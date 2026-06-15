---
description: Verify generated agent files are in sync with .agentkit/ and validation passes. Use before committing or when CI reports drift.
agent: agent
---

Run the repository's static gates and report the result concisely:

1. `pnpm validate` - schema, structure, budgets.
2. `pnpm check` - generated native files match `.agentkit/`.

If `pnpm check` reports drift, run `pnpm generate` and re-run, then summarize what changed. Do not edit
generated files by hand.
