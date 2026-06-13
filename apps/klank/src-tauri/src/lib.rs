//! Tauri backend for klank. Exposes the `scrape_ug` IPC command, which imports
//! a tab from an Ultimate Guitar URL through a layered, observable pipeline (see
//! the [`import`] module).
mod import;

use import::ImportProgress;
use tauri::ipc::Channel;

/// Imports a tab from a UG URL. Tries each import stage in order, streaming
/// progress over `on_progress`, and returns the tab as JSON
/// `{ content, artist, song }` (the frontend strips `[ch]`/`[tab]` markup and
/// builds the filename). Returns `Err` with a human-readable summary if every
/// stage fails.
#[tauri::command]
async fn scrape_ug(
    app: tauri::AppHandle,
    url: String,
    on_progress: Channel<ImportProgress>,
) -> Result<String, String> {
    import::run(app, url, on_progress).await
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_shell::init());

    // The hidden-webview import stage (and its IPC) is desktop-only; Android
    // uses the mobile API / website stages and (next) a dedicated plugin.
    #[cfg(desktop)]
    let builder = builder
        .manage(import::desktop::UgWebviewState::default())
        .invoke_handler(tauri::generate_handler![
            scrape_ug,
            import::desktop::deliver_ug_html,
            import::desktop::report_ug_challenge
        ]);
    #[cfg(not(desktop))]
    let builder = builder.invoke_handler(tauri::generate_handler![scrape_ug]);

    builder
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
