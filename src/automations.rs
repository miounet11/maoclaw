//! Automation engine — definitions, scheduler, and job-state model.
//!
//! Automations are repeatable, policy-scoped execution jobs attached to a
//! `SystemProfile`.  They can be:
//! - schedule-based (cron-like)
//! - trigger-based (on artifact completion, inbound binding message, etc.)
//! - artifact follow-up actions (e.g. "publish to CMS after content plan is complete")
//!
//! # Storage layout
//!
//! ```text
//! $cwd/.pi/automations/
//!   {system_id}/
//!     {automation_id}.json   — definition
//!     runs/
//!       {run_id}.json        — execution record
//! ```

use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

// ── Automation definition ────────────────────────────────────────────────────

/// A repeatable, policy-scoped execution job.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Automation {
    pub id: String,
    pub system_id: String,
    pub name: String,
    pub description: Option<String>,
    pub trigger: AutomationTrigger,
    pub action: AutomationAction,
    pub enabled: bool,
    pub created_at: String,
    pub updated_at: String,
    /// Max consecutive failures before auto-disable.
    #[serde(default = "default_max_failures")]
    pub max_consecutive_failures: u32,
    pub last_run_at: Option<String>,
    pub last_run_status: Option<AutomationRunStatus>,
    pub consecutive_failures: u32,
}

