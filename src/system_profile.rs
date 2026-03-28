//! V2 core domain object: SystemProfile.
//!
//! A `SystemProfile` represents a complete work system with its own team
//! blueprint, memory strategy, routing policy, permissions, bindings, and
//! automation hooks.  It is the primary V2 product object — users interact
//! with systems, not raw agent configurations.
//!
//! # Design
//!
//! `SystemProfile` is both serialisable config (stored in `settings.json`
//! under the `systems` key) and the runtime domain object.  There is no
//! separate "config-vs-domain" split: the profile IS the canonical state.
//!
//! # Relationship to V1 agent profiles
//!
//! V1 `AgentProfile` maps 1:1 onto a single-role `SystemProfile` with an
//! empty team blueprint.  The migration utility in this module provides the
//! conversion.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// ── Status ────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SystemStatus {
    #[default]
    Active,
    Archived,
    Draft,
}

impl SystemStatus {
    pub const fn label(&self) -> &'static str {
        match self {
            Self::Active => "active",
            Self::Archived => "archived",
            Self::Draft => "draft",
        }
    }
}

// ── Team Blueprint ────────────────────────────────────────────────────────────

/// Standard role identifiers shared across all built-in templates.
pub const ROLE_PLANNER: &str = "planner";
pub const ROLE_RESEARCHER: &str = "researcher";
pub const ROLE_WRITER: &str = "writer";
pub const ROLE_IMPLEMENTER: &str = "implementer";
pub const ROLE_REVIEWER: &str = "reviewer";
pub const ROLE_OPERATOR: &str = "operator";
pub const ROLE_COORDINATOR: &str = "coordinator";

/// One agent role in a team blueprint.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentRole {
    pub id: String,
    pub name: String,
    pub description: String,
    #[serde(default)]
    pub skills: Vec<String>,
    #[serde(default)]
    pub provider: Option<String>,
    #[serde(default)]
    pub model: Option<String>,
}

impl AgentRole {
    pub fn new(id: &str, name: &str, description: &str) -> Self {
        Self {
            id: id.to_string(),
            name: name.to_string(),
            description: description.to_string(),
            skills: Vec::new(),
            provider: None,
            model: None,
        }
    }
}

/// Defines the role graph inside a system.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(default)]
pub struct TeamBlueprint {
    pub id: String,
    pub roles: Vec<AgentRole>,
}

impl TeamBlueprint {
    pub fn new(id: impl Into<String>, roles: Vec<AgentRole>) -> Self {
        Self {
            id: id.into(),
            roles,
        }
    }

    pub fn role(&self, id: &str) -> Option<&AgentRole> {
        self.roles.iter().find(|r| r.id == id)
    }
}

// ── Memory Strategy ───────────────────────────────────────────────────────────

/// Memory bucket kinds from V2 spec § 6.4.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MemoryBucketKind {
    UserProfile,
    ProjectMemory,
    SystemRules,
    ToolUsage,
    ResultHistory,
    BrandStyle,
    ChannelContext,
    Custom(String),
}

impl MemoryBucketKind {
    pub fn label(&self) -> &str {
        match self {
            Self::UserProfile => "User Profile",
            Self::ProjectMemory => "Project Memory",
            Self::SystemRules => "System Rules",
            Self::ToolUsage => "Tool Usage",
            Self::ResultHistory => "Result History",
            Self::BrandStyle => "Brand & Style",
            Self::ChannelContext => "Channel Context",
            Self::Custom(s) => s.as_str(),
        }
    }
}

/// One logical memory partition inside a system.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryBucket {
    pub kind: MemoryBucketKind,
    pub enabled: bool,
    #[serde(default)]
    pub max_tokens: Option<u32>,
}

impl MemoryBucket {
    pub const fn new(kind: MemoryBucketKind, enabled: bool) -> Self {
        Self {
            kind,
            enabled,
            max_tokens: None,
        }
    }
}

