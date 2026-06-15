# GitHub Actions stack reference - maintaining

Concrete GitHub Actions upkeep for `cicd-maintain`. Bump pinned actions, migrate runner images, prune dead workflows, version reusable workflows.

## Steps

1. **Automate action updates with Dependabot.** Add `.github/dependabot.yml`:

   ```yaml
   version: 2
   updates:
     - package-ecosystem: "github-actions"
       directory: "/"
       schedule: { interval: "weekly" }
   ```

   Dependabot keeps the SHA pin but advances it and updates the `# vX.Y.Z` comment, so you stay pinned AND current. Renovate is an alternative with grouping and a cooldown window (delay adopting brand-new releases to dodge fresh compromises). Review the diff before merging; do not blind-auto-merge action bumps.

2. **Track and migrate runner-image moves.** `ubuntu-latest` now resolves to `ubuntu-24.04` (moved Dec 2024 to Jan 2025); `ubuntu-20.04` was fully removed by Apr 2025. Pin a specific label (`ubuntu-24.04`, `windows-2025`) for reproducibility, and put runner-image bumps on a deliberate cadence rather than riding `*-latest` and getting surprised by brownouts. Watch `actions/runner-images` issues for deprecation and tool-removal notices.

3. **Audit for deprecation warnings.** Skim recent run annotations for "deprecated" notices (old action major versions, Node runtime end-of-life, removed runner tools). Address them before the brownout-to-failure cutover.

4. **Prune dead and slow workflows.** Identify workflows with no recent runs, redundant triggers, or that always pass trivially - delete or consolidate them. For slow ones, add caching, split with a matrix, or tighten `paths:`/`paths-ignore:` so they only run when relevant. Add `concurrency` with `cancel-in-progress` to stop stacking redundant runs.

5. **Version internal reusable workflows deliberately.** Tag releases (semver) and have callers pin to a SHA or release tag, not `@main`. Treat a breaking input/secret change as a major bump. Provide a short migration note in the release. This lets consumers upgrade on their schedule instead of breaking on every push to the shared workflow.

6. **Periodically re-pin transitively.** A SHA-pinned action you trust may itself call unpinned actions; on major bumps, re-check that its internal `uses:` are still trustworthy.

7. **Keep the dependency set shrinking.** On each pass, ask whether an external action can be replaced by a few lines of `run:` or an official `setup-*` action. Fewer third-party actions means less to maintain and audit.

## Gotchas

- Do not auto-merge action bumps unattended - a malicious release or a moved tag can land via the bump itself; review diffs and consider a Renovate cooldown.
- `*-latest` labels change under you - acceptable for casual repos, risky for anything reproducibility-sensitive; pin the version.
- Bumping a runner image can change preinstalled tool versions (Node, Python, Docker); test on the new image before standardizing.
- Removing a workflow that other repos call via `workflow_call` breaks them - search for `uses:` references first.
- Dependabot opens one PR per action by default; group related bumps (or use Renovate grouping) to cut review noise.

## Sources

- <https://github.com/actions/runner-images>
- <https://docs.github.com/en/code-security/dependabot/working-with-dependabot/keeping-your-actions-up-to-date-with-dependabot>
