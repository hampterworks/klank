//! File & settings routes — thin over [`klank_core::fs`].

use crate::{ApiError, AppState};
use axum::{extract::State, http::StatusCode, Json};
use klank_core::fs;
use serde::Deserialize;
use serde_json::{json, Map, Value};

#[derive(Deserialize)]
pub struct PathQuery {
    pub path: String,
}

pub async fn tree(State(s): State<AppState>) -> Json<Vec<fs::TreeEntry>> {
    Json(fs::read_tree(&s.tabs_dir))
}

pub async fn get_file(
    State(s): State<AppState>,
    axum::extract::Query(q): axum::extract::Query<PathQuery>,
) -> Result<Json<Value>, ApiError> {
    let content = fs::read_file(&s.tabs_dir, &q.path)?;
    Ok(Json(json!({ "content": content })))
}

#[derive(Deserialize)]
pub struct PutFile {
    pub filename: String,
    pub target: String,
    pub content: String,
}

pub async fn put_file(
    State(s): State<AppState>,
    Json(body): Json<PutFile>,
) -> Result<Json<Value>, ApiError> {
    let path = fs::write_file(&s.tabs_dir, &body.target, &body.filename, &body.content)?;
    Ok(Json(json!({ "path": path })))
}

pub async fn delete_file(
    State(s): State<AppState>,
    axum::extract::Query(q): axum::extract::Query<PathQuery>,
) -> Result<StatusCode, ApiError> {
    fs::delete_file(&s.tabs_dir, &q.path)?;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn exists(
    State(s): State<AppState>,
    axum::extract::Query(q): axum::extract::Query<PathQuery>,
) -> Result<Json<Value>, ApiError> {
    Ok(Json(
        json!({ "exists": fs::path_exists(&s.tabs_dir, &q.path)? }),
    ))
}

pub async fn get_settings(State(s): State<AppState>) -> Json<Map<String, Value>> {
    Json(fs::read_settings(&s.tabs_dir, &s.settings_lock).await)
}

#[derive(Deserialize)]
pub struct TabSettingBody {
    pub path: String,
    pub settings: Value,
}

pub async fn put_tab_setting(
    State(s): State<AppState>,
    Json(body): Json<TabSettingBody>,
) -> Result<StatusCode, ApiError> {
    fs::write_tab_setting(&s.tabs_dir, &s.settings_lock, &body.path, body.settings).await?;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn delete_tab_setting(
    State(s): State<AppState>,
    axum::extract::Query(q): axum::extract::Query<PathQuery>,
) -> Result<StatusCode, ApiError> {
    fs::delete_tab_setting(&s.tabs_dir, &s.settings_lock, &q.path).await?;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn get_playlists(State(s): State<AppState>) -> Json<Vec<Value>> {
    Json(fs::read_playlists(&s.tabs_dir, &s.settings_lock).await)
}

pub async fn put_playlists(
    State(s): State<AppState>,
    Json(playlists): Json<Vec<Value>>,
) -> Result<StatusCode, ApiError> {
    fs::write_playlists(&s.tabs_dir, &s.settings_lock, playlists).await?;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn get_play_metrics(State(s): State<AppState>) -> Json<Map<String, Value>> {
    Json(fs::read_play_metrics(&s.tabs_dir, &s.settings_lock).await)
}

pub async fn put_play_metrics(
    State(s): State<AppState>,
    Json(metrics): Json<Map<String, Value>>,
) -> Result<StatusCode, ApiError> {
    fs::write_play_metrics(&s.tabs_dir, &s.settings_lock, metrics).await?;
    Ok(StatusCode::NO_CONTENT)
}
