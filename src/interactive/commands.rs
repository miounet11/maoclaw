use super::*;

use crate::models::{ModelEntry, model_requires_configured_credential, normalize_api_key_opt};
use crate::provider_metadata::{provider_ids_match, split_provider_model_spec};

#[cfg(feature = "clipboard")]
use arboard::Clipboard as ArboardClipboard;

/// Available slash commands.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SlashCommand {
    Help,
    Setup,
    Login,
    Logout,
    Clear,
    Model,
    Thinking,
    ScopedModels,
    Exit,
    History,
    Export,
    Session,
    Settings,
    Theme,
    Resume,
    New,
    Copy,
    Name,
    Hotkeys,
    Changelog,
    Tree,
    Fork,
    Compact,
    Reload,
    Share,
    // ── V2 ────────────────────────────────────────────────────────────────
    /// List and switch work systems.
    Systems,
    /// System Vault: save/restore/clone/compare snapshots.
    Vault,
    /// Show current system's team agents.
    Agents,
    /// Show and open result artifacts.
    Artifacts,
    /// Start a structured task intake for the active system.
    Task,
    /// Manage conversation-entry bindings (Telegram, QQ, Feishu).
    Bindings,
    /// Review and control V2 memory partitions.
    Memory,
    /// List and manage automations for the active system.
    Automations,
    /// Local bridge settings (link to web control plane).
    Bridge,
}

impl SlashCommand {
    /// Parse a slash command from input.
    pub fn parse(input: &str) -> Option<(Self, &str)> {
        let input = input.trim();
        if !input.starts_with('/') {
            return None;
        }

        let (cmd, args) = input.split_once(char::is_whitespace).unwrap_or((input, ""));

        let command = match cmd.to_lowercase().as_str() {
            "/help" | "/h" | "/?" => Self::Help,
            "/setup" | "/provider" => Self::Setup,
            "/login" => Self::Login,
            "/logout" => Self::Logout,
            "/clear" | "/cls" => Self::Clear,
            "/model" | "/m" => Self::Model,
            "/thinking" | "/think" | "/t" => Self::Thinking,
            "/scoped-models" | "/scoped" => Self::ScopedModels,
            "/exit" | "/quit" | "/q" => Self::Exit,
            "/history" | "/hist" => Self::History,
            "/export" => Self::Export,
            "/session" | "/info" => Self::Session,
            "/settings" => Self::Settings,
            "/theme" => Self::Theme,
            "/resume" | "/r" => Self::Resume,
            "/new" => Self::New,
            "/copy" | "/cp" => Self::Copy,
            "/name" => Self::Name,
            "/hotkeys" | "/keys" | "/keybindings" => Self::Hotkeys,
            "/changelog" => Self::Changelog,
            "/tree" => Self::Tree,
            "/fork" => Self::Fork,
            "/compact" => Self::Compact,
            "/reload" => Self::Reload,
            "/share" => Self::Share,
            // V2 commands
            "/systems" | "/sys" => Self::Systems,
            "/vault" | "/v" => Self::Vault,
            "/agents" => Self::Agents,
            "/artifacts" | "/art" | "/results" => Self::Artifacts,
            "/task" => Self::Task,
            "/bindings" | "/bind" => Self::Bindings,
            "/memory" | "/mem" => Self::Memory,
            "/automations" | "/auto" => Self::Automations,
            "/bridge" => Self::Bridge,
            _ => return None,
        };

        Some((command, args.trim()))
    }

    /// Get help text for all commands.
    pub const fn help_text() -> &'static str {
        r"Available commands:
  /help, /h, /?      - Show this help message
  /setup [provider]  - Open provider setup panel for provider/model/API URL/API key
  /login [provider]  - Login/setup credentials; without provider shows status table
  /logout [provider] - Remove stored credentials
  /clear, /cls       - Clear conversation history
  /model, /m [id|provider/id] - Open model selector or switch directly
  /thinking, /t [level] - Set thinking level (off/minimal/low/medium/high/xhigh)
  /scoped-models [patterns|clear] - Show or set scoped models for cycling
  /history, /hist    - Show input history
  /export [path]     - Export conversation to HTML
  /session, /info    - Show session info (path, tokens, cost)
  /settings          - Open settings selector
  /theme [name]      - List or switch themes (dark/light/custom)
  /resume, /r        - Pick and resume a previous session
  /new               - Start a new session
  /copy, /cp         - Copy last assistant message to clipboard
  /name <name>       - Set session display name
  /hotkeys, /keys    - Show keyboard shortcuts
  /changelog         - Show changelog entries
  /tree              - Show session branch tree summary
  /fork [id|index]   - Fork from a user message (default: last on current path)
  /compact [notes]   - Compact older context with optional instructions
  /reload            - Reload skills/prompts/themes, refresh model catalog, and hot-reload JS/native extensions
  /share             - Upload session HTML to a secret GitHub gist and show URL
  /exit, /quit, /q   - Exit Pi

  Work systems (V2):
  /systems, /sys     - List work systems; /sys <id> to switch active
  /vault, /v [save|list|restore|clone|compare]  - Vault snapshot operations
  /artifacts, /art [<id> [export]]  - Browse result artifacts; detail/export by id
  /task [goal]       - Start a structured task intake
  /memory, /mem      - Show V2 memory partitions for active system
  /automations, /auto - List automations for active system
  /agents            - List team agents for active system
  /bindings, /bind   - Show channel binding status (Telegram, QQ, Feishu)
  /bridge            - Bridge and web control plane settings

  Tips:
    • Use ↑/↓ arrows to navigate input history
    • Use Ctrl+L to open model selector
    • Use Ctrl+P to cycle scoped models
    • Use Shift+Enter (Ctrl+Enter on Windows) to insert a newline
    • Use PageUp/PageDown to scroll conversation history
    • Use Escape to cancel current input
    • Use /skill:name or /template to expand resources"
    }
}

pub(super) fn parse_extension_command(input: &str) -> Option<(String, Vec<String>)> {
    let input = input.trim();
    if !input.starts_with('/') {
        return None;
    }

    // Built-in slash commands are handled elsewhere.
    if SlashCommand::parse(input).is_some() {
        return None;
    }

    let (cmd, rest) = input.split_once(char::is_whitespace).unwrap_or((input, ""));
    let cmd = cmd.trim_start_matches('/').trim();
    if cmd.is_empty() {
        return None;
    }
    let args = rest
        .split_whitespace()
        .map(std::string::ToString::to_string)
        .collect();
    Some((cmd.to_string(), args))
}

pub(super) fn parse_bash_command(input: &str) -> Option<(String, bool)> {
    let trimmed = input.trim_start();
    let (rest, force) = trimmed
        .strip_prefix("!!")
        .map(|r| (r, true))
        .or_else(|| trimmed.strip_prefix('!').map(|r| (r, false)))?;
    let command = rest.trim();
    if command.is_empty() {
        return None;
    }
    Some((command.to_string(), force))
}

pub(super) fn normalize_api_key_input(raw: &str) -> std::result::Result<String, String> {
    let key = raw.trim();
    if key.is_empty() {
        return Err("API key cannot be empty".to_string());
    }
    if key.chars().any(char::is_whitespace) {
        return Err("API key must not contain whitespace".to_string());
    }
    Ok(key.to_string())
}

pub(super) fn normalize_auth_provider_input(raw: &str) -> String {
    let provider = raw.trim().to_ascii_lowercase();
    crate::provider_metadata::canonical_provider_id(&provider)
        .unwrap_or(provider.as_str())
        .to_string()
}

pub(super) fn api_key_login_prompt(provider: &str) -> Option<&'static str> {
    match provider {
        "openai" => Some(
            "API key login: openai\n\n\
Paste your OpenAI API key to save it in auth.json.\n\
Get a key from platform.openai.com/api-keys.\n\
Rotate/revoke keys from that dashboard if compromised.\n\n\
Your input will be treated as sensitive and is not added to message history.",
        ),
        "google" => Some(
            "API key login: google/gemini\n\n\
Paste your Google Gemini API key to save it in auth.json under google.\n\
Get a key from ai.google.dev/gemini-api/docs/api-key.\n\
Rotate/revoke keys from Google AI Studio if compromised.\n\n\
Your input will be treated as sensitive and is not added to message history.",
        ),
        _ => None,
    }
}

pub(super) fn save_provider_credential(
    auth: &mut crate::auth::AuthStorage,
    provider: &str,
    credential: crate::auth::AuthCredential,
) {
    let requested = provider.trim().to_ascii_lowercase();
    let canonical = normalize_auth_provider_input(&requested);
    let _ = auth.remove_provider_aliases(&requested);
    if requested != canonical {
        let _ = auth.remove_provider_aliases(&canonical);
    }
    auth.set(canonical.clone(), credential);
}

pub(super) fn remove_provider_credentials(
    auth: &mut crate::auth::AuthStorage,
    requested_provider: &str,
) -> bool {
    let requested = requested_provider.trim().to_ascii_lowercase();
    let canonical = normalize_auth_provider_input(&requested);

    let mut removed = auth.remove_provider_aliases(&canonical);
    if requested != canonical {
        removed |= auth.remove_provider_aliases(&requested);
    }
    removed
}

const BUILTIN_LOGIN_PROVIDERS: [(&str, &str); 9] = [
    ("anthropic", "OAuth"),
    ("openai-codex", "OAuth"),
    ("google-gemini-cli", "OAuth"),
    ("google-antigravity", "OAuth"),
    ("kimi-for-coding", "OAuth"),
    ("github-copilot", "OAuth"),
    ("gitlab", "OAuth"),
    ("openai", "API key"),
    ("google", "API key"),
];

const STARTUP_PRIORITY_OAUTH_PROVIDERS: [(&str, &str); 3] = [
    ("anthropic", "Claude Code"),
    ("openai-codex", "Codex"),
    ("google-gemini-cli", "Gemini CLI"),
];

fn format_compact_duration(ms: i64) -> String {
    let seconds = (ms.max(0) / 1000).max(1);
    if seconds < 60 {
        format!("{seconds}s")
    } else if seconds < 60 * 60 {
        format!("{}m", seconds / 60)
    } else if seconds < 24 * 60 * 60 {
        format!("{}h", seconds / (60 * 60))
    } else {
        format!("{}d", seconds / (24 * 60 * 60))
    }
}

fn format_credential_status(status: &crate::auth::CredentialStatus) -> String {
    match status {
        crate::auth::CredentialStatus::Missing => "Not authenticated".to_string(),
        crate::auth::CredentialStatus::ApiKey
        | crate::auth::CredentialStatus::BearerToken
        | crate::auth::CredentialStatus::AwsCredentials
        | crate::auth::CredentialStatus::ServiceKey => "Authenticated".to_string(),
        crate::auth::CredentialStatus::OAuthValid { expires_in_ms } => {
            format!(
                "Authenticated (expires in {})",
                format_compact_duration(*expires_in_ms)
            )
        }
        crate::auth::CredentialStatus::OAuthExpired { expired_by_ms } => {
            format!(
                "Authenticated (expired {} ago)",
                format_compact_duration(*expired_by_ms)
            )
        }
    }
}

fn format_provider_status(auth: &crate::auth::AuthStorage, provider: &str) -> String {
    if let Some(source) = auth.external_setup_source(provider)
        && !auth.has_stored_credential(provider)
    {
        return format!("Auto-detected from {source}");
    }

    let status = auth.credential_status(provider);
    format_credential_status(&status)
}

fn extension_login_model_entries(extensions: Option<&ExtensionManager>) -> Vec<ModelEntry> {
    extensions.map_or_else(Vec::new, ExtensionManager::extension_model_entries)
}

fn collect_extension_oauth_providers(extension_models: &[ModelEntry]) -> Vec<String> {
    let mut providers: Vec<String> = extension_models
        .iter()
        .filter(|entry| entry.oauth_config.is_some())
        .map(|entry| {
            let provider = entry.model.provider.as_str();
            crate::provider_metadata::canonical_provider_id(provider)
                .unwrap_or(provider)
                .to_string()
        })
        .collect();

    providers.retain(|provider| {
        !BUILTIN_LOGIN_PROVIDERS
            .iter()
            .any(|(builtin, _)| provider == builtin)
    });
    providers.sort_unstable();
    providers.dedup();
    providers
}

fn extension_oauth_config_for_provider(
    extension_models: &[ModelEntry],
    provider: &str,
) -> Option<crate::models::OAuthConfig> {
    extension_models.iter().find_map(|entry| {
        let model_provider = entry.model.provider.as_str();
        let canonical = crate::provider_metadata::canonical_provider_id(model_provider)
            .unwrap_or(model_provider);
        if canonical.eq_ignore_ascii_case(provider) {
            entry.oauth_config.clone()
        } else {
            None
        }
    })
}

fn append_provider_rows(output: &mut String, heading: &str, rows: &[(String, String, String)]) {
    let provider_width = rows
        .iter()
        .map(|(provider, _, _)| provider.len())
        .max()
        .unwrap_or("provider".len())
        .max("provider".len());
    let method_width = rows
        .iter()
        .map(|(_, method, _)| method.len())
        .max()
        .unwrap_or("method".len())
        .max("method".len());

    let _ = writeln!(output, "{heading}:");
    let _ = writeln!(
        output,
        "  {:<provider_width$}  {:<method_width$}  status",
        "provider", "method"
    );
    for (provider, method, status) in rows {
        let _ = writeln!(
            output,
            "  {provider:<provider_width$}  {method:<method_width$}  {status}"
        );
    }
}

pub(super) fn format_login_provider_listing(
    auth: &crate::auth::AuthStorage,
    extension_models: &[ModelEntry],
) -> String {
    let mut output = String::from("Available login providers:\n\n");

    let built_in_rows: Vec<(String, String, String)> = BUILTIN_LOGIN_PROVIDERS
        .iter()
        .map(|(provider, method)| {
            (
                (*provider).to_string(),
                (*method).to_string(),
                format_provider_status(auth, provider),
            )
        })
        .collect();
    append_provider_rows(&mut output, "Built-in", &built_in_rows);

    let extension_providers = collect_extension_oauth_providers(extension_models);
    if !extension_providers.is_empty() {
        let extension_rows: Vec<(String, String, String)> = extension_providers
            .iter()
            .map(|provider| {
                (
                    provider.clone(),
                    "OAuth".to_string(),
                    format_provider_status(auth, provider),
                )
            })
            .collect();
        output.push('\n');
        append_provider_rows(&mut output, "Extension providers", &extension_rows);
    }

    output.push_str("\nUsage: /login <provider>");
    output
}

pub(super) fn format_startup_oauth_hint(auth: &crate::auth::AuthStorage) -> String {
    let mut output = String::new();
    output.push_str("  No provider credentials were detected.\n");
    output.push_str("  Connect one of these providers:\n");
    for (provider, label) in STARTUP_PRIORITY_OAUTH_PROVIDERS {
        let status = format_provider_status(auth, provider);
        let _ = writeln!(output, "  - {provider} ({label}): {status}");
    }
    output.push_str("  Use /login <provider> to connect or refresh credentials.\n");
    output.push_str("  Use /login to see all providers and auth methods.");
    output
}

