//! Interactive TUI mode using charmed_rust (bubbletea/lipgloss/bubbles/glamour).
//!
//! This module provides the full interactive terminal interface for Pi,
//! implementing the Elm Architecture for state management.
//!
//! ## Features
//!
//! - **Multi-line editor**: Full text area with line wrapping and history
//! - **Viewport scrolling**: Scrollable conversation history with keyboard navigation
//! - **Slash commands**: Built-in commands like /help, /clear, /model, /exit
//! - **Token tracking**: Real-time cost and token usage display
//! - **Markdown rendering**: Assistant responses rendered with syntax highlighting

use asupersync::Cx;
use asupersync::channel::mpsc;
use asupersync::runtime::RuntimeHandle;
use asupersync::sync::Mutex;
use async_trait::async_trait;
use bubbles::spinner::{SpinnerModel, TickMsg as SpinnerTickMsg, spinners};
use bubbles::textarea::TextArea;
use bubbles::viewport::Viewport;
use bubbletea::{
    Cmd, KeyMsg, KeyType, Message, Model as BubbleteaModel, MouseButton, MouseMsg, Program,
    WindowSizeMsg, batch, quit, sequence,
};
use chrono::Utc;
use crossterm::{cursor, terminal};
use futures::future::BoxFuture;
use glamour::StyleConfig as GlamourStyleConfig;
use glob::Pattern;
use serde_json::{Value, json};
use url::Url;

use std::collections::{HashMap, VecDeque};
use std::fmt::Write as _;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::sync::Mutex as StdMutex;
use std::sync::atomic::{AtomicBool, Ordering};

use crate::agent::{AbortHandle, Agent, AgentEvent, QueueMode};
use crate::autocomplete::{AutocompleteCatalog, AutocompleteItem, AutocompleteItemKind};
use crate::config::{Config, ExtensionPolicyConfig, SettingsScope, parse_queue_mode_or_default};
use crate::extension_events::{InputEventOutcome, apply_input_event_response};
use crate::extensions::{
    EXTENSION_EVENT_TIMEOUT_MS, ExtensionDeliverAs, ExtensionEventName, ExtensionHostActions,
    ExtensionManager, ExtensionSendMessage, ExtensionSendUserMessage, ExtensionSession,
    ExtensionUiRequest, ExtensionUiResponse,
};
use crate::keybindings::{AppAction, KeyBinding, KeyBindings};
use crate::model::{
    AssistantMessageEvent, ContentBlock, CustomMessage, ImageContent, Message as ModelMessage,
    StopReason, TextContent, ThinkingLevel, Usage, UserContent, UserMessage,
};
use crate::models::{ModelEntry, ModelRegistry, default_models_path};
use crate::package_manager::PackageManager;
use crate::providers;
use crate::resources::{DiagnosticKind, ResourceCliOptions, ResourceDiagnostic, ResourceLoader};
use crate::session::{Session, SessionEntry, SessionMessage, bash_execution_to_text};
use crate::theme::{Theme, TuiStyles};
use crate::tools::{process_file_arguments, resolve_read_path};

#[cfg(all(feature = "clipboard", feature = "image-resize"))]
use arboard::Clipboard as ArboardClipboard;

mod agent;
mod commands;
mod conversation;
mod ext_session;
mod file_refs;
mod keybindings;
mod model_selector_ui;
mod perf;
mod share;
mod state;
mod text_utils;
mod tool_render;
mod tree;
mod tree_ui;
mod view;

use self::agent::{build_user_message, extension_commands_for_catalog};
pub use self::commands::{
    SlashCommand, model_entry_matches, parse_scoped_model_patterns, resolve_scoped_model_entries,
    strip_thinking_level_suffix,
};
#[cfg(test)]
use self::commands::{
    api_key_login_prompt, format_login_provider_listing, format_resource_diagnostics, kind_rank,
};
use self::commands::{
    format_startup_oauth_hint, normalize_api_key_input, normalize_auth_provider_input,
    parse_bash_command, parse_extension_command, remove_provider_credentials,
    save_provider_credential, should_show_startup_oauth_hint,
};
use self::conversation::conversation_from_session;
#[cfg(test)]
use self::conversation::{
    assistant_content_to_text, build_content_blocks_for_input, content_blocks_to_text,
    split_content_blocks_for_input, tool_content_blocks_to_text, user_content_to_text,
};
use self::ext_session::{InteractiveExtensionHostActions, InteractiveExtensionSession};
pub use self::ext_session::{format_extension_ui_prompt, parse_extension_ui_response};
use self::file_refs::{
    file_url_to_path, format_file_ref, is_file_ref_boundary, next_non_whitespace_token,
    parse_quoted_file_ref, path_for_display, split_trailing_punct, strip_wrapping_quotes,
    unescape_dragged_path,
};
use self::perf::{
    CRITICAL_KEEP_MESSAGES, FrameTimingStats, MemoryLevel, MemoryMonitor, MessageRenderCache,
    RenderBuffers, micros_as_u64,
};
#[cfg(test)]
use self::state::TOOL_AUTO_COLLAPSE_THRESHOLD;
pub use self::state::{AgentState, InputMode, PendingInput};
use self::state::{
    AutocompleteState, BranchPickerOverlay, CapabilityAction, CapabilityPromptOverlay,
    ExtensionCustomOverlay, HistoryList, InjectedMessageQueue, InteractiveMessageQueue,
    PendingLoginKind, PendingOAuth, ProviderSetupField, ProviderSetupOverlay, QueuedMessageKind,
    SessionPickerOverlay, SettingsUiEntry, SettingsUiState, TOOL_COLLAPSE_PREVIEW_LINES,
    ThemePickerItem, ThemePickerOverlay, ToolProgress, format_count,
};
pub use self::state::{ConversationMessage, MessageRole};
#[cfg(test)]
use self::text_utils::push_line;
use self::text_utils::{queued_message_preview, truncate};
use self::tool_render::{format_tool_output, render_tool_message};
#[cfg(test)]
use self::tool_render::{pretty_json, split_diff_prefix};
use self::tree::{
    PendingTreeNavigation, TreeCustomPromptState, TreeSelectorState, TreeSummaryChoice,
    TreeSummaryPromptState, TreeUiState, collect_tree_branch_entries,
    resolve_tree_selector_initial_id, view_tree_ui,
};

// ============================================================================
// Tmux wheel scroll guard
// ============================================================================

/// RAII guard that overrides tmux WheelUp/WheelDown bindings for the current
/// pane so that mouse wheel events are forwarded to the application instead of
/// triggering tmux copy-mode.  When dropped (including on panic), the original
/// bindings are restored.
///
/// The override is pane-scoped: other panes in the same tmux session are not
/// affected.  If `PI_TMUX_WHEEL_OVERRIDE=0` is set, no override is installed.
struct TmuxWheelGuard {
    /// Original WheelUp binding (None if there was no binding).
    saved_wheel_up: Option<String>,
    /// Original WheelDown binding (None if there was no binding).
    saved_wheel_down: Option<String>,
}

impl TmuxWheelGuard {
    /// Attempt to install pane-scoped tmux wheel overrides.
    ///
    /// Returns `None` if:
    /// - Not running inside tmux (`$TMUX` unset)
    /// - `PI_TMUX_WHEEL_OVERRIDE=0` env is set
    /// - `tmux` binary is not available or returns errors
    fn install() -> Option<Self> {
        // Respect opt-out env var.
        if std::env::var("PI_TMUX_WHEEL_OVERRIDE")
            .ok()
            .is_some_and(|v| v == "0")
        {
            return None;
        }

        // Check if we're in tmux.
        std::env::var_os("TMUX")?;

        // Get the current pane ID.
        let pane = std::process::Command::new("tmux")
            .args(["display-message", "-p", "#{pane_id}"])
            .output()
            .ok()
            .and_then(|o| {
                if o.status.success() {
                    String::from_utf8(o.stdout)
                        .ok()
                        .map(|s| s.trim().to_string())
                } else {
                    None
                }
            })?;

        if pane.is_empty() {
            return None;
        }

        // Save existing WheelUpPane/WheelDownPane bindings so we can restore them.
        let saved_wheel_up = Self::get_binding("WheelUpPane");
        let saved_wheel_down = Self::get_binding("WheelDownPane");

        // `bind-key -T root` is global, so make the binding conditional on the
        // current pane and delegate to the original command for all other panes.
        Self::install_binding_for_pane(&pane, "WheelUpPane", saved_wheel_up.as_deref());
        Self::install_binding_for_pane(&pane, "WheelDownPane", saved_wheel_down.as_deref());

        Some(Self {
            saved_wheel_up,
            saved_wheel_down,
        })
    }

    /// Query the current tmux binding for a key in the root table.
    fn get_binding(key: &str) -> Option<String> {
        let output = std::process::Command::new("tmux")
            .args(["list-keys", "-T", "root"])
            .output()
            .ok()?;
        if !output.status.success() {
            return None;
        }
        let stdout = String::from_utf8_lossy(&output.stdout);
        // Each line looks like: bind-key    -T root    WheelUpPane    if-shell -F ...
        for line in stdout.lines() {
            if Self::binding_key_and_command(line).is_some_and(|(bound_key, _)| bound_key == key) {
                return Some(line.trim().to_string());
            }
        }
        None
    }

    /// Extract the bound command payload from a `list-keys` line.
    fn binding_command(saved_line: &str, key_name: &str) -> Option<String> {
        let (bound_key, command) = Self::binding_key_and_command(saved_line)?;
        (bound_key == key_name && !command.is_empty()).then(|| command.to_string())
    }

    fn binding_key_and_command(saved_line: &str) -> Option<(&str, &str)> {
        let (_, bind_end) = Self::next_shell_token_bounds(saved_line, 0)?;
        if saved_line.get(..bind_end)? != "bind-key" {
            return None;
        }

        let mut cursor = bind_end;
        loop {
            let (token_start, token_end) = Self::next_shell_token_bounds(saved_line, cursor)?;
            let token = saved_line.get(token_start..token_end)?;
            cursor = token_end;

            match token {
                "-T" | "-N" => {
                    let (_, value_end) = Self::next_shell_token_bounds(saved_line, cursor)?;
                    cursor = value_end;
                }
                _ if token.starts_with('-') => {}
                _ => {
                    let command = saved_line.get(cursor..)?.trim_start();
                    return Some((token, command));
                }
            }
        }
    }

    fn next_shell_token_bounds(input: &str, from: usize) -> Option<(usize, usize)> {
        let bytes = input.as_bytes();
        let mut idx = from;
        while idx < bytes.len() && bytes[idx].is_ascii_whitespace() {
            idx += 1;
        }
        if idx >= bytes.len() {
            return None;
        }

        let start = idx;
        let mut in_single = false;
        let mut in_double = false;
        while idx < bytes.len() {
            let byte = bytes[idx];
            if in_single {
                if byte == b'\'' {
                    in_single = false;
                }
                idx += 1;
                continue;
            }
            if in_double {
                if byte == b'\\' && idx + 1 < bytes.len() {
                    idx += 2;
                    continue;
                }
                if byte == b'"' {
                    in_double = false;
                }
                idx += 1;
                continue;
            }

            match byte {
                b'\'' => {
                    in_single = true;
                    idx += 1;
                }
                b'"' => {
                    in_double = true;
                    idx += 1;
                }
                b'\\' if idx + 1 < bytes.len() => {
                    idx += 2;
                }
                _ if byte.is_ascii_whitespace() => break,
                _ => {
                    idx += 1;
                }
            }
        }

        Some((start, idx))
    }

    /// Install a tmux mouse-wheel override that only applies to `pane`.
    fn install_binding_for_pane(pane: &str, key_name: &str, saved_line: Option<&str>) {
        let fallback = saved_line
            .and_then(|line| Self::binding_command(line, key_name))
            .unwrap_or_default();
        let args = Self::pane_scoped_binding_args(pane, key_name, fallback);
        let _ = std::process::Command::new("tmux").args(&args).status();
    }

    fn pane_scoped_binding_args(pane: &str, key_name: &str, fallback: String) -> Vec<String> {
        let condition = format!("#{{==:#{{pane_id}},{pane}}}");
        vec![
            "bind-key".to_string(),
            "-T".to_string(),
            "root".to_string(),
            key_name.to_string(),
            "if-shell".to_string(),
            "-F".to_string(),
            condition,
            "send-keys -M".to_string(),
            fallback,
        ]
    }

    /// Restore the original binding for a wheel direction, or unbind if there
    /// was no previous binding.
    fn restore_binding(saved: Option<&str>, key_name: &str) {
        if let Some(line) = saved {
            // Restore the exact serialized bind-key command that tmux gave us.
            Self::run_tmux_command_line(line);
        } else {
            // No previous binding — unbind to revert to tmux default behavior.
            let _ = std::process::Command::new("tmux")
                .args(["unbind-key", "-T", "root", key_name])
                .status();
        }
    }

    fn run_tmux_command_line(command: &str) {
        use std::io::Write as _;

        let Ok(mut child) = std::process::Command::new("tmux")
            .args(["source-file", "-"])
            .stdin(std::process::Stdio::piped())
            .spawn()
        else {
            return;
        };

        if let Some(mut stdin) = child.stdin.take() {
            let _ = stdin.write_all(command.as_bytes());
            let _ = stdin.write_all(b"\n");
        }

        let _ = child.wait();
    }
}

impl Drop for TmuxWheelGuard {
    fn drop(&mut self) {
        Self::restore_binding(self.saved_wheel_up.as_deref(), "WheelUpPane");
        Self::restore_binding(self.saved_wheel_down.as_deref(), "WheelDownPane");
    }
}

// ============================================================================
// Helpers
// ============================================================================

/// Compute the maximum visible items for overlay pickers (model selector,
/// session picker, settings, branch picker, etc.) based on the terminal height.
///
/// The overlay typically needs ~8 rows of chrome: title, search field, divider,
/// pagination hint, detail line, help footer, and margins.  We reserve that
/// overhead and clamp the result to `[3, 30]` so the UI stays usable on very
/// small terminals while allowing taller lists on large ones.
fn overlay_max_visible(term_height: usize) -> usize {
    const OVERLAY_CHROME_ROWS: usize = 8;
    term_height.saturating_sub(OVERLAY_CHROME_ROWS).clamp(3, 30)
}

fn validate_provider_base_url(value: &str) -> Result<Option<String>, String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Ok(None);
    }

    let parsed = Url::parse(trimmed)
        .map_err(|err| format!("API URL must be a valid http or https URL: {err}"))?;
    match parsed.scheme() {
        "http" | "https" => Ok(Some(trimmed.to_string())),
        _ => Err("API URL must be a valid http or https URL".to_string()),
    }
}

