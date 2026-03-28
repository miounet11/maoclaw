import Foundation

struct DesktopCredential: Codable {
    let type: String
    let key: String

    init(key: String) {
        self.type = "api_key"
        self.key = key
    }
}

struct DesktopSettings: Codable {
    var defaultProvider: String?
    var defaultModel: String?
    var providerPreset: String?
    var defaultProviderName: String?
    var defaultApiBaseURL: String?
    var defaultApiProtocol: String?
    var starterAgent: String?
    var uiLanguage: String?
    var uiMode: String?
    var checkForUpdates: Bool?
    var onboarding: DesktopOnboardingState?
    var hostSettings: DesktopHostSettings?
}

struct DesktopHostSettings: Codable {
    var preferredSurface: String?
    var webWorkspaceURL: String?
    var closeBehavior: String?
    var menuBarEnabled: Bool?
}

struct DesktopOnboardingState: Codable {
    var completed: Bool?
    var version: Int?
    var chosenProvider: String?
    var chosenModel: String?
    var chosenApiBaseURL: String?
    var chosenApiProtocol: String?
    var chosenAgentProfile: String?
    var chosenLanguage: String?
    var chosenMode: String?
}

struct DesktopRuntimeState: Codable {
    var workspacePath: String?
    var sessionAgents: [String: String]?
    var updateState: DesktopUpdateState?
}

struct DesktopAgentSummary: Codable {
    let id: String
    let displayName: String
    let description: String
    let modeId: String
    let modeLabel: String
    let provider: String?
    let model: String?
    let skills: [String]
    let builtinSkills: [String]
    let prompts: [String]
    let skillScope: String
    let hasCustomizations: Bool
}

struct DesktopBindingSummary: Codable {
    let id: String
    let name: String
    let status: String
    let health: String
    let linkedAgent: String
    let authState: String
    let lastMessage: String?
    let note: String
}

struct DesktopSessionSummary: Codable {
    let path: String
    let name: String
    let modifiedAt: String
    let sizeBytes: UInt64
    let isCurrent: Bool
    let messageCount: Int
    let lastRole: String?
    let preview: String?
    let agentId: String?
    let hasGoalContract: Bool
    let goalRunStatus: String?
}

struct DesktopImportCandidate: Codable {
    let available: Bool
    let sourceRoot: String?
    let settingsPath: String?
    let authPath: String?
}

struct DesktopProviderPreset: Codable {
    let id: String
    let runtimeProviderId: String
    let label: String
    let description: String
    let apiProtocol: String
    let apiBaseURL: String
    let defaultModels: [String]
    let supportsDirectApiKey: Bool
    let supportsCustomBaseURL: Bool
}

struct DesktopProviderConfig: Codable {
    let presetId: String
    let providerId: String
    let providerLabel: String
    let model: String?
    let apiProtocol: String
    let apiBaseURL: String
    let usesCustomConfiguration: Bool
    let hasSavedCredential: Bool
    let credentialProviders: [String]
    let checkForUpdates: Bool
    let modelsPath: String
}

struct DesktopUpdateState: Codable {
    let currentVersion: String
    let latestVersion: String?
    let status: String
    let message: String?
    let checkedAt: String?
    let releaseName: String?
    let publishedAt: String?
    let releaseNotes: String?
    let releaseURL: String?
    let downloadURL: String?
    let downloadedPackagePath: String?
}

struct BootstrapPayload: Codable {
    let productName: String
    let configured: Bool
    let provider: String?
    let model: String?
    let starterAgent: String?
    let uiLanguage: String
    let uiMode: String
    let activeSessionAgent: String?
    let currentSessionPath: String?
    let workspacePath: String
    let appSupportPath: String
    let configPath: String
    let authPath: String
    let modelsPath: String
    let sessionPath: String
    let bundledBinaryPath: String
    let recommendedModels: [String: [String]]
    let providerPresets: [DesktopProviderPreset]
    let providerConfig: DesktopProviderConfig
    let updateState: DesktopUpdateState
    let agents: [DesktopAgentSummary]
    let bindings: [DesktopBindingSummary]
    let sessions: [DesktopSessionSummary]
    let importCandidate: DesktopImportCandidate
    let logs: [String]
}

struct RpcEnvelope: Codable {
    let action: String
    let requestId: String?
    let payload: [String: String]?
}
