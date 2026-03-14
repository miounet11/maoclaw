<p align="center">
  <img src="maoclaw_illustration.webp" alt="maoclaw" width="560"/>
</p>

<h1 align="center">maoclaw</h1>

<p align="center">
  <strong>`猫爪` / maoclaw</strong><br/>
  An original AI coding agent product developed in China
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
  <img src="https://img.shields.io/badge/license-MIT%20%2B%20Rider-blue" alt="License: MIT + Rider">
  <img src="https://img.shields.io/badge/unsafe-forbidden-brightgreen" alt="No Unsafe Code">
</p>

```bash
curl -fsSL "https://raw.githubusercontent.com/miounet11/maoclaw/main/install.sh?$(date +%s)" | bash
```

## Overview

`maoclaw` is a local-first AI coding agent focused on speed, clear operator control, and practical integration surfaces.

It currently ships with:

- terminal-first interactive usage
- single-shot and structured output modes
- RPC mode for external clients
- session persistence and resume flows
- built-in file, search, and shell tools
- provider configuration for major model operators
- macOS desktop packaging on top of the same Rust runtime

Public naming policy:

- Chinese name: `猫爪`
- English / global name: `maoclaw`
- Japanese-facing name: `猫爪 / maoclaw`
- Compatibility command: `pi`

## Why It Exists

Modern coding tools often force developers into heavy desktop shells, unclear runtime behavior, or opaque automation layers.

`maoclaw` is designed to be:

- fast to start
- explicit about configuration
- suitable for both direct use and product integration
- honest about current release boundaries

## What You Can Do Today

- ask questions about a local codebase
- read and modify files through the agent loop
- search symbols, TODOs, and problem areas
- run shell-based development tasks
- save, continue, and resume sessions
- drive the runtime through CLI, JSON output, or RPC

## Install

Install the latest public build:

```bash
curl -fsSL "https://raw.githubusercontent.com/miounet11/maoclaw/main/install.sh?$(date +%s)" | bash
```

Verify:

```bash
pi --version
pi --help
```

## Quick Start

Set one provider key:

```bash
export ANTHROPIC_API_KEY="your-key"
```

Then start:

```bash
pi
pi "Summarize this repository"
pi --continue
```

## Documentation

Product and release entrypoints:

- [STATUS.md](STATUS.md)
- [docs/README.md](docs/README.md)
- [docs/open-source-overview.md](docs/open-source-overview.md)
- [docs/deployment-guide.md](docs/deployment-guide.md)

Multilingual user documentation:

- [中文文档](docs/i18n/zh/README.md)
- [English documentation](docs/i18n/en/README.md)
- [日本語ドキュメント](docs/i18n/ja/README.md)

Each language portal includes:

- status and overview
- quick start
- installation and deployment
- usage and configuration
- provider and API key setup
- integrations and automation
- FAQ
- support scope and known limitations
- release notes and changelog

## Runtime Surfaces

Interactive CLI:

```bash
pi
```

Print mode:

```bash
pi -p "Explain this error"
pi --mode json -p "Return structured output"
```

RPC mode:

```bash
pi --mode rpc
```

Desktop packaging:

```bash
cargo build --release --bin pi_desktop --features desktop-iced
bash scripts/build_macos_app.sh --install
```

## Current Release Posture

The current public release is a focused trial release.

It is suitable for:

- developers evaluating terminal-first AI workflows
- teams testing local coding-agent operations
- product integration experiments through RPC
- macOS-first product demos and internal rollout

For exact scope, use:

- [STATUS.md](STATUS.md)
- [docs/maozhua-v0.1-support-scope.md](docs/maozhua-v0.1-support-scope.md)
- [docs/maozhua-v0.1-known-limitations.md](docs/maozhua-v0.1-known-limitations.md)

## Project Direction

`maoclaw` is positioned as an original product with its own repository, release identity, documentation system, and desktop surface.

The public documentation and release messaging should use `maoclaw` / `猫爪` as the primary identity.
