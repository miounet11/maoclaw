#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_NAME="maoclaw.app"
APP_OUTPUT="${ROOT}/dist/${APP_NAME}"
PKG_OUTPUT="${ROOT}/dist/maoclaw.pkg"
LEGACY_PKG_OUTPUT="${ROOT}/dist/Pi Desktop.pkg"
PI_BINARY=""
APP_SIGN_IDENTITY="${MACOS_APP_SIGN_IDENTITY:-${PI_MACOS_APP_SIGN_IDENTITY:-}}"
PKG_SIGN_IDENTITY="${MACOS_PKG_SIGN_IDENTITY:-${PI_MACOS_PKG_SIGN_IDENTITY:-}}"
APP_VERSION="$(sed -nE 's/^version = "(.*)"/\1/p' "${ROOT}/Cargo.toml" | head -n 1)"

if [ -z "${APP_VERSION}" ]; then
  echo "Failed to determine app version from Cargo.toml." >&2
  exit 1
fi

absolute_path() {
  local target="$1"
  local target_dir=""
  local target_base=""
  target_dir="$(cd "$(dirname "${target}")" && pwd)"
  target_base="$(basename "${target}")"
  printf '%s/%s\n' "${target_dir}" "${target_base}"
}

capture_cli_binary_version() {
  local binary_path="$1"
  [ -x "${binary_path}" ] || return 1
  "${binary_path}" --version 2>/dev/null | head -n 1 | tr -d '\r'
}

app_bundle_matches_version() {
  local app_path="$1"
  local info_plist="${app_path}/Contents/Info.plist"
  local pi_binary="${app_path}/Contents/Resources/bin/pi"
  local desktop_binary="${app_path}/Contents/Resources/bin/pi_desktop"
  local bundle_version=""

  [ -f "${info_plist}" ] || return 1
  bundle_version="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "${info_plist}" 2>/dev/null || true)"
  [ "${bundle_version}" = "${APP_VERSION}" ] || return 1

  if [ -x "${pi_binary}" ]; then
    capture_cli_binary_version "${pi_binary}" | grep -Fq "${APP_VERSION}" || return 1
  else
    return 1
  fi

  [ -x "${desktop_binary}" ] || return 1

  return 0
}

sync_legacy_pkg_copy() {
  if [ "$(absolute_path "${PKG_OUTPUT}")" != "${ROOT}/dist/maoclaw.pkg" ]; then
    return 0
  fi

  if [ -e "${LEGACY_PKG_OUTPUT}" ]; then
    legacy_backup="${LEGACY_PKG_OUTPUT}.bak.$(date +%Y%m%d%H%M%S)"
    mv "${LEGACY_PKG_OUTPUT}" "${legacy_backup}"
    echo "Existing legacy dist package moved to ${legacy_backup}"
  fi

  cp "${PKG_OUTPUT}" "${LEGACY_PKG_OUTPUT}"
  echo "Refreshed compatibility package at ${LEGACY_PKG_OUTPUT}"
}

usage() {
  cat <<'USAGE'
Usage: scripts/build_macos_pkg.sh [options]

Options:
  --pi-binary PATH         Path to the Pi binary to bundle
  --app PATH               Path to an existing .app bundle to package
  --output PATH            Output package path (default: dist/maoclaw.pkg)
  --app-sign-identity NAME codesign identity passed to build_macos_app.sh when app build is needed
  --sign-identity NAME     pkgbuild signing identity (Developer ID Installer)
  -h, --help               Show this help
USAGE
}

while [ $# -gt 0 ]; do
  case "$1" in
    --pi-binary)
      PI_BINARY="$2"
      shift 2
      ;;
    --app)
      APP_OUTPUT="$2"
      shift 2
      ;;
    --output)
      PKG_OUTPUT="$2"
      shift 2
      ;;
    --app-sign-identity)
      APP_SIGN_IDENTITY="$2"
      shift 2
      ;;
    --sign-identity)
      PKG_SIGN_IDENTITY="$2"
      shift 2
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
  echo "This packaging script only supports macOS." >&2
  exit 1
fi

if ! command -v pkgbuild >/dev/null 2>&1; then
  echo "pkgbuild is required to create a macOS installer package." >&2
  exit 1
fi

if [ ! -d "${APP_OUTPUT}" ] || ! app_bundle_matches_version "${APP_OUTPUT}"; then
  build_args=("${ROOT}/scripts/build_macos_app.sh" "--output" "${APP_OUTPUT}")
  if [ -n "${PI_BINARY}" ]; then
    build_args+=("--pi-binary" "${PI_BINARY}")
  fi
  if [ -n "${APP_SIGN_IDENTITY}" ]; then
    build_args+=("--sign-identity" "${APP_SIGN_IDENTITY}")
  fi
  bash "${build_args[@]}"
fi

pkgbuild_args=(
  --component "${APP_OUTPUT}" \
  --identifier "com.maoclaw.desktop" \
  --version "${APP_VERSION}" \
  --install-location "/Applications"
)

if [ -n "${PKG_SIGN_IDENTITY}" ]; then
  pkgbuild_args+=(--sign "${PKG_SIGN_IDENTITY}")
fi

pkgbuild \
  "${pkgbuild_args[@]}" \
  "${PKG_OUTPUT}"

sync_legacy_pkg_copy

echo "Built macOS installer package at ${PKG_OUTPUT}"
