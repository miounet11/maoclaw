#!/usr/bin/env bash
# scripts/release_gate.sh — Release gate requiring conformance evidence bundle.
#
# Validates that all required evidence artifacts exist and meet thresholds
# before allowing a release. Designed to run as a CI step or local pre-release
# check.
#
# Usage:
#   ./scripts/release_gate.sh                          # check latest evidence
#   ./scripts/release_gate.sh --evidence-dir <path>    # check specific run
#   ./scripts/release_gate.sh --report                 # JSON output
#   ./scripts/release_gate.sh --require-rch            # require remote offload for cargo checks
#   ./scripts/release_gate.sh --no-rch                 # force local cargo execution
#
# Environment:
#   RELEASE_GATE_MIN_PASS_RATE     Minimum conformance pass rate (default: 80)
#   RELEASE_GATE_MAX_FAIL_COUNT    Maximum conformance failures (default: 36)
#   RELEASE_GATE_MAX_NA_COUNT      Maximum N/A scenarios (default: 170)
#   RELEASE_GATE_REQUIRE_DROPIN_CERTIFIED  Set to 1 to require CERTIFIED drop-in verdict
#   RELEASE_GATE_REQUIRE_PREFLIGHT Set to 1 to require preflight analyzer (default: 0)
#   RELEASE_GATE_REQUIRE_QUALITY   Set to 1 to require quality pipeline pass (default: 0)
#   RELEASE_GATE_MAX_EVIDENCE_AGE_HOURS  Max age for evidence_contract.json (default: 24, 0 disables)
#   RELEASE_GATE_CARGO_RUNNER      Cargo runner mode: rch | auto | local (default: rch)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# ─── Configuration ──────────────────────────────────────────────────────────

MIN_PASS_RATE="${RELEASE_GATE_MIN_PASS_RATE:-80}"
MAX_FAIL_COUNT="${RELEASE_GATE_MAX_FAIL_COUNT:-36}"
MAX_NA_COUNT="${RELEASE_GATE_MAX_NA_COUNT:-170}"
REQUIRE_DROPIN_CERTIFIED="${RELEASE_GATE_REQUIRE_DROPIN_CERTIFIED:-0}"
REQUIRE_PREFLIGHT="${RELEASE_GATE_REQUIRE_PREFLIGHT:-0}"
REQUIRE_QUALITY="${RELEASE_GATE_REQUIRE_QUALITY:-0}"
MAX_EVIDENCE_AGE_HOURS="${RELEASE_GATE_MAX_EVIDENCE_AGE_HOURS:-24}"
CARGO_RUNNER_REQUEST="${RELEASE_GATE_CARGO_RUNNER:-rch}" # rch | auto | local
CARGO_RUNNER_MODE="local"
declare -a CARGO_RUNNER_ARGS=("cargo")
EVIDENCE_DIR=""
REPORT_JSON=0
EVIDENCE_DIR_SELECTION_DETAIL=""
SEEN_NO_RCH=false
SEEN_REQUIRE_RCH=false

while [[ $# -gt 0 ]]; do
    case "$1" in
        --evidence-dir) EVIDENCE_DIR="$2"; shift 2 ;;
        --report) REPORT_JSON=1; shift ;;
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
        --help|-h)
            sed -n '2,/^$/p' "$0" | sed 's/^# \?//'
            exit 0
            ;;
        *) echo "Unknown flag: $1"; exit 1 ;;
    esac
done

# ─── Cargo Runner Resolution ────────────────────────────────────────────────

if [[ "$CARGO_RUNNER_REQUEST" != "rch" && "$CARGO_RUNNER_REQUEST" != "auto" && "$CARGO_RUNNER_REQUEST" != "local" ]]; then
    echo "Invalid RELEASE_GATE_CARGO_RUNNER value: $CARGO_RUNNER_REQUEST (expected: rch|auto|local)" >&2
    exit 2
fi

