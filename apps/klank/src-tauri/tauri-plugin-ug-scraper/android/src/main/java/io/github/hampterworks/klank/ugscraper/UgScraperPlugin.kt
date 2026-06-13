package io.github.hampterworks.klank.ugscraper

import android.app.Activity
import android.view.ViewGroup
import android.webkit.JavascriptInterface
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin

@InvokeArg
class ScrapeArgs {
    lateinit var url: String
    lateinit var script: String
}

/**
 * Scrapes an Ultimate Guitar page in a self-owned, hidden WebView.
 *
 * The WebView is added to the Activity content at 1×1 (hidden but attached, so
 * JS and timers actually run — a detached WebView won't fire onPageFinished).
 * The shared script is injected on page load and signals back through the
 * `__ugBridge` JavaScript interface: `deliver(html)` resolves the call;
 * `challenge()` reveals the WebView full-screen so the user can solve an
 * interactive Cloudflare challenge. Everything is outside WRY, so none of the
 * single-webview-per-Activity hazards apply.
 */
@TauriPlugin
class UgScraperPlugin(private val activity: Activity) : Plugin(activity) {
    private val timeoutMs = 40_000L

    @Command
    fun scrape(invoke: Invoke) {
        val args = invoke.parseArgs(ScrapeArgs::class.java)
        activity.runOnUiThread {
            try {
                start(args.url, args.script, invoke)
            } catch (e: Exception) {
                invoke.reject(e.message ?: "scrape failed")
            }
        }
    }

    private fun start(url: String, script: String, invoke: Invoke) {
        val root = activity.findViewById<ViewGroup>(android.R.id.content)
        val webView = WebView(activity)
        val resolved = java.util.concurrent.atomic.AtomicBoolean(false)

        // 1×1 = effectively invisible, but attached so JS/timers run.
        root.addView(webView, FrameLayout.LayoutParams(1, 1))

        fun cleanup() {
            activity.runOnUiThread {
                try {
                    root.removeView(webView)
                    webView.destroy()
                } catch (_: Exception) {
                }
            }
        }

        fun finish(html: String?, error: String?) {
            if (!resolved.compareAndSet(false, true)) return
            val ret = JSObject()
            if (html != null) ret.put("html", html)
            if (error != null) ret.put("error", error)
            invoke.resolve(ret)
            cleanup()
        }

        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true

        webView.addJavascriptInterface(object {
            @JavascriptInterface
            fun deliver(html: String) {
                finish(html, null)
            }

            @JavascriptInterface
            fun challenge() {
                activity.runOnUiThread {
                    val p = webView.layoutParams as FrameLayout.LayoutParams
                    p.width = FrameLayout.LayoutParams.MATCH_PARENT
                    p.height = FrameLayout.LayoutParams.MATCH_PARENT
                    webView.layoutParams = p
                    webView.bringToFront()
                }
            }
        }, "__ugBridge")

        webView.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView, finishedUrl: String) {
                view.evaluateJavascript(script, null)
            }
        }

        webView.postDelayed({ finish(null, "timeout") }, timeoutMs)
        webView.loadUrl(url)
    }
}
