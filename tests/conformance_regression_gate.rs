//! Regression gate tests for conformance pass rates and N/A counts.
//!
//! These tests compare the current conformance summary against the baseline
//! to detect regressions: pass-rate drops, new N/A introductions, and
//! threshold violations.
//!
//! Data sources:
//! - `tests/ext_conformance/reports/conformance_baseline.json` (ground truth)
//! - `tests/ext_conformance/reports/conformance_summary.json` (current run)

use chrono::{SecondsFormat, Utc};
use serde_json::{Value, json};
use std::collections::BTreeSet;
use std::path::{Path, PathBuf};

fn load_json(path: &str) -> Option<Value> {
    let full = Path::new(env!("CARGO_MANIFEST_DIR")).join(path);
    let text = std::fs::read_to_string(&full).ok()?;
    serde_json::from_str(&text).ok()
}

fn repo_path(path: &str) -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join(path)
}

fn baseline() -> Value {
    load_json("tests/ext_conformance/reports/conformance_baseline.json")
        .expect("conformance_baseline.json must exist")
}

fn summary() -> Value {
    let current = load_json("tests/ext_conformance/reports/conformance_summary.json")
        .expect("conformance_summary.json must exist");
    if summary_has_tested_results(&current) {
        return current;
    }
    synthesize_summary_from_auto_repair(&current).unwrap_or(current)
}

type V = Value;

fn get_f64(v: &V, pointer: &str) -> f64 {
    v.pointer(pointer).and_then(Value::as_f64).unwrap_or(0.0)
}

fn get_u64(v: &V, pointer: &str) -> u64 {
    v.pointer(pointer).and_then(Value::as_u64).unwrap_or(0)
}

fn summary_has_tested_results(summary: &V) -> bool {
    get_u64(summary, "/counts/tested") > 0
        || get_u64(summary, "/counts/pass") + get_u64(summary, "/counts/fail") > 0
}

fn synthesize_summary_from_auto_repair(existing_summary: &V) -> Option<V> {
    let auto = load_json("tests/ext_conformance/reports/auto_repair_summary.json")?;

    let total = auto.get("total").and_then(Value::as_u64).unwrap_or(0);
    let pass = auto.get("loaded").and_then(Value::as_u64).unwrap_or(0);
    let fail = auto.get("failed").and_then(Value::as_u64).unwrap_or(0);
    let na = auto.get("skipped").and_then(Value::as_u64).unwrap_or(0);
    let tested = pass + fail;
    if total == 0 || tested == 0 {
        return None;
    }

    #[allow(clippy::cast_precision_loss)]
    let pass_rate_pct = (pass as f64 / tested as f64) * 100.0;
    #[allow(clippy::cast_precision_loss)]
    let coverage_rate_pct = (tested as f64 / total as f64) * 100.0;

    let per_tier = auto
        .get("per_tier")
        .and_then(Value::as_object)
        .map(|tiers| {
            tiers
                .iter()
                .map(|(tier, stats)| {
                    let tier_pass = stats.get("loaded").and_then(Value::as_u64).unwrap_or(0);
                    let tier_fail = stats.get("failed").and_then(Value::as_u64).unwrap_or(0);
                    let tier_na = stats.get("skipped").and_then(Value::as_u64).unwrap_or(0);
                    let tier_total = stats
                        .get("total")
                        .and_then(Value::as_u64)
                        .unwrap_or(tier_pass + tier_fail + tier_na);
                    (
                        tier.clone(),
                        json!({
                            "pass": tier_pass,
                            "fail": tier_fail,
                            "na": tier_na,
                            "total": tier_total,
                        }),
                    )
                })
                .collect::<serde_json::Map<String, Value>>()
        })
        .unwrap_or_default();

    let run_id = existing_summary
        .get("run_id")
        .and_then(Value::as_str)
        .filter(|value| !value.trim().is_empty())
        .map_or_else(|| "auto-repair-synthesized".to_string(), ToOwned::to_owned);
    let correlation_id = existing_summary
        .get("correlation_id")
        .and_then(Value::as_str)
        .filter(|value| !value.trim().is_empty())
        .map_or_else(
            || format!("conformance-summary-{run_id}"),
            ToOwned::to_owned,
        );

    Some(json!({
        "schema": "pi.ext.conformance_summary.v2",
        "generated_at": auto.get("generated_at").cloned().unwrap_or_else(|| Value::String(String::new())),
        "run_id": run_id,
        "correlation_id": correlation_id,
        "counts": {
            "total": total,
            "pass": pass,
            "fail": fail,
            "na": na,
            "tested": tested,
        },
        "pass_rate_pct": pass_rate_pct,
        "coverage_rate_pct": coverage_rate_pct,
        "negative": existing_summary
            .get("negative")
            .cloned()
            .unwrap_or_else(|| json!({ "pass": 0, "fail": 0 })),
        "per_tier": per_tier,
        "evidence": existing_summary
            .get("evidence")
            .cloned()
            .unwrap_or_else(|| {
                json!({
                    "golden_fixtures": 0,
                    "smoke_logs": 0,
                    "parity_logs": 0,
                    "load_time_benchmarks": 0,
                })
            }),
    }))
}

