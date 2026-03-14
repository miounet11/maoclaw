# Maozhua Status

Last updated: 2026-03-10  
Scope: Public launch positioning for Maozhua v0.1

## What Is Proven

- The Rust CLI is installable and usable today as a terminal-first AI coding agent.
- Core workflows already work on the main path: interactive mode, print mode, basic RPC, session save/continue/resume, fork/compact, and the seven built-in tools.
- The product has measurable speed and memory advantages over the legacy Node/Bun stack on the benchmarked paths documented in the repository.
- Migration-oriented usage is already viable on validated CLI workflows, especially for users who want to keep the `pi` command and move to the Rust runtime gradually.

## What Is Shipping Now

- Official Chinese product name is `猫爪`, with `maoclaw` as the global repository/package identity.
- Official website is `https://xinxiang.xin`.
- Public-facing communication is being aligned for Chinese, English, and Japanese.
- `maoclaw` is positioned as an independently developed original product from China with its own repository and release identity.
- Maozhua v0.1 is a small-scope public trial release.
- The external product brand is `猫爪`, while the command remains `pi`.
- The launch is migration-first, not parity-first:
  - fresh install is supported
  - adopting an existing TypeScript `pi` install is supported on documented paths
  - keeping an existing `pi` while evaluating the Rust build side-by-side is supported on documented paths
- Primary launch platform is macOS. Linux and Windows remain secondary for this release.
- Supported launch surface:
  - interactive mode
  - print mode
  - basic RPC mode
  - Anthropic, OpenAI, Gemini, and Azure OpenAI
  - `read`, `write`, `edit`, `bash`, `grep`, `find`, `ls`
  - sessions, resume, continue, fork, compact
  - skills, prompt templates, themes, and the base extension runtime

## What Is Not Yet Parity-Certified

- Maozhua v0.1 is not yet a strict drop-in replacement for TS Pi / OpenClaw.
- Full JSON/RPC parity is not yet certified.
- Full SDK contract parity is not yet certified.
- Full extension-hook and third-party ecosystem compatibility is not yet certified.
- Strict replacement language remains gated by the certification documents in `docs/`.

## Decision Guidance

Use Maozhua v0.1 now if you want:

- faster startup and lower memory use
- a terminal-first coding agent
- a migration path from existing Pi workflows
- early adoption with clearly documented boundaries

Wait for a later release if you need:

- strict drop-in certification
- deep automation or SDK parity guarantees
- broader ecosystem compatibility guarantees

## Upgrade Route

The public upgrade path is intentionally staged:

- `v0.1`: migration-first public trial
- `v0.2`: migration confidence beta
- `v0.3`: integration beta
- `v0.4`: certification track

See [docs/maozhua-upgrade-roadmap.md](docs/maozhua-upgrade-roadmap.md) for the detailed route.