fn provider_default_base_url(provider: &str) -> Option<String> {
    let canonical = crate::provider_metadata::canonical_provider_id(provider).unwrap_or(provider);
    crate::provider_metadata::provider_routing_defaults(canonical).and_then(|defaults| {
        let trimmed = defaults.base_url.trim();
        (!trimmed.is_empty()).then(|| trimmed.to_string())
    })
}

fn read_json_object_file(path: &Path) -> Result<Value, String> {
    if !path.exists() {
        return Ok(Value::Object(serde_json::Map::new()));
    }

    let content =
        std::fs::read_to_string(path).map_err(|err| format!("read {}: {err}", path.display()))?;
    if content.trim().is_empty() {
        return Ok(Value::Object(serde_json::Map::new()));
    }

    let value: Value =
        serde_json::from_str(&content).map_err(|err| format!("parse {}: {err}", path.display()))?;
    if value.is_object() {
        Ok(value)
    } else {
        Err(format!("{} must contain a JSON object", path.display()))
    }
}

fn load_provider_base_url_override(models_path: &Path, provider: &str) -> Option<String> {
    let provider = crate::provider_metadata::canonical_provider_id(provider)
        .unwrap_or(provider)
        .trim();
    if provider.is_empty() {
        return None;
    }

    let value = read_json_object_file(models_path).ok()?;
    value
        .get("providers")
        .and_then(Value::as_object)
        .and_then(|providers| providers.get(provider))
        .and_then(Value::as_object)
        .and_then(|config| config.get("baseUrl"))
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
}

fn save_provider_base_url_override(
    models_path: &Path,
    provider: &str,
    base_url: Option<&str>,
) -> Result<(), String> {
    let provider = crate::provider_metadata::canonical_provider_id(provider)
        .unwrap_or(provider)
        .trim();
    if provider.is_empty() {
        return Ok(());
    }

    let mut root = read_json_object_file(models_path)?;
    let root_obj = root
        .as_object_mut()
        .ok_or_else(|| format!("{} must contain a JSON object", models_path.display()))?;
    let providers_entry = root_obj
        .entry("providers".to_string())
        .or_insert_with(|| Value::Object(serde_json::Map::new()));
    let providers = providers_entry.as_object_mut().ok_or_else(|| {
        format!(
            "providers in {} must be a JSON object",
            models_path.display()
        )
    })?;

    if let Some(value) = base_url.map(str::trim).filter(|value| !value.is_empty()) {
        let provider_entry = providers
            .entry(provider.to_string())
            .or_insert_with(|| Value::Object(serde_json::Map::new()));
        let provider_obj = provider_entry.as_object_mut().ok_or_else(|| {
            format!(
                "provider entry {provider} in {} must be a JSON object",
                models_path.display()
            )
        })?;
        provider_obj.insert("baseUrl".to_string(), Value::String(value.to_string()));
    } else {
        let remove_provider = providers
            .get_mut(provider)
            .and_then(Value::as_object_mut)
            .is_some_and(|provider_obj| {
                provider_obj.remove("baseUrl");
                provider_obj.is_empty()
            });
        if remove_provider {
            providers.remove(provider);
        }
    }

    if providers.is_empty() {
        root_obj.remove("providers");
    }

    if let Some(parent) = models_path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|err| format!("create {}: {err}", parent.display()))?;
    }
    std::fs::write(
        models_path,
        serde_json::to_string_pretty(&root)
            .map_err(|err| format!("serialize {}: {err}", models_path.display()))?,
    )
    .map_err(|err| format!("write {}: {err}", models_path.display()))
}

fn editable_api_key_for_provider(
    auth: &crate::auth::AuthStorage,
    provider: &str,
) -> Option<String> {
    match auth.get(provider) {
        Some(crate::auth::AuthCredential::ApiKey { key }) => Some(key.clone()),
        Some(crate::auth::AuthCredential::BearerToken { token }) => Some(token.clone()),
        _ => crate::provider_metadata::canonical_provider_id(provider)
            .filter(|canonical| *canonical != provider)
            .and_then(|canonical| editable_api_key_for_provider(auth, canonical)),
    }
}

// ============================================================================
// Slash Commands
// ============================================================================

impl PiApp {
    /// Returns true when the viewport is currently anchored to the tail of the
    /// conversation content (i.e. the user has not scrolled away from the bottom).
    fn is_at_bottom(&self) -> bool {
        let content = self.build_conversation_content();
        let trimmed = content.trim_end();
        let line_count = trimmed.lines().count();
        let visible_rows = self.view_effective_conversation_height().max(1);
        if line_count <= visible_rows {
            return true;
        }
        let max_offset = line_count.saturating_sub(visible_rows);
        self.conversation_viewport.y_offset() >= max_offset
    }

    /// Rebuild viewport content after conversation state changes.
    /// If `follow_tail` is true the viewport is scrolled to the very bottom;
    /// otherwise the current scroll position is preserved.
    fn refresh_conversation_viewport(&mut self, follow_tail: bool) {
        let vp_start = if self.frame_timing.enabled {
            Some(std::time::Instant::now())
        } else {
            None
        };

        // When the user has scrolled away (follow_tail == false), preserve
        // the absolute y_offset so new content appended at the bottom does
        // not shift the lines the user is reading.
        let saved_offset = if follow_tail {
            None
        } else {
            Some(self.conversation_viewport.y_offset())
        };

        let content = self.build_conversation_content();
        let trimmed = content.trim_end();
        let effective = self.view_effective_conversation_height().max(1);
        self.conversation_viewport.height = effective;
        self.conversation_viewport.set_content(trimmed);

        if follow_tail {
            self.conversation_viewport.goto_bottom();
            self.follow_stream_tail = true;
        } else if let Some(offset) = saved_offset {
            // Restore the exact scroll position. set_y_offset() clamps to
            // max_y_offset internally, so this is safe even if content shrank.
            self.conversation_viewport.set_y_offset(offset);
        }

        if let Some(start) = vp_start {
            self.frame_timing
                .record_viewport_sync(micros_as_u64(start.elapsed().as_micros()));
        }
    }

    /// Scroll the conversation viewport to the bottom.
    fn scroll_to_bottom(&mut self) {
        self.refresh_conversation_viewport(true);
    }

    fn scroll_to_last_match(&mut self, needle: &str) {
        let content = self.build_conversation_content();
        let trimmed = content.trim_end();
        let effective = self.view_effective_conversation_height().max(1);
        self.conversation_viewport.height = effective;
        self.conversation_viewport.set_content(trimmed);

        let mut last_index = None;
        for (idx, line) in trimmed.lines().enumerate() {
            if line.contains(needle) {
                last_index = Some(idx);
            }
        }

        if let Some(idx) = last_index {
            self.conversation_viewport.set_y_offset(idx);
            self.follow_stream_tail = false;
        } else {
            self.conversation_viewport.goto_bottom();
            self.follow_stream_tail = true;
        }
    }

    /// Handle a mouse wheel event, routing it to the appropriate overlay or
    /// the conversation viewport.  Returns `None` (no command needed).
    fn handle_mouse_wheel(&mut self, is_up: bool) -> Option<Cmd> {
        // Priority 1: tree UI captures everything.
        if self.tree_ui.is_some() {
            // Tree UI has its own scroll; we don't intercept here.
            return None;
        }

        // Priority 2: model selector overlay.
        if let Some(ref mut selector) = self.model_selector {
            if is_up {
                selector.select_prev();
            } else {
                selector.select_next();
            }
            return None;
        }

        // Priority 3: session picker overlay.
        if let Some(ref mut picker) = self.session_picker {
            if is_up {
                picker.select_prev();
            } else {
                picker.select_next();
            }
            return None;
        }

        // Priority 4: settings UI overlay.
        if let Some(ref mut settings) = self.settings_ui {
            if is_up {
                settings.select_prev();
            } else {
                settings.select_next();
            }
            return None;
        }

        // Priority 5: provider setup overlay.
        if self.provider_setup.is_some() {
            return None;
        }

        // Priority 6: theme picker overlay.
        if let Some(ref mut picker) = self.theme_picker {
            if is_up {
                picker.select_prev();
            } else {
                picker.select_next();
            }
            return None;
        }

        // Priority 7: branch picker overlay.
        if let Some(ref mut picker) = self.branch_picker {
            if is_up {
                picker.select_prev();
            } else {
                picker.select_next();
            }
            return None;
        }

        // No overlay open: scroll the conversation viewport.
        // Sync content before scrolling (same pattern as PageUp/PageDown).
        let saved_offset = self.conversation_viewport.y_offset();
        let content = self.build_conversation_content();
        let effective = self.view_effective_conversation_height().max(1);
        self.conversation_viewport.height = effective;
        self.conversation_viewport.set_content(content.trim_end());
        self.conversation_viewport.set_y_offset(saved_offset);

        if is_up {
            self.conversation_viewport.scroll_up(1);
            self.follow_stream_tail = false;
        } else {
            self.conversation_viewport.scroll_down(1);
            // Re-enable auto-follow if scrolled back to the bottom.
            if self.is_at_bottom() {
                self.follow_stream_tail = true;
            }
        }
        None
    }

    fn apply_theme(&mut self, theme: Theme) {
        self.theme = theme;
        self.styles = self.theme.tui_styles();
        self.markdown_style = self.theme.glamour_style_config();
        if let Some(indent) = self
            .config
            .markdown
            .as_ref()
            .and_then(|m| m.code_block_indent)
        {
            self.markdown_style.code_block.block.margin = Some(indent as usize);
        }
        self.spinner =
            SpinnerModel::with_spinner(spinners::dot()).style(self.styles.accent.clone());

        self.message_render_cache.invalidate_all();
        let content = self.build_conversation_content();
        let effective = self.view_effective_conversation_height().max(1);
        self.conversation_viewport.height = effective;
        self.conversation_viewport.set_content(content.trim_end());
    }

    fn persist_project_theme(&self, theme_name: &str) -> crate::error::Result<()> {
        let settings_path = self.cwd.join(Config::project_dir()).join("settings.json");
        let mut settings = if settings_path.exists() {
            let content = std::fs::read_to_string(&settings_path)?;
            serde_json::from_str::<Value>(&content)?
        } else {
            json!({})
        };

        let obj = settings.as_object_mut().ok_or_else(|| {
            crate::error::Error::config(format!(
                "Settings file is not a JSON object: {}",
                settings_path.display()
            ))
        })?;
        obj.insert("theme".to_string(), Value::String(theme_name.to_string()));

        if let Some(parent) = settings_path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        std::fs::write(settings_path, serde_json::to_string_pretty(&settings)?)?;
        Ok(())
    }

    fn apply_queue_modes(&self, steering_mode: QueueMode, follow_up_mode: QueueMode) {
        if let Ok(mut queue) = self.message_queue.lock() {
            queue.set_modes(steering_mode, follow_up_mode);
        }

        if let Ok(mut agent_guard) = self.agent.try_lock() {
            agent_guard.set_queue_modes(steering_mode, follow_up_mode);
            return;
        }

        let agent = Arc::clone(&self.agent);
        let runtime_handle = self.runtime_handle.clone();
        runtime_handle.spawn(async move {
            let cx = Cx::for_request();
            if let Ok(mut agent_guard) = agent.lock(&cx).await {
                agent_guard.set_queue_modes(steering_mode, follow_up_mode);
            }
        });
    }

    fn toggle_queue_mode_setting(&mut self, entry: SettingsUiEntry) {
        let (key, current) = match entry {
            SettingsUiEntry::SteeringMode => ("steeringMode", self.config.steering_queue_mode()),
            SettingsUiEntry::FollowUpMode => ("followUpMode", self.config.follow_up_queue_mode()),
            _ => return,
        };

        let next = match current {
            QueueMode::All => QueueMode::OneAtATime,
            QueueMode::OneAtATime => QueueMode::All,
        };

        let patch = match entry {
            SettingsUiEntry::SteeringMode => json!({ "steeringMode": next.as_str() }),
            SettingsUiEntry::FollowUpMode => json!({ "followUpMode": next.as_str() }),
            _ => json!({}),
        };

        let global_dir = Config::global_dir();
        if let Err(err) =
            Config::patch_settings_with_roots(SettingsScope::Project, &global_dir, &self.cwd, patch)
        {
            self.status_message = Some(format!("Failed to update {key}: {err}"));
            return;
        }

        match entry {
            SettingsUiEntry::SteeringMode => {
                self.config.steering_mode = Some(next.as_str().to_string());
            }
            SettingsUiEntry::FollowUpMode => {
                self.config.follow_up_mode = Some(next.as_str().to_string());
            }
            _ => {}
        }

        let steering_mode = self.config.steering_queue_mode();
        let follow_up_mode = self.config.follow_up_queue_mode();
        self.apply_queue_modes(steering_mode, follow_up_mode);
        self.status_message = Some(format!("Updated {key}: {}", next.as_str()));
    }

    fn persist_project_settings_patch(&mut self, key: &str, patch: Value) -> bool {
        let global_dir = Config::global_dir();
        if let Err(err) =
            Config::patch_settings_with_roots(SettingsScope::Project, &global_dir, &self.cwd, patch)
        {
            self.status_message = Some(format!("Failed to update {key}: {err}"));
            return false;
        }
        true
    }

    fn open_provider_setup_overlay(&mut self, provider_override: Option<&str>) {
        let provider = provider_override
            .map(normalize_auth_provider_input)
            .or_else(|| {
                self.config
                    .default_provider
                    .as_deref()
                    .map(normalize_auth_provider_input)
            })
            .filter(|value| !value.is_empty())
            .unwrap_or_else(|| normalize_auth_provider_input(&self.model_entry.model.provider));
        let model = self
            .config
            .default_model
            .clone()
            .filter(|value| !value.trim().is_empty())
            .unwrap_or_else(|| self.model_entry.model.id.clone());
        let models_path = default_models_path(&Config::global_dir());
        let base_url = load_provider_base_url_override(&models_path, &provider)
            .or_else(|| provider_default_base_url(&provider))
            .unwrap_or_default();
        let api_key = crate::auth::AuthStorage::load(Config::auth_path())
            .ok()
            .and_then(|auth| editable_api_key_for_provider(&auth, &provider))
            .unwrap_or_default();

        self.provider_setup = Some(ProviderSetupOverlay::new(
            provider, model, base_url, api_key,
        ));
        self.session_picker = None;
        self.settings_ui = None;
        self.theme_picker = None;
        self.model_selector = None;
        self.autocomplete.close();
    }

    fn refresh_available_models_from_auth(
        &mut self,
        auth: &crate::auth::AuthStorage,
    ) -> Option<String> {
        let registry = load_interactive_model_registry(auth, self.extensions.as_ref());
        let mut available_models = registry.get_available();
        if !available_models
            .iter()
            .any(|entry| model_entry_matches(entry, &self.model_entry))
        {
            available_models.push(self.model_entry.clone());
        }
        self.set_available_models(available_models);

        let enabled_patterns = self.config.enabled_models.clone().unwrap_or_default();
        if enabled_patterns.is_empty() {
            self.model_scope.clear();
        } else if let Ok(scope) =
            resolve_scoped_model_entries(&enabled_patterns, &self.available_models)
        {
            self.model_scope = scope;
        } else {
            self.model_scope.clear();
        }

        registry.error().map(ToOwned::to_owned)
    }

