//! Jam mode (Tauri glue): hosts a LAN WebSocket jam and advertises it over mDNS.
//!
//! The transport itself — the snapshot/client `watch` channels, the axum router,
//! and the per-socket loop — lives in [`klank_core::jam`], shared with
//! `klank-server`. This module owns only the platform-specific parts: binding a
//! LAN listener, mDNS advertise/browse (`_klank-jam._tcp.local.`), and the
//! Android Wi-Fi multicast lock. mDNS is best-effort; hosting still works via the
//! manual `ip:port` join fallback when it is unavailable.

use klank_core::jam::JamChannels;
use mdns_sd::{ServiceDaemon, ServiceEvent, ServiceInfo};
use serde::Serialize;
use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::Mutex;
use std::time::Duration;
use tokio::sync::oneshot;

/// mDNS service type advertised/browsed for klank jams.
const SERVICE_TYPE: &str = "_klank-jam._tcp.local.";

// ── State ─────────────────────────────────────────────────────────────────────

/// Shared state managed by Tauri (.manage()).
pub struct JamState {
    /// The snapshot + client-count broadcast channels (shared core transport).
    pub channels: JamChannels,
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
    /// True when an Android multicast lock is held for this session (so stop
    /// releases exactly what start acquired). Always false off Android.
    multicast_held: bool,
}

impl Default for JamState {
    fn default() -> Self {
        Self {
            channels: JamChannels::default(),
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
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == '-' {
                c
            } else {
                '-'
            }
        })
        .collect();
    let trimmed = cleaned.trim_matches('-');
    if trimmed.is_empty() {
        "klank-jam.local.".to_string()
    } else {
        format!("{trimmed}.local.")
    }
}

/// Best-effort advertise of this jam. Returns the registered fullname on success.
fn advertise(
    daemon: &ServiceDaemon,
    name: &str,
    ip: std::net::IpAddr,
    port: u16,
) -> Option<String> {
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

// ── Android multicast lock ──────────────────────────────────────────────────
//
// Android filters inbound multicast by default, so mDNS advertise/browse needs
// a held Wi-Fi MulticastLock. These helpers are no-ops off Android.

#[cfg(target_os = "android")]
fn hold_multicast(app: &tauri::AppHandle) -> bool {
    use tauri_plugin_multicast_lock::MulticastLockExt;
    match app.multicast_lock().acquire() {
        Ok(()) => true,
        Err(e) => {
            log::warn!("multicast lock acquire failed: {e}");
            false
        }
    }
}

#[cfg(not(target_os = "android"))]
fn hold_multicast(_app: &tauri::AppHandle) -> bool {
    false
}

#[cfg(target_os = "android")]
fn release_multicast(app: &tauri::AppHandle) {
    use tauri_plugin_multicast_lock::MulticastLockExt;
    if let Err(e) = app.multicast_lock().release() {
        log::warn!("multicast lock release failed: {e}");
    }
}

#[cfg(not(target_os = "android"))]
fn release_multicast(_app: &tauri::AppHandle) {}

/// Releases a held multicast lock on drop, so a scan releases on every exit
/// path (including early `?` returns).
struct MulticastGuard<'a> {
    app: &'a tauri::AppHandle,
    held: bool,
}

impl Drop for MulticastGuard<'_> {
    fn drop(&mut self) {
        if self.held {
            release_multicast(self.app);
        }
    }
}

// ── Tauri commands ────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn jam_start(
    state: tauri::State<'_, JamState>,
    app: tauri::AppHandle,
    name: String,
) -> Result<JamInfo, String> {
    // Stop any existing server first (idempotent).
    jam_stop_inner(&state, &app);

    // Reset the connected count for the fresh session.
    state.channels.clients.send_modify(|c| *c = 0);

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

    let router =
        klank_core::jam::build_router(state.channels.tx.clone(), state.channels.clients.clone());

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

    // Hold the multicast lock (Android) so mDNS advertise/browse works.
    let multicast_held = hold_multicast(&app);

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
            multicast_held,
        });
    }

    Ok(info)
}

fn jam_stop_inner(state: &tauri::State<'_, JamState>, app: &tauri::AppHandle) {
    if let Ok(mut guard) = state.inner.lock() {
        if let Some(server) = guard.server.take() {
            if let (Some(daemon), Some(fullname)) = (guard.mdns.as_ref(), server.mdns_fullname) {
                let _ = daemon.unregister(&fullname);
            }
            // Release exactly what jam_start acquired.
            if server.multicast_held {
                release_multicast(app);
            }
            // Sending triggers graceful shutdown; ignore errors (already gone).
            let _ = server.shutdown.send(());
        }
    }
    // No guests remain once the server is down.
    state.channels.clients.send_modify(|c| *c = 0);
}

#[tauri::command]
pub async fn jam_stop(
    state: tauri::State<'_, JamState>,
    app: tauri::AppHandle,
) -> Result<(), String> {
    jam_stop_inner(&state, &app);
    Ok(())
}

#[tauri::command]
pub async fn jam_broadcast(
    state: tauri::State<'_, JamState>,
    snapshot: String,
) -> Result<(), String> {
    // Ignore send errors (no active receivers is fine).
    let _ = state.channels.tx.send(snapshot);
    Ok(())
}

#[tauri::command]
pub fn jam_status(state: tauri::State<'_, JamState>) -> JamStatus {
    let clients = *state.channels.clients.borrow();
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
pub async fn jam_discover(
    state: tauri::State<'_, JamState>,
    app: tauri::AppHandle,
) -> Result<Vec<DiscoveredJam>, String> {
    // Hold the multicast lock (Android) for the duration of the scan so we can
    // receive announcements. The guard releases it on every exit path. Composes
    // with a host hold via the reference-counted lock.
    let _multicast = MulticastGuard {
        app: &app,
        held: hold_multicast(&app),
    };

    // Pull the daemon out of the lock so we never hold the std Mutex across an
    // await, and note our own fullname to skip it in the results.
    let (daemon, own) = {
        let mut guard = state.inner.lock().map_err(|e| e.to_string())?;
        let daemon = match ensure_mdns(&mut guard) {
            Some(d) => d,
            None => return Ok(vec![]),
        };
        let own = guard.server.as_ref().and_then(|s| s.mdns_fullname.clone());
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
