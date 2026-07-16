//! Fallback import stage: scrape the public UG tab page over plain HTTP.
//!
//! On a cold (cookie-less) visit, UG server-renders the full tab payload into
//! `<div class="js-store" data-content="...">` (HTML-escaped JSON, top-level
//! `store`). We fetch with realistic browser headers and read that attribute —
//! no browser required. Covers the case where the mobile API changes.

use super::super::{ImportStage, NormalizedTab, StageError, StageOutcome};
use super::is_ug_url;
use std::time::Duration;

const BROWSER_UA: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) \
AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

pub struct UgWebsite {
    url: String,
    http: reqwest::Client,
}

impl UgWebsite {
    pub fn new(url: String, http: reqwest::Client) -> Self {
        Self { url, http }
    }
}

#[async_trait::async_trait]
impl ImportStage for UgWebsite {
    fn id(&self) -> &'static str {
        "ug-website"
    }
    fn label(&self) -> &'static str {
        "Ultimate Guitar website"
    }
    fn can_handle(&self) -> bool {
        is_ug_url(&self.url)
    }
    fn timeout(&self) -> Duration {
        Duration::from_secs(12)
    }

    async fn run(&self) -> StageOutcome {
        let resp = self
            .http
            .get(&self.url)
            .header("User-Agent", BROWSER_UA)
            .header(
                "Accept",
                "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            )
            .header("Accept-Language", "en-US,en;q=0.9")
            .header("Referer", "https://www.ultimate-guitar.com/")
            .send()
            .await;

        let resp = match resp {
            Ok(r) => r,
            Err(e) => return StageOutcome::RetryNext(StageError::Network(e.to_string())),
        };

        match resp.status().as_u16() {
            200 => {}
            403 | 429 | 503 => return StageOutcome::RetryNext(StageError::Challenged),
            404 => return StageOutcome::Fatal(StageError::NotFound),
            s => return StageOutcome::RetryNext(StageError::Network(format!("HTTP {s}"))),
        }

        let body = match resp.text().await {
            Ok(b) => b,
            Err(e) => return StageOutcome::RetryNext(StageError::Network(e.to_string())),
        };

        let Some(json) = extract_js_store(&body) else {
            // No js-store usually means a Cloudflare/consent interstitial.
            return StageOutcome::RetryNext(StageError::Challenged);
        };

        match parse_store(&json, self.id()) {
            Some(tab) => StageOutcome::Success(tab),
            None => StageOutcome::RetryNext(StageError::Parse("unexpected page shape".into())),
        }
    }
}

/// Extracts and HTML-decodes the `data-content` attribute of the `js-store`
/// div. Inner quotes are entity-escaped, so the closing quote is unambiguous.
fn extract_js_store(html: &str) -> Option<String> {
    let anchor = html.find("js-store")?;
    let rest = &html[anchor..];
    let attr = rest.find("data-content=")?;
    let after = &rest[attr + "data-content=".len()..];
    let quote = after.chars().next()?;
    if quote != '"' && quote != '\'' {
        return None;
    }
    let after = &after[quote.len_utf8()..];
    let end = after.find(quote)?;
    let raw = &after[..end];
    Some(html_escape::decode_html_entities(raw).into_owned())
}

/// Navigates the `store.page.data` JSON to the tab content + metadata.
/// Shared with the webview stage, which delivers the same `{ store: … }` shape.
pub fn parse_store(json: &str, source: &'static str) -> Option<NormalizedTab> {
    let v: serde_json::Value = serde_json::from_str(json).ok()?;
    let data = v.get("store")?.get("page")?.get("data")?;
    let content = data
        .get("tab_view")?
        .get("wiki_tab")?
        .get("content")?
        .as_str()?
        .to_string();
    if content.trim().is_empty() {
        return None;
    }
    let tab = data.get("tab");
    let artist = tab
        .and_then(|t| t.get("artist_name"))
        .and_then(|x| x.as_str())
        .unwrap_or("")
        .to_string();
    let song = tab
        .and_then(|t| t.get("song_name"))
        .and_then(|x| x.as_str())
        .unwrap_or("")
        .to_string();
    Some(NormalizedTab {
        content,
        artist,
        song,
        source,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extracts_and_decodes_data_content() {
        let html =
            r#"<div class="js-store" data-content="{&quot;store&quot;:{&quot;x&quot;:1}}"></div>"#;
        let got = extract_js_store(html).unwrap();
        assert_eq!(got, r#"{"store":{"x":1}}"#);
    }

    #[test]
    fn parses_store_to_normalized_tab() {
        let json = r#"{"store":{"page":{"data":{
            "tab_view":{"wiki_tab":{"content":"[tab]riff[/tab]"}},
            "tab":{"artist_name":"Nirvana","song_name":"Polly"}
        }}}}"#;
        let tab = parse_store(json, "ug-website").unwrap();
        assert_eq!(tab.artist, "Nirvana");
        assert_eq!(tab.song, "Polly");
        assert!(tab.content.contains("riff"));
        assert_eq!(tab.source, "ug-website");
    }

    #[test]
    fn missing_js_store_returns_none() {
        assert!(extract_js_store("<html>no store here</html>").is_none());
    }
}
