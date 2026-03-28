//! Artifact registry — durable result pages from completed tasks.
//!
//! Artifacts are the V2 output objects.  Each major task ends in an artifact
//! that records what was done, what was decided, and what was produced.
//!
//! # Storage layout
//!
//! ```text
//! $cwd/.pi/artifacts/
//!   {system_id}/
//!     {artifact_id}.json
//! ```
//!
//! # Artifact types (V2 spec § 6.7)
//!
//! Content calendar, product spec, code delivery package, contract draft,
//! research brief, lesson plan, screenplay pack, and any custom artifact.

use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

// ── Artifact ─────────────────────────────────────────────────────────────────

/// A durable result page from one completed task run.
///
/// Maps to V2 spec § 6.7 and § 9.2.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Artifact {
    /// Stable id (e.g. `"art_1a2b3c"`).
    pub id: String,
    /// System that produced this artifact.
    pub system_id: String,
    /// Task or goal that generated this artifact.
    pub task_summary: String,
    /// Explicit artifact type label (e.g. `"website_delivery_package"`, `"research_memo"`).
    /// Separate from schema to support filtering and display.
    #[serde(default)]
    pub artifact_type: String,
    /// Result schema (e.g. `"website_delivery"`, `"research_brief"`).
    pub schema: Option<String>,
    /// Session id from which this artifact was generated.
    pub session_id: Option<String>,
    /// Where the task ran: `"local"`, `"cloud"`, `"hybrid"`.
    #[serde(default = "default_execution_target")]
    pub execution_target: String,
    /// Vault branch this artifact was produced on, if any.
    pub branch_id: Option<String>,
    /// Nearest vault snapshot at time of generation, for provenance.
    pub snapshot_id: Option<String>,
    /// Human-readable status.
    pub status: ArtifactStatus,
    pub created_at: String,
    pub updated_at: String,

    // ── Result page content (V2 spec § 9.2) ───────────────────────────────
    /// Structured inputs provided to the task.
    #[serde(default)]
    pub inputs: Vec<ArtifactEntry>,
    /// Key decisions made during execution.
    #[serde(default)]
    pub decisions: Vec<ArtifactEntry>,
    /// Generated deliverables (title → content/path).
    #[serde(default)]
    pub deliverables: Vec<Deliverable>,
    /// Supporting evidence or references.
    #[serde(default)]
    pub evidence: Vec<ArtifactEntry>,
    /// Next-step suggestions shown on the result page.
    #[serde(default)]
    pub next_steps: Vec<NextStep>,
    /// Tags for filtering in the Results library.
    #[serde(default)]
    pub tags: Vec<String>,
}

fn default_execution_target() -> String {
    "local".to_string()
}

/// Full lifecycle status of an artifact (Result Center spec §14).
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ArtifactStatus {
    #[default]
    Draft,
    ReadyForReview,
    Approved,
    ReadyToPublish,
    Published,
    Complete,
    Archived,
}

impl ArtifactStatus {
    pub const fn label(&self) -> &'static str {
        match self {
            Self::Draft => "draft",
            Self::ReadyForReview => "ready_for_review",
            Self::Approved => "approved",
            Self::ReadyToPublish => "ready_to_publish",
            Self::Published => "published",
            Self::Complete => "complete",
            Self::Archived => "archived",
        }
    }

    /// True if the artifact is ready for external action (publish, share, export).
    pub const fn is_actionable(&self) -> bool {
        matches!(
            self,
            Self::ReadyForReview | Self::Approved | Self::ReadyToPublish | Self::Published
        )
    }
}

/// One key-value entry in the result page (input, decision, evidence).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArtifactEntry {
    pub key: String,
    pub value: String,
}

impl ArtifactEntry {
    pub fn new(key: impl Into<String>, value: impl Into<String>) -> Self {
        Self {
            key: key.into(),
            value: value.into(),
        }
    }
}

/// A generated deliverable attached to an artifact.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Deliverable {
    pub title: String,
    /// Inline text content, if available.
    pub content: Option<String>,
    /// File path (relative to workspace), if saved to disk.
    pub path: Option<String>,
    #[serde(default = "yes")]
    pub visible: bool,
}

impl Deliverable {
    pub fn text(title: impl Into<String>, content: impl Into<String>) -> Self {
        Self {
            title: title.into(),
            content: Some(content.into()),
            path: None,
            visible: true,
        }
    }

    pub fn file(title: impl Into<String>, path: impl Into<String>) -> Self {
        Self {
            title: title.into(),
            content: None,
            path: Some(path.into()),
            visible: true,
        }
    }
}

/// A suggested next action shown at the bottom of the result page.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NextStep {
    pub label: String,
    pub action: NextStepAction,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case", tag = "type")]
