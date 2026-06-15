# GitHub Actions stack reference - authoring

Concrete GitHub Actions syntax for `cicd-scaffold`. Secure-by-default from the first commit: minimal permissions, SHA-pinned actions, reusable parts.

## Steps

1. **Pick the trigger precisely.** `push`/`pull_request` for CI; `workflow_dispatch` for manual; `schedule` for cron; `workflow_call` to make it reusable. Never use `pull_request_target` unless you genuinely need write access to the base repo, and then never check out or run untrusted PR head code with it.

2. **Set least-privilege permissions at the top.** Default-deny, then grant per job:

   ```yaml
   permissions:
     contents: read   # or: permissions: {} for nothing
   ```

   Add scopes only on the specific job that needs them (e.g. `permissions: { contents: read, packages: write }`). Never leave the legacy read-write default.

3. **Add `concurrency` to cancel superseded runs** (saves minutes, avoids races):

   ```yaml
   concurrency:
     group: ${{ github.workflow }}-${{ github.ref }}
     cancel-in-progress: true
   ```

   Do NOT use `cancel-in-progress: true` on deploy/release workflows where a mid-flight cancel is unsafe.

4. **Pin actions to SHAs with a version comment.** Tags are mutable (see `cicd-harden` for why this matters):

   ```yaml
   - uses: actions/checkout@08c6903cd8c0fde910a37f88322edcfb5dd907a8 # v5.0.0
   ```

5. **Use a matrix for parallel variants** and `fail-fast` deliberately:

   ```yaml
   strategy:
     fail-fast: false        # see all failures, not just the first
     matrix:
       node: [20, 22]
       os: [ubuntu-24.04, windows-2025]
   runs-on: ${{ matrix.os }}
   ```

   Pin runner labels (`ubuntu-24.04`) rather than `ubuntu-latest` for reproducibility; `cicd-maintain` covers tracking image moves.

6. **Cache dependencies.** Prefer the built-in cache of `setup-*` actions (`actions/setup-node` with `cache: npm`, `setup-python` with `cache: pip`, `setup-go`); fall back to `actions/cache` keyed on a lockfile hash. Never cache secrets or auth tokens.

7. **Use OIDC, not long-lived secrets, for cloud auth.** Add `permissions: { id-token: write }` only on the deploy job and exchange the token for short-lived cloud credentials. No static cloud keys in repo secrets.

8. **Factor out repetition early.** A reusable workflow (`on: workflow_call`) for whole jobs; a composite action (`runs.using: composite`) for a sequence of steps. This is the scalable default once a pattern repeats across jobs or repos - see Reusable parts below.

9. **Lint before committing.** Run `actionlint` (syntax, expressions, shell) and `zizmor` (security) locally; both are dev tools you run, not actions added to the user's workflow.

## Reusable parts

- **Reusable workflow** - share whole jobs across workflows/repos. Caller:

  ```yaml
  jobs:
    test:
      uses: org/repo/.github/workflows/ci.yml@<sha>   # pin internal ones too
      permissions: { contents: read }
      secrets: inherit   # or pass explicit secrets; avoid blanket inherit when possible
  ```

- **Composite action** - bundle a step sequence into one `uses:`. Lives in its own dir with `action.yml`; reference inputs via `${{ inputs.x }}`.
- Version internal reusable workflows with tags/releases and pin callers to a SHA or release; `cicd-maintain` covers the upgrade flow.

## Gotchas

- Never interpolate untrusted input (`${{ github.event.pull_request.title }}`, issue body, branch name) directly into a `run:` script - that is shell injection. Pass it via an `env:` variable and reference `"$VAR"` in the script.
- `permissions: {}` means no scopes; omitting `permissions` entirely falls back to the repo default (often too broad). Be explicit.
- `secrets: inherit` forwards every secret to a called workflow; prefer explicit `secrets:` mapping for third-party or wide-blast-radius workflows.
- `GITHUB_TOKEN` cannot trigger another workflow run (no recursive CI); use a dedicated app token if you need that.
- Set `timeout-minutes` on jobs so a hung step does not burn the full 6-hour default.

## Sources

- <https://docs.github.com/en/actions/reference/security/secure-use>
- <https://docs.github.com/en/actions/sharing-automations/reusing-workflows>
