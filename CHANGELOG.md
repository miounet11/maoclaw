# Changelog

This file tracks formal public `maoclaw` releases.

Pre-release migration notes and transition-era launch materials are not treated as the official public release history. The formal public release line starts here.

## Unreleased

Highlights:

- Continue tightening onboarding, agent-management ergonomics, and release-quality verification on top of the new `v0.1.17` baseline.

## 0.1.17 - macOS Launch Guidance And Optional Signing

Released: 2026-04-06

Highlights:

- Polished the install-to-first-use path so macOS users get clearer launcher wording, desktop-app guidance, and more explicit next steps after installation.
- Expanded the public docs with stronger first-contact, learning, deployment, and re-skin guidance so teams can evaluate the runtime or ship a branded fork with less guesswork.
- Added optional macOS app and package signing hooks to the packaging scripts so release operators can produce Developer ID-signed artifacts when identities are available.

## 0.1.16 - Release Pipeline Repair And Download Consistency

Released: 2026-04-02

Highlights:

- Fixed release CI so missing Git metadata no longer aborts public artifact builds on GitHub Actions.
- Synchronized the checked-in Cargo lockfile with the package version so `--locked` release builds now succeed consistently across the matrix.
- Moved the public direct-download links forward to the repaired release tag so the homepage points at live macOS and Windows packages instead of a failed candidate.

## 0.1.15 - Mao Command Release And Direct Download UX

Released: 2026-04-02

Highlights:

- Promoted `mao` to the primary CLI command and aligned install, docs, and examples around the branded invocation path.
- Updated release packaging so public downloads expose current branded assets and clearer first-run guidance instead of legacy `pi`-only archive naming.
- Added direct current-version download URLs to the public README so users can find the macOS package and Windows desktop package immediately after release.

## 0.1.14 - Verification Closure And Release Gate Reliability

Released: 2026-04-01

Highlights:

- Fixed the top-level `./verify --profile smoke` wrapper so the documented smoke path works on macOS Bash 3.2 instead of failing on empty forwarded-argument arrays.
- Made `scripts/smoke.sh` portable on macOS by falling back to `gtimeout` or Python when GNU `timeout` is unavailable, restoring the fast local regression loop on the primary release platform.
- Tightened `scripts/release_gate.sh` and the GitHub release workflow so tagged releases now require a passing release gate backed by fresh evidence instead of silently reusing stale historical artifacts.

## 0.1.13 - Multi-Agent Mesh And Release Evidence Hardening

Released: 2026-03-30

Highlights:

- Hardened the release evidence path by fixing the kernel-boundary drift report contract so claim-integrity and evidence-contract gating agree on one schema and verdict shape.
- Brought the release gate, regression checks, and focused readiness flow into alignment with the official-tier conformance oracle instead of failing on unsupported whole-corpus N/A accounting.
- Fixed the `community/nicobailon-subagents` conformance fixture to stay inside the extension-root write sandbox, restoring full generated conformance pass coverage for the verified corpus.
- Continued expanding the local agent-mesh and bridge surfaces so shared terminal coordination across maoclaw, Claude Code, and Codex can be managed as one runtime system instead of separate manual workflows.

## 0.1.12 - Native Desktop Security And Public Distribution

Released: 2026-03-28

Highlights:

- Added a native desktop security command center with readiness scoring, permission posture, and correction actions.
- Surfaced the same security assessment state inside settings corrections, readiness checks, and runtime telemetry panels so the desktop shell stays internally consistent.
- Promoted desktop artifacts to a real public release surface by wiring GitHub Releases and the website to the current macOS package/archive and Windows portable desktop zip.
- Reworked the release-facing docs and public site so download paths, release notes, and current-version messaging all point at the same tagged build.

## 0.1.11 - Desktop Configuration And Packaging Reliability

Released: 2026-03-16

Highlights:

- Fixed a desktop settings regression where switching providers could keep showing the previous provider's API URL override.
- Made saved desktop credentials more legible by surfacing masked saved-key previews instead of leaving users to guess whether persistence worked.
- Tightened the desktop save confirmation path so successful saves read like a product action, not a raw file-path dump.
- Hardened macOS packaging scripts to reject stale `pi` binaries whose reported version does not match `Cargo.toml`, and to reject `pi_desktop` artifacts that predate the current manifest version.
- Hardened macOS package creation to rebuild stale `.app` bundles instead of silently wrapping an old desktop binary in a new installer version.
- Documented the supported desktop setup path for third-party OpenAI-compatible providers directly in the root README.

## 0.1.9 - First Official maoclaw Open Source Release

Released: 2026-03-15

Highlights:

- Established `maoclaw` as the formal open-source release identity for the project.
- Reorganized the root README so the first-contact story is clear, product-grade, and aligned with the actual runtime surface.
- Reset the public changelog to start with official `maoclaw` releases instead of internal transition notes.
- Standardized the repository licensing message on MIT.
- Added missing community health files: contribution guide, security policy, code of conduct, and issue templates.
- Tightened release-facing documentation around open-source packaging, support expectations, and release operations.

Open-source surface:

- `README.md`
- `LICENSE`
- `CONTRIBUTING.md`
- `SECURITY.md`
- `.github/ISSUE_TEMPLATE/*`
- `.github/CODE_OF_CONDUCT.md`

Product/runtime surface highlighted for this release:

- interactive terminal mode
- print mode and JSON mode
- stdin/stdout RPC mode
- Rust SDK embedding surface
- sessions with continue/resume/fork/compact flows
- built-in tools: `read`, `write`, `edit`, `bash`, `grep`, `find`, `ls`
- skills, prompt templates, themes, and extension runtime
- macOS desktop packaging on the same runtime
