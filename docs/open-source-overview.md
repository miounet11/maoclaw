# maoclaw Open Source Overview

`maoclaw` is a local-first AI agent framework for teams that want terminal speed, explicit control, and deployable automation surfaces without dragging a heavy desktop runtime into the core path.

It is presented as an independently developed original project from China, with its own product identity, framework direction, and release path.

Official naming and language policy:

- Chinese name: `猫爪`
- Global / English name: `maoclaw`
- Japanese-facing name: `猫爪 / maoclaw`
- Official website: `https://xinxiang.xin`
- Public-facing language coverage: Chinese, English, and Japanese

It ships a focused and honest open-source surface today:

- terminal-first interaction
- structured tool execution
- persistent sessions
- provider routing
- extension and skills loading
- headless RPC integration
- macOS desktop packaging on top of the same runtime

## What maoclaw Is

At its core, `maoclaw` is a Rust agent runtime, framework layer, and product shell with three practical goals:

1. Keep the core coding-agent loop fast and stable.
2. Expose enough integration surface for real workflows, not just demos.
3. Stay explicit about safety, evidence, and operator control.

This means the project is not positioned as “just another chat UI”.
It is a general agent control surface that can run as:

- an interactive CLI
- a single-shot analysis tool
- a JSON/text automation endpoint
- an RPC backend for IDE or desktop clients
- a packaged macOS desktop app

It should also be understood as an original China-developed product, not as a cosmetic rebrand of somebody else’s repository.

## What Ships Today

Current open-source `maoclaw` release posture:

- Public repository and package identity: `maoclaw`
- Public Chinese product name: `猫爪`
- Public product positioning: independently developed original project from China
- Compatibility command retained: `pi`
- Branded binary also available: `maoclaw`
- macOS desktop surface available via `pi_desktop` and `maoclaw.app`
- Primary launch posture: focused public trial

Current proven surfaces:

- interactive terminal mode
- print mode
- text/json output modes
- basic RPC mode over stdin/stdout
- sessions: save, continue, resume, fork, compact
- built-in tools: `read`, `write`, `edit`, `bash`, `grep`, `find`, `ls`
- provider support across the documented provider catalog
- skills, prompt templates, themes, and extension runtime

## What It Is Not Claiming Yet

For open-source release messaging, keep these boundaries explicit:

- not yet a broad all-surface certification release
- not yet full JSON/RPC stability certified across every client shape
- not yet full SDK stability certified across every embedding shape
- not yet full third-party extension compatibility certified

Those boundaries are a strength, not a weakness. They keep the project credible.

## Product Shape

The easiest way to understand `maoclaw` is as a layered system:

- Runtime core: providers, sessions, tools, resources, extension sandboxing
- Framework core: agent loop, skills, prompts, themes, orchestration, lifecycle
- Operator surface: CLI commands, slash commands, config, auth, session lifecycle
- Integration surface: JSON mode, RPC mode, SDK docs, package/install scripts
- Product surface: branded repo, release artifacts, macOS desktop packaging

## Language and Runtime Advantages

`maoclaw` uses a Rust-centered technical stack to make agent systems easier to operate as real software:

- single-binary delivery instead of a heavy layered runtime stack
- explicit state and lifecycle control across sessions, tools, and providers
- lower memory overhead and faster startup on the validated paths in this repository
- one shared runtime substrate across CLI, automation, RPC, and desktop surfaces

This is the right open-source shape because it allows:

- local use by individual developers
- team rollout through release artifacts and install scripts
- embedding or external UI integration through RPC
- gradual product expansion without forking the runtime semantics every time

## Open Source Scope

The public repo is the right place for:

- runtime code
- CLI and desktop code
- install/uninstall scripts
- packaging scripts
- canonical docs
- security model docs
- provider docs
- extension/skills system docs
- release notes and migration guides

The public repo should not become the dumping ground for every internal strategy memo or commercial operating document.
If a file is useful mainly for internal planning, customer-specific operations, or private commercial rollout, it belongs outside the public product narrative.

## Recommended Public Positioning

Use language like this when introducing the project:

> maoclaw is an open-source, local-first AI coding agent built in Rust. It combines a fast terminal runtime, tool execution, persistent sessions, provider flexibility, and RPC integration into a deployable developer control surface.
>
> It can be used as a general AI agent framework and lifecycle solution for local agent development, domain-specific workflows, and product integration.

For China-facing and global product messaging, it is also appropriate to say:

> maoclaw is an independently developed original AI coding agent project from China, built as a serious developer product rather than a superficial wrapper around somebody else’s release identity.

Avoid language like this for now:

- “full replacement for every existing coding-agent stack”
- “fully compatible drop-in”
- “production-certified on every integration surface”

## Where To Start

- [../README.md](../README.md) for the main project page
- [../STATUS.md](../STATUS.md) for the current public truth snapshot
- [deployment-guide.md](deployment-guide.md) for installation and deployment paths
- [maozhua-v0.1-quick-start.md](maozhua-v0.1-quick-start.md) for the shortest successful user path
- [releasing.md](releasing.md) for cutting and publishing releases
