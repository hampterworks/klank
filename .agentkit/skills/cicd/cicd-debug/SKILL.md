---
name: cicd-debug
description: Diagnoses a failing CI/CD run via failed-step logs, debug logging, re-runs, flaky triage, and local repro. Loads a platform reference (e.g. github-actions). Use when a pipeline run is failing.
argument-hint: <platform>
---

# Debugging a failing CI/CD run

A run is red and you need the cause. Read the failed step, reproduce, and fix. For creating pipelines use `cicd-scaffold`; for security review use `cicd-harden`; for routine upkeep use `cicd-maintain`.

## Stack guidance

Load `references/github-actions.md` for the target platform's concrete syntax (add more platforms as reference files); with no file for the user's platform, apply the guidance below and say so.

## Steps

1. **Find the failing step, not just the failing job.** The first failed step holds the real error. Read the LAST error line and the lines just above it - later steps often fail as a consequence of the first.
2. **Check whether it is deterministic.** Re-run to learn whether the failure is consistent or flaky. Re-run only the failed jobs first (fast); re-run everything when a passing job may have masked the issue.
3. **Turn on verbose/debug logging** for detail without guessing - the platform's step-debug and runner-debug switches expose internals. Remove them when done to avoid noisy logs.
4. **Read annotations and the run summary.** Structured error/warning annotations and deprecation notices often pinpoint the line faster than scrolling raw logs.
5. **Classify the failure:**
   - *Deterministic* (same step, same error every run) - a real bug in code, config, or a changed dependency/runner. Bisect against the last green run; suspect a moved `*-latest` image or an unpinned dependency that shifted (see `cicd-maintain`/`cicd-harden`).
   - *Flaky/intermittent* - network, timing, ordering, resource limits, or test-order dependence. Re-run to confirm, then quarantine, add a targeted retry, or fix the race. Do not paper over a real race with blanket retries.
6. **Inspect context and environment.** Add a temporary debug step to dump what the job actually saw (trigger, ref, matrix value, presence of expected inputs/vars). A missing secret/var often surfaces as an empty string, not an error. Never echo secrets.
7. **Reproduce locally** with the platform's local-runner tool to iterate without push-and-wait. A local pass is necessary-not-sufficient (tool versions, identity federation, and services differ from hosted runners); confirm the fix on a real run.
8. **Fix and re-run the failed jobs** to confirm green. If the root cause was a dependency/runner change, address it durably via the relevant sibling skill.

## Gotchas

- A step can "fail" only because an earlier step left bad state; trace upward from the first red step.
- Empty/blank interpolations usually mean a missing secret, var, or wrong context - not a syntax error.
- Conditional steps silently skip; a "missing" step that never ran is often a condition, not a crash.
- Continue-on-error and fail-fast settings hide or truncate failures - check them before trusting a green-ish matrix.
- Logs auto-mask secrets, so a needed value can print as masked; that is masking, not corruption.
- A local run passing while CI fails (or vice versa) usually reflects image/tool-version drift, not a pipeline logic bug.