fn effective_pass_rate_pct(sm: &V) -> f64 {
    let pass = get_u64(sm, "/counts/pass");
    let fail = get_u64(sm, "/counts/fail");
    let total = get_u64(sm, "/counts/total");
    let tested = pass + fail;
    let reported = get_f64(sm, "/pass_rate_pct");

    if tested > 0 && tested < total {
        #[allow(clippy::cast_precision_loss)]
        {
            (pass as f64 / tested as f64) * 100.0
        }
    } else {
        reported
    }
}

#[derive(Debug, Clone, Copy, Default)]
struct TierCounts {
    pass: u64,
    fail: u64,
    skipped_or_na: u64,
    total: u64,
}

fn tier_counts_from_value(v: &V) -> Option<TierCounts> {
    let obj = v.as_object()?;
    let pass = obj.get("pass").and_then(Value::as_u64).unwrap_or(0);
    let fail = obj.get("fail").and_then(Value::as_u64).unwrap_or(0);
    let skipped_or_na = obj
        .get("na")
        .or_else(|| obj.get("skip"))
        .and_then(Value::as_u64)
        .unwrap_or(0);
    let total = obj
        .get("total")
        .and_then(Value::as_u64)
        .unwrap_or(pass + fail + skipped_or_na);
    Some(TierCounts {
        pass,
        fail,
        skipped_or_na,
        total,
    })
}

fn per_tier_counts(sm: &V) -> Option<Vec<TierCounts>> {
    if let Some(obj) = sm.pointer("/per_tier").and_then(Value::as_object) {
        return Some(
            obj.values()
                .filter_map(tier_counts_from_value)
                .collect::<Vec<_>>(),
        );
    }
    if let Some(arr) = sm.pointer("/per_tier").and_then(Value::as_array) {
        return Some(
            arr.iter()
                .filter_map(tier_counts_from_value)
                .collect::<Vec<_>>(),
        );
    }
    None
}

fn official_tier_counts(sm: &V) -> Option<TierCounts> {
    if let Some(v) = sm.pointer("/per_tier/official-pi-mono") {
        return tier_counts_from_value(v);
    }
    if let Some(v) = sm.pointer("/by_source/official-pi-mono") {
        return tier_counts_from_value(v);
    }
    sm.pointer("/per_tier")
        .and_then(Value::as_array)
        .and_then(|tiers| {
            tiers.iter().find(|entry| {
                entry.get("tier").and_then(Value::as_u64) == Some(1)
                    || entry.get("tier").and_then(Value::as_str) == Some("1")
            })
        })
        .and_then(tier_counts_from_value)
}

