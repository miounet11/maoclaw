const PRODUCT_FALLBACK = "猫爪 maoclaw";

const providerPresetFallbacks = [
  {
    id: "anthropic",
    runtimeProviderId: "anthropic",
    label: "Anthropic",
    description: "Claude-first path for coding-heavy desktop usage.",
    apiProtocol: "anthropic-messages",
    apiBaseURL: "https://api.anthropic.com/v1/messages",
    defaultModels: ["claude-sonnet-4-6", "claude-opus-4-1"],
  },
  {
    id: "openai",
    runtimeProviderId: "openai",
    label: "OpenAI",
    description: "Fast general-purpose path with broad model coverage.",
    apiProtocol: "openai-responses",
    apiBaseURL: "https://api.openai.com/v1",
    defaultModels: ["gpt-4.1", "gpt-4o", "o3"],
  },
  {
    id: "google",
    runtimeProviderId: "google",
    label: "Google Gemini",
    description: "Gemini route with direct API key entry.",
    apiProtocol: "google-generative-ai",
    apiBaseURL: "https://generativelanguage.googleapis.com/v1beta",
    defaultModels: ["gemini-2.5-pro", "gemini-2.0-flash"],
  },
  {
    id: "cohere",
    runtimeProviderId: "cohere",
    label: "Cohere",
    description: "Cohere Command-family setup with direct credential entry.",
    apiProtocol: "cohere-chat",
    apiBaseURL: "https://api.cohere.com/v2",
    defaultModels: ["command-a-03-2025", "command-r-plus"],
  },
  {
    id: "openrouter",
    runtimeProviderId: "openrouter",
    label: "OpenRouter",
    description: "OpenAI-compatible router with editable endpoint and model.",
    apiProtocol: "openai-completions",
    apiBaseURL: "https://openrouter.ai/api/v1",
    defaultModels: ["openai/gpt-4o", "anthropic/claude-3.7-sonnet"],
  },
  {
    id: "groq",
    runtimeProviderId: "groq",
    label: "Groq",
    description: "High-speed OpenAI-compatible inference.",
    apiProtocol: "openai-completions",
    apiBaseURL: "https://api.groq.com/openai/v1",
    defaultModels: ["llama-3.3-70b-versatile", "deepseek-r1-distill-llama-70b"],
  },
  {
    id: "moonshotai",
    runtimeProviderId: "moonshotai",
    label: "Kimi / Moonshot",
    description: "Moonshot/Kimi route with OpenAI-compatible wiring.",
    apiProtocol: "openai-completions",
    apiBaseURL: "https://api.moonshot.ai/v1",
    defaultModels: ["kimi-k2-0905-preview", "moonshot-v1-8k"],
  },
  {
    id: "custom",
    runtimeProviderId: "custom-openai",
    label: "Custom API",
    description: "Bring your own provider id, API URL, model, and key.",
    apiProtocol: "openai-completions",
    apiBaseURL: "https://api.example.com/v1",
    defaultModels: ["custom-model"],
  },
];

const V2_COPY = {
  en: {
    loadingTitle: "Booting Desktop V2",
    loadingBody: "Preparing the local desktop workspace, restoring your project context, and getting chat ready.",
    fatalTitle: "Desktop V2 hit a startup error",
    fatalBody: "The window opened, but the local desktop workspace did not finish starting.",
    setupEyebrow: "Desktop setup",
    setupTitle: "Set up maoclaw once, then stay in flow.",
    setupBody: "Choose your provider, enter a key, pick a default model, and start chatting in the local desktop client right away.",
    setupCardTitle: "Finish setup",
    setupCardBody: "This takes about a minute. Save your defaults once and every new session will open ready to work.",
    providerPreset: "Provider preset",
    providerId: "Provider id",
    modelId: "Default model",
    apiKey: "API key",
    apiBase: "API base URL",
    apiProtocol: "API protocol",
    workspace: "Workspace",
    chooseWorkspace: "Choose folder",
    starterAgent: "Starter agent",
    uiLanguage: "Language",
    uiMode: "Layout mode",
    importSetup: "Import existing setup",
    removeCredential: "Remove saved credential",
    saveAndLaunch: "Save and launch",
    saveDefaults: "Save defaults",
    setupNoteA: "Chat stays front and center so your current task is always visible.",
    setupNoteB: "Defaults, diagnostics, and session details stay close without taking over the screen.",
    setupNoteC: "You can still open the hosted workspace when you want it, without leaving the desktop flow.",
    sidebarTitle: "Conversations",
    newSession: "New session",
    openSessionsFolder: "Sessions folder",
    refreshDesktop: "Refresh",
    noSessionsTitle: "No sessions yet",
    noSessionsBody: "Start a conversation and the local session library will appear here.",
    workspaceTitle: "Workspace",
    workspaceBody: "maoclaw is currently working in the folder below.",
    openCurrentSession: "Open session file",
    openAppSupport: "App support",
    openHostedWeb: "Open hosted web",
    openWebInApp: "Open web in app",
    restartBackend: "Restart backend",
    heroEyebrow: "Desktop V2",
    heroTitle: "Keep the work in front of you and the controls within reach.",
    heroBody: "The desktop keeps the active conversation, session context, and essential controls together so you can stay focused from prompt to result.",
    statusReady: "Desktop ready.",
    statusSetup: "Complete setup to start your first session.",
    statusRefreshed: "Desktop refreshed.",
    statusWorkspace: "Workspace updated.",
    statusSaved: "Desktop defaults updated.",
    statusImported: "Existing setup imported.",
    statusRestarted: "Backend restarted.",
    statusPromptAccepted: "Message sent.",
    statusSessionRenamed: "Session renamed.",
    statusSessionSwitched: "Session switched.",
    statusModelApplied: "Default model updated for this session.",
    statusAgentApplied: "Session agent updated.",
    statusAttachmentPicked: "Files attached.",
    connected: "Connected",
    booting: "Booting",
    offline: "Offline",
    liveChat: "Live chat",
    sessionMetrics: "Session metrics",
    defaultsCard: "Desktop defaults",
    currentSessionCard: "Current session",
    diagnosticsCard: "Recent diagnostics",
    logsEmpty: "Diagnostics will appear here when the desktop or runtime reports new activity.",
    emptyChatTitle: "Start working from here",
    emptyChatBody: "Ask for a change, attach files, or reopen a previous session from the left side.",
    composePlaceholder: "Describe what you want to build, fix, review, or explain.",
    attachFiles: "Attach files",
    send: "Send",
    sending: "Sending...",
    renameSession: "Rename session",
    agentLane: "Session lane",
    applyLane: "Apply lane",
    applyModel: "Apply model",
    openExport: "Export session",
    usageMessages: "messages",
    usageTokens: "tokens",
    usageCost: "cost",
    providerLabel: "Provider",
    modelLabel: "Model",
    sessionFile: "Session file",
    workspacePath: "Workspace path",
    diagnosticsHint: "These are the latest local desktop and runtime messages.",
    languageEnglish: "English",
    languageChinese: "Chinese",
    modeSimple: "Simple",
    modePro: "Pro",
    noMessages: "No visible messages yet.",
    importAvailable: "A previous CLI setup was found and can be imported directly.",
    current: "Current",
    lastUpdated: "Updated",
    saveHostActions: "Local surface only",
    browserHint: "Open the web workspace in your browser.",
    composerAttachments: "Attachments",
    defaultsHint: "Updating defaults affects the next new session and refreshes the desktop backend.",
    activeSession: "Active session",
    starterAgentHint: "New sessions start with this agent unless you change it later in the thread.",
    credentialStateSaved: "A saved key is already available.",
    credentialStateMissing: "No saved key yet.",
    statsPending: "pending writes",
    statsTools: "tool calls",
    statsMode: "durability",
    setupProviderHint: "Start with a preset, then adjust the endpoint or provider ID only if you need a custom route.",
    noLogs: "No diagnostics yet.",
    hostedWebHint: "The web workspace stays available when you want it, but the desktop remains the main place to work.",
    sessionSearch: "Filter sessions",
    noSessionMatches: "No sessions match the current filter.",
    quickActions: "Quick actions",
    quickPromptReview: "Review the current code and point out the highest-risk issues first.",
    quickPromptRefactor: "Refactor this area so it is clearer, smaller, and easier to maintain.",
    quickPromptTrace: "Trace the bug from symptom to root cause, then fix it completely.",
    quickPromptPlan: "Plan the implementation and carry it through to a finished result.",
    shortcutHint: "Use Cmd/Ctrl + Enter to send.",
    filterLogs: "Search diagnostics",
    sourceLabel: "Source",
    categoryLabel: "Category",
    severityLabel: "Severity",
    levelAll: "All levels",
    levelError: "Errors",
    levelWarn: "Warnings",
    levelInfo: "Info",
    categoryAll: "All categories",
    categoryPermissions: "Permissions",
    categoryRuntime: "Runtime",
    categoryUpdates: "Updates",
    categoryGateway: "Gateway",
    categoryChannels: "Channels",
    categoryFilesystem: "Filesystem",
    categoryGeneral: "General",
    userLabel: "You",
  },
  zh: {
    loadingTitle: "正在启动 Desktop V2",
    loadingBody: "正在准备本地桌面工作区，恢复项目上下文，并让对话界面进入可用状态。",
    fatalTitle: "Desktop V2 启动失败",
    fatalBody: "窗口已经打开，但本地桌面工作区没有成功完成启动。",
    setupEyebrow: "桌面端配置",
    setupTitle: "把 maoclaw 配好一次，后面就专注工作。",
    setupBody: "选择服务商，填入密钥，选一个默认模型，保存后就能直接在本地桌面端开始对话。",
    setupCardTitle: "完成配置",
    setupCardBody: "整个过程大约一分钟。默认值保存一次，之后每个新会话都会直接进入可用状态。",
    providerPreset: "服务商预设",
    providerId: "服务商 ID",
    modelId: "默认模型",
    apiKey: "API 密钥",
    apiBase: "API 地址",
    apiProtocol: "API 协议",
    workspace: "工作目录",
    chooseWorkspace: "选择文件夹",
    starterAgent: "默认智能体",
    uiLanguage: "语言",
    uiMode: "界面模式",
    importSetup: "导入已有配置",
    removeCredential: "移除已保存凭证",
    saveAndLaunch: "保存并启动",
    saveDefaults: "保存默认值",
    setupNoteA: "对话始终在中心位置，当前任务不会被别的面板打断。",
    setupNoteB: "默认值、诊断信息和会话详情都在手边，但不会抢走主界面。",
    setupNoteC: "如果你需要，仍然可以打开托管版工作区，但桌面端始终是主入口。",
    sidebarTitle: "会话",
    newSession: "新会话",
    openSessionsFolder: "打开 sessions 目录",
    refreshDesktop: "刷新",
    noSessionsTitle: "还没有会话",
    noSessionsBody: "先开始一次对话，本地 session 列表就会出现在这里。",
    workspaceTitle: "工作空间",
    workspaceBody: "猫爪当前正在下面这个目录中工作。",
    openCurrentSession: "打开会话文件",
    openAppSupport: "打开 App Support",
    openHostedWeb: "打开托管 Web",
    openWebInApp: "应用内打开 Web",
    restartBackend: "重启后端",
    heroEyebrow: "Desktop V2",
    heroTitle: "把工作放在眼前，把控制项放在手边。",
    heroBody: "桌面端把当前对话、会话上下文和必要控制项放在同一处，让你从提需求到拿结果都能保持专注。",
    statusReady: "桌面端已就绪。",
    statusSetup: "完成配置后即可开始第一个会话。",
    statusRefreshed: "桌面端已刷新。",
    statusWorkspace: "工作目录已更新。",
    statusSaved: "桌面默认值已更新。",
    statusImported: "已导入原有配置。",
    statusRestarted: "后端已重启。",
    statusPromptAccepted: "消息已发送。",
    statusSessionRenamed: "会话已重命名。",
    statusSessionSwitched: "已切换会话。",
    statusModelApplied: "当前会话的默认模型已更新。",
    statusAgentApplied: "当前会话的智能体已更新。",
    statusAttachmentPicked: "文件已附加。",
    connected: "已连接",
    booting: "启动中",
    offline: "离线",
    liveChat: "实时对话",
    sessionMetrics: "会话指标",
    defaultsCard: "桌面默认值",
    currentSessionCard: "当前会话",
    diagnosticsCard: "最近诊断",
    logsEmpty: "桌面端或运行时有新的状态消息时，这里就会显示出来。",
    emptyChatTitle: "从这里开始工作",
    emptyChatBody: "提出需求、附加文件，或者从左侧重新打开之前的会话。",
    composePlaceholder: "直接写下你要构建、修复、审查或解释的内容。",
    attachFiles: "附加文件",
    send: "发送",
    sending: "发送中...",
    renameSession: "重命名会话",
    agentLane: "会话 lane",
    applyLane: "应用 lane",
    applyModel: "应用模型",
    openExport: "导出会话",
    usageMessages: "消息",
    usageTokens: "tokens",
    usageCost: "花费",
    providerLabel: "Provider",
    modelLabel: "模型",
    sessionFile: "会话文件",
    workspacePath: "工作目录路径",
    diagnosticsHint: "这里显示本地桌面端与运行时的最新消息。",
    languageEnglish: "English",
    languageChinese: "中文",
    modeSimple: "Simple",
    modePro: "Pro",
    noMessages: "还没有可见消息。",
    importAvailable: "检测到旧的 CLI 配置，可以直接导入。",
    current: "当前",
    lastUpdated: "更新时间",
    saveHostActions: "本地主界面",
    browserHint: "在浏览器中打开 Web 工作区。",
    composerAttachments: "附件",
    defaultsHint: "修改默认值会影响下一个新会话，并刷新桌面后端。",
    activeSession: "当前会话",
    starterAgentHint: "新会话会默认使用这个智能体，之后也可以在会话里再切换。",
    credentialStateSaved: "已检测到已保存的密钥。",
    credentialStateMissing: "还没有保存的密钥。",
    statsPending: "待落盘",
    statsTools: "工具调用",
    statsMode: "持久化模式",
    setupProviderHint: "先用预设即可；只有在接自定义接口时，才需要调整地址或服务商 ID。",
    noLogs: "还没有诊断信息。",
    hostedWebHint: "如果你需要，Web 工作区依然可用，但桌面端仍然是主要工作入口。",
    sessionSearch: "筛选会话",
    noSessionMatches: "当前筛选下没有匹配的会话。",
    quickActions: "快捷动作",
    quickPromptReview: "审查当前代码，并优先指出风险最高的问题。",
    quickPromptRefactor: "把这一块重构得更清晰、更小、更容易维护。",
    quickPromptTrace: "从现象一路追到根因，再把问题完整修掉。",
    quickPromptPlan: "先规划实现，再把改动一路做成可交付结果。",
    shortcutHint: "使用 Cmd/Ctrl + Enter 发送。",
    filterLogs: "搜索诊断",
    sourceLabel: "来源",
    categoryLabel: "类别",
    severityLabel: "严重级别",
    levelAll: "全部级别",
    levelError: "错误",
    levelWarn: "警告",
    levelInfo: "信息",
    categoryAll: "全部类别",
    categoryPermissions: "权限",
    categoryRuntime: "运行时",
    categoryUpdates: "更新",
    categoryGateway: "网关",
    categoryChannels: "渠道",
    categoryFilesystem: "文件系统",
    categoryGeneral: "通用",
    userLabel: "你",
  },
};

const pendingRequests = new Map();

const state = {
  bootstrap: null,
  messages: [],
  pendingAssistantId: null,
  status: "",
  statusKind: "",
  backendReady: false,
  view: "loading",
  availableModels: [],
  logs: [],
  ui: {
    language: "zh-CN",
    mode: "simple",
  },
  v2: null,
};

function productName() {
  return state.bootstrap?.productName || PRODUCT_FALLBACK;
}

