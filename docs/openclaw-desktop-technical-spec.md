# OpenClaw Desktop Technical Spec

Status: Proposed  
Audience: Claude Code implementation agent, Rust engineers  
Companion: [openclaw-desktop-product-spec.md](openclaw-desktop-product-spec.md)

## 1. Goal

This document translates the product spec into implementable Rust architecture inside `maoclaw`.

It defines:
- module boundaries
- config/schema changes
- onboarding state machine
- starter-agent preset model
- conversation-entry binding abstraction
- local service/runtime plan
- coexistence rules with existing OpenClaw installations

## 2. Non-Goals For MVP

Do not build these in MVP:
- full separate GUI shell
- full Feishu conversational bot support
- shared runtime state with existing OpenClaw
- cloud sync
- remote multi-device coordination
- live config migration from arbitrary third-party OpenClaw installs

## 3. Target Architecture

### High-level structure

```text
CLI / TUI Entry
  -> App bootstrap
  -> Config load
  -> Onboarding decision
  -> Chat shell
  -> Optional binding manager / local service

Core layers
  -> Agent profiles
  -> Provider/model resolution
  -> Session management
  -> Resource/skills loader
  -> Binding adapter layer
```

### New internal domains

Add these domains:

- `onboarding`
- `agent_profiles`
- `bindings`
- `desktop_state`

These should be internal modules under `src/`, not separate crates for MVP.

## 4. File Layout

Recommended additions:

```text
src/
  onboarding.rs
  onboarding/
    state.rs
    steps.rs
    persist.rs
    view.rs
  agent_profiles.rs
  bindings.rs
  bindings/
    mod.rs
    types.rs
    manager.rs
    telegram.rs
    qq.rs
    feishu.rs
    health.rs
  desktop_state.rs
```

Recommended existing touch points:

- `src/config.rs`
- `src/main.rs`
- `src/interactive.rs`
- `src/interactive/state.rs`
- `src/interactive/view.rs`
- `src/interactive/commands.rs`
- `src/resources.rs`

## 5. Config Schema Changes

### Extend `Config`

Add fields to `src/config.rs`:

```rust
pub onboarding: Option<OnboardingConfig>,
pub starter_agent: Option<String>,
pub agent_profiles: Option<HashMap<String, AgentProfileConfig>>,
pub bindings: Option<Vec<BindingConfig>>,
```

### New config structs

```rust
pub struct OnboardingConfig {
    pub completed: Option<bool>,
    pub version: Option<u32>,
}

pub struct AgentProfileConfig {
    pub display_name: Option<String>,
    pub description: Option<String>,
    pub mode: Option<String>, // follow_main | override
    pub provider: Option<String>,
    pub model: Option<String>,
    pub skills: Option<Vec<String>>,
    pub prompts: Option<Vec<String>>,
    pub bindings: Option<Vec<String>>,
}

pub struct BindingConfig {
    pub id: String,
    pub platform: String,
    pub enabled: Option<bool>,
    pub agent_profile: Option<String>,
    pub config: Option<serde_json::Value>,
}
```

### Rules

- All new structs must support serde aliases only where necessary.
- Merge behavior should remain field-wise consistent with existing config behavior.
- `bindings` should replace at the current scope, not deep-merge per element.

## 6. Onboarding State Machine

### Entry condition

On first app startup:

- if `config.onboarding.completed == true`, skip onboarding
- otherwise enter onboarding flow

### State enum

```rust
pub enum OnboardingStep {
    Intro,
    ProviderSetup,
    AgentPreset,
    OptionalBinding,
    Complete,
}
```

### Working state

```rust
pub struct OnboardingState {
    pub step: OnboardingStep,
    pub selected_provider: Option<String>,
    pub auth_mode: Option<AuthMode>,
    pub api_key_input: String,
    pub selected_model: Option<String>,
    pub selected_agent_preset: Option<String>,
    pub selected_binding_platform: Option<String>,
    pub validation_error: Option<String>,
    pub is_submitting: bool,
}
```

### Rules

- Back navigation preserves prior inputs.
- Provider setup can be prefilled from detected credentials.
- Completion writes config atomically.
- Completion transfers directly into normal chat state.

## 7. Provider Setup Logic

### Detection order

When entering provider setup:

1. explicit config default provider/model
2. existing auth storage credentials
3. environment variables
4. recommended default provider fallback

### Required helper

Introduce a helper in `src/app.rs` or `src/onboarding.rs`:

```rust
pub struct ReadyProviderCandidate {
    pub provider: String,
    pub default_model: Option<String>,
    pub auth_kind: ReadyAuthKind,
    pub source: ReadySource,
}
```

This is used to:
- prefill onboarding
- display “ready” provider badges
- avoid asking the user for unnecessary setup

## 8. Starter Agent Presets

### Runtime shape

Define a runtime profile model in `src/agent_profiles.rs`:

```rust
pub enum AgentProfileMode {
    FollowMain,
    Override,
}

pub struct AgentProfile {
    pub id: String,
    pub display_name: String,
    pub description: String,
    pub mode: AgentProfileMode,
    pub provider: Option<String>,
    pub model: Option<String>,
    pub skills: Vec<String>,
    pub prompts: Vec<String>,
}
```

### Required built-ins

Ship these built-ins:
- `main`
- `architect`
- `implementer`
- `debugger`
- `operator`

### Resolution

When a profile is activated:

- `FollowMain` -> use `Config.default_provider/default_model`
- `Override` -> use profile provider/model

### Failure behavior

If an override profile references unavailable credentials:
- do not crash
- surface inline warning
- offer fallback to main profile