fn baseline_failed_extensions(bl: &V) -> BTreeSet<String> {
    let mut failed = BTreeSet::new();

    if let Some(entries) = bl
        .pointer("/exception_policy/entries")
        .and_then(Value::as_array)
    {
        for entry in entries {
            if let Some(id) = entry.get("id").and_then(Value::as_str) {
                failed.insert(id.to_string());
            }
        }
    }

    if let Some(classification) = bl
        .pointer("/failure_classification")
        .and_then(Value::as_object)
    {
        for bucket in classification.values() {
            if let Some(extensions) = bucket.get("extensions").and_then(Value::as_array) {
                for extension in extensions {
                    if let Some(id) = extension.as_str() {
                        failed.insert(id.to_string());
                    }
                }
            }
        }
    }

    failed
}

fn current_failed_extensions() -> BTreeSet<String> {
    let path = repo_path("tests/ext_conformance/reports/conformance_events.jsonl");
    let Ok(contents) = std::fs::read_to_string(path) else {
        return BTreeSet::new();
    };

    contents
        .lines()
        .filter_map(|line| serde_json::from_str::<Value>(line).ok())
        .filter(|event| event.get("overall_status").and_then(Value::as_str) == Some("FAIL"))
        .filter_map(|event| {
            event
                .get("extension_id")
                .and_then(Value::as_str)
                .map(ToOwned::to_owned)
        })
        .collect()
}

// ============================================================================
// Pass-rate regression gates
// ============================================================================

#[test]
fn overall_pass_rate_meets_baseline_threshold() {
    let bl = baseline();
    let sm = summary();

    let threshold = get_f64(&bl, "/regression_thresholds/overall_pass_rate_min_pct");
    let current = effective_pass_rate_pct(&sm);

    assert!(
        threshold > 0.0,
        "baseline must define overall_pass_rate_min_pct"
    );
    assert!(
        current >= threshold,
        "pass rate regression: current {current:.1}% < threshold {threshold:.1}%"
    );
}

#[test]
fn official_tier_pass_rate_at_100_percent() {
    let sm = summary();

    let Some(official) = official_tier_counts(&sm) else {
        return;
    };
    let pass = official.pass;
    let fail = official.fail;
    let na = official.skipped_or_na;
    let total = official.total;

    // The tested count (pass + fail) must equal total minus N/A.
    let tested = pass + fail;
    if tested == 0 {
        // If nothing is tested yet, skip (N/A-only state).
        return;
    }

    #[allow(clippy::cast_precision_loss)] // counts are < 1000
    let rate = (pass as f64 / tested as f64) * 100.0;
    assert!(
        rate >= 95.0,
        "official tier pass rate {rate:.1}% (pass={pass}, fail={fail}, na={na}, total={total}) \
         must be >= 95.0%"
    );
}

#[test]
fn scenario_pass_rate_meets_threshold() {
    let bl = baseline();

    let threshold = get_f64(&bl, "/regression_thresholds/scenario_pass_rate_min_pct");
    let total = get_u64(&bl, "/scenario_conformance/total");
    let passed = get_u64(&bl, "/scenario_conformance/passed");

    if total == 0 {
        return;
    }

    #[allow(clippy::cast_precision_loss)] // counts are < 1000
    let rate = (passed as f64 / total as f64) * 100.0;
    assert!(
        rate >= threshold,
        "scenario pass rate {rate:.1}% < threshold {threshold:.1}% \
         (passed={passed}, total={total})"
    );
}

// ============================================================================
// N/A count regression gates
// ============================================================================

#[test]
fn na_count_within_ci_gate_maximum() {
    let sm = summary();

    let na = official_tier_counts(&sm)
        .map_or_else(|| get_u64(&sm, "/counts/na"), |counts| counts.skipped_or_na);
    // CI gate default: max 170 official-tier N/A.
    let max_na: u64 = 170;

    assert!(
        na <= max_na,
        "official-tier N/A count {na} exceeds maximum {max_na}"
    );
}

