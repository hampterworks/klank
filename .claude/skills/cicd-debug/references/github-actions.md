# GitHub Actions stack reference - debugging

Concrete GitHub Actions debugging for `cicd-debug`. Find the failed step, reproduce, classify, fix.

## Steps

1. **Find the failing step, not just the failing job.** Open the run in the Actions tab; the red job's first failed step holds the real error. Read the LAST error line and the lines just above it - later steps often fail as a consequence of the first. CLI: `gh run view <run-id> --log-failed` shows only failed-step logs.

2. **Check whether it is deterministic.** Re-run to learn whether it is consistent or flaky:
   - **Re-run failed jobs** (retries only red jobs, reuses passed ones) - fast.
   - **Re-run all jobs** - when a passing job may have masked the issue.
   - Check **"Enable debug logging"** when re-running to get verbose traces for that run only.

3. **Turn on step debug logging** for detail without a re-run dialog. Set repo/org variables (not just the re-run checkbox):
   - `ACTIONS_STEP_DEBUG=true` - verbose per-step internals.
   - `ACTIONS_RUNNER_DEBUG=true` - runner/job-setup diagnostics.
   Set them as repository variables (or secrets) in Settings; remove when done to avoid noisy logs.

4. **Read annotations and the summary.** Workflow annotations surface `::error::`/`::warning::` messages and deprecation notices at the top of the run; the job summary may show structured failure output. These often pinpoint the line faster than scrolling logs.

5. **Classify the failure:**
   - *Deterministic* (same step, same error every run) - a real bug in code, config, or a changed action/runner. Bisect: diff against the last green run; suspect a moved `*-latest` runner image or an unpinned action that shifted (see `cicd-maintain`/`cicd-harden`).
   - *Flaky/intermittent* - network, timing, ordering, resource limits, or test order dependence. Re-run to confirm; then quarantine, add a targeted retry, or fix the race. Do not paper over a real race with blanket retries.

6. **Inspect context and env.** Add a temporary debug step to dump what the job actually saw:

   ```yaml
   - run: |
       echo "ref=$GITHUB_REF event=$GITHUB_EVENT_NAME"
       env | sort
   ```

   Verify the trigger, ref, matrix value, and that expected inputs/vars are present (a missing secret/var often surfaces as an empty string, not an error). Never echo secrets.

7. **Reproduce locally with `act`** to iterate without push-and-wait:

   ```bash
   act -j <job-id> -W .github/workflows/<file>.yml
   ```

   `act` runs jobs in Docker approximating the runner. Caveat: software versions, OIDC, artifacts, and some services differ from GitHub-hosted runners, so a local pass is necessary-not-sufficient; confirm the fix on a real run.

8. **Fix and re-run the failed jobs** to confirm green. If the root cause was an action/runner change, address it durably via the relevant sibling skill.

## Gotchas

- A step can "fail" only because an earlier step left bad state; trace upward from the first red step.
- Empty/blank interpolations usually mean a missing secret, var, or wrong context - not a syntax error.
- `if:` conditions silently skip steps; a "missing" step that never ran is often a condition, not a crash.
- `continue-on-error: true` and `fail-fast` hide or truncate failures - check them before trusting a green-ish matrix.
- Logs auto-mask secrets, so a needed value can print as `***`; that is masking, not corruption.
- `act` succeeding while CI fails (or vice versa) usually reflects image/tool-version drift, not a workflow logic bug.

## Sources

- <https://docs.github.com/en/actions/how-tos/monitor-workflows/enable-debug-logging>
- <https://docs.github.com/en/actions/how-tos/manage-workflow-runs/re-run-workflows-and-jobs>
- <https://github.com/nektos/act>
