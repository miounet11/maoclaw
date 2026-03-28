//! Local localhost bridge used by the web and desktop surfaces.
//!
//! Phase 1 implements the accepted browser-local contract:
//! - `GET /healthz` and aliases
//! - `POST /link/redeem` and alias
//! - `POST /rpc` and aliases for read-only commands
//! - `POST /skills/install` and aliases for tightly scoped SkillHub installs
//!
//! The bridge does not pretend to be a full cloud-authenticated daemon yet.
//! Link redemption is persisted locally and reported honestly as local-only.

use crate::agent_cx::AgentCx;
use crate::config::{Config, SettingsScope};
use crate::error::{Error, Result};
use crate::model::{ContentBlock, Message};
use crate::models::ModelEntry;
use crate::provider_metadata::provider_ids_match;
use crate::session::{Session, SessionEntry, SessionMessage};
use asupersync::sync::Mutex as AsyncMutex;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::io::{BufRead, BufReader, Read, Write};
use std::net::{IpAddr, Ipv4Addr, SocketAddr, TcpListener, TcpStream};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex as StdMutex};
use std::time::Duration;
use url::Url;

pub const DEFAULT_BRIDGE_PORT: u16 = 43115;
const MAX_HTTP_HEADERS_BYTES: usize = 64 * 1024;
const MAX_HTTP_BODY_BYTES: usize = 1024 * 1024;
const DEFAULT_ALLOWED_ORIGINS: &[&str] = &["https://xinxiang.xin", "http://localhost:3000"];

// ── Bridge config ─────────────────────────────────────────────────────────────

/// User-facing bridge settings persisted in the maoclaw config.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BridgeSettings {
    /// Whether the user has enabled local bridge linking.
    #[serde(default)]
    pub enabled: bool,
    /// The port the bridge listens on. Defaults to 43115.
    #[serde(default = "default_bridge_port")]
    pub port: u16,
    /// Web control-plane URL this bridge registers with.
    pub control_plane_url: Option<String>,
    /// Device label shown in the web UI.
    pub device_label: Option<String>,
    /// Registered device id (set after first successful handshake).
    pub device_id: Option<String>,
    /// Scopes the web plane is allowed to perform on this device.
    #[serde(default)]
    pub allowed_scopes: Vec<BridgeScope>,
}

impl Default for BridgeSettings {
    fn default() -> Self {
        Self {
            enabled: false,
            port: default_bridge_port(),
            control_plane_url: None,
            device_label: None,
            device_id: None,
            allowed_scopes: Vec::new(),
        }
    }
}

pub const fn default_bridge_port() -> u16 {
    DEFAULT_BRIDGE_PORT
}

/// Permissions the web control plane may invoke on this device.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum BridgeScope {
    /// Read system list and metadata.
    SystemsRead,
    /// Read artifact index.
    ArtifactsRead,
    /// Approve and launch remote tasks.
    RemoteLaunch,
    /// Sync vault snapshot manifests (not content).
    VaultMetadataSync,
    /// Sync artifact records to the web.
    ArtifactSync,
}

impl BridgeScope {
    pub const fn label(&self) -> &'static str {
        match self {
            Self::SystemsRead => "systems:read",
            Self::ArtifactsRead => "artifacts:read",
            Self::RemoteLaunch => "remote:launch",
            Self::VaultMetadataSync => "vault:metadata_sync",
            Self::ArtifactSync => "artifact:sync",
        }
    }
}

// ── Handshake ─────────────────────────────────────────────────────────────────

/// A pairing challenge the user presents to the web UI to authorise linking.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BridgeHandshakeChallenge {
    pub challenge_id: String,
    /// Short code displayed in the TUI for the user to copy into the web UI.
    pub code: String,
    /// Requested scopes this handshake will grant.
    pub requested_scopes: Vec<BridgeScope>,
    pub expires_in_minutes: u32,
    pub created_at: String,
}

impl BridgeHandshakeChallenge {
    /// Generate a new pairing challenge.  The code is a base-36 encoded
    /// truncation of the current timestamp — good enough for a display code.
    pub fn generate(scopes: Vec<BridgeScope>) -> Self {
        use std::time::{SystemTime, UNIX_EPOCH};
        let secs = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        // 6-character alphanumeric display code
        let code = format!("{:06}", secs % 1_000_000);
        Self {
            challenge_id: format!("chal_{secs:x}"),
            code,
            requested_scopes: scopes,
            expires_in_minutes: 10,
            created_at: now_rfc3339(),
        }
    }
}

// ── Bridge state ──────────────────────────────────────────────────────────────

/// Runtime state of the bridge (in-memory, not persisted).
#[derive(Debug, Clone, Default)]
pub struct BridgeState {
    pub settings: BridgeSettings,
    pub status: BridgeStatus,
    pub pending_challenge: Option<BridgeHandshakeChallenge>,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum BridgeStatus {
    #[default]
    Disabled,
    /// Challenge generated, waiting for web confirmation.
    AwaitingHandshake,
    /// Linked and ready for web traffic.
    Linked,
    /// Bridge errored.
    Error(String),
}

impl BridgeStatus {
    pub const fn label(&self) -> &'static str {
        match self {
            Self::Disabled => "disabled",
            Self::AwaitingHandshake => "awaiting handshake",
            Self::Linked => "linked",
            Self::Error(_) => "error",
        }
    }
}

impl BridgeState {
    pub const fn new(settings: BridgeSettings) -> Self {
        let status = if settings.enabled && settings.device_id.is_some() {
            BridgeStatus::Linked
        } else {
            BridgeStatus::Disabled
        };
        Self {
            settings,
            status,
            pending_challenge: None,
        }
    }

    /// Start the pairing flow: generate a challenge and set status.
    pub fn begin_pairing(&mut self, scopes: Vec<BridgeScope>) -> &BridgeHandshakeChallenge {
        let challenge = BridgeHandshakeChallenge::generate(scopes);
        self.pending_challenge = Some(challenge);
        self.status = BridgeStatus::AwaitingHandshake;
        self.pending_challenge.as_ref().unwrap()
    }

    /// Mark the bridge as successfully linked with a device id.
    pub fn confirm_linked(&mut self, device_id: impl Into<String>) {
        self.settings.device_id = Some(device_id.into());
        self.settings.enabled = true;
        self.pending_challenge = None;
        self.status = BridgeStatus::Linked;
    }

    pub fn disconnect(&mut self) {
        self.settings.device_id = None;
        self.settings.enabled = false;
        self.pending_challenge = None;
        self.status = BridgeStatus::Disabled;
    }

    pub fn is_linked(&self) -> bool {
        self.status == BridgeStatus::Linked
    }
}

#[derive(Debug, Clone)]
pub struct LocalBridgeOptions {
    pub bind_addr: SocketAddr,
    pub allowed_origins: Vec<String>,
    pub global_dir: PathBuf,
    pub cwd: PathBuf,
    pub skillhub_bin: String,
}

