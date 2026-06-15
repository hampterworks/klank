# GitHub Actions stack reference - hardening

Concrete GitHub Actions hardening for `cicd-harden`, plus the full audit checklist. SHA-pin everything, minimize `GITHUB_TOKEN`, kill injection and `pull_request_target` risks.

## Table of contents

- [Why this matters (2025-2026 incidents)](#why-this-matters-2025-2026-incidents)
- [Steps](#steps)
- [Deep dive: least-privilege GITHUB_TOKEN](#deep-dive-least-privilege-github_token)
- [Gotchas](#gotchas)
- [Audit checklist](#audit-checklist)
- [Sources](#sources)

## Why this matters (2025-2026 incidents)

- **tj-actions/changed-files (CVE-2025-30066, Mar 2025)** - attacker moved existing tags to a malicious commit that dumped runner memory and leaked secrets into logs across 23,000+ repos. Repos pinned to a SHA were unaffected.
- **trivy-action (Mar 2026)** - attacker force-pushed 75 of 76 tags to malicious commits that stole CI/CD secrets before running the real scan, so pipelines looked normal. Root cause traced to a `pull_request_target` misconfig that leaked a PAT in an earlier incident weeks prior.
- **Lessons:** mutable tags are the attack surface. SHA-pinning, least-privilege `GITHUB_TOKEN`, and no untrusted code under `pull_request_target` would have blocked or contained all three.

## Steps

1. **Inventory every `uses:`** across `.github/workflows/` and any composite actions. List each action, its current ref (tag vs SHA), and whether it is official/trusted or third-party.

2. **SHA-pin all external actions.** Replace tag refs with the full 40-char commit SHA plus a `# vX.Y.Z` comment. Pin internal reusable workflows too. As of GitHub's Aug 2025 policy, orgs can ENFORCE SHA pinning and block specific actions at the org/repo level - enable it. Better still, prefer an official tool's pinned release binary or container (verified by sha256 or image digest, run from a minimal `run:` step) over a third-party marketplace *wrapper* around a CLI you could invoke directly - the wrapper is extra third-party code in the pipeline for no benefit. Reserve `uses:` for first-party/official actions, SHA-pinned.

3. **Drive `GITHUB_TOKEN` to least privilege** (the highest-leverage fix - see deep section below).

4. **Remove or rewrite injection sinks.** Find `${{ ... }}` interpolations of attacker-controllable context inside `run:`/`script:` and move them to `env:` vars referenced as `"$VAR"`.

5. **Audit `pull_request_target` usage.** It runs with repo secrets and write token in the base-repo context. Confirm it never checks out or executes PR head code. Prefer plain `pull_request` unless privileged base-repo writes are truly required.

6. **Tighten secrets and OIDC.** Replace long-lived cloud keys with OIDC (`id-token: write` only on the deploy job, short-lived creds). Scope `secrets:` explicitly to called workflows instead of `secrets: inherit`.

7. **Run static analysis.** `zizmor` (catches unpinned-uses, template-injection, dangerous triggers, excessive permissions) and `actionlint` (syntax, shell, expression bugs). Run them locally or as a CI job using the official, SHA-pinned action only.

8. **Add Dependabot for actions** so pins get PRs to bump SHAs; `cicd-maintain` covers the upkeep cadence.

9. **Work the full checklist** below and confirm each item.

## Deep dive: least-privilege GITHUB_TOKEN

- Set a restrictive default at the top, then grant per job. Strongest baseline:

  ```yaml
  permissions: {}          # deny all at workflow level
  jobs:
    build:
      permissions:
        contents: read      # grant only what THIS job needs
  ```

  `read-all` is acceptable as a top-level default when many jobs read; still narrow each job.
- Only the job that needs a scope gets it: `packages: write` for publishing, `pull-requests: write` for PR comments, `id-token: write` for OIDC, `contents: write` for releases/tags.
- Older repos (created before Feb 2023) may default `GITHUB_TOKEN` to read-WRITE. Flip the repo to read-only in Settings > Actions > General, then grant up in workflows.
- A leaked over-scoped token is the difference between a logged secret and a pushed backdoor; minimal scopes shrink blast radius.

## Gotchas

- Pinning a tag is NOT enough; only a full 40-char SHA is immutable. Short SHAs and tags can both be moved.
- A pinned SHA still needs updating for security fixes - pinning + Dependabot, not pinning alone.
- `zizmor` flags `dangerous-triggers` and `artipacked` (checkout that persists credentials); do not ignore these.
- Re-pin transitively: a SHA-pinned action can still call unpinned actions internally - prefer trusted publishers.
- Self-hosted runners on public repos are dangerous - a forked PR can run arbitrary code on your infra.

## Audit checklist

Copy-paste this and check each item against every workflow under `.github/workflows/` and any composite/reusable actions. Grouped by risk area; top groups are highest leverage.

### Supply chain / action pinning

- [ ] Every external `uses:` is pinned to a full 40-char commit SHA, not a tag or branch.
- [ ] Each pin has a `# vX.Y.Z` comment so the intended version is auditable.
- [ ] Internal reusable workflows (`uses: org/repo/.github/workflows/*.yml@ref`) are pinned to a SHA or immutable release.
- [ ] Third-party actions are from official/highly-trusted publishers; unmaintained or single-maintainer actions removed or replaced.
- [ ] Org/repo SHA-pinning policy enabled (GitHub Aug 2025 policy) to enforce and block actions centrally.
- [ ] Action count is minimized - inline trivial one-liners instead of pulling a dependency (dev-principles).
- [ ] No third-party marketplace action wraps a tool you could run directly; the official tool is downloaded at a pinned version, verified by checksum/digest, and run from a minimal step.
- [ ] No action is referenced by a mutable branch (`@main`, `@master`).

### GITHUB_TOKEN permissions

- [ ] Workflow-level `permissions` is set explicitly (`{}` or `read-all`), never relying on the repo default.
- [ ] Repo default token permission is read-only (Settings > Actions > General) - critical for repos created before Feb 2023.
- [ ] Each job grants only the scopes it needs (`contents`, `packages`, `pull-requests`, `id-token`, etc.).
- [ ] No job has `write` scopes it does not use.
- [ ] `contents: write` is limited to release/tagging jobs.
- [ ] `id-token: write` appears only on jobs performing OIDC auth.

### Triggers and untrusted code

- [ ] `pull_request_target` is used only where base-repo write is required; it never checks out or runs PR head code.
- [ ] No `actions/checkout` with `ref: ${{ github.event.pull_request.head.sha }}` under a privileged trigger.
- [ ] `workflow_run` handlers treat the upstream artifacts/outputs as untrusted.
- [ ] Forked-PR workflows that need secrets gate on a maintainer-approved environment or label.

### Injection

- [ ] No untrusted context (`github.event.*.title`, `.body`, branch/tag/ref names, issue comments, commit messages) interpolated directly into `run:` or `script:`.
- [ ] Untrusted values pass through `env:` and are referenced as quoted shell vars (`"$VAR"`).
- [ ] `github-script` / inline JS uses `process.env`, not `${{ }}` interpolation of untrusted data.
- [ ] No untrusted input written unguarded to `$GITHUB_ENV` or `$GITHUB_OUTPUT`.

### Secrets and OIDC

- [ ] No long-lived cloud credentials in secrets where OIDC is available (AWS/Azure/GCP).
- [ ] Reusable workflows receive explicit `secrets:` mappings, not blanket `secrets: inherit`, where feasible.
- [ ] No secrets echoed, logged, or written to artifacts; masking not relied on as the only control.
- [ ] Secrets scoped to environments with required reviewers for deploy/release.

### Runners and environment

- [ ] Self-hosted runners are not exposed to public-repo forked-PR workflows.
- [ ] Runner labels pinned (`ubuntu-24.04`) where reproducibility matters; image-move tracking owned by cicd-maintain.
- [ ] Jobs set `timeout-minutes` to bound hung steps.
- [ ] No caching of secrets or auth state.

### Tooling and process

- [ ] `zizmor` run with no unaddressed high/medium findings.
- [ ] `actionlint` run clean.
- [ ] Dependabot (or Renovate) enabled for `github-actions` to PR SHA bumps.
- [ ] `concurrency` set to avoid duplicate/racing runs where relevant.

## Sources

- <https://docs.zizmor.sh/audits/>
- <https://docs.github.com/en/actions/reference/security/secure-use>
