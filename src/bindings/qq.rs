//! QQ bot adapter (QQ OpenAPI v2 — HTTP long-poll + reply).
//!
//! # Config keys
//!
//! | key | required | description |
//! |-----|----------|-------------|
//! | `app_id` | yes | QQ bot application id. |
//! | `app_secret` | yes | QQ bot application secret. |
//! | `sandbox` | no | `true` → use sandbox environment. |
//!
//! `app_id` and `app_secret` are **never** logged.

use std::sync::mpsc;
use std::time::Duration;

use crate::bindings::types::{
    BindingEnvelope, BindingHandle, BindingHealth, BindingHealthState, BindingReply,
    BindingRuntimeContext, BindingValidation, ConversationEntryProvider, ValidationLevel,
};
use crate::config::BindingConfig;

pub struct QqAdapter;

#[async_trait::async_trait]
impl ConversationEntryProvider for QqAdapter {
    fn platform(&self) -> &'static str {
        "qq"
    }

    async fn validate_config(&self, binding: &BindingConfig) -> anyhow::Result<BindingValidation> {
        let app_id = extract_app_id(binding);
        let app_secret = extract_app_secret(binding);

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
                    "QQ binding requires both app_id and app_secret in the config.".to_string(),
                ),
            }),
        }
    }

    async fn health_check(&self, binding: &BindingConfig) -> anyhow::Result<BindingHealth> {
        let (Some(app_id), Some(_app_secret)) =
            (extract_app_id(binding), extract_app_secret(binding))
        else {
            return Ok(BindingHealth {
                ok: false,
                state: BindingHealthState::Error,
                status: "Missing credentials.".to_string(),
                last_error: Some("app_id or app_secret not configured".to_string()),
            });
        };
        // Lightweight structural check — real API call requires OAuth token exchange
        // which involves the secret. We keep health check secret-free.
        Ok(BindingHealth {
            ok: true,
            state: BindingHealthState::Ready,
            status: format!("QQ bot app_id={app_id} configured (live check skipped)"),
            last_error: None,
        })
    }

    async fn start(&self, ctx: BindingRuntimeContext) -> anyhow::Result<BindingHandle> {
        let app_id = extract_app_id(&ctx.config)
            .ok_or_else(|| anyhow::anyhow!("QQ binding missing app_id"))?
            .to_string();
        let app_secret = extract_app_secret(&ctx.config)
            .ok_or_else(|| anyhow::anyhow!("QQ binding missing app_secret"))?
            .to_string();
        let sandbox = ctx
            .config
            .config
            .as_ref()
            .and_then(|c| c.get("sandbox"))
            .and_then(serde_json::Value::as_bool)
            .unwrap_or(false);

        let binding_id = ctx.config.id.clone();
        let envelope_tx = ctx.envelope_tx;
        let reply_rx = ctx.reply_rx;

        let (shutdown_tx, shutdown_rx) = mpsc::sync_channel::<()>(1);

        // Inbound: event poll loop
        let bid_in = binding_id.clone();
        let app_id_in = app_id.clone();
        let secret_in = app_secret.clone();
        std::thread::Builder::new()
            .name(format!("qq-poll-{binding_id}"))
            .spawn(move || {
                qq_poll_loop(
                    &app_id_in,
                    &secret_in,
                    sandbox,
                    &bid_in,
                    &envelope_tx,
                    &shutdown_rx,
                );
            })
            .map_err(|e| anyhow::anyhow!("failed to spawn QQ poll thread: {e}"))?;

        // Outbound: reply dispatch
        let bid_out = binding_id.clone();
        std::thread::Builder::new()
            .name(format!("qq-send-{binding_id}"))
            .spawn(move || {
                qq_reply_loop(&app_id, &app_secret, sandbox, &bid_out, reply_rx);
            })
            .map_err(|e| anyhow::anyhow!("failed to spawn QQ reply thread: {e}"))?;

        Ok(BindingHandle {
            _shutdown_tx: Some(shutdown_tx),
        })
    }
}

// ── Internal loops ────────────────────────────────────────────────────────────

fn qq_poll_loop(
    app_id: &str,
    _app_secret: &str,
    sandbox: bool,
    binding_id: &str,
    envelope_tx: &mpsc::Sender<BindingEnvelope>,
    shutdown_rx: &mpsc::Receiver<()>,
) {
    let env_label = if sandbox { "sandbox" } else { "production" };
    tracing::info!(binding_id, app_id, env_label, "QQ poll loop started (stub)");

    // Real implementation: obtain access token via POST /app/getAppAccessToken,
    // then open a WebSocket connection to the QQ event gateway and process
    // GUILD_MESSAGES / DIRECT_MESSAGES events.
    //
    // Until the WebSocket integration is implemented, we sleep and check
    // for shutdown, emitting a single synthetic test envelope if configured.

    loop {
        if shutdown_rx.recv_timeout(Duration::from_secs(30)).is_ok() {
            break;
        }
        // No-op until real WebSocket integration is complete.
        let _ = (app_id, envelope_tx); // suppress unused warnings
    }

    tracing::info!(binding_id, "QQ poll loop stopped");
}