impl LocalBridgeOptions {
    pub fn from_config(config: &Config, global_dir: &Path, cwd: &Path) -> Self {
        let settings = config.bridge.clone().unwrap_or_default();
        let port = std::env::var("PI_BRIDGE_PORT")
            .ok()
            .and_then(|value| value.parse::<u16>().ok())
            .unwrap_or(settings.port);
        Self {
            bind_addr: SocketAddr::new(IpAddr::V4(Ipv4Addr::LOCALHOST), port),
            allowed_origins: resolve_allowed_origins(),
            global_dir: global_dir.to_path_buf(),
            cwd: cwd.to_path_buf(),
            skillhub_bin: std::env::var("PI_BRIDGE_SKILLHUB_BIN")
                .ok()
                .filter(|value| !value.trim().is_empty())
                .unwrap_or_else(|| "skillhub".to_string()),
        }
    }
}

// ── Remote launch request ─────────────────────────────────────────────────────

/// A task launch request arriving from the web control plane.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RemoteLaunchRequest {
    pub request_id: String,
    pub system_id: String,
    pub task_title: String,
    pub prompt: String,
    pub execution_target: RemoteExecutionTarget,
    pub approved: bool,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RemoteExecutionTarget {
    Local,
    Cloud { host_id: String },
    Hybrid,
}

impl RemoteLaunchRequest {
    pub const fn approve(&mut self) {
        self.approved = true;
    }
}

// ── Status summary ─────────────────────────────────────────────────────────────

/// Human-readable bridge status block for TUI display.
pub fn format_bridge_status(state: &BridgeState) -> String {
    use std::fmt::Write;
    let mut out = String::new();
    let _ = writeln!(out, "Bridge status: {}", state.status.label());
    if state.settings.enabled {
        let _ = writeln!(out, "  Port: {}", state.settings.port);
        if let Some(url) = &state.settings.control_plane_url {
            let _ = writeln!(out, "  Control plane: {url}");
        }
        if let Some(dev) = &state.settings.device_id {
            let _ = writeln!(out, "  Device id: {dev}");
        }
        if !state.settings.allowed_scopes.is_empty() {
            let scopes: Vec<&str> = state
                .settings
                .allowed_scopes
                .iter()
                .map(BridgeScope::label)
                .collect();
            let _ = writeln!(out, "  Scopes: {}", scopes.join(", "));
        }
    }
    if let Some(ch) = &state.pending_challenge {
        let _ = writeln!(
            out,
            "  Pairing code: {} (expires in {}m)",
            ch.code, ch.expires_in_minutes
        );
    }
    out
}

pub fn run_local_bridge(
    session: Arc<AsyncMutex<Session>>,
    config: Config,
    available_models: Vec<ModelEntry>,
    options: LocalBridgeOptions,
) -> Result<()> {
    let stop = Arc::new(AtomicBool::new(false));
    let stop_for_signal = Arc::clone(&stop);
    if let Err(err) = ctrlc::set_handler(move || {
        stop_for_signal.store(true, Ordering::SeqCst);
    }) {
        eprintln!("Warning: Failed to install Ctrl+C handler for bridge mode: {err}");
    }

    let settings = config.bridge.clone().unwrap_or_default();
    run_local_bridge_until(session, config, available_models, options, settings, &stop)
}

fn run_local_bridge_until(
    session: Arc<AsyncMutex<Session>>,
    config: Config,
    available_models: Vec<ModelEntry>,
    options: LocalBridgeOptions,
    settings: BridgeSettings,
    stop: &Arc<AtomicBool>,
) -> Result<()> {
    let listener = TcpListener::bind(options.bind_addr).map_err(|err| {
        Error::config(format!(
            "Failed to bind local bridge on {}: {err}",
            options.bind_addr
        ))
    })?;
    listener
        .set_nonblocking(true)
        .map_err(|err| Error::Io(Box::new(err)))?;

    let context = BridgeContext {
        session,
        config,
        available_models,
        options,
        state: Arc::new(StdMutex::new(BridgeState::new(settings))),
    };

    eprintln!(
        "maoclaw local bridge listening on http://{}",
        context.options.bind_addr
    );

    while !stop.load(Ordering::SeqCst) {
        match listener.accept() {
            Ok((stream, _)) => {
                let _ = handle_connection(stream, &context);
            }
            Err(err) if err.kind() == std::io::ErrorKind::WouldBlock => {
                std::thread::sleep(Duration::from_millis(40));
            }
            Err(err) => return Err(Error::Io(Box::new(err))),
        }
    }

    Ok(())
}

#[derive(Clone)]
struct BridgeContext {
    session: Arc<AsyncMutex<Session>>,
    config: Config,
    available_models: Vec<ModelEntry>,
    options: LocalBridgeOptions,
    state: Arc<StdMutex<BridgeState>>,
}

#[derive(Debug)]
struct HttpRequest {
    method: String,
    path: String,
    headers: HashMap<String, String>,
    body: Vec<u8>,
}