    fn refresh_available_models_from_disk(&mut self) -> Result<Option<String>, String> {
        let auth =
            crate::auth::AuthStorage::load(Config::auth_path()).map_err(|err| err.to_string())?;
        Ok(self.refresh_available_models_from_auth(&auth))
    }

    #[allow(clippy::too_many_lines)]
    fn apply_provider_setup(&mut self, overlay: &ProviderSetupOverlay) -> Result<String, String> {
        let provider = normalize_auth_provider_input(&overlay.provider);
        if provider.is_empty() {
            return Err("Provider is required".to_string());
        }

        let model = overlay.model.trim();
        if model.is_empty() {
            return Err("Model is required".to_string());
        }

        let normalized_api_key = if overlay.api_key.trim().is_empty() {
            None
        } else {
            Some(normalize_api_key_input(overlay.api_key.trim())?)
        };
        let base_url_input = if !overlay.base_url_dirty
            && normalize_auth_provider_input(&overlay.initial_provider) != provider
            && overlay.base_url.trim() == overlay.initial_base_url.trim()
        {
            provider_default_base_url(&provider).unwrap_or_default()
        } else {
            overlay.base_url.trim().to_string()
        };
        let base_url = validate_provider_base_url(&base_url_input)?;
        let mut auth =
            crate::auth::AuthStorage::load(Config::auth_path()).map_err(|err| err.to_string())?;
        let global_dir = Config::global_dir();
        let settings_patch = json!({
            "defaultProvider": provider,
            "defaultModel": model,
            "default_provider": provider,
            "default_model": model,
        });
        Config::patch_settings_with_roots(
            SettingsScope::Global,
            &global_dir,
            &self.cwd,
            settings_patch,
        )
        .map_err(|err| format!("Failed to save provider defaults: {err}"))?;

        let models_path = default_models_path(&global_dir);
        save_provider_base_url_override(&models_path, &provider, base_url.as_deref())?;
        let api_key_value = overlay.api_key.trim();
        let provider_matches_initial =
            normalize_auth_provider_input(&overlay.initial_provider) == provider;

        if api_key_value.is_empty() {
            if provider_matches_initial && !overlay.initial_api_key.is_empty() {
                remove_provider_credentials(&mut auth, &provider);
                auth.save().map_err(|err| err.to_string())?;
                self.sync_active_provider_credentials_from_auth(&auth, &provider);
            }
        } else {
            save_provider_credential(
                &mut auth,
                &provider,
                crate::auth::AuthCredential::ApiKey {
                    key: normalized_api_key.expect("validated api key"),
                },
            );
            auth.save().map_err(|err| err.to_string())?;
            self.sync_active_provider_credentials_from_auth(&auth, &provider);
        }

        self.config.default_provider = Some(provider.clone());
        self.config.default_model = Some(model.to_string());

        let registry = load_interactive_model_registry(&auth, self.extensions.as_ref());
        self.set_available_models(registry.get_available());
        let registry_diagnostic = registry.error().map(ToOwned::to_owned);

        let next = registry
            .find(&provider, model)
            .or_else(|| crate::models::ad_hoc_model_entry(&provider, model));

        let mut status = format!(
            "Provider setup saved: {provider}/{model}. Updated global settings, auth.json, and models.json"
        );

        if let Some(next) = next {
            let resolved_key_opt = self::commands::resolve_model_key_from_default_auth(&next);
            if crate::models::model_requires_configured_credential(&next)
                && resolved_key_opt.is_none()
            {
                status
                    .push_str(". Saved defaults, but the provider still has no usable credentials");
            } else {
                let provider_impl = providers::create_provider(&next, self.extensions.as_ref())
                    .map_err(|err| err.to_string())?;
                if let Err(err) =
                    self.switch_active_model(&next, provider_impl, resolved_key_opt.as_deref())
                {
                    let _ = write!(status, ". Saved defaults, but live switch failed: {err}");
                } else {
                    self.push_available_model_if_missing(next);
                    let _ = write!(status, ". Active model: {}", self.model);
                }
            }
        } else {
            status.push_str(
                ". Saved defaults, but this provider/model is not routable yet; use a supported provider id such as openai for OpenAI-compatible services",
            );
        }

        if let Some(diagnostic) = registry_diagnostic {
            let _ = write!(status, ". models.json warning: {diagnostic}");
        }

        let _ = self.refresh_available_models_from_disk();
        Ok(status)
    }

    fn sync_available_models_shared(&self) {
        if let Ok(mut guard) = self.available_models_shared.lock() {
            guard.clone_from(&self.available_models);
        }
    }

    fn set_available_models(&mut self, available_models: Vec<ModelEntry>) {
        self.available_models = available_models;
        self.sync_available_models_shared();
    }

    fn push_available_model_if_missing(&mut self, entry: ModelEntry) {
        if !self
            .available_models
            .iter()
            .any(|candidate| model_entry_matches(candidate, &entry))
        {
            self.available_models.push(entry);
            self.sync_available_models_shared();
        }
    }

    fn effective_show_hardware_cursor(&self) -> bool {
        self.config.show_hardware_cursor.unwrap_or_else(|| {
            std::env::var("PI_HARDWARE_CURSOR")
                .ok()
                .is_some_and(|val| val == "1")
        })
    }

    fn effective_default_permissive(&self) -> bool {
        self.config
            .extension_policy
            .as_ref()
            .and_then(|policy| policy.default_permissive)
            .unwrap_or(true)
    }

    fn apply_hardware_cursor(show: bool) {
        let mut stdout = std::io::stdout();
        if show {
            let _ = crossterm::execute!(stdout, cursor::Show);
        } else {
            let _ = crossterm::execute!(stdout, cursor::Hide);
        }
    }

    #[allow(clippy::too_many_lines)]
    fn toggle_settings_entry(&mut self, entry: SettingsUiEntry) {
        match entry {
            SettingsUiEntry::ProviderSetup => {
                self.open_provider_setup_overlay(None);
            }
            SettingsUiEntry::SteeringMode | SettingsUiEntry::FollowUpMode => {
                self.toggle_queue_mode_setting(entry);
            }
            SettingsUiEntry::DefaultPermissive => {
                let next = !self.effective_default_permissive();
                if self.persist_project_settings_patch(
                    "extensionPolicy.defaultPermissive",
                    json!({ "extensionPolicy": { "defaultPermissive": next } }),
                ) {
                    let policy = self
                        .config
                        .extension_policy
                        .get_or_insert_with(ExtensionPolicyConfig::default);
                    policy.default_permissive = Some(next);
                    self.status_message = Some(format!(
                        "Updated extensionPolicy.defaultPermissive: {}",
                        bool_label(next)
                    ));
                }
            }
            SettingsUiEntry::QuietStartup => {
                let next = !self.config.quiet_startup.unwrap_or(false);
                if self.persist_project_settings_patch(
                    "quietStartup",
                    json!({ "quiet_startup": next }),
                ) {
                    self.config.quiet_startup = Some(next);
                    self.status_message =
                        Some(format!("Updated quietStartup: {}", bool_label(next)));
                }
            }
            SettingsUiEntry::CollapseChangelog => {
                let next = !self.config.collapse_changelog.unwrap_or(false);
                if self.persist_project_settings_patch(
                    "collapseChangelog",
                    json!({ "collapse_changelog": next }),
                ) {
                    self.config.collapse_changelog = Some(next);
                    self.status_message =
                        Some(format!("Updated collapseChangelog: {}", bool_label(next)));
                }
            }
            SettingsUiEntry::HideThinkingBlock => {
                let next = !self.config.hide_thinking_block.unwrap_or(false);
                if self.persist_project_settings_patch(
                    "hideThinkingBlock",
                    json!({ "hide_thinking_block": next }),
                ) {
                    self.config.hide_thinking_block = Some(next);
                    self.thinking_visible = !next;
                    self.message_render_cache.invalidate_all();
                    self.scroll_to_bottom();
                    self.status_message =
                        Some(format!("Updated hideThinkingBlock: {}", bool_label(next)));
                }
            }
            SettingsUiEntry::ShowHardwareCursor => {
                let next = !self.effective_show_hardware_cursor();
                if self.persist_project_settings_patch(
                    "showHardwareCursor",
                    json!({ "show_hardware_cursor": next }),
                ) {
                    self.config.show_hardware_cursor = Some(next);
                    Self::apply_hardware_cursor(next);
                    self.status_message =
                        Some(format!("Updated showHardwareCursor: {}", bool_label(next)));
                }
            }
            SettingsUiEntry::DoubleEscapeAction => {
                let current = self
                    .config
                    .double_escape_action
                    .as_deref()
                    .unwrap_or("tree");
                let next = if current.eq_ignore_ascii_case("tree") {
                    "fork"
                } else {
                    "tree"
                };
                if self.persist_project_settings_patch(
                    "doubleEscapeAction",
                    json!({ "double_escape_action": next }),
                ) {
                    self.config.double_escape_action = Some(next.to_string());
                    self.status_message = Some(format!("Updated doubleEscapeAction: {next}"));
                }
            }
            SettingsUiEntry::EditorPaddingX => {
                let current = self.editor_padding_x.min(3);
                let next = match current {
                    0 => 1,
                    1 => 2,
                    2 => 3,
                    _ => 0,
                };
                if self.persist_project_settings_patch(
                    "editorPaddingX",
                    json!({ "editor_padding_x": next }),
                ) {
                    self.config.editor_padding_x = u32::try_from(next).ok();
                    self.editor_padding_x = next;
                    self.input
                        .set_width(self.term_width.saturating_sub(5 + self.editor_padding_x));
                    self.scroll_to_bottom();
                    self.status_message = Some(format!("Updated editorPaddingX: {next}"));
                }
            }
            SettingsUiEntry::AutocompleteMaxVisible => {
                let cycle = [3usize, 5, 8, 10, 12, 15, 20];
                let current = self.autocomplete.max_visible;
                let next = cycle
                    .iter()
                    .position(|value| *value == current)
                    .map_or(cycle[0], |idx| cycle[(idx + 1) % cycle.len()]);
                if self.persist_project_settings_patch(
                    "autocompleteMaxVisible",
                    json!({ "autocomplete_max_visible": next }),
                ) {
                    self.config.autocomplete_max_visible = u32::try_from(next).ok();
                    self.autocomplete.max_visible = next;
                    self.status_message = Some(format!("Updated autocompleteMaxVisible: {next}"));
                }
            }
            SettingsUiEntry::Theme => {
                self.settings_ui = None;
                let mut picker = ThemePickerOverlay::new(&self.cwd);
                picker.max_visible = overlay_max_visible(self.term_height);
                self.theme_picker = Some(picker);
            }
            SettingsUiEntry::Summary => {}
        }
    }

    // ========================================================================
    // Memory pressure actions (PERF-6)
    // ========================================================================

    /// Run memory pressure actions: progressive collapse (Pressure) and
    /// conversation truncation (Critical). Called from update_inner().
    fn run_memory_pressure_actions(&mut self) {
        let level = self.memory_monitor.level;

        // Progressive collapse: one tool output per second, oldest first.
        if self.memory_monitor.collapsing
            && self.memory_monitor.last_collapse.elapsed() >= std::time::Duration::from_secs(1)
        {
            if let Some(idx) = self.find_next_uncollapsed_tool_output() {
                self.messages[idx].collapsed = true;
                let placeholder = "[tool output collapsed due to memory pressure]".to_string();
                self.messages[idx].content = placeholder;
                self.messages[idx].thinking = None;
                self.memory_monitor.next_collapse_index = idx + 1;
                self.memory_monitor.last_collapse = std::time::Instant::now();
                self.memory_monitor.resample_now();
            } else {
                self.memory_monitor.collapsing = false;
            }
        }

        // Pressure level: remove thinking from messages older than last 10 turns.
        if level == MemoryLevel::Pressure || level == MemoryLevel::Critical {
            let msg_count = self.messages.len();
            if msg_count > 10 {
                for msg in &mut self.messages[..msg_count - 10] {
                    if msg.thinking.is_some() {
                        msg.thinking = None;
                    }
                }
            }
        }

        // Critical: truncate old messages (keep last CRITICAL_KEEP_MESSAGES).
        if level == MemoryLevel::Critical && !self.memory_monitor.truncated {
            let msg_count = self.messages.len();
            if msg_count > CRITICAL_KEEP_MESSAGES {
                let remove_count = msg_count - CRITICAL_KEEP_MESSAGES;
                self.messages.drain(..remove_count);
                self.messages.insert(
                    0,
                    ConversationMessage::new(
                        MessageRole::System,
                        "[conversation history truncated due to memory pressure — see session file for full history]".to_string(),
                        None,
                    ),
                );
                self.memory_monitor.next_collapse_index = 0;
                self.message_render_cache.clear();
            }
            self.memory_monitor.truncated = true;
            self.memory_monitor.resample_now();
        }
    }

    /// Find the next uncollapsed Tool message starting from `next_collapse_index`.
    fn find_next_uncollapsed_tool_output(&self) -> Option<usize> {
        let start = self.memory_monitor.next_collapse_index;
        (start..self.messages.len())
            .find(|&i| self.messages[i].role == MessageRole::Tool && !self.messages[i].collapsed)
    }

