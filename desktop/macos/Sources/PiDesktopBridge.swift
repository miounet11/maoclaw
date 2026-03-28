import AppKit
import AVFoundation
import ApplicationServices
import CoreGraphics
import CoreLocation
import Darwin
import Foundation
import Speech
import UniformTypeIdentifiers
import UserNotifications
import WebKit

final class PiDesktopBridge: NSObject, CLLocationManagerDelegate {
    private struct PendingRPCBridgeRequest {
        let requestId: String?
        let command: String
    }

    private let productDisplayName = "猫爪 maoclaw"
    private let productDirectoryName = "maoclaw"
    private let defaultWebWorkspaceURL = "https://xinxiang.xin"
    private let defaultLocalBridgePort: UInt16 = 43115
    private let pendingRPCRequestTimeoutSeconds: TimeInterval = 8
    private let releaseAPIURL = URL(string: "https://api.github.com/repos/miounet11/maoclaw/releases/latest")!
    private let releasesPageURL = URL(string: "https://github.com/miounet11/maoclaw/releases")!
    private weak var webView: WKWebView?
    private var rpcProcess: Process?
    private var rpcStdin: FileHandle?
    private var localBridgeProcess: Process?
    private var nativeShellProcess: Process?
    private var localBridgePort: UInt16 = 43115
    private var rpcStdoutBuffer = Data()
    private var rpcStderrBuffer = Data()
    private var bridgeStdoutBuffer = Data()
    private var bridgeStderrBuffer = Data()
    private var nativeStdoutBuffer = Data()
    private var nativeStderrBuffer = Data()
    private var recentLogs: [String] = []
    private var currentSessionPath: String?
    private var locationManager: CLLocationManager?
    private var pendingLocationPermissionRequestId: String?
    private let pendingRPCRequestsLock = NSLock()
    private var pendingRPCRequests: [String: PendingRPCBridgeRequest] = [:]

    private let fileManager = FileManager.default
    private lazy var encoder: JSONEncoder = {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        return encoder
    }()
    private let decoder = JSONDecoder()

    private lazy var providerPresets: [DesktopProviderPreset] = Self.loadProviderPresets()
    private lazy var recommendedModels: [String: [String]] = {
        var models: [String: [String]] = [:]
        for preset in providerPresets where models[preset.runtimeProviderId] == nil {
            models[preset.runtimeProviderId] = preset.defaultModels
        }
        return models
    }()
    private let agentCatalog: [DesktopAgentSummary] = [
        DesktopAgentSummary(
            id: "main",
            displayName: "Main",
            description: "General assistant for coding, planning, and execution.",
            modeId: "follow_main",
            modeLabel: "Follows main settings",
            provider: nil,
            model: nil,
            skills: [],
            builtinSkills: [],
            prompts: [],
            skillScope: "Global-only",
            hasCustomizations: false
        ),
        DesktopAgentSummary(
            id: "architect",
            displayName: "Architect",
            description: "Design, refactor, review, and technical tradeoffs.",
            modeId: "follow_main",
            modeLabel: "Follows main settings",
            provider: nil,
            model: nil,
            skills: ["senior-architect"],
            builtinSkills: ["senior-architect"],
            prompts: [],
            skillScope: "Shipped profile bundle",
            hasCustomizations: false
        ),
        DesktopAgentSummary(
            id: "implementer",
            displayName: "Implementer",
            description: "Fast code writing and file modification.",
            modeId: "follow_main",
            modeLabel: "Follows main settings",
            provider: nil,
            model: nil,
            skills: [],
            builtinSkills: [],
            prompts: [],
            skillScope: "Global-only",
            hasCustomizations: false
        ),
        DesktopAgentSummary(
            id: "debugger",
            displayName: "Debugger",
            description: "Root cause analysis, logs, and regressions.",
            modeId: "follow_main",
            modeLabel: "Follows main settings",
            provider: nil,
            model: nil,
            skills: [],
            builtinSkills: [],
            prompts: [],
            skillScope: "Global-only",
            hasCustomizations: false
        ),
        DesktopAgentSummary(
            id: "operator",
            displayName: "Operator",
            description: "Diagnostics, environment checks, and deployment tasks.",
            modeId: "follow_main",
            modeLabel: "Follows main settings",
            provider: nil,
            model: nil,
            skills: [],
            builtinSkills: [],
            prompts: [],
            skillScope: "Global-only",
            hasCustomizations: false
        )
    ]
    private let bindingCatalog: [DesktopBindingSummary] = [
        DesktopBindingSummary(
            id: "telegram",
            name: "Telegram",
            status: "disabled",
            health: "scaffolded",
            linkedAgent: "main",
            authState: "not_connected",
            lastMessage: nil,
            note: "Visible v1 scaffold. Binding flow stays optional until after local chat."
        ),
        DesktopBindingSummary(
            id: "feishu",
            name: "Feishu",
            status: "disabled",
            health: "scaffolded",
            linkedAgent: "operator",
            authState: "not_connected",
            lastMessage: nil,
            note: "Desktop shell exposes the product surface now; adapter wiring lands later."
        ),
        DesktopBindingSummary(
            id: "qq",
            name: "QQ",
            status: "disabled",
            health: "scaffolded",
            linkedAgent: "implementer",
            authState: "not_connected",
            lastMessage: nil,
            note: "Reserved visible slot for the planned adapter, without blocking first-run chat."
        )
    ]

    func attach(webView: WKWebView) {
        self.webView = webView
    }

    func currentHostSettings() -> DesktopHostSettings {
        resolvedHostSettings(from: loadSettings())
    }

    func prewarmForSurface(_ surface: String) {
        let configured = bootstrapPayload()["configured"] as? Bool == true
        guard configured else {
            return
        }
        do {
            try ensureLocalBridge()
            if surface != "web" {
                try ensureBackend()
                requestBackendSnapshot()
            }
        } catch {
            appendLog("desktop prewarm failed: \(error.localizedDescription)")
        }
    }

    func launchNativeShell(activate: Bool) -> Bool {
        do {
            try ensureNativeShell()
            if activate {
                activateNativeShellWindow()
            }
            return true
        } catch {
            appendLog("native shell launch failed: \(error.localizedDescription)")
            return false
        }
    }

    func stopNativeShell() {
        terminateProcess(nativeShellProcess)
        nativeShellProcess = nil
    }

    func stopWebHelpers() {
        stopBackend()
        stopLocalBridge()
    }

    func saveHostSettings(payload: [String: Any]) throws -> [String: Any] {
        let nextSettings = resolvedHostSettings(from: payload)
        var settings = loadSettings()
        settings.hostSettings = nextSettings
        try saveSettings(settings)
        if settings.onboarding?.completed == true {
            try ensureLocalBridge()
        }
        return bootstrapPayload()
    }

    func respondToFrontend(requestId: String?, ok: Bool, payload: [String: Any] = [:], error: String? = nil) {
        respond(requestId: requestId, ok: ok, payload: payload, error: error)
    }

    func noteHostEvent(_ message: String) {
        appendLog(message)
    }

    func handle(message: WKScriptMessage) {
        guard let body = message.body as? [String: Any] else {
            return
        }

        let action = body["action"] as? String ?? ""
        let requestId = body["requestId"] as? String
        let payload = body["payload"] as? [String: Any] ?? [:]

        switch action {
        case "bootstrap":
            handleBootstrap(requestId: requestId)
        case "refreshDesktop":
            handleRefreshDesktop(requestId: requestId)
        case "saveOnboarding":
            handleSaveOnboarding(requestId: requestId, payload: payload)
        case "savePreferences":
            handleSavePreferences(requestId: requestId, payload: payload)
        case "setSessionAgentProfile":
            handleSetSessionAgentProfile(requestId: requestId, payload: payload)
        case "removeProviderCredential":
            handleRemoveProviderCredential(requestId: requestId, payload: payload)
        case "saveBindings":
            handleSaveBindings(requestId: requestId, payload: payload)
        case "saveSkillSettings":
            handleSaveSkillSettings(requestId: requestId, payload: payload)
        case "installCatalogSkill":
            handleInstallCatalogSkill(requestId: requestId, payload: payload)
        case "saveHostSettings":
            handleSaveHostSettings(requestId: requestId, payload: payload)
        case "saveAgentProfiles":
            handleSaveAgentProfiles(requestId: requestId, payload: payload)
        case "saveAutomation":
            handleSaveAutomation(requestId: requestId, payload: payload)
        case "deleteAutomation":
            handleDeleteAutomation(requestId: requestId, payload: payload)
        case "toggleAutomation":
            handleToggleAutomation(requestId: requestId, payload: payload)
        case "saveSecuritySettings":
            handleSaveSecuritySettings(requestId: requestId, payload: payload)
        case "setPermissionDecision":
            handleSetPermissionDecision(requestId: requestId, payload: payload)
        case "removePermissionExtension":
            handleRemovePermissionExtension(requestId: requestId, payload: payload)
        case "resetPermissionDecisions":
            handleResetPermissionDecisions(requestId: requestId)
        case "pickScopedDirectory":
            handlePickScopedDirectory(requestId: requestId)
        case "removeScopedDirectory":
            handleRemoveScopedDirectory(requestId: requestId, payload: payload)
        case "requestSystemPermission":
            handleRequestSystemPermission(requestId: requestId, payload: payload)
        case "openPrivacySettings":
            handleOpenPrivacySettings(requestId: requestId, payload: payload)
        case "openDesktopLog":
            handleOpenDesktopLog(requestId: requestId)
        case "exportDiagnosticsReport":
            handleExportDiagnosticsReport(requestId: requestId)
        case "prepareSupportReport":
            handlePrepareSupportReport(requestId: requestId)
        case "setGoalContract":
            handleSetGoalContract(requestId: requestId, payload: payload)
        case "updateGoalRun":
            handleUpdateGoalRun(requestId: requestId, payload: payload)
        case "updateGoalCriterion":
            handleUpdateGoalCriterion(requestId: requestId, payload: payload)
        case "clearGoalContract":
            handleClearGoalContract(requestId: requestId)
        case "sendPrompt":
            handleSendPrompt(requestId: requestId, payload: payload)
        case "pickComposerAttachments":
            handlePickComposerAttachments(requestId: requestId, payload: payload)
        case "openExternalPath":
            handleOpenExternalPath(requestId: requestId, payload: payload)
        case "chooseWorkspace":
            handleChooseWorkspace(requestId: requestId)
        case "openSessionsFolder":
            handleOpenPath(requestId: requestId, path: sessionsDirectory())
        case "openAppSupport":
            handleOpenPath(requestId: requestId, path: appSupportRoot())
        case "openCurrentSession":
            handleOpenCurrentSession(requestId: requestId)
        case "checkForUpdates":
            handleCheckForUpdates(requestId: requestId)
        case "downloadAndInstallUpdate":
            handleDownloadAndInstallUpdate(requestId: requestId)
        case "openReleasePage":
            handleOpenReleasePage(requestId: requestId)
        case "restartBackend":
            restartBackend()
            respond(requestId: requestId, ok: true, payload: bootstrapPayload())
        case "newSession":
            handleNewSession(requestId: requestId)
        case "switchSession":
            handleSwitchSession(requestId: requestId, payload: payload)
        case "setModel":
            handleSetModel(requestId: requestId, payload: payload)
        case "setSessionName":
            handleSetSessionName(requestId: requestId, payload: payload)
        case "exportCurrentSession":
            handleExportCurrentSession(requestId: requestId)
        case "importExistingSetup":
            handleImportExistingSetup(requestId: requestId)
        default:
            respond(requestId: requestId, ok: false, error: "Unknown action: \(action)")
        }
    }

    func handleConsole(message: WKScriptMessage) {
        if let body = message.body as? [String: Any] {
            let level = body["level"] as? String ?? "log"
            let text = body["message"] as? String ?? ""
            if !text.isEmpty {
                appendLog("web[\(level)]: \(text)")
            }
        } else if let text = message.body as? String, !text.isEmpty {
            appendLog("web: \(text)")
        }
    }

    func noteWebEvent(_ message: String) {
        appendLog("webview: \(message)")
    }

    func pruneStaleHelperProcesses() {
        let keepPids = Set(
            [
                localBridgeProcess?.processIdentifier,
                rpcProcess?.processIdentifier,
                nativeShellProcess?.processIdentifier
            ].compactMap { $0 }
        )

        let candidateBinaries = [bundledBinaryPath(), bundledNativeShellPath()]
        for binary in candidateBinaries {
            let path = binary.path
            guard fileManager.isExecutableFile(atPath: path) else {
                continue
            }
            guard let output = try? runProcessCaptureOutput(
                launchPath: "/usr/bin/pgrep",
                arguments: ["-f", path]
            ) else {
                continue
            }

            for line in output.split(whereSeparator: \.isNewline) {
                guard let pid = Int32(line), pid > 0 else {
                    continue
                }
                if keepPids.contains(pid) || pid == ProcessInfo.processInfo.processIdentifier {
                    continue
                }
                if kill(pid, SIGTERM) == 0 {
                    appendLog("reaped stale helper process \(pid)")
                }
            }
        }
    }

    func applicationWillTerminate() {
        stopBackend()
        stopLocalBridge()
        stopNativeShell()
    }

    // MARK: - Paths

    private func appSupportRoot() -> URL {
        let base = fileManager.urls(for: .applicationSupportDirectory, in: .userDomainMask)
            .first!
        return base.appendingPathComponent(productDirectoryName, isDirectory: true)
    }

    private func legacyDesktopSupportRoot() -> URL {
        let base = fileManager.urls(for: .applicationSupportDirectory, in: .userDomainMask)
            .first!
        return base.appendingPathComponent("Pi Desktop", isDirectory: true)
    }

    private func agentRoot() -> URL {
        appSupportRoot().appendingPathComponent("agent", isDirectory: true)
    }

    private func settingsPath() -> URL {
        agentRoot().appendingPathComponent("settings.json")
    }

    private func authPath() -> URL {
        agentRoot().appendingPathComponent("auth.json")
    }

    private func modelsPath() -> URL {
        agentRoot().appendingPathComponent("models.json")
    }

    private func sessionsDirectory() -> URL {
        appSupportRoot().appendingPathComponent("sessions", isDirectory: true)
    }

    private func desktopStatePath() -> URL {
        appSupportRoot().appendingPathComponent("desktop-state.json")
    }

    private func desktopLogPath() -> URL {
        appSupportRoot().appendingPathComponent("desktop.log")
    }

    private func diagnosticsDirectory() -> URL {
        appSupportRoot().appendingPathComponent("diagnostics", isDirectory: true)
    }

    private func legacyAgentRoot() -> URL {
        URL(fileURLWithPath: NSHomeDirectory())
            .appendingPathComponent(".pi", isDirectory: true)
            .appendingPathComponent("agent", isDirectory: true)
    }

    private func legacySettingsPath() -> URL {
        legacyAgentRoot().appendingPathComponent("settings.json")
    }

    private func legacyAuthPath() -> URL {
        legacyAgentRoot().appendingPathComponent("auth.json")
    }

    private func bundledBinaryPath() -> URL {
        Bundle.main.resourceURL!
            .appendingPathComponent("bin", isDirectory: true)
            .appendingPathComponent("pi")
    }

    private func bundledNativeShellPath() -> URL {
        Bundle.main.resourceURL!
            .appendingPathComponent("bin", isDirectory: true)
            .appendingPathComponent("pi_desktop")
    }

    private func workspaceURL() -> URL {
        let workspacePath = loadRuntimeState().workspacePath ?? NSHomeDirectory()
        return URL(fileURLWithPath: workspacePath, isDirectory: true)
    }

    private func projectRoot() -> URL {
        workspaceURL().appendingPathComponent(".pi", isDirectory: true)
    }

    private func projectSettingsPath() -> URL {
        projectRoot().appendingPathComponent("settings.json")
    }

    private func permissionsPath() -> URL {
        agentRoot().appendingPathComponent("extension-permissions.json")
    }

    private func globalSkillsRoot() -> URL {
        agentRoot().appendingPathComponent("skills", isDirectory: true)
    }

    private func projectSkillsRoot() -> URL {
        projectRoot().appendingPathComponent("skills", isDirectory: true)
    }

    private func bundledSkillCatalogRoot() -> URL? {
        Bundle.main.resourceURL?.appendingPathComponent("skill-catalog", isDirectory: true)
    }

    private func bundledSkillCatalogManifestPath() -> URL? {
        Bundle.main.resourceURL?.appendingPathComponent("skill_catalog.tsv", isDirectory: false)
    }

    private func automationsRoot() -> URL {
        projectRoot().appendingPathComponent("automations", isDirectory: true)
    }

    private func ensureDirectories() throws {
        try migrateLegacyDesktopSupportIfNeeded()
        try fileManager.createDirectory(at: appSupportRoot(), withIntermediateDirectories: true)
        try fileManager.createDirectory(at: agentRoot(), withIntermediateDirectories: true)
        try fileManager.createDirectory(at: sessionsDirectory(), withIntermediateDirectories: true)
        try fileManager.createDirectory(at: diagnosticsDirectory(), withIntermediateDirectories: true)
    }

    private func migrateLegacyDesktopSupportIfNeeded() throws {
        let legacyRoot = legacyDesktopSupportRoot()
        let currentRoot = appSupportRoot()
        guard fileManager.fileExists(atPath: legacyRoot.path) else {
            return
        }
        guard !fileManager.fileExists(atPath: currentRoot.path) else {
            return
        }
        try fileManager.copyItem(at: legacyRoot, to: currentRoot)
    }

    // MARK: - Persistence

    private func loadSettings() -> DesktopSettings {
        decode(DesktopSettings.self, from: settingsPath()) ?? DesktopSettings()
    }

    private func saveSettings(_ settings: DesktopSettings) throws {
        try ensureDirectories()
        var merged = loadJSONObject(from: settingsPath())
        for key in [
            "defaultProvider",
            "defaultModel",
            "providerPreset",
            "defaultProviderName",
            "defaultApiBaseURL",
            "defaultApiProtocol",
            "starterAgent",
            "checkForUpdates",
            "onboarding",
            "hostSettings"
        ] {
            merged.removeValue(forKey: key)
        }

        let settingsObject = dictionary(from: settings)
        for (key, value) in settingsObject {
            merged[key] = value
        }
        try saveJSONObject(merged, to: settingsPath())
    }

    private func resolvedHostSettings(from settings: DesktopSettings) -> DesktopHostSettings {
        DesktopHostSettings(
            preferredSurface: resolvedSurfaceMode(settings.hostSettings?.preferredSurface),
            webWorkspaceURL: resolvedWebWorkspaceURL(settings.hostSettings?.webWorkspaceURL),
            closeBehavior: resolvedCloseBehavior(settings.hostSettings?.closeBehavior),
            menuBarEnabled: settings.hostSettings?.menuBarEnabled ?? true
        )
    }

