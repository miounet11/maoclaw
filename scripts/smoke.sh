#!/usr/bin/env bash
# scripts/smoke.sh — Fast local smoke suite with structured JSONL logs.
#
# Runs a curated subset of unit, VCR, and E2E tests designed to catch
# common regressions in under 60 seconds on a development machine.
#
# Usage:
#   ./scripts/smoke.sh                    # default: all smoke targets
#   ./scripts/smoke.sh --skip-lint        # skip cargo fmt/clippy checks
#   ./scripts/smoke.sh --only unit        # only unit smoke targets
#   ./scripts/smoke.sh --only vcr         # only VCR smoke targets
#   ./scripts/smoke.sh --require-rch      # require remote offload for heavy cargo steps
#   ./scripts/smoke.sh --no-rch           # force local cargo execution
#   ./scripts/smoke.sh --verbose          # show full cargo test output
#   ./scripts/smoke.sh --json             # machine-readable JSON summary to stdout
#
# Environment:
#   SMOKE_ARTIFACT_DIR   Override artifact output directory
#   CARGO_TARGET_DIR     Override cargo target directory
#   SMOKE_TIMEOUT        Per-target timeout in seconds (default: 30)
#   SMOKE_CARGO_RUNNER   Cargo runner mode: rch | auto | local (default: auto)
#   SMOKE_TARGET_PROFILE Target set: core | extended (default: core)
#   SMOKE_LINT_PROFILE   Lint scope: fast | full (default: fast)
#   SMOKE_CONTINUE_AFTER_LINT_FAIL  1 to continue into build/tests after lint failure (default: 0)
#
# Output:
#   $SMOKE_ARTIFACT_DIR/smoke_log.jsonl          Structured event log
#   $SMOKE_ARTIFACT_DIR/smoke_summary.json       Machine-readable summary
#   $SMOKE_ARTIFACT_DIR/<target>/output.log      Per-target output
#
# See docs/testing-policy.md "Fast Local Smoke Suite" for design rationale.

set -eo pipefail

# Bash 3.2 (the stock shell on macOS) treats empty-array expansions as
# unbound variables under `set -u`, which breaks this runner because it relies
# on arrays that may legitimately be empty at different phases.
if [[ ${BASH_VERSINFO[0]:-0} -ge 4 ]]; then
    set -u
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

# ─── Configuration ────────────────────────────────────────────────────────────

TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
ARTIFACT_DIR="${SMOKE_ARTIFACT_DIR:-$PROJECT_ROOT/tests/smoke_results/$TIMESTAMP}"
TIMEOUT="${SMOKE_TIMEOUT:-30}"
SKIP_LINT=false
ONLY_SUITE=""
VERBOSE=false
JSON_OUTPUT=false
CARGO_RUNNER_REQUEST="${SMOKE_CARGO_RUNNER:-auto}" # rch | auto | local
CARGO_RUNNER_MODE="local"
declare -a CARGO_RUNNER_ARGS=("cargo")
SMOKE_TARGET_PROFILE="${SMOKE_TARGET_PROFILE:-core}" # core | extended
SMOKE_LINT_PROFILE="${SMOKE_LINT_PROFILE:-fast}" # fast | full
SMOKE_CONTINUE_AFTER_LINT_FAIL="${SMOKE_CONTINUE_AFTER_LINT_FAIL:-0}" # 0 | 1
SEEN_NO_RCH=false
SEEN_REQUIRE_RCH=false

run_with_timeout() {
    local timeout_seconds="$1"
    shift

    if command -v timeout >/dev/null 2>&1; then
        timeout "${timeout_seconds}s" "$@"
        return $?
    fi

    if command -v gtimeout >/dev/null 2>&1; then
        gtimeout "${timeout_seconds}s" "$@"
        return $?
    fi

    local python_cmd=""
    if command -v python3 >/dev/null 2>&1; then
        python_cmd="python3"
    elif command -v python >/dev/null 2>&1; then
        python_cmd="python"
    fi

    if [[ -n "$python_cmd" ]]; then
        "$python_cmd" - "$timeout_seconds" "$@" <<'PY'
import subprocess
import sys

timeout = float(sys.argv[1])
command = sys.argv[2:]

if not command:
    print("run_with_timeout received no command", file=sys.stderr)
    raise SystemExit(2)

try:
    completed = subprocess.run(command, timeout=timeout)
except subprocess.TimeoutExpired:
    raise SystemExit(124)

raise SystemExit(completed.returncode)
PY
        return $?
    fi

    echo "No timeout implementation available (expected timeout, gtimeout, python3, or python)." >&2
    return 127
}

