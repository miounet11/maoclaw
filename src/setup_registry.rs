//! Shared first-run setup preset registry.
//!
//! The source of truth lives in `desktop/macos/Resources/setup-presets.json`
//! so Rust and the desktop bridge can stay aligned on preset names, models,
//! and first-run taxonomy.

use crate::provider_metadata;
use serde::Deserialize;
use std::sync::OnceLock;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
pub enum SetupLane {
    #[serde(rename = "official_api")]
    OfficialApi,
    #[serde(rename = "openai_compatible_gateway")]
    OpenAICompatibleGateway,
    #[serde(rename = "local_model")]
    LocalModel,
    #[serde(rename = "connected_account")]
    ConnectedAccount,
}

impl SetupLane {
    #[must_use]
    pub const fn label(self) -> &'static str {
        match self {
            Self::OfficialApi => "Official API",
            Self::OpenAICompatibleGateway => "OpenAI-compatible gateway",
            Self::LocalModel => "Local model",
            Self::ConnectedAccount => "Connected account",
        }
    }

    #[must_use]
    pub const fn description(self) -> &'static str {
        match self {
            Self::OfficialApi => "Use an official provider key and start fast.",
            Self::OpenAICompatibleGateway => {
                "Use a compatible gateway such as NewAPI, OpenRouter, DeepSeek, or Qwen."
            }
            Self::LocalModel => "Use a local runtime such as Ollama or LM Studio.",
            Self::ConnectedAccount => "Sign in with an existing product account via OAuth.",
        }
    }

    #[must_use]
    pub const fn all() -> &'static [Self] {
        &[
            Self::OfficialApi,
            Self::OpenAICompatibleGateway,
            Self::LocalModel,
            Self::ConnectedAccount,
        ]
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
pub enum SetupCredentialKind {
    #[serde(rename = "api_key")]
    ApiKey,
    #[serde(rename = "oauth_pkce")]
    OAuthPkce,
    #[serde(rename = "oauth_device_flow")]
    OAuthDeviceFlow,
    #[serde(rename = "none")]
    None,
}

impl SetupCredentialKind {
    #[must_use]
    pub const fn label(self) -> &'static str {
        match self {
            Self::ApiKey => "API key",
            Self::OAuthPkce => "OAuth",
            Self::OAuthDeviceFlow => "OAuth (device flow)",
            Self::None => "No credential",
        }
    }
}

#[allow(clippy::struct_excessive_bools)]
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SetupPreset {
    pub id: String,
    pub runtime_provider_id: String,
    pub label: String,
    pub description: String,
    pub api_protocol: String,
    #[serde(rename = "apiBaseURL", alias = "apiBaseUrl")]
    pub api_base_url: String,
    pub default_models: Vec<String>,
    pub supports_direct_api_key: bool,
    #[serde(rename = "supportsCustomBaseURL", alias = "supportsCustomBaseUrl")]
    pub supports_custom_base_url: bool,
    pub lane: SetupLane,
    #[serde(default)]
    pub first_wow: bool,
    #[serde(default)]
    pub tui_onboarding: bool,
    #[serde(default)]
    pub desktop_quick_access: bool,
    #[serde(default)]
    pub cli_setup_kinds: Vec<SetupCredentialKind>,
    #[serde(default)]
    pub aliases: Vec<String>,
    #[serde(default)]
    pub auth_env_hints: Vec<String>,
    #[serde(default)]
    #[serde(rename = "requiresBaseURL", alias = "requiresBaseUrl")]
    pub requires_base_url: bool,
    #[serde(default)]
    pub requires_model_selection: bool,
    #[serde(default)]
    pub supports_no_credential: bool,
}

impl SetupPreset {
    #[must_use]
    pub fn primary_model(&self) -> Option<&str> {
        self.default_models.first().map(String::as_str)
    }

    #[must_use]
    pub fn display_provider_id(&self) -> &str {
        self.runtime_provider_id.as_str()
    }
}

#[derive(Debug, Clone, Copy)]
pub struct SetupChoice {
    pub preset: &'static SetupPreset,
    pub credential_kind: SetupCredentialKind,
}

impl SetupChoice {
    #[must_use]
    pub fn env_hint(&self) -> &str {
        self.preset
            .auth_env_hints
            .first()
            .map_or("", String::as_str)
    }

    #[must_use]
    pub fn label(&self) -> &str {
        self.preset.label.as_str()
    }

    #[must_use]
    pub fn provider(&self) -> &str {
        self.preset.runtime_provider_id.as_str()
    }
}

fn registry_data() -> &'static [SetupPreset] {
    static REGISTRY: OnceLock<Vec<SetupPreset>> = OnceLock::new();
    REGISTRY
        .get_or_init(|| {
            let raw = include_str!("../desktop/macos/Resources/setup-presets.json");
            serde_json::from_str(raw).expect("setup-presets.json must be valid")
        })
        .as_slice()
}

#[must_use]
pub fn setup_presets() -> &'static [SetupPreset] {
    registry_data()
}

fn normalize_token(value: &str) -> String {
    value.trim().to_ascii_lowercase()
}

