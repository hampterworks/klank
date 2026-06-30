---
name: develop-consolidate
description: Audits for one-off UI components and design-token drift (spacing, type, color, height), merging duplicates into shared primitives. Use for a consistency pass, not general cleanup or code review.
argument-hint: "<scope: diff|area|repo>"
---

# Consolidating UI components and design tokens

Find where the UI has drifted from its design system - duplicate components built one-off instead of
reused, and magic-number spacing/type/color/height values that bypass the token scale - then merge them
back into shared primitives. This is `dev-principles` (one source of truth, least code) applied to UI:
a second button component is the same defect as a second copy of a function.

Use as a dedicated pass to find and fix consistency drift. Not general code smells (`develop-clean`);
not a code review that flags duplication but leaves the fix to the author (`develop-review`); not a
heuristic critique of the live UI/UX with no code changes (`design-review`) - this skill is specific to
design-token/component drift and ends with the merge applied, not just named.

## Scope

Confirm before starting; default to `diff` if unspecified.

- **diff** - the current change only: does it add a one-off component or magic value where an existing one
  would do.
- **area** - a feature/directory: consolidate within it.
- **repo** - the whole UI: batch by component family (buttons, cards, inputs, ...) in separate reviewable
  commits, never one sweeping diff.

## Process

1. **Find the sources of truth.** The token source (spacing, type scale, color, radius, height - a theme
   file, CSS custom properties, a theme object, or a constants module) and the shared component layer
   (e.g. a `components/ui` or design-system package), which is the merge target. A missing token system
   or component layer is itself a finding to report, not a gap to fill in this pass.
2. **Scan the scope for drift:**
   - **Magic values** - hardcoded px/rem/hex/numeric spacing, font-size, height, or color that bypass a
     token, especially values a few pixels off an existing token.
   - **Near-duplicate components** - overlapping markup/props doing one job under different names (two card
     components, a one-off modal beside the shared `Dialog`).
   - **Inconsistent application** - the same concept (page padding, heading size, button height) using
     different values across screens for no functional reason.
3. **Prioritize.** Group findings by component/token family; order by frequency x visual prominence (a
   header drift beats a rarely-seen settings row).
4. **Baseline, then consolidate in small batches.** Get tests/type-check/build green first so you can prove
   behavior is preserved (no baseline, drop to flagging findings only). Then, preferring extension over
   creation:
   - Snap a stray value to the nearest existing token; the gap was drift, not a need.
   - Add a *new* token only for a value that recurs and is a genuine new step in the scale, never for one
     usage.
   - Merge a near-duplicate into the existing component via a variant/prop, repoint every call site, and
     delete the duplicate; never keep both "for now."
5. **Verify.** Re-run tests/build, and screenshot affected screens before/after (`qa-capture`). A token
   swap that shifts pixels, or a merge that changes behavior, is a regression - not a side effect to wave
   through.
6. **Report:** what merged into what, tokens reused vs added (added should be rare), and what was deferred
   to a later pass and why.

## Gotchas

- Prefer extending an existing component's variants over a new component that almost does the same thing
  (`dev-principles`).
- Batch even at `repo` scope; an unreviewable diff defeats the pass.
- Do not smuggle a behavior or visual change into a "consolidation" - a real diff is a finding to surface,
  not a fix to slip in.
- Consolidate by shape and purpose, not visual resemblance: components that look alike but differ
  semantically (an alert vs a toast) stay separate.
