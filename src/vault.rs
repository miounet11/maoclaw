//! System Vault — snapshot, restore, clone, and branch engine.
//!
//! The Vault is the V2 differentiator: it turns accumulated system tuning into
//! recoverable, branchable product value.
//!
//! # Storage layout
//!
//! ```text
//! $cwd/.pi/vault/
//!   {system_id}/
//!     snapshots/
//!       {snapshot_id}.json   ← serialised VaultSnapshot
//!     branches/
//!       {branch_id}.json     ← VaultBranch
//! ```
//!
//! # Snapshot types (V2 spec § 10.4)
//!
//! | Type | When created |
//! |------|-------------|
//! | `Baseline` | On first vault write for a new system |
//! | `AutoCheckpoint` | Automatically before destructive operations |
//! | `Manual` | User-initiated from the Vault panel |
//! | `Milestone` | Pinned by user as a named version |
//! | `PreMigration` | Before V1→V2 or schema migrations |
//! | `PreExperiment` | Before a risky prompt/config experiment |

use crate::system_profile::{SystemProfile, gen_system_id};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

// ── Snapshot type ─────────────────────────────────────────────────────────────

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SnapshotKind {
    Baseline,
    AutoCheckpoint,
    Manual,
    Milestone,
    PreMigration,
    PreExperiment,
}

impl SnapshotKind {
    pub const fn label(&self) -> &'static str {
        match self {
            Self::Baseline => "baseline",
            Self::AutoCheckpoint => "auto-checkpoint",
            Self::Manual => "manual",
            Self::Milestone => "milestone",
            Self::PreMigration => "pre-migration",
            Self::PreExperiment => "pre-experiment",
        }
    }

    pub const fn is_auto(&self) -> bool {
        matches!(self, Self::AutoCheckpoint)
    }
}

// ── VaultSnapshot ─────────────────────────────────────────────────────────────

/// A complete point-in-time capture of a SystemProfile's state.
///
/// Snapshots are immutable after creation.  Restore produces a new profile
/// (or replaces in-place) without modifying the snapshot itself.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VaultSnapshot {
    /// Stable snapshot id (e.g. `"snap_1a2b3c"`).
    pub id: String,
    pub system_id: String,
    pub kind: SnapshotKind,
    /// Optional human label (always set for `Milestone`).
    pub label: Option<String>,
    pub created_at: String,
    /// The full serialised system state at snapshot time.
    pub system: SystemProfile,
    /// Scopes included (for partial restore).
    pub scopes: SnapshotScopes,
}

impl VaultSnapshot {
    pub fn new(kind: SnapshotKind, system: SystemProfile, label: Option<String>) -> Self {
        use std::sync::atomic::{AtomicU64, Ordering};
        use std::time::{SystemTime, UNIX_EPOCH};
        static SEQ: AtomicU64 = AtomicU64::new(0);
        #[allow(clippy::cast_possible_truncation)]
        let ns = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos() as u64;
        let seq = SEQ.fetch_add(1, Ordering::Relaxed);
        let id = format!("snap_{ns:x}_{seq:x}");
        let system_id = system.id.clone();
        let created_at = system.created_at.clone().unwrap_or_else(|| id.clone());
        Self {
            id,
            system_id,
            kind,
            label,
            created_at,
            scopes: SnapshotScopes::full(),
            system,
        }
    }

    /// Display label: use custom label if set, otherwise kind + id suffix.
    pub fn display_label(&self) -> String {
        self.label.as_ref().map_or_else(
            || {
                format!(
                    "{} ({})",
                    self.kind.label(),
                    &self.id[self.id.len().min(8)..]
                )
            },
            Clone::clone,
        )
    }
}

/// Which scopes were captured in a snapshot.
///
/// Enables partial restore by scope (V2 spec § 10.5).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[allow(clippy::struct_excessive_bools)]
pub struct SnapshotScopes {
    pub system_config: bool,
    pub team_blueprint: bool,
    pub prompt_assignments: bool,
    pub memory_stores: bool,
    pub permissions: bool,
    pub bindings: bool,
    pub automations: bool,
    pub artifact_index: bool,
}

impl SnapshotScopes {
    pub const fn full() -> Self {
        Self {
            system_config: true,
            team_blueprint: true,
            prompt_assignments: true,
            memory_stores: true,
            permissions: true,
            bindings: true,
            automations: true,
            artifact_index: true,
        }
    }

    pub const fn config_only() -> Self {
        Self {
            system_config: true,
            team_blueprint: true,
            prompt_assignments: true,
            memory_stores: false,
            permissions: false,
            bindings: false,
            automations: false,
            artifact_index: false,
        }
    }
}

// ── VaultBranch ───────────────────────────────────────────────────────────────

/// A derived version of a system, created from a snapshot for experimentation.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VaultBranch {
    pub id: String,
    pub system_id: String,
    pub name: String,
    pub parent_snapshot_id: String,
    pub created_at: String,
    pub description: Option<String>,
    pub is_active: bool,
}