pub(super) fn should_show_startup_oauth_hint(auth: &crate::auth::AuthStorage) -> bool {
    if !auth.provider_names().is_empty() {
        return false;
    }

    let has_any_credential = crate::provider_metadata::PROVIDER_METADATA
        .iter()
        .map(|meta| meta.canonical_id)
        .any(|provider| {
            auth.has_stored_credential(provider)
                || auth.external_setup_source(provider).is_some()
                || auth.resolve_api_key(provider, None).is_some()
        });
    if has_any_credential {
        return false;
    }

    STARTUP_PRIORITY_OAUTH_PROVIDERS
        .iter()
        .all(|(provider, _)| {
            auth.resolve_api_key(provider, None).is_none()
                && !auth.has_stored_credential(provider)
                && auth.external_setup_source(provider).is_none()
        })
}

pub fn strip_thinking_level_suffix(pattern: &str) -> &str {
    let Some((prefix, suffix)) = pattern.rsplit_once(':') else {
        return pattern;
    };
    match suffix.to_ascii_lowercase().as_str() {
        "off" | "minimal" | "low" | "medium" | "high" | "xhigh" => prefix,
        _ => pattern,
    }
}

pub fn parse_scoped_model_patterns(args: &str) -> Vec<String> {
    args.split(|c: char| c == ',' || c.is_whitespace())
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(ToString::to_string)
        .collect()
}

pub fn model_entry_matches(left: &ModelEntry, right: &ModelEntry) -> bool {
    let left_provider = crate::provider_metadata::canonical_provider_id(&left.model.provider)
        .unwrap_or(&left.model.provider);
    let right_provider = crate::provider_metadata::canonical_provider_id(&right.model.provider)
        .unwrap_or(&right.model.provider);

    left_provider.eq_ignore_ascii_case(right_provider)
        && left.model.id.eq_ignore_ascii_case(&right.model.id)
}

pub(super) fn resolve_model_key_with_auth(
    auth: &crate::auth::AuthStorage,
    entry: &ModelEntry,
) -> Option<String> {
    normalize_api_key_opt(auth.resolve_api_key(&entry.model.provider, None))
        .or_else(|| normalize_api_key_opt(entry.api_key.clone()))
}

pub(super) fn resolve_model_key_from_default_auth(entry: &ModelEntry) -> Option<String> {
    let auth_path = crate::config::Config::auth_path();
    crate::auth::AuthStorage::load(auth_path)
        .ok()
        .and_then(|auth| resolve_model_key_with_auth(&auth, entry))
        .or_else(|| normalize_api_key_opt(entry.api_key.clone()))
}

fn session_thinking_level(
    session: &crate::session::Session,
) -> Option<crate::model::ThinkingLevel> {
    session
        .header
        .thinking_level
        .as_deref()
        .and_then(|value| value.parse::<crate::model::ThinkingLevel>().ok())
}

pub fn resolve_scoped_model_entries(
    patterns: &[String],
    available_models: &[ModelEntry],
) -> Result<Vec<ModelEntry>, String> {
    let mut resolved: Vec<ModelEntry> = Vec::new();

    for pattern in patterns {
        let raw_pattern = strip_thinking_level_suffix(pattern);
        let is_glob =
            raw_pattern.contains('*') || raw_pattern.contains('?') || raw_pattern.contains('[');

        if is_glob {
            let glob = Pattern::new(&raw_pattern.to_lowercase())
                .map_err(|err| format!("Invalid model pattern \"{pattern}\": {err}"))?;

            for entry in available_models {
                let full_id = format!("{}/{}", entry.model.provider, entry.model.id);
                let full_id_lower = full_id.to_lowercase();
                let id_lower = entry.model.id.to_lowercase();

                if (glob.matches(&full_id_lower) || glob.matches(&id_lower))
                    && !resolved
                        .iter()
                        .any(|existing| model_entry_matches(existing, entry))
                {
                    resolved.push(entry.clone());
                }
            }
            continue;
        }

        for entry in available_models {
            let full_id = format!("{}/{}", entry.model.provider, entry.model.id);
            if raw_pattern.eq_ignore_ascii_case(&full_id)
                || raw_pattern.eq_ignore_ascii_case(&entry.model.id)
            {
                if !resolved
                    .iter()
                    .any(|existing| model_entry_matches(existing, entry))
                {
                    resolved.push(entry.clone());
                }
                break;
            }
        }
    }

    resolved.sort_by(|a, b| {
        let left = format!("{}/{}", a.model.provider, a.model.id);
        let right = format!("{}/{}", b.model.provider, b.model.id);
        left.cmp(&right)
    });

    Ok(resolved)
}

pub(super) const fn kind_rank(kind: &DiagnosticKind) -> u8 {
    match kind {
        DiagnosticKind::Warning => 0,
        DiagnosticKind::Collision => 1,
    }
}

pub(super) fn format_resource_diagnostics(
    label: &str,
    diagnostics: &[ResourceDiagnostic],
) -> (String, usize) {
    let mut ordered: Vec<&ResourceDiagnostic> = diagnostics.iter().collect();
    ordered.sort_by(|a, b| {
        a.path
            .cmp(&b.path)
            .then_with(|| kind_rank(&a.kind).cmp(&kind_rank(&b.kind)))
            .then_with(|| a.message.cmp(&b.message))
    });

    let mut out = String::new();
    let _ = writeln!(out, "{label}:");
    for diag in ordered {
        let kind = match diag.kind {
            DiagnosticKind::Warning => "warning",
            DiagnosticKind::Collision => "collision",
        };
        let _ = write!(out, "- {kind}: {} ({})", diag.message, diag.path.display());
        if let Some(collision) = &diag.collision {
            let _ = write!(
                out,
                " [winner: {} loser: {}]",
                collision.winner_path.display(),
                collision.loser_path.display()
            );
        }
        out.push('\n');
    }
    (out, diagnostics.len())
}

fn build_reload_diagnostics(
    models_error: Option<String>,
    resources: &ResourceLoader,
    extension_error: Option<String>,
) -> (Option<String>, usize) {
    let mut sections = Vec::new();
    let mut count = 0usize;

    if let Some(err) = models_error {
        count = count.saturating_add(1);
        sections.push(format!("models.json:\n{err}"));
    }

    let mut resource_sections = Vec::new();
    let (skills_text, skills_count) =
        format_resource_diagnostics("Skills", resources.skill_diagnostics());
    if skills_count > 0 {
        resource_sections.push(skills_text);
        count = count.saturating_add(skills_count);
    }

    let (prompts_text, prompts_count) =
        format_resource_diagnostics("Prompts", resources.prompt_diagnostics());
    if prompts_count > 0 {
        resource_sections.push(prompts_text);
        count = count.saturating_add(prompts_count);
    }

    let (themes_text, themes_count) =
        format_resource_diagnostics("Themes", resources.theme_diagnostics());
    if themes_count > 0 {
        resource_sections.push(themes_text);
        count = count.saturating_add(themes_count);
    }

    if !resource_sections.is_empty() {
        sections.push(format!(
            "Resource diagnostics:\n{}",
            resource_sections.join("\n")
        ));
    }

    if let Some(err) = extension_error {
        count = count.saturating_add(1);
        sections.push(format!("Extensions:\n{err}"));
    }

    if sections.is_empty() {
        (None, 0)
    } else {
        (
            Some(format!("Reload diagnostics:\n\n{}", sections.join("\n\n"))),
            count,
        )
    }
}

struct LiveExtensionReloadSpecs {
    js: Vec<crate::extensions::JsExtensionLoadSpec>,
    native: Vec<crate::extensions::NativeRustExtensionLoadSpec>,
}

impl LiveExtensionReloadSpecs {
    fn target_runtime(&self) -> Option<&'static str> {
        if !self.js.is_empty() {
            Some("quickjs")
        } else if !self.native.is_empty() {
            Some("native-rust")
        } else {
            None
        }
    }
}

fn collect_live_extension_reload_specs(
    resources: &ResourceLoader,
) -> Result<LiveExtensionReloadSpecs, String> {
    let mut js = Vec::new();
    let mut native = Vec::new();
    #[cfg(feature = "wasm-host")]
    let mut saw_wasm_specs = false;

    for entry in resources.extensions() {
        match crate::extensions::resolve_extension_load_spec(entry) {
            Ok(crate::extensions::ExtensionLoadSpec::Js(spec)) => js.push(spec),
            Ok(crate::extensions::ExtensionLoadSpec::NativeRust(spec)) => native.push(spec),
            #[cfg(feature = "wasm-host")]
            Ok(crate::extensions::ExtensionLoadSpec::Wasm(_)) => {
                saw_wasm_specs = true;
            }
            Err(err) => {
                return Err(format!(
                    "Failed to resolve extension entry {}: {err}",
                    entry.display()
                ));
            }
        }
    }

    if !js.is_empty() && !native.is_empty() {
        return Err(
            "Mixed extension runtimes are not supported in one live reload. Restart or start a new session after choosing either JS/TS or native-rust extensions."
                .to_string(),
        );
    }

    #[cfg(feature = "wasm-host")]
    if saw_wasm_specs {
        return Err(
            "Interactive /reload does not hot-reload WASM extensions yet; restart or start a new session to apply WASM extension code changes."
                .to_string(),
        );
    }

    Ok(LiveExtensionReloadSpecs { js, native })
}

fn validate_live_extension_runtime(
    current_runtime: &str,
    specs: &LiveExtensionReloadSpecs,
) -> Result<(), String> {
    if let Some(target_runtime) = specs.target_runtime()
        && current_runtime != target_runtime
    {
        return Err(format!(
            "Interactive /reload cannot switch the live extension runtime from {current_runtime} to {target_runtime}; restart or start a new session to apply runtime-kind changes."
        ));
    }

    Ok(())
}

async fn load_live_extension_registrations(
    manager: &ExtensionManager,
    current_runtime: &str,
    specs: LiveExtensionReloadSpecs,
) -> Result<(), String> {
    let load_result = if !specs.js.is_empty() {
        manager.load_js_extensions(specs.js).await
    } else if !specs.native.is_empty() {
        manager.load_native_extensions(specs.native).await
    } else {
        match current_runtime {
            "quickjs" => manager.load_js_extensions(Vec::new()).await,
            "native-rust" => manager.load_native_extensions(Vec::new()).await,
            other => {
                return Err(format!(
                    "Interactive /reload does not support the live extension runtime '{other}'."
                ));
            }
        }
    };

    load_result.map_err(|err| format!("Extension reload failed: {err}"))
}

async fn current_session_file(session: &Arc<Mutex<Session>>) -> Result<Option<String>, String> {
    let cx = Cx::for_request();
    session
        .lock(&cx)
        .await
        .map_err(|err| format!("reading the current session failed: {err}"))
        .map(|guard| guard.path.as_ref().map(|path| path.display().to_string()))
}

async fn replace_live_extension_tools(
    manager: &ExtensionManager,
    agent: &Arc<Mutex<Agent>>,
    cwd: &Path,
) -> Result<(), String> {
    let wrappers = crate::extension_tools::collect_extension_tool_wrappers(
        manager,
        json!({ "cwd": cwd.display().to_string() }),
    )
    .await
    .map_err(|err| format!("rebuilding live tools failed: {err}"))?;

    let cx = Cx::for_request();
    agent
        .lock(&cx)
        .await
        .map_err(|err| format!("updating the live agent toolset failed: {err}"))?
        .replace_extension_tools(wrappers);
    Ok(())
}

async fn reload_live_extensions(
    manager: &ExtensionManager,
    agent: &Arc<Mutex<Agent>>,
    session: &Arc<Mutex<Session>>,
    cwd: &Path,
    resources: &ResourceLoader,
) -> (Option<String>, Option<String>) {
    let Some(runtime) = manager.runtime() else {
        return (
            None,
            Some("Live extension manager is present but no runtime is configured".to_string()),
        );
    };

    let specs = match collect_live_extension_reload_specs(resources) {
        Ok(specs) => specs,
        Err(err) => return (None, Some(err)),
    };
    let current_runtime = runtime.runtime_name();
    if let Err(err) = validate_live_extension_runtime(current_runtime, &specs) {
        return (None, Some(err));
    }
    if let Err(err) = load_live_extension_registrations(manager, current_runtime, specs).await {
        return (None, Some(err));
    }

    let session_path = match current_session_file(session).await {
        Ok(path) => path,
        Err(err) => {
            return (None, Some(format!("Extension reload succeeded, but {err}")));
        }
    };

    let startup_hook_error = manager
        .dispatch_event(
            ExtensionEventName::Startup,
            Some(json!({
                "version": env!("CARGO_PKG_VERSION"),
                "sessionFile": session_path,
            })),
        )
        .await
        .err()
        .map(|err| {
            tracing::warn!("startup extension hook failed after reload (fail-open): {err}");
            format!("Extension startup hook failed after reload: {err}")
        });

    if let Err(err) = replace_live_extension_tools(manager, agent, cwd).await {
        return (
            None,
            Some(format!("Extension registrations reloaded, but {err}")),
        );
    }

    let reloaded_count = resources.extensions().len();
    let extension_status = if reloaded_count == 0 {
        "cleared live extension registrations".to_string()
    } else if reloaded_count == 1 {
        "reloaded 1 live extension".to_string()
    } else {
        format!("reloaded {reloaded_count} live extensions")
    };

    (Some(extension_status), startup_hook_error)
}

impl PiApp {
    pub(super) fn sync_active_provider_credentials_from_auth(
        &mut self,
        auth: &crate::auth::AuthStorage,
        changed_provider: &str,
    ) {
        let changed_canonical = normalize_auth_provider_input(changed_provider);
        let provider_matches_changed =
            |provider: &str| normalize_auth_provider_input(provider) == changed_canonical;

        if !provider_matches_changed(&self.model_entry.model.provider) {
            return;
        }

        // Keep catalog/model-scope entries immutable here so inline model keys
        // are never overwritten by transient auth state. We only refresh the
        // active runtime key.
        let fallback_inline_key = self
            .available_models
            .iter()
            .find(|entry| model_entry_matches(entry, &self.model_entry))
            .and_then(|entry| normalize_api_key_opt(entry.api_key.clone()))
            .or_else(|| normalize_api_key_opt(self.model_entry.api_key.clone()));

        let resolved_key_opt =
            normalize_api_key_opt(auth.resolve_api_key(&changed_canonical, None))
                .or(fallback_inline_key);

        if let Ok(mut agent_guard) = self.agent.try_lock() {
            agent_guard
                .stream_options_mut()
                .api_key
                .clone_from(&resolved_key_opt);
        }

        self.model_entry.api_key.clone_from(&resolved_key_opt);
        if let Ok(mut shared_entry) = self.model_entry_shared.lock() {
            shared_entry.api_key.clone_from(&resolved_key_opt);
        }
    }

    pub(super) fn refresh_provider_auth_state_from_auth(
        &mut self,
        auth: &crate::auth::AuthStorage,
        changed_provider: &str,
    ) -> Option<String> {
        // Update the live runtime first so any ad-hoc current model that gets
        // reinserted into the catalog reflects the latest credential state.
        self.sync_active_provider_credentials_from_auth(auth, changed_provider);
        self.refresh_available_models_from_auth(auth)
    }

    pub(super) fn refresh_provider_auth_state(
        &mut self,
        changed_provider: &str,
    ) -> Result<Option<String>, String> {
        let auth = crate::auth::AuthStorage::load(crate::config::Config::auth_path())
            .map_err(|err| err.to_string())?;
        Ok(self.refresh_provider_auth_state_from_auth(&auth, changed_provider))
    }

