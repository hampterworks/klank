//! Last-resort import stage: load the page in a **real browser**, hidden.
//!
//! Unified design across platforms — the scraper surface is created invisible
//! and only revealed if a Cloudflare *interactive* challenge is detected; real
//! Chromium clears managed/JS challenges automatically while hidden. One shared
//! script ([`SHARED_SCRIPT`]) drives extraction + challenge detection on both
//! platforms; only the native show/hide primitive differs:
//!
//! - Desktop: a hidden `WebviewWindow` (this module).
//! - Android: a self-owned 1×1 `android.webkit.WebView` in a Kotlin plugin
//!   (wired in a follow-up; `can_handle` is false off-desktop until then).

#[cfg(any(desktop, target_os = "android"))]
use klank_core::import::stages::is_ug_url;
use klank_core::import::{ImportStage, StageOutcome};
use std::time::Duration;

/// Extraction + challenge-detection script, injected at document start. Routes
/// its two outbound signals through `window.__ugDeliver` / `window.__ugChallenge`
/// shims that pick whichever transport exists (Tauri IPC on desktop, the
/// `__ugBridge` `@JavascriptInterface` on Android), so the body is identical on
/// both platforms.
pub(crate) const SHARED_SCRIPT: &str = r#"
(function () {
  window.__ugDeliver = function (html) {
    try { if (window.__ugBridge && window.__ugBridge.deliver) { window.__ugBridge.deliver(html); return; } } catch (e) {}
    try { var i = window.__TAURI_INTERNALS__; if (i && i.invoke) i.invoke('deliver_ug_html', { html }); } catch (e) {}
  };
  window.__ugChallenge = function () {
    try { if (window.__ugBridge && window.__ugBridge.challenge) { window.__ugBridge.challenge(); return; } } catch (e) {}
    try { var i = window.__TAURI_INTERNALS__; if (i && i.invoke) i.invoke('report_ug_challenge'); } catch (e) {}
  };

  var isTop = (function () { try { return window.top === window.self; } catch (_) { return false; } })();
  var host = location.hostname || '';
  var isUg = /ultimate-guitar\.com$/i.test(host);
  var isCmp = /(consensu\.org|privacy-mgmt\.com|sp-prod\.net|sourcepoint|quantcast|cookielaw\.org|onetrust|trustarc|didomi|cmp\.)/i.test(host);
  if (isTop) { if (!isUg) return; } else { if (!isCmp) return; }
  if (window.__ug_scrape_started) return;
  window.__ug_scrape_started = true;

  var consentTexts = ['agree', 'accept', 'accept all', 'i accept', 'i agree', 'consent', 'allow all', 'akzeptieren', 'accepter', 'souhlasím', 'zustimmen'];
  function tryClickConsent() {
    var nodes = document.querySelectorAll('button,[role="button"],a,input[type="button"],input[type="submit"]');
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      var t = ((n.innerText || n.textContent || n.value || '') + '').trim().toLowerCase();
      if (t && consentTexts.some(function (x) { return t === x || t.startsWith(x); })) {
        try { n.click(); return true; } catch (_) {}
      }
    }
    return false;
  }

  // In CMP iframes we only click accept; the data lives on the parent page.
  if (!isTop) {
    var clicked = false;
    var cmpIv = setInterval(function () { if (!clicked && tryClickConsent()) clicked = true; }, 500);
    tryClickConsent();
    setTimeout(function () { clearInterval(cmpIv); }, 20000);
    return;
  }

  var delivered = false;
  function findStore() {
    try {
      var s = window.UGAPP && window.UGAPP.store;
      if (s && s.page && s.page.data && s.page.data.tab_view) return JSON.stringify({ store: s });
    } catch (_) {}
    var el = document.querySelector('.js-store');
    if (el) { var dc = el.getAttribute('data-content'); if (dc) return dc; }
    return null;
  }
  function tryGrab() {
    if (delivered) return true;
    var dc = findStore();
    if (dc) { delivered = true; window.__ugDeliver(dc); return true; }
    return false;
  }

  function looksLikeChallenge() {
    var t = (document.title || '').toLowerCase();
    if (t.indexOf('just a moment') !== -1 || t.indexOf('attention required') !== -1 || t.indexOf('verifying') !== -1) return true;
    return !!document.querySelector('#challenge-form, #challenge-running, iframe[src*="challenges.cloudflare.com"], .cf-turnstile');
  }

  var start = Date.now();
  var challengeSignaled = false;
  tryGrab();
  document.addEventListener('DOMContentLoaded', function () { tryGrab(); tryClickConsent(); }, { once: true });

  var iv = setInterval(function () {
    if (tryGrab()) { clearInterval(iv); return; }
    if (!challengeSignaled && Date.now() - start > 4000 && looksLikeChallenge()) {
      challengeSignaled = true;
      window.__ugChallenge();
    }
  }, 150);

  var obs = new MutationObserver(function () { if (tryGrab()) { obs.disconnect(); clearInterval(iv); } });
  (function startObs() {
    if (document.documentElement) obs.observe(document.documentElement, { childList: true, subtree: true });
    else document.addEventListener('DOMContentLoaded', startObs, { once: true });
  })();
  tryClickConsent();

  setTimeout(function () { obs.disconnect(); clearInterval(iv); }, 40000);
})();
"#;