#[derive(Debug)]
struct HttpResponse {
    status: u16,
    reason: &'static str,
    headers: Vec<(String, String)>,
    body: Vec<u8>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct LinkRedeemRequest {
    challenge_id: String,
    code: String,
    app_url: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SkillInstallRequest {
    slug: String,
    scope: Option<String>,
}

fn resolve_allowed_origins() -> Vec<String> {
    let mut origins = DEFAULT_ALLOWED_ORIGINS
        .iter()
        .map(std::string::ToString::to_string)
        .collect::<Vec<_>>();

    if let Ok(extra) = std::env::var("PI_BRIDGE_ALLOWED_ORIGINS") {
        for item in extra
            .split(',')
            .map(str::trim)
            .filter(|item| !item.is_empty())
        {
            if let Some(origin) = canonical_origin(item)
                && !origins.iter().any(|existing| existing == &origin)
            {
                origins.push(origin);
            }
        }
    }

    origins
}

fn canonical_origin(value: &str) -> Option<String> {
    let url = Url::parse(value).ok()?;
    match (url.scheme(), url.host_str()) {
        ("http" | "https", Some(host)) => {
            let mut origin = format!("{}://{}", url.scheme(), host);
            if let Some(port) = url.port() {
                origin.push(':');
                origin.push_str(&port.to_string());
            }
            Some(origin)
        }
        _ => None,
    }
}

fn handle_connection(mut stream: TcpStream, context: &BridgeContext) -> Result<()> {
    stream
        .set_read_timeout(Some(Duration::from_secs(2)))
        .map_err(|err| Error::Io(Box::new(err)))?;
    stream
        .set_write_timeout(Some(Duration::from_secs(2)))
        .map_err(|err| Error::Io(Box::new(err)))?;

    let request = match read_http_request(&mut stream) {
        Ok(request) => request,
        Err(err) => {
            write_http_response(
                &mut stream,
                json_response(
                    400,
                    "Bad Request",
                    &json!({ "ok": false, "error": err.to_string() }),
                    None,
                ),
            )?;
            return Ok(());
        }
    };

    let origin = request.headers.get("origin").cloned();
    let cors_origin = match validate_origin(origin.as_deref(), &context.options.allowed_origins) {
        Ok(origin) => origin,
        Err(err) => {
            write_http_response(
                &mut stream,
                json_response(
                    403,
                    "Forbidden",
                    &json!({ "ok": false, "error": err.to_string() }),
                    None,
                ),
            )?;
            return Ok(());
        }
    };

    let response = route_request(&request, context, cors_origin.as_deref());
    write_http_response(&mut stream, response)?;
    Ok(())
}

fn read_http_request(stream: &mut TcpStream) -> Result<HttpRequest> {
    let mut reader = BufReader::new(stream);
    let mut raw = Vec::new();

    loop {
        let available = reader.fill_buf().map_err(|err| Error::Io(Box::new(err)))?;
        if available.is_empty() {
            break;
        }
        raw.extend_from_slice(available);
        let consumed = available.len();
        reader.consume(consumed);
        if raw.windows(4).any(|window| window == b"\r\n\r\n") {
            break;
        }
        if raw.len() > MAX_HTTP_HEADERS_BYTES {
            return Err(Error::validation("HTTP headers exceed bridge limit"));
        }
    }

    let Some(header_end) = raw.windows(4).position(|window| window == b"\r\n\r\n") else {
        return Err(Error::validation("Incomplete HTTP request"));
    };

    let header_bytes = &raw[..header_end];
    let header_text = String::from_utf8(header_bytes.to_vec())
        .map_err(|_| Error::validation("HTTP request headers must be UTF-8"))?;
    let mut lines = header_text.split("\r\n");
    let request_line = lines
        .next()
        .ok_or_else(|| Error::validation("Missing HTTP request line"))?;
    let mut request_parts = request_line.split_whitespace();
    let method = request_parts
        .next()
        .ok_or_else(|| Error::validation("Missing HTTP method"))?
        .to_string();
    let path = request_parts
        .next()
        .ok_or_else(|| Error::validation("Missing HTTP path"))?
        .split('?')
        .next()
        .unwrap_or("/")
        .to_string();

    let mut headers = HashMap::new();
    for line in lines {
        let Some((name, value)) = line.split_once(':') else {
            continue;
        };
        headers.insert(name.trim().to_ascii_lowercase(), value.trim().to_string());
    }

    let content_length = headers
        .get("content-length")
        .and_then(|value| value.parse::<usize>().ok())
        .unwrap_or(0);
    if content_length > MAX_HTTP_BODY_BYTES {
        return Err(Error::validation("HTTP request body exceeds bridge limit"));
    }

    let body_start = header_end + 4;
    let mut body = raw[body_start..].to_vec();
    while body.len() < content_length {
        let remaining = content_length - body.len();
        let chunk_len = remaining.min(8 * 1024);
        let mut chunk = vec![0_u8; chunk_len];
        let read = reader
            .read(&mut chunk)
            .map_err(|err| Error::Io(Box::new(err)))?;
        if read == 0 {
            break;
        }
        body.extend_from_slice(&chunk[..read]);
    }
    body.truncate(content_length);

    Ok(HttpRequest {
        method,
        path,
        headers,
        body,
    })
}

fn validate_origin(origin: Option<&str>, allowed_origins: &[String]) -> Result<Option<String>> {
    let Some(origin) = origin else {
        return Ok(None);
    };
    let Some(origin) = canonical_origin(origin) else {
        return Err(Error::validation(
            "Origin header is not a valid HTTP(S) origin",
        ));
    };
    if allowed_origins.iter().any(|allowed| allowed == &origin) {
        Ok(Some(origin))
    } else {
        Err(Error::auth(format!(
            "Origin {origin} is not allowed to access the local bridge"
        )))
    }
}

fn route_request(
    request: &HttpRequest,
    context: &BridgeContext,
    cors_origin: Option<&str>,
) -> HttpResponse {
    if request.method.eq_ignore_ascii_case("OPTIONS") {
        return empty_response(204, "No Content", cors_origin);
    }

    let result = match (request.method.as_str(), request.path.as_str()) {
        ("GET", "/healthz" | "/v1/healthz" | "/bridge/health") => handle_health(context),
        ("POST", "/link/redeem" | "/v1/link/redeem") => handle_link_redeem(request, context),
        ("POST", "/rpc" | "/v1/rpc" | "/bridge/rpc") => handle_rpc_proxy(request, context),
        ("POST", "/skills/install" | "/v1/skills/install" | "/bridge/skills/install") => {
            handle_skill_install(request, context)
        }
        _ => Ok(json!({
            "ok": false,
            "error": "Not found",
        })),
    };

    match result {
        Ok(payload) => {
            let status = if payload.get("ok") == Some(&Value::Bool(false))
                && payload.get("error").is_some()
                && payload.get("type").is_none()
            {
                404
            } else {
                200
            };
            json_response(
                status,
                if status == 404 { "Not Found" } else { "OK" },
                &payload,
                cors_origin,
            )
        }
        Err(err) => {
            let status = match &err {
                Error::Auth(_) => 403,
                Error::Validation(_) => 400,
                _ => 500,
            };
            json_response(
                status,
                match status {
                    400 => "Bad Request",
                    403 => "Forbidden",
                    _ => "Internal Server Error",
                },
                &json!({
                    "ok": false,
                    "error": err.to_string(),
                }),
                cors_origin,
            )
        }
    }
}

fn handle_health(context: &BridgeContext) -> Result<Value> {
    let session_id = context.with_session(|session| session.header.id.clone())?;
    let state = context
        .state
        .lock()
        .map_err(|_| Error::session("Bridge state lock poisoned"))?
        .clone();

    Ok(json!({
        "ok": true,
        "connected": state.is_linked(),
        "deviceId": state.settings.device_id,
        "sessionId": session_id,
        "runtimeReady": true,
        "version": env!("CARGO_PKG_VERSION"),
    }))
}

fn handle_link_redeem(request: &HttpRequest, context: &BridgeContext) -> Result<Value> {
    let payload: LinkRedeemRequest =
        serde_json::from_slice(&request.body).map_err(|err| Error::validation(err.to_string()))?;
    if payload.challenge_id.trim().is_empty() {
        return Err(Error::validation("challengeId must not be empty"));
    }
    if payload.code.trim().len() != 6 || !payload.code.chars().all(|ch| ch.is_ascii_digit()) {
        return Err(Error::validation("code must be a 6-digit string"));
    }

    let app_origin = canonical_origin(&payload.app_url)
        .ok_or_else(|| Error::validation("appUrl must be a valid HTTP(S) origin"))?;
    if !context
        .options
        .allowed_origins
        .iter()
        .any(|origin| origin == &app_origin)
    {
        return Err(Error::auth(format!(
            "App URL origin {app_origin} is not allowed"
        )));
    }

    let device_id = build_local_device_id(&payload.challenge_id, &payload.code);
    let persisted = {
        let mut state = context
            .state
            .lock()
            .map_err(|_| Error::session("Bridge state lock poisoned"))?;
        state.settings.control_plane_url = Some(app_origin);
        state.confirm_linked(device_id.clone());
        if state.settings.allowed_scopes.is_empty() {
            state.settings.allowed_scopes = vec![BridgeScope::SystemsRead];
        }
        state.settings.clone()
    };

    Config::patch_settings_with_roots(
        SettingsScope::Global,
        &context.options.global_dir,
        &context.options.cwd,
        json!({ "bridge": persisted }),
    )?;

    Ok(json!({
        "ok": true,
        "linked": true,
        "deviceId": device_id,
        "runtimeReady": true,
        "cloudValidated": false,
    }))
}

fn handle_rpc_proxy(request: &HttpRequest, context: &BridgeContext) -> Result<Value> {
    let envelope: Value =
        serde_json::from_slice(&request.body).map_err(|err| Error::validation(err.to_string()))?;
    let id = envelope
        .get("id")
        .and_then(Value::as_str)
        .map(std::string::ToString::to_string);
    let command = envelope
        .get("type")
        .and_then(Value::as_str)
        .ok_or_else(|| Error::validation("Missing command type"))?;
    let normalized = normalize_bridge_rpc_command(command);

    match normalized {
        "get_state" => {
            let data = context.with_session(|session| {
                bridge_session_state(session, &context.available_models, &context.config)
            })?;
            Ok(rpc_ok_value(id, "get_state", data))
        }
        "get_messages" => {
            let data = context
                .with_session(|session| json!({ "messages": bridge_session_messages(session) }))?;
            Ok(rpc_ok_value(id, "get_messages", data))
        }
        "get_session_stats" => {
            let data = context.with_session(bridge_session_stats)?;
            Ok(rpc_ok_value(id, "get_session_stats", data))
        }
        _ => Ok(rpc_error_value(
            id,
            normalized,
            format!("Bridge only supports read commands; received {command}"),
        )),
    }
}

fn handle_skill_install(request: &HttpRequest, context: &BridgeContext) -> Result<Value> {
    let payload: SkillInstallRequest =
        serde_json::from_slice(&request.body).map_err(|err| Error::validation(err.to_string()))?;
    let slug = payload.slug.trim();
    if slug.is_empty() {
        return Err(Error::validation("slug must not be empty"));
    }
    if !slug
        .chars()
        .all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '-' | '_' | '.'))
    {
        return Err(Error::validation(
            "slug may only contain ASCII letters, digits, '.', '-', and '_'",
        ));
    }

