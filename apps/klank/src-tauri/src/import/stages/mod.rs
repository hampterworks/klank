//! Tauri-only import stages. The headless stages live in `klank_core`; this holds
//! just the hidden-webview fallback (real browser required).

pub mod ug_webview;

// Desktop-only IPC module for the hidden webview stage, re-exported for the
// Tauri builder in `lib.rs`. The whole module is re-exported (not individual
// items) so `generate_handler!` can resolve each command's hidden helpers.
#[cfg(desktop)]
pub use ug_webview::desktop;