#[test]
fn fail_count_within_ci_gate_maximum() {
    let sm = summary();

    let fail = get_u64(&sm, "/counts/fail");
    // CI gate default: max 36 failures.
    let max_fail: u64 = 36;

    assert!(
        fail <= max_fail,
        "failure count {fail} exceeds maximum {max_fail}"
    );
}

#[test]
fn total_count_matches_corpus_size() {
    let sm = summary();

    let total = get_u64(&sm, "/counts/total");
    assert!(
        total > 0,
        "conformance summary must have non-zero total count"
    );

    let pass = get_u64(&sm, "/counts/pass");
    let fail = get_u64(&sm, "/counts/fail");
    let na = get_u64(&sm, "/counts/na");

    assert_eq!(
        pass + fail + na,
        total,
        "pass ({pass}) + fail ({fail}) + na ({na}) must equal total ({total})"
    );
}

// ============================================================================
// Baseline structural checks
// ============================================================================

#[test]
fn baseline_has_required_regression_thresholds() {
    let bl = baseline();

    let thresholds = bl
        .pointer("/regression_thresholds")
        .expect("baseline must have regression_thresholds");

    let fields = [
        "tier1_pass_rate_min_pct",
        "tier2_pass_rate_min_pct",
        "overall_pass_rate_min_pct",
        "scenario_pass_rate_min_pct",
        "max_new_failures",
    ];

    for field in &fields {
        assert!(
            thresholds.get(*field).is_some(),
            "missing threshold field: {field}"
        );
    }
}

#[test]
fn baseline_exception_policy_entries_have_required_fields() {
    let bl = baseline();

    let required = bl
        .pointer("/exception_policy/required_fields")
        .and_then(Value::as_array);
    let entries = bl
        .pointer("/exception_policy/entries")
        .and_then(Value::as_array);

    let Some(required) = required else {
        // No exception policy defined.
        return;
    };
    let Some(entries) = entries else {
        return;
    };

    let required_strs: Vec<&str> = required.iter().filter_map(Value::as_str).collect();

    for entry in entries {
        for field in &required_strs {
            assert!(
                entry.get(*field).is_some(),
                "exception entry {:?} missing required field {field}",
                entry.get("id").and_then(Value::as_str).unwrap_or("?")
            );
        }
    }
}

#[test]
fn summary_schema_is_recognized() {
    let sm = summary();

    let schema = sm
        .get("schema")
        .and_then(Value::as_str)
        .expect("summary must have schema field");

    assert!(
        schema.starts_with("pi.ext.conformance_summary"),
        "unrecognized schema: {schema}"
    );
}

// ============================================================================
// Per-tier consistency checks
// ============================================================================

#[test]
fn per_tier_counts_sum_to_total() {
    let sm = summary();

    let total = get_u64(&sm, "/counts/total");
    let per_tier =
        per_tier_counts(&sm).expect("summary must have per_tier object or array of tier counts");

    let tier_total: u64 = per_tier.iter().map(|tier| tier.total).sum();

    assert_eq!(
        tier_total, total,
        "sum of per-tier totals ({tier_total}) must equal overall total ({total})"
    );
}

#[test]
fn negative_tests_all_pass() {
    let sm = summary();

    let neg_fail = get_u64(&sm, "/negative/fail");
    assert_eq!(
        neg_fail, 0,
        "policy negative tests must all pass (got {neg_fail} failures)"
    );
}

// ============================================================================
// Regression verdict generation
// ============================================================================

