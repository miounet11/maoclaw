//! Onboarding step definitions and state machine.
//!
//! The onboarding wizard has four user-visible steps plus a terminal Complete
//! state.  State transitions do not depend on any TUI runtime so they are fully
//! unit-testable.

#[cfg(test)]
use crate::config::OnboardingConfig;
use crate::config::{BindingConfig, Config};
use crate::setup_registry;

// ── Steps ─────────────────────────────────────────────────────────────────────

/// Each step in the first-run wizard.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum OnboardingStep {
    #[default]
    Intro,
    ProviderSetup,
    AgentPreset,
    OptionalBinding,
    Complete,
}

impl OnboardingStep {
    /// Human-readable step label used in the TUI header.
    #[must_use]
    pub const fn label(self) -> &'static str {
        match self {
            Self::Intro => "Step 1 of 3",
            Self::ProviderSetup => "Step 2 of 3",
            Self::AgentPreset => "Step 3 of 3",
            Self::OptionalBinding => "Optional: Connect a chat tool",
            Self::Complete => "Done",
        }
    }

    /// Returns the next step in the mandatory path (does not include optional
    /// binding; use [`OnboardingState::advance_to_binding`] for that).
    #[must_use]
    pub const fn next_mandatory(self) -> Self {
        match self {
            Self::Intro => Self::ProviderSetup,
            Self::ProviderSetup => Self::AgentPreset,
            Self::AgentPreset | Self::OptionalBinding | Self::Complete => Self::Complete,
        }
    }

    #[must_use]
    pub const fn prev(self) -> Self {
        match self {
            Self::Intro | Self::Complete | Self::ProviderSetup => Self::Intro,
            Self::AgentPreset => Self::ProviderSetup,
            Self::OptionalBinding => Self::AgentPreset,
        }
    }

    /// Whether this step is the last user-facing step before completion.
    #[must_use]
    pub const fn is_terminal(self) -> bool {
        matches!(self, Self::Complete)
    }
}

// ── Auth mode ─────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub enum AuthMode {
    #[default]
    ApiKey,
    OAuth,
}

// ── Detected ready provider ───────────────────────────────────────────────────

/// A provider that was detected as already configured.
#[derive(Debug, Clone)]
pub struct ReadyProviderCandidate {
    /// Normalized provider id (e.g. "anthropic").
    pub provider: String,
    /// Recommended default model for this provider.
    pub default_model: Option<String>,
    /// Where the credential came from.
    pub source: ReadySource,
}

/// Where a ready credential was detected.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ReadySource {
    Config,
    AuthStorage,
    EnvVar,
}

impl ReadySource {
    /// UI badge shown next to a ready provider.
    #[must_use]
    pub const fn badge(self) -> &'static str {
        match self {
            Self::Config => "Using saved credentials",
            Self::AuthStorage => "Detected",
            Self::EnvVar => "Ready",
        }
    }
}

// ── Working state ─────────────────────────────────────────────────────────────

/// Transient working state for the onboarding wizard.
///
/// This is NOT persisted; it lives only while the wizard is active.
/// Call [`OnboardingState::build_config_patch`] to get the values to persist.
#[derive(Debug, Clone, Default)]
pub struct OnboardingState {
    /// Current wizard step.
    pub step: OnboardingStep,

    // — Provider setup —
    /// Selected provider id.
    pub selected_provider: Option<String>,
    /// Auth mode for the selected provider.
    pub auth_mode: AuthMode,
    /// API key as entered (never logged, never stored in session).
    pub api_key_input: String,
    /// Whether the API key field is masked.
    pub api_key_masked: bool,
    /// Selected model id.
    pub selected_model: Option<String>,
    /// Providers detected as already ready.
    pub ready_candidates: Vec<ReadyProviderCandidate>,

    // — Agent preset —
    /// Selected starter preset id.
    pub selected_agent_preset: Option<String>,