    pub(super) fn sync_active_provider_credentials(&mut self, changed_provider: &str) {
        let auth = match crate::auth::AuthStorage::load(crate::config::Config::auth_path()) {
            Ok(auth) => auth,
            Err(err) => {
                tracing::warn!(
                    event = "pi.auth.sync_credentials.load_failed",
                    provider = %normalize_auth_provider_input(changed_provider),
                    error = %err,
                    "Skipping in-memory credential sync because auth storage could not be loaded"
                );
                return;
            }
        };
        self.sync_active_provider_credentials_from_auth(&auth, changed_provider);
    }

    pub(super) fn switch_active_model(
        &mut self,
        next: &ModelEntry,
        provider_impl: std::sync::Arc<dyn crate::provider::Provider>,
        resolved_key_opt: Option<&str>,
    ) -> Result<(), String> {
        let Ok(mut agent_guard) = self.agent.try_lock() else {
            return Err("Agent busy; try again".to_string());
        };
        let Ok(mut session_guard) = self.session.try_lock() else {
            return Err("Session busy; try again".to_string());
        };

        let current_thinking = agent_guard
            .stream_options()
            .thinking_level
            .unwrap_or_default();
        let next_thinking = next.clamp_thinking_level(current_thinking);
        let previous_thinking = session_thinking_level(&session_guard);
        let model_changed = session_guard.header.provider.as_deref()
            != Some(next.model.provider.as_str())
            || session_guard.header.model_id.as_deref() != Some(next.model.id.as_str());
        let thinking_changed = previous_thinking != Some(next_thinking);

        agent_guard.set_provider(provider_impl);
        let stream_options = agent_guard.stream_options_mut();
        stream_options.api_key = resolved_key_opt.map(str::to_string);
        stream_options.headers.clone_from(&next.headers);
        stream_options.thinking_level = Some(next_thinking);

        session_guard.header.provider = Some(next.model.provider.clone());
        session_guard.header.model_id = Some(next.model.id.clone());
        if model_changed {
            session_guard.append_model_change(next.model.provider.clone(), next.model.id.clone());
        }
        session_guard.header.thinking_level = Some(next_thinking.to_string());
        if thinking_changed {
            session_guard.append_thinking_level_change(next_thinking.to_string());
        }

        drop(session_guard);
        drop(agent_guard);
        if model_changed || thinking_changed {
            self.spawn_save_session();
        }

        self.model_entry = next.clone();
        if let Ok(mut guard) = self.model_entry_shared.lock() {
            *guard = next.clone();
        }
        self.model = format!("{}/{}", next.model.provider, next.model.id);
        Ok(())
    }

    #[allow(clippy::too_many_lines)]
    pub(super) fn submit_oauth_code(
        &mut self,
        code_input: &str,
        pending: PendingOAuth,
    ) -> Option<Cmd> {
        // Do not store OAuth codes in history or session.
        self.input.reset();
        self.input_mode = InputMode::SingleLine;
        self.set_input_height(3);

        self.agent_state = AgentState::Processing;
        self.scroll_to_bottom();

        let event_tx = self.event_tx.clone();
        let PendingOAuth {
            provider,
            kind,
            verifier,
            oauth_config,
            device_code,
        } = pending;
        let code_input = code_input.to_string();

        let runtime_handle = self.runtime_handle.clone();
        runtime_handle.spawn(async move {
            let auth_path = crate::config::Config::auth_path();
            let mut auth = match crate::auth::AuthStorage::load_async(auth_path).await {
                Ok(a) => a,
                Err(e) => {
                    let _ = send_pi_msg_with_backpressure(
                        &event_tx,
                        PiMsg::AgentError(e.to_string()),
                    )
                    .await;
                    return;
                }
            };

            let credential = match kind {
                PendingLoginKind::ApiKey => normalize_api_key_input(&code_input)
                    .map(|key| crate::auth::AuthCredential::ApiKey { key })
                    .map_err(crate::error::Error::auth),
                PendingLoginKind::OAuth => {
                    if provider == "anthropic" {
                        Box::pin(crate::auth::complete_anthropic_oauth(
                            &code_input,
                            &verifier,
                        ))
                        .await
                    } else if provider == "openai-codex" {
                        Box::pin(crate::auth::complete_openai_codex_oauth(
                            &code_input,
                            &verifier,
                        ))
                        .await
                    } else if provider == "google-gemini-cli" {
                        Box::pin(crate::auth::complete_google_gemini_cli_oauth(
                            &code_input,
                            &verifier,
                        ))
                        .await
                    } else if provider == "google-antigravity" {
                        Box::pin(crate::auth::complete_google_antigravity_oauth(
                            &code_input,
                            &verifier,
                        ))
                        .await
                    } else if provider == "github-copilot" || provider == "copilot" {
                        let client_id =
                            std::env::var("GITHUB_COPILOT_CLIENT_ID").unwrap_or_default();
                        let copilot_config = crate::auth::CopilotOAuthConfig {
                            client_id,
                            ..crate::auth::CopilotOAuthConfig::default()
                        };
                        Box::pin(crate::auth::complete_copilot_browser_oauth(
                            &copilot_config,
                            &code_input,
                            &verifier,
                        ))
                        .await
                    } else if provider == "gitlab" || provider == "gitlab-duo" {
                        let client_id = std::env::var("GITLAB_CLIENT_ID").unwrap_or_default();
                        let base_url = std::env::var("GITLAB_BASE_URL")
                            .unwrap_or_else(|_| "https://gitlab.com".to_string());
                        let gitlab_config = crate::auth::GitLabOAuthConfig {
                            client_id,
                            base_url,
                            ..crate::auth::GitLabOAuthConfig::default()
                        };
                        Box::pin(crate::auth::complete_gitlab_oauth(
                            &gitlab_config,
                            &code_input,
                            &verifier,
                        ))
                        .await
                    } else if let Some(config) = &oauth_config {
                        Box::pin(crate::auth::complete_extension_oauth(
                            config,
                            &code_input,
                            &verifier,
                        ))
                        .await
                    } else {
                        Err(crate::error::Error::auth(format!(
                            "OAuth provider not supported: {provider}"
                        )))
                    }
                }
                PendingLoginKind::DeviceFlow => match device_code {
                    Some(dc) => {
                        let poll_result = if provider == "kimi-for-coding" {
                            Box::pin(crate::auth::poll_kimi_code_device_flow(&dc)).await
                        } else {
                            let client_id =
                                std::env::var("GITHUB_COPILOT_CLIENT_ID").unwrap_or_default();
                            let copilot_config = crate::auth::CopilotOAuthConfig {
                                client_id,
                                ..crate::auth::CopilotOAuthConfig::default()
                            };
                            Box::pin(crate::auth::poll_copilot_device_flow(&copilot_config, &dc))
                                .await
                        };
                        match poll_result {
                            crate::auth::DeviceFlowPollResult::Success(cred) => Ok(cred),
                            crate::auth::DeviceFlowPollResult::Error(e) => {
                                Err(crate::error::Error::auth(e))
                            }
                            crate::auth::DeviceFlowPollResult::Expired => {
                                Err(crate::error::Error::auth(format!(
                                    "Device code expired for {provider}. Run /login {provider} again."
                                )))
                            }
                            crate::auth::DeviceFlowPollResult::AccessDenied => {
                                Err(crate::error::Error::auth(format!(
                                    "Access denied for {provider}."
                                )))
                            }
                            crate::auth::DeviceFlowPollResult::Pending => {
                                Err(crate::error::Error::auth(format!(
                                    "Authorization for {provider} is still pending. Complete the browser step and submit again."
                                )))
                            }
                            crate::auth::DeviceFlowPollResult::SlowDown => {
                                Err(crate::error::Error::auth(format!(
                                    "Authorization server asked to slow down for {provider}. Wait a few seconds and submit again."
                                )))
                            }
                        }
                    }
                    None => Err(crate::error::Error::auth(
                        "Device flow missing device_code".to_string(),
                    )),
                },
            };

            let credential = match credential {
                Ok(c) => c,
                Err(e) => {
                    let _ = send_pi_msg_with_backpressure(
                        &event_tx,
                        PiMsg::AgentError(e.to_string()),
                    )
                    .await;
                    return;
                }
            };

            save_provider_credential(&mut auth, &provider, credential);
            if let Err(e) = auth.save_async().await {
                let _ = send_pi_msg_with_backpressure(
                    &event_tx,
                    PiMsg::AgentError(e.to_string()),
                )
                .await;
                return;
            }
            let _ = send_pi_msg_with_backpressure(
                &event_tx,
                PiMsg::CredentialUpdated {
                    provider: provider.clone(),
                },
            )
            .await;

            let status = match kind {
                PendingLoginKind::ApiKey => {
                    format!("API key saved for {provider}. Credentials saved to auth.json.")
                }
                PendingLoginKind::OAuth | PendingLoginKind::DeviceFlow => {
                    format!(
                        "OAuth login successful for {provider}. Credentials saved to auth.json."
                    )
                }
            };
            let _ = send_pi_msg_with_backpressure(&event_tx, PiMsg::System(status)).await;
        });

        None
    }

    pub(super) fn submit_bash_command(
        &mut self,
        raw_message: &str,
        command: String,
        exclude_from_context: bool,
    ) -> Option<Cmd> {
        if self.bash_running {
            self.status_message = Some("A bash command is already running.".to_string());
            return None;
        }

        self.bash_running = true;
        self.agent_state = AgentState::ToolRunning;
        self.current_tool = Some("bash".to_string());
        self.history.push(raw_message.to_string());

        self.input.reset();
        self.input_mode = InputMode::SingleLine;
        self.set_input_height(3);

        let event_tx = self.event_tx.clone();
        let session = Arc::clone(&self.session);
        let save_enabled = self.save_enabled;
        let cwd = self.cwd.clone();
        let shell_path = self.config.shell_path.clone();
        let command_prefix = self.config.shell_command_prefix.clone();
        let runtime_handle = self.runtime_handle.clone();

        runtime_handle.spawn(async move {
            let cx = Cx::for_request();
            let result = crate::tools::run_bash_command(
                &cwd,
                shell_path.as_deref(),
                command_prefix.as_deref(),
                &command,
                None,
                None,
            )
            .await;

            match result {
                Ok(result) => {
                    let display =
                        bash_execution_to_text(&command, &result.output, 0, false, false, None);

                    if exclude_from_context {
                        let mut extra = HashMap::new();
                        extra.insert("excludeFromContext".to_string(), Value::Bool(true));

                        let bash_message = SessionMessage::BashExecution {
                            command: command.clone(),
                            output: result.output.clone(),
                            exit_code: result.exit_code,
                            cancelled: Some(result.cancelled),
                            truncated: Some(result.truncated),
                            full_output_path: result.full_output_path.clone(),
                            timestamp: Some(Utc::now().timestamp_millis()),
                            extra,
                        };

                        if let Ok(mut session_guard) = session.lock(&cx).await {
                            session_guard.append_message(bash_message);
                            if save_enabled {
                                let _ = session_guard.save().await;
                            }
                            drop(session_guard);
                        }

                        let mut display = display;
                        display.push_str("\n\n[Output excluded from model context]");
                        let _ = send_pi_msg_with_backpressure(
                            &event_tx,
                            PiMsg::BashResult {
                                display,
                                content_for_agent: None,
                            },
                        )
                        .await;
                    } else {
                        let content_for_agent =
                            vec![ContentBlock::Text(TextContent::new(display.clone()))];
                        let _ = send_pi_msg_with_backpressure(
                            &event_tx,
                            PiMsg::BashResult {
                                display,
                                content_for_agent: Some(content_for_agent),
                            },
                        )
                        .await;
                    }
                }
                Err(err) => {
                    let _ = send_pi_msg_with_backpressure(
                        &event_tx,
                        PiMsg::BashResult {
                            display: format!("Bash command failed: {err}"),
                            content_for_agent: None,
                        },
                    )
                    .await;
                }
            }
        });

        None
    }

    pub(super) fn format_themes_list(&self) -> String {
        let mut names = Vec::new();
        names.push("dark".to_string());
        names.push("light".to_string());
        names.push("solarized".to_string());

        for path in Theme::discover_themes(&self.cwd) {
            if let Ok(theme) = Theme::load(&path) {
                names.push(theme.name);
            }
        }

        names.sort_by_key(|a| a.to_ascii_lowercase());
        names.dedup_by(|a, b| a.eq_ignore_ascii_case(b));

        let mut output = String::from("Available themes:\n");
        for name in names {
            let marker = if name.eq_ignore_ascii_case(&self.theme.name) {
                "* "
            } else {
                "  "
            };
            let _ = writeln!(output, "{marker}{name}");
        }
        output.push_str("\nUse /theme <name> to switch");
        output
    }

    pub(super) fn format_scoped_models_status(&self) -> String {
        let patterns = self.config.enabled_models.as_deref().unwrap_or(&[]);
        let scope_configured = !patterns.is_empty();

        let mut output = String::new();
        let current = format!(
            "{}/{}",
            self.model_entry.model.provider, self.model_entry.model.id
        );
        let _ = writeln!(output, "Current model: {current}");
        let _ = writeln!(output);

        if !scope_configured {
            let _ = writeln!(output, "Scoped models: (all models)");
            let _ = writeln!(output);
            output.push_str("Use /scoped-models <patterns> to scope Ctrl+P cycling.\n");
            output.push_str("Use /scoped-models clear to clear scope.\n");
            return output;
        }

        output.push_str("Scoped model patterns:\n");
        for pattern in patterns {
            let _ = writeln!(output, "  - {pattern}");
        }
        let _ = writeln!(output);

        output.push_str("Scoped models (matched):\n");
        if self.model_scope.is_empty() {
            output.push_str("  (none)\n");
        } else {
            let mut models = self
                .model_scope
                .iter()
                .map(|entry| format!("{}/{}", entry.model.provider, entry.model.id))
                .collect::<Vec<_>>();
            models.sort_by_key(|value| value.to_ascii_lowercase());
            models.dedup_by(|a, b| a.eq_ignore_ascii_case(b));
            for model in models {
                let _ = writeln!(output, "  - {model}");
            }
        }
        let _ = writeln!(output);

        output.push_str("Use /scoped-models clear to cycle all models.\n");
        output
    }

    pub(super) fn format_input_history(&self) -> String {
        let entries = self.history.entries();
        if entries.is_empty() {
            return "No input history yet.".to_string();
        }

        let mut output = String::from("Input history (most recent first):\n");
        for (idx, entry) in entries.iter().rev().take(50).enumerate() {
            let trimmed = entry.value.trim();
            if trimmed.is_empty() {
                continue;
            }
            let preview = trimmed.replace('\n', "\\n");
            let preview = preview.chars().take(120).collect::<String>();
            let _ = writeln!(output, "  {}. {preview}", idx + 1);
        }
        output
    }

