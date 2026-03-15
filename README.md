<p align="center">
  <img src="maoclaw_illustration.webp" alt="maoclaw" width="560"/>
</p>

<h1 align="center">maoclaw</h1>

<p align="center">
  <strong>`猫爪` / maoclaw</strong><br/>
  A local-first AI agent runtime, framework, and product surface built in Rust
</p>

<p align="center">
  Official website: <a href="https://xinxiang.xin">xinxiang.xin</a><br/>
  GitHub: <a href="https://github.com/miounet11/maoclaw">miounet11/maoclaw</a>
</p>

<p align="center">
  <a href="docs/i18n/zh/README.md">中文</a> /
  <a href="docs/i18n/en/README.md">English</a> /
  <a href="docs/i18n/ja/README.md">日本語</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/rust-2024%20edition-orange?logo=rust" alt="Rust 2024">
  <img src="https://img.shields.io/badge/license-MIT-blue" alt="License: MIT">
  <img src="https://img.shields.io/badge/unsafe-forbidden-brightgreen" alt="No Unsafe Code">
</p>

```bash
curl -fsSL "https://raw.githubusercontent.com/miounet11/maoclaw/main/install.sh?$(date +%s)" | bash
```

## Overview

`maoclaw` is a local-first AI agent system designed for developers and teams that want terminal speed, explicit runtime control, and integration-ready surfaces without making the desktop shell the core product.

Project identity:

- Chinese name: `猫爪`
- Global / English name: `maoclaw`
- Japanese-facing name: `猫爪 / maoclaw`
- Compatibility command: `pi`
- Branded binary: `maoclaw`

The current release posture is an official open-source release with a focused public-trial scope. The project is already usable today, but it intentionally documents its boundaries instead of pretending every surface is fully certified.

## Open Source Project

`maoclaw` is released as an open-source project with a standard public repository surface:

- [LICENSE](LICENSE) - MIT license
- [CONTRIBUTING.md](CONTRIBUTING.md) - contribution rules and workflow
- [SECURITY.md](SECURITY.md) - security reporting policy
- [CHANGELOG.md](CHANGELOG.md) - formal public release history

The goal is to make the repository feel production-grade on first contact, not like an internal dump of runtime code.

## What Ships Today

`maoclaw` already provides a coherent end-to-end runtime:

- interactive terminal mode
- print mode and JSON output mode
- stdin/stdout RPC mode for external clients
- Rust SDK entrypoints for embedding
- macOS desktop packaging on the same runtime
- persistent sessions with continue, resume, fork, compact, and export flows
- built-in tools: `read`, `write`, `edit`, `bash`, `grep`, `find`, `ls`
- resource loading for skills, prompt templates, themes, and extensions
- operator commands for package install/update/search/list, config inspection, doctor checks, and migration

Core launch support is centered on:

- Anthropic
- OpenAI
- Gemini / Google
- Azure OpenAI

Broader provider routing and onboarding coverage is documented in [docs/providers.md](docs/providers.md) and [docs/provider-config-examples.md](docs/provider-config-examples.md).

## Why maoclaw

Many AI coding tools optimize for surface polish first and runtime clarity second.

`maoclaw` is built around a different set of priorities:

- fast startup and low-overhead execution
- explicit control over provider, model, thinking level, tools, sessions, and resources
- one shared runtime for CLI, JSON automation, RPC integration, SDK usage, and desktop packaging
- an operator-facing system that is honest about release scope and security boundaries

## Core Advantages

The project already has several real differentiators. These are worth stating more directly than the old README did.

### 1. One Runtime, Multiple Surfaces

The same Rust runtime powers:

- `pi` interactive CLI
- single-shot / print usage
- JSON output flows
- RPC server mode
- Rust SDK sessions
- macOS desktop packaging

That matters because it reduces semantic drift between local usage, automation, embedding, and product packaging.

### 2. Explicit Operator Control

`maoclaw` exposes the parts that usually get buried:

- provider and model selection
- thinking level
- tool enablement
- session persistence and compaction
- skill, prompt template, theme, and extension loading
- configuration and doctor diagnostics

This makes it suitable not only for direct use, but for teams building controlled internal workflows.

### 3. Integration-Ready Architecture

This is not only a chat UI.

`maoclaw` can be used as:

- a terminal-first coding agent
- a structured automation endpoint
- an RPC backend for external clients
- a Rust library surface through the SDK
- a product runtime underneath a desktop shell

### 4. Security and Extension Governance

The extension model is not just "load arbitrary scripts and hope for the best".

The repo already includes:

- extension capability policies
- install-time preflight analysis
- runtime risk controls
- operator security documentation
- doctor flows for environment and extension checks

Relevant docs:

- [docs/extension-architecture.md](docs/extension-architecture.md)
- [docs/security/operator-handbook.md](docs/security/operator-handbook.md)
- [docs/security/operator-quick-reference.md](docs/security/operator-quick-reference.md)

### 5. Rust-Centered Runtime Discipline

The runtime is intentionally built for operational simplicity:

- Rust 2024
- `#![forbid(unsafe_code)]`
- single-binary delivery
- LTO + stripped release builds
- jemalloc enabled by default on supported targets

This gives the project a strong base for speed, deployability, and long-running stability.

Performance budgets and benchmark baselines are tracked in [BENCHMARKS.md](BENCHMARKS.md).

## Architecture

At a high level, the system looks like this:

```text
CLI / Desktop / SDK / RPC
          |
      Agent Loop
          |
Providers / Tools / Sessions / Resources / Extensions
          |
Persistence / Config / Auth / Policy / Packaging
```

Key repository surfaces:

- `src/main.rs` - CLI entrypoint
- `src/agent.rs` - core agent loop
- `src/providers/` - provider implementations
- `src/tools.rs` - built-in tools
- `src/session.rs` - session persistence
- `src/rpc.rs` - RPC mode
- `src/sdk.rs` - embedding surface
- `src/extensions.rs` and `src/extensions_js.rs` - extension host and runtime
- `src/interactive.rs` - terminal interaction layer

## Quick Start

Set one provider key:

```bash
export ANTHROPIC_API_KEY="your-key"
```

Start interactive mode:

```bash
pi
pi "Summarize this repository"
pi --continue
```

Run single-shot mode:

```bash
pi -p "Explain this error"
pi --mode json -p "Return a structured summary"
```

Inspect available providers and models:

```bash
pi --list-providers
pi --list-models
```

Run health checks:

```bash
pi doctor
pi config --show
```

## Installation and Packaging

Install the latest public build:

```bash
curl -fsSL "https://raw.githubusercontent.com/miounet11/maoclaw/main/install.sh?$(date +%s)" | bash
```

Build from source:

```bash
cargo build --release

./target/release/pi --version
./target/release/maoclaw --version
```

Build the macOS desktop surface:

```bash
cargo build --release --bin pi_desktop --features desktop-iced
bash scripts/build_macos_app.sh --install
```

For deployment details, use [docs/deployment-guide.md](docs/deployment-guide.md).

## Documentation

Start here:

- [STATUS.md](STATUS.md) - current public truth snapshot
- [docs/README.md](docs/README.md) - canonical documentation map
- [docs/open-source-overview.md](docs/open-source-overview.md) - project positioning
- [docs/deployment-guide.md](docs/deployment-guide.md) - installation and rollout

Usage and operator docs:

- [docs/settings.md](docs/settings.md)
- [docs/models.md](docs/models.md)
- [docs/session.md](docs/session.md)
- [docs/tree.md](docs/tree.md)
- [docs/rpc.md](docs/rpc.md)
- [docs/sdk.md](docs/sdk.md)
- [docs/providers.md](docs/providers.md)
- [docs/provider-auth-troubleshooting.md](docs/provider-auth-troubleshooting.md)
- [docs/troubleshooting.md](docs/troubleshooting.md)

Customization and extension docs:

- [docs/skills.md](docs/skills.md)
- [docs/prompt-templates.md](docs/prompt-templates.md)
- [docs/themes.md](docs/themes.md)
- [docs/extension-architecture.md](docs/extension-architecture.md)

Multilingual portals:

- [中文文档](docs/i18n/zh/README.md)
- [English documentation](docs/i18n/en/README.md)
- [日本語ドキュメント](docs/i18n/ja/README.md)

## Current Release Boundaries

The current README should stay credible. `maoclaw` is strong, but the right claim is a focused and proven public trial release, not universal parity.

What it is reasonable to claim now:

- serious Rust AI agent runtime
- terminal-first product with integration surfaces
- usable local development workflows today
- explicit operator control and documented boundaries

What it should not claim yet:

- full drop-in replacement for every coding-agent stack
- certified compatibility across every integration surface
- stable third-party extension compatibility across the full ecosystem
- universal enterprise rollout guarantees

For the release boundary docs, see:

- [STATUS.md](STATUS.md)
- [docs/maozhua-v0.1-support-scope.md](docs/maozhua-v0.1-support-scope.md)
- [docs/maozhua-v0.1-known-limitations.md](docs/maozhua-v0.1-known-limitations.md)

## Project Direction

`maoclaw` is positioned as an original project with its own runtime, repository, release identity, and documentation system.

The strongest public story today is not "we copied everything". It is:

- a Rust-native agent runtime
- one runtime shared across direct use and integration surfaces
- explicit operator control
- practical extensibility
- honest release posture