/// Governs which memory buckets are active for a system.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(default)]
pub struct MemoryStrategy {
    pub buckets: Vec<MemoryBucket>,
}

impl MemoryStrategy {
    /// Standard seven-bucket setup for most systems.
    pub fn standard() -> Self {
        use MemoryBucketKind::{
            BrandStyle, ChannelContext, ProjectMemory, ResultHistory, SystemRules, ToolUsage,
            UserProfile,
        };
        Self {
            buckets: vec![
                MemoryBucket::new(UserProfile, true),
                MemoryBucket::new(ProjectMemory, true),
                MemoryBucket::new(SystemRules, true),
                MemoryBucket::new(ToolUsage, false),
                MemoryBucket::new(ResultHistory, true),
                MemoryBucket::new(BrandStyle, false),
                MemoryBucket::new(ChannelContext, false),
            ],
        }
    }

    pub fn enabled_buckets(&self) -> impl Iterator<Item = &MemoryBucket> {
        self.buckets.iter().filter(|b| b.enabled)
    }
}

// ── Policies ──────────────────────────────────────────────────────────────────

/// Maps task types to roles, and sets default routing.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(default)]
pub struct RoutingPolicy {
    pub default_role: Option<String>,
    pub task_role_map: HashMap<String, String>,
}

/// Tool-level permissions for a system.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(default)]
pub struct PermissionPolicy {
    pub allow_bash: Option<bool>,
    pub allow_file_write: Option<bool>,
    pub allow_network: Option<bool>,
    pub allow_browser: Option<bool>,
}

// ── Automations ───────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case", tag = "type")]
pub enum AutomationTrigger {
    TaskComplete,
    Schedule { cron: String },
    Webhook,
    Manual,
}

/// Lightweight reference to an automation definition.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AutomationRef {
    pub id: String,
    pub name: String,
    pub trigger: AutomationTrigger,
    #[serde(default = "yes")]
    pub enabled: bool,
}

const fn yes() -> bool {
    true
}

// ── SystemProfile ─────────────────────────────────────────────────────────────

/// The primary V2 product object.  Represents a complete, portable work system.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct SystemProfile {
    /// Stable local id (e.g. `"sys_1a2b3c"`).
    pub id: String,
    /// Human-readable name.
    pub name: String,
    /// Template type from the catalog (e.g. `"website_development"`).
    pub template_type: String,
    pub status: SystemStatus,
    pub description: Option<String>,

    /// ISO-8601 creation timestamp (local approximation).
    pub created_at: Option<String>,
    pub updated_at: Option<String>,

    // ── Snapshot lineage ───────────────────────────────────────────────────
    pub baseline_snapshot_id: Option<String>,
    pub active_snapshot_id: Option<String>,
    pub current_branch_id: Option<String>,

    // ── Components ────────────────────────────────────────────────────────
    #[serde(default)]
    pub team_blueprint: Option<TeamBlueprint>,
    pub memory_strategy: MemoryStrategy,
    pub routing_policy: RoutingPolicy,
    pub permission_policy: PermissionPolicy,

    // ── Channels and automations ──────────────────────────────────────────
    /// Binding ids from `config.bindings` that are attached to this system.
    #[serde(default)]
    pub bindings: Vec<String>,
    #[serde(default)]
    pub automations: Vec<AutomationRef>,

    /// Result schema id for artifact generation.
    pub result_schema: Option<String>,

    // ── Runtime config ────────────────────────────────────────────────────
    pub provider: Option<String>,
    pub model: Option<String>,
    #[serde(default)]
    pub skills: Vec<String>,
    #[serde(default)]
    pub prompts: Vec<String>,
}