    pub(super) fn format_session_info(&self, session: &Session) -> String {
        let file = session.path.as_ref().map_or_else(
            || "(not saved yet)".to_string(),
            |p| p.display().to_string(),
        );
        let name = session.get_name().unwrap_or_else(|| "-".to_string());
        let thinking = session
            .header
            .thinking_level
            .as_deref()
            .unwrap_or("off")
            .to_string();

        let message_count = session
            .entries_for_current_path()
            .iter()
            .filter(|entry| matches!(entry, SessionEntry::Message(_)))
            .count();

        let total_tokens = self.total_usage.total_tokens;
        let total_cost = self.total_usage.cost.total;
        let cost_str = if total_cost > 0.0 {
            format!("${total_cost:.4}")
        } else {
            "$0.0000".to_string()
        };

        let mut info = format!(
            "Session info:\n  file: {file}\n  id: {id}\n  name: {name}\n  model: {model}\n  thinking: {thinking}\n  messageCount: {message_count}\n  tokens: {total_tokens}\n  cost: {cost_str}",
            id = session.header.id,
            model = self.model,
        );
        info.push_str("\n\n");
        info.push_str(&self.frame_timing.summary());
        info.push_str("\n\n");
        info.push_str(&self.memory_monitor.summary());
        info
    }

