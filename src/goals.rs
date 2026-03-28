//! Goal contract domain.
//!
//! This module adapts the external "goal-driven" control philosophy into a
//! first-class maoclaw runtime primitive without rewriting the existing agent
//! loop. The goal contract is intentionally additive:
//!
//! - persisted in session metadata for durability
//! - injected into the active system prompt for execution discipline
//! - structured with explicit criteria and watchdog metadata
//! - refreshed by runtime heartbeats on successful turns
//! - enforced at runtime boundaries when inactivity exceeds policy

use crate::cli::Cli;
use crate::session::{Session, SessionEntry};
use anyhow::{Result, bail};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fmt::Write as _;
use std::path::{Path, PathBuf};

pub const GOAL_CONTRACT_ENTRY_TYPE: &str = "pi.goal.contract.v1";
pub const GOAL_CONTRACT_CLEARED_ENTRY_TYPE: &str = "pi.goal.contract.cleared.v1";
pub const GOAL_RUN_ENTRY_TYPE: &str = "pi.goal.run.v1";
pub const GOAL_RUN_CLEARED_ENTRY_TYPE: &str = "pi.goal.run.cleared.v1";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum GoalWatchdogDecision {
    Healthy,
    RestartEligible { overdue_seconds: u64 },
    BlockRequired { overdue_seconds: u64 },
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(default)]
pub struct SuccessCriterion {
    pub id: String,
    pub description: String,
    pub verification_hint: Option<String>,
    pub required: bool,
}

impl Default for SuccessCriterion {
    fn default() -> Self {
        Self {
            id: "criterion_1".to_string(),
            description: String::new(),
            verification_hint: None,
            required: true,
        }
    }
}

