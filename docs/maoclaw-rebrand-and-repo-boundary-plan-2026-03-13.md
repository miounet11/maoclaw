# maoclaw Rebrand and Repository Boundary Plan

Status: Draft  
Date: 2026-03-13  
Audience: founders, product, engineering, release owners

> Historical note: this file records the brand-cutover decision process.
> The canonical repository identity is now `miounet11/maoclaw`. Use [README.md](README.md) and [releasing.md](releasing.md) for current release-facing guidance.

## Executive Decision

Yes, a new upgrade cycle is needed.

This upgrade cycle should do **three things together**:

1. **backfill the missing runtime hardening** identified in the legacy baseline
2. **complete the brand transition** from legacy naming to `maoclaw`
3. **split public open-source contents from private company contents**

The key point is this:

> `maoclaw` should be the singular product and repository identity across code, docs, packaging, and release operations.

That means:

- public repo brand: `maoclaw`
- public GitHub repo target: `https://github.com/miounet11/maoclaw`
- internal/private repo should hold company-only strategy, release, infra, and commercial assets

## 1. Strategic Position

The old framing was:

- repo/runtime name: legacy mixed naming
- external product brand: `Maozhua`
- command compatibility retained as `pi`

That was appropriate for the migration-first phase.

The new framing should be:

- project name: `maoclaw`
- GitHub repo: `miounet11/maoclaw`
- user-facing desktop app: `maoclaw`
- package/runtime identity: `maoclaw`
- historical naming details stay out of primary branding surfaces

In other words:

> We are no longer packaging someone else’s runtime under a temporary brand overlay. We are packaging our own product with inherited runtime lineage.

## 2. Upgrade Scope

This cycle should not be only a rename.

It should be a coordinated program with three workstreams.

### 2.1 Workstream A: Runtime Catch-Up

Must import or replicate the missing low-level fixes:

1. default built-in tools should include `grep`, `find`, `ls`
2. session JSONL metadata loading must propagate read errors
3. package manifest resource loading must fail closed on invalid paths
4. HTTP `Transfer-Encoding` / `Content-Length` handling must be hardened
5. interactive event delivery under backpressure must be audited and fixed systematically
6. session health validation should verify real header structure, not generic JSON only

This is mandatory before a major brand cutover.

Reason:

- a brand relaunch amplifies scrutiny
- runtime reliability bugs will be interpreted as product immaturity, not as transition debt

### 2.2 Workstream B: Brand Cutover

All user-visible and repository-visible identity should move to `maoclaw`.

### 2.3 Workstream C: Public/Private Repo Split

We need a disciplined boundary between:

- what belongs in the public open-source repository
- what belongs only in the private company repository

Without this split, the public repo will remain noisy, strategically leaky, and hard to position.

## 3. Brand Cutover Rules

### 3.1 What must change

These items should be rebranded:

- repository name
- Cargo package name
- homepage / repository / docs URLs
- installer/uninstaller strings
- release workflow URLs
- desktop update endpoints
- README title and installation snippets
- workflow/job labels that still use legacy naming
- path markers and installer state naming where user-facing

### 3.2 What may remain as compatibility only

These may remain temporarily, but only as compatibility affordances:

- binary alias `pi`
- migration docs explaining command and packaging transitions
- references in compatibility matrices
- internal adapters or environment variables kept for one transition window

Rule:

If something is visible to a normal user, it should say `maoclaw`, not a legacy runtime label.

### 3.3 What must remain as attribution, not branding

We should keep honest lineage, but move it into secondary places:

- `NOTICE`
- `CREDITS`
- migration guide
- acknowledgements in README

Recommended wording:

> maoclaw is an independent open-source AI agent platform with a unified product and repository identity.

## 4. Current Branding Surfaces That Still Need Work

The repo is currently mixed.

### Already aligned to `maoclaw`

Examples:

- [desktop/macos/Info.plist](../desktop/macos/Info.plist)
- [desktop/macos/Sources/PiDesktopBridge.swift](../desktop/macos/Sources/PiDesktopBridge.swift)
- [desktop/macos/Sources/PiDesktopApp.swift](../desktop/macos/Sources/PiDesktopApp.swift)
- [scripts/build_macos_app.sh](../scripts/build_macos_app.sh)
- [scripts/build_macos_pkg.sh](../scripts/build_macos_pkg.sh)

### Still carrying legacy naming

Examples:

- [Cargo.toml](../Cargo.toml)
- [README.md](../README.md)
- [install.sh](../install.sh)
- [uninstall.sh](../uninstall.sh)
- [STATUS.md](../STATUS.md) still frames the product as a migration-first overlay
- multiple [`.github/workflows/`](../.github/workflows) files
- many docs and scripts still point to legacy repository identifiers