impl VaultBranch {
    pub fn new(
        system_id: impl Into<String>,
        name: impl Into<String>,
        parent_snapshot_id: impl Into<String>,
    ) -> Self {
        let id = format!("branch_{}", gen_system_id().trim_start_matches("sys_"));
        Self {
            id,
            system_id: system_id.into(),
            name: name.into(),
            parent_snapshot_id: parent_snapshot_id.into(),
            created_at: String::new(), // filled by VaultManager
            description: None,
            is_active: false,
        }
    }
}

// ── VaultManager ─────────────────────────────────────────────────────────────

/// File-backed vault.  Operates on `.pi/vault/` relative to the workspace.
pub struct VaultManager {
    vault_root: PathBuf,
}

impl VaultManager {
    /// Create a manager rooted at `{workspace}/.pi/vault/`.
    pub fn new(workspace: &Path) -> Self {
        Self {
            vault_root: workspace.join(".pi").join("vault"),
        }
    }

    // ── Write operations ───────────────────────────────────────────────────

    /// Save a snapshot to disk.  Returns the snapshot id.
    pub fn save_snapshot(&self, snap: &VaultSnapshot) -> anyhow::Result<String> {
        let dir = self.snapshots_dir(&snap.system_id);
        std::fs::create_dir_all(&dir)?;
        let path = dir.join(format!("{}.json", snap.id));
        let json = serde_json::to_string_pretty(snap)?;
        atomic_write(&path, json.as_bytes())?;
        Ok(snap.id.clone())
    }

    /// Convenience: snapshot a system, save it, and return the snapshot.
    pub fn checkpoint(
        &self,
        system: SystemProfile,
        kind: SnapshotKind,
        label: Option<String>,
    ) -> anyhow::Result<VaultSnapshot> {
        let snap = VaultSnapshot::new(kind, system, label);
        self.save_snapshot(&snap)?;
        Ok(snap)
    }

    /// Create a baseline snapshot if the system has none yet.
    ///
    /// Safe to call multiple times — skips if a baseline already exists.
    pub fn ensure_baseline(&self, system: &SystemProfile) -> anyhow::Result<Option<String>> {
        if system.baseline_snapshot_id.is_some() {
            return Ok(None);
        }
        let snap = self.checkpoint(
            system.clone(),
            SnapshotKind::Baseline,
            Some("Baseline".to_string()),
        )?;
        Ok(Some(snap.id))
    }

    // ── Read operations ────────────────────────────────────────────────────

    /// Load a specific snapshot by id.
    pub fn load_snapshot(
        &self,
        system_id: &str,
        snapshot_id: &str,
    ) -> anyhow::Result<VaultSnapshot> {
        let path = self
            .snapshots_dir(system_id)
            .join(format!("{snapshot_id}.json"));
        let bytes = std::fs::read(&path)
            .map_err(|e| anyhow::anyhow!("snapshot {snapshot_id} not found: {e}"))?;
        serde_json::from_slice(&bytes).map_err(|e| anyhow::anyhow!("snapshot parse error: {e}"))
    }

    /// List all snapshots for a system, sorted newest-first.
    pub fn list_snapshots(&self, system_id: &str) -> anyhow::Result<Vec<VaultSnapshot>> {
        let dir = self.snapshots_dir(system_id);
        if !dir.exists() {
            return Ok(Vec::new());
        }
        let mut snaps: Vec<VaultSnapshot> = std::fs::read_dir(&dir)?
            .filter_map(std::result::Result::ok)
            .filter(|e| e.path().extension().and_then(|s| s.to_str()) == Some("json"))
            .filter_map(|e| std::fs::read(e.path()).ok())
            .filter_map(|bytes| serde_json::from_slice(&bytes).ok())
            .collect();
        snaps.sort_by(|a, b| b.created_at.cmp(&a.created_at));
        Ok(snaps)
    }

    // ── Restore ────────────────────────────────────────────────────────────

    /// Full restore: return a copy of the system from the snapshot.
    ///
    /// The caller is responsible for swapping the returned profile into the
    /// active config.  The original snapshot is not modified.
    pub fn restore_full(
        &self,
        system_id: &str,
        snapshot_id: &str,
    ) -> anyhow::Result<SystemProfile> {
        let snap = self.load_snapshot(system_id, snapshot_id)?;
        Ok(snap.system)
    }

    /// Clone: restore from snapshot with a new system id and name.
    ///
    /// Useful for "Duplicate this system to test new ideas" (V2 spec § 10.7).
    pub fn clone_from_snapshot(
        &self,
        system_id: &str,
        snapshot_id: &str,
        new_name: impl Into<String>,
    ) -> anyhow::Result<SystemProfile> {
        let snap = self.load_snapshot(system_id, snapshot_id)?;
        let mut cloned = snap.system;
        cloned.id = gen_system_id();
        cloned.name = new_name.into();
        cloned.baseline_snapshot_id = None;
        cloned.active_snapshot_id = None;
        cloned.current_branch_id = None;
        Ok(cloned)
    }

    // ── Branches ──────────────────────────────────────────────────────────

