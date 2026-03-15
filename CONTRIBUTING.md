# Contributing to maoclaw

Thanks for taking the project seriously enough to want to improve it.

## Before You Start

- Read [README.md](README.md) for project scope and positioning.
- Read [AGENTS.md](AGENTS.md) if you are working through an AI coding agent.
- Read [docs/README.md](docs/README.md) before adding or reshaping documentation.
- Read [SECURITY.md](SECURITY.md) before reporting or discussing a security issue.

## Contribution Scope

High-value contributions are the ones that improve correctness, operator experience, documentation quality, test coverage, performance discipline, and release quality.

The most useful issue reports and pull requests are:

- bug fixes with a clear reproduction
- test additions for missing behavior
- documentation fixes that remove ambiguity
- UX improvements grounded in real workflows
- security hardening with a clear threat model

## Before Opening a Pull Request

1. Open or find an issue when the change is non-trivial.
2. Keep the change set focused.
3. Avoid drive-by refactors unless they are necessary to make the fix correct.
4. Update docs when behavior or public expectations change.
5. Add or update tests when practical.

## Development Expectations

- Use Cargo for all Rust workflows.
- Keep changes explicit and reviewable.
- Prefer editing existing files over creating near-duplicate files.
- Do not introduce unsafe Rust.
- Do not make release claims that outrun the evidence in the repo.

Recommended local checks:

```bash
cargo fmt --check
cargo clippy --all-targets -- -D warnings
cargo test --all-targets
```

If the full suite is too heavy for the change, run the narrowest meaningful subset and say exactly what you ran.

## Pull Request Format

Use the repository PR template and include:

- what changed
- why it changed
- risk level
- test or evidence links
- exact reproduction commands when fixing a failure path

## Documentation and Messaging Rules

- Keep the public product identity as `maoclaw`.
- Do not describe the project as a strict drop-in replacement unless the release gate explicitly supports that claim.
- Prefer precise, defensible wording over marketing inflation.

## Security Issues

Do not open public issues for vulnerabilities that could expose users or operators.

Use the process in [SECURITY.md](SECURITY.md).
