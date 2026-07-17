//! `klank_core` — the platform-free heart of klank.
//!
//! Every module here is free of any Tauri dependency, so both the Tauri desktop
//! app (thin `#[tauri::command]` wrappers) and the headless `klank-server` axum
//! binary drive the *same* engine: git sync, the tab-import pipeline, the jam
//! transport, and the file/settings store. Where the Tauri version reached for
//! an `AppHandle` (only ever to find `app_config_dir`), these take an explicit
//! `config_dir: &Path` instead.

pub mod fs;
pub mod git;
pub mod import;
pub mod jam;