    // — Optional binding —
    /// Platform the user chose to bind (if any).
    pub selected_binding_platform: Option<String>,

    // — UX helpers —
    /// Inline validation error for the current step.
    pub validation_error: Option<String>,
    /// Prevents double-submission.
    pub is_submitting: bool,
}

impl OnboardingState {
    /// New state, optionally prefilled from detected ready providers.
    #[must_use]
    pub fn new(candidates: Vec<ReadyProviderCandidate>) -> Self {
        let mut state = Self {
            api_key_masked: true,
            ready_candidates: candidates,
            ..Default::default()
        };
        // Auto-select first ready provider.
        if let Some(c) = state.ready_candidates.first() {
            state.selected_provider = Some(c.provider.clone());
            state.selected_model = c.default_model.clone();
        }
        state
    }

    // ── Transitions ────────────────────────────────────────────────────────

    /// Advance to the next mandatory step (validates first).
    ///
    /// Returns `Err` with a user-facing message if the current step is invalid.
    pub fn advance(&mut self) -> Result<(), String> {
        self.validate_current_step()?;
        self.validation_error = None;
        self.step = self.step.next_mandatory();
        Ok(())
    }

    /// Go back one step, preserving entered values.
    pub fn go_back(&mut self) {
        self.validation_error = None;
        self.step = self.step.prev();
    }

    /// Branch to the optional binding step from AgentPreset.
    pub fn advance_to_binding(&mut self) -> Result<(), String> {
        self.validate_current_step()?;
        self.validation_error = None;
        self.step = OnboardingStep::OptionalBinding;
        Ok(())
    }

    /// Skip the optional binding step and complete onboarding.
    pub fn skip_binding(&mut self) {
        self.validation_error = None;
        self.step = OnboardingStep::Complete;
    }

    /// Mark the chosen binding platform and complete onboarding.
    pub fn complete_with_binding(&mut self, platform: &str) {
        self.selected_binding_platform = Some(platform.to_string());
        self.step = OnboardingStep::Complete;
    }

    // ── Validation ─────────────────────────────────────────────────────────

    fn validate_current_step(&mut self) -> Result<(), String> {
        let err: Option<&str> = match self.step {
            OnboardingStep::Intro | OnboardingStep::OptionalBinding | OnboardingStep::Complete => {
                None
            }
            OnboardingStep::ProviderSetup => {
                if self.selected_provider.is_none() {
                    Some("Select a provider to continue.")
                } else if self.auth_mode == AuthMode::ApiKey
                    && !setup_registry::provider_supports_keyless_setup(
                        self.selected_provider.as_deref().unwrap_or(""),
                    )
                    && self.api_key_input.trim().is_empty()
                    && !self.is_provider_ready(self.selected_provider.as_deref().unwrap_or(""))
                {
                    Some("Enter a valid API key to continue.")
                } else if self.selected_model.is_none() {
                    Some("Select a model to continue.")
                } else {
                    None
                }
            }
            OnboardingStep::AgentPreset => {
                if self.selected_agent_preset.is_none() {
                    Some("Select an agent to continue.")
                } else {
                    None
                }
            }
        };

        if let Some(msg) = err {
            let owned = msg.to_string();
            self.validation_error = Some(owned.clone());
            return Err(owned);
        }
        Ok(())
    }

    /// Whether a provider id is already detected as ready.
    #[must_use]
    pub fn is_provider_ready(&self, provider: &str) -> bool {
        self.ready_candidates.iter().any(|c| c.provider == provider)
    }