    /// Handle a slash command.
    #[allow(clippy::too_many_lines)]
    pub(super) fn handle_slash_command(&mut self, cmd: SlashCommand, args: &str) -> Option<Cmd> {
        // Clear input
        self.input.reset();

        match cmd {
            SlashCommand::Help => {
                self.messages.push(ConversationMessage {
                    role: MessageRole::System,
                    content: SlashCommand::help_text().to_string(),
                    thinking: None,
                    collapsed: false,
                });
                self.scroll_to_last_match("Available commands:");
                None
            }
            SlashCommand::Setup => self.handle_slash_setup(args),
            SlashCommand::Login => self.handle_slash_login(args),
            SlashCommand::Logout => self.handle_slash_logout(args),
            SlashCommand::Clear => {
                self.messages.clear();
                self.current_response.clear();
                self.current_thinking.clear();
                self.current_tool = None;
                self.pending_tool_output = None;
                self.abort_handle = None;
                self.autocomplete.close();
                self.message_render_cache.clear();
                self.status_message = Some("Conversation cleared".to_string());
                self.scroll_to_bottom();
                None
            }
            SlashCommand::Model => self.handle_slash_model(args),
            SlashCommand::Thinking => self.handle_slash_thinking(args),
            SlashCommand::ScopedModels => self.handle_slash_scoped_models(args),
            SlashCommand::Exit => Some(self.quit_cmd()),
            SlashCommand::History => {
                self.messages.push(ConversationMessage {
                    role: MessageRole::System,
                    content: self.format_input_history(),
                    thinking: None,
                    collapsed: false,
                });
                self.scroll_to_last_match("Input history");
                None
            }
            SlashCommand::Export => {
                if self.agent_state != AgentState::Idle {
                    self.status_message = Some("Cannot export while processing".to_string());
                    return None;
                }

                let (output_path, html) = {
                    let Ok(session_guard) = self.session.try_lock() else {
                        self.status_message = Some("Session busy; try again".to_string());
                        return None;
                    };
                    let output_path = if args.trim().is_empty() {
                        self.default_export_path(&session_guard)
                    } else {
                        self.resolve_output_path(args)
                    };
                    let html = session_guard.to_html();
                    (output_path, html)
                };

                if let Some(parent) = output_path.parent() {
                    if !parent.as_os_str().is_empty() {
                        if let Err(err) = std::fs::create_dir_all(parent) {
                            self.status_message = Some(format!("Failed to create dir: {err}"));
                            return None;
                        }
                    }
                }
                if let Err(err) = std::fs::write(&output_path, html) {
                    self.status_message = Some(format!("Failed to write export: {err}"));
                    return None;
                }

                self.messages.push(ConversationMessage {
                    role: MessageRole::System,
                    content: format!("Exported HTML: {}", output_path.display()),
                    thinking: None,
                    collapsed: false,
                });
                self.scroll_to_bottom();
                self.status_message = Some(format!("Exported: {}", output_path.display()));
                None
            }
            SlashCommand::Session => {
                let Ok(session_guard) = self.session.try_lock() else {
                    self.status_message = Some("Session busy; try again".to_string());
                    return None;
                };
                let info = self.format_session_info(&session_guard);
                drop(session_guard);
                self.messages.push(ConversationMessage {
                    role: MessageRole::System,
                    content: info,
                    thinking: None,
                    collapsed: false,
                });
                self.scroll_to_bottom();
                None
            }
            SlashCommand::Settings => {
                if self.agent_state != AgentState::Idle {
                    self.status_message = Some("Cannot open settings while processing".to_string());
                    return None;
                }

                let mut settings = SettingsUiState::new();
                settings.max_visible = super::overlay_max_visible(self.term_height);
                self.settings_ui = Some(settings);
                self.session_picker = None;
                self.autocomplete.close();
                None
            }
            SlashCommand::Theme => {
                let name = args.trim();
                if name.is_empty() {
                    self.messages.push(ConversationMessage {
                        role: MessageRole::System,
                        content: self.format_themes_list(),
                        thinking: None,
                        collapsed: false,
                    });
                    self.scroll_to_last_match("Available themes:");
                    return None;
                }

                let theme = if name.eq_ignore_ascii_case("dark") {
                    Theme::dark()
                } else if name.eq_ignore_ascii_case("light") {
                    Theme::light()
                } else if name.eq_ignore_ascii_case("solarized") {
                    Theme::solarized()
                } else {
                    match Theme::load_by_name(name, &self.cwd) {
                        Ok(theme) => theme,
                        Err(err) => {
                            self.status_message = Some(err.to_string());
                            return None;
                        }
                    }
                };

                let theme_name = theme.name.clone();
                self.apply_theme(theme);
                self.config.theme = Some(theme_name.clone());

                if let Err(err) = self.persist_project_theme(&theme_name) {
                    tracing::warn!("Failed to persist theme preference: {err}");
                    self.status_message = Some(format!(
                        "Switched to theme: {theme_name} (not saved: {err})"
                    ));
                } else {
                    self.status_message = Some(format!("Switched to theme: {theme_name}"));
                }

                None
            }
            SlashCommand::Resume => {
                if self.agent_state != AgentState::Idle {
                    self.status_message = Some("Cannot resume while processing".to_string());
                    return None;
                }

                let override_dir = self
                    .session
                    .try_lock()
                    .ok()
                    .and_then(|guard| guard.session_dir.clone());
                let base_dir = override_dir.clone().unwrap_or_else(Config::sessions_dir);
                let sessions = crate::session_picker::list_sessions_for_project(
                    &self.cwd,
                    override_dir.as_deref(),
                );
                if sessions.is_empty() {
                    self.status_message = Some("No sessions found for this project".to_string());
                    return None;
                }

                let mut picker = SessionPickerOverlay::new_with_root(sessions, Some(base_dir));
                picker.max_visible = super::overlay_max_visible(self.term_height);
                self.session_picker = Some(picker);
                self.autocomplete.close();
                None
            }
            SlashCommand::New => {
                if self.agent_state != AgentState::Idle {
                    self.status_message =
                        Some("Cannot start a new session while processing".to_string());
                    return None;
                }

                let active_model_entry = self.model_entry.clone();
                let model_label = self.model.clone();
                let available_models_shared = self.available_models_shared.clone();
                let model_entry_shared = self.model_entry_shared.clone();
                let event_tx = self.event_tx.clone();
                let session = Arc::clone(&self.session);
                let agent = Arc::clone(&self.agent);
                let extensions = self.extensions.clone();
                let runtime_handle = self.runtime_handle.clone();
                let save_enabled = self.save_enabled;

                self.agent_state = AgentState::Processing;
                self.status_message = Some("Starting new session...".to_string());
                self.pending_tool_output = None;
                self.pending_oauth = None;
                self.session_picker = None;
                self.tree_ui = None;
                self.autocomplete.close();

                runtime_handle.spawn(async move {
                    let cx = Cx::for_request();

                    if let Some(manager) = extensions.clone() {
                        let cancelled = manager
                            .dispatch_cancellable_event(
                                ExtensionEventName::SessionBeforeSwitch,
                                Some(json!({ "reason": "new" })),
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
                        let (session_dir, store_kind) = match session.lock(&cx).await {
                            Ok(guard) => (guard.session_dir.clone(), guard.store_kind()),
                            Err(err) => {
                                let _ = send_pi_msg_with_backpressure(
                                    &event_tx,
                                    PiMsg::AgentError(format!("Failed to lock session: {err}")),
                                )
                                .await;
                                return;
                            }
                        };
                        let mut new_session = if save_enabled {
                            Session::create_with_dir_and_store(session_dir, store_kind)
                        } else {
                            Session::in_memory()
                        };
                        new_session.header.provider = Some(active_model_entry.model.provider.clone());
                        new_session.header.model_id = Some(active_model_entry.model.id.clone());
                        new_session.header.thinking_level = Some(ThinkingLevel::Off.to_string());
                        let available_models = available_models_shared
                            .lock()
                            .unwrap_or_else(std::sync::PoisonError::into_inner)
                            .clone();
                        match install_interactive_session(
                            InteractiveSessionInstallContext {
                                session: &session,
                                agent: &agent,
                                available_models: &available_models,
                                preferred_model_entry: Some(active_model_entry.clone()),
                                reuse_active_runtime: true,
                                model_entry_shared: &model_entry_shared,
                                extensions: extensions.as_ref(),
                            },
                            new_session,
                        )
                        .await {
                            Ok(outcome) => outcome,
                            Err(err) => {
                                let _ =
                                    send_pi_msg_with_backpressure(&event_tx, PiMsg::AgentError(err))
                                        .await;
                                return;
                            }
                        }
                    };

                    let (messages, usage) = match snapshot_conversation_state(&session).await {
                        Ok(snapshot) => snapshot,
                        Err(err) => {
                            let _ =
                                send_pi_msg_with_backpressure(&event_tx, PiMsg::AgentError(err))
                                    .await;
                            return;
                        }
                    };

                    let _ = send_pi_msg_with_backpressure(
                        &event_tx,
                        PiMsg::ConversationReset {
                            messages,
                            usage,
                            status: Some(format!(
                                "Started new session\nModel set to {model_label}\nThinking level: off"
                            )),
                        },
                    )
                    .await;

                    if let Some(manager) = extensions {
                        let _ = manager
                            .dispatch_event(
                                ExtensionEventName::SessionSwitch,
                                Some(json!({
                                    "reason": "new",
                                    "previousSessionFile": outcome.session_swap.previous_session_file,
                                    "sessionId": outcome.session_swap.session_id,
                                })),
                            )
                            .await;
                    }
                });

                None
            }
            SlashCommand::Copy => {
                if self.agent_state != AgentState::Idle {
                    self.status_message = Some("Cannot copy while processing".to_string());
                    return None;
                }

                let text = self
                    .messages
                    .iter()
                    .rev()
                    .find(|m| m.role == MessageRole::Assistant && !m.content.trim().is_empty())
                    .map(|m| m.content.clone());

                let Some(text) = text else {
                    self.status_message = Some("No agent messages to copy yet.".to_string());
                    return None;
                };

                let write_fallback = |text: &str| -> std::io::Result<std::path::PathBuf> {
                    use std::io::Write;
                    let dir = std::env::temp_dir();
                    let filename = format!("pi_copy_{}.txt", Utc::now().timestamp_millis());
                    let path = dir.join(filename);

                    let mut options = std::fs::OpenOptions::new();
                    options.write(true).create_new(true);
                    #[cfg(unix)]
                    {
                        use std::os::unix::fs::OpenOptionsExt;
                        options.mode(0o600);
                    }

                    let mut file = options.open(&path)?;
                    file.write_all(text.as_bytes())?;

                    Ok(path)
                };

                #[cfg(feature = "clipboard")]
                {
                    match ArboardClipboard::new()
                        .and_then(|mut clipboard| clipboard.set_text(text.clone()))
                    {
                        Ok(()) => self.status_message = Some("Copied to clipboard".to_string()),
                        Err(err) => match write_fallback(&text) {
                            Ok(path) => {
                                self.status_message = Some(format!(
                                    "Clipboard support is disabled or unavailable ({err}). Wrote to {}",
                                    path.display()
                                ));
                            }
                            Err(io_err) => {
                                self.status_message = Some(format!(
                                    "Clipboard support is disabled or unavailable ({err}); also failed to write fallback file: {io_err}"
                                ));
                            }
                        },
                    }
                }

                #[cfg(not(feature = "clipboard"))]
                {
                    match write_fallback(&text) {
                        Ok(path) => {
                            self.status_message = Some(format!(
                                "Clipboard support is disabled. Wrote to {}",
                                path.display()
                            ));
                        }
                        Err(err) => {
                            self.status_message = Some(format!(
                                "Clipboard support is disabled; failed to write fallback file: {err}"
                            ));
                        }
                    }
                }

                None
            }
            SlashCommand::Name => {
                let name = args.trim();
                if name.is_empty() {
                    self.status_message = Some("Usage: /name <name>".to_string());
                    return None;
                }

                let Ok(mut session_guard) = self.session.try_lock() else {
                    self.status_message = Some("Session busy; try again".to_string());
                    return None;
                };
                session_guard.append_session_info(Some(name.to_string()));
                drop(session_guard);
                self.spawn_save_session();

                self.status_message = Some(format!("Session name: {name}"));
                None
            }
            SlashCommand::Hotkeys => {
                self.messages.push(ConversationMessage {
                    role: MessageRole::System,
                    content: self.format_hotkeys(),
                    thinking: None,
                    collapsed: false,
                });
                self.scroll_to_bottom();
                None
            }
            SlashCommand::Changelog => {
                let path = Path::new(env!("CARGO_MANIFEST_DIR")).join("CHANGELOG.md");
                match std::fs::read_to_string(&path) {
                    Ok(content) => {
                        self.messages.push(ConversationMessage {
                            role: MessageRole::System,
                            content,
                            thinking: None,
                            collapsed: false,
                        });
                        self.scroll_to_last_match("# ");
                    }
                    Err(err) => {
                        self.status_message = Some(format!(
                            "Failed to read changelog {}: {err}",
                            path.display()
                        ));
                    }
                }
                None
            }
            SlashCommand::Tree => {
                if self.agent_state != AgentState::Idle {
                    self.status_message = Some("Cannot open tree while processing".to_string());
                    return None;
                }

                let Ok(session_guard) = self.session.try_lock() else {
                    self.status_message = Some("Session busy; try again".to_string());
                    return None;
                };
                let initial_selected_id = resolve_tree_selector_initial_id(&session_guard, args);
                let selector = TreeSelectorState::new(
                    &session_guard,
                    self.term_height,
                    initial_selected_id.as_deref(),
                );
                drop(session_guard);
                self.tree_ui = Some(TreeUiState::Selector(selector));
                None
            }
            SlashCommand::Fork => self.handle_slash_fork(args),
            SlashCommand::Compact => self.handle_slash_compact(args),
            SlashCommand::Reload => self.handle_slash_reload(),
            SlashCommand::Share => self.handle_slash_share(args),
            // V2
            SlashCommand::Systems => self.handle_slash_systems(args),
            SlashCommand::Vault => self.handle_slash_vault(args),
            SlashCommand::Agents => self.handle_slash_agents(args),
            SlashCommand::Artifacts => self.handle_slash_artifacts(args),
            SlashCommand::Task => self.handle_slash_task(args),
            SlashCommand::Bindings => self.handle_slash_bindings(args),
            SlashCommand::Memory => self.handle_slash_memory(args),
            SlashCommand::Automations => self.handle_slash_automations(args),
            SlashCommand::Bridge => self.handle_slash_bridge(args),
        }
    }

    pub(super) fn handle_slash_setup(&mut self, args: &str) -> Option<Cmd> {
        if self.agent_state != AgentState::Idle {
            self.status_message = Some("Cannot open setup while processing".to_string());
            return None;
        }

        let provider = args
            .split_whitespace()
            .next()
            .map(str::trim)
            .filter(|value| !value.is_empty());
        self.open_provider_setup_overlay(provider);
        None
    }

    #[allow(clippy::too_many_lines)]
    pub(super) fn handle_slash_login(&mut self, args: &str) -> Option<Cmd> {
        if self.agent_state != AgentState::Idle {
            self.status_message = Some("Cannot login while processing".to_string());
            return None;
        }

        let args = args.trim();
        if args.is_empty() {
            let auth_path = crate::config::Config::auth_path();
            match crate::auth::AuthStorage::load(auth_path) {
                Ok(auth) => {
                    let extension_models = extension_login_model_entries(self.extensions.as_ref());
                    let listing = format_login_provider_listing(&auth, &extension_models);
                    self.messages.push(ConversationMessage {
                        role: MessageRole::System,
                        content: listing,
                        thinking: None,
                        collapsed: false,
                    });
                    self.scroll_to_last_match("Available login providers:");
                }
                Err(err) => {
                    self.status_message = Some(format!("Unable to load auth status: {err}"));
                }
            }
            return None;
        }

        let requested_provider = args.split_whitespace().next().unwrap_or(args).to_string();
        let provider = normalize_auth_provider_input(&requested_provider);

        if let Some(prompt) = api_key_login_prompt(&provider) {
            self.messages.push(ConversationMessage {
                role: MessageRole::System,
                content: prompt.to_string(),
                thinking: None,
                collapsed: false,
            });
            self.scroll_to_bottom();
            self.pending_oauth = Some(PendingOAuth {
                provider,
                kind: PendingLoginKind::ApiKey,
                verifier: String::new(),
                oauth_config: None,
                device_code: None,
            });
            self.input_mode = InputMode::SingleLine;
            self.set_input_height(3);
            self.input.focus();
            return None;
        }

        if provider == "kimi-for-coding" {
            let device_start =
                futures::executor::block_on(crate::auth::start_kimi_code_device_flow());
            match device_start {
                Ok(device) => {
                    let verification_url = device
                        .verification_uri_complete
                        .clone()
                        .unwrap_or_else(|| device.verification_uri.clone());
                    let message = format!(
                        "OAuth login: kimi-for-coding\n\n\
Open this URL:\n{verification_url}\n\n\
If prompted, enter this code: {}\n\
Code expires in {} seconds.\n\n\
After approving access in the browser, press Enter in Pi to complete login.",
                        device.user_code, device.expires_in
                    );
                    self.messages.push(ConversationMessage {
                        role: MessageRole::System,
                        content: message,
                        thinking: None,
                        collapsed: false,
                    });
                    self.scroll_to_bottom();
                    self.pending_oauth = Some(PendingOAuth {
                        provider,
                        kind: PendingLoginKind::DeviceFlow,
                        verifier: String::new(),
                        oauth_config: None,
                        device_code: Some(device.device_code),
                    });
                    self.input_mode = InputMode::SingleLine;
                    self.set_input_height(3);
                    self.input.focus();
                }
                Err(err) => {
                    self.status_message = Some(format!("OAuth login failed: {err}"));
                }
            }
            return None;
        }

        // Look up OAuth config: built-in providers or extension-registered OAuth config.
        let oauth_result = if provider == "anthropic" {
            crate::auth::start_anthropic_oauth().map(|info| (info, None))
        } else if provider == "openai-codex" {
            crate::auth::start_openai_codex_oauth().map(|info| (info, None))
        } else if provider == "google-gemini-cli" {
            crate::auth::start_google_gemini_cli_oauth().map(|info| (info, None))
        } else if provider == "google-antigravity" {
            crate::auth::start_google_antigravity_oauth().map(|info| (info, None))
        } else if provider == "github-copilot" || provider == "copilot" {
            let client_id = std::env::var("GITHUB_COPILOT_CLIENT_ID").unwrap_or_default();
            let copilot_config = crate::auth::CopilotOAuthConfig {
                client_id,
                ..crate::auth::CopilotOAuthConfig::default()
            };
            crate::auth::start_copilot_browser_oauth(&copilot_config).map(|info| (info, None))
        } else if provider == "gitlab" || provider == "gitlab-duo" {
            let client_id = std::env::var("GITLAB_CLIENT_ID").unwrap_or_default();
            let base_url = std::env::var("GITLAB_BASE_URL")
                .unwrap_or_else(|_| "https://gitlab.com".to_string());
            let gitlab_config = crate::auth::GitLabOAuthConfig {
                client_id,
                base_url,
                ..crate::auth::GitLabOAuthConfig::default()
            };
            crate::auth::start_gitlab_oauth(&gitlab_config).map(|info| (info, None))
        } else {
            // Check extension providers for OAuth config.
            let extension_models = extension_login_model_entries(self.extensions.as_ref());
            let ext_oauth = extension_oauth_config_for_provider(&extension_models, &provider);
            if let Some(config) = ext_oauth {
                crate::auth::start_extension_oauth(&provider, &config)
                    .map(|info| (info, Some(config)))
            } else {
                self.status_message = Some(format!(
                    "Login not supported for {provider} (no built-in flow or OAuth config)"
                ));
                return None;
            }
        };

        match oauth_result {
            Ok((info, ext_config)) => {
                // Start a local callback server for localhost redirect URIs
                // so the browser redirect is captured automatically (issue #22).
                let callback_server = info
                    .redirect_uri
                    .as_deref()
                    .filter(|uri| crate::auth::redirect_uri_needs_callback_server(uri))
                    .and_then(|uri| crate::auth::start_oauth_callback_server(uri).ok());

                let mut message = format!(
                    "OAuth login: {}\n\nOpen this URL:\n{}\n",
                    info.provider, info.url
                );
                if info.provider == "anthropic" {
                    message.push_str(
                        "\nWARNING: Anthropic OAuth (Claude Code consumer account) is no longer recommended.\n\
Using consumer OAuth tokens outside the official client may violate Anthropic's consumer Terms of Service and can\n\
result in account suspension/ban. Prefer using an Anthropic API key (ANTHROPIC_API_KEY) instead.\n",
                    );
                }
                if callback_server.is_some() {
                    message.push_str(
                        "\nListening for callback — complete authorization in your browser.\n\
                         Pi will continue automatically, or you can paste the code manually.",
                    );
                } else if let Some(instructions) = info.instructions {
                    message.push('\n');
                    message.push_str(&instructions);
                    message.push('\n');
                    message.push_str(
                        "\nPaste the callback URL or authorization code into Pi to continue.",
                    );
                } else {
                    message.push_str(
                        "\nPaste the callback URL or authorization code into Pi to continue.",
                    );
                }

                // Spawn a thread to wait for the callback and inject the code
                // via the event channel when the browser redirect arrives.
                if let Some(server) = callback_server {
                    let event_tx = self.event_tx.clone();
                    std::thread::spawn(move || {
                        // Block until the callback arrives or the sender is dropped.
                        if let Ok(path) = server.rx.recv() {
                            let full_url = format!("http://localhost{path}");
                            let _ = send_pi_msg_with_backpressure_blocking(
                                &event_tx,
                                PiMsg::OAuthCallbackReceived(full_url),
                            );
                        }
                    });
                }

                self.messages.push(ConversationMessage {
                    role: MessageRole::System,
                    content: message,
                    thinking: None,
                    collapsed: false,
                });
                self.scroll_to_bottom();
                self.pending_oauth = Some(PendingOAuth {
                    provider: info.provider,
                    kind: PendingLoginKind::OAuth,
                    verifier: info.verifier,
                    oauth_config: ext_config,
                    device_code: None,
                });
                self.input_mode = InputMode::SingleLine;
                self.set_input_height(3);
                self.input.focus();
                None
            }
            Err(err) => {
                self.status_message = Some(format!("OAuth login failed: {err}"));
                None
            }
        }
    }

    pub(super) fn handle_slash_logout(&mut self, args: &str) -> Option<Cmd> {
        if self.agent_state != AgentState::Idle {
            self.status_message = Some("Cannot logout while processing".to_string());
            return None;
        }

        let requested_provider = if args.is_empty() {
            self.model_entry.model.provider.clone()
        } else {
            args.split_whitespace().next().unwrap_or(args).to_string()
        };
        let requested_provider = requested_provider.trim().to_ascii_lowercase();
        let provider = normalize_auth_provider_input(&requested_provider);

        let auth_path = crate::config::Config::auth_path();
        match crate::auth::AuthStorage::load(auth_path) {
            Ok(mut auth) => {
                let removed = remove_provider_credentials(&mut auth, &requested_provider);
                if let Err(err) = auth.save() {
                    self.status_message = Some(err.to_string());
                    return None;
                }
                let diagnostic = self.refresh_provider_auth_state_from_auth(&auth, &provider);
                if removed {
                    let mut status = format!("Removed stored credentials for {provider}.");
                    if let Some(diagnostic) = diagnostic {
                        let _ = write!(status, " models.json warning: {diagnostic}");
                    }
                    self.status_message = Some(status);
                } else {
                    let mut status = format!("No stored credentials for {provider}.");
                    if let Some(diagnostic) = diagnostic {
                        let _ = write!(status, " models.json warning: {diagnostic}");
                    }
                    self.status_message = Some(status);
                }
            }
            Err(err) => {
                self.status_message = Some(err.to_string());
            }
        }
        None
    }

    #[allow(clippy::too_many_lines)]
    pub(super) fn handle_slash_model(&mut self, args: &str) -> Option<Cmd> {
        if args.trim().is_empty() {
            self.open_model_selector_configured_only();
            return None;
        }

        if self.agent_state != AgentState::Idle {
            self.status_message = Some("Cannot switch models while processing".to_string());
            return None;
        }

        let pattern = args.trim();
        let pattern_lower = pattern.to_ascii_lowercase();
        let provider_scoped_pattern = split_provider_model_spec(pattern);

        let mut exact_matches = Vec::new();
        for entry in &self.available_models {
            let full = format!("{}/{}", entry.model.provider, entry.model.id);
            if full.eq_ignore_ascii_case(pattern)
                || entry.model.id.eq_ignore_ascii_case(pattern)
                || provider_scoped_pattern.is_some_and(|(provider, model_id)| {
                    provider_ids_match(&entry.model.provider, provider)
                        && entry.model.id.eq_ignore_ascii_case(model_id)
                })
            {
                exact_matches.push(entry.clone());
            }
        }

        let mut matches = if exact_matches.is_empty() {
            let mut fuzzy = Vec::new();
            for entry in &self.available_models {
                let full = format!("{}/{}", entry.model.provider, entry.model.id);
                let full_lower = full.to_ascii_lowercase();
                if full_lower.contains(&pattern_lower)
                    || entry.model.id.to_ascii_lowercase().contains(&pattern_lower)
                {
                    fuzzy.push(entry.clone());
                }
            }
            fuzzy
        } else {
            exact_matches
        };

        matches.sort_by(|a, b| {
            let left = format!("{}/{}", a.model.provider, a.model.id);
            let right = format!("{}/{}", b.model.provider, b.model.id);
            left.to_ascii_lowercase().cmp(&right.to_ascii_lowercase())
        });
        matches.dedup_by(|a, b| model_entry_matches(a, b));

        if matches.is_empty()
            && let Some((provider, model_id)) = pattern.split_once('/')
        {
            let provider = normalize_auth_provider_input(provider);
            let model_id = model_id.trim();
            if !provider.is_empty()
                && !model_id.is_empty()
                && let Some(entry) = crate::models::ad_hoc_model_entry(&provider, model_id)
            {
                matches.push(entry);
            }
        }

        if matches.is_empty() {
            self.status_message = Some(format!("Model not found: {pattern}"));
            return None;
        }
        if matches.len() > 1 {
            let preview = matches
                .iter()
                .take(8)
                .map(|m| format!("  - {}/{}", m.model.provider, m.model.id))
                .collect::<Vec<_>>()
                .join("\n");
            self.messages.push(ConversationMessage {
                role: MessageRole::System,
                content: format!(
                    "Ambiguous model pattern \"{pattern}\". Matches:\n{preview}\n\nUse /model provider/id for an exact match."
                ),
                thinking: None,
                collapsed: false,
            });
            self.scroll_to_bottom();
            return None;
        }

        let next = matches.into_iter().next().expect("matches is non-empty");

        let resolved_key_opt = resolve_model_key_from_default_auth(&next);
        if model_requires_configured_credential(&next) && resolved_key_opt.is_none() {
            self.status_message = Some(format!(
                "Missing credentials for provider {}. Run /login {}.",
                next.model.provider, next.model.provider
            ));
            return None;
        }

        if model_entry_matches(&next, &self.model_entry) {
            self.status_message = Some(format!("Current model: {}", self.model));
            return None;
        }

        let provider_impl = match providers::create_provider(&next, self.extensions.as_ref()) {
            Ok(provider_impl) => provider_impl,
            Err(err) => {
                self.status_message = Some(err.to_string());
                return None;
            }
        };

        if let Err(message) =
            self.switch_active_model(&next, provider_impl, resolved_key_opt.as_deref())
        {
            self.status_message = Some(message);
            return None;
        }

        self.push_available_model_if_missing(next.clone());

        self.status_message = Some(format!("Switched model: {}", self.model));
        None
    }

    pub(super) fn handle_slash_thinking(&mut self, args: &str) -> Option<Cmd> {
        let value = args.trim();
        if value.is_empty() {
            let current = self
                .session
                .try_lock()
                .ok()
                .and_then(|guard| guard.header.thinking_level.clone())
                .unwrap_or_else(|| ThinkingLevel::Off.to_string());
            self.status_message = Some(format!("Thinking level: {current}"));
            return None;
        }

        let level: ThinkingLevel = match value.parse() {
            Ok(level) => level,
            Err(err) => {
                self.status_message = Some(err);
                return None;
            }
        };
        let level = self.model_entry.clamp_thinking_level(level);

        let Ok(mut session_guard) = self.session.try_lock() else {
            self.status_message = Some("Session busy; try again".to_string());
            return None;
        };
        let previous_level = session_guard
            .header
            .thinking_level
            .as_deref()
            .and_then(|value| value.parse::<ThinkingLevel>().ok());
        session_guard.header.thinking_level = Some(level.to_string());
        if previous_level != Some(level) {
            session_guard.append_thinking_level_change(level.to_string());
        }
        drop(session_guard);
        self.spawn_save_session();

        if let Ok(mut agent_guard) = self.agent.try_lock() {
            agent_guard.stream_options_mut().thinking_level = Some(level);
        }

        self.status_message = Some(format!("Thinking level: {level}"));
        None
    }

    #[allow(clippy::too_many_lines)]
    pub(super) fn handle_slash_scoped_models(&mut self, args: &str) -> Option<Cmd> {
        let value = args.trim();
        if value.is_empty() {
            self.messages.push(ConversationMessage {
                role: MessageRole::System,
                content: self.format_scoped_models_status(),
                thinking: None,
                collapsed: false,
            });
            self.scroll_to_last_match("Scoped models");
            return None;
        }

        if value.eq_ignore_ascii_case("clear") {
            let previous_patterns = self
                .config
                .enabled_models
                .as_deref()
                .unwrap_or(&[])
                .to_vec();
            self.config.enabled_models = Some(Vec::new());
            self.model_scope.clear();

            let global_dir = Config::global_dir();
            let patch = json!({ "enabled_models": [] });
            let cleared_msg = if previous_patterns.is_empty() {
                "Scoped models cleared (was: all models)".to_string()
            } else {
                format!(
                    "Scoped models cleared: removed {} pattern(s) (was: {})",
                    previous_patterns.len(),
                    previous_patterns.join(", ")
                )
            };
            if let Err(err) = Config::patch_settings_with_roots(
                SettingsScope::Project,
                &global_dir,
                &self.cwd,
                patch,
            ) {
                tracing::warn!("Failed to persist enabled_models: {err}");
                self.status_message = Some(format!("{cleared_msg} (not saved: {err})"));
            } else {
                self.status_message = Some(cleared_msg);
            }
            return None;
        }

        let patterns = parse_scoped_model_patterns(value);
        if patterns.is_empty() {
            self.status_message = Some("Usage: /scoped-models [patterns|clear]".to_string());
            return None;
        }

        let resolved = match resolve_scoped_model_entries(&patterns, &self.available_models) {
            Ok(resolved) => resolved,
            Err(err) => {
                self.status_message =
                    Some(format!("{err}\n  Example: /scoped-models gpt-4*,claude-3*"));
                return None;
            }
        };

        self.model_scope = resolved;
        self.config.enabled_models = Some(patterns.clone());

        let match_count = self.model_scope.len();

        // Build a preview of matched models for the conversation pane.
        let mut preview = String::new();
        if match_count == 0 {
            let _ = writeln!(
                preview,
                "Warning: No models matched patterns: {}",
                patterns.join(", ")
            );
            let _ = writeln!(preview, "Ctrl+P cycling will use all available models.");
        } else {
            let _ = writeln!(preview, "Matching {match_count} model(s):");
            let mut model_names: Vec<String> = self
                .model_scope
                .iter()
                .map(|e| format!("{}/{}", e.model.provider, e.model.id))
                .collect();
            model_names.sort_by_key(|s| s.to_ascii_lowercase());
            model_names.dedup_by(|a, b| a.eq_ignore_ascii_case(b));
            for name in &model_names {
                let _ = writeln!(preview, "  {name}");
            }
        }
        let _ = writeln!(
            preview,
            "Patterns saved. Press Ctrl+P to cycle through matched models."
        );

        self.messages.push(ConversationMessage {
            role: MessageRole::System,
            content: preview,
            thinking: None,
            collapsed: false,
        });
        self.scroll_to_bottom();

        let status = if match_count == 0 {
            "Scoped models updated: 0 matched; cycling will use all available models".to_string()
        } else {
            format!("Scoped models updated: {match_count} matched")
        };
        let global_dir = Config::global_dir();
        let patch = json!({ "enabled_models": patterns });
        if let Err(err) =
            Config::patch_settings_with_roots(SettingsScope::Project, &global_dir, &self.cwd, patch)
        {
            tracing::warn!("Failed to persist enabled_models: {err}");
            self.status_message = Some(format!("{status} (not saved: {err})"));
        } else {
            self.status_message = Some(status);
        }
        None
    }

    pub(super) fn handle_slash_reload(&mut self) -> Option<Cmd> {
        if self.agent_state != AgentState::Idle {
            self.status_message = Some("Cannot reload while processing".to_string());
            return None;
        }

        let config = self.config.clone();
        let cli = self.resource_cli.clone();
        let cwd = self.cwd.clone();
        let event_tx = self.event_tx.clone();
        let runtime_handle = self.runtime_handle.clone();
        let extensions = self.extensions.clone();
        let agent = Arc::clone(&self.agent);
        let session = Arc::clone(&self.session);

        runtime_handle.spawn(async move {
            let manager = PackageManager::new(cwd.clone());
            match ResourceLoader::load(&manager, &cwd, &config, &cli).await {
                Ok(resources) => {
                    let (extension_status, extension_error) = if let Some(manager) = &extensions {
                        reload_live_extensions(manager, &agent, &session, &cwd, &resources).await
                    } else {
                        (None, None)
                    };
                    let models_error =
                        match crate::auth::AuthStorage::load_async(Config::auth_path()).await {
                            Ok(auth) => {
                                let models_path = default_models_path(&Config::global_dir());
                                let registry = ModelRegistry::load(&auth, Some(models_path));
                                registry.error().map(ToString::to_string)
                            }
                            Err(err) => Some(format!("Failed to load auth.json: {err}")),
                        };

                    let (diagnostics, diag_count) =
                        build_reload_diagnostics(models_error, &resources, extension_error);

                    let mut status = format!(
                        "Reloaded resources: {} skills, {} prompts, {} themes; refreshed model catalog",
                        resources.skills().len(),
                        resources.prompts().len(),
                        resources.themes().len()
                    );
                    if let Some(extension_status) = extension_status {
                        let _ = write!(status, "; {extension_status}");
                    }
                    if diag_count > 0 {
                        let _ = write!(status, " ({diag_count} diagnostics)");
                    }

                    let _ = send_pi_msg_with_backpressure(
                        &event_tx,
                        PiMsg::ResourcesReloaded {
                            resources,
                            status,
                            diagnostics,
                        },
                    )
                    .await;
                }
                Err(err) => {
                    let _ = send_pi_msg_with_backpressure(
                        &event_tx,
                        PiMsg::AgentError(format!("Failed to reload resources: {err}")),
                    )
                    .await;
                }
            }
        });

        self.status_message = Some(if self.extensions.is_some() {
            "Reloading resources, model catalog, and extensions...".to_string()
        } else {
            "Reloading resources and model catalog...".to_string()
        });
        None
    }

    // ── V2: /systems ──────────────────────────────────────────────────────────

    /// `/systems [<id>]` — list work systems or switch active system.
    pub(super) fn handle_slash_systems(&mut self, args: &str) -> Option<Cmd> {
        use std::fmt::Write as _;
        let arg = args.trim();

        // Switch active system if an id was given.
        if !arg.is_empty() {
            let exists = self
                .config
                .systems
                .as_ref()
                .is_some_and(|ss| ss.iter().any(|s| s.id == arg || s.name == arg));
            if exists {
                self.config.active_system_id = Some(arg.to_string());
                let patch = serde_json::json!({ "activeSystemId": arg });
                let global_dir = crate::config::Config::global_dir();
                let _ = crate::config::Config::patch_settings_with_roots(
                    crate::config::SettingsScope::Global,
                    &global_dir,
                    &self.cwd,
                    patch,
                );
                self.status_message = Some(format!("Active system → '{arg}'"));
                return None;
            }
        }

        let Some(ref systems) = self.config.systems else {
            self.status_message =
                Some("No work systems configured. Complete onboarding to create one.".to_string());
            return None;
        };

        let artifact_registry = crate::artifacts::ArtifactRegistry::new(&self.cwd);
        let memory_store = crate::memory_v2::MemoryStore::new(&self.cwd);
        let vault_mgr = crate::vault::VaultManager::new(&self.cwd);

        let mut out = String::new();
        let _ = writeln!(out, "Work Systems ({})\n", systems.len());
        let active = self.config.active_system_id.as_deref().unwrap_or("");
        for sys in systems {
            let marker = if sys.id == active { "▶" } else { " " };
            let artifact_count = artifact_registry
                .list_for_system(&sys.id)
                .map_or(0, |v| v.len());
            let mem_total: usize = crate::memory_v2::MemoryPartition::all()
                .iter()
                .filter_map(|&p| memory_store.load_partition(&sys.id, p).ok())
                .map(|v| v.len())
                .sum();
            let snap_count = vault_mgr.list_snapshots(&sys.id).map_or(0, |v| v.len());
            let _ = writeln!(out, " {marker} {:<24}  id: {}", sys.name, sys.id);
            let _ = writeln!(
                out,
                "     artifacts: {artifact_count}  memory: {mem_total} entries  vault: {snap_count} snapshot(s)"
            );
            if let Some(ref blueprint) = sys.team_blueprint {
                let _ = writeln!(out, "     team: {}", blueprint.id);
            }
            out.push('\n');
        }
        let _ = writeln!(out, "Use '/sys <id>' to switch active system.");
        self.messages.push(ConversationMessage {
            role: MessageRole::System,
            content: out,
            thinking: None,
            collapsed: false,
        });
        self.scroll_to_last_match("Work Systems");
        None
    }

    // ── V2: /vault ────────────────────────────────────────────────────────────

    /// `/vault [save [label] | list | restore <snap_id> [confirm] | clone <snap_id> <name> | compare <a> <b>]`
    #[allow(clippy::too_many_lines)]
    pub(super) fn handle_slash_vault(&mut self, args: &str) -> Option<Cmd> {
        use std::fmt::Write as _;

        let active_id = if let Some(id) = self.config.active_system_id.as_deref() {
            id.to_string()
        } else {
            self.status_message = Some("No active system.".to_string());
            return None;
        };

        let vault = crate::vault::VaultManager::new(&self.cwd);

        let (sub, rest) = args
            .trim()
            .split_once(char::is_whitespace)
            .map_or_else(|| (args.trim(), ""), |(a, b)| (a.trim(), b.trim()));

        match (sub, rest) {
            ("" | "list", _) => {
                // List snapshots
                let mut out = String::new();
                match vault.list_snapshots(&active_id) {
                    Ok(snaps) if snaps.is_empty() => {
                        let _ = writeln!(out, "No snapshots for system '{active_id}'.");
                        let _ = writeln!(out, "Use '/vault save [label]' to create one.");
                    }
                    Ok(snaps) => {
                        let _ = writeln!(out, "Vault snapshots — {active_id}\n");
                        let _ = writeln!(
                            out,
                            "  {:<36}  {:12}  {:12}  label",
                            "id", "kind", "created_at"
                        );
                        for snap in &snaps {
                            let _ = writeln!(
                                out,
                                "  {:<36}  {:12}  {:12}  {}",
                                snap.id,
                                format!("{:?}", snap.kind),
                                &snap.created_at[..snap.created_at.len().min(16)],
                                snap.label.as_deref().unwrap_or("(none)")
                            );
                        }
                        let _ = writeln!(
                            out,
                            "\nUse '/vault restore <id>' or '/vault clone <id> <name>'."
                        );
                    }
                    Err(e) => {
                        let _ = writeln!(out, "Vault error: {e}");
                    }
                }
                self.messages.push(ConversationMessage {
                    role: MessageRole::System,
                    content: out,
                    thinking: None,
                    collapsed: false,
                });
                self.scroll_to_last_match("Vault snapshots");
            }

            ("save", label) => {
                let label = if label.is_empty() {
                    None
                } else {
                    Some(label.to_string())
                };
                let system = self
                    .config
                    .systems
                    .as_ref()
                    .and_then(|ss| ss.iter().find(|s| s.id == active_id))
                    .cloned();
                match system {
                    None => {
                        self.status_message =
                            Some("Active system not found in config.".to_string());
                    }
                    Some(sys) => {
                        let snap = crate::vault::VaultSnapshot::new(
                            crate::vault::SnapshotKind::Manual,
                            sys,
                            label,
                        );
                        let snap_id = snap.id.clone();
                        match vault.save_snapshot(&snap) {
                            Ok(_) => {
                                self.status_message = Some(format!("Snapshot saved: {snap_id}"));
                            }
                            Err(e) => {
                                self.status_message = Some(format!("Vault save error: {e}"));
                            }
                        }
                    }
                }
            }

            ("restore", snap_id) => {
                if snap_id.is_empty() {
                    self.status_message = Some("Usage: /vault restore <snapshot_id>".to_string());
                    return None;
                }

                let confirm = snap_id.ends_with(" confirm");
                let snap_id = snap_id.trim_end_matches(" confirm").trim();

                if !confirm {
                    // Show restore plan
                    let snap = vault
                        .list_snapshots(&active_id)
                        .ok()
                        .and_then(|snaps| snaps.into_iter().find(|s| s.id == snap_id));
                    let mut plan = String::new();
                    let _ = writeln!(plan, "Vault Restore Plan\n");
                    let _ = writeln!(plan, "  Snapshot:  {snap_id}");
                    if let Some(ref s) = snap {
                        let _ = writeln!(
                            plan,
                            "  Label:     {}",
                            s.label.as_deref().unwrap_or("(no label)")
                        );
                        let _ = writeln!(plan, "  Taken at:  {}", s.created_at);
                        let _ = writeln!(plan, "  Kind:      {:?}", s.kind);
                        let _ = writeln!(plan, "  System:    {} ({})", s.system.name, s.system.id);
                    } else {
                        let _ =
                            writeln!(plan, "  [snapshot not found — will attempt restore anyway]");
                    }
                    let _ = writeln!(plan, "\nThis will overwrite the active system config.");
                    let _ = writeln!(
                        plan,
                        "Current state will be lost unless you /vault save first.\n"
                    );
                    let _ = writeln!(plan, "To confirm: /vault restore {snap_id} confirm");
                    let _ = writeln!(plan, "To cancel:  press Enter with no command");
                    self.vault_restore_plan = Some((snap_id.to_string(), active_id, plan.clone()));
                    self.messages.push(ConversationMessage {
                        role: MessageRole::System,
                        content: plan,
                        thinking: None,
                        collapsed: false,
                    });
                    self.scroll_to_last_match("Vault Restore Plan");
                    return None;
                }

                // Execute confirmed restore
                self.vault_restore_plan = None;
                match vault.restore_full(&active_id, snap_id) {
                    Ok(restored) => {
                        if let Some(ref mut systems) = self.config.systems {
                            if let Some(pos) = systems.iter().position(|s| s.id == active_id) {
                                systems[pos] = restored;
                            }
                        }
                        let patch = serde_json::json!({ "systems": &self.config.systems });
                        let global_dir = crate::config::Config::global_dir();
                        if let Err(e) = crate::config::Config::patch_settings_with_roots(
                            crate::config::SettingsScope::Global,
                            &global_dir,
                            &self.cwd,
                            patch,
                        ) {
                            self.status_message = Some(format!(
                                "Restore saved locally but config persist failed: {e}"
                            ));
                        } else {
                            self.status_message =
                                Some(format!("Restored from snapshot '{snap_id}'."));
                        }
                    }
                    Err(e) => {
                        self.status_message = Some(format!("Vault restore error: {e}"));
                    }
                }
            }

            ("clone", rest) => {
                let (snap_id, new_name) = rest
                    .split_once(char::is_whitespace)
                    .map_or((rest, ""), |(a, b)| (a.trim(), b.trim()));
                if snap_id.is_empty() || new_name.is_empty() {
                    self.status_message =
                        Some("Usage: /vault clone <snapshot_id> <new name>".to_string());
                    return None;
                }
                match vault.clone_from_snapshot(&active_id, snap_id, new_name) {
                    Ok(cloned) => {
                        let new_id = cloned.id.clone();
                        self.config
                            .systems
                            .get_or_insert_with(Vec::new)
                            .push(cloned);
                        let patch = serde_json::json!({ "systems": &self.config.systems });
                        let global_dir = crate::config::Config::global_dir();
                        if let Err(e) = crate::config::Config::patch_settings_with_roots(
                            crate::config::SettingsScope::Global,
                            &global_dir,
                            &self.cwd,
                            patch,
                        ) {
                            self.status_message = Some(format!(
                                "Cloned as '{new_id}' but config persist failed: {e}"
                            ));
                        } else {
                            self.status_message =
                                Some(format!("Cloned as new system '{new_id}' ({new_name})."));
                        }
                    }
                    Err(e) => {
                        self.status_message = Some(format!("Vault clone error: {e}"));
                    }
                }
            }

            ("compare", rest) => {
                let (snap_a, snap_b) = rest
                    .split_once(char::is_whitespace)
                    .map_or((rest, ""), |(a, b)| (a.trim(), b.trim()));
                if snap_a.is_empty() || snap_b.is_empty() {
                    self.status_message =
                        Some("Usage: /vault compare <snap_id_a> <snap_id_b>".to_string());
                    return None;
                }
                let a = vault.load_snapshot(&active_id, snap_a);
                let b = vault.load_snapshot(&active_id, snap_b);
                match (a, b) {
                    (Ok(a), Ok(b)) => {
                        let mut out = String::new();
                        let _ = writeln!(out, "Vault Compare\n");
                        let _ = writeln!(out, "  A: {} ({:?}  {})", a.id, a.kind, a.created_at);
                        let _ = writeln!(out, "  B: {} ({:?}  {})", b.id, b.kind, b.created_at);
                        let _ = writeln!(out, "\nSystem name:");
                        if a.system.name == b.system.name {
                            let _ = writeln!(out, "  (same) {}", a.system.name);
                        } else {
                            let _ = writeln!(out, "  A: {}\n  B: {}", a.system.name, b.system.name);
                        }
                        if let (Some(desc_a), Some(desc_b)) =
                            (&a.system.description, &b.system.description)
                        {
                            if desc_a != desc_b {
                                let _ = writeln!(out, "\nDescription changed.");
                            }
                        }
                        let _ =
                            writeln!(out, "\nUse '/vault restore <id>' to switch to a version.");
                        self.messages.push(ConversationMessage {
                            role: MessageRole::System,
                            content: out,
                            thinking: None,
                            collapsed: false,
                        });
                        self.scroll_to_last_match("Vault Compare");
                    }
                    (Err(e), _) | (_, Err(e)) => {
                        self.status_message = Some(format!("Vault compare error: {e}"));
                    }
                }
                return None;
            }

            _ => {
                let help = "\
Vault commands:\n\
  /vault save [label]                      — save a manual snapshot\n\
  /vault list                              — list snapshots for active system\n\
  /vault restore <snapshot_id>             — show restore plan (then confirm)\n\
  /vault restore <snapshot_id> confirm     — execute the restore\n\
  /vault clone <snapshot_id> <name>        — clone into a new system\n\
  /vault compare <snap_id_a> <snap_id_b>   — diff two snapshots\n\
\n\
The vault stores snapshots in .pi/vault/. Snapshots are never deleted automatically.";
                self.messages.push(ConversationMessage {
                    role: MessageRole::System,
                    content: help.to_string(),
                    thinking: None,
                    collapsed: false,
                });
                self.scroll_to_last_match("Vault commands:");
            }
        }

        None
    }

    // ── V2: /artifacts ────────────────────────────────────────────────────────

    /// `/artifacts [<artifact_id> [export] | <system_id>]`
    pub(super) fn handle_slash_artifacts(&mut self, args: &str) -> Option<Cmd> {
        use std::fmt::Write as _;

        let parts: Vec<&str> = args.trim().splitn(2, ' ').collect();
        let first = parts.first().copied().unwrap_or("").trim();
        let second = parts.get(1).copied().unwrap_or("").trim();

        if first.starts_with("art_") {
            return self.handle_artifact_detail(first, second);
        }

        let system_id = if first.is_empty() {
            self.config.active_system_id.clone().or_else(|| {
                self.config
                    .systems
                    .as_ref()
                    .and_then(|ss| ss.first())
                    .map(|s| s.id.clone())
            })
        } else {
            Some(first.to_string())
        };

        let Some(system_id) = system_id else {
            self.status_message = Some("No active system. Complete onboarding first.".to_string());
            return None;
        };

        let registry = crate::artifacts::ArtifactRegistry::new(&self.cwd);
        let mut out = String::new();

        match registry.list_for_system(&system_id) {
            Ok(arts) if arts.is_empty() => {
                let _ = writeln!(out, "No artifacts yet for system '{system_id}'.\n");
                let _ = writeln!(
                    out,
                    "Use '/task <goal>' to start a task and generate a result."
                );
            }
            Ok(arts) => {
                let sys_name = self
                    .config
                    .systems
                    .as_ref()
                    .and_then(|ss| ss.iter().find(|s| s.id == system_id))
                    .map_or(system_id.as_str(), |s| s.name.as_str());
                let _ = writeln!(out, "Artifacts — {sys_name}\n");
                for art in &arts {
                    let deliverable_count = art.deliverables.len();
                    let _ = writeln!(
                        out,
                        "  {:32}  {:16}  {deliverable_count} deliverable(s)",
                        art.id,
                        art.status.label()
                    );
                    let _ = writeln!(out, "  {:>4}  {}", "", art.task_summary);
                    if !art.artifact_type.is_empty() {
                        let _ = writeln!(
                            out,
                            "  {:>4}  type: {}  target: {}",
                            "", art.artifact_type, art.execution_target
                        );
                    }
                    if !art.deliverables.is_empty() {
                        for d in art.deliverables.iter().take(3) {
                            let preview = d.content.as_deref().map_or_else(
                                || d.path.as_deref().unwrap_or(""),
                                |c| {
                                    let trimmed = c.trim();
                                    if trimmed.len() > 60 {
                                        &trimmed[..60]
                                    } else {
                                        trimmed
                                    }
                                },
                            );
                            let _ = writeln!(out, "        • {}  {preview}", d.title);
                        }
                        if art.deliverables.len() > 3 {
                            let _ =
                                writeln!(out, "        … and {} more", art.deliverables.len() - 3);
                        }
                    }
                    out.push('\n');
                }
                let _ = writeln!(out, "Use '/artifacts <id>' for detail view.");
            }
            Err(e) => {
                let _ = writeln!(out, "Artifact registry error: {e}");
            }
        }

        self.messages.push(ConversationMessage {
            role: MessageRole::System,
            content: out,
            thinking: None,
            collapsed: false,
        });
        self.scroll_to_last_match("Artifacts");
        None
    }

    /// Show full detail for one artifact, or export it as markdown.
    #[allow(clippy::too_many_lines)]
    fn handle_artifact_detail(&mut self, artifact_id: &str, sub: &str) -> Option<Cmd> {
        use std::fmt::Write as _;

        let systems: Vec<String> = self
            .config
            .systems
            .as_ref()
            .map(|ss| ss.iter().map(|s| s.id.clone()).collect())
            .unwrap_or_default();

        let registry = crate::artifacts::ArtifactRegistry::new(&self.cwd);
        let art = systems
            .iter()
            .find_map(|sid| registry.load(sid, artifact_id).ok());

        let Some(art) = art else {
            self.status_message = Some(format!("Artifact '{artifact_id}' not found."));
            return None;
        };

        let mut out = String::new();

        if sub == "export" {
            let _ = writeln!(out, "# {}", art.task_summary);
            let _ = writeln!(
                out,
                "\n**Status**: {}  **Type**: {}  **Target**: {}",
                art.status.label(),
                art.artifact_type,
                art.execution_target
            );
            let _ = writeln!(out, "**ID**: `{}`  **System**: `{}`", art.id, art.system_id);
            if let Some(branch) = &art.branch_id {
                let _ = writeln!(out, "**Branch**: `{branch}`");
            }
            let _ = writeln!(out, "\n---\n");
            if !art.inputs.is_empty() {
                let _ = writeln!(out, "## Inputs\n");
                for e in &art.inputs {
                    let _ = writeln!(out, "- **{}**: {}", e.key, e.value);
                }
            }
            if !art.decisions.is_empty() {
                let _ = writeln!(out, "\n## Decisions\n");
                for e in &art.decisions {
                    let _ = writeln!(out, "- **{}**: {}", e.key, e.value);
                }
            }
            if !art.deliverables.is_empty() {
                let _ = writeln!(out, "\n## Deliverables\n");
                for d in &art.deliverables {
                    let _ = writeln!(out, "### {}", d.title);
                    if let Some(c) = &d.content {
                        let _ = writeln!(out, "\n{c}\n");
                    }
                    if let Some(p) = &d.path {
                        let _ = writeln!(out, "_File: `{p}`_\n");
                    }
                }
            }
            if !art.next_steps.is_empty() {
                let _ = writeln!(out, "\n## Next Steps\n");
                for ns in &art.next_steps {
                    let _ = writeln!(out, "- {}", ns.label);
                }
            }
        } else {
            let _ = writeln!(out, "Result Page — {}\n", art.task_summary);
            let _ = writeln!(out, "  ID:      {}", art.id);
            let _ = writeln!(
                out,
                "  Status:  {}{}",
                art.status.label(),
                if art.status.is_actionable() {
                    "  [actionable]"
                } else {
                    ""
                }
            );
            let _ = writeln!(out, "  Type:    {}", art.artifact_type);
            let _ = writeln!(out, "  Target:  {}", art.execution_target);
            let _ = writeln!(out, "  System:  {}", art.system_id);
            if let Some(b) = &art.branch_id {
                let _ = writeln!(out, "  Branch:  {b}");
            }
            if let Some(s) = &art.snapshot_id {
                let _ = writeln!(out, "  Snapshot: {s}");
            }
            let _ = writeln!(out, "  Updated: {}", art.updated_at);
            if !art.inputs.is_empty() {
                let _ = writeln!(out, "\nInputs:");
                for e in &art.inputs {
                    let _ = writeln!(out, "  {}: {}", e.key, e.value);
                }
            }
            if !art.decisions.is_empty() {
                let _ = writeln!(out, "\nDecisions:");
                for e in &art.decisions {
                    let _ = writeln!(out, "  {}: {}", e.key, e.value);
                }
            }
            if !art.deliverables.is_empty() {
                let _ = writeln!(out, "\nDeliverables ({}):", art.deliverables.len());
                for d in &art.deliverables {
                    let loc = d
                        .content
                        .as_ref()
                        .map(|c| {
                            let t = c.trim();
                            format!(
                                "\"{}{}\"",
                                &t[..t.len().min(80)],
                                if t.len() > 80 { "…" } else { "" }
                            )
                        })
                        .or_else(|| d.path.clone())
                        .unwrap_or_default();
                    let _ = writeln!(out, "  • {}  {loc}", d.title);
                }
            }
            if !art.next_steps.is_empty() {
                let _ = writeln!(out, "\nNext steps:");
                for ns in &art.next_steps {
                    let _ = writeln!(out, "  → {}", ns.label);
                }
            }
            let _ = writeln!(
                out,
                "\nTip: '/artifacts {artifact_id} export' dumps as markdown."
            );
        }

        self.messages.push(ConversationMessage {
            role: MessageRole::System,
            content: out,
            thinking: None,
            collapsed: false,
        });
        self.scroll_to_last_match("Result Page");
        None
    }

    // ── V2: /task ─────────────────────────────────────────────────────────────

    /// `/task [goal description]` — start a structured task intake.
    pub(super) fn handle_slash_task(&mut self, args: &str) -> Option<Cmd> {
        let goal = args.trim();
        if goal.is_empty() {
            self.status_message =
                Some("Usage: /task <goal description>  — starts a structured task run".to_string());
            return None;
        }
        let system_name = self
            .config
            .active_system_id
            .as_deref()
            .and_then(|id| self.config.systems.as_ref()?.iter().find(|s| s.id == id))
            .map_or("active system", |s| s.name.as_str());
        // Inject a task intake prompt as the next user message.
        let prompt = format!(
            "[Task intake for {system_name}]\n\nGoal: {goal}\n\nPlease break this down into a structured plan, execute the steps, and produce a result artifact when complete."
        );
        self.messages.push(ConversationMessage {
            role: MessageRole::System,
            content: format!("Starting task: {goal}"),
            thinking: None,
            collapsed: false,
        });
        // Set the input to the task prompt so the user can review/submit.
        self.input.set_value(&prompt);
        self.input.cursor_end();
        None
    }

    // ── V2: /memory ───────────────────────────────────────────────────────────

    /// `/memory [partition]` — show V2 memory partitions.
    pub(super) fn handle_slash_memory(&mut self, args: &str) -> Option<Cmd> {
        use std::fmt::Write as _;

        let system_id = if let Some(id) = self.config.active_system_id.as_deref() {
            id.to_string()
        } else {
            self.status_message = Some("No active system.".to_string());
            return None;
        };

        let store = crate::memory_v2::MemoryStore::new(&self.cwd);
        let partitions = crate::memory_v2::MemoryPartition::all();
        let filter = args.trim();

        let mut out = String::new();
        let _ = writeln!(out, "Memory — {system_id}\n");

        for &partition in partitions {
            if !filter.is_empty() && !format!("{partition:?}").to_lowercase().contains(filter) {
                continue;
            }
            match store.load_partition(&system_id, partition) {
                Ok(entries) if entries.is_empty() => {}
                Ok(entries) => {
                    let _ = writeln!(out, "  {:?} ({} entries):", partition, entries.len());
                    for entry in entries.iter().take(5) {
                        let _ = writeln!(
                            out,
                            "    [{}] {}",
                            entry.id,
                            &entry.summary[..entry.summary.len().min(80)]
                        );
                    }
                    if entries.len() > 5 {
                        let _ = writeln!(out, "    … and {} more", entries.len() - 5);
                    }
                    out.push('\n');
                }
                Err(_) => {}
            }
        }

        if out.trim_start_matches("Memory — ").trim() == system_id.as_str() {
            let _ = writeln!(out, "  No memory entries yet.");
        }

        self.messages.push(ConversationMessage {
            role: MessageRole::System,
            content: out,
            thinking: None,
            collapsed: false,
        });
        self.scroll_to_last_match("Memory —");
        None
    }

    // ── V2: /automations ──────────────────────────────────────────────────────

    /// `/automations` — list automations for active system.
    pub(super) fn handle_slash_automations(&mut self, args: &str) -> Option<Cmd> {
        use std::fmt::Write as _;

        let system_id = if let Some(id) = self.config.active_system_id.as_deref() {
            id.to_string()
        } else {
            self.status_message = Some("No active system.".to_string());
            return None;
        };

        let registry = crate::automations::AutomationRegistry::new(&self.cwd);
        let filter = args.trim();
        let mut out = String::new();

        match registry.list_for_system(&system_id) {
            Ok(autos) if autos.is_empty() => {
                let _ = writeln!(out, "No automations for system '{system_id}'.");
            }
            Ok(autos) => {
                let _ = writeln!(out, "Automations — {system_id}\n");
                for auto in &autos {
                    if !filter.is_empty() && !auto.name.to_lowercase().contains(filter) {
                        continue;
                    }
                    let enabled = if auto.enabled { "enabled" } else { "disabled" };
                    let trigger_label = auto.trigger.label();
                    let _ = writeln!(
                        out,
                        "  {} {:8}  {:24}  {}",
                        auto.id, enabled, auto.name, trigger_label
                    );
                }
            }
            Err(e) => {
                let _ = writeln!(out, "Automation registry error: {e}");
            }
        }

        self.messages.push(ConversationMessage {
            role: MessageRole::System,
            content: out,
            thinking: None,
            collapsed: false,
        });
        self.scroll_to_last_match("Automations —");
        None
    }

    // ── V2: /agents ───────────────────────────────────────────────────────────

    /// `/agents` — show team agents for active system.
    pub(super) fn handle_slash_agents(&mut self, _args: &str) -> Option<Cmd> {
        use std::fmt::Write as _;

        let system_id = if let Some(id) = self.config.active_system_id.as_deref() {
            id.to_string()
        } else {
            self.status_message = Some("No active system.".to_string());
            return None;
        };

        let sys = self
            .config
            .systems
            .as_ref()
            .and_then(|ss| ss.iter().find(|s| s.id == system_id))
            .cloned();

        let mut out = String::new();
        let _ = writeln!(out, "Agents — {system_id}\n");

        if let Some(sys) = sys {
            if let Some(ref blueprint) = sys.team_blueprint {
                let _ = writeln!(out, "  Team blueprint: {}", blueprint.id);
                let _ = writeln!(out, "  Roles: {}", blueprint.roles.len());
                for role in &blueprint.roles {
                    let _ = writeln!(out, "    • {}", role.id);
                }
            } else {
                let _ = writeln!(out, "  No team blueprint configured.");
            }
            let profile = self
                .config
                .active_agent_profile
                .as_deref()
                .unwrap_or("default");
            let _ = writeln!(out, "  Agent profile: {profile}");
        } else {
            let _ = writeln!(out, "  System not found.");
        }

        self.messages.push(ConversationMessage {
            role: MessageRole::System,
            content: out,
            thinking: None,
            collapsed: false,
        });
        self.scroll_to_last_match("Agents —");
        None
    }

    // ── V2: /bindings ─────────────────────────────────────────────────────────

    /// `/bindings` — show channel binding status.
    pub(super) fn handle_slash_bindings(&mut self, _args: &str) -> Option<Cmd> {
        use std::fmt::Write as _;
        let mut out = String::new();
        let _ = writeln!(out, "Channel Bindings\n");
        if self.binding_status.is_empty() {
            let _ = writeln!(out, "  No active bindings.");
            let _ = writeln!(
                out,
                "\n  Configure bindings in the web control plane or settings."
            );
        } else {
            for b in &self.binding_status {
                let _ = writeln!(
                    out,
                    "  {:20}  {:18}  {}",
                    b.platform,
                    b.health.status_label(),
                    b.id
                );
            }
        }
        self.messages.push(ConversationMessage {
            role: MessageRole::System,
            content: out,
            thinking: None,
            collapsed: false,
        });
        self.scroll_to_last_match("Channel Bindings");
        None
    }

    // ── V2: /bridge ───────────────────────────────────────────────────────────

    /// `/bridge` — show bridge/web control plane status.
    pub(super) fn handle_slash_bridge(&mut self, _args: &str) -> Option<Cmd> {
        use std::fmt::Write as _;
        let mut out = String::new();
        let _ = writeln!(out, "Bridge — Web Control Plane\n");
        let _ = writeln!(out, "  The web UI runs at http://localhost:3000 (default).");
        let _ = writeln!(out, "  Configure the bridge token in settings (/settings).");
        let _ = writeln!(
            out,
            "  Bridge links this CLI session to the web control plane."
        );
        self.messages.push(ConversationMessage {
            role: MessageRole::System,
            content: out,
            thinking: None,
            collapsed: false,
        });
        self.scroll_to_last_match("Bridge —");
        None
    }
}

#[cfg(test)]
mod tests {
    use super::{parse_bash_command, parse_extension_command, should_show_startup_oauth_hint};
    use crate::auth::{AuthCredential, AuthStorage};
    use crate::models::ModelEntry;
    use crate::provider::{InputType, Model, ModelCost};
    use std::collections::{HashMap, HashSet};
    use std::time::{SystemTime, UNIX_EPOCH};

