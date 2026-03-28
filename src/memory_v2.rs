//! Memory V2 — structured, partition-aware durable memory for system profiles.
//!
//! Replaces the idea of a single memory blob with typed, provenance-tracked
//! memory buckets that can be loaded selectively per task and per role.
//!
//! # Storage layout
//!
//! ```text
//! $cwd/.pi/memory/{system_id}/
//!   {partition}.jsonl      — append-only event log per partition
//!   index.json             — summary index with stats per partition
//! ```

use serde::{Deserialize, Serialize};
use std::io::Write as _;
use std::path::{Path, PathBuf};

// ── Partition types ───────────────────────────────────────────────────────────

/// The seven memory partitions defined in V2 spec § 10.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MemoryPartition {
    /// Stable user identity facts: name, timezone, role, preferences.
    UserProfile,
    /// Project-specific context: goals, constraints, prior decisions.
    ProjectContext,
    /// Long-running system rules, style guides, hard constraints.
    SystemRules,
    /// Tool usage patterns: preferred approaches, known failures.
    ToolUsage,
    /// Derived facts from prior artifact outputs.
    ResultHistory,
    /// Brand voice, tone, formatting standards.
    BrandStyle,
    /// Per-channel context for bindings (Telegram thread, Feishu group, etc.).
    ChannelContext,
}

impl MemoryPartition {
    pub const fn file_stem(&self) -> &'static str {
        match self {
            Self::UserProfile => "user_profile",
            Self::ProjectContext => "project_context",
            Self::SystemRules => "system_rules",
            Self::ToolUsage => "tool_usage",
            Self::ResultHistory => "result_history",
            Self::BrandStyle => "brand_style",
            Self::ChannelContext => "channel_context",
        }
    }

    pub const fn label(&self) -> &'static str {
        match self {
            Self::UserProfile => "User Profile",
            Self::ProjectContext => "Project Context",
            Self::SystemRules => "System Rules",
            Self::ToolUsage => "Tool Usage",
            Self::ResultHistory => "Result History",
            Self::BrandStyle => "Brand & Style",
            Self::ChannelContext => "Channel Context",
        }
    }

    pub const fn all() -> &'static [Self] {
        &[
            Self::UserProfile,
            Self::ProjectContext,
            Self::SystemRules,
            Self::ToolUsage,
            Self::ResultHistory,
            Self::BrandStyle,
            Self::ChannelContext,
        ]
    }
}

// ── MemoryEntry ───────────────────────────────────────────────────────────────

/// A single durable memory item.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryEntry {
    pub id: String,
    pub system_id: String,
    pub partition: MemoryPartition,
    /// Human-readable summary of the memory item.
    pub summary: String,
    /// Raw value or elaboration.
    pub value: String,
    /// Source: `"user_message"`, `"artifact"`, `"tool_output"`, `"manual"`, etc.
    pub provenance: String,
    /// Source session or task id for traceability.
    pub source_id: Option<String>,
    /// `0.0..=1.0` confidence score; lower-confidence items may be reviewed/pruned.
    #[serde(default = "default_confidence")]
    pub confidence: f32,
    pub created_at: String,
    pub last_used_at: Option<String>,
    /// If true, this entry is frozen and won't be auto-evicted.
    #[serde(default)]
    pub frozen: bool,
    /// If true, this entry has been soft-deleted.
    #[serde(default)]
    pub deleted: bool,
}

const fn default_confidence() -> f32 {
    1.0
}

impl MemoryEntry {
    pub fn new(
        system_id: impl Into<String>,
        partition: MemoryPartition,
        summary: impl Into<String>,
        value: impl Into<String>,
        provenance: impl Into<String>,
    ) -> Self {
        Self {
            id: gen_memory_id(),
            system_id: system_id.into(),
            partition,
            summary: summary.into(),
            value: value.into(),
            provenance: provenance.into(),
            source_id: None,
            confidence: 1.0,
            created_at: now_rfc3339(),
            last_used_at: None,
            frozen: false,
            deleted: false,
        }
    }

    #[must_use]
    pub fn with_source(mut self, source_id: impl Into<String>) -> Self {
        self.source_id = Some(source_id.into());
        self
    }

