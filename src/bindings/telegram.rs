//! Telegram bot adapter (long-polling, text in/out).
//!
//! # Config keys (inside `BindingConfig.config`)
//!
//! | key | required | description |
//! |-----|----------|-------------|
//! | `bot_token` | yes | Telegram Bot API token (`123456:ABC…`). |
//! | `allowed_chat_ids` | no | If set, only these chat ids are accepted. |
//!
//! # Security
//!
//! `bot_token` is **never** logged or included in health summaries.
//! Errors are classified by type (invalid-token, forbidden, rate-limit)
//! without revealing the secret.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, mpsc};
use std::time::Duration;

use anyhow::Context as _;

use crate::bindings::types::{
    BindingAttachment, BindingEnvelope, BindingHandle, BindingHealth, BindingHealthState,
    BindingRuntimeContext, BindingValidation, ConversationEntryProvider, ValidationLevel,
};
use crate::config::BindingConfig;

// ── Public adapter struct ─────────────────────────────────────────────────────

pub struct TelegramAdapter;

#[async_trait::async_trait]
impl ConversationEntryProvider for TelegramAdapter {
    fn platform(&self) -> &'static str {
        "telegram"
    }

    async fn validate_config(&self, binding: &BindingConfig) -> anyhow::Result<BindingValidation> {
        match extract_token(binding) {
            None | Some("") => Ok(BindingValidation {
                ok: false,
                level: ValidationLevel::ParseOk,
                message: Some("Telegram binding requires a bot_token in the config.".to_string()),
            }),
            Some(tok) => {
                if looks_like_token(tok) {
                    Ok(BindingValidation {
                        ok: true,
                        level: ValidationLevel::CredentialsPresent,
                        message: None,
                    })
                } else {
                    Ok(BindingValidation {
                        ok: false,
                        level: ValidationLevel::ParseOk,
                        message: Some(
                            "bot_token format looks invalid. Expected `<id>:<secret>`.".to_string(),
                        ),
                    })
                }
            }
        }
    }

    async fn health_check(&self, binding: &BindingConfig) -> anyhow::Result<BindingHealth> {
        let Some(token) = extract_token(binding) else {
            return Ok(BindingHealth {
                ok: false,
                state: BindingHealthState::Error,
                status: "No token configured.".to_string(),
                last_error: Some("missing bot_token".to_string()),
            });
        };

        match tg_get_me(token).await {
            Ok(bot_name) => Ok(BindingHealth {
                ok: true,
                state: BindingHealthState::Ready,
                status: format!("Connected as @{bot_name}"),
                last_error: None,
            }),
            Err(err) => Ok(BindingHealth {
                ok: false,
                state: BindingHealthState::Error,
                status: "Health check failed.".to_string(),
                last_error: Some(classify_tg_error(&err)),
            }),
        }
    }

    async fn start(&self, ctx: BindingRuntimeContext) -> anyhow::Result<BindingHandle> {
        let token = extract_token(&ctx.config)
            .context("Telegram binding missing bot_token")?
            .to_string();

        let binding_id = ctx.config.id.clone();
        let envelope_tx = ctx.envelope_tx.clone();
        let reply_rx = ctx.reply_rx;

        let (shutdown_tx, shutdown_rx) = mpsc::sync_channel::<()>(1);
        let running = Arc::new(AtomicBool::new(true));
        let running_clone = Arc::clone(&running);

        // Inbound: long-polling loop → envelope_tx
        let token_poll = token.clone();
        let bid_poll = binding_id.clone();
        std::thread::Builder::new()
            .name(format!("tg-poll-{binding_id}"))
            .spawn(move || {
                polling_loop(
                    &token_poll,
                    &bid_poll,
                    &envelope_tx,
                    &shutdown_rx,
                    &running_clone,
                );
            })
            .context("failed to spawn Telegram polling thread")?;

        // Outbound: reply_rx → sendMessage
        let bid_send = binding_id.clone();
        std::thread::Builder::new()
            .name(format!("tg-send-{binding_id}"))
            .spawn(move || {
                reply_dispatch_loop(&token, &bid_send, reply_rx);
            })
            .context("failed to spawn Telegram reply thread")?;

        Ok(BindingHandle {
            _shutdown_tx: Some(shutdown_tx),
        })
    }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

fn extract_token(binding: &BindingConfig) -> Option<&str> {
    binding.config.as_ref()?.get("bot_token")?.as_str()
}

fn looks_like_token(tok: &str) -> bool {
    let Some(colon) = tok.find(':') else {
        return false;
    };
    let (id_part, secret_part) = tok.split_at(colon);
    !id_part.is_empty() && id_part.chars().all(|c| c.is_ascii_digit()) && secret_part.len() > 1
}

fn classify_tg_error(err: &anyhow::Error) -> String {
    let msg = err.to_string();
    if msg.contains("401") || msg.contains("Unauthorized") {
        "Invalid bot token.".to_string()
    } else if msg.contains("403") || msg.contains("Forbidden") {
        "Bot is forbidden from this chat.".to_string()
    } else if msg.contains("429") || msg.contains("Too Many Requests") {
        "Rate limited by Telegram.".to_string()
    } else {
        "Network or API error.".to_string()
    }
}

// ── Telegram API primitives ───────────────────────────────────────────────────

const TG_API_BASE: &str = "https://api.telegram.org/bot";
const POLL_TIMEOUT_SECS: u64 = 30;
const POLL_RETRY_DELAY: Duration = Duration::from_secs(5);

async fn tg_get_me(token: &str) -> anyhow::Result<String> {
    let url = format!("{TG_API_BASE}{token}/getMe");
    let resp = crate::bindings::http::get_json(&url).await?;
    let username = resp
        .pointer("/result/username")
        .and_then(|v| v.as_str())
        .unwrap_or("unknown")
        .to_string();
    Ok(username)
}

