//! Tab-import pipeline (headless core).
//!
//! Importing a tab is modelled as an ordered chain of independent **stages**
//! (see [`ImportStage`]). Each stage is one way to obtain a tab; the
//! orchestrator ([`pipeline::run_import`]) tries them in order until one
//! succeeds. Adding or removing an import method is a one-line change in
//! [`build_headless_stages`] plus a new stage module.
//!
//! Stages receive everything they need at construction (dependency injection),
//! so the orchestrator itself depends on nothing platform-specific and is unit
//! testable with fake stages. This crate ships only the two **headless** stages
//! (mobile API + website); the hidden-webview fallback needs a real browser and
//! is supplied by the tauri crate, which appends it to the list returned here.

pub mod pipeline;
pub mod stages;

use std::path::Path;
use std::time::Duration;

/// A tab normalised to a single shape regardless of which stage produced it.
/// `content` keeps UG's `[ch]`/`[tab]` markup — the frontend strips it.
#[derive(Debug)]
pub struct NormalizedTab {
    pub content: String,
    pub artist: String,
    pub song: String,
    /// Stage id that produced this tab, used to bias the next run's ordering.
    pub source: &'static str,
}

/// Why a stage did not produce a tab. Drives both the user-facing reason text
/// and whether the pipeline should keep going.
#[derive(Debug, Clone, PartialEq)]
pub enum StageError {
    Network(String),
    Unauthorized,
    NotFound,
    Challenged,
    Parse(String),
}

impl StageError {
    pub fn message(&self) -> String {
        match self {
            StageError::Network(m) => format!("network error ({m})"),
            StageError::Unauthorized => "rejected by Ultimate Guitar (auth)".into(),
            StageError::NotFound => "tab not found".into(),
            StageError::Challenged => "blocked by an anti-bot challenge".into(),
            StageError::Parse(m) => format!("could not read the tab data ({m})"),
        }
    }
}

/// Result of running one stage.
pub enum StageOutcome {
    /// Got the tab — stop.
    Success(NormalizedTab),
    /// Not applicable right now (e.g. a desktop-only stage on mobile) — skip silently.
    Skip,
    /// This method failed; try the next stage.
    RetryNext(StageError),
    /// Definitively not importable (bad URL / 404) — stop the whole pipeline.
    Fatal(StageError),
}

/// One import method. Implementors capture their own dependencies (url, http
/// client, config dir) at construction so this trait stays dependency-free.
#[async_trait::async_trait]
pub trait ImportStage: Send + Sync {
    /// Stable machine id (e.g. `"ug-mobile-api"`).
    fn id(&self) -> &'static str;
    /// Human label shown in the progress UI.
    fn label(&self) -> &'static str;
    /// Whether this stage applies to the current input/platform.
    fn can_handle(&self) -> bool;
    /// Per-stage time budget.
    fn timeout(&self) -> Duration;
    /// Attempt the import.
    async fn run(&self) -> StageOutcome;
}

/// Progress events streamed to the frontend over a per-invocation channel.
#[derive(Debug, Clone, PartialEq, serde::Serialize)]
#[serde(tag = "type")]
pub enum ImportProgress {
    StageStart {
        id: String,
        label: String,
        index: usize,
        total: usize,
    },
    StageFailed {
        id: String,
        label: String,
        reason: String,
    },
    Succeeded {
        id: String,
        label: String,
    },
}

/// Builds the ordered list of **headless** stages, injecting each with the
/// dependencies it needs. The tauri crate pushes the webview stage onto the
/// returned vec; `klank-server` runs these two alone.
pub fn build_headless_stages(
    config_dir: &Path,
    url: String,
    http: reqwest::Client,
) -> Vec<Box<dyn ImportStage>> {
    vec![
        Box::new(stages::UgMobileApi::new(
            config_dir.to_path_buf(),
            url.clone(),
            http.clone(),
        )),
        Box::new(stages::UgWebsite::new(url, http)),
    ]
}

/// Runs the given stages, applying the self-healing order (last-successful
/// stage first), streaming progress via `emit`, and persisting the winning
/// stage. Returns the normalised tab or a human-readable failure summary.
pub async fn run_pipeline<F>(
    stages: Vec<Box<dyn ImportStage>>,
    config_dir: &Path,
    emit: F,
) -> Result<NormalizedTab, String>
where
    F: Fn(ImportProgress),
{
    let preferred = read_last_successful(config_dir);
    match pipeline::run_import(stages, preferred.as_deref(), emit).await {
        Ok(tab) => {
            write_last_successful(config_dir, tab.source);
            Ok(tab)
        }
        Err(e) => Err(e),
    }
}

const LAST_STAGE_FILE: &str = "ug_last_stage";

/// Reads the id of the stage that last succeeded, so the pipeline can try it
/// first. Best-effort: any error simply yields the default order.
fn read_last_successful(config_dir: &Path) -> Option<String> {
    let id = std::fs::read_to_string(config_dir.join(LAST_STAGE_FILE))
        .ok()?
        .trim()
        .to_string();
    if id.is_empty() {
        None
    } else {
        Some(id)
    }
}

/// Records the winning stage id. Best-effort; failures are ignored.
fn write_last_successful(config_dir: &Path, id: &str) {
    let _ = std::fs::create_dir_all(config_dir);
    let _ = std::fs::write(config_dir.join(LAST_STAGE_FILE), id);
}
