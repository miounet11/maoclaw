# Extension Capability Profile Matrix

- Generated at: `2026-04-06T09:25:05.882636+00:00`
- Conformance source: `/Users/lu/开发项目/claw/pi_agent_rust_release_wt_20260406/tests/ext_conformance/reports/conformance_events.jsonl`
- Runtime policy source: `/Users/lu/开发项目/claw/pi_agent_rust_release_wt_20260406/tests/ext_conformance/reports/negative/negative_events.jsonl`

## Profile Projection

| Profile | Pass | Fail (existing) | Blocked | Pass rate | Deny decisions | Prompt decisions | Allow decisions |
|---|---:|---:|---:|---:|---:|---:|---:|
| safe | 0 | 0 | 0 | 0.00% | 5 | 0 | 5 |
| balanced | 0 | 0 | 0 | 0.00% | 2 | 3 | 5 |
| permissive | 0 | 0 | 0 | 0.00% | 0 | 0 | 10 |

## Preflight vs Runtime Consistency

- Checked decisions: `19`
- Matched decisions: `19`
- Mismatches: `0`

### Skipped Unknown Capabilities

- `custom`: 3
- `gpu`: 3

### Skipped Fixture Overrides

- `env`: 1 (negative fixture explicit deny override)
- `exec`: 1 (negative fixture explicit deny override)