## 9. Binding Abstraction

### Core trait

Create a trait in `src/bindings/types.rs`:

```rust
#[async_trait]
pub trait ConversationEntryProvider: Send + Sync {
    fn platform(&self) -> &'static str;
    async fn validate_config(&self, binding: &BindingConfig) -> anyhow::Result<BindingValidation>;
    async fn health_check(&self, binding: &BindingConfig) -> anyhow::Result<BindingHealth>;
    async fn start(&self, ctx: BindingRuntimeContext) -> anyhow::Result<BindingHandle>;
}
```

### Supporting types

```rust
pub struct BindingValidation {
    pub ok: bool,
    pub message: Option<String>,
}

pub struct BindingHealth {
    pub ok: bool,
    pub status: String,
    pub last_error: Option<String>,
}

pub struct BindingEnvelope {
    pub binding_id: String,
    pub platform: String,
    pub chat_id: String,
    pub sender_id: String,
    pub sender_name: Option<String>,
    pub message_text: Option<String>,
    pub raw: serde_json::Value,
}
```

### Binding runtime manager

`src/bindings/manager.rs` owns:
- loading enabled bindings
- starting provider runtimes
- receiving normalized envelopes
- routing envelopes to agent profiles
- sending replies back through platform-specific handles

## 10. MVP Binding Rollout

### Telegram

First full adapter.

Support:
- polling-based receive loop
- send text replies
- one bot token + optional chat restriction

Avoid webhook in MVP.

### QQ

Second adapter.

Support:
- config persistence
- health model
- adapter scaffolding

If full runtime is too large for first implementation wave, land:
- config
- validation
- placeholder manager integration

### Feishu

Two adapters conceptually:
- `feishu_push`
- `feishu_chat`

For MVP implement:
- `feishu_push` shape only
- health/validation scaffolding

Do not mix custom-bot push behavior with app-bot conversational semantics in one adapter type.

## 11. Integration Runtime Model

### Local service

Conversation-entry bindings should not run inside fragile UI-only state.

Use one of these models:

1. Embedded background runtime in the app process for MVP
2. Extractable local service later

Recommendation:
- MVP: embedded runtime manager
- Future: promote to local companion service

### Runtime ownership

The binding manager should be owned above the interactive chat shell, not inside a single session overlay.

## 12. TUI Integration

### New app state

Extend `PiApp` with:

```rust
onboarding: Option<OnboardingUiState>,
active_agent_profile: String,
binding_status: Vec<BindingStatusView>,
```

### UI priority

When onboarding is active:
- it owns input
- normal conversation editor is hidden or visually disabled

### Post-onboarding

After onboarding completion:
- switch into normal chat shell
- preload selected starter profile
- render a lightweight success banner

## 13. Persistence

### Atomic writes

Use existing atomic settings write path in `src/config.rs`.

### Persistence moments

Persist on:
- onboarding completion
- explicit agent profile change
- binding create/update/remove

Do not persist partial onboarding state every keystroke in MVP.

## 14. Coexistence Rules

### Storage isolation

Do not reuse existing OpenClaw roots.

Introduce explicit desktop roots if needed:
- config namespace
- session namespace
- binding runtime files

### Port isolation

If any local service/dashboard is added:
- choose a dedicated port range
- never assume OpenClaw defaults are free

### Token isolation

Bindings must be treated as product-owned connections.

Do not auto-import:
- Telegram bot tokens
- QQ bot credentials
- Feishu app secrets

unless the user explicitly performs import.

## 15. Secrets Handling

### MVP

Accept config-stored secrets only if consistent with current auth model.

Preferred direction:
- reuse existing auth storage patterns where possible
- keep raw secrets out of session artifacts

### Logging rule

Never log:
- API keys
- bot tokens
- app secrets
- webhook secrets

Health and validation messages must redact secrets by default.

## 16. Suggested Command Surface

Add later, not before onboarding:

- `/agents`
- `/agent <name>`
- `/bindings`
- `/bind telegram`
- `/bind qq`
- `/bind feishu`

Do not require these commands for first-run success.

## 17. Implementation Plan

### Milestone 1: Foundations

- add config structs
- add onboarding state model
- add built-in agent profile registry
- add TUI onboarding shell

### Milestone 2: Product onboarding

- intro step
- provider setup step
- model dropdown filtering
- preset agent step
- completion persistence

### Milestone 3: Binding scaffolding

- binding trait
- manager
- config parsing
- binding status view

### Milestone 4: Telegram

- validation
- health check
- polling runtime
- reply path

### Milestone 5: QQ / Feishu

- QQ config and adapter skeleton
- Feishu push adapter skeleton
- UI for optional bind step

## 18. Testing Requirements

### Unit tests

Add tests for:
- onboarding state transitions
- config serde + merge behavior
- profile resolution
- provider prefill logic
- binding config validation

### UI tests

Add targeted tests for:
- onboarding visibility when incomplete
- selected provider/model persistence
- starter profile activation

### Integration tests

Later:
- Telegram adapter with mocked HTTP
- binding manager routing
- agent-profile-to-binding dispatch

## 19. Code Review Constraints

Implementation agent must avoid:
- introducing a second disconnected config file format
- hardcoding UI strings in scattered modules
- mixing provider setup logic directly into rendering code
- directly coupling binding adapters to specific agent implementations
- forcing users through binding before local chat

## 20. First Build Target

The first acceptable implementation is:

- TUI onboarding exists
- provider/model choice persists
- starter agent preset persists and activates
- onboarding completion prevents repeat display
- app enters normal chat after onboarding
- binding architecture exists as scaffolding even if only Telegram is operational later