    fn format_settings_summary(&self) -> String {
        let theme_setting = self
            .config
            .theme
            .as_deref()
            .unwrap_or("")
            .trim()
            .to_string();
        let theme_setting = if theme_setting.is_empty() {
            "(default)".to_string()
        } else {
            theme_setting
        };

        let compaction_enabled = self.config.compaction_enabled();
        let reserve_tokens = self.config.compaction_reserve_tokens();
        let keep_recent = self.config.compaction_keep_recent_tokens();
        let steering = self.config.steering_queue_mode();
        let follow_up = self.config.follow_up_queue_mode();
        let default_permissive = self.effective_default_permissive();
        let quiet_startup = self.config.quiet_startup.unwrap_or(false);
        let collapse_changelog = self.config.collapse_changelog.unwrap_or(false);
        let hide_thinking_block = self.config.hide_thinking_block.unwrap_or(false);
        let show_hardware_cursor = self.effective_show_hardware_cursor();
        let double_escape_action = self
            .config
            .double_escape_action
            .as_deref()
            .unwrap_or("tree");

        let mut output = String::new();
        let _ = writeln!(output, "Settings:");
        let _ = writeln!(
            output,
            "  theme: {} (config: {})",
            self.theme.name, theme_setting
        );
        let _ = writeln!(output, "  model: {}", self.model);
        let _ = writeln!(
            output,
            "  compaction: {compaction_enabled} (reserve={reserve_tokens}, keepRecent={keep_recent})"
        );
        let _ = writeln!(output, "  steeringMode: {}", steering.as_str());
        let _ = writeln!(output, "  followUpMode: {}", follow_up.as_str());
        let _ = writeln!(
            output,
            "  extensionPolicy.defaultPermissive: {}",
            bool_label(default_permissive)
        );
        let _ = writeln!(output, "  quietStartup: {}", bool_label(quiet_startup));
        let _ = writeln!(
            output,
            "  collapseChangelog: {}",
            bool_label(collapse_changelog)
        );
        let _ = writeln!(
            output,
            "  hideThinkingBlock: {}",
            bool_label(hide_thinking_block)
        );
        let _ = writeln!(
            output,
            "  showHardwareCursor: {}",
            bool_label(show_hardware_cursor)
        );
        let _ = writeln!(output, "  doubleEscapeAction: {double_escape_action}");
        let _ = writeln!(output, "  editorPaddingX: {}", self.editor_padding_x);
        let _ = writeln!(
            output,
            "  autocompleteMaxVisible: {}",
            self.autocomplete.max_visible
        );
        let _ = writeln!(
            output,
            "  skillCommands: {}",
            if self.config.enable_skill_commands() {
                "enabled"
            } else {
                "disabled"
            }
        );

        let _ = writeln!(output, "\nResources:");
        let _ = writeln!(output, "  skills: {}", self.resources.skills().len());
        let _ = writeln!(output, "  prompts: {}", self.resources.prompts().len());
        let _ = writeln!(output, "  themes: {}", self.resources.themes().len());

        let skill_diags = self.resources.skill_diagnostics().len();
        let prompt_diags = self.resources.prompt_diagnostics().len();
        let theme_diags = self.resources.theme_diagnostics().len();
        if skill_diags + prompt_diags + theme_diags > 0 {
            let _ = writeln!(output, "\nDiagnostics:");
            let _ = writeln!(output, "  skills: {skill_diags}");
            let _ = writeln!(output, "  prompts: {prompt_diags}");
            let _ = writeln!(output, "  themes: {theme_diags}");
        }

        output
    }

    fn default_export_path(&self, session: &Session) -> PathBuf {
        if let Some(path) = session.path.as_ref() {
            let stem = path
                .file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("session");
            return self.cwd.join(format!("pi-session-{stem}.html"));
        }
        let id = crate::session_picker::truncate_session_id(&session.header.id, 8);
        self.cwd.join(format!("pi-session-unsaved-{id}.html"))
    }

    fn resolve_output_path(&self, raw: &str) -> PathBuf {
        let raw = raw.trim();
        if raw.is_empty() {
            return self.cwd.join("pi-session.html");
        }
        let path = PathBuf::from(raw);
        if path.is_absolute() {
            path
        } else {
            self.cwd.join(path)
        }
    }

    fn spawn_save_session(&self) {
        if !self.save_enabled {
            return;
        }

        let session = Arc::clone(&self.session);
        let event_tx = self.event_tx.clone();
        let runtime_handle = self.runtime_handle.clone();
        runtime_handle.spawn(async move {
            let cx = Cx::for_request();

            let mut session_guard = match session.lock(&cx).await {
                Ok(guard) => guard,
                Err(err) => {
                    let _ = send_pi_msg_with_backpressure(
                        &event_tx,
                        PiMsg::AgentError(format!("Failed to lock session: {err}")),
                    )
                    .await;
                    return;
                }
            };

            if let Err(err) = session_guard.save().await {
                let _ = send_pi_msg_with_backpressure(
                    &event_tx,
                    PiMsg::AgentError(format!("Failed to save session: {err}")),
                )
                .await;
            }
        });
    }

    fn maybe_trigger_autocomplete(&mut self) {
        if !matches!(self.agent_state, AgentState::Idle)
            || self.session_picker.is_some()
            || self.settings_ui.is_some()
            || self.provider_setup.is_some()
        {
            self.autocomplete.close();
            return;
        }

        let text = self.input.value();
        if text.trim().is_empty() {
            self.autocomplete.close();
            return;
        }

        // Autocomplete provider expects a byte offset cursor.
        let cursor = self.input.cursor_byte_offset();
        let response = self.autocomplete.provider.suggest(&text, cursor);
        // Path completion is Tab-triggered to avoid noisy dropdowns for URL-like tokens.
        if response
            .items
            .iter()
            .all(|item| item.kind == AutocompleteItemKind::Path)
        {
            self.autocomplete.close();
            return;
        }
        self.autocomplete.open_with(response);
    }

    fn trigger_autocomplete(&mut self) {
        self.maybe_trigger_autocomplete();
    }

    /// Compute the conversation viewport height based on the current UI chrome.
    ///
    /// This delegates to [`view_effective_conversation_height`] so viewport
    /// scroll math stays aligned with the rows actually rendered in `view()`.
    fn conversation_viewport_height(&self) -> usize {
        self.view_effective_conversation_height()
    }

    /// Return whether the generic "Processing..." spinner row should be shown.
    ///
    /// Once provider text/thinking deltas are streaming, that output already
    /// acts as progress feedback; suppressing the extra animated status row
    /// reduces redraw churn and visible flicker.
    fn show_processing_status_spinner(&self) -> bool {
        if matches!(self.agent_state, AgentState::Idle) || self.current_tool.is_some() {
            return false;
        }

        let has_visible_stream_progress = !self.current_response.is_empty()
            || (self.thinking_visible && !self.current_thinking.is_empty());
        !has_visible_stream_progress
    }

    /// Return whether any spinner row is currently visible in `view()`.
    ///
    /// The spinner is rendered either for tool execution progress, or for the
    /// generic processing state before visible stream output appears.
    fn spinner_visible(&self) -> bool {
        if matches!(self.agent_state, AgentState::Idle) {
            return false;
        }
        self.current_tool.is_some() || self.show_processing_status_spinner()
    }

    /// Return whether the normal editor input area should be visible.
    ///
    /// Keeping this in one place prevents overlay/input drift between
    /// rendering, viewport sizing, and keyboard dispatch.
    const fn editor_input_is_available(&self) -> bool {
        matches!(self.agent_state, AgentState::Idle)
            && self.tree_ui.is_none()
            && self.session_picker.is_none()
            && self.settings_ui.is_none()
            && self.provider_setup.is_none()
            && self.theme_picker.is_none()
            && self.capability_prompt.is_none()
            && self.extension_custom_overlay.is_none()
            && self.branch_picker.is_none()
            && self.model_selector.is_none()
    }

    /// Return whether a custom extension overlay should currently receive
    /// keyboard input.
    ///
    /// Higher-priority modal overlays must win when they are present;
    /// otherwise the prompt renders but can never be answered.
    const fn custom_overlay_input_is_available(&self) -> bool {
        self.extension_custom_active
            && self.tree_ui.is_none()
            && self.session_picker.is_none()
            && self.settings_ui.is_none()
            && self.provider_setup.is_none()
            && self.theme_picker.is_none()
            && self.capability_prompt.is_none()
            && self.branch_picker.is_none()
            && self.model_selector.is_none()
    }

    /// Approximate how many rows the custom extension overlay renders.
    ///
    /// `render_extension_custom_overlay()` emits:
    /// - a leading blank spacer row plus the title row
    /// - the source row
    /// - either the waiting line or the visible frame tail
    /// - the help row
    fn extension_custom_overlay_rows(&self) -> usize {
        let Some(overlay) = self.extension_custom_overlay.as_ref() else {
            return 0;
        };

        let max_lines = self.term_height.saturating_sub(12).max(4);
        let visible_lines = overlay.lines.len().min(max_lines).max(1);
        4 + visible_lines
    }

    /// Compute the effective conversation viewport height for the current
    /// render frame, accounting for conditional chrome (scroll indicator,
    /// tool status, status message) that reduce available space.
    ///
    /// Used in [`view()`] for conversation line slicing so the total output
    /// never exceeds `term_height` rows.  The stored
    /// `conversation_viewport.height` still drives scroll-position management.
    fn view_effective_conversation_height(&self) -> usize {
        // Fixed chrome:
        // header(4) = title/model + hints + resources + spacer line
        // footer(2) = blank line + footer line
        let mut chrome: usize = 4 + 2;

        // Budget 1 row for the scroll indicator.  Slightly conservative
        // when content is short, but prevents the off-by-one that triggers
        // terminal scrolling.
        chrome += 1;

        // Tool status: "\n  spinner Running {tool} ...\n" = 2 rows.
        if self.current_tool.is_some() {
            chrome += 2;
        }

        // Status message: "\n  {status}\n" = 2 rows.
        if self.status_message.is_some() {
            chrome += 2;
        }

        // Capability prompt overlay: ~8 lines (title, ext name, desc, blank, buttons, timer, help, blank).
        if self.capability_prompt.is_some() {
            chrome += 8;
        }

        // Custom extension overlay: spacer + title + source + content/help.
        chrome += self.extension_custom_overlay_rows();

        // Branch picker overlay: header + N visible branches + help line + padding.
        if let Some(ref picker) = self.branch_picker {
            let visible = picker.branches.len().min(picker.max_visible);
            chrome += 3 + visible + 2; // title + header + separator + items + help + blank
        }

        // Model selector overlay: title + config-only hint + search + separator + items + detail + help + padding.
        if let Some(ref selector) = self.model_selector {
            let visible = selector.max_visible().min(selector.filtered_len().max(1));
            // ~6 lines of chrome (title, optional hint, search, separator, detail/status, help)
            chrome += visible + 6;
        }

        // Session picker overlay: title + search + separator + items + help + padding.
        if let Some(ref picker) = self.session_picker {
            let visible = picker.sessions.len().min(picker.max_visible);
            chrome += visible + 6; // title + blank + search + separator + items + help + blank
        }

        // Settings UI overlay: title + items + help + padding.
        if let Some(ref settings) = self.settings_ui {
            let visible = settings.entries.len().min(settings.max_visible);
            chrome += visible + 5; // title + blank + items + help + blank
        }

        // Provider setup overlay: title + intro + fields + help + padding.
        if self.provider_setup.is_some() {
            chrome += 11;
        }

        // Theme picker overlay: title + items + help + padding.
        if let Some(ref picker) = self.theme_picker {
            let visible = picker.items.len().min(picker.max_visible);
            chrome += visible + 5; // title + blank + items + help + blank
        }

        // Input area vs processing spinner.
        if self.editor_input_is_available() {
            // render_input: "\n  header\n" (2 rows) + input.height() rows.
            chrome += 2 + self.input.height();

            // Autocomplete dropdown chrome when open: top border(1) +
            // items(visible_count) + description(1) + pagination(1) +
            // bottom border(1) + help(1).  Budget for the dropdown so
            // the conversation viewport shrinks to make room.
            if self.autocomplete.open && !self.autocomplete.items.is_empty() {
                let visible = self
                    .autocomplete
                    .max_visible
                    .min(self.autocomplete.items.len());
                // 5 = top border + possible description + possible pagination
                //     + bottom border + help line
                chrome += visible + 5;
            }
        } else if self.show_processing_status_spinner() {
            // Processing spinner: "\n  spinner Processing...\n" = 2 rows.
            chrome += 2;
        }

        self.term_height.saturating_sub(chrome)
    }

    /// Set the input area height and recalculate the conversation viewport
    /// so the total layout fits the terminal.
    fn set_input_height(&mut self, h: usize) {
        self.input.set_height(h);
        self.resize_conversation_viewport();
    }

    /// Rebuild the conversation viewport after a height change (terminal resize or
    /// input area growth). Preserves mouse-wheel settings and scroll position.
    fn resize_conversation_viewport(&mut self) {
        let viewport_height = self.conversation_viewport_height();
        let mut viewport = Viewport::new(self.term_width.saturating_sub(2), viewport_height);
        viewport.mouse_wheel_enabled = true;
        viewport.mouse_wheel_delta = 1;
        self.conversation_viewport = viewport;
        self.scroll_to_bottom();
    }

    pub fn set_terminal_size(&mut self, width: usize, height: usize) {
        let test_mode = std::env::var_os("PI_TEST_MODE").is_some();
        let previous_height = self.term_height;
        self.term_width = width.max(1);
        self.term_height = height.max(1);
        self.input
            .set_width(self.term_width.saturating_sub(5 + self.editor_padding_x));

        if !test_mode
            && self.term_height < previous_height
            && self.config.terminal_clear_on_shrink()
        {
            let _ = crossterm::execute!(
                std::io::stdout(),
                terminal::Clear(terminal::ClearType::Purge)
            );
        }

        self.message_render_cache.invalidate_all();
        self.resize_conversation_viewport();

        // Adapt open overlay pickers to the new terminal height.
        let max_vis = overlay_max_visible(self.term_height);
        if let Some(ref mut selector) = self.model_selector {
            selector.set_max_visible(max_vis);
        }
        if let Some(ref mut picker) = self.session_picker {
            picker.max_visible = max_vis;
        }
        if let Some(ref mut settings) = self.settings_ui {
            settings.max_visible = max_vis;
        }
        if let Some(ref mut picker) = self.theme_picker {
            picker.max_visible = max_vis;
        }
        if let Some(ref mut picker) = self.branch_picker {
            picker.max_visible = max_vis;
        }
    }

    fn accept_autocomplete(&mut self, item: &AutocompleteItem) {
        let text = self.input.value();
        let range = self.autocomplete.replace_range.clone();

        // Guard against stale range if editor content changed since autocomplete was triggered.
        let mut start = range.start.min(text.len());
        while start > 0 && !text.is_char_boundary(start) {
            start -= 1;
        }
        let mut end = range.end.min(text.len()).max(start);
        while end < text.len() && !text.is_char_boundary(end) {
            end += 1;
        }

        let mut new_text = String::with_capacity(text.len().saturating_add(item.insert.len()));
        new_text.push_str(&text[..start]);
        new_text.push_str(&item.insert);
        new_text.push_str(&text[end..]);

        self.input.set_value(&new_text);
        self.input.cursor_end();
    }

