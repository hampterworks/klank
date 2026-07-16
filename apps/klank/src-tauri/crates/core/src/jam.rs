//! Jam mode transport (platform-free core).
//!
//! A jam host shares tab content + scroll state over a WebSocket; guests (app or
//! browser) subscribe and receive live snapshots. This module owns the pure
//! transport: a `watch` channel holding the latest snapshot JSON (so new
//! subscribers get it immediately), a second `watch` channel tracking the live
//! guest count (injected into every frame), the axum router, and the per-socket
//! loop.
//!
//! Both drivers share it: the tauri desktop/Android app spawns [`build_router`]
//! on its own LAN listener (and layers mDNS discovery on top, in the tauri
//! crate), while `klank-server` mounts the `/jam` WebSocket onto its main router
//! and drives the same [`JamChannels`]. mDNS/discovery lives entirely in the
//! tauri crate — it is meaningless in a container.

use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        State,
    },
    response::{Html, IntoResponse},
    routing::get,
    Router,
};
use tokio::sync::watch;

/// The two broadcast channels a jam is built on. Held by whichever runtime hosts
/// the jam (tauri `JamState` or the server's `AppState`) so both can `broadcast`
/// snapshots and read the live client count identically.
#[derive(Clone)]
pub struct JamChannels {
    /// The latest snapshot JSON broadcast by the host.
    pub tx: watch::Sender<String>,
    /// Number of guests currently connected to the host's WebSocket.
    pub clients: watch::Sender<usize>,
}

impl Default for JamChannels {
    fn default() -> Self {
        let (tx, _) = watch::channel("{}".to_string());
        let (clients, _) = watch::channel(0usize);
        Self { tx, clients }
    }
}

#[derive(Clone)]
struct AppState {
    tx: watch::Sender<String>,
    clients: watch::Sender<usize>,
}

async fn root_handler() -> impl IntoResponse {
    Html(include_str!("jam-lite.html"))
}

async fn ws_handler(ws: WebSocketUpgrade, State(state): State<AppState>) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_socket(socket, state.tx, state.clients))
}

/// Merge the live client count into a snapshot JSON object so guests and the
/// browser client see `clients` without a second message type. Falls back to
/// the raw snapshot if it isn't a JSON object.
pub fn frame(snapshot: &str, clients: usize) -> String {
    match serde_json::from_str::<serde_json::Value>(snapshot) {
        Ok(serde_json::Value::Object(mut map)) => {
            map.insert("clients".to_string(), serde_json::Value::from(clients));
            serde_json::Value::Object(map).to_string()
        }
        _ => snapshot.to_string(),
    }
}

/// Guest socket loop: send the current snapshot immediately, then push a fresh
/// frame on every snapshot or client-count change until the socket closes.
pub async fn handle_socket(
    mut socket: WebSocket,
    snap_tx: watch::Sender<String>,
    clients: watch::Sender<usize>,
) {
    // Count this guest in, then subscribe so we also see later changes.
    clients.send_modify(|c| *c += 1);
    let mut snap_rx = snap_tx.subscribe();
    let mut cli_rx = clients.subscribe();

    // Send the current snapshot + count immediately.
    let initial = frame(&snap_rx.borrow(), *cli_rx.borrow());
    if socket.send(Message::Text(initial.into())).await.is_err() {
        clients.send_modify(|c| *c = c.saturating_sub(1));
        return;
    }

    loop {
        tokio::select! {
            // New snapshot from host.
            changed = snap_rx.changed() => {
                if changed.is_err() { break; }
                let f = frame(&snap_rx.borrow(), *cli_rx.borrow());
                if socket.send(Message::Text(f.into())).await.is_err() { break; }
            }
            // Connected-guest count changed (someone joined/left).
            changed = cli_rx.changed() => {
                if changed.is_err() { break; }
                let f = frame(&snap_rx.borrow(), *cli_rx.borrow());
                if socket.send(Message::Text(f.into())).await.is_err() { break; }
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

    // Count this guest out.
    clients.send_modify(|c| *c = c.saturating_sub(1));
}

/// A self-contained jam router: `GET /` serves the browser `jam-lite` client and
/// `GET /jam` upgrades to the guest WebSocket. The tauri crate serves this on its
/// own LAN listener; `klank-server` instead mounts just the `/jam` handler on its
/// main router (SPA owns `/`), driving the same [`handle_socket`].
pub fn build_router(tx: watch::Sender<String>, clients: watch::Sender<usize>) -> Router {
    let state = AppState { tx, clients };
    Router::new()
        .route("/", get(root_handler))
        .route("/jam", get(ws_handler))
        .with_state(state)
}
