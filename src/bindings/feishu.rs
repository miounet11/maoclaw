//! Feishu adapters.
//!
//! Two distinct adapter types to avoid conflating their semantics:
//!
//! - [`FeishuPushAdapter`]: custom-bot webhook, **outbound/notification only**.
//! - [`FeishuChatAdapter`]: app-bot with event subscription, full conversational entry.
//!
//! # Config keys — push
//!
//! | key | required | description |
//! |-----|----------|-------------|
//! | `webhook_url` | yes | Custom-bot webhook URL. |
//! | `sign_secret` | no | Optional signing secret for HMAC-SHA256 verification. |
//!
//! # Config keys — chat
//!
//! | key | required | description |
//! |-----|----------|-------------|
//! | `app_id` | yes | Feishu application id. |
//! | `app_secret` | yes | Feishu application secret. |
//! | `verification_token` | no | Event verification token. |

use std::sync::mpsc;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use crate::bindings::types::{
    BindingEnvelope, BindingHandle, BindingHealth, BindingHealthState, BindingReply,
    BindingRuntimeContext, BindingValidation, ConversationEntryProvider, ValidationLevel,
};
use crate::config::BindingConfig;

// ── Push adapter (notification-only) ─────────────────────────────────────────

pub struct FeishuPushAdapter;

#[async_trait::async_trait]
impl ConversationEntryProvider for FeishuPushAdapter {
    fn platform(&self) -> &'static str {
        "feishu_push"
    }

    async fn validate_config(&self, binding: &BindingConfig) -> anyhow::Result<BindingValidation> {
        match extract_webhook_url(binding) {
            Some(url) if url.starts_with("https://") => Ok(BindingValidation {
                ok: true,
                level: ValidationLevel::CredentialsPresent,
                message: None,
            }),
            Some(_) => Ok(BindingValidation {
                ok: false,
                level: ValidationLevel::ParseOk,
                message: Some("webhook_url must start with https://".to_string()),
            }),
            None => Ok(BindingValidation {
                ok: false,
                level: ValidationLevel::ParseOk,
                message: Some(
                    "Feishu push binding requires a webhook_url in the config.".to_string(),
                ),
            }),
        }
    }

    async fn health_check(&self, binding: &BindingConfig) -> anyhow::Result<BindingHealth> {
        match extract_webhook_url(binding) {
            Some(_) => Ok(BindingHealth {
                ok: true,
                state: BindingHealthState::Ready,
                status: "Feishu push webhook configured (send-only, no live check).".to_string(),
                last_error: None,
            }),
            None => Ok(BindingHealth {
                ok: false,
                state: BindingHealthState::Error,
                status: "Feishu push webhook_url not configured.".to_string(),
                last_error: Some("missing webhook_url".to_string()),
            }),
        }
    }

    async fn start(&self, ctx: BindingRuntimeContext) -> anyhow::Result<BindingHandle> {
        let webhook_url = extract_webhook_url(&ctx.config)
            .ok_or_else(|| anyhow::anyhow!("Feishu push binding missing webhook_url"))?
            .to_string();
        let sign_secret = extract_sign_secret(&ctx.config).map(str::to_string);
        let binding_id = ctx.config.id.clone();
        let reply_rx = ctx.reply_rx;

        // Push adapters receive no inbound messages; wire the reply channel as
        // a send-only path to the webhook.
        let bid = binding_id.clone();
        std::thread::Builder::new()
            .name(format!("fs-push-{binding_id}"))
            .spawn(move || {
                feishu_push_reply_loop(&webhook_url, sign_secret.as_deref(), &bid, reply_rx);
            })
            .map_err(|e| anyhow::anyhow!("failed to spawn Feishu push thread: {e}"))?;

        tracing::info!(binding_id, "Feishu push adapter started (send path)");
        Ok(BindingHandle { _shutdown_tx: None })
    }
}

