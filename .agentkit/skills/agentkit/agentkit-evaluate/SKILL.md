---
name: agentkit-evaluate
description: Runs the local behavioral eval harness (promptfoo plus golden datasets) to check that skills trigger and behave correctly. Use when changing a skill's description or behavior; requires an API key.
---

# Evaluating skills

Behavioral, model-in-the-loop testing. Build the eval **before** writing extensive instructions
(evaluation-driven development) so skills solve real gaps, not imagined ones. Local and manual - it is
intentionally **not** in CI and costs money, so run it deliberately.

## Steps

1. Export a key: `export ANTHROPIC_API_KEY=…`.
2. Add or update a golden case under `evals/golden/` using the Anthropic shape:
   `{ "skills": [...], "query": "…", "files": [...], "expected_behavior": ["…"] }`.
3. Run `pnpm eval` (promptfoo trigger/no-trigger suites + the golden runner) and read the scores.
4. Iterate description and body until trigger precision and behavior pass; commit the golden case.

## Gotchas

- Test across the models you target (Haiku/Sonnet/Opus); guidance that suits Opus may underspecify Haiku.
- A skill that passes only because its golden case is loose is not validated; make `expected_behavior` specific.
