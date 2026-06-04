/// Tauri backend for klank. Exposes IPC commands for scraping Ultimate Guitar
/// tab pages via an ephemeral hidden webview and delivers the raw page content
/// back to the frontend through a oneshot channel.
use std::sync::Mutex;
use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};
use tokio::sync::oneshot;

// Holds the oneshot sender that the JS side will fulfill via `deliver_ug_html`.
struct UgScrapeState(Mutex<Option<oneshot::Sender<String>>>);

/// IPC callback invoked by the injected JavaScript inside the scraper webview.
/// Sends the HTML string through the oneshot channel to unblock the waiting
/// `scrape_ug` call. Should not be called directly from the main window.
#[tauri::command]
fn deliver_ug_html(state: tauri::State<'_, UgScrapeState>, html: String) {
    eprintln!("[ug-scraper] received HTML, {} bytes", html.len());
    if let Some(tx) = state.0.lock().unwrap().take() {
        let _ = tx.send(html);
    }
}

/// IPC callback for diagnostic logging from the injected JavaScript.
/// Writes messages to stderr with the `[ug-scraper]` prefix.
/// Used for debugging Cloudflare challenges and page detection failures.
#[tauri::command]
fn report_ug_error(msg: String) {
    eprintln!("[ug-scraper] {msg}");
}