    fn empty_auth_storage() -> AuthStorage {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system clock before unix epoch")
            .as_nanos();
        let path = std::env::temp_dir().join(format!("pi_auth_storage_test_{nonce}.json"));
        AuthStorage::load(path).expect("load empty auth storage")
    }

    fn test_model_entry(provider: &str, id: &str) -> ModelEntry {
        ModelEntry {
            model: Model {
                id: id.to_string(),
                name: id.to_string(),
                api: "openai-responses".to_string(),
                provider: provider.to_string(),
                base_url: "https://example.test/v1".to_string(),
                reasoning: true,
                input: vec![InputType::Text],
                cost: ModelCost {
                    input: 0.0,
                    output: 0.0,
                    cache_read: 0.0,
                    cache_write: 0.0,
                },
                context_window: 128_000,
                max_tokens: 8_192,
                headers: HashMap::new(),
            },
            api_key: Some("test-key".to_string()),
            headers: HashMap::new(),
            auth_header: true,
            compat: None,
            oauth_config: None,
        }
    }

    #[test]
    fn parse_ext_cmd_basic() {
        let result = parse_extension_command("/deploy");
        assert_eq!(result, Some(("deploy".to_string(), vec![])));
    }

    #[test]
    fn parse_ext_cmd_with_args() {
        let result = parse_extension_command("/deploy staging fast");
        assert_eq!(
            result,
            Some((
                "deploy".to_string(),
                vec!["staging".to_string(), "fast".to_string()]
            ))
        );
    }