# ─── Smoke Target Selection ──────────────────────────────────────────────────
#
# Curated subset covering critical paths:
#   core: highest-signal fast loop
#   extended: broader smoke coverage while staying below quick/full
#   (No E2E in smoke — those require tmux/providers and are too slow)

SMOKE_CORE_UNIT_TARGETS=(
    model_serialization
    config_precedence
    session_conformance
    compaction
)

SMOKE_CORE_VCR_TARGETS=(
    provider_streaming
    error_handling
    http_client
    sse_strict_compliance
)

SMOKE_EXTENDED_UNIT_TARGETS=(
    "${SMOKE_CORE_UNIT_TARGETS[@]}"
    error_types
    security_budgets
)

SMOKE_EXTENDED_VCR_TARGETS=(
    "${SMOKE_CORE_VCR_TARGETS[@]}"
    model_registry
    provider_factory
)

print_target_profile_help() {
    cat <<EOF
Smoke target profiles:
  core
    unit: ${SMOKE_CORE_UNIT_TARGETS[*]}
    vcr:  ${SMOKE_CORE_VCR_TARGETS[*]}

  extended
    unit: ${SMOKE_EXTENDED_UNIT_TARGETS[*]}
    vcr:  ${SMOKE_EXTENDED_VCR_TARGETS[*]}
EOF
}

# ─── CLI Parsing ──────────────────────────────────────────────────────────────

while [[ $# -gt 0 ]]; do
    case "$1" in
        --skip-lint)
            SKIP_LINT=true
            shift
            ;;
        --only)
            shift
            ONLY_SUITE="$1"
            shift
            ;;
        --verbose)
            VERBOSE=true
            shift
            ;;
        --no-rch)
            if [[ "$SEEN_REQUIRE_RCH" == true ]]; then
                echo "Cannot combine --no-rch and --require-rch" >&2
                exit 1
            fi
            SEEN_NO_RCH=true
            CARGO_RUNNER_REQUEST="local"
            shift
            ;;
        --require-rch)
            if [[ "$SEEN_NO_RCH" == true ]]; then
                echo "Cannot combine --require-rch and --no-rch" >&2
                exit 1
            fi
            SEEN_REQUIRE_RCH=true
            CARGO_RUNNER_REQUEST="rch"
            shift
            ;;
        --json)
            JSON_OUTPUT=true
            shift
            ;;
        --help|-h)
            python3 - "$0" <<'PY'
import sys

path = sys.argv[1]
started = False
with open(path, encoding="utf-8") as handle:
    for line in handle:
        if not started:
            if line.startswith("#!"):
                continue
            if line.startswith("#"):
                started = True
            else:
                continue
        if line.strip() == "#":
            break
        if line.startswith("# "):
            print(line[2:].rstrip())
        elif line.startswith("#"):
            print(line[1:].rstrip())
PY
            echo ""
            print_target_profile_help
            exit 0
            ;;
        *)
            echo "Unknown option: $1" >&2
            echo "Run $0 --help for usage." >&2
            exit 1
            ;;
    esac
done

# ─── Cargo Runner Resolution ──────────────────────────────────────────────────

if [[ "$CARGO_RUNNER_REQUEST" != "rch" && "$CARGO_RUNNER_REQUEST" != "auto" && "$CARGO_RUNNER_REQUEST" != "local" ]]; then
    echo "Invalid SMOKE_CARGO_RUNNER value: $CARGO_RUNNER_REQUEST (expected: rch|auto|local)" >&2
    exit 2
fi

if [[ "$CARGO_RUNNER_REQUEST" == "rch" ]]; then
    if ! command -v rch >/dev/null 2>&1; then
        echo "SMOKE_CARGO_RUNNER=rch requested, but 'rch' is not available in PATH." >&2
        exit 2
    fi
    if ! rch check --quiet >/dev/null 2>&1; then
        echo "'rch check' failed; refusing heavy local cargo fallback. Fix rch or pass --no-rch." >&2
        exit 2
    fi
    CARGO_RUNNER_MODE="rch"
    CARGO_RUNNER_ARGS=("rch" "exec" "--" "cargo")
