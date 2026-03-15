# Security Policy

## Supported Scope

Security reports are welcome for:

- the Rust runtime
- built-in tools
- provider auth and credential handling
- session persistence and export surfaces
- extension loading, policy, and runtime controls
- installer and release packaging flows

## Reporting a Vulnerability

Do not disclose exploitable issues in a public GitHub issue.

Use a private report channel first:

- preferred: GitHub Security Advisory / private vulnerability reporting, if enabled
- fallback: contact the maintainer directly with a minimal reproduction and impact summary

Please include:

- affected version or commit
- environment and platform
- reproduction steps
- expected impact
- whether the issue is already publicly known

## What To Expect

- Initial triage target: within 5 business days
- If the report is valid, remediation priority will be based on exploitability and user impact
- Coordinated disclosure is preferred once a fix or mitigation exists

## Good Reports

The most useful reports include:

- a minimal proof of concept
- affected files or command paths
- privilege assumptions
- whether the issue is local-only, authenticated, or remotely triggerable

## Out of Scope

The following are usually out of scope unless they lead to a concrete exploit:

- missing best-practice headers on non-web surfaces
- purely theoretical issues with no practical path
- performance complaints without a security boundary crossing
- requests to broaden policy defaults in a way that reduces operator control

## Release Messaging

Security fixes that materially affect users should be reflected in release notes and changelog entries without disclosing exploit details before a safe remediation path exists.
