# Running the doctor automatically

Make the checks run on every change so issues are caught at the source instead of in a later audit.

## GitHub Actions

```yaml
# .github/workflows/agent-doctor.yml
name: agent-doctor
on:
  pull_request:
    paths: ["**/AGENTS.md", "**/CLAUDE.md", ".claude/**", ".junie/**", ".github/agents/**", "docs/agents/**"]
jobs:
  doctor:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      # Run the doctor against this checkout. Use npx against the published agentkit,
      # or vendor the tool. Non-zero exit (errors) fails the job.
      - run: npx -y @agent-content/agentkit doctor .
```

To gate on warnings too, add `--max-warnings 0` once the repo is clean (or grep the output).

## Pre-commit hook

```bash
# .git/hooks/pre-commit  (or a husky/lefthook step)
#!/bin/sh
changed=$(git diff --cached --name-only | grep -E 'AGENTS\.md|CLAUDE\.md|\.claude/|\.junie/|\.github/agents/|docs/agents/') || exit 0
[ -n "$changed" ] && npx -y @agent-content/agentkit doctor . || true
```

## In a `.agentkit/`+generate repo

If the repo authors content under `.agentkit/` (this repo's model), prefer `pnpm validate` + `pnpm check`
(generated-in-sync) in CI - `doctor` is for **foreign** repos that hand-maintain native files. Same
rule-set, two entry points.

## Cadence

- **PR gate** (above) catches regressions before merge.
- **Periodic sweep:** run `agentkit doctor .` after a platform/tooling update - capabilities change
  (e.g. Copilot Agent Skills, Dec 2025, made per-skill `.github/agents` stubs redundant), and a sweep
  surfaces newly-redundant mirrors.
