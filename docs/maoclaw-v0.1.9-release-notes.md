# maoclaw v0.1.9 Release Notes

Status: Released  
Audience: Open-source users, evaluators, and integrators  
Release type: Formal public open-source release

## Summary

`v0.1.9` is the first formal public `maoclaw` release.

This release does not try to claim universal parity or full certification. It does something more important: it makes the repository and release surface coherent, credible, and ready for real users to evaluate as an open-source product.

## What This Release Delivers

- a clearer and stronger root README
- a clean MIT license message
- formal public release tracking via `CHANGELOG.md`
- contribution and security policies
- GitHub issue templates and community files
- a cleaner release story centered on `maoclaw`, not transition-era launch phrasing

## Product Surface Highlighted In This Release

- interactive terminal mode
- print mode and JSON mode
- stdin/stdout RPC mode
- Rust SDK embedding surface
- session persistence with continue/resume/fork/compact flows
- built-in tools: `read`, `write`, `edit`, `bash`, `grep`, `find`, `ls`
- skills, prompt templates, themes, and extension runtime
- macOS desktop packaging on the same runtime

## Open Source Surface

This release treats the repository itself as part of the product:

- `README.md`
- `LICENSE`
- `CONTRIBUTING.md`
- `SECURITY.md`
- `.github/ISSUE_TEMPLATE/`
- `.github/CODE_OF_CONDUCT.md`

## Boundaries

This release is still not claiming:

- strict drop-in replacement certification
- full JSON/RPC stability across every client shape
- full SDK stability across every embedding shape
- broad third-party extension compatibility certification
- broad enterprise rollout guarantees

## Recommended Positioning

Use language like this:

> maoclaw is an open-source, local-first AI agent runtime built in Rust. It combines a fast terminal experience, explicit operator control, provider flexibility, persistent sessions, and integration-ready surfaces including RPC and an SDK.

## Upgrade Note

For pinned installation examples, use:

```bash
curl -fsSL "https://raw.githubusercontent.com/miounet11/maoclaw/main/install.sh?$(date +%s)" | \
  bash -s -- --version v0.1.9 --yes --easy-mode
```
