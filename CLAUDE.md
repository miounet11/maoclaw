# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Dev Commands

```bash
# Check for errors (fast)
cargo check --all-targets

# Lints (pedantic + nursery are enabled; must pass -D warnings)
cargo clippy --all-targets -- -D warnings

# Format
cargo fmt
cargo fmt --check   # verify only

# Run all tests
cargo test

# Run specific test module
cargo test sse::tests
cargo test tools::tests
cargo test conformance

# Run a single test by name
cargo test <test_name>

# Build release
cargo build --release

# Benchmarks
cargo bench --bench tools
cargo bench --bench tui_perf
```

Toolchain: **nightly** (see `rust-toolchain.toml`). Edition 2024, `rust-version = "1.85"`. Never switch to stable.

Library crate name is `pi`: `use pi::sdk::*` for external consumers.

For large multi-agent builds, redirect artifacts to avoid disk pressure:
```bash
export CARGO_TARGET_DIR="/data/tmp/maoclaw/${USER:-agent}"
export TMPDIR="/data/tmp/maoclaw/${USER:-agent}/tmp"
mkdir -p "$TMPDIR"
```

Run `ubs --staged --only=rust .` before every commit. Exit 0 = safe.

## Critical Runtime Gotchas

- **Async runtime is `asupersync`, NOT tokio.** Use `asupersync::runtime::RuntimeBuilder::new().build().unwrap().block_on(...)`. Do not pull in tokio.
- **TUI framework is `charmed_rust`** (bubbletea/lipgloss/bubbles/glamour ports). `KeyType` variant is `KeyType::Runes` (not `Rune`), field is `key.runes: Vec<char>`.
- **HTTP client**: `crate::http::client::Client`. Pattern: `.get(url).send().await?.text().await` — `.text()` is on `Response`, not `RequestBuilder`.
- **ID generation**: Always use nanos + `AtomicU64` counter, never millis alone (collision risk under concurrency).

## Architecture

```
CLI (clap) → app/config/resources → Agent loop
                                         ↓
                          Provider trait (Anthropic / OpenAI / OpenAI-Responses /
                           Gemini / Cohere / Azure / Bedrock / Vertex / Copilot / GitLab /
                           extension-registered)
                                         ↓
                    Tool registry (7 built-ins + extension tools)
                    ↕
                    Extension runtime (QuickJS via rquickjs + capability policy)
                                         ↓
               Surfaces: Interactive TUI  |  RPC/stdin server mode
                                         ↓
                   Session persistence (JSONL v3, optional SQLite backend)
```

### Key source files

| File | Role |
|------|------|
| `src/agent.rs` | Core orchestration loop: build context → stream provider → execute tools → repeat |
| `src/provider.rs` | `Provider` trait + `Context`/`StreamOptions`/`ToolDef` shared types |
| `src/providers/` | One file per backend (10 providers). `mod.rs` has `ProviderRouteKind` enum (29 variants) and extension stream-simple bridge |
| `src/tools.rs` | 7 built-in tools: `read`, `write`, `edit`, `bash`, `grep`, `find`, `ls` |
| `src/model.rs` | `Message` / `ContentBlock` / `StreamEvent` — the shared wire format |
| `src/interactive.rs` | Elm-architecture TUI entry point. Submodules in `src/interactive/`: `state.rs`, `view.rs`, `commands.rs`, `agent.rs`, `conversation.rs`, `file_refs.rs`, `perf.rs`, `tree.rs`, `keybindings.rs`, `tool_render.rs` |
| `src/extensions.rs` | Extension protocol, capability policy, QuickJS runtime bridge |
| `src/session.rs` | JSONL session persistence (tree structure, branching, version 3) |
| `src/config.rs` | `Config` struct loaded from `~/.pi/config.json` |
| `src/sdk.rs` | Stable library-facing API surface — prefer `pi::sdk::*` for external consumers |
| `src/rpc.rs` | RPC/stdin server mode |
| `src/sse.rs` | SSE parser for streaming responses |
| `src/auth.rs` | OAuth, API key, device flow authentication |
| `src/models.rs` | Built-in + `models.json` registry resolution |
| `src/resources.rs` | Skills/prompt/theme/extension resource loading |
| `src/package_manager.rs` | Extension/skill/prompt package management |