    #[must_use]
    pub const fn with_confidence(mut self, confidence: f32) -> Self {
        self.confidence = confidence.clamp(0.0, 1.0);
        self
    }
}

// ── MemoryIndex ───────────────────────────────────────────────────────────────

/// Summary index kept in `index.json` alongside the partition files.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct MemoryIndex {
    pub system_id: String,
    pub partitions: Vec<PartitionStat>,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PartitionStat {
    pub partition: MemoryPartition,
    pub entry_count: usize,
    pub frozen_count: usize,
    pub last_ingest_at: Option<String>,
}

// ── MemoryStore ───────────────────────────────────────────────────────────────

/// File-backed V2 memory store per system.
pub struct MemoryStore {
    root: PathBuf,
}

impl MemoryStore {
    /// Open the memory store rooted at `{workspace}/.pi/memory/`.
    pub fn new(workspace: &Path) -> Self {
        Self {
            root: workspace.join(".pi").join("memory"),
        }
    }

    fn system_dir(&self, system_id: &str) -> PathBuf {
        self.root.join(system_id)
    }

    fn partition_file(&self, system_id: &str, partition: MemoryPartition) -> PathBuf {
        self.system_dir(system_id)
            .join(format!("{}.jsonl", partition.file_stem()))
    }

    // ── Write ───────────────────────────────────────────────────────────────

    /// Append a memory entry to its partition log.
    pub fn ingest(&self, entry: &MemoryEntry) -> anyhow::Result<()> {
        let dir = self.system_dir(&entry.system_id);
        std::fs::create_dir_all(&dir)?;
        let path = self.partition_file(&entry.system_id, entry.partition);
        let line = serde_json::to_string(entry)? + "\n";
        // Append to JSONL file.
        let mut file = std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(&path)?;
        file.write_all(line.as_bytes())?;
        Ok(())
    }

    /// Freeze an entry so it won't be auto-evicted (load + rewrite entry).
    pub fn freeze(&self, system_id: &str, entry_id: &str) -> anyhow::Result<bool> {
        self.mutate_entry(system_id, entry_id, |e| e.frozen = true)
    }

    /// Soft-delete an entry.
    pub fn delete_entry(&self, system_id: &str, entry_id: &str) -> anyhow::Result<bool> {
        self.mutate_entry(system_id, entry_id, |e| e.deleted = true)
    }

    // ── Read ────────────────────────────────────────────────────────────────

    /// Load all live (non-deleted) entries for a partition.
    pub fn load_partition(
        &self,
        system_id: &str,
        partition: MemoryPartition,
    ) -> anyhow::Result<Vec<MemoryEntry>> {
        let path = self.partition_file(system_id, partition);
        if !path.exists() {
            return Ok(Vec::new());
        }
        let raw = std::fs::read_to_string(&path)?;
        let entries: Vec<MemoryEntry> = raw
            .lines()
            .filter(|l| !l.is_empty())
            .filter_map(|l| serde_json::from_str(l).ok())
            .filter(|e: &MemoryEntry| !e.deleted)
            .collect();
        Ok(entries)
    }

    /// Load entries for multiple partitions, e.g. to build a task context.
    pub fn load_partitions(
        &self,
        system_id: &str,
        partitions: &[MemoryPartition],
    ) -> anyhow::Result<Vec<MemoryEntry>> {
        let mut all = Vec::new();
        for &p in partitions {
            all.extend(self.load_partition(system_id, p)?);
        }
        Ok(all)
    }

    /// Build a summary index for the system.
    pub fn build_index(&self, system_id: &str) -> anyhow::Result<MemoryIndex> {
        let mut stats = Vec::new();
        for &partition in MemoryPartition::all() {
            let entries = self.load_partition(system_id, partition)?;
            let frozen_count = entries.iter().filter(|e| e.frozen).count();
            let last_ingest_at = entries.last().map(|e| e.created_at.clone());
            stats.push(PartitionStat {
                partition,
                entry_count: entries.len(),
                frozen_count,
                last_ingest_at,
            });
        }
        Ok(MemoryIndex {
            system_id: system_id.to_string(),
            partitions: stats,
            updated_at: now_rfc3339(),
        })
    }

