# maoclaw Status

Last updated: 2026-03-15  
Scope: Formal open-source release posture for maoclaw v0.1.9

## What Is Proven

- The Rust CLI is installable and usable today as a terminal-first AI agent.
- Core workflows work on the main path: interactive mode, print mode, JSON mode, basic RPC, session save/continue/resume, fork/compact, and the seven built-in tools.
- The product has benchmarked speed and memory advantages documented in the repository.
- The current release supports real local development workflows with explicit settings, provider auth, and session persistence.
- The repository now ships the expected open-source surface: README, MIT license, changelog, contributing guide, security policy, and GitHub issue templates.

## What Is Shipping Now

- Official Chinese product name is `猫爪`, with `maoclaw` as the public repository/package identity.
- Official website is `https://xinxiang.xin`.
- Public-facing communication is aligned for Chinese, English, and Japanese.
- `maoclaw` is positioned as an independently developed original open-source project with its own repository and release identity.
- `v0.1.9` begins the formal public `maoclaw` release line.
- The external product brand is `猫爪`, while the command remains `pi`.
- Primary launch platform is macOS. Linux and Windows remain secondary for this release.
- Supported launch surface:
  - interactive mode
  - print mode
  - JSON mode
  - basic RPC mode
  - Anthropic, OpenAI, Gemini, and Azure OpenAI
  - `read`, `write`, `edit`, `bash`, `grep`, `find`, `ls`
  - sessions, resume, continue, fork, compact
  - skills, prompt templates, themes, and the base extension runtime
  - Rust SDK embedding surface

## Current Boundaries

- `maoclaw` v0.1.9 is an official open-source release, not a broad enterprise certification release.
- Full JSON/RPC stability across every integration surface is still evolving.
- Full SDK contract stability across every embedding scenario is still evolving.
- Broad third-party extension ecosystem compatibility is still evolving.

## Decision Guidance

Use `maoclaw` now if you want:

- faster startup and lower memory use
- a terminal-first coding agent
- explicit operator control
- early adoption with clearly documented boundaries

Wait for a later release if you need:

- broad enterprise rollout guarantees
- deeper automation or SDK stability guarantees
- broader ecosystem compatibility guarantees

## Upgrade Route

The public upgrade path remains intentionally staged:

- `v0.1`: open-source release and public trial
- `v0.2`: workflow confidence beta
- `v0.3`: integration beta
- `v0.4`: certification track

See [docs/maozhua-upgrade-roadmap.md](docs/maozhua-upgrade-roadmap.md) for the detailed route.
