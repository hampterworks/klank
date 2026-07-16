//! `klank-server` — the headless axum binary behind the `hampterworks/klank`
//! container. It serves the SPA and the HTTP/WebSocket API in `docs/server-api.md`,
//! all thin over [`klank_core`], so the server and the desktop app share one
//! backend. Runtime config comes from env vars (see [`Config`]).

mod fs_routes;
mod git_routes;
mod import_routes;
mod jam_routes;
#[cfg(test)]
mod tests;

use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::{get, post, put},
    Json, Router,
};
use klank_core::fs::FsError;
use klank_core::jam::JamChannels;
use serde_json::json;
use std::path::PathBuf;
use std::sync::Arc;
use tower_http::services::{ServeDir, ServeFile};

/// Shared, cheaply-cloneable server state.
#[derive(Clone)]
pub struct AppState {
    /// Tab library root and git working tree (`KLANK_TABS_DIR`).
    pub tabs_dir: Arc<PathBuf>,
    /// Secrets/state dir (`KLANK_CONFIG_DIR`): `git_token`, `ug_device_id`, …
    pub config_dir: Arc<PathBuf>,
    /// SPA build output (`KLANK_STATIC_DIR`).
    pub static_dir: Arc<PathBuf>,
    /// Serializes every `.klank-settings.json` mutation (single writer).
    pub settings_lock: Arc<tokio::sync::Mutex<()>>,
    /// Jam transport + hosting flag.
    pub jam: Arc<JamShared>,
    /// Crate version, reported by `GET /api/version`.
    pub version: &'static str,
}

pub struct JamShared {
    pub channels: JamChannels,
    pub hosting: std::sync::Mutex<Hosting>,
}

#[derive(Default)]
pub struct Hosting {
    pub hosting: bool,
    pub name: Option<String>,
}

/// Maps a [`FsError`] to its HTTP status + `{"error": …}` body. A newtype so we
/// can implement the foreign `IntoResponse` trait for the core error.
pub struct ApiError(pub FsError);

impl From<FsError> for ApiError {
    fn from(e: FsError) -> Self {
        ApiError(e)
    }
}

impl ApiError {
    pub fn internal(msg: impl Into<String>) -> Self {
        ApiError(FsError::Internal(msg.into()))
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let (code, msg) = match self.0 {
            FsError::BadRequest(m) => (StatusCode::BAD_REQUEST, m),
            FsError::NotFound(m) => (StatusCode::NOT_FOUND, m),
            FsError::Internal(m) => (StatusCode::INTERNAL_SERVER_ERROR, m),
        };
        (code, Json(json!({ "error": msg }))).into_response()
    }
}

fn env_dir(key: &str, default: &str) -> PathBuf {
    PathBuf::from(std::env::var(key).unwrap_or_else(|_| default.to_string()))
}

/// Builds the full router for a given state (extracted so integration tests can
/// drive it with `tower::ServiceExt::oneshot` against a tempdir).
pub fn app(state: AppState) -> Router {
    let api = Router::new()
        .route("/version", get(version))
        .route("/tree", get(fs_routes::tree))
        .route(
            "/file",
            get(fs_routes::get_file)
                .put(fs_routes::put_file)
                .delete(fs_routes::delete_file),
        )
        .route("/exists", get(fs_routes::exists))
        .route("/settings", get(fs_routes::get_settings))
        .route(
            "/settings/tab",
            put(fs_routes::put_tab_setting).delete(fs_routes::delete_tab_setting),
        )
        .route(
            "/playlists",
            get(fs_routes::get_playlists).put(fs_routes::put_playlists),
        )
        .route(
            "/play-metrics",
            get(fs_routes::get_play_metrics).put(fs_routes::put_play_metrics),
        )
        .route("/import", post(import_routes::import))
        .merge(git_routes::routes())
        .merge(jam_routes::api_routes());

    // `fallback` (not `not_found_service`) so client-side routes get the SPA
    // index with a 200 — `not_found_service` forces the status to 404.
    let index = state.static_dir.join("index.html");
    let serve = ServeDir::new(&*state.static_dir).fallback(ServeFile::new(index));

    Router::new()
        .nest("/api", api)
        .route("/jam", get(jam_routes::ws))
        .fallback_service(serve)
        .with_state(state)
}

async fn version(
    axum::extract::State(s): axum::extract::State<AppState>,
) -> Json<serde_json::Value> {
    Json(json!({
        "version": s.version,
        "mode": "server",
        "root": s.tabs_dir.to_string_lossy(),
    }))
}

async fn shutdown_signal() {
    let ctrl_c = async {
        let _ = tokio::signal::ctrl_c().await;
    };
    #[cfg(unix)]
    let terminate = async {
        use tokio::signal::unix::{signal, SignalKind};
        if let Ok(mut s) = signal(SignalKind::terminate()) {
            s.recv().await;
        }
    };
    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {},
        _ = terminate => {},
    }
}

#[tokio::main]
async fn main() {
    // /data is typically a bind mount not owned by the container user; without
    // this, libgit2 rejects the repo ("not owned by current user").
    klank_core::git::allow_foreign_repo_ownership();

    let tabs_dir = env_dir("KLANK_TABS_DIR", "/data");
    let config_dir = env_dir("KLANK_CONFIG_DIR", "/config");
    let static_dir = env_dir("KLANK_STATIC_DIR", "/app/static");
    let port: u16 = std::env::var("KLANK_PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(8080);

    for dir in [&tabs_dir, &config_dir] {
        if let Err(e) = std::fs::create_dir_all(dir) {
            eprintln!("failed to create {}: {e}", dir.display());
        }
    }

    let state = AppState {
        tabs_dir: Arc::new(tabs_dir),
        config_dir: Arc::new(config_dir),
        static_dir: Arc::new(static_dir),
        settings_lock: Arc::new(tokio::sync::Mutex::new(())),
        jam: Arc::new(JamShared {
            channels: JamChannels::default(),
            hosting: std::sync::Mutex::new(Hosting::default()),
        }),
        version: env!("CARGO_PKG_VERSION"),
    };

    let listener = match tokio::net::TcpListener::bind(("0.0.0.0", port)).await {
        Ok(l) => l,
        Err(e) => {
            eprintln!("failed to bind 0.0.0.0:{port}: {e}");
            std::process::exit(1);
        }
    };
    println!("klank-server listening on 0.0.0.0:{port}");

    if let Err(e) = axum::serve(listener, app(state))
        .with_graceful_shutdown(shutdown_signal())
        .await
    {
        eprintln!("server error: {e}");
    }
}