    // ── Internal ────────────────────────────────────────────────────────────

    /// Mutate a single entry in-place by rewriting its partition file.
    fn mutate_entry(
        &self,
        system_id: &str,
        entry_id: &str,
        mutate: impl Fn(&mut MemoryEntry),
    ) -> anyhow::Result<bool> {
        for &partition in MemoryPartition::all() {
            let path = self.partition_file(system_id, partition);
            if !path.exists() {
                continue;
            }
            let raw = std::fs::read_to_string(&path)?;
            let mut entries: Vec<MemoryEntry> = raw
                .lines()
                .filter(|l| !l.is_empty())
                .filter_map(|l| serde_json::from_str(l).ok())
                .collect();
            if let Some(e) = entries.iter_mut().find(|e| e.id == entry_id) {
                mutate(e);
                let new_content: String = entries
                    .iter()
                    .map(|e| serde_json::to_string(e).unwrap_or_default() + "\n")
                    .collect();
                std::fs::write(&path, new_content)?;
                return Ok(true);
            }
        }
        Ok(false)
    }
}

// ── Retrieval helpers ─────────────────────────────────────────────────────────

/// Build a compact context string from memory entries for injection into a prompt.
pub fn format_memory_context(entries: &[MemoryEntry], max_chars: usize) -> String {
    if entries.is_empty() {
        return String::new();
    }
    let mut out = String::from("### Memory Context\n");
    let mut used = out.len();
    for entry in entries {
        let line = format!(
            "- [{}] {}: {}\n",
            entry.partition.label(),
            entry.summary,
            entry.value
        );
        if used + line.len() > max_chars {
            out.push_str("- ... (truncated)\n");
            break;
        }
        out.push_str(&line);
        used += line.len();
    }
    out
}

// ── Memory extraction ─────────────────────────────────────────────────────────

/// A candidate memory item extracted from a conversation turn.
#[derive(Debug, Clone)]
pub struct MemoryCandidate {
    pub partition: MemoryPartition,
    pub summary: String,
    pub value: String,
    pub confidence: f32,
}