elif [[ "$CARGO_RUNNER_REQUEST" == "auto" ]] && command -v rch >/dev/null 2>&1; then
    if rch check --quiet >/dev/null 2>&1; then
        CARGO_RUNNER_MODE="rch"
        CARGO_RUNNER_ARGS=("rch" "exec" "--" "cargo")
    else
        echo "rch detected but unhealthy; auto mode will run cargo locally (set --require-rch to fail fast)." >&2
    fi
fi

# ─── Resolve target set ──────────────────────────────────────────────────────

TARGETS=()
TARGET_SUITES=()

case "$ONLY_SUITE" in
    unit)
        case "$SMOKE_TARGET_PROFILE" in
            core)
                TARGETS=("${SMOKE_CORE_UNIT_TARGETS[@]}")
                for _ in "${SMOKE_CORE_UNIT_TARGETS[@]}"; do TARGET_SUITES+=(unit); done
                ;;
            extended)
                TARGETS=("${SMOKE_EXTENDED_UNIT_TARGETS[@]}")
                for _ in "${SMOKE_EXTENDED_UNIT_TARGETS[@]}"; do TARGET_SUITES+=(unit); done
                ;;
            *)
                echo "Invalid SMOKE_TARGET_PROFILE value: $SMOKE_TARGET_PROFILE (expected: core|extended)" >&2
                exit 2
                ;;
        esac
        ;;
    vcr)
        case "$SMOKE_TARGET_PROFILE" in
            core)
                TARGETS=("${SMOKE_CORE_VCR_TARGETS[@]}")
                for _ in "${SMOKE_CORE_VCR_TARGETS[@]}"; do TARGET_SUITES+=(vcr); done
                ;;
            extended)
                TARGETS=("${SMOKE_EXTENDED_VCR_TARGETS[@]}")
                for _ in "${SMOKE_EXTENDED_VCR_TARGETS[@]}"; do TARGET_SUITES+=(vcr); done
                ;;
            *)
                echo "Invalid SMOKE_TARGET_PROFILE value: $SMOKE_TARGET_PROFILE (expected: core|extended)" >&2
                exit 2
                ;;
        esac
        ;;
    "")
        case "$SMOKE_TARGET_PROFILE" in
            core)
                TARGETS=("${SMOKE_CORE_UNIT_TARGETS[@]}" "${SMOKE_CORE_VCR_TARGETS[@]}")
                for _ in "${SMOKE_CORE_UNIT_TARGETS[@]}"; do TARGET_SUITES+=(unit); done
                for _ in "${SMOKE_CORE_VCR_TARGETS[@]}"; do TARGET_SUITES+=(vcr); done
                ;;
            extended)
                TARGETS=("${SMOKE_EXTENDED_UNIT_TARGETS[@]}" "${SMOKE_EXTENDED_VCR_TARGETS[@]}")
                for _ in "${SMOKE_EXTENDED_UNIT_TARGETS[@]}"; do TARGET_SUITES+=(unit); done
                for _ in "${SMOKE_EXTENDED_VCR_TARGETS[@]}"; do TARGET_SUITES+=(vcr); done
                ;;
            *)
                echo "Invalid SMOKE_TARGET_PROFILE value: $SMOKE_TARGET_PROFILE (expected: core|extended)" >&2
                exit 2
                ;;
        esac
        ;;
    *)
        echo "Unknown suite: $ONLY_SUITE (expected: unit, vcr)" >&2
        exit 1
        ;;
esac

# ─── Artifact setup ──────────────────────────────────────────────────────────

mkdir -p "$ARTIFACT_DIR"
LOG_FILE="$ARTIFACT_DIR/smoke_log.jsonl"
SUMMARY_FILE="$ARTIFACT_DIR/smoke_summary.json"
: > "$LOG_FILE"