    /// Badge text for a provider id, if ready.
    #[must_use]
    pub fn provider_badge(&self, provider: &str) -> Option<&'static str> {
        self.ready_candidates
            .iter()
            .find(|c| c.provider == provider)
            .map(|c| c.source.badge())
    }

    // ── Config patch ────────────────────────────────────────────────────────

    /// Build the config values to persist on completion.
    ///
    /// Returns a JSON object suitable for `Config::patch_settings_with_roots`.
    #[must_use]
    pub fn build_config_patch(&self) -> serde_json::Value {
        let mut patch = serde_json::Map::new();

        // Mark onboarding complete.
        patch.insert(
            "onboarding".to_string(),
            serde_json::json!({ "completed": true, "version": 1 }),
        );

        // Provider / model.
        if let Some(p) = &self.selected_provider {
            patch.insert("defaultProvider".to_string(), p.clone().into());
        }
        if let Some(m) = &self.selected_model {
            patch.insert("defaultModel".to_string(), m.clone().into());
        }

        // Starter agent.
        if let Some(a) = &self.selected_agent_preset {
            patch.insert("starterAgent".to_string(), a.clone().into());
        }

        // Optional binding scaffold.
        if let Some(platform) = &self.selected_binding_platform {
            let binding = BindingConfig {
                id: format!("{platform}_main"),
                platform: platform.clone(),
                enabled: Some(false),
                agent_profile: Some(
                    self.selected_agent_preset
                        .clone()
                        .unwrap_or_else(|| "main".to_string()),
                ),
                config: None,
            };
            patch.insert(
                "bindings".to_string(),
                serde_json::to_value(vec![binding]).unwrap_or(serde_json::Value::Array(vec![])),
            );
        }

        serde_json::Value::Object(patch)
    }

    /// Whether the wizard has completed all required steps.
    #[must_use]
    pub const fn is_complete(&self) -> bool {
        matches!(self.step, OnboardingStep::Complete)
    }
}

// ── Gate ──────────────────────────────────────────────────────────────────────

/// Returns `true` if the given `config` has already completed onboarding.
#[must_use]
pub fn onboarding_is_complete(config: &Config) -> bool {
    config
        .onboarding
        .as_ref()
        .and_then(|o| o.completed)
        .unwrap_or(false)
}

/// Returns `true` if the app should show the onboarding wizard on startup.
#[must_use]
pub fn should_show_onboarding(config: &Config) -> bool {
    !onboarding_is_complete(config)
}

// ── Provider helpers ──────────────────────────────────────────────────────────

/// The shared set of providers surfaced in onboarding.
#[must_use]
pub fn onboarding_providers() -> Vec<(&'static str, &'static str)> {
    setup_registry::onboarding_presets()
        .into_iter()
        .map(|preset| (preset.display_provider_id(), preset.label.as_str()))
        .collect()
}

/// Default recommended model per provider (used when no model is already set).
#[must_use]
pub fn default_model_for_provider(provider: &str) -> Option<&'static str> {
    setup_registry::default_model_for_provider(provider)
}