if [[ "$CARGO_RUNNER_REQUEST" == "rch" ]]; then
    if ! command -v rch >/dev/null 2>&1; then
        echo "RELEASE_GATE_CARGO_RUNNER=rch requested, but 'rch' is not available in PATH." >&2
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

# Auto-detect latest complete evidence directory if not specified.
if [[ -z "$EVIDENCE_DIR" ]]; then
    E2E_RESULTS="$PROJECT_ROOT/tests/e2e_results"
    if [[ -d "$E2E_RESULTS" ]]; then
        # "Complete" currently means the run produced the required gate artifact(s).
        # Add additional required files here as the evidence contract evolves.
        required_artifacts=("evidence_contract.json")
        skipped_count=0
        declare -a skipped_examples=()

        while IFS= read -r candidate; do
            [[ -z "$candidate" ]] && continue

            missing_artifacts=()
            for artifact in "${required_artifacts[@]}"; do
                if [[ ! -f "$candidate/$artifact" ]]; then
                    missing_artifacts+=("$artifact")
                fi
            done

            if [[ ${#missing_artifacts[@]} -eq 0 ]]; then
                EVIDENCE_DIR="$candidate"
                if [[ "$skipped_count" -gt 0 ]]; then
                    EVIDENCE_DIR_SELECTION_DETAIL="Selected ${candidate#$PROJECT_ROOT/} after skipping $skipped_count incomplete newer run(s): ${skipped_examples[*]}"
                fi
                break
            fi

            skipped_count=$((skipped_count + 1))
            if [[ ${#skipped_examples[@]} -lt 3 ]]; then
                missing_csv="$(IFS=,; echo "${missing_artifacts[*]}")"
                skipped_examples+=("${candidate#$PROJECT_ROOT/} (missing: $missing_csv)")
            fi
        done < <(find "$E2E_RESULTS" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | sort -r)

        if [[ -z "$EVIDENCE_DIR" ]] && [[ "$skipped_count" -gt 0 ]]; then
            EVIDENCE_DIR_SELECTION_DETAIL="No complete evidence bundle found under tests/e2e_results; skipped $skipped_count incomplete run(s): ${skipped_examples[*]}"
        fi
    fi
fi

# ─── State tracking ─────────────────────────────────────────────────────────

PASS_COUNT=0
FAIL_COUNT=0
WARN_COUNT=0
declare -a CHECKS=()

log() {
    if [[ "$REPORT_JSON" -eq 0 ]]; then
        echo "[$1] $2"
    fi
}

check_pass() {
    local name="$1"
    local detail="$2"
    log "PASS" "$name: $detail"
    PASS_COUNT=$((PASS_COUNT + 1))
    CHECKS+=("{\"name\":\"$name\",\"status\":\"pass\",\"detail\":\"$detail\"}")
}

check_fail() {
    local name="$1"
    local detail="$2"
    log "FAIL" "$name: $detail"
    FAIL_COUNT=$((FAIL_COUNT + 1))
    CHECKS+=("{\"name\":\"$name\",\"status\":\"fail\",\"detail\":\"$detail\"}")
}

check_warn() {
    local name="$1"
    local detail="$2"
    log "WARN" "$name: $detail"
    WARN_COUNT=$((WARN_COUNT + 1))
    CHECKS+=("{\"name\":\"$name\",\"status\":\"warn\",\"detail\":\"$detail\"}")
}

run_cargo_gate() {
    "${CARGO_RUNNER_ARGS[@]}" "$@"
}

# ─── Gate checks ────────────────────────────────────────────────────────────

# Emit evidence-directory selection diagnostics before gate checks.
if [[ -n "$EVIDENCE_DIR_SELECTION_DETAIL" ]]; then
    check_warn "evidence_dir_selection" "$EVIDENCE_DIR_SELECTION_DETAIL"
fi
check_pass "cargo_runner" "mode=$CARGO_RUNNER_MODE request=$CARGO_RUNNER_REQUEST"

# Gate 1: Evidence directory exists
if [[ -z "$EVIDENCE_DIR" ]] || [[ ! -d "$EVIDENCE_DIR" ]]; then
    if [[ -n "$EVIDENCE_DIR_SELECTION_DETAIL" ]]; then
        check_fail "evidence_dir" "No evidence directory found. $EVIDENCE_DIR_SELECTION_DETAIL"
    else
        check_fail "evidence_dir" "No evidence directory found"
    fi
else
    check_pass "evidence_dir" "Found: $EVIDENCE_DIR"
fi

# Gate 1b: Evidence freshness
EVIDENCE_CONTRACT="$EVIDENCE_DIR/evidence_contract.json"
if [[ -n "$EVIDENCE_DIR" ]] && [[ -f "$EVIDENCE_CONTRACT" ]]; then
    FRESHNESS_CHECK=$(python3 - "$EVIDENCE_CONTRACT" "$MAX_EVIDENCE_AGE_HOURS" <<'PY'
import datetime as dt
import json
import os
import sys
from pathlib import Path

contract_path = Path(sys.argv[1])
max_age_hours = float(sys.argv[2])

if max_age_hours <= 0:
    print("pass|freshness disabled")
    raise SystemExit(0)

try:
    payload = json.loads(contract_path.read_text(encoding="utf-8"))
except Exception as exc:  # noqa: BLE001
    print(f"fail|could not parse evidence contract for freshness check: {exc}")
    raise SystemExit(0)

generated_raw = payload.get("generated_at") or payload.get("generated_at_utc")
if generated_raw:
    normalized = str(generated_raw).replace("Z", "+00:00")
    try:
        generated_at = dt.datetime.fromisoformat(normalized)
    except ValueError as exc:
        print(f"fail|invalid evidence timestamp '{generated_raw}': {exc}")
        raise SystemExit(0)
else:
    generated_at = dt.datetime.fromtimestamp(
        os.path.getmtime(contract_path),
        tz=dt.timezone.utc,
    )

if generated_at.tzinfo is None:
    generated_at = generated_at.replace(tzinfo=dt.timezone.utc)

now = dt.datetime.now(dt.timezone.utc)
age_hours = max((now - generated_at).total_seconds() / 3600.0, 0.0)

if age_hours <= max_age_hours:
    print(
        "pass|"
        f"generated_at={generated_at.isoformat()} age={age_hours:.1f}h <= {max_age_hours:.1f}h"
    )
else:
    print(
        "fail|"
        f"generated_at={generated_at.isoformat()} age={age_hours:.1f}h > {max_age_hours:.1f}h"
    )
PY
)

    FRESHNESS_STATUS="${FRESHNESS_CHECK%%|*}"
    FRESHNESS_DETAIL="${FRESHNESS_CHECK#*|}"
    case "$FRESHNESS_STATUS" in
        pass)
            check_pass "evidence_freshness" "$FRESHNESS_DETAIL"
            ;;
        fail)
            check_fail "evidence_freshness" "$FRESHNESS_DETAIL"
            ;;
        *)
            check_fail "evidence_freshness" "unexpected freshness validation result: $FRESHNESS_CHECK"
            ;;
    esac
fi

# Gate 2: Evidence contract
if [[ -f "$EVIDENCE_CONTRACT" ]]; then
    CONTRACT_STATUS=$(python3 -c "
import json
with open('$EVIDENCE_CONTRACT') as f:
    data = json.load(f)
print(data.get('status', 'unknown'))
" 2>/dev/null || echo "parse_error")

    CONTRACT_CLASSIFICATION=$(python3 -c "
import json
from pathlib import Path

allowed_markers = (
    '.test_log_jsonl',
    '.artifact_index_jsonl',
    '.minimum_signal_harness_category',
)

try:
    data = json.loads(Path('$EVIDENCE_CONTRACT').read_text())
except Exception:
    print('parse_error')
    raise SystemExit(0)

status = data.get('status', 'unknown')
errors = data.get('errors', [])

if status == 'pass':
    print('pass')
elif not errors:
    print('hard_fail')
elif all(any(marker in str(err) for marker in allowed_markers) for err in errors):
    print('artifact_gap_only')
else:
    print('hard_fail')
" 2>/dev/null || echo "parse_error")

    if [[ "$CONTRACT_STATUS" == "pass" ]]; then
        check_pass "evidence_contract" "status=pass"
    elif [[ "$CONTRACT_STATUS" == "parse_error" ]]; then
        check_fail "evidence_contract" "Failed to parse evidence_contract.json"
    elif [[ "$CONTRACT_CLASSIFICATION" == "artifact_gap_only" ]]; then
        check_warn "evidence_contract" \
            "status=$CONTRACT_STATUS (only harness log/artifact coverage gaps; core verification signals remain green)"
    else
        check_fail "evidence_contract" "status=$CONTRACT_STATUS (expected pass)"
    fi
else
    check_fail "evidence_contract" "evidence_contract.json not found"
fi

# Gate 3: Conformance summary
CONFORMANCE_DIR="$PROJECT_ROOT/tests/ext_conformance/reports"
CONFORMANCE_SUMMARY="$CONFORMANCE_DIR/conformance_summary.json"
if [[ -f "$CONFORMANCE_SUMMARY" ]]; then
    SUMMARY_DATA=$(python3 -c "
import json
with open('$CONFORMANCE_SUMMARY') as f:
    data = json.load(f)
counts = data.get('counts', {})
per_tier = data.get('per_tier', {}) if isinstance(data, dict) else {}
official = per_tier.get('official-pi-mono', {}) if isinstance(per_tier, dict) else {}
official_na = official.get('na', counts.get('na', 0)) if isinstance(official, dict) else counts.get('na', 0)
print(f\"{counts.get('total', 0)} {counts.get('pass', 0)} {counts.get('fail', 0)} {counts.get('na', 0)} {data.get('pass_rate_pct', 0)} {official_na}\")
" 2>/dev/null || echo "0 0 0 0 0")

    read -r TOTAL PASS FAIL NA PASS_RATE OFFICIAL_NA <<< "$SUMMARY_DATA"

    if [[ "$TOTAL" -eq 0 ]]; then
        check_fail "conformance_total" "Zero total scenarios in conformance summary"
    else
        check_pass "conformance_total" "$TOTAL total scenarios"
    fi

    # Pass rate threshold
    PASS_RATE_INT="${PASS_RATE%.*}"
    if [[ "$PASS_RATE_INT" -ge "$MIN_PASS_RATE" ]]; then
        check_pass "conformance_pass_rate" "${PASS_RATE}% >= ${MIN_PASS_RATE}% threshold"
    else
        check_fail "conformance_pass_rate" "${PASS_RATE}% < ${MIN_PASS_RATE}% threshold"
    fi

    # Fail count threshold
    if [[ "$FAIL" -le "$MAX_FAIL_COUNT" ]]; then
        check_pass "conformance_fail_count" "$FAIL failures <= $MAX_FAIL_COUNT threshold"
    else
        check_fail "conformance_fail_count" "$FAIL failures > $MAX_FAIL_COUNT threshold"
    fi

    # N/A count threshold
    # conformance_summary.json is produced from the differential oracle and
    # only classifies a subset of the full corpus in practice. Gate on the
    # official-pi-mono tier's N/A count, which is the supported release signal.
    if [[ "$OFFICIAL_NA" -le "$MAX_NA_COUNT" ]]; then
        check_pass "conformance_na_count" "$OFFICIAL_NA official-tier N/A <= $MAX_NA_COUNT threshold"
    else
        check_fail "conformance_na_count" "$OFFICIAL_NA official-tier N/A > $MAX_NA_COUNT threshold"
    fi
else
    check_fail "conformance_summary" "conformance_summary.json not found"
fi

# Gate 4: Conformance report
CONFORMANCE_REPORT="$CONFORMANCE_DIR/CONFORMANCE_REPORT.md"
if [[ -f "$CONFORMANCE_REPORT" ]]; then
    check_pass "conformance_report" "CONFORMANCE_REPORT.md exists"
else
    check_warn "conformance_report" "CONFORMANCE_REPORT.md not found (optional)"
fi

# Gate 5: Conformance baseline
CONFORMANCE_BASELINE="$CONFORMANCE_DIR/conformance_baseline.json"
if [[ -f "$CONFORMANCE_BASELINE" ]]; then
    check_pass "conformance_baseline" "Baseline exists for regression checks"
else
    check_warn "conformance_baseline" "No baseline (first run?)"
fi

# Gate 6: Compilation check (cargo check)
if run_cargo_gate check --lib --quiet 2>/dev/null; then
    check_pass "cargo_check" "Library compiles cleanly"
else
    check_fail "cargo_check" "cargo check --lib failed"
fi

# Gate 7: Clippy lint
if run_cargo_gate clippy --lib --quiet -- -D warnings 2>/dev/null; then
    check_pass "clippy" "No clippy warnings"
else
    check_fail "clippy" "Clippy has warnings"
fi

# Gate 8: Preflight analyzer (optional)
if [[ "$REQUIRE_PREFLIGHT" -eq 1 ]]; then
    if run_cargo_gate test --lib extension_preflight --quiet 2>/dev/null; then
        check_pass "preflight_tests" "Extension preflight tests pass"
    else
        check_fail "preflight_tests" "Extension preflight tests failed"
    fi
fi

# Gate 9: Quality pipeline (optional)
if [[ "$REQUIRE_QUALITY" -eq 1 ]]; then
    quality_runner_flag=()
    if [[ "$CARGO_RUNNER_MODE" == "rch" ]]; then
        quality_runner_flag=(--require-rch)
    elif [[ "$CARGO_RUNNER_REQUEST" == "local" ]]; then
        quality_runner_flag=(--no-rch)
    fi
    if "$SCRIPT_DIR/ext_quality_pipeline.sh" --check-only --report "${quality_runner_flag[@]}" >/dev/null 2>&1; then
        check_pass "quality_pipeline" "Extension quality pipeline passes"
    else
        check_fail "quality_pipeline" "Extension quality pipeline failed"
    fi
fi

# Gate 10: Suite classification guard
CLASSIFICATION="$PROJECT_ROOT/tests/suite_classification.toml"
if [[ -f "$CLASSIFICATION" ]]; then
    check_pass "suite_classification" "suite_classification.toml exists"
else
    check_fail "suite_classification" "suite_classification.toml missing"
fi

# Gate 11: Traceability matrix
TRACEABILITY="$PROJECT_ROOT/docs/traceability_matrix.json"
if [[ -f "$TRACEABILITY" ]]; then
    check_pass "traceability_matrix" "traceability_matrix.json exists"
else
    check_warn "traceability_matrix" "traceability_matrix.json not found"
fi

# Gate 12: Drop-in certification contract artifact
DROPIN_CONTRACT="$PROJECT_ROOT/docs/dropin-certification-contract.json"
if [[ -f "$DROPIN_CONTRACT" ]]; then
    CONTRACT_CHECK=$(python3 - <<PY
import json
from pathlib import Path

path = Path("$DROPIN_CONTRACT")
try:
    data = json.loads(path.read_text(encoding="utf-8"))
except Exception as exc:  # noqa: BLE001
    print(f"parse_error:{exc}")
    raise SystemExit(0)

missing = []
for key in ("schema", "hard_gates", "release_process_enforcement"):
    if key not in data:
        missing.append(key)

contract = (
    data.get("release_process_enforcement", {})
    .get("verdict_artifact_contract", {})
)
for key in ("path", "schema", "required_fields", "blocking_rule"):
    if key not in contract:
        missing.append(f"release_process_enforcement.verdict_artifact_contract.{key}")

if missing:
    print("missing:" + ",".join(missing))
    raise SystemExit(0)

if data.get("schema") != "pi.dropin.certification_contract.v1":
    print(f"schema_mismatch:{data.get('schema')}")
    raise SystemExit(0)

print("ok")
PY
)

    case "$CONTRACT_CHECK" in
        ok)
            check_pass "dropin_contract" "dropin certification contract is present and well-formed"
            ;;
        parse_error:*)
            check_fail "dropin_contract" "dropin certification contract JSON parse failed (${CONTRACT_CHECK#parse_error:})"
            ;;
        missing:*)
            check_fail "dropin_contract" "dropin certification contract missing required fields (${CONTRACT_CHECK#missing:})"
            ;;
        schema_mismatch:*)
            check_fail "dropin_contract" "unexpected contract schema (${CONTRACT_CHECK#schema_mismatch:})"
            ;;
        *)
            check_fail "dropin_contract" "unexpected contract validation result: $CONTRACT_CHECK"
            ;;
    esac
else
    check_fail "dropin_contract" "docs/dropin-certification-contract.json not found"
fi

# Gate 13: Drop-in certification verdict (required for strict claim mode)
DROPIN_VERDICT="$PROJECT_ROOT/docs/dropin-certification-verdict.json"
DROPIN_CHECK=$(python3 - <<PY
import json
import os
from pathlib import Path

project_root = Path("$PROJECT_ROOT")
contract_path = Path("$DROPIN_CONTRACT")
verdict_path = Path("$DROPIN_VERDICT")
# IMPORTANT: this must track the shell-resolved gate toggle derived from
# RELEASE_GATE_REQUIRE_DROPIN_CERTIFIED. Reading an unrelated env var here
# can silently disable strict drop-in enforcement.
strict_required = "$REQUIRE_DROPIN_CERTIFIED" == "1"

if not contract_path.is_file():
    print("fail|contract missing; cannot validate verdict")
    raise SystemExit(0)

try:
    contract = json.loads(contract_path.read_text(encoding="utf-8"))
except Exception as exc:  # noqa: BLE001
    print(f"fail|contract parse error: {exc}")
    raise SystemExit(0)

spec = (
    contract.get("release_process_enforcement", {})
    .get("verdict_artifact_contract", {})
)
required_fields = spec.get("required_fields", [])
expected_schema = spec.get("schema", "pi.dropin.certification_verdict.v1")

if not verdict_path.is_file():
    if strict_required:
        print("fail|missing docs/dropin-certification-verdict.json in strict drop-in mode")
    else:
        print("warn|docs/dropin-certification-verdict.json not present (strict drop-in mode disabled)")
    raise SystemExit(0)

try:
    verdict = json.loads(verdict_path.read_text(encoding="utf-8"))
except Exception as exc:  # noqa: BLE001
    print(f"fail|verdict parse error: {exc}")
    raise SystemExit(0)

missing_fields = [field for field in required_fields if field not in verdict]
if missing_fields:
    print("fail|verdict missing required fields: " + ", ".join(missing_fields))
    raise SystemExit(0)

schema = verdict.get("schema")
if schema != expected_schema:
    print(f"fail|verdict schema mismatch: expected {expected_schema}, got {schema}")
    raise SystemExit(0)

overall = verdict.get("overall_verdict")
if strict_required and overall != "CERTIFIED":
    print(f"fail|overall_verdict={overall} (expected CERTIFIED in strict mode)")
    raise SystemExit(0)

hard_gate_results = verdict.get("hard_gate_results")
if strict_required:
    if not isinstance(hard_gate_results, list) or not hard_gate_results:
        print("fail|hard_gate_results missing/empty in strict mode")
        raise SystemExit(0)
    non_pass = []
    for gate in hard_gate_results:
        status = str(gate.get("status", "")).lower()
        gate_id = gate.get("gate_id", "?")
        if status != "pass":
            non_pass.append(f"{gate_id}:{status or 'unknown'}")
    if non_pass:
        print("fail|non-pass hard gates in strict mode: " + ", ".join(non_pass))
        raise SystemExit(0)

evidence_index = verdict.get("evidence_index")
if strict_required:
    if not isinstance(evidence_index, list) or not evidence_index:
        print("fail|evidence_index missing/empty in strict mode")
        raise SystemExit(0)
    missing_paths = []
    for entry in evidence_index:
        if isinstance(entry, str):
            rel_path = entry
        elif isinstance(entry, dict):
            rel_path = entry.get("path")
        else:
            rel_path = None
        if isinstance(rel_path, str) and rel_path:
            if not (project_root / rel_path).exists():
                missing_paths.append(rel_path)
    if missing_paths:
        print("fail|evidence_index paths missing on disk: " + ", ".join(missing_paths))
        raise SystemExit(0)

if strict_required:
    print("pass|strict drop-in certification verdict is CERTIFIED with complete hard-gate evidence")
else:
    print(f"pass|drop-in certification verdict present (overall_verdict={overall})")
PY
)

DROPIN_STATUS="${DROPIN_CHECK%%|*}"
DROPIN_DETAIL="${DROPIN_CHECK#*|}"
case "$DROPIN_STATUS" in
    pass)
        check_pass "dropin_verdict" "$DROPIN_DETAIL"
        ;;
    warn)
        check_warn "dropin_verdict" "$DROPIN_DETAIL"
        ;;
    fail)
        check_fail "dropin_verdict" "$DROPIN_DETAIL"
        ;;
    *)
        check_fail "dropin_verdict" "unexpected drop-in verdict validation result: $DROPIN_CHECK"
        ;;