emit_event() {
    local schema="$1"
    shift
    python3 -c "
import json, sys
from datetime import datetime, timezone
event = {'schema': '$schema', 'ts': datetime.now(timezone.utc).isoformat()}
for arg in sys.argv[1:]:
    k, _, v = arg.partition('=')
    # Try numeric conversion.
    try:
        v = int(v)
    except ValueError:
        try:
            v = float(v)
        except ValueError:
            pass
    event[k] = v
print(json.dumps(event, sort_keys=True))
" "$@" >> "$LOG_FILE"
}

emit_event "pi.smoke.session_start.v1" \
    "artifact_dir=$ARTIFACT_DIR" \
    "timestamp=$TIMESTAMP" \
    "skip_lint=$SKIP_LINT" \
    "only_suite=${ONLY_SUITE:-all}" \
    "target_count=${#TARGETS[@]}" \
    "target_profile=$SMOKE_TARGET_PROFILE" \
    "lint_profile=$SMOKE_LINT_PROFILE" \
    "continue_after_lint_fail=$SMOKE_CONTINUE_AFTER_LINT_FAIL" \
    "cargo_runner_request=$CARGO_RUNNER_REQUEST" \
    "cargo_runner_mode=$CARGO_RUNNER_MODE"

echo "──── Runner ────"
echo "  cargo runner: $CARGO_RUNNER_MODE (request=$CARGO_RUNNER_REQUEST)"
echo "  target set:   $SMOKE_TARGET_PROFILE"
echo "  lint scope:   $SMOKE_LINT_PROFILE"
echo "  lint fail:    $( [[ \"$SMOKE_CONTINUE_AFTER_LINT_FAIL\" == \"1\" ]] && echo keep-going || echo stop-early )"

run_split_clippy() {
    local log_file="$1"
    : > "$log_file"

    local -a labels=()
    case "$SMOKE_LINT_PROFILE" in
        fast)
            labels=("lib+bins" "tests")
            ;;
        full)
            labels=("lib+bins" "tests" "benches" "examples")
            ;;
        *)
            echo "Invalid SMOKE_LINT_PROFILE value: $SMOKE_LINT_PROFILE (expected: fast|full)" >&2
            return 2
            ;;
    esac
    local -a cmd=()
    for label in "${labels[@]}"; do
        echo "=== clippy slice: $label ===" >> "$log_file"
        case "$label" in
            "lib+bins")
                cmd=(clippy --lib --bins -- -D warnings)
                ;;
            "tests")
                cmd=(clippy --tests -- -D warnings)
                ;;
            "benches")
                cmd=(clippy --benches -- -D warnings)
                ;;
            "examples")
                cmd=(clippy --examples -- -D warnings)
                ;;
        esac

        if "${CARGO_RUNNER_ARGS[@]}" "${cmd[@]}" >> "$log_file" 2>&1; then
            echo "slice $label: PASS" >> "$log_file"
            echo >> "$log_file"
        else
            echo "slice $label: FAIL" >> "$log_file"
            echo >> "$log_file"
            return 1
        fi
    done

    return 0
}

# ─── Lint phase (optional) ────────────────────────────────────────────────────

LINT_OK=true
LINT_DURATION=0
STOP_AFTER_LINT_FAIL=false

if [[ "$SKIP_LINT" == false ]]; then
    echo "──── Lint ────"
    lint_start=$(date +%s)

    if cargo fmt --check > "$ARTIFACT_DIR/fmt.log" 2>&1; then
        echo "  fmt:    ok"
    else
        echo "  fmt:    FAIL (see $ARTIFACT_DIR/fmt.log)"
        LINT_OK=false
    fi

    if run_split_clippy "$ARTIFACT_DIR/clippy.log"; then
        echo "  clippy: ok"
    else
        echo "  clippy: FAIL (see $ARTIFACT_DIR/clippy.log)"
        LINT_OK=false
    fi

    lint_end=$(date +%s)
    LINT_DURATION=$((lint_end - lint_start))
    emit_event "pi.smoke.lint.v1" \
        "ok=$LINT_OK" \
        "duration_seconds=$LINT_DURATION"

    if [[ "$LINT_OK" == false && "$SMOKE_CONTINUE_AFTER_LINT_FAIL" != "1" ]]; then
        STOP_AFTER_LINT_FAIL=true
    fi
fi

# ─── Build phase (compile once, run many) ─────────────────────────────────────

BUILD_DURATION=0

# ─── Test phase ───────────────────────────────────────────────────────────────

