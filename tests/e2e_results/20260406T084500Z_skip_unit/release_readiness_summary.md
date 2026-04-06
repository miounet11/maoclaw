# Release Readiness Summary

- Generated at: `2026-04-06T09:25:05.965249+00:00`
- Status: `not_ready`
- Overall ready: `False`

## Profile Safety Snapshot

| Profile | Projected pass rate | Blocked extensions | Recommendation |
|---|---:|---:|---|
| safe | 0.00% | 0 | Safest default with strongest capability restrictions |
| balanced | 0.00% | 0 | Recommended for general extension development |
| permissive | 0.00% | 0 | Trusted-only mode; enables dangerous capabilities |

## Workflow Outcomes

- Suite pass rate: `100.00%`
- Passing suites (1): e2e_extension_registration
- Failing suites (0): none
- Failing unit targets (0): none

## Known Risks

- `conformance_failures` (high): Conformance corpus has failing extensions
  - details: 6 extension(s) currently fail conformance
  - evidence: `/Users/lu/开发项目/claw/pi_agent_rust_release_wt_20260406/tests/ext_conformance/reports/conformance_summary.json`
- `soak_longevity_failure` (high): Soak/longevity verification failed thresholds
  - details: status=missing_prerequisites, failed_checks=['prerequisites.required_targets_executed']
  - evidence: `/Users/lu/开发项目/claw/pi_agent_rust_release_wt_20260406/tests/e2e_results/20260406T084500Z_skip_unit/soak_longevity_report.json`

## Recommended Remediation

- `conformance_failures`: Conformance corpus has failing extensions
  - command: `cargo test --test ext_conformance_generated conformance_full_report --features ext-conformance -- --nocapture`
- `soak_longevity_failure`: Soak/longevity verification failed thresholds
  - command: `cargo test --test ext_memory_stress ext_memory_stress_inline -- --nocapture && cargo test --test extensions_stress stress_policy_profile_rotation -- --nocapture`

## Policy Guidance

- `safe`: Default profile for untrusted extensions
  - diagnostic: `./target/debug/pi --explain-extension-policy --extension-policy safe`
- `balanced`: Recommended for general extension development
  - diagnostic: `./target/debug/pi --explain-extension-policy --extension-policy balanced`
- `permissive`: Use only for trusted local extensions
  - diagnostic: `./target/debug/pi --explain-extension-policy --extension-policy permissive`