/// Detect providers that are already configured so we can prefill onboarding.
///
/// Checks, in priority order: config default, auth storage file, env vars.
#[must_use]
pub fn detect_ready_providers(config: &Config) -> Vec<ReadyProviderCandidate> {
    let mut candidates: Vec<ReadyProviderCandidate> = Vec::new();

    // 1. Explicit config default.
    if let Some(p) = &config.default_provider {
        candidates.push(ReadyProviderCandidate {
            provider: p.clone(),
            default_model: config
                .default_model
                .clone()
                .or_else(|| default_model_for_provider(p).map(str::to_string)),
            source: ReadySource::Config,
        });
    }

    // 2. Well-known environment variables.
    let env_providers = [
        ("ANTHROPIC_API_KEY", "anthropic"),
        ("OPENAI_API_KEY", "openai"),
        ("GOOGLE_API_KEY", "google"),
        ("KIMI_API_KEY", "moonshotai"),
    ];
    for (env_var, provider_id) in env_providers {
        if candidates.iter().any(|c| c.provider == provider_id) {
            continue;
        }
        if std::env::var(env_var).is_ok() {
            candidates.push(ReadyProviderCandidate {
                provider: provider_id.to_string(),
                default_model: default_model_for_provider(provider_id).map(str::to_string),
                source: ReadySource::EnvVar,
            });
        }
    }

    candidates
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn step_advance_path() {
        let mut s = OnboardingState {
            selected_provider: Some("anthropic".to_string()),
            selected_model: Some("claude-sonnet-4-6".to_string()),
            selected_agent_preset: Some("main".to_string()),
            ready_candidates: vec![ReadyProviderCandidate {
                provider: "anthropic".to_string(),
                default_model: None,
                source: ReadySource::EnvVar,
            }],
            ..Default::default()
        };
        // Intro -> ProviderSetup
        s.advance().expect("intro ok");
        assert_eq!(s.step, OnboardingStep::ProviderSetup);
        // ProviderSetup -> AgentPreset
        s.advance().expect("provider ok");
        assert_eq!(s.step, OnboardingStep::AgentPreset);
        // AgentPreset -> Complete
        s.advance().expect("agent ok");
        assert_eq!(s.step, OnboardingStep::Complete);
        assert!(s.is_complete());
    }

    #[test]
    fn step_go_back_preserves_input() {
        let mut s = OnboardingState {
            step: OnboardingStep::ProviderSetup,
            selected_provider: Some("openai".to_string()),
            ..Default::default()
        };
        s.go_back();
        assert_eq!(s.step, OnboardingStep::Intro);
        // value must still be there after going back
        assert_eq!(s.selected_provider.as_deref(), Some("openai"));
    }

    #[test]
    fn validate_provider_step_requires_provider() {
        let mut s = OnboardingState {
            step: OnboardingStep::ProviderSetup,
            ..Default::default()
        };
        let err = s.advance().unwrap_err();
        assert!(err.contains("provider"));
    }

    #[test]
    fn validate_provider_step_requires_model() {
        let mut s = OnboardingState {
            step: OnboardingStep::ProviderSetup,
            selected_provider: Some("anthropic".to_string()),
            ready_candidates: vec![ReadyProviderCandidate {
                provider: "anthropic".to_string(),
                default_model: None,
                source: ReadySource::EnvVar,
            }],
            ..Default::default()
        };
        let err = s.advance().unwrap_err();
        assert!(err.contains("model"));
    }

    #[test]
    fn config_patch_roundtrip() {
        let s = OnboardingState {
            step: OnboardingStep::Complete,
            selected_provider: Some("openai".to_string()),
            selected_model: Some("gpt-4o".to_string()),
            selected_agent_preset: Some("architect".to_string()),
            ..Default::default()
        };
        let patch = s.build_config_patch();
        assert_eq!(patch["defaultProvider"], "openai");
        assert_eq!(patch["defaultModel"], "gpt-4o");
        assert_eq!(patch["starterAgent"], "architect");
        assert_eq!(patch["onboarding"]["completed"], true);
    }

    #[test]
    fn should_show_onboarding_when_not_complete() {
        let config = Config::default();
        assert!(should_show_onboarding(&config));
    }

    #[test]
    fn should_skip_onboarding_when_complete() {
        let config = Config {
            onboarding: Some(OnboardingConfig {
                completed: Some(true),
                version: Some(1),
                ..Default::default()
            }),
            ..Default::default()
        };
        assert!(!should_show_onboarding(&config));
    }

    #[test]
    fn optional_binding_branch() {
        let mut s = OnboardingState {
            step: OnboardingStep::AgentPreset,
            selected_agent_preset: Some("main".to_string()),
            ..Default::default()
        };
        s.advance_to_binding().expect("valid");
        assert_eq!(s.step, OnboardingStep::OptionalBinding);
        s.complete_with_binding("telegram");
        assert!(s.is_complete());
        assert_eq!(s.selected_binding_platform.as_deref(), Some("telegram"));
        let patch = s.build_config_patch();
        let bindings = patch["bindings"].as_array().unwrap();
        assert_eq!(bindings[0]["platform"], "telegram");
    }
}
