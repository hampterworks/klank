//! Jam mode: host shares tab content + scroll state over a local LAN WebSocket
//! server; guests (app or browser) subscribe and receive live snapshots.
//!
//! The axum HTTP+WS server runs on a background tokio task. A `watch` channel
//! holds the latest snapshot JSON so new subscribers receive it immediately.
//! A second `watch` channel tracks the live connected-guest count, which is
//! injected into every outgoing frame so all participants can see it.
//!
//! Hosts also advertise the jam over mDNS (`_klank-jam._tcp.local.`) so other
//! klank apps on the same LAN can discover and join without typing an address.
//! mDNS is best-effort: if the daemon can't start (e.g. multicast blocked, or
//! a mobile OS without a held multicast lock) hosting still works via the
//! manual `ip:port` join fallback.

use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        State,
    },
    response::{Html, IntoResponse},
    routing::get,
    Router,
};
use mdns_sd::{ServiceDaemon, ServiceEvent, ServiceInfo};
use serde::Serialize;
use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::Mutex;
use std::time::Duration;
use tokio::sync::{oneshot, watch};

/// mDNS service type advertised/browsed for klank jams.
const SERVICE_TYPE: &str = "_klank-jam._tcp.local.";

// ── State ─────────────────────────────────────────────────────────────────────

/// Shared state managed by Tauri (.manage()).
pub struct JamState {
    /// The latest snapshot JSON broadcast by the host.
    pub tx: watch::Sender<String>,
    /// Number of guests currently connected to the host's WebSocket.
    pub clients: watch::Sender<usize>,
    inner: Mutex<Inner>,
}

#[derive(Default)]
struct Inner {
    /// Running server info; None when stopped.
    server: Option<RunningServer>,
    /// Reused mDNS daemon, created lazily on first host/discover.
    mdns: Option<ServiceDaemon>,
}

struct RunningServer {
    port: u16,
    urls: Vec<String>,
    name: String,
    /// Dropping / sending on this kills the axum server.
    shutdown: oneshot::Sender<()>,
    /// Registered mDNS fullname, if advertising succeeded — used to unregister
    /// on stop and to filter our own jam out of discovery results.
    mdns_fullname: Option<String>,
}

impl Default for JamState {
    fn default() -> Self {
        let (tx, _) = watch::channel("{}".to_string());
        let (clients, _) = watch::channel(0usize);
        Self {
            tx,
            clients,
            inner: Mutex::new(Inner::default()),
        }
    }
}

// ── Return types ──────────────────────────────────────────────────────────────

#[derive(Serialize, Clone)]
pub struct JamInfo {
    pub port: u16,
    pub urls: Vec<String>,
    pub name: String,
}

#[derive(Serialize)]
pub struct JamStatus {
    pub hosting: bool,
    pub port: Option<u16>,
    pub urls: Vec<String>,
    pub name: Option<String>,
    /// Guests currently connected (host perspective).
    pub clients: usize,
}

/// A jam discovered on the local network.
#[derive(Serialize)]
pub struct DiscoveredJam {
    pub name: String,
    /// `ip:port` ready to hand to the guest connect flow.
    pub address: String,
}

// ── LAN IP detection ─────────────────────────────────────────────────────────

fn lan_ip() -> Option<std::net::IpAddr> {
    let s = std::net::UdpSocket::bind("0.0.0.0:0").ok()?;
    s.connect("8.8.8.8:80").ok()?;
    Some(s.local_addr().ok()?.ip())
}

// ── mDNS helpers ────────────────────────────────────────────────────────────

/// Lazily create (and reuse) the shared mDNS daemon. Returns None when mDNS is
/// unavailable on this platform/network — callers degrade to manual join.
fn ensure_mdns(inner: &mut Inner) -> Option<ServiceDaemon> {
    if inner.mdns.is_none() {
        match ServiceDaemon::new() {
            Ok(d) => inner.mdns = Some(d),
            Err(e) => {
                log::warn!("mDNS unavailable: {e}");
                return None;
            }
        }
    }
    inner.mdns.clone()
}

/// DNS-safe `<name>.local.` hostname derived from a jam name.
fn safe_host(name: &str) -> String {
    let cleaned: String = name
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() || c == '-' { c } else { '-' })
        .collect();
    let trimmed = cleaned.trim_matches('-');
    if trimmed.is_empty() {
        "klank-jam.local.".to_string()
    } else {
        format!("{trimmed}.local.")
    }
}

/// Best-effort advertise of this jam. Returns the registered fullname on success.
fn advertise(daemon: &ServiceDaemon, name: &str, ip: std::net::IpAddr, port: u16) -> Option<String> {
    let host = safe_host(name);
    let props: [(&str, &str); 1] = [("name", name)];
    let info = match ServiceInfo::new(SERVICE_TYPE, name, &host, ip, port, &props[..]) {
        Ok(i) => i,
        Err(e) => {
            log::warn!("mDNS service info failed: {e}");
            return None;
        }
    };
    let fullname = info.get_fullname().to_string();
    match daemon.register(info) {
        Ok(()) => Some(fullname),
        Err(e) => {
            log::warn!("mDNS register failed: {e}");
            None
        }
    }
}

