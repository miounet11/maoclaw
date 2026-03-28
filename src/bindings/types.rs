//! Shared protocol types for conversation-entry bindings.
//!
//! All platform-specific adapters (Telegram, QQ, Feishu …) normalize their
//! inbound events into [`BindingEnvelope`] and send outbound replies via
//! [`BindingReply`].

use serde::{Deserialize, Serialize};

// ── Envelope / reply ──────────────────────────────────────────────────────────

/// Normalized inbound message from any external platform.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BindingEnvelope {
    /// Id of the binding that produced this envelope.
    pub binding_id: String,
    /// Platform identifier ("telegram", "qq", "feishu_push", "feishu_chat").
    pub platform: String,
    /// Platform-native conversation/chat id, stable across messages.
    pub conversation_id: String,
    /// Platform-native sender id.
    pub sender_id: String,
    /// Sender display name, if available.
    pub sender_name: Option<String>,
    /// Plain-text message content.
    pub text: Option<String>,
    /// Any attachments (images, files, …).
    pub attachments: Vec<BindingAttachment>,
    /// Reply threading context, if the message was a reply to another message.
    pub reply_context: Option<BindingReplyContext>,
    /// Raw platform event for debugging (must not be logged at info level).
    pub raw: serde_json::Value,
}

/// Attachment in an inbound envelope.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BindingAttachment {
    pub kind: BindingAttachmentKind,
    pub name: Option<String>,
    pub mime_type: Option<String>,
    pub remote_url: Option<String>,
    pub platform_file_id: Option<String>,
}

/// Attachment type.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum BindingAttachmentKind {
    Image,
    Document,
    Audio,
    Video,
    Other,
}

/// Thread context for a reply-to-message.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BindingReplyContext {
    /// Platform-native message id being replied to.
    pub replied_to_id: String,
}

/// Outbound reply to send back through a binding.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BindingReply {
    pub binding_id: String,
    pub conversation_id: String,
    pub text: String,
    pub attachments: Vec<BindingOutboundAttachment>,
    /// If set, the reply is threaded to this platform message id.
    pub reply_to: Option<String>,
}

/// Outbound attachment placeholder (MVP: text-only).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BindingOutboundAttachment {
    pub kind: BindingAttachmentKind,
    pub name: Option<String>,
    pub url: Option<String>,
}

// ── Binding kinds ─────────────────────────────────────────────────────────────

/// Explicit binding type to avoid conflating push-only and full-chat adapters.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum BindingKind {
    TelegramBot,
    QqBot,
    /// Feishu custom-bot webhook push (outbound only).
    FeishuPush,
    /// Feishu app-bot with event subscription (full conversational entry).
    FeishuChat,
}

impl BindingKind {
    /// Canonical platform string used in config and logging.
    #[must_use]
    pub const fn platform_str(self) -> &'static str {
        match self {
            Self::TelegramBot => "telegram",
            Self::QqBot => "qq",
            Self::FeishuPush => "feishu_push",
            Self::FeishuChat => "feishu_chat",
        }
    }
}

// ── Validation ────────────────────────────────────────────────────────────────

/// Result of structural config validation (no network required).
#[derive(Debug, Clone)]
pub struct BindingValidation {
    pub ok: bool,
    pub level: ValidationLevel,
    /// User-facing message (secrets must be redacted).
    pub message: Option<String>,
}

/// Validation depth achieved.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum ValidationLevel {
    ParseOk,
    CredentialsPresent,
    RemoteHealthOk,
}

// ── Health ────────────────────────────────────────────────────────────────────

/// Runtime health state of an active binding.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum BindingHealthState {
    #[default]
    Unknown,
    Ready,
    Warning,
    Error,
    Disabled,
}

impl BindingHealthState {
    /// UI status label aligned with copy deck.
    #[must_use]
    pub const fn status_label(self) -> &'static str {
        match self {
            Self::Unknown | Self::Disabled => "Needs Setup",
            Self::Ready => "Connected",
            Self::Warning | Self::Error => "Health Check Failed",
        }
    }
}

/// Live health snapshot for a binding.
#[derive(Debug, Clone)]
pub struct BindingHealth {
    pub ok: bool,
    pub state: BindingHealthState,
    /// Human-readable status summary (no secrets).
    pub status: String,
    /// Last error summary, if any.
    pub last_error: Option<String>,
}

// ── Runtime context / handle ──────────────────────────────────────────────────

/// Context passed to `ConversationEntryProvider::start`.
#[derive(Debug)]
pub struct BindingRuntimeContext {
    /// Config for this binding.
    pub config: crate::config::BindingConfig,
    /// Channel to push normalized envelopes to the manager.
    pub envelope_tx: std::sync::mpsc::Sender<BindingEnvelope>,
    /// Channel to receive outbound replies for this binding from the router.
    pub reply_rx: std::sync::mpsc::Receiver<BindingReply>,
}

/// Opaque handle returned by a started binding.
///
/// Dropping the handle must stop the adapter's background task.
pub struct BindingHandle {
    /// Optional shutdown signal.  None = no graceful shutdown path needed.
    pub(crate) _shutdown_tx: Option<std::sync::mpsc::SyncSender<()>>,
}

// ── Trait ─────────────────────────────────────────────────────────────────────

/// A conversation-entry adapter for one external platform.
///
/// Each platform implements this trait.  The binding manager calls these
/// methods; implementations must not call each other directly.
#[async_trait::async_trait]
pub trait ConversationEntryProvider: Send + Sync {
    /// The platform id this adapter handles (e.g. "telegram").
    fn platform(&self) -> &'static str;

    /// Validate a binding config structurally (no network).
    async fn validate_config(
        &self,
        binding: &crate::config::BindingConfig,
    ) -> anyhow::Result<BindingValidation>;

    /// Optional: perform a live health check against the platform API.
    async fn health_check(
        &self,
        binding: &crate::config::BindingConfig,
    ) -> anyhow::Result<BindingHealth>;

    /// Start the adapter's background receive loop.
    ///
    /// Must return a [`BindingHandle`] whose `Drop` stops the loop.
    async fn start(&self, ctx: BindingRuntimeContext) -> anyhow::Result<BindingHandle>;
}

// ── Status view (for TUI) ─────────────────────────────────────────────────────

/// Lightweight view type surfaced in the TUI status rail.
#[derive(Debug, Clone)]
pub struct BindingStatusView {
    pub id: String,
    pub platform: String,
    pub agent_profile: String,
    pub health: BindingHealthState,
    pub enabled: bool,
}
