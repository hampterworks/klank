//! Primary import stage: Ultimate Guitar's mobile-app JSON API.
//!
//! This is the app's own API (`api.ultimate-guitar.com`), so it is **not**
//! behind Cloudflare's browser challenges and works identically on desktop and
//! Android with a plain HTTP request — no webview.
//!
//! The auth scheme was reverse-engineered from the Android app. All of its
//! fragile pieces live here as named constants with a golden-hash unit test, so
//! if UG changes the algorithm it is a one-file, one-test edit.

use super::super::{ImportStage, NormalizedTab, StageError, StageOutcome};
use super::is_ug_url;
use std::time::Duration;

// --- Fragile, reverse-engineered constants (keep together; covered by tests) ---
const API_BASE: &str = "https://api.ultimate-guitar.com/api/v1";
const APP_USER_AGENT: &str = "UGT_ANDROID/4.11.1 (Pixel; 8.1.0)";
/// `X-UG-API-KEY = md5_hex(deviceId + utc(API_KEY_TIME_FMT) + API_KEY_SUFFIX)`.
const API_KEY_SUFFIX: &str = "createLog()";
const API_KEY_TIME_FMT: &str = "%Y-%m-%d:%H";
// -------------------------------------------------------------------------------

const DEVICE_ID_FILE: &str = "ug_device_id";

pub struct UgMobileApi {
    app: tauri::AppHandle,
    url: String,
    http: reqwest::Client,
}

impl UgMobileApi {
    pub fn new(app: tauri::AppHandle, url: String, http: reqwest::Client) -> Self {
        Self { app, url, http }
    }
}

#[async_trait::async_trait]
impl ImportStage for UgMobileApi {
    fn id(&self) -> &'static str {
        "ug-mobile-api"
    }
    fn label(&self) -> &'static str {
        "Ultimate Guitar app API"
    }
    fn can_handle(&self) -> bool {
        is_ug_url(&self.url)
    }
    fn timeout(&self) -> Duration {
        Duration::from_secs(8)
    }

    async fn run(&self) -> StageOutcome {
        let Some(tab_id) = extract_tab_id(&self.url) else {
            // No numeric id in the URL — let the website stage handle it.
            return StageOutcome::RetryNext(StageError::Parse("no tab id in URL".into()));
        };

        let device_id = device_id(&self.app);
        let api_key = api_key(&device_id, &chrono::Utc::now());
        let req_url = format!("{API_BASE}/tab/info?tab_id={tab_id}&tab_access_type=private");

        let resp = self
            .http
            .get(&req_url)
            .header("User-Agent", APP_USER_AGENT)
            .header("Accept", "application/json")
            .header("Accept-Charset", "utf-8")
            .header("X-UG-CLIENT-ID", &device_id)
            .header("X-UG-API-KEY", api_key)
            .send()
            .await;

        let resp = match resp {
            Ok(r) => r,
            Err(e) => return StageOutcome::RetryNext(StageError::Network(e.to_string())),
        };

        match resp.status().as_u16() {
            200 => {}
            401 | 403 => return StageOutcome::RetryNext(StageError::Unauthorized),
            404 => return StageOutcome::Fatal(StageError::NotFound),
            s => return StageOutcome::RetryNext(StageError::Network(format!("HTTP {s}"))),
        }

        let body = match resp.text().await {
            Ok(b) => b,
            Err(e) => return StageOutcome::RetryNext(StageError::Network(e.to_string())),
        };

        match parse_tab_info(&body) {
            Some(tab) => StageOutcome::Success(tab),
            None => StageOutcome::RetryNext(StageError::Parse("unexpected API response".into())),
        }
    }
}

/// Computes the `X-UG-API-KEY` header value.
fn api_key(device_id: &str, now: &chrono::DateTime<chrono::Utc>) -> String {
    let stamp = now.format(API_KEY_TIME_FMT).to_string();
    let digest = md5::compute(format!("{device_id}{stamp}{API_KEY_SUFFIX}"));
    format!("{digest:x}")
}