// ── axum app ─────────────────────────────────────────────────────────────────

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
fn frame(snapshot: &str, clients: usize) -> String {
    match serde_json::from_str::<serde_json::Value>(snapshot) {
        Ok(serde_json::Value::Object(mut map)) => {
            map.insert("clients".to_string(), serde_json::Value::from(clients));
            serde_json::Value::Object(map).to_string()
        }
        _ => snapshot.to_string(),
    }
}

async fn handle_socket(
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

fn build_router(tx: watch::Sender<String>, clients: watch::Sender<usize>) -> Router {
    let state = AppState { tx, clients };
    Router::new()
        .route("/", get(root_handler))
        .route("/jam", get(ws_handler))
        .with_state(state)
}

// ── Tauri commands ────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn jam_start(
    state: tauri::State<'_, JamState>,
    name: String,
) -> Result<JamInfo, String> {
    // Stop any existing server first (idempotent).
    jam_stop_inner(&state);

    // Reset the connected count for the fresh session.
    state.clients.send_modify(|c| *c = 0);

    // Bind listener — prefer 7070, fall back to OS-assigned.
    let listener = match tokio::net::TcpListener::bind("0.0.0.0:7070").await {
        Ok(l) => l,
        Err(_) => tokio::net::TcpListener::bind("0.0.0.0:0")
            .await
            .map_err(|e| format!("Failed to bind: {e}"))?,
    };

    let addr: SocketAddr = listener.local_addr().map_err(|e| e.to_string())?;
    let port = addr.port();

    let ip = lan_ip();
    let urls = match ip {
        Some(ip) => vec![format!("http://{}:{}", ip, port)],
        None => vec![],
    };

    let (shutdown_tx, shutdown_rx) = oneshot::channel::<()>();

    let router = build_router(state.tx.clone(), state.clients.clone());

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
        name: name.clone(),
    };

    {
        let mut guard = state.inner.lock().map_err(|e| e.to_string())?;
        // Best-effort mDNS advertise so nearby apps can discover this jam.
        let mdns_fullname = match (ensure_mdns(&mut guard), ip) {
            (Some(daemon), Some(ip)) => advertise(&daemon, &name, ip, port),
            _ => None,
        };
        guard.server = Some(RunningServer {
            port,
            urls,
            name,
            shutdown: shutdown_tx,
            mdns_fullname,
        });
    }

    Ok(info)
}

fn jam_stop_inner(state: &tauri::State<'_, JamState>) {
    if let Ok(mut guard) = state.inner.lock() {
        if let Some(server) = guard.server.take() {
            if let (Some(daemon), Some(fullname)) = (guard.mdns.as_ref(), server.mdns_fullname) {
                let _ = daemon.unregister(&fullname);
            }
            // Sending triggers graceful shutdown; ignore errors (already gone).
            let _ = server.shutdown.send(());
        }
    }
    // No guests remain once the server is down.
    state.clients.send_modify(|c| *c = 0);
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
    let clients = *state.clients.borrow();
    match state.inner.lock() {
        Ok(guard) => match guard.server.as_ref() {
            Some(s) => JamStatus {
                hosting: true,
                port: Some(s.port),
                urls: s.urls.clone(),
                name: Some(s.name.clone()),
                clients,
            },
            None => JamStatus {
                hosting: false,
                port: None,
                urls: vec![],
                name: None,
                clients: 0,
            },
        },
        Err(_) => JamStatus {
            hosting: false,
            port: None,
            urls: vec![],
            name: None,
            clients: 0,
        },
    }
}

/// Browse the LAN for ~1.5s and return the jams currently being advertised,
/// excluding our own. Returns an empty list when mDNS is unavailable.
#[tauri::command]
pub async fn jam_discover(state: tauri::State<'_, JamState>) -> Result<Vec<DiscoveredJam>, String> {
    // Pull the daemon out of the lock so we never hold the std Mutex across an
    // await, and note our own fullname to skip it in the results.
    let (daemon, own) = {
        let mut guard = state.inner.lock().map_err(|e| e.to_string())?;
        let daemon = match ensure_mdns(&mut guard) {
            Some(d) => d,
            None => return Ok(vec![]),
        };
        let own = guard
            .server
            .as_ref()
            .and_then(|s| s.mdns_fullname.clone());
        (daemon, own)
    };

    let receiver = daemon.browse(SERVICE_TYPE).map_err(|e| e.to_string())?;
    // Keyed by fullname so repeated announcements collapse to one entry.
    let mut found: HashMap<String, DiscoveredJam> = HashMap::new();

    let _ = tokio::time::timeout(Duration::from_millis(1500), async {
        loop {
            match receiver.recv_async().await {
                Ok(ServiceEvent::ServiceResolved(info)) => {
                    let fullname = info.get_fullname().to_string();
                    if own.as_deref() == Some(fullname.as_str()) {
                        continue;
                    }
                    let Some(ip) = info.get_addresses().iter().next() else {
                        continue;
                    };
                    let name = info
                        .get_property_val_str("name")
                        .map(|s| s.to_string())
                        .unwrap_or_else(|| fullname.clone());
                    found.insert(
                        fullname,
                        DiscoveredJam {
                            name,
                            address: format!("{}:{}", ip, info.get_port()),
                        },
                    );
                }
                Ok(_) => {}
                Err(_) => break,
            }
        }
    })
    .await;

    let _ = daemon.stop_browse(SERVICE_TYPE);
    Ok(found.into_values().collect())
}