pub enum NextStepAction {
    /// Open a new chat task with pre-filled context.
    StartTask { prompt: String },
    /// Trigger an automation.
    RunAutomation { automation_id: String },
    /// Export to a SaaS system.
    Export { destination: String },
    /// Open the artifact in a viewer.
    View,
}

impl Artifact {
    /// Construct a new draft artifact.
    pub fn new(system_id: impl Into<String>, task_summary: impl Into<String>) -> Self {
        let now = now_rfc3339();
        let id = gen_artifact_id();
        Self {
            id,
            system_id: system_id.into(),
            task_summary: task_summary.into(),
            artifact_type: String::new(),
            schema: None,
            session_id: None,
            execution_target: "local".to_string(),
            branch_id: None,
            snapshot_id: None,
            status: ArtifactStatus::Draft,
            created_at: now.clone(),
            updated_at: now,
            inputs: Vec::new(),
            decisions: Vec::new(),
            deliverables: Vec::new(),
            evidence: Vec::new(),
            next_steps: Vec::new(),
            tags: Vec::new(),
        }
    }

    #[must_use]
    pub fn with_type(mut self, artifact_type: impl Into<String>) -> Self {
        self.artifact_type = artifact_type.into();
        self
    }

    #[must_use]
    pub fn with_execution_target(mut self, target: impl Into<String>) -> Self {
        self.execution_target = target.into();
        self
    }

    #[must_use]
    pub fn with_provenance(
        mut self,
        branch_id: Option<String>,
        snapshot_id: Option<String>,
    ) -> Self {
        self.branch_id = branch_id;
        self.snapshot_id = snapshot_id;
        self
    }

    /// Mark ready for human review.
    pub fn mark_ready_for_review(&mut self) {
        self.status = ArtifactStatus::ReadyForReview;
        self.updated_at = now_rfc3339();
    }

    /// Approve the artifact.
    pub fn approve(&mut self) {
        self.status = ArtifactStatus::Approved;
        self.updated_at = now_rfc3339();
    }

    /// Mark ready to publish.
    pub fn mark_ready_to_publish(&mut self) {
        self.status = ArtifactStatus::ReadyToPublish;
        self.updated_at = now_rfc3339();
    }

    /// Mark as complete and update the timestamp.
    pub fn complete(&mut self) {
        self.status = ArtifactStatus::Complete;
        self.updated_at = now_rfc3339();
    }

    /// Add a deliverable.
    pub fn add_deliverable(&mut self, d: Deliverable) {
        self.deliverables.push(d);
        self.updated_at = now_rfc3339();
    }
}

const fn yes() -> bool {
    true
}

// ── ArtifactRegistry ─────────────────────────────────────────────────────────

/// File-backed artifact store.  Operates on `.pi/artifacts/` in the workspace.
pub struct ArtifactRegistry {
    artifacts_root: PathBuf,
}

impl ArtifactRegistry {
    /// Create a registry rooted at `{workspace}/.pi/artifacts/`.
    pub fn new(workspace: &Path) -> Self {
        Self {
            artifacts_root: workspace.join(".pi").join("artifacts"),
        }
    }

    // ── Write ──────────────────────────────────────────────────────────────

    /// Persist an artifact.  Creates directories as needed.
    pub fn save(&self, artifact: &Artifact) -> anyhow::Result<()> {
        let dir = self.system_dir(&artifact.system_id);
        std::fs::create_dir_all(&dir)?;
        let path = dir.join(format!("{}.json", artifact.id));
        let json = serde_json::to_string_pretty(artifact)?;
        atomic_write(&path, json.as_bytes())?;
        Ok(())
    }

    // ── Read ───────────────────────────────────────────────────────────────

    /// Load a specific artifact by id.
    pub fn load(&self, system_id: &str, artifact_id: &str) -> anyhow::Result<Artifact> {
        let path = self
            .system_dir(system_id)
            .join(format!("{artifact_id}.json"));
        let bytes = std::fs::read(&path)
            .map_err(|e| anyhow::anyhow!("artifact {artifact_id} not found: {e}"))?;
        serde_json::from_slice(&bytes).map_err(|e| anyhow::anyhow!("artifact parse error: {e}"))
    }

    /// List all artifacts for a system, sorted newest-first.
    pub fn list_for_system(&self, system_id: &str) -> anyhow::Result<Vec<Artifact>> {
        let dir = self.system_dir(system_id);
        if !dir.exists() {
            return Ok(Vec::new());
        }
        let mut arts: Vec<Artifact> = std::fs::read_dir(&dir)?
            .filter_map(std::result::Result::ok)
            .filter(|e| e.path().extension().and_then(|s| s.to_str()) == Some("json"))
            .filter_map(|e| std::fs::read(e.path()).ok())
            .filter_map(|bytes| serde_json::from_slice(&bytes).ok())
            .collect();
        arts.sort_by(|a, b| b.created_at.cmp(&a.created_at));
        Ok(arts)
    }