    private func resolvedHostSettings(from payload: [String: Any]) -> DesktopHostSettings {
        let requestedClose = resolvedCloseBehavior(stringValue(payload["closeBehavior"]))
        let menuBarEnabled = (boolValue(payload["menuBarEnabled"]) ?? true) || requestedClose == "background"
        return DesktopHostSettings(
            preferredSurface: resolvedSurfaceMode(stringValue(payload["preferredSurface"])),
            webWorkspaceURL: resolvedWebWorkspaceURL(stringValue(payload["webWorkspaceURL"])),
            closeBehavior: requestedClose,
            menuBarEnabled: menuBarEnabled
        )
    }

    private func resolvedSurfaceMode(_ value: String?) -> String {
        switch value?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() {
        case "web":
            return "web"
        default:
            return "native"
        }
    }

    private func resolvedCloseBehavior(_ value: String?) -> String {
        switch value?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() {
        case "quit":
            return "quit"
        default:
            return "background"
        }
    }

    private func resolvedWebWorkspaceURL(_ value: String?) -> String {
        let trimmed = value?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        guard !trimmed.isEmpty else {
            return defaultWebWorkspaceURL
        }
        let candidate = trimmed.contains("://") ? trimmed : "https://\(trimmed)"
        guard
            let components = URLComponents(string: candidate),
            let scheme = components.scheme?.lowercased(),
            ["https", "http"].contains(scheme),
            components.host?.isEmpty == false,
            components.url != nil
        else {
            return defaultWebWorkspaceURL
        }
        return candidate
    }

    private func loadRuntimeState() -> DesktopRuntimeState {
        decode(DesktopRuntimeState.self, from: desktopStatePath()) ?? DesktopRuntimeState()
    }

    private func saveRuntimeState(_ state: DesktopRuntimeState) throws {
        try ensureDirectories()
        let data = try encoder.encode(state)
        try data.write(to: desktopStatePath(), options: .atomic)
    }

    private func saveAuth(provider: String, apiKey: String) throws {
        try ensureDirectories()
        let trimmedProvider = provider.trimmingCharacters(in: .whitespacesAndNewlines)
        let trimmedKey = apiKey.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedProvider.isEmpty, !trimmedKey.isEmpty else {
            return
        }

        var payload = loadJSONObject(from: authPath())
        payload[trimmedProvider] = dictionary(from: DesktopCredential(key: trimmedKey))
        try saveJSONObject(payload, to: authPath())
    }

    private func decode<T: Decodable>(_ type: T.Type, from path: URL) -> T? {
        guard let data = try? Data(contentsOf: path), !data.isEmpty else {
            return nil
        }
        return try? decoder.decode(type, from: data)
    }

    private func loadJSONObject(from path: URL) -> [String: Any] {
        guard
            let data = try? Data(contentsOf: path),
            !data.isEmpty,
            let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
        else {
            return [:]
        }
        return object
    }

    private func saveJSONObject(_ object: [String: Any], to path: URL) throws {
        try fileManager.createDirectory(
            at: path.deletingLastPathComponent(),
            withIntermediateDirectories: true
        )
        let data = try JSONSerialization.data(
            withJSONObject: object,
            options: [.prettyPrinted, .sortedKeys]
        )
        try data.write(to: path, options: .atomic)
        if path.lastPathComponent == "auth.json" {
            try fileManager.setAttributes([.posixPermissions: 0o600], ofItemAtPath: path.path)
        }
    }

