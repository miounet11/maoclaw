//! Starter agent profile registry.
//!
//! Defines the built-in agent presets and the runtime resolution model.
//! Profiles can follow main provider/model settings ("follow_main") or
//! override them with a specific provider/model pair.
//!
//! External consumers should import from [`crate::sdk`] rather than this
//! module directly.

use crate::config::{AgentProfileConfig, Config};

// ── Profile mode ─────────────────────────────────────────────────────────────

/// How an agent profile resolves its provider/model.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum AgentProfileMode {
    /// Use `Config.default_provider` / `Config.default_model`.
    #[default]
    FollowMain,
    /// Use the profile's own `provider` / `model` fields.
    Override,
}

impl AgentProfileMode {
    /// Parse from config string ("follow_main" | "override").
    #[must_use]
    pub fn parse(s: &str) -> Self {
        match s.to_ascii_lowercase().as_str() {
            "override" => Self::Override,
            _ => Self::FollowMain,
        }
    }

    /// Canonical string representation.
    #[must_use]
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::FollowMain => "follow_main",
            Self::Override => "override",
        }
    }
}

// ── Runtime profile ───────────────────────────────────────────────────────────

/// A resolved agent profile ready for use by the agent runtime.
#[derive(Debug, Clone)]
pub struct AgentProfile {
    /// Stable id (e.g. "main", "architect").
    pub id: String,
    /// Display name shown in the TUI and onboarding picker.
    pub display_name: String,
    /// One-line purpose shown on agent cards.
    pub description: String,
    /// Provider/model resolution mode.
    pub mode: AgentProfileMode,
    /// Provider override (only meaningful when `mode == Override`).
    pub provider: Option<String>,
    /// Model override (only meaningful when `mode == Override`).
    pub model: Option<String>,
    /// Skill ids to activate for this profile.
    pub skills: Vec<String>,
    /// Prompt resource ids to load for this profile.
    pub prompts: Vec<String>,
}

impl AgentProfile {
    /// Resolve the provider id for this profile given the global config.
    #[must_use]
    pub fn resolved_provider<'a>(&'a self, config: &'a Config) -> Option<&'a str> {
        match self.mode {
            AgentProfileMode::Override => self.provider.as_deref(),
            AgentProfileMode::FollowMain => config.default_provider.as_deref(),
        }
    }

    /// Resolve the model id for this profile given the global config.
    #[must_use]
    pub fn resolved_model<'a>(&'a self, config: &'a Config) -> Option<&'a str> {
        match self.mode {
            AgentProfileMode::Override => self.model.as_deref(),
            AgentProfileMode::FollowMain => config.default_model.as_deref(),
        }
    }

    /// Human-readable mode label used in the onboarding card meta line.
    #[must_use]
    pub fn mode_label(&self) -> String {
        match self.mode {
            AgentProfileMode::FollowMain => "Follows main settings".to_string(),
            AgentProfileMode::Override => {
                let p = self.provider.as_deref().unwrap_or("?");
                let m = self.model.as_deref().unwrap_or("?");
                format!("Override: {p}/{m}")
            }
        }
    }
}

// ── Built-in presets ──────────────────────────────────────────────────────────

/// Returns the canonical list of built-in starter agent presets.
///
/// These resolve without any disk access or remote fetch.
#[must_use]
pub fn builtin_profiles() -> Vec<AgentProfile> {
    vec![
        AgentProfile {
            id: "main".to_string(),
            display_name: "Main".to_string(),
            description: "General-purpose maoclaw assistant for everyday coding work.".to_string(),
            mode: AgentProfileMode::FollowMain,
            provider: None,
            model: None,
            skills: vec![],
            prompts: vec![],
        },
        AgentProfile {
            id: "architect".to_string(),
            display_name: "Architect".to_string(),
            description: "System design, refactors, code review, and technical decisions."
                .to_string(),
            mode: AgentProfileMode::FollowMain,
            provider: None,
            model: None,
            skills: vec!["senior-architect".to_string()],
            prompts: vec![],
        },
        AgentProfile {
            id: "implementer".to_string(),
            display_name: "Implementer".to_string(),
            description: "Fast execution for code writing, file edits, and feature delivery."
                .to_string(),
            mode: AgentProfileMode::FollowMain,
            provider: None,
            model: None,
            skills: vec![],
            prompts: vec![],
        },
        AgentProfile {
            id: "debugger".to_string(),
            display_name: "Debugger".to_string(),
            description: "Root-cause analysis, error triage, logs, and regression isolation."
                .to_string(),
            mode: AgentProfileMode::FollowMain,
            provider: None,
            model: None,
            skills: vec![],
            prompts: vec![],
        },
        AgentProfile {
            id: "operator".to_string(),
            display_name: "Operator".to_string(),
            description: "Deployment, diagnostics, environment checks, and runtime operations."
                .to_string(),
            mode: AgentProfileMode::FollowMain,
            provider: None,
            model: None,
            skills: vec![],
            prompts: vec![],
        },
    ]
}

// ── Registry ──────────────────────────────────────────────────────────────────

/// Merged agent profile registry.
///
/// Built-ins are always present; user-defined overrides in `config.agent_profiles`
/// extend or override them.
#[derive(Debug)]
pub struct AgentProfileRegistry {
    profiles: Vec<AgentProfile>,
}

