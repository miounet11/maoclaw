//! Binding runtime manager + reply router.
//!
//! # Architecture
//!
//! ```text
//! Platform adapter
//!   polling/ws loop ──► envelope_tx ──► BindingRouter::run()
//!                                             │
//!                                    agent_fn(envelope) → reply_text
//!                                             │
//!                            reply_tx[binding_id] ──► adapter reply loop ──► platform API
//! ```
//!
//! The `BindingManager` wires adapters, channels, and the router together.
//! `BindingRouter` owns the main receive loop and reply dispatch.

use std::collections::HashMap;
use std::sync::{Arc, Mutex, mpsc};
use std::thread;

use crate::bindings::types::{
    BindingEnvelope, BindingHandle, BindingHealthState, BindingReply, BindingRuntimeContext,
    BindingStatusView, ConversationEntryProvider,
};
use crate::config::Config;

// ── Type aliases ──────────────────────────────────────────────────────────────

type AgentFn = Box<dyn Fn(&str, &str, Option<&str>, &str) -> String + Send + 'static>;

// ── BindingRouter ─────────────────────────────────────────────────────────────

/// Routes inbound envelopes through the agent and dispatches replies back to
/// the originating binding.
///
/// Run on a dedicated thread via `BindingRouter::spawn()`.
pub struct BindingRouter {
    /// Receives envelopes from all adapters.
    envelope_rx: mpsc::Receiver<BindingEnvelope>,
    /// Per-binding reply sender: binding_id → tx.
    reply_senders: HashMap<String, mpsc::Sender<BindingReply>>,
    /// The agent dispatch function.
    ///
    /// `(binding_id, conversation_id, sender_name, text) → reply_text`
    ///
    /// In production this calls the interactive agent loop.  For testing it can
    /// be a simple echo or mock.
    agent_fn: AgentFn,
}

impl BindingRouter {
    pub fn new(
        envelope_rx: mpsc::Receiver<BindingEnvelope>,
        reply_senders: HashMap<String, mpsc::Sender<BindingReply>>,
        agent_fn: impl Fn(&str, &str, Option<&str>, &str) -> String + Send + 'static,
    ) -> Self {
        Self {
            envelope_rx,
            reply_senders,
            agent_fn: Box::new(agent_fn),
        }
    }

    /// Spawn the router on a background thread.  Returns the thread handle.
    pub fn spawn(self) -> thread::JoinHandle<()> {
        thread::Builder::new()
            .name("binding-router".to_string())
            .spawn(move || self.run())
            .expect("failed to spawn binding router thread")
    }

    fn run(self) {
        tracing::info!("BindingRouter started");
        for envelope in &self.envelope_rx {
            let text = match &envelope.text {
                Some(t) if !t.trim().is_empty() => t.clone(),
                _ => {
                    tracing::debug!(
                        binding_id = %envelope.binding_id,
                        "skipping envelope with no text"
                    );
                    continue;
                }
            };

            let reply_text = (self.agent_fn)(
                &envelope.binding_id,
                &envelope.conversation_id,
                envelope.sender_name.as_deref(),
                &text,
            );

            let reply = BindingReply {
                binding_id: envelope.binding_id.clone(),
                conversation_id: envelope.conversation_id.clone(),
                text: reply_text,
                attachments: vec![],
                reply_to: None,
            };

            if let Some(tx) = self.reply_senders.get(&envelope.binding_id) {
                if let Err(e) = tx.send(reply) {
                    tracing::warn!(
                        binding_id = %envelope.binding_id,
                        error = %e,
                        "reply channel closed for binding"
                    );
                }
            } else {
                tracing::warn!(
                    binding_id = %envelope.binding_id,
                    "no reply sender registered for binding — reply dropped"
                );
            }
        }
        tracing::info!("BindingRouter stopped (envelope channel closed)");
    }
}

// ── BindingManager ────────────────────────────────────────────────────────────

/// Central manager for all conversation-entry bindings.
pub struct BindingManager {
    /// Registered adapter factories, keyed by platform id.
    adapters: HashMap<String, Arc<dyn ConversationEntryProvider>>,
    /// Health snapshots, keyed by binding id.
    health: Arc<Mutex<HashMap<String, BindingHealthState>>>,
    /// Active binding handles (kept alive to maintain receive loops).
    #[allow(dead_code)]
    handles: Vec<(String, BindingHandle)>,
    /// Reply senders available to the router after `start_from_config`.
    /// Keyed by binding id.
    reply_senders: HashMap<String, mpsc::Sender<BindingReply>>,
    /// Envelope sender used by adapters — the receiver goes to BindingRouter.
    envelope_tx: Option<mpsc::Sender<BindingEnvelope>>,
}

