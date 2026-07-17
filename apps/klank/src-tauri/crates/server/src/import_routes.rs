//! Import route — streams the headless pipeline as NDJSON.
//!
//! Runs only the two headless stages (mobile API + website); the hidden-webview
//! Cloudflare fallback is desktop-only. The core `emit` closure is bridged into
//! an mpsc channel drained as `application/x-ndjson`: zero or more serialized
//! `ImportProgress` lines, then exactly one terminal `{"done":…}` or
//! `{"error":…}` line. Always `200` (even for an invalid URL — the failure is
//! carried in the terminal line).

use crate::AppState;
use axum::{
    body::Body,
    extract::State,
    http::header,
    response::{IntoResponse, Response},
    Json,
};
use klank_core::import::{build_headless_stages, run_pipeline, ImportProgress};
use serde::Deserialize;
use serde_json::json;
use std::convert::Infallible;
use tokio::sync::mpsc;
use tokio_stream::{wrappers::UnboundedReceiverStream, StreamExt};

#[derive(Deserialize)]
pub struct ImportBody {
    pub url: String,
}

pub async fn import(State(s): State<AppState>, Json(body): Json<ImportBody>) -> Response {
    let (tx, rx) = mpsc::unbounded_channel::<String>();
    let config_dir = (*s.config_dir).clone();

    tokio::spawn(async move {
        let http = match reqwest::Client::builder().build() {
            Ok(c) => c,
            Err(e) => {
                let _ = tx.send(json!({ "error": e.to_string() }).to_string());
                return;
            }
        };
        let stages = build_headless_stages(&config_dir, body.url, http);
        let emit_tx = tx.clone();
        let emit = move |p: ImportProgress| {
            if let Ok(line) = serde_json::to_string(&p) {
                let _ = emit_tx.send(line);
            }
        };
        let terminal = match run_pipeline(stages, &config_dir, emit).await {
            Ok(tab) => json!({
                "done": { "content": tab.content, "artist": tab.artist, "song": tab.song }
            }),
            Err(e) => json!({ "error": e }),
        };
        let _ = tx.send(terminal.to_string());
    });

    let stream =
        UnboundedReceiverStream::new(rx).map(|line| Ok::<String, Infallible>(format!("{line}\n")));

    Response::builder()
        .header(header::CONTENT_TYPE, "application/x-ndjson")
        .body(Body::from_stream(stream))
        .unwrap()
        .into_response()
}