    let scope = payload.scope.unwrap_or_else(|| "global".to_string());
    if scope != "global" && scope != "project" {
        return Err(Error::validation("scope must be 'global' or 'project'"));
    }

    let install_root = if scope == "project" {
        &context.options.cwd
    } else {
        &context.options.global_dir
    };

    let output = Command::new(&context.options.skillhub_bin)
        .args(["install", slug])
        .current_dir(install_root)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .map_err(|err| {
            Error::tool(
                "bridge.skill_install",
                format!(
                    "Failed to start SkillHub installer '{}': {err}",
                    context.options.skillhub_bin
                ),
            )
        })?;

    let stdout = trim_bridge_command_output(&output.stdout);
    let stderr = trim_bridge_command_output(&output.stderr);

    if !output.status.success() {
        let code = output.status.code().unwrap_or_default();
        let error = if stderr.is_empty() {
            format!("SkillHub install exited with status {code}")
        } else {
            stderr.clone()
        };
        return Ok(json!({
            "ok": false,
            "error": error,
            "code": "skill_install_failed",
            "slug": slug,
            "scope": scope,
            "exitCode": code,
            "stdout": stdout,
            "stderr": stderr,
        }));
    }

    Ok(json!({
        "ok": true,
        "installed": true,
        "slug": slug,
        "scope": scope,
        "cwd": install_root,
        "stdout": stdout,
        "stderr": stderr,
    }))
}

fn trim_bridge_command_output(bytes: &[u8]) -> String {
    const MAX_LEN: usize = 1200;
    let text = String::from_utf8_lossy(bytes).trim().to_string();
    if text.len() <= MAX_LEN {
        text
    } else {
        format!("{}…", text.chars().take(MAX_LEN - 1).collect::<String>())
    }
}

impl BridgeContext {
    fn with_session<T>(&self, f: impl FnOnce(&Session) -> T) -> Result<T> {
        let session = Arc::clone(&self.session);
        futures::executor::block_on(async move {
            let cx = AgentCx::for_request();
            let session = session
                .lock(cx.cx())
                .await
                .map_err(|err| Error::session(format!("Bridge session lock failed: {err}")))?;
            Ok(f(&session))
        })
    }
}

fn normalize_bridge_rpc_command(command: &str) -> &str {
    match command {
        "get-state" | "getState" => "get_state",
        "get-messages" | "getMessages" => "get_messages",
        "get-session-stats" | "getSessionStats" => "get_session_stats",
        _ => command,
    }
}

fn build_local_device_id(challenge_id: &str, code: &str) -> String {
    let mut digest = Sha256::new();
    digest.update(challenge_id.as_bytes());
    digest.update(b":");
    digest.update(code.as_bytes());
    let hash = digest.finalize();
    let mut suffix = String::new();
    for byte in hash.iter().take(6) {
        use std::fmt::Write as _;
        let _ = write!(&mut suffix, "{byte:02x}");
    }
    format!("dev_local_{suffix}")
}

fn bridge_session_state(
    session: &Session,
    available_models: &[ModelEntry],
    config: &Config,
) -> Value {
    let model = session
        .header
        .provider
        .as_deref()
        .zip(session.header.model_id.as_deref())
        .and_then(|(provider, model_id)| {
            available_models.iter().find(|entry| {
                provider_ids_match(&entry.model.provider, provider)
                    && entry.model.id.eq_ignore_ascii_case(model_id)
            })
        })
        .map_or_else(
            || {
                session
                    .header
                    .provider
                    .as_ref()
                    .zip(session.header.model_id.as_ref())
                    .map_or(Value::Null, |(provider, model_id)| {
                        json!({
                            "provider": provider,
                            "id": model_id,
                        })
                    })
            },
            rpc_model_from_entry,
        );

    let message_count = session
        .entries_for_current_path()
        .iter()
        .filter(|entry| matches!(entry, SessionEntry::Message(_)))
        .count();

    json!({
        "model": model,
        "thinkingLevel": session.header.thinking_level.clone().unwrap_or_else(|| "off".to_string()),
        "isStreaming": false,
        "isCompacting": false,
        "steeringMode": config.steering_queue_mode().as_str(),
        "followUpMode": config.follow_up_queue_mode().as_str(),
        "sessionFile": session.path.as_ref().map(|path| path.display().to_string()),
        "sessionId": session.header.id.clone(),
        "sessionName": session.get_name(),
        "autoCompactionEnabled": config.compaction_enabled(),
        "messageCount": message_count,
        "pendingMessageCount": session.autosave_metrics().pending_mutations,
        "durabilityMode": session.autosave_durability_mode().as_str(),
    })
}