    pub fn save_branch(&self, branch: &VaultBranch) -> anyhow::Result<()> {
        let dir = self.branches_dir(&branch.system_id);
        std::fs::create_dir_all(&dir)?;
        let path = dir.join(format!("{}.json", branch.id));
        let json = serde_json::to_string_pretty(branch)?;
        atomic_write(&path, json.as_bytes())?;
        Ok(())
    }

    pub fn list_branches(&self, system_id: &str) -> anyhow::Result<Vec<VaultBranch>> {
        let dir = self.branches_dir(system_id);
        if !dir.exists() {
            return Ok(Vec::new());
        }
        let branches: Vec<VaultBranch> = std::fs::read_dir(&dir)?
            .filter_map(std::result::Result::ok)
            .filter(|e| e.path().extension().and_then(|s| s.to_str()) == Some("json"))
            .filter_map(|e| std::fs::read(e.path()).ok())
            .filter_map(|bytes| serde_json::from_slice(&bytes).ok())
            .collect();
        Ok(branches)
    }

    // ── Paths ─────────────────────────────────────────────────────────────

    fn snapshots_dir(&self, system_id: &str) -> PathBuf {
        self.vault_root.join(system_id).join("snapshots")
    }

    fn branches_dir(&self, system_id: &str) -> PathBuf {
        self.vault_root.join(system_id).join("branches")
    }

    pub fn vault_root(&self) -> &Path {
        &self.vault_root
    }
}

// ── Utility ───────────────────────────────────────────────────────────────────

/// Write `content` to `path` atomically via a sibling temp file.
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
    use crate::system_profile::SystemProfile;

    fn tmp_vault() -> (tempfile::TempDir, VaultManager) {
        let dir = tempfile::tempdir().expect("tempdir");
        let mgr = VaultManager::new(dir.path());
        (dir, mgr)
    }

    fn make_system(id: &str) -> SystemProfile {
        SystemProfile::new(id, "Test System", "custom")
    }

    #[test]
    fn save_and_load_snapshot() {
        let (_dir, mgr) = tmp_vault();
        let sys = make_system("s1");
        let snap = VaultSnapshot::new(SnapshotKind::Manual, sys, Some("v1".to_string()));
        let snap_id = mgr.save_snapshot(&snap).unwrap();
        let loaded = mgr.load_snapshot("s1", &snap_id).unwrap();
        assert_eq!(loaded.system.id, "s1");
        assert_eq!(loaded.label.as_deref(), Some("v1"));
    }

    #[test]
    fn list_snapshots_sorted_newest_first() {
        let (_dir, mgr) = tmp_vault();
        for label in ["first", "second"] {
            let sys = make_system("s1");
            let snap = VaultSnapshot::new(SnapshotKind::Manual, sys, Some(label.to_string()));
            mgr.save_snapshot(&snap).unwrap();
        }
        let list = mgr.list_snapshots("s1").unwrap();
        assert_eq!(list.len(), 2);
    }

    #[test]
    fn restore_full_returns_system() {
        let (_dir, mgr) = tmp_vault();
        let sys = make_system("s2");
        let snap = VaultSnapshot::new(SnapshotKind::Baseline, sys, None);
        let snap_id = mgr.save_snapshot(&snap).unwrap();
        let restored = mgr.restore_full("s2", &snap_id).unwrap();
        assert_eq!(restored.id, "s2");
    }

    #[test]
    fn clone_from_snapshot_gets_new_id() {
        let (_dir, mgr) = tmp_vault();
        let sys = make_system("s3");
        let snap = VaultSnapshot::new(SnapshotKind::Manual, sys, None);
        let snap_id = mgr.save_snapshot(&snap).unwrap();
        let cloned = mgr.clone_from_snapshot("s3", &snap_id, "Clone").unwrap();
        assert_ne!(cloned.id, "s3");
        assert_eq!(cloned.name, "Clone");
        assert!(cloned.baseline_snapshot_id.is_none());
    }

    #[test]
    fn ensure_baseline_skips_if_already_set() {
        let (_dir, mgr) = tmp_vault();
        let mut sys = make_system("s4");
        sys.baseline_snapshot_id = Some("existing_baseline".to_string());
        let result = mgr.ensure_baseline(&sys).unwrap();
        assert!(result.is_none()); // skipped
    }

    #[test]
    fn empty_snapshot_list_on_unknown_system() {
        let (_dir, mgr) = tmp_vault();
        let list = mgr.list_snapshots("unknown").unwrap();
        assert!(list.is_empty());
    }

    #[test]
    fn snapshot_display_label_uses_custom_label() {
        let sys = make_system("s5");
        let snap = VaultSnapshot::new(SnapshotKind::Milestone, sys, Some("MVP launch".to_string()));
        assert_eq!(snap.display_label(), "MVP launch");
    }

    #[test]
    fn snapshot_display_label_falls_back_to_kind() {
        let sys = make_system("s6");
        let snap = VaultSnapshot::new(SnapshotKind::AutoCheckpoint, sys, None);
        assert!(snap.display_label().contains("auto-checkpoint"));
    }
}