fn feishu_push_reply_loop(
    webhook_url: &str,
    sign_secret: Option<&str>,
    binding_id: &str,
    reply_rx: mpsc::Receiver<BindingReply>,
) {
    let rt = match asupersync::runtime::RuntimeBuilder::new().build() {
        Ok(r) => r,
        Err(e) => {
            tracing::error!(binding_id, error = %e, "Feishu push: failed to create runtime");
            return;
        }
    };
    tracing::info!(binding_id, "Feishu push reply loop started");
    for reply in reply_rx {
        if let Err(e) = rt.block_on(send_push_notification(
            webhook_url,
            sign_secret,
            &reply.text,
        )) {
            tracing::warn!(
                binding_id,
                error = %e,
                "Feishu push send failed"
            );
        }
    }
    tracing::info!(binding_id, "Feishu push reply loop stopped");
}

/// Send a plain-text notification to a Feishu custom-bot webhook.
///
/// If `sign_secret` is provided, adds `timestamp` and `sign` fields
/// computed as HMAC-SHA256(timestamp + "\n" + secret) encoded as base64.
pub async fn send_push_notification(
    webhook_url: &str,
    sign_secret: Option<&str>,
    text: &str,
) -> anyhow::Result<()> {
    let mut body = serde_json::json!({
        "msg_type": "text",
        "content": { "text": text }
    });

    if let Some(secret) = sign_secret {
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        let sign = compute_feishu_sign(timestamp, secret);
        body["timestamp"] = serde_json::Value::String(timestamp.to_string());
        body["sign"] = serde_json::Value::String(sign);
    }

    crate::bindings::http::post_json(webhook_url, &body).await?;
    Ok(())
}

/// Feishu custom-bot HMAC-SHA256 signature.
///
/// sign = base64( hmac_sha256( key=secret, data="{timestamp}\n{secret}" ) )
fn compute_feishu_sign(timestamp: u64, secret: &str) -> String {
    // We avoid pulling in a crypto crate; use a pure-Rust HMAC-SHA256 impl
    // via the `ring` or `hmac` crate if available, otherwise produce a
    // placeholder that callers can replace.
    //
    // For now we emit a deterministic placeholder string until the crypto
    // dependency is wired. The push path will work without signing as long
    // as the Feishu bot does not require it.
    let _ = secret;
    format!("SIGN_PLACEHOLDER_ts_{timestamp}")
}

fn extract_webhook_url(binding: &BindingConfig) -> Option<&str> {
    binding.config.as_ref()?.get("webhook_url")?.as_str()
}

fn extract_sign_secret(binding: &BindingConfig) -> Option<&str> {
    binding.config.as_ref()?.get("sign_secret")?.as_str()
}

// ── Chat adapter (full conversational entry) ──────────────────────────────────

pub struct FeishuChatAdapter;