function safeUUID() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `desktop-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeJsSingle(value) {
  return String(value ?? "")
    .replaceAll("\\", "\\\\")
    .replaceAll("'", "\\'")
    .replaceAll("\n", "\\n");
}

function shorten(value, max) {
  const text = String(value ?? "");
  if (text.length <= max) {
    return text;
  }
  return `${text.slice(0, Math.max(0, max - 1))}…`;
}

function normalizeHostResponse(result) {
  if (result && typeof result === "object" && result.kind === "response") {
    return result;
  }
  if (result && typeof result === "object" && ("payload" in result || "ok" in result || "error" in result)) {
    return {
      kind: "response",
      ok: result.ok !== false,
      payload: result.payload || {},
      error: result.error,
    };
  }
  return {
    kind: "response",
    ok: true,
    payload: result && typeof result === "object" ? result : {},
  };
}

function hostRequest(action, payload = {}) {
  if (typeof window.__PI_DESKTOP_MOCK_HOST_REQUEST__ === "function") {
    return Promise.resolve(window.__PI_DESKTOP_MOCK_HOST_REQUEST__(action, payload)).then((result) => {
      const message = normalizeHostResponse(result);
      if (message.ok) {
        return message;
      }
      throw new Error(message.error || "Unknown desktop error.");
    });
  }

  const handler = window.webkit?.messageHandlers?.piHost;
  if (!handler || typeof handler.postMessage !== "function") {
    return Promise.reject(new Error("Desktop host bridge is unavailable."));
  }

  const requestId = safeUUID();
  return new Promise((resolve, reject) => {
    pendingRequests.set(requestId, { resolve, reject });
    try {
      handler.postMessage({ action, requestId, payload });
    } catch (error) {
      pendingRequests.delete(requestId);
      reject(error);
    }
  });
}

function appendStatus(message, kind = "") {
  if (!message) {
    return;
  }
  state.status = String(message);
  state.statusKind = kind;
  render();
}

function parseDiagnosticLine(rawLine) {
  const raw = String(rawLine ?? "").trim();
  const bracketMatch = raw.match(/^\[([^\]]+)\]\s*(.*)$/);
  const timestamp = bracketMatch?.[1] || new Date().toISOString();
  const message = bracketMatch?.[2] || raw;
  const lower = message.toLowerCase();

  let level = "info";
  if (/\berror\b|failed|denied|unsupported/.test(lower)) {
    level = "error";
  } else if (/\bwarn\b|warning|manual_check/.test(lower)) {
    level = "warn";
  }

  let category = "general";
  if (/permission|accessibility|screen recording|microphone|camera|location/.test(lower)) {
    category = "permissions";
  } else if (/backend|rpc|session/.test(lower)) {
    category = "runtime";
  } else if (/update|release|installer/.test(lower)) {
    category = "updates";
  } else if (/gateway|proxy|sandbox/.test(lower)) {
    category = "gateway";
  } else if (/binding|telegram|qq|feishu/.test(lower)) {
    category = "channels";
  } else if (/file|directory|path/.test(lower)) {
    category = "filesystem";
  }

  let source = "desktop";
  if (message.startsWith("backend[stderr]")) {
    source = "backend-stderr";
  } else if (message.startsWith("backend[out]")) {
    source = "backend-stdout";
  } else if (message.startsWith("web[")) {
    source = "webview";
  } else if (message.startsWith("backend")) {
    source = "backend";
  }

  return {
    id: safeUUID(),
    timestamp,
    level,
    category,
    source,
    message,
    raw,
  };
}

function diagnosticEntries() {
  const structured = state.bootstrap?.diagnosticsState?.entries;
  if (Array.isArray(structured) && structured.length) {
    return structured;
  }
  return (state.logs || []).map((line) => parseDiagnosticLine(line));
}

function updateDiagnosticsWithLine(line) {
  if (!state.bootstrap) {
    return;
  }
  const diagnostics = state.bootstrap.diagnosticsState || { entries: [], errorCount: 0, warningCount: 0 };
  const entry = parseDiagnosticLine(line);
  const entries = [...(diagnostics.entries || []), entry].slice(-200);
  state.bootstrap.diagnosticsState = {
    ...diagnostics,
    entries,
    errorCount: entries.filter((item) => item.level === "error").length,
    warningCount: entries.filter((item) => item.level === "warn").length,
  };
}

function v2EnsureState() {
  if (!state.v2) {
    state.v2 = {
      section: "chat",
      settingsDraft: {
        providerPreset: "anthropic",
        provider: "anthropic",
        model: "",
        apiKey: "",
        apiBaseURL: "",
        apiProtocol: "",
        starterAgent: "main",
        uiLanguage: "zh-CN",
        uiMode: "simple",
        workspacePath: "",
        checkForUpdates: true,
      },
      hostDraft: {
        preferredSurface: "desktop",
        webWorkspaceURL: "https://xinxiang.xin",
        closeBehavior: "background",
        menuBarEnabled: true,
      },
      securityDraft: {
        machinePreset: "primary",
        profile: "permissive",
        defaultPermissive: false,
        allowDangerous: false,
        destructiveExecPolicy: "confirm",
        sandboxMode: "workspace_write",
        gatewayMode: "direct",
        gatewayURL: "",
        browserAutomation: false,
        conflictGuard: true,
        scopedDirectories: [],
      },
      selectedAgentId: "main",
      agentDrafts: {},
      selectedSessionPath: "",
      sessionNameDraft: "",
      sessionNameDirty: false,
      sessionAgentDraft: "main",
      modelDraft: {
        provider: "anthropic",
        modelId: "",
      },
      composerText: "",
      composerBusy: false,
      attachments: [],
      sessionQuery: "",
      diagnosticsQuery: "",
      diagnosticsLevel: "all",
      diagnosticsCategory: "all",
      autoScrollPending: false,
    };
  }
  return state.v2;
}

function v2Locale() {
  const raw = String(state.ui.language || state.bootstrap?.uiLanguage || "zh-CN").toLowerCase();
  return raw.startsWith("zh") ? "zh" : "en";
}

function v2Text(key) {
  const copy = V2_COPY[v2Locale()] || V2_COPY.en;
  return copy[key] || V2_COPY.en[key] || key;
}

function v2LocaleText(zh, en) {
  return v2Locale() === "zh" ? zh : en;
}

function v2HumanizeStatus(value) {
  const text = String(value || "").trim();
  if (!text) {
    return "—";
  }
  return text.replaceAll("_", " ").replace(/\b\w/g, (match) => match.toUpperCase());
}

function v2ToneForStatus(value) {
  const status = String(value || "").toLowerCase();
  if (["error", "failed", "denied", "missing_credentials", "offline"].includes(status)) {
    return "bad";
  }
  if (["warn", "warning", "manual_check", "needs_setup", "needs_manual_grant", "partial", "restricted", "update_available"].includes(status)) {
    return "warn";
  }
  return "good";
}

function v2LevelLabel(level) {
  switch (level) {
    case "error":
      return v2Text("levelError");
    case "warn":
      return v2Text("levelWarn");
    case "info":
      return v2Text("levelInfo");
    default:
      return v2Text("levelAll");
  }
}

function v2CategoryFilterLabel(category) {
  switch (category) {
    case "permissions":
      return v2Text("categoryPermissions");
    case "runtime":
      return v2Text("categoryRuntime");
    case "updates":
      return v2Text("categoryUpdates");
    case "gateway":
      return v2Text("categoryGateway");
    case "channels":
      return v2Text("categoryChannels");
    case "filesystem":
      return v2Text("categoryFilesystem");
    case "general":
      return v2Text("categoryGeneral");
    default:
      return v2Text("categoryAll");
  }
}

function v2ProviderPresets() {
  return Array.isArray(state.bootstrap?.providerPresets) && state.bootstrap.providerPresets.length
    ? state.bootstrap.providerPresets
    : providerPresetFallbacks;
}

function v2ProviderPresetById(id) {
  const needle = String(id || "").toLowerCase();
  return (
    v2ProviderPresets().find((preset) => {
      const presetId = String(preset.id || "").toLowerCase();
      const runtimeId = String(preset.runtimeProviderId || "").toLowerCase();
      return presetId === needle || runtimeId === needle;
    }) || v2ProviderPresets()[0]
  );
}

function v2RecommendedModel(provider, presetId) {
  const preset = v2ProviderPresetById(presetId || provider);
  return state.bootstrap?.recommendedModels?.[provider]?.[0] || preset?.defaultModels?.[0] || "";
}

function v2Agents() {
  return Array.isArray(state.bootstrap?.agents) ? state.bootstrap.agents : [];
}

function v2Sessions() {
  return Array.isArray(state.bootstrap?.sessions) ? state.bootstrap.sessions : [];
}

function v2CurrentSessionPath() {
  const v2 = v2EnsureState();
  return state.sessionState?.sessionFile || state.bootstrap?.currentSessionPath || v2.selectedSessionPath || "";
}

function v2CurrentSession() {
  const path = v2CurrentSessionPath();
  return v2Sessions().find((session) => session.path === path) || v2Sessions()[0] || null;
}

function v2FilteredSessions() {
  const query = String(v2EnsureState().sessionQuery || "").trim().toLowerCase();
  const sessions = v2Sessions();
  if (!query) {
    return sessions;
  }
  return sessions.filter((session) => {
    const haystack = `${session.name || ""} ${session.preview || ""} ${session.agentId || ""} ${session.path || ""}`.toLowerCase();
    return haystack.includes(query);
  });
}

function v2FilteredLogs() {
  const v2 = v2EnsureState();
  const query = String(v2.diagnosticsQuery || "").trim().toLowerCase();
  const level = v2.diagnosticsLevel || "all";
  const category = v2.diagnosticsCategory || "all";
  return diagnosticEntries().filter((entry) => {
    if (level !== "all" && entry.level !== level) {
      return false;
    }
    if (category !== "all" && entry.category !== category) {
      return false;
    }
    if (!query) {
      return true;
    }
    const haystack = `${entry.message || ""} ${entry.source || ""} ${entry.category || ""}`.toLowerCase();
    return haystack.includes(query);
  });
}

function v2CurrentModel() {
  const v2 = v2EnsureState();
  return (
    state.sessionState?.model || {
      provider: state.bootstrap?.provider || v2.settingsDraft.provider || "",
      id: state.bootstrap?.model || v2.settingsDraft.model || "",
    }
  );
}

function v2HasSavedCredential() {
  return Boolean(state.bootstrap?.providerConfig?.hasSavedCredential);
}

function v2QuickPrompts() {
  return [
    v2Text("quickPromptReview"),
    v2Text("quickPromptRefactor"),
    v2Text("quickPromptTrace"),
    v2Text("quickPromptPlan"),
  ];
}

function v2HostState() {
  return state.bootstrap?.hostState || {
    preferredSurface: "desktop",
    webWorkspaceURL: "https://xinxiang.xin",
    closeBehavior: "background",
    menuBarEnabled: true,
    webBridgeBaseURL: "http://127.0.0.1:43115",
    webBridgeRunning: false,
    desktopControlCenterAvailable: true,
  };
}

function v2SecurityState() {
  return state.bootstrap?.securityState || {
    machinePreset: "primary",
    profile: "permissive",
    defaultPermissive: false,
    allowDangerous: false,
    destructiveExecPolicy: "confirm",
    sandboxMode: "workspace_write",
    gatewayMode: "direct",
    gatewayURL: "",
    browserAutomation: false,
    conflictGuard: true,
    scopedDirectories: [],
    decisions: [],
  };
}

function v2UpdateState() {
  return state.bootstrap?.updateState || {};
}

function v2SystemPermissions() {
  return Array.isArray(state.bootstrap?.systemPermissions) ? state.bootstrap.systemPermissions : [];
}

function v2Channels() {
  return Array.isArray(state.bootstrap?.channels) ? state.bootstrap.channels : [];
}

function v2SkillsState() {
  return state.bootstrap?.skillsCatalog || {
    skills: [],
    catalogEntries: [],
    globalSkillPaths: [],
    projectSkillPaths: [],
    enableSkillCommands: true,
    catalogInstallableCount: 0,
  };
}

function v2AutomationState() {
  return state.bootstrap?.automationState || {
    activeSystemId: "",
    systems: [],
    automations: [],
  };
}

function v2CurrentAgentDraft() {
  const v2 = v2EnsureState();
  return v2.agentDrafts[v2.selectedAgentId] || null;
}

function v2HydrateDraftsFromBootstrap(payload = {}) {
  const v2 = v2EnsureState();
  const providerConfig = payload.providerConfig || {};
  const preset = v2ProviderPresetById(
    providerConfig.presetId || providerConfig.providerId || payload.provider || v2.settingsDraft.providerPreset
  );
  const providerId =
    providerConfig.providerId ||
    payload.provider ||
    v2.settingsDraft.provider ||
    preset.runtimeProviderId;

  v2.settingsDraft.providerPreset = preset.id;
  v2.settingsDraft.provider = providerId;
  v2.settingsDraft.model =
    providerConfig.model ||
    payload.model ||
    v2.settingsDraft.model ||
    v2RecommendedModel(providerId, preset.id);
  v2.settingsDraft.apiBaseURL = providerConfig.apiBaseURL || preset.apiBaseURL || "";
  v2.settingsDraft.apiProtocol = providerConfig.apiProtocol || preset.apiProtocol || "";
  v2.settingsDraft.starterAgent =
    payload.starterAgent || v2.settingsDraft.starterAgent || v2Agents()[0]?.id || "main";
  v2.settingsDraft.uiLanguage = payload.uiLanguage || v2.settingsDraft.uiLanguage || "zh-CN";
  v2.settingsDraft.uiMode = payload.uiMode || v2.settingsDraft.uiMode || "simple";
  v2.settingsDraft.workspacePath = payload.workspacePath || v2.settingsDraft.workspacePath || "";
  v2.settingsDraft.checkForUpdates = providerConfig.checkForUpdates !== false;

  const host = payload.hostState || {};
  v2.hostDraft = {
    preferredSurface: host.preferredSurface || "desktop",
    webWorkspaceURL: host.webWorkspaceURL || "https://xinxiang.xin",
    closeBehavior: host.closeBehavior || "background",
    menuBarEnabled: host.menuBarEnabled !== false,
  };

  const security = payload.securityState || {};
  v2.securityDraft = {
    machinePreset: security.machinePreset || "primary",
    profile: security.profile || "permissive",
    defaultPermissive: Boolean(security.defaultPermissive),
    allowDangerous: Boolean(security.allowDangerous),
    destructiveExecPolicy: security.destructiveExecPolicy || "confirm",
    sandboxMode: security.sandboxMode || "workspace_write",
    gatewayMode: security.gatewayMode || "direct",
    gatewayURL: security.gatewayURL || "",
    browserAutomation: Boolean(security.browserAutomation),
    conflictGuard: security.conflictGuard !== false,
    scopedDirectories: Array.isArray(security.scopedDirectories) ? [...security.scopedDirectories] : [],
  };

  const nextAgentDrafts = {};
  for (const agent of v2Agents()) {
    nextAgentDrafts[agent.id] = {
      id: agent.id,
      displayName: agent.displayName || agent.id,
      description: agent.description || "",
      modeId: agent.modeId || "follow_main",
      provider: agent.provider || "",
      model: agent.model || "",
      skills: Array.isArray(agent.skills) ? [...agent.skills] : [],
      prompts: Array.isArray(agent.prompts) ? [...agent.prompts] : [],
      builtinSkills: Array.isArray(agent.builtinSkills) ? [...agent.builtinSkills] : [],
      skillScope: agent.skillScope || "",
    };
  }
  v2.agentDrafts = nextAgentDrafts;
  if (!v2.selectedAgentId || !nextAgentDrafts[v2.selectedAgentId]) {
    v2.selectedAgentId = payload.starterAgent || v2Agents()[0]?.id || "main";
  }

  const availableSessionPaths = new Set(v2Sessions().map((session) => session.path));
  if (!v2.selectedSessionPath || !availableSessionPaths.has(v2.selectedSessionPath)) {
    v2.selectedSessionPath = payload.currentSessionPath || v2Sessions()[0]?.path || "";
  }

  if (!v2.sessionNameDirty) {
    v2.sessionNameDraft = state.sessionState?.sessionName || v2CurrentSession()?.name || "";
  }

  v2.sessionAgentDraft =
    v2CurrentSession()?.agentId ||
    payload.activeSessionAgent ||
    payload.starterAgent ||
    v2.sessionAgentDraft ||
    "main";

  const currentModel = v2CurrentModel();
  v2.modelDraft = {
    provider: currentModel.provider || providerId,
    modelId:
      currentModel.id ||
      v2.settingsDraft.model ||
      v2RecommendedModel(currentModel.provider || providerId, preset.id),
  };
}

function applyBootstrap(payload = {}) {
  state.bootstrap = payload;
  state.logs = Array.isArray(payload.logs) ? payload.logs.slice(-160) : [];
  state.ui.language = payload.uiLanguage || state.ui.language || "zh-CN";
  state.ui.mode = payload.uiMode || state.ui.mode || "simple";
  v2HydrateDraftsFromBootstrap(payload);
}

function v2FormatCount(value) {
  const number = Number(value || 0);
  return new Intl.NumberFormat(v2Locale() === "zh" ? "zh-CN" : "en-US", {
    notation: number >= 1000 ? "compact" : "standard",
    maximumFractionDigits: number >= 1000 ? 1 : 0,
  }).format(number);
}

function v2FormatCurrency(value) {
  const amount = Number(value || 0);
  if (!amount) {
    return "$0";
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: amount >= 10 ? 2 : 3,
  }).format(amount);
}

function v2FormatTime(value) {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  return new Intl.DateTimeFormat(v2Locale() === "zh" ? "zh-CN" : "en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function v2BackendLevel() {
  if (state.backendReady) {
    return "good";
  }
  if (state.statusKind === "error") {
    return "bad";
  }
  return "warn";
}

function v2BackendLabel() {
  if (state.backendReady) {
    return v2Text("connected");
  }
  return state.statusKind === "error" ? v2Text("offline") : v2Text("booting");
}

function v2ModelsForProvider(provider) {
  const normalizedProvider = String(provider || "").toLowerCase();
  const available = (state.availableModels || []).filter(
    (model) => String(model.provider || "").toLowerCase() === normalizedProvider
  );
  if (available.length) {
    return available;
  }
  return (state.bootstrap?.recommendedModels?.[provider] || []).map((id) => ({
    id,
    name: id,
    provider,
  }));
}

function v2CurrentPersistenceSummary() {
  return (
    state.sessionStats?.persistenceStatus?.summary ||
    state.sessionStats?.durabilityMode ||
    state.sessionState?.durabilityMode ||
    "—"
  );
}

function v2PayloadMatchesCurrentSession(data) {
  const currentPath = v2CurrentSessionPath();
  if (!data?.sessionFile || !currentPath) {
    return true;
  }
  return data.sessionFile === currentPath || data.sessionFile === state.bootstrap?.currentSessionPath;
}

function v2FlattenText(value) {
  if (!value) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value)) {
    return value
      .map((entry) => v2FlattenText(entry))
      .filter(Boolean)
      .join("\n");
  }
  if (typeof value === "object") {
    if (typeof value.text === "string") {
      return value.text;
    }
    if (typeof value.value === "string") {
      return value.value;
    }
    if (typeof value.content === "string") {
      return value.content;
    }
    if (Array.isArray(value.content)) {
      return value.content
        .map((entry) => v2FlattenText(entry))
        .filter(Boolean)
        .join("\n");
    }
  }
  return "";
}

function v2PresentContent(content) {
  const result = {
    body: "",
    attachments: [],
    tools: [],
  };

  if (!Array.isArray(content)) {
    result.body = v2FlattenText(content).trim();
    return result;
  }

  const textParts = [];
  for (const block of content) {
    if (!block) {
      continue;
    }
    if (typeof block === "string") {
      textParts.push(block);
      continue;
    }
    const type = String(block.type || block.kind || "").toLowerCase();
    const body = v2FlattenText(block.text || block.content || block.value || "").trim();
    if (type.includes("text") || (!type && body)) {
      if (body) {
        textParts.push(body);
      }
      continue;
    }
    if (type.includes("tool")) {
      const label = block.name || block.toolName || block.tool || block.id || "tool";
      result.tools.push(String(label));
      continue;
    }
    if (type.includes("image") || type.includes("file") || type.includes("audio")) {
      const label = block.name || block.mimeType || type;
      result.attachments.push(String(label));
      continue;
    }
    if (body) {
      textParts.push(body);
    }
  }

  result.body = textParts.join("\n\n").trim();
  result.tools = [...new Set(result.tools)];
  result.attachments = [...new Set(result.attachments)];
  return result;
}

function v2NormalizeRpcMessage(message, index) {
  if (!message) {
    return null;
  }

  const role = String(message.role || "").toLowerCase();
  const createdAt = message.createdAt || message.timestamp || message.time || message.ts || null;
  const presentation = v2PresentContent(message.content);
  const fallbackBody = String(message.body || message.text || message.errorMessage || "").trim();
  const body = presentation.body || fallbackBody;

  if (role === "toolresult" || role === "bashexecution") {
    return null;
  }

  if (role === "user") {
    return {
      id: message.id || `user-${index}`,
      role: "user",
      label: v2Text("userLabel"),
      body,
      attachments: presentation.attachments,
      tools: [],
      createdAt,
      streaming: false,
    };
  }

  if (role === "assistant") {
    return {
      id: message.id || `assistant-${index}`,
      role: "assistant",
      label: productName(),
      body: body || v2Text("noMessages"),
      attachments: presentation.attachments,
      tools: presentation.tools,
      createdAt,
      streaming: false,
    };
  }

  if (role === "custom" && body) {
    return {
      id: message.id || `custom-${index}`,
      role: "assistant",
      label: message.customType || "Custom",
      body,
      attachments: [],
      tools: [],
      createdAt,
      streaming: false,
    };
  }

  return null;
}

function v2NormalizeRpcMessages(messages) {
  v2EnsureState().autoScrollPending = true;
  return (messages || [])
    .map((message, index) => v2NormalizeRpcMessage(message, index))
    .filter(Boolean);
}

function v2EnsureAssistantMessage() {
  if (state.pendingAssistantId) {
    return state.pendingAssistantId;
  }
  const id = safeUUID();
  state.pendingAssistantId = id;
  state.messages.push({
    id,
    role: "assistant",
    label: productName(),
    body: "",
    attachments: [],
    tools: [],
    createdAt: new Date().toISOString(),
    streaming: true,
  });
  v2EnsureState().autoScrollPending = true;
  return id;
}

function v2PendingAssistant() {
  if (!state.pendingAssistantId) {
    return null;
  }
  return state.messages.find((message) => message.id === state.pendingAssistantId) || null;
}

function v2SyncAssistantMessageFromRpcMessage(rpcMessage) {
  if (!rpcMessage || String(rpcMessage.role || "").toLowerCase() !== "assistant") {
    return false;
  }
  const messageId = v2EnsureAssistantMessage();
  const target = state.messages.find((message) => message.id === messageId);
  if (!target) {
    return false;
  }

  const presentation = v2PresentContent(rpcMessage.content);
  const errorMessage = String(rpcMessage.errorMessage || "").trim();
  if (presentation.body) {
    target.body = presentation.body;
  } else if (errorMessage) {
    target.body = errorMessage;
  }
  target.attachments = presentation.attachments;
  target.tools = presentation.tools;
  target.createdAt = rpcMessage.createdAt || rpcMessage.timestamp || target.createdAt;
  target.streaming = true;
  v2EnsureState().autoScrollPending = true;
  return true;
}

function v2UpdateAssistantBody(delta) {
  const target = v2PendingAssistant() || state.messages.find((message) => message.id === v2EnsureAssistantMessage());
  if (!target) {
    return;
  }
  target.body = `${target.body || ""}${delta || ""}`;
  target.streaming = true;
  v2EnsureState().autoScrollPending = true;
}

function v2PushAssistantTool(label) {
  const target = v2PendingAssistant() || state.messages.find((message) => message.id === v2EnsureAssistantMessage());
  if (!target) {
    return;
  }
  target.tools = [...new Set([...(target.tools || []), label])];
  target.streaming = true;
  v2EnsureState().autoScrollPending = true;
}

function v2FinishAssistant() {
  const target = v2PendingAssistant();
  if (target) {
    target.streaming = false;
  }
  state.pendingAssistantId = null;
}

function handleRpcResponse(payload) {
  if (payload.success === false) {
    appendStatus(payload.error || `RPC ${payload.command} failed.`, "error");
    return;
  }

  const data = payload.data || {};
  switch (payload.command) {
    case "get_state":
      state.sessionState = data;
      if (data.model && state.bootstrap) {
        state.bootstrap.provider = data.model.provider;
        state.bootstrap.model = data.model.id;
      }
      if (data.sessionFile) {
        v2EnsureState().selectedSessionPath = data.sessionFile;
        if (state.bootstrap) {
          state.bootstrap.currentSessionPath = data.sessionFile;
        }
      }
      v2HydrateDraftsFromBootstrap(state.bootstrap || {});
      render();
      break;
    case "get_session_stats":
      state.sessionStats = data;
      render();
      break;
    case "get_messages":
      if (!v2PayloadMatchesCurrentSession(data)) {
        return;
      }
      state.messages = v2NormalizeRpcMessages(data.messages);
      if (data.sessionFile) {
        v2EnsureState().selectedSessionPath = data.sessionFile;
      }
      if (!state.sessionState?.isStreaming) {
        v2FinishAssistant();
      }
      render();
      break;
    case "get_available_models":
      state.availableModels = Array.isArray(data.models) ? data.models : [];
      render();
      break;
    case "prompt":
      state.sessionState = {
        ...(state.sessionState || {}),
        ...data,
      };
      if (data.sessionFile) {
        v2EnsureState().selectedSessionPath = data.sessionFile;
      }
      if (data.phase === "accepted") {
        appendStatus(v2Text("statusPromptAccepted"));
      }
      render();
      break;
    case "new_session":
    case "switch_session":
      appendStatus(v2Text("statusSessionSwitched"));
      refreshDesktop(false);
      break;
    case "set_model":
      if (state.bootstrap) {
        state.bootstrap.provider = data.provider || state.bootstrap.provider;
        state.bootstrap.model = data.id || state.bootstrap.model;
      }
      appendStatus(v2Text("statusModelApplied"));
      refreshDesktop(false);
      break;
    case "set_session_name":
      appendStatus(v2Text("statusSessionRenamed"));
      refreshDesktop(false);
      break;
    case "set_goal_contract":
    case "update_goal_run":
    case "update_goal_criterion":
    case "clear_goal_contract":
      refreshDesktop(false);
      break;
    case "export_html":
      appendStatus(`${v2Text("openExport")}: ${data.path || "HTML"}`);
      render();
      break;
    default:
      break;
  }
}

function handleRpcEvent(payload) {
  switch (payload.type) {
    case "agent_start":
      v2EnsureAssistantMessage();
      render();
      break;
    case "message_start":
    case "message_update":
    case "message_end":
      if (v2SyncAssistantMessageFromRpcMessage(payload.message)) {
        render();
      }
      break;
    case "text_delta":
      v2UpdateAssistantBody(payload.delta || payload.text || "");
      render();
      break;
    case "tool_start":
    case "tool_execution_start":
      v2PushAssistantTool(`tool: ${payload.toolName || payload.tool || payload.name || "running"}`);
      render();
      break;
    case "tool_execution_update":
      v2PushAssistantTool(`tool update: ${payload.toolName || payload.tool || payload.name || "running"}`);
      render();
      break;
    case "tool_end":
    case "tool_execution_end":
      v2PushAssistantTool(`tool done: ${payload.toolName || payload.tool || payload.name || "running"}`);
      render();
      break;
    case "agent_end":
      if (payload.error) {
        const target = v2PendingAssistant() || state.messages.find((message) => message.id === v2EnsureAssistantMessage());
        if (target) {
          target.body = payload.error;
          target.streaming = false;
        }
        appendStatus(payload.error, "error");
      }
      v2FinishAssistant();
      render();
      break;
    default:
      break;
  }
}

window.PiDesktop = {
  receive(message) {
    if (message.kind === "response") {
      const pending = pendingRequests.get(message.requestId);
      if (!pending) {
        return;
      }
      pendingRequests.delete(message.requestId);
      if (message.ok) {
        pending.resolve(message);
      } else {
        pending.reject(message.error || "Unknown desktop error.");
      }
      return;
    }

    if (message.kind !== "event") {
      return;
    }

    switch (message.event) {
      case "backend_status":
        state.backendReady = Boolean(message.payload.ready);
        appendStatus(message.payload.message || "", message.payload.ready ? "" : "error");
        if (message.payload.workspacePath && state.bootstrap) {
          state.bootstrap.workspacePath = message.payload.workspacePath;
          v2EnsureState().settingsDraft.workspacePath = message.payload.workspacePath;
        }
        break;
      case "backend_log":
        state.logs = [...state.logs, message.payload.line].slice(-160);
        updateDiagnosticsWithLine(message.payload.line);
        render();
        break;
      case "rpc_event":
        handleRpcEvent(message.payload);
        break;
      case "rpc_response":
        handleRpcResponse(message.payload);
        break;
      case "desktop_catalog":
        applyBootstrap(message.payload);
        render();
        break;
      case "desktop_export":
        appendStatus(`${v2Text("openExport")}: ${message.payload.path || "HTML"}`);
        break;
      default:
        break;
    }
  },
};

function v2BuildConfigurationPayload() {
  const draft = v2EnsureState().settingsDraft;
  return {
    providerPreset: draft.providerPreset,
    provider: draft.provider,
    model: draft.model,
    apiKey: String(draft.apiKey || "").trim(),
    apiBaseURL: String(draft.apiBaseURL || "").trim(),
    apiProtocol: String(draft.apiProtocol || "").trim(),
    starterAgent: draft.starterAgent,
    uiLanguage: draft.uiLanguage,
    uiMode: draft.uiMode,
    workspacePath: draft.workspacePath || state.bootstrap?.workspacePath || "",
    checkForUpdates: draft.checkForUpdates !== false,
  };
}

function v2PersistConfiguration(action) {
  const v2 = v2EnsureState();
  hostRequest(action, v2BuildConfigurationPayload())
    .then((response) => {
      if (response.payload?.error) {
        throw new Error(response.payload.error);
      }
      applyBootstrap(response.payload || {});
      v2.settingsDraft.apiKey = "";
      state.view = "app";
      appendStatus(action === "saveOnboarding" ? v2Text("statusReady") : v2Text("statusSaved"));
      render();
      refreshDesktop(false);
    })
    .catch((error) => appendStatus(String(error), "error"));
}

function saveOnboarding() {
  v2PersistConfiguration("saveOnboarding");
}

function v2SaveDefaults() {
  v2PersistConfiguration("savePreferences");
}

function v2SelectProviderPreset(id) {
  const v2 = v2EnsureState();
  const preset = v2ProviderPresetById(id);
  v2.settingsDraft.providerPreset = preset.id;
  v2.settingsDraft.provider = preset.runtimeProviderId || preset.id;
  v2.settingsDraft.model = v2RecommendedModel(v2.settingsDraft.provider, preset.id);
  v2.settingsDraft.apiBaseURL = preset.apiBaseURL || "";
  v2.settingsDraft.apiProtocol = preset.apiProtocol || "";
  render();
}

function v2UpdateSettingsField(field, value) {
  const v2 = v2EnsureState();
  v2.settingsDraft[field] = value;
  if (field === "uiLanguage") {
    state.ui.language = value;
  }
  if (field === "uiMode") {
    state.ui.mode = value;
  }
  render();
}

function chooseWorkspace() {
  hostRequest("chooseWorkspace")
    .then((response) => {
      if (response.payload?.error) {
        throw new Error(response.payload.error);
      }
      applyBootstrap(response.payload || {});
      appendStatus(v2Text("statusWorkspace"));
      render();
      if (response.payload?.configured) {
        refreshDesktop(false);
      }
    })
    .catch((error) => appendStatus(String(error), "error"));
}

function v2ImportExistingSetup() {
  hostRequest("importExistingSetup")
    .then((response) => {
      if (response.payload?.error) {
        throw new Error(response.payload.error);
      }
      applyBootstrap(response.payload || {});
      state.view = "app";
      appendStatus(v2Text("statusImported"));
      render();
      refreshDesktop(false);
    })
    .catch((error) => appendStatus(String(error), "error"));
}

function v2RemoveSavedCredential() {
  const draft = v2EnsureState().settingsDraft;
  hostRequest("removeProviderCredential", {
    providerPreset: draft.providerPreset,
    provider: draft.provider,
  })
    .then((response) => {
      if (response.payload?.error) {
        throw new Error(response.payload.error);
      }
      applyBootstrap(response.payload || {});
      appendStatus(v2Text("credentialStateMissing"));
      render();
    })
    .catch((error) => appendStatus(String(error), "error"));
}

function startNewSession() {
  const v2 = v2EnsureState();
  v2.selectedSessionPath = "";
  v2.sessionNameDirty = false;
  state.messages = [];
  v2FinishAssistant();
  hostRequest("newSession")
    .then(() => {
      appendStatus(v2Text("statusSessionSwitched"));
      refreshDesktop(false);
    })
    .catch((error) => appendStatus(String(error), "error"));
}

function switchSession(sessionPath) {
  const v2 = v2EnsureState();
  v2.selectedSessionPath = sessionPath;
  v2.sessionNameDirty = false;
  state.messages = [];
  v2FinishAssistant();
  render();
  hostRequest("switchSession", { sessionPath })
    .then(() => {
      appendStatus(v2Text("statusSessionSwitched"));
      refreshDesktop(false);
    })
    .catch((error) => appendStatus(String(error), "error"));
}

function restartBackend() {
  hostRequest("restartBackend")
    .then((response) => {
      if (response.payload?.error) {
        throw new Error(response.payload.error);
      }
      applyBootstrap(response.payload || {});
      appendStatus(v2Text("statusRestarted"));
      render();
      refreshDesktop(false);
    })
    .catch((error) => appendStatus(String(error), "error"));
}

function refreshBootstrapOnly() {
  return hostRequest("bootstrap")
    .then((response) => {
      if (response.payload?.error) {
        throw new Error(response.payload.error);
      }
      applyBootstrap(response.payload || {});
      render();
      return response.payload;
    })
    .catch((error) => {
      appendStatus(String(error), "error");
      return null;
    });
}

function refreshDesktop(renderStatus = true) {
  return hostRequest("refreshDesktop")
    .then((response) => {
      if (response.payload?.error) {
        throw new Error(response.payload.error);
      }
      applyBootstrap(response.payload || {});
      if (renderStatus) {
        appendStatus(v2Text("statusRefreshed"));
      } else {
        render();
      }
      return response.payload;
    })
    .catch((error) => {
      appendStatus(String(error), "error");
      return null;
    });
}

function v2PickComposerAttachments() {
  hostRequest("pickComposerAttachments", { purpose: "any" })
    .then((response) => {
      const attachments = Array.isArray(response.payload?.attachments) ? response.payload.attachments : [];
      v2EnsureState().attachments = attachments;
      appendStatus(v2Text("statusAttachmentPicked"));
      render();
    })
    .catch((error) => appendStatus(String(error), "error"));
}

function v2RemoveAttachment(id) {
  const v2 = v2EnsureState();
  v2.attachments = v2.attachments.filter((attachment) => attachment.id !== id);
  render();
}

function v2UpdateComposer(value) {
  v2EnsureState().composerText = value;
}

function v2HandleComposerKeydown(event) {
  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
    event.preventDefault();
    sendPrompt();
  }
}

function v2SetSessionQuery(value) {
  v2EnsureState().sessionQuery = value;
  render();
}

function v2SetDiagnosticsQuery(value) {
  v2EnsureState().diagnosticsQuery = value;
  render();
}

function v2SetDiagnosticsLevel(value) {
  v2EnsureState().diagnosticsLevel = value;
  render();
}

function v2SetDiagnosticsCategory(value) {
  v2EnsureState().diagnosticsCategory = value;
  render();
}

function v2ApplyQuickPrompt(text) {
  const v2 = v2EnsureState();
  v2.composerText = text;
  render();
  const composer = document.getElementById("v2-composer-textarea");
  composer?.focus();
  composer?.setSelectionRange(composer.value.length, composer.value.length);
}

function sendPrompt(event) {
  if (event?.preventDefault) {
    event.preventDefault();
  }

  const v2 = v2EnsureState();
  const message = String(v2.composerText || "").trim();
  const attachments = Array.isArray(v2.attachments) ? v2.attachments : [];
  if (!message && !attachments.length) {
    return;
  }

  v2.composerBusy = true;
  const previewParts = [];
  if (message) {
    previewParts.push(message);
  }
  if (attachments.length) {
    previewParts.push(
      attachments
        .map((item) => `• ${item.name || item.path || item.id || "attachment"}`)
        .join("\n")
    );
  }

  state.messages.push({
    id: `local-user-${safeUUID()}`,
    role: "user",
    label: v2Text("userLabel"),
    body: previewParts.join("\n\n"),
    attachments: attachments.map((item) => item.name || item.path || "attachment"),
    tools: [],
    createdAt: new Date().toISOString(),
    streaming: false,
  });

  v2EnsureAssistantMessage();
  const outboundAttachments = [...attachments];
  v2.composerText = "";
  v2.attachments = [];
  v2.autoScrollPending = true;
  render();

  hostRequest("sendPrompt", {
    message,
    attachments: outboundAttachments,
  })
    .then(() => {
      v2.composerBusy = false;
      appendStatus(v2Text("statusPromptAccepted"));
      render();
    })
    .catch((error) => {
      v2.composerBusy = false;
      const assistant = v2PendingAssistant();
      if (assistant) {
        assistant.body = String(error);
        assistant.streaming = false;
      }
      v2FinishAssistant();
      appendStatus(String(error), "error");
      render();
    });
}

function openCurrentSession() {
  hostRequest("openCurrentSession").catch((error) => appendStatus(String(error), "error"));
}

function openSessionsFolder() {
  hostRequest("openSessionsFolder").catch((error) => appendStatus(String(error), "error"));
}

function openAppSupport() {
  hostRequest("openAppSupport").catch((error) => appendStatus(String(error), "error"));
}

function exportCurrentSession() {
  hostRequest("exportCurrentSession").catch((error) => appendStatus(String(error), "error"));
}

function v2OpenHostedWorkspace() {
  hostRequest("openWebWorkspaceExternal").catch((error) => appendStatus(String(error), "error"));
}

function v2OpenHostedWorkspaceInApp() {
  hostRequest("switchDesktopSurface", { mode: "web" }).catch((error) => appendStatus(String(error), "error"));
}

function v2UpdateSessionName(value) {
  const v2 = v2EnsureState();
  v2.sessionNameDraft = value;
  v2.sessionNameDirty = true;
}

function saveSessionName() {
  const v2 = v2EnsureState();
  hostRequest("setSessionName", { name: v2.sessionNameDraft })
    .then(() => {
      v2.sessionNameDirty = false;
      appendStatus(v2Text("statusSessionRenamed"));
      refreshDesktop(false);
    })
    .catch((error) => appendStatus(String(error), "error"));
}

function v2UpdateSessionAgent(value) {
  v2EnsureState().sessionAgentDraft = value;
  render();
}

function v2ApplySessionAgent() {
  const v2 = v2EnsureState();
  const sessionPath = v2CurrentSessionPath();
  if (!sessionPath) {
    return;
  }
  hostRequest("setSessionAgentProfile", {
    sessionPath,
    agentId: v2.sessionAgentDraft,
  })
    .then((response) => {
      if (response.payload?.error) {
        throw new Error(response.payload.error);
      }
      applyBootstrap(response.payload || {});
      appendStatus(v2Text("statusAgentApplied"));
      render();
    })
    .catch((error) => appendStatus(String(error), "error"));
}

function v2UpdateModelProvider(value) {
  const v2 = v2EnsureState();
  v2.modelDraft.provider = value;
  v2.settingsDraft.provider = value;
  const preset = v2ProviderPresets().find((entry) => (entry.runtimeProviderId || entry.id) === value);
  if (preset) {
    v2.settingsDraft.providerPreset = preset.id;
    v2.settingsDraft.apiBaseURL = preset.apiBaseURL || v2.settingsDraft.apiBaseURL;
    v2.settingsDraft.apiProtocol = preset.apiProtocol || v2.settingsDraft.apiProtocol;
  }
  const suggestions = v2ModelsForProvider(value);
  if (!suggestions.some((entry) => entry.id === v2.modelDraft.modelId)) {
    v2.modelDraft.modelId = suggestions[0]?.id || "";
  }
  v2.settingsDraft.model = v2.modelDraft.modelId;
  render();
}

function v2UpdateModelId(value) {
  const v2 = v2EnsureState();
  v2.modelDraft.modelId = value;
  v2.settingsDraft.model = value;
}

function v2ApplyModelSelection() {
  const draft = v2EnsureState().modelDraft;
  if (!draft.provider || !draft.modelId) {
    return;
  }
  hostRequest("setModel", {
    provider: draft.provider,
    modelId: draft.modelId,
  })
    .then(() => {
      appendStatus(v2Text("statusModelApplied"));
      refreshDesktop(false);
    })
    .catch((error) => appendStatus(String(error), "error"));
}

function v2SelectSection(section) {
  v2EnsureState().section = section;
  render();
}

function v2SectionMeta(section) {
  switch (section) {
    case "settings":
      return {
        title: v2LocaleText("桌面设置", "Desktop Settings"),
        detail: v2LocaleText("把 provider、默认模型、窗口行为和 agent 配置放回真正的软件控制面里。", "Put providers, defaults, window behavior, and agent profiles back into a real software control plane."),
      };
    case "security":
      return {
        title: v2LocaleText("安全与权限", "Security & Access"),
        detail: v2LocaleText("集中管理执行策略、文件系统范围、macOS 权限和扩展授权决策。", "Manage execution policy, filesystem scope, macOS permissions, and extension approvals in one place."),
      };
    case "operations":
      return {
        title: v2LocaleText("运维与诊断", "Operations & Diagnostics"),
        detail: v2LocaleText("更新、诊断、渠道、技能和自动化的运行视图都应该是桌面端的一等能力。", "Updates, diagnostics, channels, skills, and automations should all be first-class desktop capabilities."),
      };
    default:
      return {
        title: v2LocaleText("工作区", "Workspace"),
        detail: v2LocaleText("把当前会话放在中心，把上下文、模型和控制面板留在同一个桌面视图中。", "Keep the active thread centered while context, models, and controls stay inside the same desktop view."),
      };
  }
}

function v2UpdateHostField(field, value) {
  v2EnsureState().hostDraft[field] = value;
  render();
}

function v2SaveHostSettings() {
  hostRequest("saveHostSettings", v2EnsureState().hostDraft)
    .then((response) => {
      applyBootstrap(response.payload || {});
      appendStatus(v2LocaleText("桌面外壳设置已保存。", "Desktop shell settings saved."));
      render();
    })
    .catch((error) => appendStatus(String(error), "error"));
}

function v2SwitchDesktopSurface(mode, makePreferred = false) {
  hostRequest("switchDesktopSurface", { mode, makePreferred })
    .then(() => {
      appendStatus(mode === "web"
        ? v2LocaleText("已切换到内置 Web 工作区。", "Embedded web workspace opened.")
        : v2LocaleText("已切换到桌面控制中心。", "Desktop control center opened."));
      refreshBootstrapOnly();
    })
    .catch((error) => appendStatus(String(error), "error"));
}

function v2OpenExternalPath(path) {
  if (!path) {
    return;
  }
  hostRequest("openExternalPath", { path }).catch((error) => appendStatus(String(error), "error"));
}

function v2UpdateSecurityField(field, value) {
  const draft = v2EnsureState().securityDraft;
  draft[field] = value;
  if (field === "gatewayMode" && value === "direct") {
    draft.gatewayURL = "";
  }
  render();
}

function v2SaveSecuritySettings() {
  hostRequest("saveSecuritySettings", v2EnsureState().securityDraft)
    .then((response) => {
      applyBootstrap(response.payload || {});
      appendStatus(v2LocaleText("安全策略已保存。", "Security policy saved."));
      render();
    })
    .catch((error) => appendStatus(String(error), "error"));
}

function v2PickScopedDirectory() {
  hostRequest("pickScopedDirectory")
    .then((response) => {
      applyBootstrap(response.payload || {});
      appendStatus(v2LocaleText("已加入新的授权目录。", "Approved directory added."));
      render();
    })
    .catch((error) => {
      if (!String(error).includes("Cancelled")) {
        appendStatus(String(error), "error");
      }
    });
}

function v2RemoveScopedDirectory(path) {
  hostRequest("removeScopedDirectory", { path })
    .then((response) => {
      applyBootstrap(response.payload || {});
      appendStatus(v2LocaleText("已移除授权目录。", "Approved directory removed."));
      render();
    })
    .catch((error) => appendStatus(String(error), "error"));
}

function v2RequestSystemPermission(permissionId) {
  hostRequest("requestSystemPermission", { permissionId })
    .then((response) => {
      applyBootstrap(response.payload || {});
      appendStatus(v2LocaleText("权限状态已刷新。", "Permission state refreshed."));
      render();
    })
    .catch((error) => appendStatus(String(error), "error"));
}

function v2OpenPrivacySettings(permissionId) {
  hostRequest("openPrivacySettings", { permissionId })
    .then(() => appendStatus(v2LocaleText("已打开系统隐私设置。", "System privacy settings opened.")))
    .catch((error) => appendStatus(String(error), "error"));
}

function v2ResetPermissionDecisions() {
  hostRequest("resetPermissionDecisions")
    .then((response) => {
      applyBootstrap(response.payload || {});
      appendStatus(v2LocaleText("扩展授权决策已重置。", "Extension permission decisions reset."));
      render();
    })
    .catch((error) => appendStatus(String(error), "error"));
}

function v2RemovePermissionExtension(extensionId) {
  hostRequest("removePermissionExtension", { extensionId })
    .then((response) => {
      applyBootstrap(response.payload || {});
      appendStatus(v2LocaleText("扩展授权规则已移除。", "Extension permission rules removed."));
      render();
    })
    .catch((error) => appendStatus(String(error), "error"));
}

function v2CheckForUpdates() {
  hostRequest("checkForUpdates")
    .then((response) => {
      applyBootstrap(response.payload || {});
      appendStatus(v2LocaleText("已检查桌面更新。", "Desktop update check finished."));
      render();
    })
    .catch((error) => appendStatus(String(error), "error"));
}

function v2DownloadAndInstallUpdate() {
  hostRequest("downloadAndInstallUpdate")
    .then((response) => {
      if (response.payload) {
        applyBootstrap(response.payload);
      }
      appendStatus(v2LocaleText("安装器下载流程已启动。", "Installer download started."));
      render();
    })
    .catch((error) => appendStatus(String(error), "error"));
}

function v2OpenReleasePage() {
  hostRequest("openReleasePage")
    .then(() => appendStatus(v2LocaleText("已打开发布页面。", "Release page opened.")))
    .catch((error) => appendStatus(String(error), "error"));
}

function v2OpenDesktopLog() {
  hostRequest("openDesktopLog")
    .then(() => appendStatus(v2LocaleText("已打开桌面日志。", "Desktop log opened.")))
    .catch((error) => appendStatus(String(error), "error"));
}

function v2ExportDiagnosticsReport() {
  hostRequest("exportDiagnosticsReport")
    .then((response) => {
      const path = response.payload?.path || "";
      appendStatus(path
        ? `${v2LocaleText("诊断报告已导出到", "Diagnostics report exported to")} ${path}`
        : v2LocaleText("诊断报告已导出。", "Diagnostics report exported."));
      if (response.payload?.bootstrap) {
        applyBootstrap(response.payload.bootstrap);
      }
      render();
    })
    .catch((error) => appendStatus(String(error), "error"));
}

function v2PrepareSupportReport() {
  hostRequest("prepareSupportReport")
    .then((response) => {
      const path = response.payload?.path || "";
      appendStatus(path
        ? `${v2LocaleText("支持包已生成到", "Support bundle prepared at")} ${path}`
        : v2LocaleText("支持包已生成。", "Support bundle prepared."));
      if (response.payload?.bootstrap) {
        applyBootstrap(response.payload.bootstrap);
      }
      render();
    })
    .catch((error) => appendStatus(String(error), "error"));
}

function v2SelectAgentProfile(agentId) {
  v2EnsureState().selectedAgentId = agentId;
  render();
}

function v2UpdateAgentProfileField(field, value) {
  const draft = v2CurrentAgentDraft();
  if (!draft) {
    return;
  }
  draft[field] = value;
  if (field === "modeId" && value !== "override") {
    draft.provider = "";
    draft.model = "";
  }
  render();
}

function v2SaveAgentProfiles() {
  const profiles = Object.values(v2EnsureState().agentDrafts).map((draft) => ({
    id: draft.id,
    displayName: draft.displayName,
    description: draft.description,
    modeId: draft.modeId,
    provider: draft.provider,
    model: draft.model,
    skills: Array.isArray(draft.skills) ? draft.skills : [],
    prompts: Array.isArray(draft.prompts) ? draft.prompts : [],
  }));

  hostRequest("saveAgentProfiles", { profiles })
    .then((response) => {
      applyBootstrap(response.payload || {});
      appendStatus(v2LocaleText("Agent 配置已保存。", "Agent profiles saved."));
      render();
    })
    .catch((error) => appendStatus(String(error), "error"));
}

function renderFatal(error) {
  state.view = "fatal";
  state.status = String(error?.message || error || "");
  state.statusKind = "error";
  render();
}

function v2RenderStatusLine() {
  const badgeClass = v2BackendLevel();
  return `
    <div class="v2-status-line">
      <div>
        <strong>${escapeHtml(state.status || (state.bootstrap?.configured ? v2Text("statusReady") : v2Text("statusSetup")))}</strong>
        <div class="v2-status-copy">${escapeHtml(v2Text("workspacePath"))}: ${escapeHtml(state.bootstrap?.workspacePath || "—")}</div>
      </div>
      <span class="v2-badge ${badgeClass}">${escapeHtml(v2BackendLabel())}</span>
    </div>
  `;
}

function v2RenderOnboarding() {
  const v2 = v2EnsureState();
  const providers = v2ProviderPresets();
  const agents = v2Agents();
  const importCandidate = state.bootstrap?.importCandidate || {};
  const customProviderField =
    v2.settingsDraft.providerPreset === "custom"
      ? `
        <div class="v2-field">
          <label for="v2-provider-id">${escapeHtml(v2Text("providerId"))}</label>
          <input
            id="v2-provider-id"
            class="v2-input"
            value="${escapeHtml(v2.settingsDraft.provider || "")}"
            oninput="v2UpdateSettingsField('provider', this.value)"
          />
        </div>
      `
      : "";

  return `
    <div class="v2-root">
      <div class="v2-setup">
        <section class="v2-card pad-lg v2-setup-copy">
          <div class="v2-kicker">${escapeHtml(v2Text("setupEyebrow"))}</div>
          <h1 class="v2-headline">${escapeHtml(v2Text("setupTitle"))}</h1>
          <p class="v2-subtitle">${escapeHtml(v2Text("setupBody"))}</p>
          <div class="v2-stat-grid">
            <div class="v2-stat">
              <strong>${escapeHtml(v2Text("liveChat"))}</strong>
              <span>${escapeHtml(v2Text("setupNoteA"))}</span>
            </div>
            <div class="v2-stat">
              <strong>${escapeHtml(v2Text("defaultsCard"))}</strong>
              <span>${escapeHtml(v2Text("setupNoteB"))}</span>
            </div>
            <div class="v2-stat">
              <strong>${escapeHtml(v2Text("diagnosticsCard"))}</strong>
              <span>${escapeHtml(v2Text("setupNoteC"))}</span>
            </div>
          </div>
          <div class="v2-note-list">
            <div class="v2-note">${escapeHtml(v2Text("setupProviderHint"))}</div>
            <div class="v2-note">${escapeHtml(v2HasSavedCredential() ? v2Text("credentialStateSaved") : v2Text("credentialStateMissing"))}</div>
            ${importCandidate.available ? `<div class="v2-note">${escapeHtml(v2Text("importAvailable"))}</div>` : ""}
          </div>
        </section>
        <section class="v2-card pad-lg v2-setup-panel">
          <div class="v2-panel-head">
            <div>
              <div class="v2-kicker">${escapeHtml(v2Text("saveHostActions"))}</div>
              <h2 class="v2-setup-title">${escapeHtml(v2Text("setupCardTitle"))}</h2>
            </div>
          </div>
          <p class="v2-copy">${escapeHtml(v2Text("setupCardBody"))}</p>
          <div class="v2-flow-label">${escapeHtml(v2LocaleText("1. 选择服务商", "1. Choose a provider"))}</div>
          <div class="v2-provider-grid">
            ${providers
              .map((preset) => `
                <button
                  class="v2-provider-tile v2-chip-button ${v2.settingsDraft.providerPreset === preset.id ? "active" : ""}"
                  type="button"
                  onclick="v2SelectProviderPreset('${escapeJsSingle(preset.id)}')"
                >
                  <strong>${escapeHtml(preset.label || preset.id)}</strong>
                  <span>${escapeHtml(preset.description || "")}</span>
                </button>
              `)
              .join("")}
          </div>
          <div class="v2-flow-label">${escapeHtml(v2LocaleText("2. 填入默认配置", "2. Set your defaults"))}</div>
          <div class="v2-field-row">
            <div class="v2-field">
              <label for="v2-model-id">${escapeHtml(v2Text("modelId"))}</label>
              <input
                id="v2-model-id"
                class="v2-input"
                value="${escapeHtml(v2.settingsDraft.model || "")}"
                oninput="v2UpdateSettingsField('model', this.value)"
              />
            </div>
            <div class="v2-field">
              <label for="v2-api-key">${escapeHtml(v2Text("apiKey"))}</label>
              <input
                id="v2-api-key"
                class="v2-input"
                type="password"
                value="${escapeHtml(v2.settingsDraft.apiKey || "")}"
                oninput="v2UpdateSettingsField('apiKey', this.value)"
              />
            </div>
          </div>
          ${customProviderField}
          <div class="v2-field-row">
            <div class="v2-field">
              <label for="v2-api-base">${escapeHtml(v2Text("apiBase"))}</label>
              <input
                id="v2-api-base"
                class="v2-input"
                value="${escapeHtml(v2.settingsDraft.apiBaseURL || "")}"
                oninput="v2UpdateSettingsField('apiBaseURL', this.value)"
              />
            </div>
            <div class="v2-field">
              <label for="v2-api-protocol">${escapeHtml(v2Text("apiProtocol"))}</label>
              <input
                id="v2-api-protocol"
                class="v2-input"
                value="${escapeHtml(v2.settingsDraft.apiProtocol || "")}"
                oninput="v2UpdateSettingsField('apiProtocol', this.value)"
              />
            </div>
          </div>
          <div class="v2-field-row">
            <div class="v2-field">
              <label for="v2-workspace">${escapeHtml(v2Text("workspace"))}</label>
              <div class="v2-inline-form">
                <input id="v2-workspace" class="v2-input" value="${escapeHtml(v2.settingsDraft.workspacePath || "")}" readonly />
                <button class="v2-ghost" type="button" onclick="chooseWorkspace()">${escapeHtml(v2Text("chooseWorkspace"))}</button>
              </div>
            </div>
            <div class="v2-field">
              <label for="v2-agent">${escapeHtml(v2Text("starterAgent"))}</label>
              <select id="v2-agent" class="v2-select" onchange="v2UpdateSettingsField('starterAgent', this.value)">
                ${agents
                  .map((agent) => `
                    <option value="${escapeHtml(agent.id)}" ${v2.settingsDraft.starterAgent === agent.id ? "selected" : ""}>
                      ${escapeHtml(agent.displayName || agent.id)}
                    </option>
                  `)
                  .join("")}
              </select>
            </div>
          </div>
          <div class="v2-field-row">
            <div class="v2-field">
              <label for="v2-language">${escapeHtml(v2Text("uiLanguage"))}</label>
              <select id="v2-language" class="v2-select" onchange="v2UpdateSettingsField('uiLanguage', this.value)">
                <option value="en" ${String(v2.settingsDraft.uiLanguage).startsWith("en") ? "selected" : ""}>${escapeHtml(v2Text("languageEnglish"))}</option>
                <option value="zh-CN" ${String(v2.settingsDraft.uiLanguage).startsWith("zh") ? "selected" : ""}>${escapeHtml(v2Text("languageChinese"))}</option>
              </select>
            </div>
            <div class="v2-field">
              <label for="v2-mode">${escapeHtml(v2Text("uiMode"))}</label>
              <select id="v2-mode" class="v2-select" onchange="v2UpdateSettingsField('uiMode', this.value)">
                <option value="simple" ${v2.settingsDraft.uiMode === "simple" ? "selected" : ""}>${escapeHtml(v2Text("modeSimple"))}</option>
                <option value="pro" ${v2.settingsDraft.uiMode === "pro" ? "selected" : ""}>${escapeHtml(v2Text("modePro"))}</option>
              </select>
            </div>
          </div>
          ${v2RenderStatusLine()}
          <div class="v2-flow-label">${escapeHtml(v2LocaleText("3. 启动桌面端", "3. Launch the desktop"))}</div>
          <div class="v2-action-cluster primary">
            <button class="v2-button" type="button" onclick="saveOnboarding()">${escapeHtml(v2Text("saveAndLaunch"))}</button>
          </div>
          <div class="v2-action-cluster secondary">
            <button class="v2-ghost" type="button" onclick="v2ImportExistingSetup()" ${importCandidate.available ? "" : "disabled"}>${escapeHtml(v2Text("importSetup"))}</button>
            <button class="v2-soft" type="button" onclick="v2RemoveSavedCredential()" ${v2HasSavedCredential() ? "" : "disabled"}>${escapeHtml(v2Text("removeCredential"))}</button>
            <button class="v2-ghost" type="button" onclick="v2OpenHostedWorkspace()">${escapeHtml(v2Text("openHostedWeb"))}</button>
          </div>
        </section>
      </div>
    </div>
  `;
}

function v2RenderSessionRows() {
  const sessions = v2FilteredSessions();
  if (!sessions.length) {
    const hasAnySessions = v2Sessions().length > 0;
    return `
      <div class="v2-empty">
        <div>
          <strong>${escapeHtml(v2Text(hasAnySessions ? "noSessionMatches" : "noSessionsTitle"))}</strong>
          <p class="v2-empty-copy">${escapeHtml(v2Text("noSessionsBody"))}</p>
        </div>
      </div>
    `;
  }
  return sessions
    .map((session) => `
      <button
        class="v2-session-row ${session.path === v2CurrentSessionPath() ? "active" : ""}"
        type="button"
        onclick="switchSession('${escapeJsSingle(session.path)}')"
      >
        <div class="v2-row-between">
          <strong>${escapeHtml(session.name || "session")}</strong>
          ${session.isCurrent ? `<span class="v2-badge good">${escapeHtml(v2Text("current"))}</span>` : ""}
        </div>
        <span>${escapeHtml(shorten(session.preview || "", 110) || "—")}</span>
        <small>${escapeHtml(v2Text("lastUpdated"))}: ${escapeHtml(v2FormatTime(session.modifiedAt))}</small>
      </button>
    `)
    .join("");
}

function v2RenderMessages() {
  if (!state.messages.length) {
    return `
      <div class="v2-empty">
        <div>
          <strong>${escapeHtml(v2Text("emptyChatTitle"))}</strong>
          <p class="v2-empty-copy">${escapeHtml(v2Text("emptyChatBody"))}</p>
          <div class="v2-empty-actions">
            ${v2QuickPrompts()
              .map((prompt) => `
                <button class="v2-chip-button" type="button" onclick="v2ApplyQuickPrompt('${escapeJsSingle(prompt)}')">
                  ${escapeHtml(prompt)}
                </button>
              `)
              .join("")}
          </div>
        </div>
      </div>
    `;
  }

  return state.messages
    .map((message) => `
      <article class="v2-message ${escapeHtml(message.role)} ${message.streaming ? "streaming" : ""}">
        <div class="v2-message-meta">
          <span>${escapeHtml(message.label || (message.role === "user" ? v2Text("userLabel") : productName()))}</span>
          <span>${escapeHtml(v2FormatTime(message.createdAt))}</span>
          ${message.streaming ? `<span class="v2-dot"></span>` : ""}
        </div>
        <div class="v2-message-copy">${escapeHtml(message.body || v2Text("noMessages"))}</div>
        ${
          Array.isArray(message.attachments) && message.attachments.length
            ? `<div class="v2-message-attachments">${message.attachments.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div>`
            : ""
        }
        ${
          Array.isArray(message.tools) && message.tools.length
            ? `<div class="v2-message-tools">${message.tools.map((item) => `<span class="v2-message-tool">${escapeHtml(item)}</span>`).join("")}</div>`
            : ""
        }
      </article>
    `)
    .join("");
}

function v2RenderComposer() {
  const v2 = v2EnsureState();
  return `
    <form class="v2-composer" onsubmit="sendPrompt(event)">
      ${
        v2.attachments.length
          ? `
            <div class="v2-stack">
              <div class="v2-inline-meta">${escapeHtml(v2Text("composerAttachments"))}</div>
              <div class="v2-attachment-strip">
                ${v2.attachments
                  .map((attachment) => `
                    <span class="v2-attachment-chip">
                      ${escapeHtml(attachment.name || attachment.path || attachment.id || "attachment")}
                      <button class="v2-ghost" type="button" onclick="v2RemoveAttachment('${escapeJsSingle(attachment.id || attachment.path || attachment.name || safeUUID())}')">×</button>
                    </span>
                  `)
                  .join("")}
              </div>
            </div>
          `
          : ""
      }
      <textarea
        id="v2-composer-textarea"
        class="v2-textarea"
        placeholder="${escapeHtml(v2Text("composePlaceholder"))}"
        oninput="v2UpdateComposer(this.value)"
        onkeydown="v2HandleComposerKeydown(event)"
      >${escapeHtml(v2.composerText || "")}</textarea>
      <div class="v2-toolbar">
        <span class="v2-inline-meta">${escapeHtml(v2Text("shortcutHint"))}</span>
        <button class="v2-ghost" type="button" onclick="v2PickComposerAttachments()">${escapeHtml(v2Text("attachFiles"))}</button>
        <button class="v2-button" type="submit" ${v2.composerBusy ? "disabled" : ""}>${escapeHtml(v2.composerBusy ? v2Text("sending") : v2Text("send"))}</button>
      </div>
    </form>
  `;
}

function v2SectionTabs() {
  const updateState = v2UpdateState();
  return [
    {
      id: "chat",
      label: v2LocaleText("工作区", "Workspace"),
      note: v2CurrentSession()?.name || v2LocaleText("当前线程", "Active thread"),
      badge: v2CurrentModel().id || v2BackendLabel(),
    },
    {
      id: "settings",
      label: v2LocaleText("设置", "Settings"),
      note: v2LocaleText("默认值与桌面外壳", "Defaults and shell"),
      badge: v2CurrentModel().provider || "—",
    },
    {
      id: "security",
      label: v2LocaleText("安全", "Security"),
      note: v2LocaleText("权限与策略", "Permissions and policy"),
      badge: String((v2SecurityState().decisions || []).length),
    },
    {
      id: "operations",
      label: v2LocaleText("运维", "Operations"),
      note: v2LocaleText("更新、诊断、渠道", "Updates, diagnostics, channels"),
      badge: updateState.latestVersion || String(v2FilteredLogs().length),
    },
  ];
}

function v2RenderSectionNav() {
  const v2 = v2EnsureState();
  return `
    <div class="v2-nav-stack">
      ${v2SectionTabs()
        .map((item) => `
          <button
            class="v2-nav-item ${v2.section === item.id ? "active" : ""}"
            type="button"
            onclick="v2SelectSection('${item.id}')"
          >
            <div class="v2-nav-copy">
              <strong>${escapeHtml(item.label)}</strong>
              <span>${escapeHtml(item.note)}</span>
            </div>
            <span class="v2-nav-badge">${escapeHtml(item.badge)}</span>
          </button>
        `)
        .join("")}
    </div>
  `;
}

function v2RenderSidebar() {
  return `
    <aside class="v2-sidebar">
      <section class="v2-card pad-md">
        <div class="v2-brand">
          <div class="v2-inline-row">
            <span class="v2-brand-mark">猫</span>
            <div>
              <strong>maoclaw</strong>
              <div class="v2-inline-meta">${escapeHtml(v2LocaleText("桌面客户端", "Desktop Client"))}</div>
            </div>
          </div>
          <span class="v2-badge ${v2BackendLevel()}">${escapeHtml(v2BackendLabel())}</span>
        </div>
        <div class="v2-stack">
          <button class="v2-button" type="button" onclick="startNewSession()">${escapeHtml(v2Text("newSession"))}</button>
          <button class="v2-ghost" type="button" onclick="openSessionsFolder()">${escapeHtml(v2Text("openSessionsFolder"))}</button>
          <button class="v2-soft" type="button" onclick="refreshDesktop()">${escapeHtml(v2Text("refreshDesktop"))}</button>
        </div>
      </section>

      <section class="v2-card pad-md">
        <div class="v2-panel-head">
          <h2 class="v2-panel-title">${escapeHtml(v2LocaleText("控制面", "Control Plane"))}</h2>
          <span class="v2-pill">${escapeHtml(v2FormatCount(v2SectionTabs().length))}</span>
        </div>
        ${v2RenderSectionNav()}
      </section>

      <section class="v2-card pad-md">
        <div class="v2-panel-head">
          <h2 class="v2-panel-title">${escapeHtml(v2Text("sidebarTitle"))}</h2>
          <span class="v2-pill">${escapeHtml(v2FormatCount(v2Sessions().length))}</span>
        </div>
        <div class="v2-field">
          <input
            class="v2-input"
            value="${escapeHtml(v2EnsureState().sessionQuery || "")}"
            placeholder="${escapeHtml(v2Text("sessionSearch"))}"
            oninput="v2SetSessionQuery(this.value)"
          />
        </div>
        <div class="v2-sidebar-stack">
          ${v2RenderSessionRows()}
        </div>
      </section>
    </aside>
  `;
}

function v2RenderMain() {
  const currentModel = v2CurrentModel();
  const stats = state.sessionStats || {};
  return `
    <main class="v2-main">
      <section class="v2-card v2-hero">
        <div class="v2-shell-header">
          <div>
            <div class="v2-kicker">${escapeHtml(v2Text("heroEyebrow"))}</div>
            <h1 class="v2-setup-title">${escapeHtml(v2Text("heroTitle"))}</h1>
            <p class="v2-subtitle">${escapeHtml(v2Text("heroBody"))}</p>
          </div>
          <div class="v2-summary-grid">
            <div class="v2-summary">
              <strong>${escapeHtml(v2Text("usageMessages"))}</strong>
              <span>${escapeHtml(v2FormatCount(stats.totalMessages || state.sessionState?.messageCount || 0))}</span>
            </div>
            <div class="v2-summary">
              <strong>${escapeHtml(v2Text("usageTokens"))}</strong>
              <span>${escapeHtml(v2FormatCount(stats.tokens?.total || 0))}</span>
            </div>
            <div class="v2-summary">
              <strong>${escapeHtml(v2Text("usageCost"))}</strong>
              <span>${escapeHtml(v2FormatCurrency(stats.cost || 0))}</span>
            </div>
            <div class="v2-summary">
              <strong>${escapeHtml(v2Text("modelLabel"))}</strong>
              <span>${escapeHtml(`${currentModel.provider || "—"} / ${currentModel.id || "—"}`)}</span>
            </div>
          </div>
        </div>
        <div class="v2-stack">
          <div class="v2-inline-meta">${escapeHtml(v2Text("quickActions"))}</div>
          <div class="v2-attachment-strip">
            ${v2QuickPrompts()
              .map((prompt) => `
                <button class="v2-chip-button" type="button" onclick="v2ApplyQuickPrompt('${escapeJsSingle(prompt)}')">
                  ${escapeHtml(prompt)}
                </button>
              `)
              .join("")}
          </div>
        </div>
      </section>
      ${v2RenderStatusLine()}
      <section class="v2-card pad-lg v2-chat-card">
        <div class="v2-panel-head">
          <div>
            <div class="v2-kicker">${escapeHtml(v2Text("liveChat"))}</div>
            <h2 class="v2-panel-title">${escapeHtml(v2CurrentSession()?.name || v2Text("activeSession"))}</h2>
          </div>
          <div class="v2-toolbar">
            <span class="v2-pill">${escapeHtml(currentModel.provider || "—")}</span>
            <span class="v2-pill">${escapeHtml(currentModel.id || "—")}</span>
          </div>
        </div>
        <div class="v2-message-list">${v2RenderMessages()}</div>
        ${v2RenderComposer()}
      </section>
    </main>
  `;
}

function v2RenderDiagnosticsRows(entries) {
  if (!entries.length) {
    return `
      <div class="v2-empty">
        <div>
          <strong>${escapeHtml(v2Text("noLogs"))}</strong>
          <p class="v2-empty-copy">${escapeHtml(v2Text("logsEmpty"))}</p>
        </div>
      </div>
    `;
  }

  return entries
    .slice(-12)
    .reverse()
    .map((entry) => `
      <div class="v2-log-row ${escapeHtml(entry.level || "info")}">
        <div class="v2-row-between">
          <span class="v2-badge ${entry.level === "error" ? "bad" : entry.level === "warn" ? "warn" : "good"}">${escapeHtml(v2LevelLabel(entry.level || "info"))}</span>
          <small>${escapeHtml(v2FormatTime(entry.timestamp))}</small>
        </div>
        <strong>${escapeHtml(entry.message || "")}</strong>
        <small>${escapeHtml(v2Text("sourceLabel"))}: ${escapeHtml(entry.source || "desktop")} · ${escapeHtml(v2Text("categoryLabel"))}: ${escapeHtml(v2CategoryFilterLabel(entry.category || "general"))}</small>
      </div>
    `)
    .join("");
}

function v2RenderStageHeader() {
  const meta = v2SectionMeta(v2EnsureState().section);
  const currentModel = v2CurrentModel();
  return `
    <section class="v2-card pad-md v2-stage-header">
      <div>
        <div class="v2-kicker">${escapeHtml(v2LocaleText("桌面软件模式", "Desktop App Mode"))}</div>
        <h1 class="v2-panel-title v2-stage-title">${escapeHtml(meta.title)}</h1>
        <p class="v2-copy">${escapeHtml(meta.detail)}</p>
      </div>
      <div class="v2-stage-meta">
        <span class="v2-pill">${escapeHtml(currentModel.provider || "—")}</span>
        <span class="v2-pill">${escapeHtml(currentModel.id || "—")}</span>
        <span class="v2-badge ${v2BackendLevel()}">${escapeHtml(v2BackendLabel())}</span>
      </div>
    </section>
  `;
}

function v2RenderChatSection() {
  return `
    <section class="v2-workspace-grid">
      ${v2RenderMain()}
      ${v2RenderAside()}
    </section>
  `;
}

function v2RenderSettingsSection() {
  const v2 = v2EnsureState();
  const draft = v2.settingsDraft;
  const host = v2.hostDraft;
  const hostState = v2HostState();
  const suggestions = v2ModelsForProvider(draft.provider || v2CurrentModel().provider);
  const currentAgent = v2CurrentAgentDraft();
  const importAvailable = state.bootstrap?.importCandidate?.available;

  return `
    <section class="v2-section-grid">
      <section class="v2-card pad-lg">
        <div class="v2-panel-head">
          <div>
            <div class="v2-kicker">${escapeHtml(v2LocaleText("默认配置", "Defaults"))}</div>
            <h2 class="v2-panel-title">${escapeHtml(v2LocaleText("Provider 与会话默认值", "Provider and Session Defaults"))}</h2>
          </div>
          <span class="v2-badge ${v2HasSavedCredential() ? "good" : "warn"}">${escapeHtml(v2HasSavedCredential() ? v2Text("credentialStateSaved") : v2Text("credentialStateMissing"))}</span>
        </div>
        <div class="v2-provider-grid">
          ${v2ProviderPresets()
            .map((preset) => `
              <button
                class="v2-provider-tile v2-chip-button ${draft.providerPreset === preset.id ? "active" : ""}"
                type="button"
                onclick="v2SelectProviderPreset('${escapeJsSingle(preset.id)}')"
              >
                <strong>${escapeHtml(preset.label || preset.id)}</strong>
                <span>${escapeHtml(preset.description || "")}</span>
              </button>
            `)
            .join("")}
        </div>
        <div class="v2-field-row">
          <div class="v2-field">
            <label>${escapeHtml(v2Text("providerId"))}</label>
            <input class="v2-input" value="${escapeHtml(draft.provider || "")}" oninput="v2UpdateSettingsField('provider', this.value)" ${draft.providerPreset === "custom" ? "" : "readonly"} />
          </div>
          <div class="v2-field">
            <label>${escapeHtml(v2Text("modelLabel"))}</label>
            <input class="v2-input" list="v2-settings-models" value="${escapeHtml(draft.model || "")}" oninput="v2UpdateSettingsField('model', this.value)" />
            <datalist id="v2-settings-models">
              ${suggestions.map((entry) => `<option value="${escapeHtml(entry.id)}"></option>`).join("")}
            </datalist>
          </div>
        </div>
        <div class="v2-field-row">
          <div class="v2-field">
            <label>${escapeHtml(v2Text("apiBase"))}</label>
            <input class="v2-input" value="${escapeHtml(draft.apiBaseURL || "")}" oninput="v2UpdateSettingsField('apiBaseURL', this.value)" />
          </div>
          <div class="v2-field">
            <label>${escapeHtml(v2Text("apiProtocol"))}</label>
            <input class="v2-input" value="${escapeHtml(draft.apiProtocol || "")}" oninput="v2UpdateSettingsField('apiProtocol', this.value)" />
          </div>
        </div>
        <div class="v2-field-row">
          <div class="v2-field">
            <label>${escapeHtml(v2Text("apiKey"))}</label>
            <input class="v2-input" type="password" value="${escapeHtml(draft.apiKey || "")}" oninput="v2UpdateSettingsField('apiKey', this.value)" />
          </div>
          <div class="v2-field">
            <label>${escapeHtml(v2Text("starterAgent"))}</label>
            <select class="v2-select" onchange="v2UpdateSettingsField('starterAgent', this.value)">
              ${v2Agents().map((agent) => `
                <option value="${escapeHtml(agent.id)}" ${draft.starterAgent === agent.id ? "selected" : ""}>
                  ${escapeHtml(agent.displayName || agent.id)}
                </option>
              `).join("")}
            </select>
          </div>
        </div>
        <div class="v2-field-row">
          <div class="v2-field">
            <label>${escapeHtml(v2Text("workspace"))}</label>
            <div class="v2-inline-form">
              <input class="v2-input" value="${escapeHtml(draft.workspacePath || "")}" readonly />
              <button class="v2-ghost" type="button" onclick="chooseWorkspace()">${escapeHtml(v2Text("chooseWorkspace"))}</button>
            </div>
          </div>
          <div class="v2-field">
            <label>${escapeHtml(v2Text("uiLanguage"))}</label>
            <div class="v2-field-row compact">
              <select class="v2-select" onchange="v2UpdateSettingsField('uiLanguage', this.value)">
                <option value="en" ${String(draft.uiLanguage).startsWith("en") ? "selected" : ""}>${escapeHtml(v2Text("languageEnglish"))}</option>
                <option value="zh-CN" ${String(draft.uiLanguage).startsWith("zh") ? "selected" : ""}>${escapeHtml(v2Text("languageChinese"))}</option>
              </select>
              <select class="v2-select" onchange="v2UpdateSettingsField('uiMode', this.value)">
                <option value="simple" ${draft.uiMode === "simple" ? "selected" : ""}>${escapeHtml(v2Text("modeSimple"))}</option>
                <option value="pro" ${draft.uiMode === "pro" ? "selected" : ""}>${escapeHtml(v2Text("modePro"))}</option>
              </select>
            </div>
          </div>
        </div>
        <div class="v2-action-grid">
          <button class="v2-button" type="button" onclick="v2SaveDefaults()">${escapeHtml(v2Text("saveDefaults"))}</button>
          <button class="v2-ghost" type="button" onclick="v2ImportExistingSetup()" ${importAvailable ? "" : "disabled"}>${escapeHtml(v2Text("importSetup"))}</button>
          <button class="v2-soft" type="button" onclick="v2RemoveSavedCredential()" ${v2HasSavedCredential() ? "" : "disabled"}>${escapeHtml(v2Text("removeCredential"))}</button>
        </div>
      </section>

      <section class="v2-card pad-lg">
        <div class="v2-panel-head">
          <div>
            <div class="v2-kicker">${escapeHtml(v2LocaleText("桌面外壳", "Desktop Shell"))}</div>
            <h2 class="v2-panel-title">${escapeHtml(v2LocaleText("窗口与表面行为", "Window and Surface Behavior"))}</h2>
          </div>
          <span class="v2-pill">${escapeHtml(hostState.webBridgeRunning ? v2LocaleText("桥接运行中", "Bridge live") : v2LocaleText("按需启动", "On demand"))}</span>
        </div>
        <div class="v2-choice-grid">
          <button class="v2-choice-card ${host.preferredSurface === "desktop" ? "active" : ""}" type="button" onclick="v2UpdateHostField('preferredSurface', 'desktop')">
            <strong>${escapeHtml(v2LocaleText("桌面控制中心", "Desktop control center"))}</strong>
            <span>${escapeHtml(v2LocaleText("默认回到本地软件界面，而不是网页工作区。", "Return to the local software surface by default."))}</span>
          </button>
          <button class="v2-choice-card ${host.preferredSurface === "web" ? "active" : ""}" type="button" onclick="v2UpdateHostField('preferredSurface', 'web')">
            <strong>${escapeHtml(v2LocaleText("内置 Web 工作区", "Embedded web workspace"))}</strong>
            <span>${escapeHtml(v2LocaleText("保留网页模式，但它应该是次级入口。", "Keep the web surface available as a secondary route."))}</span>
          </button>
        </div>
        <div class="v2-field-row">
          <div class="v2-field">
            <label>${escapeHtml(v2LocaleText("Web 工作区 URL", "Web workspace URL"))}</label>
            <input class="v2-input" value="${escapeHtml(host.webWorkspaceURL || "")}" oninput="v2UpdateHostField('webWorkspaceURL', this.value)" />
          </div>
          <div class="v2-field">
            <label>${escapeHtml(v2LocaleText("关闭窗口时", "On window close"))}</label>
            <select class="v2-select" onchange="v2UpdateHostField('closeBehavior', this.value)">
              <option value="background" ${host.closeBehavior === "background" ? "selected" : ""}>${escapeHtml(v2LocaleText("隐藏到后台", "Hide to background"))}</option>
              <option value="quit" ${host.closeBehavior === "quit" ? "selected" : ""}>${escapeHtml(v2LocaleText("直接退出", "Quit app"))}</option>
            </select>
          </div>
        </div>
        <label class="v2-toggle-row">
          <input type="checkbox" ${host.menuBarEnabled ? "checked" : ""} onchange="v2UpdateHostField('menuBarEnabled', this.checked)" />
          <span>
            <strong>${escapeHtml(v2LocaleText("显示菜单栏入口", "Show menu bar entry"))}</strong>
            <small>${escapeHtml(v2LocaleText("保持后台唤起能力。", "Keep a lightweight background entry point."))}</small>
          </span>
        </label>
        <div class="v2-detail-list">
          <div class="v2-detail-row"><span>${escapeHtml(v2LocaleText("本地桥接地址", "Local bridge"))}</span><strong class="mono">${escapeHtml(hostState.webBridgeBaseURL || "http://127.0.0.1:43115")}</strong></div>
          <div class="v2-detail-row"><span>${escapeHtml(v2LocaleText("桌面控制中心", "Desktop control center"))}</span><strong>${escapeHtml(hostState.desktopControlCenterAvailable ? v2LocaleText("可用", "Available") : v2LocaleText("不可用", "Unavailable"))}</strong></div>
        </div>
        <div class="v2-action-grid">
          <button class="v2-button" type="button" onclick="v2SaveHostSettings()">${escapeHtml(v2LocaleText("保存外壳设置", "Save shell settings"))}</button>
          <button class="v2-ghost" type="button" onclick="v2SwitchDesktopSurface('desktop')">${escapeHtml(v2LocaleText("打开桌面界面", "Open desktop surface"))}</button>
          <button class="v2-ghost" type="button" onclick="v2SwitchDesktopSurface('web')">${escapeHtml(v2LocaleText("应用内打开 Web", "Open web in app"))}</button>
          <button class="v2-soft" type="button" onclick="v2OpenHostedWorkspace()">${escapeHtml(v2LocaleText("浏览器打开 Web", "Open web in browser"))}</button>
        </div>
      </section>

      <section class="v2-card pad-lg v2-span-all">
        <div class="v2-panel-head">
          <div>
            <div class="v2-kicker">${escapeHtml(v2LocaleText("Agent 配置", "Agent Profiles"))}</div>
            <h2 class="v2-panel-title">${escapeHtml(v2LocaleText("编辑桌面内置 agent 角色", "Edit desktop agent roles"))}</h2>
          </div>
          <span class="v2-pill">${escapeHtml(v2FormatCount(v2Agents().length))}</span>
        </div>
        <div class="v2-agent-shell">
          <div class="v2-list-panel">
            ${v2Agents().map((agent) => `
              <button class="v2-list-row ${v2.selectedAgentId === agent.id ? "active" : ""}" type="button" onclick="v2SelectAgentProfile('${escapeJsSingle(agent.id)}')">
                <strong>${escapeHtml(agent.displayName || agent.id)}</strong>
                <span>${escapeHtml(agent.description || "")}</span>
              </button>
            `).join("")}
          </div>
          <div class="v2-editor-panel">
            ${currentAgent ? `
              <div class="v2-field-row">
                <div class="v2-field">
                  <label>${escapeHtml(v2LocaleText("显示名称", "Display name"))}</label>
                  <input class="v2-input" value="${escapeHtml(currentAgent.displayName || "")}" oninput="v2UpdateAgentProfileField('displayName', this.value)" />
                </div>
                <div class="v2-field">
                  <label>${escapeHtml(v2LocaleText("模式", "Mode"))}</label>
                  <select class="v2-select" onchange="v2UpdateAgentProfileField('modeId', this.value)">
                    <option value="follow_main" ${currentAgent.modeId === "follow_main" ? "selected" : ""}>${escapeHtml(v2LocaleText("跟随主配置", "Follow main settings"))}</option>
                    <option value="override" ${currentAgent.modeId === "override" ? "selected" : ""}>${escapeHtml(v2LocaleText("独立覆盖", "Override"))}</option>
                  </select>
                </div>
              </div>
              <div class="v2-field">
                <label>${escapeHtml(v2LocaleText("说明", "Description"))}</label>
                <textarea class="v2-textarea v2-small-textarea" oninput="v2UpdateAgentProfileField('description', this.value)">${escapeHtml(currentAgent.description || "")}</textarea>
              </div>
              <div class="v2-field-row">
                <div class="v2-field">
                  <label>${escapeHtml(v2LocaleText("覆盖 Provider", "Override provider"))}</label>
                  <input class="v2-input" value="${escapeHtml(currentAgent.provider || "")}" oninput="v2UpdateAgentProfileField('provider', this.value)" ${currentAgent.modeId === "override" ? "" : "disabled"} />
                </div>
                <div class="v2-field">
                  <label>${escapeHtml(v2LocaleText("覆盖模型", "Override model"))}</label>
                  <input class="v2-input" value="${escapeHtml(currentAgent.model || "")}" oninput="v2UpdateAgentProfileField('model', this.value)" ${currentAgent.modeId === "override" ? "" : "disabled"} />
                </div>
              </div>
              <div class="v2-detail-list">
                <div class="v2-detail-row"><span>${escapeHtml(v2LocaleText("技能来源", "Skill scope"))}</span><strong>${escapeHtml(currentAgent.skillScope || "—")}</strong></div>
                <div class="v2-detail-row"><span>${escapeHtml(v2LocaleText("技能数量", "Skills"))}</span><strong>${escapeHtml(v2FormatCount((currentAgent.skills || []).length))}</strong></div>
                <div class="v2-detail-row"><span>${escapeHtml(v2LocaleText("提示数量", "Prompts"))}</span><strong>${escapeHtml(v2FormatCount((currentAgent.prompts || []).length))}</strong></div>
              </div>
              ${(currentAgent.skills || []).length ? `<div class="v2-tag-row">${currentAgent.skills.map((skill) => `<span class="v2-pill">${escapeHtml(skill)}</span>`).join("")}</div>` : ""}
              <div class="v2-action-grid">
                <button class="v2-button" type="button" onclick="v2SaveAgentProfiles()">${escapeHtml(v2LocaleText("保存 Agent 配置", "Save agent profiles"))}</button>
              </div>
            ` : ""}
          </div>
        </div>
      </section>
    </section>
  `;
}

function v2RenderSecuritySection() {
  const draft = v2EnsureState().securityDraft;
  const securityState = v2SecurityState();
  const permissions = v2SystemPermissions();
  const decisions = securityState.decisions || [];

  return `
    <section class="v2-section-grid">
      <section class="v2-card pad-lg">
        <div class="v2-panel-head">
          <div>
            <div class="v2-kicker">${escapeHtml(v2LocaleText("执行策略", "Execution Policy"))}</div>
            <h2 class="v2-panel-title">${escapeHtml(v2LocaleText("桌面安全姿态", "Desktop security posture"))}</h2>
          </div>
          <span class="v2-pill">${escapeHtml(v2HumanizeStatus(draft.machinePreset))}</span>
        </div>
        <div class="v2-field-row">
          <div class="v2-field">
            <label>${escapeHtml(v2LocaleText("机器预设", "Machine preset"))}</label>
            <select class="v2-select" onchange="v2UpdateSecurityField('machinePreset', this.value)">
              <option value="dedicated" ${draft.machinePreset === "dedicated" ? "selected" : ""}>Dedicated</option>
              <option value="primary" ${draft.machinePreset === "primary" ? "selected" : ""}>Primary</option>
              <option value="home" ${draft.machinePreset === "home" ? "selected" : ""}>Home</option>
            </select>
          </div>
          <div class="v2-field">
            <label>${escapeHtml(v2LocaleText("扩展策略", "Extension profile"))}</label>
            <select class="v2-select" onchange="v2UpdateSecurityField('profile', this.value)">
              <option value="permissive" ${draft.profile === "permissive" ? "selected" : ""}>Permissive</option>
              <option value="balanced" ${draft.profile === "balanced" ? "selected" : ""}>Balanced</option>
              <option value="safe" ${draft.profile === "safe" ? "selected" : ""}>Safe</option>
            </select>
          </div>
        </div>
        <div class="v2-field-row">
          <div class="v2-field">
            <label>${escapeHtml(v2LocaleText("危险命令策略", "Destructive exec policy"))}</label>
            <select class="v2-select" onchange="v2UpdateSecurityField('destructiveExecPolicy', this.value)">
              <option value="confirm" ${draft.destructiveExecPolicy === "confirm" ? "selected" : ""}>Confirm</option>
              <option value="allow_all" ${draft.destructiveExecPolicy === "allow_all" ? "selected" : ""}>Allow all</option>
              <option value="deny_destructive" ${draft.destructiveExecPolicy === "deny_destructive" ? "selected" : ""}>Deny destructive</option>
            </select>
          </div>
          <div class="v2-field">
            <label>${escapeHtml(v2LocaleText("文件系统范围", "Filesystem scope"))}</label>
            <select class="v2-select" onchange="v2UpdateSecurityField('sandboxMode', this.value)">
              <option value="workspace_write" ${draft.sandboxMode === "workspace_write" ? "selected" : ""}>Workspace only</option>
              <option value="selected_directories" ${draft.sandboxMode === "selected_directories" ? "selected" : ""}>Approved directories</option>
              <option value="full_access" ${draft.sandboxMode === "full_access" ? "selected" : ""}>Full access</option>
            </select>
          </div>
        </div>
        <div class="v2-field-row">
          <div class="v2-field">
            <label>${escapeHtml(v2LocaleText("网关模式", "Gateway mode"))}</label>
            <select class="v2-select" onchange="v2UpdateSecurityField('gatewayMode', this.value)">
              <option value="direct" ${draft.gatewayMode === "direct" ? "selected" : ""}>Direct</option>
              <option value="sandbox_gateway" ${draft.gatewayMode === "sandbox_gateway" ? "selected" : ""}>Sandbox gateway</option>
              <option value="custom_gateway" ${draft.gatewayMode === "custom_gateway" ? "selected" : ""}>Custom gateway</option>
            </select>
          </div>
          <div class="v2-field">
            <label>${escapeHtml(v2LocaleText("网关 URL", "Gateway URL"))}</label>
            <input class="v2-input" value="${escapeHtml(draft.gatewayURL || "")}" oninput="v2UpdateSecurityField('gatewayURL', this.value)" ${draft.gatewayMode === "custom_gateway" ? "" : "disabled"} />
          </div>
        </div>
        <div class="v2-toggle-grid">
          <label class="v2-toggle-row">
            <input type="checkbox" ${draft.defaultPermissive ? "checked" : ""} onchange="v2UpdateSecurityField('defaultPermissive', this.checked)" />
            <span><strong>Default permissive</strong><small>${escapeHtml(v2LocaleText("未声明权限时默认放行。", "Allow unspecified extension capabilities by default."))}</small></span>
          </label>
          <label class="v2-toggle-row">
            <input type="checkbox" ${draft.allowDangerous ? "checked" : ""} onchange="v2UpdateSecurityField('allowDangerous', this.checked)" />
            <span><strong>Allow dangerous</strong><small>${escapeHtml(v2LocaleText("允许更高风险动作。", "Permit higher-risk actions."))}</small></span>
          </label>
          <label class="v2-toggle-row">
            <input type="checkbox" ${draft.conflictGuard ? "checked" : ""} onchange="v2UpdateSecurityField('conflictGuard', this.checked)" />
            <span><strong>Conflict guard</strong><small>${escapeHtml(v2LocaleText("避免并发冲突。", "Reduce concurrent workspace conflicts."))}</small></span>
          </label>
          <label class="v2-toggle-row">
            <input type="checkbox" ${draft.browserAutomation ? "checked" : ""} onchange="v2UpdateSecurityField('browserAutomation', this.checked)" />
            <span><strong>Browser automation</strong><small>${escapeHtml(v2LocaleText("允许浏览器自动化能力。", "Allow browser automation abilities."))}</small></span>
          </label>
        </div>
        <div class="v2-panel-head">
          <h2 class="v2-panel-title">${escapeHtml(v2LocaleText("授权目录", "Approved directories"))}</h2>
          <span class="v2-pill">${escapeHtml(v2FormatCount(draft.scopedDirectories.length))}</span>
        </div>
        <div class="v2-list-panel compact">
          ${draft.scopedDirectories.length ? draft.scopedDirectories.map((path) => `
            <div class="v2-inline-card">
              <strong class="mono">${escapeHtml(path)}</strong>
              <button class="v2-ghost" type="button" onclick="v2RemoveScopedDirectory('${escapeJsSingle(path)}')">${escapeHtml(v2LocaleText("移除", "Remove"))}</button>
            </div>
          `).join("") : `<div class="v2-empty-inline">${escapeHtml(v2LocaleText("还没有额外授权目录。", "No additional approved directories yet."))}</div>`}
        </div>
        <div class="v2-action-grid">
          <button class="v2-ghost" type="button" onclick="v2PickScopedDirectory()">${escapeHtml(v2LocaleText("添加目录", "Add directory"))}</button>
          <button class="v2-soft" type="button" onclick="v2OpenExternalPath('${escapeJsSingle(securityState.permissionsPath || "")}')">${escapeHtml(v2LocaleText("打开权限文件", "Open permissions file"))}</button>
          <button class="v2-button" type="button" onclick="v2SaveSecuritySettings()">${escapeHtml(v2LocaleText("保存安全策略", "Save security policy"))}</button>
        </div>
      </section>

      <section class="v2-card pad-lg">
        <div class="v2-panel-head">
          <div>
            <div class="v2-kicker">${escapeHtml(v2LocaleText("macOS 权限", "macOS Permissions"))}</div>
            <h2 class="v2-panel-title">${escapeHtml(v2LocaleText("系统授权状态", "System authorization status"))}</h2>
          </div>
          <span class="v2-pill">${escapeHtml(v2FormatCount(permissions.length))}</span>
        </div>
        <div class="v2-resource-grid">
          ${permissions.map((permission) => `
            <div class="v2-resource-card">
              <div class="v2-row-between">
                <strong>${escapeHtml(permission.name || permission.id)}</strong>
                <span class="v2-badge ${v2ToneForStatus(permission.status)}">${escapeHtml(v2HumanizeStatus(permission.status))}</span>
              </div>
              <p class="v2-copy">${escapeHtml(permission.detail || "")}</p>
              <div class="v2-action-grid">
                ${permission.canRequest ? `<button class="v2-ghost" type="button" onclick="v2RequestSystemPermission('${escapeJsSingle(permission.id)}')">${escapeHtml(v2LocaleText("请求授权", "Request"))}</button>` : ""}
                <button class="v2-soft" type="button" onclick="v2OpenPrivacySettings('${escapeJsSingle(permission.id)}')">${escapeHtml(v2LocaleText("打开设置", "Open settings"))}</button>
              </div>
            </div>
          `).join("")}
        </div>
      </section>

      <section class="v2-card pad-lg v2-span-all">
        <div class="v2-panel-head">
          <div>
            <div class="v2-kicker">${escapeHtml(v2LocaleText("扩展授权", "Extension Decisions"))}</div>
            <h2 class="v2-panel-title">${escapeHtml(v2LocaleText("已保存的能力决策", "Saved capability decisions"))}</h2>
          </div>
          <span class="v2-pill">${escapeHtml(v2FormatCount(decisions.length))}</span>
        </div>
        <div class="v2-list-panel compact">
          ${decisions.length ? decisions.map((decision) => `
            <div class="v2-inline-card">
              <div>
                <strong>${escapeHtml(decision.extensionId || "extension")}</strong>
                <div class="v2-inline-meta">${escapeHtml(decision.capability || "capability")} · ${escapeHtml(decision.allow ? v2LocaleText("允许", "Allow") : v2LocaleText("拒绝", "Deny"))}</div>
              </div>
              <button class="v2-ghost" type="button" onclick="v2RemovePermissionExtension('${escapeJsSingle(decision.extensionId || "")}')">${escapeHtml(v2LocaleText("移除规则", "Remove rules"))}</button>
            </div>
          `).join("") : `<div class="v2-empty-inline">${escapeHtml(v2LocaleText("当前还没有扩展授权决策。", "No extension capability decisions have been saved yet."))}</div>`}
        </div>
        <div class="v2-action-grid">
          <button class="v2-soft" type="button" onclick="v2ResetPermissionDecisions()">${escapeHtml(v2LocaleText("重置全部决策", "Reset all decisions"))}</button>
        </div>
      </section>
    </section>
  `;
}

function v2RenderOperationsSection() {
  const updateState = v2UpdateState();
  const diagnostics = v2FilteredLogs();
  const channels = v2Channels();
  const skills = v2SkillsState();
  const automations = v2AutomationState();

  return `
    <section class="v2-section-grid">
      <section class="v2-card pad-lg">
        <div class="v2-panel-head">
          <div>
            <div class="v2-kicker">${escapeHtml(v2LocaleText("更新", "Updates"))}</div>
            <h2 class="v2-panel-title">${escapeHtml(v2LocaleText("桌面版本管理", "Desktop version management"))}</h2>
          </div>
          <span class="v2-badge ${v2ToneForStatus(updateState.status)}">${escapeHtml(v2HumanizeStatus(updateState.status || "not_checked"))}</span>
        </div>
        <div class="v2-detail-list">
          <div class="v2-detail-row"><span>${escapeHtml(v2LocaleText("当前版本", "Installed"))}</span><strong>${escapeHtml(updateState.currentVersion || "—")}</strong></div>
          <div class="v2-detail-row"><span>${escapeHtml(v2LocaleText("最新版本", "Latest"))}</span><strong>${escapeHtml(updateState.latestVersion || "—")}</strong></div>
          <div class="v2-detail-row"><span>${escapeHtml(v2LocaleText("最后检查", "Last checked"))}</span><strong>${escapeHtml(v2FormatTime(updateState.checkedAt))}</strong></div>
          <div class="v2-detail-row"><span>${escapeHtml(v2LocaleText("发布名", "Release"))}</span><strong>${escapeHtml(updateState.releaseName || "—")}</strong></div>
        </div>
        <p class="v2-copy">${escapeHtml(updateState.message || v2LocaleText("这里显示手动更新检查和安装器状态。", "Manual update checks and installer state appear here."))}</p>
        <div class="v2-action-grid">
          <button class="v2-button" type="button" onclick="v2CheckForUpdates()">${escapeHtml(v2LocaleText("检查更新", "Check for updates"))}</button>
          <button class="v2-ghost" type="button" onclick="v2DownloadAndInstallUpdate()" ${updateState.downloadURL ? "" : "disabled"}>${escapeHtml(v2LocaleText("下载安装", "Download & install"))}</button>
          <button class="v2-soft" type="button" onclick="v2OpenReleasePage()">${escapeHtml(v2LocaleText("打开发布页", "Open releases"))}</button>
        </div>
      </section>

      <section class="v2-card pad-lg">
        <div class="v2-panel-head">
          <div>
            <div class="v2-kicker">${escapeHtml(v2LocaleText("诊断", "Diagnostics"))}</div>
            <h2 class="v2-panel-title">${escapeHtml(v2LocaleText("运行时问题与支持包", "Runtime issues and support bundle"))}</h2>
          </div>
          <span class="v2-pill">${escapeHtml(v2FormatCount(diagnostics.length))}</span>
        </div>
        <div class="v2-field-row">
          <div class="v2-field">
            <label>${escapeHtml(v2Text("severityLabel"))}</label>
            <select class="v2-select" onchange="v2SetDiagnosticsLevel(this.value)">
              <option value="all" ${v2EnsureState().diagnosticsLevel === "all" ? "selected" : ""}>${escapeHtml(v2Text("levelAll"))}</option>
              <option value="error" ${v2EnsureState().diagnosticsLevel === "error" ? "selected" : ""}>${escapeHtml(v2Text("levelError"))}</option>
              <option value="warn" ${v2EnsureState().diagnosticsLevel === "warn" ? "selected" : ""}>${escapeHtml(v2Text("levelWarn"))}</option>
              <option value="info" ${v2EnsureState().diagnosticsLevel === "info" ? "selected" : ""}>${escapeHtml(v2Text("levelInfo"))}</option>
            </select>
          </div>
          <div class="v2-field">
            <label>${escapeHtml(v2Text("categoryLabel"))}</label>
            <select class="v2-select" onchange="v2SetDiagnosticsCategory(this.value)">
              <option value="all" ${v2EnsureState().diagnosticsCategory === "all" ? "selected" : ""}>${escapeHtml(v2Text("categoryAll"))}</option>
              <option value="permissions" ${v2EnsureState().diagnosticsCategory === "permissions" ? "selected" : ""}>${escapeHtml(v2Text("categoryPermissions"))}</option>
              <option value="runtime" ${v2EnsureState().diagnosticsCategory === "runtime" ? "selected" : ""}>${escapeHtml(v2Text("categoryRuntime"))}</option>
              <option value="updates" ${v2EnsureState().diagnosticsCategory === "updates" ? "selected" : ""}>${escapeHtml(v2Text("categoryUpdates"))}</option>
              <option value="gateway" ${v2EnsureState().diagnosticsCategory === "gateway" ? "selected" : ""}>${escapeHtml(v2Text("categoryGateway"))}</option>
              <option value="channels" ${v2EnsureState().diagnosticsCategory === "channels" ? "selected" : ""}>${escapeHtml(v2Text("categoryChannels"))}</option>
              <option value="filesystem" ${v2EnsureState().diagnosticsCategory === "filesystem" ? "selected" : ""}>${escapeHtml(v2Text("categoryFilesystem"))}</option>
              <option value="general" ${v2EnsureState().diagnosticsCategory === "general" ? "selected" : ""}>${escapeHtml(v2Text("categoryGeneral"))}</option>
            </select>
          </div>
        </div>
        <div class="v2-field">
          <input class="v2-input" value="${escapeHtml(v2EnsureState().diagnosticsQuery || "")}" placeholder="${escapeHtml(v2Text("filterLogs"))}" oninput="v2SetDiagnosticsQuery(this.value)" />
        </div>
        <div class="v2-action-grid">
          <button class="v2-ghost" type="button" onclick="v2OpenDesktopLog()">${escapeHtml(v2LocaleText("打开日志", "Open log"))}</button>
          <button class="v2-ghost" type="button" onclick="v2ExportDiagnosticsReport()">${escapeHtml(v2LocaleText("导出诊断", "Export diagnostics"))}</button>
          <button class="v2-soft" type="button" onclick="v2PrepareSupportReport()">${escapeHtml(v2LocaleText("生成支持包", "Prepare support bundle"))}</button>
        </div>
        <div class="v2-log-list">${v2RenderDiagnosticsRows(diagnostics)}</div>
      </section>

      <section class="v2-card pad-lg v2-span-all">
        <div class="v2-panel-head">
          <div>
            <div class="v2-kicker">${escapeHtml(v2LocaleText("运行清单", "Runtime Inventory"))}</div>
            <h2 class="v2-panel-title">${escapeHtml(v2LocaleText("渠道、技能与自动化", "Channels, skills, and automations"))}</h2>
          </div>
          <span class="v2-pill">${escapeHtml(v2FormatCount(channels.length + (skills.skills || []).length + (automations.automations || []).length))}</span>
        </div>
        <div class="v2-overview-grid">
          <div class="v2-overview-card">
            <strong>${escapeHtml(v2LocaleText("渠道", "Channels"))}</strong>
            <span>${escapeHtml(v2FormatCount(channels.length))}</span>
            <div class="v2-list-panel compact">
              ${channels.length ? channels.map((channel) => `
                <div class="v2-inline-card">
                  <div>
                    <strong>${escapeHtml(channel.name || channel.id || "channel")}</strong>
                    <div class="v2-inline-meta">${escapeHtml(v2HumanizeStatus(channel.status || channel.health || "unknown"))}</div>
                  </div>
                  <span class="v2-badge ${v2ToneForStatus(channel.status || channel.health)}">${escapeHtml(v2HumanizeStatus(channel.status || channel.health || "unknown"))}</span>
                </div>
              `).join("") : `<div class="v2-empty-inline">${escapeHtml(v2LocaleText("没有渠道配置。", "No channel bindings configured."))}</div>`}
            </div>
          </div>
          <div class="v2-overview-card">
            <strong>${escapeHtml(v2LocaleText("技能", "Skills"))}</strong>
            <span>${escapeHtml(v2FormatCount((skills.skills || []).length))}</span>
            <div class="v2-list-panel compact">
              ${(skills.skills || []).length ? skills.skills.slice(0, 6).map((skill) => `
                <div class="v2-inline-card">
                  <div>
                    <strong>${escapeHtml(skill.name || "Skill")}</strong>
                    <div class="v2-inline-meta">${escapeHtml(skill.source || "source")}</div>
                  </div>
                </div>
              `).join("") : `<div class="v2-empty-inline">${escapeHtml(v2LocaleText("没有已发现技能。", "No discovered skills yet."))}</div>`}
            </div>
            <div class="v2-action-grid">
              <button class="v2-ghost" type="button" onclick="v2OpenExternalPath('${escapeJsSingle(state.bootstrap?.globalSkillsRoot || "")}')">${escapeHtml(v2LocaleText("打开全局技能目录", "Open global skills"))}</button>
              <button class="v2-soft" type="button" onclick="v2OpenExternalPath('${escapeJsSingle(state.bootstrap?.projectSkillsRoot || "")}')">${escapeHtml(v2LocaleText("打开项目技能目录", "Open project skills"))}</button>
            </div>
          </div>
          <div class="v2-overview-card">
            <strong>${escapeHtml(v2LocaleText("自动化", "Automations"))}</strong>
            <span>${escapeHtml(v2FormatCount((automations.automations || []).length))}</span>
            <div class="v2-list-panel compact">
              ${(automations.automations || []).length ? automations.automations.map((automation) => `
                <div class="v2-inline-card">
                  <div>
                    <strong>${escapeHtml(automation.name || automation.id || "Automation")}</strong>
                    <div class="v2-inline-meta">${escapeHtml(automation.cron || automation.actionType || "schedule")}</div>
                  </div>
                  <span class="v2-badge ${v2ToneForStatus(automation.lastRunStatus || (automation.enabled ? "ready" : "disabled"))}">${escapeHtml(v2HumanizeStatus(automation.lastRunStatus || (automation.enabled ? "enabled" : "disabled")))}</span>
                </div>
              `).join("") : `<div class="v2-empty-inline">${escapeHtml(v2LocaleText("当前没有自动化任务。", "No automations configured yet."))}</div>`}
            </div>
            <div class="v2-action-grid">
              <button class="v2-soft" type="button" onclick="v2OpenExternalPath('${escapeJsSingle(state.bootstrap?.automationsRoot || "")}')">${escapeHtml(v2LocaleText("打开自动化目录", "Open automations root"))}</button>
            </div>
          </div>
        </div>
      </section>
    </section>
  `;
}

function v2RenderSectionBody() {
  switch (v2EnsureState().section) {
    case "settings":
      return v2RenderSettingsSection();
    case "security":
      return v2RenderSecuritySection();
    case "operations":
      return v2RenderOperationsSection();
    default:
      return v2RenderChatSection();
  }
}

function v2RenderAside() {
  const v2 = v2EnsureState();
  const currentSession = v2CurrentSession();
  const currentModel = v2CurrentModel();
  const suggestions = v2ModelsForProvider(v2.modelDraft.provider || currentModel.provider);
  const diagnostics = v2FilteredLogs();
  return `
    <aside class="v2-aside">
      <section class="v2-card pad-md">
        <div class="v2-panel-head">
          <h2 class="v2-panel-title">${escapeHtml(v2Text("workspaceTitle"))}</h2>
          <span class="v2-pill">${escapeHtml(v2Text("connected"))}</span>
        </div>
        <p class="v2-copy">${escapeHtml(v2Text("workspaceBody"))}</p>
        <div class="v2-stack">
          <div class="v2-field">
            <label>${escapeHtml(v2Text("workspacePath"))}</label>
            <input class="v2-input" value="${escapeHtml(state.bootstrap?.workspacePath || "—")}" readonly />
          </div>
          <div class="v2-action-grid">
            <button class="v2-ghost" type="button" onclick="chooseWorkspace()">${escapeHtml(v2Text("chooseWorkspace"))}</button>
            <button class="v2-ghost" type="button" onclick="openAppSupport()">${escapeHtml(v2Text("openAppSupport"))}</button>
            <button class="v2-soft" type="button" onclick="restartBackend()">${escapeHtml(v2Text("restartBackend"))}</button>
            <button class="v2-ghost" type="button" onclick="v2OpenHostedWorkspaceInApp()">${escapeHtml(v2Text("openWebInApp"))}</button>
          </div>
          <div class="v2-action-grid">
            <button class="v2-ghost" type="button" onclick="v2OpenHostedWorkspace()">${escapeHtml(v2Text("openHostedWeb"))}</button>
            <button class="v2-soft" type="button" onclick="openSessionsFolder()">${escapeHtml(v2Text("openSessionsFolder"))}</button>
          </div>
          <p class="v2-hint">${escapeHtml(v2Text("hostedWebHint"))}</p>
        </div>
      </section>

      <section class="v2-card pad-md">
        <div class="v2-panel-head">
          <h2 class="v2-panel-title">${escapeHtml(v2Text("currentSessionCard"))}</h2>
          <span class="v2-badge good">${escapeHtml(v2Text("current"))}</span>
        </div>
        <div class="v2-stack">
          <div class="v2-field">
            <label>${escapeHtml(v2Text("renameSession"))}</label>
            <div class="v2-inline-form">
              <input class="v2-input" value="${escapeHtml(v2.sessionNameDraft || currentSession?.name || "")}" oninput="v2UpdateSessionName(this.value)" />
              <button class="v2-ghost" type="button" onclick="saveSessionName()">${escapeHtml(v2Text("renameSession"))}</button>
            </div>
          </div>
          <div class="v2-field">
            <label>${escapeHtml(v2Text("agentLane"))}</label>
            <div class="v2-inline-form">
              <select class="v2-select" onchange="v2UpdateSessionAgent(this.value)">
                ${v2Agents()
                  .map((agent) => `
                    <option value="${escapeHtml(agent.id)}" ${v2.sessionAgentDraft === agent.id ? "selected" : ""}>
                      ${escapeHtml(agent.displayName || agent.id)}
                    </option>
                  `)
                  .join("")}
              </select>
              <button class="v2-ghost" type="button" onclick="v2ApplySessionAgent()">${escapeHtml(v2Text("applyLane"))}</button>
            </div>
          </div>
          <div class="v2-field">
            <label>${escapeHtml(v2Text("sessionFile"))}</label>
            <input class="v2-input" value="${escapeHtml(currentSession?.path || "—")}" readonly />
          </div>
          <div class="v2-action-grid">
            <button class="v2-ghost" type="button" onclick="openCurrentSession()" ${currentSession ? "" : "disabled"}>${escapeHtml(v2Text("openCurrentSession"))}</button>
            <button class="v2-ghost" type="button" onclick="exportCurrentSession()" ${currentSession ? "" : "disabled"}>${escapeHtml(v2Text("openExport"))}</button>
          </div>
        </div>
      </section>

      <section class="v2-card pad-md">
        <div class="v2-panel-head">
          <h2 class="v2-panel-title">${escapeHtml(v2Text("sessionMetrics"))}</h2>
          <span class="v2-pill">${escapeHtml(v2CurrentPersistenceSummary())}</span>
        </div>
        <div class="v2-summary-grid">
          <div class="v2-summary">
            <strong>${escapeHtml(v2Text("statsPending"))}</strong>
            <span>${escapeHtml(v2FormatCount(state.sessionStats?.pendingMessageCount || 0))}</span>
          </div>
          <div class="v2-summary">
            <strong>${escapeHtml(v2Text("statsTools"))}</strong>
            <span>${escapeHtml(v2FormatCount(state.sessionStats?.toolCalls || 0))}</span>
          </div>
          <div class="v2-summary">
            <strong>${escapeHtml(v2Text("usageMessages"))}</strong>
            <span>${escapeHtml(v2FormatCount(state.sessionStats?.totalMessages || 0))}</span>
          </div>
          <div class="v2-summary">
            <strong>${escapeHtml(v2Text("statsMode"))}</strong>
            <span>${escapeHtml(v2CurrentPersistenceSummary())}</span>
          </div>
        </div>
      </section>

      <section class="v2-card pad-md">
        <div class="v2-panel-head">
          <h2 class="v2-panel-title">${escapeHtml(v2Text("defaultsCard"))}</h2>
          <span class="v2-badge ${v2HasSavedCredential() ? "good" : "warn"}">${escapeHtml(v2HasSavedCredential() ? v2Text("credentialStateSaved") : v2Text("credentialStateMissing"))}</span>
        </div>
        <p class="v2-copy">${escapeHtml(v2Text("defaultsHint"))}</p>
        <div class="v2-stack">
          <div class="v2-field">
            <label>${escapeHtml(v2Text("providerLabel"))}</label>
            <select class="v2-select" onchange="v2UpdateModelProvider(this.value)">
              ${v2ProviderPresets()
                .map((preset) => `
                  <option value="${escapeHtml(preset.runtimeProviderId || preset.id)}" ${(v2.modelDraft.provider || currentModel.provider) === (preset.runtimeProviderId || preset.id) ? "selected" : ""}>
                    ${escapeHtml(preset.label || preset.id)}
                  </option>
                `)
                .join("")}
            </select>
          </div>
          <div class="v2-field">
            <label>${escapeHtml(v2Text("modelLabel"))}</label>
            <input
              class="v2-input"
              list="v2-model-datalist"
              value="${escapeHtml(v2.modelDraft.modelId || currentModel.id || "")}"
              oninput="v2UpdateModelId(this.value)"
            />
            <datalist id="v2-model-datalist">
              ${suggestions.map((entry) => `<option value="${escapeHtml(entry.id)}"></option>`).join("")}
            </datalist>
          </div>
          <div class="v2-field">
            <label>${escapeHtml(v2Text("starterAgent"))}</label>
            <select class="v2-select" onchange="v2UpdateSettingsField('starterAgent', this.value)">
              ${v2Agents()
                .map((agent) => `
                  <option value="${escapeHtml(agent.id)}" ${v2.settingsDraft.starterAgent === agent.id ? "selected" : ""}>
                    ${escapeHtml(agent.displayName || agent.id)}
                  </option>
                `)
                .join("")}
            </select>
          </div>
          <div class="v2-field">
            <label>${escapeHtml(v2Text("apiKey"))}</label>
            <input class="v2-input" type="password" value="${escapeHtml(v2.settingsDraft.apiKey || "")}" oninput="v2UpdateSettingsField('apiKey', this.value)" />
          </div>
          <div class="v2-field-row">
            <div class="v2-field">
              <label>${escapeHtml(v2Text("uiLanguage"))}</label>
              <select class="v2-select" onchange="v2UpdateSettingsField('uiLanguage', this.value)">
                <option value="en" ${String(v2.settingsDraft.uiLanguage).startsWith("en") ? "selected" : ""}>${escapeHtml(v2Text("languageEnglish"))}</option>
                <option value="zh-CN" ${String(v2.settingsDraft.uiLanguage).startsWith("zh") ? "selected" : ""}>${escapeHtml(v2Text("languageChinese"))}</option>
              </select>
            </div>
            <div class="v2-field">
              <label>${escapeHtml(v2Text("uiMode"))}</label>
              <select class="v2-select" onchange="v2UpdateSettingsField('uiMode', this.value)">
                <option value="simple" ${v2.settingsDraft.uiMode === "simple" ? "selected" : ""}>${escapeHtml(v2Text("modeSimple"))}</option>
                <option value="pro" ${v2.settingsDraft.uiMode === "pro" ? "selected" : ""}>${escapeHtml(v2Text("modePro"))}</option>
              </select>
            </div>
          </div>
          <div class="v2-action-grid">
            <button class="v2-button" type="button" onclick="v2ApplyModelSelection()">${escapeHtml(v2Text("applyModel"))}</button>
            <button class="v2-soft" type="button" onclick="v2SaveDefaults()">${escapeHtml(v2Text("saveDefaults"))}</button>
          </div>
          <p class="v2-hint">${escapeHtml(v2Text("starterAgentHint"))}</p>
        </div>
      </section>

      <section class="v2-card pad-md">
        <div class="v2-panel-head">
          <h2 class="v2-panel-title">${escapeHtml(v2Text("diagnosticsCard"))}</h2>
          <span class="v2-pill">${escapeHtml(v2FormatCount(diagnostics.length))}</span>
        </div>
        <p class="v2-copy">${escapeHtml(v2Text("diagnosticsHint"))}</p>
        <div class="v2-field-row">
          <div class="v2-field">
            <label>${escapeHtml(v2Text("severityLabel"))}</label>
            <select class="v2-select" onchange="v2SetDiagnosticsLevel(this.value)">
              <option value="all" ${v2.diagnosticsLevel === "all" ? "selected" : ""}>${escapeHtml(v2Text("levelAll"))}</option>
              <option value="error" ${v2.diagnosticsLevel === "error" ? "selected" : ""}>${escapeHtml(v2Text("levelError"))}</option>
              <option value="warn" ${v2.diagnosticsLevel === "warn" ? "selected" : ""}>${escapeHtml(v2Text("levelWarn"))}</option>
              <option value="info" ${v2.diagnosticsLevel === "info" ? "selected" : ""}>${escapeHtml(v2Text("levelInfo"))}</option>
            </select>
          </div>
          <div class="v2-field">
            <label>${escapeHtml(v2Text("categoryLabel"))}</label>
            <select class="v2-select" onchange="v2SetDiagnosticsCategory(this.value)">
              <option value="all" ${v2.diagnosticsCategory === "all" ? "selected" : ""}>${escapeHtml(v2Text("categoryAll"))}</option>
              <option value="permissions" ${v2.diagnosticsCategory === "permissions" ? "selected" : ""}>${escapeHtml(v2Text("categoryPermissions"))}</option>
              <option value="runtime" ${v2.diagnosticsCategory === "runtime" ? "selected" : ""}>${escapeHtml(v2Text("categoryRuntime"))}</option>
              <option value="updates" ${v2.diagnosticsCategory === "updates" ? "selected" : ""}>${escapeHtml(v2Text("categoryUpdates"))}</option>
              <option value="gateway" ${v2.diagnosticsCategory === "gateway" ? "selected" : ""}>${escapeHtml(v2Text("categoryGateway"))}</option>
              <option value="channels" ${v2.diagnosticsCategory === "channels" ? "selected" : ""}>${escapeHtml(v2Text("categoryChannels"))}</option>
              <option value="filesystem" ${v2.diagnosticsCategory === "filesystem" ? "selected" : ""}>${escapeHtml(v2Text("categoryFilesystem"))}</option>
              <option value="general" ${v2.diagnosticsCategory === "general" ? "selected" : ""}>${escapeHtml(v2Text("categoryGeneral"))}</option>
            </select>
          </div>
        </div>
        <div class="v2-field">
          <input
            class="v2-input"
            value="${escapeHtml(v2.diagnosticsQuery || "")}"
            placeholder="${escapeHtml(v2Text("filterLogs"))}"
            oninput="v2SetDiagnosticsQuery(this.value)"
          />
        </div>
        <div class="v2-log-list">${v2RenderDiagnosticsRows(diagnostics)}</div>
      </section>
    </aside>
  `;
}

function v2RenderApp() {
  return `
    <div class="v2-root">
      <div class="v2-shell">
        ${v2RenderSidebar()}
        <section class="v2-stage">
          ${v2RenderStageHeader()}
          ${v2RenderSectionBody()}
        </section>
      </div>
    </div>
  `;
}

function render() {
  document.body.classList.add("v2-body");
  const app = document.getElementById("app");
  if (!app) {
    return;
  }
  app.classList.add("v2-mounted");
  v2EnsureState();

  const content =
    state.view === "fatal"
      ? `
        <div class="v2-root v2-fatal">
          <section class="v2-card pad-lg">
            <div class="v2-kicker">Desktop V2</div>
            <h1 class="v2-setup-title">${escapeHtml(v2Text("fatalTitle"))}</h1>
            <p class="v2-subtitle">${escapeHtml(v2Text("fatalBody"))}</p>
            <div class="v2-status-line">
              <strong>${escapeHtml(state.status || "Unknown error")}</strong>
              <span class="v2-badge bad">${escapeHtml(v2Text("offline"))}</span>
            </div>
          </section>
        </div>
      `
      : state.view === "loading"
        ? `
          <div class="v2-root v2-loading">
            <section class="v2-card pad-lg">
              <div class="v2-inline-row">
                <div class="v2-kicker">Desktop V2</div>
                <span class="v2-dot"></span>
              </div>
              <h1 class="v2-setup-title">${escapeHtml(v2Text("loadingTitle"))}</h1>
              <p class="v2-subtitle">${escapeHtml(v2Text("loadingBody"))}</p>
            </section>
          </div>
        `
        : state.view === "onboarding"
          ? v2RenderOnboarding()
          : v2RenderApp();

  app.innerHTML = content;
  const v2 = v2EnsureState();
  if (v2.autoScrollPending) {
    const messageList = app.querySelector(".v2-message-list");
    if (messageList) {
      messageList.scrollTop = messageList.scrollHeight;
    }
    v2.autoScrollPending = false;
  }
}

function boot() {
  document.body.classList.add("v2-body");
  const app = document.getElementById("app");
  if (app) {
    app.classList.add("v2-mounted");
  }
  state.view = "loading";
  render();
  hostRequest("bootstrap")
    .then((response) => {
      if (response.payload?.error) {
        throw new Error(response.payload.error);
      }
      applyBootstrap(response.payload || {});
      state.view = response.payload?.configured ? "app" : "onboarding";
      appendStatus(response.payload?.configured ? v2Text("statusReady") : v2Text("statusSetup"));
      render();
      if (response.payload?.configured) {
        refreshDesktop(false);
      }
    })
    .catch((error) => renderFatal(error));
}

function syncResponsiveShell() {
  render();
}

window.addEventListener("DOMContentLoaded", () => {
  try {
    boot();
  } catch (error) {
    renderFatal(error);
  }
});

window.addEventListener("resize", () => {
  syncResponsiveShell();
});
