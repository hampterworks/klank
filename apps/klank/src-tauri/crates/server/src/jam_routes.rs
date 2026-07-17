//! Jam routes — the server itself is the host. `/jam` is always mounted;
//! `start`/`stop` toggle the hosting flag (whether broadcasts flow and status
//! reports hosting). The client fills `port`/`urls` from `window.location`, so
//! those are never returned. Discovery is meaningless in a container → `[]`.

use crate::AppState;
use axum::{
    extract::{ws::WebSocketUpgrade, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use serde_json::{json, Value};

pub fn api_routes() -> Router<AppState> {
    Router::new()
        .route("/jam/start", post(start))
        .route("/jam/stop", post(stop))
        .route("/jam/broadcast", post(broadcast))
        .route("/jam/status", get(status))
        .route("/jam/discover", get(discover))
}

#[derive(Deserialize)]
struct StartBody {
    name: String,
}

async fn start(State(s): State<AppState>, Json(body): Json<StartBody>) -> Json<Value> {
    {
        let mut h = s.jam.hosting.lock().unwrap();
        h.hosting = true;
        h.name = Some(body.name.clone());
    }
    Json(json!({ "name": body.name }))
}

async fn stop(State(s): State<AppState>) -> StatusCode {
    let mut h = s.jam.hosting.lock().unwrap();
    h.hosting = false;
    h.name = None;
    StatusCode::NO_CONTENT
}

async fn broadcast(State(s): State<AppState>, Json(snapshot): Json<Value>) -> StatusCode {
    // Broadcasts only flow while hosting.
    if s.jam.hosting.lock().unwrap().hosting {
        let _ = s.jam.channels.tx.send(snapshot.to_string());
    }
    StatusCode::NO_CONTENT
}

async fn status(State(s): State<AppState>) -> Json<Value> {
    let clients = *s.jam.channels.clients.borrow();
    let h = s.jam.hosting.lock().unwrap();
    Json(json!({ "hosting": h.hosting, "name": h.name, "clients": clients }))
}

async fn discover() -> Json<Value> {
    Json(json!([]))
}

/// Guest WebSocket: mounts the shared core socket loop onto the server's `/jam`.
pub async fn ws(ws: WebSocketUpgrade, State(s): State<AppState>) -> Response {
    ws.on_upgrade(move |socket| {
        klank_core::jam::handle_socket(
            socket,
            s.jam.channels.tx.clone(),
            s.jam.channels.clients.clone(),
        )
    })
    .into_response()
}