fn bridge_session_messages(session: &Session) -> Vec<Value> {
    session
        .entries_for_current_path()
        .iter()
        .filter_map(|entry| match entry {
            SessionEntry::Message(message_entry) => match &message_entry.message {
                SessionMessage::User { .. }
                | SessionMessage::Assistant { .. }
                | SessionMessage::ToolResult { .. }
                | SessionMessage::BashExecution { .. }
                | SessionMessage::Custom { .. } => {
                    Some(rpc_session_message_value(message_entry.message.clone()))
                }
                _ => None,
            },
            _ => None,
        })
        .collect()
}

#[allow(clippy::too_many_lines)]
fn bridge_session_stats(session: &Session) -> Value {
    let mut user_messages: u64 = 0;
    let mut assistant_messages: u64 = 0;
    let mut tool_results: u64 = 0;
    let mut tool_calls: u64 = 0;
    let mut total_input: u64 = 0;
    let mut total_output: u64 = 0;
    let mut total_cache_read: u64 = 0;
    let mut total_cache_write: u64 = 0;
    let mut total_cost: f64 = 0.0;

    let messages = session.to_messages_for_current_path();
    for message in &messages {
        match message {
            Message::User(_) | Message::Custom(_) => user_messages += 1,
            Message::Assistant(message) => {
                assistant_messages += 1;
                tool_calls += message
                    .content
                    .iter()
                    .filter(|block| matches!(block, ContentBlock::ToolCall(_)))
                    .count() as u64;
                total_input += message.usage.input;
                total_output += message.usage.output;
                total_cache_read += message.usage.cache_read;
                total_cache_write += message.usage.cache_write;
                total_cost += message.usage.cost.total;
            }
            Message::ToolResult(_) => tool_results += 1,
        }
    }

    let total_messages = messages.len() as u64;
    let total_tokens = total_input + total_output + total_cache_read + total_cache_write;
    let autosave = session.autosave_metrics();
    let pending_message_count = autosave.pending_mutations as u64;
    let durability_mode = session.autosave_durability_mode();
    let durability_mode_label = durability_mode.as_str();
    let (status_event, status_severity, status_summary, status_action, status_sli_ids) =
        if pending_message_count == 0 {
            (
                "session.persistence.healthy",
                "ok",
                "Persistence queue is clear.",
                "No action required.",
                vec!["sli_resume_ready_p95_ms"],
            )
        } else {
            let summary = match durability_mode {
                crate::session::AutosaveDurabilityMode::Strict => {
                    "Pending persistence backlog under strict durability mode."
                }
                crate::session::AutosaveDurabilityMode::Balanced => {
                    "Pending persistence backlog under balanced durability mode."
                }
                crate::session::AutosaveDurabilityMode::Throughput => {
                    "Pending persistence backlog under throughput durability mode."
                }
            };
            let action = match durability_mode {
                crate::session::AutosaveDurabilityMode::Throughput => {
                    "Expect deferred writes; trigger manual save before critical transitions."
                }
                _ => "Allow autosave flush to complete or trigger manual save before exit.",
            };
            (
                "session.persistence.backlog",
                "warning",
                summary,
                action,
                vec![
                    "sli_resume_ready_p95_ms",
                    "sli_failure_recovery_success_rate",
                ],
            )
        };

    json!({
        "sessionFile": session.path.as_ref().map(|path| path.display().to_string()),
        "sessionId": session.header.id.clone(),
        "userMessages": user_messages,
        "assistantMessages": assistant_messages,
        "toolCalls": tool_calls,
        "toolResults": tool_results,
        "totalMessages": total_messages,
        "durabilityMode": durability_mode_label,
        "pendingMessageCount": pending_message_count,
        "tokens": {
            "input": total_input,
            "output": total_output,
            "cacheRead": total_cache_read,
            "cacheWrite": total_cache_write,
            "total": total_tokens,
        },
        "persistenceStatus": {
            "event": status_event,
            "severity": status_severity,
            "summary": status_summary,
            "action": status_action,
            "sliIds": status_sli_ids,
            "pendingMessageCount": pending_message_count,
            "flushCounters": {
                "started": autosave.flush_started,
                "succeeded": autosave.flush_succeeded,
                "failed": autosave.flush_failed,
            },
        },
        "uxEventMarkers": [
            {
                "event": status_event,
                "severity": status_severity,
                "durabilityMode": durability_mode_label,
                "pendingMessageCount": pending_message_count,
                "sliIds": status_sli_ids,
            }
        ],
        "cost": total_cost,
    })
}

fn rpc_model_from_entry(entry: &ModelEntry) -> Value {
    let input = entry
        .model
        .input
        .iter()
        .map(|input_type| match input_type {
            crate::provider::InputType::Text => "text",
            crate::provider::InputType::Image => "image",
        })
        .collect::<Vec<_>>();

    json!({
        "id": entry.model.id,
        "name": entry.model.name,
        "api": entry.model.api,
        "provider": entry.model.provider,
        "baseUrl": entry.model.base_url,
        "reasoning": entry.model.reasoning,
        "input": input,
        "contextWindow": entry.model.context_window,
        "maxTokens": entry.model.max_tokens,
        "cost": entry.model.cost,
    })
}

fn rpc_session_message_value(message: SessionMessage) -> Value {
    let mut value =
        serde_json::to_value(message).expect("SessionMessage should always serialize to JSON");
    rpc_flatten_content_blocks(&mut value);
    value
}

fn rpc_flatten_content_blocks(value: &mut Value) {
    let Value::Object(message_obj) = value else {
        return;
    };
    let Some(content) = message_obj.get_mut("content") else {
        return;
    };
    let Value::Array(blocks) = content else {
        return;
    };

    for block in blocks {
        let Value::Object(block_obj) = block else {
            continue;
        };
        let Some(inner) = block_obj.remove("0") else {
            continue;
        };
        let Value::Object(inner_obj) = inner else {
            block_obj.insert("0".to_string(), inner);
            continue;
        };
        for (key, value) in inner_obj {
            block_obj.entry(key).or_insert(value);
        }
    }
}

fn rpc_ok_value(id: Option<String>, command: &str, data: Value) -> Value {
    let mut response = serde_json::Map::new();
    response.insert("type".to_string(), Value::String("response".to_string()));
    response.insert("command".to_string(), Value::String(command.to_string()));
    response.insert("success".to_string(), Value::Bool(true));
    response.insert("data".to_string(), data);
    if let Some(id) = id {
        response.insert("id".to_string(), Value::String(id));
    }
    Value::Object(response)
}

