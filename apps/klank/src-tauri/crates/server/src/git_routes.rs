//! Git routes — thin over [`klank_core::git`]. The repo is always `KLANK_TABS_DIR`
//! and the token/cred-mode live in `KLANK_CONFIG_DIR`; there is no `dir`
//! parameter. Git failures are carried inside `GitResult`/`SyncResult` (never
//! HTTP errors), exactly like the desktop commands. Network operations run on a
//! blocking thread so libgit2 I/O never stalls the async runtime.

use crate::{ApiError, AppState};
use axum::{
    extract::State,
    http::StatusCode,
    routing::{get, post, put},
    Json, Router,
};
use klank_core::git::{self, BranchInfo, GitChangedFile, GitResult, SyncResult};
use serde::Deserialize;
use serde_json::{json, Value};

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/git/is-repo", get(is_repo))
        .route("/git/status", get(status))
        .route("/git/pull", post(pull))
        .route("/git/commit", post(commit))
        .route("/git/push", post(push))
        .route("/git/unpushed", get(unpushed))
        .route("/git/sync", post(sync))
        .route("/git/branches", get(branches))
        .route("/git/checkout", post(checkout))
        .route("/git/clone", post(clone))
        .route("/git/token", put(set_token))
        .route("/git/has-token", get(has_token))
        .route("/git/is-authenticated", get(is_authenticated))
        .route(
            "/git/system-credentials-enabled",
            get(system_credentials_enabled),
        )
        .route("/git/use-system-credentials", post(use_system_credentials))
        .route(
            "/git/disable-system-credentials",
            post(disable_system_credentials),
        )
}

fn dir(s: &AppState) -> String {
    s.tabs_dir.to_string_lossy().to_string()
}

async fn blocking<T: Send + 'static>(
    f: impl FnOnce() -> T + Send + 'static,
) -> Result<T, ApiError> {
    tokio::task::spawn_blocking(f)
        .await
        .map_err(|e| ApiError::internal(e.to_string()))
}

async fn is_repo(State(s): State<AppState>) -> Json<Value> {
    Json(json!({ "value": git::git_is_repo(&dir(&s)) }))
}

async fn status(State(s): State<AppState>) -> Result<Json<Vec<GitChangedFile>>, ApiError> {
    let d = dir(&s);
    blocking(move || git::git_status(&d))
        .await?
        .map(Json)
        .map_err(ApiError::internal)
}

async fn pull(State(s): State<AppState>) -> Result<Json<GitResult>, ApiError> {
    let (c, d) = ((*s.config_dir).clone(), dir(&s));
    Ok(Json(blocking(move || git::git_pull(&c, &d)).await?))
}

#[derive(Deserialize)]
struct CommitBody {
    message: String,
}

async fn commit(
    State(s): State<AppState>,
    Json(body): Json<CommitBody>,
) -> Result<Json<GitResult>, ApiError> {
    let d = dir(&s);
    Ok(Json(
        blocking(move || git::git_commit(&d, &body.message)).await?,
    ))
}

async fn push(State(s): State<AppState>) -> Result<Json<GitResult>, ApiError> {
    let (c, d) = ((*s.config_dir).clone(), dir(&s));
    Ok(Json(blocking(move || git::git_push(&c, &d)).await?))
}

async fn unpushed(State(s): State<AppState>) -> Result<Json<Vec<String>>, ApiError> {
    let d = dir(&s);
    blocking(move || git::git_unpushed(&d))
        .await?
        .map(Json)
        .map_err(ApiError::internal)
}

async fn sync(State(s): State<AppState>) -> Result<Json<SyncResult>, ApiError> {
    let (c, d) = ((*s.config_dir).clone(), dir(&s));
    Ok(Json(blocking(move || git::git_sync(&c, &d)).await?))
}

async fn branches(State(s): State<AppState>) -> Result<Json<Vec<BranchInfo>>, ApiError> {
    let d = dir(&s);
    blocking(move || git::git_list_branches(&d))
        .await?
        .map(Json)
        .map_err(ApiError::internal)
}

#[derive(Deserialize)]
struct CheckoutBody {
    branch: String,
}

async fn checkout(
    State(s): State<AppState>,
    Json(body): Json<CheckoutBody>,
) -> Result<Json<GitResult>, ApiError> {
    let d = dir(&s);
    Ok(Json(
        blocking(move || git::git_checkout_branch(&d, &body.branch)).await?,
    ))
}

#[derive(Deserialize)]
struct CloneBody {
    url: String,
}

async fn clone(
    State(s): State<AppState>,
    Json(body): Json<CloneBody>,
) -> Result<Json<GitResult>, ApiError> {
    let (c, d) = ((*s.config_dir).clone(), dir(&s));
    Ok(Json(
        blocking(move || git::git_clone(&c, &body.url, &d)).await?,
    ))
}

#[derive(Deserialize)]
struct TokenBody {
    token: String,
}

async fn set_token(
    State(s): State<AppState>,
    Json(body): Json<TokenBody>,
) -> Result<StatusCode, ApiError> {
    git::git_set_token(&s.config_dir, body.token).map_err(ApiError::internal)?;
    Ok(StatusCode::NO_CONTENT)
}

async fn has_token(State(s): State<AppState>) -> Json<Value> {
    Json(json!({ "value": git::git_has_token(&s.config_dir) }))
}

async fn is_authenticated(State(s): State<AppState>) -> Json<Value> {
    // Token only — the system credential helper is a desktop-only feature.
    Json(json!({ "value": git::git_has_token(&s.config_dir) }))
}

async fn system_credentials_enabled() -> Json<Value> {
    Json(json!({ "value": false }))
}

async fn use_system_credentials() -> Json<GitResult> {
    Json(GitResult {
        success: false,
        output: String::new(),
        error: Some("System git credentials are not available in server mode".into()),
    })
}

async fn disable_system_credentials() -> StatusCode {
    StatusCode::NO_CONTENT
}
