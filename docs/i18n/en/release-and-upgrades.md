# Release And Upgrade Guide

This page explains where to track public releases, current build upgrades, and documentation changes without mixing them together.

## 1. Read The Right Log

- `CHANGELOG.md`: formal public releases
- `UPGRADE_LOG.md`: broader upgrade stream, including current working-build improvements
- `xinxiang.xin/trial/changelog`: public website release summary
- `xinxiang.xin/trial/upgrade-log`: public website upgrade stream

## 2. Current Public Release Line

### March 28, 2026: `v0.1.12`

Current latest formal release in the repository changelog.

Main focus:

- native desktop security command center and readiness scoring
- consistent security posture visibility across settings, readiness checks, and telemetry
- real public desktop distribution on GitHub Releases and `xinxiang.xin`
- aligned release docs, download paths, and current-version messaging

### March 16, 2026: `v0.1.11`

Current latest formal release in the repository changelog.

Main focus:

- desktop configuration reliability
- clearer saved-credential feedback
- stronger macOS packaging validation
- safer app bundle refresh behavior

### March 15, 2026: `v0.1.9`

The first official `maoclaw` open-source release line.

Main focus:

- public repository identity
- installer and release-facing documentation
- formal changelog reset under the `maoclaw` name
- open-source project surface and release posture

## 3. Current Working-Build Upgrade Track

These items may exist in the current build before they are cut into the next tagged release.

Current active track:

- deeper onboarding and zero-config automation refinement
- agent-management and runtime-governance surface upgrades
- broader Windows packaging polish beyond the current portable desktop archive

Treat these as current build improvements unless and until a tagged release lands.

## 4. What Users Should Read First

If the user wants:

- first install path: read [Quick Start](quick-start.md)
- which surface to use: read [Usage and Configuration](usage-and-configuration.md)
- IDE or client integration: read [Integrations and Automation](integrations.md)
- what changed recently: read `CHANGELOG.md` first, then `UPGRADE_LOG.md`

## 5. Release Communication Rules

- do not present a working-build improvement as a tagged release
- do not claim broad platform certification unless the release docs explicitly say so
- keep website copy, README, changelog, and install guidance on the same version line
- if the site and repo disagree, treat the repository release files as the source of truth