fn rpc_error_value(id: Option<String>, command: &str, error: impl Into<String>) -> Value {
    let mut response = serde_json::Map::new();
    response.insert("type".to_string(), Value::String("response".to_string()));
    response.insert("command".to_string(), Value::String(command.to_string()));
    response.insert("success".to_string(), Value::Bool(false));
    response.insert("error".to_string(), Value::String(error.into()));
    if let Some(id) = id {
        response.insert("id".to_string(), Value::String(id));
    }
    Value::Object(response)
}

fn json_response(
    status: u16,
    reason: &'static str,
    payload: &Value,
    cors_origin: Option<&str>,
) -> HttpResponse {
    let body = serde_json::to_vec(payload).expect("bridge response JSON should serialize");
    let mut headers = vec![
        ("Content-Type".to_string(), "application/json".to_string()),
        ("Content-Length".to_string(), body.len().to_string()),
        ("Connection".to_string(), "close".to_string()),
    ];
    if let Some(origin) = cors_origin {
        headers.extend(cors_headers(origin));
    }
    HttpResponse {
        status,
        reason,
        headers,
        body,
    }
}

fn empty_response(status: u16, reason: &'static str, cors_origin: Option<&str>) -> HttpResponse {
    let mut headers = vec![
        ("Content-Length".to_string(), "0".to_string()),
        ("Connection".to_string(), "close".to_string()),
    ];
    if let Some(origin) = cors_origin {
        headers.extend(cors_headers(origin));
    }
    HttpResponse {
        status,
        reason,
        headers,
        body: Vec::new(),
    }
}

fn cors_headers(origin: &str) -> Vec<(String, String)> {
    vec![
        (
            "Access-Control-Allow-Origin".to_string(),
            origin.to_string(),
        ),
        (
            "Access-Control-Allow-Headers".to_string(),
            "Content-Type".to_string(),
        ),
        (
            "Access-Control-Allow-Methods".to_string(),
            "GET, POST, OPTIONS".to_string(),
        ),
        (
            "Access-Control-Allow-Credentials".to_string(),
            "true".to_string(),
        ),
        ("Vary".to_string(), "Origin".to_string()),
    ]
}