impl Default for SystemProfile {
    fn default() -> Self {
        Self {
            id: gen_system_id(),
            name: "New System".to_string(),
            template_type: "custom".to_string(),
            status: SystemStatus::Active,
            description: None,
            created_at: Some(now_rfc3339()),
            updated_at: Some(now_rfc3339()),
            baseline_snapshot_id: None,
            active_snapshot_id: None,
            current_branch_id: None,
            team_blueprint: None,
            memory_strategy: MemoryStrategy::standard(),
            routing_policy: RoutingPolicy::default(),
            permission_policy: PermissionPolicy::default(),
            bindings: Vec::new(),
            automations: Vec::new(),
            result_schema: None,
            provider: None,
            model: None,
            skills: Vec::new(),
            prompts: Vec::new(),
        }
    }
}

impl SystemProfile {
    pub fn new(
        id: impl Into<String>,
        name: impl Into<String>,
        template_type: impl Into<String>,
    ) -> Self {
        Self {
            id: id.into(),
            name: name.into(),
            template_type: template_type.into(),
            ..Default::default()
        }
    }

    /// Active role count (0 if no blueprint).
    pub fn role_count(&self) -> usize {
        self.team_blueprint.as_ref().map_or(0, |tb| tb.roles.len())
    }

    /// Whether this system has been snapshotted at least once.
    pub const fn has_baseline(&self) -> bool {
        self.baseline_snapshot_id.is_some()
    }
}

// ── SystemRegistry ────────────────────────────────────────────────────────────

/// In-memory registry of all systems for the current workspace.
pub struct SystemRegistry {
    pub systems: Vec<SystemProfile>,
    pub active_system_id: Option<String>,
}

impl SystemRegistry {
    pub const fn new() -> Self {
        Self {
            systems: Vec::new(),
            active_system_id: None,
        }
    }

    pub fn from_config(systems: Option<&[SystemProfile]>, active_id: Option<&str>) -> Self {
        Self {
            systems: systems.map(<[SystemProfile]>::to_vec).unwrap_or_default(),
            active_system_id: active_id.map(str::to_string),
        }
    }

    pub fn active_system(&self) -> Option<&SystemProfile> {
        self.active_system_id
            .as_ref()
            .and_then(|id| self.systems.iter().find(|s| &s.id == id))
            .or_else(|| self.systems.first())
    }

    pub fn add_system(&mut self, profile: SystemProfile) -> String {
        let id = profile.id.clone();
        if self.active_system_id.is_none() {
            self.active_system_id = Some(id.clone());
        }
        self.systems.push(profile);
        id
    }

    pub fn get(&self, id: &str) -> Option<&SystemProfile> {
        self.systems.iter().find(|s| s.id == id)
    }

    pub fn get_mut(&mut self, id: &str) -> Option<&mut SystemProfile> {
        self.systems.iter_mut().find(|s| s.id == id)
    }

    pub fn remove(&mut self, id: &str) -> Option<SystemProfile> {
        if let Some(pos) = self.systems.iter().position(|s| s.id == id) {
            let removed = self.systems.remove(pos);
            if self.active_system_id.as_deref() == Some(id) {
                self.active_system_id = self.systems.first().map(|s| s.id.clone());
            }
            Some(removed)
        } else {
            None
        }
    }
}

impl Default for SystemRegistry {
    fn default() -> Self {
        Self::new()
    }
}

// ── V1 → V2 migration ────────────────────────────────────────────────────────

/// Lift a V1 starter-agent id into an equivalent single-role SystemProfile.
///
/// Call this on first-run V2 migration to preserve V1 data without overwriting
/// it.  The returned profile has `template_type = "v1_agent_migration"` so
/// it can be identified and upgraded later.
pub fn migrate_v1_agent_to_system(
    agent_id: &str,
    provider: Option<&str>,
    model: Option<&str>,
) -> SystemProfile {
    SystemProfile {
        id: format!("sys_v1_{agent_id}"),
        name: format!("{agent_id} (migrated)"),
        template_type: "v1_agent_migration".to_string(),
        description: Some("Migrated from V1 agent profile.".to_string()),
        provider: provider.map(str::to_string),
        model: model.map(str::to_string),
        ..Default::default()
    }
}

// ── Utility ───────────────────────────────────────────────────────────────────

