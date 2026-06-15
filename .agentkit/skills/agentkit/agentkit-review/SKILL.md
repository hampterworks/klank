---
name: agentkit-review
description: Reviews an agent-content diff against the authoring catalogue checklist. Use when reviewing a PR that changes skills, instructions, or AGENTS.md - not for general code review.
---

# Reviewing agent content

A qualitative pass that complements mechanical `validate`, applying `review-principles`. Delegate to the
`content-reviewer` subagent for larger diffs.

## Review checklist

1. **Edited the source?** Changes are in `.agentkit/`, with regenerated outputs included (not hand-edited).
2. **Routing quality** - descriptions are specific, third person, what + when, and discriminative
   (won't mis-trigger). Negative boundaries present where useful.
3. **Structure** - progressive disclosure honored; ordering puts critical steps + Gotchas last.
4. **Orthogonality** - the new item doesn't duplicate an existing one; one clear job.
5. **Budgets** - `pnpm budgets` stays comfortably under the ceiling.

## Gotchas

- A clean `validate` is necessary but not sufficient - judgment on clarity and overlap is the point here.
- Prefer requesting a split over approving a skill that does five unrelated things.
