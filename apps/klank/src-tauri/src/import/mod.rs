//! Tab-import pipeline.
//!
//! Importing a tab is modelled as an ordered chain of independent **stages**
//! (see [`ImportStage`]). Each stage is one way to obtain a tab; the
//! orchestrator ([`pipeline::run_import`]) tries them in order until one
//! succeeds. Adding or removing an import method is a one-line change in
//! [`stages::build_stages`] plus a new stage module — the frontend needs no
//! change because it renders whatever progress the backend streams.
//!
//! Stages receive everything they need at construction (dependency injection),
//! so the orchestrator itself depends on nothing Tauri-specific and is unit
//! testable with fake stages.

pub mod pipeline;
pub mod stages;

use std::time::Duration;
use tauri::ipc::Channel;

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
    // Constructed by the upcoming `ug-webview` stage (and by pipeline tests).
    #[allow(dead_code)]
    Skip,
    /// This method failed; try the next stage.
    RetryNext(StageError),
    /// Definitively not importable (bad URL / 404) — stop the whole pipeline.
    Fatal(StageError),
}

/// One import method. Implementors capture their own dependencies (url, http
/// client, app handle) at construction so this trait stays dependency-free.
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
    StageStart { id: String, label: String, index: usize, total: usize },
    StageFailed { id: String, label: String, reason: String },
    Succeeded { id: String, label: String },
}

/// Serialised success payload returned to the frontend (`download.ts` parses
/// this, strips markup, and builds the filename).
#[derive(serde::Serialize)]
struct OutTab {
    content: String,
    artist: String,
    song: String,
}

/// Entry point used by the `scrape_ug` command. Builds the stages, applies the
/// self-healing order, runs the pipeline while streaming progress, persists the
/// winning stage, and returns the normalised tab as a JSON string.
pub async fn run(
    app: tauri::AppHandle,
    url: String,
    on_progress: Channel<ImportProgress>,
) -> Result<String, String> {
    let http = reqwest::Client::builder()
        .build()
        .map_err(|e| e.to_string())?;

    let stages = stages::build_stages(app.clone(), url, http);
    let preferred = read_last_successful(&app);

    let emit = move |p: ImportProgress| {
        let _ = on_progress.send(p);
    };

    match pipeline::run_import(stages, preferred.as_deref(), emit).await {
        Ok(tab) => {
            write_last_successful(&app, tab.source);
            serde_json::to_string(&OutTab {
                content: tab.content,
                artist: tab.artist,
                song: tab.song,
            })
            .map_err(|e| e.to_string())
        }
        Err(e) => Err(e),
    }
}

const LAST_STAGE_FILE: &str = "ug_last_stage";

/// Reads the id of the stage that last succeeded, so the pipeline can try it
/// first. Best-effort: any error simply yields the default order.
fn read_last_successful(app: &tauri::AppHandle) -> Option<String> {
    use tauri::Manager;
    let path = app.path().app_config_dir().ok()?.join(LAST_STAGE_FILE);
    let id = std::fs::read_to_string(path).ok()?.trim().to_string();
    if id.is_empty() {
        None
    } else {
        Some(id)
    }
}

/// Records the winning stage id. Best-effort; failures are ignored.
fn write_last_successful(app: &tauri::AppHandle, id: &str) {
    use tauri::Manager;
    if let Ok(dir) = app.path().app_config_dir() {
        let _ = std::fs::create_dir_all(&dir);
        let _ = std::fs::write(dir.join(LAST_STAGE_FILE), id);
    }
}