pub struct UgWebview {
    #[cfg_attr(all(not(desktop), not(target_os = "android")), allow(dead_code))]
    app: tauri::AppHandle,
    url: String,
}

impl UgWebview {
    pub fn new(app: tauri::AppHandle, url: String) -> Self {
        Self { app, url }
    }
}

#[async_trait::async_trait]
impl ImportStage for UgWebview {
    fn id(&self) -> &'static str {
        "ug-webview"
    }
    fn label(&self) -> &'static str {
        "Ultimate Guitar (browser)"
    }
    fn can_handle(&self) -> bool {
        // Desktop (hidden WRY window) and Android (self-owned WebView plugin).
        #[cfg(any(desktop, target_os = "android"))]
        {
            is_ug_url(&self.url)
        }
        #[cfg(not(any(desktop, target_os = "android")))]
        {
            false
        }
    }
    fn timeout(&self) -> Duration {
        Duration::from_secs(45)
    }
    async fn run(&self) -> StageOutcome {
        #[cfg(desktop)]
        return desktop::scrape(&self.app, &self.url).await;
        #[cfg(target_os = "android")]
        return android::scrape(&self.app, &self.url).await;
        #[cfg(not(any(desktop, target_os = "android")))]
        return StageOutcome::Skip;
    }
}

/// Android implementation: a self-owned offscreen `android.webkit.WebView` in
/// the `ug-scraper` plugin (outside WRY). `run_mobile_plugin` blocks, so it runs
/// on a blocking thread.
#[cfg(target_os = "android")]
mod android {
    use super::SHARED_SCRIPT;
    use klank_core::import::stages::parse_store;
    use klank_core::import::{StageError, StageOutcome};
    use tauri_plugin_ug_scraper::UgScraperExt;

    pub async fn scrape(app: &tauri::AppHandle, url: &str) -> StageOutcome {
        let app = app.clone();
        let url = url.to_string();
        let result = tokio::task::spawn_blocking(move || {
            app.ug_scraper().scrape(url, SHARED_SCRIPT.to_string())
        })
        .await;

        match result {
            Ok(Ok(resp)) => match resp.html {
                Some(html) => match parse_store(&html, "ug-webview") {
                    Some(tab) => StageOutcome::Success(tab),
                    None => StageOutcome::RetryNext(StageError::Parse(
                        "could not parse tab data".into(),
                    )),
                },
                // No html → timeout / unsolved challenge.
                None => StageOutcome::RetryNext(StageError::Challenged),
            },
            Ok(Err(e)) => StageOutcome::RetryNext(StageError::Network(e)),
            Err(e) => StageOutcome::RetryNext(StageError::Network(e.to_string())),
        }
    }
}