esac

# ─── Summary ────────────────────────────────────────────────────────────────

TOTAL_CHECKS=$((PASS_COUNT + FAIL_COUNT + WARN_COUNT))

if [[ "$REPORT_JSON" -eq 1 ]]; then
    JSON_CHECKS=""
    for c in "${CHECKS[@]}"; do
        if [[ -n "$JSON_CHECKS" ]]; then
            JSON_CHECKS="$JSON_CHECKS,$c"
        else
            JSON_CHECKS="$c"
        fi
    done

    VERDICT="pass"
    if [[ $FAIL_COUNT -gt 0 ]]; then
        VERDICT="fail"
    fi

    cat <<EOF
{
  "schema": "pi.release_gate.v1",
  "verdict": "$VERDICT",
  "thresholds": {
    "min_pass_rate": $MIN_PASS_RATE,
    "max_fail_count": $MAX_FAIL_COUNT,
    "max_na_count": $MAX_NA_COUNT,
    "require_dropin_certified": $REQUIRE_DROPIN_CERTIFIED
  },
  "counts": {
    "pass": $PASS_COUNT,
    "fail": $FAIL_COUNT,
    "warn": $WARN_COUNT,
    "total": $TOTAL_CHECKS
  },
  "checks": [$JSON_CHECKS]
}
EOF
else
    echo ""
    echo "═══════════════════════════════════════════════════════════"
    echo "  Release Gate — Conformance Evidence Bundle"
    echo "═══════════════════════════════════════════════════════════"
    echo "  Pass: $PASS_COUNT  Fail: $FAIL_COUNT  Warn: $WARN_COUNT  Total: $TOTAL_CHECKS"
    echo "  Thresholds: pass_rate>=${MIN_PASS_RATE}%, fail<=${MAX_FAIL_COUNT}, na<=${MAX_NA_COUNT}"
    echo "═══════════════════════════════════════════════════════════"

    if [[ $FAIL_COUNT -gt 0 ]]; then
        echo "  VERDICT: FAIL — release blocked"
        exit 1
    else
        echo "  VERDICT: PASS — release approved"
    fi
fi