    fn extract_file_references(&mut self, message: &str) -> (String, Vec<String>) {
        let mut cleaned = String::with_capacity(message.len());
        let mut file_args = Vec::new();
        let mut idx = 0usize;

        while idx < message.len() {
            let ch = message[idx..].chars().next().unwrap_or(' ');
            if ch == '@' && is_file_ref_boundary(message, idx) {
                let token_start = idx + ch.len_utf8();
                let parsed = parse_quoted_file_ref(message, token_start);
                let (path, trailing, token_end) = parsed.unwrap_or_else(|| {
                    let (token, token_end) = next_non_whitespace_token(message, token_start);
                    let (path, trailing) = split_trailing_punct(token);
                    (path.to_string(), trailing.to_string(), token_end)
                });

                if !path.is_empty() {
                    let resolved =
                        self.autocomplete
                            .provider
                            .resolve_file_ref(&path)
                            .or_else(|| {
                                let resolved_path = resolve_read_path(&path, &self.cwd);
                                resolved_path.exists().then(|| path.clone())
                            });

                    if let Some(resolved) = resolved {
                        file_args.push(resolved);
                        if !trailing.is_empty()
                            && cleaned.chars().last().is_some_and(char::is_whitespace)
                        {
                            cleaned.pop();
                        }
                        cleaned.push_str(&trailing);
                        idx = token_end;
                        continue;
                    }
                }
            }

            cleaned.push(ch);
            idx += ch.len_utf8();
        }

        (cleaned, file_args)
    }

    #[allow(clippy::too_many_lines)]
    fn load_session_from_path(&mut self, path: &str) -> Option<Cmd> {
        let path = path.to_string();
        let session = Arc::clone(&self.session);
        let agent = Arc::clone(&self.agent);
        let extensions = self.extensions.clone();
        let available_models_shared = self.available_models_shared.clone();
        let model_entry_shared = self.model_entry_shared.clone();
        let event_tx = self.event_tx.clone();
        let runtime_handle = self.runtime_handle.clone();

        runtime_handle.spawn(async move {
            let cx = Cx::for_request();

            if let Some(manager) = extensions.clone() {
                let cancelled = manager
                    .dispatch_cancellable_event(
                        ExtensionEventName::SessionBeforeSwitch,
                        Some(json!({
                            "reason": "resume",
                            "targetSessionFile": path.clone(),
                        })),
                        EXTENSION_EVENT_TIMEOUT_MS,
                    )
                    .await
                    .unwrap_or(false);
                if cancelled {
                    let _ = send_pi_msg_with_backpressure(
                        &event_tx,
                        PiMsg::System("Session switch cancelled by extension".to_string()),
                    )
                    .await;
                    return;
                }
            }

            let outcome = {
                let session_dir = match session.lock(&cx).await {
                    Ok(guard) => guard.session_dir.clone(),
                    Err(err) => {
                        let _ = send_pi_msg_with_backpressure(
                            &event_tx,
                            PiMsg::AgentError(format!("Failed to lock session: {err}")),
                        )
                        .await;
                        return;
                    }
                };
                let mut loaded_session = match Session::open(&path).await {
                    Ok(session) => session,
                    Err(err) => {
                        let _ = send_pi_msg_with_backpressure(
                            &event_tx,
                            PiMsg::AgentError(format!("Failed to open session: {err}")),
                        )
                        .await;
                        return;
                    }
                };
                loaded_session.session_dir = session_dir;
                let available_models = available_models_shared
                    .lock()
                    .unwrap_or_else(std::sync::PoisonError::into_inner)
                    .clone();
                match install_interactive_session(
                    InteractiveSessionInstallContext {
                        session: &session,
                        agent: &agent,
                        available_models: &available_models,
                        preferred_model_entry: None,
                        reuse_active_runtime: false,
                        model_entry_shared: &model_entry_shared,
                        extensions: extensions.as_ref(),
                    },
                    loaded_session,
                )
                .await {
                    Ok(outcome) => outcome,
                    Err(err) => {
                        let _ =
                            send_pi_msg_with_backpressure(&event_tx, PiMsg::AgentError(err)).await;
                        return;
                    }
                }
            };

            if let Some(entry) = outcome.active_model_entry.clone() {
                let _ =
                    send_pi_msg_with_backpressure(&event_tx, PiMsg::SyncModelState(Box::new(entry)))
                        .await;
            }

            let (messages, usage) = match snapshot_conversation_state(&session).await {
                Ok(snapshot) => snapshot,
                Err(err) => {
                    let _ = send_pi_msg_with_backpressure(&event_tx, PiMsg::AgentError(err)).await;
                    return;
                }
            };

            let _ = send_pi_msg_with_backpressure(
                &event_tx,
                PiMsg::ConversationReset {
                    messages,
                    usage,
                    status: Some("Session resumed".to_string()),
                },
            )
            .await;

            if let Some(manager) = extensions {
                let _ = manager
                    .dispatch_event(
                        ExtensionEventName::SessionSwitch,
                        Some(json!({
                            "reason": "resume",
                            "previousSessionFile": outcome.session_swap.previous_session_file,
                            "targetSessionFile": outcome.session_swap.target_session_file.unwrap_or(path),
                            "sessionId": outcome.session_swap.session_id,
                        })),
                    )
                    .await;
            }
        });

        self.status_message = Some("Loading session...".to_string());
        None
    }
}

const fn bool_label(value: bool) -> &'static str {
    if value { "on" } else { "off" }
}

/// Run the interactive mode.
#[allow(clippy::too_many_arguments)]
pub async fn run_interactive(
    agent: Agent,
    session: Arc<Mutex<Session>>,
    config: Config,
    model_entry: ModelEntry,
    model_scope: Vec<ModelEntry>,
    available_models: Vec<ModelEntry>,
    pending_inputs: Vec<PendingInput>,
    save_enabled: bool,
    resources: ResourceLoader,
    resource_cli: ResourceCliOptions,
    extensions: Option<ExtensionManager>,
    cwd: PathBuf,
    runtime_handle: RuntimeHandle,
) -> anyhow::Result<()> {
    let show_hardware_cursor = config.show_hardware_cursor.unwrap_or_else(|| {
        std::env::var("PI_HARDWARE_CURSOR")
            .ok()
            .is_some_and(|val| val == "1")
    });
    let mut stdout = std::io::stdout();
    if show_hardware_cursor {
        let _ = crossterm::execute!(stdout, cursor::Show);
    } else {
        let _ = crossterm::execute!(stdout, cursor::Hide);
    }

    let (event_tx, event_rx) = mpsc::channel::<PiMsg>(1024);
    let (ui_tx, ui_rx) = std::sync::mpsc::channel::<Message>();

    runtime_handle.spawn(async move {
        let cx = Cx::for_request();
        while let Ok(msg) = event_rx.recv(&cx).await {
            if matches!(msg, PiMsg::UiShutdown) {
                break;
            }
            let _ = ui_tx.send(Message::new(msg));
        }
    });

    let extensions = extensions;

    if let Some(manager) = &extensions {
        let (extension_ui_tx, extension_ui_rx) = mpsc::channel::<ExtensionUiRequest>(64);
        manager.set_ui_sender(extension_ui_tx);

        let extension_event_tx = event_tx.clone();
        runtime_handle.spawn(async move {
            let cx = Cx::for_request();
            while let Ok(request) = extension_ui_rx.recv(&cx).await {
                if !send_pi_msg_with_backpressure(
                    &extension_event_tx,
                    PiMsg::ExtensionUiRequest(request),
                )
                .await
                {
                    break;
                }
            }
        });
    }

    let (messages, usage) = {
        let cx = Cx::for_request();
        let guard = session
            .lock(&cx)
            .await
            .map_err(|e| anyhow::anyhow!("Failed to lock session: {e}"))?;
        conversation_from_session(&guard)
    };

    Program::new(PiApp::new(
        agent,
        session,
        config,
        resources,
        resource_cli,
        cwd,
        model_entry,
        model_scope,
        available_models,
        pending_inputs,
        event_tx,
        runtime_handle,
        save_enabled,
        extensions,
        None,
        messages,
        usage,
    ))
    .with_alt_screen()
    .with_mouse_cell_motion()
    .with_input_receiver(ui_rx)
    .run()?;

    let _ = crossterm::execute!(std::io::stdout(), cursor::Show);
    println!("Goodbye!");
    Ok(())
}

/// Custom message types for async agent events.
#[derive(Debug, Clone)]
pub enum PiMsg {
    /// Agent started processing.
    AgentStart,
    /// Trigger processing of the next queued input (CLI startup messages).
    RunPending,
    /// Enqueue a pending input (extensions may inject while idle).
    EnqueuePendingInput(PendingInput),
    /// Internal: shut down the async→UI message bridge (used for clean exit).
    UiShutdown,
    /// Text delta from assistant.
    TextDelta(String),
    /// Thinking delta from assistant.
    ThinkingDelta(String),
    /// Tool execution started.
    ToolStart { name: String, tool_id: String },
    /// Tool execution update (streaming output).
    ToolUpdate {
        name: String,
        tool_id: String,
        content: Vec<ContentBlock>,
        details: Option<Value>,
    },
    /// Tool execution ended.
    ToolEnd {
        name: String,
        tool_id: String,
        is_error: bool,
    },
    /// Agent finished with final message.
    AgentDone {
        usage: Option<Usage>,
        stop_reason: StopReason,
        error_message: Option<String>,
    },
    /// Agent error.
    AgentError(String),
    /// Credentials changed for a provider; refresh in-memory provider auth state.
    CredentialUpdated { provider: String },
    /// Non-error system message.
    System(String),
    /// System note that does not mutate agent state (safe during streaming).
    SystemNote(String),
    /// Update last user message content (input transform/redaction).
    UpdateLastUserMessage(String),
    /// Bash command result (non-agent).
    BashResult {
        display: String,
        content_for_agent: Option<Vec<ContentBlock>>,
    },
    /// Replace conversation state from session (compaction/fork).
    ConversationReset {
        messages: Vec<ConversationMessage>,
        usage: Usage,
        status: Option<String>,
    },
    /// Synchronize the active model label/state after a session swap.
    SyncModelState(Box<ModelEntry>),
    /// Set the editor contents (used by /tree selection of user/custom messages).
    SetEditorText(String),
    /// Reloaded skills/prompts/themes and refreshed the model catalog.
    ResourcesReloaded {
        resources: ResourceLoader,
        status: String,
        diagnostics: Option<String>,
    },
    /// Extension UI request (select/confirm/input/editor/custom/notify).
    ExtensionUiRequest(ExtensionUiRequest),
    /// Extension command finished execution.
    ExtensionCommandDone {
        command: String,
        display: String,
        is_error: bool,
    },
    /// OAuth callback server received the browser redirect.
    /// The string is the full callback URL (e.g. `http://localhost:1455/auth/callback?code=abc&state=xyz`).
    OAuthCallbackReceived(String),
}

pub(super) async fn send_pi_msg_with_backpressure(
    event_tx: &mpsc::Sender<PiMsg>,
    msg: PiMsg,
) -> bool {
    let cx = Cx::for_request();
    event_tx.send(&cx, msg).await.is_ok()
}

pub(super) fn send_pi_msg_with_backpressure_blocking(
    event_tx: &mpsc::Sender<PiMsg>,
    msg: PiMsg,
) -> bool {
    futures::executor::block_on(send_pi_msg_with_backpressure(event_tx, msg))
}

pub(super) async fn snapshot_conversation_state(
    session: &Arc<Mutex<Session>>,
) -> std::result::Result<(Vec<ConversationMessage>, Usage), String> {
    let cx = Cx::for_request();
    let guard = session
        .lock(&cx)
        .await
        .map_err(|err| format!("Failed to lock session: {err}"))?;
    Ok(conversation_from_session(&guard))
}

pub(super) async fn snapshot_session_id(
    session: &Arc<Mutex<Session>>,
) -> std::result::Result<String, String> {
    let cx = Cx::for_request();
    let guard = session
        .lock(&cx)
        .await
        .map_err(|err| format!("Failed to lock session: {err}"))?;
    Ok(guard.header.id.clone())
}

struct InteractiveAgentRefresh {
    agent_messages: Vec<ModelMessage>,
    messages: Vec<ConversationMessage>,
    usage: Usage,
    session_id: String,
    thinking_level: Option<crate::model::ThinkingLevel>,
}

fn capture_interactive_agent_refresh(session: &Session) -> InteractiveAgentRefresh {
    let (messages, usage) = conversation_from_session(session);
    InteractiveAgentRefresh {
        agent_messages: session.to_messages_for_current_path(),
        messages,
        usage,
        session_id: session.header.id.clone(),
        thinking_level: session
            .header
            .thinking_level
            .as_deref()
            .and_then(|value| value.parse::<crate::model::ThinkingLevel>().ok()),
    }
}

fn reset_interactive_agent_state(
    agent: &mut Agent,
    messages: Vec<ModelMessage>,
    session_id: String,
    thinking_level: Option<crate::model::ThinkingLevel>,
) {
    agent.replace_messages(messages);
    agent.clear_queued_messages();
    let stream_options = agent.stream_options_mut();
    stream_options.session_id = Some(session_id);
    stream_options.thinking_level = thinking_level;
}

pub(super) async fn refresh_interactive_agent_from_session(
    session: &Arc<Mutex<Session>>,
    agent: &Arc<Mutex<Agent>>,
) -> std::result::Result<(Vec<ConversationMessage>, Usage), String> {
    let cx = Cx::for_request();
    let refresh = {
        let guard = session
            .lock(&cx)
            .await
            .map_err(|err| format!("Failed to lock session: {err}"))?;
        capture_interactive_agent_refresh(&guard)
    };

    let InteractiveAgentRefresh {
        agent_messages,
        messages,
        usage,
        session_id,
        thinking_level,
    } = refresh;

    let mut agent_guard = agent
        .lock(&cx)
        .await
        .map_err(|err| format!("Failed to lock agent: {err}"))?;
    reset_interactive_agent_state(&mut agent_guard, agent_messages, session_id, thinking_level);
    Ok((messages, usage))
}

pub(super) fn refresh_interactive_agent_from_session_try(
    session: &Arc<Mutex<Session>>,
    agent: &Arc<Mutex<Agent>>,
) -> std::result::Result<(Vec<ConversationMessage>, Usage), String> {
    let refresh = {
        let guard = session
            .try_lock()
            .map_err(|err| format!("Failed to lock session: {err}"))?;
        capture_interactive_agent_refresh(&guard)
    };

    let InteractiveAgentRefresh {
        agent_messages,
        messages,
        usage,
        session_id,
        thinking_level,
    } = refresh;

    let mut agent_guard = agent
        .try_lock()
        .map_err(|err| format!("Failed to lock agent: {err}"))?;
    reset_interactive_agent_state(&mut agent_guard, agent_messages, session_id, thinking_level);
    Ok((messages, usage))
}

pub(super) fn collect_interactive_model_candidates(
    available_models: &[ModelEntry],
    preferred_model_entry: Option<&ModelEntry>,
    extensions: Option<&ExtensionManager>,
) -> Vec<ModelEntry> {
    let mut candidates = available_models.to_vec();

    if let Some(manager) = extensions {
        for entry in manager.extension_model_entries() {
            if !candidates
                .iter()
                .any(|candidate| commands::model_entry_matches(candidate, &entry))
            {
                candidates.push(entry);
            }
        }
    }

    if let Some(preferred) = preferred_model_entry {
        if !candidates
            .iter()
            .any(|candidate| commands::model_entry_matches(candidate, preferred))
        {
            candidates.push(preferred.clone());
        }
    }

    candidates
}

