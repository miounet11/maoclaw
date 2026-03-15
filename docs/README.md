# maoclaw Documentation Map

This directory contains both canonical `maoclaw` documentation and a large amount of planning, audit, parity, and contract material.

Brand baseline for canonical docs:

- Chinese name: `猫爪`
- Global / English name: `maoclaw`
- Japanese-facing name: `猫爪 / maoclaw`
- Official website: `https://xinxiang.xin`
- Public-facing language targets: Chinese, English, and Japanese

If you are looking for the current product story, do **not** start by opening random files in `docs/`.
Start with the canonical set below.

## Multilingual Portals

GitHub-facing language entrypoints:

- [i18n/README.md](i18n/README.md) - multilingual switchboard
- [i18n/zh/README.md](i18n/zh/README.md) - Chinese user docs
- [i18n/en/README.md](i18n/en/README.md) - English user docs
- [i18n/ja/README.md](i18n/ja/README.md) - Japanese user docs

Each language portal includes quick start, installation, usage, provider setup, integration guidance, FAQ, and changelog pages.

## Canonical Docs

### Product and release

- [../README.md](../README.md) - main project overview
- [../STATUS.md](../STATUS.md) - current public truth snapshot
- [open-source-overview.md](open-source-overview.md) - concise open-source positioning and scope
- [deployment-guide.md](deployment-guide.md) - install, packaging, and deployment paths
- [maozhua-v0.1-quick-start.md](maozhua-v0.1-quick-start.md) - shortest path to first successful use
- [maozhua-v0.1-support-scope.md](maozhua-v0.1-support-scope.md) - what is in scope for the current release
- [maozhua-v0.1-known-limitations.md](maozhua-v0.1-known-limitations.md) - explicit boundaries and non-promises
- [maozhua-v0.1-faq.md](maozhua-v0.1-faq.md) - operator/customer questions
- [maoclaw-v0.1.9-release-notes.md](maoclaw-v0.1.9-release-notes.md) - first formal maoclaw release notes
- [maozhua-upgrade-roadmap.md](maozhua-upgrade-roadmap.md) - staged upgrade route
- [releasing.md](releasing.md) - release process and artifacts

### Installation and usage

- [terminal-setup.md](terminal-setup.md)
- [troubleshooting.md](troubleshooting.md)
- [settings.md](settings.md)
- [models.md](models.md)
- [skills.md](skills.md)
- [prompt-templates.md](prompt-templates.md)
- [themes.md](themes.md)

### Integrators and operators

- [integrator-migration-playbook.md](integrator-migration-playbook.md)
- [rpc.md](rpc.md)
- [sdk.md](sdk.md)
- [session.md](session.md)
- [tree.md](tree.md)
- [providers.md](providers.md)
- [provider-auth-troubleshooting.md](provider-auth-troubleshooting.md)

### Security and runtime

- [security/operator-handbook.md](security/operator-handbook.md)
- [security/operator-quick-reference.md](security/operator-quick-reference.md)
- [security/threat-model.md](security/threat-model.md)
- [security/invariants.md](security/invariants.md)
- [capability-prompts.md](capability-prompts.md)
- [extension-architecture.md](extension-architecture.md)
- [extension-troubleshooting.md](extension-troubleshooting.md)

## Internal Reference Layers

These files are useful, but they are not the first stop for users or release communication.

### Planning and temporary decision records

- `maozhua-v0.1-trial-release-plan.md`
- `maozhua-v0.1-release-blockers.md`
- `maoclaw-rebrand-and-repo-boundary-plan-2026-03-13.md`

### Historical engineering reference

- `original-developer-arc-ef68e11-to-cd6b6ef-analysis.md`
- `maoclaw-inherit-original-developer-method-playbook.md`
- `maoclaw-upgrade-roadmap-derived-from-original-method.md`
- `openclaw-*.md`
- `dropin-*.json`
- `parity-certification.json`

### Large generated evidence and audit artifacts

- `provider-*.json`
- `extension-*.json`
- `franken-node-*.json`
- `traceability_matrix.json`
- `sec_traceability_matrix.json`

These support engineering, certification, and forensic work. They are not product docs.

## Reference-Only Materials

- Local reference/inspiration materials that are not linked from the canonical section should be treated as working notes, not source-of-truth product documentation.
- `image*.png` files in this folder are working captures. They are not stable documentation.

## Editing Rules

- When adding a new user-facing doc, link it from this file.
- When adding a planning or audit doc, keep it out of the canonical section unless it is meant to be read by normal users/operators.
- Prefer updating an existing canonical doc over creating another near-duplicate file.