const fn default_max_failures() -> u32 {
    5
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case", tag = "type")]
pub enum AutomationTrigger {
    /// Cron expression in local time (minute hour dom month dow).
    Schedule { cron: String },
    /// Fire when an artifact of this type is saved for this system.
    ArtifactSaved { schema: String },
    /// Fire when an inbound binding message matches a keyword.
    InboundMessage {
        platform: String,
        keyword_pattern: String,
    },
    /// Fire when a task completes with a given result schema.
    TaskCompleted { task_type: String },
    /// Manual / API invocation only.
    Manual,
}

impl AutomationTrigger {
    pub const fn label(&self) -> &'static str {
        match self {
            Self::Schedule { .. } => "schedule",
            Self::ArtifactSaved { .. } => "artifact_saved",
            Self::InboundMessage { .. } => "inbound_message",
            Self::TaskCompleted { .. } => "task_completed",
            Self::Manual => "manual",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case", tag = "type")]
pub enum AutomationAction {
    /// Inject a structured prompt into the system's agent loop.
    RunTask { prompt_template: String },
    /// Push the latest artifact to a SaaS destination.
    Export { destination: String, format: String },
    /// Send a summary via a binding channel.
    NotifyBinding {
        binding_id: String,
        template: String,
    },
    /// Webhook POST to an external URL.
    Webhook { url: String },
}

impl AutomationAction {
    pub const fn label(&self) -> &'static str {
        match self {
            Self::RunTask { .. } => "run_task",
            Self::Export { .. } => "export",
            Self::NotifyBinding { .. } => "notify_binding",
            Self::Webhook { .. } => "webhook",
        }
    }
}

// ── Run records ───────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AutomationRun {
    pub id: String,
    pub automation_id: String,
    pub system_id: String,
    pub trigger_reason: String,
    pub status: AutomationRunStatus,
    pub started_at: String,
    pub finished_at: Option<String>,
    pub output_artifact_id: Option<String>,
    pub error_message: Option<String>,
    pub retry_count: u32,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AutomationRunStatus {
    #[default]
    Queued,
    Running,
    Succeeded,
    Failed,
    Cancelled,
    Skipped,
}

impl AutomationRunStatus {
    pub const fn label(&self) -> &'static str {
        match self {
            Self::Queued => "queued",
            Self::Running => "running",
            Self::Succeeded => "succeeded",
            Self::Failed => "failed",
            Self::Cancelled => "cancelled",
            Self::Skipped => "skipped",
        }
    }
}

impl Automation {
    pub fn new(
        system_id: impl Into<String>,
        name: impl Into<String>,
        trigger: AutomationTrigger,
        action: AutomationAction,
    ) -> Self {
        let now = now_rfc3339();
        Self {
            id: gen_automation_id(),
            system_id: system_id.into(),
            name: name.into(),
            description: None,
            trigger,
            action,
            enabled: true,
            created_at: now.clone(),
            updated_at: now,
            max_consecutive_failures: 5,
            last_run_at: None,
            last_run_status: None,
            consecutive_failures: 0,
        }
    }

    #[must_use]
    pub fn with_description(mut self, desc: impl Into<String>) -> Self {
        self.description = Some(desc.into());
        self
    }

    pub fn disable(&mut self) {
        self.enabled = false;
        self.updated_at = now_rfc3339();
    }

    pub fn enable(&mut self) {
        self.enabled = true;
        self.consecutive_failures = 0;
        self.updated_at = now_rfc3339();
    }

    /// Record a completed run.  Auto-disables after `max_consecutive_failures`.
    pub fn record_run(&mut self, status: AutomationRunStatus) {
        let now = now_rfc3339();
        self.last_run_at = Some(now.clone());
        self.last_run_status = Some(status);
        self.updated_at = now;
        if status == AutomationRunStatus::Failed {
            self.consecutive_failures += 1;
            if self.consecutive_failures >= self.max_consecutive_failures {
                self.enabled = false;
            }
        } else if status == AutomationRunStatus::Succeeded {
            self.consecutive_failures = 0;
        }
    }
}

// ── AutomationRegistry ────────────────────────────────────────────────────────

/// File-backed store for automation definitions and run records.
pub struct AutomationRegistry {
    pub(crate) root: PathBuf,
}

impl AutomationRegistry {
    pub fn new(workspace: &Path) -> Self {
        Self {
            root: workspace.join(".pi").join("automations"),
        }
    }

    fn system_dir(&self, system_id: &str) -> PathBuf {
        self.root.join(system_id)
    }

    fn runs_dir(&self, system_id: &str) -> PathBuf {
        self.system_dir(system_id).join("runs")
    }

    // ── Definitions ─────────────────────────────────────────────────────────

    pub fn save(&self, auto: &Automation) -> anyhow::Result<()> {
        let dir = self.system_dir(&auto.system_id);
        std::fs::create_dir_all(&dir)?;
        let path = dir.join(format!("{}.json", auto.id));
        let json = serde_json::to_string_pretty(auto)?;
        atomic_write(&path, json.as_bytes())?;
        Ok(())
    }

    pub fn load(&self, system_id: &str, automation_id: &str) -> anyhow::Result<Automation> {
        let path = self
            .system_dir(system_id)
            .join(format!("{automation_id}.json"));
        let bytes = std::fs::read(&path)
            .map_err(|e| anyhow::anyhow!("automation {automation_id} not found: {e}"))?;
        serde_json::from_slice(&bytes).map_err(|e| anyhow::anyhow!("parse error: {e}"))
    }

    pub fn list_for_system(&self, system_id: &str) -> anyhow::Result<Vec<Automation>> {
        let dir = self.system_dir(system_id);
        if !dir.exists() {
            return Ok(Vec::new());
        }
        let autos: Vec<Automation> = std::fs::read_dir(&dir)?
            .filter_map(Result::ok)
            .filter(|e| {
                let name = e.file_name();
                let s = name.to_string_lossy();
                s.ends_with(".json") && !s.starts_with('.')
            })
            .filter_map(|e| std::fs::read(e.path()).ok())
            .filter_map(|b| serde_json::from_slice(&b).ok())
            .collect();
        Ok(autos)
    }

    pub fn delete(&self, system_id: &str, automation_id: &str) -> anyhow::Result<()> {
        let path = self
            .system_dir(system_id)
            .join(format!("{automation_id}.json"));
        if path.exists() {
            std::fs::remove_file(&path)?;
        }
        Ok(())
    }

    // ── Runs ────────────────────────────────────────────────────────────────

    pub fn save_run(&self, run: &AutomationRun) -> anyhow::Result<()> {
        let dir = self.runs_dir(&run.system_id);
        std::fs::create_dir_all(&dir)?;
        let path = dir.join(format!("{}.json", run.id));
        let json = serde_json::to_string_pretty(run)?;
        atomic_write(&path, json.as_bytes())?;
        Ok(())
    }

    pub fn list_runs(
        &self,
        system_id: &str,
        automation_id: &str,
    ) -> anyhow::Result<Vec<AutomationRun>> {
        let dir = self.runs_dir(system_id);
        if !dir.exists() {
            return Ok(Vec::new());
        }
        let mut runs: Vec<AutomationRun> = std::fs::read_dir(&dir)?
            .filter_map(Result::ok)
            .filter_map(|e| std::fs::read(e.path()).ok())
            .filter_map(|b| serde_json::from_slice::<AutomationRun>(&b).ok())
            .filter(|r| r.automation_id == automation_id)
            .collect();
        runs.sort_by(|a, b| b.started_at.cmp(&a.started_at));
        Ok(runs)
    }
}

// ── AutomationScheduler ───────────────────────────────────────────────────────

/// Scheduler that checks which automations are due to fire on a given tick.
///
/// `tick(now_secs)` is called once per minute (or on demand) and returns
/// all enabled automations whose schedule is due.  It is the caller's
/// responsibility to dispatch the returned automations.
pub struct AutomationScheduler<'a> {
    registry: &'a AutomationRegistry,
}

