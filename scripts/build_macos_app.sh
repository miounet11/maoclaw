#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_NAME="maoclaw.app"
APP_DIR="${ROOT}/dist/${APP_NAME}"
LEGACY_APP_NAME="Pi Desktop.app"
LEGACY_APP_DIR="${ROOT}/dist/${LEGACY_APP_NAME}"
PI_BINARY=""
PI_DESKTOP_BINARY=""
INSTALL_APP=0
APP_VERSION="$(sed -nE 's/^version = "(.*)"/\1/p' "${ROOT}/Cargo.toml" | head -n 1)"

if [ -z "${APP_VERSION}" ]; then
  echo "Failed to determine app version from Cargo.toml." >&2
  exit 1
fi

capture_cli_binary_version() {
  local binary_path="$1"
  [ -x "${binary_path}" ] || return 1
  "${binary_path}" --version 2>/dev/null | head -n 1 | tr -d '\r'
}

absolute_path() {
  local target="$1"
  local target_dir=""
  local target_base=""
  target_dir="$(cd "$(dirname "${target}")" && pwd)"
  target_base="$(basename "${target}")"
  printf '%s/%s\n' "${target_dir}" "${target_base}"
}

binary_is_fresh() {
  local binary_path="$1"
  [ -x "${binary_path}" ] || return 1
  [ "${binary_path}" -nt "${ROOT}/Cargo.toml" ]
}

build_release_binary() {
  local label="$1"
  shift
  echo "Building fresh ${label} release binary..."
  cargo build --release "$@"
}

resolve_cargo_target_root() {
  local target_root="${CARGO_TARGET_DIR:-${ROOT}/target}"
  if [ "${target_root#/}" = "${target_root}" ]; then
    target_root="${ROOT}/${target_root}"
  fi
  printf '%s\n' "${target_root}"
}

ensure_binary_version_matches() {
  local label="$1"
  local binary_path="$2"
  local version_line=""
  version_line="$(capture_cli_binary_version "${binary_path}" || true)"
  if ! printf '%s\n' "${version_line}" | grep -Fq "${APP_VERSION}"; then
    echo "${label} binary ${binary_path} reports '${version_line:-unknown}' but Cargo.toml expects ${APP_VERSION}. Rebuild before packaging." >&2
    exit 1
  fi
}

ensure_binary_is_fresh() {
  local label="$1"
  local binary_path="$2"
  if ! binary_is_fresh "${binary_path}"; then
    echo "${label} binary ${binary_path} predates Cargo.toml version ${APP_VERSION}. Rebuild before packaging." >&2
    exit 1
  fi
}

usage() {
  cat <<'USAGE'
Usage: scripts/build_macos_app.sh [options]

Options:
  --pi-binary PATH         Path to the Pi CLI binary to bundle
  --pi-desktop-binary PATH Path to the pi_desktop (iced) binary to bundle
  --output PATH      Output .app bundle path (default: dist/maoclaw.app)
  --install          Copy the built app into ~/Applications
  -h, --help         Show this help
USAGE
}

while [ $# -gt 0 ]; do
  case "$1" in
    --pi-binary)
      PI_BINARY="$2"
      shift 2
      ;;
    --pi-desktop-binary)
      PI_DESKTOP_BINARY="$2"
      shift 2
      ;;
    --output)
      APP_DIR="$2"
      shift 2
      ;;
    --install)
      INSTALL_APP=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if [ "$(uname -s)" != "Darwin" ]; then
  echo "This build script only supports macOS." >&2
  exit 1
fi

if ! command -v swiftc >/dev/null 2>&1; then
  echo "swiftc is required to build the macOS app bundle." >&2
  exit 1
fi

if [ -z "${PI_BINARY}" ]; then
  build_release_binary "pi" --bin pi
  PI_BINARY="$(resolve_cargo_target_root)/release/pi"
fi

if [ -z "${PI_BINARY}" ] || [ ! -x "${PI_BINARY}" ]; then
  echo "Provide an executable Pi binary with --pi-binary PATH that matches version ${APP_VERSION}." >&2
  exit 1
fi
ensure_binary_version_matches "Pi" "${PI_BINARY}"

if [ -z "${PI_DESKTOP_BINARY}" ]; then
  build_release_binary "pi_desktop" --bin pi_desktop --features desktop-iced
  PI_DESKTOP_BINARY="$(resolve_cargo_target_root)/release/pi_desktop"
fi

if [ -z "${PI_DESKTOP_BINARY}" ] || [ ! -x "${PI_DESKTOP_BINARY}" ]; then
  echo "Provide an executable pi_desktop binary with --pi-desktop-binary PATH built after the current Cargo.toml version ${APP_VERSION}." >&2
  echo "Hint: cargo build --release --bin pi_desktop --features desktop-iced" >&2
  exit 1
fi
ensure_binary_is_fresh "pi_desktop" "${PI_DESKTOP_BINARY}"

sync_legacy_dist_app_copy() {
  if [ "$(absolute_path "${APP_DIR}")" != "${ROOT}/dist/${APP_NAME}" ]; then
    return 0
  fi

  if [ -e "${LEGACY_APP_DIR}" ]; then
    legacy_backup="${LEGACY_APP_DIR}.bak.$(date +%Y%m%d%H%M%S)"
    mv "${LEGACY_APP_DIR}" "${legacy_backup}"
    echo "Existing legacy dist app moved to ${legacy_backup}"
  fi

  cp -R "${APP_DIR}" "${LEGACY_APP_DIR}"
  echo "Refreshed compatibility copy at ${LEGACY_APP_DIR}"
}