/// Scrapes a UG tab page and returns its raw content as `Ok(String)`.
///
/// Accepts a UG tab URL, opens a hidden webview (800×600, skip_taskbar) to load
/// it, and injects JavaScript that detects the `.js-store` element or
/// `window.UGAPP.store`, auto-accepts consent banners, and calls
/// `deliver_ug_html` with the content. Enforces mutual exclusion — returns
/// `Err` if a scrape is already in progress. Has a 35-second hard timeout;
/// returns `Err` on timeout.
#[tauri::command]
async fn scrape_ug(app: tauri::AppHandle, url: String) -> Result<String, String> {
    let state = app.state::<UgScrapeState>();
    let (tx, rx) = oneshot::channel::<String>();
    {
        let mut guard = state.0.lock().map_err(|e| e.to_string())?;
        if guard.is_some() {
            return Err("another UG scrape is already in progress".into());
        }
        *guard = Some(tx);
    }

    // Polls the page until UG's `js-store` element is present (i.e. the real page,
    // not a Cloudflare interstitial), then ships outerHTML back to Rust via IPC.
    let init_script = r#"
        (function () {
            // Identify which kind of frame we're in. We want to run in two
            // places: (a) the top UG frame, to poll for .js-store and ship it
            // back to Rust; (b) any CMP iframe (Quantcast Choice / Sourcepoint
            // / OneTrust / TrustArc / etc.) so we can click "Accept" inside it,
            // which is what unlocks UG actually rendering .js-store on the
            // parent page.
            const isTop = (() => { try { return window.top === window.self; } catch (_) { return false; } })();
            const host = location.hostname || '';
            const isUg = /ultimate-guitar\.com$/i.test(host);
            const isCmp = /(consensu\.org|privacy-mgmt\.com|sp-prod\.net|sourcepoint|quantcast|cookielaw\.org|onetrust|trustarc|didomi|cmp\.)/i.test(host);
            if (isTop) {
                if (!isUg) return;          // ignore non-UG top frames
            } else {
                if (!isCmp) return;         // ignore ad iframes; only run inside CMP iframes
            }
            if (window.__ug_scrape_started) return;
            window.__ug_scrape_started = true;
            const internals = window.__TAURI_INTERNALS__;
            const report = (m) => {
                try {
                    if (internals && internals.invoke) {
                        internals.invoke('report_ug_error', { msg: String(m) });
                    }
                } catch (_) {}
                try { console.log('[ug-scraper]', m); } catch (_) {}
            };
            report('frame: ' + (isTop ? 'top' : 'iframe') + ' ' + host + ' | has internals: ' + !!internals);

            const consentTexts = ['agree', 'accept', 'accept all', 'i accept', 'i agree', 'consent', 'allow all', 'akzeptieren', 'accepter', 'souhlasím', 'zustimmen'];
            const tryClickConsent = () => {
                const nodes = document.querySelectorAll('button, [role="button"], a, input[type="button"], input[type="submit"]');
                for (const n of nodes) {
                    const t = ((n.innerText || n.textContent || n.value || '') + '').trim().toLowerCase();
                    if (t && consentTexts.some(x => t === x || t.startsWith(x))) {
                        try { n.click(); report('clicked consent: ' + t + ' (frame=' + (isTop ? 'top' : 'iframe') + ')'); return true; } catch (_) {}
                    }
                }
                return false;
            };

            // In CMP iframes, just click the accept button and stop — no
            // polling for .js-store there (it lives on the parent UG page).
            if (!isTop) {
                let clicked = false;
                const tick = () => { if (!clicked && tryClickConsent()) clicked = true; };
                tick();
                const cmpIv = setInterval(tick, 500);
                setTimeout(() => clearInterval(cmpIv), 20000);
                return;
            }
            let delivered = false;
            const send = (html) => {
                if (delivered) return;
                if (!internals || !internals.invoke) {
                    report('cannot deliver: __TAURI_INTERNALS__ missing');
                    return;
                }
                try {
                    const p = internals.invoke('deliver_ug_html', { html });
                    delivered = true;
                    report('deliver_ug_html invoked, html length=' + html.length);
                    if (p && typeof p.catch === 'function') {
                        p.catch((err) => {
                            delivered = false;
                            report('invoke failed: ' + (err && err.message ? err.message : err));
                        });
                    }
                } catch (e) {
                    report('invoke threw: ' + (e && e.message ? e.message : e));
                }
            };
            const findStoreContent = () => {
                // Preferred: UG hydrates this global early in their bundle.
                try {
                    const s = window.UGAPP && window.UGAPP.store;
                    if (s && s.page && s.page.data && s.page.data.tab_view) {
                        return JSON.stringify({ store: s });
                    }
                } catch (_) {}
                // Fallback: server-rendered .js-store (only present on a cold,
                // pre-consent visit; UG omits it once a CMP cookie is stored).
                const el = document.querySelector('.js-store');
                if (el) {
                    const dc = el.getAttribute('data-content');
                    if (dc) return dc;
                }
                return null;
            };
            const tryGrab = () => {
                const dc = findStoreContent();
                if (dc) { send(dc); return delivered; }
                return false;
            };

            // `.js-store` is server-rendered into UG's initial HTML, so it is
            // present the moment the real UG document starts parsing — no
            // polling needed. We just need to act on whichever of these
            // happens first: it's already there, the DOM finishes parsing,
            // or (in case the page is replaced after a Cloudflare/consent
            // navigation) it gets inserted later. A single MutationObserver
            // covers the last case without busy-looping.
            const start = Date.now();
            const tryAndReport = (why) => {
                const ok = tryGrab();
                report(why + ' -> found=' + ok + ', elapsed=' + (Date.now() - start) + 'ms, title=' + document.title);
                return ok;
            };

            // 1) Immediate attempt — works for the common case where the init
            //    script runs after the HTML is already parsed.
            if (tryAndReport('immediate')) return;

            // 2) DOMContentLoaded — covers running before parse is complete.
            const onReady = () => { if (!delivered) tryAndReport('DOMContentLoaded'); };
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', onReady, { once: true });
            }

            // 3) Fast poll for `window.UGAPP.store` to populate. UG sets this
            //    from their JS bundle after hydration, which is NOT a DOM
            //    mutation, so a MutationObserver wouldn't catch it. 50ms is
            //    cheap (one property read) and gives sub-frame latency.
            const iv = setInterval(() => {
                if (delivered) { clearInterval(iv); return; }
                if (tryGrab()) {
                    clearInterval(iv);
                    report('poll hit, elapsed=' + (Date.now() - start) + 'ms');
                }
            }, 50);
            // Also a MutationObserver for the cold-visit `.js-store` fallback.
            const obs = new MutationObserver(() => {
                if (delivered) { obs.disconnect(); return; }
                if (tryGrab()) { obs.disconnect(); clearInterval(iv); report('observer hit, elapsed=' + (Date.now() - start) + 'ms'); }
            });
            const startObs = () => {
                if (document.documentElement) {
                    obs.observe(document.documentElement, { childList: true, subtree: true });
                } else {
                    document.addEventListener('DOMContentLoaded', startObs, { once: true });
                }
            };
            startObs();

            // 4) Click any consent banner that's already there, then once more
            //    when the DOM is ready — that's all the consent handling we need;
            //    once Accept is clicked the MutationObserver picks up `.js-store`.
            tryClickConsent();
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => tryClickConsent(), { once: true });
            }

            // 5) Safety timeout — give up after 30s instead of 60s, since we no
            //    longer need polling slack.
            setTimeout(() => {
                if (delivered) return;
                obs.disconnect();
                clearInterval(iv);
                report('timeout, store never appeared, title=' + document.title + ', hasUGAPP=' + !!window.UGAPP);
            }, 30000);
        })();
    "#;

    let parsed: tauri::Url = url.parse().map_err(|e| format!("invalid url: {e}"))?;
    let label = format!("ug-scraper-{}", chrono_like_id());
    let script = init_script.to_string();

    // Window creation must happen on the main thread.
    let app_for_main = app.clone();
    let label_for_main = label.clone();
    let (built_tx, built_rx) = oneshot::channel::<Result<(), String>>();
    app.run_on_main_thread(move || {
        let res = WebviewWindowBuilder::new(
            &app_for_main,
            &label_for_main,
            WebviewUrl::External(parsed),
        )
        // Visible so Cloudflare's interactive challenge (checkbox) can be solved if needed.
        .visible(true)
        .focused(false)
        .skip_taskbar(true)
        .title("Loading tab…")
        .inner_size(800.0, 600.0)
        .initialization_script(&script)
        .build()
        .map_err(|e| e.to_string());
        let res = match res {
            Ok(_w) => {
                #[cfg(debug_assertions)]
                {
                    _w.open_devtools();
                }
                Ok(())
            }
            Err(e) => Err(e),
        };
        let _ = built_tx.send(res);
    })
    .map_err(|e| e.to_string())?;

    built_rx
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e)?;

    // Wait for JS to deliver the HTML (with a hard upper bound).
    let html_result = tokio::time::timeout(std::time::Duration::from_secs(35), rx).await;

    // Close the hidden window regardless of outcome.
    if let Some(w) = app.get_webview_window(&label) {
        let _ = w.close();
    }
    // Always clear the slot so the next call can start fresh.
    if let Ok(mut guard) = state.0.lock() {
        *guard = None;
    }

    match html_result {
        Ok(Ok(html)) => Ok(html),
        Ok(Err(_)) => Err("scrape channel closed (sender dropped before delivering HTML)".into()),
        Err(_) => Err("timed out waiting for UG page to load".into()),
    }
}

fn chrono_like_id() -> u128 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_shell::init())
        .manage(UgScrapeState(Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![scrape_ug, deliver_ug_html, report_ug_error])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
