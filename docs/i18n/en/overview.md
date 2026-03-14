# Open Source Overview

`猫爪 / maoclaw` is a local-first, terminal-first AI agent framework.

Its public position is:

- an original product developed in China
- a practical agent-development and workflow tool
- suitable for CLI usage, automation output, RPC integration, and macOS desktop distribution

## What Ships Publicly

- interactive terminal usage
- one-shot prompts and structured output
- built-in file, search, and shell tools
- session persistence and resume
- provider configuration
- skills, prompts, themes, and a baseline extension runtime

## Framework Value

`maoclaw` is intended not only for direct use, but also for building:

- internal AI agent systems
- domain-specific agent workflows
- productized agent clients on top of one shared runtime

## Language and Runtime Advantages

- Rust 2024 based runtime and packaging
- low-overhead startup and resource usage
- explicit control over sessions, tools, providers, and integration surfaces
- one technical foundation for CLI, automation, RPC, and desktop delivery

## Why the Public Repo Is Shaped This Way

The public repository should primarily carry:

- runtime code
- install and packaging scripts
- user documentation
- security documentation
- provider and integration guidance
- release history

It should not treat internal strategy notes or temporary planning documents as the default product entrypoint.

## Continue With

- [Quick Start](quick-start.md)
- [Installation and Deployment](installation-and-deployment.md)
- [Usage and Configuration](usage-and-configuration.md)
- [Integrations and Automation](integrations.md)
