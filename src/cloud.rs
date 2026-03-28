//! Cloud host registry — remote execution target contracts.
//!
//! The cloud layer is optional and additive: the local app remains the
//! source of truth for user data.  Cloud hosts are approved execution
//! targets for long-running or always-on tasks.
//!
//! ## Current status
//!
//! This is a Phase-E stub.  The types and registry are complete; the
//! actual HTTP dispatch to cloud hosts will be wired in Phase E
//! alongside the local bridge.

use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

// ── Cloud host ────────────────────────────────────────────────────────────────

/// A registered cloud execution host.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CloudHost {
    pub id: String,
    pub workspace_id: String,
    pub label: String,
    pub provider: CloudHostProvider,
    pub region: Option<String>,
    pub status: CloudHostStatus,
    pub capabilities: CloudHostCapabilities,
    pub registered_at: String,
    pub last_heartbeat_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CloudHostProvider {
    MaoclawManaged,
    UserSelfHosted,
    AwsLambda,
    GcpCloudRun,
    AzureContainerApps,
    Fly,
    Railway,
    Other(String),
}

impl CloudHostProvider {
    pub fn label(&self) -> String {
        match self {
            Self::MaoclawManaged => "maoclaw Cloud".to_string(),
            Self::UserSelfHosted => "Self-hosted".to_string(),
            Self::AwsLambda => "AWS Lambda".to_string(),
            Self::GcpCloudRun => "GCP Cloud Run".to_string(),
            Self::AzureContainerApps => "Azure Container Apps".to_string(),
            Self::Fly => "Fly.io".to_string(),
            Self::Railway => "Railway".to_string(),
            Self::Other(s) => s.clone(),
        }
    }
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CloudHostStatus {
    #[default]
    Pending,
    Healthy,
    Degraded,
    Offline,
    Revoked,
}

impl CloudHostStatus {
    pub const fn label(&self) -> &'static str {
        match self {
            Self::Pending => "pending",
            Self::Healthy => "healthy",
            Self::Degraded => "degraded",
            Self::Offline => "offline",
            Self::Revoked => "revoked",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CloudHostCapabilities {
    /// Max concurrent task runs.
    pub max_concurrent_tasks: u32,
    /// Supports long-running (> 5 min) tasks.
    pub long_running: bool,
    /// Supports Browser Operator execution.
    pub browser_operator: bool,
    /// Max memory in MB.
    pub memory_mb: u32,
}

impl Default for CloudHostCapabilities {
    fn default() -> Self {
        Self {
            max_concurrent_tasks: 5,
            long_running: true,
            browser_operator: false,
            memory_mb: 2048,
        }
    }
}

// ── Dispatch request ─────────────────────────────────────────────────────────

/// A task dispatch targeting a specific cloud host.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CloudDispatchRequest {
    pub request_id: String,
    pub host_id: String,
    pub system_id: String,
    pub task_title: String,
    pub prompt: String,
    pub priority: DispatchPriority,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DispatchPriority {
    Low,
    Normal,
    High,
}

impl CloudDispatchRequest {
    pub fn new(
        host_id: impl Into<String>,
        system_id: impl Into<String>,
        task_title: impl Into<String>,
        prompt: impl Into<String>,
    ) -> Self {
        Self {
            request_id: gen_request_id(),
            host_id: host_id.into(),
            system_id: system_id.into(),
            task_title: task_title.into(),
            prompt: prompt.into(),
            priority: DispatchPriority::Normal,
            created_at: now_rfc3339(),
        }
    }
}

// ── CloudHostRegistry ─────────────────────────────────────────────────────────

/// File-backed registry of approved cloud hosts.
///
/// Hosts are stored at `.pi/cloud/{workspace_id}/{host_id}.json`.
pub struct CloudHostRegistry {
    root: PathBuf,
}

impl CloudHostRegistry {
    pub fn new(workspace: &Path) -> Self {
        Self {
            root: workspace.join(".pi").join("cloud"),
        }
    }

    fn workspace_dir(&self, workspace_id: &str) -> PathBuf {
        self.root.join(workspace_id)
    }

    pub fn register(&self, host: &CloudHost) -> anyhow::Result<()> {
        let dir = self.workspace_dir(&host.workspace_id);
        std::fs::create_dir_all(&dir)?;
        let path = dir.join(format!("{}.json", host.id));
        let json = serde_json::to_string_pretty(host)?;
        atomic_write(&path, json.as_bytes())?;
        Ok(())
    }

    pub fn get(&self, workspace_id: &str, host_id: &str) -> anyhow::Result<CloudHost> {
        let path = self
            .workspace_dir(workspace_id)
            .join(format!("{host_id}.json"));
        let bytes = std::fs::read(&path)
            .map_err(|e| anyhow::anyhow!("cloud host {host_id} not found: {e}"))?;
        serde_json::from_slice(&bytes).map_err(|e| anyhow::anyhow!("parse: {e}"))
    }

    pub fn list(&self, workspace_id: &str) -> anyhow::Result<Vec<CloudHost>> {
        let dir = self.workspace_dir(workspace_id);
        if !dir.exists() {
            return Ok(Vec::new());
        }
        let hosts: Vec<CloudHost> = std::fs::read_dir(&dir)?
            .filter_map(Result::ok)
            .filter(|e| {
                let n = e.file_name();
                n.to_string_lossy().ends_with(".json")
            })
            .filter_map(|e| std::fs::read(e.path()).ok())
            .filter_map(|b| serde_json::from_slice(&b).ok())
            .collect();
        Ok(hosts)
    }

    pub fn update_status(
        &self,
        workspace_id: &str,
        host_id: &str,
        status: CloudHostStatus,
    ) -> anyhow::Result<()> {
        let mut host = self.get(workspace_id, host_id)?;
        host.status = status;
        host.last_heartbeat_at = Some(now_rfc3339());
        self.register(&host)
    }

    pub fn revoke(&self, workspace_id: &str, host_id: &str) -> anyhow::Result<()> {
        self.update_status(workspace_id, host_id, CloudHostStatus::Revoked)
    }

    /// List only healthy hosts that support browser operator.
    pub fn find_browser_hosts(&self, workspace_id: &str) -> anyhow::Result<Vec<CloudHost>> {
        let hosts = self.list(workspace_id)?;
        Ok(hosts
            .into_iter()
            .filter(|h| h.status == CloudHostStatus::Healthy && h.capabilities.browser_operator)
            .collect())
    }
}

/// Format a table of cloud hosts for TUI display.
pub fn format_hosts_table(hosts: &[CloudHost]) -> String {
    use std::fmt::Write;

    if hosts.is_empty() {
        return "  No cloud hosts registered.\n  Use /cloud register <url> to add one.\n"
            .to_string();
    }
    let mut out = String::from("  ID              PROVIDER                STATUS     BROWSER\n");
    for h in hosts {
        let browser = if h.capabilities.browser_operator {
            "yes"
        } else {
            "no"
        };
        let _ = writeln!(
            out,
            "  {:<16} {:<24} {:<10} {}",
            h.id,
            h.provider.label(),
            h.status.label(),
            browser,
        );
    }
    out
}

// ── Utilities ─────────────────────────────────────────────────────────────────

fn gen_request_id() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    #[allow(clippy::cast_possible_truncation)]
    let ns = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos()
        .wrapping_rem(u128::from(u64::MAX)) as u64;
    format!("req_{ns:x}")
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
    let parent = path.parent().ok_or_else(|| anyhow::anyhow!("no parent"))?;
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

    fn sample_host(workspace_id: &str, id: &str) -> CloudHost {
        CloudHost {
            id: id.to_string(),
            workspace_id: workspace_id.to_string(),
            label: "Test Host".to_string(),
            provider: CloudHostProvider::UserSelfHosted,
            region: Some("us-east-1".to_string()),
            status: CloudHostStatus::Healthy,
            capabilities: CloudHostCapabilities::default(),
            registered_at: "2026-01-01T00:00:00Z".to_string(),
            last_heartbeat_at: None,
        }
    }

    fn tmp_registry() -> (tempfile::TempDir, CloudHostRegistry) {
        let dir = tempfile::tempdir().expect("tempdir");
        let reg = CloudHostRegistry::new(dir.path());
        (dir, reg)
    }

    #[test]
    fn register_and_get() {
        let (_dir, reg) = tmp_registry();
        let host = sample_host("ws_1", "host_a");
        reg.register(&host).unwrap();
        let loaded = reg.get("ws_1", "host_a").unwrap();
        assert_eq!(loaded.label, "Test Host");
    }

    #[test]
    fn list_hosts() {
        let (_dir, reg) = tmp_registry();
        reg.register(&sample_host("ws_2", "h1")).unwrap();
        reg.register(&sample_host("ws_2", "h2")).unwrap();
        let list = reg.list("ws_2").unwrap();
        assert_eq!(list.len(), 2);
    }

    #[test]
    fn revoke_sets_status() {
        let (_dir, reg) = tmp_registry();
        reg.register(&sample_host("ws_3", "h_rev")).unwrap();
        reg.revoke("ws_3", "h_rev").unwrap();
        let loaded = reg.get("ws_3", "h_rev").unwrap();
        assert_eq!(loaded.status, CloudHostStatus::Revoked);
    }

    #[test]
    fn find_browser_hosts_filters() {
        let (_dir, reg) = tmp_registry();
        let mut h1 = sample_host("ws_4", "h_browser");
        h1.capabilities.browser_operator = true;
        let h2 = sample_host("ws_4", "h_no_browser");
        reg.register(&h1).unwrap();
        reg.register(&h2).unwrap();
        let browser = reg.find_browser_hosts("ws_4").unwrap();
        assert_eq!(browser.len(), 1);
        assert_eq!(browser[0].id, "h_browser");
    }
}
