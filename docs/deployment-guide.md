# maoclaw Deployment Guide

This guide explains how to install, run, package, and deploy the current open-source `maoclaw` surfaces.

Official website:

- `https://xinxiang.xin`

## Deployment Modes

`maoclaw` currently supports four practical deployment shapes.

### 1. Local CLI install

Best for:

- individual developers
- terminal-first usage
- quick evaluation
- migration from an existing `pi` workflow

Install with the release installer:

```bash
curl -fsSL "https://raw.githubusercontent.com/miounet11/maoclaw/main/install.sh?$(date +%s)" | bash
```

After install:

```bash
pi --version
pi --help
```

### 2. Version-pinned rollout

Best for:

- team rollout
- CI images
- reproducible internal evaluation
- controlled upgrade windows

```bash
curl -fsSL "https://raw.githubusercontent.com/miounet11/maoclaw/main/install.sh?$(date +%s)" | \
  bash -s -- --version v0.1.8 --yes --easy-mode
```

### 3. Source build

Best for:

- contributors
- air-gapped environments
- custom packaging
- local patching or forked builds

```bash
git clone https://github.com/miounet11/maoclaw.git
cd maoclaw
cargo build --release

./target/release/pi --version
./target/release/maoclaw --version
```

### 4. macOS desktop packaging

Best for:

- a branded desktop distribution
- non-terminal-first users on macOS
- internal product demos

Build the desktop binary and app:

```bash
cargo build --release --bin pi_desktop --features desktop-iced
bash scripts/build_macos_app.sh --install
```

Build the installer package:

```bash
bash scripts/build_macos_pkg.sh
```

Outputs:

- `~/Applications/maoclaw.app`
- `dist/maoclaw.app`
- `dist/maoclaw.pkg`

## Runtime Surfaces

### Interactive CLI

```bash
pi
pi "Summarize this repository"
pi --continue
```

### Print / automation mode

```bash
pi -p "Explain this error"
pi --mode json -p "Return a structured summary"
```

### RPC backend mode

Best for IDEs, wrappers, or external clients.

```bash
pi --mode rpc
```

This exposes a line-delimited JSON protocol over stdin/stdout.
Use [rpc.md](rpc.md) for the message contract.

### Desktop runtime

The desktop app uses the same Rust runtime and provider/session model as the CLI.
It is a product surface, not a different backend.

## Provider Setup

The quickest path is environment variables.

Examples:

```bash
export ANTHROPIC_API_KEY="your-key"
export OPENAI_API_KEY="your-key"
export GOOGLE_API_KEY="your-key"
export AZURE_OPENAI_API_KEY="your-key"
```

Then verify available providers/models:

```bash
pi --list-providers
pi --list-models
```

For provider-specific setup details:

- [providers.md](providers.md)
- [provider-auth-troubleshooting.md](provider-auth-troubleshooting.md)

## Skills, Themes, and Prompt Templates

`maoclaw` is designed to be configurable without rewriting the runtime.

User/project resources are loaded from the documented `.pi` and `~/.pi/agent` paths.

Common resource types:

- skills
- prompt templates
- themes
- extensions

Relevant docs:

- [skills.md](skills.md)
- [prompt-templates.md](prompt-templates.md)
- [themes.md](themes.md)
- [extension-architecture.md](extension-architecture.md)

## Recommended Deployment Patterns

### Pattern A: Solo developer workstation

- install with `install.sh`
- set one provider API key
- use `pi` interactively
- use `--continue` and sessions as the default workflow

### Pattern B: Team canary rollout

- pin a release with `install.sh --version`
- validate install, auth, and `pi --help`
- smoke test a few real repositories
- promote only after the rollout checklist in [releasing.md](releasing.md) is satisfied

### Pattern C: IDE or wrapper integration

- run `pi --mode rpc`
- keep your UI as a separate process
- render prompts/state/events client-side
- use RPC as the stable integration seam instead of scraping TUI output

### Pattern D: Branded macOS distribution

- build `pi_desktop`
- bundle with `scripts/build_macos_app.sh`
- package with `scripts/build_macos_pkg.sh`
- distribute `maoclaw.app` / `maoclaw.pkg`

## Open Source Release Checklist

Before publishing the repo or a release, make sure the public surface is coherent:

1. `README.md` matches the current shipped product story.
2. `STATUS.md` matches what is actually proven.
3. Quick start, FAQ, support scope, and known limitations do not contradict each other.
4. `install.sh` points at `miounet11/maoclaw`.
5. `docs/releasing.md` matches the current package/release identity.
6. Release artifacts build successfully for the intended targets.

## Current Recommendation

For open-source launch, present `maoclaw` as:

- a serious Rust AI coding agent runtime
- a terminal-first product with an optional desktop shell
- a product-ready runtime for local use and external integration
- a project with explicit release boundaries instead of inflated parity claims

That positioning is strong enough to publish and honest enough to defend.