PASSED=0
FAILED=0
SKIPPED=0
FAILED_NAMES=()
TARGET_RESULTS=()
TOTAL_TEST_DURATION=0
overall_start=$(date +%s)
if [[ "$STOP_AFTER_LINT_FAIL" == true ]]; then
    echo ""
    echo "Skipping build/tests because lint failed. Set SMOKE_CONTINUE_AFTER_LINT_FAIL=1 to keep going."
    emit_event "pi.smoke.build.v1" "duration_seconds=0" "status=skipped_after_lint_fail"
else
    echo "──── Build ────"
    build_start=$(date +%s)

    # Build all smoke test binaries in one cargo invocation to avoid per-target
    # recompilation. This is the main optimization that keeps smoke under 60s.
    build_args=()
    for target in "${TARGETS[@]}"; do
        if [[ -f "tests/${target}.rs" ]]; then
            build_args+=(--test "$target")
        fi
    done

    if "${CARGO_RUNNER_ARGS[@]}" test --no-run "${build_args[@]}" > "$ARTIFACT_DIR/build.log" 2>&1; then
        echo "  compile: ok"
    else
        echo "  compile: FAIL (see $ARTIFACT_DIR/build.log)"
        # Still attempt to run tests — some may have compiled.
    fi

    build_end=$(date +%s)
    BUILD_DURATION=$((build_end - build_start))
    echo "  build:   ${BUILD_DURATION}s"
    emit_event "pi.smoke.build.v1" "duration_seconds=$BUILD_DURATION"

    # ─── Test phase ───────────────────────────────────────────────────────────

    echo "──── Smoke Tests (${#TARGETS[@]} targets) ────"

    for i in "${!TARGETS[@]}"; do
        target="${TARGETS[$i]}"
        suite="${TARGET_SUITES[$i]}"
        target_dir="$ARTIFACT_DIR/$target"
        mkdir -p "$target_dir"
        output_file="$target_dir/output.log"

        # Check the test file exists.
        if [[ ! -f "tests/${target}.rs" ]]; then
            echo "  $target: SKIP (file missing)"
            ((SKIPPED++)) || true
            emit_event "pi.smoke.target.v1" \
                "target=$target" "suite=$suite" "status=skip" \
                "reason=file_missing" "duration_seconds=0"
            TARGET_RESULTS+=("{\"target\":\"$target\",\"suite\":\"$suite\",\"status\":\"skip\",\"duration_seconds\":0}")
            continue
        fi

        target_start=$(date +%s)

        # Run with timeout.
        set +e
        if [[ "$VERBOSE" == true ]]; then
            run_with_timeout "$TIMEOUT" "${CARGO_RUNNER_ARGS[@]}" test --test "$target" -- --test-threads=1 2>&1 | tee "$output_file"
            exit_code=${PIPESTATUS[0]}
        else
            run_with_timeout "$TIMEOUT" "${CARGO_RUNNER_ARGS[@]}" test --test "$target" -- --test-threads=1 > "$output_file" 2>&1
            exit_code=$?
        fi
        set -e

        target_end=$(date +%s)
        target_duration=$((target_end - target_start))
        TOTAL_TEST_DURATION=$((TOTAL_TEST_DURATION + target_duration))

        if [[ $exit_code -eq 0 ]]; then
            echo "  $target: ok (${target_duration}s)"
            ((PASSED++)) || true
            status="pass"
        elif [[ $exit_code -eq 124 ]]; then
            echo "  $target: TIMEOUT after ${TIMEOUT}s (see $output_file)"
            ((FAILED++)) || true
            FAILED_NAMES+=("$target")
            status="timeout"
        else
            echo "  $target: FAIL (exit $exit_code, see $output_file)"
            ((FAILED++)) || true
            FAILED_NAMES+=("$target")
            status="fail"
        fi

        emit_event "pi.smoke.target.v1" \
            "target=$target" "suite=$suite" "status=$status" \
            "exit_code=$exit_code" "duration_seconds=$target_duration"

        TARGET_RESULTS+=("{\"target\":\"$target\",\"suite\":\"$suite\",\"status\":\"$status\",\"exit_code\":$exit_code,\"duration_seconds\":$target_duration}")
    done
fi

overall_end=$(date +%s)
OVERALL_DURATION=$((overall_end - overall_start))

