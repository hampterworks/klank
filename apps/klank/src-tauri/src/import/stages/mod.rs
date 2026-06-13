//! The concrete import stages and the ordered registry that lists them.
//!
//! To add an import method: write a new `ImportStage` module here and add one
//! line to [`build_stages`]. To remove one: delete its line. Nothing else
//! (including the frontend) needs to change.

mod ug_mobile_api;
mod ug_webview;
mod ug_website;

use super::ImportStage;

// Desktop-only IPC module for the hidden webview stage, re-exported for the
// Tauri builder in `lib.rs`. The whole module is re-exported (not individual
// items) so `generate_handler!` can resolve each command's hidden helpers.
#[cfg(desktop)]
pub use ug_webview::desktop;

/// Builds the ordered list of stages, injecting each with the dependencies it
/// needs. Order here is the default attempt order (the pipeline may promote the
/// last-successful stage to the front).
pub fn build_stages(
    app: tauri::AppHandle,
    url: String,
    http: reqwest::Client,
) -> Vec<Box<dyn ImportStage>> {
    vec![
        Box::new(ug_mobile_api::UgMobileApi::new(app.clone(), url.clone(), http.clone())),
        Box::new(ug_website::UgWebsite::new(url.clone(), http.clone())),
        Box::new(ug_webview::UgWebview::new(app.clone(), url.clone())),
    ]
}

/// Shared helper: is this a URL we recognise as an Ultimate Guitar tab page?
pub(crate) fn is_ug_url(url: &str) -> bool {
    let host = url
        .split("://")
        .nth(1)
        .and_then(|rest| rest.split(['/', '?', '#']).next())
        .unwrap_or("")
        .to_ascii_lowercase();
    host == "ultimate-guitar.com" || host.ends_with(".ultimate-guitar.com")
}

#[cfg(test)]
mod tests {
    use super::is_ug_url;

    #[test]
    fn recognises_ug_hosts() {
        assert!(is_ug_url("https://tabs.ultimate-guitar.com/tab/x-1"));
        assert!(is_ug_url("https://www.ultimate-guitar.com/tab/x-1"));
        assert!(is_ug_url("https://ultimate-guitar.com/tab/x-1"));
        assert!(!is_ug_url("https://evil-ultimate-guitar.com.example.com/x"));
        assert!(!is_ug_url("https://example.com/tab"));
    }
}