    #[test]
    fn parse_ext_cmd_builtin_filtered() {
        assert!(parse_extension_command("/help").is_none());
        assert!(parse_extension_command("/clear").is_none());
        assert!(parse_extension_command("/model").is_none());
        assert!(parse_extension_command("/exit").is_none());
        assert!(parse_extension_command("/compact").is_none());
    }

    #[test]
    fn parse_ext_cmd_no_slash() {
        assert!(parse_extension_command("deploy").is_none());
        assert!(parse_extension_command("hello world").is_none());
    }

    #[test]
    fn parse_ext_cmd_empty_slash() {
        assert!(parse_extension_command("/").is_none());
        assert!(parse_extension_command("/  ").is_none());
    }

    #[test]
    fn parse_ext_cmd_whitespace_trimming() {
        let result = parse_extension_command("  /deploy  arg1  arg2  ");
        assert_eq!(
            result,
            Some((
                "deploy".to_string(),
                vec!["arg1".to_string(), "arg2".to_string()]
            ))
        );
    }

    #[test]
    fn parse_ext_cmd_single_arg() {
        let result = parse_extension_command("/greet world");
        assert_eq!(
            result,
            Some(("greet".to_string(), vec!["world".to_string()]))
        );
    }

    #[test]
    fn parse_bash_command_distinguishes_exclusion() {
        let (command, exclude) = parse_bash_command("! ls -la").expect("bang command");
        assert_eq!(command, "ls -la");
        assert!(!exclude);

        let (command, exclude) = parse_bash_command("!! ls -la").expect("double bang command");
        assert_eq!(command, "ls -la");
        assert!(exclude);
    }