# ─── Summary ──────────────────────────────────────────────────────────────────

TOTAL=$((PASSED + FAILED + SKIPPED))
if [[ $TOTAL -gt 0 && $FAILED -eq 0 && "$LINT_OK" == true ]]; then
    VERDICT="pass"
else
    VERDICT="fail"
fi

# Build JSON array of target results.
results_json="["
first=true
for r in "${TARGET_RESULTS[@]}"; do
    if ! $first; then results_json+=","; fi
    results_json+="$r"
    first=false
done
results_json+="]"

# Build failed names JSON array.
failed_json="["
first=true
for name in "${FAILED_NAMES[@]}"; do
    if ! $first; then failed_json+=","; fi
    failed_json+="\"$name\""
    first=false
done
failed_json+="]"

cat > "$SUMMARY_FILE" <<ENDJSON
{
  "schema": "pi.smoke.summary.v1",
  "timestamp": "$TIMESTAMP",
  "verdict": "$VERDICT",
  "cargo_runner_request": "$CARGO_RUNNER_REQUEST",
  "cargo_runner_mode": "$CARGO_RUNNER_MODE",
  "lint_ok": $LINT_OK,
  "lint_duration_seconds": $LINT_DURATION,
  "build_duration_seconds": $BUILD_DURATION,
  "passed": $PASSED,
  "failed": $FAILED,
  "skipped": $SKIPPED,
  "total": $TOTAL,
  "failed_targets": $failed_json,
  "test_duration_seconds": $TOTAL_TEST_DURATION,
  "overall_duration_seconds": $OVERALL_DURATION,
  "timeout_per_target_seconds": $TIMEOUT,
  "artifact_dir": "$ARTIFACT_DIR",
  "targets": $results_json
}
ENDJSON

emit_event "pi.smoke.session_end.v1" \
    "verdict=$VERDICT" \
    "passed=$PASSED" \
    "failed=$FAILED" \
    "skipped=$SKIPPED" \
    "total=$TOTAL" \
    "test_duration_seconds=$TOTAL_TEST_DURATION" \
    "overall_duration_seconds=$OVERALL_DURATION"

# ─── Display ──────────────────────────────────────────────────────────────────

echo ""
echo "──── Summary ────"
echo "  Verdict:  $VERDICT"
echo "  Passed:   $PASSED / $TOTAL"
if [[ $FAILED -gt 0 ]]; then
    echo "  Failed:   $FAILED (${FAILED_NAMES[*]})"
fi
if [[ $SKIPPED -gt 0 ]]; then
    echo "  Skipped:  $SKIPPED"
fi
echo "  Duration: ${OVERALL_DURATION}s (tests: ${TOTAL_TEST_DURATION}s)"
echo ""
echo "  Artifacts: $ARTIFACT_DIR"
echo "  Log:       $LOG_FILE"
echo "  Summary:   $SUMMARY_FILE"

echo ""
echo "──── Recommended Next Step ────"
if [[ "$VERDICT" == "pass" ]]; then
    echo "  Safe next step: ./verify --profile quick"
    if [[ "$SMOKE_TARGET_PROFILE" == "core" ]]; then
        echo "  For broader smoke coverage first, run: SMOKE_TARGET_PROFILE=extended ./verify --profile smoke"
    fi
    echo "  Use full ./verify only if your change touched runtime wiring, sessions, extensions, TUI, or RPC."
elif [[ "$LINT_OK" == false && $FAILED -eq 0 ]]; then
    echo "  Fix formatting/lint issues first, then rerun: ./verify --profile smoke"
else
    echo "  Inspect failed target logs above, fix the regression, then rerun: ./verify --profile smoke"
    echo "  Escalate to ./verify --profile quick only after smoke is green."
fi

if [[ "$JSON_OUTPUT" == true ]]; then
    cat "$SUMMARY_FILE"
fi

if [[ $FAILED -gt 0 ]]; then
    echo ""
    echo "Verbose logs for failed targets:"
    for name in "${FAILED_NAMES[@]}"; do
        echo "  $ARTIFACT_DIR/$name/output.log"
    done
fi

# Exit with failure if any test failed or lint failed.
if [[ "$VERDICT" == "fail" ]]; then
    exit 1
fi
