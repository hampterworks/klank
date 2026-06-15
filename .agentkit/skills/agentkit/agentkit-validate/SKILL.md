---
name: agentkit-validate
description: Runs schema, structure, and metadata-budget checks over .agentkit/ and docs. Use for the deterministic pre-commit pass, not the qualitative PR review (agentkit-review) or app-code linting.
---

# Validating agent content

Catch structural and budget problems early, deterministically, with no API key.

## Steps

1. `pnpm validate` - JSON-Schema frontmatter, naming, structure, ordering, links, and the metadata ceiling.
2. `pnpm budgets` - per-skill and cumulative metadata vs the ~16KB ceiling (skills hide past it).
3. Fix errors (they fail CI); treat warnings as strong nudges, info as optional.

## Common fixes

- `schema` → a frontmatter field is missing or the wrong type; compare against `src/schemas/`.
- `desc-length` / `metadata-ceiling` → shorten descriptions; move detail into the body or references.
- `ref-dead` / `ref-nested` → fix the link target or flatten to one level deep.
- `skill-lines` → split content into `references/*.md`.

## Gotchas

- `validate` does not check sync - run `pnpm check` (the `agentkit-generate` skill) for that.
- Reserved words `anthropic`/`claude` in a skill name are hard errors.
