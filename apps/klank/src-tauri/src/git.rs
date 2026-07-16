//! Thin Tauri command wrappers over [`klank_core::git`].
//!
//! Each command resolves `app_config_dir` once (where the PAT / cred-mode
//! markers live) and delegates to the shared engine, so desktop, Android, and
//! `klank-server` run identical git logic. All are `#[tauri::command(async)]`:
//! the bodies block on libgit2 network I/O and the core `SYNC_LOCK`, which would
//! freeze the UI thread — running off-thread keeps the app responsive.

use klank_core::git::{BranchInfo, GitChangedFile, GitResult, SyncResult};
use std::path::PathBuf;
use tauri::Manager;

/// The app-private config dir holding `git_token` / `git_cred_mode`.
fn config_dir(app: &tauri::AppHandle) -> Option<PathBuf> {
    app.path().app_config_dir().ok()
}

/// Builds a `GitResult` failure for the (practically unreachable) case where the
/// OS has no app config dir, so git commands still return their structured shape.
fn no_config_dir() -> GitResult {
    GitResult {
        success: false,
        output: String::new(),
        error: Some("no config directory".into()),
    }
}

#[tauri::command(async)]
pub fn git_set_token(app: tauri::AppHandle, token: String) -> Result<(), String> {
    let cfg = config_dir(&app).ok_or("no config directory")?;
    klank_core::git::git_set_token(&cfg, token)
}

#[tauri::command(async)]
pub fn git_has_token(app: tauri::AppHandle) -> bool {
    config_dir(&app)
        .map(|c| klank_core::git::git_has_token(&c))
        .unwrap_or(false)
}

#[tauri::command(async)]
pub fn git_is_authenticated(app: tauri::AppHandle) -> bool {
    config_dir(&app)
        .map(|c| klank_core::git::git_is_authenticated(&c))
        .unwrap_or(false)
}

#[tauri::command(async)]
pub fn git_system_credentials_enabled(app: tauri::AppHandle) -> bool {
    config_dir(&app)
        .map(|c| klank_core::git::git_system_credentials_enabled(&c))
        .unwrap_or(false)
}

#[tauri::command(async)]
pub fn git_use_system_credentials(app: tauri::AppHandle, dir: String) -> GitResult {
    match config_dir(&app) {
        Some(cfg) => klank_core::git::git_use_system_credentials(&cfg, &dir),
        None => no_config_dir(),
    }
}

#[tauri::command(async)]
pub fn git_disable_system_credentials(app: tauri::AppHandle) -> Result<(), String> {
    let cfg = config_dir(&app).ok_or("no config directory")?;
    klank_core::git::git_disable_system_credentials(&cfg)
}

#[tauri::command(async)]
pub fn git_is_repo(dir: String) -> bool {
    klank_core::git::git_is_repo(&dir)
}

#[tauri::command(async)]
pub fn git_status(dir: String) -> Result<Vec<GitChangedFile>, String> {
    klank_core::git::git_status(&dir)
}

#[tauri::command(async)]
pub fn git_commit(dir: String, message: String) -> GitResult {
    klank_core::git::git_commit(&dir, &message)
}

#[tauri::command(async)]
pub fn git_pull(app: tauri::AppHandle, dir: String) -> GitResult {
    match config_dir(&app) {
        Some(cfg) => klank_core::git::git_pull(&cfg, &dir),
        None => no_config_dir(),
    }
}

#[tauri::command(async)]
pub fn git_push(app: tauri::AppHandle, dir: String) -> GitResult {
    match config_dir(&app) {
        Some(cfg) => klank_core::git::git_push(&cfg, &dir),
        None => no_config_dir(),
    }
}

#[tauri::command(async)]
pub fn git_unpushed(dir: String) -> Result<Vec<String>, String> {
    klank_core::git::git_unpushed(&dir)
}

#[tauri::command(async)]
pub fn git_clone(app: tauri::AppHandle, url: String, dir: String) -> GitResult {
    match config_dir(&app) {
        Some(cfg) => klank_core::git::git_clone(&cfg, &url, &dir),
        None => no_config_dir(),
    }
}

#[tauri::command(async)]
pub fn git_sync(app: tauri::AppHandle, dir: String) -> SyncResult {
    match config_dir(&app) {
        Some(cfg) => klank_core::git::git_sync(&cfg, &dir),
        None => SyncResult {
            success: false,
            message: "no config directory".into(),
            error: Some("no config directory".into()),
            error_kind: Some("other".into()),
            ..Default::default()
        },
    }
}

#[tauri::command(async)]
pub fn git_list_branches(dir: String) -> Result<Vec<BranchInfo>, String> {
    klank_core::git::git_list_branches(&dir)
}

#[tauri::command(async)]
pub fn git_checkout_branch(dir: String, branch: String) -> GitResult {
    klank_core::git::git_checkout_branch(&dir, &branch)
}