/// Desktop implementation: a hidden `WebviewWindow` revealed only on a
/// Cloudflare challenge. The IPC commands and state live here and are wired into
/// the Tauri builder in `lib.rs` (desktop only).
#[cfg(desktop)]
pub mod desktop {
    use super::SHARED_SCRIPT;
    use klank_core::import::stages::parse_store;
    use klank_core::import::{StageError, StageOutcome};
    use std::sync::Mutex;
    use std::time::{Duration, SystemTime, UNIX_EPOCH};
    use tauri::{Manager, State, WebviewUrl, WebviewWindowBuilder};
    use tokio::sync::oneshot;

    /// Shared state linking the injected JS callbacks to the waiting scrape.
    #[derive(Default)]
    pub struct UgWebviewState {
        tx: Mutex<Option<oneshot::Sender<String>>>,
        label: Mutex<Option<String>>,
    }

    /// IPC: the injected JS delivers the extracted `{ store: … }` JSON.
    #[tauri::command]
    pub fn deliver_ug_html(state: State<'_, UgWebviewState>, html: String) {
        if let Some(tx) = state.tx.lock().unwrap().take() {
            let _ = tx.send(html);
        }
    }

    /// IPC: the injected JS detected an interactive challenge — reveal the
    /// otherwise-hidden window so the user can solve it.
    #[tauri::command]
    pub fn report_ug_challenge(app: tauri::AppHandle, state: State<'_, UgWebviewState>) {
        let label = state.label.lock().unwrap().clone();
        if let Some(label) = label {
            if let Some(w) = app.get_webview_window(&label) {
                let _ = w.show();
                let _ = w.set_focus();
            }
        }
    }

    fn cleanup(app: &tauri::AppHandle, state: &UgWebviewState, label: &str) {
        if let Some(w) = app.get_webview_window(label) {
            let _ = w.close();
        }
        *state.tx.lock().unwrap() = None;
        *state.label.lock().unwrap() = None;
    }

    pub async fn scrape(app: &tauri::AppHandle, url: &str) -> StageOutcome {
        let state = app.state::<UgWebviewState>();

        let parsed: tauri::Url = match url.parse() {
            Ok(u) => u,
            Err(e) => return StageOutcome::Fatal(StageError::Parse(format!("invalid url: {e}"))),
        };

        let (tx, rx) = oneshot::channel::<String>();
        {
            let mut guard = state.tx.lock().unwrap();
            if guard.is_some() {
                return StageOutcome::RetryNext(StageError::Network(
                    "another scrape is in progress".into(),
                ));
            }
            *guard = Some(tx);
        }
        let label = format!("ug-scraper-{}", now_nanos());
        *state.label.lock().unwrap() = Some(label.clone());

        // Window creation must run on the main thread. Built hidden.
        let (btx, brx) = oneshot::channel::<Result<(), String>>();
        let app_main = app.clone();
        let label_main = label.clone();
        let _ = app.run_on_main_thread(move || {
            let res =
                WebviewWindowBuilder::new(&app_main, &label_main, WebviewUrl::External(parsed))
                    .visible(false)
                    .focused(false)
                    .skip_taskbar(true)
                    .title("Loading tab…")
                    .inner_size(900.0, 700.0)
                    .initialization_script(SHARED_SCRIPT)
                    .build()
                    .map(|_| ())
                    .map_err(|e| e.to_string());
            let _ = btx.send(res);
        });

        match brx.await {
            Ok(Ok(())) => {}
            Ok(Err(e)) => {
                cleanup(app, &state, &label);
                return StageOutcome::RetryNext(StageError::Network(e));
            }
            Err(e) => {
                cleanup(app, &state, &label);
                return StageOutcome::RetryNext(StageError::Network(e.to_string()));
            }
        }

        let result = tokio::time::timeout(Duration::from_secs(40), rx).await;
        cleanup(app, &state, &label);

        match result {
            Ok(Ok(html)) => match parse_store(&html, "ug-webview") {
                Some(tab) => StageOutcome::Success(tab),
                None => {
                    StageOutcome::RetryNext(StageError::Parse("could not parse tab data".into()))
                }
            },
            Ok(Err(_)) => {
                StageOutcome::RetryNext(StageError::Network("scrape channel closed".into()))
            }
            // Timed out — most likely an unsolved challenge.
            Err(_) => StageOutcome::RetryNext(StageError::Challenged),
        }
    }

    fn now_nanos() -> u128 {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or(0)
    }
}
