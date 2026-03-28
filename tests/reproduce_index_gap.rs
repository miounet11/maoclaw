#![forbid(unsafe_code)]

use pi::PiResult;
use pi::session_store_v2::SessionStoreV2;
use serde_json::json;
use std::fs;
use tempfile::tempdir;

const MAX_SEGMENT_BYTES: u64 = 4 * 1024;

#[test]
#[allow(clippy::too_many_lines)]
fn rebuild_index_skips_subsequent_segments_on_corruption() -> PiResult<()> {
    let dir = tempdir()?;
    let mut store = SessionStoreV2::create(dir.path(), MAX_SEGMENT_BYTES)?;

    store.append_entry("e1", None, "message", json!({"data": "x".repeat(50)}))?;
    store.append_entry(
        "e2",
        Some("e1".into()),
        "message",
        json!({"data": "x".repeat(50)}),
    )?;
    store.append_entry(
        "e3",
        Some("e2".into()),
        "message",
        json!({"data": "x".repeat(50)}),
    )?;

    let index = store.read_index()?;
    let segs: std::collections::HashSet<u64> = index.iter().map(|r| r.segment_seq).collect();
    if segs.len() < 2 {
        let mut parent_id = "e3".to_string();
        for next in 4..=80 {
            let entry_id = format!("e{next}");
            store.append_entry(
                &entry_id,
                Some(parent_id.clone()),
                "message",
                json!({"data": "x".repeat(50)}),
            )?;
            parent_id = entry_id;

            let segs: std::collections::HashSet<u64> =
                store.read_index()?.iter().map(|r| r.segment_seq).collect();
            if segs.len() >= 2 {
                break;
            }
        }
    }

    let index = store.read_index()?;
    let segs: std::collections::HashSet<u64> = index.iter().map(|r| r.segment_seq).collect();
    assert!(segs.len() >= 2, "Setup failed: need at least 2 segments");

    let seg1_entries: Vec<String> = index
        .iter()
        .filter(|row| row.segment_seq == 1)
        .map(|row| row.entry_id.clone())
        .collect();
    let seg2_entries: Vec<String> = index
        .iter()
        .filter(|row| row.segment_seq == 2)
        .map(|row| row.entry_id.clone())
        .collect();
    assert!(
        !seg1_entries.is_empty() && !seg2_entries.is_empty(),
        "Setup failed: expected entries in both segment 1 and segment 2",
    );

    let seg1_path = store.segment_file_path(1);
    let seg2_path = store.segment_file_path(2);

    assert!(seg1_path.exists());
    assert!(seg2_path.exists());

    // Corrupt the final frame in segment 1 by truncating into its JSON payload.
    // A missing trailing newline is now healed automatically, so the repro must
    // create an invalid EOF frame to exercise the quarantine path.
    let bytes = fs::read(&seg1_path)?;
    let newline_positions: Vec<usize> = bytes
        .iter()
        .enumerate()
        .filter_map(|(idx, byte)| (*byte == b'\n').then_some(idx))
        .collect();
    assert!(
        newline_positions.len() >= 2,
        "segment 1 must contain at least two frames"
    );
    let start_of_last_line = newline_positions[newline_positions.len() - 2].saturating_add(1);
    let truncate_to = start_of_last_line.saturating_add(8);
    fs::OpenOptions::new()
        .write(true)
        .open(&seg1_path)?
        .set_len(u64::try_from(truncate_to).unwrap_or(u64::MAX))?;

    drop(store);

    let index_path = dir.path().join("index").join("offsets.jsonl");
    fs::remove_file(&index_path)?;

    let mut store = SessionStoreV2::create(dir.path(), MAX_SEGMENT_BYTES)?;
    let rebuilt_count = store.rebuild_index()?;

    let new_index = store.read_index()?;
    let has_seg2 = new_index.iter().any(|r| r.segment_seq == 2);
    let rebuilt_ids: Vec<String> = new_index.iter().map(|row| row.entry_id.clone()).collect();

    assert!(
        !has_seg2,
        "Index should stop before segment 2 after segment 1 EOF corruption"
    );
    assert_eq!(
        rebuilt_count,
        u64::try_from(seg1_entries.len().saturating_sub(1)).unwrap_or(u64::MAX),
        "rebuild should retain all complete frames before the corrupted tail",
    );
    assert_eq!(
        rebuilt_ids,
        seg1_entries[..seg1_entries.len() - 1].to_vec(),
        "rebuild should keep only intact entries before the corrupted frame",
    );
    assert!(
        seg2_entries
            .iter()
            .all(|entry_id| !rebuilt_ids.contains(entry_id)),
        "rebuilt index must not retain quarantined segment 2 entries",
    );

    assert!(
        !seg2_path.exists(),
        "segment 2 should be quarantined out of the active segment set"
    );
    assert!(
        seg2_path
            .with_file_name(format!(
                "{}.bak",
                seg2_path
                    .file_name()
                    .and_then(|name| name.to_str())
                    .unwrap_or("segment")
            ))
            .exists(),
        "quarantined segment 2 backup should be preserved for inspection",
    );
    assert_eq!(
        fs::metadata(&seg1_path)?.len(),
        u64::try_from(start_of_last_line).unwrap_or(u64::MAX),
        "segment 1 should be truncated to the last complete frame boundary",
    );

    Ok(())
}
