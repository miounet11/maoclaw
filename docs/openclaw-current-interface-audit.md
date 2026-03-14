# OpenClaw Current Interface Audit

Status: Proposed  
Date: 2026-03-10  
Audience: Product, design, engineering, founders  
Related: [openclaw-v2-program-upgrade-spec.md](openclaw-v2-program-upgrade-spec.md), [openclaw-v2-technical-architecture-spec.md](openclaw-v2-technical-architecture-spec.md), [openclaw-web-platform-spec.md](openclaw-web-platform-spec.md), [../../web/openclaw-web-technical-architecture.md](../../web/openclaw-web-technical-architecture.md)

## 1. Purpose

This document audits the current user-facing interface state across:

- the installed local maoclaw runtime in the current workspace
- the in-progress web control plane in `../web`

The goal is to answer four questions clearly:

1. What interface does the user get today after installation?
2. What is already usable?
3. What still feels infrastructural rather than product-grade?
4. What gaps remain between the current interface and the planned V2 product direction?

## 2. Executive Summary

### 2.1 Short answer

Yes, the product already has a real operable interface after install.

But the current interface is split into two different maturity levels:

- **Local product**: a working full-screen terminal TUI with onboarding and chat workflow
- **Web product**: an early control-plane shell with dashboard, systems, and task views

### 2.2 Current state in one sentence

OpenClaw today is already usable as a terminal-first product, but it is not yet a polished desktop-first or web-first outcome platform.

### 2.3 Product maturity verdict

| Surface | Exists now | Usable now | Product maturity |
|---|---|---:|---|
| Local interactive TUI | Yes | Yes | Medium |
| Terminal onboarding | Yes | Yes | Medium |
| Scenario/template selection | Yes | Partially | Early-medium |
| Result-page product UX | Not really | Limited | Low |
| Vault restore UX | Not yet as a user-facing surface | No | Low |
| Web marketing/control plane | Yes | Yes | Early-medium |
| Web artifact/workflow product | Partial shell only | Limited | Low |
| Membership/billing/CMS | Planned, not complete | No | Low |

## 3. Scope Of This Audit

This audit covers the current implementation evidenced by:

### Local runtime

- [README.md](../README.md)
- [docs/tui.md](tui.md)
- [src/interactive.rs](../src/interactive.rs)
- [src/onboarding.rs](../src/onboarding.rs)
- [src/templates.rs](../src/templates.rs)

### Web control plane

- [../../web/README.md](../../web/README.md)
- [../../web/openclaw-web-technical-architecture.md](../../web/openclaw-web-technical-architecture.md)
- [../../web/src/app/page.tsx](../../web/src/app/page.tsx)
- [../../web/src/app/app/dashboard/page.tsx](../../web/src/app/app/dashboard/page.tsx)
- [../../web/src/app/app/systems/page.tsx](../../web/src/app/app/systems/page.tsx)
- [../../web/src/app/app/tasks/page.tsx](../../web/src/app/app/tasks/page.tsx)
- [../../web/prisma/schema.prisma](../../web/prisma/schema.prisma)

## 4. What Users Get Today After Local Install

## 4.1 Primary installed interface

The primary post-install interface is a full-screen terminal application, not a graphical desktop window.

Evidence:

- [README.md](../README.md#L177-L201) documents `pi` interactive mode as the main entry
- [docs/tui.md](tui.md#L1-L24) describes a full interactive terminal UI
- [src/interactive.rs](../src/interactive.rs#L1-L11) defines the interactive TUI as the full interface

### Current user mental model

After installation, a user typically runs:

- `pi`
- `pi "message"`
- `pi --continue`

This means the current installed product is best described as:

> a terminal-first AI workspace with a structured full-screen TUI

not as:

- a native desktop app
- a browser-first SaaS app
- a card-based visual workspace

## 4.2 Current TUI layout

The current TUI layout is already formalized in [docs/tui.md](tui.md#L5-L24).

### Interface regions

#### Header

Shows:

- current model
- status
- hints / session context

#### Conversation view

Shows:

- user messages
- assistant markdown responses
- thinking blocks
- tool calls and tool outputs

#### Editor

Shows:

- single-line or multi-line input
- command entry
- file references
- autocomplete flows

#### Footer

Shows:

- token usage
- cost estimate
- editor mode hints
- current status messages

## 4.3 Current interaction capabilities

The TUI is not just a text prompt. It already supports strong operational controls.

From [docs/tui.md](tui.md#L33-L106), current capabilities include:

- slash commands
- settings panel invocation
- model switching
- session resume
- session tree navigation
- queue steering / follow-up input
- scrollable history
- theme switching
- export
- copy
- share

This means the interface is already a real product surface, not only a developer console.

## 5. Current Onboarding Experience

## 5.1 Does onboarding exist?

Yes.

The app computes onboarding state during interactive app startup. Evidence:

- [src/interactive.rs](../src/interactive.rs#L2110-L2196)

The onboarding step model is defined in:

- [src/onboarding.rs](../src/onboarding.rs#L12-L40)

## 5.2 Current onboarding steps

The current onboarding path is:

1. Intro
2. Provider Setup
3. Agent Preset
4. Optional Binding
5. Complete

## 5.3 What the onboarding actually looks like

The onboarding is currently rendered as a text-based wizard inside the TUI. Evidence:

- [src/interactive.rs](../src/interactive.rs#L2948-L3065)

### Intro screen

Current copy includes:

- `One minute to install, chat immediately.`
- `Zero-config, zero-dependency OpenClaw desktop client.`
- `[Enter] Get Started`

This is already a product-style welcome step, not a raw config prompt.

### Provider setup screen

Current step includes:

- provider list
- ready badge if credentials are detected
- API key field
- model display
- next/back controls

### System/template selection screen

Current step includes:

- `Choose your work system`
- template cycle behavior
- template-based selection instead of only a blank agent

### Optional binding screen

Current step includes options for:

- Telegram
- Feishu
- QQ

with a `Skip for Now` behavior.

## 5.4 Current onboarding strengths

- already productized compared with a normal CLI
- already introduces providers and task systems through a guided path
- already aligns partly with the desired V2 direction

## 5.5 Current onboarding weaknesses

- still presented in terminal text form, not a richer product visual flow
- no visual cards, previews, or guided benefits per template
- optional binding is mostly a textual placeholder, not a full setup experience
- no visible Vault baseline explanation to reassure users about future restore/clone safety

## 6. Current Template / Work-System Layer

The local app already has a built-in template catalog in:

- [src/templates.rs](../src/templates.rs#L1-L22)

Examples currently present include:

- [Website Development](../src/templates.rs#L156)
- [Project Development](../src/templates.rs#L174)
- [Content Growth](../src/templates.rs#L190)
- [One-Person Company](../src/templates.rs#L206)

This is important because it means the codebase has already begun moving from agent-first to scenario-first.

### Current status

The template layer exists conceptually and technically, but it is still lightly surfaced in the UI.

The user can select a work system, but there is not yet a deep workbench experience per template.

## 7. Current Local Interface Strengths

### 7.1 Strength: real usability today

The local interface is already capable of real interaction after install.

### 7.2 Strength: onboarding exists now

A guided path exists instead of forcing users directly into raw configuration.

### 7.3 Strength: session and advanced control are strong

The TUI supports history, trees, forks, settings, theme switching, and message queuing.

### 7.4 Strength: groundwork for scenario-first systems is present

The template layer and onboarding text already reflect the V2 direction.

## 8. Current Local Interface Weaknesses

### 8.1 Weakness: still terminal-first

The primary experience still feels like a powerful terminal tool rather than a desktop product.

### 8.2 Weakness: result visibility is limited

The product still centers heavily on conversation and runtime behavior rather than clear artifact/result pages.

### 8.3 Weakness: Vault is not yet a visible primary UX surface

Although V2 planning is strong, current users do not yet get a first-class restore/clone/switch interface.

### 8.4 Weakness: system maturity is hidden

There is no prominent visual representation of:

- current active system
- accumulated memory maturity
- checkpoints
- branch lineage
- artifact library

### 8.5 Weakness: desktop branding vs actual UI form

The onboarding copy references a desktop client, but the actual product is still primarily a terminal UI.

## 9. Current Web Interface State

## 9.1 Does the web interface exist?

Yes.

The web project already exists and has a working scaffold. Evidence:

- [../../web/README.md](../../web/README.md#L1-L19)

## 9.2 What the web currently is

The current web app is best described as:

> an early web control-plane shell for OpenClaw

not yet:

- a mature member product
- a workflow-first SaaS app
- a complete outcome dashboard

## 9.3 Current web homepage

Current web home at [../../web/src/app/page.tsx](../../web/src/app/page.tsx#L1-L71) shows:

- `OpenClaw Web Control Plane`
- hero copy about local-first systems and web control
- CTA to open dashboard
- health API link
- control-plane posture metrics
- execution topology
- recent runs

This is a strong technical-control-plane landing page, but not yet a customer-facing high-conversion business product page.

## 9.4 Current web dashboard

Current dashboard at [../../web/src/app/app/dashboard/page.tsx](../../web/src/app/app/dashboard/page.tsx#L1-L106) includes:

- workspace dashboard hero
- metric cards
- linked targets
- bridge linking preview
- core navigation cards
- task run list

This is useful as an operator/admin shell.

## 9.5 Current web app sections

Currently confirmed sections include:

- dashboard: [../../web/src/app/app/dashboard/page.tsx](../../web/src/app/app/dashboard/page.tsx)
- systems: [../../web/src/app/app/systems/page.tsx](../../web/src/app/app/systems/page.tsx)
- tasks: [../../web/src/app/app/tasks/page.tsx](../../web/src/app/app/tasks/page.tsx)

The dashboard also links toward future areas such as:

- templates
- artifacts
- vault
- memory
- automations

But those are not yet present as implemented routes in the current app shell.

## 9.6 Current backend mode

The current web backend is still described as running in an in-memory demo mode by default. Evidence:

- [../../web/README.md](../../web/README.md#L13-L19)

So the web product currently behaves more like:

- architecture scaffold
- admin/control plane prototype
- product shell

than a production-ready SaaS application.

## 10. Current Web Strengths

### 10.1 Strength: correct architectural direction

The current web app already reflects the right hybrid local/web/cloud model.

### 10.2 Strength: good domain foundation

The Prisma schema already contains strong core objects in [../../web/prisma/schema.prisma](../../web/prisma/schema.prisma#L1-L260), including:

- `Workspace`
- `Device`
- `CloudHost`
- `System`
- `TaskRun`
- `Artifact`
- `Automation`
- `IntegrationRef`

### 10.3 Strength: clear control-plane posture

The web shell already understands device linking, systems, tasks, and execution targets.

### 10.4 Strength: not starting from zero

This is important strategically: the web product is already materially underway.

## 11. Current Web Weaknesses

### 11.1 Weakness: still infrastructure-forward

The current UI emphasizes topology, bridge state, targets, and tasks more than user jobs and result outcomes.

### 11.2 Weakness: no strong template-first experience yet

The dashboard links to templates, but there is not yet a full template launcher route implemented.

### 11.3 Weakness: no polished artifact/result center yet

Artifacts are central to V2, but there is not yet a visible product-grade artifact experience.

### 11.4 Weakness: membership, billing, CMS are still missing as full features

These are central to the future SaaS experience but are not yet complete.

### 11.5 Weakness: not yet a website-building workflow surface

Although the architecture supports it, the current web app does not yet expose the `Website Development System` as a full business workflow.

## 12. Gap Analysis Against The Planned V2 Direction

## 12.1 What V2 wants to be

Planned V2 direction is:

- scenario-first
- system-first
- artifact-first
- Vault-safe
- hybrid local/web/cloud
- membership-capable
- workflow-rich

## 12.2 What current local already supports well

- interactive runtime
- onboarding
- structured chat
- advanced session control
- early template selection

## 12.3 What current local does not yet fully support visually

- product-grade workbench
- result pages
- memory center
- Vault center
- branch/clone/switch UX
- card-based system overview

## 12.4 What current web already supports well

- control-plane foundation
- dashboard shell
- systems and tasks visibility
- device/cloud conceptual model
- backend domain modeling

## 12.5 What current web does not yet fully support

- full member journey
- website / content / legal / sales system launchers
- artifact-first product UX
- CMS-admin surfaces
- pricing, plan gating, billing workflows
- publish workflows
- result continuation workflows

## 13. Product Reality Check

## 13.1 What can be honestly claimed today

Today, OpenClaw can honestly claim:

- a real working local interactive UI exists
- the first-run experience is guided rather than raw
- a scenario/template direction is already present
- a separate web control plane is already under active construction

## 13.2 What should not yet be overclaimed

It should not yet be described as:

- a finished desktop GUI product
- a complete Manus-style result platform
- a full member SaaS with polished CMS and billing
- a mature Vault-first restore/clone product surface

## 14. Recommended Next Interface Priorities

### Priority 1: make templates visibly first-class

Across both local and web, users should land on:

- what they want to accomplish
- not only systems/tasks topology

### Priority 2: add result/artifact center

This is the fastest path to making product value visible.

### Priority 3: add visible Vault surface

Users need reassurance that tuning and memory growth are safe.

### Priority 4: evolve web from control plane to product surface

Keep the architecture, but make the UI less infra-centric and more workflow-centric.

### Priority 5: close the desktop/product form gap

Either:

- embrace terminal-first honestly, or
- continue moving toward a richer desktop shell around the runtime

## 15. Final Assessment

Current OpenClaw is already more than an internal prototype.

### It already has:

- a real interactive installed interface
- a real onboarding flow
- a template-aware direction
- a real web control-plane foundation

### But it is still missing:

- a polished outcome-first workbench
- visible artifacts and result pages
- first-class Vault UX
- a complete SaaS membership/content layer
- a visually mature product shell across local and web

## 16. Recommended Follow-Up Docs

The next most useful companion docs would be:

1. local interface redesign brief
2. web interface redesign brief
3. artifact/result-center interaction spec
4. Vault interaction and confidence UX spec
5. template-launcher UX spec