    /// Count artifacts for a system.
    pub fn count_for_system(&self, system_id: &str) -> usize {
        self.list_for_system(system_id).map_or(0, |v| v.len())
    }

    fn system_dir(&self, system_id: &str) -> PathBuf {
        self.artifacts_root.join(system_id)
    }
}

// ── Utility ───────────────────────────────────────────────────────────────────

fn gen_artifact_id() -> String {
    use std::sync::atomic::{AtomicU64, Ordering};
    use std::time::{SystemTime, UNIX_EPOCH};
    static SEQ: AtomicU64 = AtomicU64::new(0);
    #[allow(clippy::cast_possible_truncation)]
    let ns = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos() as u64;
    let seq = SEQ.fetch_add(1, Ordering::Relaxed);
    format!("art_{ns:x}_{seq:x}")
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
    // Include milliseconds so fast test runs get distinct sortable timestamps.
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

    fn tmp_registry() -> (tempfile::TempDir, ArtifactRegistry) {
        let dir = tempfile::tempdir().expect("tempdir");
        let reg = ArtifactRegistry::new(dir.path());
        (dir, reg)
    }

    #[test]
    fn save_and_load_artifact() {
        let (_dir, reg) = tmp_registry();
        let mut art = Artifact::new("sys_1", "Build landing page");
        art.add_deliverable(Deliverable::text("Hero copy", "Welcome to ACME."));
        reg.save(&art).unwrap();
        let loaded = reg.load("sys_1", &art.id).unwrap();
        assert_eq!(loaded.task_summary, "Build landing page");
        assert_eq!(loaded.deliverables.len(), 1);
    }

    #[test]
    fn list_artifacts_sorted_newest_first() {
        let (_dir, reg) = tmp_registry();
        for task in ["task_a", "task_b"] {
            let art = Artifact::new("sys_2", task);
            reg.save(&art).unwrap();
        }
        let list = reg.list_for_system("sys_2").unwrap();
        assert_eq!(list.len(), 2);
    }

    #[test]
    fn complete_updates_status() {
        let mut art = Artifact::new("sys_3", "Research task");
        assert_eq!(art.status, ArtifactStatus::Draft);
        art.complete();
        assert_eq!(art.status, ArtifactStatus::Complete);
    }

    #[test]
    fn empty_list_for_unknown_system() {
        let (_dir, reg) = tmp_registry();
        let list = reg.list_for_system("unknown").unwrap();
        assert!(list.is_empty());
    }

    #[test]
    fn deliverable_text_has_content() {
        let d = Deliverable::text("Title", "Body text");
        assert!(d.content.is_some());
        assert!(d.path.is_none());
    }

    #[test]
    fn deliverable_file_has_path() {
        let d = Deliverable::file("Output", "output/result.md");
        assert!(d.path.is_some());
        assert!(d.content.is_none());
    }

    #[test]
    fn status_lifecycle_progression() {
        let mut art = Artifact::new("sys_4", "Full lifecycle");
        assert_eq!(art.status, ArtifactStatus::Draft);
        assert!(!art.status.is_actionable());

        art.mark_ready_for_review();
        assert_eq!(art.status, ArtifactStatus::ReadyForReview);
        assert!(art.status.is_actionable());

        art.approve();
        assert_eq!(art.status, ArtifactStatus::Approved);
        assert!(art.status.is_actionable());

        art.mark_ready_to_publish();
        assert_eq!(art.status, ArtifactStatus::ReadyToPublish);
        assert!(art.status.is_actionable());

        art.complete();
        assert_eq!(art.status, ArtifactStatus::Complete);
        assert!(!art.status.is_actionable());
    }

    #[test]
    fn artifact_provenance_fields() {
        let art = Artifact::new("sys_5", "Provenance test")
            .with_type("research_brief")
            .with_execution_target("hybrid")
            .with_provenance(Some("branch_abc".into()), Some("snap_xyz".into()));

        assert_eq!(art.artifact_type, "research_brief");
        assert_eq!(art.execution_target, "hybrid");
        assert_eq!(art.branch_id.as_deref(), Some("branch_abc"));
        assert_eq!(art.snapshot_id.as_deref(), Some("snap_xyz"));
    }

    #[test]
    fn artifact_status_labels() {
        assert_eq!(ArtifactStatus::Draft.label(), "draft");
        assert_eq!(ArtifactStatus::ReadyForReview.label(), "ready_for_review");
        assert_eq!(ArtifactStatus::ReadyToPublish.label(), "ready_to_publish");
        assert_eq!(ArtifactStatus::Published.label(), "published");
        assert_eq!(ArtifactStatus::Archived.label(), "archived");
    }

    #[test]
    fn artifact_default_execution_target_is_local() {
        let art = Artifact::new("sys_6", "Default target");
        assert_eq!(art.execution_target, "local");
    }
}
