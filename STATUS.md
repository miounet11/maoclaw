# Maozhua Status

Last updated: 2026-03-14  
Scope: Public launch positioning for Maozhua v0.1

## What Is Proven

- The Rust CLI is installable and usable today as a terminal-first AI coding agent.
- Core workflows already work on the main path: interactive mode, print mode, basic RPC, session save/continue/resume, fork/compact, and the seven built-in tools.
- The product has measurable speed and memory advantages on the benchmarked paths documented in the repository.
- The current release can already support real local development workflows with explicit settings, provider auth, and session persistence.

## What Is Shipping Now

- Official Chinese product name is `猫爪`, with `maoclaw` as the global repository/package identity.
- Official website is `https://xinxiang.xin`.
- Public-facing communication is being aligned for Chinese, English, and Japanese.
- `maoclaw` is positioned as an independently developed original product from China with its own repository and release identity.
- Maozhua v0.1 is a focused public trial release.
- The external product brand is `猫爪`, while the command remains `pi`.
- Primary launch platform is macOS. Linux and Windows remain secondary for this release.
- Supported launch surface:
  - interactive mode
  - print mode
  - basic RPC mode
  - Anthropic, OpenAI, Gemini, and Azure OpenAI
  - `read`, `write`, `edit`, `bash`, `grep`, `find`, `ls`
  - sessions, resume, continue, fork, compact
  - skills, prompt templates, themes, and the base extension runtime

## Current Boundaries

- Maozhua v0.1 is a trial release, not a broad enterprise certification release.
- Full JSON/RPC stability across every integration surface is still evolving.
- Full SDK contract stability across every embedding scenario is still evolving.
- Broad third-party extension ecosystem compatibility is still evolving.

## Decision Guidance

Use Maozhua v0.1 now if you want:

- faster startup and lower memory use
- a terminal-first coding agent
- explicit operator control
- early adoption with clearly documented boundaries

Wait for a later release if you need:

- broad enterprise rollout guarantees
- deeper automation or SDK stability guarantees
- broader ecosystem compatibility guarantees

## Upgrade Route

The public upgrade path is intentionally staged:

- `v0.1`: public trial
- `v0.2`: workflow confidence beta
- `v0.3`: integration beta
- `v0.4`: certification track

See [docs/maozhua-upgrade-roadmap.md](docs/maozhua-upgrade-roadmap.md) for the detailed route.
