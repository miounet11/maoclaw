# Cross-Platform CI Matrix — MACOS

> Generated: 2026-04-06T11:10:07Z
> OS: macos / aarch64
> Required checks: 5/5 passed

## Check Results

| Check | Policy | Status | Tag |
|-------|--------|--------|-----|
| Cargo check compiles | required | PASS | - |
| Test infrastructure functional | required | PASS | - |
| Temp directory writable | required | PASS | - |
| Git CLI available | required | PASS | - |
| Conformance artifacts present | informational | PASS | - |
| E2E TUI test support (tmux) | informational | FAIL | platform-unsupported |
| POSIX file permission support | informational | PASS | - |
| Extension test artifacts present | informational | PASS | - |
| Evidence bundle index present | informational | PASS | - |
| Suite classification file present and valid | required | PASS | - |

## Merge Policy

| Platform | Role |
|----------|------|
| Linux | **Required** — all required checks must pass |
| macOS | Informational — failures logged, not blocking |
| Windows | Informational — failures logged, not blocking |

## Platform-Specific Issues

- **E2E TUI test support (tmux)** (fail): tmux not found in PATH