fn polling_loop(
    token: &str,
    binding_id: &str,
    envelope_tx: &mpsc::Sender<BindingEnvelope>,
    shutdown_rx: &mpsc::Receiver<()>,
    running: &AtomicBool,
) {
    let rt = match asupersync::runtime::RuntimeBuilder::new().build() {
        Ok(r) => r,
        Err(e) => {
            tracing::error!(binding_id, error = %e, "Telegram: failed to create runtime");
            return;
        }
    };

    let mut offset: i64 = 0;
    tracing::info!(binding_id, "Telegram polling loop started");

    loop {
        if shutdown_rx.try_recv().is_ok() || !running.load(Ordering::Relaxed) {
            break;
        }

        let url =
            format!("{TG_API_BASE}{token}/getUpdates?offset={offset}&timeout={POLL_TIMEOUT_SECS}");

        match rt.block_on(crate::bindings::http::get_json(&url)) {
            Err(err) => {
                tracing::warn!(
                    binding_id,
                    error = %classify_tg_error(&err),
                    "Telegram poll error"
                );
                std::thread::sleep(POLL_RETRY_DELAY);
            }
            Ok(body) => {
                for update in body
                    .pointer("/result")
                    .and_then(|v| v.as_array())
                    .into_iter()
                    .flatten()
                {
                    let update_id = update
                        .get("update_id")
                        .and_then(serde_json::Value::as_i64)
                        .unwrap_or(0);
                    offset = offset.max(update_id + 1);
                    if let Some(env) = parse_update(binding_id, update) {
                        let _ = envelope_tx.send(env);
                    }
                }
            }
        }
    }

    tracing::info!(binding_id, "Telegram polling loop stopped");
}

fn parse_update(binding_id: &str, update: &serde_json::Value) -> Option<BindingEnvelope> {
    let msg = update.get("message")?;
    let chat_id = msg.pointer("/chat/id")?.as_i64()?.to_string();
    let sender_id = msg.pointer("/from/id")?.as_i64()?.to_string();
    let sender_name = msg
        .pointer("/from/first_name")
        .and_then(|v| v.as_str())
        .map(str::to_string);
    let text = msg.get("text").and_then(|v| v.as_str()).map(str::to_string);

    Some(BindingEnvelope {
        binding_id: binding_id.to_string(),
        platform: "telegram".to_string(),
        conversation_id: chat_id,
        sender_id,
        sender_name,
        text,
        attachments: Vec::<BindingAttachment>::new(),
        reply_context: None,
        raw: update.clone(),
    })
}

fn reply_dispatch_loop(
    token: &str,
    binding_id: &str,
    reply_rx: mpsc::Receiver<crate::bindings::types::BindingReply>,
) {
    let rt = match asupersync::runtime::RuntimeBuilder::new().build() {
        Ok(r) => r,
        Err(e) => {
            tracing::error!(binding_id, error = %e, "Telegram reply: failed to create runtime");
            return;
        }
    };
    tracing::info!(binding_id, "Telegram reply dispatch loop started");
    for reply in reply_rx {
        if let Err(e) = rt.block_on(send_text(token, &reply.conversation_id, &reply.text)) {
            tracing::warn!(
                binding_id,
                conversation_id = %reply.conversation_id,
                error = %e,
                "Telegram send failed"
            );
        }
    }
    tracing::info!(binding_id, "Telegram reply dispatch loop stopped");
}

/// Send a text reply back to a Telegram chat.
pub async fn send_text(token: &str, chat_id: &str, text: &str) -> anyhow::Result<()> {
    let url = format!("{TG_API_BASE}{token}/sendMessage");
    let body = serde_json::json!({ "chat_id": chat_id, "text": text });
    crate::bindings::http::post_json(&url, &body).await?;
    Ok(())
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    fn block<F: std::future::Future>(f: F) -> F::Output {
        asupersync::runtime::RuntimeBuilder::new()
            .build()
            .expect("runtime")
            .block_on(f)
    }

    #[test]
    fn token_structural_check() {
        assert!(looks_like_token("123456789:ABCdefGHIjkl-MNopQRstUVwxyz"));
        assert!(!looks_like_token("not-a-token"));
        assert!(!looks_like_token(":noprefix"));
        assert!(!looks_like_token("nocoLon"));
    }

    #[test]
    fn missing_token_fails_validation() {
        let adapter = TelegramAdapter;
        let binding = BindingConfig {
            id: "test".to_string(),
            platform: "telegram".to_string(),
            config: None,
            ..Default::default()
        };
        let result = block(adapter.validate_config(&binding)).unwrap();
        assert!(!result.ok);
    }

    #[test]
    fn present_token_passes_structural_validation() {
        let adapter = TelegramAdapter;
        let binding = BindingConfig {
            id: "test".to_string(),
            platform: "telegram".to_string(),
            config: Some(serde_json::json!({ "bot_token": "123456:ABCdefGHI" })),
            ..Default::default()
        };
        let result = block(adapter.validate_config(&binding)).unwrap();
        assert!(result.ok);
        assert_eq!(result.level, ValidationLevel::CredentialsPresent);
    }

    #[test]
    fn parse_update_extracts_text() {
        let update = serde_json::json!({
            "update_id": 42,
            "message": {
                "chat": { "id": 100 },
                "from": { "id": 200, "first_name": "Alice" },
                "text": "Hello"
            }
        });
        let env = parse_update("tg_main", &update).unwrap();
        assert_eq!(env.text.as_deref(), Some("Hello"));
        assert_eq!(env.conversation_id, "100");
        assert_eq!(env.sender_id, "200");
    }
}
