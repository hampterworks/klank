//! Android-only Tauri plugin that scrapes an Ultimate Guitar page using a
//! **self-owned** `android.webkit.WebView`, deliberately outside WRY.
//!
//! WRY keeps a single webview per Android Activity (a second one overwrites it
//! and steals IPC), which is why the previous secondary-`WebviewWindow` approach
//! could never work on Android. This plugin creates its own 1×1 (hidden but
//! attached, so JS/timers run) WebView, injects the shared extraction script,
//! and receives the result through its own `@JavascriptInterface` bridge —
//! touching none of WRY's `setContentView`/`mWebView`/`ACTIVITY_PROXY` state.
//!
//! It is invoked from Rust (the `ug-webview` import stage) via
//! [`UgScraperExt::ug_scraper`], not from JS.

use serde::Deserialize;
use tauri::{
    plugin::{Builder, TauriPlugin},
    Runtime,
};

#[cfg(target_os = "android")]
use {serde::Serialize, tauri::plugin::PluginHandle, tauri::Manager};

/// Arguments sent to the Android `scrape` command.
#[cfg(target_os = "android")]
#[derive(Serialize)]
struct ScrapeArgs {
    url: String,
    /// The shared extraction + challenge-detection script to inject.
    script: String,
}

/// Result returned by the Android `scrape` command. Exactly one of `html` /
/// `error` is set.
#[derive(Debug, Default, Deserialize)]
pub struct ScrapeResponse {
    /// The extracted `{ store: … }` JSON when the page yielded tab data.
    pub html: Option<String>,
    /// A failure reason (e.g. `"timeout"`) when scraping did not succeed.
    pub error: Option<String>,
}

/// Handle to the registered Android plugin.
#[cfg(target_os = "android")]
pub struct UgScraper<R: Runtime>(PluginHandle<R>);

#[cfg(target_os = "android")]
impl<R: Runtime> UgScraper<R> {
    /// Loads `url` in a hidden WebView, injects `script`, and resolves once the
    /// page delivers tab data (or times out).
    pub fn scrape(&self, url: String, script: String) -> Result<ScrapeResponse, String> {
        self.0
            .run_mobile_plugin("scrape", ScrapeArgs { url, script })
            .map_err(|e| e.to_string())
    }
}

/// Extension trait to reach the plugin from an `AppHandle`/`Manager`.
#[cfg(target_os = "android")]
pub trait UgScraperExt<R: Runtime> {
    fn ug_scraper(&self) -> &UgScraper<R>;
}

#[cfg(target_os = "android")]
impl<R: Runtime, T: Manager<R>> UgScraperExt<R> for T {
    fn ug_scraper(&self) -> &UgScraper<R> {
        self.state::<UgScraper<R>>().inner()
    }
}

/// Initializes the plugin. On non-Android targets this is a no-op shell so the
/// crate still compiles and can be registered unconditionally.
pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("ug-scraper")
        .setup(|_app, _api| {
            #[cfg(target_os = "android")]
            {
                let handle = _api.register_android_plugin(
                    "io.github.hampterworks.klank.ugscraper",
                    "UgScraperPlugin",
                )?;
                _app.manage(UgScraper(handle));
            }
            Ok(())
        })
        .build()
}