fn resolve_session_model_entry(
    available_models: &[ModelEntry],
    preferred_model_entry: Option<&ModelEntry>,
    provider_id: &str,
    model_id: &str,
) -> Option<ModelEntry> {
    preferred_model_entry
        .filter(|entry| {
            crate::provider_metadata::provider_ids_match(&entry.model.provider, provider_id)
                && entry.model.id.eq_ignore_ascii_case(model_id)
        })
        .cloned()
        .or_else(|| {
            available_models
                .iter()
                .find(|entry| {
                    crate::provider_metadata::provider_ids_match(&entry.model.provider, provider_id)
                        && entry.model.id.eq_ignore_ascii_case(model_id)
                })
                .cloned()
        })
}

fn load_interactive_model_registry(
    auth: &crate::auth::AuthStorage,
    extensions: Option<&ExtensionManager>,
) -> ModelRegistry {
    let models_path = default_models_path(&Config::global_dir());
    let mut registry = ModelRegistry::load(auth, Some(models_path));
    if let Some(manager) = extensions {
        let extension_models = manager.extension_model_entries();
        if !extension_models.is_empty() {
            registry.merge_entries(extension_models);
        }
    }
    registry
}

pub(super) struct InteractiveSessionInstallOutcome {
    pub(super) session_swap: crate::agent::SessionSwapOutcome,
    pub(super) active_model_entry: Option<ModelEntry>,
}

pub(super) struct InteractiveSessionInstallContext<'a> {
    pub(super) session: &'a Arc<Mutex<Session>>,
    pub(super) agent: &'a Arc<Mutex<Agent>>,
    pub(super) available_models: &'a [ModelEntry],
    pub(super) preferred_model_entry: Option<ModelEntry>,
    pub(super) reuse_active_runtime: bool,
    pub(super) model_entry_shared: &'a Arc<StdMutex<ModelEntry>>,
    pub(super) extensions: Option<&'a ExtensionManager>,
}

struct InteractiveRuntimeModel {
    entry: ModelEntry,
    provider_impl: Option<Arc<dyn crate::provider::Provider>>,
    resolved_key: Option<String>,
}

fn resolve_interactive_runtime_model(
    available_models: &[ModelEntry],
    preferred_model_entry: Option<&ModelEntry>,
    reuse_active_runtime: bool,
    extensions: Option<&ExtensionManager>,
    provider_id: Option<&str>,
    model_id: Option<&str>,
) -> std::result::Result<Option<InteractiveRuntimeModel>, String> {
    let (Some(provider_id), Some(model_id)) = (provider_id, model_id) else {
        return Ok(None);
    };

    let preferred_matches = preferred_model_entry.filter(|entry| {
        crate::provider_metadata::provider_ids_match(&entry.model.provider, provider_id)
            && entry.model.id.eq_ignore_ascii_case(model_id)
    });
    let candidate_models =
        collect_interactive_model_candidates(available_models, preferred_model_entry, extensions);

    if reuse_active_runtime {
        return Ok(preferred_matches
            .cloned()
            .map(|entry| InteractiveRuntimeModel {
                entry,
                provider_impl: None,
                resolved_key: None,
            })
            .or_else(|| {
                resolve_session_model_entry(
                    &candidate_models,
                    preferred_model_entry,
                    provider_id,
                    model_id,
                )
                .map(|entry| InteractiveRuntimeModel {
                    entry,
                    provider_impl: None,
                    resolved_key: None,
                })
            })
            .or_else(|| {
                crate::models::ad_hoc_model_entry(provider_id, model_id).map(|entry| {
                    InteractiveRuntimeModel {
                        entry,
                        provider_impl: None,
                        resolved_key: None,
                    }
                })
            }));
    }

    let entry = resolve_session_model_entry(
        &candidate_models,
        preferred_model_entry,
        provider_id,
        model_id,
    )
    .or_else(|| crate::models::ad_hoc_model_entry(provider_id, model_id))
    .ok_or_else(|| {
        format!(
            "Failed to restore session model {provider_id}/{model_id}: model not found in available models or supported ad-hoc providers"
        )
    })?;
    let provider_impl = providers::create_provider(&entry, extensions).map_err(|err| {
        format!("Failed to restore session model {provider_id}/{model_id}: {err}")
    })?;
    let resolved_key = commands::resolve_model_key_from_default_auth(&entry);

    Ok(Some(InteractiveRuntimeModel {
        entry,
        provider_impl: Some(provider_impl),
        resolved_key,
    }))
}

pub(super) async fn install_interactive_session(
    context: InteractiveSessionInstallContext<'_>,
    new_session: Session,
) -> std::result::Result<InteractiveSessionInstallOutcome, String> {
    let session_id = new_session.header.id.clone();
    let target_session_file = new_session
        .path
        .as_ref()
        .map(|path| path.display().to_string());
    let thinking_level = new_session
        .header
        .thinking_level
        .as_deref()
        .and_then(|value| value.parse::<crate::model::ThinkingLevel>().ok());
    let messages = new_session.to_messages_for_current_path();
    let runtime_model = resolve_interactive_runtime_model(
        context.available_models,
        context.preferred_model_entry.as_ref(),
        context.reuse_active_runtime,
        context.extensions,
        new_session.header.provider.as_deref(),
        new_session.header.model_id.as_deref(),
    )?;
    let active_model_entry = runtime_model.as_ref().map(|runtime| runtime.entry.clone());

    let cx = Cx::for_request();
    let previous_session_file = {
        let mut guard = context
            .session
            .lock(&cx)
            .await
            .map_err(|err| format!("Failed to lock session: {err}"))?;
        let previous = guard.path.as_ref().map(|path| path.display().to_string());
        *guard = new_session;
        previous
    };

    let mut agent_guard = context
        .agent
        .lock(&cx)
        .await
        .map_err(|err| format!("Failed to lock agent: {err}"))?;
    if let Some(runtime) = &runtime_model {
        if let Some(provider_impl) = &runtime.provider_impl {
            agent_guard.set_provider(Arc::clone(provider_impl));
            let stream_options = agent_guard.stream_options_mut();
            stream_options.api_key.clone_from(&runtime.resolved_key);
            stream_options.headers.clone_from(&runtime.entry.headers);
        }
    }
    reset_interactive_agent_state(
        &mut agent_guard,
        messages,
        session_id.clone(),
        thinking_level,
    );

    if let Some(entry) = &active_model_entry {
        if let Ok(mut guard) = context.model_entry_shared.lock() {
            *guard = entry.clone();
        }
    }

    Ok(InteractiveSessionInstallOutcome {
        session_swap: crate::agent::SessionSwapOutcome {
            session_id,
            previous_session_file,
            target_session_file,
        },
        active_model_entry,
    })
}

/// Read the current git branch from `.git/HEAD` in the given directory.
///
/// Returns `Some("branch-name")` for a normal branch,
/// `Some("abc1234")` (7-char short SHA) for detached HEAD,
/// or `None` if not in a git repo or `.git/HEAD` is unreadable.
fn read_git_branch(cwd: &Path) -> Option<String> {
    let git_head = find_git_head_path(cwd)?;
    let content = std::fs::read_to_string(git_head).ok()?;
    let content = content.trim();
    content.strip_prefix("ref: refs/heads/").map_or_else(
        || {
            // Detached HEAD — show short SHA
            (content.len() >= 7 && content.chars().all(|c| c.is_ascii_hexdigit()))
                .then(|| content[..7].to_string())
        },
        |ref_path| Some(ref_path.to_string()),
    )
}

fn find_git_head_path(cwd: &Path) -> Option<PathBuf> {
    let mut current = cwd.to_path_buf();
    loop {
        let dot_git = current.join(".git");
        if let Some(git_head) = resolve_git_head_path(&dot_git) {
            return Some(git_head);
        }
        if !current.pop() {
            return None;
        }
    }
}

fn resolve_git_head_path(dot_git: &Path) -> Option<PathBuf> {
    if dot_git.is_dir() {
        let head = dot_git.join("HEAD");
        return head.is_file().then_some(head);
    }

    if dot_git.is_file() {
        let dot_git_contents = std::fs::read_to_string(dot_git).ok()?;
        let gitdir = dot_git_contents
            .trim()
            .strip_prefix("gitdir:")
            .map(str::trim)?;
        if gitdir.is_empty() {
            return None;
        }
        let resolved_gitdir = Path::new(gitdir);
        let resolved_gitdir = if resolved_gitdir.is_absolute() {
            resolved_gitdir.to_path_buf()
        } else {
            dot_git.parent()?.join(resolved_gitdir)
        };
        let head = resolved_gitdir.join("HEAD");
        return head.is_file().then_some(head);
    }

    None
}

fn build_startup_welcome_message(config: &Config) -> String {
    if config.quiet_startup.unwrap_or(false) {
        return String::new();
    }

    let mut message = String::from("  Welcome to Pi!\n");
    message.push_str("  Type a message to begin, or /help for commands.\n");
    message.push_str("  Use /setup to configure provider, model, API URL, and API key.\n");

    let auth_path = Config::auth_path();
    if let Ok(auth) = crate::auth::AuthStorage::load(auth_path) {
        if should_show_startup_oauth_hint(&auth) {
            message.push('\n');
            message.push_str(&format_startup_oauth_hint(&auth));
        }
    }

    message
}

/// The main interactive TUI application model.
#[allow(clippy::struct_excessive_bools)]
#[derive(bubbletea::Model)]
pub struct PiApp {
    // Input state
    input: TextArea,
    history: HistoryList,
    input_mode: InputMode,
    pending_inputs: VecDeque<PendingInput>,
    message_queue: Arc<StdMutex<InteractiveMessageQueue>>,

    // Display state - viewport for scrollable conversation
    pub conversation_viewport: Viewport,
    /// When true, the viewport auto-scrolls to the bottom on new content.
    /// Set to false when the user manually scrolls up; re-enabled when they
    /// scroll back to the bottom or a new user message is submitted.
    follow_stream_tail: bool,
    spinner: SpinnerModel,
    agent_state: AgentState,

    // Terminal dimensions
    term_width: usize,
    term_height: usize,
    editor_padding_x: usize,

    // Conversation state
    messages: Vec<ConversationMessage>,
    current_response: String,
    current_thinking: String,
    thinking_visible: bool,
    tools_expanded: bool,
    current_tool: Option<String>,
    tool_progress: Option<ToolProgress>,
    pending_tool_output: Option<String>,

    // Session and config
    session: Arc<Mutex<Session>>,
    config: Config,
    theme: Theme,
    styles: TuiStyles,
    markdown_style: GlamourStyleConfig,
    resources: ResourceLoader,
    resource_cli: ResourceCliOptions,
    cwd: PathBuf,
    model_entry: ModelEntry,
    model_entry_shared: Arc<StdMutex<ModelEntry>>,
    available_models_shared: Arc<StdMutex<Vec<ModelEntry>>>,
    model_scope: Vec<ModelEntry>,
    available_models: Vec<ModelEntry>,
    model: String,
    agent: Arc<Mutex<Agent>>,
    save_enabled: bool,
    abort_handle: Option<AbortHandle>,
    bash_running: bool,

    // Token tracking
    total_usage: Usage,

    // Async channel for agent events
    event_tx: mpsc::Sender<PiMsg>,
    runtime_handle: RuntimeHandle,

    // Extension session state
    extension_streaming: Arc<AtomicBool>,
    extension_compacting: Arc<AtomicBool>,
    extension_ui_queue: VecDeque<ExtensionUiRequest>,
    active_extension_ui: Option<ExtensionUiRequest>,
    extension_custom_overlay: Option<ExtensionCustomOverlay>,
    extension_custom_active: bool,
    extension_custom_key_queue: VecDeque<String>,

    // Status message (for slash command feedback)
    status_message: Option<String>,
    // V2 binding status snapshots for `/bindings`.
    binding_status: Vec<crate::bindings::types::BindingStatusView>,
    // Pending restore confirmation tuple: `(snapshot_id, system_id, rendered_plan)`.
    vault_restore_plan: Option<(String, String, String)>,

    // Login flow state (awaiting sensitive credential input)
    pending_oauth: Option<PendingOAuth>,

    // Extension system
    extensions: Option<ExtensionManager>,

    // Keybindings for action dispatch
    keybindings: crate::keybindings::KeyBindings,

    // Track last Ctrl+C time for double-tap quit detection
    last_ctrlc_time: Option<std::time::Instant>,
    // Track last Escape time for double-tap tree/fork
    last_escape_time: Option<std::time::Instant>,

    // Autocomplete state
    autocomplete: AutocompleteState,

    // Session picker overlay for /resume
    session_picker: Option<SessionPickerOverlay>,

    // Settings UI overlay for /settings
    settings_ui: Option<SettingsUiState>,

    // Provider setup overlay for /setup and /settings
    provider_setup: Option<ProviderSetupOverlay>,

    // Theme picker overlay
    theme_picker: Option<ThemePickerOverlay>,

    // Tree navigation UI state (for /tree command)
    tree_ui: Option<TreeUiState>,

    // Capability prompt overlay (extension permission request)
    capability_prompt: Option<CapabilityPromptOverlay>,

    // Branch picker overlay (Ctrl+B quick branch switching)
    branch_picker: Option<BranchPickerOverlay>,

    // Model selector overlay (Ctrl+L)
    model_selector: Option<crate::model_selector::ModelSelectorOverlay>,

    // Frame timing telemetry (PERF-3)
    frame_timing: FrameTimingStats,

    // Memory pressure monitoring (PERF-6)
    memory_monitor: MemoryMonitor,

    // Per-message render cache (PERF-1)
    message_render_cache: MessageRenderCache,

    // Pre-allocated reusable buffers for view() hot path (PERF-7)
    render_buffers: RenderBuffers,

    // Current git branch name (refreshed on startup + after each agent turn)
    git_branch: Option<String>,
    // Startup banner shown in an empty conversation.
    startup_welcome: String,

    // RAII guard for tmux wheel scroll override (dropped on exit/panic).
    #[allow(dead_code)]
    tmux_wheel_guard: Option<TmuxWheelGuard>,
}

impl PiApp {
    fn initial_window_size_cmd() -> Cmd {
        Cmd::new(|| {
            let (width, height) = terminal::size().unwrap_or((80, 24));
            Message::new(WindowSizeMsg { width, height })
        })
    }

    fn startup_init_cmd(input_cmd: Option<Cmd>, pending_cmd: Option<Cmd>) -> Option<Cmd> {
        let startup_cmd = sequence(vec![Some(Self::initial_window_size_cmd()), pending_cmd]);
        batch(vec![input_cmd, startup_cmd])
    }