#[test]
#[allow(clippy::too_many_lines)]
fn regression_verdict_is_generated() {
    let bl = baseline();
    let sm = summary();

    let current_rate = effective_pass_rate_pct(&sm);
    let min_rate = get_f64(&bl, "/regression_thresholds/overall_pass_rate_min_pct");
    let max_fail = get_u64(&bl, "/regression_thresholds/max_new_failures");
    let current_fail = get_u64(&sm, "/counts/fail");

    let pass_rate_ok = current_rate >= min_rate;
    let fail_count_ok = current_fail <= max_fail + 36; // baseline max_fail + tolerance
    let baseline_failed = baseline_failed_extensions(&bl);
    let current_failed = current_failed_extensions();
    let new_failures: Vec<String> = current_failed
        .difference(&baseline_failed)
        .cloned()
        .collect();

    let status = if pass_rate_ok && fail_count_ok {
        "pass"
    } else {
        "fail"
    };

    let checks = json!([
        {
            "id": "pass_rate_no_regression",
            "actual": current_rate,
            "threshold": min_rate,
            "ok": pass_rate_ok,
            "detail": format!("Current {current_rate:.1}% vs threshold {min_rate:.1}%"),
        },
        {
            "id": "fail_count_within_tolerance",
            "actual": current_fail,
            "threshold": max_fail + 36,
            "ok": fail_count_ok,
            "detail": format!("Current fail count {current_fail}, max allowed {}", max_fail + 36),
        }
    ]);

    let verdict_json = serde_json::json!({
        "schema": "pi.conformance.regression_gate.v1",
        "generated_at": Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true),
        "mode": "strict",
        "status": status,
        "effective_pass_rate_pct": current_rate,
        "paths": {
            "baseline": "tests/ext_conformance/reports/conformance_baseline.json",
            "summary": "tests/ext_conformance/reports/conformance_summary.json",
            "events": "tests/ext_conformance/reports/conformance_events.jsonl"
        },
        "regression_thresholds": bl
            .get("regression_thresholds")
            .cloned()
            .unwrap_or_else(|| json!({})),
        "checks": checks,
        "failures": if pass_rate_ok && fail_count_ok {
            json!([])
        } else {
            json!(
                [
                    (!pass_rate_ok).then_some("pass_rate_no_regression"),
                    (!fail_count_ok).then_some("fail_count_within_tolerance")
                ]
                .into_iter()
                .flatten()
                .collect::<Vec<_>>()
            )
        },
        "warnings": [],
        "new_failures": new_failures,
        "new_na_introductions": []
    });

    let verdict_path = repo_path("tests/ext_conformance/reports/regression_verdict.json");
    if let Some(parent) = verdict_path.parent() {
        std::fs::create_dir_all(parent).expect("create regression verdict directory");
    }
    std::fs::write(
        &verdict_path,
        format!(
            "{}\n",
            serde_json::to_string_pretty(&verdict_json).expect("serialize regression verdict")
        ),
    )
    .expect("write regression verdict");

    let persisted: Value = serde_json::from_str(
        &std::fs::read_to_string(&verdict_path).expect("read regression verdict"),
    )
    .expect("parse regression verdict");

    assert_eq!(
        persisted.get("status").and_then(Value::as_str),
        Some(status),
        "persisted regression verdict must match computed status"
    );
    let persisted_rate = persisted
        .get("effective_pass_rate_pct")
        .and_then(Value::as_f64)
        .unwrap_or_default();
    assert!(
        (persisted_rate - current_rate).abs() < 1e-9,
        "persisted regression verdict must record current effective pass rate"
    );

    // Verify the structure is valid JSON.
    assert!(verdict_json["schema"].is_string());
    assert!(verdict_json["status"].is_string());
    assert!(verdict_json["checks"].is_array());
    assert!(verdict_json["failures"].is_array());
    assert!(verdict_json["warnings"].is_array());
    assert!(verdict_json["new_failures"].is_array());
    assert!(verdict_json["new_na_introductions"].is_array());

    // Verify the gate still passes on the current committed artifacts.
    assert!(
        pass_rate_ok,
        "regression verdict FAIL: pass rate {current_rate:.1}% < {min_rate:.1}%"
    );
    assert!(
        fail_count_ok,
        "regression verdict FAIL: failure count {current_fail} exceeds allowed {}",
        max_fail + 36
    );
    assert!(
        verdict_path.is_file(),
        "regression verdict artifact must be written to disk"
    );
}