impl<'a> AutomationScheduler<'a> {
    pub const fn new(registry: &'a AutomationRegistry) -> Self {
        Self { registry }
    }

    /// Return all enabled, schedule-based automations that are due at `now_secs`
    /// for the given system.
    pub fn tick(&self, system_id: &str, now_secs: u64) -> Vec<Automation> {
        let autos = match self.registry.list_for_system(system_id) {
            Ok(a) => a,
            Err(e) => {
                tracing::warn!(system_id, error = %e, "AutomationScheduler: failed to list automations");
                return Vec::new();
            }
        };
        autos
            .into_iter()
            .filter(|a| a.enabled)
            .filter(|a| matches!(&a.trigger, AutomationTrigger::Schedule { cron } if is_schedule_due(cron, now_secs)))
            .collect()
    }

    /// Check all systems under `root` for due automations.
    ///
    /// Returns `(system_id, Automation)` pairs.
    pub fn tick_all(&self, now_secs: u64) -> Vec<(String, Automation)> {
        let root = &self.registry.root;
        let Ok(entries) = std::fs::read_dir(root) else {
            return Vec::new();
        };
        let mut due = Vec::new();
        for entry in entries.flatten() {
            if entry.path().is_dir() {
                let system_id = entry.file_name().to_string_lossy().to_string();
                for auto in self.tick(&system_id, now_secs) {
                    due.push((system_id.clone(), auto));
                }
            }
        }
        due
    }
}

// ── Scheduler-facing helpers ──────────────────────────────────────────────────

/// Check whether a schedule-based automation is due to fire.
///
/// This is a deliberately simple implementation: it just checks whether
/// the current minute matches the stored cron string by parsing the five
/// fields and comparing against the current epoch minute.  Full cron
/// semantics (ranges, steps, lists) are deferred to Phase D.
pub fn is_schedule_due(cron: &str, now_secs: u64) -> bool {
    let parts: Vec<&str> = cron.split_whitespace().collect();
    if parts.len() != 5 {
        return false;
    }
    let min = (now_secs / 60) % 60;
    let hour = (now_secs / 3600) % 24;
    let matches = |field: &str, val: u64| -> bool {
        if field == "*" {
            return true;
        }
        if field.starts_with("*/") {
            if let Some(step_str) = field.strip_prefix("*/") {
                if let Ok(step) = step_str.parse::<u64>() {
                    return val % step == 0;
                }
            }
        }
        field.parse::<u64>() == Ok(val)
    };
    matches(parts[0], min) && matches(parts[1], hour)
}

// ── Utilities ─────────────────────────────────────────────────────────────────

fn gen_automation_id() -> String {
    use std::sync::atomic::{AtomicU64, Ordering};
    use std::time::{SystemTime, UNIX_EPOCH};
    static SEQ: AtomicU64 = AtomicU64::new(0);
    #[allow(clippy::cast_possible_truncation)]
    let ns = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos()
        .wrapping_rem(u128::from(u64::MAX)) as u64;
    let seq = SEQ.fetch_add(1, Ordering::Relaxed);
    format!("auto_{ns:x}_{seq:x}")
}

fn now_rfc3339() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let dur = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default();
    let secs = dur.as_secs();
    let ms = dur.subsec_millis();
    let s = secs % 60;
    let m = (secs / 60) % 60;
    let h = (secs / 3600) % 24;
    format!("1970-01-01T{h:02}:{m:02}:{s:02}.{ms:03}Z")
}