/// Extract durable-memory candidates from a conversation turn.
///
/// `user_text` and `assistant_text` are the raw message pair.
/// `system_id` is used for the returned candidates but not the extraction logic.
///
/// This is a heuristic extraction pass — no model call.  It detects:
/// - Name declarations ("my name is …", "I'm …")
/// - Timezone mentions ("I'm in UTC+8", "Pacific time")
/// - Goal / project context ("we're building …", "the project is …")
/// - Explicit instruction patterns ("always …", "never …", "remember that …")
/// - Brand/tone signals ("write in a …tone", "use … style")
#[allow(clippy::too_many_lines)]
pub fn extract_memory_candidates(user_text: &str, assistant_text: &str) -> Vec<MemoryCandidate> {
    let _ = assistant_text; // Reserved for future use (e.g. fact confirmation)
    let mut candidates = Vec::new();
    let lower = user_text.to_lowercase();

    // ── Name ──────────────────────────────────────────────────────────────────
    for prefix in &["my name is ", "i'm ", "i am ", "call me "] {
        if let Some(pos) = lower.find(prefix) {
            let rest = &user_text[pos + prefix.len()..];
            let name: String = rest
                .split(['.', ',', '\n'])
                .next()
                .unwrap_or("")
                .trim()
                .to_string();
            if !name.is_empty() && name.len() < 60 {
                candidates.push(MemoryCandidate {
                    partition: MemoryPartition::UserProfile,
                    summary: "User's name".to_string(),
                    value: name,
                    confidence: 0.8,
                });
                break;
            }
        }
    }

    // ── Timezone ──────────────────────────────────────────────────────────────
    if lower.contains("utc") || lower.contains("timezone") || lower.contains("time zone") {
        // Extract surrounding context (up to 80 chars around the keyword)
        let pos = lower
            .find("utc")
            .or_else(|| lower.find("timezone"))
            .or_else(|| lower.find("time zone"))
            .unwrap_or(0);
        let start = pos.saturating_sub(20);
        let end = (pos + 40).min(user_text.len());
        let snippet = user_text[start..end].trim().to_string();
        if !snippet.is_empty() {
            candidates.push(MemoryCandidate {
                partition: MemoryPartition::UserProfile,
                summary: "User timezone context".to_string(),
                value: snippet,
                confidence: 0.7,
            });
        }
    }

    // ── Project context ───────────────────────────────────────────────────────
    for prefix in &[
        "we're building ",
        "we are building ",
        "the project is ",
        "our product is ",
        "the app is ",
        "this is a project about ",
    ] {
        if let Some(pos) = lower.find(prefix) {
            let rest = &user_text[pos + prefix.len()..];
            let desc: String = rest
                .split(['.', '\n'])
                .next()
                .unwrap_or("")
                .trim()
                .to_string();
            if desc.len() >= 5 && desc.len() < 200 {
                candidates.push(MemoryCandidate {
                    partition: MemoryPartition::ProjectContext,
                    summary: "Project description".to_string(),
                    value: desc,
                    confidence: 0.75,
                });
                break;
            }
        }
    }

    // ── System rules (always/never/remember that) ─────────────────────────────
    for prefix in &[
        "always ",
        "never ",
        "remember that ",
        "make sure to ",
        "don't ever ",
    ] {
        if lower.starts_with(prefix)
            || lower.contains(&format!("\n{prefix}"))
            || lower.contains(&format!(". {prefix}"))
        {
            // Grab the first sentence starting with this instruction
            if let Some(pos) = lower.find(prefix) {
                let rest = &user_text[pos..];
                let rule: String = rest
                    .split(['.', '\n'])
                    .next()
                    .unwrap_or("")
                    .trim()
                    .to_string();
                if rule.len() >= 8 && rule.len() < 200 {
                    candidates.push(MemoryCandidate {
                        partition: MemoryPartition::SystemRules,
                        summary: "Instruction rule".to_string(),
                        value: rule,
                        confidence: 0.85,
                    });
                }
            }
        }
    }

    // ── Brand/tone ────────────────────────────────────────────────────────────
    for kw in &[
        "tone", "style", "voice", "brand", "formal", "casual", "concise",
    ] {
        if lower.contains(kw) {
            let pos = lower.find(kw).unwrap_or(0);
            let start = pos.saturating_sub(30);
            let end = (pos + 60).min(user_text.len());
            let snippet = user_text[start..end].trim().to_string();
            if snippet.len() >= 10 {
                candidates.push(MemoryCandidate {
                    partition: MemoryPartition::BrandStyle,
                    summary: format!("Style/tone mention: {kw}"),
                    value: snippet,
                    confidence: 0.6,
                });
                break; // One brand entry per turn is enough
            }
        }
    }

    candidates
}

// ── Utilities ─────────────────────────────────────────────────────────────────