fn write_http_response(stream: &mut TcpStream, response: HttpResponse) -> Result<()> {
    let mut encoded = format!("HTTP/1.1 {} {}\r\n", response.status, response.reason);
    for (name, value) in response.headers {
        encoded.push_str(&name);
        encoded.push_str(": ");
        encoded.push_str(&value);
        encoded.push_str("\r\n");
    }
    encoded.push_str("\r\n");
    stream
        .write_all(encoded.as_bytes())
        .map_err(|err| Error::Io(Box::new(err)))?;
    if !response.body.is_empty() {
        stream
            .write_all(&response.body)
            .map_err(|err| Error::Io(Box::new(err)))?;
    }
    stream.flush().map_err(|err| Error::Io(Box::new(err)))?;
    Ok(())
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
    use crate::cli::Cli;
    use asupersync::runtime::RuntimeBuilder;
    use clap::Parser;
    use std::fs;
    #[cfg(unix)]
    use std::os::unix::fs::PermissionsExt;
    use tempfile::TempDir;

    #[test]
    fn begin_pairing_sets_challenge() {
        let mut state = BridgeState::default();
        let ch = state.begin_pairing(vec![BridgeScope::SystemsRead]);
        assert_eq!(ch.code.len(), 6);
        assert_eq!(state.status, BridgeStatus::AwaitingHandshake);
    }

    #[test]
    fn confirm_linked_stores_device_id() {
        let mut state = BridgeState::default();
        state.begin_pairing(vec![BridgeScope::SystemsRead]);
        state.confirm_linked("dev_abc123");
        assert_eq!(state.settings.device_id.as_deref(), Some("dev_abc123"));
        assert!(state.is_linked());
    }

    #[test]
    fn disconnect_resets_state() {
        let mut state = BridgeState::default();
        state.confirm_linked("dev_x");
        state.disconnect();
        assert!(!state.is_linked());
        assert!(state.settings.device_id.is_none());
    }

    #[test]
    fn format_status_disabled() {
        let state = BridgeState::default();
        let out = format_bridge_status(&state);
        assert!(out.contains("disabled"));
    }

    #[test]
    fn format_status_linked() {
        let mut state = BridgeState::default();
        state.confirm_linked("dev_001");
        state.settings.port = DEFAULT_BRIDGE_PORT;
        let out = format_bridge_status(&state);
        assert!(out.contains("linked"));
    }

    #[test]
    fn bridge_settings_default_to_contract_port() {
        assert_eq!(BridgeSettings::default().port, DEFAULT_BRIDGE_PORT);
    }

    #[test]
    fn local_bridge_serves_health_and_read_rpc() {
        let temp = TempDir::new().expect("tempdir");
        let runtime = RuntimeBuilder::new()
            .blocking_threads(1, 4)
            .build()
            .expect("runtime build");

        let listener = TcpListener::bind("127.0.0.1:0").expect("bind test listener");
        let bind_addr = listener.local_addr().expect("listener addr");
        drop(listener);

        let cli = Cli::parse_from(["pi"]);
        let config = Config::default();
        let session = runtime
            .block_on(async { Session::new(&cli, &config).await })
            .expect("create session");
        let session = Arc::new(AsyncMutex::new(session));

        let options = LocalBridgeOptions {
            bind_addr,
            allowed_origins: resolve_allowed_origins(),
            global_dir: temp.path().join("global"),
            cwd: temp.path().join("workspace"),
            skillhub_bin: "skillhub".to_string(),
        };

        let stop = Arc::new(AtomicBool::new(false));
        let server_stop = Arc::clone(&stop);
        let session_for_server = Arc::clone(&session);
        let config_for_server = config;
        let handle = std::thread::spawn(move || {
            run_local_bridge_until(
                session_for_server,
                config_for_server,
                Vec::new(),
                options,
                BridgeSettings::default(),
                &server_stop,
            )
        });

        std::thread::sleep(Duration::from_millis(100));

        let health = http_request(
            bind_addr,
            "GET",
            "/healthz",
            Some("https://xinxiang.xin"),
            None,
        );
        assert!(health.contains("\"ok\":true"));
        assert!(health.contains("\"runtimeReady\":true"));

        let rpc = http_request(
            bind_addr,
            "POST",
            "/rpc",
            Some("https://xinxiang.xin"),
            Some(r#"{"id":"req-1","type":"get_state"}"#),
        );
        assert!(rpc.contains("\"command\":\"get_state\""));
        assert!(rpc.contains("\"success\":true"));

        stop.store(true, Ordering::SeqCst);
        let _ = TcpStream::connect(bind_addr);
        handle.join().expect("join bridge").expect("bridge run");
    }

    #[test]
    fn local_bridge_rejects_unknown_origins() {
        let temp = TempDir::new().expect("tempdir");
        let runtime = RuntimeBuilder::new()
            .blocking_threads(1, 4)
            .build()
            .expect("runtime build");

        let listener = TcpListener::bind("127.0.0.1:0").expect("bind test listener");
        let bind_addr = listener.local_addr().expect("listener addr");
        drop(listener);

        let cli = Cli::parse_from(["pi"]);
        let config = Config::default();
        let session = runtime
            .block_on(async { Session::new(&cli, &config).await })
            .expect("create session");
        let session = Arc::new(AsyncMutex::new(session));

        let options = LocalBridgeOptions {
            bind_addr,
            allowed_origins: resolve_allowed_origins(),
            global_dir: temp.path().join("global"),
            cwd: temp.path().join("workspace"),
            skillhub_bin: "skillhub".to_string(),
        };

        let stop = Arc::new(AtomicBool::new(false));
        let server_stop = Arc::clone(&stop);
        let session_for_server = Arc::clone(&session);
        let config_for_server = config;
        let handle = std::thread::spawn(move || {
            run_local_bridge_until(
                session_for_server,
                config_for_server,
                Vec::new(),
                options,
                BridgeSettings::default(),
                &server_stop,
            )
        });

        std::thread::sleep(Duration::from_millis(100));

        let response = http_request(
            bind_addr,
            "GET",
            "/healthz",
            Some("https://evil.example"),
            None,
        );
        assert!(response.starts_with("HTTP/1.1 403"));

        stop.store(true, Ordering::SeqCst);
        let _ = TcpStream::connect(bind_addr);
        handle.join().expect("join bridge").expect("bridge run");
    }

    #[test]
    fn local_bridge_installs_skillhub_skill_with_safe_slug() {
        let temp = TempDir::new().expect("tempdir");
        let runtime = RuntimeBuilder::new()
            .blocking_threads(1, 4)
            .build()
            .expect("runtime build");

        let listener = TcpListener::bind("127.0.0.1:0").expect("bind test listener");
        let bind_addr = listener.local_addr().expect("listener addr");
        drop(listener);

        let cli = Cli::parse_from(["pi"]);
        let config = Config::default();
        let session = runtime
            .block_on(async { Session::new(&cli, &config).await })
            .expect("create session");
        let session = Arc::new(AsyncMutex::new(session));

        let global_dir = temp.path().join("global");
        let workspace_dir = temp.path().join("workspace");
        fs::create_dir_all(&global_dir).expect("create global dir");
        fs::create_dir_all(&workspace_dir).expect("create workspace dir");

        let invoked_log = temp.path().join("skillhub-invocation.txt");
        let skillhub_bin = temp.path().join("skillhub");
        fs::write(
            &skillhub_bin,
            format!(
                "#!/bin/sh\nprintf 'cwd=%s\\nargs=%s %s\\n' \"$PWD\" \"$1\" \"$2\" > \"{}\"\n",
                invoked_log.display()
            ),
        )
        .expect("write fake skillhub");
        #[cfg(unix)]
        {
            let mut permissions = fs::metadata(&skillhub_bin)
                .expect("stat fake skillhub")
                .permissions();
            permissions.set_mode(0o755);
            fs::set_permissions(&skillhub_bin, permissions).expect("chmod fake skillhub");
        }

        let options = LocalBridgeOptions {
            bind_addr,
            allowed_origins: resolve_allowed_origins(),
            global_dir: global_dir.clone(),
            cwd: workspace_dir,
            skillhub_bin: skillhub_bin.display().to_string(),
        };

        let stop = Arc::new(AtomicBool::new(false));
        let server_stop = Arc::clone(&stop);
        let session_for_server = Arc::clone(&session);
        let config_for_server = config;
        let handle = std::thread::spawn(move || {
            run_local_bridge_until(
                session_for_server,
                config_for_server,
                Vec::new(),
                options,
                BridgeSettings::default(),
                &server_stop,
            )
        });

        std::thread::sleep(Duration::from_millis(100));

        let response = http_request(
            bind_addr,
            "POST",
            "/skills/install",
            Some("https://xinxiang.xin"),
            Some(r#"{"slug":"agent-browser","scope":"global"}"#),
        );
        assert!(response.contains("\"installed\":true"), "{response}");

        let invocation = fs::read_to_string(&invoked_log).expect("read invocation log");
        assert!(
            invocation.contains("args=install agent-browser"),
            "{invocation}"
        );
        let canonical_global = fs::canonicalize(&global_dir).unwrap_or_else(|_| global_dir.clone());
        let matches_cwd = invocation.contains(&format!("cwd={}", global_dir.display()))
            || invocation.contains(&format!("cwd={}", canonical_global.display()));
        assert!(matches_cwd, "{invocation}");

        stop.store(true, Ordering::SeqCst);
        let _ = TcpStream::connect(bind_addr);
        handle.join().expect("join bridge").expect("bridge run");
    }

    #[test]
    fn local_bridge_rejects_skillhub_install_with_invalid_slug() {
        let temp = TempDir::new().expect("tempdir");
        let runtime = RuntimeBuilder::new()
            .blocking_threads(1, 4)
            .build()
            .expect("runtime build");

        let listener = TcpListener::bind("127.0.0.1:0").expect("bind test listener");
        let bind_addr = listener.local_addr().expect("listener addr");
        drop(listener);

        let cli = Cli::parse_from(["pi"]);
        let config = Config::default();
        let session = runtime
            .block_on(async { Session::new(&cli, &config).await })
            .expect("create session");
        let session = Arc::new(AsyncMutex::new(session));

        let global_dir = temp.path().join("global");
        let workspace_dir = temp.path().join("workspace");
        fs::create_dir_all(&global_dir).expect("create global dir");
        fs::create_dir_all(&workspace_dir).expect("create workspace dir");

        let options = LocalBridgeOptions {
            bind_addr,
            allowed_origins: resolve_allowed_origins(),
            global_dir,
            cwd: workspace_dir,
            skillhub_bin: "skillhub".to_string(),
        };

        let stop = Arc::new(AtomicBool::new(false));
        let server_stop = Arc::clone(&stop);
        let session_for_server = Arc::clone(&session);
        let config_for_server = config;
        let handle = std::thread::spawn(move || {
            run_local_bridge_until(
                session_for_server,
                config_for_server,
                Vec::new(),
                options,
                BridgeSettings::default(),
                &server_stop,
            )
        });

        std::thread::sleep(Duration::from_millis(100));

        let response = http_request(
            bind_addr,
            "POST",
            "/skills/install",
            Some("https://xinxiang.xin"),
            Some(r#"{"slug":"../bad slug","scope":"global"}"#),
        );
        assert!(response.contains("\"ok\":false"), "{response}");
        assert!(
            response.contains("slug may only contain ASCII letters"),
            "{response}"
        );

        stop.store(true, Ordering::SeqCst);
        let _ = TcpStream::connect(bind_addr);
        handle.join().expect("join bridge").expect("bridge run");
    }

    #[test]
    fn local_bridge_rejects_skillhub_install_with_invalid_scope() {
        let temp = TempDir::new().expect("tempdir");
        let runtime = RuntimeBuilder::new()
            .blocking_threads(1, 4)
            .build()
            .expect("runtime build");

        let listener = TcpListener::bind("127.0.0.1:0").expect("bind test listener");
        let bind_addr = listener.local_addr().expect("listener addr");
        drop(listener);

        let cli = Cli::parse_from(["pi"]);
        let config = Config::default();
        let session = runtime
            .block_on(async { Session::new(&cli, &config).await })
            .expect("create session");
        let session = Arc::new(AsyncMutex::new(session));

        let global_dir = temp.path().join("global");
        let workspace_dir = temp.path().join("workspace");
        fs::create_dir_all(&global_dir).expect("create global dir");
        fs::create_dir_all(&workspace_dir).expect("create workspace dir");

        let options = LocalBridgeOptions {
            bind_addr,
            allowed_origins: resolve_allowed_origins(),
            global_dir,
            cwd: workspace_dir,
            skillhub_bin: "skillhub".to_string(),
        };

        let stop = Arc::new(AtomicBool::new(false));
        let server_stop = Arc::clone(&stop);
        let session_for_server = Arc::clone(&session);
        let config_for_server = config;
        let handle = std::thread::spawn(move || {
            run_local_bridge_until(
                session_for_server,
                config_for_server,
                Vec::new(),
                options,
                BridgeSettings::default(),
                &server_stop,
            )
        });

        std::thread::sleep(Duration::from_millis(100));

        let response = http_request(
            bind_addr,
            "POST",
            "/skills/install",
            Some("https://xinxiang.xin"),
            Some(r#"{"slug":"agent-browser","scope":"invalid"}"#),
        );
        assert!(response.contains("\"ok\":false"), "{response}");
        assert!(
            response.contains("scope must be 'global' or 'project'"),
            "{response}"
        );

        stop.store(true, Ordering::SeqCst);
        let _ = TcpStream::connect(bind_addr);
        handle.join().expect("join bridge").expect("bridge run");
    }

    #[test]
    fn local_bridge_reports_skillhub_install_failures() {
        let temp = TempDir::new().expect("tempdir");
        let runtime = RuntimeBuilder::new()
            .blocking_threads(1, 4)
            .build()
            .expect("runtime build");

        let listener = TcpListener::bind("127.0.0.1:0").expect("bind test listener");
        let bind_addr = listener.local_addr().expect("listener addr");
        drop(listener);

        let cli = Cli::parse_from(["pi"]);
        let config = Config::default();
        let session = runtime
            .block_on(async { Session::new(&cli, &config).await })
            .expect("create session");
        let session = Arc::new(AsyncMutex::new(session));

        let global_dir = temp.path().join("global");
        let workspace_dir = temp.path().join("workspace");
        let workspace_dir_for_assert = workspace_dir.clone();
        fs::create_dir_all(&global_dir).expect("create global dir");
        fs::create_dir_all(&workspace_dir).expect("create workspace dir");

        let invoked_log = temp.path().join("skillhub-invocation.txt");
        let skillhub_bin = temp.path().join("skillhub");
        fs::write(
            &skillhub_bin,
            format!(
                "#!/bin/sh\nprintf 'cwd=%s\\nargs=%s %s\\n' \"$PWD\" \"$1\" \"$2\" > \"{}\"\nprintf 'installing %s\\n' \"$2\"\nprintf 'fatal: missing dependencies\\n' 1>&2\nexit 42\n",
                invoked_log.display()
            ),
        )
        .expect("write fake skillhub");
        #[cfg(unix)]
        {
            let mut permissions = fs::metadata(&skillhub_bin)
                .expect("stat fake skillhub")
                .permissions();
            permissions.set_mode(0o755);
            fs::set_permissions(&skillhub_bin, permissions).expect("chmod fake skillhub");
        }

        let options = LocalBridgeOptions {
            bind_addr,
            allowed_origins: resolve_allowed_origins(),
            global_dir,
            cwd: workspace_dir,
            skillhub_bin: skillhub_bin.display().to_string(),
        };

        let stop = Arc::new(AtomicBool::new(false));
        let server_stop = Arc::clone(&stop);
        let session_for_server = Arc::clone(&session);
        let config_for_server = config;
        let handle = std::thread::spawn(move || {
            run_local_bridge_until(
                session_for_server,
                config_for_server,
                Vec::new(),
                options,
                BridgeSettings::default(),
                &server_stop,
            )
        });

        std::thread::sleep(Duration::from_millis(100));

        let response = http_request(
            bind_addr,
            "POST",
            "/skills/install",
            Some("https://xinxiang.xin"),
            Some(r#"{"slug":"agent-browser","scope":"project"}"#),
        );
        assert!(response.contains("\"ok\":false"), "{response}");
        assert!(
            response.contains("\"code\":\"skill_install_failed\""),
            "{response}"
        );
        assert!(response.contains("\"exitCode\":42"), "{response}");
        assert!(
            response.contains("fatal: missing dependencies"),
            "{response}"
        );
        assert!(response.contains("installing agent-browser"), "{response}");

        let invocation = fs::read_to_string(&invoked_log).expect("read invocation log");
        let canonical_project = fs::canonicalize(&workspace_dir_for_assert)
            .unwrap_or_else(|_| workspace_dir_for_assert.clone());
        let matches_cwd = invocation
            .contains(&format!("cwd={}", workspace_dir_for_assert.display()))
            || invocation.contains(&format!("cwd={}", canonical_project.display()));
        assert!(matches_cwd, "{invocation}");
        assert!(
            invocation.contains("args=install agent-browser"),
            "{invocation}"
        );

        stop.store(true, Ordering::SeqCst);
        let _ = TcpStream::connect(bind_addr);
        handle.join().expect("join bridge").expect("bridge run");
    }

    fn http_request(
        addr: SocketAddr,
        method: &str,
        path: &str,
        origin: Option<&str>,
        body: Option<&str>,
    ) -> String {
        use std::fmt::Write as _;

        let mut stream = TcpStream::connect(addr).expect("connect bridge");
        let body = body.unwrap_or("");
        let mut raw = format!("{method} {path} HTTP/1.1\r\nHost: 127.0.0.1\r\n");
        if let Some(origin) = origin {
            let _ = write!(raw, "Origin: {origin}\r\n");
        }
        if !body.is_empty() {
            raw.push_str("Content-Type: application/json\r\n");
            let _ = write!(raw, "Content-Length: {}\r\n", body.len());
        }
        raw.push_str("\r\n");
        raw.push_str(body);
        stream.write_all(raw.as_bytes()).expect("write request");
        stream
            .shutdown(std::net::Shutdown::Write)
            .expect("shutdown write");
        let mut response = String::new();
        stream.read_to_string(&mut response).expect("read response");
        response
    }
}