### OpenClaw V2 domain layer

| File | Role |
|------|------|
| `src/system_profile.rs` | `SystemProfile`, `TeamBlueprint`, `AgentRole`, `RoutingPolicy`, `PermissionPolicy` |
| `src/templates.rs` | 8 built-in system templates + `instantiate()` factory |
| `src/vault.rs` | `VaultSnapshot` (6 kinds), `VaultBranch`, file-backed under `.pi/vault/` |
| `src/artifacts.rs` | `Artifact`, `Deliverable`, `NextStep`, file-backed under `.pi/artifacts/` |
| `src/memory_v2.rs` | 7-partition JSONL memory store + `extract_memory_candidates()` heuristic |
| `src/automations.rs` | `AutomationRegistry` + `AutomationScheduler::tick()`/`tick_all()` |
| `src/bridge.rs` | `BridgeState`, pairing challenge flow |
| `src/cloud.rs` | `CloudHostRegistry` |
| `src/onboarding.rs` | Onboarding wizard state machine |
| `src/agent_profiles.rs` | Builtin agent presets, `AgentProfileRegistry` |
| `src/bindings/` | Multi-channel adapters: `telegram.rs`, `qq.rs`, `feishu.rs`, `http.rs` + `BindingManager`/`BindingRouter` |

### Data flow for a single turn

1. `interactive.rs` (or `rpc.rs`) receives user input → sends to `Agent`.
2. `Agent` builds a `Context` (system prompt + session history + tool defs).
3. Calls `Provider::stream()` → yields `StreamEvent` items.
4. On `ToolCall` events: `ToolRegistry` executes up to 8 tools concurrently.
5. Tool results appended to session; loop back to step 2 until `StopReason::EndTurn`.
6. `Session` flushes to JSONL (or SQLite if `sqlite-sessions` feature enabled).

### Extension runtime

Extensions run in QuickJS (`rquickjs`) with capability-gated hostcalls:
`tool` / `exec` / `http` / `session` / `ui` / `events`.

Two-stage `exec` enforcement: capability gate → command mediation (blocks dangerous shell patterns by default). Trust lifecycle: `pending → acknowledged → trusted → killed`.

### Session format

JSONL v3. Each line is a `SessionEntry` tagged by type: `Message`, `ModelChange`, `ThinkingLevel`, `Compaction`, etc. Tree structure supports branching. Optional SQLite backend behind `sqlite-sessions` feature.

## Feature Flags

```toml
default = ["image-resize", "jemalloc", "clipboard", "wasm-host", "sqlite-sessions"]
```

| Flag | Effect |
|------|--------|
| `image-resize` | Enables `image` crate for terminal image rendering |
| `jemalloc` | `tikv-jemallocator` allocator (10-20% perf on allocation-heavy paths) |
| `clipboard` | `arboard` for `/copy` command |
| `wasm-host` | `wasmtime` for WASM extension runtime (`src/pi_wasm.rs`) |
| `sqlite-sessions` | SQLite session backend (`src/session_sqlite.rs`) |
| `ext-conformance` | Extension conformance test suite (not default) |
| `fuzzing` | Coverage-guided fuzzing exports (not default) |

## Lint & Safety Rules

- `#![forbid(unsafe_code)]` — no unsafe anywhere
- Clippy `pedantic` + `nursery` at warn level; `-D warnings` in CI
- No file deletions without explicit permission (see `AGENTS.md`)
- No `git reset --hard` / `git clean -fd` / `rm -rf` without explicit authorization
- Branch: `main` only (`master` exists for legacy URL compatibility — always push `main:master` after `main`)

## Local Sibling Crate Development

To develop against local checkouts of `asupersync`, `rich_rust`, or `charmed_*`, uncomment the `[patch.crates-io]` block at the bottom of `Cargo.toml`. **Do not commit this section** — use `git update-index --skip-worktree Cargo.toml`.

## Pre-commit Checklist

```bash
ubs --staged --only=rust .      # static analysis
cargo fmt --check               # formatting
cargo clippy --all-targets -- -D warnings
cargo test
```
