# Changelog

This page is the English GitHub-facing release summary.  
The repository-level authoritative version log remains [../../CHANGELOG.md](../../CHANGELOG.md).

## Unreleased

- continue tightening onboarding, agent-management ergonomics, and post-release packaging polish on top of `v0.1.13`

## 0.1.13 - Multi-Agent Mesh And Release Evidence Hardening

Released: 2026-03-30

- hardened the kernel-boundary drift report contract so release evidence and claim-integrity gates agree
- aligned release gating with the supported official-tier conformance oracle instead of unsupported whole-corpus N/A accounting
- fixed the `community/nicobailon-subagents` fixture to stay inside extension-root write boundaries and restored full generated conformance coverage for the verified corpus
- continued expanding terminal-mesh coordination surfaces so maoclaw, Claude Code, and Codex can operate through one shared runtime model

## 0.1.12 - Native Desktop Security And Public Distribution

Released: 2026-03-28

- added a native desktop security command center with readiness scoring, permission posture, and correction actions
- propagated the same security assessment state into settings corrections, readiness checks, and runtime telemetry
- upgraded GitHub Releases and the website to publish the current macOS package/archive plus a Windows portable desktop zip
- aligned the public docs and release surface on one tagged build instead of split version messaging

## 0.1.11 - Desktop Configuration And Packaging Reliability

Released: 2026-03-16

- fixed a desktop settings regression around provider API URL overrides
- made saved credentials easier to verify through clearer saved-key feedback
- hardened macOS packaging validation so stale desktop bundles are rejected
- improved app bundle refresh behavior during packaging

## 0.1.9 - First Official `maoclaw` Open-Source Release

Released: 2026-03-15

- established `maoclaw` as the public open-source release identity
- reset the formal public changelog under the `maoclaw` line
- aligned README, installer guidance, and release-facing documentation
- completed the baseline open-source repository surface
