//! Thin JSON HTTP helpers for binding adapters.
//!
//! Wraps `crate::http::client::Client` to provide simple `get_json` /
//! `post_json` functions that binding adapters can call without depending on
//! asupersync internals directly.

use crate::http::client::Client;
use anyhow::Context as _;

/// Perform a GET request and parse the response body as JSON.
///
/// # Errors
///
/// Returns an error if the request fails, the response is not 2xx, or the body
/// is not valid JSON.
pub async fn get_json(url: &str) -> anyhow::Result<serde_json::Value> {
    let client = Client::new();
    let body = client
        .get(url)
        .header("Accept", "application/json")
        .send()
        .await
        .map_err(|e| anyhow::anyhow!("{e}"))?
        .text()
        .await
        .map_err(|e| anyhow::anyhow!("{e}"))?;
    serde_json::from_str(&body).context("failed to parse JSON response")
}

/// Perform a POST request with a JSON body and parse the response as JSON.
///
/// # Errors
///
/// Returns an error if the request fails, the response is not 2xx, or the body
/// is not valid JSON.
pub async fn post_json(
    url: &str,
    payload: &serde_json::Value,
) -> anyhow::Result<serde_json::Value> {
    let body_bytes = serde_json::to_vec(payload).context("failed to serialize request body")?;
    let client = Client::new();
    let resp_text = client
        .post(url)
        .header("Content-Type", "application/json")
        .header("Accept", "application/json")
        .body(body_bytes)
        .send()
        .await
        .map_err(|e| anyhow::anyhow!("{e}"))?
        .text()
        .await
        .map_err(|e| anyhow::anyhow!("{e}"))?;
    serde_json::from_str(&resp_text).context("failed to parse JSON response")
}