APP_CONTENTS="${APP_DIR}/Contents"
APP_MACOS="${APP_CONTENTS}/MacOS"
APP_RESOURCES="${APP_CONTENTS}/Resources"
APP_BIN="${APP_RESOURCES}/bin"
APP_UI="${APP_RESOURCES}/ui"
APP_SKILL_CATALOG="${APP_RESOURCES}/skill-catalog"
MODULE_CACHE_DIR="${TMPDIR:-/tmp}/pi-desktop-swift-module-cache"

if [ -e "${APP_DIR}" ]; then
  backup_path="${APP_DIR}.bak.$(date +%Y%m%d%H%M%S)"
  mv "${APP_DIR}" "${backup_path}"
  echo "Existing app bundle moved to ${backup_path}"
fi
mkdir -p "${APP_MACOS}" "${APP_BIN}" "${APP_UI}" "${APP_SKILL_CATALOG}"
mkdir -p "${MODULE_CACHE_DIR}"
export CLANG_MODULE_CACHE_PATH="${MODULE_CACHE_DIR}"

swiftc \
  -O \
  -module-cache-path "${MODULE_CACHE_DIR}" \
  -framework AppKit \
  -framework AVFoundation \
  -framework ApplicationServices \
  -framework CoreGraphics \
  -framework CoreLocation \
  -framework Speech \
  -framework UserNotifications \
  -framework WebKit \
  "${ROOT}/desktop/macos/Sources/main.swift" \
  "${ROOT}/desktop/macos/Sources/PiDesktopModels.swift" \
  "${ROOT}/desktop/macos/Sources/PiDesktopBridge.swift" \
  "${ROOT}/desktop/macos/Sources/PiDesktopApp.swift" \
  -o "${APP_MACOS}/maoclaw"

cp "${ROOT}/desktop/macos/Info.plist" "${APP_CONTENTS}/Info.plist"
plutil -replace CFBundleShortVersionString -string "${APP_VERSION}" "${APP_CONTENTS}/Info.plist"
plutil -replace CFBundleVersion -string "${APP_VERSION}" "${APP_CONTENTS}/Info.plist"
cp "${PI_BINARY}" "${APP_BIN}/pi"
cp "${PI_DESKTOP_BINARY}" "${APP_BIN}/pi_desktop"
chmod 0755 "${APP_BIN}/pi" "${APP_BIN}/pi_desktop" "${APP_MACOS}/maoclaw"
cp "${ROOT}/desktop/macos/Resources/index.html" "${APP_UI}/index.html"
cp "${ROOT}/desktop/macos/Resources/styles.css" "${APP_UI}/styles.css"
cp "${ROOT}/desktop/macos/Resources/app.js" "${APP_UI}/app.js"
cp "${ROOT}/desktop/macos/Resources/desktop-v2.css" "${APP_UI}/desktop-v2.css"
cp "${ROOT}/desktop/macos/Resources/desktop-v2.js" "${APP_UI}/desktop-v2.js"
cp "${ROOT}/desktop/macos/Resources/skill_catalog.tsv" "${APP_RESOURCES}/skill_catalog.tsv"
cp "${ROOT}/desktop/macos/Resources/setup-presets.json" "${APP_RESOURCES}/setup-presets.json"

while IFS='|' read -r catalog_id _title _description _tags source_path; do
  [ -n "${catalog_id}" ] || continue
  source_root="${ROOT}/${source_path}"
  if [ -d "${source_root}" ]; then
    cp -R "${source_root}" "${APP_SKILL_CATALOG}/${catalog_id}"
  else
    echo "warning: skill catalog source missing for ${catalog_id}: ${source_root}" >&2
  fi
done < "${ROOT}/desktop/macos/Resources/skill_catalog.tsv"

sync_legacy_dist_app_copy

if [ "${INSTALL_APP}" -eq 1 ]; then
  mkdir -p "${HOME}/Applications"
  install_target="${HOME}/Applications/${APP_NAME}"
  if [ -e "${install_target}" ]; then
    install_backup="${install_target}.bak.$(date +%Y%m%d%H%M%S)"
    mv "${install_target}" "${install_backup}"
    echo "Existing installed app moved to ${install_backup}"
  fi
  cp -R "${APP_DIR}" "${install_target}"
  echo "Installed app to ${HOME}/Applications/${APP_NAME}"

  legacy_target="${HOME}/Applications/${LEGACY_APP_NAME}"
  if [ -e "${legacy_target}" ]; then
    legacy_backup="${legacy_target}.bak.$(date +%Y%m%d%H%M%S)"
    mv "${legacy_target}" "${legacy_backup}"
    echo "Existing legacy app moved to ${legacy_backup}"
  fi
  cp -R "${APP_DIR}" "${legacy_target}"
  echo "Installed compatibility copy to ${HOME}/Applications/${LEGACY_APP_NAME}"
else
  echo "Built app at ${APP_DIR}"
fi
