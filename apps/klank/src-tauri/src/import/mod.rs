//! Tauri-side import composition.
//!
//! The orchestrator, the two headless stages, and all pipeline types live in
//! [`klank_core::import`]. This module supplies only the hidden-webview fallback
//! stage — it needs a real browser (a WRY `WebviewWindow` on desktop, a Kotlin
//! `WebView` plugin on Android) and therefore cannot live in the Tauri-free core.
//! `scrape_ug` builds the core headless stages, appends the webview stage, and
//! runs the shared pipeline with an emit closure wrapping the Tauri channel.

mod stages;

// Desktop-only IPC for the hidden webview stage (registered in `lib.rs`).
#[cfg(desktop)]
pub use stages::desktop;

// Re-exported so `lib.rs`'s `use import::ImportProgress` keeps resolving.
pub use klank_core::import::ImportProgress;

use tauri::ipc::Channel;
use tauri::Manager;

/// Imports a tab from a UG URL: headless core stages + the webview fallback,
/// streaming progress over `on_progress`, returning `{ content, artist, song }`
/// JSON (the frontend strips markup and builds the filename).
pub async fn run(
    app: tauri::AppHandle,
    url: String,
    on_progress: Channel<ImportProgress>,
) -> Result<String, String> {
    let config_dir = app.path().app_config_dir().map_err(|e| e.to_string())?;
    let http = reqwest::Client::builder()
        .build()
        .map_err(|e| e.to_string())?;

    let mut stages = klank_core::import::build_headless_stages(&config_dir, url.clone(), http);
    stages.push(Box::new(stages::ug_webview::UgWebview::new(
        app.clone(),
        url,
    )));

    let emit = move |p: ImportProgress| {
        let _ = on_progress.send(p);
    };

    let tab = klank_core::import::run_pipeline(stages, &config_dir, emit).await?;
    serde_json::to_string(&serde_json::json!({
        "content": tab.content,
        "artist": tab.artist,
        "song": tab.song,
    }))
    .map_err(|e| e.to_string())
}