impl SuccessCriterion {
    fn new(index: usize, description: impl Into<String>) -> Self {
        Self {
            id: format!("criterion_{}", index + 1),
            description: description.into(),
            verification_hint: None,
            required: true,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(default)]
pub struct GoalWatchdog {
    pub heartbeat_seconds: u64,
    pub inactivity_timeout_seconds: u64,
    pub max_restarts: u32,
    pub restart_on_inactive: bool,
}

impl Default for GoalWatchdog {
    fn default() -> Self {
        Self {
            heartbeat_seconds: 300,
            inactivity_timeout_seconds: 900,
            max_restarts: 12,
            restart_on_inactive: true,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum GoalRunStatus {
    Active,
    CriteriaMet,
    Blocked,
    Failed,
    Paused,
}

impl GoalRunStatus {
    #[must_use]
    pub const fn keeps_contract_active(self) -> bool {
        matches!(self, Self::Active)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum GoalLifecycleAction {
    Pause,
    Resume,
    Complete,
    Block,
    Fail,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(default)]
pub struct CriterionState {
    pub criterion_id: String,
    pub satisfied: bool,
    pub evidence: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(default)]
pub struct GoalRunState {
    pub goal_id: String,
    pub session_id: Option<String>,
    pub status: GoalRunStatus,
    pub restart_count: u32,
    pub last_progress_at: String,
    pub criteria: Vec<CriterionState>,
}

impl Default for GoalRunState {
    fn default() -> Self {
        Self {
            goal_id: String::new(),
            session_id: None,
            status: GoalRunStatus::Active,
            restart_count: 0,
            last_progress_at: now_rfc3339(),
            criteria: Vec::new(),
        }
    }
}

impl GoalRunState {
    pub fn new(goal: &GoalSpec, session_id: Option<String>) -> Self {
        Self {
            goal_id: goal.id.clone(),
            session_id,
            status: GoalRunStatus::Active,
            restart_count: 0,
            last_progress_at: now_rfc3339(),
            criteria: goal
                .criteria
                .iter()
                .map(|criterion| CriterionState {
                    criterion_id: criterion.id.clone(),
                    satisfied: false,
                    evidence: None,
                })
                .collect(),
        }
    }

    pub fn for_goal(goal: &GoalSpec, session_id: Option<String>, previous: Option<&Self>) -> Self {
        let mut next = Self::new(goal, session_id);
        let Some(previous) = previous.filter(|previous| previous.goal_id == goal.id) else {
            return next;
        };

        next.status = previous.status;
        next.restart_count = previous.restart_count;
        next.last_progress_at.clone_from(&previous.last_progress_at);

        let previous_criteria = previous
            .criteria
            .iter()
            .cloned()
            .map(|criterion| (criterion.criterion_id.clone(), criterion))
            .collect::<HashMap<_, _>>();

        next.criteria = goal
            .criteria
            .iter()
            .map(|criterion| {
                previous_criteria
                    .get(&criterion.id)
                    .cloned()
                    .unwrap_or_else(|| CriterionState {
                        criterion_id: criterion.id.clone(),
                        satisfied: false,
                        evidence: None,
                    })
            })
            .collect();
        next
    }

    pub fn apply_lifecycle_action(
        &mut self,
        goal: &GoalSpec,
        action: GoalLifecycleAction,
        evidence: Option<String>,
    ) {
        self.goal_id.clone_from(&goal.id);
        self.last_progress_at = now_rfc3339();
        self.criteria = Self::for_goal(goal, self.session_id.clone(), Some(self)).criteria;

        match action {
            GoalLifecycleAction::Pause => {
                self.status = GoalRunStatus::Paused;
            }
            GoalLifecycleAction::Resume => {
                self.status = GoalRunStatus::Active;
            }
            GoalLifecycleAction::Complete => {
                self.status = GoalRunStatus::CriteriaMet;
                let evidence = evidence
                    .filter(|value| !value.trim().is_empty())
                    .unwrap_or_else(|| "Marked complete via control-plane action".to_string());
                for criterion in &mut self.criteria {
                    criterion.satisfied = true;
                    if criterion.evidence.is_none() {
                        criterion.evidence = Some(evidence.clone());
                    }
                }
            }
            GoalLifecycleAction::Block => {
                self.status = GoalRunStatus::Blocked;
            }
            GoalLifecycleAction::Fail => {
                self.status = GoalRunStatus::Failed;
            }
        }
    }

    pub fn apply_criterion_update(
        &mut self,
        goal: &GoalSpec,
        criterion_id: &str,
        satisfied: bool,
        evidence: Option<String>,
    ) -> Result<()> {
        self.goal_id.clone_from(&goal.id);
        self.last_progress_at = now_rfc3339();
        self.criteria = Self::for_goal(goal, self.session_id.clone(), Some(self)).criteria;

        let criterion = self
            .criteria
            .iter_mut()
            .find(|criterion| criterion.criterion_id == criterion_id)
            .ok_or_else(|| anyhow::anyhow!("unknown criterion id: {criterion_id}"))?;

        criterion.satisfied = satisfied;
        criterion.evidence = evidence;

        let all_required_satisfied = required_criteria_satisfied(goal, &self.criteria);
        self.status = if all_required_satisfied {
            GoalRunStatus::CriteriaMet
        } else if matches!(self.status, GoalRunStatus::CriteriaMet) {
            GoalRunStatus::Active
        } else {
            self.status
        };

        Ok(())
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(default)]
pub struct GoalSpec {
    pub id: String,
    pub title: String,
    pub goal: String,
    pub criteria: Vec<SuccessCriterion>,
    pub system_id: Option<String>,
    pub artifact_type: Option<String>,
    pub watchdog: GoalWatchdog,
    pub created_at: String,
    pub updated_at: String,
}

impl Default for GoalSpec {
    fn default() -> Self {
        let now = now_rfc3339();
        Self {
            id: gen_goal_id(),
            title: "Outcome Contract".to_string(),
            goal: String::new(),
            criteria: Vec::new(),
            system_id: None,
            artifact_type: None,
            watchdog: GoalWatchdog::default(),
            created_at: now.clone(),
            updated_at: now,
        }
    }
}

impl GoalSpec {
    pub fn from_cli(cli: &Cli, cwd: &Path) -> Result<Option<Self>> {
        if !cli.has_goal_contract() {
            return Ok(None);
        }

        let goal_text = cli
            .goal
            .clone()
            .map(Ok)
            .or_else(|| {
                cli.goal_file
                    .as_deref()
                    .map(|path| read_text_input(path, cwd, "goal file"))
            })
            .transpose()?
            .map(|text| text.trim().to_string())
            .filter(|text| !text.is_empty());

        let Some(goal) = goal_text else {
            bail!("goal contract requires --goal or --goal-file");
        };

        let mut raw_criteria = cli
            .criterion
            .iter()
            .map(|value| value.trim().to_string())
            .filter(|value| !value.is_empty())
            .collect::<Vec<_>>();
        for path in &cli.criteria_file {
            let contents = read_text_input(path, cwd, "criteria file")?;
            raw_criteria.extend(parse_criteria_document(&contents));
        }

        if raw_criteria.is_empty() {
            bail!("goal contract requires at least one --criterion or --criteria-file");
        }

        let criteria = raw_criteria
            .into_iter()
            .enumerate()
            .map(|(index, description)| SuccessCriterion::new(index, description))
            .collect::<Vec<_>>();

        let title = cli
            .goal_title
            .clone()
            .filter(|value| !value.trim().is_empty())
            .unwrap_or_else(|| summarize_goal_title(&goal));

        let mut spec = Self {
            title,
            goal,
            criteria,
            system_id: cli.goal_system.clone(),
            artifact_type: cli.goal_artifact_type.clone(),
            ..Self::default()
        };
        if let Some(value) = cli.goal_heartbeat_seconds {
            spec.watchdog.heartbeat_seconds = value;
        }
        if let Some(value) = cli.goal_inactivity_seconds {
            spec.watchdog.inactivity_timeout_seconds = value;
        }
        if let Some(value) = cli.goal_max_restarts {
            spec.watchdog.max_restarts = value;
        }
        Ok(Some(spec))
    }

    pub fn render_prompt_block(&self) -> String {
        let mut out = String::new();
        out.push_str("# Goal Contract\n\n");
        out.push_str("This run is operating under an explicit outcome contract.\n\n");
        out.push_str("## Primary Goal\n\n");
        out.push_str(&self.goal);
        out.push_str("\n\n## Success Criteria\n\n");
        for (index, criterion) in self.criteria.iter().enumerate() {
            let _ = write!(out, "{}. {}", index + 1, criterion.description);
            if let Some(hint) = criterion.verification_hint.as_deref() {
                let _ = write!(out, " (verification hint: {hint})");
            }
            out.push('\n');
        }
        out.push_str("\n## Execution Rules\n\n");
        out.push_str("- Do not declare the task complete until every required criterion is satisfied with evidence.\n");
        out.push_str("- If the current path is blocked, explain the blocker precisely and continue with the next highest-value step.\n");
        out.push_str("- Prefer durable outputs, explicit verification, and objective status over vague progress claims.\n");
        out.push_str("- Treat inactivity as a failure mode. If momentum stalls, resume from the last concrete unfinished step.\n");
        out.push_str("\n## Watchdog Contract\n\n");
        let _ = writeln!(
            out,
            "- heartbeat target: every {} seconds",
            self.watchdog.heartbeat_seconds
        );
        let _ = writeln!(
            out,
            "- inactivity timeout: {} seconds",
            self.watchdog.inactivity_timeout_seconds
        );
        let _ = writeln!(
            out,
            "- maximum restart attempts: {}",
            self.watchdog.max_restarts
        );
        if let Some(system_id) = self.system_id.as_deref() {
            let _ = writeln!(out, "- bound system: {system_id}");
        }
        if let Some(artifact_type) = self.artifact_type.as_deref() {
            let _ = writeln!(out, "- expected artifact type: {artifact_type}");
        }
        out
    }
}

pub fn resolve_active_goal(cli: &Cli, session: &Session, cwd: &Path) -> Result<Option<GoalSpec>> {
    if cli.has_goal_contract() {
        return GoalSpec::from_cli(cli, cwd);
    }
    Ok(latest_goal_contract(session))
}

pub fn latest_goal_contract(session: &Session) -> Option<GoalSpec> {
    for entry in session.entries.iter().rev() {
        match entry {
            SessionEntry::Custom(custom)
                if custom.custom_type == GOAL_CONTRACT_CLEARED_ENTRY_TYPE =>
            {
                return None;
            }
            SessionEntry::Custom(custom) if custom.custom_type == GOAL_CONTRACT_ENTRY_TYPE => {
                return custom
                    .data
                    .as_ref()
                    .and_then(|value| serde_json::from_value::<GoalSpec>(value.clone()).ok());
            }
            _ => {}
        }
    }
    None
}

pub fn latest_goal_run_state(session: &Session) -> Option<GoalRunState> {
    for entry in session.entries.iter().rev() {
        match entry {
            SessionEntry::Custom(custom) if custom.custom_type == GOAL_RUN_CLEARED_ENTRY_TYPE => {
                return None;
            }
            SessionEntry::Custom(custom) if custom.custom_type == GOAL_RUN_ENTRY_TYPE => {
                return custom
                    .data
                    .as_ref()
                    .and_then(|value| serde_json::from_value::<GoalRunState>(value.clone()).ok());
            }
            _ => {}
        }
    }
    None
}

pub fn persist_goal_contract(session: &mut Session, goal: &GoalSpec) -> bool {
    if latest_goal_contract(session).as_ref() == Some(goal) {
        return false;
    }
    let data = serde_json::to_value(goal).ok();
    session.append_custom_entry(GOAL_CONTRACT_ENTRY_TYPE.to_string(), data);
    true
}

pub fn persist_goal_run_state(session: &mut Session, goal: &GoalSpec) -> bool {
    let previous = latest_goal_run_state(session);
    let state = GoalRunState::for_goal(goal, Some(session.header.id.clone()), previous.as_ref());
    persist_goal_run_snapshot(session, &state)
}

pub fn persist_goal_run_snapshot(session: &mut Session, goal_run: &GoalRunState) -> bool {
    if latest_goal_run_state(session).as_ref() == Some(goal_run) {
        return false;
    }
    let data = serde_json::to_value(goal_run).ok();
    session.append_custom_entry(GOAL_RUN_ENTRY_TYPE.to_string(), data);
    true
}

pub fn clear_goal_tracking(session: &mut Session) -> bool {
    let had_contract = latest_goal_contract(session).is_some();
    let had_run = latest_goal_run_state(session).is_some();
    if !had_contract && !had_run {
        return false;
    }
    session.append_custom_entry(GOAL_CONTRACT_CLEARED_ENTRY_TYPE.to_string(), None);
    session.append_custom_entry(GOAL_RUN_CLEARED_ENTRY_TYPE.to_string(), None);
    true
}

pub fn update_goal_run_state(
    session: &mut Session,
    action: GoalLifecycleAction,
    evidence: Option<String>,
) -> Result<GoalRunState> {
    let goal = latest_goal_contract(session)
        .ok_or_else(|| anyhow::anyhow!("no active goal contract is available"))?;
    let mut goal_run = GoalRunState::for_goal(
        &goal,
        Some(session.header.id.clone()),
        latest_goal_run_state(session).as_ref(),
    );
    goal_run.apply_lifecycle_action(&goal, action, evidence);
    let _ = persist_goal_run_snapshot(session, &goal_run);
    Ok(goal_run)
}

pub fn update_goal_criterion_state(
    session: &mut Session,
    criterion_id: &str,
    satisfied: bool,
    evidence: Option<String>,
) -> Result<GoalRunState> {
    let goal = latest_goal_contract(session)
        .ok_or_else(|| anyhow::anyhow!("no active goal contract is available"))?;
    let mut goal_run = GoalRunState::for_goal(
        &goal,
        Some(session.header.id.clone()),
        latest_goal_run_state(session).as_ref(),
    );
    goal_run.apply_criterion_update(&goal, criterion_id, satisfied, evidence)?;
    let _ = persist_goal_run_snapshot(session, &goal_run);
    Ok(goal_run)
}

pub fn goal_watchdog_decision(session: &Session) -> Option<GoalWatchdogDecision> {
    let goal = latest_goal_contract(session)?;
    let goal_run = latest_goal_run_state(session)?;

    if !goal_run.status.keeps_contract_active() {
        return Some(GoalWatchdogDecision::Healthy);
    }

    let inactivity_timeout_seconds = goal.watchdog.inactivity_timeout_seconds;
    if inactivity_timeout_seconds == 0 {
        return Some(GoalWatchdogDecision::Healthy);
    }

    let last_progress_at = chrono::DateTime::parse_from_rfc3339(&goal_run.last_progress_at).ok()?;
    let elapsed =
        chrono::Utc::now().signed_duration_since(last_progress_at.with_timezone(&chrono::Utc));
    if elapsed < chrono::Duration::zero() {
        return Some(GoalWatchdogDecision::Healthy);
    }

    #[allow(clippy::cast_sign_loss)]
    let overdue_seconds = elapsed.num_seconds() as u64;
    if overdue_seconds < inactivity_timeout_seconds {
        return Some(GoalWatchdogDecision::Healthy);
    }

    if goal.watchdog.restart_on_inactive && goal_run.restart_count < goal.watchdog.max_restarts {
        Some(GoalWatchdogDecision::RestartEligible { overdue_seconds })
    } else {
        Some(GoalWatchdogDecision::BlockRequired { overdue_seconds })
    }
}

pub fn restart_goal_run_after_watchdog(session: &mut Session) -> Result<Option<GoalRunState>> {
    let decision = goal_watchdog_decision(session);

    if !matches!(decision, Some(GoalWatchdogDecision::RestartEligible { .. })) {
        return Ok(None);
    }

    let Some(goal) = latest_goal_contract(session) else {
        return Ok(None);
    };

    let mut goal_run = GoalRunState::for_goal(
        &goal,
        Some(session.header.id.clone()),
        latest_goal_run_state(session).as_ref(),
    );
    goal_run.status = GoalRunStatus::Active;
    goal_run.restart_count = goal_run.restart_count.saturating_add(1);
    goal_run.last_progress_at = now_rfc3339();
    let _ = persist_goal_run_snapshot(session, &goal_run);
    Ok(Some(goal_run))
}

pub fn block_goal_run_due_to_watchdog(session: &mut Session) -> Result<Option<GoalRunState>> {
    let decision = goal_watchdog_decision(session);

    if !matches!(decision, Some(GoalWatchdogDecision::BlockRequired { .. })) {
        return Ok(None);
    }

    let Some(goal) = latest_goal_contract(session) else {
        return Ok(None);
    };

    let mut goal_run = GoalRunState::for_goal(
        &goal,
        Some(session.header.id.clone()),
        latest_goal_run_state(session).as_ref(),
    );
    goal_run.status = GoalRunStatus::Blocked;
    let _ = persist_goal_run_snapshot(session, &goal_run);
    Ok(Some(goal_run))
}

pub fn touch_goal_run_progress(session: &mut Session) -> Result<Option<GoalRunState>> {
    let Some(goal) = latest_goal_contract(session) else {
        return Ok(None);
    };
    let mut goal_run = GoalRunState::for_goal(
        &goal,
        Some(session.header.id.clone()),
        latest_goal_run_state(session).as_ref(),
    );

    if !goal_run.status.keeps_contract_active() {
        return Ok(None);
    }

    goal_run.last_progress_at = now_rfc3339();
    let _ = persist_goal_run_snapshot(session, &goal_run);
    Ok(Some(goal_run))
}

fn required_criteria_satisfied(goal: &GoalSpec, criteria: &[CriterionState]) -> bool {
    let by_id = criteria
        .iter()
        .map(|criterion| (criterion.criterion_id.as_str(), criterion.satisfied))
        .collect::<HashMap<_, _>>();

    goal.criteria
        .iter()
        .filter(|criterion| criterion.required)
        .all(|criterion| by_id.get(criterion.id.as_str()).copied().unwrap_or(false))
}

fn summarize_goal_title(goal: &str) -> String {
    let trimmed = goal.trim();
    let mut title = trimmed.lines().next().unwrap_or(trimmed).trim().to_string();
    if title.chars().count() > 72 {
        title = title.chars().take(72).collect::<String>();
        title.push_str("...");
    }
    if title.is_empty() {
        "Outcome Contract".to_string()
    } else {
        title
    }
}

fn parse_criteria_document(input: &str) -> Vec<String> {
    let mut items = Vec::new();
    let mut paragraph = Vec::new();

    for raw_line in input.lines() {
        let line = raw_line.trim();
        if line.is_empty() {
            if !paragraph.is_empty() {
                items.push(paragraph.join(" "));
                paragraph.clear();
            }
            continue;
        }

        if let Some(bullet) = strip_bullet_prefix(line) {
            if !paragraph.is_empty() {
                items.push(paragraph.join(" "));
                paragraph.clear();
            }
            items.push(bullet.to_string());
            continue;
        }

        paragraph.push(line.to_string());
    }

    if !paragraph.is_empty() {
        items.push(paragraph.join(" "));
    }

    items
        .into_iter()
        .map(|item| item.trim().to_string())
        .filter(|item| !item.is_empty())
        .collect()
}

fn strip_bullet_prefix(line: &str) -> Option<&str> {
    if let Some(stripped) = line.strip_prefix("- ").or_else(|| line.strip_prefix("* ")) {
        return Some(stripped.trim());
    }

    let digit_prefix_len = line.chars().take_while(char::is_ascii_digit).count();
    if digit_prefix_len == 0 || line.len() <= digit_prefix_len + 2 {
        return None;
    }
    let remainder = &line[digit_prefix_len..];
    let stripped = remainder
        .strip_prefix(". ")
        .or_else(|| remainder.strip_prefix(") "))?;
    Some(stripped.trim())
}

fn read_text_input(path_or_text: &str, cwd: &Path, description: &str) -> Result<String> {
    let path = resolve_input_path(path_or_text, cwd);
    std::fs::read_to_string(&path)
        .map_err(|err| anyhow::anyhow!("failed to read {description} {}: {err}", path.display()))
}

fn resolve_input_path(path: &str, cwd: &Path) -> PathBuf {
    let candidate = Path::new(path);
    if candidate.is_absolute() {
        candidate.to_path_buf()
    } else {
        cwd.join(candidate)
    }
}

fn gen_goal_id() -> String {
    use std::sync::atomic::{AtomicU64, Ordering};
    use std::time::{SystemTime, UNIX_EPOCH};

    static SEQ: AtomicU64 = AtomicU64::new(0);
    #[allow(clippy::cast_possible_truncation)]
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos() as u64;
    let seq = SEQ.fetch_add(1, Ordering::Relaxed);
    format!("goal_{nanos:x}_{seq:x}")
}

fn now_rfc3339() -> String {
    chrono::Utc::now().to_rfc3339()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::Config;
    use asupersync::runtime::RuntimeBuilder;
    use clap::Parser;

    #[test]
    fn parse_criteria_document_supports_bullets_and_paragraphs() {
        let criteria = parse_criteria_document(
            "\
- first criterion
- second criterion

third criterion
continues here
",
        );
        assert_eq!(
            criteria,
            vec![
                "first criterion".to_string(),
                "second criterion".to_string(),
                "third criterion continues here".to_string()
            ]
        );
    }

    #[test]
    fn goal_contract_persists_and_round_trips_through_session_custom_entries() {
        let runtime = RuntimeBuilder::current_thread().build().expect("runtime");

        runtime.block_on(async {
            let cli = Cli::parse_from([
                "pi",
                "--goal",
                "Ship the project",
                "--criterion",
                "all tests pass",
                "--criterion",
                "release notes exist",
            ]);
            let config = Config::default();
            let mut session = Session::new(&cli, &config).await.expect("session");
            let goal = GoalSpec::from_cli(&cli, Path::new("."))
                .expect("goal parse")
                .expect("goal present");

            assert!(persist_goal_contract(&mut session, &goal));
            assert!(persist_goal_run_state(&mut session, &goal));
            assert_eq!(latest_goal_contract(&session), Some(goal.clone()));
            assert_eq!(
                latest_goal_run_state(&session).expect("goal run").goal_id,
                goal.id
            );
        });
    }

    #[test]
    fn render_prompt_block_mentions_goal_and_watchdog() {
        let goal = GoalSpec {
            goal: "Build a verified release".to_string(),
            criteria: vec![SuccessCriterion::new(0, "All release checks pass")],
            ..GoalSpec::default()
        };
        let prompt = goal.render_prompt_block();
        assert!(prompt.contains("Build a verified release"));
        assert!(prompt.contains("All release checks pass"));
        assert!(prompt.contains("inactivity timeout"));
    }

    #[test]
    fn clear_goal_tracking_hides_previous_goal_entries() {
        let mut session = Session::in_memory();
        let goal = GoalSpec {
            goal: "Ship the project".to_string(),
            criteria: vec![SuccessCriterion::new(0, "All checks pass")],
            ..GoalSpec::default()
        };

        assert!(persist_goal_contract(&mut session, &goal));
        assert!(persist_goal_run_state(&mut session, &goal));
        assert!(latest_goal_contract(&session).is_some());
        assert!(latest_goal_run_state(&session).is_some());

        assert!(clear_goal_tracking(&mut session));
        assert!(latest_goal_contract(&session).is_none());
        assert!(latest_goal_run_state(&session).is_none());
    }

    #[test]
    fn update_goal_run_state_marks_completion_and_evidence() {
        let mut session = Session::in_memory();
        let goal = GoalSpec {
            goal: "Ship the project".to_string(),
            criteria: vec![
                SuccessCriterion::new(0, "All checks pass"),
                SuccessCriterion::new(1, "Release notes exist"),
            ],
            ..GoalSpec::default()
        };

        assert!(persist_goal_contract(&mut session, &goal));
        assert!(persist_goal_run_state(&mut session, &goal));

        let completed = update_goal_run_state(
            &mut session,
            GoalLifecycleAction::Complete,
            Some("Verified in release dashboard".to_string()),
        )
        .expect("complete goal run");
        assert_eq!(completed.status, GoalRunStatus::CriteriaMet);
        assert!(
            completed
                .criteria
                .iter()
                .all(|criterion| criterion.satisfied)
        );
        assert_eq!(
            completed.criteria[0].evidence.as_deref(),
            Some("Verified in release dashboard")
        );
    }

    #[test]
    fn update_goal_criterion_state_tracks_individual_progress() {
        let mut session = Session::in_memory();
        let goal = GoalSpec {
            goal: "Ship the project".to_string(),
            criteria: vec![
                SuccessCriterion::new(0, "All checks pass"),
                SuccessCriterion::new(1, "Release notes exist"),
            ],
            ..GoalSpec::default()
        };

        assert!(persist_goal_contract(&mut session, &goal));
        assert!(persist_goal_run_state(&mut session, &goal));

        let first = update_goal_criterion_state(
            &mut session,
            "criterion_1",
            true,
            Some("CI is green".to_string()),
        )
        .expect("update first criterion");
        assert_eq!(first.status, GoalRunStatus::Active);
        assert_eq!(first.criteria[0].evidence.as_deref(), Some("CI is green"));
        assert!(!first.criteria[1].satisfied);

        let second = update_goal_criterion_state(
            &mut session,
            "criterion_2",
            true,
            Some("Release notes committed".to_string()),
        )
        .expect("update second criterion");
        assert_eq!(second.status, GoalRunStatus::CriteriaMet);
        assert!(second.criteria.iter().all(|criterion| criterion.satisfied));
    }

    #[test]
    fn goal_watchdog_blocks_when_restart_is_disabled() {
        let mut session = Session::in_memory();
        let goal = GoalSpec {
            goal: "Ship the project".to_string(),
            criteria: vec![SuccessCriterion::new(0, "All checks pass")],
            watchdog: GoalWatchdog {
                inactivity_timeout_seconds: 30,
                restart_on_inactive: false,
                ..GoalWatchdog::default()
            },
            ..GoalSpec::default()
        };
        let goal_run = GoalRunState {
            last_progress_at: (chrono::Utc::now() - chrono::Duration::seconds(120)).to_rfc3339(),
            ..GoalRunState::new(&goal, Some("session_1".to_string()))
        };

        assert!(persist_goal_contract(&mut session, &goal));
        assert!(persist_goal_run_snapshot(&mut session, &goal_run));

        assert_eq!(
            goal_watchdog_decision(&session),
            Some(GoalWatchdogDecision::BlockRequired {
                overdue_seconds: 120
            })
        );

        let blocked = block_goal_run_due_to_watchdog(&mut session)
            .expect("block overdue goal")
            .expect("blocked goal run");
        assert_eq!(blocked.status, GoalRunStatus::Blocked);
        assert_eq!(
            latest_goal_run_state(&session).expect("goal run").status,
            GoalRunStatus::Blocked
        );
    }

    #[test]
    fn goal_watchdog_restart_increments_restart_count() {
        let mut session = Session::in_memory();
        let goal = GoalSpec {
            goal: "Ship the project".to_string(),
            criteria: vec![SuccessCriterion::new(0, "All checks pass")],
            watchdog: GoalWatchdog {
                inactivity_timeout_seconds: 30,
                restart_on_inactive: true,
                max_restarts: 2,
                ..GoalWatchdog::default()
            },
            ..GoalSpec::default()
        };
        let goal_run = GoalRunState {
            last_progress_at: (chrono::Utc::now() - chrono::Duration::seconds(120)).to_rfc3339(),
            ..GoalRunState::new(&goal, Some("session_1".to_string()))
        };

        assert!(persist_goal_contract(&mut session, &goal));
        assert!(persist_goal_run_snapshot(&mut session, &goal_run));

        assert_eq!(
            goal_watchdog_decision(&session),
            Some(GoalWatchdogDecision::RestartEligible {
                overdue_seconds: 120
            })
        );

        let restarted = restart_goal_run_after_watchdog(&mut session)
            .expect("restart overdue goal")
            .expect("restarted goal run");
        assert_eq!(restarted.status, GoalRunStatus::Active);
        assert_eq!(restarted.restart_count, 1);
        assert_ne!(restarted.last_progress_at, goal_run.last_progress_at);
    }

    #[test]
    fn touch_goal_run_progress_refreshes_active_goal_heartbeat() {
        let mut session = Session::in_memory();
        let goal = GoalSpec {
            goal: "Ship the project".to_string(),
            criteria: vec![SuccessCriterion::new(0, "All checks pass")],
            ..GoalSpec::default()
        };
        let goal_run = GoalRunState {
            last_progress_at: (chrono::Utc::now() - chrono::Duration::seconds(120)).to_rfc3339(),
            ..GoalRunState::new(&goal, Some("session_1".to_string()))
        };

        assert!(persist_goal_contract(&mut session, &goal));
        assert!(persist_goal_run_snapshot(&mut session, &goal_run));

        let touched = touch_goal_run_progress(&mut session)
            .expect("touch goal progress")
            .expect("touched goal run");
        assert_eq!(touched.status, GoalRunStatus::Active);
        assert_ne!(touched.last_progress_at, goal_run.last_progress_at);
    }
}