/// Extracts the trailing numeric tab id from a UG URL
/// (`.../creep-chords-4169` -> `4169`). Query/fragment are ignored.
fn extract_tab_id(url: &str) -> Option<u64> {
    let path = url.split(['?', '#']).next().unwrap_or(url);
    let digits: String = path
        .chars()
        .rev()
        .take_while(|c| c.is_ascii_digit())
        .collect::<String>()
        .chars()
        .rev()
        .collect();
    if digits.is_empty() {
        None
    } else {
        digits.parse().ok()
    }
}

/// Parses the `/tab/info` response into a [`NormalizedTab`]. Returns `None` if
/// the expected fields are missing/empty so the caller can fall through.
fn parse_tab_info(body: &str) -> Option<NormalizedTab> {
    let v: serde_json::Value = serde_json::from_str(body).ok()?;
    let content = v.get("content")?.as_str()?.to_string();
    if content.trim().is_empty() {
        return None;
    }
    let artist = v
        .get("artist_name")
        .and_then(|x| x.as_str())
        .unwrap_or("")
        .to_string();
    let song = v
        .get("song_name")
        .and_then(|x| x.as_str())
        .unwrap_or("")
        .to_string();
    Some(NormalizedTab {
        content,
        artist,
        song,
        source: "ug-mobile-api",
    })
}

/// Returns a stable 16-hex-char device id, generating and persisting one on
/// first use. Best-effort persistence; falls back to an in-memory id.
fn device_id(app: &tauri::AppHandle) -> String {
    use tauri::Manager;
    let path = app
        .path()
        .app_config_dir()
        .ok()
        .map(|d| d.join(DEVICE_ID_FILE));

    if let Some(p) = &path {
        if let Ok(existing) = std::fs::read_to_string(p) {
            let existing = existing.trim().to_string();
            if existing.len() == 16 && existing.chars().all(|c| c.is_ascii_hexdigit()) {
                return existing;
            }
        }
    }

    let id: String = (0..16)
        .map(|_| format!("{:x}", rand::random::<u8>() & 0xf))
        .collect();

    if let Some(p) = &path {
        if let Some(dir) = p.parent() {
            let _ = std::fs::create_dir_all(dir);
        }
        let _ = std::fs::write(p, &id);
    }
    id
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;

    #[test]
    fn api_key_is_md5_of_device_stamp_suffix() {
        // Golden value pins the algorithm. If UG changes it, update here and the
        // constants above together.
        let now = chrono::Utc.with_ymd_and_hms(2026, 6, 13, 7, 0, 0).unwrap();
        let device = "0123456789abcdef";
        let expected = format!("{:x}", md5::compute("0123456789abcdef2026-06-13:07createLog()"));
        assert_eq!(api_key(device, &now), expected);
    }

    #[test]
    fn extracts_trailing_tab_id() {
        assert_eq!(
            extract_tab_id("https://tabs.ultimate-guitar.com/tab/radiohead/creep-chords-4169"),
            Some(4169)
        );
        assert_eq!(
            extract_tab_id("https://tabs.ultimate-guitar.com/tab/x-1?foo=bar#frag"),
            Some(1)
        );
        assert_eq!(extract_tab_id("https://tabs.ultimate-guitar.com/tab/no-id"), None);
    }

    #[test]
    fn parses_tab_info_response() {
        let body = r#"{"id":1,"song_name":"Creep","artist_name":"Radiohead","type":"Chords","content":"[ch]G[/ch] hi"}"#;
        let tab = parse_tab_info(body).unwrap();
        assert_eq!(tab.artist, "Radiohead");
        assert_eq!(tab.song, "Creep");
        assert!(tab.content.contains("[ch]G[/ch]"));
        assert_eq!(tab.source, "ug-mobile-api");
    }

    #[test]
    fn rejects_empty_content() {
        let body = r#"{"song_name":"x","artist_name":"y","content":"  "}"#;
        assert!(parse_tab_info(body).is_none());
    }
}