    /// Create a new Pi application.
    #[allow(clippy::too_many_arguments)]
    #[allow(clippy::too_many_lines)]
    pub fn new(
        agent: Agent,
        session: Arc<Mutex<Session>>,
        config: Config,
        resources: ResourceLoader,
        resource_cli: ResourceCliOptions,
        cwd: PathBuf,
        model_entry: ModelEntry,
        model_scope: Vec<ModelEntry>,
        available_models: Vec<ModelEntry>,
        pending_inputs: Vec<PendingInput>,
        event_tx: mpsc::Sender<PiMsg>,
        runtime_handle: RuntimeHandle,
        save_enabled: bool,
        extensions: Option<ExtensionManager>,
        keybindings_override: Option<KeyBindings>,
        messages: Vec<ConversationMessage>,
        total_usage: Usage,
    ) -> Self {
        // Get terminal size
        let (term_width, term_height) =
            terminal::size().map_or((80, 24), |(w, h)| (w as usize, h as usize));

        let theme = Theme::resolve(&config, &cwd);
        let styles = theme.tui_styles();
        let mut markdown_style = theme.glamour_style_config();
        if let Some(indent) = config.markdown.as_ref().and_then(|m| m.code_block_indent) {
            markdown_style.code_block.block.margin = Some(indent as usize);
        }
        let editor_padding_x = config.editor_padding_x.unwrap_or(0).min(3) as usize;
        let autocomplete_max_visible =
            config.autocomplete_max_visible.unwrap_or(5).clamp(3, 20) as usize;
        let thinking_visible = !config.hide_thinking_block.unwrap_or(false);

        // Configure text area for input
        let mut input = TextArea::new();
        input.placeholder = "Type a message... (/help, /exit)".to_string();
        input.show_line_numbers = false;
        input.prompt = "> ".to_string();
        input.set_height(3); // Start with 3 lines
        input.set_width(term_width.saturating_sub(5 + editor_padding_x));
        input.max_height = 10; // Allow expansion up to 10 lines
        input.focus();

        let spinner = SpinnerModel::with_spinner(spinners::dot()).style(styles.accent.clone());

        // Configure viewport for conversation history.
        // Height budget at startup (idle):
        // header(4) + scroll-indicator reserve(1) + input_decoration(2) + input_lines + footer(2).
        let chrome = 4 + 1 + 2 + 2;
        let viewport_height = term_height.saturating_sub(chrome + input.height());
        let mut conversation_viewport =
            Viewport::new(term_width.saturating_sub(2), viewport_height);
        conversation_viewport.mouse_wheel_enabled = true;
        conversation_viewport.mouse_wheel_delta = 1;

        let model = format!(
            "{}/{}",
            model_entry.model.provider.as_str(),
            model_entry.model.id.as_str()
        );

        let model_entry_shared = Arc::new(StdMutex::new(model_entry.clone()));
        let available_models_shared = Arc::new(StdMutex::new(available_models.clone()));
        let extension_streaming = Arc::new(AtomicBool::new(false));
        let extension_compacting = Arc::new(AtomicBool::new(false));
        let steering_mode = parse_queue_mode_or_default(config.steering_mode.as_deref());
        let follow_up_mode = parse_queue_mode_or_default(config.follow_up_mode.as_deref());
        let message_queue = Arc::new(StdMutex::new(InteractiveMessageQueue::new(
            steering_mode,
            follow_up_mode,
        )));
        let injected_queue = Arc::new(StdMutex::new(InjectedMessageQueue::new(
            steering_mode,
            follow_up_mode,
        )));

        let mut agent = agent;
        agent.set_queue_modes(steering_mode, follow_up_mode);
        {
            let steering_queue = Arc::clone(&message_queue);
            let follow_up_queue = Arc::clone(&message_queue);
            let injected_steering_queue = Arc::clone(&injected_queue);
            let injected_follow_up_queue = Arc::clone(&injected_queue);
            let steering_fetcher = move || -> BoxFuture<'static, Vec<ModelMessage>> {
                let steering_queue = Arc::clone(&steering_queue);
                let injected_steering_queue = Arc::clone(&injected_steering_queue);
                Box::pin(async move {
                    let mut out = Vec::new();
                    if let Ok(mut queue) = steering_queue.lock() {
                        out.extend(queue.pop_steering().into_iter().map(build_user_message));
                    }
                    if let Ok(mut queue) = injected_steering_queue.lock() {
                        out.extend(queue.pop_steering());
                    }
                    out
                })
            };
            let follow_up_fetcher = move || -> BoxFuture<'static, Vec<ModelMessage>> {
                let follow_up_queue = Arc::clone(&follow_up_queue);
                let injected_follow_up_queue = Arc::clone(&injected_follow_up_queue);
                Box::pin(async move {
                    let mut out = Vec::new();
                    if let Ok(mut queue) = follow_up_queue.lock() {
                        out.extend(queue.pop_follow_up().into_iter().map(build_user_message));
                    }
                    if let Ok(mut queue) = injected_follow_up_queue.lock() {
                        out.extend(queue.pop_follow_up());
                    }
                    out
                })
            };
            agent.register_message_fetchers(
                Some(Arc::new(steering_fetcher)),
                Some(Arc::new(follow_up_fetcher)),
            );
        }

        let keybindings = keybindings_override.unwrap_or_else(|| {
            // Load keybindings from user config (with defaults as fallback).
            let keybindings_result = KeyBindings::load_from_user_config();
            if keybindings_result.has_warnings() {
                tracing::warn!(
                    "Keybindings warnings: {}",
                    keybindings_result.format_warnings()
                );
            }
            keybindings_result.bindings
        });

        // Initialize autocomplete with catalog from resources
        let mut autocomplete_catalog = AutocompleteCatalog::from_resources(&resources);
        if let Some(manager) = &extensions {
            autocomplete_catalog.extension_commands = extension_commands_for_catalog(manager);
        }
        let mut autocomplete = AutocompleteState::new(cwd.clone(), autocomplete_catalog);
        autocomplete.max_visible = autocomplete_max_visible;

        let git_branch = read_git_branch(&cwd);
        let startup_welcome = build_startup_welcome_message(&config);

        let mut app = Self {
            input,
            history: HistoryList::new(),
            input_mode: InputMode::SingleLine,
            pending_inputs: VecDeque::from(pending_inputs),
            message_queue,
            conversation_viewport,
            follow_stream_tail: true,
            spinner,
            agent_state: AgentState::Idle,
            term_width,
            term_height,
            editor_padding_x,
            messages,
            current_response: String::new(),
            current_thinking: String::new(),
            thinking_visible,
            tools_expanded: true,
            current_tool: None,
            tool_progress: None,
            pending_tool_output: None,
            session,
            config,
            theme,
            styles,
            markdown_style,
            resources,
            resource_cli,
            cwd,
            model_entry,
            model_entry_shared: model_entry_shared.clone(),
            available_models_shared: available_models_shared.clone(),
            model_scope,
            available_models,
            model,
            agent: Arc::new(Mutex::new(agent)),
            total_usage,
            event_tx,
            runtime_handle,
            extension_streaming: extension_streaming.clone(),
            extension_compacting: extension_compacting.clone(),
            extension_ui_queue: VecDeque::new(),
            active_extension_ui: None,
            extension_custom_overlay: None,
            extension_custom_active: false,
            extension_custom_key_queue: VecDeque::new(),
            status_message: None,
            binding_status: Vec::new(),
            vault_restore_plan: None,
            save_enabled,
            abort_handle: None,
            bash_running: false,
            pending_oauth: None,
            extensions,
            keybindings,
            last_ctrlc_time: None,
            last_escape_time: None,
            autocomplete,
            session_picker: None,
            settings_ui: None,
            provider_setup: None,
            theme_picker: None,
            tree_ui: None,
            capability_prompt: None,
            branch_picker: None,
            model_selector: None,
            frame_timing: FrameTimingStats::new(),
            memory_monitor: MemoryMonitor::new_default(),
            message_render_cache: MessageRenderCache::new(),
            render_buffers: RenderBuffers::new(),
            git_branch,
            startup_welcome,
            tmux_wheel_guard: TmuxWheelGuard::install(),
        };

        if let Some(manager) = app.extensions.clone() {
            let session_handle = Arc::new(InteractiveExtensionSession {
                session: Arc::clone(&app.session),
                model_entry: model_entry_shared,
                available_models: available_models_shared,
                agent: Arc::clone(&app.agent),
                event_tx: app.event_tx.clone(),
                is_streaming: extension_streaming,
                is_compacting: extension_compacting,
                extensions: Some(manager.clone()),
                config: app.config.clone(),
                save_enabled: app.save_enabled,
            });
            manager.set_session(session_handle);

            manager.set_host_actions(Arc::new(InteractiveExtensionHostActions {
                session: Arc::clone(&app.session),
                agent: Arc::clone(&app.agent),
                event_tx: app.event_tx.clone(),
                extension_streaming: Arc::clone(&app.extension_streaming),
                user_queue: Arc::clone(&app.message_queue),
                injected_queue,
            }));
        }

        app.scroll_to_bottom();

        // Version update check (non-blocking, cache-only on startup)
        if app.config.should_check_for_updates() {
            if let crate::version_check::VersionCheckResult::UpdateAvailable { latest } =
                crate::version_check::check_cached()
            {
                app.status_message = Some(format!(
                    "New version {latest} available (current: {})",
                    crate::version_check::CURRENT_VERSION
                ));
            }
        }

        app
    }

    #[must_use]
    pub fn session_handle(&self) -> Arc<Mutex<Session>> {
        Arc::clone(&self.session)
    }

    #[must_use]
    pub fn agent_handle_for_test(&self) -> Arc<Mutex<Agent>> {
        Arc::clone(&self.agent)
    }

    /// Snapshot the live provider/model identity (integration test helper).
    pub fn agent_runtime_identity_for_test(&self) -> Option<(String, String)> {
        let guard = self.agent.try_lock().ok()?;
        let provider = guard.provider();
        Some((provider.name().to_string(), provider.model_id().to_string()))
    }

    /// Snapshot the current live tool names (integration test helper).
    pub fn agent_tool_names_for_test(&self) -> Option<Vec<String>> {
        let guard = self.agent.try_lock().ok()?;
        Some(guard.tool_names_for_test())
    }

    /// Get the current status message (for testing).
    pub fn status_message(&self) -> Option<&str> {
        self.status_message.as_deref()
    }

    /// Snapshot the in-memory conversation buffer (integration test helper).
    pub fn conversation_messages_for_test(&self) -> &[ConversationMessage] {
        &self.messages
    }

    /// Return the memory summary string (integration test helper).
    pub fn memory_summary_for_test(&self) -> String {
        self.memory_monitor.summary()
    }

    /// Install a deterministic RSS sampler for integration tests.
    ///
    /// This replaces `/proc/self` RSS sampling with a caller-provided function
    /// and enables immediate sampling cadence (`sample_interval = 0`).
    pub fn install_memory_rss_reader_for_test(
        &mut self,
        read_fn: Box<dyn Fn() -> Option<usize> + Send>,
    ) {
        let mut monitor = MemoryMonitor::new_with_reader_fn(read_fn);
        monitor.sample_interval = std::time::Duration::ZERO;
        monitor.last_collapse = std::time::Instant::now()
            .checked_sub(std::time::Duration::from_secs(1))
            .unwrap_or_else(std::time::Instant::now);
        self.memory_monitor = monitor;
    }

    /// Force a memory monitor sample + action pass (integration test helper).
    pub fn force_memory_cycle_for_test(&mut self) {
        self.memory_monitor.maybe_sample();
        self.run_memory_pressure_actions();
    }

    /// Force progressive-collapse timing eligibility (integration test helper).
    pub fn force_memory_collapse_tick_for_test(&mut self) {
        self.memory_monitor.last_collapse = std::time::Instant::now()
            .checked_sub(std::time::Duration::from_secs(1))
            .unwrap_or_else(std::time::Instant::now);
    }

    /// Get a reference to the model selector overlay (for testing).
    pub const fn model_selector(&self) -> Option<&crate::model_selector::ModelSelectorOverlay> {
        self.model_selector.as_ref()
    }

    /// Check if the branch picker is currently open (for testing).
    pub const fn has_branch_picker(&self) -> bool {
        self.branch_picker.is_some()
    }

    /// Return whether the conversation prefix cache is currently valid for
    /// the current message count (integration test helper for PERF-2).
    pub fn prefix_cache_valid_for_test(&self) -> bool {
        self.message_render_cache.prefix_valid(self.messages.len())
    }

    /// Return the length of the cached conversation prefix
    /// (integration test helper for PERF-2).
    pub fn prefix_cache_len_for_test(&self) -> usize {
        self.message_render_cache.prefix_get().len()
    }

    /// Return the current view capacity hint from render buffers
    /// (integration test helper for PERF-7).
    pub fn render_buffer_capacity_hint_for_test(&self) -> usize {
        self.render_buffers.view_capacity_hint()
    }

    /// Initialize the application.
    fn init(&self) -> Option<Cmd> {
        // Start text input cursor blink.
        // Spinner ticks are started lazily when we transition idle -> busy.
        let test_mode = std::env::var_os("PI_TEST_MODE").is_some();
        let input_cmd = if test_mode {
            None
        } else {
            BubbleteaModel::init(&self.input)
        };
        let pending_cmd = if self.pending_inputs.is_empty() {
            None
        } else {
            Some(Cmd::new(|| Message::new(PiMsg::RunPending)))
        };
        // Ensure the initial window-size refresh lands before any queued startup work.
        Self::startup_init_cmd(input_cmd, pending_cmd)
    }

    fn spinner_init_cmd(&self) -> Option<Cmd> {
        if std::env::var_os("PI_TEST_MODE").is_some() {
            None
        } else {
            BubbleteaModel::init(&self.spinner)
        }
    }

    /// Handle messages (keyboard input, async events, etc.).
    #[allow(clippy::too_many_lines)]
    fn update(&mut self, msg: Message) -> Option<Cmd> {
        let update_start = if self.frame_timing.enabled {
            Some(std::time::Instant::now())
        } else {
            None
        };
        let was_busy = !matches!(self.agent_state, AgentState::Idle);
        let was_spinner_visible = self.spinner_visible();
        let result = self.update_inner(msg);
        let became_busy = !was_busy && !matches!(self.agent_state, AgentState::Idle);
        let spinner_became_visible = !was_spinner_visible && self.spinner_visible();
        let result = if became_busy || spinner_became_visible {
            batch(vec![result, self.spinner_init_cmd()])
        } else {
            result
        };
        if let Some(start) = update_start {
            self.frame_timing
                .record_update(micros_as_u64(start.elapsed().as_micros()));
        }
        result
    }

    /// Inner update handler (extracted for frame timing instrumentation).
    #[allow(clippy::too_many_lines)]
    fn update_inner(&mut self, msg: Message) -> Option<Cmd> {
        // Memory pressure sampling + progressive collapse (PERF-6)
        self.memory_monitor.maybe_sample();
        self.run_memory_pressure_actions();

        // Handle our custom Pi messages (take ownership to avoid per-token clone).
        if msg.downcast_ref::<PiMsg>().is_some() {
            let pi_msg = msg.downcast::<PiMsg>().unwrap();
            return self.handle_pi_message(pi_msg);
        }

        if let Some(size) = msg.downcast_ref::<WindowSizeMsg>() {
            self.set_terminal_size(size.width as usize, size.height as usize);
            return None;
        }

        // Handle mouse wheel events: route to overlays when open, otherwise
        // scroll the conversation viewport.
        if let Some(mouse) = msg.downcast_ref::<MouseMsg>() {
            if mouse.is_wheel()
                && (mouse.button == MouseButton::WheelUp || mouse.button == MouseButton::WheelDown)
            {
                let is_up = mouse.button == MouseButton::WheelUp;
                return self.handle_mouse_wheel(is_up);
            }
        }

        // Ignore spinner ticks when no spinner row is visible so old tick
        // chains naturally stop and do not trigger hidden redraw churn.
        if msg.downcast_ref::<SpinnerTickMsg>().is_some() && !self.spinner_visible() {
            return None;
        }

        // Handle keyboard input via keybindings layer
        if let Some(key) = msg.downcast_ref::<KeyMsg>() {
            // Clear status message on any key press
            self.status_message = None;
            if key.key_type != KeyType::Esc {
                self.last_escape_time = None;
            }

            if self.handle_custom_extension_key(key) {
                return None;
            }

            // /tree modal captures all input while active.
            if self.tree_ui.is_some() {
                return self.handle_tree_ui_key(key);
            }

            // Capability prompt modal captures all input while active.
            if self.capability_prompt.is_some() {
                return self.handle_capability_prompt_key(key);
            }

            // Branch picker modal captures all input while active.
            if self.branch_picker.is_some() {
                return self.handle_branch_picker_key(key);
            }

            // Model selector modal captures all input while active.
            if self.model_selector.is_some() {
                return self.handle_model_selector_key(key);
            }

            // Theme picker modal captures all input while active.
            if self.theme_picker.is_some() {
                let mut picker = self
                    .theme_picker
                    .take()
                    .expect("checked theme_picker is_some");
                match key.key_type {
                    KeyType::Up => picker.select_prev(),
                    KeyType::Down => picker.select_next(),
                    KeyType::Runes if key.runes == ['k'] => picker.select_prev(),
                    KeyType::Runes if key.runes == ['j'] => picker.select_next(),
                    KeyType::Enter => {
                        if let Some(item) = picker.selected_item() {
                            let loaded = match item {
                                ThemePickerItem::BuiltIn(name) => Ok(match *name {
                                    "light" => Theme::light(),
                                    "solarized" => Theme::solarized(),
                                    _ => Theme::dark(),
                                }),
                                ThemePickerItem::File(path) => Theme::load(path),
                            };

                            match loaded {
                                Ok(theme) => {
                                    let theme_name = theme.name.clone();
                                    self.apply_theme(theme);
                                    self.config.theme = Some(theme_name.clone());
                                    if let Err(e) = self.persist_project_theme(&theme_name) {
                                        self.status_message =
                                            Some(format!("Failed to persist theme: {e}"));
                                    } else {
                                        self.status_message =
                                            Some(format!("Switched to theme: {theme_name}"));
                                    }
                                }
                                Err(e) => {
                                    self.status_message =
                                        Some(format!("Failed to load selected theme: {e}"));
                                }
                            }
                        }
                        self.theme_picker = None;
                        return None;
                    }
                    KeyType::Esc => {
                        self.theme_picker = None;
                        let mut settings = SettingsUiState::new();
                        settings.max_visible = overlay_max_visible(self.term_height);
                        self.settings_ui = Some(settings);
                        return None;
                    }
                    KeyType::Runes if key.runes == ['q'] => {
                        self.theme_picker = None;
                        let mut settings = SettingsUiState::new();
                        settings.max_visible = overlay_max_visible(self.term_height);
                        self.settings_ui = Some(settings);
                        return None;
                    }
                    _ => {}
                }
                self.theme_picker = Some(picker);
                return None;
            }

            // /settings modal captures all input while active.
            if self.settings_ui.is_some() {
                let mut settings_ui = self
                    .settings_ui
                    .take()
                    .expect("checked settings_ui is_some");
                match key.key_type {
                    KeyType::Up => {
                        settings_ui.select_prev();
                        self.settings_ui = Some(settings_ui);
                        return None;
                    }
                    KeyType::Down => {
                        settings_ui.select_next();
                        self.settings_ui = Some(settings_ui);
                        return None;
                    }
                    KeyType::Runes if key.runes == ['k'] => {
                        settings_ui.select_prev();
                        self.settings_ui = Some(settings_ui);
                        return None;
                    }
                    KeyType::Runes if key.runes == ['j'] => {
                        settings_ui.select_next();
                        self.settings_ui = Some(settings_ui);
                        return None;
                    }
                    KeyType::Enter => {
                        if let Some(selected) = settings_ui.selected_entry() {
                            match selected {
                                SettingsUiEntry::Summary => {
                                    self.messages.push(ConversationMessage {
                                        role: MessageRole::System,
                                        content: self.format_settings_summary(),
                                        thinking: None,
                                        collapsed: false,
                                    });
                                    self.scroll_to_bottom();
                                    self.status_message =
                                        Some("Selected setting: Summary".to_string());
                                }
                                _ => {
                                    self.toggle_settings_entry(selected);
                                }
                            }
                        }
                        self.settings_ui = None;
                        return None;
                    }
                    KeyType::Esc => {
                        self.settings_ui = None;
                        self.status_message = Some("Settings cancelled".to_string());
                        return None;
                    }
                    KeyType::Runes if key.runes == ['q'] => {
                        self.settings_ui = None;
                        self.status_message = Some("Settings cancelled".to_string());
                        return None;
                    }
                    _ => {
                        self.settings_ui = Some(settings_ui);
                        return None;
                    }
                }
            }

            if self.provider_setup.is_some() {
                let mut overlay = self
                    .provider_setup
                    .take()
                    .expect("checked provider_setup is_some");
                match key.key_type {
                    KeyType::Up => {
                        overlay.select_prev();
                        self.provider_setup = Some(overlay);
                        return None;
                    }
                    KeyType::Down | KeyType::Tab => {
                        overlay.select_next();
                        self.provider_setup = Some(overlay);
                        return None;
                    }
                    KeyType::Runes if key.runes == ['k'] => {
                        overlay.select_prev();
                        self.provider_setup = Some(overlay);
                        return None;
                    }
                    KeyType::Runes if key.runes == ['j'] => {
                        overlay.select_next();
                        self.provider_setup = Some(overlay);
                        return None;
                    }
                    KeyType::Backspace | KeyType::CtrlH => {
                        overlay.pop_char();
                        self.provider_setup = Some(overlay);
                        return None;
                    }
                    KeyType::CtrlU => {
                        overlay.clear_active_field();
                        self.provider_setup = Some(overlay);
                        return None;
                    }
                    KeyType::CtrlS => match self.apply_provider_setup(&overlay) {
                        Ok(status) => {
                            self.provider_setup = None;
                            self.status_message = Some(status);
                        }
                        Err(err) => {
                            self.status_message = Some(err);
                            self.provider_setup = Some(overlay);
                        }
                    },
                    KeyType::Enter => {
                        if overlay.selected_field() == ProviderSetupField::ApiKey {
                            match self.apply_provider_setup(&overlay) {
                                Ok(status) => {
                                    self.provider_setup = None;
                                    self.status_message = Some(status);
                                }
                                Err(err) => {
                                    self.status_message = Some(err);
                                    self.provider_setup = Some(overlay);
                                }
                            }
                        } else {
                            overlay.select_next();
                            self.provider_setup = Some(overlay);
                        }
                        return None;
                    }
                    KeyType::Esc => {
                        self.provider_setup = None;
                        self.status_message = Some("Provider setup cancelled".to_string());
                        return None;
                    }
                    KeyType::Runes if key.runes == ['q'] => {
                        self.provider_setup = None;
                        self.status_message = Some("Provider setup cancelled".to_string());
                        return None;
                    }
                    KeyType::Runes => {
                        overlay.push_chars(key.runes.iter().copied());
                        self.provider_setup = Some(overlay);
                        return None;
                    }
                    _ => {
                        self.provider_setup = Some(overlay);
                        return None;
                    }
                }

                return None;
            }

            // Handle session picker navigation when overlay is open
            if let Some(ref mut picker) = self.session_picker {
                // If in delete confirmation mode, handle y/n/Esc/Enter
                if picker.confirm_delete {
                    match key.key_type {
                        KeyType::Runes if key.runes == ['y'] || key.runes == ['Y'] => {
                            picker.confirm_delete = false;
                            match picker.delete_selected() {
                                Ok(()) => {
                                    if picker.all_sessions.is_empty() {
                                        self.session_picker = None;
                                        self.status_message =
                                            Some("No sessions found for this project".to_string());
                                    } else if picker.sessions.is_empty() {
                                        picker.status_message =
                                            Some("No sessions match current filter.".to_string());
                                    } else {
                                        picker.status_message =
                                            Some("Session deleted.".to_string());
                                    }
                                }
                                Err(err) => {
                                    picker.status_message = Some(err.to_string());
                                }
                            }
                            return None;
                        }
                        KeyType::Runes if key.runes == ['n'] || key.runes == ['N'] => {
                            // Cancel delete
                            picker.confirm_delete = false;
                            picker.status_message = None;
                            return None;
                        }
                        KeyType::Esc => {
                            // Cancel delete
                            picker.confirm_delete = false;
                            picker.status_message = None;
                            return None;
                        }
                        _ => {
                            // Ignore other keys in confirmation mode
                            return None;
                        }
                    }
                }

                // Normal picker mode
                match key.key_type {
                    KeyType::Up => {
                        picker.select_prev();
                        return None;
                    }
                    KeyType::Down => {
                        picker.select_next();
                        return None;
                    }
                    KeyType::Runes if key.runes == ['k'] && !picker.has_query() => {
                        picker.select_prev();
                        return None;
                    }
                    KeyType::Runes if key.runes == ['j'] && !picker.has_query() => {
                        picker.select_next();
                        return None;
                    }
                    KeyType::Backspace => {
                        picker.pop_char();
                        return None;
                    }
                    KeyType::Enter => {
                        // Load the selected session
                        if let Some(session_meta) = picker.selected_session().cloned() {
                            self.session_picker = None;
                            return self.load_session_from_path(&session_meta.path);
                        }
                        return None;
                    }
                    KeyType::CtrlD => {
                        picker.confirm_delete = true;
                        picker.status_message =
                            Some("Delete session? Press y/n to confirm.".to_string());
                        return None;
                    }
                    KeyType::Esc => {
                        self.session_picker = None;
                        return None;
                    }
                    KeyType::Runes if key.runes == ['q'] && !picker.has_query() => {
                        self.session_picker = None;
                        return None;
                    }
                    KeyType::Runes => {
                        picker.push_chars(key.runes.iter().copied());
                        return None;
                    }
                    _ => {
                        // Ignore other keys while picker is open
                        return None;
                    }
                }
            }

            // Handle autocomplete navigation when dropdown is open.
            //
            // IMPORTANT: Enter submits the current editor contents; Tab accepts autocomplete.
            if self.autocomplete.open {
                match key.key_type {
                    KeyType::Up => {
                        self.autocomplete.select_prev();
                        return None;
                    }
                    KeyType::Down => {
                        self.autocomplete.select_next();
                        return None;
                    }
                    KeyType::Tab => {
                        // If nothing is selected yet, select the first item
                        // so Tab always accepts something when the popup is open.
                        if self.autocomplete.selected.is_none() {
                            self.autocomplete.select_next();
                        }
                        // Accept the selected item
                        if let Some(item) = self.autocomplete.selected_item().cloned() {
                            self.accept_autocomplete(&item);
                        }
                        self.autocomplete.close();
                        return None;
                    }
                    KeyType::Enter => {
                        // Close autocomplete and allow Enter to submit.
                        self.autocomplete.close();
                    }
                    KeyType::Esc => {
                        self.autocomplete.close();
                        return None;
                    }
                    _ => {
                        // Close autocomplete on other keys, then process normally
                        self.autocomplete.close();
                    }
                }
            }

            // Handle bracketed paste (drag/drop paths, etc.) before keybindings.
            if key.paste && self.handle_paste_event(key) {
                return None;
            }

            // Convert KeyMsg to KeyBinding and resolve action
            if let Some(binding) = KeyBinding::from_bubbletea_key(key) {
                let candidates = self.keybindings.matching_actions(&binding);
                if let Some(action) = self.resolve_action(&candidates) {
                    // Dispatch action based on current state
                    if let Some(cmd) = self.handle_action(action, key) {
                        return Some(cmd);
                    }
                    // Action was handled but returned None (no command needed)
                    // Check if we should suppress forwarding to text area
                    if self.should_consume_action(action) {
                        return None;
                    }
                }

                // Extension shortcuts: check if unhandled key matches an extension shortcut
                if matches!(self.agent_state, AgentState::Idle) {
                    let key_id = binding.to_string().to_lowercase();
                    if let Some(manager) = &self.extensions {
                        if manager.has_shortcut(&key_id) {
                            return self.dispatch_extension_shortcut(&key_id);
                        }
                    }
                }
            }

            // Handle raw keys that don't map to actions but need special behavior
            // (e.g., text input handled by TextArea)
        }

        // Forward to appropriate component based on state
        if matches!(self.agent_state, AgentState::Idle) {
            let old_height = self.input.height();

            if let Some(key) = msg.downcast_ref::<KeyMsg>() {
                if key.key_type == KeyType::Space {
                    let mut key = key.clone();
                    key.key_type = KeyType::Runes;
                    key.runes = vec![' '];

                    let result = BubbleteaModel::update(&mut self.input, Message::new(key));

                    if self.input.height() != old_height {
                        self.refresh_conversation_viewport(self.follow_stream_tail);
                    }

                    self.maybe_trigger_autocomplete();
                    return result;
                }
            }
            let result = BubbleteaModel::update(&mut self.input, msg);

            if self.input.height() != old_height {
                self.refresh_conversation_viewport(self.follow_stream_tail);
            }

            // After text area update, check if we should trigger autocomplete
            self.maybe_trigger_autocomplete();

            result
        } else {
            // While processing, forward to spinner
            self.spinner.update(msg)
        }
    }
}

#[cfg(test)]
mod tests;