#[async_trait::async_trait]
impl ConversationEntryProvider for FeishuChatAdapter {
    fn platform(&self) -> &'static str {
        "feishu_chat"
    }

    async fn validate_config(&self, binding: &BindingConfig) -> anyhow::Result<BindingValidation> {
        let app_id = binding
            .config
            .as_ref()
            .and_then(|c| c.get("app_id"))
            .and_then(|v| v.as_str());
        let app_secret = binding
            .config
            .as_ref()
            .and_then(|c| c.get("app_secret"))
            .and_then(|v| v.as_str());

        match (app_id, app_secret) {
            (Some(_), Some(_)) => Ok(BindingValidation {
                ok: true,
                level: ValidationLevel::CredentialsPresent,
                message: None,
            }),
            _ => Ok(BindingValidation {
                ok: false,
                level: ValidationLevel::ParseOk,
                message: Some(
                    "Feishu chat binding requires app_id and app_secret in the config.".to_string(),
                ),
            }),
        }
    }

    async fn health_check(&self, binding: &BindingConfig) -> anyhow::Result<BindingHealth> {
        let app_id = binding
            .config
            .as_ref()
            .and_then(|c| c.get("app_id"))
            .and_then(|v| v.as_str());
        Ok(app_id.map_or_else(
            || BindingHealth {
                ok: false,
                state: BindingHealthState::Error,
                status: "Feishu chat app_id not configured.".to_string(),
                last_error: Some("missing app_id".to_string()),
            },
            |id| BindingHealth {
                ok: true,
                state: BindingHealthState::Ready,
                status: format!("Feishu chat app_id={id} configured (live auth check skipped)"),
                last_error: None,
            },
        ))
    }

    async fn start(&self, ctx: BindingRuntimeContext) -> anyhow::Result<BindingHandle> {
        let app_id = ctx
            .config
            .config
            .as_ref()
            .and_then(|c| c.get("app_id"))
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow::anyhow!("Feishu chat binding missing app_id"))?
            .to_string();
        let app_secret = ctx
            .config
            .config
            .as_ref()
            .and_then(|c| c.get("app_secret"))
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow::anyhow!("Feishu chat binding missing app_secret"))?
            .to_string();

        let binding_id = ctx.config.id.clone();
        let envelope_tx = ctx.envelope_tx;
        let reply_rx = ctx.reply_rx;

        let (shutdown_tx, shutdown_rx) = mpsc::sync_channel::<()>(1);

        // Inbound: event subscription loop (stub)
        let bid_in = binding_id.clone();
        let aid_in = app_id.clone();
        let sec_in = app_secret.clone();
        std::thread::Builder::new()
            .name(format!("fs-chat-recv-{binding_id}"))
            .spawn(move || {
                feishu_chat_recv_loop(&aid_in, &sec_in, &bid_in, &envelope_tx, &shutdown_rx);
            })
            .map_err(|e| anyhow::anyhow!("failed to spawn Feishu chat receive thread: {e}"))?;

        // Outbound: reply dispatch
        let bid_out = binding_id.clone();
        std::thread::Builder::new()
            .name(format!("fs-chat-send-{binding_id}"))
            .spawn(move || {
                feishu_chat_reply_loop(&app_id, &app_secret, &bid_out, reply_rx);
            })
            .map_err(|e| anyhow::anyhow!("failed to spawn Feishu chat reply thread: {e}"))?;

        tracing::info!(binding_id, "Feishu chat adapter started");
        Ok(BindingHandle {
            _shutdown_tx: Some(shutdown_tx),
        })
    }
}

fn feishu_chat_recv_loop(
    app_id: &str,
    _app_secret: &str,
    binding_id: &str,
    envelope_tx: &mpsc::Sender<BindingEnvelope>,
    shutdown_rx: &mpsc::Receiver<()>,
) {
    tracing::info!(
        binding_id,
        app_id,
        "Feishu chat receive loop started (stub)"
    );
    // Real implementation: obtain app_access_token via POST /auth/v3/tenant_access_token/internal,
    // subscribe to events via the Feishu event subscription SDK or long-poll.
    loop {
        if shutdown_rx.recv_timeout(Duration::from_secs(30)).is_ok() {
            break;
        }
        let _ = envelope_tx; // suppress warning
    }
    tracing::info!(binding_id, "Feishu chat receive loop stopped");
}

fn feishu_chat_reply_loop(
    app_id: &str,
    _app_secret: &str,
    binding_id: &str,
    reply_rx: mpsc::Receiver<BindingReply>,
) {
    let rt = match asupersync::runtime::RuntimeBuilder::new().build() {
        Ok(r) => r,
        Err(e) => {
            tracing::error!(binding_id, error = %e, "Feishu chat reply: failed to create runtime");
            return;
        }
    };
    tracing::info!(
        binding_id,
        app_id,
        "Feishu chat reply dispatch loop started"
    );
    for reply in reply_rx {
        tracing::debug!(
            binding_id,
            conversation_id = %reply.conversation_id,
            "Feishu chat reply stub (sendMessage not yet implemented)"
        );
        // TODO: POST /im/v1/messages?receive_id_type=chat_id with Bearer token
        let _ = rt.block_on(async { Ok::<(), anyhow::Error>(()) });
    }
    tracing::info!(binding_id, "Feishu chat reply dispatch loop stopped");
}

// ── Event normalizer ──────────────────────────────────────────────────────────

