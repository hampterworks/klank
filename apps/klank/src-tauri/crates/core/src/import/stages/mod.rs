//! The concrete headless import stages and their shared helpers.
//!
//! The hidden-webview stage is **not** here — it needs a real browser (WRY on
//! desktop, a Kotlin WebView on Android) and therefore lives in the tauri crate,
//! which appends it to these headless stages. Both `klank-server` and the tauri
//! crate build the headless stages from [`super::build_headless_stages`].

mod ug_mobile_api;
mod ug_website;

pub use ug_mobile_api::UgMobileApi;
pub use ug_website::{parse_store, UgWebsite};

/// Shared helper: is this a URL we recognise as an Ultimate Guitar tab page?
pub fn is_ug_url(url: &str) -> bool {
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
