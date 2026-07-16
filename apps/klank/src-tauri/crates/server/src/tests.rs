//! Integration tests: drive the full router with `tower::ServiceExt::oneshot`
//! against a tempdir, one test per endpoint group. No network is touched.

use crate::{app, AppState, Hosting, JamShared};
use axum::body::Body;
use axum::http::{Request, StatusCode};
use klank_core::jam::JamChannels;
use serde_json::{json, Value};
use std::sync::Arc;
use tower::ServiceExt;

/// The tempdir guards backing a test `AppState`; kept alive for the test's
/// duration (they clean up on drop).
struct Guards {
    tabs: tempfile::TempDir,
    _config: tempfile::TempDir,
    _static: tempfile::TempDir,
}

/// Builds an `AppState` rooted at fresh tempdirs, returned with their guards.
fn state() -> (AppState, Guards) {
    let tabs = tempfile::tempdir().unwrap();
    let config = tempfile::tempdir().unwrap();
    let static_dir = tempfile::tempdir().unwrap();
    let s = AppState {
        tabs_dir: Arc::new(tabs.path().to_path_buf()),
        config_dir: Arc::new(config.path().to_path_buf()),
        static_dir: Arc::new(static_dir.path().to_path_buf()),
        settings_lock: Arc::new(tokio::sync::Mutex::new(())),
        jam: Arc::new(JamShared {
            channels: JamChannels::default(),
            hosting: std::sync::Mutex::new(Hosting::default()),
        }),
        version: "test-version",
    };
    (
        s,
        Guards {
            tabs,
            _config: config,
            _static: static_dir,
        },
    )
}

async fn send(s: &AppState, req: Request<Body>) -> (StatusCode, Value) {
    let resp = app(s.clone()).oneshot(req).await.unwrap();
    let status = resp.status();
    let bytes = axum::body::to_bytes(resp.into_body(), usize::MAX)
        .await
        .unwrap();
    let value = if bytes.is_empty() {
        Value::Null
    } else {
        serde_json::from_slice(&bytes).unwrap_or(Value::Null)
    };
    (status, value)
}

fn get(uri: &str) -> Request<Body> {
    Request::builder().uri(uri).body(Body::empty()).unwrap()
}

fn json_req(method: &str, uri: &str, body: Value) -> Request<Body> {
    Request::builder()
        .method(method)
        .uri(uri)
        .header("content-type", "application/json")
        .body(Body::from(serde_json::to_vec(&body).unwrap()))
        .unwrap()
}

#[tokio::test]
async fn version_reports_server_mode_and_root() {
    let (s, g) = state();
    let tabs = &g.tabs;
    let (status, body) = send(&s, get("/api/version")).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["version"], "test-version");
    assert_eq!(body["mode"], "server");
    assert_eq!(body["root"], tabs.path().to_string_lossy().as_ref());
}

