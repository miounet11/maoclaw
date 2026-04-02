# maoclaw Re-Skin Guide

This guide is for teams that want to take `maoclaw`, keep the runtime core, and ship it under their own product identity.

The short version:

- keep the runtime honest
- change the brand deliberately
- do not break install, release, or operator workflows while changing the look

`maoclaw` is open source under MIT. That means you can fork it, adapt it, wrap it, and rebrand it.
What matters is whether your fork still feels like a coherent product after the cosmetic changes.

## What "re-skin" should mean

A good re-skin changes the product identity without introducing product confusion.

That usually includes:

- product name
- logo / hero image
- website copy
- installer messaging
- desktop app name and icon
- default command name
- release artifact names
- docs and onboarding copy

It should not mean:

- random partial renames
- one brand in the README and another in the desktop app
- changing the visuals while leaving install and release flows broken
- claiming compatibility or quality that your fork does not actually verify

## The recommended order

### 1. Decide your public identity first

Before touching code, lock down:

- public product name
- repository name
- website domain
- desktop app display name
- CLI command name
- release artifact prefix
- one-sentence positioning

If you skip this, the fork usually ends up with mixed branding across the README, installer, binaries, and release page.

### 2. Re-skin the first-contact surfaces

These are the files and surfaces normal users notice first:

- `README.md`
- `maoclaw_illustration.webp`
- `gh_og_share_image.png`
- `CHANGELOG.md`
- release notes in `.github/workflows/release.yml`
- installer messages in `install.sh`
- public docs under `docs/`

This layer should answer:

- what the product is
- why it exists
- how to install it
- where to download it
- what command users should run

### 3. Re-skin the runtime-facing product surfaces

After the outer shell is coherent, update the runtime-facing user surfaces:

- CLI help text
- doctor / config / install output
- desktop window title and branding
- package and bundle names
- release asset names

This is the step where many forks become obviously inconsistent.
Do not leave legacy names in all user-visible commands unless you are intentionally keeping compatibility aliases.

### 4. Decide your compatibility policy

You have to decide whether you want:

- a clean break
- branded primary command plus compatibility alias
- full legacy naming retained internally

A strong practical pattern is:

- one branded public command
- one legacy compatibility command for migration
- all docs teach the branded command first

That is the pattern `maoclaw` itself now uses with `mao` as the preferred public command while still preserving `pi` compatibility in release packaging.

## The minimum surfaces to audit

If you are re-skinning seriously, check all of these:

### Repository and docs

- `README.md`
- `CHANGELOG.md`
- `docs/README.md`
- `docs/deployment-guide.md`
- multilingual docs if you publish them

### Release and install

- `install.sh`
- `uninstall.sh`
- `.github/workflows/release.yml`
- `.github/workflows/publish.yml`
- release download URLs
- archive names
- package names

### CLI and runtime

- `src/main.rs`
- `src/cli.rs`
- `src/doctor.rs`
- any startup banners or onboarding text

### Desktop

- `desktop/macos/Info.plist`
- desktop UI labels and onboarding copy
- package scripts under `scripts/`

### Assets

- hero/illustration asset
- OG/social preview image
- icons, screenshots, website captures

## What to keep stable while re-skinning

Changing names is easy. Preserving product integrity is harder.

Protect these four things:

### 1. Install path clarity

A user should know exactly what command to run after install.

If your install script prints one command, your docs must show the same command.

### 2. Release artifact clarity

The release page, installer, and README should all point to the same artifact naming scheme.

Users should not have to guess whether they should download:

- the legacy binary
- the branded binary
- the desktop package
- the portable archive

### 3. Compatibility honesty

If your fork is still partly legacy under the hood, that is fine.
Just do not promise a perfect drop-in replacement unless you have actually verified it.

### 4. Operational continuity

Do not break:

- provider configuration
- session behavior
- release automation
- update/install scripts
- desktop launch flow

Re-skinning should improve perception, not destroy reliability.

## A practical fast-path for forks

If you want the fastest credible fork, do this:

1. Replace the README identity, hero image, and download section.
2. Decide the public command name and teach that command everywhere.
3. Keep one compatibility alias during migration.
4. Rename release artifacts to match the new brand.
5. Update installer copy to match the branded command and artifact names.
6. Rebuild and verify install, `--help`, and one real prompt flow.
7. Update desktop package name and screenshots only after the core flow is coherent.

## Verification checklist for a fork

Before publishing your re-skinned product, verify:

- the README teaches the right install command
- the installer produces the command the README promises
- `--help` and `--version` show the intended brand
- the release page contains the expected artifact names
- the homepage and GitHub release links agree
- the desktop package name matches the public brand
- one real provider configuration path works end to end

## Recommended philosophy

The best forks do not pretend they invented the runtime from scratch.
They simply ship a stronger product shell around a real open-source core.

That is the right mindset:

- respect the runtime
- upgrade the brand
- verify the user journey
- keep the fork honest
