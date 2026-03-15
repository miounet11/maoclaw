# Changelog

This file tracks formal public `maoclaw` releases.

Pre-release migration notes and transition-era launch materials are not treated as the official public release history. The formal public release line starts here.

## Unreleased

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