    #[test]
    fn parse_bash_command_empty_bang() {
        assert!(parse_bash_command("!").is_none());
        assert!(parse_bash_command("!!").is_none());
        assert!(parse_bash_command("!  ").is_none());
    }

    #[test]
    fn parse_bash_command_no_bang() {
        assert!(parse_bash_command("ls -la").is_none());
        assert!(parse_bash_command("").is_none());
    }

    #[test]
    fn parse_bash_command_leading_whitespace() {
        let (cmd, exclude) = parse_bash_command("  ! echo hi").expect("should parse");
        assert_eq!(cmd, "echo hi");
        assert!(!exclude);
    }

    #[test]
    fn startup_hint_is_hidden_when_priority_provider_is_available() {
        let mut auth = empty_auth_storage();
        auth.set(
            "anthropic",
            AuthCredential::ApiKey {
                key: "test-key".to_string(),
            },
        );
        assert!(!should_show_startup_oauth_hint(&auth));
    }

    #[test]
    fn startup_hint_is_hidden_when_non_oauth_provider_is_available() {
        let mut auth = empty_auth_storage();
        auth.set(
            "openai",
            AuthCredential::ApiKey {
                key: "test-openai-key".to_string(),
            },
        );
        assert!(!should_show_startup_oauth_hint(&auth));
    }

    #[test]
    fn startup_hint_is_hidden_when_extension_provider_credential_exists() {
        let mut auth = empty_auth_storage();
        auth.set(
            "ext-provider",
            AuthCredential::ApiKey {
                key: "extension-key".to_string(),
            },
        );
        assert!(!should_show_startup_oauth_hint(&auth));
    }

    #[test]
    fn startup_hint_copy_no_longer_uses_front_and_center_phrase() {
        let auth = empty_auth_storage();
        let hint = super::format_startup_oauth_hint(&auth);
        assert!(hint.contains("No provider credentials were detected."));
        assert!(!hint.contains("front and center"));
    }

    #[test]
    fn builtin_login_providers_cover_legacy_oauth_registry() {
        let login_oauth: HashSet<&str> = super::BUILTIN_LOGIN_PROVIDERS
            .iter()
            .filter_map(|(provider, mode)| (*mode == "OAuth").then_some(*provider))
            .collect();

        // Legacy pi-mono OAuth provider registry (packages/ai/src/utils/oauth/index.ts)
        // includes exactly these built-ins.
        let legacy_oauth = [
            "anthropic",
            "openai-codex",
            "google-gemini-cli",
            "google-antigravity",
            "github-copilot",
        ];

        let missing: Vec<&str> = legacy_oauth
            .iter()
            .copied()
            .filter(|provider| !login_oauth.contains(provider))
            .collect();

        assert!(
            missing.is_empty(),
            "missing legacy OAuth providers in /login table: {}",
            missing.join(", ")
        );

        assert!(
            login_oauth.contains("kimi-for-coding"),
            "kimi-for-coding should remain available in /login OAuth providers"
        );
    }

    #[test]
    fn model_entry_matches_provider_aliases_case_insensitively() {
        let left = test_model_entry("openrouter", "openai/gpt-4o-mini");
        let right = test_model_entry("open-router", "openai/gpt-4o-mini");
        assert!(super::model_entry_matches(&left, &right));
    }

    #[test]
    fn provider_ids_match_normalizes_aliases() {
        assert!(super::provider_ids_match("openrouter", "open-router"));
        assert!(super::provider_ids_match("google-gemini-cli", "gemini-cli"));
        assert!(super::provider_ids_match("kimi-for-coding", "kimi-code"));
        assert!(!super::provider_ids_match("openai", "anthropic"));
    }

    #[test]
    fn normalize_auth_provider_input_maps_kimi_code_alias() {
        assert_eq!(
            super::normalize_auth_provider_input("kimi-code"),
            "kimi-for-coding"
        );
    }

    #[test]
    fn resolve_scoped_model_entries_dedupes_provider_alias_variants() {
        let available = vec![
            test_model_entry("openrouter", "openai/gpt-4o-mini"),
            test_model_entry("open-router", "openai/gpt-4o-mini"),
        ];
        let patterns = vec!["openrouter/openai/gpt-4o-mini".to_string()];
        let resolved = super::resolve_scoped_model_entries(&patterns, &available)
            .expect("resolve scoped models");
        assert_eq!(resolved.len(), 1);
        assert_eq!(resolved[0].model.id, "openai/gpt-4o-mini");
    }

    #[test]
    fn save_provider_credential_canonicalizes_alias_input() {
        let mut auth = empty_auth_storage();
        super::save_provider_credential(
            &mut auth,
            "gemini",
            AuthCredential::ApiKey {
                key: "new-google-token".to_string(),
            },
        );

        assert!(auth.get("gemini").is_none());
        assert!(matches!(
            auth.get("google"),
            Some(AuthCredential::ApiKey { key }) if key == "new-google-token"
        ));
    }

    #[test]
    fn resolve_model_key_with_auth_prefers_stored_key_over_inline_key() {
        let mut auth = empty_auth_storage();
        auth.set(
            "openai",
            AuthCredential::ApiKey {
                key: "stored-auth-token".to_string(),
            },
        );

        let mut entry = test_model_entry("openai", "gpt-4o-mini");
        entry.api_key = Some("inline-model-token".to_string());

        assert_eq!(
            super::resolve_model_key_with_auth(&auth, &entry).as_deref(),
            Some("stored-auth-token")
        );
    }

    #[test]
    fn resolve_model_key_with_auth_falls_back_to_inline_key() {
        let auth = empty_auth_storage();
        let mut entry = test_model_entry("openai", "gpt-4o-mini");
        entry.api_key = Some("inline-model-token".to_string());

        assert_eq!(
            super::resolve_model_key_with_auth(&auth, &entry).as_deref(),
            Some("inline-model-token")
        );
    }

    #[test]
    fn remove_provider_credentials_removes_alias_entries() {
        let mut auth = empty_auth_storage();
        auth.set(
            "google",
            AuthCredential::ApiKey {
                key: "google-key".to_string(),
            },
        );
        auth.set(
            "gemini",
            AuthCredential::ApiKey {
                key: "gemini-key".to_string(),
            },
        );

        assert!(super::remove_provider_credentials(&mut auth, "gemini"));
        assert!(auth.get("google").is_none());
        assert!(auth.get("gemini").is_none());
    }

    #[test]
    fn extension_oauth_config_selection_skips_non_oauth_entries() {
        let mut no_oauth = test_model_entry("ext-provider", "model-a");
        no_oauth.oauth_config = None;
        let mut with_oauth = test_model_entry("ext-provider", "model-b");
        with_oauth.api_key = None;
        with_oauth.oauth_config = Some(crate::models::OAuthConfig {
            auth_url: "https://example.test/oauth/authorize".to_string(),
            token_url: "https://example.test/oauth/token".to_string(),
            scopes: vec!["scope:a".to_string()],
            client_id: "client-id".to_string(),
            redirect_uri: Some("http://localhost/callback".to_string()),
        });

        let selected =
            super::extension_oauth_config_for_provider(&[no_oauth, with_oauth], "ext-provider");
        let selected = selected.expect("expected oauth config");
        assert_eq!(selected.auth_url, "https://example.test/oauth/authorize");
        assert_eq!(selected.token_url, "https://example.test/oauth/token");
        assert_eq!(selected.client_id, "client-id");
        assert_eq!(selected.scopes, vec!["scope:a".to_string()]);
        assert_eq!(
            selected.redirect_uri.as_deref(),
            Some("http://localhost/callback")
        );
    }

    #[test]
    fn collect_extension_oauth_providers_includes_pre_auth_extension_entries() {
        let mut ext_entry = test_model_entry("ext-provider", "model-a");
        ext_entry.api_key = None;
        ext_entry.oauth_config = Some(crate::models::OAuthConfig {
            auth_url: "https://example.test/oauth/authorize".to_string(),
            token_url: "https://example.test/oauth/token".to_string(),
            scopes: vec!["scope:a".to_string()],
            client_id: "client-id".to_string(),
            redirect_uri: None,
        });

        let providers = super::collect_extension_oauth_providers(&[ext_entry]);
        assert_eq!(providers, vec!["ext-provider".to_string()]);
    }
}
