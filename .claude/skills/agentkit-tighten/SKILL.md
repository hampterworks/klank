---
name: agentkit-tighten
description: Refactors a .agentkit/ agent file to follow the context-architecture rules - disclosure, ordering, descriptions, budgets. Use when a SKILL.md or instruction here is bloated, vague, or oversized.
---

# Tightening agent content

Make an item smaller, better-ordered, and easier to route - without losing meaning.

## Checklist

1. **Description** → third person, what + when (+ when not), ≤200 chars, no `anthropic`/`claude`.
2. **Body order** → summary + triggers first; procedures in the middle; critical "must-do" steps and a
   `Gotchas` section last.
3. **Disclosure** → move bulky detail to `references/*.md` (one level deep; add a TOC if >100 lines);
   keep SKILL.md under 250 lines; reference scripts to run instead of inlining code.
4. **Compress** → delete boilerplate and anything the model already knows; numbered steps over prose;
   use distinct phrasings for the few critical rules.
5. Verify with `pnpm validate` and `pnpm budgets`.

## Gotchas

- Don't repeat the same sentence verbatim; vary phrasing so it survives compression and aids attention.
- Bigger is not safer: oversized files lose the middle and crowd the metadata budget.