impl AgentProfileRegistry {
    /// Build a registry from built-ins plus any user overrides in `config`.
    #[must_use]
    pub fn from_config(config: &Config) -> Self {
        let mut profiles = builtin_profiles();

        if let Some(overrides) = &config.agent_profiles {
            for (id, cfg) in overrides {
                if let Some(existing) = profiles.iter_mut().find(|p| &p.id == id) {
                    apply_config_override(existing, cfg);
                } else {
                    profiles.push(profile_from_config(id, cfg));
                }
            }
        }

        Self { profiles }
    }

    /// All profiles in display order.
    #[must_use]
    pub fn all(&self) -> &[AgentProfile] {
        &self.profiles
    }

    /// Look up a profile by id.  Falls back to "main" if the id is unknown.
    #[must_use]
    pub fn get(&self, id: &str) -> &AgentProfile {
        self.profiles
            .iter()
            .find(|p| p.id == id)
            .unwrap_or_else(|| {
                self.profiles
                    .iter()
                    .find(|p| p.id == "main")
                    .expect("built-in 'main' profile missing")
            })
    }

    /// Resolve the active profile from config, defaulting to "main".
    #[must_use]
    pub fn active<'a>(&'a self, config: &Config) -> &'a AgentProfile {
        let id = config.starter_agent.as_deref().unwrap_or("main");
        self.get(id)
    }
}

fn apply_config_override(profile: &mut AgentProfile, cfg: &AgentProfileConfig) {
    if let Some(name) = &cfg.display_name {
        profile.display_name.clone_from(name);
    }
    if let Some(desc) = &cfg.description {
        profile.description.clone_from(desc);
    }
    if let Some(mode_str) = &cfg.mode {
        profile.mode = AgentProfileMode::parse(mode_str);
    }
    if let Some(p) = &cfg.provider {
        profile.provider = Some(p.clone());
    }
    if let Some(m) = &cfg.model {
        profile.model = Some(m.clone());
    }
    if let Some(skills) = &cfg.skills {
        profile.skills.clone_from(skills);
    }
    if let Some(prompts) = &cfg.prompts {
        profile.prompts.clone_from(prompts);
    }
}

fn profile_from_config(id: &str, cfg: &AgentProfileConfig) -> AgentProfile {
    AgentProfile {
        id: id.to_string(),
        display_name: cfg.display_name.clone().unwrap_or_else(|| id.to_string()),
        description: cfg.description.clone().unwrap_or_default(),
        mode: cfg
            .mode
            .as_deref()
            .map(AgentProfileMode::parse)
            .unwrap_or_default(),
        provider: cfg.provider.clone(),
        model: cfg.model.clone(),
        skills: cfg.skills.clone().unwrap_or_default(),
        prompts: cfg.prompts.clone().unwrap_or_default(),
    }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn builtin_profiles_present() {
        let profiles = builtin_profiles();
        let ids: Vec<&str> = profiles.iter().map(|p| p.id.as_str()).collect();
        assert!(ids.contains(&"main"));
        assert!(ids.contains(&"architect"));
        assert!(ids.contains(&"implementer"));
        assert!(ids.contains(&"debugger"));
        assert!(ids.contains(&"operator"));
    }

    #[test]
    fn registry_defaults_to_main() {
        let config = Config::default();
        let reg = AgentProfileRegistry::from_config(&config);
        assert_eq!(reg.active(&config).id, "main");
    }

    #[test]
    fn registry_respects_starter_agent() {
        let config = Config {
            starter_agent: Some("architect".to_string()),
            ..Config::default()
        };
        let reg = AgentProfileRegistry::from_config(&config);
        assert_eq!(reg.active(&config).id, "architect");
    }

    #[test]
    fn profile_mode_labels() {
        let p = AgentProfile {
            id: "test".to_string(),
            display_name: "Test".to_string(),
            description: String::new(),
            mode: AgentProfileMode::FollowMain,
            provider: None,
            model: None,
            skills: vec![],
            prompts: vec![],
        };
        assert_eq!(p.mode_label(), "Follows main settings");
    }

    #[test]
    fn agent_profile_mode_parse() {
        assert_eq!(
            AgentProfileMode::parse("override"),
            AgentProfileMode::Override
        );
        assert_eq!(
            AgentProfileMode::parse("follow_main"),
            AgentProfileMode::FollowMain
        );
        assert_eq!(
            AgentProfileMode::parse("unknown"),
            AgentProfileMode::FollowMain
        );
    }

    #[test]
    fn config_serde_round_trip() {
        let json = r#"{
            "onboarding": { "completed": true, "version": 1 },
            "starterAgent": "architect",
            "agentProfiles": {
                "debugger": { "mode": "override", "provider": "openai", "model": "gpt-4o" }
            },
            "bindings": [
                { "id": "tg_main", "platform": "telegram", "enabled": false }
            ]
        }"#;
        let config: Config = serde_json::from_str(json).expect("parse");
        assert!(config.onboarding.unwrap().completed.unwrap());
        assert_eq!(config.starter_agent.unwrap(), "architect");
        let profiles = config.agent_profiles.unwrap();
        assert_eq!(profiles["debugger"].provider.as_deref(), Some("openai"));
        let bindings = config.bindings.unwrap();
        assert_eq!(bindings[0].platform, "telegram");
    }
}