## 5. Naming Matrix for the New Project

Recommended target matrix:

| Surface | Target |
|---|---|
| GitHub repo | `miounet11/maoclaw` |
| Rust package | `maoclaw` |
| crate lib name | `maoclaw` |
| main CLI binary | `maoclaw` |
| compatibility alias | `pi` for one transition period only |
| desktop app | `maoclaw.app` |
| macOS bundle id | `com.maoclaw.desktop` |
| website/control plane | `maoclaw` |
| install script owner/repo defaults | `OWNER=miounet11`, `REPO=maoclaw` |

### Important command decision

You need to choose between two command strategies:

#### Option A: Full cutover

- canonical command: `maoclaw`
- optional alias: `pi`

This is the cleanest branding outcome.

#### Option B: Soft transition

- canonical command: `maoclaw`
- compatibility alias: `pi` documented for existing users
- deprecate `pi` after one or two releases

This is the best practical option.

Recommendation:

Use **Option B**.

## 6. Public GitHub Repo: What Should Be Open Source

The public repo should contain the **product engine and developer-extensible platform**, not all company operations.

### 6.1 Definitely public

These belong in `github.com/miounet11/maoclaw`:

#### Core runtime and app code

- `src/**`
- `desktop/**`
- `Cargo.toml`
- `Cargo.lock`
- `build.rs`
- core tests needed for trust and contributions

Reason:

- this is the actual open-source product
- contributors need full buildable code
- trust requires runtime transparency

#### Public packaging and developer scripts

- `install.sh`
- `uninstall.sh`
- `scripts/build_macos_app.sh`
- `scripts/build_macos_pkg.sh`
- public-safe smoke/build scripts

Reason:

- users need reproducible install/build paths

#### Public technical docs

Keep and publish:

- usage docs
- settings docs
- provider setup docs
- extension architecture docs
- SDK docs
- theme/tui/model/session docs
- threat model at a public-safe level
- binding protocol docs
- system-profile and artifact architecture docs if they define the platform

Examples likely public:

- [docs/settings.md](settings.md)
- [docs/tui.md](tui.md)
- [docs/providers.md](providers.md)
- [docs/sdk.md](sdk.md)
- [docs/openclaw-desktop-binding-protocol-spec.md](openclaw-desktop-binding-protocol-spec.md)
- [docs/openclaw-v2-technical-architecture-spec.md](openclaw-v2-technical-architecture-spec.md)
- [docs/openclaw-artifact-result-center-spec.md](openclaw-artifact-result-center-spec.md)

#### Public CI

Keep public:

- build/test workflows
- lint workflows
- release workflows that do not expose private deployment logic

Reason:

- public projects need transparent quality gates

### 6.2 Public, but only after sanitization

These can be open-source, but must be cleaned first.

#### Security docs and threat models

Public if:

- no sensitive exploit-operational details
- no private filesystem paths
- no internal-only kill-switch procedures

#### Performance and certification docs

Public if:

- they are useful to users or contributors
- internal temp paths, machine names, and private operational assumptions are removed

#### Extension/provider research datasets

Public only if they are actively useful and legally clean.

Otherwise they should be moved out of the main OSS repo or published as generated snapshots in a separate data repo.

## 7. Private Company Repo: What Should Stay Internal

This is the most important boundary.

The private repo should contain anything that is:

- commercially sensitive
- operationally sensitive
- noisy and not useful to outside contributors
- tied to unreleased product strategy

### 7.1 Product strategy and launch planning

Keep private:

- trial release plans
- launch blockers
- product positioning drafts
- partner-specific rollout docs
- internal roadmap sequencing
- investor/market messaging drafts

Examples that should likely move to private:

- [docs/maozhua-v0.1-trial-release-plan.md](maozhua-v0.1-trial-release-plan.md)
- [docs/maozhua-v0.1-release-blockers.md](maozhua-v0.1-release-blockers.md)
- [docs/maozhua-v0.1-release-notes-draft.md](maozhua-v0.1-release-notes-draft.md)
- [docs/maozhua-v0.1-demo-scenarios.md](maozhua-v0.1-demo-scenarios.md)
- [docs/maozhua-v0.1-faq.md](maozhua-v0.1-faq.md) if it is still launch-ops oriented rather than user docs

### 7.2 Internal release operations

Keep private:

- release go/no-go ledgers
- internal QA runbooks that encode non-public operational process
- private release evidence and artifact bookkeeping
- private signing/release process details

Examples likely private or heavily reduced:

- `docs/provider-gate-*.json`
- `docs/provider-audit-*.json`
- `docs/qa-runbook.md`
- `docs/ci-operator-runbook.md`
- `docs/coverage-baseline-map.json`
- many `docs/franken-node-*.json`

### 7.3 Commercial/control-plane product code

If the web control plane is intended to be a differentiated company product rather than the OSS core, keep private:

- paid cloud coordination logic
- account system
- billing
- commercial team/workspace logic
- hosted automation orchestration
- proprietary analytics

### 7.4 Internal data exhaust

Do not keep these in the public repo:

- raw generated inventories that are not directly useful to contributors
- huge generated extension research corpora
- release artifacts
- local build backups
- internal screenshots and product review images
- generated `dist/**`

Examples:

- `dist/**`
- `.pi-agent-test/**`
- large generated benchmark snapshots
- big extension inventory JSONs unless deliberately published as data products

### 7.5 Sensitive vendor and private integration details

Keep private:

- private provider credentials and integration notes
- unpublished business integrations
- production endpoints
- private marketplace/channel contracts

## 8. Recommended Boundary by Current Repo Area

### 8.1 Keep in public `maoclaw`

Recommended public set:

- `src/**`
- `desktop/**`
- `tests/**` except raw huge generated artifacts
- `.github/workflows/**` after URL/branding cleanup
- `install.sh`
- `uninstall.sh`
- `scripts/build_*`
- `scripts/smoke.sh`
- public documentation set

### 8.2 Move to private repo

Recommended private set:

- launch/trial docs
- blocker docs
- internal release gating docs and generated evidence
- internal ops runbooks
- large generated research inventories that are not core docs
- dist outputs
- local/dev artifact backups

### 8.3 Conditional bucket

Needs per-file review:

- security docs
- performance reports
- compatibility/certification ledgers
- extension research catalogs
- provider audit evidence

Rule:

If a file helps an external developer build, trust, extend, or debug maoclaw, keep it public.
If it mainly helps us operate the business or manage release risk internally, keep it private.

## 9. Recommended Repo Topology

Recommended structure:

### Public repo

`github.com/miounet11/maoclaw`

Contains:

- OSS runtime
- desktop app
- local bridge
- binding framework
- extension runtime
- public docs
- public CI

### Private repo

Recommended name:

- `maoclaw-internal`

Contains:

- product strategy
- commercial web/control-plane code if proprietary
- launch ops
- release adjudication
- partner/channel contracts
- internal benchmarks and evidence
- private automation logic

### Optional third repo

If needed:

- `maoclaw-data`

Contains only publishable generated datasets:

- benchmark snapshots
- extension catalog snapshots
- compatibility reports

This prevents the OSS repo from turning into a dump of generated JSON.

## 10. Rebrand Execution Order

Do not do this as one giant uncontrolled rename.

### Phase 1: Runtime reliability upgrade

Before brand cutover:

1. import the missing baseline hardening fixes
2. run quality gates
3. stabilize command and packaging decisions

### Phase 2: Identity cutover

Then rename:

1. `Cargo.toml` package metadata
2. README title and install links
3. installer/uninstaller owner/repo defaults
4. release workflow URLs
5. desktop updater URLs
6. public docs and command examples

### Phase 3: Public/private split

Then separate repository content:

1. define public docs whitelist
2. move internal docs to private repo
3. remove generated/noisy artifacts from public root
4. publish cleaned `maoclaw` repo

### Phase 4: Compatibility cleanup

After release:

1. keep `pi` alias temporarily
2. document migration from legacy naming and command surfaces
3. deprecate old repo references

## 11. Concrete Public Messaging

### Recommended short statement

> maoclaw is an independent open-source AI agent platform with its own product and repository identity.

### Recommended engineering statement

> We are renaming the project to `maoclaw`, moving the public source to `github.com/miounet11/maoclaw`, and keeping only the buildable platform, public docs, and contributor-relevant materials in the open-source repo. Product strategy, release operations, and commercial control-plane assets stay private.

### Recommended positioning rule

> Public repo = engine, platform, docs, contribution surface. Private repo = business operations, launch process, proprietary services, and internal evidence.

## 12. Final Recommendation

The right move is:

1. start a new upgrade round immediately
2. treat runtime catch-up as a prerequisite to rebrand credibility
3. promote `maoclaw` from overlay brand to primary project identity
4. create `miounet11/maoclaw` as the public OSS repo
5. move strategy, release-ops, and commercial-only materials into a private repo

If you do not make this split, the project will stay stuck between three identities:

- inherited runtime fork
- temporary migration brand
- future product platform

That ambiguity is now the bigger problem.

`maoclaw` should be the project.  
Legacy naming should become internal history, not the main label.