#[must_use]
pub fn preset_by_id(id: &str) -> Option<&'static SetupPreset> {
    let normalized = normalize_token(id);
    registry_data().iter().find(|preset| {
        normalize_token(&preset.id) == normalized
            || normalize_token(&preset.runtime_provider_id) == normalized
            || preset
                .aliases
                .iter()
                .any(|alias| normalize_token(alias) == normalized)
    })
}

#[must_use]
pub fn preset_for_provider(provider: &str) -> Option<&'static SetupPreset> {
    let canonical = provider_metadata::canonical_provider_id(provider).unwrap_or(provider);
    let normalized = normalize_token(canonical);
    registry_data().iter().find(|preset| {
        preset.first_wow
            && (normalize_token(&preset.runtime_provider_id) == normalized
                || normalize_token(&preset.id) == normalized
                || preset
                    .aliases
                    .iter()
                    .any(|alias| normalize_token(alias) == normalized))
    })
}

#[must_use]
pub fn onboarding_presets() -> Vec<&'static SetupPreset> {
    registry_data()
        .iter()
        .filter(|preset| preset.tui_onboarding)
        .collect()
}

#[must_use]
pub fn desktop_quick_access_presets() -> Vec<&'static SetupPreset> {
    registry_data()
        .iter()
        .filter(|preset| preset.desktop_quick_access)
        .collect()
}

#[must_use]
pub fn cli_setup_choices() -> Vec<SetupChoice> {
    registry_data()
        .iter()
        .flat_map(|preset| {
            preset
                .cli_setup_kinds
                .iter()
                .copied()
                .map(move |credential_kind| SetupChoice {
                    preset,
                    credential_kind,
                })
        })
        .collect()
}

#[must_use]
pub fn cli_setup_choices_for_lane(lane: SetupLane) -> Vec<SetupChoice> {
    cli_setup_choices()
        .into_iter()
        .filter(|choice| choice.preset.lane == lane)
        .collect()
}

#[must_use]
pub fn default_model_for_provider(provider: &str) -> Option<&'static str> {
    preset_for_provider(provider).and_then(SetupPreset::primary_model)
}

#[must_use]
pub fn provider_supports_keyless_setup(provider: &str) -> bool {
    preset_for_provider(provider).is_some_and(|preset| preset.supports_no_credential)
}

#[must_use]
pub fn provider_choice_default_for_provider(provider: &str) -> Option<SetupChoice> {
    let canonical = provider_metadata::canonical_provider_id(provider).unwrap_or(provider);
    let normalized = normalize_token(canonical);
    cli_setup_choices().into_iter().find(|choice| {
        let preset = choice.preset;
        normalize_token(&preset.runtime_provider_id) == normalized
            || normalize_token(&preset.id) == normalized
            || preset
                .aliases
                .iter()
                .any(|alias| normalize_token(alias) == normalized)
    })
}

#[must_use]
pub fn provider_choice_from_token(token: &str) -> Option<SetupChoice> {
    let normalized = normalize_token(token);
    if normalized.is_empty() {
        return None;
    }

    let wants_key = normalized.contains("key") || normalized.contains("api");
    let wants_oauth = normalized.contains("oauth")
        || normalized.contains("login")
        || normalized.contains("signin");
    let wants_device = normalized.contains("device");

    cli_setup_choices().into_iter().find(|choice| {
        let preset = choice.preset;
        let id_match = normalize_token(&preset.id) == normalized
            || normalize_token(&preset.runtime_provider_id) == normalized
            || preset
                .aliases
                .iter()
                .any(|alias| normalize_token(alias) == normalized);
        let label_match = normalize_token(&preset.label).contains(&normalized);
        let kind_match = if wants_device {
            choice.credential_kind == SetupCredentialKind::OAuthDeviceFlow
        } else if wants_oauth {
            matches!(
                choice.credential_kind,
                SetupCredentialKind::OAuthPkce | SetupCredentialKind::OAuthDeviceFlow
            )
        } else if wants_key {
            choice.credential_kind == SetupCredentialKind::ApiKey
        } else {
            true
        };

        kind_match && (id_match || label_match)
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn registry_loads_key_first_wow_presets() {
        let ids = setup_presets()
            .iter()
            .map(|preset| preset.id.as_str())
            .collect::<Vec<_>>();
        assert!(ids.contains(&"openai"));
        assert!(ids.contains(&"compatible-gateway"));
        assert!(ids.contains(&"ollama"));
    }

    #[test]
    fn provider_default_model_comes_from_registry() {
        assert_eq!(
            default_model_for_provider("anthropic"),
            Some("claude-sonnet-4-6")
        );
        assert_eq!(default_model_for_provider("google"), Some("gemini-2.5-pro"));
    }

    #[test]
    fn keyless_setup_detects_local_model_presets() {
        assert!(provider_supports_keyless_setup("ollama"));
        assert!(provider_supports_keyless_setup("lm-studio"));
        assert!(!provider_supports_keyless_setup("openai"));
    }

    #[test]
    fn provider_choice_token_supports_gateway_aliases() {
        let choice = provider_choice_from_token("newapi").expect("gateway preset");
        assert_eq!(choice.preset.id, "compatible-gateway");
        assert_eq!(choice.credential_kind, SetupCredentialKind::ApiKey);
    }
}