fn gen_memory_id() -> String {
    use std::sync::atomic::{AtomicU64, Ordering};
    use std::time::{SystemTime, UNIX_EPOCH};
    static SEQ: AtomicU64 = AtomicU64::new(0);
    #[allow(clippy::cast_possible_truncation)]
    let ns = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos() as u64;
    let seq = SEQ.fetch_add(1, Ordering::Relaxed);
    format!("mem_{ns:x}_{seq:x}")
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

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    fn tmp_store() -> (tempfile::TempDir, MemoryStore) {
        let dir = tempfile::tempdir().expect("tempdir");
        let store = MemoryStore::new(dir.path());
        (dir, store)
    }

    #[test]
    fn ingest_and_load_partition() {
        let (_dir, store) = tmp_store();
        let entry = MemoryEntry::new(
            "sys_1",
            MemoryPartition::UserProfile,
            "User's name",
            "Alice",
            "user_message",
        );
        store.ingest(&entry).unwrap();
        let loaded = store
            .load_partition("sys_1", MemoryPartition::UserProfile)
            .unwrap();
        assert_eq!(loaded.len(), 1);
        assert_eq!(loaded[0].value, "Alice");
    }

    #[test]
    fn deleted_entries_excluded() {
        let (_dir, store) = tmp_store();
        let entry = MemoryEntry::new(
            "sys_2",
            MemoryPartition::SystemRules,
            "Rule",
            "Always respond in English",
            "manual",
        );
        let id = entry.id.clone();
        store.ingest(&entry).unwrap();
        store.delete_entry("sys_2", &id).unwrap();
        let loaded = store
            .load_partition("sys_2", MemoryPartition::SystemRules)
            .unwrap();
        assert!(loaded.is_empty());
    }

    #[test]
    fn freeze_survives_reload() {
        let (_dir, store) = tmp_store();
        let entry = MemoryEntry::new(
            "sys_3",
            MemoryPartition::BrandStyle,
            "Tone",
            "Direct and minimal",
            "manual",
        );
        let id = entry.id.clone();
        store.ingest(&entry).unwrap();
        store.freeze("sys_3", &id).unwrap();
        let loaded = store
            .load_partition("sys_3", MemoryPartition::BrandStyle)
            .unwrap();
        assert!(loaded[0].frozen);
    }

    #[test]
    fn load_multiple_partitions() {
        let (_dir, store) = tmp_store();
        let e1 = MemoryEntry::new("sys_4", MemoryPartition::UserProfile, "k", "v", "x");
        let e2 = MemoryEntry::new("sys_4", MemoryPartition::ProjectContext, "k2", "v2", "x");
        store.ingest(&e1).unwrap();
        store.ingest(&e2).unwrap();
        let all = store
            .load_partitions(
                "sys_4",
                &[
                    MemoryPartition::UserProfile,
                    MemoryPartition::ProjectContext,
                ],
            )
            .unwrap();
        assert_eq!(all.len(), 2);
    }

    #[test]
    fn build_index_counts_entries() {
        let (_dir, store) = tmp_store();
        for i in 0..3 {
            let e = MemoryEntry::new(
                "sys_5",
                MemoryPartition::ResultHistory,
                format!("item {i}"),
                format!("val {i}"),
                "artifact",
            );
            store.ingest(&e).unwrap();
        }
        let idx = store.build_index("sys_5").unwrap();
        let stat = idx
            .partitions
            .iter()
            .find(|s| s.partition == MemoryPartition::ResultHistory)
            .unwrap();
        assert_eq!(stat.entry_count, 3);
    }

    #[test]
    fn format_context_truncates() {
        let entries: Vec<MemoryEntry> = (0..100)
            .map(|i| {
                MemoryEntry::new(
                    "s",
                    MemoryPartition::UserProfile,
                    format!("k{i}"),
                    format!("v{i}"),
                    "x",
                )
            })
            .collect();
        let ctx = format_memory_context(&entries, 200);
        assert!(ctx.len() <= 250); // some slack for the truncation line
        assert!(ctx.contains("truncated"));
    }

    #[test]
    fn extract_name_from_user_message() {
        let candidates = extract_memory_candidates("My name is Bob Smith.", "");
        assert!(
            candidates.iter().any(|c| {
                c.partition == MemoryPartition::UserProfile && c.value.contains("Bob")
            })
        );
    }

    #[test]
    fn extract_project_context() {
        let candidates =
            extract_memory_candidates("We're building a SaaS tool for freelancers.", "");
        assert!(candidates.iter().any(|c| {
            c.partition == MemoryPartition::ProjectContext && c.value.contains("freelancers")
        }));
    }

    #[test]
    fn extract_system_rule_always() {
        let candidates =
            extract_memory_candidates("Always respond in English and keep it short.", "");
        assert!(candidates.iter().any(|c| {
            c.partition == MemoryPartition::SystemRules && c.value.starts_with("Always")
        }));
    }

    #[test]
    fn extract_brand_tone() {
        let candidates =
            extract_memory_candidates("Please use a casual, friendly tone in all copy.", "");
        assert!(
            candidates
                .iter()
                .any(|c| c.partition == MemoryPartition::BrandStyle)
        );
    }

    #[test]
    fn extract_empty_message_returns_no_candidates() {
        assert!(extract_memory_candidates("", "").is_empty());
    }
}