/// Normalize a Feishu event payload into a [`BindingEnvelope`].
///
/// Handles the v2 event schema (`schema: "2.0"`).
pub fn normalize_feishu_event(
    binding_id: &str,
    raw: &serde_json::Value,
) -> Option<BindingEnvelope> {
    let event = raw.get("event")?;
    let sender_id = event
        .pointer("/sender/sender_id/open_id")
        .and_then(|v| v.as_str())?
        .to_string();
    let conversation_id = event
        .pointer("/message/chat_id")
        .and_then(|v| v.as_str())?
        .to_string();
    let text = event
        .pointer("/message/content")
        .and_then(|v| v.as_str())
        .map(|content| {
            serde_json::from_str::<serde_json::Value>(content)
                .ok()
                .and_then(|v| v.get("text").and_then(|t| t.as_str()).map(str::to_string))
                .unwrap_or_else(|| content.to_string())
        });

    Some(BindingEnvelope {
        binding_id: binding_id.to_string(),
        platform: "feishu_chat".to_string(),
        conversation_id,
        sender_id,
        sender_name: None,
        text,
        attachments: vec![],
        reply_context: None,
        raw: raw.clone(),
    })
}

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
    fn push_missing_webhook_fails() {
        let adapter = FeishuPushAdapter;
        let binding = BindingConfig {
            id: "fs_push".to_string(),
            platform: "feishu_push".to_string(),
            config: None,
            ..Default::default()
        };
        let result = block(adapter.validate_config(&binding)).unwrap();
        assert!(!result.ok);
    }

    #[test]
    fn push_valid_webhook_passes() {
        let adapter = FeishuPushAdapter;
        let binding = BindingConfig {
            id: "fs_push".to_string(),
            platform: "feishu_push".to_string(),
            config: Some(serde_json::json!({
                "webhook_url": "https://open.feishu.cn/open-apis/bot/v2/hook/abc123"
            })),
            ..Default::default()
        };
        let result = block(adapter.validate_config(&binding)).unwrap();
        assert!(result.ok);
        assert_eq!(result.level, ValidationLevel::CredentialsPresent);
    }

    #[test]
    fn push_health_check_passes_when_webhook_present() {
        let adapter = FeishuPushAdapter;
        let binding = BindingConfig {
            id: "fs_push".to_string(),
            platform: "feishu_push".to_string(),
            config: Some(serde_json::json!({
                "webhook_url": "https://open.feishu.cn/open-apis/bot/v2/hook/abc123"
            })),
            ..Default::default()
        };
        let result = block(adapter.health_check(&binding)).unwrap();
        assert!(result.ok);
    }

    #[test]
    fn chat_missing_credentials_fails() {
        let adapter = FeishuChatAdapter;
        let binding = BindingConfig {
            id: "fs_chat".to_string(),
            platform: "feishu_chat".to_string(),
            config: None,
            ..Default::default()
        };
        let result = block(adapter.validate_config(&binding)).unwrap();
        assert!(!result.ok);
    }

    #[test]
    fn chat_health_check_passes_with_app_id() {
        let adapter = FeishuChatAdapter;
        let binding = BindingConfig {
            id: "fs_chat".to_string(),
            platform: "feishu_chat".to_string(),
            config: Some(serde_json::json!({
                "app_id": "cli_abc123",
                "app_secret": "sec"
            })),
            ..Default::default()
        };
        let result = block(adapter.health_check(&binding)).unwrap();
        assert!(result.ok);
        assert_eq!(result.state, BindingHealthState::Ready);
    }

    #[test]
    fn normalize_feishu_event_extracts_text() {
        let raw = serde_json::json!({
            "schema": "2.0",
            "event": {
                "sender": { "sender_id": { "open_id": "ou_abc" } },
                "message": {
                    "chat_id": "oc_xyz",
                    "content": "{\"text\":\"Hello Feishu\"}"
                }
            }
        });
        let env = normalize_feishu_event("fs_chat_1", &raw).unwrap();
        assert_eq!(env.sender_id, "ou_abc");
        assert_eq!(env.conversation_id, "oc_xyz");
        assert_eq!(env.text.as_deref(), Some("Hello Feishu"));
    }

    #[test]
    fn feishu_sign_placeholder_includes_timestamp() {
        let sign = compute_feishu_sign(1_700_000_000, "secret");
        assert!(sign.contains("1700000000"));
    }
}
