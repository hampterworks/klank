---
name: cicd-scaffold
description: Scaffolds a secure-by-default CI/CD pipeline - least-privilege, pinned deps, caching, matrices, reusable parts. Loads a platform reference (e.g. github-actions). Use when creating a pipeline.
argument-hint: <platform>
---

# Scaffolding a CI/CD pipeline

Build a new pipeline that is secure-by-default from the first commit: minimal permissions, pinned actions/images, reusable parts as the scalable default. For securing an EXISTING pipeline use `cicd-harden`; for a failing run use `cicd-debug`; for routine upkeep use `cicd-maintain`.

Follow `dev-principles`: prefer zero added third-party steps; use only official or highly-trusted ones; pin every external dependency to an immutable digest.

## Stack guidance

Load `references/github-actions.md` for the target platform's concrete syntax (add more platforms as reference files); with no file for the user's platform, apply the guidance below and say so.

## Steps

1. **Pick the trigger precisely.** Build/test on push and pull request; manual and scheduled triggers only where needed. Never grant a privileged trigger write access to the base repo while running untrusted contributor code.
2. **Set least-privilege permissions.** Default-deny the pipeline token, then grant only the scopes each job needs (read source by default; write only where a job publishes, comments, or releases). Never leave the broad legacy default.
3. **Cancel superseded runs** with a concurrency group keyed on the ref, except on deploy/release pipelines where a mid-flight cancel is unsafe.
4. **Pin every external dependency to an immutable digest** (commit SHA / image digest), with a version comment - tags and `*-latest` are mutable and are the supply-chain attack surface (`cicd-harden` explains why).
5. **Use a matrix for parallel variants** (language/runtime versions, OS) and set fail-fast deliberately - disable it when you want to see all failures, not just the first. Pin runner/image labels for reproducibility.
6. **Cache dependencies** keyed on the lockfile hash; prefer the built-in cache of official setup steps. Never cache secrets or auth tokens.
7. **Use short-lived federated credentials (OIDC), not long-lived secrets, for cloud auth.** Grant the token-minting scope only on the deploy job.
8. **Factor out repetition early.** Extract a reusable pipeline for whole jobs and a composite/template unit for a step sequence once a pattern repeats across jobs or repos.
9. **Lint before committing.** Run the platform's syntax and security linters locally - tools you run, not steps you add to the user's pipeline.

## Gotchas

- Never interpolate untrusted input (PR title, branch name, issue body) directly into a shell step - that is injection. Pass it via an environment variable and reference the quoted variable.
- Empty permissions means no scopes; omitting permissions entirely falls back to the platform default, which is often too broad. Be explicit.
- The pipeline's own token usually cannot trigger another pipeline run; use a dedicated app token if you need that.
- Set a per-job timeout so a hung step does not burn the maximum budget.
