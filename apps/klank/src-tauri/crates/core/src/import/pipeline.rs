//! Stage orchestrator. Pure (no Tauri dependencies) so it can be unit tested
//! with fake stages.

use super::{ImportProgress, ImportStage, NormalizedTab, StageOutcome};

/// Runs the stages in order until one succeeds.
///
/// - `preferred` (the last stage that worked) is moved to the front so a
///   degraded primary stage is auto-demoted after a single failure.
/// - Only stages whose `can_handle()` is true are attempted; `total` counts
///   exactly those, so the UI's "x/total" is accurate.
/// - Each stage runs under its own [`ImportStage::timeout`].
/// - `Success` short-circuits; `Skip` advances silently; `RetryNext` advances
///   and reports; `Fatal` stops the whole pipeline.
pub async fn run_import<F>(
    mut stages: Vec<Box<dyn ImportStage>>,
    preferred: Option<&str>,
    emit: F,
) -> Result<NormalizedTab, String>
where
    F: Fn(ImportProgress),
{
    if let Some(pref) = preferred {
        if let Some(pos) = stages.iter().position(|s| s.id() == pref) {
            let s = stages.remove(pos);
            stages.insert(0, s);
        }
    }

    let applicable: Vec<Box<dyn ImportStage>> =
        stages.into_iter().filter(|s| s.can_handle()).collect();
    let total = applicable.len();

    let mut reasons: Vec<String> = Vec::new();

    for (i, stage) in applicable.iter().enumerate() {
        emit(ImportProgress::StageStart {
            id: stage.id().to_string(),
            label: stage.label().to_string(),
            index: i + 1,
            total,
        });

        let outcome = match tokio::time::timeout(stage.timeout(), stage.run()).await {
            Ok(o) => o,
            Err(_) => StageOutcome::RetryNext(super::StageError::Network("timed out".into())),
        };

        match outcome {
            StageOutcome::Success(tab) => {
                emit(ImportProgress::Succeeded {
                    id: stage.id().to_string(),
                    label: stage.label().to_string(),
                });
                return Ok(tab);
            }
            StageOutcome::Skip => continue,
            StageOutcome::RetryNext(err) => {
                let reason = err.message();
                emit(ImportProgress::StageFailed {
                    id: stage.id().to_string(),
                    label: stage.label().to_string(),
                    reason: reason.clone(),
                });
                reasons.push(format!("{}: {}", stage.label(), reason));
            }
            StageOutcome::Fatal(err) => {
                let reason = err.message();
                emit(ImportProgress::StageFailed {
                    id: stage.id().to_string(),
                    label: stage.label().to_string(),
                    reason: reason.clone(),
                });
                return Err(format!("{}: {}", stage.label(), reason));
            }
        }
    }

    Err(if reasons.is_empty() {
        "no import method could handle this URL".into()
    } else {
        format!("all import methods failed — {}", reasons.join("; "))
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::import::{NormalizedTab, StageError, StageOutcome};
    use std::sync::Mutex;
    use std::time::Duration;

    /// Configurable fake stage. `outcome` is consumed once; `can` toggles
    /// applicability.
    struct Fake {
        id: &'static str,
        can: bool,
        outcome: Mutex<Option<StageOutcome>>,
        delay: Duration,
    }

    impl Fake {
        fn new(id: &'static str, outcome: StageOutcome) -> Box<dyn ImportStage> {
            Box::new(Fake {
                id,
                can: true,
                outcome: Mutex::new(Some(outcome)),
                delay: Duration::from_millis(0),
            })
        }
        fn skipped(id: &'static str) -> Box<dyn ImportStage> {
            Box::new(Fake {
                id,
                can: false,
                outcome: Mutex::new(Some(StageOutcome::Skip)),
                delay: Duration::from_millis(0),
            })
        }
        fn slow(id: &'static str, delay: Duration) -> Box<dyn ImportStage> {
            Box::new(Fake {
                id,
                can: true,
                outcome: Mutex::new(Some(StageOutcome::Success(tab(id)))),
                delay,
            })
        }
    }

    #[async_trait::async_trait]
    impl ImportStage for Fake {
        fn id(&self) -> &'static str {
            self.id
        }
        fn label(&self) -> &'static str {
            self.id
        }
        fn can_handle(&self) -> bool {
            self.can
        }
        fn timeout(&self) -> Duration {
            Duration::from_millis(50)
        }
        async fn run(&self) -> StageOutcome {
            if !self.delay.is_zero() {
                tokio::time::sleep(self.delay).await;
            }
            self.outcome
                .lock()
                .unwrap()
                .take()
                .unwrap_or(StageOutcome::Skip)
        }
    }

    fn tab(source: &'static str) -> NormalizedTab {
        NormalizedTab {
            content: "c".into(),
            artist: "a".into(),
            song: "s".into(),
            source,
        }
    }

    fn collector() -> (
        impl Fn(ImportProgress),
        std::sync::Arc<Mutex<Vec<ImportProgress>>>,
    ) {
        let log = std::sync::Arc::new(Mutex::new(Vec::new()));
        let l2 = log.clone();
        (move |p| l2.lock().unwrap().push(p), log)
    }

    #[tokio::test]
    async fn first_success_short_circuits() {
        let (emit, log) = collector();
        let stages = vec![
            Fake::new("a", StageOutcome::Success(tab("a"))),
            Fake::new("b", StageOutcome::Success(tab("b"))),
        ];
        let res = run_import(stages, None, emit).await.unwrap();
        assert_eq!(res.source, "a");
        // Only stage "a" ran: one StageStart + one Succeeded.
        let log = log.lock().unwrap();
        assert_eq!(log.len(), 2);
    }

    #[tokio::test]
    async fn retry_next_advances_and_reports() {
        let (emit, log) = collector();
        let stages = vec![
            Fake::new("a", StageOutcome::RetryNext(StageError::Challenged)),
            Fake::new("b", StageOutcome::Success(tab("b"))),
        ];
        let res = run_import(stages, None, emit).await.unwrap();
        assert_eq!(res.source, "b");
        let log = log.lock().unwrap();
        // StageStart(a), StageFailed(a), StageStart(b), Succeeded(b)
        assert!(matches!(log[1], ImportProgress::StageFailed { .. }));
        assert_eq!(log.len(), 4);
    }

    #[tokio::test]
    async fn fatal_stops_pipeline() {
        let (emit, _log) = collector();
        let stages = vec![
            Fake::new("a", StageOutcome::Fatal(StageError::NotFound)),
            Fake::new("b", StageOutcome::Success(tab("b"))),
        ];
        let err = run_import(stages, None, emit).await.unwrap_err();
        assert!(err.contains("not found"));
    }

    #[tokio::test]
    async fn skip_is_silent_and_total_counts_applicable_only() {
        let (emit, log) = collector();
        let stages = vec![
            Fake::skipped("desktop-only"),
            Fake::new("b", StageOutcome::Success(tab("b"))),
        ];
        let res = run_import(stages, None, emit).await.unwrap();
        assert_eq!(res.source, "b");
        let log = log.lock().unwrap();
        // Only "b" is applicable → total must be 1.
        match &log[0] {
            ImportProgress::StageStart { total, index, .. } => {
                assert_eq!(*total, 1);
                assert_eq!(*index, 1);
            }
            other => panic!("unexpected first event: {other:?}"),
        }
    }

    #[tokio::test]
    async fn preferred_stage_runs_first() {
        let (emit, log) = collector();
        let stages = vec![
            Fake::new("a", StageOutcome::RetryNext(StageError::Challenged)),
            Fake::new("b", StageOutcome::Success(tab("b"))),
        ];
        let res = run_import(stages, Some("b"), emit).await.unwrap();
        assert_eq!(res.source, "b");
        // "b" was promoted to the front, so it is the first (and only) start.
        let log = log.lock().unwrap();
        match &log[0] {
            ImportProgress::StageStart { id, .. } => assert_eq!(id, "b"),
            other => panic!("unexpected first event: {other:?}"),
        }
    }

    #[tokio::test]
    async fn slow_stage_times_out_and_advances() {
        let (emit, _log) = collector();
        let stages = vec![
            Fake::slow("a", Duration::from_millis(500)), // exceeds 50ms timeout
            Fake::new("b", StageOutcome::Success(tab("b"))),
        ];
        let res = run_import(stages, None, emit).await.unwrap();
        assert_eq!(res.source, "b");
    }
}