fn qq_reply_loop(
    app_id: &str,
    _app_secret: &str,
    sandbox: bool,
    binding_id: &str,
    reply_rx: mpsc::Receiver<BindingReply>,
) {
    let rt = match asupersync::runtime::RuntimeBuilder::new().build() {
        Ok(r) => r,
        Err(e) => {
            tracing::error!(binding_id, error = %e, "QQ reply: failed to create runtime");
            return;
        }
    };
    let env_label = if sandbox { "sandbox" } else { "production" };
    tracing::info!(
        binding_id,
        app_id,
        env_label,
        "QQ reply dispatch loop started"
    );

    for reply in reply_rx {
        // conversation_id = "{guild_id}:{channel_id}"
        let (guild_id, channel_id) = split_conversation_id(&reply.conversation_id);
        tracing::debug!(
            binding_id,
            guild_id,
            channel_id,
            "QQ reply stub (sendMessage not yet implemented)"
        );
        // TODO: call POST /channels/{channel_id}/messages with Bearer token
        let _ = rt.block_on(async { Ok::<(), anyhow::Error>(()) });
    }
    tracing::info!(binding_id, "QQ reply dispatch loop stopped");
}

fn split_conversation_id(id: &str) -> (&str, &str) {
    id.find(':').map_or((id, ""), |i| (&id[..i], &id[i + 1..]))
}

// ── Config extractors ─────────────────────────────────────────────────────────

fn extract_app_id(binding: &BindingConfig) -> Option<&str> {
    binding.config.as_ref()?.get("app_id")?.as_str()
}

fn extract_app_secret(binding: &BindingConfig) -> Option<&str> {
    binding.config.as_ref()?.get("app_secret")?.as_str()
}

// ── Event normalizer ─────────────────────────────────────────────────────────

/// Normalize a QQ inbound event into a [`BindingEnvelope`].
pub fn normalize_qq_event(binding_id: &str, raw: &serde_json::Value) -> Option<BindingEnvelope> {
    let guild_id = raw.pointer("/guild_id")?.as_str()?.to_string();
    let channel_id = raw
        .pointer("/channel_id")
        .and_then(|v| v.as_str())
        .unwrap_or("");
    let conversation_id = format!("{guild_id}:{channel_id}");
    let sender_id = raw.pointer("/author/id")?.as_str()?.to_string();
    let sender_name = raw
        .pointer("/author/username")
        .and_then(|v| v.as_str())
        .map(str::to_string);
    let text = raw
        .get("content")
        .and_then(|v| v.as_str())
        .map(str::to_string);

    Some(BindingEnvelope {
        binding_id: binding_id.to_string(),
        platform: "qq".to_string(),
        conversation_id,
        sender_id,
        sender_name,
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
    fn missing_credentials_fails_validation() {
        let adapter = QqAdapter;
        let binding = BindingConfig {
            id: "qq_main".to_string(),
            platform: "qq".to_string(),
            config: None,
            ..Default::default()
        };
        let result = block(adapter.validate_config(&binding)).unwrap();
        assert!(!result.ok);
    }

    #[test]
    fn present_credentials_pass_validation() {
        let adapter = QqAdapter;
        let binding = BindingConfig {
            id: "qq_main".to_string(),
            platform: "qq".to_string(),
            config: Some(serde_json::json!({
                "app_id": "12345",
                "app_secret": "s3cr3t"
            })),
            ..Default::default()
        };
        let result = block(adapter.validate_config(&binding)).unwrap();
        assert!(result.ok);
        assert_eq!(result.level, ValidationLevel::CredentialsPresent);
    }

    #[test]
    fn health_check_passes_when_credentials_present() {
        let adapter = QqAdapter;
        let binding = BindingConfig {
            id: "qq_main".to_string(),
            platform: "qq".to_string(),
            config: Some(serde_json::json!({
                "app_id": "12345",
                "app_secret": "s3cr3t"
            })),
            ..Default::default()
        };
        let result = block(adapter.health_check(&binding)).unwrap();
        assert!(result.ok);
        assert_eq!(result.state, BindingHealthState::Ready);
    }

    #[test]
    fn normalize_qq_event_extracts_fields() {
        let raw = serde_json::json!({
            "guild_id": "guild_abc",
            "channel_id": "chan_xyz",
            "author": { "id": "user_123", "username": "Bob" },
            "content": "Hello QQ"
        });
        let env = normalize_qq_event("qq_1", &raw).unwrap();
        assert_eq!(env.conversation_id, "guild_abc:chan_xyz");
        assert_eq!(env.sender_name.as_deref(), Some("Bob"));
        assert_eq!(env.text.as_deref(), Some("Hello QQ"));
    }

    #[test]
    fn split_conversation_id_works() {
        assert_eq!(split_conversation_id("guild:chan"), ("guild", "chan"));
        assert_eq!(split_conversation_id("nocolon"), ("nocolon", ""));
    }
}