#[tokio::test]
async fn tree_file_crud_and_traversal_guard() {
    let (s, g) = state();
    let tabs = &g.tabs;
    let target = tabs.path().to_string_lossy().to_string();

    // Write.
    let (status, body) = send(
        &s,
        json_req(
            "PUT",
            "/api/file",
            json!({ "filename": "A - Song.tab.txt", "target": target, "content": "hello" }),
        ),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    let written = body["path"].as_str().unwrap().to_string();

    // Tree includes it.
    let (status, tree) = send(&s, get("/api/tree")).await;
    assert_eq!(status, StatusCode::OK);
    assert!(tree
        .as_array()
        .unwrap()
        .iter()
        .any(|e| e["name"] == "A - Song.tab.txt"));

    // Read back.
    let uri = format!("/api/file?path={}", urlencoding(&written));
    let (status, body) = send(&s, get(&uri)).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["content"], "hello");

    // Exists.
    let (_s, body) = send(
        &s,
        get(&format!("/api/exists?path={}", urlencoding(&written))),
    )
    .await;
    assert_eq!(body["exists"], true);

    // Traversal guard: absolute path outside root → 400.
    let (status, _b) = send(&s, get("/api/file?path=%2Fetc%2Fpasswd")).await;
    assert_eq!(status, StatusCode::BAD_REQUEST);

    // Delete, then delete-again → 404.
    let del = format!("/api/file?path={}", urlencoding(&written));
    let (status, _b) = send(
        &s,
        Request::builder()
            .method("DELETE")
            .uri(&del)
            .body(Body::empty())
            .unwrap(),
    )
    .await;
    assert_eq!(status, StatusCode::NO_CONTENT);
    let (status, _b) = send(
        &s,
        Request::builder()
            .method("DELETE")
            .uri(&del)
            .body(Body::empty())
            .unwrap(),
    )
    .await;
    assert_eq!(status, StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn settings_playlists_and_metrics_roundtrip() {
    let (s, g) = state();
    let tabs = &g.tabs;
    // Native-separator absolute key, matching what the server derives from the
    // tabs root (forward-slash on Linux, backslash on Windows).
    let tab_path = tabs
        .path()
        .join("A - a.tab.txt")
        .to_string_lossy()
        .to_string();

    // Per-tab settings.
    let (status, _b) = send(
        &s,
        json_req(
            "PUT",
            "/api/settings/tab",
            json!({ "path": tab_path, "settings": { "fontSize": 1, "transpose": 0, "scrollSpeed": 1 } }),
        ),
    )
    .await;
    assert_eq!(status, StatusCode::NO_CONTENT);
    let (status, body) = send(&s, get("/api/settings")).await;
    assert_eq!(status, StatusCode::OK);
    assert!(body.get(&tab_path).is_some());

    // Playlists.
    let (status, _b) = send(
        &s,
        json_req(
            "PUT",
            "/api/playlists",
            json!([{ "id": "1", "name": "L", "paths": [tab_path], "createdAt": 1 }]),
        ),
    )
    .await;
    assert_eq!(status, StatusCode::NO_CONTENT);
    let (_s, body) = send(&s, get("/api/playlists")).await;
    assert_eq!(body[0]["paths"][0], json!(tab_path));
    // A reserved key must not leak into per-tab settings.
    let (_s, settings) = send(&s, get("/api/settings")).await;
    assert!(!settings
        .as_object()
        .unwrap()
        .keys()
        .any(|k| k.ends_with("playlists")));

    // Play metrics.
    let (status, _b) = send(
        &s,
        json_req(
            "PUT",
            "/api/play-metrics",
            json!({ tab_path.clone(): { "playCount": 3, "lastPlayedAt": 99 } }),
        ),
    )
    .await;
    assert_eq!(status, StatusCode::NO_CONTENT);
    let (_s, body) = send(&s, get("/api/play-metrics")).await;
    assert_eq!(body[&tab_path]["playCount"], 3);
}

#[tokio::test]
async fn git_is_repo_and_token_and_system_creds() {
    let (s, _g) = state();

    // A bare tempdir is not a repo.
    let (status, body) = send(&s, get("/api/git/is-repo")).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["value"], false);

    // System credentials are always disabled in server mode.
    let (_s, body) = send(&s, get("/api/git/system-credentials-enabled")).await;
    assert_eq!(body["value"], false);
    let (_s, body) = send(
        &s,
        json_req("POST", "/api/git/use-system-credentials", json!({})),
    )
    .await;
    assert_eq!(body["success"], false);

    // Token roundtrip: absent → set → present.
    let (_s, body) = send(&s, get("/api/git/has-token")).await;
    assert_eq!(body["value"], false);
    let (status, _b) = send(
        &s,
        json_req("PUT", "/api/git/token", json!({ "token": "abc" })),
    )
    .await;
    assert_eq!(status, StatusCode::NO_CONTENT);
    let (_s, body) = send(&s, get("/api/git/has-token")).await;
    assert_eq!(body["value"], true);
    let (_s, body) = send(&s, get("/api/git/is-authenticated")).await;
    assert_eq!(body["value"], true);
}

#[tokio::test]
async fn jam_status_reflects_start_stop() {
    let (s, _g) = state();

    let (status, body) = send(&s, get("/api/jam/status")).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["hosting"], false);
    assert_eq!(body["clients"], 0);

    let (_s, body) = send(
        &s,
        json_req("POST", "/api/jam/start", json!({ "name": "Studio" })),
    )
    .await;
    assert_eq!(body["name"], "Studio");

    let (_s, body) = send(&s, get("/api/jam/status")).await;
    assert_eq!(body["hosting"], true);
    assert_eq!(body["name"], "Studio");

    // Discover is always empty in a container.
    let (_s, body) = send(&s, get("/api/jam/discover")).await;
    assert_eq!(body, json!([]));

    let (status, _b) = send(&s, json_req("POST", "/api/jam/stop", json!({}))).await;
    assert_eq!(status, StatusCode::NO_CONTENT);
}

/// Minimal percent-encoding for a filesystem path used in a query string (enough
/// for the characters that appear in a tempdir path + our test filenames).
fn urlencoding(p: &str) -> String {
    p.chars()
        .map(|c| match c {
            'A'..='Z' | 'a'..='z' | '0'..='9' | '-' | '_' | '.' | '~' => c.to_string(),
            _ => format!("%{:02X}", c as u32),
        })
        .collect()
}