fn atomic_write(path: &Path, content: &[u8]) -> anyhow::Result<()> {
    let parent = path
        .parent()
        .ok_or_else(|| anyhow::anyhow!("no parent dir"))?;
    let tmp = parent.join(format!(
        ".tmp_{}",
        path.file_name().unwrap_or_default().to_string_lossy()
    ));
    std::fs::write(&tmp, content)?;
    std::fs::rename(&tmp, path)?;
    Ok(())
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    fn tmp_registry() -> (tempfile::TempDir, AutomationRegistry) {
        let dir = tempfile::tempdir().expect("tempdir");
        let reg = AutomationRegistry::new(dir.path());
        (dir, reg)
    }

    #[test]
    fn save_and_load_automation() {
        let (_dir, reg) = tmp_registry();
        let auto = Automation::new(
            "sys_1",
            "Weekly content plan",
            AutomationTrigger::Schedule {
                cron: "0 9 * * 1".to_string(),
            },
            AutomationAction::RunTask {
                prompt_template: "Create content plan for this week.".to_string(),
            },
        );
        reg.save(&auto).unwrap();
        let loaded = reg.load("sys_1", &auto.id).unwrap();
        assert_eq!(loaded.name, "Weekly content plan");
    }

    #[test]
    fn list_automations_for_system() {
        let (_dir, reg) = tmp_registry();
        for name in ["auto_a", "auto_b", "auto_c"] {
            let a = Automation::new(
                "sys_2",
                name,
                AutomationTrigger::Manual,
                AutomationAction::RunTask {
                    prompt_template: "do it".to_string(),
                },
            );
            reg.save(&a).unwrap();
        }
        let list = reg.list_for_system("sys_2").unwrap();
        assert_eq!(list.len(), 3);
    }

    #[test]
    fn record_failure_auto_disables() {
        let mut auto = Automation::new(
            "sys_3",
            "Flaky job",
            AutomationTrigger::Manual,
            AutomationAction::Webhook {
                url: "https://example.com".to_string(),
            },
        );
        auto.max_consecutive_failures = 3;
        for _ in 0..3 {
            auto.record_run(AutomationRunStatus::Failed);
        }
        assert!(!auto.enabled);
    }

    #[test]
    fn enable_resets_failure_count() {
        let mut auto = Automation::new(
            "sys_4",
            "Recoverable",
            AutomationTrigger::Manual,
            AutomationAction::Webhook {
                url: "https://example.com".to_string(),
            },
        );
        auto.record_run(AutomationRunStatus::Failed);
        auto.enable();
        assert_eq!(auto.consecutive_failures, 0);
        assert!(auto.enabled);
    }

    #[test]
    fn is_schedule_due_matches_cron() {
        // Midnight Monday UTC (00:00) → epoch secs 0
        assert!(is_schedule_due("0 0 * * *", 0));
        // 09:00 → 9*3600 = 32400
        assert!(is_schedule_due("0 9 * * *", 32400));
        // 09:01 = 32460 → minute 1, not minute 0 → should NOT match "0 9"
        assert!(!is_schedule_due("0 9 * * *", 32460));
        // Every 15 minutes at minute 0
        assert!(is_schedule_due("*/15 * * * *", 0));
        assert!(is_schedule_due("*/15 * * * *", 15 * 60));
        assert!(!is_schedule_due("*/15 * * * *", 7 * 60));
    }

    #[test]
    fn save_and_list_runs() {
        let (_dir, reg) = tmp_registry();
        let auto = Automation::new(
            "sys_5",
            "Job",
            AutomationTrigger::Manual,
            AutomationAction::Webhook {
                url: "https://x.com".to_string(),
            },
        );
        reg.save(&auto).unwrap();
        let run = AutomationRun {
            id: "run_001".to_string(),
            automation_id: auto.id.clone(),
            system_id: "sys_5".to_string(),
            trigger_reason: "manual".to_string(),
            status: AutomationRunStatus::Succeeded,
            started_at: now_rfc3339(),
            finished_at: Some(now_rfc3339()),
            output_artifact_id: None,
            error_message: None,
            retry_count: 0,
        };
        reg.save_run(&run).unwrap();
        let runs = reg.list_runs("sys_5", &auto.id).unwrap();
        assert_eq!(runs.len(), 1);
    }

    #[test]
    fn scheduler_returns_due_automations() {
        let (_dir, reg) = tmp_registry();
        // Due at epoch 0 (00:00)
        let due = Automation::new(
            "sys_sched",
            "Midnight job",
            AutomationTrigger::Schedule {
                cron: "0 0 * * *".to_string(),
            },
            AutomationAction::RunTask {
                prompt_template: "do it".to_string(),
            },
        );
        // Not due at epoch 0 (09:00 schedule)
        let not_due = Automation::new(
            "sys_sched",
            "Morning job",
            AutomationTrigger::Schedule {
                cron: "0 9 * * *".to_string(),
            },
            AutomationAction::RunTask {
                prompt_template: "morning".to_string(),
            },
        );
        reg.save(&due).unwrap();
        reg.save(&not_due).unwrap();

        let scheduler = AutomationScheduler::new(&reg);
        let fired = scheduler.tick("sys_sched", 0); // epoch 0 = 00:00
        assert_eq!(fired.len(), 1);
        assert_eq!(fired[0].name, "Midnight job");
    }

    #[test]
    fn scheduler_skips_disabled_automations() {
        let (_dir, reg) = tmp_registry();
        let mut auto = Automation::new(
            "sys_dis",
            "Disabled job",
            AutomationTrigger::Schedule {
                cron: "0 0 * * *".to_string(),
            },
            AutomationAction::RunTask {
                prompt_template: "x".to_string(),
            },
        );
        auto.disable();
        reg.save(&auto).unwrap();

        let scheduler = AutomationScheduler::new(&reg);
        let fired = scheduler.tick("sys_dis", 0);
        assert!(fired.is_empty());
    }
}