impl std::fmt::Debug for BindingManager {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("BindingManager")
            .field("adapters", &self.adapters.keys().collect::<Vec<_>>())
            .finish_non_exhaustive()
    }
}

impl BindingManager {
    #[must_use]
    pub fn new() -> Self {
        Self {
            adapters: HashMap::new(),
            health: Arc::new(Mutex::new(HashMap::new())),
            handles: Vec::new(),
            reply_senders: HashMap::new(),
            envelope_tx: None,
        }
    }

    /// Register a platform adapter.
    pub fn register(&mut self, adapter: Arc<dyn ConversationEntryProvider>) {
        let platform = adapter.platform().to_string();
        self.adapters.insert(platform, adapter);
    }

    /// Load enabled bindings from config and start their adapters.
    ///
    /// Returns the envelope receiver that should be passed to `BindingRouter`.
    /// Drops the returned `Receiver` to stop routing.
    pub async fn start_from_config(&mut self, config: &Config) -> mpsc::Receiver<BindingEnvelope> {
        let (envelope_tx, envelope_rx) = mpsc::channel::<BindingEnvelope>();
        self.envelope_tx = Some(envelope_tx.clone());

        let bindings = config.bindings.as_deref().unwrap_or(&[]);

        for binding in bindings {
            if binding.enabled != Some(true) {
                self.set_health(&binding.id, BindingHealthState::Disabled);
                continue;
            }

            let Some(adapter) = self.adapters.get(&binding.platform).cloned() else {
                tracing::warn!(
                    binding_id = %binding.id,
                    platform = %binding.platform,
                    "no adapter registered for platform — skipping"
                );
                self.set_health(&binding.id, BindingHealthState::Unknown);
                continue;
            };

            // One reply channel per binding.
            let (reply_tx, reply_rx) = mpsc::channel::<BindingReply>();
            self.reply_senders.insert(binding.id.clone(), reply_tx);

            let ctx = BindingRuntimeContext {
                config: binding.clone(),
                envelope_tx: envelope_tx.clone(),
                reply_rx,
            };

            match adapter.start(ctx).await {
                Ok(handle) => {
                    self.set_health(&binding.id, BindingHealthState::Ready);
                    self.handles.push((binding.id.clone(), handle));
                }
                Err(err) => {
                    tracing::warn!(
                        binding_id = %binding.id,
                        error = %err,
                        "binding failed to start"
                    );
                    self.set_health(&binding.id, BindingHealthState::Error);
                }
            }
        }

        envelope_rx
    }

    /// Build a `BindingRouter` with the given agent dispatch function, then
    /// spawn it.  Must be called after `start_from_config`.
    ///
    /// The `agent_fn` receives `(binding_id, conversation_id, sender_name, text)`
    /// and returns the reply text.
    pub fn spawn_router(
        &mut self,
        envelope_rx: mpsc::Receiver<BindingEnvelope>,
        agent_fn: impl Fn(&str, &str, Option<&str>, &str) -> String + Send + 'static,
    ) -> thread::JoinHandle<()> {
        let reply_senders = std::mem::take(&mut self.reply_senders);
        BindingRouter::new(envelope_rx, reply_senders, agent_fn).spawn()
    }

    /// Send a direct reply to a binding (bypass router — for testing).
    pub fn send_reply(&self, reply: BindingReply) -> anyhow::Result<()> {
        let tx = self
            .reply_senders
            .get(&reply.binding_id)
            .ok_or_else(|| anyhow::anyhow!("no reply sender for binding {}", reply.binding_id))?;
        tx.send(reply)
            .map_err(|e| anyhow::anyhow!("reply channel closed: {e}"))
    }

    /// Snapshot of binding health states for the TUI status rail.
    #[must_use]
    pub fn status_views(&self, config: &Config) -> Vec<BindingStatusView> {
        let health = self
            .health
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner);
        config
            .bindings
            .as_deref()
            .unwrap_or(&[])
            .iter()
            .map(|b| BindingStatusView {
                id: b.id.clone(),
                platform: b.platform.clone(),
                agent_profile: b
                    .agent_profile
                    .clone()
                    .unwrap_or_else(|| "main".to_string()),
                health: health.get(&b.id).copied().unwrap_or_default(),
                enabled: b.enabled.unwrap_or(false),
            })
            .collect()
    }

    fn set_health(&self, id: &str, state: BindingHealthState) {
        if let Ok(mut map) = self.health.lock() {
            map.insert(id.to_string(), state);
        }
    }
}

impl Default for BindingManager {
    fn default() -> Self {
        Self::new()
    }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::bindings::types::{BindingHealth, BindingValidation, ValidationLevel};
    use crate::config::BindingConfig;

    struct EchoAdapter;

