const PRODUCT_FALLBACK = "猫爪 maoclaw";
const COMMON_CAPABILITIES = ["exec", "env", "http", "read", "write", "notify"];
const STARTER_CATALOG_SHARED_TAGS = new Set(["skills", "starter"]);
const STARTER_CATALOG_WORKFLOWS = [
  {
    id: "all",
    label: "All packs",
    description: "Browse the full bundled starter catalog.",
    tags: [],
  },
  {
    id: "ship-services",
    label: "Ship services",
    description: "API, backend, architecture, and delivery workflows.",
    tags: ["backend", "architecture", "delivery", "data"],
  },
  {
    id: "frontend-polish",
    label: "Frontend polish",
    description: "UI, mobile, accessibility, and TypeScript flows.",
    tags: ["frontend", "mobile", "quality", "language"],
  },
  {
    id: "operate-production",
    label: "Operate production",
    description: "Infra, CI/CD, reliability, and incident response.",
    tags: ["devops", "infrastructure", "operations", "reliability"],
  },
  {
    id: "migrate-safely",
    label: "Migrate safely",
    description: "Migration, modernization, and documentation support.",
    tags: ["migration", "engineering", "docs"],
  },
  {
    id: "lead-delivery",
    label: "Lead delivery",
    description: "Planning, orchestration, and cross-team execution.",
    tags: ["workflow", "planning", "docs", "architecture"],
  },
];
const SECURITY_PRESETS = {
  dedicated: {
    label: "Dedicated Machine",
    detail: "Single-purpose maoclaw workstation. Fastest path, broadest authority, lowest friction.",
    profile: "permissive",
    defaultPermissive: true,
    allowDangerous: true,
    destructiveExecPolicy: "allow_all",
    sandboxMode: "full_access",
    gatewayMode: "direct",
    browserAutomation: true,
    conflictGuard: false,
  },
  primary: {
    label: "Primary Machine",
    detail: "Your main work Mac. Wide capability surface, but destructive actions still confirm first.",
    profile: "balanced",
    defaultPermissive: false,
    allowDangerous: false,
    destructiveExecPolicy: "confirm",
    sandboxMode: "selected_directories",
    gatewayMode: "direct",
    browserAutomation: true,
    conflictGuard: true,
  },
  home: {
    label: "Home Machine",
    detail: "Shared or personal Mac with tighter defaults. Safer by default and easier to audit.",
    profile: "safe",
    defaultPermissive: false,
    allowDangerous: false,
    destructiveExecPolicy: "deny_destructive",
    sandboxMode: "workspace_write",
    gatewayMode: "sandbox_gateway",
    browserAutomation: false,
    conflictGuard: true,
  },
};

const state = {
  bootstrap: null,
  messages: [],
  pendingUserTurns: [],
  pendingAssistantId: null,
  status: "",
  statusKind: "",
  backendReady: false,
  view: "loading",
  activeTab: "chat",
  sidebarCollapsed: false,
  sidebarManual: false,
  sessionState: null,
  sessionStats: null,
  availableModels: [],
  logs: [],
  sessionDraftName: "",
  goalDraft: blankGoalDraft(),
  goalEditorExpanded: false,
  goalEditorSessionKey: "",
  composerAttachments: [],
  channelExpanded: {},
  selectedAgentProfileId: "main",
  agentProfileDrafts: {},
  channelDrafts: [],
  skillDraft: {
    enableSkillCommands: true,
    globalSkillPathsText: "",
    projectSkillPathsText: "",
  },
  skillCatalogFilter: {
    text: "",
    installableOnly: false,
    category: "all",
    status: "all",
    workflow: "all",
  },
  automationDraft: blankAutomationDraft(),
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
  hostDraft: {
    preferredSurface: "native",
    webWorkspaceURL: "https://xinxiang.xin",
    closeBehavior: "background",
    menuBarEnabled: true,
  },
  permissionDraft: blankPermissionDraft(),
  diagnosticsFilter: {
    level: "all",
    category: "all",
    text: "",
  },
  onboarding: {
    providerPreset: "anthropic",
    provider: "anthropic",
    providerLabel: "Anthropic",
    model: "",
    apiKey: "",
    apiBaseURL: "",
    apiProtocol: "",
    checkForUpdates: true,
    starterAgent: "main",
    workspacePath: "",
  },
  commandQuery: "",
  ui: {
    language: "zh-CN",
    mode: "simple",
  },
};

const providerLabels = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  google: "Google Gemini",
  gemini: "Google Gemini",
  cohere: "Cohere",
  openrouter: "OpenRouter",
  "open-router": "OpenRouter",
  groq: "Groq",
  moonshotai: "Kimi / Moonshot",
  moonshot: "Kimi / Moonshot",
  kimi: "Kimi / Moonshot",
  custom: "Custom API",
  "custom-openai": "Custom API",
};

const providerDescriptions = {
  anthropic: "Claude-native path for coding-heavy desktop usage.",
  openai: "Fast general-purpose path with broad model coverage.",
  google: "Gemini-native route with direct API key entry.",
  cohere: "Cohere Command-family setup with direct credential entry.",
  openrouter: "OpenAI-compatible router with editable endpoint and model.",
  groq: "High-speed OpenAI-compatible inference.",
  moonshotai: "Moonshot/Kimi route with OpenAI-compatible wiring.",
  custom: "Bring your own provider id, API URL, model, and key.",
};

const providerPresetFallbacks = [
  {
    id: "anthropic",
    runtimeProviderId: "anthropic",
    label: "Anthropic",
    description: providerDescriptions.anthropic,
    apiProtocol: "anthropic-messages",
    apiBaseURL: "https://api.anthropic.com/v1/messages",
    defaultModels: ["claude-sonnet-4-6", "claude-opus-4-1"],
  },
  {
    id: "openai",
    runtimeProviderId: "openai",
    label: "OpenAI",
    description: providerDescriptions.openai,
    apiProtocol: "openai-responses",
    apiBaseURL: "https://api.openai.com/v1",
    defaultModels: ["gpt-4.1", "gpt-4o", "o3"],
  },
  {
    id: "google",
    runtimeProviderId: "google",
    label: "Google Gemini",
    description: providerDescriptions.google,
    apiProtocol: "google-generative-ai",
    apiBaseURL: "https://generativelanguage.googleapis.com/v1beta",
    defaultModels: ["gemini-2.5-pro", "gemini-2.0-flash"],
  },
  {
    id: "cohere",
    runtimeProviderId: "cohere",
    label: "Cohere",
    description: providerDescriptions.cohere,
    apiProtocol: "cohere-chat",
    apiBaseURL: "https://api.cohere.com/v2",
    defaultModels: ["command-a-03-2025", "command-r-plus"],
  },
  {
    id: "openrouter",
    runtimeProviderId: "openrouter",
    label: "OpenRouter",
    description: providerDescriptions.openrouter,
    apiProtocol: "openai-completions",
    apiBaseURL: "https://openrouter.ai/api/v1",
    defaultModels: ["openai/gpt-4o", "anthropic/claude-3.7-sonnet"],
  },
  {
    id: "groq",
    runtimeProviderId: "groq",
    label: "Groq",
    description: providerDescriptions.groq,
    apiProtocol: "openai-completions",
    apiBaseURL: "https://api.groq.com/openai/v1",
    defaultModels: ["llama-3.3-70b-versatile", "deepseek-r1-distill-llama-70b"],
  },
  {
    id: "moonshotai",
    runtimeProviderId: "moonshotai",
    label: "Kimi / Moonshot",
    description: providerDescriptions.moonshotai,
    apiProtocol: "openai-completions",
    apiBaseURL: "https://api.moonshot.ai/v1",
    defaultModels: ["kimi-k2-0905-preview", "moonshot-v1-8k"],
  },
  {
    id: "custom",
    runtimeProviderId: "custom-openai",
    label: "Custom API",
    description: providerDescriptions.custom,
    apiProtocol: "openai-completions",
    apiBaseURL: "https://api.example.com/v1",
    defaultModels: ["custom-model"],
  },
];

const tabMetaBase = {
  chat: {
    labelKey: "tab.chat.label",
    titleKey: "tab.chat.title",
    descriptionKey: "tab.chat.description",
    availabilityKey: "common.actionable",
    sourceKey: "source.live_runtime",
  },
  sessions: {
    labelKey: "tab.sessions.label",
    titleKey: "tab.sessions.title",
    descriptionKey: "tab.sessions.description",
    availabilityKey: "common.actionable",
    sourceKey: "source.live_filesystem",
  },
  agents: {
    labelKey: "tab.agents.label",
    titleKey: "tab.agents.title",
    descriptionKey: "tab.agents.description",
    availabilityKey: "common.actionable",
    sourceKey: "source.global_settings",
  },
  channels: {
    labelKey: "tab.channels.label",
    titleKey: "tab.channels.title",
    descriptionKey: "tab.channels.description",
    availabilityKey: "common.actionable",
    sourceKey: "source.project_config",
  },
  skills: {
    labelKey: "tab.skills.label",
    titleKey: "tab.skills.title",
    descriptionKey: "tab.skills.description",
    availabilityKey: "common.actionable",
    sourceKey: "source.live_filesystem",
  },
  automations: {
    labelKey: "tab.automations.label",
    titleKey: "tab.automations.title",
    descriptionKey: "tab.automations.description",
    availabilityKey: "common.actionable",
    sourceKey: "source.workspace_registry",
  },
  security: {
    labelKey: "tab.security.label",
    titleKey: "tab.security.title",
    descriptionKey: "tab.security.description",
    availabilityKey: "common.actionable",
    sourceKey: "source.policy_os",
  },
  settings: {
    labelKey: "tab.settings.label",
    titleKey: "tab.settings.title",
    descriptionKey: "tab.settings.description",
    availabilityKey: "common.actionable",
    sourceKey: "source.mixed",
  },
};

const PRIMARY_NAV_TABS = ["chat", "sessions", "skills", "settings"];
const OPERATIONS_NAV_TABS = ["agents", "channels", "automations", "security"];

const termCatalog = {
  "zh-CN": {
    simple: {
      chat: "对话",
      session: "聊天记录",
      agent: "助手分身",
      channel: "接入",
      skill: "技能包",
      automation: "自动化",
      security: "权限安全",
      settings: "设置",
      workspace: "工作区",
      mode: "使用模式",
      language: "界面语言",
      model_defaults: "模型与默认项",
    },
    pro: {
      chat: "会话",
      session: "会话",
      agent: "代理配置",
      channel: "渠道",
      skill: "Skills",
      automation: "自动化",
      security: "安全与权限",
      settings: "设置",
      workspace: "工作区",
      mode: "工作模式",
      language: "界面语言",
      model_defaults: "模型与默认项",
    },
  },
  "en-US": {
    simple: {
      chat: "Chat",
      session: "Chats",
      agent: "Helpers",
      channel: "Connections",
      skill: "Skill Packs",
      automation: "Automations",
      security: "Security",
      settings: "Settings",
      workspace: "Workspace",
      mode: "Mode",
      language: "Language",
      model_defaults: "Model & Defaults",
    },
    pro: {
      chat: "Chat",
      session: "Sessions",
      agent: "Agents",
      channel: "Channels",
      skill: "Skills",
      automation: "Automations",
      security: "Security",
      settings: "Settings",
      workspace: "Workspace",
      mode: "Mode",
      language: "Language",
      model_defaults: "Model & Defaults",
    },
  },
  "ja-JP": {
    simple: {
      chat: "チャット",
      session: "チャット履歴",
      agent: "アシスタント",
      channel: "接続",
      skill: "スキルパック",
      automation: "自動化",
      security: "権限と安全",
      settings: "設定",
      workspace: "ワークスペース",
      mode: "モード",
      language: "言語",
      model_defaults: "モデルと既定値",
    },
    pro: {
      chat: "チャット",
      session: "セッション",
      agent: "エージェント",
      channel: "チャネル",
      skill: "Skills",
      automation: "自動化",
      security: "セキュリティ",
      settings: "設定",
      workspace: "ワークスペース",
      mode: "モード",
      language: "言語",
      model_defaults: "モデルと既定値",
    },
  },
};

const uiStrings = {
  "zh-CN": {
    common: {
      actionable: "可操作",
      view_only: "仅查看",
      live: "实时",
      booting: "启动中",
      manage: "管理",
      connected: "已连接",
      offline: "离线",
      pending: "待创建",
      idle: "空闲",
      enabled: "已启用",
      disabled: "已关闭",
      simple: "简单版",
      pro: "专业版",
    },
    source: {
      live_runtime: "实时运行态",
      live_filesystem: "实时文件系统",
      global_settings: "全局设置",
      project_config: "项目配置",
      workspace_registry: "工作区注册表",
      policy_os: "策略 + 系统状态",
      mixed: "混合来源",
      persistent_defaults: "持久默认项",
      host_managed: "宿主管理",
    },
    shell: {
      desktop_client: "桌面客户端",
      desktop_tagline: "统筹对话、分工、技能与诊断，保持桌面端体验一致。",
      current_workspace: "当前工作区",
      primary_action: "主操作",
      open_conversation_workspace: "打开对话工作台",
      chat_first_description: "桌面端应默认落在聊天视图。设置、技能、接入与安全仍然保持随时可达，不会遮住输入区。",
      recent_sessions: "最近聊天记录",
      operational_posture: "当前运行态势",
      desktop_status: "桌面状态",
      visible_product_surface: "可见产品层",
      native_control_center: "原生控制中心",
      chat_one_click: "对话始终一键可达",
      local_bridge_ready: "本地桥接已就绪",
      local_bridge_warming: "本地桥接预热中",
      web_preferred: "优先 Web",
      native_preferred: "优先原生",
      native_host: "原生宿主",
      web_capable_host: "支持 Web 的宿主",
      backend_connected: "后端已连接",
      backend_starting: "后端启动中",
      show_sidebar: "显示侧边栏",
      focus_chat: "专注对话",
      expand: "展开",
      collapse: "收起",
      workspace_not_set: "未设置工作区",
      open_chat: "打开对话",
      remote_web: "远程 Web",
      browser: "浏览器",
      desktop_settings: "桌面设置",
      command_search_placeholder: "搜索面板、分工或操作",
      quick_nav: "前往",
      quick_actions: "快捷操作",
      nav_primary: "核心界面",
      nav_operations: "运营与配置",
      dock_actions: "快速操作",
      metric_sessions: "可用会话",
      metric_last_activity: "最近更新 {{value}}",
      metric_no_activity: "暂无记录",
      metric_messages: "累计消息",
      metric_total_messages: "索引内全部记录",
      metric_storage: "存储占用",
      metric_storage_hint: "自动归档进行中",
      metric_channels: "可用渠道",
      metric_channels_hint: "已启用 / 总渠道",
      metric_automations: "自动化计划",
      metric_automations_hint: "启用的计划",
      desktop_sessions: "桌面会话",
      desktop_workflow: "桌面工作流",
      system_broadcasts: "系统播报",
      status_channel: "运行通道",
      provider_overview: "提供方概览",
      skill_mode: "技能包",
      queue_empty: "暂无任务排队",
      connection_pulse: "连接态势",
      provider_readiness: "运行准备",
      task_queue: "任务队列",
      operational_timeline: "现场播报",
      no_recent_activity: "暂无更新",
    },
    actions: {
      new_chat: "新建对话",
      choose_folder: "选择文件夹",
      import_existing_setup: "导入现有配置",
      save_defaults: "保存默认项",
      save_shell_settings: "保存桌面外壳设置",
      open_native_chat: "打开原生对话",
      reload_native: "重载原生控制中心",
      open_web_workspace: "打开 Web 工作区",
      open_in_browser: "在浏览器打开",
      check_updates: "检查更新",
      download_install: "下载并安装",
      open_releases: "打开发布页",
      open_app_support: "打开 App Support",
      open_sessions: "打开会话目录",
      refresh: "刷新",
      restart_backend: "重启后端",
      start_chatting: "开始对话",
      recheck: "重新检查",
    },
    settings: {
      low_frequency_controls: "低频控制",
      desktop_defaults: "桌面默认项",
      desktop_defaults_desc: "Provider 预设、运行时 provider id、API URL、API key、模型、更新策略与工作区在这里统一管理。",
      workspace_experience: "工作模式与语言",
      workspace_experience_desc: "现在先把模式分层和语言底座落地。简单版会聚焦聊天、聊天记录、技能包和设置；专业版展示全部控制面板。",
      shell_title: "原生与 Web 载体",
      shell_desc: "选择 maoclaw 启动进入原生控制中心还是 Web 工作区，并定义关闭窗口后的行为。",
      preferred_surface: "首选载体",
      close_behavior: "关闭行为",
      menu_bar_access: "菜单栏入口",
      local_web_bridge: "本地 Web 桥",
      version_management: "版本管理",
      desktop_updates: "桌面更新",
      desktop_updates_desc: "手动检查版本、一键下载安装包，并清晰展示当前安装版本。",
      live_runtime: "实时运行态",
      desktop_operations: "桌面运行操作",
      desktop_operations_desc: "这些操作会直接打开或刷新真实的桌面托管状态。",
      migration: "迁移",
      import_status: "导入状态",
      import_status_desc: "桌面端可以把现有 CLI 配置吸收到自己的独立沙盒中。",
      language_label: "界面语言",
      mode_label: "使用模式",
      mode_simple_title: "简单版",
      mode_simple_desc: "保留聊天、聊天记录、技能包和设置，减少学习成本，适合日常使用和首次上手。",
      mode_pro_title: "专业版",
      mode_pro_desc: "展示 agents、channels、automations、安全与诊断等完整控制面板，适合深度配置和运维。",
      language_note: "默认中文，可切换为 English 或日本語。术语层会随着模式一起变化。",
      simple_note: "简单版不删除能力，只是收敛信息架构。",
      pro_note: "专业版显示完整控制面板和更接近底层的命名。",
    },
    chat: {
      conversation_workspace: "对话工作台",
      conversation_workspace_desc: "主聊天界面、实时会话控制，以及始终可见当前模型的核心输入区。",
      current_session: "当前会话",
      thread_lane: "当前线程分工",
      desktop_default: "桌面默认分工",
      backend: "后端",
      model_and_defaults: "模型与默认项",
      conversation_lane: "对话分工",
      conversation_deck: "会话列表",
      threads: "线程",
      current_thread: "当前线程",
      live_session: "实时会话",
      context: "上下文",
      chat_posture: "对话姿态",
      active_profile: "当前配置",
      agent_lanes: "分工配置",
      profiles: "配置",
      session_id: "会话 ID",
      messages: "消息数",
      branches: "分支数",
      no_threads_title: "还没有对话线程。",
      no_threads_desc: "第一次发送消息后，会自动创建第一个由桌面端托管的线程。",
      use_thread_switcher: "这里的切换只会修改当前线程分工。桌面默认分工会保留给后续新会话。",
      no_thread_binding: "当前还没有活动线程文件，因此这里的切换会更新下一个会话的桌面默认分工。",
      active_thread_lane: "当前线程分工",
      assign_to_thread: "分配给当前线程",
      edit_profiles: "编辑分工配置",
      manage_skills: "管理技能包",
      pack_coverage: "技能包覆盖",
      packs_in_use: "当前使用中的技能包",
      no_pack_title: "还没有关联任何技能包。",
      no_pack_desc: "可以在 Skills 或 Agents 里给当前分工附加内置技能包，让它的能力边界更清晰。",
      attached: "已附加",
      partial: "部分覆盖",
      available: "可用",
      surface_handoff: "工作载体",
      where_to_work: "在哪里工作",
      preferred_surface: "首选载体",
      web_url: "Web 地址",
      bridge: "桥接",
      native_chat: "原生对话",
      open_web_in_app: "在应用内打开 Web",
      session_controls: "会话控制",
      manage: "管理",
      session_name: "会话名称",
      rename_current_session: "重命名当前会话",
      save_name: "保存名称",
      open_session: "打开会话",
      open_folder: "打开目录",
      primary_surface: "核心界面",
      chat_first: "聊天优先",
      chat_first_desc: "输入区始终明显，当前模型始终可见，会话操作一键可达，不再躲进设置页面。",
      live_session_model: "当前会话模型",
      choose_live_model: "选择当前会话模型",
      composer: "输入区",
      composer_title: "沉浸式工作，而不是一个很小的输入框",
      composer_note: "直接发送任务指令，把图片放进模型上下文，并在下一轮之前让文件或音频引用保持可见。",
      attach_files: "附加文件",
      add_image: "添加图片",
      add_audio: "添加音频",
      clear_attachments: "清空附件",
      pending_attachments: "待发送附件",
      attachment_note: "图片会直接以内联内容发给模型。音频和其他文件会作为本地文件引用附加，供代理从磁盘读取。",
      send_prompt: "发送",
      workspace_ready_title: "你的对话工作台已经就绪。",
      workspace_ready_desc: "从一个真实的编码任务开始，然后继续附加图片、文件或音频引用。每一轮都会留在这个桌面端托管的会话空间里。",
      current: "当前",
      hot: "活跃",
      recent: "最近",
      archive: "归档",
      saved: "已保存",
      you: "你",
      tool: "工具",
      bash: "命令",
      custom: "自定义",
      streaming: "流式返回中",
      no_message_body: "没有消息内容。",
      assistant_pending_reply: "这一轮已接收，正在准备回复。",
      assistant_tool_activity: "这一轮主要通过工具执行，暂时没有直接文本回复。",
      assistant_no_visible_reply: "助手本轮结束时没有返回任何可见内容。",
      command_no_output: "命令没有输出。",
    },
    sessions_panel: {
      live_library: "实时库",
      desktop_sessions: "桌面会话",
      desktop_sessions_desc: "继续使用桌面端托管的会话，无需手动进入 CLI 存储目录。",
      discovered_sessions: "已发现会话",
      active_message_count: "当前消息数",
      storage_root: "存储根目录",
      open_sessions_folder: "打开会话目录",
      no_saved_title: "还没有保存的会话。",
      no_saved_desc: "先开始一次对话，猫爪会在这里生成独立的会话文件。",
      open: "打开",
    },
    agents_panel: {
      desktop_roles: "桌面分工",
      agent_profiles: "分工配置",
      agent_profiles_desc: "全局模型/provider 默认值保持共享。技能包和可选覆盖模型属于单个分工，这个页面会把二者分开说明。",
      profile_count: "配置数量",
      global_skill_commands: "全局技能命令",
      default_profile: "默认分工",
      no_extra_skills: "没有额外技能",
      save_again: "再次保存",
      set_as_default: "设为默认",
      edit_profile: "编辑配置",
      customized: "已自定义",
      shipped: "内置",
      per_agent_bundle: "单分工技能包",
      profile_editor: "配置编辑器",
      profile_editor_desc: "决定某个分工是跟随全局模型设置，还是使用自己的 provider/model 覆盖，以及它独享哪些额外技能。",
      profile: "配置",
      model_scope: "模型范围",
      follow_global_model: "跟随全局模型",
      override_this_agent: "仅覆盖当前分工",
      display_name: "显示名称",
      provider_override: "Provider 覆盖",
      model_override: "Model 覆盖",
      follows_global_defaults: "当前配置正在跟随 Settings 中的全局 provider 与模型默认值。",
      save_profiles: "保存分工配置",
      reset_current_profile: "重置当前配置",
      skill_scope: "技能范围",
      selected_skills: "已选技能",
      starter_packs_attached: "已附加技能包",
    },
    startup: {
      failed_title: "桌面启动失败",
      failed_desc: "在应用完成启动前，界面遇到了一个启动错误。",
      no_logs: "还没有日志。",
      no_history: "还没有会话历史。",
    },
    onboarding: {
      eyebrow: "桌面优先的编码客户端",
      hero_title: "一分钟完成安装，立刻开始对话。",
      hero_desc: "猫爪 maoclaw 是 Pi runtime 的可安装 macOS 客户端：本地优先存储、真实 RPC 对话、可见窗口，以及从首次启动到日常使用的清晰路径。",
      get_started: "开始使用",
      get_started_desc: "配置一个 provider、一个默认模型和一个桌面默认分工。先把本地对话跑起来，渠道和自动化放到后面。",
      normal_app: "正常软件",
      normal_app_desc: "以 macOS 应用程序包启动，而不是只停留在终端界面。",
      config_clarity: "配置清晰",
      config_clarity_desc: "模型、渠道、技能、自动化和权限都有可见的管理入口。",
      real_backend: "真实后端",
      real_backend_desc: "窗口通过 RPC 与打包的 Pi 二进制通信，而不是接假后端。",
      provider_step: "1. Provider",
      model_step: "2. Model",
      profile_step: "3. 桌面分工",
      starter_profiles: "默认分工配置",
    },
    tab: {
      chat: {
        label: "对话",
        title: "对话工作台",
        description: "主聊天界面、实时会话控制，以及始终可见当前模型的核心输入区。",
      },
      sessions: {
        label: "聊天记录",
        title: "聊天记录库",
        description: "继续处理桌面端托管的聊天记录，并查看当前对话保存在哪里。",
      },
      agents: {
        label: "分身",
        title: "助手分身配置",
        description: "桌面分工角色，支持全局默认和单分身技能包/模型姿态控制。",
      },
      channels: {
        label: "接入",
        title: "对话接入渠道",
        description: "绑定 Telegram、飞书、QQ 等入口，指定分工并保存真实工作区配置。",
      },
      skills: {
        label: "技能包",
        title: "技能包管理",
        description: "管理全局技能命令暴露、已发现技能以及全局/项目技能搜索路径。",
      },
      automations: {
        label: "自动化",
        title: "自动化调度",
        description: "管理基于 cron 的工作区自动化、编辑动作，并查看当前系统路由目标。",
      },
      security: {
        label: "权限安全",
        title: "安全与权限",
        description: "统一控制 extension policy、执行审批、allowlist 和 macOS 权限姿态。",
      },
      settings: {
        label: "设置",
        title: "桌面设置",
        description: "低频默认项、存储路径、迁移状态，以及桌面产品的真实性审计。",
      },
    },
    meta: {
      provider: "Provider",
      model: "模型",
      description: "描述",
      mode: "模式",
      coverage: "覆盖率",
      source: "来源",
      app_support: "App Support",
      project_settings: "项目设置",
      auth_file: "认证文件",
      history_empty: "还没有会话历史。",
      no_description: "暂无描述",
      review: "复核",
      explicit: "显式配置",
      auto_loaded: "自动加载",
      configured_path: "配置路径",
      model_invocation_disabled: "已禁用模型调用",
      project_root: "项目",
      global_root: "全局",
      running: "运行中",
      starting_on_demand: "按需启动",
      detected: "已检测",
      missing: "缺失",
      installed: "已安装",
      latest: "最新版本",
      last_check: "上次检查",
      policy: "策略",
      release: "版本",
      published: "发布时间",
      never: "从未",
      not_checked: "未检查",
      no_logs: "还没有日志。",
    },
    workspace_launcher: {
      workspace_switch: "工作区切换",
      surface_launcher: "载体启动器",
      remote_web_configured: "已配置远程 Web 工作区",
      native_chat_primary: "原生对话为主",
      remote_web_desc: "宿主可以在应用窗口中加载远程 Web 工作区，同时保留原生控制中心。",
      native_chat_desc: "你可以直接从这里打开远程 Web 工作区，而不用先绕到桌面设置里。",
      bridge_ready: "桥接就绪",
      bridge_warming: "桥接预热中",
      no_web_url: "未配置 Web 地址",
      configure_surfaces: "配置载体",
    },
    skills_panel: {
      skill_discovery: "技能发现",
      title: "技能包",
      desc: "管理猫爪从哪里加载技能、是否保持斜杠命令技能发现开启，以及当前运行时可见的技能。",
      discovered_skills: "已发现技能",
      global_extra_paths: "全局附加路径",
      project_extra_paths: "项目附加路径",
      health_notices: "健康提示",
      starter_catalog: "入门包目录",
      offline_installable: "可离线安装",
      starter_packs_installed: "已安装入门包",
      attached_to_current: "已附加到 {name}",
      command_exposure_note: "全局技能命令暴露在这里配置。入门包也可以直接从这个页面安装并附加到 {name}。",
      install_real_packs: "快速安装真实技能包",
      starter_catalog_desc: "这是猫爪的冷启动目录：应用内置的精选离线入门包，可直接安装到现有的全局或项目技能根目录。",
      bundled_catalog: "内置目录",
      installable_count: "{count} 个可安装",
      search_starter_catalog: "搜索入门目录",
      category: "分类",
      status: "状态",
      all_categories: "全部分类",
      all_packs: "全部包",
      installed_already: "已安装",
      not_installed_yet: "尚未安装",
      attached_to_current_agent: "已附加到当前分工",
      show_installable_only: "仅显示可安装项",
      show_installable_only_desc: "隐藏仅浏览项，只聚焦当前应用构建中内置的入门包。",
      reset_filters: "重置筛选",
      current_attach_target: "当前附加目标：{name}。如有需要，一键附加会先安装到{scope}技能根目录。",
      offline_install: "离线安装",
      catalog_only: "仅目录展示",
      global_installed: "已安装到全局",
      project_installed: "已安装到项目",
      skill_count: "技能数",
      attach_target: "附加目标",
      no_named_skills: "这个入门包还没有暴露命名技能。",
      attach_to_name: "附加到 {name}",
      install_and_attach: "安装并附加",
      install_global: "安装到全局",
      install_project: "安装到项目",
      open_bundle: "打开包目录",
      open_global: "打开全局目录",
      open_project: "打开项目目录",
      empty_filter_title: "当前筛选条件下没有匹配的入门包。",
      empty_filter_desc: "清空搜索、切换工作流，或关闭“仅可安装”后再浏览完整的精选目录。",
      discovery_health: "发现健康度",
      skill_loading_status: "技能加载状态",
      blocked: "阻塞",
      discovery_healthy: "技能发现状态健康：命令、路径与已发现负载保持一致。",
      enable_skill_commands: "启用技能命令",
      enable_skill_commands_desc: "控制技能定义的命令是否暴露给桌面运行时。",
      global_skills_root: "全局技能根目录",
      project_skills_root: "项目技能根目录",
      global_skill_paths: "全局技能路径",
      project_skill_paths: "项目技能路径",
      one_path_per_line_global: "每行一个路径。这些路径存储在桌面全局设置文件中。",
      one_path_per_line_project: "每行一个路径。这些路径存储在工作区 `.pi/settings.json` 中。",
      save_skill_settings: "保存技能设置",
      discovered_resources: "已发现资源",
      loaded_skill_catalog: "已加载技能目录",
      loaded_skill_catalog_desc: "下方每一行都来自真实的技能文件发现。来源标签会告诉你技能是自动加载还是来自附加路径。",
      no_skills_title: "还没有发现技能。",
      no_skills_desc: "添加全局或项目技能路径，或把技能放到默认技能根目录下。",
    },
    settings_panel: {
      preferred_surface: "首选载体",
      close_behavior: "关闭行为",
      menu_bar_access: "菜单栏入口",
      local_web_bridge: "本地 Web 桥",
      native_surface_title: "原生控制中心",
      native_surface_desc: "打包的 macOS 外壳，包含原生对话、设置、权限、技能、自动化与诊断。",
      web_surface_title: "Web 工作区",
      web_surface_desc: "在应用窗口中加载 Web 体验，同时保留本地桥接供 localhost 集成使用。",
      web_workspace_url: "Web 工作区地址",
      web_workspace_url_desc: "填写你托管的 maoclaw Web 工作区地址。像 `xinxiang.xin` 这样的纯域名会自动补全为 `https://...`。",
      window_close_behavior: "窗口关闭行为",
      close_background: "隐藏到菜单栏并保持运行",
      close_quit: "最后一个窗口关闭时退出",
      close_behavior_desc: "后台模式会把应用保留在 macOS 菜单栏中，方便快速重新打开和切换载体。",
      menu_bar_quick_access: "菜单栏快捷入口",
      menu_bar_quick_access_desc: "在 macOS 顶部右侧显示状态项，方便重新打开窗口、在原生与 Web 载体之间切换，或干净退出。",
      local_bridge_url: "本地桥接地址",
      embedded_native_shell: "内置原生外壳",
      always_available: "始终可用",
      unavailable: "不可用",
      version_management: "版本管理",
      desktop_updates_title: "桌面更新",
      desktop_updates_desc: "手动检查版本、一键下载安装包，并清晰展示当前安装版本。",
      checks_enabled: "已启用检查",
      checks_disabled: "已关闭检查",
      release_notes_preview: "版本说明预览",
      manual_update_checks: "这里支持手动检查更新。",
      live_runtime_title: "桌面运行操作",
      live_runtime_desc: "这些操作会直接打开或刷新真实的桌面托管状态。",
      migration_title: "导入状态",
      migration_desc: "桌面端可以把现有 CLI 配置吸收到自己的独立沙盒中。",
      import_note: "导入会把 CLI 设置和凭证复制到桌面沙盒中，不会覆盖你现有的 CLI 安装。",
      legacy_root: "旧版根目录",
      settings_file: "设置文件",
      auth_file: "认证文件",
      product_readiness: "产品完成度",
      product_readiness_desc: "这里会诚实展示哪些部分已经像成熟产品一样可用，哪些仍处于部分实现阶段。",
      truthfulness_audit: "真实性审计",
      data_provenance: "数据来源",
      data_provenance_desc: "每个主要产品面板都标注了其数据真正来自哪里。",
      interaction_audit: "交互审计",
      clickable_controls: "用户可以点击什么",
      clickable_controls_desc: "把信息展示区和真实可操作控件区分开，保证产品易学易用。",
      runtime_diagnostics: "运行时诊断",
      desktop_log: "桌面日志",
      desktop_log_desc: "最近的原生桥接与后端日志行。",
    },
    tabs: {
      simple_hidden_hint: "更多高级控制已收纳到专业版中。",
    },
  },
  "en-US": {
    common: {
      actionable: "Actionable",
      view_only: "View only",
      live: "Live",
      booting: "Booting",
      manage: "Manage",
      connected: "Connected",
      offline: "Offline",
      pending: "Pending",
      idle: "Idle",
      enabled: "Enabled",
      disabled: "Disabled",
      simple: "Simple",
      pro: "Pro",
    },
    source: {
      live_runtime: "Live runtime",
      live_filesystem: "Live filesystem",
      global_settings: "Global settings",
      project_config: "Project config",
      workspace_registry: "Workspace registry",
      policy_os: "Policy + OS state",
      mixed: "Mixed",
      persistent_defaults: "Persistent defaults",
      host_managed: "Host-managed",
    },
    shell: {
      desktop_client: "Desktop client",
      desktop_tagline: "Keep chat, workspace controls, and diagnostics aligned in one native view.",
      current_workspace: "Current workspace",
      primary_action: "Primary action",
      open_conversation_workspace: "Open the conversation workspace",
      chat_first_description: "The desktop should land in chat first. Settings, skills, channels, and security stay available without hiding the composer.",
      recent_sessions: "Recent chats",
      operational_posture: "Operational posture",
      desktop_status: "Desktop status",
      visible_product_surface: "Visible product surface",
      native_control_center: "Native control center",
      chat_one_click: "Chat stays one click away",
      local_bridge_ready: "Local bridge ready",
      local_bridge_warming: "Local bridge warming",
      web_preferred: "Web preferred",
      native_preferred: "Native preferred",
      native_host: "Native host",
      web_capable_host: "Web-capable host",
      backend_connected: "Backend connected",
      backend_starting: "Backend starting",
      show_sidebar: "Show Sidebar",
      focus_chat: "Focus Chat",
      expand: "Expand",
      collapse: "Collapse",
      workspace_not_set: "Workspace not set",
      open_chat: "Open Chat",
      remote_web: "Remote Web",
      browser: "Browser",
      desktop_settings: "Desktop Settings",
      command_search_placeholder: "Search tabs, panels, or actions",
      quick_nav: "Go",
      quick_actions: "Quick actions",
      nav_primary: "Work surfaces",
      nav_operations: "Operations",
      dock_actions: "Quick actions",
      metric_sessions: "Active sessions",
      metric_last_activity: "Updated {{value}}",
      metric_no_activity: "No recent activity",
      metric_messages: "Total messages",
      metric_total_messages: "Indexed conversations",
      metric_storage: "Storage",
      metric_storage_hint: "Auto archiving enabled",
      metric_channels: "Channels",
      metric_channels_hint: "Ready / total",
      metric_automations: "Automations",
      metric_automations_hint: "Enabled runs",
      desktop_sessions: "Desktop sessions",
      desktop_workflow: "Desktop workflow",
      system_broadcasts: "System broadcasts",
      status_channel: "Status lane",
      provider_overview: "Provider overview",
      skill_mode: "Skill packs",
      queue_empty: "No tasks queued",
      connection_pulse: "Connection pulse",
      provider_readiness: "Provider readiness",
      task_queue: "Task queue",
      operational_timeline: "Operational timeline",
      no_recent_activity: "No recent updates",
    },
    actions: {
      new_chat: "New Chat",
      choose_folder: "Choose Folder",
      import_existing_setup: "Import Existing Setup",
      save_defaults: "Save Defaults",
      save_shell_settings: "Save Shell Settings",
      open_native_chat: "Open Native Chat",
      reload_native: "Reload Native Control Center",
      open_web_workspace: "Open Web Workspace",
      open_in_browser: "Open in Browser",
      check_updates: "Check for Updates",
      download_install: "Download & Install",
      open_releases: "Open Releases",
      open_app_support: "Open App Support",
      open_sessions: "Open Sessions",
      refresh: "Refresh",
      restart_backend: "Restart Backend",
      start_chatting: "Start Chatting",
      recheck: "Recheck",
    },
    settings: {
      low_frequency_controls: "Low-frequency controls",
      desktop_defaults: "Desktop defaults",
      desktop_defaults_desc: "Provider preset, runtime provider id, API URL, API key, model, update policy, and workspace live here as one coherent configuration surface.",
      workspace_experience: "Mode and language",
      workspace_experience_desc: "This round lands the architecture now: a shared shell with simple/pro information layers and persisted UI language.",
      shell_title: "Native and web surfaces",
      shell_desc: "Choose whether maoclaw launches into the native control center or a web workspace, and define how the app behaves when the window closes.",
      preferred_surface: "Preferred surface",
      close_behavior: "Close behavior",
      menu_bar_access: "Menu bar access",
      local_web_bridge: "Local web bridge",
      version_management: "Version management",
      desktop_updates: "Desktop updates",
      desktop_updates_desc: "Manual release checks, one-click installer download, and a clear view of the currently installed version.",
      live_runtime: "Live runtime",
      desktop_operations: "Desktop operations",
      desktop_operations_desc: "These actions open or refresh real desktop-managed state.",
      migration: "Migration",
      import_status: "Import status",
      import_status_desc: "Desktop can adopt an existing CLI setup into its own isolated sandbox.",
      language_label: "Language",
      mode_label: "Mode",
      mode_simple_title: "Simple mode",
      mode_simple_desc: "Focus chat, chats, skill packs, and settings so new users can learn the product quickly.",
      mode_pro_title: "Pro mode",
      mode_pro_desc: "Expose the full control plane for agents, channels, automations, security, and diagnostics.",
      language_note: "Chinese is the default. English and Japanese stay one click away.",
      simple_note: "Simple mode hides complexity at the information layer, not by deleting capability.",
      pro_note: "Pro mode keeps the full surface visible with closer-to-runtime terminology.",
    },
    chat: {
      conversation_workspace: "Conversation workspace",
      conversation_workspace_desc: "Primary chat surface, live session controls, and the main composer with the active model kept visible.",
      current_session: "Current session",
      thread_lane: "Thread lane",
      desktop_default: "Desktop default",
      backend: "Backend",
      model_and_defaults: "Model & Defaults",
      conversation_lane: "Conversation lane",
      conversation_deck: "Conversation deck",
      threads: "Threads",
      current_thread: "Current thread",
      live_session: "Live session",
      context: "Context",
      chat_posture: "Chat posture",
      active_profile: "Active profile",
      agent_lanes: "Agent lanes",
      profiles: "Profiles",
      session_id: "Session id",
      messages: "Messages",
      branches: "Branches",
      no_threads_title: "No conversation threads yet.",
      no_threads_desc: "The first turn creates the first desktop-managed thread.",
      use_thread_switcher: "Switching here updates only the current thread lane. The desktop default stays separate for new sessions.",
      no_thread_binding: "No active thread file exists yet, so changing lane here will update the desktop default for the next session.",
      active_thread_lane: "Active thread lane",
      assign_to_thread: "Assign to this thread",
      edit_profiles: "Edit Profiles",
      manage_skills: "Manage Skills",
      pack_coverage: "Pack coverage",
      packs_in_use: "Starter packs in use",
      no_pack_title: "No starter-pack mapping yet.",
      no_pack_desc: "Attach a bundled starter pack in Skills or Agents to make this profile easier to reason about.",
      attached: "Attached",
      partial: "Partial",
      available: "Available",
      surface_handoff: "Surface handoff",
      where_to_work: "Where to work",
      preferred_surface: "Preferred surface",
      web_url: "Web URL",
      bridge: "Bridge",
      native_chat: "Native Chat",
      open_web_in_app: "Open Web In App",
      session_controls: "Session controls",
      manage: "Manage",
      session_name: "Session name",
      rename_current_session: "Rename current session",
      save_name: "Save Name",
      open_session: "Open Session",
      open_folder: "Open Folder",
      primary_surface: "Primary surface",
      chat_first: "Chat first",
      chat_first_desc: "The composer stays obvious, the live model stays visible, and session operations stay one click away instead of hiding inside settings.",
      live_session_model: "Live session model",
      choose_live_model: "Choose live model",
      composer: "Composer",
      composer_title: "Deep work, not a tiny prompt box",
      composer_note: "Send instructions, attach images directly into the model context, and keep files or audio references visible before the next turn.",
      attach_files: "Attach Files",
      add_image: "Add Image",
      add_audio: "Add Audio",
      clear_attachments: "Clear Attachments",
      pending_attachments: "Pending attachments",
      attachment_note: "Images are sent inline to the model. Audio and other files are attached as local file references for the agent to inspect from disk.",
      send_prompt: "Send Prompt",
      workspace_ready_title: "Your conversation workspace is ready.",
      workspace_ready_desc: "Start with a real coding task, then layer in images, files, or audio references directly from the composer. Every turn stays inside this desktop-managed session space.",
      current: "Current",
      hot: "Hot",
      recent: "Recent",
      archive: "Archive",
      saved: "Saved",
      you: "You",
      tool: "Tool",
      bash: "Bash",
      custom: "Custom",
      streaming: "streaming",
      no_message_body: "No message body.",
      assistant_pending_reply: "This turn was accepted and the assistant is preparing a reply.",
      assistant_tool_activity: "This turn is being handled through tool work and has no direct text reply yet.",
      assistant_no_visible_reply: "The assistant finished this turn without any visible reply.",
      command_no_output: "Command produced no output.",
    },
    sessions_panel: {
      live_library: "Live library",
      desktop_sessions: "Desktop sessions",
      desktop_sessions_desc: "Resume desktop-managed sessions without touching the CLI store.",
      discovered_sessions: "Discovered sessions",
      active_message_count: "Active message count",
      storage_root: "Storage root",
      open_sessions_folder: "Open Sessions Folder",
      no_saved_title: "No saved sessions yet.",
      no_saved_desc: "Start a conversation and maoclaw will begin writing isolated session files here.",
      open: "Open",
    },
    agents_panel: {
      desktop_roles: "Desktop roles",
      agent_profiles: "Agent profiles",
      agent_profiles_desc: "Global model/provider defaults stay shared. Skill bundles and optional override models are agent-specific. This surface makes that split explicit.",
      profile_count: "Profiles",
      global_skill_commands: "Global skill commands",
      default_profile: "Default profile",
      no_extra_skills: "No extra skills",
      save_again: "Save Again",
      set_as_default: "Set as Default",
      edit_profile: "Edit Profile",
      customized: "Customized",
      shipped: "Shipped",
      per_agent_bundle: "Per-agent bundle",
      profile_editor: "Profile editor",
      profile_editor_desc: "Use this to decide whether a given agent follows the main model settings or uses its own override, and which extra skills belong only to that agent.",
      profile: "Profile",
      model_scope: "Model scope",
      follow_global_model: "Follow global model",
      override_this_agent: "Override for this agent",
      display_name: "Display name",
      provider_override: "Provider override",
      model_override: "Model override",
      follows_global_defaults: "This profile currently follows the global provider and model defaults from Settings.",
      save_profiles: "Save Agent Profiles",
      reset_current_profile: "Reset Current Profile",
      skill_scope: "Skill scope",
      selected_skills: "Selected skills",
      starter_packs_attached: "Starter packs attached",
    },
    startup: {
      failed_title: "Desktop startup failed",
      failed_desc: "The UI hit a startup error before the app could finish booting.",
      no_logs: "No log entries yet.",
      no_history: "No session history yet.",
    },
    onboarding: {
      eyebrow: "Desktop-first coding client",
      hero_title: "Install in one minute, start chatting immediately.",
      hero_desc: "maoclaw is the installable macOS client for the Pi runtime: local-first storage, real RPC chat, a visible window, and a clean path from first launch to daily use.",
      get_started: "Get started",
      get_started_desc: "Configure one provider, one default model, and one desktop profile. Local chat is immediate; channels and automations come after setup.",
      normal_app: "Normal app",
      normal_app_desc: "Launches as a macOS application bundle instead of a terminal-only surface.",
      config_clarity: "Config clarity",
      config_clarity_desc: "Models, channels, skills, automations, and permissions all have visible management panels.",
      real_backend: "Real backend",
      real_backend_desc: "The window talks to the bundled Pi binary over RPC instead of a mock backend.",
      provider_step: "1. Provider",
      model_step: "2. Model",
      profile_step: "3. Desktop profile",
      starter_profiles: "Starter profiles",
    },
    tab: {
      chat: {
        label: "Chat",
        title: "Conversation workspace",
        description: "Primary chat surface, live session controls, and the main composer with the active model kept visible.",
      },
      sessions: {
        label: "Chats",
        title: "Chat library",
        description: "Resume desktop-managed chats and inspect where the current conversation is stored.",
      },
      agents: {
        label: "Agents",
        title: "Agent profiles",
        description: "Desktop roles with explicit global-vs-per-agent control for model posture and skill bundles.",
      },
      channels: {
        label: "Channels",
        title: "Conversation channels",
        description: "Bind Telegram, Feishu, and QQ entry points, assign an agent profile, and persist real workspace channel settings.",
      },
      skills: {
        label: "Skill Packs",
        title: "Skill management",
        description: "Control global skill command exposure, inspect discovered skills, and manage global and project skill search paths.",
      },
      automations: {
        label: "Automations",
        title: "Automation scheduler",
        description: "Manage cron-style workspace automations, edit their actions, and inspect the active system routing target.",
      },
      security: {
        label: "Security",
        title: "Security and permissions",
        description: "Control extension policy, exec approvals, capability allowlists, and macOS permission posture from one place.",
      },
      settings: {
        label: "Settings",
        title: "Desktop settings",
        description: "Low-frequency defaults, storage paths, migration status, and truthfulness audit for the desktop product.",
      },
    },
    meta: {
      provider: "Provider",
      model: "Model",
      description: "Description",
      mode: "Mode",
      coverage: "Coverage",
      source: "Source",
      app_support: "App Support",
      project_settings: "Project settings",
      auth_file: "Auth file",
      history_empty: "No session history yet.",
      no_description: "No description",
      review: "Review",
      explicit: "Explicit",
      auto_loaded: "Auto-loaded",
      configured_path: "Configured path",
      model_invocation_disabled: "Model invocation disabled",
      project_root: "project",
      global_root: "global",
      running: "Running",
      starting_on_demand: "Starting on demand",
      detected: "Detected",
      missing: "Missing",
      installed: "Installed",
      latest: "Latest",
      last_check: "Last check",
      policy: "Policy",
      release: "Release",
      published: "Published",
      never: "Never",
      not_checked: "Not checked",
      no_logs: "No log entries yet.",
    },
    workspace_launcher: {
      workspace_switch: "Workspace switch",
      surface_launcher: "Surface launcher",
      remote_web_configured: "Remote web is configured",
      native_chat_primary: "Native chat is primary",
      remote_web_desc: "The host can load your remote web workspace inside the app window while keeping the native control center available.",
      native_chat_desc: "Open the remote web workspace directly from here instead of hunting through desktop settings.",
      bridge_ready: "Bridge ready",
      bridge_warming: "Bridge warming",
      no_web_url: "No web URL",
      configure_surfaces: "Configure Surfaces",
    },
    skills_panel: {
      skill_discovery: "Skill discovery",
      title: "Skills",
      desc: "Manage where maoclaw loads skills from, whether slash-command discovery stays enabled, and which skills are visible to the runtime.",
      discovered_skills: "Discovered skills",
      global_extra_paths: "Global extra paths",
      project_extra_paths: "Project extra paths",
      health_notices: "Health notices",
      starter_catalog: "Starter catalog",
      offline_installable: "Offline installable",
      starter_packs_installed: "Starter packs installed",
      attached_to_current: "Attached to {name}",
      command_exposure_note: "Global skill command exposure is configured here. Starter packs can also be installed and attached directly to {name} from this screen.",
      install_real_packs: "Install real skill packs fast",
      starter_catalog_desc: "This is maoclaw’s cold-start catalog: curated offline starter packs bundled with the app and installed directly into your existing global or project skill roots.",
      bundled_catalog: "Bundled catalog",
      installable_count: "{count} installable",
      search_starter_catalog: "Search starter catalog",
      category: "Category",
      status: "Status",
      all_categories: "All categories",
      all_packs: "All packs",
      installed_already: "Installed already",
      not_installed_yet: "Not installed yet",
      attached_to_current_agent: "Attached to current agent",
      show_installable_only: "Show installable only",
      show_installable_only_desc: "Hide browse-only entries and focus on starter packs bundled into this app build.",
      reset_filters: "Reset Filters",
      current_attach_target: "Current attach target: {name}. One-click attach installs to the {scope} skills root when needed.",
      offline_install: "Offline install",
      catalog_only: "Catalog only",
      global_installed: "Global installed",
      project_installed: "Project installed",
      skill_count: "Skill count",
      attach_target: "Attach target",
      no_named_skills: "This starter pack does not expose named skills yet.",
      attach_to_name: "Attach To {name}",
      install_and_attach: "Install + Attach",
      install_global: "Install Global",
      install_project: "Install Project",
      open_bundle: "Open Bundle",
      open_global: "Open Global",
      open_project: "Open Project",
      empty_filter_title: "No starter packs match the current filter.",
      empty_filter_desc: "Clear the search, switch workflows, or disable installable-only mode to browse the full curated starter catalog.",
      discovery_health: "Discovery health",
      skill_loading_status: "Skill loading status",
      blocked: "Blocked",
      discovery_healthy: "Skill discovery is healthy: commands, paths, and discovered payloads are aligned.",
      enable_skill_commands: "Enable skill commands",
      enable_skill_commands_desc: "Controls whether skill-defined commands are exposed to the desktop runtime.",
      global_skills_root: "Global skills root",
      project_skills_root: "Project skills root",
      global_skill_paths: "Global skill paths",
      project_skill_paths: "Project skill paths",
      one_path_per_line_global: "One path per line. These paths are stored in the desktop-global settings file.",
      one_path_per_line_project: "One path per line. These paths are stored in the workspace `.pi/settings.json` file.",
      save_skill_settings: "Save Skill Settings",
      discovered_resources: "Discovered resources",
      loaded_skill_catalog: "Loaded skill catalog",
      loaded_skill_catalog_desc: "Every row below comes from actual skill file discovery. Source labels show whether the skill is auto-loaded or discovered from an extra path.",
      no_skills_title: "No skills discovered yet.",
      no_skills_desc: "Add a global or project skill path, or place skills under the default skill roots.",
    },
    settings_panel: {
      preferred_surface: "Preferred surface",
      close_behavior: "Close behavior",
      menu_bar_access: "Menu bar access",
      local_web_bridge: "Local web bridge",
      native_surface_title: "Native control center",
      native_surface_desc: "Bundled macOS shell with native chat, settings, permissions, skills, automations, and diagnostics.",
      web_surface_title: "Web workspace",
      web_surface_desc: "Load the web experience in the app window while the local bridge keeps localhost integration available.",
      web_workspace_url: "Web workspace URL",
      web_workspace_url_desc: "Use your hosted maoclaw web workspace URL. Plain domains like `xinxiang.xin` are normalized to `https://...` automatically.",
      window_close_behavior: "Window close behavior",
      close_background: "Hide to menu bar and keep running",
      close_quit: "Quit when the last window closes",
      close_behavior_desc: "Background mode keeps the app available from the macOS menu bar for quick reopen and surface switching.",
      menu_bar_quick_access: "Menu bar quick access",
      menu_bar_quick_access_desc: "Shows a top-right macOS status item so users can reopen the window, switch between native and web surfaces, or quit cleanly.",
      local_bridge_url: "Local bridge URL",
      embedded_native_shell: "Embedded native shell",
      always_available: "Always available",
      unavailable: "Unavailable",
      version_management: "Version management",
      desktop_updates_title: "Desktop updates",
      desktop_updates_desc: "Manual release checks, one-click installer download, and a clear view of the currently installed version.",
      checks_enabled: "Checks enabled",
      checks_disabled: "Checks disabled",
      release_notes_preview: "Release notes preview",
      manual_update_checks: "Manual update checks are available here.",
      live_runtime_title: "Desktop operations",
      live_runtime_desc: "These actions open or refresh real desktop-managed state.",
      migration_title: "Import status",
      migration_desc: "Desktop can adopt an existing CLI setup into its own isolated sandbox.",
      import_note: "Import copies CLI settings and credentials into the desktop sandbox. It does not overwrite your existing CLI installation.",
      legacy_root: "Legacy root",
      settings_file: "Settings file",
      auth_file: "Auth file",
      product_readiness: "Product readiness",
      product_readiness_desc: "This keeps the desktop honest about which parts already behave like a finished product and which parts are still partial implementation lanes.",
      truthfulness_audit: "Truthfulness audit",
      data_provenance: "Data provenance",
      data_provenance_desc: "Each major product surface is labeled by where its data actually comes from.",
      interaction_audit: "Interaction audit",
      clickable_controls: "What users can click",
      clickable_controls_desc: "Separates informational areas from true controls so the product stays easy to learn.",
      runtime_diagnostics: "Runtime diagnostics",
      desktop_log: "Desktop log",
      desktop_log_desc: "Recent native bridge and backend log lines.",
    },
    tabs: {
      simple_hidden_hint: "More advanced controls are available in Pro mode.",
    },
  },
  "ja-JP": {
    common: {
      actionable: "操作可能",
      view_only: "閲覧のみ",
      live: "ライブ",
      booting: "起動中",
      manage: "管理",
      connected: "接続済み",
      offline: "オフライン",
      pending: "保留",
      idle: "待機中",
      enabled: "有効",
      disabled: "無効",
      simple: "シンプル",
      pro: "プロ",
    },
    source: {
      live_runtime: "ライブ実行状態",
      live_filesystem: "ライブファイルシステム",
      global_settings: "グローバル設定",
      project_config: "プロジェクト設定",
      workspace_registry: "ワークスペースレジストリ",
      policy_os: "ポリシー + OS 状態",
      mixed: "混在",
      persistent_defaults: "永続デフォルト",
      host_managed: "ホスト管理",
    },
    shell: {
      desktop_client: "デスクトップクライアント",
      desktop_tagline: "チャット、分工、スキル、診断を 1 つのネイティブ画面で整然と管理します。",
      current_workspace: "現在のワークスペース",
      primary_action: "主要アクション",
      open_conversation_workspace: "会話ワークスペースを開く",
      chat_first_description: "デスクトップは最初にチャットへ着地すべきです。設定、スキル、チャネル、セキュリティは作曲欄を隠さずに利用できます。",
      recent_sessions: "最近のチャット",
      operational_posture: "運用状況",
      desktop_status: "デスクトップ状態",
      visible_product_surface: "可視プロダクト面",
      native_control_center: "ネイティブコントロールセンター",
      chat_one_click: "チャットは常に 1 クリック",
      local_bridge_ready: "ローカルブリッジ準備完了",
      local_bridge_warming: "ローカルブリッジ起動中",
      web_preferred: "Web 優先",
      native_preferred: "ネイティブ優先",
      native_host: "ネイティブホスト",
      web_capable_host: "Web 対応ホスト",
      backend_connected: "バックエンド接続済み",
      backend_starting: "バックエンド起動中",
      show_sidebar: "サイドバーを表示",
      focus_chat: "チャットに集中",
      expand: "展開",
      collapse: "折りたたむ",
      workspace_not_set: "ワークスペース未設定",
      open_chat: "チャットを開く",
      remote_web: "リモート Web",
      browser: "ブラウザ",
      desktop_settings: "デスクトップ設定",
      command_search_placeholder: "タブや操作を検索",
      quick_nav: "移動",
      quick_actions: "クイックアクション",
      nav_primary: "主要サーフェス",
      nav_operations: "運用・設定",
      dock_actions: "クイックアクション",
      metric_sessions: "利用可能セッション",
      metric_last_activity: "最終更新 {{value}}",
      metric_no_activity: "更新履歴なし",
      metric_messages: "累計メッセージ",
      metric_total_messages: "インデックス済み",
      metric_storage: "ストレージ使用量",
      metric_storage_hint: "自動アーカイブ中",
      metric_channels: "チャネル",
      metric_channels_hint: "稼働中 / 全体",
      metric_automations: "自動化",
      metric_automations_hint: "有効なジョブ",
      desktop_sessions: "デスクトップセッション",
      desktop_workflow: "デスクトップワークフロー",
      system_broadcasts: "システムブロードキャスト",
      status_channel: "ステータスレーン",
      provider_overview: "プロバイダー概要",
      skill_mode: "スキルパック",
      queue_empty: "待機中のタスクはありません",
      connection_pulse: "接続状況",
      provider_readiness: "プロバイダー準備",
      task_queue: "タスクキュー",
      operational_timeline: "オペレーションタイムライン",
      no_recent_activity: "最近の更新はありません",
    },
    actions: {
      new_chat: "新しいチャット",
      choose_folder: "フォルダを選択",
      import_existing_setup: "既存設定を取り込む",
      save_defaults: "既定値を保存",
      save_shell_settings: "シェル設定を保存",
      open_native_chat: "ネイティブチャットを開く",
      reload_native: "ネイティブ画面を再読み込み",
      open_web_workspace: "Web ワークスペースを開く",
      open_in_browser: "ブラウザで開く",
      check_updates: "更新を確認",
      download_install: "ダウンロードしてインストール",
      open_releases: "リリースを開く",
      open_app_support: "App Support を開く",
      open_sessions: "セッションを開く",
      refresh: "更新",
      restart_backend: "バックエンド再起動",
      start_chatting: "チャットを始める",
      recheck: "再確認",
    },
    settings: {
      low_frequency_controls: "低頻度コントロール",
      desktop_defaults: "デスクトップ既定値",
      desktop_defaults_desc: "Provider プリセット、runtime provider id、API URL、API key、モデル、更新ポリシー、ワークスペースを一つの設定面に集約します。",
      workspace_experience: "モードと言語",
      workspace_experience_desc: "今回は UI 基盤を先に入れます。simple/pro の情報階層と永続化された言語設定です。",
      shell_title: "ネイティブと Web サーフェス",
      shell_desc: "maoclaw をネイティブ制御センターで起動するか Web ワークスペースで起動するかを選び、ウィンドウを閉じた後の挙動も定義します。",
      preferred_surface: "優先サーフェス",
      close_behavior: "閉じる動作",
      menu_bar_access: "メニューバーアクセス",
      local_web_bridge: "ローカル Web ブリッジ",
      version_management: "バージョン管理",
      desktop_updates: "デスクトップ更新",
      desktop_updates_desc: "手動リリース確認、ワンクリックでのインストーラ取得、現在のバージョン表示。",
      live_runtime: "ライブ実行状態",
      desktop_operations: "デスクトップ操作",
      desktop_operations_desc: "これらの操作は実際のデスクトップ管理状態を開いたり更新したりします。",
      migration: "移行",
      import_status: "インポート状況",
      import_status_desc: "デスクトップは既存 CLI 設定を自身の隔離サンドボックスへ取り込めます。",
      language_label: "言語",
      mode_label: "モード",
      mode_simple_title: "シンプルモード",
      mode_simple_desc: "チャット、履歴、スキルパック、設定に集中し、学習コストを下げます。",
      mode_pro_title: "プロモード",
      mode_pro_desc: "agents、channels、automations、security、diagnostics まで含む完全なコントロール面を表示します。",
      language_note: "既定は中国語です。English と日本語へ切り替えられます。",
      simple_note: "シンプルモードは能力を削除せず、情報構造だけを絞ります。",
      pro_note: "プロモードはよりランタイム寄りの用語で完全な制御面を表示します。",
    },
    chat: {
      conversation_workspace: "会話ワークスペース",
      conversation_workspace_desc: "主要チャット面、ライブセッション制御、現在のモデルを表示したままのメイン composer。",
      current_session: "現在のセッション",
      thread_lane: "スレッドレーン",
      desktop_default: "デスクトップ既定",
      backend: "バックエンド",
      model_and_defaults: "モデルと既定値",
      conversation_lane: "会話レーン",
      conversation_deck: "会話デッキ",
      threads: "スレッド",
      current_thread: "現在のスレッド",
      live_session: "ライブセッション",
      context: "コンテキスト",
      chat_posture: "チャット姿勢",
      active_profile: "現在のプロファイル",
      agent_lanes: "エージェントレーン",
      profiles: "プロファイル",
      session_id: "セッション ID",
      messages: "メッセージ数",
      branches: "分岐数",
      no_threads_title: "会話スレッドはまだありません。",
      no_threads_desc: "最初の 1 ターンで、デスクトップ管理の最初のスレッドが作成されます。",
      use_thread_switcher: "ここでの切り替えは現在のスレッドレーンだけを更新します。デスクトップ既定は新しいセッション用に保持されます。",
      no_thread_binding: "まだアクティブなスレッドファイルがないため、ここでの切り替えは次回セッション用のデスクトップ既定を更新します。",
      active_thread_lane: "現在のスレッドレーン",
      assign_to_thread: "このスレッドへ割り当て",
      edit_profiles: "プロファイルを編集",
      manage_skills: "スキルを管理",
      pack_coverage: "パック適用状況",
      packs_in_use: "使用中のスターターパック",
      no_pack_title: "まだスターターパックの紐付けがありません。",
      no_pack_desc: "Skills または Agents で同梱スターターパックを追加すると、このプロファイルの守備範囲が明確になります。",
      attached: "適用済み",
      partial: "一部",
      available: "利用可能",
      surface_handoff: "サーフェス切替",
      where_to_work: "どこで作業するか",
      preferred_surface: "優先サーフェス",
      web_url: "Web URL",
      bridge: "ブリッジ",
      native_chat: "ネイティブチャット",
      open_web_in_app: "アプリ内で Web を開く",
      session_controls: "セッション操作",
      manage: "管理",
      session_name: "セッション名",
      rename_current_session: "現在のセッション名を変更",
      save_name: "名前を保存",
      open_session: "セッションを開く",
      open_folder: "フォルダを開く",
      primary_surface: "主要サーフェス",
      chat_first: "チャット優先",
      chat_first_desc: "composer を目立たせ、ライブモデルを見せたまま、セッション操作を設定の奥へ隠しません。",
      live_session_model: "現在のセッションモデル",
      choose_live_model: "現在のモデルを選択",
      composer: "Composer",
      composer_title: "小さな入力欄ではなく、深く作業するための入力面",
      composer_note: "指示を送り、画像をモデル文脈に直接添付し、次のターンまでファイルや音声参照を見える形で保持します。",
      attach_files: "ファイルを添付",
      add_image: "画像を追加",
      add_audio: "音声を追加",
      clear_attachments: "添付をクリア",
      pending_attachments: "送信待ち添付",
      attachment_note: "画像はそのままモデルへ送られます。音声やその他のファイルはローカル参照として添付され、エージェントがディスクから確認できます。",
      send_prompt: "送信",
      workspace_ready_title: "会話ワークスペースの準備ができました。",
      workspace_ready_desc: "実際のコーディング作業から始め、その後で画像、ファイル、音声参照を重ねてください。すべてのターンはこのデスクトップ管理セッション内に残ります。",
      current: "現在",
      hot: "注目",
      recent: "最近",
      archive: "アーカイブ",
      saved: "保存済み",
      you: "あなた",
      tool: "ツール",
      bash: "Bash",
      custom: "カスタム",
      streaming: "ストリーミング中",
      no_message_body: "本文がありません。",
      assistant_pending_reply: "このターンは受理され、アシスタントが返信を準備しています。",
      assistant_tool_activity: "このターンは主にツール実行で進んでおり、まだ直接の本文返信はありません。",
      assistant_no_visible_reply: "このターンでは、アシスタントから表示可能な返信がありませんでした。",
      command_no_output: "コマンド出力はありませんでした。",
    },
    sessions_panel: {
      live_library: "ライブライブラリ",
      desktop_sessions: "デスクトップセッション",
      desktop_sessions_desc: "CLI ストアへ触れずに、デスクトップ管理のセッションを再開できます。",
      discovered_sessions: "検出済みセッション",
      active_message_count: "現在のメッセージ数",
      storage_root: "保存ルート",
      open_sessions_folder: "セッションフォルダを開く",
      no_saved_title: "保存済みセッションはまだありません。",
      no_saved_desc: "会話を開始すると、maoclaw がここへ分離されたセッションファイルを書き始めます。",
      open: "開く",
    },
    agents_panel: {
      desktop_roles: "デスクトップ役割",
      agent_profiles: "エージェントプロファイル",
      agent_profiles_desc: "グローバルなモデル/provider 既定値は共有のままです。スキル束や任意のモデル上書きはエージェント単位で管理されます。",
      profile_count: "プロファイル数",
      global_skill_commands: "グローバルスキルコマンド",
      default_profile: "既定プロファイル",
      no_extra_skills: "追加スキルなし",
      save_again: "再保存",
      set_as_default: "既定に設定",
      edit_profile: "プロファイルを編集",
      customized: "カスタマイズ済み",
      shipped: "同梱",
      per_agent_bundle: "エージェント別バンドル",
      profile_editor: "プロファイルエディタ",
      profile_editor_desc: "このエージェントがメイン設定に従うか独自の上書きを使うか、また追加スキルをどれだけ持つかをここで決めます。",
      profile: "プロファイル",
      model_scope: "モデル範囲",
      follow_global_model: "グローバルモデルに従う",
      override_this_agent: "このエージェントだけ上書き",
      display_name: "表示名",
      provider_override: "Provider 上書き",
      model_override: "Model 上書き",
      follows_global_defaults: "このプロファイルは現在、Settings のグローバル provider/model 既定値に従っています。",
      save_profiles: "エージェントプロファイルを保存",
      reset_current_profile: "現在のプロファイルをリセット",
      skill_scope: "スキル範囲",
      selected_skills: "選択済みスキル",
      starter_packs_attached: "適用済みスターターパック",
    },
    startup: {
      failed_title: "デスクトップ起動に失敗しました",
      failed_desc: "アプリの起動が完了する前に、UI で起動エラーが発生しました。",
      no_logs: "ログはまだありません。",
      no_history: "セッション履歴はまだありません。",
    },
    onboarding: {
      eyebrow: "デスクトップ優先のコーディングクライアント",
      hero_title: "1 分で導入し、すぐに会話を開始。",
      hero_desc: "maoclaw は Pi runtime のインストール可能な macOS クライアントです。ローカル優先ストレージ、実際の RPC チャット、見えるウィンドウ、そして初回起動から日常利用までの明確な導線を備えます。",
      get_started: "はじめる",
      get_started_desc: "provider、既定モデル、デスクトップ既定プロファイルを 1 つずつ設定します。ローカルチャットを先に動かし、チャネルや自動化は後から整えます。",
      normal_app: "通常のアプリ",
      normal_app_desc: "端末専用 UI ではなく macOS アプリケーションバンドルとして起動します。",
      config_clarity: "設定の見通し",
      config_clarity_desc: "モデル、チャネル、スキル、自動化、権限に可視の管理面があります。",
      real_backend: "実バックエンド",
      real_backend_desc: "ウィンドウはモックではなく同梱された Pi バイナリと RPC で通信します。",
      provider_step: "1. Provider",
      model_step: "2. Model",
      profile_step: "3. デスクトッププロファイル",
      starter_profiles: "スタータープロファイル",
    },
    tab: {
      chat: {
        label: "チャット",
        title: "会話ワークスペース",
        description: "主要チャット面、ライブセッション制御、現在のモデルを表示したままのメイン composer。",
      },
      sessions: {
        label: "チャット履歴",
        title: "チャットライブラリ",
        description: "デスクトップ管理のチャットを再開し、現在の会話の保存先も確認できます。",
      },
      agents: {
        label: "エージェント",
        title: "エージェントプロファイル",
        description: "モデル姿勢やスキル束をグローバル/個別に制御できるデスクトップ役割です。",
      },
      channels: {
        label: "チャネル",
        title: "会話チャネル",
        description: "Telegram、Feishu、QQ などの入口を接続し、担当エージェントと実際のワークスペース設定を保存します。",
      },
      skills: {
        label: "スキルパック",
        title: "スキル管理",
        description: "グローバルなスキルコマンド公開、検出済みスキル、グローバル/プロジェクトの検索パスを管理します。",
      },
      automations: {
        label: "自動化",
        title: "自動化スケジューラ",
        description: "cron ベースのワークスペース自動化を管理し、動作を編集し、現在のシステム宛先を確認します。",
      },
      security: {
        label: "セキュリティ",
        title: "セキュリティと権限",
        description: "extension policy、実行承認、allowlist、macOS 権限姿勢を一か所で管理します。",
      },
      settings: {
        label: "設定",
        title: "デスクトップ設定",
        description: "低頻度の既定値、保存パス、移行状態、そしてデスクトップ製品の真実性監査。",
      },
    },
    meta: {
      provider: "Provider",
      model: "モデル",
      description: "説明",
      mode: "モード",
      coverage: "適用率",
      source: "ソース",
      app_support: "App Support",
      project_settings: "プロジェクト設定",
      auth_file: "認証ファイル",
      history_empty: "セッション履歴はまだありません。",
      no_description: "説明はありません",
      review: "確認",
      explicit: "明示",
      auto_loaded: "自動読み込み",
      configured_path: "設定パス",
      model_invocation_disabled: "モデル呼び出し無効",
      project_root: "プロジェクト",
      global_root: "グローバル",
      running: "実行中",
      starting_on_demand: "必要時に起動",
      detected: "検出済み",
      missing: "不足",
      installed: "インストール済み",
      latest: "最新",
      last_check: "最終確認",
      policy: "ポリシー",
      release: "リリース",
      published: "公開日",
      never: "未実行",
      not_checked: "未確認",
      no_logs: "ログはまだありません。",
    },
    workspace_launcher: {
      workspace_switch: "ワークスペース切替",
      surface_launcher: "サーフェス起動",
      remote_web_configured: "リモート Web を設定済み",
      native_chat_primary: "ネイティブチャットが主",
      remote_web_desc: "ホストはアプリ内でリモート Web ワークスペースを読み込みつつ、ネイティブ制御センターも維持できます。",
      native_chat_desc: "デスクトップ設定へ回り込まず、ここから直接リモート Web ワークスペースを開けます。",
      bridge_ready: "ブリッジ準備完了",
      bridge_warming: "ブリッジ起動中",
      no_web_url: "Web URL 未設定",
      configure_surfaces: "サーフェスを設定",
    },
    skills_panel: {
      skill_discovery: "スキル探索",
      title: "スキル",
      desc: "maoclaw がどこからスキルを読み込むか、スラッシュコマンド探索を有効にするか、現在ランタイムに見えているスキルを管理します。",
      discovered_skills: "検出済みスキル",
      global_extra_paths: "グローバル追加パス",
      project_extra_paths: "プロジェクト追加パス",
      health_notices: "健全性通知",
      starter_catalog: "スターターカタログ",
      offline_installable: "オフライン導入可",
      starter_packs_installed: "導入済みスターターパック",
      attached_to_current: "{name} に適用済み",
      command_exposure_note: "グローバルなスキルコマンド公開はここで設定します。スターターパックもこの画面から {name} に直接導入して適用できます。",
      install_real_packs: "実際のスキルパックをすばやく導入",
      starter_catalog_desc: "これは maoclaw のコールドスタート用カタログです。アプリ同梱のオフライン向けスターターパックを、既存のグローバルまたはプロジェクトのスキルルートへ直接導入できます。",
      bundled_catalog: "同梱カタログ",
      installable_count: "{count} 件導入可能",
      search_starter_catalog: "スターターカタログを検索",
      category: "カテゴリ",
      status: "状態",
      all_categories: "すべてのカテゴリ",
      all_packs: "すべてのパック",
      installed_already: "導入済み",
      not_installed_yet: "未導入",
      attached_to_current_agent: "現在のエージェントに適用",
      show_installable_only: "導入可能なものだけ表示",
      show_installable_only_desc: "閲覧専用の項目を隠し、このアプリに同梱されたスターターパックだけに集中します。",
      reset_filters: "フィルタをリセット",
      current_attach_target: "現在の適用先: {name}。必要ならワンクリック適用時に {scope} スキルルートへ先に導入します。",
      offline_install: "オフライン導入",
      catalog_only: "カタログのみ",
      global_installed: "グローバル導入済み",
      project_installed: "プロジェクト導入済み",
      skill_count: "スキル数",
      attach_target: "適用先",
      no_named_skills: "このスターターパックはまだ名前付きスキルを公開していません。",
      attach_to_name: "{name} に適用",
      install_and_attach: "導入して適用",
      install_global: "グローバルへ導入",
      install_project: "プロジェクトへ導入",
      open_bundle: "バンドルを開く",
      open_global: "グローバルを開く",
      open_project: "プロジェクトを開く",
      empty_filter_title: "現在のフィルタに一致するスターターパックはありません。",
      empty_filter_desc: "検索をクリアするか、ワークフローを切り替えるか、「導入可能のみ」を解除して完全なカタログを表示してください。",
      discovery_health: "探索の健全性",
      skill_loading_status: "スキル読み込み状態",
      blocked: "ブロック",
      discovery_healthy: "スキル探索は正常です。コマンド、パス、検出済みペイロードが整合しています。",
      enable_skill_commands: "スキルコマンドを有効化",
      enable_skill_commands_desc: "スキル定義のコマンドをデスクトップランタイムへ公開するかを制御します。",
      global_skills_root: "グローバルスキルルート",
      project_skills_root: "プロジェクトスキルルート",
      global_skill_paths: "グローバルスキルパス",
      project_skill_paths: "プロジェクトスキルパス",
      one_path_per_line_global: "1 行に 1 パス。これらはデスクトップ全体の設定ファイルに保存されます。",
      one_path_per_line_project: "1 行に 1 パス。これらはワークスペースの `.pi/settings.json` に保存されます。",
      save_skill_settings: "スキル設定を保存",
      discovered_resources: "検出済みリソース",
      loaded_skill_catalog: "読み込み済みスキルカタログ",
      loaded_skill_catalog_desc: "以下の各行は実際のスキルファイル探索から生成されています。ソースラベルで自動読み込みか追加パス由来かを確認できます。",
      no_skills_title: "まだスキルが見つかっていません。",
      no_skills_desc: "グローバルまたはプロジェクトのスキルパスを追加するか、既定のスキルルートへ配置してください。",
    },
    settings_panel: {
      preferred_surface: "優先サーフェス",
      close_behavior: "閉じる動作",
      menu_bar_access: "メニューバーアクセス",
      local_web_bridge: "ローカル Web ブリッジ",
      native_surface_title: "ネイティブ制御センター",
      native_surface_desc: "ネイティブチャット、設定、権限、スキル、自動化、診断を含む同梱 macOS シェルです。",
      web_surface_title: "Web ワークスペース",
      web_surface_desc: "ローカルブリッジで localhost 連携を維持しつつ、アプリウィンドウ内で Web 体験を表示します。",
      web_workspace_url: "Web ワークスペース URL",
      web_workspace_url_desc: "ホストしている maoclaw Web ワークスペース URL を使用します。`xinxiang.xin` のようなドメインは自動で `https://...` に正規化されます。",
      window_close_behavior: "ウィンドウ終了時の動作",
      close_background: "メニューバーに隠して実行を継続",
      close_quit: "最後のウィンドウを閉じたら終了",
      close_behavior_desc: "バックグラウンドモードでは macOS メニューバーからすぐ再表示したり、サーフェスを切り替えたりできます。",
      menu_bar_quick_access: "メニューバーのクイックアクセス",
      menu_bar_quick_access_desc: "右上のステータス項目からウィンドウ再表示、ネイティブ/Web の切替、終了を行えます。",
      local_bridge_url: "ローカルブリッジ URL",
      embedded_native_shell: "内蔵ネイティブシェル",
      always_available: "常に利用可能",
      unavailable: "利用不可",
      version_management: "バージョン管理",
      desktop_updates_title: "デスクトップ更新",
      desktop_updates_desc: "手動リリース確認、ワンクリックでのインストーラ取得、現在バージョンの明確表示。",
      checks_enabled: "確認有効",
      checks_disabled: "確認無効",
      release_notes_preview: "リリースノートのプレビュー",
      manual_update_checks: "ここで手動更新チェックを実行できます。",
      live_runtime_title: "デスクトップ操作",
      live_runtime_desc: "これらの操作は実際のデスクトップ管理状態を開いたり更新したりします。",
      migration_title: "インポート状態",
      migration_desc: "デスクトップは既存 CLI 設定を自身の隔離サンドボックスへ取り込めます。",
      import_note: "インポートは CLI の設定と資格情報をデスクトップサンドボックスへコピーします。既存の CLI インストールは上書きしません。",
      legacy_root: "旧ルート",
      settings_file: "設定ファイル",
      auth_file: "認証ファイル",
      product_readiness: "製品完成度",
      product_readiness_desc: "どの部分が完成品として振る舞い、どの部分がまだ部分実装かを正直に示します。",
      truthfulness_audit: "真実性監査",
      data_provenance: "データ由来",
      data_provenance_desc: "各主要サーフェスで、そのデータが実際にどこから来ているかを表示します。",
      interaction_audit: "操作監査",
      clickable_controls: "ユーザーがクリックできるもの",
      clickable_controls_desc: "情報表示領域と実際の操作領域を分けて、学びやすさを保ちます。",
      runtime_diagnostics: "実行時診断",
      desktop_log: "デスクトップログ",
      desktop_log_desc: "最近のネイティブブリッジとバックエンドのログ行。",
    },
    tabs: {
      simple_hidden_hint: "さらに高度な操作は Pro モードで利用できます。",
    },
  },
};

const localeOptions = ["zh-CN", "en-US", "ja-JP"];
const modeOptions = ["simple", "pro"];

const promptSuggestionsByLocale = {
  "zh-CN": [
    "检查这个仓库，告诉我当前最高风险的运行时缺口。",
    "审视当前桌面外壳，并提出下一个最关键的产品升级点。",
    "调试这个工作区里的失败流程，先说明根因再给方案。",
  ],
  "en-US": [
    "Inspect this repository and tell me the highest-risk runtime gaps.",
    "Review the current desktop shell and propose the next product-critical improvement.",
    "Debug the failing workflow in this workspace and explain the root cause first.",
  ],
  "ja-JP": [
    "このリポジトリを確認し、現在もっとも高リスクな実行時ギャップを教えてください。",
    "現在のデスクトップシェルを見直し、次に行うべき重要な製品改善を提案してください。",
    "このワークスペースの失敗しているワークフローをデバッグし、まず根本原因を説明してください。",
  ],
};

const uiRuntimeStrings = {
  "zh-CN": {
    common: {
      open: "打开",
      remove: "移除",
      exportHtml: "导出 HTML",
      attachment: "附件",
      image: "图片",
      audio: "音频",
      file: "文件",
      saved: "已保存",
      unknown: "未知",
      selectedPath: "所选路径",
      diagnosticsFolder: "诊断目录",
      manual: "手动",
      notConfigured: "未配置",
      providerFallback: "provider",
      modelFallback: "模型",
      openIntegrationContract: "打开集成契约",
      openBridgeSource: "打开桥接源码",
    },
    actionTypes: {
      run_task: "执行任务",
      export: "导出",
      notify_binding: "通知渠道",
      webhook: "Webhook",
    },
    relativeTime: {
      justNow: "刚刚",
      minAgo: "{count} 分钟前",
      hourAgo: "{count} 小时前",
      dayAgo: "{count} 天前",
    },
    providerDescriptions: {
      anthropic: "面向重度编码工作的 Claude 原生路径。",
      openai: "通用速度快，模型覆盖面广。",
      google: "Gemini 原生接入，支持直接填写 API key。",
      cohere: "Cohere Command 系列接入，支持直接凭证配置。",
      openrouter: "兼容 OpenAI 的路由入口，可编辑端点与模型。",
      groq: "高速度的 OpenAI 兼容推理入口。",
      moonshotai: "Moonshot/Kimi 的 OpenAI 兼容接线路径。",
      custom: "自定义 provider id、API URL、模型与 key。",
    },
    starterCatalogWorkflows: {
      all: {
        label: "全部包",
        description: "浏览完整的内置入门包目录。",
      },
      "ship-services": {
        label: "交付服务",
        description: "API、后端、架构与交付工作流。",
      },
      "frontend-polish": {
        label: "前端打磨",
        description: "UI、移动端、可访问性与 TypeScript 流程。",
      },
      "operate-production": {
        label: "运维生产",
        description: "基础设施、CI/CD、可靠性与故障响应。",
      },
      "migrate-safely": {
        label: "安全迁移",
        description: "迁移、现代化与文档支持。",
      },
      "lead-delivery": {
        label: "推进交付",
        description: "规划、编排与跨团队执行。",
      },
    },
    securityPresets: {
      dedicated: {
        label: "专用机器",
        detail: "专门用于 maoclaw 的工作站。路径最快、权限最大、摩擦最小。",
      },
      primary: {
        label: "主力机器",
        detail: "你的主工作 Mac。能力面广，但破坏性动作仍需先确认。",
      },
      home: {
        label: "家用机器",
        detail: "共享或个人 Mac，默认更克制，更容易审计。",
      },
    },
    status: {
      noUpdateCheckYet: "还没有执行过更新检查。",
      desktopReady: "{product} 已就绪。",
      finishSetup: "完成设置后即可开始和 {product} 对话。",
      desktopStateRefreshed: "桌面状态已刷新。",
      workspaceUpdated: "工作区已更新。",
      backendRestarted: "{product} 后端已重启。",
      importingExistingSetup: "正在把现有 Pi CLI 配置导入桌面沙盒...",
      importedExistingSetup: "现有 CLI 配置已导入桌面沙盒。",
      startingFreshSession: "正在开始新会话...",
      switchingSession: "正在切换到 {name}...",
      savingSessionName: "正在保存会话名称...",
      exportRequestSent: "已发送导出请求。请在保存面板中选择目标位置。",
      savingDesktopSetup: "正在保存桌面配置...",
      savingDesktopDefaults: "正在保存桌面默认值...",
      desktopDefaultsSaved: "桌面默认值已保存。",
      savingShellSettings: "正在保存桌面壳设置...",
      shellSettingsSaved: "桌面壳设置已保存。",
      openingWebWorkspace: "正在打开 Web 工作区...",
      returningNativeControlCenter: "正在返回原生控制中心...",
      openingWebWorkspaceBrowser: "正在浏览器中打开 Web 工作区...",
      webWorkspaceOpenedBrowser: "Web 工作区已在浏览器中打开。",
      removingSavedCredential: "正在移除 {providerId} 的已保存凭证...",
      savedCredentialRemoved: "{providerId} 的已保存凭证已移除。",
      checkingUpdates: "正在检查桌面更新...",
      updateCheckFinished: "更新检查已完成。",
      downloadingInstaller: "正在下载最新安装包...",
      installerDownloaded: "安装包已下载完成。",
      openedReleasesPage: "已打开发布页面。",
      enterPromptOrAttachFirst: "请先输入提示词或添加附件。",
      inspectAttachedItems: "请先检查附加内容。",
      promptDispatching: "正在派发提示词...",
      promptAccepted: "提示词已被后端接受。",
      promptAndAttachmentsSent: "提示词和附件已发送。",
      promptSent: "提示词已发送。",
      savingGoalContract: "正在保存目标契约...",
      goalContractSaved: "目标契约已更新。",
      updatingGoalRun: "正在更新目标执行状态...",
      goalRunUpdated: "目标执行状态已更新。",
      updatingGoalCriterion: "正在更新验收条件...",
      goalCriterionUpdated: "验收条件已更新。",
      clearingGoalContract: "正在清除目标契约...",
      goalContractCleared: "目标契约已清除。",
      goalContractRequiresGoalAndCriteria: "目标和至少一个验收条件不能为空。",
      goalContractInvalidNumber: "心跳、超时和最大重启次数必须是有效数字。",
      goalContractDraftReset: "目标草稿已重置为当前会话状态。",
      openingAttachmentPicker: "正在打开附件选择器...",
      attachmentsAdded: "已添加 {count} 个附件。",
      assigningThread: "正在把这个线程分配给 {agentName}...",
      threadLaneUpdated: "这个线程现在使用 {agentName} 分工。",
      desktopDefaultAgentSet: "桌面默认代理已切换为 {agentName}。",
      desktopDefaultSet: "桌面默认值已切换为 {agentName}。下一个线程会从这个分工开始。",
      noActiveThreadDefaulting: "当前还没有活动线程。正在把桌面默认值切换为 {agentName}...",
      savingAgentProfiles: "正在保存代理配置...",
      agentProfilesSaved: "代理配置已保存。",
      savingChannelBindings: "正在保存渠道绑定...",
      channelSettingsSaved: "渠道设置已保存。",
      channelReset: "渠道编辑已重置为工作区已保存状态。",
      savingSkillSettings: "正在保存技能设置...",
      skillSettingsSaved: "技能设置已保存。",
      installingCuratedSkillPack: "正在把精选技能包安装到 {scope} 技能目录...",
      curatedSkillPackInstalled: "精选技能包已安装到 {scope} 技能目录。",
      starterPackMissing: "内置目录中没有找到这个入门包。",
      noDiscoverableSkills: "{entry} 中没有发现可附加的技能。",
      starterPackAlreadyAttached: "{entry} 已经附加到 {agentName}。",
      installingAndAttachingPack: "正在把 {entry} 安装到 {scope} 技能目录并附加到 {agentName}...",
      attachingPack: "正在把 {entry} 附加到 {agentName}...",
      packAttached: "{entry} 已附加到 {agentName}。",
      creatingAutomation: "正在创建自动化...",
      updatingAutomation: "正在更新自动化...",
      automationSaved: "自动化已保存。",
      deletingAutomation: "正在删除自动化...",
      automationDeleted: "自动化已删除。",
      enablingAutomation: "正在启用自动化...",
      disablingAutomation: "正在停用自动化...",
      automationStateUpdated: "自动化状态已更新。",
      savingSecurityPolicy: "正在保存安全策略...",
      securityPolicySaved: "安全策略已保存。",
      securityPresetApplied: "已应用 {preset} 预设。请检查后保存以持久化。",
      selectingApprovedDirectory: "正在选择批准目录...",
      approvedDirectoryAdded: "已添加批准目录。",
      removingApprovedDirectory: "正在移除批准目录...",
      approvedDirectoryRemoved: "已移除批准目录。",
      extensionCapabilityRequired: "扩展 ID 和能力不能为空。",
      savingCapabilityDecision: "正在保存能力决策...",
      capabilityDecisionSaved: "能力决策已保存。",
      removingSavedDecisions: "正在移除已保存决策...",
      savedDecisionsRemoved: "已保存决策已移除。",
      resettingSavedDecisions: "正在重置所有已保存决策...",
      allSavedDecisionsRemoved: "所有已保存决策已移除。",
      requestingPermission: "正在请求 {permission} 权限...",
      permissionRequestSent: "{permission} 权限请求已发送。",
      openedPrivacySettings: "已打开 {permission} 的隐私设置。",
      openedDesktopLog: "已打开桌面日志文件。",
      exportingDiagnosticsReport: "正在导出诊断报告...",
      diagnosticsReportExported: "诊断报告已导出到 {path}。",
      preparingSupportBundle: "正在为 maoclaw 准备支持包...",
      supportBundlePrepared: "支持包已生成于 {path}。",
      refreshingSecurityState: "正在刷新安全与诊断状态...",
      securityStateRefreshed: "安全与诊断状态已刷新。",
      diagnosticsFolderUnavailable: "诊断目录当前不可用。",
      switchingModel: "正在切换到 {provider}/{modelId}...",
      rpcFailed: "RPC {command} 失败。",
      newSessionStarted: "新会话已开始。",
      sessionSwitched: "会话已切换。",
      modelSwitched: "模型已切换到 {provider}/{modelId}。",
      sessionNameUpdated: "会话名称已更新。",
      sessionExported: "会话已导出到 {path}。",
      thinking: "{product} 正在思考...",
      returnedError: "{product} 返回了错误。",
      turnComplete: "本轮已完成。",
      unknownProductError: "未知的 {product} 错误",
    },
    goal: {
      contract_title: "目标契约",
      contract_desc: "把当前会话绑定到明确目标和验收条件，避免执行过程漂移。",
      controls_title: "目标控制台",
      controls_desc: "只有在目标、生命周期或看门狗需要调整时才展开完整控制。",
      title: "标题",
      goal: "主目标",
      criteria: "验收条件",
      criteria_note: "每行一个条件。允许粘贴项目符号或编号列表。",
      criteria_placeholder: "- 所有检查通过\n- 产出可交付结果",
      system_id: "系统 ID",
      artifact_type: "产物类型",
      heartbeat_seconds: "心跳秒数",
      inactivity_seconds: "超时秒数",
      max_restarts: "最大重启次数",
      restart_on_inactive: "空转时自动恢复",
      save: "保存目标",
      reset: "重置草稿",
      open_controls: "展开控制",
      hide_controls: "收起控制",
      draft_dirty: "草稿未保存",
      pause: "暂停",
      resume: "恢复",
      complete: "完成",
      block: "阻塞",
      fail: "失败",
      clear: "清除",
      criterion_evidence: "验收证据",
      apply_criterion: "应用条件",
      criterion_met: "已满足",
      criterion_open: "未满足",
      watchdog: "看门狗",
      watchdog_healthy: "正常",
      watchdog_overdue: "超时",
      last_progress: "最近进展",
      empty_hint: "当前会话还没有目标契约。",
      status_active: "执行中",
      status_criteria_met: "条件满足",
      status_blocked: "已阻塞",
      status_failed: "失败",
      status_paused: "已暂停",
    },
    providerReadiness: {
      modelRequired: "必须填写模型 ID。",
      apiUrlInvalid: "API URL 必须是有效的 http 或 https 地址。",
      customProviderIdInvalid: "自定义 provider id 只能使用小写字母、数字和连字符。",
      apiKeyRequired: "当前没有已保存凭证，因此必须填写 API key。",
      usingSavedCredential: "当前将继续使用 {providerLabel} 已保存的凭证。",
      apiUrlDiffers: "API URL 与预设默认值不同。用于代理、网关或企业端点时这是正常的。",
      wireApiDiffers: "通信 API 与预设默认值不同。",
    },
  },
  "en-US": {
    common: {
      open: "Open",
      remove: "Remove",
      exportHtml: "Export HTML",
      attachment: "Attachment",
      image: "Image",
      audio: "Audio",
      file: "File",
      saved: "Saved",
      unknown: "Unknown",
      selectedPath: "selected path",
      diagnosticsFolder: "diagnostics folder",
      manual: "manual",
      notConfigured: "Not configured",
      providerFallback: "provider",
      modelFallback: "model",
      openIntegrationContract: "Open Integration Contract",
      openBridgeSource: "Open Bridge Source",
    },
    actionTypes: {
      run_task: "Run Task",
      export: "Export",
      notify_binding: "Notify Binding",
      webhook: "Webhook",
    },
    relativeTime: {
      justNow: "just now",
      minAgo: "{count} min ago",
      hourAgo: "{count} h ago",
      dayAgo: "{count} d ago",
    },
    providerDescriptions: {
      anthropic: "Claude-native path for coding-heavy desktop usage.",
      openai: "Fast general-purpose path with broad model coverage.",
      google: "Gemini-native route with direct API key entry.",
      cohere: "Cohere Command-family setup with direct credential entry.",
      openrouter: "OpenAI-compatible router with editable endpoint and model.",
      groq: "High-speed OpenAI-compatible inference.",
      moonshotai: "Moonshot/Kimi route with OpenAI-compatible wiring.",
      custom: "Bring your own provider id, API URL, model, and key.",
    },
    starterCatalogWorkflows: {
      all: {
        label: "All packs",
        description: "Browse the full bundled starter catalog.",
      },
      "ship-services": {
        label: "Ship services",
        description: "API, backend, architecture, and delivery workflows.",
      },
      "frontend-polish": {
        label: "Frontend polish",
        description: "UI, mobile, accessibility, and TypeScript flows.",
      },
      "operate-production": {
        label: "Operate production",
        description: "Infra, CI/CD, reliability, and incident response.",
      },
      "migrate-safely": {
        label: "Migrate safely",
        description: "Migration, modernization, and documentation support.",
      },
      "lead-delivery": {
        label: "Lead delivery",
        description: "Planning, orchestration, and cross-team execution.",
      },
    },
    securityPresets: {
      dedicated: {
        label: "Dedicated Machine",
        detail: "Single-purpose maoclaw workstation. Fastest path, broadest authority, lowest friction.",
      },
      primary: {
        label: "Primary Machine",
        detail: "Your main work Mac. Wide capability surface, but destructive actions still confirm first.",
      },
      home: {
        label: "Home Machine",
        detail: "Shared or personal Mac with tighter defaults. Safer by default and easier to audit.",
      },
    },
    status: {
      noUpdateCheckYet: "No update check has been run yet.",
      desktopReady: "{product} is ready.",
      finishSetup: "Finish setup to start chatting with {product}.",
      desktopStateRefreshed: "Desktop state refreshed.",
      workspaceUpdated: "Workspace updated.",
      backendRestarted: "{product} backend restarted.",
      importingExistingSetup: "Importing existing Pi CLI setup into the desktop sandbox...",
      importedExistingSetup: "Existing CLI setup imported into the desktop sandbox.",
      startingFreshSession: "Starting a fresh session...",
      switchingSession: "Switching to {name}...",
      savingSessionName: "Saving session name...",
      exportRequestSent: "Export request sent. Choose a destination in the save panel.",
      savingDesktopSetup: "Saving desktop setup...",
      savingDesktopDefaults: "Saving desktop defaults...",
      desktopDefaultsSaved: "Desktop defaults saved.",
      savingShellSettings: "Saving desktop shell settings...",
      shellSettingsSaved: "Desktop shell settings saved.",
      openingWebWorkspace: "Opening web workspace...",
      returningNativeControlCenter: "Returning to native control center...",
      openingWebWorkspaceBrowser: "Opening web workspace in your browser...",
      webWorkspaceOpenedBrowser: "Web workspace opened in your browser.",
      removingSavedCredential: "Removing saved credential for {providerId}...",
      savedCredentialRemoved: "Saved credential removed for {providerId}.",
      checkingUpdates: "Checking for desktop updates...",
      updateCheckFinished: "Update check finished.",
      downloadingInstaller: "Downloading the latest installer...",
      installerDownloaded: "Installer downloaded.",
      openedReleasesPage: "Opened the releases page.",
      enterPromptOrAttachFirst: "Enter a prompt or attach something first.",
      inspectAttachedItems: "Please inspect the attached items.",
      promptDispatching: "Dispatching prompt...",
      promptAccepted: "Prompt accepted by the backend.",
      promptAndAttachmentsSent: "Prompt and attachments sent.",
      promptSent: "Prompt sent.",
      savingGoalContract: "Saving goal contract...",
      goalContractSaved: "Goal contract updated.",
      updatingGoalRun: "Updating goal run state...",
      goalRunUpdated: "Goal run state updated.",
      updatingGoalCriterion: "Updating goal criterion...",
      goalCriterionUpdated: "Goal criterion updated.",
      clearingGoalContract: "Clearing goal contract...",
      goalContractCleared: "Goal contract cleared.",
      goalContractRequiresGoalAndCriteria: "A goal and at least one criterion are required.",
      goalContractInvalidNumber: "Heartbeat, timeout, and restart fields must be valid numbers.",
      goalContractDraftReset: "Goal draft reset to the current session state.",
      openingAttachmentPicker: "Opening attachment picker...",
      attachmentsAdded: "{count} attachment(s) added.",
      assigningThread: "Assigning this thread to {agentName}...",
      threadLaneUpdated: "This thread now uses the {agentName} lane.",
      desktopDefaultAgentSet: "Desktop default agent set to {agentName}.",
      desktopDefaultSet: "Desktop default set to {agentName}. The next thread will start on this lane.",
      noActiveThreadDefaulting: "No active thread yet. Setting desktop default to {agentName}...",
      savingAgentProfiles: "Saving agent profiles...",
      agentProfilesSaved: "Agent profiles saved.",
      savingChannelBindings: "Saving channel bindings...",
      channelSettingsSaved: "Channel settings saved.",
      channelReset: "Channel edits reset to the saved workspace state.",
      savingSkillSettings: "Saving skill settings...",
      skillSettingsSaved: "Skill settings saved.",
      installingCuratedSkillPack: "Installing curated skill pack into {scope} skills...",
      curatedSkillPackInstalled: "Curated skill pack installed into {scope} skills.",
      starterPackMissing: "Starter pack was not found in the bundled catalog.",
      noDiscoverableSkills: "No discoverable skills were found inside {entry}.",
      starterPackAlreadyAttached: "{entry} is already attached to {agentName}.",
      installingAndAttachingPack: "Installing {entry} into {scope} skills and attaching it to {agentName}...",
      attachingPack: "Attaching {entry} to {agentName}...",
      packAttached: "{entry} attached to {agentName}.",
      creatingAutomation: "Creating automation...",
      updatingAutomation: "Updating automation...",
      automationSaved: "Automation saved.",
      deletingAutomation: "Deleting automation...",
      automationDeleted: "Automation deleted.",
      enablingAutomation: "Enabling automation...",
      disablingAutomation: "Disabling automation...",
      automationStateUpdated: "Automation state updated.",
      savingSecurityPolicy: "Saving security policy...",
      securityPolicySaved: "Security policy saved.",
      securityPresetApplied: "{preset} preset applied. Review and save to persist it.",
      selectingApprovedDirectory: "Selecting approved directory...",
      approvedDirectoryAdded: "Approved directory added.",
      removingApprovedDirectory: "Removing approved directory...",
      approvedDirectoryRemoved: "Approved directory removed.",
      extensionCapabilityRequired: "Extension id and capability are required.",
      savingCapabilityDecision: "Saving capability decision...",
      capabilityDecisionSaved: "Capability decision saved.",
      removingSavedDecisions: "Removing saved decisions...",
      savedDecisionsRemoved: "Saved decisions removed.",
      resettingSavedDecisions: "Resetting all saved decisions...",
      allSavedDecisionsRemoved: "All saved decisions removed.",
      requestingPermission: "Requesting {permission} permission...",
      permissionRequestSent: "{permission} permission request sent.",
      openedPrivacySettings: "Opened {permission} privacy settings.",
      openedDesktopLog: "Opened the desktop log file.",
      exportingDiagnosticsReport: "Exporting diagnostics report...",
      diagnosticsReportExported: "Diagnostics report exported to {path}.",
      preparingSupportBundle: "Preparing support bundle for maoclaw...",
      supportBundlePrepared: "Support bundle prepared at {path}.",
      refreshingSecurityState: "Refreshing security and diagnostics state...",
      securityStateRefreshed: "Security and diagnostics state refreshed.",
      diagnosticsFolderUnavailable: "Diagnostics folder is unavailable.",
      switchingModel: "Switching to {provider}/{modelId}...",
      rpcFailed: "RPC {command} failed.",
      newSessionStarted: "New session started.",
      sessionSwitched: "Session switched.",
      modelSwitched: "Model switched to {provider}/{modelId}.",
      sessionNameUpdated: "Session name updated.",
      sessionExported: "Session exported to {path}.",
      thinking: "{product} is thinking...",
      returnedError: "{product} returned an error.",
      turnComplete: "Turn complete.",
      unknownProductError: "Unknown {product} error",
    },
    goal: {
      contract_title: "Goal Contract",
      contract_desc: "Bind the current session to an explicit objective and acceptance criteria so execution does not drift.",
      controls_title: "Goal Controls",
      controls_desc: "Open the full controls only when the mission, lifecycle, or guardrails need to change.",
      title: "Title",
      goal: "Primary goal",
      criteria: "Criteria",
      criteria_note: "One criterion per line. Bullets and numbered lines are accepted.",
      criteria_placeholder: "- All checks pass\n- Deliver a usable artifact",
      system_id: "System id",
      artifact_type: "Artifact type",
      heartbeat_seconds: "Heartbeat seconds",
      inactivity_seconds: "Inactivity timeout seconds",
      max_restarts: "Max restarts",
      restart_on_inactive: "Restart on inactivity",
      save: "Save goal",
      reset: "Reset draft",
      open_controls: "Open controls",
      hide_controls: "Hide controls",
      draft_dirty: "Draft changes",
      pause: "Pause",
      resume: "Resume",
      complete: "Complete",
      block: "Block",
      fail: "Fail",
      clear: "Clear",
      criterion_evidence: "Criterion evidence",
      apply_criterion: "Apply criterion",
      criterion_met: "Satisfied",
      criterion_open: "Open",
      watchdog: "Watchdog",
      watchdog_healthy: "Healthy",
      watchdog_overdue: "Overdue",
      last_progress: "Last progress",
      empty_hint: "No goal contract is active for this session yet.",
      status_active: "Active",
      status_criteria_met: "Criteria met",
      status_blocked: "Blocked",
      status_failed: "Failed",
      status_paused: "Paused",
    },
    providerReadiness: {
      modelRequired: "Model id is required.",
      apiUrlInvalid: "API URL must be a valid http or https address.",
      customProviderIdInvalid: "Custom provider id must use lowercase letters, numbers, and hyphens.",
      apiKeyRequired: "An API key is required because no saved credential exists for this provider.",
      usingSavedCredential: "Using the saved credential already stored for {providerLabel}.",
      apiUrlDiffers: "API URL differs from the preset default. This is fine for proxies, gateways, or enterprise endpoints.",
      wireApiDiffers: "Wire API differs from the preset default.",
    },
  },
  "ja-JP": {
    common: {
      open: "開く",
      remove: "削除",
      exportHtml: "HTML を書き出す",
      attachment: "添付",
      image: "画像",
      audio: "音声",
      file: "ファイル",
      saved: "保存済み",
      unknown: "不明",
      selectedPath: "選択したパス",
      diagnosticsFolder: "診断フォルダ",
      manual: "手動",
      notConfigured: "未設定",
      providerFallback: "provider",
      modelFallback: "モデル",
      openIntegrationContract: "統合契約を開く",
      openBridgeSource: "ブリッジソースを開く",
    },
    actionTypes: {
      run_task: "タスク実行",
      export: "エクスポート",
      notify_binding: "チャネル通知",
      webhook: "Webhook",
    },
    relativeTime: {
      justNow: "たった今",
      minAgo: "{count} 分前",
      hourAgo: "{count} 時間前",
      dayAgo: "{count} 日前",
    },
    providerDescriptions: {
      anthropic: "重いコーディング作業向けの Claude ネイティブ経路です。",
      openai: "幅広いモデルを高速に使える汎用経路です。",
      google: "API key を直接入力できる Gemini ネイティブ経路です。",
      cohere: "資格情報を直接設定できる Cohere Command 系の経路です。",
      openrouter: "エンドポイントとモデルを編集できる OpenAI 互換ルーターです。",
      groq: "高速な OpenAI 互換推論経路です。",
      moonshotai: "OpenAI 互換配線を使う Moonshot/Kimi 経路です。",
      custom: "provider id、API URL、モデル、key を自由に指定します。",
    },
    starterCatalogWorkflows: {
      all: {
        label: "すべてのパック",
        description: "同梱スターターカタログ全体を閲覧します。",
      },
      "ship-services": {
        label: "サービスを出荷",
        description: "API、バックエンド、アーキテクチャ、デリバリーの流れです。",
      },
      "frontend-polish": {
        label: "フロントエンド磨き込み",
        description: "UI、モバイル、アクセシビリティ、TypeScript の流れです。",
      },
      "operate-production": {
        label: "本番運用",
        description: "インフラ、CI/CD、信頼性、インシデント対応です。",
      },
      "migrate-safely": {
        label: "安全に移行",
        description: "移行、モダナイズ、ドキュメント支援です。",
      },
      "lead-delivery": {
        label: "デリバリー主導",
        description: "計画、オーケストレーション、横断実行です。",
      },
    },
    securityPresets: {
      dedicated: {
        label: "専用マシン",
        detail: "maoclaw 専用ワークステーション。最速で、権限が広く、摩擦が最も少ない構成です。",
      },
      primary: {
        label: "主力マシン",
        detail: "あなたのメイン作業用 Mac。能力面は広い一方、破壊的操作は確認を維持します。",
      },
      home: {
        label: "ホームマシン",
        detail: "共有または個人 Mac 向け。既定値はより保守的で、監査もしやすい構成です。",
      },
    },
    status: {
      noUpdateCheckYet: "まだ更新チェックは実行されていません。",
      desktopReady: "{product} の準備ができました。",
      finishSetup: "セットアップを完了すると {product} で会話を開始できます。",
      desktopStateRefreshed: "デスクトップ状態を更新しました。",
      workspaceUpdated: "ワークスペースを更新しました。",
      backendRestarted: "{product} バックエンドを再起動しました。",
      importingExistingSetup: "既存の Pi CLI 設定をデスクトップサンドボックスへ取り込んでいます...",
      importedExistingSetup: "既存 CLI 設定をデスクトップサンドボックスへ取り込みました。",
      startingFreshSession: "新しいセッションを開始しています...",
      switchingSession: "{name} へ切り替えています...",
      savingSessionName: "セッション名を保存しています...",
      exportRequestSent: "書き出し要求を送信しました。保存パネルで保存先を選択してください。",
      savingDesktopSetup: "デスクトップ設定を保存しています...",
      savingDesktopDefaults: "デスクトップ既定値を保存しています...",
      desktopDefaultsSaved: "デスクトップ既定値を保存しました。",
      savingShellSettings: "デスクトップシェル設定を保存しています...",
      shellSettingsSaved: "デスクトップシェル設定を保存しました。",
      openingWebWorkspace: "Web ワークスペースを開いています...",
      returningNativeControlCenter: "ネイティブ制御センターへ戻っています...",
      openingWebWorkspaceBrowser: "ブラウザで Web ワークスペースを開いています...",
      webWorkspaceOpenedBrowser: "Web ワークスペースをブラウザで開きました。",
      removingSavedCredential: "{providerId} の保存済み資格情報を削除しています...",
      savedCredentialRemoved: "{providerId} の保存済み資格情報を削除しました。",
      checkingUpdates: "デスクトップ更新を確認しています...",
      updateCheckFinished: "更新チェックが完了しました。",
      downloadingInstaller: "最新インストーラをダウンロードしています...",
      installerDownloaded: "インストーラをダウンロードしました。",
      openedReleasesPage: "リリースページを開きました。",
      enterPromptOrAttachFirst: "先にプロンプトを入力するか添付を追加してください。",
      inspectAttachedItems: "添付内容を確認してください。",
      promptDispatching: "プロンプトを送信キューへ入れています...",
      promptAccepted: "プロンプトがバックエンドに受理されました。",
      promptAndAttachmentsSent: "プロンプトと添付を送信しました。",
      promptSent: "プロンプトを送信しました。",
      savingGoalContract: "目標契約を保存しています...",
      goalContractSaved: "目標契約を更新しました。",
      updatingGoalRun: "目標実行状態を更新しています...",
      goalRunUpdated: "目標実行状態を更新しました。",
      updatingGoalCriterion: "達成条件を更新しています...",
      goalCriterionUpdated: "達成条件を更新しました。",
      clearingGoalContract: "目標契約をクリアしています...",
      goalContractCleared: "目標契約をクリアしました。",
      goalContractRequiresGoalAndCriteria: "目標と少なくとも 1 つの達成条件が必要です。",
      goalContractInvalidNumber: "ハートビート、タイムアウト、再開回数は有効な数値である必要があります。",
      goalContractDraftReset: "目標ドラフトを現在のセッション状態へ戻しました。",
      openingAttachmentPicker: "添付ピッカーを開いています...",
      attachmentsAdded: "{count} 件の添付を追加しました。",
      assigningThread: "このスレッドを {agentName} に割り当てています...",
      threadLaneUpdated: "このスレッドは {agentName} レーンを使うようになりました。",
      desktopDefaultAgentSet: "デスクトップ既定エージェントを {agentName} に設定しました。",
      desktopDefaultSet: "デスクトップ既定値を {agentName} に設定しました。次のスレッドはこのレーンで始まります。",
      noActiveThreadDefaulting: "まだアクティブなスレッドがありません。デスクトップ既定値を {agentName} に切り替えています...",
      savingAgentProfiles: "エージェントプロファイルを保存しています...",
      agentProfilesSaved: "エージェントプロファイルを保存しました。",
      savingChannelBindings: "チャネル設定を保存しています...",
      channelSettingsSaved: "チャネル設定を保存しました。",
      channelReset: "チャネル編集を保存済みワークスペース状態へ戻しました。",
      savingSkillSettings: "スキル設定を保存しています...",
      skillSettingsSaved: "スキル設定を保存しました。",
      installingCuratedSkillPack: "{scope} スキルへ同梱スキルパックを導入しています...",
      curatedSkillPackInstalled: "{scope} スキルへ同梱スキルパックを導入しました。",
      starterPackMissing: "同梱カタログにスターターパックが見つかりませんでした。",
      noDiscoverableSkills: "{entry} の中に発見可能なスキルがありませんでした。",
      starterPackAlreadyAttached: "{entry} はすでに {agentName} に適用されています。",
      installingAndAttachingPack: "{entry} を {scope} スキルへ導入し、{agentName} に適用しています...",
      attachingPack: "{entry} を {agentName} に適用しています...",
      packAttached: "{entry} を {agentName} に適用しました。",
      creatingAutomation: "自動化を作成しています...",
      updatingAutomation: "自動化を更新しています...",
      automationSaved: "自動化を保存しました。",
      deletingAutomation: "自動化を削除しています...",
      automationDeleted: "自動化を削除しました。",
      enablingAutomation: "自動化を有効化しています...",
      disablingAutomation: "自動化を無効化しています...",
      automationStateUpdated: "自動化状態を更新しました。",
      savingSecurityPolicy: "セキュリティ方針を保存しています...",
      securityPolicySaved: "セキュリティ方針を保存しました。",
      securityPresetApplied: "{preset} プリセットを適用しました。内容を確認して保存してください。",
      selectingApprovedDirectory: "承認済みディレクトリを選択しています...",
      approvedDirectoryAdded: "承認済みディレクトリを追加しました。",
      removingApprovedDirectory: "承認済みディレクトリを削除しています...",
      approvedDirectoryRemoved: "承認済みディレクトリを削除しました。",
      extensionCapabilityRequired: "拡張 ID と能力は必須です。",
      savingCapabilityDecision: "能力決定を保存しています...",
      capabilityDecisionSaved: "能力決定を保存しました。",
      removingSavedDecisions: "保存済み決定を削除しています...",
      savedDecisionsRemoved: "保存済み決定を削除しました。",
      resettingSavedDecisions: "すべての保存済み決定をリセットしています...",
      allSavedDecisionsRemoved: "すべての保存済み決定を削除しました。",
      requestingPermission: "{permission} 権限を要求しています...",
      permissionRequestSent: "{permission} 権限要求を送信しました。",
      openedPrivacySettings: "{permission} のプライバシー設定を開きました。",
      openedDesktopLog: "デスクトップログファイルを開きました。",
      exportingDiagnosticsReport: "診断レポートをエクスポートしています...",
      diagnosticsReportExported: "診断レポートを {path} にエクスポートしました。",
      preparingSupportBundle: "maoclaw 向けサポートバンドルを準備しています...",
      supportBundlePrepared: "サポートバンドルを {path} に生成しました。",
      refreshingSecurityState: "セキュリティと診断状態を更新しています...",
      securityStateRefreshed: "セキュリティと診断状態を更新しました。",
      diagnosticsFolderUnavailable: "診断フォルダは利用できません。",
      switchingModel: "{provider}/{modelId} へ切り替えています...",
      rpcFailed: "RPC {command} が失敗しました。",
      newSessionStarted: "新しいセッションを開始しました。",
      sessionSwitched: "セッションを切り替えました。",
      modelSwitched: "モデルを {provider}/{modelId} に切り替えました。",
      sessionNameUpdated: "セッション名を更新しました。",
      sessionExported: "セッションを {path} に書き出しました。",
      thinking: "{product} が考えています...",
      returnedError: "{product} がエラーを返しました。",
      turnComplete: "このターンは完了しました。",
      unknownProductError: "不明な {product} エラー",
    },
    goal: {
      contract_title: "目標契約",
      contract_desc: "現在のセッションを明確な目標と達成条件へ結びつけ、実行のぶれを防ぎます。",
      controls_title: "目標コントロール",
      controls_desc: "目標、進行状態、ガードレールを調整するときだけ詳細コントロールを開きます。",
      title: "タイトル",
      goal: "主目標",
      criteria: "達成条件",
      criteria_note: "1 行に 1 条件。箇条書きや番号付きリストもそのまま貼れます。",
      criteria_placeholder: "- すべてのチェックに合格\n- 使える成果物を出す",
      system_id: "システム ID",
      artifact_type: "成果物タイプ",
      heartbeat_seconds: "ハートビート秒数",
      inactivity_seconds: "停止判定秒数",
      max_restarts: "最大再開回数",
      restart_on_inactive: "停止時に自動再開",
      save: "目標を保存",
      reset: "ドラフトを戻す",
      open_controls: "コントロールを開く",
      hide_controls: "コントロールを閉じる",
      draft_dirty: "未保存のドラフト",
      pause: "一時停止",
      resume: "再開",
      complete: "完了",
      block: "停止",
      fail: "失敗",
      clear: "クリア",
      criterion_evidence: "達成証拠",
      apply_criterion: "条件を反映",
      criterion_met: "達成",
      criterion_open: "未達成",
      watchdog: "ウォッチドッグ",
      watchdog_healthy: "正常",
      watchdog_overdue: "超過",
      last_progress: "直近の進捗",
      empty_hint: "このセッションにはまだ目標契約がありません。",
      status_active: "進行中",
      status_criteria_met: "条件達成",
      status_blocked: "停止中",
      status_failed: "失敗",
      status_paused: "一時停止",
    },
    providerReadiness: {
      modelRequired: "モデル ID は必須です。",
      apiUrlInvalid: "API URL は有効な http または https アドレスである必要があります。",
      customProviderIdInvalid: "カスタム provider id には小文字、数字、ハイフンのみ使用できます。",
      apiKeyRequired: "この provider には保存済み資格情報がないため、API key が必要です。",
      usingSavedCredential: "{providerLabel} に保存されている資格情報を使用します。",
      apiUrlDiffers: "API URL がプリセット既定値と異なります。プロキシ、ゲートウェイ、企業エンドポイントでは問題ありません。",
      wireApiDiffers: "通信 API がプリセット既定値と異なります。",
    },
  },
};

function runtimeCatalog(locale = currentLocale()) {
  return uiRuntimeStrings[locale] || uiRuntimeStrings["zh-CN"];
}

function uiCopy(key, params = {}) {
  const catalogs = [runtimeCatalog(currentLocale()), uiRuntimeStrings["zh-CN"]];
  let value = null;
  for (const catalog of catalogs) {
    let cursor = catalog;
    for (const part of String(key).split(".")) {
      cursor = cursor?.[part];
    }
    if (typeof cursor === "string") {
      value = cursor;
      break;
    }
  }
  let text = value || key;
  for (const [paramKey, paramValue] of Object.entries(params)) {
    text = text.replaceAll(`{${paramKey}}`, String(paramValue));
  }
  return text;
}

function localizedProviderDescription(providerId, fallback = "") {
  return uiCopy(`providerDescriptions.${providerId}`) || fallback || "";
}

function localizedStarterCatalogWorkflow(workflow) {
  return {
    label: uiCopy(`starterCatalogWorkflows.${workflow.id}.label`) || workflow.label,
    description: uiCopy(`starterCatalogWorkflows.${workflow.id}.description`) || workflow.description,
  };
}

function localizedSecurityPreset(presetId, preset) {
  return {
    label: uiCopy(`securityPresets.${presetId}.label`) || preset.label,
    detail: uiCopy(`securityPresets.${presetId}.detail`) || preset.detail,
  };
}

function attachmentCountLabel(count) {
  const total = Number(count || 0);
  if (currentLocale() === "en-US") {
    return `${total} attachment${total === 1 ? "" : "s"}`;
  }
  if (currentLocale() === "ja-JP") {
    return `添付 ${total} 件`;
  }
  return `${total} 个附件`;
}

function actionTypeLabel(actionType) {
  return uiCopy(`actionTypes.${actionType || "run_task"}`) || actionType || uiCopy("actionTypes.run_task");
}

const pendingRequests = new Map();

function blankGoalDraft() {
  return {
    sourceGoalId: "",
    title: "",
    goal: "",
    criteriaText: "",
    systemId: "",
    artifactType: "",
    heartbeatSeconds: "300",
    inactivitySeconds: "900",
    maxRestarts: "12",
    restartOnInactive: true,
    dirty: false,
  };
}

function goalDraftFromContract(goalContract) {
  const watchdog = goalContract?.watchdog || {};
  return {
    sourceGoalId: goalContract?.id || "",
    title: goalContract?.title || "",
    goal: goalContract?.goal || "",
    criteriaText: Array.isArray(goalContract?.criteria)
      ? goalContract.criteria
        .map((criterion) => criterion?.description || "")
        .filter(Boolean)
        .join("\n")
      : "",
    systemId: goalContract?.systemId || "",
    artifactType: goalContract?.artifactType || "",
    heartbeatSeconds: String(watchdog.heartbeatSeconds || 300),
    inactivitySeconds: String(watchdog.inactivityTimeoutSeconds || 900),
    maxRestarts: String(
      typeof watchdog.maxRestarts === "number" ? watchdog.maxRestarts : 12
    ),
    restartOnInactive: watchdog.restartOnInactive !== false,
    dirty: false,
  };
}

function currentGoalSessionKey(sessionState = state.sessionState) {
  return sessionState?.sessionId || sessionState?.sessionFile || "";
}

function blankAutomationDraft() {
  return {
    id: "",
    name: "",
    description: "",
    cron: "0 9 * * *",
    actionType: "run_task",
    promptTemplate: "",
    destination: "",
    format: "json",
    bindingId: "",
    template: "",
    url: "",
    enabled: true,
  };
}

function blankPermissionDraft() {
  return {
    extensionId: "",
    capability: "exec",
    allow: true,
  };
}

function blankAgentProfileDraft(agentId = "main") {
  return {
    id: agentId,
    displayName: "",
    description: "",
    modeId: "follow_main",
    provider: "",
    model: "",
    skills: [],
    builtinSkills: [],
    prompts: [],
    skillScope: "Global-only",
    hasCustomizations: false,
  };
}

function normalizeGoalCriterionLine(line) {
  return String(line || "")
    .trim()
    .replace(/^[-*]\s+/, "")
    .replace(/^\d+[.)]\s+/, "")
    .trim();
}

function parseGoalCriteriaText(text) {
  return String(text || "")
    .split(/\r?\n/)
    .map((line) => normalizeGoalCriterionLine(line))
    .filter(Boolean);
}

function parseIntegerField(value, minimum = 0) {
  const parsed = Number.parseInt(String(value || "").trim(), 10);
  if (!Number.isFinite(parsed) || parsed < minimum) {
    return null;
  }
  return parsed;
}

function attachmentPreviewURL(attachment) {
  if (attachment.kind !== "image" || !attachment.base64Data || !attachment.mimeType) {
    return "";
  }
  return `data:${attachment.mimeType};base64,${attachment.base64Data}`;
}

function attachmentLabel(attachment) {
  switch (attachment.kind) {
    case "image":
      return uiCopy("common.image");
    case "audio":
      return uiCopy("common.audio");
    default:
      return uiCopy("common.file");
  }
}

function formatAttachmentSize(value) {
  const size = Number(value || 0);
  if (!size) {
    return "";
  }
  return formatBytes(size);
}

function safeUUID() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `fallback-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function productName() {
  return state.bootstrap?.productName || PRODUCT_FALLBACK;
}

function providerPresets() {
  return state.bootstrap?.providerPresets || providerPresetFallbacks;
}

function providerPresetById(id) {
  return providerPresets().find((preset) => preset.id === id || preset.runtimeProviderId === id) || providerPresetFallbacks[0];
}

function currentProviderConfig() {
  return state.bootstrap?.providerConfig || {
    presetId: state.onboarding.providerPreset,
    providerId: state.onboarding.provider,
    providerLabel: state.onboarding.providerLabel || providerLabels[state.onboarding.provider] || "Provider",
    model: state.onboarding.model,
    apiProtocol: state.onboarding.apiProtocol || providerPresetById(state.onboarding.providerPreset).apiProtocol,
    apiBaseURL: state.onboarding.apiBaseURL || providerPresetById(state.onboarding.providerPreset).apiBaseURL,
    usesCustomConfiguration: state.onboarding.providerPreset === "custom",
    hasSavedCredential: false,
    credentialProviders: [],
    checkForUpdates: state.onboarding.checkForUpdates !== false,
    modelsPath: state.bootstrap?.modelsPath || "",
  };
}

function updateStateSnapshot() {
  return state.bootstrap?.updateState || {
    currentVersion: "0.0.0",
    latestVersion: null,
    status: "idle",
    message: uiCopy("status.noUpdateCheckYet"),
    checkedAt: null,
    releaseName: null,
    publishedAt: null,
    releaseNotes: null,
    releaseURL: "",
    downloadURL: null,
    downloadedPackagePath: null,
  };
}

function providerIdPattern() {
  return /^[a-z0-9][a-z0-9-]{1,62}$/;
}

function looksLikeHttpUrl(value) {
  try {
    const url = new URL(String(value || "").trim());
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function providerReadiness() {
  const providerConfig = currentProviderConfig();
  const preset = providerPresetById(state.onboarding.providerPreset || providerConfig.presetId);
  const providerId = String(state.onboarding.provider || "").trim();
  const model = String(state.onboarding.model || "").trim();
  const apiBaseURL = String(state.onboarding.apiBaseURL || "").trim();
  const apiKey = String(state.onboarding.apiKey || "").trim();
  const issues = [];
  const warnings = [];

  if (!model) {
    issues.push(uiCopy("providerReadiness.modelRequired"));
  }
  if (!apiBaseURL || !looksLikeHttpUrl(apiBaseURL)) {
    issues.push(uiCopy("providerReadiness.apiUrlInvalid"));
  }
  if (preset.id === "custom" && !providerIdPattern().test(providerId)) {
    issues.push(uiCopy("providerReadiness.customProviderIdInvalid"));
  }
  if (!providerConfig.hasSavedCredential && !apiKey) {
    issues.push(uiCopy("providerReadiness.apiKeyRequired"));
  }
  if (providerConfig.hasSavedCredential && !apiKey) {
    warnings.push(uiCopy("providerReadiness.usingSavedCredential", { providerLabel: providerConfig.providerLabel }));
  }
  if (preset.id !== "custom" && apiBaseURL && apiBaseURL !== preset.apiBaseURL) {
    warnings.push(uiCopy("providerReadiness.apiUrlDiffers"));
  }
  if (preset.id !== "custom" && state.onboarding.apiProtocol !== preset.apiProtocol) {
    warnings.push(uiCopy("providerReadiness.wireApiDiffers"));
  }

  return {
    ready: issues.length === 0,
    issues,
    warnings,
    providerId,
    model,
    apiBaseURL,
  };
}

function releaseNotesPreview(notes) {
  return String(notes || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 6)
    .join("\n");
}

function normalizeUiLanguage(value) {
  return localeOptions.includes(value) ? value : "zh-CN";
}

function normalizeUiMode(value) {
  return modeOptions.includes(value) ? value : "simple";
}

function currentLocale() {
  return normalizeUiLanguage(state.ui.language || state.bootstrap?.uiLanguage || "zh-CN");
}

function currentMode() {
  return normalizeUiMode(state.ui.mode || state.bootstrap?.uiMode || "simple");
}

function translationCatalog(locale = currentLocale()) {
  return uiStrings[locale] || uiStrings["zh-CN"];
}

function t(key, params = {}) {
  const locale = currentLocale();
  const catalogs = [translationCatalog(locale), uiStrings["zh-CN"]];
  let value = null;
  for (const catalog of catalogs) {
    let cursor = catalog;
    for (const part of String(key).split(".")) {
      cursor = cursor?.[part];
    }
    if (typeof cursor === "string") {
      value = cursor;
      break;
    }
  }
  let text = value || key;
  for (const [paramKey, paramValue] of Object.entries(params)) {
    text = text.replaceAll(`{${paramKey}}`, String(paramValue));
  }
  return text;
}

function term(key) {
  const locale = currentLocale();
  const mode = currentMode();
  return termCatalog[locale]?.[mode]?.[key]
    || termCatalog["zh-CN"]?.[mode]?.[key]
    || key;
}

function localizedPromptSuggestions() {
  return promptSuggestionsByLocale[currentLocale()] || promptSuggestionsByLocale["zh-CN"];
}

function localeLabel(locale) {
  switch (normalizeUiLanguage(locale)) {
    case "en-US":
      return "English";
    case "ja-JP":
      return "日本語";
    default:
      return "中文";
  }
}

function modeLabel(mode) {
  return normalizeUiMode(mode) === "pro" ? t("common.pro") : t("common.simple");
}

function resolvedTabMeta() {
  return Object.fromEntries(
    Object.entries(tabMetaBase).map(([id, meta]) => [
      id,
      {
        label: t(meta.labelKey),
        title: t(meta.titleKey),
        description: t(meta.descriptionKey),
        availability: t(meta.availabilityKey),
        availabilityValue: meta.availabilityKey === "common.view_only" ? "View only" : "Actionable",
        source: t(meta.sourceKey),
      },
    ])
  );
}

function visibleTabIds() {
  return currentMode() === "pro"
    ? Object.keys(tabMetaBase)
    : ["chat", "sessions", "skills", "settings"];
}

function sidebarNavGroups() {
  const available = new Set(visibleTabIds());
  const groups = [];
  const primary = PRIMARY_NAV_TABS.filter((tab) => available.has(tab));
  if (primary.length) {
    groups.push({
      label: t("shell.nav_primary"),
      tabs: primary,
    });
  }
  const operations = OPERATIONS_NAV_TABS.filter((tab) => available.has(tab));
  if (operations.length) {
    groups.push({
      label: t("shell.nav_operations"),
      tabs: operations,
    });
  }
  return groups;
}

function ensureVisibleActiveTab() {
  if (!visibleTabIds().includes(state.activeTab)) {
    state.activeTab = "chat";
  }
}

function hostRequest(action, payload = {}) {
  const requestId = `req-${safeUUID()}`;
  return new Promise((resolve, reject) => {
    pendingRequests.set(requestId, { resolve, reject });
    const handler = globalThis.webkit?.messageHandlers?.piHost;
    if (!handler || typeof handler.postMessage !== "function") {
      pendingRequests.delete(requestId);
      reject(`${productName()} bridge is unavailable.`);
      return;
    }
    try {
      handler.postMessage({ action, requestId, payload });
    } catch (error) {
      pendingRequests.delete(requestId);
      reject(String(error));
    }
  });
}

function appendStatus(message, kind = "") {
  state.status = message;
  state.statusKind = kind;
  render();
}

function appendLocalizedStatus(key, params = {}, kind = "") {
  appendStatus(uiCopy(`status.${key}`, params), kind);
}

function backendStatusLevel() {
  if (state.backendReady) {
    return "connected";
  }
  return state.statusKind === "error" ? "offline" : "booting";
}

function backendStatusLabel() {
  switch (backendStatusLevel()) {
    case "connected":
      return t("common.connected");
    case "offline":
      return t("common.offline");
    default:
      return t("common.booting");
  }
}

function backendStatusBadgeClass() {
  switch (backendStatusLevel()) {
    case "connected":
      return statusBadgeClass("granted");
    case "offline":
      return statusBadgeClass("denied");
    default:
      return statusBadgeClass("manual_check");
  }
}

function recommendedModel(provider, presetId = currentProviderConfig().presetId || state.onboarding.providerPreset) {
  const preset = providerPresetById(presetId || provider);
  return state.bootstrap?.recommendedModels?.[provider]?.[0] || preset.defaultModels?.[0] || "";
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function composeOutboundPromptPreview(text, attachments) {
  const trimmedText = String(text || "").trim();
  const parts = [];
  if (trimmedText) {
    parts.push(trimmedText);
  }

  if (Array.isArray(attachments) && attachments.length) {
    const attachmentLines = attachments.map((item) => {
      const kind = item?.kind || "file";
      const name = item?.name || "attachment";
      const path = item?.path || "";
      if (kind === "image") {
        return `- image: ${name}`;
      }
      if (kind === "audio") {
        return `- audio file reference: ${name} (${path})`;
      }
      return `- file reference: ${name} (${path})`;
    });
    parts.push(`Attached items:\n${attachmentLines.join("\n")}`);
  }

  return parts.length ? parts.join("\n\n") : "Please inspect the attached items.";
}

function normalizePromptText(value) {
  return String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .join(" ");
}

function messageMatchesPendingUserTurn(message, pendingTurn) {
  if (!message || message.role !== "user" || !pendingTurn) {
    return false;
  }
  return normalizePromptText(message.body) === normalizePromptText(pendingTurn.outboundText);
}

function isPendingUserMessage(message) {
  if (!message || message.role !== "user") {
    return false;
  }
  return state.pendingUserTurns.some((entry) => entry.id === message.id);
}

function reconcilePendingUserTurns(messages) {
  const nextMessages = Array.isArray(messages) ? [...messages] : [];
  if (!state.pendingUserTurns.length) {
    return nextMessages;
  }

  const unmatched = [];
  const availableUserIndexes = new Set(
    nextMessages
      .map((entry, index) => (entry?.role === "user" ? index : -1))
      .filter((index) => index >= 0)
  );

  for (const pendingTurn of state.pendingUserTurns) {
    let matchedIndex = -1;
    for (const index of availableUserIndexes) {
      if (messageMatchesPendingUserTurn(nextMessages[index], pendingTurn)) {
        matchedIndex = index;
        break;
      }
    }

    if (matchedIndex >= 0) {
      availableUserIndexes.delete(matchedIndex);
      continue;
    }

    nextMessages.push({
      id: pendingTurn.id,
      role: "user",
      label: "You",
      body: pendingTurn.body || "",
      attachments: pendingTurn.attachments || [],
      tools: [],
      createdAt: pendingTurn.createdAt || null,
    });
    unmatched.push(pendingTurn);
  }

  state.pendingUserTurns = unmatched;
  return nextMessages;
}

function parseListInput(text) {
  return String(text || "")
    .split(/[\n,]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function availableChannels() {
  return state.bootstrap?.channels || [];
}

function skillsCatalog() {
  return state.bootstrap?.skillsCatalog || {
    enableSkillCommands: true,
    globalSkillPaths: [],
    projectSkillPaths: [],
    skills: [],
    catalogEntries: [],
    catalogInstallableCount: 0,
  };
}

function automationState() {
  return state.bootstrap?.automationState || {
    activeSystemId: "maoclaw_main",
    systems: [],
    automations: [],
  };
}

function securityState() {
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
    permissionsPath: "",
    desktopLogPath: "",
    diagnosticsPath: "",
  };
}

function systemPermissions() {
  return state.bootstrap?.systemPermissions || [];
}

function diagnosticsState() {
  return state.bootstrap?.diagnosticsState || {
    entries: [],
    logPath: "",
    reportRoot: "",
    errorCount: 0,
    warningCount: 0,
  };
}

function hostState() {
  return state.bootstrap?.hostState || {
    preferredSurface: "native",
    webWorkspaceURL: "https://xinxiang.xin",
    closeBehavior: "background",
    menuBarEnabled: true,
    webBridgeBaseURL: "http://127.0.0.1:43115",
    webBridgeRunning: false,
    nativeControlCenterAvailable: true,
  };
}

function hydrateDrafts(payload) {
  state.channelDrafts = deepClone(payload.channels || []);
  const agents = deepClone(payload.agents || []);
  const nextAgentDrafts = {};
  for (const agent of agents) {
    nextAgentDrafts[agent.id] = {
      id: agent.id,
      displayName: agent.displayName || agent.id,
      description: agent.description || "",
      modeId: agent.modeId || "follow_main",
      provider: agent.provider || "",
      model: agent.model || "",
      skills: Array.isArray(agent.skills) ? [...agent.skills] : [],
      builtinSkills: Array.isArray(agent.builtinSkills) ? [...agent.builtinSkills] : [],
      prompts: Array.isArray(agent.prompts) ? [...agent.prompts] : [],
      skillScope: agent.skillScope || "Global-only",
      hasCustomizations: Boolean(agent.hasCustomizations),
    };
  }
  state.agentProfileDrafts = nextAgentDrafts;
  if (!state.selectedAgentProfileId || !nextAgentDrafts[state.selectedAgentProfileId]) {
    state.selectedAgentProfileId = payload.starterAgent || agents[0]?.id || "main";
  }
  const skills = payload.skillsCatalog || {};
  state.skillDraft = {
    enableSkillCommands: skills.enableSkillCommands !== false,
    globalSkillPathsText: (skills.globalSkillPaths || []).join("\n"),
    projectSkillPathsText: (skills.projectSkillPaths || []).join("\n"),
  };

  const automations = payload.automationState?.automations || [];
  const currentId = state.automationDraft.id;
  const matching = automations.find((entry) => entry.id === currentId);
  state.automationDraft = matching
    ? automationDraftFromEntry(matching)
    : currentId
      ? blankAutomationDraft()
      : (state.automationDraft?.id ? blankAutomationDraft() : state.automationDraft);

  const security = payload.securityState || {};
  state.securityDraft = {
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

  const host = payload.hostState || {};
  state.hostDraft = {
    preferredSurface: host.preferredSurface || "native",
    webWorkspaceURL: host.webWorkspaceURL || "https://xinxiang.xin",
    closeBehavior: host.closeBehavior || "background",
    menuBarEnabled: host.menuBarEnabled !== false,
  };
}

function syncGoalDraftFromSessionState(options = {}) {
  const force = Boolean(options.force);
  const sessionKey = currentGoalSessionKey(state.sessionState);
  const currentDraft = state.goalDraft || blankGoalDraft();
  const goalContract = state.sessionState?.goalContract || null;

  if (force || state.goalEditorSessionKey !== sessionKey) {
    state.goalEditorExpanded = false;
    state.goalEditorSessionKey = sessionKey;
  }

  if (!goalContract) {
    if (force || !currentDraft.dirty || currentDraft.sourceGoalId) {
      state.goalDraft = blankGoalDraft();
    }
    return;
  }

  const goalId = goalContract.id || "";
  if (force || !currentDraft.dirty || currentDraft.sourceGoalId !== goalId) {
    state.goalDraft = goalDraftFromContract(goalContract);
  }
}

function applyBootstrap(payload) {
  state.bootstrap = payload;
  state.logs = Array.isArray(payload.logs) ? payload.logs.slice(-120) : [];
  state.ui.language = normalizeUiLanguage(payload.uiLanguage || state.ui.language || "zh-CN");
  state.ui.mode = normalizeUiMode(payload.uiMode || state.ui.mode || "simple");

  const providerConfig = payload.providerConfig || {};
  const preset = providerPresetById(providerConfig.presetId || payload.provider || state.onboarding.providerPreset || "anthropic");
  const bootstrapProvider = providerConfig.providerId || payload.provider || state.onboarding.provider || preset.runtimeProviderId;
  state.onboarding.providerPreset = preset.id;
  state.onboarding.provider = bootstrapProvider;
  state.onboarding.providerLabel = providerConfig.providerLabel || preset.label || providerLabels[bootstrapProvider] || bootstrapProvider;
  state.onboarding.model = providerConfig.model || payload.model || state.onboarding.model || recommendedModel(bootstrapProvider, preset.id);
  state.onboarding.apiBaseURL = providerConfig.apiBaseURL || preset.apiBaseURL;
  state.onboarding.apiProtocol = providerConfig.apiProtocol || preset.apiProtocol;
  state.onboarding.apiKey = "";
  state.onboarding.checkForUpdates = providerConfig.checkForUpdates !== false;
  state.onboarding.starterAgent = payload.starterAgent || state.onboarding.starterAgent || "main";
  state.onboarding.workspacePath = payload.workspacePath || state.onboarding.workspacePath || "";

  if (!state.sessionDraftName && state.sessionState?.sessionName) {
    state.sessionDraftName = state.sessionState.sessionName;
  }

  hydrateDrafts(payload);
  ensureVisibleActiveTab();
}

function boot() {
  state.sidebarCollapsed = globalThis.innerWidth < 1360;
  hostRequest("bootstrap")
    .then((response) => {
      applyBootstrap(response.payload);
      state.view = response.payload.configured ? "app" : "onboarding";
      appendStatus(
        response.payload.configured
          ? uiCopy("status.desktopReady", { product: productName() })
          : uiCopy("status.finishSetup", { product: productName() })
      );
      if (response.payload.configured) {
        state.activeTab = "chat";
        refreshDesktop(false);
      }
    })
    .catch((error) => appendStatus(String(error), "error"));
}

function refreshBootstrapOnly() {
  return hostRequest("bootstrap").then((response) => {
    applyBootstrap(response.payload);
    render();
    return response.payload;
  });
}

function refreshDesktop(renderStatus = true) {
  return hostRequest("refreshDesktop")
    .then((response) => {
      applyBootstrap(response.payload);
      if (renderStatus) {
        appendLocalizedStatus("desktopStateRefreshed");
      } else {
        render();
      }
      return response.payload;
    })
    .catch((error) => appendStatus(String(error), "error"));
}

function ensureAssistantMessage() {
  if (state.pendingAssistantId) {
    return state.pendingAssistantId;
  }
  const id = safeUUID();
  state.pendingAssistantId = id;
  state.messages.push({
    id,
    role: "assistant",
    body: "",
    tools: [],
    label: productName(),
    createdAt: new Date().toISOString(),
  });
  return id;
}

function updateAssistantBody(delta) {
  const id = ensureAssistantMessage();
  const message = state.messages.find((entry) => entry.id === id);
  if (message) {
    message.body += delta;
  }
}

function pushToolEvent(label) {
  const id = ensureAssistantMessage();
  const message = state.messages.find((entry) => entry.id === id);
  if (message && !message.tools.includes(label)) {
    message.tools.push(label);
  }
}

function syncAssistantMessageFromRpcMessage(rpcMessage) {
  if (!rpcMessage || rpcMessage.role !== "assistant") {
    return false;
  }

  const id = ensureAssistantMessage();
  const message = state.messages.find((entry) => entry.id === id);
  if (!message) {
    return false;
  }

  const presentation = normalizeVisibleContentPresentation(rpcMessage.content);
  const errorMessage = typeof rpcMessage.errorMessage === "string" ? rpcMessage.errorMessage.trim() : "";
  const nextBody = presentation.body || errorMessage || message.body || "";
  const nextTools = normalizeToolLabels([...(message.tools || []), ...presentation.toolNames]);
  const createdAt = rpcMessage.createdAt || rpcMessage.timestamp || rpcMessage.ts || rpcMessage.time || null;

  message.body = nextBody;
  message.tools = nextTools;
  if (presentation.attachments.length) {
    message.attachments = presentation.attachments;
  }
  if (createdAt) {
    message.createdAt = createdAt;
  }
  return true;
}

function ensureAssistantVisibleIfStreaming() {
  if (!state.sessionState?.isStreaming) {
    return;
  }
  if (state.pendingAssistantId && state.messages.some((entry) => entry.id === state.pendingAssistantId)) {
    return;
  }

  for (let index = state.messages.length - 1; index >= 0; index -= 1) {
    const role = state.messages[index]?.role;
    if (role === "assistant") {
      return;
    }
    if (role === "user") {
      break;
    }
  }

  ensureAssistantMessage();
}

function finishAssistantIfNeeded() {
  if (!state.pendingAssistantId) {
    return;
  }
  const pendingId = state.pendingAssistantId;
  state.pendingAssistantId = null;
  const index = state.messages.findIndex((entry) => entry.id === pendingId);
  if (index === -1) {
    return;
  }
  const message = state.messages[index];
  const hasBody = typeof message.body === "string" && message.body.trim().length > 0;
  const hasAttachments = Array.isArray(message.attachments) && message.attachments.length > 0;
  const hasTools = Array.isArray(message.tools) && message.tools.length > 0;
  if (!hasBody && !hasAttachments && !hasTools) {
    state.messages.splice(index, 1);
  }
}

function chooseWorkspace() {
  hostRequest("chooseWorkspace")
    .then((response) => {
      applyBootstrap(response.payload);
      appendLocalizedStatus("workspaceUpdated");
      if (state.view === "app") {
        refreshDesktop(false);
      }
    })
    .catch((error) => {
      if (String(error) !== "Cancelled") {
        appendStatus(String(error), "error");
      }
    });
}

function openSessionsFolder() {
  hostRequest("openSessionsFolder").catch((error) => appendStatus(String(error), "error"));
}

function openAppSupport() {
  hostRequest("openAppSupport").catch((error) => appendStatus(String(error), "error"));
}

function openCurrentSession() {
  hostRequest("openCurrentSession").catch((error) => appendStatus(String(error), "error"));
}

function openExternalPath(path) {
  if (!path) {
    return;
  }
  hostRequest("openExternalPath", { path }).catch((error) => appendStatus(String(error), "error"));
}

function toggleChannelExpanded(channelId) {
  state.channelExpanded[channelId] = !state.channelExpanded[channelId];
  render();
}

function focusComposerSoon() {
  globalThis.requestAnimationFrame(() => {
    const composer = document.querySelector("#composer");
    if (!composer) {
      return;
    }
    composer.focus({ preventScroll: false });
    composer.scrollIntoView({ block: "nearest", behavior: "smooth" });
  });
}

function restartBackend() {
  hostRequest("restartBackend")
    .then((response) => {
      applyBootstrap(response.payload);
      appendLocalizedStatus("backendRestarted", { product: productName() });
      refreshDesktop(false);
    })
    .catch((error) => appendStatus(String(error), "error"));
}

function importExistingSetup() {
  appendLocalizedStatus("importingExistingSetup");
  hostRequest("importExistingSetup")
    .then((response) => {
      applyBootstrap(response.payload);
      state.view = response.payload.configured ? "app" : state.view;
      state.activeTab = "chat";
      appendLocalizedStatus("importedExistingSetup");
      refreshDesktop(false);
    })
    .catch((error) => appendStatus(String(error), "error"));
}

function startNewSession() {
  state.activeTab = "chat";
  render();
  hostRequest("newSession")
    .then(() => {
      state.messages = [];
      state.pendingUserTurns = [];
      finishAssistantIfNeeded();
      focusComposerSoon();
    })
    .catch((error) => appendStatus(String(error), "error"));
}

function openSessionByIndex(index) {
  const session = state.bootstrap?.sessions?.[index];
  if (!session) {
    return;
  }

  state.activeTab = "chat";
  render();
  hostRequest("switchSession", { sessionPath: session.path })
    .then(() => {
      focusComposerSoon();
    })
    .catch((error) => appendStatus(String(error), "error"));
}

function updateSessionDraft(value) {
  state.sessionDraftName = value;
}

function updateGoalDraftField(field, value) {
  state.goalDraft = {
    ...(state.goalDraft || blankGoalDraft()),
    [field]: value,
    dirty: true,
  };
  state.goalEditorExpanded = true;
  render();
}

function resetGoalDraft() {
  syncGoalDraftFromSessionState({ force: true });
  appendLocalizedStatus("goalContractDraftReset");
  render();
}

function toggleGoalEditor(expanded) {
  if (!state.sessionState?.goalContract) {
    return;
  }
  if (expanded === false && state.goalDraft?.dirty) {
    return;
  }
  state.goalEditorExpanded = typeof expanded === "boolean"
    ? expanded
    : !goalEditorOpen(state.sessionState);
  render();
}

function saveGoalContract() {
  const draft = {
    ...(state.goalDraft || blankGoalDraft()),
  };
  const goal = draft.goal.trim();
  const criteria = parseGoalCriteriaText(draft.criteriaText);
  if (!goal || !criteria.length) {
    appendLocalizedStatus("goalContractRequiresGoalAndCriteria", {}, "error");
    return;
  }

  const heartbeatSeconds = parseIntegerField(draft.heartbeatSeconds, 1);
  const inactivityTimeoutSeconds = parseIntegerField(draft.inactivitySeconds, 1);
  const maxRestarts = parseIntegerField(draft.maxRestarts, 0);
  if (heartbeatSeconds === null || inactivityTimeoutSeconds === null || maxRestarts === null) {
    appendLocalizedStatus("goalContractInvalidNumber", {}, "error");
    return;
  }

  const goalContract = {
    goal,
    criteria,
    watchdog: {
      heartbeatSeconds,
      inactivityTimeoutSeconds,
      maxRestarts,
      restartOnInactive: draft.restartOnInactive !== false,
    },
  };
  if (draft.sourceGoalId) {
    goalContract.id = draft.sourceGoalId;
  }
  if (draft.title.trim()) {
    goalContract.title = draft.title.trim();
  }
  if (draft.systemId.trim()) {
    goalContract.systemId = draft.systemId.trim();
  }
  if (draft.artifactType.trim()) {
    goalContract.artifactType = draft.artifactType.trim();
  }

  appendLocalizedStatus("savingGoalContract");
  hostRequest("setGoalContract", { goalContract })
    .catch((error) => appendStatus(String(error), "error"));
}

function applyGoalLifecycle(action) {
  appendLocalizedStatus("updatingGoalRun");
  hostRequest("updateGoalRun", {
    goalRun: { action },
  }).catch((error) => appendStatus(String(error), "error"));
}

function clearGoalContract() {
  appendLocalizedStatus("clearingGoalContract");
  hostRequest("clearGoalContract")
    .catch((error) => appendStatus(String(error), "error"));
}

function goalCriterionCheckboxId(criterionId) {
  return `goal-criterion-${criterionId}`;
}

function goalCriterionEvidenceInputId(criterionId) {
  return `goal-criterion-evidence-${criterionId}`;
}

function applyGoalCriterion(criterionId) {
  const checkbox = document.querySelector(`#${goalCriterionCheckboxId(criterionId)}`);
  const evidenceInput = document.querySelector(`#${goalCriterionEvidenceInputId(criterionId)}`);
  appendLocalizedStatus("updatingGoalCriterion");
  hostRequest("updateGoalCriterion", {
    goalCriterion: {
      criterionId,
      satisfied: Boolean(checkbox?.checked),
      evidence: evidenceInput?.value?.trim() || null,
    },
  }).catch((error) => appendStatus(String(error), "error"));
}

function saveSessionName() {
  const name = state.sessionDraftName.trim();
  hostRequest("setSessionName", { name })
    .then(() => render())
    .catch((error) => appendStatus(String(error), "error"));
}

function exportCurrentSession() {
  hostRequest("exportCurrentSession")
    .then(() => appendLocalizedStatus("exportRequestSent"))
    .catch((error) => {
      if (String(error) !== "Cancelled") {
        appendStatus(String(error), "error");
      }
    });
}

function saveOnboarding(event) {
  event.preventDefault();
  appendLocalizedStatus("savingDesktopSetup");
  hostRequest("saveOnboarding", {
    ...state.onboarding,
    uiLanguage: currentLocale(),
    uiMode: currentMode(),
  })
    .then((response) => {
      applyBootstrap(response.payload);
      state.view = "app";
      state.activeTab = "chat";
      appendLocalizedStatus("desktopReady", { product: productName() });
      refreshDesktop(false);
    })
    .catch((error) => appendStatus(String(error), "error"));
}

function savePreferences(options = {}) {
  appendStatus(options.pendingMessage || uiCopy("status.savingDesktopDefaults"));
  return hostRequest("savePreferences", {
    providerPreset: state.onboarding.providerPreset,
    provider: state.onboarding.provider,
    providerLabel: state.onboarding.providerLabel,
    model: state.onboarding.model,
    apiBaseURL: state.onboarding.apiBaseURL,
    apiProtocol: state.onboarding.apiProtocol,
    starterAgent: state.onboarding.starterAgent,
    apiKey: state.onboarding.apiKey,
    uiLanguage: currentLocale(),
    uiMode: currentMode(),
    checkForUpdates: state.onboarding.checkForUpdates,
    workspacePath: state.onboarding.workspacePath,
  })
    .then((response) => {
      applyBootstrap(response.payload);
      if (options.switchToTab) {
        state.activeTab = options.switchToTab;
      }
      appendStatus(options.successMessage || uiCopy("status.desktopDefaultsSaved"));
      refreshDesktop(false);
    })
    .catch((error) => appendStatus(String(error), "error"));
}

function updateHostField(field, value) {
  state.hostDraft[field] = value;
  render();
}

function saveHostSettings() {
  appendLocalizedStatus("savingShellSettings");
  hostRequest("saveHostSettings", {
    preferredSurface: state.hostDraft.preferredSurface,
    webWorkspaceURL: state.hostDraft.webWorkspaceURL,
    closeBehavior: state.hostDraft.closeBehavior,
    menuBarEnabled: state.hostDraft.menuBarEnabled,
  })
    .then((response) => {
      applyBootstrap(response.payload);
      appendLocalizedStatus("shellSettingsSaved");
      render();
    })
    .catch((error) => appendStatus(String(error), "error"));
}

function switchDesktopSurface(mode, makePreferred = false) {
  appendLocalizedStatus(mode === "web" ? "openingWebWorkspace" : "returningNativeControlCenter");
  hostRequest("switchDesktopSurface", { mode, makePreferred })
    .catch((error) => appendStatus(String(error), "error"));
}

function openWebWorkspaceExternal() {
  appendLocalizedStatus("openingWebWorkspaceBrowser");
  hostRequest("openWebWorkspaceExternal")
    .then(() => appendLocalizedStatus("webWorkspaceOpenedBrowser"))
    .catch((error) => appendStatus(String(error), "error"));
}

function removeProviderCredential(providerId = state.onboarding.provider, presetId = state.onboarding.providerPreset) {
  appendLocalizedStatus("removingSavedCredential", { providerId });
  hostRequest("removeProviderCredential", {
    provider: providerId,
    providerPreset: presetId,
  })
    .then((response) => {
      applyBootstrap(response.payload);
      appendLocalizedStatus("savedCredentialRemoved", { providerId });
      render();
    })
    .catch((error) => appendStatus(String(error), "error"));
}

function checkForUpdates() {
  appendLocalizedStatus("checkingUpdates");
  hostRequest("checkForUpdates")
    .then((response) => {
      applyBootstrap(response.payload);
      appendStatus(updateStateSnapshot().message || uiCopy("status.updateCheckFinished"));
      render();
    })
    .catch((error) => appendStatus(String(error), "error"));
}

function downloadAndInstallUpdate() {
  appendLocalizedStatus("downloadingInstaller");
  hostRequest("downloadAndInstallUpdate")
    .then((response) => {
      applyBootstrap(response.payload);
      appendStatus(updateStateSnapshot().message || uiCopy("status.installerDownloaded"));
      render();
    })
    .catch((error) => appendStatus(String(error), "error"));
}

function openReleasePage() {
  hostRequest("openReleasePage")
    .then((response) => {
      applyBootstrap(response.payload);
      appendLocalizedStatus("openedReleasesPage");
    })
    .catch((error) => appendStatus(String(error), "error"));
}

function sendPrompt(event) {
  event.preventDefault();
  const textarea = document.querySelector("#composer");
  if (!textarea) {
    return;
  }
  const message = textarea.value.trim();
  const attachments = deepClone(state.composerAttachments || []);
  if (!message && !attachments.length) {
    appendLocalizedStatus("enterPromptOrAttachFirst", {}, "error");
    return;
  }

  const fallbackMessage = attachments.length ? uiCopy("status.inspectAttachedItems") : "";
  const outgoingBody = message || fallbackMessage;
  const localMessageId = safeUUID();
  const createdAt = new Date().toISOString();
  state.messages.push({
    id: localMessageId,
    role: "user",
    body: outgoingBody,
    attachments,
    tools: [],
    label: "You",
    createdAt,
  });
  state.pendingUserTurns.push({
    id: localMessageId,
    body: outgoingBody,
    attachments,
    createdAt,
    outboundText: composeOutboundPromptPreview(message, attachments),
  });
  textarea.value = "";
  state.composerAttachments = [];
  finishAssistantIfNeeded();
  const createdAssistantPlaceholder = !state.pendingAssistantId;
  if (createdAssistantPlaceholder) {
    ensureAssistantMessage();
  }
  render();
  appendLocalizedStatus("promptDispatching");

  hostRequest("sendPrompt", { message, attachments })
    .then((response) => {
      if (!response?.payload?.phase) {
        appendLocalizedStatus("promptAccepted");
      }
    })
    .catch((error) => {
      textarea.value = message;
      state.composerAttachments = attachments;
      state.pendingUserTurns = state.pendingUserTurns.filter((entry) => entry.id !== localMessageId);
      state.messages = state.messages.filter((entry) => entry.id !== localMessageId);
      if (createdAssistantPlaceholder) {
        finishAssistantIfNeeded();
      }
      appendStatus(String(error), "error");
      render();
    });
}

function mergeComposerAttachments(items) {
  const deduped = new Map();
  for (const item of [...state.composerAttachments, ...(items || [])]) {
    const key = item.path || `${item.kind}:${item.name}:${item.mimeType || ""}`;
    deduped.set(key, item);
  }
  state.composerAttachments = Array.from(deduped.values());
}

function pickComposerAttachments(purpose = "any") {
  appendLocalizedStatus("openingAttachmentPicker");
  hostRequest("pickComposerAttachments", { purpose })
    .then((response) => {
      const attachments = Array.isArray(response.payload?.attachments) ? response.payload.attachments : [];
      mergeComposerAttachments(attachments);
      appendLocalizedStatus("attachmentsAdded", { count: attachments.length });
      render();
    })
    .catch((error) => {
      if (String(error) !== "Cancelled") {
        appendStatus(String(error), "error");
      }
    });
}

function removeComposerAttachment(id) {
  state.composerAttachments = state.composerAttachments.filter((item) => item.id !== id);
  render();
}

function clearComposerAttachments() {
  state.composerAttachments = [];
  render();
}

function applySuggestedModel(modelId) {
  state.onboarding.model = modelId;
  render();
}

function resetProviderPresetConfig() {
  const preset = providerPresetById(state.onboarding.providerPreset);
  state.onboarding.provider = preset.id === "custom"
    ? (state.onboarding.provider || preset.runtimeProviderId)
    : preset.runtimeProviderId;
  state.onboarding.providerLabel = preset.label;
  state.onboarding.apiProtocol = preset.apiProtocol;
  state.onboarding.apiBaseURL = preset.apiBaseURL;
  if (!state.onboarding.model || state.onboarding.model === currentProviderConfig().model) {
    state.onboarding.model = preset.defaultModels?.[0] || state.onboarding.model;
  }
  render();
}

function selectProviderPreset(presetId) {
  const previousPreset = providerPresetById(state.onboarding.providerPreset);
  const nextPreset = providerPresetById(presetId);
  const previousRecommended = recommendedModel(state.onboarding.provider, previousPreset.id);
  state.onboarding.providerPreset = nextPreset.id;
  state.onboarding.provider = nextPreset.id === "custom"
    ? (state.onboarding.provider || nextPreset.runtimeProviderId)
    : nextPreset.runtimeProviderId;
  state.onboarding.providerLabel = nextPreset.label;
  state.onboarding.apiProtocol = nextPreset.apiProtocol;
  state.onboarding.apiBaseURL = nextPreset.apiBaseURL;
  if (!state.onboarding.model || state.onboarding.model === previousRecommended) {
    state.onboarding.model = recommendedModel(state.onboarding.provider, nextPreset.id);
  }
  render();
}

function updateField(field, value) {
  state.onboarding[field] = value;
}

function selectTab(tab) {
  if (!visibleTabIds().includes(tab)) {
    state.ui.mode = "pro";
  }
  state.activeTab = tab;
  render();
  const content = document.querySelector(".content-body");
  if (content) {
    content.scrollTop = 0;
  }
  if (tab === "chat") {
    focusComposerSoon();
  }
}

function updateUiLanguage(language) {
  state.ui.language = normalizeUiLanguage(language);
  render();
}

function updateUiMode(mode) {
  state.ui.mode = normalizeUiMode(mode);
  ensureVisibleActiveTab();
  render();
}

function openChatWorkspace() {
  state.activeTab = "chat";
  render();
  focusComposerSoon();
}

function renderExperienceControls(compact = false) {
  return `
    <section class="surface-card ${compact ? "compact-surface-card" : ""}">
      <div class="surface-header ${compact ? "tight" : ""}">
        <div>
          <div class="section-kicker">${escapeHtml(t("settings.workspace_experience"))}</div>
          <h2>${escapeHtml(t("settings.workspace_experience"))}</h2>
          ${compact ? "" : `<p>${escapeHtml(t("settings.workspace_experience_desc"))}</p>`}
        </div>
      </div>

      <div class="form-grid two">
        <div class="field">
          <label for="ui-language">${escapeHtml(t("settings.language_label"))}</label>
          <select id="ui-language" onchange="updateUiLanguage(this.value)">
            ${localeOptions.map((locale) => `
              <option value="${escapeHtml(locale)}" ${currentLocale() === locale ? "selected" : ""}>${escapeHtml(localeLabel(locale))}</option>
            `).join("")}
          </select>
          <div class="field-note">${escapeHtml(t("settings.language_note"))}</div>
        </div>

        <div class="field">
          <label for="ui-mode">${escapeHtml(t("settings.mode_label"))}</label>
          <select id="ui-mode" onchange="updateUiMode(this.value)">
            ${modeOptions.map((mode) => `
              <option value="${escapeHtml(mode)}" ${currentMode() === mode ? "selected" : ""}>${escapeHtml(modeLabel(mode))}</option>
            `).join("")}
          </select>
          <div class="field-note">${escapeHtml(currentMode() === "simple" ? t("settings.simple_note") : t("settings.pro_note"))}</div>
        </div>
      </div>

      ${compact ? "" : `
        <div class="card-grid">
          <button class="choice ${currentMode() === "simple" ? "selected" : ""}" type="button" onclick="updateUiMode('simple')">
            <strong>${escapeHtml(t("settings.mode_simple_title"))}</strong>
            <p>${escapeHtml(t("settings.mode_simple_desc"))}</p>
          </button>
          <button class="choice ${currentMode() === "pro" ? "selected" : ""}" type="button" onclick="updateUiMode('pro')">
            <strong>${escapeHtml(t("settings.mode_pro_title"))}</strong>
            <p>${escapeHtml(t("settings.mode_pro_desc"))}</p>
          </button>
        </div>
      `}
    </section>
  `;
}

function renderWorkspaceLauncher(options = {}) {
  const host = hostState();
  const compact = Boolean(options.compact);
  const locationLabel = compact ? t("workspace_launcher.workspace_switch") : t("workspace_launcher.surface_launcher");
  return `
    <section class="surface-switcher ${compact ? "compact" : ""}">
      <div class="surface-switcher-copy">
        <div class="section-kicker">${escapeHtml(locationLabel)}</div>
        <strong>${escapeHtml(host.preferredSurface === "web" ? t("workspace_launcher.remote_web_configured") : t("workspace_launcher.native_chat_primary"))}</strong>
        <p>${escapeHtml(host.preferredSurface === "web"
          ? t("workspace_launcher.remote_web_desc")
          : t("workspace_launcher.native_chat_desc"))}</p>
      </div>
      <div class="surface-switcher-meta">
        <span class="badge ${host.webBridgeRunning ? "badge-live" : ""}">${host.webBridgeRunning ? escapeHtml(t("workspace_launcher.bridge_ready")) : escapeHtml(t("workspace_launcher.bridge_warming"))}</span>
        <span class="badge">${escapeHtml(host.webWorkspaceURL || t("workspace_launcher.no_web_url"))}</span>
      </div>
      <div class="button-row">
        <button class="button primary small" type="button" onclick="openChatWorkspace()">${escapeHtml(t("chat.native_chat"))}</button>
        <button class="button secondary small" type="button" onclick="switchDesktopSurface('web')">${escapeHtml(t("chat.open_web_in_app"))}</button>
        <button class="button ghost small" type="button" onclick="openWebWorkspaceExternal()">${escapeHtml(t("actions.open_in_browser"))}</button>
        ${compact ? "" : `<button class="button ghost small" type="button" onclick="selectTab('settings')">${escapeHtml(t("workspace_launcher.configure_surfaces"))}</button>`}
      </div>
    </section>
  `;
}

function selectAgent(agentId) {
  state.onboarding.starterAgent = agentId;
  render();
}

function setDefaultAgent(agentId) {
  state.onboarding.starterAgent = agentId;
  savePreferences({
    successMessage: uiCopy("status.desktopDefaultAgentSet", { agentName: capitalize(agentId) }),
  });
}

function desktopDefaultAgentId() {
  return state.bootstrap?.starterAgent || state.onboarding.starterAgent || "main";
}

function activeChatAgentId() {
  return state.bootstrap?.activeSessionAgent || desktopDefaultAgentId();
}

function currentSessionId() {
  return state.sessionState?.sessionId || "";
}

function currentSessionPath() {
  return state.sessionState?.sessionFile || state.bootstrap?.currentSessionPath || "";
}

function payloadMatchesActiveSession(data) {
  if (!data || typeof data !== "object") {
    return true;
  }

  const activeSessionPath = currentSessionPath();
  const activeSessionId = currentSessionId();
  const payloadSessionPath = typeof data.sessionFile === "string" ? data.sessionFile : "";
  const payloadSessionId = typeof data.sessionId === "string" ? data.sessionId : "";

  if (activeSessionPath && payloadSessionPath && activeSessionPath !== payloadSessionPath) {
    return false;
  }
  if (activeSessionId && payloadSessionId && activeSessionId !== payloadSessionId) {
    return false;
  }
  return true;
}

function applyChatAgentProfile(agentId) {
  const sessionPath = currentSessionPath();
  if (!sessionPath) {
    state.onboarding.starterAgent = agentId;
    savePreferences({
      pendingMessage: uiCopy("status.noActiveThreadDefaulting", { agentName: capitalize(agentId) }),
      successMessage: uiCopy("status.desktopDefaultSet", { agentName: capitalize(agentId) }),
      switchToTab: "chat",
    });
    return;
  }

  appendLocalizedStatus("assigningThread", { agentName: capitalize(agentId) });
  hostRequest("setSessionAgentProfile", { agentId, sessionPath })
    .then((response) => {
      applyBootstrap(response.payload);
      appendLocalizedStatus("threadLaneUpdated", { agentName: capitalize(agentId) });
      state.activeTab = "chat";
      render();
    })
    .catch((error) => appendStatus(String(error), "error"));
}

function selectAgentProfileForEditing(agentId) {
  state.selectedAgentProfileId = agentId;
  render();
}

function updateAgentProfileField(field, value) {
  const draft = currentAgentProfileDraft();
  draft[field] = value;
  state.agentProfileDrafts[draft.id] = draft;
  render();
}

function toggleAgentSkill(skillName, enabled) {
  const draft = currentAgentProfileDraft();
  const next = new Set(draft.skills || []);
  if (enabled) {
    next.add(skillName);
  } else {
    next.delete(skillName);
  }
  draft.skills = Array.from(next).sort((a, b) => a.localeCompare(b));
  state.agentProfileDrafts[draft.id] = draft;
  render();
}

function resetAgentProfileDraft() {
  const live = availableAgentProfiles().find((agent) => agent.id === state.selectedAgentProfileId);
  if (!live) {
    return;
  }
  state.agentProfileDrafts[state.selectedAgentProfileId] = {
    id: live.id,
    displayName: live.displayName || live.id,
    description: live.description || "",
    modeId: live.modeId || "follow_main",
    provider: live.provider || "",
    model: live.model || "",
    skills: Array.isArray(live.skills) ? [...live.skills] : [],
    builtinSkills: Array.isArray(live.builtinSkills) ? [...live.builtinSkills] : [],
    prompts: Array.isArray(live.prompts) ? [...live.prompts] : [],
    skillScope: live.skillScope || "Global-only",
    hasCustomizations: Boolean(live.hasCustomizations),
  };
  render();
}

function saveAgentProfiles(options = {}) {
  appendStatus(options.pendingMessage || uiCopy("status.savingAgentProfiles"));
  return hostRequest("saveAgentProfiles", {
    profiles: Object.values(state.agentProfileDrafts).map((draft) => ({
      id: draft.id,
      displayName: draft.displayName,
      description: draft.description,
      modeId: draft.modeId,
      provider: draft.provider,
      model: draft.model,
      skills: draft.skills || [],
      prompts: draft.prompts || [],
    })),
  })
    .then((response) => {
      applyBootstrap(response.payload);
      appendStatus(options.successMessage || uiCopy("status.agentProfilesSaved"));
      render();
      return response;
    })
    .catch((error) => {
      appendStatus(String(error), "error");
      throw error;
    });
}

function syncResponsiveShell() {
  const shouldCollapse = globalThis.innerWidth < 1360;
  if (!state.sidebarManual && state.sidebarCollapsed !== shouldCollapse) {
    state.sidebarCollapsed = shouldCollapse;
    render();
  }
}

function toggleSidebar() {
  state.sidebarManual = true;
  state.sidebarCollapsed = !state.sidebarCollapsed;
  render();
}

function updateCommandQuery(value) {
  state.commandQuery = value;
  render();
}

function clearCommandQuery() {
  state.commandQuery = "";
  render();
}

function executeCommandSearch(event) {
  event.preventDefault();
  const term = state.commandQuery.trim().toLowerCase();
  if (!term) {
    return;
  }
  const tabs = resolvedTabMeta();
  for (const [id, meta] of Object.entries(tabs)) {
    if (meta.label.toLowerCase().includes(term) || meta.title.toLowerCase().includes(term)) {
      selectTab(id);
      clearCommandQuery();
      return;
    }
  }
  const visible = visibleTabIds();
  const fallback = visible.find((id) => id.toLowerCase().includes(term));
  if (fallback) {
    selectTab(fallback);
  }
  clearCommandQuery();
}

function applyPromptSuggestion(prompt) {
  const textarea = document.querySelector("#composer");
  if (!textarea) {
    return;
  }
  textarea.value = prompt;
  textarea.focus();
}

function availableProviders() {
  const set = new Set(providerPresets().map((preset) => preset.runtimeProviderId));
  for (const model of state.availableModels) {
    if (model?.provider) {
      set.add(model.provider);
    }
  }
  return Array.from(set);
}

function modelsForProvider(provider) {
  return state.availableModels.filter((model) => model.provider === provider);
}

function modelSuggestions(provider) {
  const liveModels = modelsForProvider(provider)
    .map((entry) => entry.id)
    .filter(Boolean);
  if (liveModels.length) {
    return liveModels;
  }
  const preset = providerPresets().find((entry) => entry.runtimeProviderId === provider || entry.id === provider)
    || providerPresetById(state.onboarding.providerPreset || provider);
  return state.bootstrap?.recommendedModels?.[provider] || preset.defaultModels || [];
}

function availableAgentProfiles() {
  return state.bootstrap?.agents || [];
}

function agentSummaryById(agentId) {
  return availableAgentProfiles().find((agent) => agent.id === agentId) || null;
}

function displayAgentName(agentId) {
  const agent = agentSummaryById(agentId);
  return agent?.displayName || capitalize(agentId || "main");
}

function skillOptionNames() {
  const set = new Set();
  for (const skill of skillsCatalog().skills || []) {
    if (skill?.name) {
      set.add(skill.name);
    }
  }
  for (const agent of availableAgentProfiles()) {
    for (const skill of agent.skills || []) {
      if (skill) {
        set.add(skill);
      }
    }
    for (const skill of agent.builtinSkills || []) {
      if (skill) {
        set.add(skill);
      }
    }
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

function currentAgentProfileDraft() {
  return state.agentProfileDrafts[state.selectedAgentProfileId] || blankAgentProfileDraft(state.selectedAgentProfileId);
}

function sanitizeChannelDrafts() {
  return state.channelDrafts.map((channel) => ({
    id: channel.id,
    platform: channel.platform,
    enabled: Boolean(channel.enabled),
    agentProfile: channel.agentProfile || "main",
    config: deepClone(channel.config || {}),
  }));
}

function updateChannelEnabled(channelId, enabled) {
  const target = state.channelDrafts.find((entry) => entry.id === channelId);
  if (!target) {
    return;
  }
  target.enabled = Boolean(enabled);
  render();
}

function updateChannelAgent(channelId, value) {
  const target = state.channelDrafts.find((entry) => entry.id === channelId);
  if (!target) {
    return;
  }
  target.agentProfile = value;
  render();
}

function updateChannelConfig(channelId, key, value, inputType = "text") {
  const target = state.channelDrafts.find((entry) => entry.id === channelId);
  if (!target) {
    return;
  }
  if (!target.config || typeof target.config !== "object") {
    target.config = {};
  }
  target.config[key] = inputType === "checkbox" ? Boolean(value) : value;
  render();
}

function saveChannels() {
  appendLocalizedStatus("savingChannelBindings");
  hostRequest("saveBindings", { bindings: sanitizeChannelDrafts() })
    .then((response) => {
      applyBootstrap(response.payload);
      appendLocalizedStatus("channelSettingsSaved");
      render();
    })
    .catch((error) => appendStatus(String(error), "error"));
}

function resetChannelDrafts() {
  hydrateDrafts(state.bootstrap || {});
  appendLocalizedStatus("channelReset");
  render();
}

function saveSkills() {
  appendLocalizedStatus("savingSkillSettings");
  hostRequest("saveSkillSettings", {
    enableSkillCommands: state.skillDraft.enableSkillCommands,
    globalSkillPaths: parseListInput(state.skillDraft.globalSkillPathsText),
    projectSkillPaths: parseListInput(state.skillDraft.projectSkillPathsText),
  })
    .then((response) => {
      applyBootstrap(response.payload);
      appendLocalizedStatus("skillSettingsSaved");
      render();
    })
    .catch((error) => appendStatus(String(error), "error"));
}

function updateSkillToggle(value) {
  state.skillDraft.enableSkillCommands = Boolean(value);
  render();
}

function updateSkillPaths(scope, value) {
  if (scope === "global") {
    state.skillDraft.globalSkillPathsText = value;
  } else {
    state.skillDraft.projectSkillPathsText = value;
  }
  render();
}

function updateSkillCatalogFilter(field, value) {
  state.skillCatalogFilter[field] = value;
  render();
}

function catalogWorkflowOptions() {
  return STARTER_CATALOG_WORKFLOWS;
}

function starterCatalogCategoryOptions() {
  const counts = new Map();
  for (const entry of curatedSkillCatalogEntries()) {
    for (const tag of entry.tags || []) {
      if (!tag || STARTER_CATALOG_SHARED_TAGS.has(tag)) {
        continue;
      }
      counts.set(tag, (counts.get(tag) || 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([id, count]) => ({ id, label: capitalize(id), count }));
}

function curatedSkillCatalogEntries() {
  return skillsCatalog().catalogEntries || [];
}

function catalogEntryInstalled(entry) {
  return Boolean(entry.installedGlobal || entry.installedProject);
}

function catalogEntryAttachedToCurrentAgent(entry) {
  const attachedSkills = new Set(currentAgentProfileDraft().skills || []);
  return (entry.skillNames || []).some((skillName) => attachedSkills.has(skillName));
}

function catalogEntryMatchesWorkflow(entry, workflowId) {
  if (!workflowId || workflowId === "all") {
    return true;
  }
  const workflow = catalogWorkflowOptions().find((item) => item.id === workflowId);
  if (!workflow) {
    return true;
  }
  return workflow.tags.some((tag) => (entry.tags || []).includes(tag));
}

function catalogEntryMatchesStatus(entry, status) {
  switch (status) {
    case "installable":
      return Boolean(entry.installable);
    case "installed":
      return catalogEntryInstalled(entry);
    case "not_installed":
      return !catalogEntryInstalled(entry);
    case "attached":
      return catalogEntryAttachedToCurrentAgent(entry);
    default:
      return true;
  }
}

function starterPackCoverageForAgent(entry, agentDraft = currentAgentProfileDraft()) {
  const selectedSkills = new Set(agentDraft.skills || []);
  const packSkills = Array.isArray(entry.skillNames) ? entry.skillNames.filter(Boolean) : [];
  const matched = packSkills.filter((skillName) => selectedSkills.has(skillName)).length;
  let status = "available";
  if (packSkills.length && matched === packSkills.length) {
    status = "attached";
  } else if (matched > 0) {
    status = "partial";
  }
  return {
    matched,
    total: packSkills.length,
    status,
  };
}

function agentStarterPackEntries(agentDraft = currentAgentProfileDraft()) {
  const rank = {
    attached: 0,
    partial: 1,
    available: 2,
  };
  return curatedSkillCatalogEntries()
    .map((entry) => ({
      ...entry,
      coverage: starterPackCoverageForAgent(entry, agentDraft),
    }))
    .filter((entry) => entry.coverage.total > 0)
    .sort((left, right) => {
      const rankDelta = (rank[left.coverage.status] ?? 9) - (rank[right.coverage.status] ?? 9);
      if (rankDelta !== 0) {
        return rankDelta;
      }
      return String(left.title || left.id).localeCompare(String(right.title || right.id));
    });
}

function starterPackCoverageBadge(status) {
  switch (status) {
    case "attached":
      return sourceBadgeClass("live");
    case "partial":
      return statusBadgeClass("manual_check");
    default:
      return sourceBadgeClass("seeded");
  }
}

function filteredCuratedSkillCatalogEntries() {
  const filter = state.skillCatalogFilter;
  const needle = String(filter.text || "").trim().toLowerCase();
  return curatedSkillCatalogEntries().filter((entry) => {
    if (filter.installableOnly && !entry.installable) {
      return false;
    }
    if (filter.category && filter.category !== "all" && !(entry.tags || []).includes(filter.category)) {
      return false;
    }
    if (!catalogEntryMatchesWorkflow(entry, filter.workflow)) {
      return false;
    }
    if (!catalogEntryMatchesStatus(entry, filter.status)) {
      return false;
    }
    if (!needle) {
      return true;
    }
    const tags = Array.isArray(entry.tags) ? entry.tags.join(" ") : "";
    const skills = Array.isArray(entry.skillNames) ? entry.skillNames.join(" ") : "";
    const haystack = `${entry.title || ""} ${entry.description || ""} ${tags} ${skills}`.toLowerCase();
    return haystack.includes(needle);
  });
}

function installCatalogSkill(catalogId, scope) {
  appendLocalizedStatus("installingCuratedSkillPack", { scope });
  hostRequest("installCatalogSkill", { catalogId, scope })
    .then((response) => {
      applyBootstrap(response.payload);
      appendLocalizedStatus("curatedSkillPackInstalled", { scope });
      render();
    })
    .catch((error) => appendStatus(String(error), "error"));
}

function attachSkillsToCurrentAgent(skillNames) {
  const normalized = Array.from(new Set((skillNames || []).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  if (!normalized.length) {
    return 0;
  }
  const draft = currentAgentProfileDraft();
  const next = new Set(draft.skills || []);
  const before = next.size;
  for (const skillName of normalized) {
    next.add(skillName);
  }
  draft.skills = Array.from(next).sort((a, b) => a.localeCompare(b));
  state.agentProfileDrafts[draft.id] = draft;
  return next.size - before;
}

function attachCatalogSkillToCurrentAgent(catalogId) {
  const entry = curatedSkillCatalogEntries().find((item) => item.id === catalogId);
  if (!entry) {
    appendLocalizedStatus("starterPackMissing", {}, "error");
    return;
  }
  const skillNames = Array.isArray(entry.skillNames) ? entry.skillNames.filter(Boolean) : [];
  if (!skillNames.length) {
    appendLocalizedStatus("noDiscoverableSkills", { entry: entry.title || entry.id }, "error");
    return;
  }

  const currentAgent = currentAgentProfileDraft();
  const currentAgentName = currentAgent.displayName || capitalize(currentAgent.id || "main");
  const persistAttachment = () => {
    const added = attachSkillsToCurrentAgent(skillNames);
    if (!added) {
      appendLocalizedStatus("starterPackAlreadyAttached", { entry: entry.title || entry.id, agentName: currentAgentName });
      render();
      return Promise.resolve();
    }
    return saveAgentProfiles({
      pendingMessage: uiCopy("status.attachingPack", { entry: entry.title || entry.id, agentName: currentAgentName }),
      successMessage: uiCopy("status.packAttached", { entry: entry.title || entry.id, agentName: currentAgentName }),
    });
  };

  if (catalogEntryInstalled(entry)) {
    persistAttachment();
    return;
  }

  const installScope = state.bootstrap?.workspacePath ? "project" : "global";
  appendLocalizedStatus("installingAndAttachingPack", {
    entry: entry.title || entry.id,
    scope: installScope,
    agentName: currentAgentName,
  });
  hostRequest("installCatalogSkill", { catalogId, scope: installScope })
    .then((response) => {
      applyBootstrap(response.payload);
      render();
      return persistAttachment();
    })
    .catch((error) => appendStatus(String(error), "error"));
}

function automationDraftFromEntry(entry) {
  const action = entry.action || {};
  return {
    id: entry.id || "",
    name: entry.name || "",
    description: entry.description || "",
    cron: entry.cron || "0 9 * * *",
    actionType: entry.actionType || "run_task",
    promptTemplate: action.prompt_template || "",
    destination: action.destination || "",
    format: action.format || "json",
    bindingId: action.binding_id || "",
    template: action.template || "",
    url: action.url || "",
    enabled: entry.enabled !== false,
  };
}

function newAutomationDraft() {
  state.automationDraft = blankAutomationDraft();
  render();
}

function editAutomation(automationId) {
  const entry = automationState().automations.find((item) => item.id === automationId);
  if (!entry) {
    return;
  }
  state.automationDraft = automationDraftFromEntry(entry);
  render();
}

function updateAutomationField(field, value) {
  state.automationDraft[field] = value;
  render();
}

function saveAutomation() {
  const draft = state.automationDraft;
  appendLocalizedStatus(draft.id ? "updatingAutomation" : "creatingAutomation");
  hostRequest("saveAutomation", {
    id: draft.id || undefined,
    name: draft.name,
    description: draft.description || undefined,
    cron: draft.cron,
    enabled: draft.enabled,
    actionType: draft.actionType,
    promptTemplate: draft.promptTemplate,
    destination: draft.destination,
    format: draft.format,
    bindingId: draft.bindingId,
    template: draft.template,
    url: draft.url,
  })
    .then((response) => {
      applyBootstrap(response.payload);
      appendLocalizedStatus("automationSaved");
      const created = automationState().automations.find((entry) => {
        if (draft.id) {
          return entry.id === draft.id;
        }
        return entry.name === draft.name && entry.cron === draft.cron && entry.actionType === draft.actionType;
      });
      state.automationDraft = created ? automationDraftFromEntry(created) : blankAutomationDraft();
      render();
    })
    .catch((error) => appendStatus(String(error), "error"));
}

function deleteAutomation(automationId) {
  appendLocalizedStatus("deletingAutomation");
  hostRequest("deleteAutomation", { id: automationId })
    .then((response) => {
      applyBootstrap(response.payload);
      if (state.automationDraft.id === automationId) {
        state.automationDraft = blankAutomationDraft();
      }
      appendLocalizedStatus("automationDeleted");
      render();
    })
    .catch((error) => appendStatus(String(error), "error"));
}

function toggleAutomation(automationId, enabled) {
  appendLocalizedStatus(enabled ? "enablingAutomation" : "disablingAutomation");
  hostRequest("toggleAutomation", { id: automationId, enabled })
    .then((response) => {
      applyBootstrap(response.payload);
      if (state.automationDraft.id === automationId) {
        const updated = automationState().automations.find((entry) => entry.id === automationId);
        if (updated) {
          state.automationDraft = automationDraftFromEntry(updated);
        }
      }
      appendLocalizedStatus("automationStateUpdated");
      render();
    })
    .catch((error) => appendStatus(String(error), "error"));
}

function updateSecurityField(field, value) {
  state.securityDraft[field] = value;
  render();
}

function saveSecuritySettings() {
  appendLocalizedStatus("savingSecurityPolicy");
  hostRequest("saveSecuritySettings", state.securityDraft)
    .then((response) => {
      applyBootstrap(response.payload);
      appendLocalizedStatus("securityPolicySaved");
      render();
    })
    .catch((error) => appendStatus(String(error), "error"));
}

function applySecurityPreset(presetId) {
  const preset = SECURITY_PRESETS[presetId];
  if (!preset) {
    return;
  }
  const localizedPreset = localizedSecurityPreset(presetId, preset);
  state.securityDraft = {
    ...state.securityDraft,
    machinePreset: presetId,
    profile: preset.profile,
    defaultPermissive: preset.defaultPermissive,
    allowDangerous: preset.allowDangerous,
    destructiveExecPolicy: preset.destructiveExecPolicy,
    sandboxMode: preset.sandboxMode,
    gatewayMode: preset.gatewayMode,
    browserAutomation: preset.browserAutomation,
    conflictGuard: preset.conflictGuard,
    gatewayURL: preset.gatewayMode === "direct" ? "" : state.securityDraft.gatewayURL,
  };
  appendLocalizedStatus("securityPresetApplied", { preset: localizedPreset.label });
  render();
}

function pickScopedDirectory() {
  appendLocalizedStatus("selectingApprovedDirectory");
  hostRequest("pickScopedDirectory")
    .then((response) => {
      applyBootstrap(response.payload);
      appendLocalizedStatus("approvedDirectoryAdded");
      render();
    })
    .catch((error) => appendStatus(String(error), "error"));
}

function removeScopedDirectory(path) {
  appendLocalizedStatus("removingApprovedDirectory");
  hostRequest("removeScopedDirectory", { path })
    .then((response) => {
      applyBootstrap(response.payload);
      appendLocalizedStatus("approvedDirectoryRemoved");
      render();
    })
    .catch((error) => appendStatus(String(error), "error"));
}

function updatePermissionDraft(field, value) {
  state.permissionDraft[field] = value;
  render();
}

function applyPermissionDecision() {
  const extensionId = state.permissionDraft.extensionId.trim();
  const capability = state.permissionDraft.capability.trim();
  if (!extensionId || !capability) {
    appendLocalizedStatus("extensionCapabilityRequired", {}, "error");
    return;
  }
  appendLocalizedStatus("savingCapabilityDecision");
  hostRequest("setPermissionDecision", {
    extensionId,
    capability,
    allow: Boolean(state.permissionDraft.allow),
  })
    .then((response) => {
      applyBootstrap(response.payload);
      state.permissionDraft = blankPermissionDraft();
      appendLocalizedStatus("capabilityDecisionSaved");
      render();
    })
    .catch((error) => appendStatus(String(error), "error"));
}

function removePermissionExtension(extensionId) {
  appendLocalizedStatus("removingSavedDecisions");
  hostRequest("removePermissionExtension", { extensionId })
    .then((response) => {
      applyBootstrap(response.payload);
      appendLocalizedStatus("savedDecisionsRemoved");
      render();
    })
    .catch((error) => appendStatus(String(error), "error"));
}

function resetPermissionDecisions() {
  appendLocalizedStatus("resettingSavedDecisions");
  hostRequest("resetPermissionDecisions")
    .then((response) => {
      applyBootstrap(response.payload);
      appendLocalizedStatus("allSavedDecisionsRemoved");
      render();
    })
    .catch((error) => appendStatus(String(error), "error"));
}

function requestSystemPermission(permissionId) {
  appendLocalizedStatus("requestingPermission", { permission: permissionLabel(permissionId) });
  hostRequest("requestSystemPermission", { permissionId })
    .then((response) => {
      applyBootstrap(response.payload);
      appendLocalizedStatus("permissionRequestSent", { permission: permissionLabel(permissionId) });
      render();
    })
    .catch((error) => appendStatus(String(error), "error"));
}

function openPrivacySettings(permissionId) {
  hostRequest("openPrivacySettings", { permissionId })
    .then((response) => {
      if (response.payload) {
        applyBootstrap(response.payload);
      }
      appendLocalizedStatus("openedPrivacySettings", { permission: permissionLabel(permissionId) });
    })
    .catch((error) => appendStatus(String(error), "error"));
}

function openDesktopLog() {
  hostRequest("openDesktopLog")
    .then(() => appendLocalizedStatus("openedDesktopLog"))
    .catch((error) => appendStatus(String(error), "error"));
}

function exportDiagnosticsReport() {
  appendLocalizedStatus("exportingDiagnosticsReport");
  hostRequest("exportDiagnosticsReport")
    .then((response) => {
      if (response.payload?.bootstrap) {
        applyBootstrap(response.payload.bootstrap);
      }
      appendLocalizedStatus("diagnosticsReportExported", {
        path: response.payload?.path || uiCopy("common.selectedPath"),
      });
      render();
    })
    .catch((error) => appendStatus(String(error), "error"));
}

function prepareSupportReport() {
  appendLocalizedStatus("preparingSupportBundle");
  hostRequest("prepareSupportReport")
    .then((response) => {
      if (response.payload?.bootstrap) {
        applyBootstrap(response.payload.bootstrap);
      }
      appendLocalizedStatus("supportBundlePrepared", {
        path: response.payload?.path || uiCopy("common.diagnosticsFolder"),
      });
      render();
    })
    .catch((error) => appendStatus(String(error), "error"));
}

function updateDiagnosticsFilter(field, value) {
  state.diagnosticsFilter[field] = value;
  render();
}

function desktopDataSources() {
  if (currentLocale() === "zh-CN") {
    return [
      {
        label: "对话流与回复",
        status: "live",
        detail: "来自打包的 Pi RPC 后端，通过实时流事件和快照请求驱动。",
      },
      {
        label: "当前模型与会话统计",
        status: "live",
        detail: "来自 get_state、get_available_models 和 get_session_stats。",
      },
      {
        label: "模型默认值与自定义 provider 路由",
        status: "live",
        detail: "来自桌面设置、auth.json 和 models.json，自定义端点与预设走的是同一条运行时路径。",
      },
      {
        label: "会话库",
        status: "live",
        detail: "从 Application Support 中桌面管理的会话目录扫描得到。",
      },
      {
        label: "渠道",
        status: "live",
        detail: "配置会持久化到工作区 `.pi/settings.json`。不同平台的运行时覆盖范围会在每个渠道上明确标注。",
      },
      {
        label: "技能",
        status: "live",
        detail: "技能发现由文件系统驱动，来源包括全局与项目技能根目录，以及额外配置路径。",
      },
      {
        label: "自动化",
        status: "live",
        detail: "定义从工作区 `.pi/automations/{system_id}` 加载，并直接在这个 UI 中编辑。",
      },
      {
        label: "扩展安全决策",
        status: "live",
        detail: "能力审批会持久化到权限存储，并立即反映到桌面界面。",
      },
      {
        label: "版本更新",
        status: "live",
        detail: "来自桌面客户端主动触发的 GitHub 发布检查，最新结果会缓存在本地。",
      },
      {
        label: "代理配置",
        status: "live",
        detail: "桌面代理默认值来自内置配置，再叠加 settings.json 中持久化的 agentProfiles 覆盖项。",
      },
    ];
  }
  if (currentLocale() === "ja-JP") {
    return [
      {
        label: "会話ストリームと返信",
        status: "live",
        detail: "同梱 Pi RPC バックエンドのライブストリームイベントとスナップショット要求から取得されます。",
      },
      {
        label: "現在のモデルとセッション統計",
        status: "live",
        detail: "get_state、get_available_models、get_session_stats から取得されます。",
      },
      {
        label: "モデル既定値とカスタム provider ルーティング",
        status: "live",
        detail: "デスクトップ設定、auth.json、models.json 由来で、カスタムエンドポイントとプリセットは同じランタイム経路を使います。",
      },
      {
        label: "セッションライブラリ",
        status: "live",
        detail: "Application Support 内のデスクトップ管理セッションディレクトリを走査して取得します。",
      },
      {
        label: "チャネル",
        status: "live",
        detail: "設定はワークスペース `.pi/settings.json` に保存されます。ランタイム対応範囲はチャネルごとに明示されます。",
      },
      {
        label: "スキル",
        status: "live",
        detail: "探索はファイルシステム由来で、グローバル/プロジェクトのスキルルートと追加パスから読み込みます。",
      },
      {
        label: "自動化",
        status: "live",
        detail: "定義はワークスペース `.pi/automations/{system_id}` から読み込み、この UI から直接編集します。",
      },
      {
        label: "拡張セキュリティ決定",
        status: "live",
        detail: "能力承認は権限ストアへ保存され、デスクトップ画面へ即時反映されます。",
      },
      {
        label: "バージョン更新",
        status: "live",
        detail: "デスクトップクライアントが明示的に実行した GitHub リリース確認から取得され、結果はローカルにキャッシュされます。",
      },
      {
        label: "エージェントプロファイル",
        status: "live",
        detail: "デスクトップ既定値は同梱プロファイルと settings.json に保存された agentProfiles 上書きから構成されます。",
      },
    ];
  }
  return [
    {
      label: "Conversation stream and replies",
      status: "live",
      detail: "Comes from the bundled Pi RPC backend through live streaming events and snapshot requests.",
    },
    {
      label: "Current model and session stats",
      status: "live",
      detail: "Comes from get_state, get_available_models, and get_session_stats.",
    },
    {
      label: "Model defaults and custom provider routing",
      status: "live",
      detail: "Comes from desktop settings, auth.json, and models.json so custom endpoints and presets stay on the same runtime path.",
    },
    {
      label: "Session library",
      status: "live",
      detail: "Scanned from the desktop-managed sessions directory in Application Support.",
    },
    {
      label: "Channels",
      status: "live",
      detail: "Configuration is persisted in the workspace .pi/settings.json. Runtime support varies by platform and is labeled per channel.",
    },
    {
      label: "Skills",
      status: "live",
      detail: "Discovery is filesystem-backed from global and project skill roots plus configured extra paths.",
    },
    {
      label: "Automations",
      status: "live",
      detail: "Definitions are loaded from workspace .pi/automations/{system_id} and edited directly from this UI.",
    },
    {
      label: "Extension security decisions",
      status: "live",
      detail: "Capability approvals are persisted in the permissions store and reflected immediately in the desktop surface.",
    },
    {
      label: "Version updates",
      status: "live",
      detail: "Comes from explicit GitHub release checks initiated in the desktop client, with the latest result cached locally.",
    },
    {
      label: "Agent profiles",
      status: "live",
      detail: "Desktop agent defaults come from shipped profiles plus persisted agentProfiles overrides in settings.json.",
    },
  ];
}

function interactionAuditRows() {
  if (currentLocale() === "zh-CN") {
    return [
      {
        surface: "聊天",
        mode: "Actionable",
        detail: "发送提示词、切换实时模型、重命名/导出/打开当前会话、开启新对话，并把当前线程分配给内置代理分工。",
        truth: "使用实时运行时/会话状态，以及桌面持久化的会话级分工绑定。",
      },
      {
        surface: "会话",
        mode: "Actionable",
        detail: "恢复已发现的会话，并打开隔离的会话目录。",
        truth: "文件系统驱动。",
      },
      {
        surface: "代理",
        mode: "Actionable",
        detail: "设置默认配置、定制每个代理的技能包，并可为单个代理覆盖 provider/model 姿态。",
        truth: "由全局设置中的 starterAgent 和 agentProfiles 驱动；聊天页可把单个会话绑定到这些配置之一，而不改动桌面默认值。",
      },
      {
        surface: "渠道",
        mode: "Actionable",
        detail: "启用或停用绑定、选择路由配置，并为每个渠道保存真实的凭证/配置值。",
        truth: "由项目配置驱动；运行时覆盖范围会被明确标注。",
      },
      {
        surface: "技能",
        mode: "Actionable",
        detail: "切换技能命令、增加搜索路径，并检查已发现技能及其来源。",
        truth: "文件系统发现加持久化设置。",
      },
      {
        surface: "自动化",
        mode: "Actionable",
        detail: "为当前系统创建、编辑、启用、停用和删除基于 cron 的自动化。",
        truth: "由 JSON 文件支持的工作区自动化注册表。",
      },
      {
        surface: "安全",
        mode: "Actionable",
        detail: "调整扩展策略、管理执行审批，并请求 macOS 权限。",
        truth: "全局配置、权限存储和 OS 状态 API。",
      },
      {
        surface: "设置",
        mode: "Actionable",
        detail: "选择 provider 预设、设置 API URL、保存 key、管理自定义模型，并触发版本检查或安装包下载。",
        truth: "桌面设置 + auth.json + models.json + GitHub 发布检查。",
      },
    ];
  }
  if (currentLocale() === "ja-JP") {
    return [
      {
        surface: "チャット",
        mode: "Actionable",
        detail: "プロンプト送信、ライブモデル切替、現在のセッション名変更/書き出し/表示、新規会話開始、同梱エージェントレーンの現在スレッドへの割り当てができます。",
        truth: "ライブなランタイム/セッション状態と、デスクトップに保存されたセッション単位レーン割り当てを使います。",
      },
      {
        surface: "セッション",
        mode: "Actionable",
        detail: "検出済みセッションを再開し、隔離されたセッションディレクトリを開けます。",
        truth: "ファイルシステム由来です。",
      },
      {
        surface: "エージェント",
        mode: "Actionable",
        detail: "既定プロファイル設定、エージェント別スキル束の調整、個別エージェント向け provider/model 上書きができます。",
        truth: "グローバル設定の starterAgent と agentProfiles に支えられます。チャット面では、デスクトップ既定値を変えずにセッションをそのプロファイルへ結び付けられます。",
      },
      {
        surface: "チャネル",
        mode: "Actionable",
        detail: "バインディングの有効/無効、ルーティングプロファイル選択、チャネルごとの実際の資格情報/設定値保存ができます。",
        truth: "プロジェクト設定由来で、ランタイム対応範囲は明示表示されます。",
      },
      {
        surface: "スキル",
        mode: "Actionable",
        detail: "スキルコマンド切替、検索パス追加、発見済みスキルとその出所の確認ができます。",
        truth: "ファイルシステム探索と永続設定に基づきます。",
      },
      {
        surface: "自動化",
        mode: "Actionable",
        detail: "現在のシステム向けに cron 駆動の自動化を作成、編集、有効化、無効化、削除できます。",
        truth: "JSON ファイルに支えられたワークスペース自動化レジストリです。",
      },
      {
        surface: "セキュリティ",
        mode: "Actionable",
        detail: "拡張ポリシー調整、exec 承認管理、macOS 権限要求ができます。",
        truth: "グローバル設定、権限ストア、OS 状態 API に基づきます。",
      },
      {
        surface: "設定",
        mode: "Actionable",
        detail: "provider プリセット選択、API URL 設定、key 保存、カスタムモデル管理、更新確認やインストーラ取得ができます。",
        truth: "デスクトップ設定 + auth.json + models.json + GitHub リリース確認です。",
      },
    ];
  }
  return [
    {
      surface: "Chat",
      mode: "Actionable",
      detail: "Send prompts, switch the live model, rename/export/open the active session, start a new conversation, and assign a shipped agent lane to the current thread.",
      truth: "Uses live runtime/session state plus desktop-persisted per-session lane assignment.",
    },
    {
      surface: "Sessions",
      mode: "Actionable",
      detail: "Resume discovered sessions and open the isolated sessions directory.",
      truth: "Filesystem-backed.",
    },
    {
      surface: "Agents",
      mode: "Actionable",
      detail: "Set the default profile, customize per-agent skill bundles, and optionally override provider/model posture for individual agents.",
      truth: "Global settings-backed via starterAgent and agentProfiles; chat can bind a session to one of those profiles without changing the desktop default.",
    },
    {
      surface: "Channels",
      mode: "Actionable",
      detail: "Enable or disable bindings, choose the routing profile, and save real credential/config values per channel.",
      truth: "Project-config-backed; runtime coverage is explicitly labeled.",
    },
    {
      surface: "Skills",
      mode: "Actionable",
      detail: "Toggle skill commands, add search paths, and inspect discovered skills and their sources.",
      truth: "Filesystem-backed discovery and persisted settings.",
    },
    {
      surface: "Automations",
      mode: "Actionable",
      detail: "Create, edit, enable, disable, and remove cron-driven automations for the active system.",
      truth: "Workspace automation registry backed by JSON files.",
    },
    {
      surface: "Security",
      mode: "Actionable",
      detail: "Adjust extension policy, manage exec approvals, and request macOS permissions.",
      truth: "Global config, permissions store, and OS status APIs.",
    },
    {
      surface: "Settings",
      mode: "Actionable",
      detail: "Choose provider presets, set API URLs, save keys, manage custom models, and trigger release checks or installer downloads.",
      truth: "Desktop settings + auth.json + models.json + GitHub release checks.",
    },
  ];
}

function productReadinessRows() {
  if (currentLocale() === "zh-CN") {
    return [
      {
        area: "桌面对话、会话与模型配置",
        status: "live",
        label: "生产可用",
        detail: "本地桌面对话循环、会话库、provider/API key 配置、自定义 API URL、模型选择和更新检查都已接入真实运行时状态。",
      },
      {
        area: "技能与自动化管理",
        status: "live",
        label: "生产可用",
        detail: "技能发现、技能路径管理、命令开关以及基于计划的自动化编辑都已启用，并通过真实文件系统状态持久化。",
      },
      {
        area: "权限中心与诊断",
        status: "live",
        label: "接近完整",
        detail: "扩展策略、已保存审批、macOS 权限请求、原始日志和诊断导出都已可用。桌面端也明确标出了哪些控制是立即生效的。",
      },
      {
        area: "破坏性执行、沙盒范围与网关路由",
        status: "scaffold",
        label: "部分完成",
        detail: "这些控制现在已经形成一致的桌面策略并会被持久化，但更深层的后端执行与中介链路仍需继续接线。",
      },
      {
        area: "跨平台渠道运行时一致性",
        status: "scaffold",
        label: "部分完成",
        detail: "渠道配置已经存在并可保存，但部分平台特定的回复路径仍停留在脚手架阶段，尚未形成完整的端到端生产集成。",
      },
    ];
  }
  if (currentLocale() === "ja-JP") {
    return [
      {
        area: "デスクトップチャット、セッション、モデル設定",
        status: "live",
        label: "本番レベル",
        detail: "ローカル会話ループ、セッションライブラリ、provider/API key 設定、カスタム API URL、モデル選択、更新確認はすべて実ランタイム状態へ接続済みです。",
      },
      {
        area: "スキルと自動化の管理",
        status: "live",
        label: "本番レベル",
        detail: "スキル探索、スキルパス管理、コマンド切替、スケジュール型自動化編集は実ファイルシステム状態を通じて動作し、保存されます。",
      },
      {
        area: "権限センターと診断",
        status: "live",
        label: "かなり完成",
        detail: "拡張ポリシー、保存済み承認、macOS 権限要求、生ログ、診断エクスポートはすでに有効です。どれが即時に効くかも明示しています。",
      },
      {
        area: "破壊的実行、サンドボックス範囲、ゲートウェイルーティング",
        status: "scaffold",
        label: "部分実装",
        detail: "これらの制御は一貫したデスクトップ方針として存在し保存されますが、より深いバックエンド実行と仲介経路の実装はまだ必要です。",
      },
      {
        area: "チャネルのクロスプラットフォーム実行時整合性",
        status: "scaffold",
        label: "部分実装",
        detail: "チャネル設定は存在し保存されますが、一部プラットフォーム特有の返信経路はまだ脚手架段階で、完全な本番 E2E 統合ではありません。",
      },
    ];
  }
  return [
    {
      area: "Desktop chat, sessions, and model configuration",
      status: "live",
      label: "Production-ready",
      detail: "The local desktop conversation loop, session library, provider/API key setup, custom API URL, model selection, and update checks are all wired to live runtime state.",
    },
    {
      area: "Skills and automation management",
      status: "live",
      label: "Production-ready",
      detail: "Skill discovery, skill path management, command toggles, and schedule-based automation editing are active and persisted through real filesystem-backed state.",
    },
    {
      area: "Permission center and diagnostics",
      status: "live",
      label: "Mostly complete",
      detail: "Extension policy, saved approvals, macOS permission requests, raw logs, and diagnostics export are live now. The desktop also clearly labels what is enforced immediately.",
    },
    {
      area: "Destructive exec, sandbox scope, and gateway routing",
      status: "scaffold",
      label: "Partial",
      detail: "These controls now exist as coherent desktop policy and are persisted, but full backend enforcement still needs to be wired into runtime execution and mediation paths.",
    },
    {
      area: "Channel runtime parity across platforms",
      status: "scaffold",
      label: "Partial",
      detail: "Channel configuration is present and saved, but some platform-specific reply paths are still scaffolded rather than complete end-to-end production integrations.",
    },
  ];
}

function sourceBadgeClass(status) {
  switch (status) {
    case "live":
      return "source-live";
    case "seeded":
      return "source-seeded";
    case "scaffold":
      return "source-scaffold";
    default:
      return "";
  }
}

function actionBadgeClass(mode) {
  switch ((mode || "").toLowerCase()) {
    case "actionable":
      return "mode-actionable";
    case "view only":
      return "mode-view";
    case "mixed":
      return "mode-mixed";
    default:
      return "";
  }
}

function actionModeLabel(mode) {
  switch ((mode || "").toLowerCase()) {
    case "view only":
      return t("common.view_only");
    case "actionable":
      return t("common.actionable");
    case "mixed":
      return currentLocale() === "zh-CN" ? "混合" : currentLocale() === "ja-JP" ? "混合" : "Mixed";
    default:
      return mode || "";
  }
}

function sourceStatusLabel(status) {
  switch ((status || "").toLowerCase()) {
    case "live":
      return t("common.live");
    case "seeded":
      return currentLocale() === "zh-CN" ? "内置" : currentLocale() === "ja-JP" ? "同梱" : "Seeded";
    case "scaffold":
      return currentLocale() === "zh-CN" ? "脚手架" : currentLocale() === "ja-JP" ? "スキャフォールド" : "Scaffold";
    default:
      return status || "";
  }
}

function statusBadgeClass(status) {
  switch ((status || "").toLowerCase()) {
    case "ready":
    case "configured":
    case "connected":
    case "granted":
    case "enabled":
    case "succeeded":
      return "status-good";
    case "send_only":
    case "partial":
    case "manual_check":
    case "not_determined":
    case "unknown":
      return "status-neutral";
    case "needs_setup":
    case "missing_credentials":
    case "disabled":
      return "status-warn";
    case "denied":
    case "restricted":
    case "needs_manual_grant":
    case "failed":
      return "status-bad";
    default:
      return "";
  }
}

function humanChannelStatus(status) {
  const locale = currentLocale();
  switch (status) {
    case "ready":
      return locale === "zh-CN" ? "就绪" : locale === "ja-JP" ? "準備完了" : "Ready";
    case "send_only":
      return locale === "zh-CN" ? "仅发送" : locale === "ja-JP" ? "送信専用" : "Send Only";
    case "partial":
      return locale === "zh-CN" ? "部分可用" : locale === "ja-JP" ? "部分対応" : "Partial";
    case "needs_setup":
      return locale === "zh-CN" ? "待配置" : locale === "ja-JP" ? "要設定" : "Needs Setup";
    case "disabled":
      return locale === "zh-CN" ? "已关闭" : locale === "ja-JP" ? "無効" : "Disabled";
    default:
      return capitalize(status || "unknown");
  }
}

function humanPermissionStatus(status) {
  const locale = currentLocale();
  switch (status) {
    case "granted":
      return locale === "zh-CN" ? "已授权" : locale === "ja-JP" ? "許可済み" : "Granted";
    case "denied":
      return locale === "zh-CN" ? "已拒绝" : locale === "ja-JP" ? "拒否済み" : "Denied";
    case "not_determined":
      return locale === "zh-CN" ? "未请求" : locale === "ja-JP" ? "未要求" : "Not Requested";
    case "needs_manual_grant":
      return locale === "zh-CN" ? "需要手动授权" : locale === "ja-JP" ? "手動許可が必要" : "Needs Manual Grant";
    case "manual_check":
      return locale === "zh-CN" ? "需要手动检查" : locale === "ja-JP" ? "手動確認" : "Manual Check";
    case "restricted":
      return locale === "zh-CN" ? "受限" : locale === "ja-JP" ? "制限あり" : "Restricted";
    case "unsupported":
      return locale === "zh-CN" ? "不支持" : locale === "ja-JP" ? "非対応" : "Unsupported";
    default:
      return capitalize(status || "unknown");
  }
}

function permissionLabel(permissionId) {
  return systemPermissions().find((entry) => entry.id === permissionId)?.name || permissionId;
}

function permissionNeedsAttention(permission) {
  return ["denied", "not_determined", "needs_manual_grant", "manual_check"].includes(permission?.status);
}

function permissionRecoveryNote(permission) {
  const locale = currentLocale();
  switch (permission?.status) {
    case "granted":
      return locale === "zh-CN"
        ? "这个能力路径已经可用。"
        : locale === "ja-JP"
          ? "この機能経路は利用可能です。"
          : "Ready for this capability path.";
    case "not_determined":
      return permission.canRequest
        ? (locale === "zh-CN"
          ? "先在 maoclaw 中发起请求，再去 macOS 设置里确认授权已生效。"
          : locale === "ja-JP"
            ? "まず maoclaw から要求し、その後 macOS 設定で許可が反映されたか確認してください。"
            : "Request from maoclaw first, then verify the grant landed in macOS settings.")
        : (locale === "zh-CN"
          ? "打开 macOS 设置并手动授予这个权限。"
          : locale === "ja-JP"
            ? "macOS 設定を開き、この権限を手動で許可してください。"
            : "Open macOS settings and grant this permission manually.");
    case "denied":
      return locale === "zh-CN"
        ? "macOS 已经拒绝了这个能力。请打开对应的隐私面板并在那里重新授权。"
        : locale === "ja-JP"
          ? "macOS がこの機能を拒否しています。対応するプライバシーパネルを開いて許可してください。"
          : "macOS already denied this capability. Open the matching privacy pane and grant access there.";
    case "needs_manual_grant":
      return locale === "zh-CN"
        ? "相关工作流要生效，必须先在系统设置中手动授权这个权限。"
        : locale === "ja-JP"
          ? "関連ワークフローを使う前に、System Settings でこの権限を手動許可する必要があります。"
          : "This permission requires a manual macOS grant in System Settings before the related workflow can work.";
    case "manual_check":
      return locale === "zh-CN"
        ? "macOS 在这里不会给出可靠的一次性结果。请打开隐私面板确认后再重新检查。"
        : locale === "ja-JP"
          ? "macOS はここで信頼できる単発結果を返しません。プライバシーパネルで確認してから再チェックしてください。"
          : "macOS does not expose a reliable one-shot result here. Open the privacy pane, confirm it, then recheck.";
    case "restricted":
      return locale === "zh-CN"
        ? "这个权限受到设备策略或系统限制。"
        : locale === "ja-JP"
          ? "この権限はデバイスポリシーまたは OS 制限により制約されています。"
          : "This permission is restricted by device policy or OS limits.";
    case "unsupported":
      return locale === "zh-CN"
        ? "当前 macOS 版本不支持这个能力。"
        : locale === "ja-JP"
          ? "現在の macOS バージョンではこの機能はサポートされていません。"
          : "This capability is not supported on the current macOS version.";
    default:
      return locale === "zh-CN"
        ? "检查对应的隐私面板，然后刷新状态。"
        : locale === "ja-JP"
          ? "対応するプライバシーパネルを確認し、その後ステータスを更新してください。"
          : "Check the matching privacy pane, then refresh status.";
  }
}

function destructiveExecPolicyLabel(policy) {
  const locale = currentLocale();
  switch (policy) {
    case "allow_all":
      return locale === "zh-CN" ? "允许所有执行" : locale === "ja-JP" ? "すべての実行を許可" : "Allow all exec";
    case "deny_destructive":
      return locale === "zh-CN" ? "阻止破坏性命令" : locale === "ja-JP" ? "破壊的実行をブロック" : "Block destructive";
    default:
      return locale === "zh-CN" ? "敏感执行需确认" : locale === "ja-JP" ? "高リスク実行は確認" : "Confirm sensitive exec";
  }
}

function sandboxModeLabel(mode) {
  const locale = currentLocale();
  switch (mode) {
    case "full_access":
      return locale === "zh-CN" ? "完整磁盘与命令权限" : locale === "ja-JP" ? "フルディスクとコマンド権限" : "Full disk and command access";
    case "selected_directories":
      return locale === "zh-CN" ? "工作区加已批准目录" : locale === "ja-JP" ? "ワークスペース + 承認済みディレクトリ" : "Workspace plus approved directories";
    default:
      return locale === "zh-CN" ? "仅工作区写权限" : locale === "ja-JP" ? "ワークスペース限定書き込み" : "Workspace-only write scope";
  }
}

function gatewayModeLabel(mode) {
  const locale = currentLocale();
  switch (mode) {
    case "sandbox_gateway":
      return locale === "zh-CN" ? "沙盒网关" : locale === "ja-JP" ? "サンドボックスゲートウェイ" : "Sandbox gateway";
    case "custom_gateway":
      return locale === "zh-CN" ? "自定义网关" : locale === "ja-JP" ? "カスタムゲートウェイ" : "Custom gateway";
    default:
      return locale === "zh-CN" ? "本地运行时直连" : locale === "ja-JP" ? "ローカルランタイム直結" : "Direct local runtime";
  }
}

function diagnosticEntries() {
  return diagnosticsState().entries || [];
}

function parseDiagnosticLine(rawLine) {
  const line = String(rawLine || "");
  const match = line.match(/^\[([^\]]+)\]\s*(.*)$/);
  const timestamp = match ? match[1] : new Date().toISOString();
  const message = match ? match[2] : line;
  const lower = message.toLowerCase();
  let level = "info";
  if (lower.includes("failed") || lower.includes("error") || lower.includes("denied") || lower.includes("unsupported")) {
    level = "error";
  } else if (lower.includes("warning") || lower.includes("warn") || lower.includes("manual_check")) {
    level = "warn";
  }
  let category = "general";
  if (/(permission|accessibility|screen recording|microphone|camera|location)/.test(lower)) {
    category = "permissions";
  } else if (/(backend|rpc|session)/.test(lower)) {
    category = "runtime";
  } else if (/(gateway|proxy|sandbox)/.test(lower)) {
    category = "gateway";
  } else if (/(telegram|qq|feishu|binding)/.test(lower)) {
    category = "channels";
  } else if (/(update|release|installer)/.test(lower)) {
    category = "updates";
  } else if (/(file|directory|path)/.test(lower)) {
    category = "filesystem";
  }
  let source = "desktop";
  if (message.startsWith("backend[stderr]")) {
    source = "backend-stderr";
  } else if (message.startsWith("backend[out]")) {
    source = "backend-stdout";
  } else if (message.startsWith("backend")) {
    source = "backend";
  } else if (message.startsWith("web[")) {
    source = "webview";
  }
  return {
    id: `${timestamp}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp,
    level,
    category,
    source,
    message,
    raw: line,
  };
}

function filteredDiagnosticsEntries() {
  const { level, category, text } = state.diagnosticsFilter;
  const needle = String(text || "").trim().toLowerCase();
  return diagnosticEntries().filter((entry) => {
    if (level !== "all" && entry.level !== level) {
      return false;
    }
    if (category !== "all" && entry.category !== category) {
      return false;
    }
    if (needle) {
      const haystack = `${entry.message || ""} ${entry.source || ""} ${entry.category || ""}`.toLowerCase();
      if (!haystack.includes(needle)) {
        return false;
      }
    }
    return true;
  });
}

function permissionRepairQueue() {
  return systemPermissions().filter(permissionNeedsAttention);
}

function diagnosticsHotspots() {
  const summary = new Map();
  for (const entry of diagnosticEntries()) {
    const key = entry.category || "general";
    const existing = summary.get(key) || {
      category: key,
      errorCount: 0,
      warningCount: 0,
      latestMessage: entry.message,
      latestTimestamp: entry.timestamp,
    };
    if (entry.level === "error") {
      existing.errorCount += 1;
    } else if (entry.level === "warn") {
      existing.warningCount += 1;
    }
    existing.latestMessage = entry.message || existing.latestMessage;
    existing.latestTimestamp = entry.timestamp || existing.latestTimestamp;
    summary.set(key, existing);
  }
  return Array.from(summary.values())
    .filter((item) => item.errorCount > 0 || item.warningCount > 0)
    .sort((left, right) => (right.errorCount - left.errorCount) || (right.warningCount - left.warningCount))
    .slice(0, 4);
}

function diagnosticsRecoveryNote(category) {
  const locale = currentLocale();
  switch (category) {
    case "permissions":
      return locale === "zh-CN"
        ? "打开 macOS 隐私面板，授予权限后再刷新安全页面。"
        : locale === "ja-JP"
          ? "macOS のプライバシーパネルを開いて許可し、その後セキュリティページを更新してください。"
          : "Open the macOS privacy pane, grant access, then refresh the security page.";
    case "runtime":
      return locale === "zh-CN"
        ? "先用“重启后端”，如果流式中断，再重新打开当前会话。"
        : locale === "ja-JP"
          ? "まず「Restart Backend」を使い、ストリームが途切れた場合は現在のセッションを開き直してください。"
          : "Use Restart Backend, then reopen the current session if the stream was interrupted.";
    case "filesystem":
      return locale === "zh-CN"
        ? "重试动作之前，先批准目录或扩大沙盒范围。"
        : locale === "ja-JP"
          ? "再実行する前にディレクトリを承認するか、サンドボックス範囲を広げてください。"
          : "Approve the directory or widen sandbox scope before retrying the action.";
    case "gateway":
      return locale === "zh-CN"
        ? "同时检查网关模式与 URL。直连模式是最快的隔离排查路径。"
        : locale === "ja-JP"
          ? "ゲートウェイモードと URL を一緒に確認してください。Direct モードが最速の切り分け経路です。"
          : "Check gateway mode and URL together. Direct mode is the fastest isolation path.";
    case "channels":
      return locale === "zh-CN"
        ? "重新启用前，先检查渠道绑定、密钥和平台配置链接。"
        : locale === "ja-JP"
          ? "再度有効化する前に、チャネルバインディング、シークレット、プラットフォーム設定リンクを確認してください。"
          : "Inspect the channel binding, secrets, and platform setup link before re-enabling.";
    case "updates":
      return locale === "zh-CN"
        ? "重新执行更新检查；如果仍然失败，再打开发布页。"
        : locale === "ja-JP"
          ? "更新チェックを再実行し、それでも失敗する場合はリリースページを開いてください。"
          : "Re-run update check, then open the releases page if the fetch still fails.";
    default:
      return locale === "zh-CN"
        ? "如果问题重复出现，请打开原始日志或导出诊断报告。"
        : locale === "ja-JP"
          ? "問題が再発する場合は、生ログを開くか診断をエクスポートしてください。"
          : "Open the raw log or export diagnostics if the issue repeats.";
  }
}

function focusDiagnosticsCategory(category = "all", level = "all") {
  state.diagnosticsFilter.category = category;
  state.diagnosticsFilter.level = level;
  render();
}

function refreshSecurityConsole() {
  appendLocalizedStatus("refreshingSecurityState");
  refreshDesktop(false)
    .then(() => {
      state.activeTab = "security";
      appendLocalizedStatus("securityStateRefreshed");
      render();
    })
    .catch((error) => appendStatus(String(error), "error"));
}

function openDiagnosticsFolder() {
  const path = diagnosticsState().reportRoot || "";
  if (!path) {
    appendLocalizedStatus("diagnosticsFolderUnavailable", {}, "error");
    return;
  }
  openExternalPath(path);
}

function channelActivationLabel(channel) {
  if (currentLocale() === "zh-CN") {
    return channel.enabled ? "已激活" : "未激活";
  }
  if (currentLocale() === "ja-JP") {
    return channel.enabled ? "有効化済み" : "未有効化";
  }
  return channel.enabled ? "Activated" : "Not Activated";
}

function channelSetupLinks(platform) {
  switch (platform) {
    case "telegram":
      return [
        { label: "BotFather", target: "https://t.me/BotFather" },
        { label: "Telegram Bot Docs", target: "https://core.telegram.org/bots/tutorial" },
      ];
    case "feishu_push":
      return [
        { label: "Feishu Open Platform", target: "https://open.feishu.cn/" },
        { label: "Bot Search", target: "https://open.feishu.cn/search?from=header&lang=zh-CN&page=1&pageSize=10&q=%E8%87%AA%E5%AE%9A%E4%B9%89%20bot&topicFilter=" },
      ];
    case "feishu_chat":
      return [
        { label: "Feishu Open Platform", target: "https://open.feishu.cn/" },
        { label: "App Bot Search", target: "https://open.feishu.cn/search?from=header&lang=zh-CN&page=1&pageSize=10&q=app%20bot&topicFilter=" },
      ];
    case "qq":
      return [
        { label: "QQ Bot Wiki", target: "https://bot.q.qq.com/wiki/" },
        { label: "QQ Bot Console", target: "https://q.qq.com/" },
      ];
    default:
      return [];
  }
}

function renderChannelLinks(links) {
  if (!links?.length) {
    return "";
  }
  return `
    <div class="support-link-row">
      ${links.map((link) => `
        <button class="button ghost small" type="button" onclick="openExternalPath('${escapeJsSingle(link.target)}')">${escapeHtml(link.label)}</button>
      `).join("")}
    </div>
  `;
}

function channelNeedsAttention(channel) {
  return channel.enabled && !["ready", "send_only"].includes(channel.status);
}

function channelRecoveryNote(channel) {
  if (!channel.enabled) {
    return "Disabled channels are inert until you activate them for this workspace.";
  }
  switch (channel.status) {
    case "needs_setup":
      return channel.validationMessage || "Required credentials or routing fields are still missing.";
    case "partial":
      return "This platform path is only partially supported right now. Use it with explicit expectation-setting.";
    case "send_only":
      return "Outbound-only mode is valid here. It can notify without acting as a full inbound conversation lane.";
    case "ready":
      return "This binding is configured and ready to use.";
    default:
      return "Inspect the saved fields, setup links, and runtime support notes before enabling.";
  }
}

function channelRecoveryQueue(channels = state.channelDrafts) {
  return channels.filter(channelNeedsAttention);
}

function skillPathRows() {
  return [
    ...parseListInput(state.skillDraft.globalSkillPathsText).map((path) => ({ scope: "Global", path })),
    ...parseListInput(state.skillDraft.projectSkillPathsText).map((path) => ({ scope: "Project", path })),
  ];
}

function skillsHealthRows() {
  const catalog = skillsCatalog();
  const discovered = catalog.skills || [];
  const configuredPaths = skillPathRows();
  const rows = [];
  if (!state.skillDraft.enableSkillCommands) {
    rows.push({
      level: "warn",
      title: "Skill commands are disabled",
      detail: "Discovered skills can still exist on disk, but slash-style skill command exposure is turned off.",
      action: "Enable commands",
    });
  }
  if (!discovered.length) {
    rows.push({
      level: "error",
      title: "No skills are currently discovered",
      detail: configuredPaths.length
        ? "Configured paths exist, but the runtime did not discover any skill payloads from them yet."
        : "Add a global or project skill path, or place skills under the default roots first.",
      action: "Review skill paths",
    });
  }
  if (configuredPaths.some((entry) => !entry.path.startsWith("/") && !entry.path.startsWith("./") && !entry.path.startsWith("../"))) {
    rows.push({
      level: "warn",
      title: "Some configured paths are ambiguous",
      detail: "Use absolute paths or explicit relative prefixes so users can predict where maoclaw loads skills from.",
      action: "Normalize paths",
    });
  }
  if (discovered.some((skill) => skill.disableModelInvocation)) {
    rows.push({
      level: "warn",
      title: "Some skills are discovery-only",
      detail: "At least one discovered skill disables direct model invocation, so it may appear in the catalog without being callable in every workflow.",
      action: "Inspect catalog",
    });
  }
  return rows;
}

function automationNeedsAttention(entry) {
  return entry.enabled && ["failed", "error", "partial"].includes(String(entry.lastRunStatus || "").toLowerCase());
}

function automationRecoveryQueue(automations) {
  return automations.filter(automationNeedsAttention);
}

function automationDraftIssues() {
  const draft = state.automationDraft;
  const issues = [];
  const warnings = [];
  if (!draft.name.trim()) {
    issues.push("Automation name is required.");
  }
  if (!draft.cron.trim()) {
    issues.push("Cron expression is required.");
  }
  if (draft.actionType === "run_task" && !draft.promptTemplate.trim()) {
    issues.push("Run Task automations need a prompt template.");
  }
  if (draft.actionType === "export" && !draft.destination.trim()) {
    issues.push("Export automations need a destination.");
  }
  if (draft.actionType === "notify_binding") {
    if (!draft.bindingId.trim()) {
      issues.push("Notify Binding automations need a target channel binding.");
    } else {
      const channel = availableChannels().find((entry) => entry.id === draft.bindingId);
      if (!channel) {
        issues.push("Selected channel binding no longer exists.");
      } else if (!channel.enabled) {
        warnings.push("Selected channel binding is currently disabled.");
      } else if (!["ready", "send_only"].includes(channel.status)) {
        warnings.push("Selected channel binding is not fully ready yet.");
      }
    }
  }
  if (draft.actionType === "webhook" && (!draft.url.trim() || !looksLikeHttpUrl(draft.url))) {
    issues.push("Webhook automations need a valid http or https URL.");
  }
  return { issues, warnings };
}

function renderWebBridgeIntegrationCard() {
  const bootstrap = state.bootstrap || {};
  const projectConfigPath = bootstrap.projectConfigPath || "";
  const controlPlaneStatePath = bootstrap.controlPlaneStatePath || "";
  const controlPlaneWorkersPath = bootstrap.controlPlaneWorkersPath || "";
  const vaultRootPath = bootstrap.vaultRootPath || "";
  const appSupportPath = bootstrap.appSupportPath || "";
  const copy = currentLocale() === "zh-CN"
    ? {
      title: "本地 Web Bridge",
      desc: "面向浏览器本地 maoclaw Web 集成的契约，涵盖 localhost 健康检查、link redeem 与只读 RPC hydration。",
      accepted: "契约已接受",
      expectedHost: "预期宿主",
      expectedReads: "预期读取接口",
      currentState: "当前运行状态",
      currentStateDesc: "本地服务器已实现；bridge 运行信息、控制台状态和 worker 运行态都会持久化到桌面管理路径。",
      note: "当前 bridge 已在 43115 端口提供 health、本地 link redeem 与只读 RPC hydration。云端认证 bridge 会话仍属于后续阶段，因此这里明确标注当前仍是本地链路范围。",
      openProjectSettings: "打开项目设置",
      openControlState: "打开控制台状态",
      openWorkerState: "打开 Worker 状态",
      openVault: "打开 Vault",
      openSupport: "打开应用支持目录",
    }
    : currentLocale() === "ja-JP"
      ? {
        title: "ローカル Web Bridge",
        desc: "ブラウザ内 maoclaw Web 統合向けのローカル契約です。localhost ヘルス、link redeem、読み取り専用 RPC hydration を含みます。",
        accepted: "契約確認済み",
        expectedHost: "想定ホスト",
        expectedReads: "想定読み取り",
        currentState: "現在の実行状態",
        currentStateDesc: "localhost サーバーは実装済みで、bridge 状態、制御台状態、worker 実行状態はデスクトップ管理パスへ保存されます。",
        note: "bridge は現在 43115 番ポートで health、ローカル link redeem、読み取り専用 RPC hydration を提供しています。クラウド認証 bridge セッションは後続フェーズのため、このカードでは現状のローカル限定スコープを明示します。",
        openProjectSettings: "プロジェクト設定を開く",
        openControlState: "制御台状態を開く",
        openWorkerState: "Worker 状態を開く",
        openVault: "Vault を開く",
        openSupport: "アプリサポートを開く",
      }
      : {
        title: "Local Web Bridge",
        desc: "Browser-local maoclaw web integration contract for localhost health, link redeem, and read-only RPC hydration.",
        accepted: "Contract accepted",
        expectedHost: "Expected host",
        expectedReads: "Expected reads",
        currentState: "Current runtime state",
        currentStateDesc: "The localhost bridge is implemented, and bridge/control/worker state is persisted into desktop-managed runtime paths.",
        note: "The bridge now serves health, local link redeem, and read-only RPC hydration on port 43115. Cloud-authenticated bridge sessions are still a later phase, so this card stays explicit about the current local-only link scope.",
        openProjectSettings: "Open project settings",
        openControlState: "Open control state",
        openWorkerState: "Open worker state",
        openVault: "Open vault",
        openSupport: "Open app support",
      };
  const supportLinks = [
    projectConfigPath
      ? `<button class="button secondary small" type="button" onclick="openExternalPath('${escapeJsSingle(projectConfigPath)}')">${escapeHtml(copy.openProjectSettings)}</button>`
      : "",
    controlPlaneStatePath
      ? `<button class="button ghost small" type="button" onclick="openExternalPath('${escapeJsSingle(controlPlaneStatePath)}')">${escapeHtml(copy.openControlState)}</button>`
      : "",
    controlPlaneWorkersPath
      ? `<button class="button ghost small" type="button" onclick="openExternalPath('${escapeJsSingle(controlPlaneWorkersPath)}')">${escapeHtml(copy.openWorkerState)}</button>`
      : "",
    vaultRootPath
      ? `<button class="button ghost small" type="button" onclick="openExternalPath('${escapeJsSingle(vaultRootPath)}')">${escapeHtml(copy.openVault)}</button>`
      : "",
    appSupportPath
      ? `<button class="button ghost small" type="button" onclick="openExternalPath('${escapeJsSingle(appSupportPath)}')">${escapeHtml(copy.openSupport)}</button>`
      : ""
  ].filter(Boolean).join("");
  return `
    <article class="channel-card integration-card">
      <div class="channel-head">
        <div>
          <h3>${escapeHtml(copy.title)}</h3>
          <p>${escapeHtml(copy.desc)}</p>
        </div>
        <div class="badge-row">
          <span class="badge ${statusBadgeClass("live")}">${escapeHtml(t("common.live"))}</span>
          <span class="badge ${statusBadgeClass("manual_check")}">${escapeHtml(copy.accepted)}</span>
        </div>
      </div>

      <div class="detail-list compact">
        <div class="detail-row"><span>${escapeHtml(copy.expectedHost)}</span><strong class="mono">127.0.0.1:43115</strong></div>
        <div class="detail-row"><span>${escapeHtml(copy.expectedReads)}</span><strong>get_state, get_messages, get_session_stats</strong></div>
        <div class="detail-row"><span>${escapeHtml(copy.currentState)}</span><strong>${escapeHtml(copy.currentStateDesc)}</strong></div>
      </div>

      <div class="inline-alert ok">${escapeHtml(copy.note)}</div>

      ${supportLinks ? `<div class="support-link-row">${supportLinks}</div>` : ""}
    </article>
  `;
}

function changeSelectedModel(value) {
  if (!value) {
    return;
  }
  const [provider, modelId] = value.split("::");
  if (!provider || !modelId) {
    return;
  }
  hostRequest("setModel", { provider, modelId })
    .then(() => render())
    .catch((error) => appendStatus(String(error), "error"));
}

function formatBytes(value) {
  const size = Number(value || 0);
  if (!size) {
    return "0 B";
  }
  const units = ["B", "KB", "MB", "GB"];
  let cursor = size;
  let unitIndex = 0;
  while (cursor >= 1024 && unitIndex < units.length - 1) {
    cursor /= 1024;
    unitIndex += 1;
  }
  return `${cursor.toFixed(cursor >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function formatTimestamp(value) {
  if (!value) {
    return uiCopy("common.unknown");
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
}

function formatRelativeTime(value) {
  if (!value) {
    return uiCopy("common.unknown");
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return uiCopy("common.unknown");
  }
  const deltaMs = Date.now() - date.getTime();
  const deltaSeconds = Math.max(0, Math.round(deltaMs / 1000));
  if (deltaSeconds < 60) {
    return uiCopy("relativeTime.justNow");
  }
  const deltaMinutes = Math.round(deltaSeconds / 60);
  if (deltaMinutes < 60) {
    return uiCopy("relativeTime.minAgo", { count: deltaMinutes });
  }
  const deltaHours = Math.round(deltaMinutes / 60);
  if (deltaHours < 24) {
    return uiCopy("relativeTime.hourAgo", { count: deltaHours });
  }
  const deltaDays = Math.round(deltaHours / 24);
  if (deltaDays < 14) {
    return uiCopy("relativeTime.dayAgo", { count: deltaDays });
  }
  return formatTimestamp(value);
}

function collectContentAttachments(content) {
  if (!Array.isArray(content)) {
    return [];
  }
  return content
    .map((block, index) => {
      if (!block || typeof block !== "object") {
        return null;
      }
      if (block.type === "image" && typeof block.data === "string" && typeof block.mimeType === "string") {
        return {
          id: `image-${index}-${block.mimeType}`,
          kind: "image",
          name: `image-${index + 1}`,
          mimeType: block.mimeType,
          base64Data: block.data,
          sizeBytes: 0,
        };
      }
      return null;
    })
    .filter(Boolean);
}

function normalizeVisibleContentPresentation(content) {
  if (typeof content === "string") {
    const body = content.trim();
    return {
      body,
      attachments: [],
      hasVisibleContent: Boolean(body),
      hasWorkflowContent: false,
      hasToolCalls: false,
      toolNames: [],
    };
  }
  if (!Array.isArray(content)) {
    return {
      body: "",
      attachments: [],
      hasVisibleContent: false,
      hasWorkflowContent: false,
      hasToolCalls: false,
      toolNames: [],
    };
  }

  const lines = [];
  const attachments = collectContentAttachments(content);
  const toolNames = [];
  let hasWorkflowContent = false;
  let hasToolCalls = false;

  content.forEach((block) => {
    if (!block || typeof block !== "object") {
      return;
    }
    const blockType = typeof block.type === "string" ? block.type : "";
    if (blockType === "thinking") {
      if (typeof block.thinking === "string" && block.thinking.trim()) {
        hasWorkflowContent = true;
      }
      return;
    }
    if (blockType === "toolCall") {
      hasWorkflowContent = true;
      hasToolCalls = true;
      if (typeof block.name === "string" && block.name.trim()) {
        toolNames.push(block.name.trim());
      }
      return;
    }
    if (blockType === "image") {
      return;
    }
    if (typeof block.text === "string" && block.text.trim()) {
      lines.push(block.text.trim());
      return;
    }
    if (!blockType && typeof block.content === "string" && block.content.trim()) {
      lines.push(block.content.trim());
    }
  });

  const body = lines.join("\n\n");
  return {
    body,
    attachments,
    hasVisibleContent: Boolean(body) || attachments.length > 0,
    hasWorkflowContent,
    hasToolCalls,
    toolNames,
  };
}

function normalizeToolLabels(toolNames) {
  return Array.from(
    new Set(
      (toolNames || [])
        .map((name) => String(name || "").trim())
        .filter(Boolean)
    )
  );
}

function normalizeRpcMessage(message, index) {
  const role = message.role || "custom";
  const createdAt = message.createdAt || message.timestamp || message.ts || message.time || null;

  if (role === "user") {
    const presentation = normalizeVisibleContentPresentation(message.content);
    return {
      id: `${role}-${index}`,
      role: "user",
      label: "You",
      body: presentation.body || "",
      attachments: presentation.attachments,
      tools: [],
      createdAt,
    };
  }

  if (role === "assistant") {
    const presentation = normalizeVisibleContentPresentation(message.content);
    const toolLabels = normalizeToolLabels(presentation.toolNames);
    const errorMessage = typeof message.errorMessage === "string" ? message.errorMessage.trim() : "";
    if (presentation.hasVisibleContent) {
      return {
        id: `${role}-${index}`,
        role: "assistant",
        label: productName(),
        body: presentation.body || "",
        attachments: presentation.attachments,
        tools: toolLabels,
        createdAt,
      };
    }
    if (errorMessage) {
      return {
        id: `${role}-${index}`,
        role: "assistant",
        label: productName(),
        body: errorMessage,
        attachments: [],
        tools: toolLabels,
        createdAt,
      };
    }
    if (presentation.hasWorkflowContent || presentation.hasToolCalls) {
      return {
        id: `${role}-${index}`,
        role: "assistant",
        label: productName(),
        body: uiCopy("chat.assistant_tool_activity"),
        attachments: [],
        tools: toolLabels,
        createdAt,
      };
    }
    return {
      id: `${role}-${index}`,
      role: "assistant",
      label: productName(),
      body: uiCopy("chat.assistant_no_visible_reply"),
      attachments: [],
      tools: [],
      createdAt,
    };
  }

  if (role === "toolResult" || role === "bashExecution") {
    return null;
  }

  if (role === "custom") {
    if (!message.display) {
      return null;
    }
    const body = typeof message.content === "string" ? message.content.trim() : "";
    const details = message.details ? JSON.stringify(message.details, null, 2) : "";
    if (!body && !details) {
      return null;
    }
    return {
      id: `${role}-${index}`,
      role: "custom",
      label: message.customType || "Custom",
      body: body || details,
      attachments: [],
      tools: [],
      createdAt,
    };
  }

  return null;
}

function normalizeRpcMessages(messages) {
  return (messages || [])
    .map((message, index) => normalizeRpcMessage(message, index))
    .filter(Boolean);
}

function handleRpcResponse(payload) {
  if (payload.success === false) {
    appendStatus(payload.error || uiCopy("status.rpcFailed", { command: payload.command }), "error");
    return;
  }

  const command = payload.command;
  const data = payload.data || {};
  switch (command) {
    case "get_state":
      state.sessionState = data;
      state.sessionDraftName = data.sessionName || state.sessionDraftName;
      syncGoalDraftFromSessionState();
      if (data.model && state.bootstrap) {
        state.bootstrap.provider = data.model.provider;
        state.bootstrap.model = data.model.id;
      }
      if (data.sessionFile && state.bootstrap) {
        state.bootstrap.currentSessionPath = data.sessionFile;
      }
      ensureAssistantVisibleIfStreaming();
      render();
      break;
    case "get_session_stats":
      state.sessionStats = data;
      render();
      break;
    case "get_messages":
      if (!payloadMatchesActiveSession(data)) {
        return;
      }
      state.messages = reconcilePendingUserTurns(normalizeRpcMessages(data.messages));
      if (data.sessionFile && state.bootstrap) {
        state.bootstrap.currentSessionPath = data.sessionFile;
      }
      if (state.sessionState) {
        state.sessionState = {
          ...state.sessionState,
          sessionFile: data.sessionFile || state.sessionState.sessionFile,
          sessionId: data.sessionId || state.sessionState.sessionId,
        };
      }
      ensureAssistantVisibleIfStreaming();
      if (!state.sessionState?.isStreaming) {
        finishAssistantIfNeeded();
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
      state.sessionDraftName = data.sessionName || state.sessionDraftName;
      syncGoalDraftFromSessionState();
      if (state.bootstrap) {
        if (data.model) {
          state.bootstrap.provider = data.model.provider;
          state.bootstrap.model = data.model.id;
        }
        if (data.sessionFile) {
          state.bootstrap.currentSessionPath = data.sessionFile;
        }
      }
      if (data.phase === "accepted") {
        ensureAssistantVisibleIfStreaming();
        appendLocalizedStatus("promptAccepted");
      }
      render();
      break;
    case "set_goal_contract":
      state.sessionState = {
        ...(state.sessionState || {}),
        goalContract: data.goalContract || state.sessionState?.goalContract || null,
        goalRun: data.goalRun || state.sessionState?.goalRun || null,
      };
      syncGoalDraftFromSessionState({ force: true });
      appendLocalizedStatus("goalContractSaved");
      render();
      break;
    case "update_goal_run":
      state.sessionState = {
        ...(state.sessionState || {}),
        goalContract: data.goalContract || state.sessionState?.goalContract || null,
        goalRun: data.goalRun || state.sessionState?.goalRun || null,
      };
      syncGoalDraftFromSessionState();
      appendLocalizedStatus("goalRunUpdated");
      render();
      break;
    case "update_goal_criterion":
      state.sessionState = {
        ...(state.sessionState || {}),
        goalContract: data.goalContract || state.sessionState?.goalContract || null,
        goalRun: data.goalRun || state.sessionState?.goalRun || null,
      };
      syncGoalDraftFromSessionState();
      appendLocalizedStatus("goalCriterionUpdated");
      render();
      break;
    case "clear_goal_contract":
      state.sessionState = {
        ...(state.sessionState || {}),
        goalContract: null,
        goalRun: null,
      };
      syncGoalDraftFromSessionState({ force: true });
      appendLocalizedStatus("goalContractCleared");
      render();
      break;
    case "new_session":
      state.pendingUserTurns = [];
      refreshBootstrapOnly();
      appendLocalizedStatus("newSessionStarted");
      break;
    case "switch_session":
      state.pendingUserTurns = [];
      refreshBootstrapOnly();
      appendLocalizedStatus("sessionSwitched");
      break;
    case "set_model":
      if (state.bootstrap) {
        state.bootstrap.provider = data.provider || state.bootstrap.provider;
        state.bootstrap.model = data.id || state.bootstrap.model;
      }
      appendLocalizedStatus("modelSwitched", {
        provider: data.provider || uiCopy("common.providerFallback"),
        modelId: data.id || uiCopy("common.modelFallback"),
      });
      render();
      break;
    case "set_session_name":
      refreshBootstrapOnly();
      appendLocalizedStatus("sessionNameUpdated");
      break;
    case "export_html":
      appendLocalizedStatus("sessionExported", { path: data.path || uiCopy("common.selectedPath") });
      break;
    default:
      break;
  }
}

function handleRpcEvent(payload) {
  const eventType = payload.type;
  switch (eventType) {
    case "agent_start":
      appendLocalizedStatus("thinking", { product: productName() });
      ensureAssistantMessage();
      render();
      break;
    case "message_start":
    case "message_update":
    case "message_end":
      if (syncAssistantMessageFromRpcMessage(payload.message)) {
        render();
      }
      break;
    case "thinking_start":
    case "thinking_delta":
    case "thinking_end":
      ensureAssistantMessage();
      render();
      break;
    case "text_delta":
      updateAssistantBody(payload.delta || payload.text || "");
      render();
      break;
    case "tool_start":
    case "tool_execution_start":
      pushToolEvent(`tool: ${payload.toolName || payload.tool || payload.name || "running"}`);
      render();
      break;
    case "tool_execution_update":
      pushToolEvent(`tool update: ${payload.toolName || payload.tool || payload.name || "running"}`);
      render();
      break;
    case "tool_end":
    case "tool_execution_end":
      pushToolEvent(`tool done: ${payload.toolName || payload.tool || payload.name || "running"}`);
      render();
      break;
    case "agent_end":
      if (payload.error) {
        const id = ensureAssistantMessage();
        const message = state.messages.find((entry) => entry.id === id);
        if (message) {
          message.body = payload.error;
        }
        appendLocalizedStatus("returnedError", { product: productName() }, "error");
      } else {
        finishAssistantIfNeeded();
        appendLocalizedStatus("turnComplete");
      }
      render();
      break;
    default:
      break;
  }
}

function renderModelDatalist(id, provider) {
  const suggestions = modelSuggestions(provider);
  if (!suggestions.length) {
    return "";
  }
  return `
    <datalist id="${id}">
      ${suggestions.map((model) => `<option value="${escapeHtml(model)}"></option>`).join("")}
    </datalist>
  `;
}

function renderSuggestedModels(provider) {
  const suggestions = modelSuggestions(provider).slice(0, 6);
  if (!suggestions.length) {
    return "";
  }
  return `
    <div class="suggestion-row compact model-suggestions">
      ${suggestions.map((modelId) => `
        <button
          class="suggestion-chip ${state.onboarding.model === modelId ? "active-chip" : ""}"
          type="button"
          onclick="applySuggestedModel('${escapeJsSingle(modelId)}')"
        >${escapeHtml(modelId)}</button>
      `).join("")}
    </div>
  `;
}

function renderCredentialInventory(providerConfig) {
  const providers = providerConfig.credentialProviders || [];
  const copy = currentLocale() === "zh-CN"
    ? {
      emptyTitle: "还没有已保存的 provider 凭证。",
      emptyDesc: "第一次成功保存后会写入 auth.json，并保留其他 provider 的现有凭证。",
      saved: "已保存",
      remove: "移除",
    }
    : currentLocale() === "ja-JP"
      ? {
        emptyTitle: "保存済みの provider 資格情報はまだありません。",
        emptyDesc: "最初に保存が成功すると auth.json に書き込まれ、他の provider の資格情報は維持されます。",
        saved: "保存済み",
        remove: "削除",
      }
      : {
        emptyTitle: "No saved provider credentials yet.",
        emptyDesc: "The first successful save writes into auth.json and keeps other providers intact.",
        saved: uiCopy("common.saved"),
        remove: uiCopy("common.remove"),
      };
  if (!providers.length) {
    return `
      <div class="empty-inline">
        <strong>${escapeHtml(copy.emptyTitle)}</strong>
        <p>${escapeHtml(copy.emptyDesc)}</p>
      </div>
    `;
  }
  return `
    <div class="mini-list credential-list">
      ${providers.map((providerId) => `
        <div class="mini-row static-row">
          <div class="mini-row-copy">
            <strong>${escapeHtml(providerLabels[providerId] || providerId)}</strong>
            <span class="mono">${escapeHtml(providerId)}</span>
          </div>
          <div class="row-actions">
            <span class="badge ${statusBadgeClass("configured")}">${escapeHtml(copy.saved)}</span>
            <button class="button ghost small" type="button" onclick="removeProviderCredential('${escapeJsSingle(providerId)}')">${escapeHtml(copy.remove)}</button>
          </div>
        </div>
      `).join("")}
    </div>
  `;
}

function renderReadinessPanel() {
  const readiness = providerReadiness();
  const level = readiness.ready ? "good" : "bad";
  const copy = currentLocale() === "zh-CN"
    ? {
      readyTitle: "配置已就绪",
      blockedTitle: "配置需要处理",
      readyBadge: "就绪",
      blockedBadge: "阻塞",
      success: "Provider、端点、模型与凭证已处于可运行状态。",
    }
    : currentLocale() === "ja-JP"
      ? {
        readyTitle: "設定は準備完了です",
        blockedTitle: "設定に対応が必要です",
        readyBadge: "準備完了",
        blockedBadge: "ブロック",
        success: "Provider、エンドポイント、モデル、資格情報が実行可能な状態です。",
      }
      : {
        readyTitle: "Configuration ready",
        blockedTitle: "Configuration needs attention",
        readyBadge: "Ready",
        blockedBadge: "Blocked",
        success: "Provider, endpoint, model, and credentials are in a runnable state.",
      };
  return `
    <div class="validation-panel ${level}">
      <div class="validation-header">
        <strong>${escapeHtml(readiness.ready ? copy.readyTitle : copy.blockedTitle)}</strong>
        <span class="badge ${statusBadgeClass(readiness.ready ? "configured" : "denied")}">${escapeHtml(readiness.ready ? copy.readyBadge : copy.blockedBadge)}</span>
      </div>
      ${readiness.issues.length ? `
        <div class="validation-list">
          ${readiness.issues.map((issue) => `<div class="validation-item issue">${escapeHtml(issue)}</div>`).join("")}
        </div>
      ` : `<div class="validation-item success">${escapeHtml(copy.success)}</div>`}
      ${readiness.warnings.length ? `
        <div class="validation-list">
          ${readiness.warnings.map((warning) => `<div class="validation-item warning">${escapeHtml(warning)}</div>`).join("")}
        </div>
      ` : ""}
    </div>
  `;
}

function renderAttachmentStrip(attachments, options = {}) {
  if (!attachments?.length) {
    return "";
  }
  const removable = Boolean(options.removable);
  const compact = Boolean(options.compact);
  return `
    <div class="attachment-strip ${compact ? "compact" : ""}">
      ${attachments.map((attachment) => `
        <article class="attachment-pill ${attachment.kind === "image" ? "image" : "file"}">
          ${attachment.kind === "image" && attachment.base64Data ? `
            <button class="attachment-preview" type="button" onclick="openExternalPath('${escapeJsSingle(attachment.path || "")}')">
              <img src="${escapeHtml(attachmentPreviewURL(attachment))}" alt="${escapeHtml(attachment.name || uiCopy("common.attachment"))}" />
            </button>
          ` : `
            <button class="attachment-icon" type="button" onclick="openExternalPath('${escapeJsSingle(attachment.path || "")}')">${escapeHtml(attachment.kind === "audio" ? uiCopy("common.audio") : uiCopy("common.file"))}</button>
          `}
          <div class="attachment-copy">
            <strong>${escapeHtml(attachment.name || uiCopy("common.attachment"))}</strong>
            <span>${escapeHtml(attachmentLabel(attachment))}${attachment.mimeType ? ` · ${escapeHtml(attachment.mimeType)}` : ""}${formatAttachmentSize(attachment.sizeBytes) ? ` · ${escapeHtml(formatAttachmentSize(attachment.sizeBytes))}` : ""}</span>
            ${attachment.kind !== "image" && attachment.path ? `<small class="mono">${escapeHtml(attachment.path)}</small>` : ""}
          </div>
          <div class="row-actions">
            ${attachment.path ? `<button class="button ghost small" type="button" onclick="openExternalPath('${escapeJsSingle(attachment.path)}')">${escapeHtml(uiCopy("common.open"))}</button>` : ""}
            ${removable ? `<button class="button ghost small" type="button" onclick="removeComposerAttachment('${escapeJsSingle(attachment.id)}')">${escapeHtml(uiCopy("common.remove"))}</button>` : ""}
          </div>
        </article>
      `).join("")}
    </div>
  `;
}

function renderMessageAttachments(message) {
  return renderAttachmentStrip(message.attachments || [], { compact: true });
}

function renderMessageMeta(message) {
  const chips = [];
  if (message.role) {
    chips.push(`<span class="badge ${sourceBadgeClass(message.role === "assistant" ? "live" : message.role === "user" ? "seeded" : "scaffold")}">${escapeHtml(capitalize(message.role))}</span>`);
  }
  if (isPendingUserMessage(message)) {
    chips.push(`<span class="badge ${statusBadgeClass("manual_check")}">${escapeHtml(t("common.pending"))}</span>`);
  }
  if ((message.attachments || []).length) {
    chips.push(`<span class="badge">${escapeHtml(attachmentCountLabel(message.attachments.length))}</span>`);
  }
  if ((message.tools || []).length) {
    chips.push(`<span class="badge">${escapeHtml(`${message.tools.length} tool${message.tools.length === 1 ? "" : "s"}`)}</span>`);
  }
  if (message.createdAt) {
    chips.push(`<span class="badge">${escapeHtml(formatTimestamp(message.createdAt))}</span>`);
  }
  return chips.length ? `<div class="message-meta-row">${chips.join("")}</div>` : "";
}

function messageFrameClass(message) {
  switch (message.role) {
    case "tool":
      return "message-frame tool-frame";
    case "system":
      return "message-frame system-frame";
    case "custom":
      return "message-frame custom-frame";
    default:
      return "message-frame";
  }
}

function renderConversationSpotlight(provider, model, activeAgentId, defaultAgentId, sessionState) {
  const currentAgent = agentSummaryById(activeAgentId) || currentAgentProfileDraft();
  const currentAgentName = currentAgent.displayName || displayAgentName(activeAgentId);
  const attachedPacks = agentStarterPackEntries(currentAgent).filter((entry) => entry.coverage.status === "attached").length;
  const hasSessionBinding = Boolean(sessionState?.sessionFile);
  const goalBadge = renderGoalBadge(sessionState);
  return `
    <section class="conversation-spotlight">
      <div class="conversation-spotlight-copy">
        <div class="section-kicker">${escapeHtml(t("chat.conversation_lane"))}</div>
        <strong>${escapeHtml(currentLocale() === "zh-CN"
          ? `${currentAgentName} 正在负责这个线程`
          : currentLocale() === "ja-JP"
            ? `${currentAgentName} がこのスレッドを担当しています`
            : `${currentAgentName} is driving this thread`)}</strong>
        <p>${escapeHtml(currentAgent.description || (currentLocale() === "zh-CN"
          ? "这个工作区会把线程责任、模型、附件和目标状态保持在同一块 AI 画布里。"
          : currentLocale() === "ja-JP"
            ? "このワークスペースは、担当レーン、モデル、添付、目標状態を 1 つの AI ネイティブなキャンバスに保ちます。"
            : "This workspace keeps the lane, model, attachments, and goal state on one AI-native canvas."))}</p>
      </div>
      <div class="conversation-spotlight-meta">
        <span class="badge ${sourceBadgeClass("live")}">${escapeHtml(providerLabels[provider] || provider || t("meta.provider"))}</span>
        <span class="badge">${escapeHtml(model || t("chat.choose_live_model"))}</span>
        <span class="badge">${escapeHtml(`${t("chat.thread_lane")}: ${displayAgentName(activeAgentId)}`)}</span>
        <span class="badge">${escapeHtml(`${t("chat.desktop_default")}: ${displayAgentName(defaultAgentId)}`)}</span>
        <span class="badge">${escapeHtml(`${attachedPacks} ${term("skill")}`)}</span>
        <span class="badge">${escapeHtml(`${state.composerAttachments.length} ${t("chat.pending_attachments")}`)}</span>
        <span class="badge">${escapeHtml(`${sessionState.messageCount || 0} ${t("chat.messages")}`)}</span>
        ${goalBadge}
      </div>
      <div class="suggestion-row">
        ${availableAgentProfiles().map((agent) => `
          <button class="suggestion-chip ${activeAgentId === agent.id ? "active-chip" : ""}" type="button" onclick="applyChatAgentProfile('${agent.id}')">
            ${escapeHtml(agent.displayName)}
          </button>
        `).join("")}
      </div>
      <div class="field-note">${escapeHtml(hasSessionBinding ? t("chat.use_thread_switcher") : t("chat.no_thread_binding"))}</div>
    </section>
  `;
}

function renderChatSignalGrid(sessionState, provider, model, activeAgentId) {
  const goalContract = sessionState?.goalContract || null;
  const goalSummary = goalCriteriaSummary(sessionState);
  const goalStatus = goalRunStatusLabel(sessionState?.goalRun?.status);
  const sessionLabel = sessionState.sessionName || sessionState.sessionId || t("common.pending");
  const cards = [
    {
      label: t("chat.session_name"),
      value: sessionLabel,
      detail: sessionState.sessionId || "",
      mono: !sessionState.sessionName && Boolean(sessionState.sessionId),
    },
    {
      label: t("chat.thread_lane"),
      value: displayAgentName(activeAgentId),
      detail: backendStatusLabel(),
      mono: false,
    },
    {
      label: t("meta.model"),
      value: model || t("common.pending"),
      detail: providerLabels[provider] || provider || t("meta.provider"),
      mono: false,
    },
    {
      label: goalLabel(),
      value: goalContract ? shorten(goalContract.title || goalContract.goal || goalLabel(), 34) : t("common.pending"),
      detail: goalContract
        ? [goalSummary, goalStatus].filter(Boolean).join(" · ")
        : `${state.composerAttachments.length} ${t("chat.pending_attachments")}`,
      mono: false,
    },
  ];

  return `
    <div class="chat-signal-grid">
      ${cards.map((card) => `
        <div class="chat-signal-card">
          <span class="chat-signal-label">${escapeHtml(card.label)}</span>
          <strong class="chat-signal-value ${card.mono ? "mono" : ""}">${escapeHtml(card.value || t("common.pending"))}</strong>
          <span class="chat-signal-detail">${escapeHtml(card.detail || t("common.pending"))}</span>
        </div>
      `).join("")}
    </div>
  `;
}

function workbenchStateCopy(stateId) {
  if (currentLocale() === "zh-CN") {
    switch (stateId) {
      case "offline":
        return {
          kicker: "工作台状态",
          title: "后端当前不可用",
          detail: "先恢复桌面后端连接，再继续发送或推进当前线程。",
        };
      case "blocked":
        return {
          kicker: "工作台状态",
          title: "目标执行已阻塞",
          detail: "先解除阻塞、恢复目标，或清除当前目标契约，再继续执行。",
        };
      case "failed":
        return {
          kicker: "工作台状态",
          title: "目标执行已失败",
          detail: "当前目标已经进入失败状态，需要人工确认下一步策略。",
        };
      case "paused":
        return {
          kicker: "工作台状态",
          title: "目标执行已暂停",
          detail: "恢复目标后，这个会话会继续沿着同一个目标契约推进。",
        };
      case "streaming":
        return {
          kicker: "工作台状态",
          title: "Assistant 正在流式回复",
          detail: "当前线程已进入执行中状态，实时结果会继续落在这块对话画布里。",
        };
      case "complete":
        return {
          kicker: "工作台状态",
          title: "目标验收条件已满足",
          detail: "现在应该检查产物与证据，而不是继续在完成状态下盲目前进。",
        };
      case "active":
        return {
          kicker: "工作台状态",
          title: "线程处于可推进状态",
          detail: "继续补充指令、附件或验收证据，让执行保持收敛而不是漂移。",
        };
      default:
        return {
          kicker: "工作台状态",
          title: "工作台已经就绪",
          detail: "从真实任务开始，再把附件、目标和上下文逐步叠加进来。",
        };
    }
  }
  if (currentLocale() === "ja-JP") {
    switch (stateId) {
      case "offline":
        return {
          kicker: "Workbench state",
          title: "バックエンドは現在利用できません",
          detail: "まずデスクトップのバックエンド接続を回復してから、このスレッドを続けてください。",
        };
      case "blocked":
        return {
          kicker: "Workbench state",
          title: "目標実行がブロックされています",
          detail: "ブロック解除、再開、または目標契約のクリアを行ってから次へ進みます。",
        };
      case "failed":
        return {
          kicker: "Workbench state",
          title: "目標実行は失敗状態です",
          detail: "次の進め方は人間側で判断する必要があります。",
        };
      case "paused":
        return {
          kicker: "Workbench state",
          title: "目標実行は一時停止中です",
          detail: "再開すると、このセッションは同じ目標契約の下で続行します。",
        };
      case "streaming":
        return {
          kicker: "Workbench state",
          title: "Assistant がストリーミング応答中です",
          detail: "このスレッドの実行は進行中で、結果はこの会話キャンバスに継続して反映されます。",
        };
      case "complete":
        return {
          kicker: "Workbench state",
          title: "目標条件は満たされました",
          detail: "この時点では、さらに前進するより成果物と証拠の確認が優先です。",
        };
      case "active":
        return {
          kicker: "Workbench state",
          title: "スレッドは前進可能です",
          detail: "指示、添付、達成証拠を追加し、実行を収束させてください。",
        };
      default:
        return {
          kicker: "Workbench state",
          title: "ワークベンチの準備ができています",
          detail: "実際の作業から始め、必要な添付や目標をここに重ねていきます。",
        };
    }
  }

  switch (stateId) {
    case "offline":
      return {
        kicker: "Workbench state",
        title: "The backend is currently unavailable",
        detail: "Restore the desktop backend connection before continuing this thread.",
      };
    case "blocked":
      return {
        kicker: "Workbench state",
        title: "The goal run is blocked",
        detail: "Unblock it, resume it, or clear the current goal contract before continuing.",
      };
    case "failed":
      return {
        kicker: "Workbench state",
        title: "The goal run has failed",
        detail: "A human needs to choose the next recovery path before pushing this thread further.",
      };
    case "paused":
      return {
        kicker: "Workbench state",
        title: "The goal run is paused",
        detail: "Resume it when you want this session to continue under the same contract.",
      };
    case "streaming":
      return {
        kicker: "Workbench state",
        title: "The assistant is streaming a reply",
        detail: "This thread is actively running and the result will continue to land in this canvas.",
      };
    case "complete":
      return {
        kicker: "Workbench state",
        title: "The goal criteria are satisfied",
        detail: "Review the artifact and evidence now instead of continuing blindly past completion.",
      };
    case "active":
      return {
        kicker: "Workbench state",
        title: "The thread is ready to advance",
        detail: "Add direction, inputs, or evidence here so execution keeps converging instead of drifting.",
      };
    default:
      return {
        kicker: "Workbench state",
        title: "The workbench is ready",
        detail: "Start with a real task, then layer goals, attachments, and context into this session.",
      };
  }
}

function deriveWorkbenchState(sessionState) {
  const goalStatus = String(sessionState?.goalRun?.status || "");
  const backendLevel = backendStatusLevel();
  const streaming = Boolean(state.pendingAssistantId) || Boolean(sessionState?.isStreaming);
  const hasMessages = state.messages.length > 0;
  let stateId = "ready";

  if (backendLevel === "offline") {
    stateId = "offline";
  } else if (goalStatus === "blocked") {
    stateId = "blocked";
  } else if (goalStatus === "failed") {
    stateId = "failed";
  } else if (goalStatus === "paused") {
    stateId = "paused";
  } else if (streaming) {
    stateId = "streaming";
  } else if (goalStatus === "criteria_met") {
    stateId = "complete";
  } else if (hasMessages) {
    stateId = "active";
  }

  const copy = workbenchStateCopy(stateId);
  const badges = [
    `<span class="badge ${backendStatusBadgeClass()}">${escapeHtml(backendStatusLabel())}</span>`,
  ];
  if (sessionState?.goalRun?.status) {
    const goalBadgeClass = goalStatus === "blocked" || goalStatus === "failed"
      ? statusBadgeClass("failed")
      : goalStatus === "paused"
        ? statusBadgeClass("manual_check")
        : goalStatus === "criteria_met"
          ? statusBadgeClass("granted")
          : sourceBadgeClass("live");
    badges.push(`<span class="badge ${goalBadgeClass}">${escapeHtml(goalRunStatusLabel(goalStatus))}</span>`);
  }
  if (streaming) {
    badges.push(`<span class="badge ${statusBadgeClass("manual_check")}">${escapeHtml(t("chat.streaming"))}</span>`);
  }
  badges.push(`<span class="badge">${escapeHtml(`${sessionState?.messageCount || 0} ${t("chat.messages")}`)}</span>`);

  return {
    stateId,
    copy,
    badges,
  };
}

function renderWorkbenchStateStrip(sessionState) {
  const summary = deriveWorkbenchState(sessionState);
  return `
    <section class="workbench-state-strip state-${summary.stateId}">
      <div class="workbench-state-copy">
        <div class="section-kicker">${escapeHtml(summary.copy.kicker)}</div>
        <strong>${escapeHtml(summary.copy.title)}</strong>
        <p>${escapeHtml(summary.copy.detail)}</p>
      </div>
      <div class="workbench-state-badges">
        ${summary.badges.join("")}
      </div>
    </section>
  `;
}

function goalLabel() {
  if (currentLocale() === "zh-CN") {
    return "目标";
  }
  if (currentLocale() === "ja-JP") {
    return "目標";
  }
  return "Goal";
}

function goalRunStatusLabel(status) {
  if (!status) {
    return "";
  }
  const key = `goal.status_${status}`;
  const localized = uiCopy(key);
  if (localized !== key) {
    return localized;
  }
  return capitalize(String(status).replaceAll("_", " "));
}

function goalCriterionStateMap(sessionState) {
  const map = new Map();
  for (const criterion of sessionState?.goalRun?.criteria || []) {
    if (criterion?.criterionId) {
      map.set(criterion.criterionId, criterion);
    }
  }
  return map;
}

function goalWatchdogSnapshot(sessionState) {
  const goalContract = sessionState?.goalContract;
  const goalRun = sessionState?.goalRun;
  if (!goalContract?.watchdog || !goalRun?.lastProgressAt) {
    return null;
  }

  const lastProgress = new Date(goalRun.lastProgressAt);
  if (Number.isNaN(lastProgress.getTime())) {
    return null;
  }

  const inactivityTimeoutSeconds = Number(goalContract.watchdog.inactivityTimeoutSeconds || 0);
  const secondsSinceProgress = Math.max(0, Math.floor((Date.now() - lastProgress.getTime()) / 1000));
  const secondsUntilTimeout = inactivityTimeoutSeconds > 0
    ? inactivityTimeoutSeconds - secondsSinceProgress
    : null;

  return {
    secondsSinceProgress,
    secondsUntilTimeout,
    overdue: secondsUntilTimeout !== null && secondsUntilTimeout <= 0,
  };
}

function renderGoalCriteriaList(sessionState) {
  const goalContract = sessionState?.goalContract;
  if (!goalContract) {
    return "";
  }

  const criterionStates = goalCriterionStateMap(sessionState);
  return `
    <div class="goal-criteria-list">
      ${(goalContract.criteria || []).map((criterion) => {
        const criterionState = criterionStates.get(criterion.id) || { satisfied: false, evidence: "" };
        const evidenceValue = criterionState.evidence || "";
        return `
          <div class="goal-criterion-row">
            <div class="goal-criterion-head">
              <label class="checkbox-row">
                <input id="${escapeHtml(goalCriterionCheckboxId(criterion.id))}" type="checkbox" ${criterionState.satisfied ? "checked" : ""} />
                <span>${escapeHtml(criterion.description || criterion.id)}</span>
              </label>
              <span class="badge ${criterionState.satisfied ? sourceBadgeClass("live") : sourceBadgeClass("seeded")}">${escapeHtml(criterionState.satisfied ? uiCopy("goal.criterion_met") : uiCopy("goal.criterion_open"))}</span>
            </div>
            <div class="field compact">
              <label for="${escapeHtml(goalCriterionEvidenceInputId(criterion.id))}">${escapeHtml(uiCopy("goal.criterion_evidence"))}</label>
              <input id="${escapeHtml(goalCriterionEvidenceInputId(criterion.id))}" value="${escapeHtml(evidenceValue)}" placeholder="${escapeHtml(uiCopy("goal.criterion_evidence"))}" />
            </div>
            <div class="button-row compact">
              <button class="button ghost small" type="button" onclick="applyGoalCriterion('${escapeJsSingle(criterion.id)}')">${escapeHtml(uiCopy("goal.apply_criterion"))}</button>
            </div>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

function goalCriteriaSummary(sessionState) {
  const goalContract = sessionState?.goalContract;
  if (!goalContract) {
    return "";
  }
  const total = Array.isArray(goalContract.criteria) ? goalContract.criteria.length : 0;
  const satisfied = Array.isArray(sessionState?.goalRun?.criteria)
    ? sessionState.goalRun.criteria.filter((criterion) => criterion && criterion.satisfied).length
    : 0;
  if (!total) {
    return "";
  }
  return `${satisfied}/${total}`;
}

function renderGoalBadge(sessionState) {
  const goalContract = sessionState?.goalContract;
  if (!goalContract) {
    return "";
  }
  const title = goalContract.title || goalContract.goal || goalLabel();
  const criteriaSummary = goalCriteriaSummary(sessionState);
  const goalStatus = goalRunStatusLabel(sessionState?.goalRun?.status);
  const suffixParts = [criteriaSummary, goalStatus].filter(Boolean);
  const suffix = suffixParts.length ? ` · ${suffixParts.join(" · ")}` : "";
  return `<span class="badge">${escapeHtml(`${goalLabel()}: ${shorten(title, 32)}${suffix}`)}</span>`;
}

function goalEditorOpen(sessionState) {
  if (!sessionState?.goalContract) {
    return true;
  }
  return Boolean(state.goalEditorExpanded) || Boolean(state.goalDraft?.dirty);
}

function renderGoalCriteriaPreview(sessionState) {
  const goalContract = sessionState?.goalContract;
  if (!goalContract) {
    return "";
  }

  const criterionStates = goalCriterionStateMap(sessionState);
  return `
    <div class="goal-criteria-preview">
      ${(goalContract.criteria || []).map((criterion) => {
        const criterionState = criterionStates.get(criterion.id) || { satisfied: false, evidence: "" };
        const evidence = String(criterionState.evidence || "").trim();
        return `
          <div class="goal-criteria-preview-row ${criterionState.satisfied ? "met" : "open"}">
            <div class="goal-criteria-preview-head">
              <strong>${escapeHtml(criterion.description || criterion.id)}</strong>
              <span class="badge ${criterionState.satisfied ? sourceBadgeClass("live") : sourceBadgeClass("seeded")}">${escapeHtml(criterionState.satisfied ? uiCopy("goal.criterion_met") : uiCopy("goal.criterion_open"))}</span>
            </div>
            ${evidence ? `<p>${escapeHtml(evidence)}</p>` : ""}
          </div>
        `;
      }).join("")}
    </div>
  `;
}

function renderGoalControlsPanel(sessionState, goalDraft, lifecyclePrimaryAction) {
  const goalContract = sessionState?.goalContract || null;
  return `
    <div class="goal-controls-shell">
      <div class="goal-controls-header">
        <div class="goal-controls-copy">
          <div class="section-kicker">${escapeHtml(uiCopy("goal.controls_title"))}</div>
          <p class="field-note">${escapeHtml(uiCopy("goal.controls_desc"))}</p>
        </div>
        ${goalDraft.dirty ? `<span class="badge ${statusBadgeClass("manual_check")}">${escapeHtml(uiCopy("goal.draft_dirty"))}</span>` : ""}
      </div>
      ${goalContract ? `
        <div class="button-row compact goal-controls-actions">
          <button class="button secondary small" type="button" onclick="applyGoalLifecycle('${escapeJsSingle(lifecyclePrimaryAction)}')">${escapeHtml(uiCopy(`goal.${lifecyclePrimaryAction}`))}</button>
          <button class="button secondary small" type="button" onclick="applyGoalLifecycle('complete')">${escapeHtml(uiCopy("goal.complete"))}</button>
          <button class="button ghost small" type="button" onclick="applyGoalLifecycle('block')">${escapeHtml(uiCopy("goal.block"))}</button>
          <button class="button ghost small" type="button" onclick="applyGoalLifecycle('fail')">${escapeHtml(uiCopy("goal.fail"))}</button>
          <button class="button ghost small" type="button" onclick="clearGoalContract()">${escapeHtml(uiCopy("goal.clear"))}</button>
        </div>
        ${renderGoalCriteriaList(sessionState)}
      ` : ""}
      <div class="field">
        <label for="goal-title">${escapeHtml(uiCopy("goal.title"))}</label>
        <input id="goal-title" value="${escapeHtml(goalDraft.title || "")}" oninput="updateGoalDraftField('title', this.value)" />
      </div>
      <div class="field">
        <label for="goal-body">${escapeHtml(uiCopy("goal.goal"))}</label>
        <textarea id="goal-body" oninput="updateGoalDraftField('goal', this.value)">${escapeHtml(goalDraft.goal || "")}</textarea>
      </div>
      <div class="field">
        <label for="goal-criteria">${escapeHtml(uiCopy("goal.criteria"))}</label>
        <textarea id="goal-criteria" oninput="updateGoalDraftField('criteriaText', this.value)" placeholder="${escapeHtml(uiCopy("goal.criteria_placeholder"))}">${escapeHtml(goalDraft.criteriaText || "")}</textarea>
        <div class="field-note">${escapeHtml(uiCopy("goal.criteria_note"))}</div>
      </div>
      <div class="goal-controls-meta-grid">
        <div class="field">
          <label for="goal-system-id">${escapeHtml(uiCopy("goal.system_id"))}</label>
          <input id="goal-system-id" value="${escapeHtml(goalDraft.systemId || "")}" oninput="updateGoalDraftField('systemId', this.value)" />
        </div>
        <div class="field">
          <label for="goal-artifact-type">${escapeHtml(uiCopy("goal.artifact_type"))}</label>
          <input id="goal-artifact-type" value="${escapeHtml(goalDraft.artifactType || "")}" oninput="updateGoalDraftField('artifactType', this.value)" />
        </div>
        <div class="field">
          <label for="goal-heartbeat">${escapeHtml(uiCopy("goal.heartbeat_seconds"))}</label>
          <input id="goal-heartbeat" type="number" min="1" value="${escapeHtml(goalDraft.heartbeatSeconds || "300")}" oninput="updateGoalDraftField('heartbeatSeconds', this.value)" />
        </div>
        <div class="field">
          <label for="goal-inactivity">${escapeHtml(uiCopy("goal.inactivity_seconds"))}</label>
          <input id="goal-inactivity" type="number" min="1" value="${escapeHtml(goalDraft.inactivitySeconds || "900")}" oninput="updateGoalDraftField('inactivitySeconds', this.value)" />
        </div>
        <div class="field">
          <label for="goal-restarts">${escapeHtml(uiCopy("goal.max_restarts"))}</label>
          <input id="goal-restarts" type="number" min="0" value="${escapeHtml(goalDraft.maxRestarts || "12")}" oninput="updateGoalDraftField('maxRestarts', this.value)" />
        </div>
      </div>
      <label class="checkbox-row">
        <input type="checkbox" ${goalDraft.restartOnInactive ? "checked" : ""} onchange="updateGoalDraftField('restartOnInactive', this.checked)" />
        <span>${escapeHtml(uiCopy("goal.restart_on_inactive"))}</span>
      </label>
      <div class="button-row compact">
        <button class="button secondary small" type="button" onclick="saveGoalContract()">${escapeHtml(uiCopy("goal.save"))}</button>
        <button class="button ghost small" type="button" onclick="resetGoalDraft()">${escapeHtml(uiCopy("goal.reset"))}</button>
      </div>
    </div>
  `;
}

function renderGoalContractPanel(sessionState) {
  const goalContract = sessionState?.goalContract || null;
  const goalRun = sessionState?.goalRun || null;
  const goalDraft = state.goalDraft || blankGoalDraft();
  const goalRunStatusId = String(goalRun?.status || "active");
  const goalStatus = goalRunStatusLabel(goalRun?.status) || uiCopy("goal.status_active");
  const lifecyclePrimaryAction = goalRunStatusId === "paused" ? "resume" : "pause";
  const watchdogSnapshot = goalWatchdogSnapshot(sessionState);
  const controlsOpen = goalEditorOpen(sessionState);
  const criteriaSummary = goalCriteriaSummary(sessionState);
  const draftDirty = Boolean(goalDraft.dirty);
  const title = goalContract?.title || goalContract?.goal || goalLabel();
  const primaryCopy = goalContract?.goal || uiCopy("goal.contract_desc");
  const watchdogLabel = watchdogSnapshot
    ? `${watchdogSnapshot.overdue ? uiCopy("goal.watchdog_overdue") : uiCopy("goal.watchdog_healthy")} · ${watchdogSnapshot.secondsSinceProgress}s / ${goalContract?.watchdog?.inactivityTimeoutSeconds || 0}s`
    : "";
  const toggleControl = goalContract
    ? (draftDirty
      ? `<span class="badge ${statusBadgeClass("manual_check")}">${escapeHtml(uiCopy("goal.draft_dirty"))}</span>`
      : `<button class="button ${controlsOpen ? "ghost" : "secondary"} small" type="button" onclick="toggleGoalEditor(${controlsOpen ? "false" : "true"})">${escapeHtml(uiCopy(controlsOpen ? "goal.hide_controls" : "goal.open_controls"))}</button>`)
    : "";

  return `
    <section class="surface-card context-panel goal-editor-panel">
      <div class="surface-header tight">
        <div>
          <div class="section-kicker">${escapeHtml(goalLabel())}</div>
          <h2>${escapeHtml(uiCopy("goal.contract_title"))}</h2>
        </div>
        <div class="badge-row goal-panel-head-actions">
          <span class="badge ${goalContract ? sourceBadgeClass("live") : sourceBadgeClass("seeded")}">${escapeHtml(goalContract ? goalStatus : t("common.pending"))}</span>
          ${goalContract ? `<span class="badge">${escapeHtml(criteriaSummary || String((goalContract.criteria || []).length))}</span>` : ""}
          ${toggleControl}
        </div>
      </div>
      <div class="goal-contract-summary ${goalContract ? "" : "empty"}">
        <div class="goal-summary-head">
          <div class="goal-summary-copy">
            <strong>${escapeHtml(title)}</strong>
            <p>${escapeHtml(primaryCopy)}</p>
          </div>
          ${goalContract ? `
            <div class="goal-summary-badges">
              <span class="badge ${sourceBadgeClass("live")}">${escapeHtml(goalStatus)}</span>
              <span class="badge">${escapeHtml(criteriaSummary || String((goalContract.criteria || []).length))}</span>
              ${watchdogLabel ? `<span class="badge ${watchdogSnapshot?.overdue ? statusBadgeClass("denied") : statusBadgeClass("granted")}">${escapeHtml(watchdogLabel)}</span>` : ""}
            </div>
          ` : ""}
        </div>
        ${goalContract ? `
          <div class="detail-list compact">
            <div class="detail-row"><span>${escapeHtml(goalLabel())}</span><strong>${escapeHtml(goalContract.title || shorten(goalContract.goal || "", 42))}</strong></div>
            <div class="detail-row"><span>${escapeHtml(uiCopy("goal.criteria"))}</span><strong>${escapeHtml(criteriaSummary || String((goalContract.criteria || []).length))}</strong></div>
            ${goalContract.systemId ? `<div class="detail-row"><span>${escapeHtml(uiCopy("goal.system_id"))}</span><strong>${escapeHtml(goalContract.systemId)}</strong></div>` : ""}
            ${goalContract.artifactType ? `<div class="detail-row"><span>${escapeHtml(uiCopy("goal.artifact_type"))}</span><strong>${escapeHtml(goalContract.artifactType)}</strong></div>` : ""}
            ${watchdogLabel ? `<div class="detail-row"><span>${escapeHtml(uiCopy("goal.watchdog"))}</span><strong>${escapeHtml(watchdogLabel)}</strong></div>` : ""}
            ${goalRun?.lastProgressAt ? `<div class="detail-row"><span>${escapeHtml(uiCopy("goal.last_progress"))}</span><strong>${escapeHtml(`${formatRelativeTime(goalRun.lastProgressAt)} · ${formatTimestamp(goalRun.lastProgressAt)}`)}</strong></div>` : ""}
          </div>
          ${renderGoalCriteriaPreview(sessionState)}
        ` : `
          <div class="goal-empty-state">
            <strong>${escapeHtml(uiCopy("goal.empty_hint"))}</strong>
            <p>${escapeHtml(uiCopy("goal.contract_desc"))}</p>
          </div>
        `}
      </div>
      ${controlsOpen ? renderGoalControlsPanel(sessionState, goalDraft, lifecyclePrimaryAction) : ""}
    </section>
  `;
}

function renderTextSection(lines) {
  if (!lines.length) {
    return "";
  }
  if (lines.every((line) => /^[-*]\s+/.test(line))) {
    return `
      <ul class="message-list">
        ${lines.map((line) => `<li>${escapeHtml(line.replace(/^[-*]\s+/, ""))}</li>`).join("")}
      </ul>
    `;
  }
  if (lines.every((line) => /^\d+\.\s+/.test(line))) {
    return `
      <ol class="message-list ordered">
        ${lines.map((line) => `<li>${escapeHtml(line.replace(/^\d+\.\s+/, ""))}</li>`).join("")}
      </ol>
    `;
  }
  if (lines.every((line) => /^>\s?/.test(line))) {
    return `
      <blockquote class="message-quote">
        ${lines.map((line) => `<p>${escapeHtml(line.replace(/^>\s?/, ""))}</p>`).join("")}
      </blockquote>
    `;
  }
  return lines
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) {
        return "";
      }
      if (/^#{1,3}\s+/.test(trimmed)) {
        return `<div class="message-heading">${escapeHtml(trimmed.replace(/^#{1,3}\s+/, ""))}</div>`;
      }
      return `<p>${escapeHtml(trimmed)}</p>`;
    })
    .join("");
}

function renderRichMessageBody(body) {
  const text = String(body || "");
  if (!text.trim()) {
    return `<div class="message-body empty">${escapeHtml(t("chat.no_message_body"))}</div>`;
  }

  const sections = [];
  const parts = text.split(/```/);
  parts.forEach((part, index) => {
    if (index % 2 === 1) {
      const lines = part.split("\n");
      const firstLine = lines[0]?.trim() || "";
      const language = /^[A-Za-z0-9_+.-]+$/.test(firstLine) ? firstLine : "";
      const code = language ? lines.slice(1).join("\n") : part;
      sections.push(`
        <pre class="message-code-block"><code>${escapeHtml(code.replace(/^\n+|\n+$/g, ""))}</code></pre>
      `);
      return;
    }

    const blocks = part
      .split(/\n{2,}/)
      .map((chunk) => chunk.split("\n").map((line) => line.trimEnd()).filter((line, lineIndex, array) => !(line === "" && array.length === 1)))
      .filter((lines) => lines.some((line) => line.trim()));
    blocks.forEach((lines) => {
      sections.push(renderTextSection(lines));
    });
  });

  return `<div class="message-body rich">${sections.join("")}</div>`;
}

function renderStructuredMessageBody(message) {
  const text = String(message.body || "");
  if (message.role === "assistant" && !text.trim() && !(message.attachments || []).length) {
    if (state.pendingAssistantId === message.id) {
      const pendingCopy = (message.tools || []).length
        ? t("chat.assistant_tool_activity")
        : t("chat.assistant_pending_reply");
      return `<div class="message-body empty">${escapeHtml(pendingCopy)}</div>`;
    }
    if ((message.tools || []).length) {
      return `<div class="message-body empty">${escapeHtml(t("chat.assistant_tool_activity"))}</div>`;
    }
  }
  if (!text.trim() && (message.attachments || []).length) {
    return "";
  }
  if (message.role === "tool") {
    const match = text.match(/^\$ ([^\n]+)\n?([\s\S]*)$/);
    if (match) {
      const command = match[1];
      const output = (match[2] || "").trim();
      return `
        <div class="message-body rich tool-output">
          <div class="tool-command">$ ${escapeHtml(command)}</div>
          ${output ? `<pre class="message-code-block"><code>${escapeHtml(output)}</code></pre>` : `<div class="message-body empty">${escapeHtml(t("chat.command_no_output"))}</div>`}
        </div>
      `;
    }
    return renderRichMessageBody(text);
  }
  if (message.role === "system" || message.role === "custom") {
    const looksStructured = text.trim().startsWith("{") || text.trim().startsWith("[");
    if (looksStructured) {
      return `<div class="message-body rich"><pre class="message-code-block"><code>${escapeHtml(text)}</code></pre></div>`;
    }
  }
  return renderRichMessageBody(text);
}

function threadRecencyKind(session) {
  if (session.isCurrent) {
    return "current";
  }
  const modified = new Date(session.modifiedAt || 0);
  if (Number.isNaN(modified.getTime())) {
    return "saved";
  }
  const ageHours = (Date.now() - modified.getTime()) / 3600000;
  if (ageHours < 12) {
    return "hot";
  }
  if (ageHours < 72) {
    return "recent";
  }
  return "archive";
}

function threadRecencyBadge(session) {
  return t(`chat.${threadRecencyKind(session)}`);
}

function threadExecutionKind(session) {
  const status = String(session.goalRunStatus || "").toLowerCase();
  if (["active", "paused", "blocked", "failed", "criteria_met"].includes(status)) {
    return status;
  }
  return session.hasGoalContract ? "active" : "";
}

function threadExecutionBadgeClass(kind) {
  switch (kind) {
    case "blocked":
    case "failed":
      return statusBadgeClass("denied");
    case "paused":
      return statusBadgeClass("manual_check");
    case "criteria_met":
      return statusBadgeClass("granted");
    case "active":
      return sourceBadgeClass("live");
    default:
      return sourceBadgeClass("seeded");
  }
}

function threadSectionId(session) {
  if (session.isCurrent) {
    return "current";
  }
  const executionKind = threadExecutionKind(session);
  if (executionKind === "blocked" || executionKind === "failed") {
    return "attention";
  }
  if (executionKind === "active" || executionKind === "paused") {
    return "active";
  }
  return threadRecencyKind(session) === "archive" ? "archive" : "recent";
}

function threadSectionTitle(sectionId) {
  switch (sectionId) {
    case "current":
      return t("chat.current");
    case "active":
      return `${goalLabel()} · ${uiCopy("goal.status_active")} / ${uiCopy("goal.status_paused")}`;
    case "attention":
      return `${goalLabel()} · ${uiCopy("goal.status_blocked")} / ${uiCopy("goal.status_failed")}`;
    default:
      return sectionId === "archive" ? t("chat.archive") : t("chat.recent");
  }
}

function threadRoleLabel(role) {
  switch (String(role || "").toLowerCase()) {
    case "assistant":
      return productName();
    case "user":
      return t("chat.you");
    case "toolresult":
    case "tool":
      return t("chat.tool");
    case "bashexecution":
      return t("chat.bash");
    case "custom":
      return t("chat.custom");
    default:
      return "";
  }
}

function groupedThreadSections(sessions) {
  const buckets = new Map([
    ["current", []],
    ["active", []],
    ["attention", []],
    ["recent", []],
    ["archive", []],
  ]);
  for (const session of sessions || []) {
    buckets.get(threadSectionId(session))?.push(session);
  }
  return Array.from(buckets.entries())
    .map(([id, items]) => ({ id, title: threadSectionTitle(id), items }))
    .filter((section) => section.items.length);
}

function renderThreadRow(session, index, options = {}) {
  const compact = Boolean(options.compact);
  const defaultAgentId = options.defaultAgentId || desktopDefaultAgentId();
  const badges = [];
  const recencyKind = threadRecencyKind(session);
  const recency = t(`chat.${recencyKind}`);
  const executionKind = threadExecutionKind(session);
  const executionLabel = executionKind ? goalRunStatusLabel(executionKind) : "";
  if (executionLabel) {
    badges.push(`<span class="badge ${threadExecutionBadgeClass(executionKind)}">${escapeHtml(`${goalLabel()} · ${executionLabel}`)}</span>`);
  }
  badges.push(`<span class="badge ${session.isCurrent ? sourceBadgeClass("live") : recencyKind === "hot" ? actionBadgeClass("actionable") : recencyKind === "recent" ? sourceBadgeClass("seeded") : statusBadgeClass("manual_check")}">${escapeHtml(recency)}</span>`);
  if (session.agentId) {
    const laneClass = session.agentId === defaultAgentId ? sourceBadgeClass("seeded") : sourceBadgeClass("live");
    badges.push(`<span class="badge ${laneClass}">${escapeHtml(displayAgentName(session.agentId))}</span>`);
  }
  if (session.messageCount) {
    badges.push(`<span class="badge">${escapeHtml(`${session.messageCount} ${t("chat.messages")}`)}</span>`);
  }
  if (session.sizeBytes) {
    badges.push(`<span class="badge">${escapeHtml(formatBytes(session.sizeBytes))}</span>`);
  }
  const roleLabel = threadRoleLabel(session.lastRole);
  const previewCopy = [roleLabel, executionLabel, session.preview].filter(Boolean).join(" · ");
  return `
    <button class="mini-row thread-row ${compact ? "compact" : ""} ${session.isCurrent ? "current" : ""} ${executionKind ? `thread-state-${executionKind}` : "thread-state-idle"}" type="button" onclick="openSessionByIndex(${index})">
      <div class="mini-row-copy">
        <strong>${escapeHtml(session.name)}</strong>
        <span>${escapeHtml(formatRelativeTime(session.modifiedAt))} · ${escapeHtml(formatTimestamp(session.modifiedAt))}</span>
        ${previewCopy ? `<small>${escapeHtml(previewCopy)}</small>` : ""}
      </div>
      <div class="row-actions">
        ${badges.join("")}
      </div>
    </button>
  `;
}

function renderChatThreadRail(sessions, activeAgentId, defaultAgentId, sessionState) {
  const agents = availableAgentProfiles();
  const sections = groupedThreadSections(sessions.slice(0, 10));
  return `
    <aside class="chat-thread-rail">
      <section class="surface-card rail-surface">
        <div class="surface-header tight">
          <div>
            <div class="section-kicker">${escapeHtml(t("chat.conversation_deck"))}</div>
            <h2>${escapeHtml(t("chat.threads"))}</h2>
          </div>
        </div>
        ${sessions.length ? `
          <div class="rail-scroll thread-scroll">
            <div class="thread-list">
              ${sections.map((section) => `
                <section class="thread-section">
                  <div class="thread-section-title">${escapeHtml(section.title)}</div>
                  <div class="mini-list">
                    ${section.items.map((session) => renderThreadRow(session, sessions.indexOf(session), { defaultAgentId })).join("")}
                  </div>
                </section>
              `).join("")}
            </div>
          </div>
        ` : `
          <div class="empty-inline">
            <strong>${escapeHtml(t("chat.no_threads_title"))}</strong>
            <p>${escapeHtml(t("chat.no_threads_desc"))}</p>
          </div>
        `}
        <div class="button-row compact rail-actions">
          <button class="button secondary small" type="button" onclick="startNewSession()">${escapeHtml(t("actions.new_chat"))}</button>
          <button class="button ghost small" type="button" onclick="selectTab('sessions')">${escapeHtml(t("actions.open_sessions"))}</button>
        </div>
      </section>

      <section class="surface-card rail-surface">
        <div class="surface-header tight">
          <div>
            <div class="section-kicker">${escapeHtml(t("chat.agent_lanes"))}</div>
            <h2>${escapeHtml(t("chat.profiles"))}</h2>
          </div>
        </div>
        <div class="rail-scroll lane-scroll">
          <div class="profile-switch-grid">
            ${agents.map((agent) => `
              <button class="choice ${activeAgentId === agent.id ? "selected" : ""}" type="button" onclick="applyChatAgentProfile('${agent.id}')">
                <strong>${escapeHtml(agent.displayName)}</strong>
                <p>${escapeHtml(agent.description)}</p>
                <span>${escapeHtml(activeAgentId === agent.id ? t("chat.active_thread_lane") : t("chat.assign_to_thread"))}</span>
              </button>
            `).join("")}
          </div>
        </div>
        <div class="field-note">${escapeHtml(t("chat.use_thread_switcher"))}</div>
      </section>
    </aside>
  `;
}

function renderChatContextRail(sessionState, sessionStats, provider, model, activeAgentId, defaultAgentId) {
  const currentAgent = agentSummaryById(activeAgentId) || currentAgentProfileDraft();
  const currentAgentName = currentAgent.displayName || displayAgentName(activeAgentId);
  const currentAgentPacks = agentStarterPackEntries(currentAgent);
  const attachedPacks = currentAgentPacks.filter((entry) => entry.coverage.status === "attached");
  const partialPacks = currentAgentPacks.filter((entry) => entry.coverage.status === "partial");
  const host = hostState();
  const goalContract = sessionState?.goalContract || null;
  const goalRun = sessionState?.goalRun || null;
  const goalStatus = goalRunStatusLabel(goalRun?.status);
  return `
    <aside class="chat-context-rail">
      <section class="surface-card context-panel">
        <div class="surface-header tight">
          <div>
            <div class="section-kicker">${escapeHtml(t("chat.live_session"))}</div>
            <h2>${escapeHtml(t("chat.context"))}</h2>
          </div>
          <div class="badge-row">
            <span class="badge ${sourceBadgeClass("live")}">${escapeHtml(providerLabels[provider] || provider || t("common.pending"))}</span>
            <span class="badge">${escapeHtml(displayAgentName(activeAgentId))}</span>
          </div>
        </div>
        <div class="detail-list compact">
          <div class="detail-row"><span>${escapeHtml(t("meta.provider"))}</span><strong>${escapeHtml(providerLabels[provider] || provider || t("common.pending"))}</strong></div>
          <div class="detail-row"><span>${escapeHtml(t("meta.model"))}</span><strong>${escapeHtml(model || t("common.pending"))}</strong></div>
          <div class="detail-row"><span>${escapeHtml(t("chat.thread_lane"))}</span><strong>${escapeHtml(displayAgentName(activeAgentId))}</strong></div>
          <div class="detail-row"><span>${escapeHtml(t("chat.desktop_default"))}</span><strong>${escapeHtml(displayAgentName(defaultAgentId))}</strong></div>
          <div class="detail-row"><span>${escapeHtml(t("chat.backend"))}</span><strong>${escapeHtml(backendStatusLabel())}</strong></div>
          <div class="detail-row"><span>${escapeHtml(t("chat.messages"))}</span><strong>${escapeHtml(String(sessionState.messageCount || 0))}</strong></div>
          <div class="detail-row"><span>${escapeHtml(t("chat.branches"))}</span><strong>${escapeHtml(String(sessionStats.branchCount || 0))}</strong></div>
          <div class="detail-row"><span>${escapeHtml(t("chat.session_id"))}</span><strong class="mono">${escapeHtml(sessionState.sessionId || t("common.pending"))}</strong></div>
          ${goalContract ? `<div class="detail-row"><span>${escapeHtml(goalLabel())}</span><strong>${escapeHtml(goalContract.title || shorten(goalContract.goal || "", 40))}</strong></div>` : ""}
          ${goalContract ? `<div class="detail-row"><span>${escapeHtml(uiCopy("goal.criteria"))}</span><strong>${escapeHtml(goalCriteriaSummary(sessionState) || String((goalContract.criteria || []).length))}${goalStatus ? ` · ${escapeHtml(goalStatus)}` : ""}</strong></div>` : ""}
        </div>
        <div class="field inline-session-field">
          <label for="session-name">${escapeHtml(t("chat.session_name"))}</label>
          <input id="session-name" value="${escapeHtml(state.sessionDraftName || "")}" oninput="updateSessionDraft(this.value)" placeholder="${escapeHtml(t("chat.rename_current_session"))}" />
        </div>
        <div class="button-row compact">
          <button class="button secondary small" type="button" onclick="saveSessionName()">${escapeHtml(t("chat.save_name"))}</button>
          <button class="button secondary small" type="button" onclick="openCurrentSession()">${escapeHtml(t("chat.open_session"))}</button>
          <button class="button ghost small" type="button" onclick="exportCurrentSession()">${escapeHtml(uiCopy("common.exportHtml"))}</button>
        </div>
      </section>

      ${renderGoalContractPanel(sessionState)}

      <section class="surface-card profile-context-panel">
        <div class="surface-header tight">
          <div>
            <div class="section-kicker">${escapeHtml(t("chat.chat_posture"))}</div>
            <h2>${escapeHtml(t("chat.active_profile"))}</h2>
          </div>
          <div class="badge-row">
            <span class="badge ${sourceBadgeClass("live")}">${escapeHtml(currentAgentName)}</span>
            <span class="badge ${currentAgent.hasCustomizations ? sourceBadgeClass("live") : sourceBadgeClass("seeded")}">${currentAgent.hasCustomizations ? escapeHtml(t("agents_panel.customized")) : escapeHtml(t("agents_panel.shipped"))}</span>
          </div>
        </div>
        <div class="detail-list compact">
          <div class="detail-row"><span>${escapeHtml(t("meta.description"))}</span><strong>${escapeHtml(currentAgent.description || t("meta.no_description"))}</strong></div>
          <div class="detail-row"><span>${escapeHtml(t("meta.mode"))}</span><strong>${escapeHtml(currentAgent.modeLabel || t("agents_panel.follow_global_model"))}</strong></div>
          <div class="detail-row"><span>${escapeHtml(t("agents_panel.selected_skills"))}</span><strong>${escapeHtml(String((currentAgent.skills || []).length))}</strong></div>
          <div class="detail-row"><span>${escapeHtml(t("chat.packs_in_use"))}</span><strong>${escapeHtml(`${attachedPacks.length} ${t("chat.attached")}${partialPacks.length ? ` · ${partialPacks.length} ${t("chat.partial")}` : ""}`)}</strong></div>
        </div>
        ${currentAgentPacks.length ? `
          <div class="pack-chip-row">
            ${currentAgentPacks.slice(0, 4).map((entry) => `
              <span class="pack-chip ${entry.coverage.status === "attached" ? "attached" : entry.coverage.status === "partial" ? "partial" : ""}">
                ${escapeHtml(entry.title || entry.id)}
                <small>${escapeHtml(`${entry.coverage.matched}/${entry.coverage.total}`)}</small>
              </span>
            `).join("")}
          </div>
        ` : `
          <div class="empty-inline compact-empty">
            <strong>${escapeHtml(t("chat.no_pack_title"))}</strong>
            <p>${escapeHtml(t("chat.no_pack_desc"))}</p>
          </div>
        `}
        <div class="profile-switch-grid compact-grid lane-grid">
          ${availableAgentProfiles().map((agent) => `
            <button class="choice compact-choice ${activeAgentId === agent.id ? "selected" : ""}" type="button" onclick="applyChatAgentProfile('${agent.id}')">
              <strong>${escapeHtml(agent.displayName)}</strong>
              <p>${escapeHtml(agent.description || t("chat.active_profile"))}</p>
              <span>${escapeHtml(activeAgentId === agent.id ? t("chat.active_thread_lane") : t("chat.assign_to_thread"))}</span>
            </button>
          `).join("")}
        </div>
        <div class="button-row">
          <button class="button secondary small" type="button" onclick="selectTab('agents')">${escapeHtml(t("chat.edit_profiles"))}</button>
          <button class="button ghost small" type="button" onclick="selectTab('skills')">${escapeHtml(t("chat.manage_skills"))}</button>
        </div>
      </section>

      <section class="surface-card">
        <div class="surface-header tight">
          <div>
            <div class="section-kicker">${escapeHtml(t("chat.surface_handoff"))}</div>
            <h2>${escapeHtml(t("chat.where_to_work"))}</h2>
          </div>
        </div>
        <div class="detail-list compact">
          <div class="detail-row"><span>${escapeHtml(t("chat.preferred_surface"))}</span><strong>${escapeHtml(host.preferredSurface === "web" ? t("chat.open_web_in_app") : t("chat.native_chat"))}</strong></div>
          <div class="detail-row"><span>${escapeHtml(t("chat.web_url"))}</span><strong class="mono">${escapeHtml(host.webWorkspaceURL || uiCopy("common.notConfigured"))}</strong></div>
          <div class="detail-row"><span>${escapeHtml(t("chat.bridge"))}</span><strong>${escapeHtml(host.webBridgeRunning ? t("common.connected") : t("common.booting"))}</strong></div>
        </div>
        <div class="button-row">
          <button class="button secondary small" type="button" onclick="openChatWorkspace()">${escapeHtml(t("chat.native_chat"))}</button>
          <button class="button secondary small" type="button" onclick="switchDesktopSurface('web')">${escapeHtml(t("chat.open_web_in_app"))}</button>
          <button class="button ghost small" type="button" onclick="openWebWorkspaceExternal()">${escapeHtml(t("actions.open_in_browser"))}</button>
          <button class="button ghost small" type="button" onclick="openSessionsFolder()">${escapeHtml(t("chat.open_folder"))}</button>
        </div>
      </section>
    </aside>
  `;
}

function renderSetupFields(prefix) {
  const provider = state.onboarding.provider;
  const preset = providerPresetById(state.onboarding.providerPreset || provider);
  const providerConfig = currentProviderConfig();
  const currentModel = state.onboarding.model || recommendedModel(provider, preset.id);
  const agents = availableAgentProfiles();
  const modelListId = `${prefix}-models`;
  const copy = currentLocale() === "zh-CN"
    ? {
      provider: "Provider",
      manualConfig: "手动配置路径。",
      runtimeProviderId: "运行时 provider id：",
      resetPreset: "重置为预设默认值",
      providerId: "Provider ID",
      providerIdHelp: "作为运行时 provider id 使用，也作为认证存储里的凭证键。",
      presetProviderIdHelp: "由预设提供的运行时 provider id。",
      displayName: "显示名称",
      displayNamePlaceholder: "界面中显示的 provider 名称",
      displayNameHelp: "显示在桌面界面中。运行时仍使用上面的 provider id。",
      apiUrl: "API URL",
      apiUrlHelp: "可直接编辑，用于托管网关、企业代理或自建端点。",
      wireApi: "通信 API",
      wireApiHelp: "默认值来自所选预设。自定义 provider 可以显式切换协议。",
      model: "模型",
      modelPlaceholder: "选择或输入模型 id",
      modelHelp: "这里会同时显示预设默认模型与运行时实时模型，也支持手动输入模型 id。",
      agentHelp: `控制桌面客户端默认的${term("chat")}工作姿态。`,
      apiKey: "API Key",
      apiKeyPlaceholder: "留空可保留当前已保存的凭证",
      workspaceFolder: "工作区文件夹",
      workspacePlaceholder: "/path/to/your/project",
      workspaceHelp: "这个目录会成为打包 Pi 运行时的工作目录。",
      updatesHelp: "让共享桌面设置文件持续保持版本检查开启。",
      configFiles: "配置文件",
      savedCredentials: "已保存凭证",
      credentialSaved: `已检测到 ${providerConfig.providerLabel} 的保存凭证。留空 API key 即可继续使用。`,
      credentialMissing: "当前还没有已保存凭证。保存前请粘贴 API key。",
    }
    : currentLocale() === "ja-JP"
      ? {
        provider: "Provider",
        manualConfig: "手動設定パスです。",
        runtimeProviderId: "ランタイム provider id:",
        resetPreset: "プリセット既定値へ戻す",
        providerId: "Provider ID",
        providerIdHelp: "ランタイム provider id として使われ、認証ストア内の資格情報キーにもなります。",
        presetProviderIdHelp: "プリセットに紐づくランタイム provider id です。",
        displayName: "表示名",
        displayNamePlaceholder: "UI に表示する provider 名",
        displayNameHelp: "デスクトップ UI に表示されます。ランタイムは上の provider id を使います。",
        apiUrl: "API URL",
        apiUrlHelp: "ホスト型ゲートウェイ、企業プロキシ、自前エンドポイント向けに直接編集できます。",
        wireApi: "通信 API",
        wireApiHelp: "既定値は選択中のプリセットに従います。カスタム provider は明示的に切り替えられます。",
        model: "モデル",
        modelPlaceholder: "モデル id を選択または入力",
        modelHelp: "プリセット既定モデルとライブランタイムモデルの両方が表示され、手入力も可能です。",
        agentHelp: `デスクトップクライアントの既定${term("chat")}姿勢を制御します。`,
        apiKey: "API Key",
        apiKeyPlaceholder: "現在保存されている資格情報を保持する場合は空欄",
        workspaceFolder: "ワークスペースフォルダ",
        workspacePlaceholder: "/path/to/your/project",
        workspaceHelp: "このフォルダが同梱 Pi ランタイムの作業ディレクトリになります。",
        updatesHelp: "共有デスクトップ設定ファイルで更新確認を有効なまま維持します。",
        configFiles: "設定ファイル",
        savedCredentials: "保存済み資格情報",
        credentialSaved: `${providerConfig.providerLabel} の保存済み資格情報を検出しました。API key を空欄にするとそのまま使います。`,
        credentialMissing: "まだ保存済み資格情報はありません。保存前に API key を貼り付けてください。",
      }
      : {
        provider: "Provider",
        manualConfig: "Manual configuration path.",
        runtimeProviderId: "Runtime provider id:",
        resetPreset: "Reset To Preset Defaults",
        providerId: "Provider ID",
        providerIdHelp: "Used as the runtime provider id and the credential key in auth storage.",
        presetProviderIdHelp: "Preset-backed runtime provider id.",
        displayName: "Display name",
        displayNamePlaceholder: "Visible provider label",
        displayNameHelp: "Shown in the desktop UI. Runtime uses the provider id above.",
        apiUrl: "API URL",
        apiUrlHelp: "Directly editable for hosted gateways, enterprise proxies, or self-hosted endpoints.",
        wireApi: "Wire API",
        wireApiHelp: "Defaults come from the selected preset. Custom providers can switch protocol explicitly.",
        model: "Model",
        modelPlaceholder: "Select or type a model id",
        modelHelp: "Preset defaults and live runtime models both appear here. Manual model ids are supported.",
        agentHelp: `This controls the default ${term("chat").toLowerCase()} posture for the desktop client.`,
        apiKey: "API key",
        apiKeyPlaceholder: "Leave blank to keep the currently saved credential",
        workspaceFolder: "Workspace folder",
        workspacePlaceholder: "/path/to/your/project",
        workspaceHelp: "This folder becomes the working directory for the bundled Pi runtime.",
        updatesHelp: "Keep release checking enabled inside the shared desktop settings file.",
        configFiles: "Config files",
        savedCredentials: "Saved credentials",
        credentialSaved: `Saved credential detected for ${providerConfig.providerLabel}. Leave API key blank to keep it.`,
        credentialMissing: "No saved credential exists yet. Paste an API key before saving.",
      };
  const credentialNote = providerConfig.hasSavedCredential
    ? copy.credentialSaved
    : copy.credentialMissing;
  const protocolOptions = [
    "anthropic-messages",
    "openai-responses",
    "openai-completions",
    "google-generative-ai",
    "cohere-chat",
  ];

  return `
    <div class="field">
      <label>${escapeHtml(copy.provider)}</label>
      <div class="choice-grid">
        ${providerPresets().map((providerPreset) => `
          <button type="button" class="choice ${state.onboarding.providerPreset === providerPreset.id ? "selected" : ""}" onclick="selectProviderPreset('${providerPreset.id}')">
            <strong>${escapeHtml(providerPreset.label)}</strong>
            <p>${escapeHtml(localizedProviderDescription(providerPreset.id, providerPreset.description || providerDescriptions[providerPreset.id] || copy.manualConfig))}</p>
          </button>
        `).join("")}
      </div>
      <div class="field-note">${escapeHtml(copy.runtimeProviderId)} <span class="mono">${escapeHtml(state.onboarding.provider || preset.runtimeProviderId)}</span></div>
      <div class="button-row compact">
        <button class="button ghost small" type="button" onclick="resetProviderPresetConfig()">${escapeHtml(copy.resetPreset)}</button>
      </div>
    </div>

    <div class="form-grid two">
      ${preset.id === "custom" ? `
        <div class="field">
          <label for="${prefix}-provider-id">${escapeHtml(copy.providerId)}</label>
          <input
            id="${prefix}-provider-id"
            value="${escapeHtml(state.onboarding.provider || preset.runtimeProviderId)}"
            oninput="updateField('provider', this.value)"
            placeholder="custom-openai"
          />
          <div class="field-note">${escapeHtml(copy.providerIdHelp)}</div>
        </div>
      ` : `
        <div class="field">
          <label for="${prefix}-provider-id">${escapeHtml(copy.providerId)}</label>
          <input
            id="${prefix}-provider-id"
            value="${escapeHtml(state.onboarding.provider || preset.runtimeProviderId)}"
            disabled
          />
          <div class="field-note">${escapeHtml(copy.presetProviderIdHelp)}</div>
        </div>
      `}

      <div class="field">
        <label for="${prefix}-provider-label">${escapeHtml(copy.displayName)}</label>
        <input
          id="${prefix}-provider-label"
          value="${escapeHtml(state.onboarding.providerLabel || preset.label)}"
          oninput="updateField('providerLabel', this.value)"
          placeholder="${escapeHtml(copy.displayNamePlaceholder)}"
        />
        <div class="field-note">${escapeHtml(copy.displayNameHelp)}</div>
      </div>
    </div>

    <div class="form-grid two">
      <div class="field">
        <label for="${prefix}-api-url">${escapeHtml(copy.apiUrl)}</label>
        <input
          id="${prefix}-api-url"
          value="${escapeHtml(state.onboarding.apiBaseURL || preset.apiBaseURL)}"
          oninput="updateField('apiBaseURL', this.value)"
          placeholder="https://api.example.com/v1"
        />
        <div class="field-note">${escapeHtml(copy.apiUrlHelp)}</div>
      </div>

      <div class="field">
        <label for="${prefix}-api-protocol">${escapeHtml(copy.wireApi)}</label>
        <select id="${prefix}-api-protocol" onchange="updateField('apiProtocol', this.value)">
          ${protocolOptions.map((protocol) => `
            <option value="${escapeHtml(protocol)}" ${state.onboarding.apiProtocol === protocol ? "selected" : ""}>${escapeHtml(protocol)}</option>
          `).join("")}
        </select>
        <div class="field-note">${escapeHtml(copy.wireApiHelp)}</div>
      </div>
    </div>

    <div class="form-grid two">
      <div class="field">
        <label for="${prefix}-model">${escapeHtml(copy.model)}</label>
        <input
          id="${prefix}-model"
          list="${modelListId}"
          value="${escapeHtml(currentModel)}"
          oninput="updateField('model', this.value)"
          placeholder="${escapeHtml(copy.modelPlaceholder)}"
        />
        ${renderModelDatalist(modelListId, provider)}
        <div class="field-note">${escapeHtml(copy.modelHelp)}</div>
        ${renderSuggestedModels(provider)}
      </div>

      <div class="field">
        <label for="${prefix}-agent">${escapeHtml(`${t("chat.desktop_default")} ${term("agent")}`)}</label>
        <select id="${prefix}-agent" onchange="selectAgent(this.value)">
          ${agents.map((agent) => `
            <option value="${escapeHtml(agent.id)}" ${state.onboarding.starterAgent === agent.id ? "selected" : ""}>
              ${escapeHtml(agent.displayName)}
            </option>
          `).join("")}
        </select>
        <div class="field-note">${escapeHtml(copy.agentHelp)}</div>
      </div>
    </div>

    <div class="form-grid two">
      <div class="field">
        <label for="${prefix}-api-key">${escapeHtml(copy.apiKey)}</label>
        <input
          id="${prefix}-api-key"
          type="password"
          value="${escapeHtml(state.onboarding.apiKey)}"
          oninput="updateField('apiKey', this.value)"
          placeholder="${escapeHtml(copy.apiKeyPlaceholder)}"
        />
        <div class="field-note">${escapeHtml(credentialNote)}</div>
      </div>

      <div class="field">
        <label for="${prefix}-workspace">${escapeHtml(copy.workspaceFolder)}</label>
        <input
          id="${prefix}-workspace"
          value="${escapeHtml(state.onboarding.workspacePath || "")}"
          oninput="updateField('workspacePath', this.value)"
          placeholder="${escapeHtml(copy.workspacePlaceholder)}"
        />
        <div class="field-note">${escapeHtml(copy.workspaceHelp)}</div>
      </div>
    </div>

    <div class="form-grid two">
      <label class="toggle-row">
        <input
          type="checkbox"
          ${state.onboarding.checkForUpdates !== false ? "checked" : ""}
          onchange="updateField('checkForUpdates', this.checked)"
        />
        <span>
          <strong>${escapeHtml(t("actions.check_updates"))}</strong>
          <small>${escapeHtml(copy.updatesHelp)}</small>
        </span>
      </label>

      <div class="field subtle-field">
        <label>${escapeHtml(copy.configFiles)}</label>
        <div class="detail-list compact">
          <div class="detail-row"><span>${escapeHtml(t("meta.auth_file"))}</span><strong class="mono">${escapeHtml(state.bootstrap?.authPath || "")}</strong></div>
          <div class="detail-row"><span>${escapeHtml(copy.model)}</span><strong class="mono">${escapeHtml(providerConfig.modelsPath || state.bootstrap?.modelsPath || "")}</strong></div>
        </div>
      </div>
    </div>

    <div class="field">
      <label>${escapeHtml(copy.savedCredentials)}</label>
      ${renderCredentialInventory(providerConfig)}
    </div>

    ${renderReadinessPanel()}
  `;
}

function renderLoading() {
  return `
    <div class="shell fallback-shell">
      <section class="card panel narrow">
        <div class="eyebrow">${escapeHtml(productName())}</div>
        <h1>${escapeHtml(currentLocale() === "zh-CN" ? "正在启动桌面客户端..." : currentLocale() === "ja-JP" ? "デスクトップクライアントを起動しています..." : "Starting desktop client...")}</h1>
        <p class="panel-subtitle">${escapeHtml(currentLocale() === "zh-CN"
          ? "正在准备原生 macOS 外壳、本地 WebView 和打包的 Pi 运行时。"
          : currentLocale() === "ja-JP"
            ? "ネイティブ macOS シェル、ローカル WebView、同梱された Pi ランタイムを準備しています。"
            : "Preparing the native macOS shell, the local WebView, and the bundled Pi runtime.")}</p>
      </section>
    </div>
  `;
}

function renderOnboarding() {
  const agents = availableAgentProfiles();
  const canImport = state.bootstrap?.importCandidate?.available;
  const readiness = providerReadiness();

  return `
    <div class="shell onboarding-shell">
      <section class="card hero-panel">
        <div class="hero-copy">
          <div>
            <div class="eyebrow">${escapeHtml(t("onboarding.eyebrow"))}</div>
            <h1>${escapeHtml(t("onboarding.hero_title"))}</h1>
            <p>${escapeHtml(t("onboarding.hero_desc"))}</p>
          </div>

          <div class="hero-metrics">
            <div class="metric-card">
              <strong>${escapeHtml(t("onboarding.normal_app"))}</strong>
              <span>${escapeHtml(t("onboarding.normal_app_desc"))}</span>
            </div>
            <div class="metric-card">
              <strong>${escapeHtml(t("onboarding.config_clarity"))}</strong>
              <span>${escapeHtml(t("onboarding.config_clarity_desc"))}</span>
            </div>
            <div class="metric-card">
              <strong>${escapeHtml(t("onboarding.real_backend"))}</strong>
              <span>${escapeHtml(t("onboarding.real_backend_desc"))}</span>
            </div>
          </div>
        </div>
      </section>

      <section class="card panel">
        <div class="step-row">
          <span class="step-pill active">${escapeHtml(t("onboarding.provider_step"))}</span>
          <span class="step-pill active">${escapeHtml(t("onboarding.model_step"))}</span>
          <span class="step-pill active">${escapeHtml(t("onboarding.profile_step"))}</span>
        </div>
        <h1>${escapeHtml(t("onboarding.get_started"))}</h1>
        <p class="panel-subtitle">${escapeHtml(t("onboarding.get_started_desc"))}</p>

        ${renderExperienceControls(true)}

        <form onsubmit="saveOnboarding(event)">
          ${renderSetupFields("onboarding")}

          <div class="field">
            <label>${escapeHtml(t("onboarding.starter_profiles"))}</label>
            <div class="choice-grid">
              ${agents.map((agent) => `
                <button type="button" class="choice ${state.onboarding.starterAgent === agent.id ? "selected" : ""}" onclick="selectAgent('${agent.id}')">
                  <strong>${escapeHtml(agent.displayName)}</strong>
                  <p>${escapeHtml(agent.description)}</p>
                  <span>${escapeHtml(agent.modeLabel)}</span>
                </button>
              `).join("")}
            </div>
          </div>

          <div class="button-row">
            <button class="button secondary" type="button" onclick="chooseWorkspace()">${escapeHtml(t("actions.choose_folder"))}</button>
            ${canImport ? `<button class="button ghost" type="button" onclick="importExistingSetup()">${escapeHtml(t("actions.import_existing_setup"))}</button>` : ""}
            <button class="button primary" type="submit" ${readiness.ready ? "" : "disabled"}>${escapeHtml(t("actions.start_chatting"))}</button>
          </div>
        </form>

        <div class="status-line ${state.statusKind}">${escapeHtml(state.status || "")}</div>
      </section>
    </div>
  `;
}

function renderMessageStream() {
  if (!state.messages.length) {
    return `
      <div class="empty-state rich-empty">
        <div>
          <h2>${escapeHtml(t("chat.workspace_ready_title"))}</h2>
          <p>${escapeHtml(t("chat.workspace_ready_desc"))}</p>
          <div class="suggestion-row">
            ${localizedPromptSuggestions().map((prompt) => `
              <button class="suggestion-chip" type="button" onclick="applyPromptSuggestion('${escapeJsSingle(prompt)}')">${escapeHtml(prompt)}</button>
            `).join("")}
          </div>
        </div>
      </div>
    `;
  }

  return state.messages
    .map((message) => `
      <article class="message ${message.role}">
        <header>
          <strong>${escapeHtml(message.label || threadRoleLabel(message.role) || capitalize(message.role))}</strong>
          <span>${message.role === "assistant" && state.pendingAssistantId === message.id ? escapeHtml(t("chat.streaming")) : isPendingUserMessage(message) ? escapeHtml(t("common.pending")) : ""}</span>
        </header>
        <div class="${messageFrameClass(message)}">
          ${renderMessageMeta(message)}
          ${renderStructuredMessageBody(message)}
          ${renderMessageAttachments(message)}
          ${message.tools?.length ? `
            <div class="tool-strip">
              ${message.tools.map((tool) => `<span class="tool-pill">${escapeHtml(tool)}</span>`).join("")}
            </div>
          ` : ""}
        </div>
      </article>
    `)
    .join("");
}

function renderChatTab() {
  const bootstrap = state.bootstrap || {};
  const providerConfig = currentProviderConfig();
  const provider = providerConfig.providerId || bootstrap.provider || state.onboarding.provider;
  const model = providerConfig.model || bootstrap.model || state.onboarding.model;
  const starterAgent = desktopDefaultAgentId();
  const activeAgentId = activeChatAgentId();
  const sessionState = state.sessionState || {};
  const sessionStats = state.sessionStats || {};
  const sessions = bootstrap.sessions || [];
  const selectedModel = state.availableModels.length
    ? modelsForProvider(provider).some((entry) => entry.id === model)
      ? `${provider}::${model}`
      : ""
    : "";

  return `
    <div class="content-body">
      <section class="surface-card chat-shell-card">
        <div class="chat-shell-head">
          <div class="chat-shell-masthead">
            <div class="chat-shell-copy">
              <div class="section-kicker">${escapeHtml(t("chat.primary_surface"))}</div>
              <h2>${escapeHtml(t("chat.chat_first"))}</h2>
              <p>${escapeHtml(t("chat.chat_first_desc"))}</p>
            </div>
            ${renderChatSignalGrid(sessionState, provider, model, activeAgentId)}
          </div>
          <div class="chat-shell-actions">
            <button class="button secondary small" type="button" onclick="startNewSession()">${escapeHtml(t("actions.new_chat"))}</button>
            <button class="button ghost small" type="button" onclick="selectTab('settings')">${escapeHtml(t("chat.model_and_defaults"))}</button>
          </div>
        </div>

        <div class="chat-meta-bar chat-meta-band">
          <span class="badge ${sourceBadgeClass("live")}">${escapeHtml(sessionState.sessionName || sessionState.sessionId || `${t("common.pending")} ${term("session")}`)}</span>
          <span class="badge">${escapeHtml(displayAgentName(activeAgentId))}</span>
          <span class="badge">${escapeHtml(`${providerLabels[provider] || provider || t("meta.provider")} · ${model || t("chat.choose_live_model")}`)}</span>
          ${renderGoalBadge(sessionState)}
          <span class="badge ${backendStatusBadgeClass()}">${escapeHtml(backendStatusLabel())}</span>
        </div>

        <div class="chat-workspace">
          ${renderChatThreadRail(sessions, activeAgentId, starterAgent, sessionState)}

          <section class="conversation-card immersive">
            <div class="conversation-topbar">
              <div class="cluster">
                <label for="session-model">${escapeHtml(t("chat.live_session_model"))}</label>
                <select id="session-model" onchange="changeSelectedModel(this.value)">
                  <option value="">${state.availableModels.length ? escapeHtml(t("chat.choose_live_model")) : `${provider}/${model || uiCopy("common.manual")}`}</option>
                  ${availableProviders().map((providerId) => `
                    <optgroup label="${escapeHtml(providerLabels[providerId] || capitalize(providerId))}">
                      ${modelSuggestions(providerId).map((modelId) => `
                        <option value="${escapeHtml(`${providerId}::${modelId}`)}" ${selectedModel === `${providerId}::${modelId}` ? "selected" : ""}>
                          ${escapeHtml(modelId)}
                        </option>
                      `).join("")}
                    </optgroup>
                  `).join("")}
                </select>
              </div>

              <div class="header-actions">
                <button class="button ghost small" type="button" onclick="openChatWorkspace()">${escapeHtml(t("shell.open_chat"))}</button>
              </div>
            </div>

            ${renderConversationSpotlight(provider, model, activeAgentId, starterAgent, sessionState)}
            ${renderWorkbenchStateStrip(sessionState)}

            <div class="messages">${renderMessageStream()}</div>

            <form class="composer-card immersive" onsubmit="sendPrompt(event)">
              <div class="composer-strip">
                <div class="composer-toolbar">
                  <button class="button secondary small" type="button" onclick="pickComposerAttachments('any')">${escapeHtml(t("chat.attach_files"))}</button>
                  <button class="button secondary small" type="button" onclick="pickComposerAttachments('image')">${escapeHtml(t("chat.add_image"))}</button>
                  <button class="button ghost small" type="button" onclick="pickComposerAttachments('audio')">${escapeHtml(t("chat.add_audio"))}</button>
                  ${state.composerAttachments.length ? `<button class="button ghost small" type="button" onclick="clearComposerAttachments()">${escapeHtml(t("chat.clear_attachments"))}</button>` : ""}
                </div>
                <span class="badge ${backendStatusBadgeClass()}">${escapeHtml(backendStatusLabel())}</span>
              </div>

              <div class="composer-summary-row">
                <span class="badge ${sourceBadgeClass("live")}">${escapeHtml(displayAgentName(activeAgentId))}</span>
                <span class="badge">${escapeHtml(`${t("chat.desktop_default")}: ${displayAgentName(starterAgent)}`)}</span>
                <span class="badge">${escapeHtml(providerLabels[provider] || provider || t("meta.provider"))}</span>
                <span class="badge">${escapeHtml(model || t("chat.choose_live_model"))}</span>
                <span class="badge">${escapeHtml(`${state.composerAttachments.length} ${t("chat.pending_attachments")}`)}</span>
              </div>

              <div class="composer-input-stage">
                <div class="composer-stage-meta">
                  <div>
                    <div class="section-kicker">${escapeHtml(t("chat.composer"))}</div>
                    <strong class="composer-stage-title">${escapeHtml(t("chat.composer_title"))}</strong>
                  </div>
                  <p class="composer-stage-note">${escapeHtml(t("chat.composer_note"))}</p>
                </div>

                <textarea id="composer" placeholder="${escapeHtml(currentLocale() === "zh-CN"
                  ? "描述任务、请求审查、补充调试上下文，或把已附加的图片/文件发到下一轮。"
                  : currentLocale() === "ja-JP"
                    ? "作業内容やレビュー依頼、デバッグ文脈を入力し、添付した画像やファイルを次のターンへ送ってください。"
                    : "Describe the task, ask for a review, add debugging context, or send attached images/files into the next turn.")}"></textarea>
              </div>

              ${state.composerAttachments.length ? `
                <div class="composer-attachment-panel">
                  <div class="detail-row">
                    <span>${escapeHtml(t("chat.pending_attachments"))}</span>
                    <strong>${escapeHtml(String(state.composerAttachments.length))}</strong>
                  </div>
                  <div class="field-note">${escapeHtml(t("chat.attachment_note"))}</div>
                  ${renderAttachmentStrip(state.composerAttachments, { removable: true })}
                </div>
              ` : ""}
              <div class="composer-footer">
                <div class="suggestion-row compact">
                  ${localizedPromptSuggestions().map((prompt) => `
                    <button class="suggestion-chip" type="button" onclick="applyPromptSuggestion('${escapeJsSingle(prompt)}')">${escapeHtml(shorten(prompt, 48))}</button>
                  `).join("")}
                </div>
                <button class="button primary composer-send" type="submit">${escapeHtml(t("chat.send_prompt"))}</button>
              </div>
            </form>
          </section>

          ${renderChatContextRail(sessionState, sessionStats, provider, model, activeAgentId, starterAgent)}
        </div>
      </section>
    </div>
  `;
}

function renderSessionsTab() {
  const sessions = state.bootstrap?.sessions || [];
  return `
    <div class="content-body">
      <section class="surface-card">
        <div class="surface-header">
          <div>
            <div class="section-kicker">${escapeHtml(t("sessions_panel.live_library"))}</div>
            <h2>${escapeHtml(t("sessions_panel.desktop_sessions"))}</h2>
            <p>${escapeHtml(t("sessions_panel.desktop_sessions_desc"))}</p>
          </div>
          <div class="badge-row">
            <span class="badge ${actionBadgeClass("Actionable")}">${escapeHtml(t("common.actionable"))}</span>
            <span class="badge ${sourceBadgeClass("live")}">${escapeHtml(t("source.live_filesystem"))}</span>
          </div>
        </div>

        ${renderCompactMetaStrip([
          { label: t("sessions_panel.discovered_sessions"), value: sessions.length },
          { label: t("sessions_panel.active_message_count"), value: state.sessionState?.messageCount || 0 },
          { label: t("sessions_panel.storage_root"), value: state.bootstrap?.sessionPath || "", mono: true, wide: true }
        ])}

        <div class="button-row">
          <button class="button secondary small" type="button" onclick="startNewSession()">${escapeHtml(t("actions.new_chat"))}</button>
          <button class="button ghost small" type="button" onclick="openSessionsFolder()">${escapeHtml(t("sessions_panel.open_sessions_folder"))}</button>
        </div>

        <div class="list-stack">
          ${sessions.length ? sessions.map((session, index) => `
            <div class="list-row ${session.isCurrent ? "current" : ""}">
              <div class="list-row-main">
                <strong>${escapeHtml(session.name)}</strong>
                <div class="subtle">${escapeHtml(formatTimestamp(session.modifiedAt))} · ${escapeHtml(formatBytes(session.sizeBytes))}</div>
                ${session.preview ? `<div class="field-note">${threadRoleLabel(session.lastRole) ? `${escapeHtml(threadRoleLabel(session.lastRole))} · ` : ""}${escapeHtml(session.preview)}</div>` : ""}
                <div class="mono">${escapeHtml(session.path)}</div>
              </div>
              <div class="row-actions">
                ${session.isCurrent ? `<span class="badge ${sourceBadgeClass("live")}">${escapeHtml(t("chat.current"))}</span>` : ""}
                ${session.messageCount ? `<span class="badge">${escapeHtml(`${session.messageCount} msgs`)}</span>` : ""}
                <button class="button secondary small" type="button" onclick="openSessionByIndex(${index})">${escapeHtml(t("sessions_panel.open"))}</button>
              </div>
            </div>
          `).join("") : `
            <div class="empty-state">
              <div>
                <h2>${escapeHtml(t("sessions_panel.no_saved_title"))}</h2>
                <p>${escapeHtml(t("sessions_panel.no_saved_desc"))}</p>
              </div>
            </div>
          `}
        </div>
      </section>
    </div>
  `;
}

function renderAgentsTab() {
  const agents = availableAgentProfiles();
  const active = state.onboarding.starterAgent;
  const draft = currentAgentProfileDraft();
  const skillNames = skillOptionNames();
  const starterPacks = agentStarterPackEntries(draft);
  const attachedStarterPacks = starterPacks.filter((entry) => entry.coverage.status === "attached").length;
  const copy = currentLocale() === "zh-CN"
    ? {
      desktopDefault: "桌面默认",
      mode: "模式",
      skills: "技能",
      note: "全局技能命令发现由 Skills 页面控制。这里显示的 bundle 只代表附加到当前分工的额外技能集合。",
      perAgentBundle: "单分工技能包",
      description: "描述",
      providerOverride: "Provider 覆盖",
      modelOverride: "Model 覆盖",
      globalCommands: "全局命令",
      currentScope: "当前范围",
      starterPacksAttached: "已附加入门包",
      starterPacks: "入门包",
      packCoverageSuffix: "技能包覆盖",
      bundled: "内置",
      attachedCount: "{count} 已附加",
      starterPackFallback: "入门包",
      globalInstall: "全局",
      projectInstall: "项目",
      workflowTags: "工作流标签",
      general: "通用",
      reattachPack: "重新附加技能包",
      attachPack: "附加技能包",
      openSkillsCatalog: "打开技能目录",
      noPackTitle: "还没有内置入门包暴露命名技能。",
      noPackDesc: "在内置包暴露技能元数据之前，这个编辑器会继续显示原始技能列表。",
      shippedBundle: "属于内置分工包",
      activeOnly: "仅在当前分工激活时启用。",
      noSkillCatalogTitle: "还没有发现技能目录。",
      noSkillCatalogDesc: "先在 Skills 页面添加技能路径，再在这里把技能分配给具体分工。",
    }
    : currentLocale() === "ja-JP"
      ? {
        desktopDefault: "デスクトップ既定",
        mode: "モード",
        skills: "スキル",
        note: "グローバルなスキルコマンド探索は Skills タブで制御されます。ここに表示される bundle は、このエージェントに追加されたスキル集合だけです。",
        perAgentBundle: "エージェント別バンドル",
        description: "説明",
        providerOverride: "Provider 上書き",
        modelOverride: "Model 上書き",
        globalCommands: "グローバルコマンド",
        currentScope: "現在の範囲",
        starterPacksAttached: "適用済みスターターパック",
        starterPacks: "スターターパック",
        packCoverageSuffix: "パック適用状況",
        bundled: "同梱",
        attachedCount: "{count} 件適用済み",
        starterPackFallback: "スターターパック",
        globalInstall: "グローバル",
        projectInstall: "プロジェクト",
        workflowTags: "ワークフロータグ",
        general: "一般",
        reattachPack: "パックを再適用",
        attachPack: "パックを適用",
        openSkillsCatalog: "スキルカタログを開く",
        noPackTitle: "名前付きスキルを公開している同梱スターターパックはまだありません。",
        noPackDesc: "同梱パックがスキルメタデータを公開するまでは、このエディタは生のスキル一覧を表示し続けます。",
        shippedBundle: "同梱プロファイルバンドルに含まれます。",
        activeOnly: "このプロファイルが有効なときだけ有効です。",
        noSkillCatalogTitle: "検出済みスキルカタログはまだありません。",
        noSkillCatalogDesc: "まず Skills でスキルパスを追加し、その後ここで個別エージェントへ割り当ててください。",
      }
      : {
        desktopDefault: "Desktop default",
        mode: "Mode",
        skills: "Skills",
        note: "Global skill command discovery is controlled in Skills. The bundle shown here is only the extra skill set attached to this specific agent profile.",
        perAgentBundle: "Per-agent bundle",
        description: "Description",
        providerOverride: "Provider override",
        modelOverride: "Model override",
        globalCommands: "Global commands",
        currentScope: "Current scope",
        starterPacksAttached: "Starter packs attached",
        starterPacks: "Starter packs",
        packCoverageSuffix: "pack coverage",
        bundled: "Bundled",
        attachedCount: "{count} attached",
        starterPackFallback: "Starter pack",
        globalInstall: "Global",
        projectInstall: "Project",
        workflowTags: "Workflow tags",
        general: "General",
        reattachPack: "Re-attach Pack",
        attachPack: "Attach Pack",
        openSkillsCatalog: "Open Skills Catalog",
        noPackTitle: "No bundled starter packs exposed named skills yet.",
        noPackDesc: "The profile editor will continue to show the raw skill list until a bundled pack exposes skill metadata.",
        shippedBundle: "Included by the shipped profile bundle.",
        activeOnly: "Enabled only when this profile is active.",
        noSkillCatalogTitle: "No discovered skill catalog yet.",
        noSkillCatalogDesc: "Add skill paths in Skills first, then assign them to individual agents here.",
      };
  return `
    <div class="content-body">
      <section class="surface-card">
        <div class="surface-header">
          <div>
            <div class="section-kicker">${escapeHtml(t("agents_panel.desktop_roles"))}</div>
            <h2>${escapeHtml(t("agents_panel.agent_profiles"))}</h2>
            <p>${escapeHtml(t("agents_panel.agent_profiles_desc"))}</p>
          </div>
          <div class="badge-row">
            <span class="badge ${actionBadgeClass("Actionable")}">${escapeHtml(t("common.actionable"))}</span>
            <span class="badge ${sourceBadgeClass("live")}">${escapeHtml(t("source.global_settings"))}</span>
          </div>
        </div>

        ${renderCompactMetaStrip([
          { label: t("agents_panel.profile_count"), value: agents.length },
          { label: t("agents_panel.global_skill_commands"), value: skillsCatalog().enableSkillCommands !== false ? t("common.enabled") : t("common.disabled") },
          { label: t("agents_panel.default_profile"), value: capitalize(active || "main") }
        ])}

        <div class="card-grid">
          ${agents.map((agent) => `
            <article class="profile-card ${agent.id === active ? "selected" : ""}">
              <div class="profile-head">
                <div>
                  <h3>${escapeHtml(agent.displayName)}</h3>
                  <p>${escapeHtml(agent.description)}</p>
                </div>
                <div class="badge-row">
                  ${agent.id === active ? `<span class="badge ${sourceBadgeClass("live")}">${escapeHtml(copy.desktopDefault)}</span>` : ""}
                  <span class="badge ${agent.hasCustomizations ? sourceBadgeClass("live") : sourceBadgeClass("seeded")}">${agent.hasCustomizations ? escapeHtml(t("agents_panel.customized")) : escapeHtml(t("agents_panel.shipped"))}</span>
                </div>
              </div>
              <div class="detail-list compact">
                <div class="detail-row"><span>${escapeHtml(copy.mode)}</span><strong>${escapeHtml(agent.modeLabel)}</strong></div>
                <div class="detail-row"><span>${escapeHtml(t("agents_panel.skill_scope"))}</span><strong>${escapeHtml(agent.skillScope || "Global-only")}</strong></div>
                <div class="detail-row"><span>${escapeHtml(copy.skills)}</span><strong>${escapeHtml(agent.skills.length ? agent.skills.join(", ") : t("agents_panel.no_extra_skills"))}</strong></div>
              </div>
              <div class="field-note">
                ${escapeHtml(copy.note)}
              </div>
              <div class="button-row">
                <button class="button secondary small" type="button" onclick="setDefaultAgent('${agent.id}')">
                  ${agent.id === active ? escapeHtml(t("agents_panel.save_again")) : escapeHtml(t("agents_panel.set_as_default"))}
                </button>
                <button class="button ghost small" type="button" onclick="selectAgentProfileForEditing('${agent.id}')">${escapeHtml(t("agents_panel.edit_profile"))}</button>
              </div>
            </article>
          `).join("")}
        </div>
      </section>

      <section class="split-panel">
        <section class="surface-card">
          <div class="surface-header">
            <div>
              <div class="section-kicker">${escapeHtml(t("agents_panel.per_agent_bundle"))}</div>
              <h2>${escapeHtml(t("agents_panel.profile_editor"))}</h2>
              <p>${escapeHtml(t("agents_panel.profile_editor_desc"))}</p>
            </div>
          </div>

          <div class="form-grid two">
            <div class="field">
              <label for="agent-profile-select">${escapeHtml(t("agents_panel.profile"))}</label>
              <select id="agent-profile-select" onchange="selectAgentProfileForEditing(this.value)">
                ${agents.map((agent) => `
                  <option value="${escapeHtml(agent.id)}" ${draft.id === agent.id ? "selected" : ""}>${escapeHtml(agent.displayName)}</option>
                `).join("")}
              </select>
            </div>
            <div class="field">
              <label for="agent-mode-select">${escapeHtml(t("agents_panel.model_scope"))}</label>
              <select id="agent-mode-select" onchange="updateAgentProfileField('modeId', this.value)">
                <option value="follow_main" ${draft.modeId === "follow_main" ? "selected" : ""}>${escapeHtml(t("agents_panel.follow_global_model"))}</option>
                <option value="override" ${draft.modeId === "override" ? "selected" : ""}>${escapeHtml(t("agents_panel.override_this_agent"))}</option>
              </select>
            </div>
          </div>

          <div class="form-grid two">
            <div class="field">
              <label for="agent-display-name">${escapeHtml(t("agents_panel.display_name"))}</label>
              <input id="agent-display-name" value="${escapeHtml(draft.displayName || "")}" oninput="updateAgentProfileField('displayName', this.value)" />
            </div>
            <div class="field">
              <label for="agent-description">${escapeHtml(copy.description)}</label>
              <input id="agent-description" value="${escapeHtml(draft.description || "")}" oninput="updateAgentProfileField('description', this.value)" />
            </div>
          </div>

          ${draft.modeId === "override" ? `
            <div class="form-grid two">
              <div class="field">
                <label for="agent-provider">${escapeHtml(copy.providerOverride)}</label>
                <input id="agent-provider" value="${escapeHtml(draft.provider || "")}" oninput="updateAgentProfileField('provider', this.value)" placeholder="openai" />
              </div>
              <div class="field">
                <label for="agent-model">${escapeHtml(copy.modelOverride)}</label>
                <input id="agent-model" value="${escapeHtml(draft.model || "")}" oninput="updateAgentProfileField('model', this.value)" placeholder="gpt-4.1" />
              </div>
            </div>
          ` : `
            <div class="inline-alert ok">${escapeHtml(t("agents_panel.follows_global_defaults"))}</div>
          `}

          <div class="button-row">
            <button class="button secondary" type="button" onclick="saveAgentProfiles()">${escapeHtml(t("agents_panel.save_profiles"))}</button>
            <button class="button ghost" type="button" onclick="resetAgentProfileDraft()">${escapeHtml(t("agents_panel.reset_current_profile"))}</button>
          </div>
        </section>

        <section class="surface-card">
          <div class="surface-header">
            <div>
              <div class="section-kicker">${escapeHtml(t("agents_panel.skill_scope"))}</div>
              <h2>${escapeHtml(draft.displayName || capitalize(draft.id || "profile"))} ${escapeHtml(term("skill"))}</h2>
              <p>${escapeHtml(copy.note)}</p>
            </div>
          </div>

          <div class="detail-list compact">
            <div class="detail-row"><span>${escapeHtml(copy.globalCommands)}</span><strong>${skillsCatalog().enableSkillCommands !== false ? escapeHtml(t("common.enabled")) : escapeHtml(t("common.disabled"))}</strong></div>
            <div class="detail-row"><span>${escapeHtml(copy.currentScope)}</span><strong>${escapeHtml(draft.skillScope || "Per-agent")}</strong></div>
            <div class="detail-row"><span>${escapeHtml(t("agents_panel.selected_skills"))}</span><strong>${escapeHtml(String((draft.skills || []).length))}</strong></div>
            <div class="detail-row"><span>${escapeHtml(copy.starterPacksAttached)}</span><strong>${escapeHtml(String(attachedStarterPacks))}</strong></div>
          </div>

          <section class="starter-pack-panel">
            <div class="surface-header tight">
              <div>
                <div class="section-kicker">${escapeHtml(copy.starterPacks)}</div>
                <h2>${escapeHtml(draft.displayName || capitalize(draft.id || "profile"))} ${escapeHtml(copy.packCoverageSuffix)}</h2>
              </div>
              <div class="badge-row">
                <span class="badge ${sourceBadgeClass("seeded")}">${escapeHtml(copy.bundled)}</span>
                <span class="badge ${sourceBadgeClass("live")}">${escapeHtml(copy.attachedCount.replace("{count}", String(attachedStarterPacks)))}</span>
              </div>
            </div>

            <div class="list-stack compact starter-pack-list">
              ${starterPacks.length ? starterPacks.map((entry) => `
                <article class="starter-pack-card ${entry.coverage.status === "attached" ? "starter-pack-card-attached" : entry.coverage.status === "partial" ? "starter-pack-card-partial" : ""}">
                  <div class="permission-head">
                    <div>
                      <strong>${escapeHtml(entry.title || entry.id)}</strong>
                      <p>${escapeHtml(entry.description || copy.starterPackFallback)}</p>
                    </div>
                    <div class="badge-row">
                      <span class="badge ${entry.coverage.status === "attached" ? sourceBadgeClass("live") : entry.coverage.status === "partial" ? statusBadgeClass("manual_check") : sourceBadgeClass("seeded")}">
                        ${entry.coverage.status === "attached" ? escapeHtml(t("chat.attached")) : entry.coverage.status === "partial" ? escapeHtml(t("chat.partial")) : escapeHtml(t("chat.available"))}
                      </span>
                      ${entry.installedGlobal ? `<span class="badge ${statusBadgeClass("granted")}">${escapeHtml(copy.globalInstall)}</span>` : ""}
                      ${entry.installedProject ? `<span class="badge ${statusBadgeClass("granted")}">${escapeHtml(copy.projectInstall)}</span>` : ""}
                    </div>
                  </div>
                  <div class="detail-list compact">
                    <div class="detail-row"><span>${escapeHtml(t("meta.coverage"))}</span><strong>${escapeHtml(`${entry.coverage.matched}/${entry.coverage.total} ${term("skill")}`)}</strong></div>
                    <div class="detail-row"><span>${escapeHtml(copy.workflowTags)}</span><strong>${escapeHtml((entry.tags || []).filter((tag) => !STARTER_CATALOG_SHARED_TAGS.has(tag)).join(", ") || copy.general)}</strong></div>
                  </div>
                  <div class="catalog-skill-list">
                    ${(entry.skillNames || []).map((skillName) => `
                      <span class="suggestion-chip ${(draft.skills || []).includes(skillName) ? "active-chip" : ""}">${escapeHtml(skillName)}</span>
                    `).join("")}
                  </div>
                  <div class="button-row">
                    <button class="button secondary small" type="button" onclick="attachCatalogSkillToCurrentAgent('${escapeJsSingle(entry.id)}')" ${entry.installable || catalogEntryInstalled(entry) ? "" : "disabled"}>
                      ${entry.coverage.status === "attached" ? escapeHtml(copy.reattachPack) : escapeHtml(copy.attachPack)}
                    </button>
                    <button class="button ghost small" type="button" onclick="selectTab('skills')">${escapeHtml(copy.openSkillsCatalog)}</button>
                    ${entry.bundlePath ? `<button class="button ghost small" type="button" onclick="openExternalPath('${escapeJsSingle(entry.bundlePath)}')">${escapeHtml(t("skills_panel.open_bundle"))}</button>` : ""}
                  </div>
                </article>
              `).join("") : `
                <div class="empty-inline">
                  <strong>${escapeHtml(copy.noPackTitle)}</strong>
                  <p>${escapeHtml(copy.noPackDesc)}</p>
                </div>
              `}
            </div>
          </section>

          <div class="list-stack compact skill-toggle-list">
            ${skillNames.length ? skillNames.map((skillName) => `
              <label class="toggle-line">
                <input type="checkbox" ${(draft.skills || []).includes(skillName) ? "checked" : ""} onchange="toggleAgentSkill('${escapeJsSingle(skillName)}', this.checked)" />
                <span>
                  <strong>${escapeHtml(skillName)}</strong>
                  <small>${(draft.builtinSkills || []).includes(skillName) ? escapeHtml(copy.shippedBundle) : escapeHtml(copy.activeOnly)}</small>
                </span>
              </label>
            `).join("") : `
              <div class="empty-inline">
                <strong>${escapeHtml(copy.noSkillCatalogTitle)}</strong>
                <p>${escapeHtml(copy.noSkillCatalogDesc)}</p>
              </div>
            `}
          </div>
        </section>
      </section>
    </div>
  `;
}

function renderChannelField(channel, field) {
  const value = channel.config?.[field.id];
  if (field.type === "checkbox") {
    return `
      <label class="toggle-line">
        <input type="checkbox" ${value ? "checked" : ""} onchange="updateChannelConfig('${escapeJsSingle(channel.id)}', '${escapeJsSingle(field.id)}', this.checked, 'checkbox')" />
        <span>
          <strong>${escapeHtml(field.label)}</strong>
          <small>${escapeHtml(field.help || "")}</small>
        </span>
      </label>
    `;
  }
  return `
    <div class="field">
      <label for="${escapeHtml(`${channel.id}-${field.id}`)}">${escapeHtml(field.label)}</label>
      <input
        id="${escapeHtml(`${channel.id}-${field.id}`)}"
        type="${escapeHtml(field.type === "password" ? "password" : "text")}"
        value="${escapeHtml(value ?? "")}"
        oninput="updateChannelConfig('${escapeJsSingle(channel.id)}', '${escapeJsSingle(field.id)}', this.value, '${escapeJsSingle(field.type || "text")}')"
        placeholder="${escapeHtml(field.placeholder || "")}"
      />
      ${field.help ? `<div class="field-note">${escapeHtml(field.help)}</div>` : ""}
    </div>
  `;
}

function renderChannelsTab() {
  const channels = state.channelDrafts;
  const ready = channels.filter((channel) => channel.status === "ready" || channel.status === "send_only").length;
  const enabled = channels.filter((channel) => channel.enabled).length;
  const queue = channelRecoveryQueue(channels);
  const agents = availableAgentProfiles();
  const copy = currentLocale() === "zh-CN"
    ? {
      kicker: "对话入口",
      title: "接入渠道",
      desc: "这些绑定会写入真实项目设置。保存到工作区后，打包运行时会在重启后读取它们。",
      totalChannels: "总渠道数",
      enabled: "已启用",
      readyOrSendOnly: "就绪或仅发送",
      needSetup: "待配置",
      save: "保存渠道设置",
      reset: "重置未保存修改",
      workspaceConfig: "工作区配置",
      readiness: "渠道就绪度",
      blockers: "仍阻塞激活的事项",
      openBinding: "打开绑定",
      noBlocked: "当前没有已启用渠道被缺失配置阻塞。",
      collapse: "收起",
      expand: "展开",
      platform: "平台",
      agent: "分工",
      runtimeSupport: "运行时支持",
      bindingId: "绑定 ID",
      unset: "未设置",
      unknown: "未知",
      activated: "已激活",
      notActivated: "未激活",
      activateHelp: "为当前工作区启用这个入站或出站入口。",
      agentProfile: "分工配置",
      agentRouteNote: "入站消息会路由到这个分工。",
      validationOk: "已保存字段满足当前渠道校验契约。",
      setupFlow: "配置流程",
      collapsedNote: "默认收起，方便快速浏览。只展开你当前正在接线的平台。",
    }
    : currentLocale() === "ja-JP"
      ? {
        kicker: "会話エントリポイント",
        title: "チャネル",
        desc: "これらのバインディングは実際のプロジェクト設定です。ワークスペースへ保存すると、同梱ランタイムが再起動後に読み込みます。",
        totalChannels: "チャネル総数",
        enabled: "有効",
        readyOrSendOnly: "準備完了または送信専用",
        needSetup: "要設定",
        save: "チャネル設定を保存",
        reset: "未保存の変更をリセット",
        workspaceConfig: "ワークスペース設定",
        readiness: "チャネル準備状況",
        blockers: "有効化を妨げている項目",
        openBinding: "バインディングを開く",
        noBlocked: "現在、有効なチャネルで設定不足によりブロックされているものはありません。",
        collapse: "折りたたむ",
        expand: "展開",
        platform: "プラットフォーム",
        agent: "エージェント",
        runtimeSupport: "ランタイム対応",
        bindingId: "バインディング ID",
        unset: "未設定",
        unknown: "不明",
        activated: "有効化済み",
        notActivated: "未有効化",
        activateHelp: "現在のワークスペースでこの入出力エントリポイントを有効にします。",
        agentProfile: "エージェントプロファイル",
        agentRouteNote: "受信メッセージはこのプロファイルへルーティングされます。",
        validationOk: "保存済みの項目は現在のチャネル検証条件を満たしています。",
        setupFlow: "設定手順",
        collapsedNote: "一覧性を保つため既定では折りたたまれています。今設定しているプラットフォームだけ展開してください。",
      }
      : {
        kicker: "Conversation entry points",
        title: "Channels",
        desc: "These bindings are real project settings. Save them to the workspace and the bundled runtime picks them up on restart.",
        totalChannels: "Total channels",
        enabled: "Enabled",
        readyOrSendOnly: "Ready or send-only",
        needSetup: "Need setup",
        save: "Save Channel Settings",
        reset: "Reset Unsaved Edits",
        workspaceConfig: "Workspace config",
        readiness: "Channel readiness",
        blockers: "What still blocks activation",
        openBinding: "Open Binding",
        noBlocked: "No enabled channels are currently blocked by missing setup.",
        collapse: "Collapse",
        expand: "Expand",
        platform: "Platform",
        agent: "Agent",
        runtimeSupport: "Runtime support",
        bindingId: "Binding id",
        unset: "Unset",
        unknown: "Unknown",
        activated: "Activated",
        notActivated: "Not Activated",
        activateHelp: "Turn this inbound or outbound entry point on for the active workspace.",
        agentProfile: "Agent profile",
        agentRouteNote: "Inbound messages route to this profile.",
        validationOk: "Saved fields satisfy the current channel validation contract.",
        setupFlow: "Setup flow",
        collapsedNote: "Collapsed by default to keep the channels page scannable. Expand only the platform you are wiring right now.",
      };

  return `
    <div class="content-body">
      <section class="surface-card">
        <div class="surface-header">
          <div>
            <div class="section-kicker">${escapeHtml(copy.kicker)}</div>
            <h2>${escapeHtml(copy.title)}</h2>
            <p>${escapeHtml(copy.desc)}</p>
          </div>
          <div class="badge-row">
            <span class="badge ${actionBadgeClass("Actionable")}">${escapeHtml(t("common.actionable"))}</span>
            <span class="badge ${sourceBadgeClass("live")}">${escapeHtml(t("source.project_config"))}</span>
          </div>
        </div>

        ${renderCompactMetaStrip([
          { label: copy.totalChannels, value: channels.length },
          { label: copy.enabled, value: enabled },
          { label: copy.readyOrSendOnly, value: ready },
          { label: copy.needSetup, value: queue.length }
        ])}

        <div class="button-row">
          <button class="button secondary" type="button" onclick="saveChannels()">${escapeHtml(copy.save)}</button>
          <button class="button ghost" type="button" onclick="resetChannelDrafts()">${escapeHtml(copy.reset)}</button>
        </div>

        <div class="field-note">
          ${escapeHtml(copy.workspaceConfig)}: <span class="mono">${escapeHtml(state.bootstrap?.projectConfigPath || "")}</span>
        </div>

        <section class="recovery-panel compact-panel">
          <div class="surface-header tight">
            <div>
              <div class="section-kicker">${escapeHtml(copy.readiness)}</div>
              <h2>${escapeHtml(copy.blockers)}</h2>
            </div>
          </div>
          ${queue.length ? `
            <div class="recovery-grid">
              ${queue.map((channel) => `
                <article class="recovery-card">
                  <div class="permission-head">
                    <strong>${escapeHtml(channel.name)}</strong>
                    <span class="badge ${statusBadgeClass(channel.status)}">${escapeHtml(humanChannelStatus(channel.status))}</span>
                  </div>
                  <p>${escapeHtml(channelRecoveryNote(channel))}</p>
                  <div class="button-row">
                    <button class="button secondary small" type="button" onclick="toggleChannelExpanded('${escapeJsSingle(channel.id)}'); render();">${escapeHtml(copy.openBinding)}</button>
                    ${renderChannelLinks(channelSetupLinks(channel.platform))}
                  </div>
                </article>
              `).join("")}
            </div>
          ` : `<div class="inline-alert ok">${escapeHtml(copy.noBlocked)}</div>`}
        </section>

        ${renderWebBridgeIntegrationCard()}

        <div class="channel-grid">
          ${channels.map((channel) => `
            <article class="channel-card ${state.channelExpanded[channel.id] ? "expanded" : "collapsed"}">
              <button class="channel-toggle" type="button" onclick="toggleChannelExpanded('${escapeJsSingle(channel.id)}')">
                <div class="channel-head">
                  <div>
                    <h3>${escapeHtml(channel.name)}</h3>
                    <p>${escapeHtml(channel.note || "")}</p>
                  </div>
                  <div class="badge-row">
                    <span class="badge ${channel.enabled ? statusBadgeClass("granted") : statusBadgeClass("neutral")}">${escapeHtml(channelActivationLabel(channel))}</span>
                    <span class="badge ${statusBadgeClass(channel.status)}">${escapeHtml(humanChannelStatus(channel.status))}</span>
                    <span class="badge ${statusBadgeClass(channel.authState)}">${escapeHtml(capitalize((channel.authState || "").replaceAll("_", " ")))}</span>
                    <span class="badge">${state.channelExpanded[channel.id] ? escapeHtml(copy.collapse) : escapeHtml(copy.expand)}</span>
                  </div>
                </div>
              </button>

              <div class="detail-list compact channel-summary-list">
                <div>
                  <div class="detail-row"><span>${escapeHtml(copy.platform)}</span><strong>${escapeHtml(channel.platform)}</strong></div>
                  <div class="detail-row"><span>${escapeHtml(copy.agent)}</span><strong>${escapeHtml(agents.find((agent) => agent.id === channel.agentProfile)?.displayName || channel.agentProfile || copy.unset)}</strong></div>
                </div>
                <div>
                  <div class="detail-row"><span>${escapeHtml(copy.runtimeSupport)}</span><strong>${escapeHtml(channel.runtimeSupport || copy.unknown)}</strong></div>
                  <div class="detail-row"><span>${escapeHtml(copy.bindingId)}</span><strong class="mono">${escapeHtml(channel.id)}</strong></div>
                </div>
              </div>

              ${state.channelExpanded[channel.id] ? `
                <div class="channel-body">
                  <div class="form-grid two">
                    <label class="toggle-line">
                      <input type="checkbox" ${channel.enabled ? "checked" : ""} onchange="updateChannelEnabled('${escapeJsSingle(channel.id)}', this.checked)" />
                      <span>
                        <strong>${channel.enabled ? escapeHtml(copy.activated) : escapeHtml(copy.notActivated)}</strong>
                        <small>${escapeHtml(copy.activateHelp)}</small>
                      </span>
                    </label>

                    <div class="field">
                      <label>${escapeHtml(copy.agentProfile)}</label>
                      <select onchange="updateChannelAgent('${escapeJsSingle(channel.id)}', this.value)">
                        ${agents.map((agent) => `
                          <option value="${escapeHtml(agent.id)}" ${channel.agentProfile === agent.id ? "selected" : ""}>${escapeHtml(agent.displayName)}</option>
                        `).join("")}
                      </select>
                      <div class="field-note">${escapeHtml(copy.agentRouteNote)}</div>
                    </div>
                  </div>

                  ${channel.validationMessage ? `
                    <div class="inline-alert warn">${escapeHtml(channel.validationMessage)}</div>
                  ` : `
                    <div class="inline-alert ok">${escapeHtml(copy.validationOk)}</div>
                  `}

                  ${renderChannelLinks(channelSetupLinks(channel.platform))}

                  <div class="channel-config-grid">
                    ${(channel.fields || []).map((field) => renderChannelField(channel, field)).join("")}
                  </div>

                  <div class="setup-list">
                    <strong>${escapeHtml(copy.setupFlow)}</strong>
                    <ol>
                      ${(channel.setupSteps || []).map((step) => `<li>${escapeHtml(step)}</li>`).join("")}
                    </ol>
                  </div>
                </div>
              ` : `
                <div class="field-note">${escapeHtml(copy.collapsedNote)}</div>
              `}
            </article>
          `).join("")}
        </div>
      </section>
    </div>
  `;
}

function renderSkillsTab() {
  const catalog = skillsCatalog();
  const skills = catalog.skills || [];
  const healthRows = skillsHealthRows();
  const configuredPaths = skillPathRows();
  const currentAgent = currentAgentProfileDraft();
  const currentAgentName = currentAgent.displayName || capitalize(currentAgent.id || "main");
  const starterEntries = filteredCuratedSkillCatalogEntries();
  const starterCatalog = curatedSkillCatalogEntries();
  const categoryOptions = starterCatalogCategoryOptions();
  const starterInstalled = starterCatalog.filter((entry) => entry.installedGlobal || entry.installedProject).length;
  const starterAttached = starterCatalog.filter((entry) => catalogEntryAttachedToCurrentAgent(entry)).length;
  return `
    <div class="content-body">
      <section class="surface-card">
        <div class="surface-header">
          <div>
            <div class="section-kicker">${escapeHtml(t("skills_panel.skill_discovery"))}</div>
            <h2>${escapeHtml(t("skills_panel.title"))}</h2>
            <p>${escapeHtml(t("skills_panel.desc"))}</p>
          </div>
          <div class="badge-row">
            <span class="badge ${actionBadgeClass("Actionable")}">${escapeHtml(t("common.actionable"))}</span>
            <span class="badge ${sourceBadgeClass("live")}">${escapeHtml(t("source.live_filesystem"))}</span>
          </div>
        </div>

        ${renderCompactMetaStrip([
          { label: t("skills_panel.discovered_skills"), value: skills.length },
          { label: t("skills_panel.health_notices"), value: healthRows.length },
          { label: t("skills_panel.offline_installable"), value: catalog.catalogInstallableCount || 0 },
          { label: t("skills_panel.starter_packs_installed"), value: starterInstalled },
          { label: t("skills_panel.attached_to_current", { name: currentAgentName }), value: starterAttached }
        ])}

        <div class="inline-alert ok">${escapeHtml(t("skills_panel.command_exposure_note", { name: currentAgentName }))}</div>

        <section class="surface-card inner-surface">
          <div class="surface-header">
            <div>
              <div class="section-kicker">${escapeHtml(t("skills_panel.starter_catalog"))}</div>
              <h2>${escapeHtml(t("skills_panel.install_real_packs"))}</h2>
              <p>${escapeHtml(t("skills_panel.starter_catalog_desc"))}</p>
            </div>
            <div class="badge-row">
              <span class="badge ${sourceBadgeClass("seeded")}">${escapeHtml(t("skills_panel.bundled_catalog"))}</span>
              <span class="badge ${statusBadgeClass((catalog.catalogInstallableCount || 0) > 0 ? "configured" : "manual_check")}">${escapeHtml(t("skills_panel.installable_count", { count: catalog.catalogInstallableCount || 0 }))}</span>
            </div>
          </div>

          <div class="catalog-insight-grid">
            ${catalogWorkflowOptions().map((workflow) => `
              <button
                class="choice compact-choice ${state.skillCatalogFilter.workflow === workflow.id ? "selected" : ""}"
                type="button"
                onclick="updateSkillCatalogFilter('workflow', '${escapeJsSingle(workflow.id)}')"
              >
                <strong>${escapeHtml(localizedStarterCatalogWorkflow(workflow).label)}</strong>
                <p>${escapeHtml(localizedStarterCatalogWorkflow(workflow).description)}</p>
              </button>
            `).join("")}
          </div>

          <div class="form-grid three">
            <div class="field">
              <label for="skill-catalog-search">${escapeHtml(t("skills_panel.search_starter_catalog"))}</label>
              <input
                id="skill-catalog-search"
                value="${escapeHtml(state.skillCatalogFilter.text || "")}"
                oninput="updateSkillCatalogFilter('text', this.value)"
                placeholder="backend, docs, migration, infrastructure..."
              />
            </div>
            <div class="field">
              <label for="skill-catalog-category">${escapeHtml(t("skills_panel.category"))}</label>
              <select id="skill-catalog-category" onchange="updateSkillCatalogFilter('category', this.value)">
                <option value="all" ${state.skillCatalogFilter.category === "all" ? "selected" : ""}>${escapeHtml(t("skills_panel.all_categories"))}</option>
                ${categoryOptions.map((option) => `
                  <option value="${escapeHtml(option.id)}" ${state.skillCatalogFilter.category === option.id ? "selected" : ""}>${escapeHtml(`${option.label} (${option.count})`)}</option>
                `).join("")}
              </select>
            </div>
            <div class="field">
              <label for="skill-catalog-status">${escapeHtml(t("skills_panel.status"))}</label>
              <select id="skill-catalog-status" onchange="updateSkillCatalogFilter('status', this.value)">
                <option value="all" ${state.skillCatalogFilter.status === "all" ? "selected" : ""}>${escapeHtml(t("skills_panel.all_packs"))}</option>
                <option value="installable" ${state.skillCatalogFilter.status === "installable" ? "selected" : ""}>${escapeHtml(t("skills_panel.offline_installable"))}</option>
                <option value="installed" ${state.skillCatalogFilter.status === "installed" ? "selected" : ""}>${escapeHtml(t("skills_panel.installed_already"))}</option>
                <option value="not_installed" ${state.skillCatalogFilter.status === "not_installed" ? "selected" : ""}>${escapeHtml(t("skills_panel.not_installed_yet"))}</option>
                <option value="attached" ${state.skillCatalogFilter.status === "attached" ? "selected" : ""}>${escapeHtml(t("skills_panel.attached_to_current_agent"))}</option>
              </select>
            </div>
          </div>

          <div class="button-row">
            <label class="toggle-line">
              <input type="checkbox" ${state.skillCatalogFilter.installableOnly ? "checked" : ""} onchange="updateSkillCatalogFilter('installableOnly', this.checked)" />
              <span>
                <strong>${escapeHtml(t("skills_panel.show_installable_only"))}</strong>
                <small>${escapeHtml(t("skills_panel.show_installable_only_desc"))}</small>
              </span>
            </label>
            <button
              class="button ghost small"
              type="button"
              onclick="state.skillCatalogFilter = { text: '', installableOnly: false, category: 'all', status: 'all', workflow: 'all' }; render();"
            >
              ${escapeHtml(t("skills_panel.reset_filters"))}
            </button>
          </div>

          <div class="field-note">${escapeHtml(t("skills_panel.current_attach_target", { name: currentAgentName, scope: state.bootstrap?.workspacePath ? t("meta.project_root") : t("meta.global_root") }))}</div>

          <div class="catalog-grid">
            ${starterEntries.length ? starterEntries.map((entry) => `
              <article class="catalog-card ${catalogEntryAttachedToCurrentAgent(entry) ? "catalog-card-attached" : ""}">
                <div class="permission-head">
                  <div>
                    <strong>${escapeHtml(entry.title || entry.id)}</strong>
                    <p>${escapeHtml(entry.description || t("skills_panel.starter_catalog"))}</p>
                  </div>
                  <div class="badge-row">
                    <span class="badge ${entry.installable ? statusBadgeClass("configured") : statusBadgeClass("manual_check")}">${entry.installable ? escapeHtml(t("skills_panel.offline_install")) : escapeHtml(t("skills_panel.catalog_only"))}</span>
                    ${catalogEntryAttachedToCurrentAgent(entry) ? `<span class="badge ${sourceBadgeClass("live")}">${escapeHtml(t("skills_panel.attached_to_current", { name: currentAgentName }))}</span>` : ""}
                    ${entry.installedGlobal ? `<span class="badge ${statusBadgeClass("granted")}">${escapeHtml(t("skills_panel.global_installed"))}</span>` : ""}
                    ${entry.installedProject ? `<span class="badge ${statusBadgeClass("granted")}">${escapeHtml(t("skills_panel.project_installed"))}</span>` : ""}
                  </div>
                </div>
                <div class="detail-list compact">
                  <div class="detail-row"><span>${escapeHtml(t("skills_panel.skill_count"))}</span><strong>${escapeHtml(String(entry.skillCount || 0))}</strong></div>
                  <div class="detail-row"><span>${escapeHtml(t("meta.source"))}</span><strong class="mono">${escapeHtml(entry.sourcePath || "")}</strong></div>
                  <div class="detail-row"><span>${escapeHtml(t("skills_panel.attach_target"))}</span><strong>${escapeHtml(currentAgentName)}</strong></div>
                </div>
                <div class="badge-row">
                  ${(entry.tags || []).map((tag) => `<span class="badge">${escapeHtml(tag)}</span>`).join("")}
                </div>
                ${(entry.skillNames || []).length ? `
                  <div class="catalog-skill-list">
                    ${(entry.skillNames || []).map((skillName) => `<span class="suggestion-chip">${escapeHtml(skillName)}</span>`).join("")}
                  </div>
                ` : `<div class="field-note">${escapeHtml(t("skills_panel.no_named_skills"))}</div>`}
                <div class="button-row">
                  <button class="button primary small" type="button" onclick="attachCatalogSkillToCurrentAgent('${escapeJsSingle(entry.id)}')" ${entry.installable || catalogEntryInstalled(entry) ? "" : "disabled"}>
                    ${catalogEntryInstalled(entry) ? escapeHtml(t("skills_panel.attach_to_name", { name: currentAgentName })) : escapeHtml(t("skills_panel.install_and_attach"))}
                  </button>
                  <button class="button secondary small" type="button" onclick="installCatalogSkill('${escapeJsSingle(entry.id)}', 'global')" ${entry.installable ? "" : "disabled"}>${escapeHtml(t("skills_panel.install_global"))}</button>
                  <button class="button secondary small" type="button" onclick="installCatalogSkill('${escapeJsSingle(entry.id)}', 'project')" ${entry.installable ? "" : "disabled"}>${escapeHtml(t("skills_panel.install_project"))}</button>
                  ${entry.bundlePath ? `<button class="button ghost small" type="button" onclick="openExternalPath('${escapeJsSingle(entry.bundlePath)}')">${escapeHtml(t("skills_panel.open_bundle"))}</button>` : ""}
                  ${(entry.installedGlobal && entry.installedGlobalPath) ? `<button class="button ghost small" type="button" onclick="openExternalPath('${escapeJsSingle(entry.installedGlobalPath)}')">${escapeHtml(t("skills_panel.open_global"))}</button>` : ""}
                  ${(entry.installedProject && entry.installedProjectPath) ? `<button class="button ghost small" type="button" onclick="openExternalPath('${escapeJsSingle(entry.installedProjectPath)}')">${escapeHtml(t("skills_panel.open_project"))}</button>` : ""}
                </div>
              </article>
            `).join("") : `
              <div class="empty-state">
                <div>
                  <h2>${escapeHtml(t("skills_panel.empty_filter_title"))}</h2>
                  <p>${escapeHtml(t("skills_panel.empty_filter_desc"))}</p>
                </div>
              </div>
            `}
          </div>
        </section>

        <section class="recovery-panel compact-panel">
          <div class="surface-header tight">
            <div>
              <div class="section-kicker">${escapeHtml(t("skills_panel.discovery_health"))}</div>
              <h2>${escapeHtml(t("skills_panel.skill_loading_status"))}</h2>
            </div>
          </div>
          ${healthRows.length ? `
            <div class="recovery-grid">
              ${healthRows.map((row) => `
                <article class="recovery-card">
                  <div class="permission-head">
                    <strong>${escapeHtml(row.title)}</strong>
                    <span class="badge ${statusBadgeClass(row.level === "error" ? "denied" : "manual_check")}">${escapeHtml(row.level === "error" ? t("skills_panel.blocked") : t("meta.review"))}</span>
                  </div>
                  <p>${escapeHtml(row.detail)}</p>
                  <div class="button-row">
                    <button class="button secondary small" type="button" onclick="selectTab('skills')">${escapeHtml(row.action)}</button>
                    <button class="button ghost small" type="button" onclick="openAppSupport()">${escapeHtml(t("actions.open_app_support"))}</button>
                  </div>
                </article>
              `).join("")}
            </div>
          ` : `<div class="inline-alert ok">${escapeHtml(t("skills_panel.discovery_healthy"))}</div>`}
        </section>

        <div class="form-grid two">
          <label class="toggle-line">
            <input type="checkbox" ${state.skillDraft.enableSkillCommands ? "checked" : ""} onchange="updateSkillToggle(this.checked)" />
            <span>
              <strong>${escapeHtml(t("skills_panel.enable_skill_commands"))}</strong>
              <small>${escapeHtml(t("skills_panel.enable_skill_commands_desc"))}</small>
            </span>
          </label>

          <div class="detail-list compact">
            <div class="detail-row"><span>${escapeHtml(t("skills_panel.global_skills_root"))}</span><strong class="mono">${escapeHtml(state.bootstrap?.globalSkillsRoot || "")}</strong></div>
            <div class="detail-row"><span>${escapeHtml(t("skills_panel.project_skills_root"))}</span><strong class="mono">${escapeHtml(state.bootstrap?.projectSkillsRoot || "")}</strong></div>
          </div>
        </div>

        <div class="form-grid two">
          <div class="field">
            <label for="global-skill-paths">${escapeHtml(t("skills_panel.global_skill_paths"))}</label>
            <textarea id="global-skill-paths" oninput="updateSkillPaths('global', this.value)" placeholder="/absolute/path/to/skills">${escapeHtml(state.skillDraft.globalSkillPathsText)}</textarea>
            <div class="field-note">${escapeHtml(t("skills_panel.one_path_per_line_global"))}</div>
          </div>
          <div class="field">
            <label for="project-skill-paths">${escapeHtml(t("skills_panel.project_skill_paths"))}</label>
            <textarea id="project-skill-paths" oninput="updateSkillPaths('project', this.value)" placeholder="./relative/or/absolute/path">${escapeHtml(state.skillDraft.projectSkillPathsText)}</textarea>
            <div class="field-note">${escapeHtml(t("skills_panel.one_path_per_line_project"))}</div>
          </div>
        </div>

        <div class="button-row">
          <button class="button secondary" type="button" onclick="saveSkills()">${escapeHtml(t("skills_panel.save_skill_settings"))}</button>
          <button class="button ghost" type="button" onclick="openAppSupport()">${escapeHtml(t("actions.open_app_support"))}</button>
        </div>

        ${configuredPaths.length ? `
          <div class="resource-table compact-table">
            ${configuredPaths.map((entry) => `
              <div class="resource-row">
                <div class="resource-main">
                  <strong>${escapeHtml(entry.scope)} path</strong>
                  <div class="mono">${escapeHtml(entry.path)}</div>
                </div>
                <div class="resource-meta">
                  <span class="badge ${entry.path.startsWith("/") || entry.path.startsWith("./") || entry.path.startsWith("../") ? statusBadgeClass("configured") : statusBadgeClass("manual_check")}">
                    ${escapeHtml(entry.path.startsWith("/") || entry.path.startsWith("./") || entry.path.startsWith("../") ? t("meta.explicit") : t("meta.review"))}
                  </span>
                </div>
              </div>
            `).join("")}
          </div>
        ` : ""}
      </section>

      <section class="surface-card">
        <div class="surface-header">
          <div>
            <div class="section-kicker">${escapeHtml(t("skills_panel.discovered_resources"))}</div>
            <h2>${escapeHtml(t("skills_panel.loaded_skill_catalog"))}</h2>
            <p>${escapeHtml(t("skills_panel.loaded_skill_catalog_desc"))}</p>
          </div>
        </div>
        <div class="resource-table">
          ${skills.length ? skills.map((skill) => `
            <div class="resource-row">
              <div class="resource-main">
                <strong>${escapeHtml(skill.name)}</strong>
                <p>${escapeHtml(skill.description || t("meta.no_description"))}</p>
                <div class="mono">${escapeHtml(skill.path)}</div>
              </div>
              <div class="resource-meta">
                <span class="badge ${sourceBadgeClass(skill.autoLoaded ? "live" : "seeded")}">${skill.autoLoaded ? escapeHtml(t("meta.auto_loaded")) : escapeHtml(t("meta.configured_path"))}</span>
                <span class="badge">${escapeHtml(skill.source)}</span>
                ${skill.disableModelInvocation ? `<span class="badge ${statusBadgeClass("partial")}">${escapeHtml(t("meta.model_invocation_disabled"))}</span>` : ""}
              </div>
            </div>
          `).join("") : `
            <div class="empty-state">
              <div>
                <h2>${escapeHtml(t("skills_panel.no_skills_title"))}</h2>
                <p>${escapeHtml(t("skills_panel.no_skills_desc"))}</p>
              </div>
            </div>
          `}
        </div>
      </section>
    </div>
  `;
}

function renderAutomationActionFields() {
  const draft = state.automationDraft;
  const copy = currentLocale() === "zh-CN"
    ? {
      promptTemplate: "提示词模板",
      promptPlaceholder: "例如：每个工作日上午运行这个任务...",
      destination: "目标位置",
      destinationPlaceholder: "s3://reports 或本地目录",
      format: "格式",
      binding: "绑定渠道",
      selectBinding: "选择一个渠道绑定",
      messageTemplate: "消息模板",
      messageTemplatePlaceholder: "日报：{{result}}",
      webhookUrl: "Webhook URL",
      webhookPlaceholder: "https://example.com/hooks/...",
    }
    : currentLocale() === "ja-JP"
      ? {
        promptTemplate: "プロンプトテンプレート",
        promptPlaceholder: "例: 平日の朝ごとにこのタスクを実行...",
        destination: "出力先",
        destinationPlaceholder: "s3://reports またはローカルディレクトリ",
        format: "形式",
        binding: "バインディング",
        selectBinding: "チャネルバインディングを選択",
        messageTemplate: "メッセージテンプレート",
        messageTemplatePlaceholder: "日次サマリー: {{result}}",
        webhookUrl: "Webhook URL",
        webhookPlaceholder: "https://example.com/hooks/...",
      }
      : {
        promptTemplate: "Prompt template",
        promptPlaceholder: "Run this task every weekday morning...",
        destination: "Destination",
        destinationPlaceholder: "s3://reports or local dir",
        format: "Format",
        binding: "Binding",
        selectBinding: "Select a channel binding",
        messageTemplate: "Message template",
        messageTemplatePlaceholder: "Daily summary: {{result}}",
        webhookUrl: "Webhook URL",
        webhookPlaceholder: "https://example.com/hooks/...",
      };
  if (draft.actionType === "run_task") {
    return `
      <div class="field">
        <label for="automation-prompt">${escapeHtml(copy.promptTemplate)}</label>
        <textarea id="automation-prompt" oninput="updateAutomationField('promptTemplate', this.value)" placeholder="${escapeHtml(copy.promptPlaceholder)}">${escapeHtml(draft.promptTemplate)}</textarea>
      </div>
    `;
  }
  if (draft.actionType === "export") {
    return `
      <div class="form-grid two">
        <div class="field">
          <label for="automation-destination">${escapeHtml(copy.destination)}</label>
          <input id="automation-destination" value="${escapeHtml(draft.destination)}" oninput="updateAutomationField('destination', this.value)" placeholder="${escapeHtml(copy.destinationPlaceholder)}" />
        </div>
        <div class="field">
          <label for="automation-format">${escapeHtml(copy.format)}</label>
          <input id="automation-format" value="${escapeHtml(draft.format)}" oninput="updateAutomationField('format', this.value)" placeholder="json" />
        </div>
      </div>
    `;
  }
  if (draft.actionType === "notify_binding") {
    const channels = availableChannels();
    return `
      <div class="form-grid two">
        <div class="field">
          <label for="automation-binding">${escapeHtml(copy.binding)}</label>
          <select id="automation-binding" onchange="updateAutomationField('bindingId', this.value)">
            <option value="">${escapeHtml(copy.selectBinding)}</option>
            ${channels.map((channel) => `
              <option value="${escapeHtml(channel.id)}" ${draft.bindingId === channel.id ? "selected" : ""}>${escapeHtml(channel.name)} · ${escapeHtml(channel.id)}</option>
            `).join("")}
          </select>
        </div>
        <div class="field">
          <label for="automation-template">${escapeHtml(copy.messageTemplate)}</label>
          <input id="automation-template" value="${escapeHtml(draft.template)}" oninput="updateAutomationField('template', this.value)" placeholder="${escapeHtml(copy.messageTemplatePlaceholder)}" />
        </div>
      </div>
    `;
  }
  return `
    <div class="field">
      <label for="automation-url">${escapeHtml(copy.webhookUrl)}</label>
      <input id="automation-url" value="${escapeHtml(draft.url)}" oninput="updateAutomationField('url', this.value)" placeholder="${escapeHtml(copy.webhookPlaceholder)}" />
    </div>
  `;
}

function renderAutomationsTab() {
  const automation = automationState();
  const automations = automation.automations || [];
  const enabled = automations.filter((entry) => entry.enabled).length;
  const queue = automationRecoveryQueue(automations);
  const draftValidation = automationDraftIssues();
  const systems = automation.systems || [];
  const copy = currentLocale() === "zh-CN"
    ? {
      kicker: "Cron 与工作流任务",
      title: "自动化",
      desc: "调度周期性工作、导出、渠道通知或 webhook。编辑器会把定义直接写入当前工作区自动化注册表。",
      total: "自动化总数",
      enabled: "已启用",
      activeSystem: "当前系统",
      failing: "失败中的启用任务",
      unset: "未设置",
      health: "自动化健康度",
      needsAttention: "需要关注的任务",
      fallbackDesc: "上次运行没有完整成功。请打开编辑器检查对应动作的前置条件。",
      openEditor: "打开编辑器",
      viewDiagnostics: "查看诊断",
      noneFailing: "当前没有已启用自动化报告失败或部分完成的上次运行。",
      newAutomation: "新建自动化",
      noDescription: "暂无描述",
      edit: "编辑",
      disable: "停用",
      enable: "启用",
      delete: "删除",
      noAutomationsTitle: "还没有自动化。",
      noAutomationsDesc: "从右侧编辑器开始创建这个工作区的第一个计划任务。",
      editor: "编辑器",
      editAutomation: "编辑自动化",
      createAutomation: "创建自动化",
      availableSystems: "可用系统",
      automationRoot: "自动化根目录",
      validationOk: "当前编辑器字段满足可见的自动化前置条件。",
      name: "名称",
      namePlaceholder: "每日站会摘要",
      enabledDesc: "关闭后任务仍保留在注册表中，但不会执行。",
      description: "描述",
      descriptionPlaceholder: "给操作者看的可选说明",
      cron: "Cron",
      cronHelp: "当前 UI 只面向基于计划的自动化，因为这是现阶段支持的工作区调度路径。",
      action: "动作",
      runTask: "运行任务",
      export: "导出",
      notifyBinding: "通知渠道",
      webhook: "Webhook",
      save: "保存自动化",
      clear: "清空编辑器",
      newBadge: "new",
    }
    : currentLocale() === "ja-JP"
      ? {
        kicker: "Cron とワークフロージョブ",
        title: "自動化",
        desc: "定期実行の作業、エクスポート、チャネル通知、Webhook をスケジュールします。エディタは定義を現在のワークスペース自動化レジストリへ直接書き込みます。",
        total: "自動化総数",
        enabled: "有効",
        activeSystem: "アクティブシステム",
        failing: "失敗中の有効ジョブ",
        unset: "未設定",
        health: "自動化の健全性",
        needsAttention: "対応が必要なジョブ",
        fallbackDesc: "前回の実行は正常完了していません。エディタを開いてアクション固有の前提条件を確認してください。",
        openEditor: "エディタを開く",
        viewDiagnostics: "診断を見る",
        noneFailing: "有効な自動化で、前回実行が失敗または部分完了と報告されているものはありません。",
        newAutomation: "新規自動化",
        noDescription: "説明はありません。",
        edit: "編集",
        disable: "無効化",
        enable: "有効化",
        delete: "削除",
        noAutomationsTitle: "自動化はまだありません。",
        noAutomationsDesc: "右側のエディタから、このワークスペース向け最初のスケジュールワークフローを作成してください。",
        editor: "エディタ",
        editAutomation: "自動化を編集",
        createAutomation: "自動化を作成",
        availableSystems: "利用可能システム",
        automationRoot: "自動化ルート",
        validationOk: "現在のエディタ項目は可視の自動化前提条件を満たしています。",
        name: "名前",
        namePlaceholder: "毎日のスタンドアップ要約",
        enabledDesc: "無効化してもレジストリには残りますが、実行はされません。",
        description: "説明",
        descriptionPlaceholder: "運用者向けの任意説明",
        cron: "Cron",
        cronHelp: "現在の UI は、今日サポートされているワークスペーススケジューラ経路であるスケジュール型自動化を対象にしています。",
        action: "アクション",
        runTask: "タスク実行",
        export: "エクスポート",
        notifyBinding: "バインディング通知",
        webhook: "Webhook",
        save: "自動化を保存",
        clear: "エディタをクリア",
        newBadge: "new",
      }
      : {
        kicker: "Cron and workflow jobs",
        title: "Automations",
        desc: "Schedule recurring work, exports, channel notifications, or webhooks. The editor writes definitions directly into the active workspace automation registry.",
        total: "Total automations",
        enabled: "Enabled",
        activeSystem: "Active system",
        failing: "Failing enabled jobs",
        unset: "Unset",
        health: "Automation health",
        needsAttention: "Jobs needing attention",
        fallbackDesc: "The last run did not complete cleanly. Open the editor and verify action-specific prerequisites.",
        openEditor: "Open Editor",
        viewDiagnostics: "View Diagnostics",
        noneFailing: "No enabled automations currently report a failed or partial last run.",
        newAutomation: "New Automation",
        noDescription: "No description.",
        edit: "Edit",
        disable: "Disable",
        enable: "Enable",
        delete: "Delete",
        noAutomationsTitle: "No automations yet.",
        noAutomationsDesc: "Create the first scheduled workflow for this workspace from the editor on the right.",
        editor: "Editor",
        editAutomation: "Edit automation",
        createAutomation: "Create automation",
        availableSystems: "Available systems",
        automationRoot: "Automation root",
        validationOk: "Current editor fields satisfy the visible automation prerequisites.",
        name: "Name",
        namePlaceholder: "Daily standup summary",
        enabledDesc: "Disabled jobs stay in the registry but will not run.",
        description: "Description",
        descriptionPlaceholder: "Optional operator-facing description",
        cron: "Cron",
        cronHelp: "Current UI targets schedule-based automations because that is the supported workspace scheduler path today.",
        action: "Action",
        runTask: "Run Task",
        export: "Export",
        notifyBinding: "Notify Binding",
        webhook: "Webhook",
        save: "Save Automation",
        clear: "Clear Editor",
        newBadge: "new",
      };

  return `
    <div class="content-body">
      <section class="surface-card">
        <div class="surface-header">
          <div>
            <div class="section-kicker">${escapeHtml(copy.kicker)}</div>
            <h2>${escapeHtml(copy.title)}</h2>
            <p>${escapeHtml(copy.desc)}</p>
          </div>
          <div class="badge-row">
            <span class="badge ${actionBadgeClass("Actionable")}">${escapeHtml(t("common.actionable"))}</span>
            <span class="badge ${sourceBadgeClass("live")}">${escapeHtml(t("source.workspace_registry"))}</span>
          </div>
        </div>

        ${renderCompactMetaStrip([
          { label: copy.total, value: automations.length },
          { label: copy.enabled, value: enabled },
          { label: copy.activeSystem, value: automation.activeSystemId || copy.unset },
          { label: copy.failing, value: queue.length }
        ])}

        <section class="recovery-panel compact-panel">
          <div class="surface-header tight">
            <div>
              <div class="section-kicker">${escapeHtml(copy.health)}</div>
              <h2>${escapeHtml(copy.needsAttention)}</h2>
            </div>
          </div>
          ${queue.length ? `
            <div class="recovery-grid">
              ${queue.map((entry) => `
                <article class="recovery-card">
                  <div class="permission-head">
                    <strong>${escapeHtml(entry.name)}</strong>
                    <span class="badge ${statusBadgeClass(entry.lastRunStatus || "manual_check")}">${escapeHtml(capitalize(entry.lastRunStatus || "issue"))}</span>
                  </div>
                  <p>${escapeHtml(entry.description || copy.fallbackDesc)}</p>
                  <div class="button-row">
                    <button class="button secondary small" type="button" onclick="editAutomation('${escapeJsSingle(entry.id)}')">${escapeHtml(copy.openEditor)}</button>
                    <button class="button ghost small" type="button" onclick="focusDiagnosticsCategory('runtime', 'all'); selectTab('security');">${escapeHtml(copy.viewDiagnostics)}</button>
                  </div>
                </article>
              `).join("")}
            </div>
          ` : `<div class="inline-alert ok">${escapeHtml(copy.noneFailing)}</div>`}
        </section>

        <div class="automation-shell">
          <div class="automation-list">
            <div class="button-row">
              <button class="button secondary small" type="button" onclick="newAutomationDraft()">${escapeHtml(copy.newAutomation)}</button>
            </div>
            <div class="list-stack">
              ${automations.length ? automations.map((entry) => `
                <div class="list-row ${state.automationDraft.id === entry.id ? "current" : ""}">
                  <div class="list-row-main">
                    <strong>${escapeHtml(entry.name)}</strong>
                    <p>${escapeHtml(entry.description || copy.noDescription)}</p>
                    <div class="subtle">${escapeHtml(entry.cron || uiCopy("common.manual"))} · ${escapeHtml(actionTypeLabel(entry.actionType))}</div>
                    <div class="mono">${escapeHtml(entry.path || "")}</div>
                  </div>
                  <div class="row-actions">
                    <span class="badge ${statusBadgeClass(entry.enabled ? "enabled" : "disabled")}">${entry.enabled ? escapeHtml(t("common.enabled")) : escapeHtml(t("common.disabled"))}</span>
                    ${entry.lastRunStatus ? `<span class="badge ${statusBadgeClass(entry.lastRunStatus)}">${escapeHtml(capitalize(entry.lastRunStatus))}</span>` : ""}
                    <button class="button secondary small" type="button" onclick="editAutomation('${escapeJsSingle(entry.id)}')">${escapeHtml(copy.edit)}</button>
                    <button class="button ghost small" type="button" onclick="toggleAutomation('${escapeJsSingle(entry.id)}', ${entry.enabled ? "false" : "true"})">${entry.enabled ? escapeHtml(copy.disable) : escapeHtml(copy.enable)}</button>
                    <button class="button ghost small" type="button" onclick="deleteAutomation('${escapeJsSingle(entry.id)}')">${escapeHtml(copy.delete)}</button>
                  </div>
                </div>
              `).join("") : `
                <div class="empty-state">
                  <div>
                    <h2>${escapeHtml(copy.noAutomationsTitle)}</h2>
                    <p>${escapeHtml(copy.noAutomationsDesc)}</p>
                  </div>
                </div>
              `}
            </div>
          </div>

          <div class="automation-editor">
            <div class="surface-header tight">
              <div>
                <div class="section-kicker">${escapeHtml(copy.editor)}</div>
                <h2>${escapeHtml(state.automationDraft.id ? copy.editAutomation : copy.createAutomation)}</h2>
              </div>
              <div class="badge-row">
                <span class="badge">${escapeHtml(state.automationDraft.id || copy.newBadge)}</span>
              </div>
            </div>

            <div class="detail-list compact">
              <div class="detail-row"><span>${escapeHtml(copy.activeSystem)}</span><strong>${escapeHtml(automation.activeSystemId || copy.unset)}</strong></div>
              <div class="detail-row"><span>${escapeHtml(copy.availableSystems)}</span><strong>${escapeHtml(String(systems.length))}</strong></div>
              <div class="detail-row"><span>${escapeHtml(copy.automationRoot)}</span><strong class="mono">${escapeHtml(state.bootstrap?.automationsRoot || "")}</strong></div>
            </div>

            ${draftValidation.issues.length ? `
              <div class="inline-alert warn">${escapeHtml(draftValidation.issues[0])}</div>
            ` : draftValidation.warnings.length ? `
              <div class="inline-alert warn">${escapeHtml(draftValidation.warnings[0])}</div>
            ` : `
              <div class="inline-alert ok">${escapeHtml(copy.validationOk)}</div>
            `}

            <div class="form-grid two">
              <div class="field">
                <label for="automation-name">${escapeHtml(copy.name)}</label>
                <input id="automation-name" value="${escapeHtml(state.automationDraft.name)}" oninput="updateAutomationField('name', this.value)" placeholder="${escapeHtml(copy.namePlaceholder)}" />
              </div>
              <label class="toggle-line">
                <input type="checkbox" ${state.automationDraft.enabled ? "checked" : ""} onchange="updateAutomationField('enabled', this.checked)" />
                <span>
                  <strong>${escapeHtml(copy.enabled)}</strong>
                  <small>${escapeHtml(copy.enabledDesc)}</small>
                </span>
              </label>
            </div>

            <div class="field">
              <label for="automation-description">${escapeHtml(copy.description)}</label>
              <textarea id="automation-description" oninput="updateAutomationField('description', this.value)" placeholder="${escapeHtml(copy.descriptionPlaceholder)}">${escapeHtml(state.automationDraft.description)}</textarea>
            </div>

            <div class="form-grid two">
              <div class="field">
                <label for="automation-cron">${escapeHtml(copy.cron)}</label>
                <input id="automation-cron" value="${escapeHtml(state.automationDraft.cron)}" oninput="updateAutomationField('cron', this.value)" placeholder="0 9 * * *" />
                <div class="field-note">${escapeHtml(copy.cronHelp)}</div>
              </div>
              <div class="field">
                <label for="automation-action-type">${escapeHtml(copy.action)}</label>
                <select id="automation-action-type" onchange="updateAutomationField('actionType', this.value)">
                  <option value="run_task" ${state.automationDraft.actionType === "run_task" ? "selected" : ""}>${escapeHtml(copy.runTask)}</option>
                  <option value="export" ${state.automationDraft.actionType === "export" ? "selected" : ""}>${escapeHtml(copy.export)}</option>
                  <option value="notify_binding" ${state.automationDraft.actionType === "notify_binding" ? "selected" : ""}>${escapeHtml(copy.notifyBinding)}</option>
                  <option value="webhook" ${state.automationDraft.actionType === "webhook" ? "selected" : ""}>${escapeHtml(copy.webhook)}</option>
                </select>
              </div>
            </div>

            ${renderAutomationActionFields()}

            <div class="button-row">
              <button class="button secondary" type="button" onclick="saveAutomation()">${escapeHtml(copy.save)}</button>
              <button class="button ghost" type="button" onclick="newAutomationDraft()">${escapeHtml(copy.clear)}</button>
            </div>
          </div>
        </div>
      </section>
    </div>
  `;
}

function renderSecurityTab() {
  const security = securityState();
  const decisions = security.decisions || [];
  const permissions = systemPermissions();
  const permissionQueue = permissionRepairQueue();
  const diagnostics = diagnosticsState();
  const entries = filteredDiagnosticsEntries();
  const hotspots = diagnosticsHotspots();
  const activePreset = SECURITY_PRESETS[state.securityDraft.machinePreset] || SECURITY_PRESETS.primary;
  const copy = currentLocale() === "zh-CN"
    ? {
      kicker: "权限中心",
      title: "安全控制",
      desc: "在一个地方管理机器姿态、破坏性执行行为、沙盒与网关路由、已保存审批，以及 macOS 权限面。",
      machinePosture: "机器姿态",
      effectiveProfile: "当前配置",
      sensitiveExec: "敏感执行",
      filesystemScope: "文件系统范围",
      diagnosticsErrors: "诊断错误",
      savedAllowlist: "已保存 allowlist 条目",
      permissionsNeedingAction: "待处理权限",
      permissionsStore: "权限存储",
      recoveryQueue: "修复队列",
      fixBlocking: "优先修复当前阻塞项",
      refreshStatus: "刷新状态",
      openRawLog: "打开原始日志",
      permissionAttention: "{count} 个 macOS 权限仍需处理。请先在这里修复，然后再刷新。",
      noPermissionBlockers: "当前没有检测到 macOS 权限阻塞。",
      request: "请求",
      openSettings: "打开设置",
      filterDiagnostics: "筛选诊断",
      approveDirectory: "批准目录",
      openUpdates: "打开更新",
      enforcementVisibility: "执行可见性",
      immediateActions: "哪些设置会立即生效",
      immediateDesc: "把已经影响运行中产品的控制项，与当前只是存为桌面策略、等待后续执行落地的控制项区分开。",
      machinePresets: "机器预设",
      quickPresets: "快捷姿态预设",
      quickPresetsDesc: "把这些当作最快的安全起点。Dedicated Machine 权限最大，Primary Machine 保留破坏性确认，Home Machine 默认更保守。",
      safeDetail: "默认拒绝。最适合最小权限。",
      balancedDetail: "以提示确认为主，风险面比 permissive 更窄。",
      permissiveDetail: "优先兼容性，扩展行为更宽松。",
      fallbackAllow: "兜底：始终允许",
      fallbackAllowDesc: "当未选择显式 profile 时，会映射到 `extensionPolicy.defaultPermissive`。",
      allowDangerous: "允许危险能力",
      allowDangerousDesc: "控制是否允许 `exec`、`env` 等高风险能力。",
      conflictGuard: "冲突保护",
      conflictGuardDesc: "当沙盒、网关和审批设置开始分叉时，让桌面端保持更明确的策略姿态。",
      browserAutomation: "浏览器自动化",
      browserAutomationDesc: "在桌面策略中心标记浏览器控制工作流可用。应配合辅助功能与自动化授权一起使用。",
      sensitiveExecPolicy: "敏感执行策略",
      confirmDestructive: "破坏性执行需确认",
      alwaysAllowExec: "始终允许执行",
      blockDestructive: "阻止破坏性执行",
      sensitiveExecDesc: "用于 `rm`、破坏性覆盖以及类似高风险动作。",
      sandboxScope: "文件系统 / 沙盒范围",
      workspaceOnly: "仅工作区",
      workspaceApproved: "工作区 + 已批准目录",
      fullAccess: "完整访问",
      sandboxDesc: "这是桌面端对读/写/编辑/删除范围的策略视图。已批准目录显示在下方。",
      gatewayRouting: "网关路由",
      directRuntime: "本地运行时直连",
      sandboxGateway: "沙盒网关",
      customGateway: "自定义网关",
      gatewayUrl: "网关 URL",
      gatewayUrlDesc: "本地直连时保持为空。只有团队实际通过网关路由时才填写。",
      savePolicy: "保存安全策略",
      openPermissionsStore: "打开权限存储",
      filesystemApprovals: "文件系统授权",
      approvedDirectories: "已批准目录",
      approvedDirectoriesDesc: "当桌面保持在工作区或已选目录模式时，这些额外根目录是比直接开放全盘权限更快、更可控的授权方式。",
      addDirectory: "添加目录",
      approvedRoot: "已批准的额外工作根目录",
      remove: "移除",
      noDirectoriesTitle: "还没有批准的额外目录。",
      noDirectoriesDesc: "保持仅工作区模式，或者当项目位于当前根目录之外时在这里添加目录。",
      approvalsAllowlist: "执行审批与 allowlist",
      capabilityDecisions: "能力决策",
      capabilityDecisionsDesc: "新增或覆盖已保存的扩展能力决策。这里就是桌面端的 “Allow Always / Never Ask” 策略面板。",
      extensionId: "扩展 ID",
      capability: "能力",
      allowAlways: "始终允许",
      neverAsk: "永不询问",
      pendingAllow: "待允许",
      pendingDeny: "待拒绝",
      saveDecision: "保存决策",
      resetDecisions: "重置全部决策",
      decidedAt: "决策时间",
      allow: "允许",
      deny: "拒绝",
      removeExtensionRules: "移除扩展规则",
      noDecisionsTitle: "还没有已保存的能力决策。",
      noDecisionsDesc: "在你持久化显式允许或拒绝规则之前，能力将跟随当前 profile。",
      macosAccess: "macOS 访问",
      systemPermissions: "系统权限",
      systemPermissionsDesc: "读取当前 OS 授权状态，并在运行时需要时请求权限或打开对应隐私面板。",
      recheck: "重新检查",
      diagnosticsCenter: "诊断中心",
      errorRuntimeDiagnostics: "错误与运行时诊断",
      diagnosticsDesc: "按严重级别和类别筛选最近问题，打开原始日志，或生成 maoclaw 支持包。",
      errors: "错误",
      warnings: "警告",
      severity: "严重级别",
      category: "类别",
      all: "全部",
      info: "信息",
      permissions: "权限",
      runtime: "运行时",
      filesystem: "文件系统",
      gatewaySandbox: "网关 / 沙盒",
      channels: "渠道",
      updates: "更新",
      general: "通用",
      search: "搜索",
      exportDiagnostics: "导出诊断",
      prepareSupportBundle: "准备支持包",
      openReportsFolder: "打开报告目录",
      logPath: "日志路径",
      supportReports: "支持报告",
      currentGatewayRoute: "当前网关路由",
      noDiagnosticsMatch: "当前筛选条件下没有匹配的诊断。",
    }
    : currentLocale() === "ja-JP"
      ? {
      kicker: "権限センター",
      title: "セキュリティ制御",
      desc: "マシン姿勢、破壊的実行、サンドボックスとゲートウェイルーティング、保存済み承認、macOS 権限面を一か所で管理します。",
      machinePosture: "マシン姿勢",
      effectiveProfile: "有効プロファイル",
      sensitiveExec: "高リスク実行",
      filesystemScope: "ファイルシステム範囲",
      diagnosticsErrors: "診断エラー",
      savedAllowlist: "保存済み allowlist",
      permissionsNeedingAction: "要対応権限",
      permissionsStore: "権限ストア",
      recoveryQueue: "復旧キュー",
      fixBlocking: "今ユーザーを止めている項目を修正",
      refreshStatus: "状態を更新",
      openRawLog: "生ログを開く",
      permissionAttention: "{count} 個の macOS 権限がまだ対応待ちです。ここで修正してから更新してください。",
      noPermissionBlockers: "現在、macOS 権限のブロッカーは検出されていません。",
      request: "要求",
      openSettings: "設定を開く",
      filterDiagnostics: "診断を絞り込む",
      approveDirectory: "ディレクトリを承認",
      openUpdates: "更新を開く",
      enforcementVisibility: "実行可視性",
      immediateActions: "すぐ効くもの",
      immediateDesc: "すでに実行中の製品へ反映される制御と、次の実行レーン向けにデスクトップ方針として保存されるだけの制御を分けて示します。",
      machinePresets: "マシンプリセット",
      quickPresets: "クイック姿勢プリセット",
      quickPresetsDesc: "最速で安全な出発点として使ってください。Dedicated Machine は最大権限、Primary Machine は破壊的確認を維持し、Home Machine は保守的です。",
      safeDetail: "フェイルクローズ。最小権限に最適。",
      balancedDetail: "確認中心の既定値で、permissive より狭い影響範囲です。",
      permissiveDetail: "互換性優先で、拡張動作が広めです。",
      fallbackAllow: "フォールバック: 常に許可",
      fallbackAllowDesc: "明示プロファイルがない場合、`extensionPolicy.defaultPermissive` に対応します。",
      allowDangerous: "危険な能力を許可",
      allowDangerousDesc: "`exec` や `env` など高リスク能力を許可するかを制御します。",
      conflictGuard: "競合ガード",
      conflictGuardDesc: "サンドボックス、ゲートウェイ、承認設定が乖離し始めたとき、デスクトップ面を明確に保ちます。",
      browserAutomation: "ブラウザ自動化",
      browserAutomationDesc: "デスクトップ方針センターでブラウザ制御ワークフローを有効として扱います。Accessibility と Automation 許可と組み合わせてください。",
      sensitiveExecPolicy: "高リスク実行ポリシー",
      confirmDestructive: "破壊的実行は確認",
      alwaysAllowExec: "常に実行を許可",
      blockDestructive: "破壊的実行をブロック",
      sensitiveExecDesc: "`rm`、破壊的上書き、同種の高リスク操作向けです。",
      sandboxScope: "ファイルシステム / サンドボックス範囲",
      workspaceOnly: "ワークスペースのみ",
      workspaceApproved: "ワークスペース + 承認済みディレクトリ",
      fullAccess: "フルアクセス",
      sandboxDesc: "これは read/write/edit/delete 範囲に対するデスクトップ方針ビューです。承認済みディレクトリは下に表示されます。",
      gatewayRouting: "ゲートウェイルーティング",
      directRuntime: "ローカルランタイム直結",
      sandboxGateway: "サンドボックスゲートウェイ",
      customGateway: "カスタムゲートウェイ",
      gatewayUrl: "ゲートウェイ URL",
      gatewayUrlDesc: "ローカル直結なら空欄にしてください。チームが実際にゲートウェイ経由で流す場合のみ入力します。",
      savePolicy: "セキュリティ方針を保存",
      openPermissionsStore: "権限ストアを開く",
      filesystemApprovals: "ファイルシステム承認",
      approvedDirectories: "承認済みディレクトリ",
      approvedDirectoriesDesc: "デスクトップを workspace または selected-directory モードに保つ場合、これらの追加ルートはフルディスク権限へ飛ばずに意図的アクセスを許可する最速手段です。",
      addDirectory: "ディレクトリを追加",
      approvedRoot: "承認済み追加ワーキングルート",
      remove: "削除",
      noDirectoriesTitle: "承認済みの追加ディレクトリはありません。",
      noDirectoriesDesc: "workspace-only のままにするか、プロジェクトが現在のルート外にある場合ここで追加してください。",
      approvalsAllowlist: "実行承認と allowlist",
      capabilityDecisions: "能力決定",
      capabilityDecisionsDesc: "保存済み拡張能力決定を追加または上書きします。これは “Allow Always / Never Ask” スタイルのデスクトップ方針面です。",
      extensionId: "拡張 ID",
      capability: "能力",
      allowAlways: "常に許可",
      neverAsk: "二度と確認しない",
      pendingAllow: "許可予定",
      pendingDeny: "拒否予定",
      saveDecision: "決定を保存",
      resetDecisions: "すべての決定をリセット",
      decidedAt: "決定日時",
      allow: "許可",
      deny: "拒否",
      removeExtensionRules: "拡張ルールを削除",
      noDecisionsTitle: "保存済みの能力決定はありません。",
      noDecisionsDesc: "明示的な許可または拒否ルールを保存するまで、能力は現在のプロファイルに従います。",
      macosAccess: "macOS アクセス",
      systemPermissions: "システム権限",
      systemPermissionsDesc: "現在の OS 許可状態を読み取り、必要時には要求または対応するプライバシーパネルを開きます。",
      recheck: "再確認",
      diagnosticsCenter: "診断センター",
      errorRuntimeDiagnostics: "エラーとランタイム診断",
      diagnosticsDesc: "最近の問題を重大度とカテゴリで絞り込み、生ログを開くか、maoclaw 用サポートバンドルを生成します。",
      errors: "エラー",
      warnings: "警告",
      severity: "重大度",
      category: "カテゴリ",
      all: "すべて",
      info: "情報",
      permissions: "権限",
      runtime: "ランタイム",
      filesystem: "ファイルシステム",
      gatewaySandbox: "ゲートウェイ / サンドボックス",
      channels: "チャネル",
      updates: "更新",
      general: "一般",
      search: "検索",
      exportDiagnostics: "診断をエクスポート",
      prepareSupportBundle: "サポートバンドルを準備",
      openReportsFolder: "レポートフォルダを開く",
      logPath: "ログパス",
      supportReports: "サポートレポート",
      currentGatewayRoute: "現在のゲートウェイルート",
      noDiagnosticsMatch: "現在のフィルタに一致する診断はありません。",
    }
      : {
      kicker: "Permission Center",
      title: "Security controls",
      desc: "Manage machine posture, destructive exec behavior, sandbox and gateway routing, saved approvals, and the macOS permission surface from one place.",
      machinePosture: "Machine posture",
      effectiveProfile: "Effective profile",
      sensitiveExec: "Sensitive exec",
      filesystemScope: "Filesystem scope",
      diagnosticsErrors: "Diagnostics errors",
      savedAllowlist: "Saved allowlist entries",
      permissionsNeedingAction: "Permissions needing action",
      permissionsStore: "Permissions store",
      recoveryQueue: "Recovery queue",
      fixBlocking: "Fix what is blocking users now",
      refreshStatus: "Refresh status",
      openRawLog: "Open raw log",
      permissionAttention: "{count} macOS permissions still need attention. Repair from here, then refresh.",
      noPermissionBlockers: "No macOS permission blockers are currently detected.",
      request: "Request",
      openSettings: "Open Settings",
      filterDiagnostics: "Filter Diagnostics",
      approveDirectory: "Approve Directory",
      openUpdates: "Open Updates",
      enforcementVisibility: "Enforcement visibility",
      immediateActions: "What acts immediately",
      immediateDesc: "This separates controls that already affect the running product from controls that are currently stored as desktop policy for the next enforcement pass.",
      machinePresets: "Machine presets",
      quickPresets: "Quick posture presets",
      quickPresetsDesc: "Use these as the fastest safe starting point. Dedicated Machine is highest-authority, Primary Machine keeps destructive confirmation, and Home Machine stays conservative by default.",
      safeDetail: "Fail-closed profile. Best for least privilege.",
      balancedDetail: "Prompt-oriented default with narrower blast radius than permissive.",
      permissiveDetail: "Compatibility-first profile for broader extension behavior.",
      fallbackAllow: "Fallback: Always Allow",
      fallbackAllowDesc: "Maps to `extensionPolicy.defaultPermissive` when no explicit profile is selected.",
      allowDangerous: "Allow dangerous capabilities",
      allowDangerousDesc: "Controls whether high-risk capabilities such as `exec` and `env` are permitted.",
      conflictGuard: "Conflict guard",
      conflictGuardDesc: "Keeps the desktop surface opinionated when sandbox, gateway, and approval settings start diverging.",
      browserAutomation: "Browser automation",
      browserAutomationDesc: "Marks browser-control workflows as enabled in the desktop policy center. Pair this with Accessibility and Automation grants.",
      sensitiveExecPolicy: "Sensitive exec policy",
      confirmDestructive: "Confirm destructive exec",
      alwaysAllowExec: "Always allow exec",
      blockDestructive: "Block destructive exec",
      sensitiveExecDesc: "Use this for `rm`, destructive overwrites, and similarly high-risk actions.",
      sandboxScope: "Filesystem / sandbox scope",
      workspaceOnly: "Workspace only",
      workspaceApproved: "Workspace + approved directories",
      fullAccess: "Full access",
      sandboxDesc: "This is the desktop policy view for read/write/edit/delete scope. Approved directories appear below.",
      gatewayRouting: "Gateway routing",
      directRuntime: "Direct local runtime",
      sandboxGateway: "Sandbox gateway",
      customGateway: "Custom gateway",
      gatewayUrl: "Gateway URL",
      gatewayUrlDesc: "Leave empty for direct local runtime. Fill this only when your team actually routes through a gateway.",
      savePolicy: "Save Security Policy",
      openPermissionsStore: "Open permissions store",
      filesystemApprovals: "Filesystem approvals",
      approvedDirectories: "Approved directories",
      approvedDirectoriesDesc: "When you keep the desktop in workspace or selected-directory mode, these extra roots are the fastest way to grant intentional access without jumping straight to full disk scope.",
      addDirectory: "Add directory",
      approvedRoot: "Approved extra working root",
      remove: "Remove",
      noDirectoriesTitle: "No extra directories approved.",
      noDirectoriesDesc: "Stay workspace-only, or add a directory here when a project lives outside the current root.",
      approvalsAllowlist: "Exec approvals and allowlist",
      capabilityDecisions: "Capability decisions",
      capabilityDecisionsDesc: "Add or overwrite saved extension capability decisions. This is the desktop surface for “Allow Always” and “Never Ask” style policy state.",
      extensionId: "Extension id",
      capability: "Capability",
      allowAlways: "Allow Always",
      neverAsk: "Never Ask",
      pendingAllow: "Pending allow",
      pendingDeny: "Pending deny",
      saveDecision: "Save Decision",
      resetDecisions: "Reset All Decisions",
      decidedAt: "Decided",
      allow: "Allow",
      deny: "Deny",
      removeExtensionRules: "Remove Extension Rules",
      noDecisionsTitle: "No saved capability decisions.",
      noDecisionsDesc: "Capabilities will follow the current profile until you persist explicit allow or deny rules.",
      macosAccess: "macOS access",
      systemPermissions: "System permissions",
      systemPermissionsDesc: "Read current OS-grant state and request or open the relevant privacy pane when the runtime needs a permission.",
      recheck: "Recheck",
      diagnosticsCenter: "Diagnostics center",
      errorRuntimeDiagnostics: "Error and runtime diagnostics",
      diagnosticsDesc: "Filter recent issues by severity and category, open the raw log, or generate a support bundle for maoclaw troubleshooting.",
      errors: "errors",
      warnings: "warnings",
      severity: "Severity",
      category: "Category",
      all: "All",
      info: "Info",
      permissions: "Permissions",
      runtime: "Runtime",
      filesystem: "Filesystem",
      gatewaySandbox: "Gateway / Sandbox",
      channels: "Channels",
      updates: "Updates",
      general: "General",
      search: "Search",
      exportDiagnostics: "Export diagnostics",
      prepareSupportBundle: "Prepare support bundle",
      openReportsFolder: "Open reports folder",
      logPath: "Log path",
      supportReports: "Support reports",
      currentGatewayRoute: "Current gateway route",
      noDiagnosticsMatch: "No diagnostics matched the current filters.",
    };
  const coverageRows = [
    {
      name: currentLocale() === "zh-CN" ? "扩展能力配置" : currentLocale() === "ja-JP" ? "拡張能力プロファイル" : "Extension capability profile",
      status: "live",
      label: currentLocale() === "zh-CN" ? "实时运行态" : currentLocale() === "ja-JP" ? "ライブランタイム" : "Live runtime",
      detail: currentLocale() === "zh-CN" ? "profile、兜底允许模式和危险能力开关都会持久化到设置中，并由运行时实际应用。"
        : currentLocale() === "ja-JP" ? "プロファイル、フォールバック許可モード、危険能力トグルは設定へ永続化され、ランタイムに適用されます。"
        : "The profile, fallback allow mode, and dangerous-capability toggle are persisted into settings and applied by the runtime.",
    },
    {
      name: currentLocale() === "zh-CN" ? "已保存能力决策" : currentLocale() === "ja-JP" ? "保存済み能力決定" : "Saved capability decisions",
      status: "live",
      label: currentLocale() === "zh-CN" ? "实时运行态" : currentLocale() === "ja-JP" ? "ライブランタイム" : "Live runtime",
      detail: currentLocale() === "zh-CN" ? "Allow Always / Never Ask 规则由运行时实际使用的扩展权限存储支撑。"
        : currentLocale() === "ja-JP" ? "Allow Always / Never Ask ルールは、ランタイムが使う拡張権限ストアによって保持されます。"
        : "Allow Always / Never Ask rules are backed by the extension permissions store used by the runtime.",
    },
    {
      name: currentLocale() === "zh-CN" ? "macOS 隐私权限" : currentLocale() === "ja-JP" ? "macOS プライバシー権限" : "macOS privacy permissions",
      status: "live",
      label: currentLocale() === "zh-CN" ? "系统实时状态" : currentLocale() === "ja-JP" ? "OS ライブ状態" : "Live OS state",
      detail: currentLocale() === "zh-CN" ? "辅助功能、屏幕录制、麦克风、摄像头、通知等授权会反映当前 macOS 状态。"
        : currentLocale() === "ja-JP" ? "Accessibility、画面収録、マイク、カメラ、通知などの許可状態は現在の macOS 状態を反映します。"
        : "Accessibility, screen recording, microphone, camera, notifications, and related grants reflect current macOS state.",
    },
    {
      name: currentLocale() === "zh-CN" ? "诊断与支持导出" : currentLocale() === "ja-JP" ? "診断とサポート出力" : "Diagnostics and support export",
      status: "live",
      label: currentLocale() === "zh-CN" ? "桌面实时状态" : currentLocale() === "ja-JP" ? "デスクトップライブ" : "Live desktop",
      detail: currentLocale() === "zh-CN" ? "最近的桌面与后端日志、原始日志打开，以及支持报告导出现在都已经可用。"
        : currentLocale() === "ja-JP" ? "最近のデスクトップ/バックエンドログ、生ログ表示、サポートレポート出力はすでに利用可能です。"
        : "Recent desktop and backend log lines, raw log opening, and support report export are active now.",
    },
    {
      name: currentLocale() === "zh-CN" ? "机器预设与破坏性执行姿态" : currentLocale() === "ja-JP" ? "マシンプリセットと破壊的実行姿勢" : "Machine presets and destructive exec posture",
      status: "scaffold",
      label: currentLocale() === "zh-CN" ? "已存储策略" : currentLocale() === "ja-JP" ? "保存済みポリシー" : "Stored policy",
      detail: currentLocale() === "zh-CN" ? "这些设置已经存到桌面配置里，并会指导控制中心展示，但更深的后端执行仍是下一阶段工作。"
        : currentLocale() === "ja-JP" ? "これらの設定はデスクトップ構成に保存され、コントロールセンターをガイドしますが、より深いバックエンド強制は次のレーンです。"
        : "These settings are persisted in the desktop config and guide the control center, but deeper backend enforcement is the next runtime lane.",
    },
    {
      name: currentLocale() === "zh-CN" ? "沙盒范围、网关路由与批准目录" : currentLocale() === "ja-JP" ? "サンドボックス範囲・ゲートウェイルート・承認済みディレクトリ" : "Sandbox scope, gateway route, and approved directories",
      status: "scaffold",
      label: currentLocale() === "zh-CN" ? "已存储策略" : currentLocale() === "ja-JP" ? "保存済みポリシー" : "Stored policy",
      detail: currentLocale() === "zh-CN" ? "目录选择与路由决策已经保存并可见，但它们还不是完整的后端沙盒或网关强制层。"
        : currentLocale() === "ja-JP" ? "ディレクトリ選択とルーティング方針は保存され可視化されていますが、まだ完全なバックエンド強制層ではありません。"
        : "Directory selections and routing choices are saved and visible here, but they are not yet a full backend sandbox or gateway enforcement layer.",
    },
  ];
  return `
    <div class="content-body">
      <section class="surface-card">
        <div class="surface-header">
          <div>
            <div class="section-kicker">${escapeHtml(copy.kicker)}</div>
            <h2>${escapeHtml(copy.title)}</h2>
            <p>${escapeHtml(copy.desc)}</p>
          </div>
          <div class="badge-row">
            <span class="badge ${actionBadgeClass("Actionable")}">${escapeHtml(t("common.actionable"))}</span>
            <span class="badge ${sourceBadgeClass("live")}">${escapeHtml(t("source.policy_os"))}</span>
          </div>
        </div>

        ${renderCompactMetaStrip([
          { label: copy.machinePosture, value: localizedSecurityPreset(state.securityDraft.machinePreset, activePreset).label },
          { label: copy.effectiveProfile, value: state.securityDraft.profile },
          { label: copy.sensitiveExec, value: destructiveExecPolicyLabel(state.securityDraft.destructiveExecPolicy) },
          { label: copy.filesystemScope, value: sandboxModeLabel(state.securityDraft.sandboxMode) },
          { label: copy.diagnosticsErrors, value: diagnostics.errorCount || 0 },
          { label: copy.permissionsNeedingAction, value: permissionQueue.length },
          { label: copy.permissionsStore, value: security.permissionsPath || "", mono: true, wide: true }
        ])}

        <section class="recovery-panel">
          <div class="surface-header tight">
            <div>
              <div class="section-kicker">${escapeHtml(copy.recoveryQueue)}</div>
              <h2>${escapeHtml(copy.fixBlocking)}</h2>
            </div>
            <div class="button-row">
              <button class="button secondary small" type="button" onclick="refreshSecurityConsole()">${escapeHtml(copy.refreshStatus)}</button>
              <button class="button ghost small" type="button" onclick="openDesktopLog()">${escapeHtml(copy.openRawLog)}</button>
            </div>
          </div>

          ${permissionQueue.length ? `
            <div class="inline-alert warn">
              ${escapeHtml(copy.permissionAttention.replace("{count}", String(permissionQueue.length)))}
            </div>
          ` : `
            <div class="inline-alert ok">${escapeHtml(copy.noPermissionBlockers)}</div>
          `}

          <div class="recovery-grid">
            ${permissionQueue.map((permission) => `
              <article class="recovery-card">
                <div class="permission-head">
                  <strong>${escapeHtml(permission.name)}</strong>
                  <span class="badge ${statusBadgeClass(permission.status)}">${escapeHtml(humanPermissionStatus(permission.status))}</span>
                </div>
                <p>${escapeHtml(permissionRecoveryNote(permission))}</p>
                <div class="button-row">
                  ${permission.canRequest ? `<button class="button secondary small" type="button" onclick="requestSystemPermission('${escapeJsSingle(permission.id)}')">${escapeHtml(copy.request)}</button>` : ""}
                  <button class="button ghost small" type="button" onclick="openPrivacySettings('${escapeJsSingle(permission.id)}')">${escapeHtml(copy.openSettings)}</button>
                </div>
              </article>
            `).join("")}
            ${hotspots.map((hotspot) => `
              <article class="recovery-card">
                <div class="permission-head">
                  <strong>${escapeHtml(capitalize(hotspot.category))}</strong>
                  <span class="badge ${statusBadgeClass(hotspot.errorCount > 0 ? "denied" : "manual_check")}">${escapeHtml(hotspot.errorCount > 0 ? `${hotspot.errorCount} ${copy.errors}` : `${hotspot.warningCount} ${copy.warnings}`)}</span>
                </div>
                <p>${escapeHtml(diagnosticsRecoveryNote(hotspot.category))}</p>
                <div class="subtle">${escapeHtml(shorten(hotspot.latestMessage || "", 120))}</div>
                <div class="button-row">
                  <button class="button secondary small" type="button" onclick="focusDiagnosticsCategory('${escapeJsSingle(hotspot.category)}', '${hotspot.errorCount > 0 ? "error" : "warn"}')">${escapeHtml(copy.filterDiagnostics)}</button>
                  ${hotspot.category === "runtime" ? `<button class="button ghost small" type="button" onclick="restartBackend()">Restart Backend</button>` : ""}
                  ${hotspot.category === "filesystem" ? `<button class="button ghost small" type="button" onclick="pickScopedDirectory()">${escapeHtml(copy.approveDirectory)}</button>` : ""}
                  ${hotspot.category === "updates" ? `<button class="button ghost small" type="button" onclick="selectTab('settings')">${escapeHtml(copy.openUpdates)}</button>` : ""}
                </div>
              </article>
            `).join("")}
          </div>
        </section>

        <div class="surface-header">
          <div>
            <div class="section-kicker">${escapeHtml(copy.enforcementVisibility)}</div>
            <h2>${escapeHtml(copy.immediateActions)}</h2>
            <p>${escapeHtml(copy.immediateDesc)}</p>
          </div>
        </div>
        <div class="resource-table">
          ${coverageRows.map((row) => `
            <div class="resource-row">
              <div class="resource-main">
                <strong>${escapeHtml(row.name)}</strong>
                <p>${escapeHtml(row.detail)}</p>
              </div>
              <div class="resource-meta">
                <span class="badge ${sourceBadgeClass(row.status)}">${escapeHtml(row.label)}</span>
              </div>
            </div>
          `).join("")}
        </div>

        <div class="surface-header">
          <div>
            <div class="section-kicker">${escapeHtml(copy.machinePresets)}</div>
            <h2>${escapeHtml(copy.quickPresets)}</h2>
            <p>${escapeHtml(copy.quickPresetsDesc)}</p>
          </div>
        </div>
        <div class="card-grid">
          ${Object.entries(SECURITY_PRESETS).map(([id, preset]) => `
            <button class="choice ${state.securityDraft.machinePreset === id ? "selected" : ""}" type="button" onclick="applySecurityPreset('${id}')">
              <strong>${escapeHtml(localizedSecurityPreset(id, preset).label)}</strong>
              <p>${escapeHtml(localizedSecurityPreset(id, preset).detail)}</p>
            </button>
          `).join("")}
        </div>

        <div class="card-grid">
          ${[
            ["safe", copy.safeDetail],
            ["balanced", copy.balancedDetail],
            ["permissive", copy.permissiveDetail]
          ].map(([id, detail]) => `
            <button class="choice ${state.securityDraft.profile === id ? "selected" : ""}" type="button" onclick="updateSecurityField('profile', '${id}')">
              <strong>${escapeHtml(capitalize(id))}</strong>
              <p>${escapeHtml(detail)}</p>
            </button>
          `).join("")}
        </div>

        <div class="form-grid two">
          <label class="toggle-line">
            <input type="checkbox" ${state.securityDraft.defaultPermissive ? "checked" : ""} onchange="updateSecurityField('defaultPermissive', this.checked)" />
            <span>
              <strong>${escapeHtml(copy.fallbackAllow)}</strong>
              <small>${escapeHtml(copy.fallbackAllowDesc)}</small>
            </span>
          </label>
          <label class="toggle-line">
            <input type="checkbox" ${state.securityDraft.allowDangerous ? "checked" : ""} onchange="updateSecurityField('allowDangerous', this.checked)" />
            <span>
              <strong>${escapeHtml(copy.allowDangerous)}</strong>
              <small>${escapeHtml(copy.allowDangerousDesc)}</small>
            </span>
          </label>
          <label class="toggle-line">
            <input type="checkbox" ${state.securityDraft.conflictGuard ? "checked" : ""} onchange="updateSecurityField('conflictGuard', this.checked)" />
            <span>
              <strong>${escapeHtml(copy.conflictGuard)}</strong>
              <small>${escapeHtml(copy.conflictGuardDesc)}</small>
            </span>
          </label>
          <label class="toggle-line">
            <input type="checkbox" ${state.securityDraft.browserAutomation ? "checked" : ""} onchange="updateSecurityField('browserAutomation', this.checked)" />
            <span>
              <strong>${escapeHtml(copy.browserAutomation)}</strong>
              <small>${escapeHtml(copy.browserAutomationDesc)}</small>
            </span>
          </label>
        </div>

        <div class="form-grid two">
          <div class="field">
            <label for="destructive-policy">${escapeHtml(copy.sensitiveExecPolicy)}</label>
            <select id="destructive-policy" onchange="updateSecurityField('destructiveExecPolicy', this.value)">
              <option value="confirm" ${state.securityDraft.destructiveExecPolicy === "confirm" ? "selected" : ""}>${escapeHtml(copy.confirmDestructive)}</option>
              <option value="allow_all" ${state.securityDraft.destructiveExecPolicy === "allow_all" ? "selected" : ""}>${escapeHtml(copy.alwaysAllowExec)}</option>
              <option value="deny_destructive" ${state.securityDraft.destructiveExecPolicy === "deny_destructive" ? "selected" : ""}>${escapeHtml(copy.blockDestructive)}</option>
            </select>
            <div class="field-note">${escapeHtml(copy.sensitiveExecDesc)}</div>
          </div>
          <div class="field">
            <label for="sandbox-mode">${escapeHtml(copy.sandboxScope)}</label>
            <select id="sandbox-mode" onchange="updateSecurityField('sandboxMode', this.value)">
              <option value="workspace_write" ${state.securityDraft.sandboxMode === "workspace_write" ? "selected" : ""}>${escapeHtml(copy.workspaceOnly)}</option>
              <option value="selected_directories" ${state.securityDraft.sandboxMode === "selected_directories" ? "selected" : ""}>${escapeHtml(copy.workspaceApproved)}</option>
              <option value="full_access" ${state.securityDraft.sandboxMode === "full_access" ? "selected" : ""}>${escapeHtml(copy.fullAccess)}</option>
            </select>
            <div class="field-note">${escapeHtml(copy.sandboxDesc)}</div>
          </div>
        </div>

        <div class="form-grid two">
          <div class="field">
            <label for="gateway-mode">${escapeHtml(copy.gatewayRouting)}</label>
            <select id="gateway-mode" onchange="updateSecurityField('gatewayMode', this.value)">
              <option value="direct" ${state.securityDraft.gatewayMode === "direct" ? "selected" : ""}>${escapeHtml(copy.directRuntime)}</option>
              <option value="sandbox_gateway" ${state.securityDraft.gatewayMode === "sandbox_gateway" ? "selected" : ""}>${escapeHtml(copy.sandboxGateway)}</option>
              <option value="custom_gateway" ${state.securityDraft.gatewayMode === "custom_gateway" ? "selected" : ""}>${escapeHtml(copy.customGateway)}</option>
            </select>
          </div>
          <div class="field">
            <label for="gateway-url">${escapeHtml(copy.gatewayUrl)}</label>
            <input id="gateway-url" value="${escapeHtml(state.securityDraft.gatewayURL || "")}" oninput="updateSecurityField('gatewayURL', this.value)" placeholder="https://gateway.example.internal" />
            <div class="field-note">${escapeHtml(copy.gatewayUrlDesc)}</div>
          </div>
        </div>

        <div class="button-row">
          <button class="button secondary" type="button" onclick="saveSecuritySettings()">${escapeHtml(copy.savePolicy)}</button>
          <button class="button ghost" type="button" onclick="openExternalPath('${escapeJsSingle(security.permissionsPath || "")}')">${escapeHtml(copy.openPermissionsStore)}</button>
        </div>
      </section>

      <section class="split-panel">
        <section class="surface-card">
          <div class="surface-header">
            <div>
              <div class="section-kicker">${escapeHtml(copy.filesystemApprovals)}</div>
              <h2>${escapeHtml(copy.approvedDirectories)}</h2>
              <p>${escapeHtml(copy.approvedDirectoriesDesc)}</p>
            </div>
          </div>
          <div class="button-row">
            <button class="button secondary small" type="button" onclick="pickScopedDirectory()">${escapeHtml(copy.addDirectory)}</button>
          </div>
          <div class="resource-table">
            ${state.securityDraft.scopedDirectories.length ? state.securityDraft.scopedDirectories.map((path) => `
              <div class="resource-row">
                <div class="resource-main">
                  <strong class="mono">${escapeHtml(path)}</strong>
                  <p>${escapeHtml(copy.approvedRoot)}</p>
                </div>
                <div class="resource-meta">
                  <button class="button ghost small" type="button" onclick="removeScopedDirectory('${escapeJsSingle(path)}')">${escapeHtml(copy.remove)}</button>
                </div>
              </div>
            `).join("") : `
              <div class="empty-state">
                <div>
                  <h2>${escapeHtml(copy.noDirectoriesTitle)}</h2>
                  <p>${escapeHtml(copy.noDirectoriesDesc)}</p>
                </div>
              </div>
            `}
          </div>
        </section>

        <section class="surface-card">
          <div class="surface-header">
            <div>
              <div class="section-kicker">${escapeHtml(copy.approvalsAllowlist)}</div>
              <h2>${escapeHtml(copy.capabilityDecisions)}</h2>
              <p>${escapeHtml(copy.capabilityDecisionsDesc)}</p>
            </div>
          </div>

          <div class="form-grid two">
            <div class="field">
              <label for="decision-extension">${escapeHtml(copy.extensionId)}</label>
              <input id="decision-extension" value="${escapeHtml(state.permissionDraft.extensionId)}" oninput="updatePermissionDraft('extensionId', this.value)" placeholder="agentmain or extension-id" />
            </div>
            <div class="field">
              <label for="decision-capability">${escapeHtml(copy.capability)}</label>
              <input id="decision-capability" list="capability-list" value="${escapeHtml(state.permissionDraft.capability)}" oninput="updatePermissionDraft('capability', this.value)" placeholder="exec" />
              <datalist id="capability-list">
                ${COMMON_CAPABILITIES.map((capability) => `<option value="${escapeHtml(capability)}"></option>`).join("")}
              </datalist>
            </div>
          </div>

          <div class="button-row">
            <button class="button secondary small" type="button" onclick="updatePermissionDraft('allow', true)">${escapeHtml(copy.allowAlways)}</button>
            <button class="button ghost small" type="button" onclick="updatePermissionDraft('allow', false)">${escapeHtml(copy.neverAsk)}</button>
            <span class="badge ${statusBadgeClass(state.permissionDraft.allow ? "granted" : "denied")}">${state.permissionDraft.allow ? escapeHtml(copy.pendingAllow) : escapeHtml(copy.pendingDeny)}</span>
          </div>

          <div class="button-row">
            <button class="button secondary" type="button" onclick="applyPermissionDecision()">${escapeHtml(copy.saveDecision)}</button>
            <button class="button ghost" type="button" onclick="resetPermissionDecisions()">${escapeHtml(copy.resetDecisions)}</button>
          </div>

          <div class="resource-table">
            ${decisions.length ? decisions.map((decision) => `
              <div class="resource-row">
                <div class="resource-main">
                  <strong>${escapeHtml(decision.extensionId)}</strong>
                  <p>${escapeHtml(decision.capability)} · ${decision.allow ? escapeHtml(copy.allow) : escapeHtml(copy.deny)}</p>
                  <div class="subtle">${escapeHtml(copy.decidedAt)} ${escapeHtml(formatTimestamp(decision.decidedAt))}</div>
                </div>
                <div class="resource-meta">
                  <span class="badge ${statusBadgeClass(decision.allow ? "granted" : "denied")}">${decision.allow ? escapeHtml(copy.allow) : escapeHtml(copy.deny)}</span>
                  <button class="button ghost small" type="button" onclick="removePermissionExtension('${escapeJsSingle(decision.extensionId)}')">${escapeHtml(copy.removeExtensionRules)}</button>
                </div>
              </div>
            `).join("") : `
              <div class="empty-state">
                <div>
                  <h2>${escapeHtml(copy.noDecisionsTitle)}</h2>
                  <p>${escapeHtml(copy.noDecisionsDesc)}</p>
                </div>
              </div>
            `}
          </div>
        </section>
      </section>

      <section class="split-panel">
        <section class="surface-card">
          <div class="surface-header">
            <div>
              <div class="section-kicker">${escapeHtml(copy.macosAccess)}</div>
              <h2>${escapeHtml(copy.systemPermissions)}</h2>
              <p>${escapeHtml(copy.systemPermissionsDesc)}</p>
            </div>
            <div class="button-row">
              <button class="button secondary small" type="button" onclick="refreshSecurityConsole()">${escapeHtml(copy.refreshStatus)}</button>
            </div>
          </div>

          <div class="permission-grid">
            ${permissions.map((permission) => `
              <div class="permission-card">
                <div class="permission-head">
                  <strong>${escapeHtml(permission.name)}</strong>
                  <span class="badge ${statusBadgeClass(permission.status)}">${escapeHtml(humanPermissionStatus(permission.status))}</span>
                </div>
                <p>${escapeHtml(permission.detail || "")}</p>
                <div class="field-note">${escapeHtml(permissionRecoveryNote(permission))}</div>
                <div class="button-row">
                  ${permission.canRequest ? `<button class="button secondary small" type="button" onclick="requestSystemPermission('${escapeJsSingle(permission.id)}')">${escapeHtml(copy.request)}</button>` : ""}
                  <button class="button ghost small" type="button" onclick="openPrivacySettings('${escapeJsSingle(permission.id)}')">${escapeHtml(copy.openSettings)}</button>
                  <button class="button ghost small" type="button" onclick="refreshSecurityConsole()">${escapeHtml(copy.recheck)}</button>
                </div>
              </div>
            `).join("")}
          </div>
        </section>

        <section class="surface-card log-card">
          <div class="surface-header">
            <div>
              <div class="section-kicker">${escapeHtml(copy.diagnosticsCenter)}</div>
              <h2>${escapeHtml(copy.errorRuntimeDiagnostics)}</h2>
              <p>${escapeHtml(copy.diagnosticsDesc)}</p>
            </div>
            <div class="badge-row">
              <span class="badge ${statusBadgeClass((diagnostics.errorCount || 0) > 0 ? "denied" : "granted")}">${String(diagnostics.errorCount || 0)} ${escapeHtml(copy.errors)}</span>
              <span class="badge ${statusBadgeClass((diagnostics.warningCount || 0) > 0 ? "manual_check" : "granted")}">${String(diagnostics.warningCount || 0)} ${escapeHtml(copy.warnings)}</span>
            </div>
          </div>

          <div class="form-grid three">
            <div class="field">
              <label for="diagnostics-level">${escapeHtml(copy.severity)}</label>
              <select id="diagnostics-level" onchange="updateDiagnosticsFilter('level', this.value)">
                <option value="all" ${state.diagnosticsFilter.level === "all" ? "selected" : ""}>${escapeHtml(copy.all)}</option>
                <option value="error" ${state.diagnosticsFilter.level === "error" ? "selected" : ""}>${escapeHtml(copy.errors)}</option>
                <option value="warn" ${state.diagnosticsFilter.level === "warn" ? "selected" : ""}>${escapeHtml(copy.warnings)}</option>
                <option value="info" ${state.diagnosticsFilter.level === "info" ? "selected" : ""}>${escapeHtml(copy.info)}</option>
              </select>
            </div>
            <div class="field">
              <label for="diagnostics-category">${escapeHtml(copy.category)}</label>
              <select id="diagnostics-category" onchange="updateDiagnosticsFilter('category', this.value)">
                <option value="all" ${state.diagnosticsFilter.category === "all" ? "selected" : ""}>${escapeHtml(copy.all)}</option>
                <option value="permissions" ${state.diagnosticsFilter.category === "permissions" ? "selected" : ""}>${escapeHtml(copy.permissions)}</option>
                <option value="runtime" ${state.diagnosticsFilter.category === "runtime" ? "selected" : ""}>${escapeHtml(copy.runtime)}</option>
                <option value="filesystem" ${state.diagnosticsFilter.category === "filesystem" ? "selected" : ""}>${escapeHtml(copy.filesystem)}</option>
                <option value="gateway" ${state.diagnosticsFilter.category === "gateway" ? "selected" : ""}>${escapeHtml(copy.gatewaySandbox)}</option>
                <option value="channels" ${state.diagnosticsFilter.category === "channels" ? "selected" : ""}>${escapeHtml(copy.channels)}</option>
                <option value="updates" ${state.diagnosticsFilter.category === "updates" ? "selected" : ""}>${escapeHtml(copy.updates)}</option>
                <option value="general" ${state.diagnosticsFilter.category === "general" ? "selected" : ""}>${escapeHtml(copy.general)}</option>
              </select>
            </div>
            <div class="field">
              <label for="diagnostics-search">${escapeHtml(copy.search)}</label>
              <input id="diagnostics-search" value="${escapeHtml(state.diagnosticsFilter.text || "")}" oninput="updateDiagnosticsFilter('text', this.value)" placeholder="permission denied, rpc, update..." />
            </div>
          </div>

          <div class="button-row">
            <button class="button secondary small" type="button" onclick="refreshSecurityConsole()">${escapeHtml(copy.refreshStatus)}</button>
            <button class="button secondary small" type="button" onclick="openDesktopLog()">${escapeHtml(copy.openRawLog)}</button>
            <button class="button secondary small" type="button" onclick="exportDiagnosticsReport()">${escapeHtml(copy.exportDiagnostics)}</button>
            <button class="button ghost small" type="button" onclick="prepareSupportReport()">${escapeHtml(copy.prepareSupportBundle)}</button>
            <button class="button ghost small" type="button" onclick="openDiagnosticsFolder()">${escapeHtml(copy.openReportsFolder)}</button>
          </div>

          <div class="detail-list compact">
            <div class="detail-row"><span>${escapeHtml(copy.logPath)}</span><strong class="mono">${escapeHtml(diagnostics.logPath || "")}</strong></div>
            <div class="detail-row"><span>${escapeHtml(copy.supportReports)}</span><strong class="mono">${escapeHtml(diagnostics.reportRoot || "")}</strong></div>
            <div class="detail-row"><span>${escapeHtml(copy.currentGatewayRoute)}</span><strong>${escapeHtml(gatewayModeLabel(state.securityDraft.gatewayMode))}</strong></div>
          </div>

          <div class="log-list">
            ${entries.length ? entries.slice().reverse().map((entry) => `
              <div class="resource-row">
                <div class="resource-main">
                  <strong>${escapeHtml(entry.message || "")}</strong>
                  <p>${escapeHtml(`${entry.category || "general"} · ${entry.source || "desktop"} · ${entry.timestamp || ""}`)}</p>
                </div>
                <div class="resource-meta">
                  <span class="badge ${statusBadgeClass(entry.level === "error" ? "denied" : entry.level === "warn" ? "manual_check" : "granted")}">${escapeHtml(String(entry.level || "info").toUpperCase())}</span>
                </div>
              </div>
            `).join("") : `<div class="log-line">${escapeHtml(copy.noDiagnosticsMatch)}</div>`}
          </div>
        </section>
      </section>
    </div>
  `;
}

function renderSettingsTab() {
  const bootstrap = state.bootstrap || {};
  const providerConfig = currentProviderConfig();
  const updateState = updateStateSnapshot();
  const host = hostState();
  const readiness = providerReadiness();
  const sources = desktopDataSources();
  const interactions = interactionAuditRows();
  const readinessRows = productReadinessRows();
  return `
    <div class="content-body settings-stack">
      <section class="surface-card">
        <div class="surface-header">
          <div>
            <div class="section-kicker">${escapeHtml(t("settings.low_frequency_controls"))}</div>
            <h2>${escapeHtml(t("settings.desktop_defaults"))}</h2>
            <p>${escapeHtml(t("settings.desktop_defaults_desc"))}</p>
          </div>
          <div class="badge-row">
            <span class="badge ${actionBadgeClass("Actionable")}">${escapeHtml(t("common.actionable"))}</span>
            <span class="badge ${sourceBadgeClass("seeded")}">${escapeHtml(t("source.persistent_defaults"))}</span>
          </div>
        </div>

        ${renderSetupFields("settings")}

        <div class="button-row">
          <button class="button secondary" type="button" onclick="chooseWorkspace()">${escapeHtml(t("actions.choose_folder"))}</button>
          <button class="button ghost" type="button" onclick="importExistingSetup()" ${bootstrap.importCandidate?.available ? "" : "disabled"}>${escapeHtml(t("actions.import_existing_setup"))}</button>
          <button class="button primary" type="button" onclick="savePreferences()" ${readiness.ready ? "" : "disabled"}>${escapeHtml(t("actions.save_defaults"))}</button>
        </div>
      </section>

      ${renderExperienceControls(false)}

      <section class="surface-card">
        <div class="surface-header">
          <div>
            <div class="section-kicker">${escapeHtml(t("settings.shell_title"))}</div>
            <h2>${escapeHtml(t("settings.shell_title"))}</h2>
            <p>${escapeHtml(t("settings.shell_desc"))}</p>
          </div>
          <div class="badge-row">
            <span class="badge ${actionBadgeClass("Actionable")}">${escapeHtml(t("common.actionable"))}</span>
            <span class="badge ${sourceBadgeClass("live")}">${escapeHtml(t("source.host_managed"))}</span>
          </div>
        </div>

        ${renderCompactMetaStrip([
          { label: t("settings_panel.preferred_surface"), value: state.hostDraft.preferredSurface === "web" ? t("settings_panel.web_surface_title") : t("settings_panel.native_surface_title") },
          { label: t("settings_panel.close_behavior"), value: state.hostDraft.closeBehavior === "background" ? t("settings_panel.close_background") : t("settings_panel.close_quit") },
          { label: t("settings_panel.menu_bar_access"), value: state.hostDraft.menuBarEnabled ? t("common.enabled") : t("common.disabled") },
          { label: t("settings_panel.local_web_bridge"), value: host.webBridgeRunning ? t("meta.running") : t("meta.starting_on_demand") }
        ])}

        <div class="card-grid">
          <button class="choice ${state.hostDraft.preferredSurface === "native" ? "selected" : ""}" type="button" onclick="updateHostField('preferredSurface', 'native')">
            <strong>${escapeHtml(t("settings_panel.native_surface_title"))}</strong>
            <p>${escapeHtml(t("settings_panel.native_surface_desc"))}</p>
          </button>
          <button class="choice ${state.hostDraft.preferredSurface === "web" ? "selected" : ""}" type="button" onclick="updateHostField('preferredSurface', 'web')">
            <strong>${escapeHtml(t("settings_panel.web_surface_title"))}</strong>
            <p>${escapeHtml(t("settings_panel.web_surface_desc"))}</p>
          </button>
        </div>

        <div class="form-grid two">
          <div class="field">
            <label for="desktop-web-url">${escapeHtml(t("settings_panel.web_workspace_url"))}</label>
            <input id="desktop-web-url" value="${escapeHtml(state.hostDraft.webWorkspaceURL || "")}" oninput="updateHostField('webWorkspaceURL', this.value)" placeholder="https://xinxiang.xin" />
            <div class="field-note">${escapeHtml(t("settings_panel.web_workspace_url_desc"))}</div>
          </div>
          <div class="field">
            <label for="desktop-close-behavior">${escapeHtml(t("settings_panel.window_close_behavior"))}</label>
            <select id="desktop-close-behavior" onchange="updateHostField('closeBehavior', this.value)">
              <option value="background" ${state.hostDraft.closeBehavior === "background" ? "selected" : ""}>${escapeHtml(t("settings_panel.close_background"))}</option>
              <option value="quit" ${state.hostDraft.closeBehavior === "quit" ? "selected" : ""}>${escapeHtml(t("settings_panel.close_quit"))}</option>
            </select>
            <div class="field-note">${escapeHtml(t("settings_panel.close_behavior_desc"))}</div>
          </div>
        </div>

        <div class="form-grid two">
          <label class="toggle-line">
            <input type="checkbox" ${state.hostDraft.menuBarEnabled ? "checked" : ""} onchange="updateHostField('menuBarEnabled', this.checked)" />
            <span>
              <strong>${escapeHtml(t("settings_panel.menu_bar_quick_access"))}</strong>
              <small>${escapeHtml(t("settings_panel.menu_bar_quick_access_desc"))}</small>
            </span>
          </label>
          <div class="subtle-field">
            <div class="detail-list compact">
              <div class="detail-row"><span>${escapeHtml(t("settings_panel.local_bridge_url"))}</span><strong class="mono">${escapeHtml(host.webBridgeBaseURL || "http://127.0.0.1:43115")}</strong></div>
              <div class="detail-row"><span>${escapeHtml(t("settings_panel.embedded_native_shell"))}</span><strong>${host.nativeControlCenterAvailable ? escapeHtml(t("settings_panel.always_available")) : escapeHtml(t("settings_panel.unavailable"))}</strong></div>
            </div>
          </div>
        </div>

        <div class="button-row">
          <button class="button secondary" type="button" onclick="saveHostSettings()">${escapeHtml(t("actions.save_shell_settings"))}</button>
          <button class="button secondary" type="button" onclick="openChatWorkspace()">${escapeHtml(t("actions.open_native_chat"))}</button>
          <button class="button ghost" type="button" onclick="switchDesktopSurface('native')">${escapeHtml(t("actions.reload_native"))}</button>
          <button class="button secondary" type="button" onclick="switchDesktopSurface('web')">${escapeHtml(t("actions.open_web_workspace"))}</button>
          <button class="button ghost" type="button" onclick="openWebWorkspaceExternal()">${escapeHtml(t("actions.open_in_browser"))}</button>
        </div>
      </section>

      <section class="split-panel">
        <section class="surface-card">
          <div class="surface-header">
            <div>
              <div class="section-kicker">${escapeHtml(t("settings_panel.version_management"))}</div>
              <h2>${escapeHtml(t("settings_panel.desktop_updates_title"))}</h2>
              <p>${escapeHtml(t("settings_panel.desktop_updates_desc"))}</p>
            </div>
            <div class="badge-row">
              <span class="badge ${actionBadgeClass("Actionable")}">${escapeHtml(t("common.actionable"))}</span>
              <span class="badge ${statusBadgeClass(updateState.status === "update_available" ? "manual_check" : "configured")}">${escapeHtml(updateState.status.replaceAll("_", " "))}</span>
            </div>
          </div>

          <div class="detail-list">
            <div class="detail-row"><span>${escapeHtml(t("meta.installed"))}</span><strong>${escapeHtml(updateState.currentVersion || t("common.pending"))}</strong></div>
            <div class="detail-row"><span>${escapeHtml(t("meta.latest"))}</span><strong>${escapeHtml(updateState.latestVersion || t("meta.not_checked"))}</strong></div>
            <div class="detail-row"><span>${escapeHtml(t("meta.last_check"))}</span><strong>${escapeHtml(updateState.checkedAt ? formatTimestamp(updateState.checkedAt) : t("meta.never"))}</strong></div>
            <div class="detail-row"><span>${escapeHtml(t("meta.policy"))}</span><strong>${providerConfig.checkForUpdates ? escapeHtml(t("settings_panel.checks_enabled")) : escapeHtml(t("settings_panel.checks_disabled"))}</strong></div>
            <div class="detail-row"><span>${escapeHtml(t("meta.release"))}</span><strong>${escapeHtml(updateState.releaseName || t("common.pending"))}</strong></div>
            <div class="detail-row"><span>${escapeHtml(t("meta.published"))}</span><strong>${escapeHtml(updateState.publishedAt ? formatTimestamp(updateState.publishedAt) : t("common.pending"))}</strong></div>
          </div>

          <div class="field-note">${escapeHtml(updateState.message || t("settings_panel.manual_update_checks"))}</div>

          ${updateState.releaseNotes ? `
            <div class="release-notes-card">
              <label>${escapeHtml(t("settings_panel.release_notes_preview"))}</label>
              <pre>${escapeHtml(releaseNotesPreview(updateState.releaseNotes))}</pre>
            </div>
          ` : ""}

          <div class="button-row">
            <button class="button secondary small" type="button" onclick="checkForUpdates()">${escapeHtml(t("actions.check_updates"))}</button>
            <button class="button primary small" type="button" onclick="downloadAndInstallUpdate()" ${updateState.downloadURL ? "" : "disabled"}>${escapeHtml(t("actions.download_install"))}</button>
            <button class="button ghost small" type="button" onclick="openReleasePage()">${escapeHtml(t("actions.open_releases"))}</button>
          </div>
        </section>

        <section class="surface-card">
          <div class="surface-header">
            <div>
              <div class="section-kicker">${escapeHtml(t("settings.live_runtime"))}</div>
              <h2>${escapeHtml(t("settings_panel.live_runtime_title"))}</h2>
              <p>${escapeHtml(t("settings_panel.live_runtime_desc"))}</p>
            </div>
            <div class="badge-row">
              <span class="badge ${actionBadgeClass("Actionable")}">${escapeHtml(t("common.actionable"))}</span>
              <span class="badge ${sourceBadgeClass("live")}">${escapeHtml(t("common.live"))}</span>
            </div>
          </div>

          <div class="detail-list">
            <div class="detail-row"><span>${escapeHtml(term("workspace"))}</span><strong class="mono">${escapeHtml(bootstrap.workspacePath || "")}</strong></div>
            <div class="detail-row"><span>${escapeHtml(t("meta.app_support"))}</span><strong class="mono">${escapeHtml(bootstrap.appSupportPath || "")}</strong></div>
            <div class="detail-row"><span>${escapeHtml(t("settings.desktop_settings"))}</span><strong class="mono">${escapeHtml(bootstrap.configPath || "")}</strong></div>
            <div class="detail-row"><span>${escapeHtml(t("meta.project_settings"))}</span><strong class="mono">${escapeHtml(bootstrap.projectConfigPath || "")}</strong></div>
            <div class="detail-row"><span>${escapeHtml(t("meta.auth_file"))}</span><strong class="mono">${escapeHtml(bootstrap.authPath || "")}</strong></div>
            <div class="detail-row"><span>${escapeHtml(t("meta.model"))}</span><strong class="mono">${escapeHtml(bootstrap.modelsPath || providerConfig.modelsPath || "")}</strong></div>
            <div class="detail-row"><span>${escapeHtml(t("sessions_panel.desktop_sessions"))}</span><strong class="mono">${escapeHtml(bootstrap.sessionPath || "")}</strong></div>
            <div class="detail-row"><span>Pi</span><strong class="mono">${escapeHtml(bootstrap.bundledBinaryPath || "")}</strong></div>
          </div>

          <div class="button-row">
            <button class="button secondary small" type="button" onclick="openAppSupport()">${escapeHtml(t("actions.open_app_support"))}</button>
            <button class="button secondary small" type="button" onclick="openSessionsFolder()">${escapeHtml(t("actions.open_sessions"))}</button>
            <button class="button ghost small" type="button" onclick="refreshDesktop()">${escapeHtml(t("actions.refresh"))}</button>
            <button class="button ghost small" type="button" onclick="restartBackend()">${escapeHtml(t("actions.restart_backend"))}</button>
          </div>
        </section>

        <section class="surface-card">
          <div class="surface-header">
            <div>
              <div class="section-kicker">${escapeHtml(t("settings.migration"))}</div>
              <h2>${escapeHtml(t("settings_panel.migration_title"))}</h2>
              <p>${escapeHtml(t("settings_panel.migration_desc"))}</p>
            </div>
            <div class="badge-row">
              <span class="badge ${actionBadgeClass("Actionable")}">${escapeHtml(t("common.actionable"))}</span>
              <span class="badge ${sourceBadgeClass(bootstrap.importCandidate?.available ? "live" : "seeded")}">${bootstrap.importCandidate?.available ? escapeHtml(t("meta.detected")) : escapeHtml(t("common.disabled"))}</span>
            </div>
          </div>

          <div class="detail-list">
            <div class="detail-row"><span>${escapeHtml(t("settings_panel.legacy_root"))}</span><strong class="mono">${escapeHtml(bootstrap.importCandidate?.sourceRoot || t("common.disabled"))}</strong></div>
            <div class="detail-row"><span>${escapeHtml(t("settings_panel.settings_file"))}</span><strong>${bootstrap.importCandidate?.settingsPath ? escapeHtml(t("meta.detected")) : escapeHtml(t("meta.missing"))}</strong></div>
            <div class="detail-row"><span>${escapeHtml(t("settings_panel.auth_file"))}</span><strong>${bootstrap.importCandidate?.authPath ? escapeHtml(t("meta.detected")) : escapeHtml(t("meta.missing"))}</strong></div>
          </div>

          <div class="field-note">
            ${escapeHtml(t("settings_panel.import_note"))}
          </div>
        </section>
      </section>

      <section class="surface-card">
        <div class="surface-header">
          <div>
            <div class="section-kicker">${escapeHtml(t("settings_panel.product_readiness"))}</div>
            <h2>${escapeHtml(t("settings_panel.product_readiness"))}</h2>
            <p>${escapeHtml(t("settings_panel.product_readiness_desc"))}</p>
          </div>
          <div class="badge-row">
            <span class="badge ${actionBadgeClass("View only")}">${escapeHtml(t("common.view_only"))}</span>
          </div>
        </div>

        <div class="resource-table">
          ${readinessRows.map((row) => `
            <div class="resource-row">
              <div class="resource-main">
                <strong>${escapeHtml(row.area)}</strong>
                <p>${escapeHtml(row.detail)}</p>
              </div>
              <div class="resource-meta">
                <span class="badge ${sourceBadgeClass(row.status)}">${escapeHtml(row.label)}</span>
              </div>
            </div>
          `).join("")}
        </div>
      </section>

      <section class="split-panel">
        <section class="surface-card">
          <div class="surface-header">
            <div>
              <div class="section-kicker">${escapeHtml(t("settings_panel.truthfulness_audit"))}</div>
              <h2>${escapeHtml(t("settings_panel.data_provenance"))}</h2>
              <p>${escapeHtml(t("settings_panel.data_provenance_desc"))}</p>
            </div>
            <div class="badge-row">
              <span class="badge ${actionBadgeClass("View only")}">${escapeHtml(t("common.view_only"))}</span>
            </div>
          </div>

          <div class="list-stack compact">
            ${sources.map((source) => `
              <div class="list-row compact">
                <div class="list-row-main">
                  <strong>${escapeHtml(source.label)}</strong>
                  <p>${escapeHtml(source.detail)}</p>
                </div>
                <div class="row-actions">
                  <span class="badge ${sourceBadgeClass(source.status)}">${escapeHtml(sourceStatusLabel(source.status))}</span>
                </div>
              </div>
            `).join("")}
          </div>
        </section>

        <section class="surface-card">
          <div class="surface-header">
            <div>
              <div class="section-kicker">${escapeHtml(t("settings_panel.interaction_audit"))}</div>
              <h2>${escapeHtml(t("settings_panel.clickable_controls"))}</h2>
              <p>${escapeHtml(t("settings_panel.clickable_controls_desc"))}</p>
            </div>
            <div class="badge-row">
              <span class="badge ${actionBadgeClass("View only")}">${escapeHtml(t("common.view_only"))}</span>
            </div>
          </div>

          <div class="audit-table">
            ${interactions.map((entry) => `
              <div class="audit-row">
                <div>
                  <strong>${escapeHtml(entry.surface)}</strong>
                  <p>${escapeHtml(entry.detail)}</p>
                </div>
                <div class="audit-meta">
                  <span class="badge ${actionBadgeClass(entry.mode)}">${escapeHtml(actionModeLabel(entry.mode))}</span>
                  <span class="subtle">${escapeHtml(entry.truth)}</span>
                </div>
              </div>
            `).join("")}
          </div>
        </section>
      </section>

      <section class="surface-card log-card">
        <div class="surface-header">
          <div>
            <div class="section-kicker">${escapeHtml(t("settings_panel.runtime_diagnostics"))}</div>
            <h2>${escapeHtml(t("settings_panel.desktop_log"))}</h2>
            <p>${escapeHtml(t("settings_panel.desktop_log_desc"))}</p>
          </div>
          <div class="badge-row">
            <span class="badge ${actionBadgeClass("View only")}">${escapeHtml(t("common.view_only"))}</span>
          </div>
        </div>
        <div class="log-list">
          ${state.logs.length ? state.logs.slice().reverse().map((line) => `<div class="log-line">${escapeHtml(line)}</div>`).join("") : `<div class="log-line">${escapeHtml(t("meta.no_logs"))}</div>`}
        </div>
      </section>
    </div>
  `;
}

function renderSidebar() {
  const bootstrap = state.bootstrap || {};
  const tabs = resolvedTabMeta();
  const providerConfig = currentProviderConfig();
  const provider = providerConfig.providerId || bootstrap.provider || state.onboarding.provider;
  const model = providerConfig.model || bootstrap.model || state.onboarding.model;
  const starterAgent = bootstrap.starterAgent || state.onboarding.starterAgent;
  const toggleLabel = state.sidebarCollapsed ? t("shell.expand") : t("shell.collapse");
  const navGroups = sidebarNavGroups();
  const workspacePath = bootstrap.workspacePath || t("shell.workspace_not_set");
  const workspaceDisplay = state.sidebarCollapsed ? shorten(workspacePath, 18) : workspacePath;
  const providerLabel = providerConfig.providerLabel || providerLabels[provider] || provider || t("common.pending");
  const sessionLabel = state.sessionState?.sessionName || state.sessionState?.sessionId || t("common.pending");
  const workspaceSummary = [
    {
      label: t("meta.provider"),
      value: providerLabel,
    },
    {
      label: t("meta.model"),
      value: model || t("common.pending"),
    },
    {
      label: term("agent"),
      value: displayAgentName(starterAgent || "main"),
    },
  ];
  const runtimeSummary = [
    {
      label: t("chat.backend"),
      value: backendStatusLabel(),
      tone: state.backendReady ? "live" : "idle",
    },
    {
      label: term("session"),
      value: shorten(sessionLabel, state.sidebarCollapsed ? 12 : 24),
      mono: true,
    },
    {
      label: t("tab.sessions.label"),
      value: String((bootstrap.sessions || []).length),
    },
  ];

  return `
    <aside class="sidebar card ${state.sidebarCollapsed ? "collapsed" : ""}">
      <div class="sidebar-header">
        <div class="sidebar-header-row">
          <div class="eyebrow">猫爪 maoclaw</div>
          <button
            class="button ghost small sidebar-toggle icon-toggle"
            type="button"
            onclick="toggleSidebar()"
            title="${escapeHtml(toggleLabel)}"
            aria-label="${escapeHtml(toggleLabel)}"
          >${state.sidebarCollapsed ? "→" : "←"}</button>
        </div>
        <div class="brand-lockup">
          <h2>${escapeHtml(t("shell.desktop_client"))}</h2>
          ${state.sidebarCollapsed ? "" : `<p>${escapeHtml(t("shell.desktop_tagline"))}</p>`}
        </div>
        <div class="rail-card sidebar-context-card ${state.sidebarCollapsed ? "compact-rail-card" : ""}">
          <div class="sidebar-context-head">
            <div class="rail-title">${escapeHtml(t("shell.current_workspace"))}</div>
            <strong class="sidebar-context-path" title="${escapeHtml(workspacePath)}">${escapeHtml(workspaceDisplay)}</strong>
          </div>
          ${state.sidebarCollapsed ? "" : `
            <div class="sidebar-context-grid">
              ${workspaceSummary.map((item) => `
                <div class="sidebar-context-stat" title="${escapeHtml(item.value)}">
                  <span>${escapeHtml(item.label)}</span>
                  <strong>${escapeHtml(item.value)}</strong>
                </div>
              `).join("")}
            </div>
          `}
          <div class="sidebar-context-actions">
            <button
              class="button primary small"
              type="button"
              onclick="startNewSession()"
              title="${escapeHtml(t("actions.new_chat"))}"
              aria-label="${escapeHtml(t("actions.new_chat"))}"
            >${state.sidebarCollapsed ? "+" : escapeHtml(t("actions.new_chat"))}</button>
            <button
              class="button secondary small"
              type="button"
              onclick="chooseWorkspace()"
              title="${escapeHtml(t("actions.choose_folder"))}"
              aria-label="${escapeHtml(t("actions.choose_folder"))}"
            >${state.sidebarCollapsed ? "DIR" : escapeHtml(t("actions.choose_folder"))}</button>
          </div>
        </div>
      </div>

      <div class="sidebar-body">
        ${navGroups.length ? `
          <nav class="sidebar-nav">
            ${navGroups.map((group) => `
              <section class="nav-group">
                ${state.sidebarCollapsed ? "" : `<div class="nav-group-label">${escapeHtml(group.label)}</div>`}
                <div class="nav-stack">
                  ${group.tabs.map((id) => {
                    const meta = tabs[id];
                    if (!meta) {
                      return "";
                    }
                    return `
                      <button
                        class="nav-item ${state.activeTab === id ? "active" : ""} ${state.sidebarCollapsed ? "compact" : ""}"
                        type="button"
                        onclick="selectTab('${id}')"
                        title="${escapeHtml(`${meta.label} · ${meta.description}`)}"
                        aria-label="${escapeHtml(meta.label)}"
                      >
                        <span class="nav-item-leading">
                          <span class="nav-item-glyph">${escapeHtml(navGlyph(id))}</span>
                          ${state.sidebarCollapsed ? "" : `
                            <span class="nav-item-copy">
                              <span class="nav-item-title-row">
                                <strong class="nav-item-title">${escapeHtml(meta.label)}</strong>
                                <span class="nav-count-badge">${escapeHtml(navCount(id))}</span>
                              </span>
                              <span class="nav-item-caption">${escapeHtml(meta.description)}</span>
                            </span>
                          `}
                        </span>
                      </button>
                    `;
                  }).join("")}
                </div>
              </section>
            `).join("")}
          </nav>
        ` : ""}
      </div>

      <div class="sidebar-footer">
        <div class="status-card sidebar-runtime-card ${state.statusKind} ${state.sidebarCollapsed ? "compact-status-card" : ""}">
          <div class="sidebar-runtime-head">
            <div class="rail-title">${escapeHtml(t("shell.desktop_status"))}</div>
            <span class="sidebar-status-indicator ${state.backendReady ? "live" : "idle"}">${escapeHtml(backendStatusLabel())}</span>
          </div>
          <strong title="${escapeHtml(state.status || t("common.idle"))}">${escapeHtml(state.sidebarCollapsed ? shorten(state.status || t("common.idle"), 24) : (state.status || t("common.idle")))}</strong>
          <div class="sidebar-runtime-grid">
            ${runtimeSummary.map((item) => `
              <div class="sidebar-mini-stat ${item.tone || ""}" title="${escapeHtml(item.value)}">
                <span>${escapeHtml(item.label)}</span>
                <strong class="${item.mono ? "mono" : ""}">${escapeHtml(item.value)}</strong>
              </div>
            `).join("")}
          </div>
        </div>
        <div class="sidebar-footer-actions">
          <button
            class="button ghost small"
            type="button"
            onclick="openWebWorkspaceExternal()"
            title="${escapeHtml(t("shell.browser"))}"
            aria-label="${escapeHtml(t("shell.browser"))}"
          >${state.sidebarCollapsed ? "WEB" : escapeHtml(t("shell.browser"))}</button>
        </div>
      </div>
    </aside>
  `;
}

function navCount(tabId) {
  switch (tabId) {
    case "chat":
      return state.backendReady ? t("common.live") : backendStatusLabel();
    case "sessions":
      return String((state.bootstrap?.sessions || []).length);
    case "agents":
      return String(availableAgentProfiles().length);
    case "channels":
      return String(availableChannels().filter((entry) => entry.enabled).length);
    case "skills":
      return String((skillsCatalog().skills || []).length);
    case "automations":
      return String((automationState().automations || []).length);
    case "security":
      return String((securityState().decisions || []).length);
    case "settings":
      return t("common.manage");
    default:
      return "";
  }
}

function navGlyph(tabId) {
  switch (tabId) {
    case "chat":
      return "C";
    case "sessions":
      return "S";
    case "agents":
      return "A";
    case "channels":
      return "Ch";
    case "skills":
      return "Sk";
    case "automations":
      return "Cr";
    case "security":
      return "Se";
    case "settings":
      return "St";
    default:
      return String(tabId || "?").slice(0, 2);
  }
}

function renderPrimaryTabRail() {
  const tabs = resolvedTabMeta();
  return `
    <section class="primary-tabbar card minimal">
      <div class="primary-tabrail">
        ${visibleTabIds().map((id) => {
          const meta = tabs[id];
          return `
          <button class="primary-tab ${state.activeTab === id ? "active" : ""}" type="button" onclick="selectTab('${id}')">
            <span>${escapeHtml(meta.label)}</span>
            <small>${escapeHtml(navCount(id))}</small>
          </button>
        `;
        }).join("")}
      </div>
      <div class="primary-tabbar-actions">
        <button class="button secondary small" type="button" onclick="openChatWorkspace()">${escapeHtml(t("shell.open_chat"))}</button>
        <button class="button ghost small" type="button" onclick="openWebWorkspaceExternal()">${escapeHtml(t("shell.browser"))}</button>
        <button class="button ghost small" type="button" onclick="selectTab('settings')">${escapeHtml(t("common.manage"))}</button>
      </div>
    </section>
  `;
}

function renderAppShell() {
  ensureVisibleActiveTab();
  const tabs = resolvedTabMeta();
  const meta = tabs[state.activeTab] || tabs.chat;

  return `
    <div class="native-shell ${state.sidebarCollapsed ? "sidebar-collapsed" : ""}">
      ${renderSidebar()}
      <main class="workspace workspace-flat">
        ${renderPrimaryTabRail()}
        <section class="workspace-main workspace-main-flat">
          ${renderActiveTabContent(meta)}
        </section>
      </main>
    </div>
  `;
}

function renderActiveTabContent(meta) {
  let content = renderChatTab();
  if (state.activeTab === "sessions") {
    content = renderSessionsTab();
  } else if (state.activeTab === "agents") {
    content = renderAgentsTab();
  } else if (state.activeTab === "channels") {
    content = renderChannelsTab();
  } else if (state.activeTab === "skills") {
    content = renderSkillsTab();
  } else if (state.activeTab === "automations") {
    content = renderAutomationsTab();
  } else if (state.activeTab === "security") {
    content = renderSecurityTab();
  } else if (state.activeTab === "settings") {
    content = renderSettingsTab();
  }
  return `
    <div class="tab-content-panel" data-tab="${escapeHtml(meta.id || state.activeTab)}">
      ${content}
    </div>
  `;
}

function renderCompactMetaStrip(items, options = {}) {
  const classes = ["compact-meta-strip"];
  if (options.dense) {
    classes.push("dense");
  }
  return `
    <div class="${classes.join(" ")}">
      ${items
        .filter((item) => item && item.value !== undefined && item.value !== null && item.value !== "")
        .map((item) => `
          <div class="compact-meta-item ${item.wide ? "wide" : ""}">
            <span>${escapeHtml(item.label || "")}</span>
            <strong class="${item.mono ? "mono" : ""}">${escapeHtml(String(item.value))}</strong>
          </div>
        `)
        .join("")}
    </div>
  `;
}

function render() {
  const app = document.querySelector("#app");
  if (!app) {
    return;
  }

  if (state.view === "loading") {
    app.innerHTML = renderLoading();
    return;
  }

  app.innerHTML = state.view === "onboarding" ? renderOnboarding() : renderAppShell();

  const messages = document.querySelector(".messages");
  if (messages) {
    messages.scrollTop = messages.scrollHeight;
  }
}

function renderFatal(error) {
  const app = document.querySelector("#app");
  if (!app) {
    return;
  }
  app.innerHTML = `
    <div class="shell fallback-shell">
      <section class="card panel narrow">
        <div class="eyebrow">${escapeHtml(productName())}</div>
        <h1>${escapeHtml(t("startup.failed_title"))}</h1>
        <p class="panel-subtitle">${escapeHtml(t("startup.failed_desc"))}</p>
        <div class="status-line error">${escapeHtml(String(error))}</div>
      </section>
    </div>
  `;
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeJsSingle(value) {
  return String(value || "")
    .replaceAll("\\", "\\\\")
    .replaceAll("'", "\\'")
    .replaceAll("\n", "\\n");
}

function capitalize(value) {
  if (!value) {
    return "";
  }
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function shorten(value, max) {
  const text = String(value || "");
  if (text.length <= max) {
    return text;
  }
  return `${text.slice(0, Math.max(0, max - 1))}…`;
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
        pending.reject(message.error || uiCopy("status.unknownProductError", { product: productName() }));
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
        }
        break;
      case "backend_log":
        state.logs = [...state.logs, message.payload.line].slice(-120);
        if (state.bootstrap) {
          const diagnostics = state.bootstrap.diagnosticsState || { entries: [], errorCount: 0, warningCount: 0 };
          const entry = parseDiagnosticLine(message.payload.line);
          const nextEntries = [...(diagnostics.entries || []), entry].slice(-200);
          state.bootstrap.diagnosticsState = {
            ...diagnostics,
            entries: nextEntries,
            errorCount: nextEntries.filter((item) => item.level === "error").length,
            warningCount: nextEntries.filter((item) => item.level === "warn").length,
          };
        }
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
        appendLocalizedStatus("sessionExported", { path: message.payload.path || uiCopy("common.selectedPath") });
        break;
      default:
        break;
    }
  }
};

window.addEventListener("DOMContentLoaded", () => {
  try {
    boot();
  } catch (error) {
    console.error(error);
    renderFatal(error);
  }
});

window.addEventListener("resize", () => {
  syncResponsiveShell();
});

/* Desktop V2 */

const V2_COPY = {
  en: {
    loadingTitle: "Booting Desktop V2",
    loadingBody: "Reconnecting the embedded control center, local runtime, and active project state.",
    fatalTitle: "Desktop V2 hit a startup error",
    fatalBody: "The host window is running, but the local control center could not finish booting.",
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
    workspaceBody: "The local runtime is pointed at the directory below.",
    openCurrentSession: "Open session file",
    openAppSupport: "App support",
    openHostedWeb: "Open hosted web",
    restartBackend: "Restart backend",
    heroEyebrow: "Desktop V2",
    heroTitle: "Keep the active coding thread in view, with operations pushed to the edges.",
    heroBody: "This shell is optimized for the one thing the desktop has to do well: show the current conversation, keep session context visible, and expose settings without burying the thread.",
    statusReady: "Desktop connected.",
    statusSetup: "Complete setup to start your first session.",
    statusRefreshed: "Desktop state refreshed.",
    statusWorkspace: "Workspace updated.",
    statusSaved: "Desktop defaults saved.",
    statusImported: "Existing setup imported.",
    statusRestarted: "Backend restarted.",
    statusPromptAccepted: "Prompt accepted.",
    statusSessionRenamed: "Session name updated.",
    statusSessionSwitched: "Session switched.",
    statusModelApplied: "Model selection applied.",
    statusAgentApplied: "Agent lane updated for this session.",
    statusAttachmentPicked: "Files attached.",
    connected: "Connected",
    booting: "Booting",
    offline: "Offline",
    liveChat: "Live chat",
    sessionMetrics: "Session metrics",
    defaultsCard: "Desktop defaults",
    currentSessionCard: "Current session",
    diagnosticsCard: "Recent diagnostics",
    logsEmpty: "Runtime logs will appear here once the backend reports status or diagnostics.",
    emptyChatTitle: "Start the next task here",
    emptyChatBody: "Send a prompt, attach files, or open an earlier session from the left rail.",
    composePlaceholder: "Ask for code changes, reviews, architecture work, or attach files for context.",
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
    diagnosticsHint: "These are the latest lines from the macOS bridge and runtime logs.",
    languageEnglish: "English",
    languageChinese: "Chinese",
    modeSimple: "Simple",
    modePro: "Pro",
    noMessages: "No visible messages yet.",
    importAvailable: "A previous CLI setup was found and can be imported directly.",
    current: "Current",
    lastUpdated: "Updated",
    saveHostActions: "Local surface only",
    browserHint: "Open the hosted workspace in your browser.",
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
    noLogs: "No diagnostic lines yet.",
    hostedWebHint: "Keeps the hosted workspace available without making it the main desktop experience.",
    sessionSearch: "Filter sessions",
    noSessionMatches: "No sessions match the current filter.",
    quickActions: "Quick actions",
    quickPromptReview: "Review the current code and identify the highest-risk issues.",
    quickPromptRefactor: "Refactor this area for clarity and maintainability.",
    quickPromptTrace: "Trace the bug from symptom to root cause and fix it.",
    quickPromptPlan: "Plan the implementation, then make the changes end to end.",
    shortcutHint: "Use Cmd/Ctrl + Enter to send.",
    filterLogs: "Filter diagnostics",
    sourceLabel: "Source",
    categoryLabel: "Category"
  },
  zh: {
    loadingTitle: "正在启动 Desktop V2",
    loadingBody: "正在重连内置控制中心、本地 runtime 与当前项目状态。",
    fatalTitle: "Desktop V2 启动失败",
    fatalBody: "宿主窗口仍在运行，但本地控制中心没能完成启动。",
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
    workspaceBody: "本地 runtime 当前指向下面这个目录。",
    openCurrentSession: "打开会话文件",
    openAppSupport: "打开 App Support",
    openHostedWeb: "打开托管 Web",
    restartBackend: "重启后端",
    heroEyebrow: "Desktop V2",
    heroTitle: "把正在进行的编码线程放在视线中央，把操作面收敛到边缘。",
    heroBody: "这个壳层只优化一件事：把当前对话、会话上下文和必要设置同时放到一屏里，而不是把线程埋掉。",
    statusReady: "桌面端已连接。",
    statusSetup: "完成配置后即可开始第一个会话。",
    statusRefreshed: "桌面状态已刷新。",
    statusWorkspace: "工作目录已更新。",
    statusSaved: "桌面默认值已保存。",
    statusImported: "已导入原有配置。",
    statusRestarted: "后端已重启。",
    statusPromptAccepted: "Prompt 已接受。",
    statusSessionRenamed: "会话名称已更新。",
    statusSessionSwitched: "已切换会话。",
    statusModelApplied: "模型切换已生效。",
    statusAgentApplied: "当前会话的 agent lane 已更新。",
    statusAttachmentPicked: "文件已附加。",
    connected: "已连接",
    booting: "启动中",
    offline: "离线",
    liveChat: "实时对话",
    sessionMetrics: "会话指标",
    defaultsCard: "桌面默认值",
    currentSessionCard: "当前会话",
    diagnosticsCard: "最近诊断",
    logsEmpty: "一旦后端输出状态或诊断信息，日志就会显示在这里。",
    emptyChatTitle: "从这里开始下一项任务",
    emptyChatBody: "发送 prompt、附加文件，或者从左侧打开之前的会话。",
    composePlaceholder: "在这里请求改代码、做 review、架构重构，或者附加文件作为上下文。",
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
    diagnosticsHint: "这里显示来自 macOS bridge 和 runtime 的最新日志行。",
    languageEnglish: "English",
    languageChinese: "中文",
    modeSimple: "Simple",
    modePro: "Pro",
    noMessages: "还没有可见消息。",
    importAvailable: "检测到旧的 CLI 配置，可以直接导入。",
    current: "当前",
    lastUpdated: "更新时间",
    saveHostActions: "本地主界面",
    browserHint: "在浏览器中打开托管 workspace。",
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
    noLogs: "还没有诊断日志。",
    hostedWebHint: "保留托管 workspace，但不再把它当作桌面主界面。",
    sessionSearch: "筛选会话",
    noSessionMatches: "当前筛选下没有匹配的会话。",
    quickActions: "快捷动作",
    quickPromptReview: "审查当前代码并指出风险最高的问题。",
    quickPromptRefactor: "把这一块重构得更清晰、更好维护。",
    quickPromptTrace: "从现象一路追到根因并修掉这个 bug。",
    quickPromptPlan: "先规划实现，再把改动完整做完。",
    shortcutHint: "使用 Cmd/Ctrl + Enter 发送。",
    filterLogs: "筛选诊断",
    sourceLabel: "来源",
    categoryLabel: "类别"
  }
};

function v2EnsureState() {
  if (!state.v2) {
    state.v2 = {
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
      autoScrollPending: false,
    };
  }
  return state.v2;
}

function v2Locale() {
  const raw = String(state.ui?.language || state.bootstrap?.uiLanguage || "en").toLowerCase();
  return raw.startsWith("zh") ? "zh" : "en";
}

function v2Text(key, params = {}) {
  const locale = v2Locale();
  const base = V2_COPY[locale] || V2_COPY.en;
  let value = base[key] || V2_COPY.en[key] || key;
  for (const [name, replacement] of Object.entries(params)) {
    value = value.replaceAll(`{${name}}`, String(replacement));
  }
  return value;
}

function v2ProviderPresets() {
  return Array.isArray(state.bootstrap?.providerPresets) && state.bootstrap.providerPresets.length
    ? state.bootstrap.providerPresets
    : providerPresetFallbacks;
}

function v2ProviderPresetById(id) {
  const lower = String(id || "").toLowerCase();
  return (
    v2ProviderPresets().find((preset) => {
      const presetId = String(preset.id || "").toLowerCase();
      const runtimeId = String(preset.runtimeProviderId || "").toLowerCase();
      return presetId === lower || runtimeId === lower;
    }) || v2ProviderPresets()[0]
  );
}

function v2RecommendedModel(provider, presetId) {
  const preset = v2ProviderPresetById(presetId || provider);
  return (
    state.bootstrap?.recommendedModels?.[provider]?.[0] ||
    preset?.defaultModels?.[0] ||
    ""
  );
}

function v2Agents() {
  return Array.isArray(state.bootstrap?.agents) ? state.bootstrap.agents : [];
}

function v2Sessions() {
  return Array.isArray(state.bootstrap?.sessions) ? state.bootstrap.sessions : [];
}

function v2CurrentSessionPath() {
  const v2 = v2EnsureState();
  return (
    state.sessionState?.sessionFile ||
    state.bootstrap?.currentSessionPath ||
    v2.selectedSessionPath ||
    ""
  );
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
  const query = String(v2EnsureState().diagnosticsQuery || "").trim().toLowerCase();
  const logs = (state.logs || []).map((line) => parseDiagnosticLine(line));
  if (!query) {
    return logs;
  }
  return logs.filter((entry) => {
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

  const availableSessionPaths = new Set(v2Sessions().map((session) => session.path));
  if (!v2.selectedSessionPath || !availableSessionPaths.has(v2.selectedSessionPath)) {
    v2.selectedSessionPath = payload.currentSessionPath || v2Sessions()[0]?.path || "";
  }

  if (!v2.sessionNameDirty) {
    v2.sessionNameDraft =
      state.sessionState?.sessionName ||
      v2CurrentSession()?.name ||
      "";
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
      label: "You",
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
      label: state.bootstrap?.productName || PRODUCT_FALLBACK,
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
    label: state.bootstrap?.productName || PRODUCT_FALLBACK,
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
      appendStatus(v2Text("statusSessionSwitched"));
      refreshDesktop(false);
      break;
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
  }
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

function v2ToggleSetting(field) {
  const v2 = v2EnsureState();
  v2.settingsDraft[field] = !v2.settingsDraft[field];
  render();
}

function chooseWorkspace() {
  hostRequest("chooseWorkspace")
    .then((response) => {
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
      const attachments = Array.isArray(response.payload?.attachments)
        ? response.payload.attachments
        : [];
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
    label: "You",
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
  const preset = v2ProviderPresets().find(
    (entry) => (entry.runtimeProviderId || entry.id) === value
  );
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
            ${
              importCandidate.available
                ? `<div class="v2-note">${escapeHtml(v2Text("importAvailable"))}</div>`
                : ""
            }
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
          <div class="v2-action-grid">
            <button class="v2-button" type="button" onclick="saveOnboarding()">${escapeHtml(v2Text("saveAndLaunch"))}</button>
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
        </div>
      </div>
    `;
  }

  return state.messages
    .map((message) => `
      <article class="v2-message ${escapeHtml(message.role)} ${message.streaming ? "streaming" : ""}">
        <div class="v2-message-meta">
          <span>${escapeHtml(message.label || (message.role === "user" ? "You" : PRODUCT_FALLBACK))}</span>
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

function v2RenderSidebar() {
  return `
    <aside class="v2-sidebar">
      <section class="v2-card pad-md">
        <div class="v2-brand">
          <div class="v2-inline-row">
            <span class="v2-brand-mark">猫</span>
            <div>
              <strong>maoclaw</strong>
              <div class="v2-inline-meta">${escapeHtml(v2Text("sidebarTitle"))}</div>
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

function v2RenderAside() {
  const v2 = v2EnsureState();
  const currentSession = v2CurrentSession();
  const currentModel = v2CurrentModel();
  const suggestions = v2ModelsForProvider(v2.modelDraft.provider || currentModel.provider);
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
            <button class="v2-ghost" type="button" onclick="v2OpenHostedWorkspace()">${escapeHtml(v2Text("openHostedWeb"))}</button>
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
          <span class="v2-pill">${escapeHtml(v2FormatCount(v2FilteredLogs().length))}</span>
        </div>
        <p class="v2-copy">${escapeHtml(v2Text("diagnosticsHint"))}</p>
        <div class="v2-field">
          <input
            class="v2-input"
            value="${escapeHtml(v2EnsureState().diagnosticsQuery || "")}"
            placeholder="${escapeHtml(v2Text("filterLogs"))}"
            oninput="v2SetDiagnosticsQuery(this.value)"
          />
        </div>
        <div class="v2-log-list">
          ${
            v2FilteredLogs().length
              ? v2FilteredLogs()
                  .slice(-12)
                  .reverse()
                  .map((entry) => `
                    <div class="v2-log-row ${escapeHtml(entry.level || "info")}">
                      <div class="v2-row-between">
                        <span class="v2-badge ${entry.level === "error" ? "bad" : entry.level === "warn" ? "warn" : "good"}">${escapeHtml(entry.level || "info")}</span>
                        <small>${escapeHtml(v2FormatTime(entry.timestamp))}</small>
                      </div>
                      <strong>${escapeHtml(entry.message || "")}</strong>
                      <small>${escapeHtml(v2Text("sourceLabel"))}: ${escapeHtml(entry.source || "desktop")} · ${escapeHtml(v2Text("categoryLabel"))}: ${escapeHtml(entry.category || "general")}</small>
                    </div>
                  `)
                  .join("")
              : `<div class="v2-empty"><div><strong>${escapeHtml(v2Text("noLogs"))}</strong><p class="v2-empty-copy">${escapeHtml(v2Text("logsEmpty"))}</p></div></div>`
          }
        </div>
      </section>
    </aside>
  `;
}

function v2RenderApp() {
  return `
    <div class="v2-root">
      <div class="v2-shell">
        ${v2RenderSidebar()}
        ${v2RenderMain()}
        ${v2RenderAside()}
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