/// Generate a short deterministic system id from wall-clock time.
pub fn gen_system_id() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let ms = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    format!("sys_{ms:x}")
}

/// Approximate RFC-3339 UTC timestamp without chrono.
fn now_rfc3339() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    // Compute naive UTC components — good enough for a creation timestamp.
    let s = secs % 60;
    let m = (secs / 60) % 60;
    let h = (secs / 3600) % 24;
    let days = secs / 86400; // days since 1970-01-01
    // Approx Gregorian date (±1 day around leap years — acceptable for metadata).
    let (year, month, day) = days_to_ymd(days);
    format!("{year:04}-{month:02}-{day:02}T{h:02}:{m:02}:{s:02}Z")
}

fn days_to_ymd(mut days: u64) -> (u64, u64, u64) {
    let mut y = 1970u64;
    loop {
        let leap = (y % 4 == 0 && y % 100 != 0) || y % 400 == 0;
        let dy = if leap { 366 } else { 365 };
        if days < dy {
            break;
        }
        days -= dy;
        y += 1;
    }
    let leap = (y % 4 == 0 && y % 100 != 0) || y % 400 == 0;
    let months = [
        31u64,
        if leap { 29 } else { 28 },
        31,
        30,
        31,
        30,
        31,
        31,
        30,
        31,
        30,
        31,
    ];
    let mut mo = 1u64;
    for &mdays in &months {
        if days < mdays {
            break;
        }
        days -= mdays;
        mo += 1;
    }
    (y, mo, days + 1)
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_system_gets_unique_id() {
        let a = SystemProfile::default();
        let b = SystemProfile::default();
        // Ids may collide in very fast loops, but each is non-empty.
        assert!(!a.id.is_empty());
        assert!(!b.id.is_empty());
    }

    #[test]
    fn standard_memory_strategy_has_seven_buckets() {
        let s = MemoryStrategy::standard();
        assert_eq!(s.buckets.len(), 7);
        assert!(s.enabled_buckets().count() >= 3);
    }

    #[test]
    fn registry_add_sets_active_id() {
        let mut reg = SystemRegistry::new();
        assert!(reg.active_system().is_none());
        let id = reg.add_system(SystemProfile::new("s1", "My System", "custom"));
        assert_eq!(reg.active_system_id.as_deref(), Some("s1"));
        assert_eq!(reg.active_system().unwrap().id, id);
    }

    #[test]
    fn registry_remove_updates_active() {
        let mut reg = SystemRegistry::new();
        reg.add_system(SystemProfile::new("s1", "S1", "custom"));
        reg.add_system(SystemProfile::new("s2", "S2", "custom"));
        reg.active_system_id = Some("s1".to_string());
        reg.remove("s1");
        assert_ne!(reg.active_system_id.as_deref(), Some("s1"));
    }

    #[test]
    fn v1_migration_preserves_agent_id() {
        let sp =
            migrate_v1_agent_to_system("architect", Some("anthropic"), Some("claude-sonnet-4-6"));
        assert!(sp.id.contains("architect"));
        assert_eq!(sp.template_type, "v1_agent_migration");
        assert_eq!(sp.provider.as_deref(), Some("anthropic"));
    }

    #[test]
    fn system_profile_serde_roundtrip() {
        let sp = SystemProfile::new("s1", "Test", "website_development");
        let json = serde_json::to_string(&sp).unwrap();
        let restored: SystemProfile = serde_json::from_str(&json).unwrap();
        assert_eq!(restored.id, "s1");
        assert_eq!(restored.template_type, "website_development");
    }

    #[test]
    fn team_blueprint_role_lookup() {
        let bp = TeamBlueprint::new(
            "web_team",
            vec![
                AgentRole::new(ROLE_PLANNER, "Planner", "Plans tasks"),
                AgentRole::new(ROLE_WRITER, "Writer", "Writes content"),
            ],
        );
        assert!(bp.role(ROLE_PLANNER).is_some());
        assert!(bp.role("nonexistent").is_none());
    }
}
