---
name: cicd-maintain
description: Keeps CI/CD pipelines healthy via dependency and runner-image updates, pruning, and reusable-pipeline versioning. Loads a platform reference (e.g. github-actions). Use for routine upkeep.
argument-hint: <platform>
---

# Maintaining CI/CD pipelines

Keep existing, working pipelines current and lean: bump pinned dependencies, migrate off deprecated runner images, prune dead/slow pipelines, version internal reusable pipelines. For securing a pipeline use `cicd-harden`; for a failing run use `cicd-debug`; for a new pipeline use `cicd-scaffold`.

Follow `dev-principles`: minimize and prefer eliminating external/third-party steps; the fewer dependencies, the less upkeep and supply-chain surface.

## Stack guidance

Load `references/github-actions.md` for the target platform's concrete syntax (add more platforms as reference files); with no file for the user's platform, apply the guidance below and say so.

## Steps

1. **Automate dependency updates with a bot.** Configure the platform's update bot (or Renovate) to advance pinned digests and the version comment on a cadence, so pins stay current AND immutable. Review each diff before merging; do not blind-auto-merge dependency bumps - a malicious release or moved tag can land via the bump itself. Consider a cooldown window that delays adopting brand-new releases.
2. **Track and migrate runner-image moves.** Floating `*-latest` images shift under you and eventually drop old versions. Pin a specific image label for reproducibility and put image bumps on a deliberate cadence rather than getting surprised by a brownout. Watch the platform's runner-image deprecation notices.
3. **Audit for deprecation warnings.** Skim recent run annotations for deprecation notices (old dependency major versions, end-of-life runtimes, removed runner tools) and address them before the brownout-to-failure cutover.
4. **Prune dead and slow pipelines.** Delete or consolidate pipelines with no recent runs, redundant triggers, or trivial always-pass behavior. For slow ones, add caching, split with a matrix, or tighten path filters so they run only when relevant. Cancel superseded runs with a concurrency setting.
5. **Version internal reusable pipelines deliberately.** Tag releases (semver) and have callers pin to a digest or release tag, not a moving branch. Treat a breaking input/secret change as a major bump and provide a short migration note, so consumers upgrade on their schedule instead of breaking on every push.
6. **Periodically re-pin transitively.** A pinned dependency you trust may itself call unpinned ones; on major bumps, re-check that its internal dependencies are still trustworthy.
7. **Keep the dependency set shrinking.** On each pass, ask whether an external step can be replaced by a few lines of script or an official setup step. Fewer third-party dependencies means less to maintain and audit.

## Gotchas

- Do not auto-merge dependency bumps unattended - review diffs and consider a cooldown.
- Floating `*-latest` labels change under you - acceptable for casual repos, risky for anything reproducibility-sensitive; pin the version.
- Bumping a runner image can change preinstalled tool versions; test on the new image before standardizing.
- Removing a pipeline that other repos call breaks them - search for references first.
- One PR per dependency is noisy; group related bumps to cut review load.
