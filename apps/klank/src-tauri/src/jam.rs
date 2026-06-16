//! Jam mode: host shares tab content + scroll state over a local LAN WebSocket
//! server; guests (app or browser) subscribe and receive live snapshots.
//!
//! The axum HTTP+WS server runs on a background tokio task. A `watch` channel
//! holds the latest snapshot JSON so new subscribers receive it immediately.

use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        State,
    },
    response::{Html, IntoResponse},
    routing::get,
    Router,
};
use serde::Serialize;
use std::net::SocketAddr;
use std::sync::Mutex;
use tokio::sync::{oneshot, watch};

// ── State ─────────────────────────────────────────────────────────────────────

/// Shared state managed by Tauri (.manage()).
pub struct JamState {
    /// The latest snapshot JSON broadcast by the host.
    pub tx: watch::Sender<String>,
    /// Running server info; None when stopped.
    inner: Mutex<Option<RunningServer>>,
}

struct RunningServer {
    port: u16,
    urls: Vec<String>,
    /// Dropping / sending on this kills the axum server.
    shutdown: oneshot::Sender<()>,
}

impl Default for JamState {
    fn default() -> Self {
        let (tx, _) = watch::channel("{}".to_string());
        Self {
            tx,
            inner: Mutex::new(None),
        }
    }
}

// ── Return types ──────────────────────────────────────────────────────────────

#[derive(Serialize, Clone)]
pub struct JamInfo {
    pub port: u16,
    pub urls: Vec<String>,
}

#[derive(Serialize)]
pub struct JamStatus {
    pub hosting: bool,
    pub port: Option<u16>,
    pub urls: Vec<String>,
}

// ── LAN IP detection ─────────────────────────────────────────────────────────

fn lan_ip() -> Option<std::net::IpAddr> {
    let s = std::net::UdpSocket::bind("0.0.0.0:0").ok()?;
    s.connect("8.8.8.8:80").ok()?;
    Some(s.local_addr().ok()?.ip())
}

// ── axum app ─────────────────────────────────────────────────────────────────

#[derive(Clone)]
struct AppState {
    tx: watch::Sender<String>,
}

async fn root_handler() -> impl IntoResponse {
    Html(include_str!("jam-lite.html"))
}

async fn ws_handler(ws: WebSocketUpgrade, State(state): State<AppState>) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_socket(socket, state.tx))
}

async fn handle_socket(mut socket: WebSocket, tx: watch::Sender<String>) {
    let mut rx = tx.subscribe();

    // Send current snapshot immediately.
    let current = rx.borrow().clone();
    if socket.send(Message::Text(current.into())).await.is_err() {
        return;
    }

    loop {
        tokio::select! {
            // New snapshot from host.
            changed = rx.changed() => {
                if changed.is_err() { break; }
                let snapshot = rx.borrow().clone();
                if socket.send(Message::Text(snapshot.into())).await.is_err() {
                    break;
                }
            }
            // Drain inbound messages; detect close.
            msg = socket.recv() => {
                match msg {
                    Some(Ok(_)) => {} // ignore
                    _ => break,
                }
            }
        }
    }
}

fn build_router(tx: watch::Sender<String>) -> Router {
    let state = AppState { tx };
    Router::new()
        .route("/", get(root_handler))
        .route("/jam", get(ws_handler))
        .with_state(state)
}

// ── Tauri commands ────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn jam_start(
    state: tauri::State<'_, JamState>,
) -> Result<JamInfo, String> {
    // Stop any existing server first (idempotent).
    jam_stop_inner(&state);

    // Bind listener — prefer 7070, fall back to OS-assigned.
    let listener = match tokio::net::TcpListener::bind("0.0.0.0:7070").await {
        Ok(l) => l,
        Err(_) => tokio::net::TcpListener::bind("0.0.0.0:0")
            .await
            .map_err(|e| format!("Failed to bind: {e}"))?,
    };

    let addr: SocketAddr = listener.local_addr().map_err(|e| e.to_string())?;
    let port = addr.port();

    let urls = match lan_ip() {
        Some(ip) => vec![format!("http://{}:{}", ip, port)],
        None => vec![],
    };

    let (shutdown_tx, shutdown_rx) = oneshot::channel::<()>();

    let router = build_router(state.tx.clone());

    tauri::async_runtime::spawn(async move {
        let _ = axum::serve(listener, router)
            .with_graceful_shutdown(async move {
                let _ = shutdown_rx.await;
            })
            .await;
    });

    let info = JamInfo {
        port,
        urls: urls.clone(),
    };

    {
        let mut guard = state.inner.lock().map_err(|e| e.to_string())?;
        *guard = Some(RunningServer {
            port,
            urls,
            shutdown: shutdown_tx,
        });
    }

    Ok(info)
}

fn jam_stop_inner(state: &tauri::State<'_, JamState>) {
    if let Ok(mut guard) = state.inner.lock() {
        if let Some(server) = guard.take() {
            // Sending triggers graceful shutdown; ignore errors (already gone).
            let _ = server.shutdown.send(());
        }
    }
}

#[tauri::command]
pub async fn jam_stop(state: tauri::State<'_, JamState>) -> Result<(), String> {
    jam_stop_inner(&state);
    Ok(())
}

#[tauri::command]
pub async fn jam_broadcast(
    state: tauri::State<'_, JamState>,
    snapshot: String,
) -> Result<(), String> {
    // Ignore send errors (no active receivers is fine).
    let _ = state.tx.send(snapshot);
    Ok(())
}

#[tauri::command]
pub fn jam_status(state: tauri::State<'_, JamState>) -> JamStatus {
    match state.inner.lock() {
        Ok(guard) => match guard.as_ref() {
            Some(s) => JamStatus {
                hosting: true,
                port: Some(s.port),
                urls: s.urls.clone(),
            },
            None => JamStatus {
                hosting: false,
                port: None,
                urls: vec![],
            },
        },
        Err(_) => JamStatus {
            hosting: false,
            port: None,
            urls: vec![],
        },
    }
}
