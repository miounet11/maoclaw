# Installation and Deployment

This page explains how to install, upgrade, build from source, and package `maoclaw`.

## 1. Local Install

```bash
curl -fsSL "https://raw.githubusercontent.com/miounet11/maoclaw/main/install.sh?$(date +%s)" | bash
```

After install:

```bash
pi --version
pi --help
```

## 2. Version-Pinned Rollout

Useful for team evaluation, CI images, and reproducible rollout:

```bash
curl -fsSL "https://raw.githubusercontent.com/miounet11/maoclaw/main/install.sh?$(date +%s)" | \
  bash -s -- --version v0.1.8 --yes --easy-mode
```

## 3. Build From Source

```bash
git clone https://github.com/miounet11/maoclaw.git
cd maoclaw
cargo build --release

./target/release/pi --version
./target/release/maoclaw --version
```

## 4. macOS Desktop Packaging

Build the desktop binary and `.app` bundle:

```bash
cargo build --release --bin pi_desktop --features desktop-iced
bash scripts/build_macos_app.sh --install
```

Build the installer package:

```bash
bash scripts/build_macos_pkg.sh
```

Typical outputs:

- `~/Applications/maoclaw.app`
- `dist/maoclaw.app`
- `dist/maoclaw.pkg`

## 5. Upgrade Guidance

- individual users: upgrade with the latest installer
- teams: pin versions and validate gradually
- before release: review both [Changelog](changelog.md) and root [CHANGELOG.md](../../CHANGELOG.md)

## 6. Deployment Shapes

- local CLI install for individual developers
- version-pinned rollout for teams
- source build for contributors or custom distribution
- macOS desktop packaging for demos and GUI-oriented delivery