    private func loadJSONArray(from path: URL) -> [[String: Any]] {
        guard
            let data = try? Data(contentsOf: path),
            !data.isEmpty,
            let object = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]]
        else {
            return []
        }
        return object
    }

    private func currentAppVersion() -> String {
        (Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String)?
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .nonEmpty ?? "0.0.0"
    }

    private static func loadProviderPresets() -> [DesktopProviderPreset] {
        guard
            let url = Bundle.main.resourceURL?.appendingPathComponent("setup-presets.json"),
            let data = try? Data(contentsOf: url),
            let presets = try? JSONDecoder().decode([DesktopProviderPreset].self, from: data),
            !presets.isEmpty
        else {
            return fallbackProviderPresets()
        }
        return presets
    }

    private static func fallbackProviderPresets() -> [DesktopProviderPreset] {
        [
            DesktopProviderPreset(
                id: "anthropic",
                runtimeProviderId: "anthropic",
                label: "Claude",
                description: "Official Anthropic API path for Claude with direct API key setup.",
                apiProtocol: "anthropic-messages",
                apiBaseURL: "https://api.anthropic.com/v1/messages",
                defaultModels: ["claude-sonnet-4-6", "claude-opus-4-1"],
                supportsDirectApiKey: true,
                supportsCustomBaseURL: true
            ),
            DesktopProviderPreset(
                id: "openai",
                runtimeProviderId: "openai",
                label: "OpenAI",
                description: "Official OpenAI API path with direct API key setup and broad model coverage.",
                apiProtocol: "openai-responses",
                apiBaseURL: "https://api.openai.com/v1",
                defaultModels: ["gpt-4.1", "gpt-5", "gpt-4o"],
                supportsDirectApiKey: true,
                supportsCustomBaseURL: true
            ),
            DesktopProviderPreset(
                id: "google",
                runtimeProviderId: "google",
                label: "Google Gemini",
                description: "Official Gemini API path with multimodal support and direct API key setup.",
                apiProtocol: "google-generative-ai",
                apiBaseURL: "https://generativelanguage.googleapis.com/v1beta",
                defaultModels: ["gemini-2.5-pro", "gemini-2.0-flash"],
                supportsDirectApiKey: true,
                supportsCustomBaseURL: true
            ),
            DesktopProviderPreset(
                id: "moonshotai",
                runtimeProviderId: "moonshotai",
                label: "Kimi / Moonshot",
                description: "OpenAI-compatible Moonshot path for Kimi users with direct key setup.",
                apiProtocol: "openai-completions",
                apiBaseURL: "https://api.moonshot.ai/v1",
                defaultModels: ["kimi-k2-0905-preview", "moonshot-v1-8k"],
                supportsDirectApiKey: true,
                supportsCustomBaseURL: true
            ),
            DesktopProviderPreset(
                id: "openrouter",
                runtimeProviderId: "openrouter",
                label: "OpenRouter",
                description: "OpenAI-compatible router path with direct endpoint, model, and key control.",
                apiProtocol: "openai-completions",
                apiBaseURL: "https://openrouter.ai/api/v1",
                defaultModels: ["openai/gpt-4.1", "anthropic/claude-sonnet-4.5"],
                supportsDirectApiKey: true,
                supportsCustomBaseURL: true
            ),
            DesktopProviderPreset(
                id: "compatible-gateway",
                runtimeProviderId: "openai",
                label: "Compatible Gateway",
                description: "OpenAI-compatible gateway lane for NewAPI, OneAPI, SiliconFlow, 302.AI, and similar routes.",
                apiProtocol: "openai-completions",
                apiBaseURL: "",
                defaultModels: ["gpt-4.1", "deepseek-chat", "qwen-plus"],
                supportsDirectApiKey: true,
                supportsCustomBaseURL: true
            ),
            DesktopProviderPreset(
                id: "ollama",
                runtimeProviderId: "ollama",
                label: "Ollama",
                description: "Local model lane for Ollama with zero external credentials.",
                apiProtocol: "openai-completions",
                apiBaseURL: "http://127.0.0.1:11434/v1",
                defaultModels: ["qwen2.5-coder:7b", "llama3.2", "deepseek-r1:8b"],
                supportsDirectApiKey: false,
                supportsCustomBaseURL: true
            ),
            DesktopProviderPreset(
                id: "lmstudio",
                runtimeProviderId: "lmstudio",
                label: "LM Studio",
                description: "Local model lane for LM Studio with zero external credentials.",
                apiProtocol: "openai-completions",
                apiBaseURL: "http://127.0.0.1:1234/v1",
                defaultModels: ["qwen2.5-coder", "llama-3.1-8b-instruct", "deepseek-r1-distill-qwen"],
                supportsDirectApiKey: false,
                supportsCustomBaseURL: true
            )
        ]
    }

    private func defaultProviderPreset() -> DesktopProviderPreset {
        providerPresets.first { $0.id == "anthropic" } ?? providerPresets[0]
    }

    private func canonicalProviderId(_ value: String?) -> String? {
        guard let value else {
            return nil
        }
        let normalized = value
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased()
        guard !normalized.isEmpty else {
            return nil
        }

        switch normalized {
        case "gemini", "google":
            return "google"
        case "open-router", "openrouter":
            return "openrouter"
        case "kimi", "moonshot", "moonshotai":
            return "moonshotai"
        default:
            return normalized
        }
    }

    private func providerPreset(for id: String?) -> DesktopProviderPreset? {
        guard let normalized = canonicalProviderId(id) else {
            return nil
        }
        return providerPresets.first { preset in
            preset.id == normalized || preset.runtimeProviderId == normalized
        }
    }

    private func inferPresetId(for providerId: String?) -> String {
        guard let providerId = canonicalProviderId(providerId) else {
            return defaultProviderPreset().id
        }
        return providerPreset(for: providerId)?.id ?? "custom"
    }

    private func providerAliases(for providerId: String, preset: DesktopProviderPreset) -> [String] {
        switch canonicalProviderId(providerId) ?? providerId {
        case "google":
            return ["google", "gemini"]
        case "openrouter":
            return ["openrouter", "open-router"]
        case "moonshotai":
            return ["moonshotai", "moonshot", "kimi"]
        default:
            return [providerId, preset.runtimeProviderId, preset.id]
        }
    }

    private func sanitizedProviderId(raw: String?, preset: DesktopProviderPreset) -> String {
        if preset.id != "custom" {
            return preset.runtimeProviderId
        }

        let source = raw?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        let lowered = source.lowercased()
        let mapped = canonicalProviderId(lowered) ?? lowered
        let scalars = mapped.unicodeScalars.map { scalar -> Character in
            if CharacterSet.alphanumerics.contains(scalar) || scalar == "-" {
                return Character(scalar)
            }
            return "-"
        }
        let collapsed = String(scalars)
            .replacingOccurrences(of: "-{2,}", with: "-", options: .regularExpression)
            .trimmingCharacters(in: CharacterSet(charactersIn: "-"))
        return collapsed.isEmpty ? preset.runtimeProviderId : collapsed
    }

    private func normalizedEndpoint(_ value: String?) -> String? {
        guard let value else {
            return nil
        }
        var trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            return nil
        }
        while trimmed.count > 1 && trimmed.hasSuffix("/") {
            trimmed.removeLast()
        }
        return trimmed
    }

    private func normalizedDesktopLanguage(_ value: String?) -> String {
        switch value?.trimmingCharacters(in: .whitespacesAndNewlines) {
        case "en", "en-US", "en_US":
            return "en-US"
        case "ja", "ja-JP", "ja_JP":
            return "ja-JP"
        default:
            return "zh-CN"
        }
    }

    private func normalizedDesktopMode(_ value: String?) -> String {
        switch value?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() {
        case "pro":
            return "pro"
        default:
            return "simple"
        }
    }

    private func modelsSettingsEntry(for providerId: String) -> [String: Any]? {
        let providers = loadJSONObject(from: modelsPath())["providers"] as? [String: Any] ?? [:]
        if let exact = providers[providerId] as? [String: Any] {
            return exact
        }
        return providers.first { key, _ in
            key.caseInsensitiveCompare(providerId) == .orderedSame
        }?.value as? [String: Any]
    }

    private func savedCredentialProviders() -> [String] {
        loadJSONObject(from: authPath())
            .compactMap { key, value in
                guard credentialAPIKey(from: value)?.isEmpty == false else {
                    return nil
                }
                return key
            }
            .sorted()
    }

    private func hasStoredCredential(providerId: String, preset: DesktopProviderPreset) -> Bool {
        let aliases = providerAliases(for: providerId, preset: preset)
        let authEntries = loadJSONObject(from: authPath())
        return authEntries.contains { existing, value in
            aliases.contains { alias in
                existing.caseInsensitiveCompare(alias) == .orderedSame
            } && credentialAPIKey(from: value)?.isEmpty == false
        }
    }

    private func credentialAPIKey(from value: Any) -> String? {
        guard let entry = value as? [String: Any] else {
            return nil
        }
        let key = stringValue(entry["key"])?.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let key, !key.isEmpty else {
            return nil
        }
        return key
    }

    private func currentProviderConfig(from settings: DesktopSettings? = nil) -> DesktopProviderConfig {
        let settings = settings ?? loadSettings()
        let preset = providerPreset(for: settings.providerPreset ?? settings.defaultProvider) ?? defaultProviderPreset()
        let providerId = sanitizedProviderId(raw: settings.defaultProvider, preset: preset)
        let modelsEntry = modelsSettingsEntry(for: providerId)
        let apiProtocol = stringValue(modelsEntry?["api"])
            ?? settings.defaultApiProtocol
            ?? preset.apiProtocol
        let apiBaseURL = normalizedEndpoint(stringValue(modelsEntry?["baseUrl"]) ?? settings.defaultApiBaseURL)
            ?? preset.apiBaseURL
        let providerLabel = settings.defaultProviderName?.nonEmpty
            ?? (preset.id == "custom" ? providerId : preset.label)
        let usesCustomConfiguration =
            preset.id == "custom"
            || providerId != preset.runtimeProviderId
            || normalizedEndpoint(apiBaseURL) != normalizedEndpoint(preset.apiBaseURL)
            || apiProtocol != preset.apiProtocol

        return DesktopProviderConfig(
            presetId: preset.id,
            providerId: providerId,
            providerLabel: providerLabel,
            model: settings.defaultModel,
            apiProtocol: apiProtocol,
            apiBaseURL: apiBaseURL,
            usesCustomConfiguration: usesCustomConfiguration,
            hasSavedCredential: hasStoredCredential(providerId: providerId, preset: preset),
            credentialProviders: savedCredentialProviders(),
            checkForUpdates: settings.checkForUpdates ?? true,
            modelsPath: modelsPath().path
        )
    }

    private func currentUpdateState() -> DesktopUpdateState {
        if let cached = loadRuntimeState().updateState {
            return DesktopUpdateState(
                currentVersion: currentAppVersion(),
                latestVersion: cached.latestVersion,
                status: cached.status,
                message: cached.message,
                checkedAt: cached.checkedAt,
                releaseName: cached.releaseName,
                publishedAt: cached.publishedAt,
                releaseNotes: cached.releaseNotes,
                releaseURL: cached.releaseURL,
                downloadURL: cached.downloadURL,
                downloadedPackagePath: cached.downloadedPackagePath
            )
        }

        return DesktopUpdateState(
            currentVersion: currentAppVersion(),
            latestVersion: nil,
            status: "idle",
            message: "No update check has been run yet.",
            checkedAt: nil,
            releaseName: nil,
            publishedAt: nil,
            releaseNotes: nil,
            releaseURL: releasesPageURL.absoluteString,
            downloadURL: nil,
            downloadedPackagePath: nil
        )
    }

    private func saveUpdateState(_ updateState: DesktopUpdateState) throws {
        var runtime = loadRuntimeState()
        runtime.updateState = updateState
        try saveRuntimeState(runtime)
    }

    private func customModelsPayload(
        providerId: String,
        modelId: String,
        providerLabel: String,
        apiProtocol: String,
        apiBaseURL: String,
        preset: DesktopProviderPreset
    ) -> [String: Any] {
        var modelIds = preset.defaultModels
        if !modelIds.contains(where: { $0.caseInsensitiveCompare(modelId) == .orderedSame }) {
            modelIds.insert(modelId, at: 0)
        }

        let models = modelIds.map { item in
            [
                "id": item,
                "name": item
            ]
        }

        return [
            "providers": [
                providerId: [
                    "api": apiProtocol,
                    "baseUrl": apiBaseURL,
                    "authHeader": true,
                    "models": models,
                    "label": providerLabel
                ]
            ]
        ]
    }

    private func persistModelsConfiguration(
        settings: DesktopSettings,
        providerConfig: DesktopProviderConfig
    ) throws {
        let preset = providerPreset(for: providerConfig.presetId) ?? defaultProviderPreset()
        var root = loadJSONObject(from: modelsPath())
        var providers = root["providers"] as? [String: Any] ?? [:]

        if providerConfig.usesCustomConfiguration {
            let payload = customModelsPayload(
                providerId: providerConfig.providerId,
                modelId: settings.defaultModel ?? preset.defaultModels.first ?? "custom-model",
                providerLabel: providerConfig.providerLabel,
                apiProtocol: providerConfig.apiProtocol,
                apiBaseURL: providerConfig.apiBaseURL,
                preset: preset
            )
            let payloadProviders = payload["providers"] as? [String: Any] ?? [:]
            for (key, value) in payloadProviders {
                providers[key] = value
            }
        } else {
            providers.removeValue(forKey: providerConfig.providerId)
            if let match = providers.keys.first(where: {
                $0.caseInsensitiveCompare(providerConfig.providerId) == .orderedSame
            }) {
                providers.removeValue(forKey: match)
            }
        }

        root["providers"] = providers
        try saveJSONObject(root, to: modelsPath())
    }

    private func persistDesktopConfiguration(
        payload: [String: Any],
        requireFreshAPIKey: Bool
    ) throws {
        let preset = providerPreset(for: stringValue(payload["providerPreset"]) ?? stringValue(payload["provider"])) ?? defaultProviderPreset()
        let providerId = sanitizedProviderId(raw: stringValue(payload["provider"]), preset: preset)
        let providerLabel = stringValue(payload["providerLabel"])?.nonEmpty
            ?? (preset.id == "custom" ? providerId : preset.label)
        let model = stringValue(payload["model"]) ?? preset.defaultModels.first ?? "custom-model"
        let starterAgent = stringValue(payload["starterAgent"]) ?? "main"
        let apiProtocol = stringValue(payload["apiProtocol"]) ?? preset.apiProtocol
        let apiBaseURL = normalizedEndpoint(stringValue(payload["apiBaseURL"])) ?? preset.apiBaseURL
        let apiKey = stringValue(payload["apiKey"])
        let workspacePath = stringValue(payload["workspacePath"])
        let uiLanguage = normalizedDesktopLanguage(stringValue(payload["uiLanguage"]) ?? loadSettings().uiLanguage)
        let uiMode = normalizedDesktopMode(stringValue(payload["uiMode"]) ?? loadSettings().uiMode)
        let checkForUpdates = boolValue(payload["checkForUpdates"]) ?? true

        let providerConfig = DesktopProviderConfig(
            presetId: preset.id,
            providerId: providerId,
            providerLabel: providerLabel,
            model: model,
            apiProtocol: apiProtocol,
            apiBaseURL: apiBaseURL,
            usesCustomConfiguration: preset.id == "custom"
                || providerId != preset.runtimeProviderId
                || normalizedEndpoint(apiBaseURL) != normalizedEndpoint(preset.apiBaseURL)
                || apiProtocol != preset.apiProtocol,
            hasSavedCredential: hasStoredCredential(providerId: providerId, preset: preset),
            credentialProviders: savedCredentialProviders(),
            checkForUpdates: checkForUpdates,
            modelsPath: modelsPath().path
        )

        if requireFreshAPIKey && apiKey == nil {
            throw NSError(domain: "PiDesktop", code: 10, userInfo: [
                NSLocalizedDescriptionKey: "API key is required during first-run setup."
            ])
        }

        if apiKey == nil && !providerConfig.hasSavedCredential {
            throw NSError(domain: "PiDesktop", code: 11, userInfo: [
                NSLocalizedDescriptionKey: "No saved API key exists for \(providerConfig.providerLabel). Paste one before saving."
            ])
        }

        var settings = loadSettings()
        settings.providerPreset = preset.id
        settings.defaultProvider = providerId
        settings.defaultProviderName = providerLabel
        settings.defaultModel = model
        settings.defaultApiProtocol = apiProtocol
        settings.defaultApiBaseURL = apiBaseURL
        settings.starterAgent = starterAgent
        settings.uiLanguage = uiLanguage
        settings.uiMode = uiMode
        settings.checkForUpdates = checkForUpdates
        settings.onboarding = DesktopOnboardingState(
            completed: true,
            version: 2,
            chosenProvider: providerId,
            chosenModel: model,
            chosenApiBaseURL: apiBaseURL,
            chosenApiProtocol: apiProtocol,
            chosenAgentProfile: starterAgent,
            chosenLanguage: uiLanguage,
            chosenMode: uiMode
        )
        try saveSettings(settings)

        if let apiKey {
            try saveAuth(provider: providerId, apiKey: apiKey)
        }

        try persistModelsConfiguration(settings: settings, providerConfig: providerConfig)

        var runtime = loadRuntimeState()
        if let workspacePath {
            runtime.workspacePath = workspacePath
        } else if runtime.workspacePath == nil {
            runtime.workspacePath = NSHomeDirectory()
        }
        try saveRuntimeState(runtime)
    }

    // MARK: - Bootstrap

    private func handleBootstrap(requestId: String?) {
        if bootstrapPayload()["configured"] as? Bool == true {
            do {
                try ensureLocalBridge()
                try ensureBackend()
                requestBackendSnapshot()
            } catch {
                appendLog("backend bootstrap failed: \(error.localizedDescription)")
            }
        }
        respond(requestId: requestId, ok: true, payload: bootstrapPayload())
    }

    private func handleRefreshDesktop(requestId: String?) {
        if bootstrapPayload()["configured"] as? Bool == true {
            do {
                try ensureLocalBridge()
                try ensureBackend()
                requestBackendSnapshot()
            } catch {
                appendLog("desktop refresh failed: \(error.localizedDescription)")
            }
        }
        respond(requestId: requestId, ok: true, payload: bootstrapPayload())
    }

    private func bootstrapPayload() -> [String: Any] {
        do {
            try ensureDirectories()
        } catch {
            return ["error": "Failed to prepare app support directories: \(error.localizedDescription)"]
        }

        hydrateRecentLogsFromDiskIfNeeded()

        let settings = loadSettings()
        let runtime = loadRuntimeState()
        let workspace = runtime.workspacePath ?? NSHomeDirectory()
        let providerConfig = currentProviderConfig(from: settings)
        let configured = (settings.defaultProvider?.isEmpty == false)
            && (settings.defaultModel?.isEmpty == false)
            && providerConfig.hasSavedCredential
        let defaultAgentId = settings.starterAgent ?? "main"
        let uiLanguage = normalizedDesktopLanguage(settings.uiLanguage)
        let uiMode = normalizedDesktopMode(settings.uiMode)
        let activeSessionAgent = resolvedSessionAgentId(
            for: currentSessionPath,
            runtime: runtime,
            fallback: defaultAgentId
        )

        var payload = dictionary(from: BootstrapPayload(
            productName: productDisplayName,
            configured: configured,
            provider: settings.defaultProvider,
            model: settings.defaultModel,
            starterAgent: settings.starterAgent,
            uiLanguage: uiLanguage,
            uiMode: uiMode,
            activeSessionAgent: activeSessionAgent,
            currentSessionPath: canonicalPath(currentSessionPath) ?? currentSessionPath,
            workspacePath: workspace,
            appSupportPath: appSupportRoot().path,
            configPath: settingsPath().path,
            authPath: authPath().path,
            modelsPath: modelsPath().path,
            sessionPath: sessionsDirectory().path,
            bundledBinaryPath: bundledBinaryPath().path,
            recommendedModels: recommendedModels,
            providerPresets: providerPresets,
            providerConfig: providerConfig,
            updateState: currentUpdateState(),
            agents: buildAgentPayload(),
            bindings: bindingCatalog,
            sessions: buildSessionSummaries(runtime: runtime, defaultAgentId: defaultAgentId),
            importCandidate: importCandidate(),
            logs: recentLogs
        ))

        payload["projectConfigPath"] = projectSettingsPath().path
        payload["projectRootPath"] = projectRoot().path
        payload["vaultRootPath"] = projectRoot().appendingPathComponent("vault", isDirectory: true).path
        payload["artifactLibraryPath"] = projectRoot()
            .appendingPathComponent("artifacts", isDirectory: true)
            .path
        payload["controlPlaneStatePath"] = projectRoot()
            .appendingPathComponent("control-plane", isDirectory: true)
            .appendingPathComponent("operator-console.json")
            .path
        payload["controlPlaneWorkersPath"] = projectRoot()
            .appendingPathComponent("control-plane", isDirectory: true)
            .appendingPathComponent("workers.json")
            .path
        payload["permissionsPath"] = permissionsPath().path
        payload["globalSkillsRoot"] = globalSkillsRoot().path
        payload["projectSkillsRoot"] = projectSkillsRoot().path
        payload["automationsRoot"] = automationsRoot().path
        payload["channels"] = buildChannelPayload()
        payload["skillsCatalog"] = buildSkillsPayload()
        payload["automationState"] = buildAutomationPayload()
        payload["securityState"] = buildSecurityPayload()
        payload["hostState"] = buildHostPayload()
        payload["systemPermissions"] = buildSystemPermissionsPayload()
        payload["diagnosticsState"] = buildDiagnosticsPayload()
        return payload
    }

    private func localBridgeBaseURLString() -> String {
        "http://127.0.0.1:\(localBridgePort)"
    }

    private func pickLocalBridgePort() -> UInt16 {
        if isLocalPortAvailable(defaultLocalBridgePort) {
            return defaultLocalBridgePort
        }
        let fallback = ephemeralLocalPort() ?? defaultLocalBridgePort
        if fallback != defaultLocalBridgePort {
            appendLog("default local bridge port \(defaultLocalBridgePort) is busy; using \(fallback) instead")
        }
        return fallback
    }

    private func isLocalPortAvailable(_ port: UInt16) -> Bool {
        let fd = socket(AF_INET, SOCK_STREAM, 0)
        guard fd >= 0 else {
            return false
        }
        defer { close(fd) }

        var value: Int32 = 1
        _ = setsockopt(fd, SOL_SOCKET, SO_REUSEADDR, &value, socklen_t(MemoryLayout<Int32>.size))

        var address = sockaddr_in()
        address.sin_len = UInt8(MemoryLayout<sockaddr_in>.stride)
        address.sin_family = sa_family_t(AF_INET)
        address.sin_port = port.bigEndian
        address.sin_addr = in_addr(s_addr: inet_addr("127.0.0.1"))

        let result = withUnsafePointer(to: &address) {
            $0.withMemoryRebound(to: sockaddr.self, capacity: 1) { pointer in
                Darwin.bind(fd, pointer, socklen_t(MemoryLayout<sockaddr_in>.stride))
            }
        }
        return result == 0
    }

    private func ephemeralLocalPort() -> UInt16? {
        let fd = socket(AF_INET, SOCK_STREAM, 0)
        guard fd >= 0 else {
            return nil
        }
        defer { close(fd) }

        var address = sockaddr_in()
        address.sin_len = UInt8(MemoryLayout<sockaddr_in>.stride)
        address.sin_family = sa_family_t(AF_INET)
        address.sin_port = 0
        address.sin_addr = in_addr(s_addr: inet_addr("127.0.0.1"))

        let bindResult = withUnsafePointer(to: &address) {
            $0.withMemoryRebound(to: sockaddr.self, capacity: 1) { pointer in
                Darwin.bind(fd, pointer, socklen_t(MemoryLayout<sockaddr_in>.stride))
            }
        }
        guard bindResult == 0 else {
            return nil
        }

        var resolved = sockaddr_in()
        var length = socklen_t(MemoryLayout<sockaddr_in>.stride)
        let nameResult = withUnsafeMutablePointer(to: &resolved) {
            $0.withMemoryRebound(to: sockaddr.self, capacity: 1) { pointer in
                Darwin.getsockname(fd, pointer, &length)
            }
        }
        guard nameResult == 0 else {
            return nil
        }
        return UInt16(bigEndian: resolved.sin_port)
    }

    private func hydrateRecentLogsFromDiskIfNeeded() {
        guard recentLogs.isEmpty, let data = try? Data(contentsOf: desktopLogPath()),
              let text = String(data: data, encoding: .utf8)
        else {
            return
        }
        recentLogs = Array(text
            .split(whereSeparator: \.isNewline)
            .map(String.init)
            .suffix(200))
    }

    private func dictionary<T: Encodable>(from value: T) -> [String: Any] {
        guard
            let data = try? JSONEncoder().encode(value),
            let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
        else {
            return [:]
        }
        return object
    }

    private func stringValue(_ value: Any?) -> String? {
        if let string = value as? String {
            let trimmed = string.trimmingCharacters(in: .whitespacesAndNewlines)
            return trimmed.isEmpty ? nil : trimmed
        }
        return nil
    }

    private func boolValue(_ value: Any?) -> Bool? {
        if let bool = value as? Bool {
            return bool
        }
        if let number = value as? NSNumber {
            return number.boolValue
        }
        if let string = value as? String {
            let normalized = string.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
            if ["1", "true", "yes", "on"].contains(normalized) {
                return true
            }
            if ["0", "false", "no", "off"].contains(normalized) {
                return false
            }
        }
        return nil
    }

    private func stringArray(_ value: Any?) -> [String] {
        (value as? [Any] ?? []).compactMap { stringValue($0) }
    }

    private func objectArray(_ value: Any?) -> [[String: Any]] {
        value as? [[String: Any]] ?? []
    }

    private func diagnosticEntry(from rawLine: String) -> [String: Any] {
        let timestamp: String
        let remainder: String
        if rawLine.hasPrefix("["),
           let closing = rawLine.firstIndex(of: "]")
        {
            timestamp = String(rawLine[rawLine.index(after: rawLine.startIndex)..<closing])
            remainder = rawLine[rawLine.index(after: closing)...]
                .trimmingCharacters(in: .whitespacesAndNewlines)
        } else {
            timestamp = nowIsoString()
            remainder = rawLine.trimmingCharacters(in: .whitespacesAndNewlines)
        }

        let lower = remainder.lowercased()
        let level: String
        if lower.contains(" error") || lower.contains("failed") || lower.contains("denied") || lower.contains("unsupported") {
            level = "error"
        } else if lower.contains("warning") || lower.contains("warn") || lower.contains("manual_check") {
            level = "warn"
        } else {
            level = "info"
        }

        let category: String
        if lower.contains("permission") || lower.contains("accessibility") || lower.contains("screen recording") || lower.contains("microphone") || lower.contains("camera") || lower.contains("location") {
            category = "permissions"
        } else if lower.contains("backend") || lower.contains("rpc") || lower.contains("session") {
            category = "runtime"
        } else if lower.contains("update") || lower.contains("release") || lower.contains("installer") {
            category = "updates"
        } else if lower.contains("gateway") || lower.contains("proxy") || lower.contains("sandbox") {
            category = "gateway"
        } else if lower.contains("binding") || lower.contains("telegram") || lower.contains("qq") || lower.contains("feishu") {
            category = "channels"
        } else if lower.contains("file") || lower.contains("directory") || lower.contains("path") {
            category = "filesystem"
        } else {
            category = "general"
        }

        let source: String
        if remainder.hasPrefix("backend[stderr]") {
            source = "backend-stderr"
        } else if remainder.hasPrefix("backend[out]") {
            source = "backend-stdout"
        } else if remainder.hasPrefix("web[") {
            source = "webview"
        } else if remainder.hasPrefix("backend") {
            source = "backend"
        } else {
            source = "desktop"
        }

        return [
            "id": UUID().uuidString,
            "timestamp": timestamp,
            "level": level,
            "category": category,
            "source": source,
            "message": remainder,
            "raw": rawLine
        ]
    }

    private func projectSettingsObject() -> [String: Any] {
        loadJSONObject(from: projectSettingsPath())
    }

    private func globalSettingsObject() -> [String: Any] {
        loadJSONObject(from: settingsPath())
    }

    private func saveProjectSettingsObject(_ object: [String: Any]) throws {
        try saveJSONObject(object, to: projectSettingsPath())
    }

    private func saveGlobalSettingsObject(_ object: [String: Any]) throws {
        try saveJSONObject(object, to: settingsPath())
    }

    private func canonicalOrPath(_ path: String) -> String {
        canonicalPath(path) ?? path
    }

    private func nowIsoString() -> String {
        ISO8601DateFormatter().string(from: Date())
    }

    private func defaultChannelConfigurations() -> [[String: Any]] {
        [
            [
                "id": "telegram_main",
                "platform": "telegram",
                "enabled": false,
                "agentProfile": "main",
                "config": [
                    "bot_token": "",
                    "allowed_chat_ids": ""
                ]
            ],
            [
                "id": "feishu_push_main",
                "platform": "feishu_push",
                "enabled": false,
                "agentProfile": "operator",
                "config": [
                    "webhook_url": "",
                    "sign_secret": ""
                ]
            ],
            [
                "id": "feishu_chat_main",
                "platform": "feishu_chat",
                "enabled": false,
                "agentProfile": "operator",
                "config": [
                    "app_id": "",
                    "app_secret": "",
                    "verification_token": ""
                ]
            ],
            [
                "id": "qq_main",
                "platform": "qq",
                "enabled": false,
                "agentProfile": "implementer",
                "config": [
                    "app_id": "",
                    "app_secret": "",
                    "sandbox": true
                ]
            ]
        ]
    }

    private func mergedBindingConfigurations() -> [[String: Any]] {
        let configured = objectArray(projectSettingsObject()["bindings"])
        var byId: [String: [String: Any]] = [:]
        for entry in configured {
            if let id = stringValue(entry["id"]) {
                byId[id] = entry
            }
        }

        var merged: [[String: Any]] = []
        for template in defaultChannelConfigurations() {
            guard let id = stringValue(template["id"]) else { continue }
            if let existing = byId.removeValue(forKey: id) {
                merged.append(mergeBinding(template: template, existing: existing))
            } else {
                merged.append(template)
            }
        }

        merged.append(contentsOf: byId.values.sorted {
            stringValue($0["id"]) ?? "" < stringValue($1["id"]) ?? ""
        })
        return merged
    }

    private func mergeBinding(template: [String: Any], existing: [String: Any]) -> [String: Any] {
        var merged = template
        for (key, value) in existing {
            if key == "config",
               let existingConfig = value as? [String: Any],
               let templateConfig = merged["config"] as? [String: Any]
            {
                merged["config"] = templateConfig.merging(existingConfig) { _, new in new }
            } else {
                merged[key] = value
            }
        }
        return merged
    }

    private func channelDefinitions(for platform: String) -> (name: String, note: String, runtime: String, fields: [[String: Any]], setup: [String]) {
        switch platform {
        case "telegram":
            return (
                "Telegram",
                "Full conversational entry via Telegram Bot API.",
                "Supported runtime path",
                [
                    ["id": "bot_token", "label": "Bot Token", "type": "password", "required": true, "secret": true, "placeholder": "123456:ABC...", "help": "Telegram Bot API token."],
                    ["id": "allowed_chat_ids", "label": "Allowed Chat IDs", "type": "text", "required": false, "secret": false, "placeholder": "12345,67890", "help": "Optional comma-separated allowlist of Telegram chat ids."]
                ],
                [
                    "Create a Telegram bot with BotFather.",
                    "Paste the bot token here.",
                    "Optionally restrict inbound chats with allowed chat ids.",
                    "Enable the channel to let inbound messages route through the selected profile."
                ]
            )
        case "feishu_push":
            return (
                "Feishu Push",
                "Send-only Feishu custom bot webhook for notifications and summaries.",
                "Send-only runtime path",
                [
                    ["id": "webhook_url", "label": "Webhook URL", "type": "text", "required": true, "secret": true, "placeholder": "https://open.feishu.cn/...", "help": "Feishu custom-bot webhook URL."],
                    ["id": "sign_secret", "label": "Sign Secret", "type": "password", "required": false, "secret": true, "placeholder": "Optional", "help": "Optional Feishu signing secret."]
                ],
                [
                    "Create a Feishu custom bot webhook.",
                    "Paste the webhook URL and optional signing secret.",
                    "Use this channel for outbound notifications rather than inbound chat."
                ]
            )
        case "feishu_chat":
            return (
                "Feishu Chat",
                "Full conversational Feishu app-bot with event subscription.",
                "Supported runtime path",
                [
                    ["id": "app_id", "label": "App ID", "type": "text", "required": true, "secret": true, "placeholder": "cli_...", "help": "Feishu application id."],
                    ["id": "app_secret", "label": "App Secret", "type": "password", "required": true, "secret": true, "placeholder": "App secret", "help": "Feishu application secret."],
                    ["id": "verification_token", "label": "Verification Token", "type": "text", "required": false, "secret": true, "placeholder": "Optional", "help": "Optional event verification token."]
                ],
                [
                    "Create a Feishu app bot with event subscription.",
                    "Paste the app id and app secret.",
                    "Add the optional verification token if your deployment uses it."
                ]
            )
        case "qq":
            return (
                "QQ",
                "QQ OpenAPI bot path. Configuration is real; runtime reply wiring is still partial.",
                "Partial runtime path",
                [
                    ["id": "app_id", "label": "App ID", "type": "text", "required": true, "secret": true, "placeholder": "QQ app id", "help": "QQ bot application id."],
                    ["id": "app_secret", "label": "App Secret", "type": "password", "required": true, "secret": true, "placeholder": "QQ app secret", "help": "QQ bot application secret."],
                    ["id": "sandbox", "label": "Sandbox", "type": "checkbox", "required": false, "secret": false, "placeholder": "", "help": "Use QQ sandbox environment."]
                ],
                [
                    "Create a QQ bot application.",
                    "Paste the app id and app secret.",
                    "Use sandbox until production credentials are ready."
                ]
            )
        default:
            return (
                platform.capitalized,
                "Custom channel configuration.",
                "Unknown runtime path",
                [],
                ["Review the platform-specific configuration and supply the required fields."]
            )
        }
    }

    private func bindingValidationMessage(platform: String, config: [String: Any]) -> String? {
        switch platform {
        case "telegram":
            return stringValue(config["bot_token"]) == nil ? "Telegram requires a bot token." : nil
        case "feishu_push":
            return stringValue(config["webhook_url"]) == nil ? "Feishu Push requires a webhook URL." : nil
        case "feishu_chat":
            if stringValue(config["app_id"]) == nil || stringValue(config["app_secret"]) == nil {
                return "Feishu Chat requires app_id and app_secret."
            }
            return nil
        case "qq":
            if stringValue(config["app_id"]) == nil || stringValue(config["app_secret"]) == nil {
                return "QQ requires app_id and app_secret."
            }
            return nil
        default:
            return nil
        }
    }

    private func buildChannelPayload() -> [[String: Any]] {
        mergedBindingConfigurations().map { binding in
            let platform = stringValue(binding["platform"]) ?? "custom"
            let details = channelDefinitions(for: platform)
            let config = binding["config"] as? [String: Any] ?? [:]
            let enabled = boolValue(binding["enabled"]) ?? false
            let validation = bindingValidationMessage(platform: platform, config: config)
            let runtimeState: String
            if !enabled {
                runtimeState = "disabled"
            } else if validation != nil {
                runtimeState = "needs_setup"
            } else if platform == "qq" {
                runtimeState = "partial"
            } else if platform == "feishu_push" {
                runtimeState = "send_only"
            } else {
                runtimeState = "ready"
            }

            return [
                "id": stringValue(binding["id"]) ?? UUID().uuidString,
                "name": details.name,
                "platform": platform,
                "enabled": enabled,
                "agentProfile": stringValue(binding["agentProfile"]) ?? "main",
                "config": config,
                "note": details.note,
                "runtimeSupport": details.runtime,
                "status": runtimeState,
                "health": runtimeState,
                "authState": validation == nil ? "configured" : "missing_credentials",
                "validationMessage": validation as Any,
                "fields": details.fields,
                "setupSteps": details.setup
            ]
        }
    }

    private func parseSkillMetadata(at path: URL) -> [String: Any] {
        guard let raw = try? String(contentsOf: path, encoding: .utf8) else {
            return [:]
        }
        var name = path.deletingLastPathComponent().lastPathComponent
        var description = "Skill metadata unavailable."
        var disableModelInvocation = false
        let lines = raw.components(separatedBy: .newlines)
        if lines.first == "---" {
            for line in lines.dropFirst() {
                if line == "---" {
                    break
                }
                let parts = line.split(separator: ":", maxSplits: 1).map(String.init)
                if parts.count == 2 {
                    let key = parts[0].trimmingCharacters(in: .whitespacesAndNewlines)
                    let value = parts[1].trimmingCharacters(in: .whitespacesAndNewlines)
                    if key == "name", !value.isEmpty {
                        name = value
                    } else if key == "description", !value.isEmpty {
                        description = value
                    } else if key == "disable-model-invocation" {
                        disableModelInvocation = boolValue(value) ?? false
                    }
                }
            }
        }
        return [
            "name": name,
            "description": description,
            "disableModelInvocation": disableModelInvocation
        ]
    }

    private func discoverSkillFiles(in root: URL, source: String, autoLoaded: Bool) -> [[String: Any]] {
        guard fileManager.fileExists(atPath: root.path) else {
            return []
        }
        guard let enumerator = fileManager.enumerator(at: root, includingPropertiesForKeys: nil) else {
            return []
        }
        var skills: [[String: Any]] = []
        var seen = Set<String>()
        for case let url as URL in enumerator {
            let fileName = url.lastPathComponent
            guard fileName == "SKILL.md" || fileName.hasSuffix(".md") else {
                continue
            }
            let canonical = canonicalOrPath(url.path)
            if seen.contains(canonical) {
                continue
            }
            seen.insert(canonical)
            let meta = parseSkillMetadata(at: url)
            skills.append([
                "name": stringValue(meta["name"]) ?? url.deletingPathExtension().lastPathComponent,
                "description": stringValue(meta["description"]) ?? "Skill metadata unavailable.",
                "path": url.path,
                "baseDir": url.deletingLastPathComponent().path,
                "source": source,
                "autoLoaded": autoLoaded,
                "disableModelInvocation": boolValue(meta["disableModelInvocation"]) ?? false
            ])
        }
        return skills
    }

    private func buildSkillsPayload() -> [String: Any] {
        let globalSettings = globalSettingsObject()
        let projectSettings = projectSettingsObject()
        let globalSkillPaths = stringArray(globalSettings["skills"])
        let projectSkillPaths = stringArray(projectSettings["skills"])
        var skills = discoverSkillFiles(in: globalSkillsRoot(), source: "user", autoLoaded: true)
        skills.append(contentsOf: discoverSkillFiles(in: projectSkillsRoot(), source: "project", autoLoaded: true))
        for path in globalSkillPaths {
            skills.append(contentsOf: discoverSkillFiles(
                in: URL(fileURLWithPath: path),
                source: "global_path",
                autoLoaded: false
            ))
        }
        for path in projectSkillPaths {
            skills.append(contentsOf: discoverSkillFiles(
                in: URL(fileURLWithPath: path),
                source: "project_path",
                autoLoaded: false
            ))
        }

        var deduped: [[String: Any]] = []
        var seen = Set<String>()
        for skill in skills {
            let path = stringValue(skill["path"]) ?? UUID().uuidString
            let canonical = canonicalOrPath(path)
            if seen.contains(canonical) {
                continue
            }
            seen.insert(canonical)
            deduped.append(skill)
        }
        deduped.sort { (stringValue($0["name"]) ?? "") < (stringValue($1["name"]) ?? "") }
        let catalogEntries = buildCuratedSkillCatalogEntries()

        return [
            "enableSkillCommands": boolValue(globalSettings["enableSkillCommands"]) ?? true,
            "globalSkillPaths": globalSkillPaths,
            "projectSkillPaths": projectSkillPaths,
            "skills": deduped,
            "catalogEntries": catalogEntries,
            "catalogInstallableCount": catalogEntries.filter { boolValue($0["installable"]) == true }.count
        ]
    }

    private func buildCuratedSkillCatalogEntries() -> [[String: Any]] {
        guard
            let manifestPath = bundledSkillCatalogManifestPath(),
            let raw = try? String(contentsOf: manifestPath, encoding: .utf8)
        else {
            return []
        }

        let globalInstalledRoot = globalSkillsRoot().appendingPathComponent("catalog", isDirectory: true)
        let projectInstalledRoot = projectSkillsRoot().appendingPathComponent("catalog", isDirectory: true)
        let bundledRoot = bundledSkillCatalogRoot()

        return raw
            .split(whereSeparator: \.isNewline)
            .compactMap { rawLine -> [String: Any]? in
                let line = rawLine.trimmingCharacters(in: .whitespacesAndNewlines)
                guard !line.isEmpty, !line.hasPrefix("#") else {
                    return nil
                }
                let fields = line.components(separatedBy: "|")
                guard fields.count >= 5 else {
                    return nil
                }

                let id = fields[0].trimmingCharacters(in: .whitespacesAndNewlines)
                let title = fields[1].trimmingCharacters(in: .whitespacesAndNewlines)
                let description = fields[2].trimmingCharacters(in: .whitespacesAndNewlines)
                let tags = fields[3]
                    .split(separator: ",")
                    .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
                    .filter { !$0.isEmpty }
                let sourcePath = fields[4].trimmingCharacters(in: .whitespacesAndNewlines)

                guard !id.isEmpty else {
                    return nil
                }

                let bundledSource = bundledRoot?.appendingPathComponent(id, isDirectory: true)
                let installable = bundledSource.map { fileManager.fileExists(atPath: $0.path) } ?? false
                let bundledSkills = bundledSource.map {
                    discoverSkillFiles(in: $0, source: "catalog_bundle", autoLoaded: false)
                } ?? []
                let skillNames = bundledSkills.compactMap { stringValue($0["name"]) }
                let skillCount = bundledSkills.count
                let installedGlobalPath = globalInstalledRoot.appendingPathComponent(id, isDirectory: true)
                let installedProjectPath = projectInstalledRoot.appendingPathComponent(id, isDirectory: true)

                return [
                    "id": id,
                    "title": title,
                    "description": description,
                    "tags": tags,
                    "sourcePath": sourcePath,
                    "bundlePath": bundledSource?.path as Any,
                    "installable": installable,
                    "skillCount": skillCount,
                    "skillNames": skillNames,
                    "installedGlobal": fileManager.fileExists(atPath: installedGlobalPath.path),
                    "installedProject": fileManager.fileExists(atPath: installedProjectPath.path),
                    "installedGlobalPath": installedGlobalPath.path,
                    "installedProjectPath": installedProjectPath.path
                ]
            }
            .sorted { (stringValue($0["title"]) ?? "") < (stringValue($1["title"]) ?? "") }
    }

    private func agentModeLabel(modeId: String, provider: String?, model: String?) -> String {
        if modeId == "override" {
            return "Override: \(provider ?? "?")/\(model ?? "?")"
        }
        return "Follows main settings"
    }

    private func buildAgentSummary(
        id: String,
        base: DesktopAgentSummary?,
        override: [String: Any]
    ) -> DesktopAgentSummary {
        let hasSkillsOverride = override.keys.contains("skills")
        let modeId = stringValue(override["mode"]) ?? base?.modeId ?? "follow_main"
        let provider = stringValue(override["provider"]) ?? base?.provider
        let model = stringValue(override["model"]) ?? base?.model
        let builtinSkills = base?.builtinSkills ?? []
        let skills = hasSkillsOverride ? stringArray(override["skills"]) : (base?.skills ?? [])
        let prompts = override.keys.contains("prompts") ? stringArray(override["prompts"]) : (base?.prompts ?? [])
        let displayName = stringValue(override["displayName"])
            ?? stringValue(override["display_name"])
            ?? base?.displayName
            ?? id.capitalized
        let description = stringValue(override["description"]) ?? base?.description ?? ""
        let hasCustomizations = !override.isEmpty
        let skillScope: String
        if hasSkillsOverride {
            skillScope = skills.isEmpty ? "Per-agent bundle disabled" : "Per-agent custom bundle"
        } else if !(base?.skills.isEmpty ?? true) {
            skillScope = "Shipped profile bundle"
        } else {
            skillScope = "Global-only"
        }

        return DesktopAgentSummary(
            id: id,
            displayName: displayName,
            description: description,
            modeId: modeId,
            modeLabel: agentModeLabel(modeId: modeId, provider: provider, model: model),
            provider: modeId == "override" ? provider : nil,
            model: modeId == "override" ? model : nil,
            skills: skills,
            builtinSkills: builtinSkills,
            prompts: prompts,
            skillScope: skillScope,
            hasCustomizations: hasCustomizations
        )
    }

    private func buildAgentPayload() -> [DesktopAgentSummary] {
        let rawProfiles = globalSettingsObject()["agentProfiles"] as? [String: Any] ?? [:]
        var built: [DesktopAgentSummary] = []
        var seen = Set<String>()

        for base in agentCatalog {
            let override = rawProfiles[base.id] as? [String: Any] ?? [:]
            built.append(buildAgentSummary(id: base.id, base: base, override: override))
            seen.insert(base.id)
        }

        let extras = rawProfiles.keys
            .filter { !seen.contains($0) }
            .sorted()
            .compactMap { id -> DesktopAgentSummary? in
                let override = rawProfiles[id] as? [String: Any] ?? [:]
                return buildAgentSummary(id: id, base: nil, override: override)
            }
        built.append(contentsOf: extras)
        return built
    }

    private func activeSystemId(from settings: [String: Any]) -> String {
        if let active = stringValue(settings["activeSystemId"]) {
            return active
        }
        if let first = objectArray(settings["systems"]).first,
           let id = stringValue(first["id"])
        {
            return id
        }
        return "maoclaw_main"
    }

    private func ensureSystemExists(in settings: inout [String: Any]) -> String {
        let systemId = activeSystemId(from: settings)
        var systems = objectArray(settings["systems"])
        if !systems.contains(where: { stringValue($0["id"]) == systemId }) {
            systems.append([
                "id": systemId,
                "name": "maoclaw Main",
                "template_type": "custom",
                "status": "active",
                "created_at": nowIsoString(),
                "updated_at": nowIsoString(),
                "memory_strategy": ["buckets": []],
                "routing_policy": [:],
                "permission_policy": [:],
                "bindings": [],
                "automations": [],
                "skills": [],
                "prompts": []
            ])
        }
        settings["activeSystemId"] = systemId
        settings["systems"] = systems
        return systemId
    }

    private func automationDirectory(for systemId: String) -> URL {
        automationsRoot().appendingPathComponent(systemId, isDirectory: true)
    }

    private func automationFileURL(systemId: String, automationId: String) -> URL {
        automationDirectory(for: systemId).appendingPathComponent("\(automationId).json")
    }

    private func loadAutomations(for systemId: String) -> [[String: Any]] {
        let dir = automationDirectory(for: systemId)
        guard fileManager.fileExists(atPath: dir.path) else {
            return []
        }
        guard let enumerator = fileManager.enumerator(at: dir, includingPropertiesForKeys: nil) else {
            return []
        }
        var automations: [[String: Any]] = []
        for case let url as URL in enumerator {
            guard url.pathExtension == "json", url.deletingLastPathComponent().lastPathComponent != "runs" else {
                continue
            }
            let object = loadJSONObject(from: url)
            if !object.isEmpty {
                automations.append(object)
            }
        }
        automations.sort { (stringValue($0["name"]) ?? "") < (stringValue($1["name"]) ?? "") }
        return automations
    }

    private func syncSystemReferences(in settings: inout [String: Any], systemId: String) {
        var systems = objectArray(settings["systems"])
        let bindingRefs = objectArray(settings["bindings"])
            .filter { boolValue($0["enabled"]) ?? false }
            .compactMap { stringValue($0["id"]) }
        let automations = loadAutomations(for: systemId).map { automation -> [String: Any] in
            [
                "id": stringValue(automation["id"]) ?? UUID().uuidString,
                "name": stringValue(automation["name"]) ?? "Automation",
                "trigger": automation["trigger"] ?? ["type": "schedule", "cron": "* * * * *"],
                "enabled": boolValue(automation["enabled"]) ?? true
            ]
        }

        for index in systems.indices {
            if stringValue(systems[index]["id"]) == systemId {
                systems[index]["bindings"] = bindingRefs
                systems[index]["automations"] = automations
                systems[index]["updated_at"] = nowIsoString()
            }
        }
        settings["systems"] = systems
    }

    private func buildAutomationPayload() -> [String: Any] {
        let settings = projectSettingsObject()
        let systemId = activeSystemId(from: settings)
        let systems = objectArray(settings["systems"]).map { system in
            [
                "id": stringValue(system["id"]) ?? "",
                "name": stringValue(system["name"]) ?? "System",
                "status": stringValue(system["status"]) ?? "active"
            ]
        }
        let automations = loadAutomations(for: systemId).map { automation -> [String: Any] in
            let trigger = automation["trigger"] as? [String: Any] ?? [:]
            let action = automation["action"] as? [String: Any] ?? [:]
            return [
                "id": stringValue(automation["id"]) ?? UUID().uuidString,
                "name": stringValue(automation["name"]) ?? "Automation",
                "description": stringValue(automation["description"]) as Any,
                "enabled": boolValue(automation["enabled"]) ?? true,
                "triggerType": stringValue(trigger["type"]) ?? "schedule",
                "cron": stringValue(trigger["cron"]) ?? "",
                "actionType": stringValue(action["type"]) ?? "run_task",
                "action": action,
                "updatedAt": stringValue(automation["updated_at"]) as Any,
                "lastRunStatus": stringValue(automation["last_run_status"]) as Any,
                "path": automationFileURL(systemId: systemId, automationId: stringValue(automation["id"]) ?? "").path
            ]
        }

        return [
            "activeSystemId": systemId,
            "systems": systems,
            "automations": automations
        ]
    }

    private func loadPermissionDecisions() -> [String: [[String: Any]]] {
        let root = loadJSONObject(from: permissionsPath())
        guard let raw = root["decisions"] as? [String: Any] else {
            return [:]
        }
        var decisions: [String: [[String: Any]]] = [:]
        for (extensionId, value) in raw {
            decisions[extensionId] = value as? [[String: Any]] ?? []
        }
        return decisions
    }

    private func savePermissionDecisions(_ decisions: [String: [[String: Any]]]) throws {
        try saveJSONObject([
            "version": 1,
            "decisions": decisions
        ], to: permissionsPath())
    }

    private func buildSecurityPayload() -> [String: Any] {
        let settings = globalSettingsObject()
        let extensionPolicy = settings["extensionPolicy"] as? [String: Any] ?? [:]
        let desktopSecurity = settings["desktopSecurity"] as? [String: Any] ?? [:]
        let decisions = loadPermissionDecisions()
        let flattened: [[String: Any]] = decisions.keys.sorted().flatMap { extensionId in
            (decisions[extensionId] ?? []).map { decision in
                [
                    "extensionId": extensionId,
                    "capability": stringValue(decision["capability"]) ?? "",
                    "allow": boolValue(decision["allow"]) ?? false,
                    "decidedAt": stringValue(decision["decided_at"]) as Any,
                    "expiresAt": stringValue(decision["expires_at"]) as Any,
                    "versionRange": stringValue(decision["version_range"]) as Any
                ]
            }
        }

        return [
            "machinePreset": stringValue(desktopSecurity["machinePreset"]) ?? "primary",
            "profile": stringValue(extensionPolicy["profile"]) ?? "permissive",
            "defaultPermissive": boolValue(extensionPolicy["defaultPermissive"]) ?? false,
            "allowDangerous": boolValue(extensionPolicy["allowDangerous"]) ?? false,
            "destructiveExecPolicy": stringValue(desktopSecurity["destructiveExecPolicy"]) ?? "confirm",
            "sandboxMode": stringValue(desktopSecurity["sandboxMode"]) ?? "workspace_write",
            "gatewayMode": stringValue(desktopSecurity["gatewayMode"]) ?? "direct",
            "gatewayURL": stringValue(desktopSecurity["gatewayURL"]) ?? "",
            "browserAutomation": boolValue(desktopSecurity["browserAutomation"]) ?? false,
            "conflictGuard": boolValue(desktopSecurity["conflictGuard"]) ?? true,
            "scopedDirectories": stringArray(desktopSecurity["scopedDirectories"]),
            "decisions": flattened,
            "permissionsPath": permissionsPath().path,
            "desktopLogPath": desktopLogPath().path,
            "diagnosticsPath": diagnosticsDirectory().path
        ]
    }

    private func buildDiagnosticsPayload() -> [String: Any] {
        let entries = recentLogs.suffix(200).map(diagnosticEntry(from:))
        let errors = entries.filter { stringValue($0["level"]) == "error" }.count
        let warnings = entries.filter { stringValue($0["level"]) == "warn" }.count
        return [
            "entries": entries,
            "logPath": desktopLogPath().path,
            "reportRoot": diagnosticsDirectory().path,
            "errorCount": errors,
            "warningCount": warnings
        ]
    }

    private func buildHostPayload() -> [String: Any] {
        let host = resolvedHostSettings(from: loadSettings())
        return [
            "preferredSurface": host.preferredSurface ?? "native",
            "webWorkspaceURL": host.webWorkspaceURL ?? defaultWebWorkspaceURL,
            "closeBehavior": host.closeBehavior ?? "background",
            "menuBarEnabled": host.menuBarEnabled ?? true,
            "webBridgeBaseURL": localBridgeBaseURLString(),
            "webBridgeRunning": localBridgeProcess?.isRunning == true,
            "nativeControlCenterAvailable": true,
            "desktopControlCenterAvailable": true
        ]
    }

    private func notificationAuthorizationStatus() -> String {
        let semaphore = DispatchSemaphore(value: 0)
        var value = "unknown"
        UNUserNotificationCenter.current().getNotificationSettings { settings in
            switch settings.authorizationStatus {
            case .authorized, .provisional, .ephemeral:
                value = "granted"
            case .denied:
                value = "denied"
            case .notDetermined:
                value = "not_determined"
            @unknown default:
                value = "unknown"
            }
            semaphore.signal()
        }
        _ = semaphore.wait(timeout: .now() + 1)
        return value
    }

    private func mediaAuthorizationStatus(for mediaType: AVMediaType) -> String {
        switch AVCaptureDevice.authorizationStatus(for: mediaType) {
        case .authorized:
            return "granted"
        case .denied:
            return "denied"
        case .restricted:
            return "restricted"
        case .notDetermined:
            return "not_determined"
        @unknown default:
            return "unknown"
        }
    }

    private func speechAuthorizationStatus() -> String {
        switch SFSpeechRecognizer.authorizationStatus() {
        case .authorized:
            return "granted"
        case .denied:
            return "denied"
        case .restricted:
            return "restricted"
        case .notDetermined:
            return "not_determined"
        @unknown default:
            return "unknown"
        }
    }

    private func locationAuthorizationStatus() -> String {
        let status = locationManager?.authorizationStatus ?? CLLocationManager().authorizationStatus
        switch status {
        case .authorizedAlways, .authorizedWhenInUse:
            return "granted"
        case .denied:
            return "denied"
        case .restricted:
            return "restricted"
        case .notDetermined:
            return "not_determined"
        @unknown default:
            return "unknown"
        }
    }

    private func accessibilityAuthorizationStatus() -> String {
        AXIsProcessTrusted() ? "granted" : "needs_manual_grant"
    }

    private func screenRecordingAuthorizationStatus() -> String {
        if #available(macOS 10.15, *) {
            return CGPreflightScreenCaptureAccess() ? "granted" : "needs_manual_grant"
        }
        return "unsupported"
    }

    private func automationAuthorizationStatus() -> String {
        "manual_check"
    }

    private func buildSystemPermissionsPayload() -> [[String: Any]] {
        [
            [
                "id": "automation",
                "name": "Automation (AppleScript)",
                "status": automationAuthorizationStatus(),
                "canRequest": true,
                "detail": "Control other macOS apps when automation actions need Apple Events."
            ],
            [
                "id": "notifications",
                "name": "Notifications",
                "status": notificationAuthorizationStatus(),
                "canRequest": true,
                "detail": "Show desktop alerts for agent activity."
            ],
            [
                "id": "accessibility",
                "name": "Accessibility",
                "status": accessibilityAuthorizationStatus(),
                "canRequest": true,
                "detail": "Control UI elements when an action requires it."
            ],
            [
                "id": "screen_recording",
                "name": "Screen Recording",
                "status": screenRecordingAuthorizationStatus(),
                "canRequest": true,
                "detail": "Capture the screen for context or screenshots."
            ],
            [
                "id": "microphone",
                "name": "Microphone",
                "status": mediaAuthorizationStatus(for: .audio),
                "canRequest": true,
                "detail": "Allow Voice Wake and audio capture."
            ],
            [
                "id": "speech_recognition",
                "name": "Speech Recognition",
                "status": speechAuthorizationStatus(),
                "canRequest": true,
                "detail": "Transcribe Voice Wake trigger phrases on-device."
            ],
            [
                "id": "camera",
                "name": "Camera",
                "status": mediaAuthorizationStatus(for: .video),
                "canRequest": true,
                "detail": "Capture photos and video from the camera."
            ],
            [
                "id": "location",
                "name": "Location",
                "status": locationAuthorizationStatus(),
                "canRequest": true,
                "detail": "Share location when requested by the agent."
            ]
        ]
    }

    // MARK: - Actions

    private func handleSaveOnboarding(requestId: String?, payload: [String: Any]) {
        guard
            stringValue(payload["provider"]) != nil || stringValue(payload["providerPreset"]) != nil,
            stringValue(payload["model"]) != nil,
            stringValue(payload["starterAgent"]) != nil
        else {
            respond(requestId: requestId, ok: false, error: "Missing onboarding fields.")
            return
        }
        do {
            try persistDesktopConfiguration(payload: payload, requireFreshAPIKey: true)
            restartBackend()
            respond(requestId: requestId, ok: true, payload: bootstrapPayload())
        } catch {
            respond(requestId: requestId, ok: false, error: error.localizedDescription)
        }
    }

    private func handleSavePreferences(requestId: String?, payload: [String: Any]) {
        do {
            try persistDesktopConfiguration(payload: payload, requireFreshAPIKey: false)
            restartBackend()
            respond(requestId: requestId, ok: true, payload: bootstrapPayload())
        } catch {
            respond(requestId: requestId, ok: false, error: error.localizedDescription)
        }
    }

    private func handleSetSessionAgentProfile(requestId: String?, payload: [String: Any]) {
        guard let requestedAgentId = stringValue(payload["agentId"])?.nonEmpty else {
            respond(requestId: requestId, ok: false, error: "Missing agent id.")
            return
        }

        let sessionPath = stringValue(payload["sessionPath"]) ?? currentSessionPath
        guard let canonicalSessionPath = canonicalPath(sessionPath) else {
            respond(requestId: requestId, ok: false, error: "No active session is available yet.")
            return
        }

        let validAgentIds = Set(buildAgentPayload().map(\.id))
        guard validAgentIds.contains(requestedAgentId) else {
            respond(requestId: requestId, ok: false, error: "Unknown agent profile: \(requestedAgentId)")
            return
        }

        do {
            var runtime = loadRuntimeState()
            var sessionAgents = normalizedSessionAgents(from: runtime)
            let defaultAgentId = loadSettings().starterAgent ?? "main"
            if requestedAgentId == defaultAgentId {
                sessionAgents.removeValue(forKey: canonicalSessionPath)
            } else {
                sessionAgents[canonicalSessionPath] = requestedAgentId
            }
            runtime.sessionAgents = sessionAgents.isEmpty ? nil : sessionAgents
            try saveRuntimeState(runtime)
            if let currentCanonical = canonicalPath(currentSessionPath),
               currentCanonical == canonicalSessionPath
            {
                currentSessionPath = canonicalSessionPath
            }
            respond(requestId: requestId, ok: true, payload: bootstrapPayload())
        } catch {
            respond(requestId: requestId, ok: false, error: error.localizedDescription)
        }
    }

    private func handleRemoveProviderCredential(requestId: String?, payload: [String: Any]) {
        let preset = providerPreset(for: stringValue(payload["providerPreset"]) ?? stringValue(payload["provider"])) ?? defaultProviderPreset()
        let providerId = sanitizedProviderId(raw: stringValue(payload["provider"]), preset: preset)
        guard !providerId.isEmpty else {
            respond(requestId: requestId, ok: false, error: "Missing provider id.")
            return
        }

        do {
            var authEntries = loadJSONObject(from: authPath())
            let aliases = providerAliases(for: providerId, preset: preset)
            for key in authEntries.keys.filter({ existing in
                aliases.contains { alias in
                    existing.caseInsensitiveCompare(alias) == .orderedSame
                }
            }) {
                authEntries.removeValue(forKey: key)
            }
            try saveJSONObject(authEntries, to: authPath())
            restartBackend()
            respond(requestId: requestId, ok: true, payload: bootstrapPayload())
        } catch {
            respond(requestId: requestId, ok: false, error: error.localizedDescription)
        }
    }

    private func handleSaveBindings(requestId: String?, payload: [String: Any]) {
        let bindings = objectArray(payload["bindings"])
        do {
            var settings = projectSettingsObject()
            let systemId = ensureSystemExists(in: &settings)
            settings["bindings"] = bindings.map { binding in
                [
                    "id": stringValue(binding["id"]) ?? UUID().uuidString,
                    "platform": stringValue(binding["platform"]) ?? "custom",
                    "enabled": boolValue(binding["enabled"]) ?? false,
                    "agentProfile": stringValue(binding["agentProfile"]) ?? "main",
                    "config": binding["config"] as? [String: Any] ?? [:]
                ]
            }
            syncSystemReferences(in: &settings, systemId: systemId)
            try saveProjectSettingsObject(settings)
            restartBackend()
            respond(requestId: requestId, ok: true, payload: bootstrapPayload())
        } catch {
            respond(requestId: requestId, ok: false, error: error.localizedDescription)
        }
    }

    private func handleSaveSkillSettings(requestId: String?, payload: [String: Any]) {
        do {
            var global = globalSettingsObject()
            var project = projectSettingsObject()
            global["enableSkillCommands"] = boolValue(payload["enableSkillCommands"]) ?? true
            global["skills"] = stringArray(payload["globalSkillPaths"])
            project["skills"] = stringArray(payload["projectSkillPaths"])
            try saveGlobalSettingsObject(global)
            try saveProjectSettingsObject(project)
            restartBackend()
            respond(requestId: requestId, ok: true, payload: bootstrapPayload())
        } catch {
            respond(requestId: requestId, ok: false, error: error.localizedDescription)
        }
    }

    private func handleInstallCatalogSkill(requestId: String?, payload: [String: Any]) {
        guard let catalogId = stringValue(payload["catalogId"]), !catalogId.isEmpty else {
            respond(requestId: requestId, ok: false, error: "Missing catalog skill id.")
            return
        }
        let scope = stringValue(payload["scope"]) ?? "global"
        guard let sourceRoot = bundledSkillCatalogRoot()?.appendingPathComponent(catalogId, isDirectory: true),
              fileManager.fileExists(atPath: sourceRoot.path) else {
            respond(requestId: requestId, ok: false, error: "This curated skill pack is not bundled with the installed app.")
            return
        }

        let targetRoot: URL
        switch scope {
        case "project":
            targetRoot = projectSkillsRoot().appendingPathComponent("catalog", isDirectory: true)
        default:
            targetRoot = globalSkillsRoot().appendingPathComponent("catalog", isDirectory: true)
        }

        do {
            try fileManager.createDirectory(at: targetRoot, withIntermediateDirectories: true)
            let target = targetRoot.appendingPathComponent(catalogId, isDirectory: true)
            try copyWithBackupIfNeeded(from: sourceRoot, to: target)
            appendLog("installed curated skill pack \(catalogId) into \(scope) skills")
            restartBackend()
            respond(requestId: requestId, ok: true, payload: bootstrapPayload())
        } catch {
            respond(requestId: requestId, ok: false, error: error.localizedDescription)
        }
    }

    private func handleSaveHostSettings(requestId: String?, payload: [String: Any]) {
        do {
            let bootstrap = try saveHostSettings(payload: payload)
            respond(requestId: requestId, ok: true, payload: bootstrap)
        } catch {
            respond(requestId: requestId, ok: false, error: error.localizedDescription)
        }
    }

    private func canonicalAgentOverride(
        payload: [String: Any],
        base: DesktopAgentSummary?
    ) -> [String: Any]? {
        let id = stringValue(payload["id"]) ?? base?.id ?? UUID().uuidString
        let displayName = stringValue(payload["displayName"])?.trimmingCharacters(in: .whitespacesAndNewlines)
            ?? base?.displayName
            ?? id.capitalized
        let description = stringValue(payload["description"])?.trimmingCharacters(in: .whitespacesAndNewlines)
            ?? base?.description
            ?? ""
        let modeId = stringValue(payload["modeId"]) ?? base?.modeId ?? "follow_main"
        let provider = stringValue(payload["provider"])?.trimmingCharacters(in: .whitespacesAndNewlines)
        let model = stringValue(payload["model"])?.trimmingCharacters(in: .whitespacesAndNewlines)
        let skills = stringArray(payload["skills"])
        let prompts = stringArray(payload["prompts"])

        var object: [String: Any] = [:]
        if displayName != base?.displayName || base == nil {
            object["displayName"] = displayName
        }
        if description != base?.description || base == nil {
            object["description"] = description
        }
        if modeId != base?.modeId || base == nil {
            object["mode"] = modeId
        }
        if modeId == "override" {
            if let provider, !provider.isEmpty {
                object["provider"] = provider
            }
            if let model, !model.isEmpty {
                object["model"] = model
            }
        }
        if skills != (base?.builtinSkills ?? base?.skills ?? []) || base == nil {
            object["skills"] = skills
        }
        if !prompts.isEmpty || !(base?.prompts.isEmpty ?? true) {
            if prompts != (base?.prompts ?? []) || base == nil {
                object["prompts"] = prompts
            }
        }

        return object.isEmpty ? nil : object
    }

    private func handleSaveAgentProfiles(requestId: String?, payload: [String: Any]) {
        let profiles = objectArray(payload["profiles"])
        do {
            var global = globalSettingsObject()
            var savedProfiles: [String: Any] = [:]
            let basesById = Dictionary(uniqueKeysWithValues: agentCatalog.map { ($0.id, $0) })

            for profile in profiles {
                guard let id = stringValue(profile["id"]) else {
                    continue
                }
                if let override = canonicalAgentOverride(payload: profile, base: basesById[id]) {
                    savedProfiles[id] = override
                }
            }

            if savedProfiles.isEmpty {
                global.removeValue(forKey: "agentProfiles")
            } else {
                global["agentProfiles"] = savedProfiles
            }
            try saveGlobalSettingsObject(global)
            restartBackend()
            respond(requestId: requestId, ok: true, payload: bootstrapPayload())
        } catch {
            respond(requestId: requestId, ok: false, error: error.localizedDescription)
        }
    }

    private func handleSaveAutomation(requestId: String?, payload: [String: Any]) {
        let name = stringValue(payload["name"]) ?? "Scheduled Automation"
        let cron = stringValue(payload["cron"]) ?? ""
        guard !cron.isEmpty else {
            respond(requestId: requestId, ok: false, error: "Cron expression is required.")
            return
        }

        let actionType = stringValue(payload["actionType"]) ?? "run_task"
        var action: [String: Any] = ["type": actionType]
        switch actionType {
        case "run_task":
            action["prompt_template"] = stringValue(payload["promptTemplate"]) ?? ""
        case "export":
            action["destination"] = stringValue(payload["destination"]) ?? ""
            action["format"] = stringValue(payload["format"]) ?? "json"
        case "notify_binding":
            action["binding_id"] = stringValue(payload["bindingId"]) ?? ""
            action["template"] = stringValue(payload["template"]) ?? ""
        case "webhook":
            action["url"] = stringValue(payload["url"]) ?? ""
        default:
            break
        }

        do {
            var settings = projectSettingsObject()
            let systemId = ensureSystemExists(in: &settings)
            try fileManager.createDirectory(at: automationDirectory(for: systemId), withIntermediateDirectories: true)
            let automationId = stringValue(payload["id"]) ?? "auto_\(timestampToken().lowercased())"
            let existing = loadJSONObject(from: automationFileURL(systemId: systemId, automationId: automationId))
            let createdAt = stringValue(existing["created_at"]) ?? nowIsoString()
            let automation: [String: Any] = [
                "id": automationId,
                "system_id": systemId,
                "name": name,
                "description": stringValue(payload["description"]) as Any,
                "trigger": [
                    "type": "schedule",
                    "cron": cron
                ],
                "action": action,
                "enabled": boolValue(payload["enabled"]) ?? true,
                "created_at": createdAt,
                "updated_at": nowIsoString(),
                "max_consecutive_failures": 5,
                "last_run_at": existing["last_run_at"] as Any,
                "last_run_status": existing["last_run_status"] as Any,
                "consecutive_failures": (existing["consecutive_failures"] as? Int) ?? 0
            ]
            try saveJSONObject(automation, to: automationFileURL(systemId: systemId, automationId: automationId))
            syncSystemReferences(in: &settings, systemId: systemId)
            try saveProjectSettingsObject(settings)
            respond(requestId: requestId, ok: true, payload: bootstrapPayload())
        } catch {
            respond(requestId: requestId, ok: false, error: error.localizedDescription)
        }
    }

    private func handleDeleteAutomation(requestId: String?, payload: [String: Any]) {
        guard let automationId = stringValue(payload["id"]) else {
            respond(requestId: requestId, ok: false, error: "Missing automation id.")
            return
        }
        do {
            var settings = projectSettingsObject()
            let systemId = ensureSystemExists(in: &settings)
            let path = automationFileURL(systemId: systemId, automationId: automationId)
            if fileManager.fileExists(atPath: path.path) {
                try fileManager.removeItem(at: path)
            }
            syncSystemReferences(in: &settings, systemId: systemId)
            try saveProjectSettingsObject(settings)
            respond(requestId: requestId, ok: true, payload: bootstrapPayload())
        } catch {
            respond(requestId: requestId, ok: false, error: error.localizedDescription)
        }
    }

    private func handleToggleAutomation(requestId: String?, payload: [String: Any]) {
        guard
            let automationId = stringValue(payload["id"]),
            let enabled = boolValue(payload["enabled"])
        else {
            respond(requestId: requestId, ok: false, error: "Missing automation toggle payload.")
            return
        }

        do {
            var settings = projectSettingsObject()
            let systemId = ensureSystemExists(in: &settings)
            let path = automationFileURL(systemId: systemId, automationId: automationId)
            var automation = loadJSONObject(from: path)
            guard !automation.isEmpty else {
                respond(requestId: requestId, ok: false, error: "Automation not found.")
                return
            }
            automation["enabled"] = enabled
            automation["updated_at"] = nowIsoString()
            try saveJSONObject(automation, to: path)
            syncSystemReferences(in: &settings, systemId: systemId)
            try saveProjectSettingsObject(settings)
            respond(requestId: requestId, ok: true, payload: bootstrapPayload())
        } catch {
            respond(requestId: requestId, ok: false, error: error.localizedDescription)
        }
    }

    private func handleSaveSecuritySettings(requestId: String?, payload: [String: Any]) {
        do {
            var settings = globalSettingsObject()
            settings["extensionPolicy"] = [
                "profile": stringValue(payload["profile"]) ?? "permissive",
                "defaultPermissive": boolValue(payload["defaultPermissive"]) ?? false,
                "allowDangerous": boolValue(payload["allowDangerous"]) ?? false
            ]
            settings["desktopSecurity"] = [
                "machinePreset": stringValue(payload["machinePreset"]) ?? "primary",
                "destructiveExecPolicy": stringValue(payload["destructiveExecPolicy"]) ?? "confirm",
                "sandboxMode": stringValue(payload["sandboxMode"]) ?? "workspace_write",
                "gatewayMode": stringValue(payload["gatewayMode"]) ?? "direct",
                "gatewayURL": stringValue(payload["gatewayURL"]) ?? "",
                "browserAutomation": boolValue(payload["browserAutomation"]) ?? false,
                "conflictGuard": boolValue(payload["conflictGuard"]) ?? true,
                "scopedDirectories": stringArray(payload["scopedDirectories"])
            ]
            try saveGlobalSettingsObject(settings)
            restartBackend()
            respond(requestId: requestId, ok: true, payload: bootstrapPayload())
        } catch {
            respond(requestId: requestId, ok: false, error: error.localizedDescription)
        }
    }

    private func handlePickScopedDirectory(requestId: String?) {
        let panel = NSOpenPanel()
        panel.canChooseDirectories = true
        panel.canChooseFiles = false
        panel.allowsMultipleSelection = false
        panel.directoryURL = URL(fileURLWithPath: loadRuntimeState().workspacePath ?? NSHomeDirectory())
        panel.prompt = "Allow Directory"
        panel.message = "Choose an additional directory \(productDisplayName) may treat as an approved working root."

        guard panel.runModal() == .OK, let url = panel.url else {
            respond(requestId: requestId, ok: false, error: "Cancelled")
            return
        }

        do {
            var settings = globalSettingsObject()
            var desktopSecurity = settings["desktopSecurity"] as? [String: Any] ?? [:]
            var scopedDirectories = Set(stringArray(desktopSecurity["scopedDirectories"]))
            scopedDirectories.insert(url.path)
            desktopSecurity["scopedDirectories"] = scopedDirectories.sorted()
            settings["desktopSecurity"] = desktopSecurity
            try saveGlobalSettingsObject(settings)
            respond(requestId: requestId, ok: true, payload: bootstrapPayload())
        } catch {
            respond(requestId: requestId, ok: false, error: error.localizedDescription)
        }
    }

    private func handleRemoveScopedDirectory(requestId: String?, payload: [String: Any]) {
        guard let path = stringValue(payload["path"]) else {
            respond(requestId: requestId, ok: false, error: "Missing scoped directory path.")
            return
        }

        do {
            var settings = globalSettingsObject()
            var desktopSecurity = settings["desktopSecurity"] as? [String: Any] ?? [:]
            let scopedDirectories = stringArray(desktopSecurity["scopedDirectories"])
                .filter { $0 != path }
            desktopSecurity["scopedDirectories"] = scopedDirectories
            settings["desktopSecurity"] = desktopSecurity
            try saveGlobalSettingsObject(settings)
            respond(requestId: requestId, ok: true, payload: bootstrapPayload())
        } catch {
            respond(requestId: requestId, ok: false, error: error.localizedDescription)
        }
    }

    private func handleSetPermissionDecision(requestId: String?, payload: [String: Any]) {
        guard
            let extensionId = stringValue(payload["extensionId"]),
            let capability = stringValue(payload["capability"]),
            let allow = boolValue(payload["allow"])
        else {
            respond(requestId: requestId, ok: false, error: "Missing extension permission fields.")
            return
        }

        do {
            var decisions = loadPermissionDecisions()
            var extensionDecisions = decisions[extensionId] ?? []
            extensionDecisions.removeAll { stringValue($0["capability"]) == capability }
            extensionDecisions.append([
                "capability": capability,
                "allow": allow,
                "decided_at": nowIsoString(),
                "expires_at": NSNull(),
                "version_range": NSNull()
            ])
            decisions[extensionId] = extensionDecisions.sorted {
                stringValue($0["capability"]) ?? "" < stringValue($1["capability"]) ?? ""
            }
            try savePermissionDecisions(decisions)
            respond(requestId: requestId, ok: true, payload: bootstrapPayload())
        } catch {
            respond(requestId: requestId, ok: false, error: error.localizedDescription)
        }
    }

    private func handleRemovePermissionExtension(requestId: String?, payload: [String: Any]) {
        guard let extensionId = stringValue(payload["extensionId"]) else {
            respond(requestId: requestId, ok: false, error: "Missing extension id.")
            return
        }

        do {
            var decisions = loadPermissionDecisions()
            decisions.removeValue(forKey: extensionId)
            try savePermissionDecisions(decisions)
            respond(requestId: requestId, ok: true, payload: bootstrapPayload())
        } catch {
            respond(requestId: requestId, ok: false, error: error.localizedDescription)
        }
    }

    private func handleResetPermissionDecisions(requestId: String?) {
        do {
            try savePermissionDecisions([:])
            respond(requestId: requestId, ok: true, payload: bootstrapPayload())
        } catch {
            respond(requestId: requestId, ok: false, error: error.localizedDescription)
        }
    }

    private func handleRequestSystemPermission(requestId: String?, payload: [String: Any]) {
        guard let permissionId = stringValue(payload["permissionId"]) else {
            respond(requestId: requestId, ok: false, error: "Missing permission id.")
            return
        }

        switch permissionId {
        case "notifications":
            UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { [weak self] _, error in
                DispatchQueue.main.async {
                    if let error {
                        self?.respond(requestId: requestId, ok: false, error: error.localizedDescription)
                    } else {
                        self?.respond(requestId: requestId, ok: true, payload: self?.bootstrapPayload() ?? [:])
                    }
                }
            }
        case "camera":
            AVCaptureDevice.requestAccess(for: .video) { [weak self] _ in
                DispatchQueue.main.async {
                    self?.respond(requestId: requestId, ok: true, payload: self?.bootstrapPayload() ?? [:])
                }
            }
        case "microphone":
            AVCaptureDevice.requestAccess(for: .audio) { [weak self] _ in
                DispatchQueue.main.async {
                    self?.respond(requestId: requestId, ok: true, payload: self?.bootstrapPayload() ?? [:])
                }
            }
        case "speech_recognition":
            SFSpeechRecognizer.requestAuthorization { [weak self] _ in
                DispatchQueue.main.async {
                    self?.respond(requestId: requestId, ok: true, payload: self?.bootstrapPayload() ?? [:])
                }
            }
        case "location":
            pendingLocationPermissionRequestId = requestId
            let manager = CLLocationManager()
            manager.delegate = self
            locationManager = manager
            manager.requestAlwaysAuthorization()
        case "screen_recording":
            if #available(macOS 10.15, *) {
                _ = CGRequestScreenCaptureAccess()
                respond(requestId: requestId, ok: true, payload: bootstrapPayload())
            } else {
                respond(requestId: requestId, ok: false, error: "Screen recording permissions are unsupported on this macOS version.")
            }
        case "accessibility":
            let options = [kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String: true] as CFDictionary
            _ = AXIsProcessTrustedWithOptions(options)
            respond(requestId: requestId, ok: true, payload: bootstrapPayload())
        case "automation":
            _ = requestAutomationPermission()
            respond(requestId: requestId, ok: true, payload: bootstrapPayload())
        default:
            respond(requestId: requestId, ok: false, error: "Unknown permission: \(permissionId)")
        }
    }

    private func handleOpenPrivacySettings(requestId: String?, payload: [String: Any]) {
        guard let permissionId = stringValue(payload["permissionId"]) else {
            respond(requestId: requestId, ok: false, error: "Missing permission id.")
            return
        }
        let urlString: String
        switch permissionId {
        case "automation":
            urlString = "x-apple.systempreferences:com.apple.preference.security?Privacy_Automation"
        case "notifications":
            urlString = "x-apple.systempreferences:com.apple.preference.notifications"
        case "accessibility":
            urlString = "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility"
        case "screen_recording":
            urlString = "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture"
        case "microphone":
            urlString = "x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone"
        case "speech_recognition":
            urlString = "x-apple.systempreferences:com.apple.preference.security?Privacy_SpeechRecognition"
        case "camera":
            urlString = "x-apple.systempreferences:com.apple.preference.security?Privacy_Camera"
        case "location":
            urlString = "x-apple.systempreferences:com.apple.preference.security?Privacy_LocationServices"
        default:
            respond(requestId: requestId, ok: false, error: "Unknown permission: \(permissionId)")
            return
        }

        if let url = URL(string: urlString) {
            NSWorkspace.shared.open(url)
        }
        respond(requestId: requestId, ok: true, payload: bootstrapPayload())
    }

    private func handleOpenDesktopLog(requestId: String?) {
        handleOpenPath(requestId: requestId, path: desktopLogPath())
    }

    private func handleExportDiagnosticsReport(requestId: String?) {
        let panel = NSSavePanel()
        panel.directoryURL = diagnosticsDirectory()
        panel.nameFieldStringValue = "maoclaw-diagnostics-\(timestampToken().lowercased()).json"
        panel.allowedContentTypes = [.json]
        panel.prompt = "Export"
        panel.message = "Export a structured diagnostics report for troubleshooting."

        guard panel.runModal() == .OK, let url = panel.url else {
            respond(requestId: requestId, ok: false, error: "Cancelled")
            return
        }

        do {
            try writeDiagnosticsReport(to: url, includeSupportSnapshot: false)
            respond(requestId: requestId, ok: true, payload: [
                "path": url.path,
                "bootstrap": bootstrapPayload()
            ])
        } catch {
            respond(requestId: requestId, ok: false, error: error.localizedDescription)
        }
    }

    private func handlePrepareSupportReport(requestId: String?) {
        do {
            let url = diagnosticsDirectory().appendingPathComponent(
                "maoclaw-support-\(timestampToken().lowercased()).json"
            )
            try writeDiagnosticsReport(to: url, includeSupportSnapshot: true)
            NSWorkspace.shared.activateFileViewerSelecting([url])
            respond(requestId: requestId, ok: true, payload: [
                "path": url.path,
                "bootstrap": bootstrapPayload()
            ])
        } catch {
            respond(requestId: requestId, ok: false, error: error.localizedDescription)
        }
    }

    private func handleSendPrompt(requestId: String?, payload: [String: Any]) {
        let rawMessage = payload["message"] as? String ?? ""
        let attachments = objectArray(payload["attachments"])
        let textMessage = rawMessage.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !textMessage.isEmpty || !attachments.isEmpty else {
            respond(requestId: requestId, ok: false, error: "Prompt is empty.")
            return
        }

        do {
            try ensureBackend()
            let images = rpcImagePayload(from: attachments)
            let outboundMessage = composeOutboundPrompt(text: textMessage, attachments: attachments)
            try sendTrackedRPCLine(
                requestId: requestId,
                command: "prompt",
                value: [
                "type": "prompt",
                "message": outboundMessage,
                "images": images,
                "streamingBehavior": "followUp"
                ]
            )
        } catch {
            respond(requestId: requestId, ok: false, error: error.localizedDescription)
        }
    }

    private func handleSetGoalContract(requestId: String?, payload: [String: Any]) {
        guard let goalContract = payload["goalContract"] as? [String: Any], !goalContract.isEmpty else {
            respond(requestId: requestId, ok: false, error: "Missing goal contract payload.")
            return
        }

        do {
            try ensureBackend()
            try sendTrackedRPCLine(
                requestId: requestId,
                command: "set_goal_contract",
                value: [
                    "type": "set_goal_contract",
                    "goalContract": goalContract
                ]
            )
        } catch {
            respond(requestId: requestId, ok: false, error: error.localizedDescription)
        }
    }

    private func handleUpdateGoalRun(requestId: String?, payload: [String: Any]) {
        guard let goalRun = payload["goalRun"] as? [String: Any], !goalRun.isEmpty else {
            respond(requestId: requestId, ok: false, error: "Missing goal run payload.")
            return
        }

        do {
            try ensureBackend()
            try sendTrackedRPCLine(
                requestId: requestId,
                command: "update_goal_run",
                value: [
                    "type": "update_goal_run",
                    "goalRun": goalRun
                ]
            )
        } catch {
            respond(requestId: requestId, ok: false, error: error.localizedDescription)
        }
    }

    private func handleUpdateGoalCriterion(requestId: String?, payload: [String: Any]) {
        guard let goalCriterion = payload["goalCriterion"] as? [String: Any], !goalCriterion.isEmpty else {
            respond(requestId: requestId, ok: false, error: "Missing goal criterion payload.")
            return
        }

        do {
            try ensureBackend()
            try sendTrackedRPCLine(
                requestId: requestId,
                command: "update_goal_criterion",
                value: [
                    "type": "update_goal_criterion",
                    "goalCriterion": goalCriterion
                ]
            )
        } catch {
            respond(requestId: requestId, ok: false, error: error.localizedDescription)
        }
    }

    private func handleClearGoalContract(requestId: String?) {
        do {
            try ensureBackend()
            try sendTrackedRPCLine(
                requestId: requestId,
                command: "clear_goal_contract",
                value: [
                    "type": "clear_goal_contract"
                ]
            )
        } catch {
            respond(requestId: requestId, ok: false, error: error.localizedDescription)
        }
    }

    private func handlePickComposerAttachments(requestId: String?, payload: [String: Any]) {
        let purpose = stringValue(payload["purpose"]) ?? "any"
        let panel = NSOpenPanel()
        panel.canChooseDirectories = false
        panel.canChooseFiles = true
        panel.allowsMultipleSelection = true
        panel.directoryURL = URL(fileURLWithPath: loadRuntimeState().workspacePath ?? NSHomeDirectory())
        panel.prompt = "Attach"
        panel.message = "Select files to attach to the next \(productDisplayName) turn."
        panel.allowedContentTypes = allowedContentTypes(for: purpose)

        guard panel.runModal() == .OK else {
            respond(requestId: requestId, ok: false, error: "Cancelled")
            return
        }

        do {
            let attachments = try panel.urls.map(desktopAttachmentPayload(for:))
            respond(requestId: requestId, ok: true, payload: ["attachments": attachments])
        } catch {
            respond(requestId: requestId, ok: false, error: error.localizedDescription)
        }
    }

    private func handleOpenExternalPath(requestId: String?, payload: [String: Any]) {
        guard let path = stringValue(payload["path"]), !path.isEmpty else {
            respond(requestId: requestId, ok: false, error: "Missing path.")
            return
        }
        if let url = URL(string: path), let scheme = url.scheme?.lowercased(), ["http", "https", "file"].contains(scheme) {
            NSWorkspace.shared.open(url)
            respond(requestId: requestId, ok: true)
            return
        }
        handleOpenPath(requestId: requestId, path: URL(fileURLWithPath: path))
    }

    private func allowedContentTypes(for purpose: String) -> [UTType] {
        switch purpose {
        case "image":
            return [.image]
        case "audio":
            return [.audio]
        default:
            return [.data, .image, .audio, .pdf, .plainText, .json]
        }
    }

    private func attachmentKind(for type: UTType?) -> String {
        guard let type else {
            return "file"
        }
        if type.conforms(to: .image) {
            return "image"
        }
        if type.conforms(to: .audio) {
            return "audio"
        }
        return "file"
    }

    private func desktopAttachmentPayload(for url: URL) throws -> [String: Any] {
        let resourceValues = try url.resourceValues(forKeys: [.contentTypeKey, .fileSizeKey])
        let contentType = resourceValues.contentType
        let kind = attachmentKind(for: contentType)
        let mimeType = contentType?.preferredMIMEType ?? "application/octet-stream"
        let sizeBytes = resourceValues.fileSize ?? 0

        var payload: [String: Any] = [
            "id": UUID().uuidString,
            "name": url.lastPathComponent,
            "path": url.path,
            "kind": kind,
            "mimeType": mimeType,
            "sizeBytes": sizeBytes
        ]

        if kind == "image" {
            let data = try Data(contentsOf: url)
            payload["base64Data"] = data.base64EncodedString()
        }

        return payload
    }

    private func rpcImagePayload(from attachments: [[String: Any]]) -> [[String: Any]] {
        attachments.compactMap { item in
            guard
                stringValue(item["kind"]) == "image",
                let data = stringValue(item["base64Data"]),
                let mimeType = stringValue(item["mimeType"])
            else {
                return nil
            }
            return [
                "type": "image",
                "source": [
                    "type": "base64",
                    "mediaType": mimeType,
                    "data": data
                ]
            ]
        }
    }

    private func composeOutboundPrompt(text: String, attachments: [[String: Any]]) -> String {
        var parts: [String] = []
        if !text.isEmpty {
            parts.append(text)
        }

        if !attachments.isEmpty {
            let attachmentLines = attachments.map { item -> String in
                let kind = stringValue(item["kind"]) ?? "file"
                let name = stringValue(item["name"]) ?? "attachment"
                let path = stringValue(item["path"]) ?? ""
                switch kind {
                case "image":
                    return "- image: \(name)"
                case "audio":
                    return "- audio file reference: \(name) (\(path))"
                default:
                    return "- file reference: \(name) (\(path))"
                }
            }
            parts.append(
                """
                Attached items:
                \(attachmentLines.joined(separator: "\n"))
                """
            )
        }

        if parts.isEmpty {
            return "Please inspect the attached items."
        }
        return parts.joined(separator: "\n\n")
    }

    private func handleChooseWorkspace(requestId: String?) {
        let panel = NSOpenPanel()
        panel.canChooseDirectories = true
        panel.canChooseFiles = false
        panel.allowsMultipleSelection = false
        panel.directoryURL = URL(fileURLWithPath: loadRuntimeState().workspacePath ?? NSHomeDirectory())
        panel.prompt = "Use Folder"
        panel.message = "Choose the working folder \(productDisplayName) should operate in."

        guard panel.runModal() == .OK, let url = panel.url else {
            respond(requestId: requestId, ok: false, error: "Cancelled")
            return
        }

        do {
            var runtime = loadRuntimeState()
            runtime.workspacePath = url.path
            try saveRuntimeState(runtime)
            restartBackend()
            respond(requestId: requestId, ok: true, payload: bootstrapPayload())
        } catch {
            respond(requestId: requestId, ok: false, error: error.localizedDescription)
        }
    }

    private func handleOpenPath(requestId: String?, path: URL) {
        NSWorkspace.shared.open(path)
        respond(requestId: requestId, ok: true)
    }

    private func handleOpenCurrentSession(requestId: String?) {
        guard let currentSessionPath else {
            respond(requestId: requestId, ok: false, error: "No session file is active yet.")
            return
        }
        handleOpenPath(requestId: requestId, path: URL(fileURLWithPath: currentSessionPath))
    }

    private func handleNewSession(requestId: String?) {
        do {
            try ensureBackend()
            try sendTrackedRPCLine(
                requestId: requestId,
                command: "new_session",
                value: [
                "type": "new_session"
                ]
            )
        } catch {
            respond(requestId: requestId, ok: false, error: error.localizedDescription)
        }
    }

    private func handleSwitchSession(requestId: String?, payload: [String: Any]) {
        guard let sessionPath = payload["sessionPath"] as? String, !sessionPath.isEmpty else {
            respond(requestId: requestId, ok: false, error: "Missing session path.")
            return
        }

        do {
            try ensureBackend()
            try sendTrackedRPCLine(
                requestId: requestId,
                command: "switch_session",
                value: [
                "type": "switch_session",
                "sessionPath": sessionPath
                ]
            )
        } catch {
            respond(requestId: requestId, ok: false, error: error.localizedDescription)
        }
    }

    private func handleSetModel(requestId: String?, payload: [String: Any]) {
        guard
            let provider = payload["provider"] as? String, !provider.isEmpty,
            let modelId = payload["modelId"] as? String, !modelId.isEmpty
        else {
            respond(requestId: requestId, ok: false, error: "Missing provider/model selection.")
            return
        }

        do {
            try ensureBackend()
            try sendTrackedRPCLine(
                requestId: requestId,
                command: "set_model",
                value: [
                "type": "set_model",
                "provider": provider,
                "modelId": modelId
                ]
            )
        } catch {
            respond(requestId: requestId, ok: false, error: error.localizedDescription)
        }
    }

    private func handleSetSessionName(requestId: String?, payload: [String: Any]) {
        guard let name = payload["name"] as? String else {
            respond(requestId: requestId, ok: false, error: "Missing session name.")
            return
        }

        do {
            try ensureBackend()
            try sendTrackedRPCLine(
                requestId: requestId,
                command: "set_session_name",
                value: [
                "type": "set_session_name",
                "name": name
                ]
            )
        } catch {
            respond(requestId: requestId, ok: false, error: error.localizedDescription)
        }
    }

    private func handleExportCurrentSession(requestId: String?) {
        let panel = NSSavePanel()
        panel.nameFieldStringValue = "pi-session.html"
        panel.allowedContentTypes = [.html]
        panel.prompt = "Export"
        panel.message = "Export the current \(productDisplayName) session as HTML."

        guard panel.runModal() == .OK, let url = panel.url else {
            respond(requestId: requestId, ok: false, error: "Cancelled")
            return
        }

        do {
            try ensureBackend()
            try sendRPCLine([
                "id": UUID().uuidString,
                "type": "export_html",
                "outputPath": url.path
            ])
            respond(requestId: requestId, ok: true)
        } catch {
            respond(requestId: requestId, ok: false, error: error.localizedDescription)
        }
    }

    private func handleImportExistingSetup(requestId: String?) {
        let candidate = importCandidate()
        guard candidate.available else {
            respond(requestId: requestId, ok: false, error: "No existing Pi CLI setup was detected.")
            return
        }

        do {
            try ensureDirectories()
            try copyWithBackupIfNeeded(from: legacySettingsPath(), to: settingsPath())
            try copyWithBackupIfNeeded(from: legacyAuthPath(), to: authPath())
            if loadRuntimeState().workspacePath == nil {
                var runtime = loadRuntimeState()
                runtime.workspacePath = NSHomeDirectory()
                try saveRuntimeState(runtime)
            }
            restartBackend()
            respond(requestId: requestId, ok: true, payload: bootstrapPayload())
        } catch {
            respond(requestId: requestId, ok: false, error: error.localizedDescription)
        }
    }

    private func parsedVersionComponents(_ value: String) -> [Int] {
        let normalized = value
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: #"^[vV]"#, with: "", options: .regularExpression)
            .components(separatedBy: CharacterSet(charactersIn: "-+"))
            .first ?? value
        return normalized
            .split(separator: ".")
            .map { Int($0) ?? 0 }
    }

    private func isNewerVersion(_ latest: String, than current: String) -> Bool {
        let lhs = parsedVersionComponents(latest)
        let rhs = parsedVersionComponents(current)
        let count = max(lhs.count, rhs.count)
        for index in 0..<count {
            let left = index < lhs.count ? lhs[index] : 0
            let right = index < rhs.count ? rhs[index] : 0
            if left != right {
                return left > right
            }
        }
        return false
    }

    private func preferredReleaseDownloadURL(from release: [String: Any]) -> String? {
        let assets = release["assets"] as? [[String: Any]] ?? []
        let preferred = assets.first { asset in
            guard let name = stringValue(asset["name"])?.lowercased() else {
                return false
            }
            return (name.hasSuffix(".pkg") || name.hasSuffix(".dmg")) && name.contains("mao")
        } ?? assets.first { asset in
            guard let name = stringValue(asset["name"])?.lowercased() else {
                return false
            }
            return name.hasSuffix(".pkg") || name.hasSuffix(".dmg")
        }
        return stringValue(preferred?["browser_download_url"])
    }

    private func handleCheckForUpdates(requestId: String?) {
        var request = URLRequest(url: releaseAPIURL)
        request.setValue("application/vnd.github+json", forHTTPHeaderField: "Accept")
        request.setValue("maoclaw-desktop/\(currentAppVersion())", forHTTPHeaderField: "User-Agent")

        URLSession.shared.dataTask(with: request) { [weak self] data, _, error in
            guard let self else {
                return
            }

            if let error {
                let state = DesktopUpdateState(
                    currentVersion: self.currentAppVersion(),
                    latestVersion: nil,
                    status: "error",
                    message: "Update check failed: \(error.localizedDescription)",
                    checkedAt: self.nowIsoString(),
                    releaseName: nil,
                    publishedAt: nil,
                    releaseNotes: nil,
                    releaseURL: self.releasesPageURL.absoluteString,
                    downloadURL: nil,
                    downloadedPackagePath: nil
                )
                try? self.saveUpdateState(state)
                self.respond(requestId: requestId, ok: true, payload: self.bootstrapPayload())
                return
            }

            guard
                let data,
                let value = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                let latestVersion = self.stringValue(value["tag_name"])?.replacingOccurrences(of: #"^[vV]"#, with: "", options: .regularExpression)
            else {
                let state = DesktopUpdateState(
                    currentVersion: self.currentAppVersion(),
                    latestVersion: nil,
                    status: "error",
                    message: "GitHub returned an unreadable release payload.",
                    checkedAt: self.nowIsoString(),
                    releaseName: nil,
                    publishedAt: nil,
                    releaseNotes: nil,
                    releaseURL: self.releasesPageURL.absoluteString,
                    downloadURL: nil,
                    downloadedPackagePath: nil
                )
                try? self.saveUpdateState(state)
                self.respond(requestId: requestId, ok: true, payload: self.bootstrapPayload())
                return
            }

            let downloadURL = self.preferredReleaseDownloadURL(from: value)
            let updateAvailable = self.isNewerVersion(latestVersion, than: self.currentAppVersion())
            let state = DesktopUpdateState(
                currentVersion: self.currentAppVersion(),
                latestVersion: latestVersion,
                status: updateAvailable ? "update_available" : "up_to_date",
                message: updateAvailable
                    ? "Version \(latestVersion) is available."
                    : "This desktop build is up to date.",
                checkedAt: self.nowIsoString(),
                releaseName: self.stringValue(value["name"]),
                publishedAt: self.stringValue(value["published_at"]),
                releaseNotes: self.stringValue(value["body"]),
                releaseURL: self.stringValue(value["html_url"]) ?? self.releasesPageURL.absoluteString,
                downloadURL: downloadURL,
                downloadedPackagePath: nil
            )
            try? self.saveUpdateState(state)
            self.respond(requestId: requestId, ok: true, payload: self.bootstrapPayload())
        }.resume()
    }

    private func handleOpenReleasePage(requestId: String?) {
        let updateState = currentUpdateState()
        let target = updateState.releaseURL.flatMap(URL.init(string:)) ?? releasesPageURL
        NSWorkspace.shared.open(target)
        respond(requestId: requestId, ok: true, payload: bootstrapPayload())
    }

    private func handleDownloadAndInstallUpdate(requestId: String?) {
        let updateState = currentUpdateState()
        guard let downloadURLString = updateState.downloadURL, let downloadURL = URL(string: downloadURLString) else {
            respond(requestId: requestId, ok: false, error: "No installable macOS package was found for the latest release.")
            return
        }

        var request = URLRequest(url: downloadURL)
        request.setValue("maoclaw-desktop/\(currentAppVersion())", forHTTPHeaderField: "User-Agent")

        URLSession.shared.downloadTask(with: request) { [weak self] temporaryURL, _, error in
            guard let self else {
                return
            }
            if let error {
                self.respond(requestId: requestId, ok: false, error: "Update download failed: \(error.localizedDescription)")
                return
            }
            guard let temporaryURL else {
                self.respond(requestId: requestId, ok: false, error: "Update download produced no file.")
                return
            }

            do {
                let downloadsDirectory = self.fileManager.urls(for: .downloadsDirectory, in: .userDomainMask)
                    .first ?? self.appSupportRoot()
                let filename = downloadURL.lastPathComponent.isEmpty ? "maoclaw-update.pkg" : downloadURL.lastPathComponent
                var destination = downloadsDirectory.appendingPathComponent(filename)
                if self.fileManager.fileExists(atPath: destination.path) {
                    let basename = destination.deletingPathExtension().lastPathComponent
                    let ext = destination.pathExtension
                    let uniqueName = ext.isEmpty
                        ? "\(basename)-\(self.timestampToken())"
                        : "\(basename)-\(self.timestampToken()).\(ext)"
                    destination = downloadsDirectory.appendingPathComponent(uniqueName)
                }
                try self.fileManager.moveItem(at: temporaryURL, to: destination)
                NSWorkspace.shared.open(destination)

                let state = DesktopUpdateState(
                    currentVersion: self.currentAppVersion(),
                    latestVersion: updateState.latestVersion,
                    status: "downloaded",
                    message: "Downloaded the latest installer and opened it.",
                    checkedAt: self.nowIsoString(),
                    releaseName: updateState.releaseName,
                    publishedAt: updateState.publishedAt,
                    releaseNotes: updateState.releaseNotes,
                    releaseURL: updateState.releaseURL,
                    downloadURL: updateState.downloadURL,
                    downloadedPackagePath: destination.path
                )
                try self.saveUpdateState(state)
                self.respond(requestId: requestId, ok: true, payload: self.bootstrapPayload())
            } catch {
                self.respond(requestId: requestId, ok: false, error: "Failed to stage the update installer: \(error.localizedDescription)")
            }
        }.resume()
    }

    // MARK: - RPC process

    private func ensureBackend() throws {
        if rpcProcess?.isRunning == true {
            return
        }
        try startBackend()
    }

    private func ensureLocalBridge() throws {
        if localBridgeProcess?.isRunning == true {
            return
        }
        try startLocalBridge()
    }

    private func ensureNativeShell() throws {
        if nativeShellProcess?.isRunning == true {
            return
        }
        try startNativeShell()
    }

    private func restartBackend() {
        stopBackend()
        stopLocalBridge()
        do {
            try startLocalBridge()
            try startBackend()
        } catch {
            appendLog("backend restart failed: \(error.localizedDescription)")
            emit(type: "backend_status", payload: [
                "ready": false,
                "message": error.localizedDescription
            ])
        }
    }

    private func startBackend() throws {
        try ensureDirectories()

        let binaryPath = bundledBinaryPath()
        guard fileManager.isExecutableFile(atPath: binaryPath.path) else {
            throw NSError(domain: "PiDesktop", code: 1, userInfo: [
                NSLocalizedDescriptionKey: "Bundled Pi binary is missing at \(binaryPath.path)"
            ])
        }

        let settings = loadSettings()
        let runtime = loadRuntimeState()
        let workspacePath = runtime.workspacePath ?? NSHomeDirectory()

        let process = Process()
        process.executableURL = binaryPath
        process.arguments = [
            "--mode", "rpc",
            "--no-migrations"
        ]
        process.currentDirectoryURL = URL(fileURLWithPath: workspacePath)

        var env = ProcessInfo.processInfo.environment
        env["PI_CODING_AGENT_DIR"] = agentRoot().path
        env["PI_SESSIONS_DIR"] = sessionsDirectory().path
        if let provider = settings.defaultProvider {
            env["PI_DESKTOP_PROVIDER"] = provider
        }
        if let model = settings.defaultModel {
            env["PI_DESKTOP_MODEL"] = model
        }
        process.environment = env

        let stdinPipe = Pipe()
        let stdoutPipe = Pipe()
        let stderrPipe = Pipe()
        process.standardInput = stdinPipe
        process.standardOutput = stdoutPipe
        process.standardError = stderrPipe

        stdoutPipe.fileHandleForReading.readabilityHandler = { [weak self] handle in
            let data = handle.availableData
            guard !data.isEmpty else { return }
            self?.consumeStdout(data)
        }
        stderrPipe.fileHandleForReading.readabilityHandler = { [weak self] handle in
            let data = handle.availableData
            guard !data.isEmpty else { return }
            self?.consumeStderr(data)
        }

        process.terminationHandler = { [weak self] terminated in
            DispatchQueue.main.async {
                self?.appendLog("backend exited with status \(terminated.terminationStatus)")
                self?.failPendingRPCRequests(
                    "\(self?.productDisplayName ?? "maoclaw") backend exited before completing the request."
                )
                self?.emit(type: "backend_status", payload: [
                    "ready": false,
                    "message": "\(self?.productDisplayName ?? "maoclaw") backend exited (\(terminated.terminationStatus))."
                ])
                self?.rpcProcess = nil
                self?.rpcStdin = nil
            }
        }

        try process.run()
        rpcProcess = process
        rpcStdin = stdinPipe.fileHandleForWriting
        appendLog("backend started in \(workspacePath)")
        emit(type: "backend_status", payload: [
            "ready": true,
            "message": "\(productDisplayName) backend connected.",
            "workspacePath": workspacePath
        ])
        requestBackendSnapshot()
    }

    private func startLocalBridge() throws {
        try ensureDirectories()

        let binaryPath = bundledBinaryPath()
        guard fileManager.isExecutableFile(atPath: binaryPath.path) else {
            throw NSError(domain: "PiDesktop", code: 12, userInfo: [
                NSLocalizedDescriptionKey: "Bundled Pi binary is missing at \(binaryPath.path)"
            ])
        }

        let runtime = loadRuntimeState()
        let workspacePath = runtime.workspacePath ?? NSHomeDirectory()
        let selectedPort = pickLocalBridgePort()
        localBridgePort = selectedPort

        let process = Process()
        process.executableURL = binaryPath
        process.arguments = [
            "--mode", "bridge",
            "--no-migrations"
        ]
        process.currentDirectoryURL = URL(fileURLWithPath: workspacePath)

        var env = ProcessInfo.processInfo.environment
        env["PI_CODING_AGENT_DIR"] = agentRoot().path
        env["PI_SESSIONS_DIR"] = sessionsDirectory().path
        env["PI_BRIDGE_PORT"] = String(selectedPort)
        process.environment = env

        let stdoutPipe = Pipe()
        let stderrPipe = Pipe()
        process.standardOutput = stdoutPipe
        process.standardError = stderrPipe

        stdoutPipe.fileHandleForReading.readabilityHandler = { [weak self] handle in
            let data = handle.availableData
            guard !data.isEmpty else { return }
            self?.consumeBridgeStdout(data)
        }
        stderrPipe.fileHandleForReading.readabilityHandler = { [weak self] handle in
            let data = handle.availableData
            guard !data.isEmpty else { return }
            self?.consumeBridgeStderr(data)
        }

        process.terminationHandler = { [weak self] terminated in
            DispatchQueue.main.async {
                self?.appendLog("local bridge exited with status \(terminated.terminationStatus)")
                self?.localBridgeProcess = nil
            }
        }

        try process.run()
        localBridgeProcess = process
        appendLog("local web bridge started on \(self.localBridgeBaseURLString())")
    }

    private func startNativeShell() throws {
        try ensureDirectories()

        let binaryPath = bundledNativeShellPath()
        guard fileManager.isExecutableFile(atPath: binaryPath.path) else {
            throw NSError(domain: "PiDesktop", code: 15, userInfo: [
                NSLocalizedDescriptionKey: "Bundled native shell is missing at \(binaryPath.path)"
            ])
        }

        let runtime = loadRuntimeState()
        let workspacePath = runtime.workspacePath ?? NSHomeDirectory()

        let process = Process()
        process.executableURL = binaryPath
        process.currentDirectoryURL = URL(fileURLWithPath: workspacePath)

        var env = ProcessInfo.processInfo.environment
        env["PI_CODING_AGENT_DIR"] = agentRoot().path
        env["PI_SESSIONS_DIR"] = sessionsDirectory().path
        process.environment = env

        let stdoutPipe = Pipe()
        let stderrPipe = Pipe()
        process.standardOutput = stdoutPipe
        process.standardError = stderrPipe

        stdoutPipe.fileHandleForReading.readabilityHandler = { [weak self] handle in
            let data = handle.availableData
            guard !data.isEmpty else { return }
            self?.consumeNativeStdout(data)
        }
        stderrPipe.fileHandleForReading.readabilityHandler = { [weak self] handle in
            let data = handle.availableData
            guard !data.isEmpty else { return }
            self?.consumeNativeStderr(data)
        }

        process.terminationHandler = { [weak self] terminated in
            DispatchQueue.main.async {
                self?.appendLog("native shell exited with status \(terminated.terminationStatus)")
                self?.nativeShellProcess = nil
            }
        }

        try process.run()
        nativeShellProcess = process
        appendLog("native control center launched from \(binaryPath.path)")
    }

    private func stopBackend() {
        failPendingRPCRequests("\(productDisplayName) backend stopped before completing the request.")
        terminateProcess(rpcProcess)
        rpcProcess = nil
        rpcStdin = nil
    }

    private func stopLocalBridge() {
        terminateProcess(localBridgeProcess)
        localBridgeProcess = nil
        localBridgePort = defaultLocalBridgePort
    }

    private func activateNativeShellWindow() {
        guard let process = nativeShellProcess else {
            return
        }
        if let app = NSRunningApplication(processIdentifier: process.processIdentifier) {
            if #available(macOS 14.0, *) {
                app.activate(options: [.activateAllWindows])
            } else {
                app.activate(options: [.activateAllWindows, .activateIgnoringOtherApps])
            }
        }
    }

    private func requestBackendSnapshot() {
        guard rpcProcess?.isRunning == true else {
            return
        }
        let requests: [[String: Any]] = [
            [
                "id": UUID().uuidString,
                "type": "get_state"
            ],
            [
                "id": UUID().uuidString,
                "type": "get_session_stats"
            ],
            [
                "id": UUID().uuidString,
                "type": "get_messages"
            ],
            [
                "id": UUID().uuidString,
                "type": "get_available_models"
            ]
        ]

        for request in requests {
            do {
                try sendRPCLine(request)
            } catch {
                appendLog("snapshot request failed: \(error.localizedDescription)")
            }
        }
    }

    private func sendRPCLine(_ value: [String: Any]) throws {
        guard let rpcStdin else {
            throw NSError(domain: "PiDesktop", code: 2, userInfo: [
                NSLocalizedDescriptionKey: "\(productDisplayName) backend is not available."
            ])
        }
        let data = try JSONSerialization.data(withJSONObject: value)
        var line = data
        line.append(0x0A)
        try rpcStdin.write(contentsOf: line)
    }

    private func sendTrackedRPCLine(
        requestId: String?,
        command: String,
        value: [String: Any]
    ) throws {
        let rpcRequestId = UUID().uuidString
        var commandValue = value
        commandValue["id"] = rpcRequestId

        pendingRPCRequestsLock.lock()
        pendingRPCRequests[rpcRequestId] = PendingRPCBridgeRequest(
            requestId: requestId,
            command: command
        )
        pendingRPCRequestsLock.unlock()

        do {
            try sendRPCLine(commandValue)
        } catch {
            pendingRPCRequestsLock.lock()
            pendingRPCRequests.removeValue(forKey: rpcRequestId)
            pendingRPCRequestsLock.unlock()
            throw error
        }

        DispatchQueue.main.asyncAfter(
            deadline: .now() + pendingRPCRequestTimeoutSeconds
        ) { [weak self] in
            guard let self,
                  let pending = self.takePendingRPCRequest(for: rpcRequestId)
            else {
                return
            }

            self.appendLog("backend did not acknowledge \(pending.command) within \(Int(self.pendingRPCRequestTimeoutSeconds))s")
            guard pending.requestId != nil else {
                return
            }
            self.respond(
                requestId: pending.requestId,
                ok: false,
                error: "\(self.productDisplayName) backend did not acknowledge \(pending.command) in time."
            )
        }
    }

    private func takePendingRPCRequest(for rpcRequestId: String) -> PendingRPCBridgeRequest? {
        pendingRPCRequestsLock.lock()
        defer { pendingRPCRequestsLock.unlock() }
        return pendingRPCRequests.removeValue(forKey: rpcRequestId)
    }

    private func failPendingRPCRequests(_ error: String) {
        pendingRPCRequestsLock.lock()
        let pending = Array(pendingRPCRequests.values)
        pendingRPCRequests.removeAll()
        pendingRPCRequestsLock.unlock()

        for request in pending {
            guard request.requestId != nil else {
                continue
            }
            respond(requestId: request.requestId, ok: false, error: error)
        }
    }

    private func completePendingRPCRequest(with response: [String: Any]) {
        guard let rpcRequestId = response["id"] as? String,
              let pending = takePendingRPCRequest(for: rpcRequestId)
        else {
            return
        }

        guard pending.requestId != nil else {
            return
        }

        let success = (response["success"] as? Bool) == true
        if success {
            if let payload = response["data"] as? [String: Any] {
                respond(requestId: pending.requestId, ok: true, payload: payload)
            } else if let payload = response["data"] {
                respond(requestId: pending.requestId, ok: true, payload: ["data": payload])
            } else {
                respond(requestId: pending.requestId, ok: true)
            }
        } else {
            let error = stringValue(response["error"]) ?? "\(pending.command) failed."
            respond(requestId: pending.requestId, ok: false, error: error)
        }
    }

    private func consumeStdout(_ data: Data) {
        rpcStdoutBuffer.append(data)
        flush(buffer: &rpcStdoutBuffer, kind: "rpc")
    }

    private func consumeStderr(_ data: Data) {
        rpcStderrBuffer.append(data)
        flush(buffer: &rpcStderrBuffer, kind: "stderr")
    }

    private func consumeBridgeStdout(_ data: Data) {
        bridgeStdoutBuffer.append(data)
        flushBridge(buffer: &bridgeStdoutBuffer, stream: "stdout")
    }

    private func consumeBridgeStderr(_ data: Data) {
        bridgeStderrBuffer.append(data)
        flushBridge(buffer: &bridgeStderrBuffer, stream: "stderr")
    }

    private func consumeNativeStdout(_ data: Data) {
        nativeStdoutBuffer.append(data)
        flushNative(buffer: &nativeStdoutBuffer, stream: "stdout")
    }

    private func consumeNativeStderr(_ data: Data) {
        nativeStderrBuffer.append(data)
        flushNative(buffer: &nativeStderrBuffer, stream: "stderr")
    }

    private func flush(buffer: inout Data, kind: String) {
        while let newline = buffer.firstIndex(of: 0x0A) {
            let lineData = buffer.prefix(upTo: newline)
            buffer.removeSubrange(...newline)
            guard let line = String(data: lineData, encoding: .utf8), !line.isEmpty else {
                continue
            }
            if kind == "stderr" {
                appendLog("backend[stderr]: \(line)")
                emit(type: "backend_log", payload: ["line": line])
                continue
            }
            handleRPCLine(line)
        }
    }

    private func handleRPCLine(_ line: String) {
        guard
            let data = line.data(using: .utf8),
            let value = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
        else {
            appendLog("backend[out]: \(line)")
            emit(type: "backend_log", payload: ["line": line])
            return
        }

        let type = value["type"] as? String ?? ""
        switch type {
        case "response":
            cacheResponseState(value)
            completePendingRPCRequest(with: value)
            emit(type: "rpc_response", payload: value)
        case "agent_end":
            emit(type: "rpc_event", payload: value)
            requestBackendSnapshot()
        default:
            emit(type: "rpc_event", payload: value)
        }
    }

    private func flushBridge(buffer: inout Data, stream: String) {
        while let newline = buffer.firstIndex(of: 0x0A) {
            let lineData = buffer.prefix(upTo: newline)
            buffer.removeSubrange(...newline)
            guard let line = String(data: lineData, encoding: .utf8), !line.isEmpty else {
                continue
            }
            appendLog("bridge[\(stream)]: \(line)")
        }
    }

    private func flushNative(buffer: inout Data, stream: String) {
        while let newline = buffer.firstIndex(of: 0x0A) {
            let lineData = buffer.prefix(upTo: newline)
            buffer.removeSubrange(...newline)
            guard let line = String(data: lineData, encoding: .utf8), !line.isEmpty else {
                continue
            }
            appendLog("native[\(stream)]: \(line)")
        }
    }

    private func cacheResponseState(_ value: [String: Any]) {
        guard let command = value["command"] as? String else {
            return
        }

        if let data = value["data"] as? [String: Any] {
            switch command {
            case "get_state", "prompt":
                if let sessionFile = data["sessionFile"] as? String,
                   !sessionFile.isEmpty
                {
                    currentSessionPath = sessionFile
                }
                if command == "get_state" || command == "prompt" {
                    emit(type: "desktop_catalog", payload: bootstrapPayload())
                }
            default:
                break
            }
        }

        if let success = value["success"] as? Bool, success {
            switch command {
            case "prompt", "new_session", "switch_session", "set_model", "set_session_name", "set_goal_contract", "update_goal_run", "update_goal_criterion", "clear_goal_contract":
                requestBackendSnapshot()
                emit(type: "desktop_catalog", payload: bootstrapPayload())
            case "export_html":
                emit(type: "desktop_export", payload: (value["data"] as? [String: Any]) ?? [:])
            default:
                break
            }
        }
    }

    // MARK: - JS bridge

    private func respond(requestId: String?, ok: Bool, payload: [String: Any] = [:], error: String? = nil) {
        var value: [String: Any] = [
            "kind": "response",
            "requestId": requestId ?? "",
            "ok": ok
        ]
        if !payload.isEmpty {
            value["payload"] = payload
        }
        if let error {
            value["error"] = error
        }
        dispatchToWeb(value)
    }

    private func emit(type: String, payload: [String: Any]) {
        dispatchToWeb([
            "kind": "event",
            "event": type,
            "payload": payload
        ])
    }

    private func dispatchToWeb(_ value: [String: Any]) {
        guard let webView else {
            return
        }
        guard
            let data = try? JSONSerialization.data(withJSONObject: value),
            let json = String(data: data, encoding: .utf8)
        else {
            return
        }
        DispatchQueue.main.async {
            webView.evaluateJavaScript("window.PiDesktop && window.PiDesktop.receive(\(json));") { [weak self] _, error in
                if let error {
                    self?.appendLog("bridge dispatch failed: \(error.localizedDescription)")
                }
            }
        }
    }

    // MARK: - Desktop catalog

    private func importCandidate() -> DesktopImportCandidate {
        let settingsExists = fileManager.fileExists(atPath: legacySettingsPath().path)
        let authExists = fileManager.fileExists(atPath: legacyAuthPath().path)
        let available = settingsExists || authExists
        return DesktopImportCandidate(
            available: available,
            sourceRoot: available ? legacyAgentRoot().path : nil,
            settingsPath: settingsExists ? legacySettingsPath().path : nil,
            authPath: authExists ? legacyAuthPath().path : nil
        )
    }

    private func buildSessionSummaries(
        runtime: DesktopRuntimeState? = nil,
        defaultAgentId: String? = nil
    ) -> [DesktopSessionSummary] {
        guard let enumerator = fileManager.enumerator(
            at: sessionsDirectory(),
            includingPropertiesForKeys: [.contentModificationDateKey, .fileSizeKey],
            options: [.skipsHiddenFiles]
        ) else {
            return []
        }

        let runtime = runtime ?? loadRuntimeState()
        let currentCanonical = canonicalPath(currentSessionPath)
        let fallbackAgentId = defaultAgentId ?? loadSettings().starterAgent ?? "main"
        let formatter = ISO8601DateFormatter()
        var sessions: [DesktopSessionSummary] = []

        for case let url as URL in enumerator {
            let filename = url.lastPathComponent
            let ext = url.pathExtension.lowercased()
            guard ["jsonl", "sqlite"].contains(ext), !filename.hasPrefix("session-index") else {
                continue
            }

            let values = try? url.resourceValues(forKeys: [.contentModificationDateKey, .fileSizeKey])
            let modifiedAt = values?.contentModificationDate ?? .distantPast
            let sizeBytes = UInt64(values?.fileSize ?? 0)
            let canonical = canonicalPath(url.path)
            let digest = sessionDigest(for: url)

            sessions.append(
                DesktopSessionSummary(
                    path: url.path,
                    name: url.deletingPathExtension().lastPathComponent,
                    modifiedAt: formatter.string(from: modifiedAt),
                    sizeBytes: sizeBytes,
                    isCurrent: currentCanonical != nil && canonical == currentCanonical,
                    messageCount: digest.messageCount,
                    lastRole: digest.lastRole,
                    preview: digest.preview,
                    agentId: resolvedSessionAgentId(for: canonical ?? url.path, runtime: runtime, fallback: fallbackAgentId),
                    hasGoalContract: digest.hasGoalContract,
                    goalRunStatus: digest.goalRunStatus
                )
            )
        }

        return sessions.sorted { lhs, rhs in
            if lhs.isCurrent != rhs.isCurrent {
                return lhs.isCurrent && !rhs.isCurrent
            }
            return lhs.modifiedAt > rhs.modifiedAt
        }
    }

    private func sessionDigest(
        for url: URL
    ) -> (
        messageCount: Int,
        lastRole: String?,
        preview: String?,
        hasGoalContract: Bool,
        goalRunStatus: String?
    ) {
        guard url.pathExtension.lowercased() == "jsonl" else {
            return (0, nil, nil, false, nil)
        }
        guard let raw = try? String(contentsOf: url, encoding: .utf8), !raw.isEmpty else {
            return (0, nil, nil, false, nil)
        }

        var count = 0
        var lastRole: String?
        var preview: String?
        var hasGoalContract = false
        var goalRunStatus: String?

        for line in raw.split(whereSeparator: \.isNewline) {
            guard
                let data = line.data(using: .utf8),
                let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
            else {
                continue
            }

            switch stringValue(object["type"])?.lowercased() {
            case "message":
                guard
                    let message = object["message"] as? [String: Any],
                    let role = stringValue(message["role"])
                else {
                    continue
                }
                count += 1
                let nextPreview = previewText(fromSessionMessage: message)
                if !nextPreview.isEmpty {
                    lastRole = role
                    preview = nextPreview
                } else if lastRole == nil {
                    lastRole = role
                }
            case "custom":
                let customType = stringValue(object["customType"]) ?? stringValue(object["custom_type"])
                switch customType {
                case "pi.goal.contract.v1":
                    hasGoalContract = true
                case "pi.goal.contract.cleared.v1":
                    hasGoalContract = false
                case "pi.goal.run.v1":
                    if
                        let goalRun = object["data"] as? [String: Any],
                        let status = stringValue(goalRun["status"])?.lowercased(),
                        !status.isEmpty
                    {
                        goalRunStatus = status
                    }
                case "pi.goal.run.cleared.v1":
                    goalRunStatus = nil
                default:
                    break
                }
            default:
                break
            }
        }

        return (count, lastRole, preview, hasGoalContract, goalRunStatus)
    }

    private func previewText(fromSessionMessage message: [String: Any]) -> String {
        if let role = stringValue(message["role"])?.lowercased() {
            switch role {
            case "bashexecution":
                let command = stringValue(message["command"]) ?? ""
                let output = stringValue(message["output"]) ?? ""
                return trimmedPreview("$ \(command)\n\(output)")
            case "custom":
                return trimmedPreview(stringValue(message["content"]) ?? "")
            default:
                break
            }
        }

        if let content = message["content"] {
            let flattened = flattenPreviewContent(content)
            if !flattened.isEmpty {
                return trimmedPreview(flattened)
            }
        }

        if let nested = message["message"] as? [String: Any], let content = nested["content"] {
            let flattened = flattenPreviewContent(content)
            if !flattened.isEmpty {
                return trimmedPreview(flattened)
            }
        }

        if let input = stringValue(message["input"]), !input.isEmpty {
            return trimmedPreview(input)
        }

        if let summary = stringValue(message["summary"]), !summary.isEmpty {
            return trimmedPreview(summary)
        }

        return ""
    }

    private func flattenPreviewContent(_ value: Any) -> String {
        if let text = value as? String {
            return text
        }
        if let array = value as? [Any] {
            return array
                .map { flattenPreviewContent($0) }
                .filter { !$0.isEmpty }
                .joined(separator: "\n")
        }
        if let dict = value as? [String: Any] {
            if let text = stringValue(dict["text"]), !text.isEmpty {
                return text
            }
            if let content = dict["content"] {
                let flattened = flattenPreviewContent(content)
                if !flattened.isEmpty {
                    return flattened
                }
            }
            if let input = stringValue(dict["input"]), !input.isEmpty {
                return input
            }
            if let name = stringValue(dict["name"]), !name.isEmpty {
                return "[\(name)]"
            }
            if let kind = stringValue(dict["type"]), !kind.isEmpty {
                return "[\(kind)]"
            }
        }
        return ""
    }

    private func trimmedPreview(_ value: String, limit: Int = 140) -> String {
        let collapsed = value
            .replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)
        guard !collapsed.isEmpty else {
            return ""
        }
        if collapsed.count <= limit {
            return collapsed
        }
        let index = collapsed.index(collapsed.startIndex, offsetBy: limit)
        return String(collapsed[..<index]).trimmingCharacters(in: .whitespacesAndNewlines) + "…"
    }

    private func canonicalPath(_ path: String?) -> String? {
        guard let path, !path.isEmpty else {
            return nil
        }
        return URL(fileURLWithPath: path).resolvingSymlinksInPath().standardizedFileURL.path
    }

    private func normalizedSessionAgents(from runtime: DesktopRuntimeState? = nil) -> [String: String] {
        let raw = (runtime ?? loadRuntimeState()).sessionAgents ?? [:]
        var normalized: [String: String] = [:]
        for (path, agentId) in raw {
            guard let canonical = canonicalPath(path), !agentId.isEmpty else {
                continue
            }
            normalized[canonical] = agentId
        }
        return normalized
    }

    private func resolvedSessionAgentId(
        for sessionPath: String?,
        runtime: DesktopRuntimeState? = nil,
        fallback: String
    ) -> String {
        guard let canonical = canonicalPath(sessionPath) else {
            return fallback
        }
        return normalizedSessionAgents(from: runtime)[canonical] ?? fallback
    }

    private func terminateProcess(_ process: Process?) {
        guard let process, process.isRunning else {
            return
        }
        process.terminate()
        for _ in 0..<20 {
            if !process.isRunning {
                return
            }
            usleep(50_000)
        }
        _ = kill(process.processIdentifier, SIGKILL)
    }

    private func runProcessCaptureOutput(launchPath: String, arguments: [String]) throws -> String {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: launchPath)
        process.arguments = arguments
        let outputPipe = Pipe()
        process.standardOutput = outputPipe
        process.standardError = Pipe()
        try process.run()
        process.waitUntilExit()
        guard process.terminationStatus == 0 else {
            return ""
        }
        let data = outputPipe.fileHandleForReading.readDataToEndOfFile()
        return String(data: data, encoding: .utf8) ?? ""
    }

    private func appendLog(_ message: String) {
        let timestamped = "[\(timestampToken())] \(message)"
        recentLogs.append(timestamped)
        if recentLogs.count > 200 {
            recentLogs.removeFirst(recentLogs.count - 200)
        }
        fputs("\(timestamped)\n", stderr)
        do {
            try ensureDirectories()
            let line = "\(timestamped)\n"
            if let data = line.data(using: .utf8) {
                if fileManager.fileExists(atPath: desktopLogPath().path) {
                    let handle = try FileHandle(forWritingTo: desktopLogPath())
                    defer { try? handle.close() }
                    try handle.seekToEnd()
                    try handle.write(contentsOf: data)
                } else {
                    try data.write(to: desktopLogPath(), options: .atomic)
                }
            }
        } catch {
            fputs("[PiDesktopBridge] failed to persist log: \(error.localizedDescription)\n", stderr)
        }
    }

    private func writeDiagnosticsReport(to url: URL, includeSupportSnapshot: Bool) throws {
        try ensureDirectories()
        var report: [String: Any] = [
            "generatedAt": nowIsoString(),
            "product": productDisplayName,
            "workspacePath": loadRuntimeState().workspacePath ?? NSHomeDirectory(),
            "configPath": settingsPath().path,
            "projectConfigPath": projectSettingsPath().path,
            "permissionsPath": permissionsPath().path,
            "desktopLogPath": desktopLogPath().path,
            "securityState": buildSecurityPayload(),
            "systemPermissions": buildSystemPermissionsPayload(),
            "diagnostics": buildDiagnosticsPayload()
        ]

        if includeSupportSnapshot {
            report["providerConfig"] = dictionary(from: currentProviderConfig(from: loadSettings()))
            report["updateState"] = dictionary(from: currentUpdateState())
            report["sessionSummaries"] = buildSessionSummaries().map { dictionary(from: $0) }
        }

        try saveJSONObject(report, to: url)
    }

    private func copyWithBackupIfNeeded(from source: URL, to target: URL) throws {
        guard fileManager.fileExists(atPath: source.path) else {
            return
        }
        if fileManager.fileExists(atPath: target.path) {
            let backup = target
                .deletingLastPathComponent()
                .appendingPathComponent("\(target.lastPathComponent).backup.\(timestampToken())")
            try fileManager.moveItem(at: target, to: backup)
        }
        try fileManager.copyItem(at: source, to: target)
    }

    private func timestampToken() -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyyMMddHHmmss"
        formatter.locale = Locale(identifier: "en_US_POSIX")
        return formatter.string(from: Date())
    }

    private func requestAutomationPermission() -> Bool {
        let script = NSAppleScript(source: #"tell application "System Events" to count processes"#)
        var error: NSDictionary?
        _ = script?.executeAndReturnError(&error)
        if let error {
            appendLog("automation permission check: \(error)")
            return false
        }
        return true
    }

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        guard let requestId = pendingLocationPermissionRequestId else {
            return
        }
        pendingLocationPermissionRequestId = nil
        locationManager = nil
        respond(requestId: requestId, ok: true, payload: bootstrapPayload())
    }
}

private extension String {
    var nonEmpty: String? {
        isEmpty ? nil : self
    }
}