    #[async_trait::async_trait]
    impl ConversationEntryProvider for EchoAdapter {
        fn platform(&self) -> &'static str {
            "echo"
        }

        async fn validate_config(&self, _b: &BindingConfig) -> anyhow::Result<BindingValidation> {
            Ok(BindingValidation {
                ok: true,
                level: ValidationLevel::CredentialsPresent,
                message: None,
            })
        }

        async fn health_check(&self, _b: &BindingConfig) -> anyhow::Result<BindingHealth> {
            Ok(BindingHealth {
                ok: true,
                state: BindingHealthState::Ready,
                status: "ok".to_string(),
                last_error: None,
            })
        }

        async fn start(&self, ctx: BindingRuntimeContext) -> anyhow::Result<BindingHandle> {
            // Send one test envelope and then drain replies.
            let envelope_tx = ctx.envelope_tx.clone();
            let binding_id = ctx.config.id.clone();
            let (shutdown_tx, shutdown_rx) = mpsc::sync_channel::<()>(1);
            std::thread::spawn(move || {
                let _ = envelope_tx.send(BindingEnvelope {
                    binding_id: binding_id.clone(),
                    platform: "echo".to_string(),
                    conversation_id: "conv_1".to_string(),
                    sender_id: "user_1".to_string(),
                    sender_name: Some("Alice".to_string()),
                    text: Some("hello".to_string()),
                    attachments: vec![],
                    reply_context: None,
                    raw: serde_json::Value::Null,
                });
                // Drain replies (don't block test)
                let _rx = ctx.reply_rx;
                let _ = shutdown_rx.recv();
            });
            Ok(BindingHandle {
                _shutdown_tx: Some(shutdown_tx),
            })
        }
    }

    fn block<F: std::future::Future>(f: F) -> F::Output {
        asupersync::runtime::RuntimeBuilder::new()
            .build()
            .expect("runtime")
            .block_on(f)
    }

    #[test]
    fn manager_starts_echo_binding() {
        let mut manager = BindingManager::new();
        manager.register(Arc::new(EchoAdapter));

        let config = Config {
            bindings: Some(vec![BindingConfig {
                id: "echo_1".to_string(),
                platform: "echo".to_string(),
                enabled: Some(true),
                config: None,
                ..Default::default()
            }]),
            ..Default::default()
        };

        let envelope_rx = block(manager.start_from_config(&config));
        // Should receive the one test envelope from EchoAdapter
        let env = envelope_rx
            .recv_timeout(std::time::Duration::from_secs(2))
            .unwrap();
        assert_eq!(env.text.as_deref(), Some("hello"));
    }

    #[test]
    fn router_dispatches_and_replies() {
        let (envelope_tx, envelope_rx) = mpsc::channel::<BindingEnvelope>();
        let (reply_tx, reply_rx) = mpsc::channel::<BindingReply>();

        let mut reply_senders = HashMap::new();
        reply_senders.insert("tg_1".to_string(), reply_tx);

        let router = BindingRouter::new(envelope_rx, reply_senders, |_bid, _cid, _name, text| {
            format!("echo: {text}")
        });
        let _handle = router.spawn();

        envelope_tx
            .send(BindingEnvelope {
                binding_id: "tg_1".to_string(),
                platform: "telegram".to_string(),
                conversation_id: "chat_123".to_string(),
                sender_id: "u1".to_string(),
                sender_name: None,
                text: Some("ping".to_string()),
                attachments: vec![],
                reply_context: None,
                raw: serde_json::Value::Null,
            })
            .unwrap();

        let reply = reply_rx
            .recv_timeout(std::time::Duration::from_secs(2))
            .unwrap();
        assert_eq!(reply.text, "echo: ping");
        assert_eq!(reply.conversation_id, "chat_123");
    }

    #[test]
    fn router_skips_empty_text() {
        let (envelope_tx, envelope_rx) = mpsc::channel::<BindingEnvelope>();
        let (reply_tx, reply_rx) = mpsc::channel::<BindingReply>();
        let mut reply_senders = HashMap::new();
        reply_senders.insert("b1".to_string(), reply_tx);
        let router = BindingRouter::new(envelope_rx, reply_senders, |_, _, _, _| "x".to_string());
        let _handle = router.spawn();

        envelope_tx
            .send(BindingEnvelope {
                binding_id: "b1".to_string(),
                platform: "test".to_string(),
                conversation_id: "c1".to_string(),
                sender_id: "s1".to_string(),
                sender_name: None,
                text: None,
                attachments: vec![],
                reply_context: None,
                raw: serde_json::Value::Null,
            })
            .unwrap();
        drop(envelope_tx);

        // No reply should arrive
        assert!(
            reply_rx
                .recv_timeout(std::time::Duration::from_millis(200))
                .is_err()
        );
    }
}
