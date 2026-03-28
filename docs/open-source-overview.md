# maoclaw Open Source Overview

`maoclaw` is a fully open-source, local-first AI agent runtime and customization platform built in Rust.
It is designed for teams that want to build serious agent systems, not just run a single chat interface.

The project combines:

- agent orchestration
- tool execution
- sessions and memory
- skills, prompts, and extensions
- CLI, RPC, SDK, and desktop surfaces
- release, packaging, and operator governance

## Brand System

- Official global name: `maoclaw`
- Official Chinese name: `猫爪`
- Community nickname in Chinese: `机器猫`
- Public repository and installer identity: `maoclaw`
- Compatibility command retained for workflow continuity: `pi`

Use `maoclaw / 猫爪` as the official public brand.
Use `机器猫` only as the community nickname, not as the primary repository or packaging identity.

## Product Positioning

The most accurate public description is:

> maoclaw is an open-source agent runtime and customization platform for building local-first, domain-specific AI systems.

That matters because the project is intended to support:

- direct developer use from the terminal
- local automation and operator workflows
- embedded RPC / SDK integrations
- native product shells on top of the same runtime
- vertical agent customization across industries

This is the right narrative for software engineering, research, operations, service, knowledge workflows, and industry-specific assistants with custom tools, memory, and policy.

## What Makes The Project Credible

The repo should feel like a serious international OSS project on first contact.
That means the public surface should consistently show:

- a clear README
- clear docs entrypoints
- visible CI and release automation
- clear contribution and security policies
- a coherent install and upgrade path
- honest scope boundaries

The public story should lead with engineering quality and runtime discipline:

- Rust 2024
- `#![forbid(unsafe_code)]`
- single runtime across multiple surfaces
- explicit operator control
- explicit governance and release boundaries

## What The Project Is For

`maoclaw` should be understood as infrastructure for building and operating customized agent systems.

That includes:

- coding agents
- research agents
- knowledge agents
- workflow and operations agents
- internal assistants
- vertical agents for domain-specific business processes

The value is not only in the default CLI.
The value is in the runtime, control model, extensibility, and productization surface.

## OSS Scope

The public repository is the right home for:

- runtime code
- packaging and install scripts
- CLI and desktop surfaces
- canonical docs
- security and release docs
- extension and skills documentation
- changelogs and migration guidance

The public repository should not read like an internal planning dump.
Canonical docs should stay curated, and planning or audit artifacts should stay clearly separated from the public product narrative.

## Recommended Public Messaging

Use language like this:

> maoclaw is an open-source Rust runtime for building customizable AI agent systems.
> It gives teams one foundation for orchestration, tools, memory, sessions, skills, and product surfaces across CLI, RPC, SDK, and desktop delivery.

And when emphasizing customization:

> maoclaw is designed to support vertical AI agent customization across industries by exposing the runtime layers that teams actually need to control: tools, prompts, memory, policy, routing, and packaging.

Avoid weaker language like this:

- “just another AI chat product”
- “a thin wrapper around an upstream tool”
- “fully certified for every enterprise surface”
- “drop-in replacement for everything”

## Start Here

- [../README.md](../README.md) for the main project page
- [../STATUS.md](../STATUS.md) for the current public truth snapshot
- [README.md](README.md) for the canonical docs map
- [deployment-guide.md](deployment-guide.md) for installation and deployment
- [releasing.md](releasing.md) for release process and artifacts
