//! Conversation-entry binding adapters.
//!
//! This module owns:
//! - The shared [`types`] protocol (envelope, reply, health, trait).
//! - The [`manager`] that starts and tracks active bindings.
//! - Per-platform adapters: [`telegram`], [`qq`], [`feishu`].

pub mod feishu;
pub mod http;
pub mod manager;
pub mod qq;
pub mod telegram;
pub mod types;

pub use manager::BindingManager;
pub use types::{
    BindingEnvelope, BindingHandle, BindingHealth, BindingHealthState, BindingKind, BindingReply,
    BindingStatusView, BindingValidation, ConversationEntryProvider, ValidationLevel,
};
