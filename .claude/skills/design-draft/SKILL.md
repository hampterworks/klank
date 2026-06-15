---
name: design-draft
description: Creates a product design as a structured design spec - user flows, information architecture, low-fidelity first, every state covered. Use when designing a new feature, flow, or screen.
---

# Drafting a design

Turn a goal or requirement into a structured, low-fidelity design spec: who, what flow, what
screens, what states. Produce an artifact a team can build from, not pixels.

Use when: a new feature, flow, screen, or end-to-end journey needs designing from scratch (often
fed by `design-interrogate`). Not for critiquing an existing UI (`design-review`) or writing copy
(`design-write`).

Apply `design-principles`: fewest steps and smallest surface that reach the goal; a strong default over
a setting; aim for one moment of delight that never costs clarity.

## Steps

1. **Anchor on the goal.** State the user, their job-to-be-done, and the single success outcome in
   1-2 lines. If this is fuzzy, stop and run `design-interrogate` first. Everything below serves this.
2. **Map the user flow.** List the steps from entry point to success as a linear path (text or
   arrows: `Entry -> A -> B -> Success`). Mark branches and decision points. Minimize steps - each
   one is friction; merge or default away any step that does not earn its place.
3. **Define information architecture.** Group the content and actions into screens or sections. Name
   them. Decide hierarchy: what is primary (one clear primary action per screen), secondary,
   buried. Order by user priority, not internal org structure.
4. **Go low fidelity first.** Sketch each screen as boxes and labels (ASCII, bullets, or a wireframe
   description): regions, key content, the primary action, navigation. Resist visual polish; cheap
   to change now, expensive later. Validate the structure before any styling.
5. **Design responsive and mobile-first.** Lay out for the smallest viewport first, then define how the
   single design reflows up: which regions stack vs sit side by side, what stays primary at each width,
   how navigation adapts (e.g. tab bar to sidebar). Use fluid layouts and relative units, prioritize
   content over chrome, and size targets for touch. One design adapts to every viewport, input (touch,
   pointer, keyboard), and device - never a separate "mobile design".
6. **Force every state.** For each screen, specify all of: ideal/populated, **empty** (first-use vs
   user-cleared vs no-results), **loading**, **error** (and how the user recovers), partial/slow,
   **permission/auth** (logged-out, no access), and edge cases (long text, zero/many items, narrow and
   wide viewports, offline). A design that only shows the happy path is incomplete. Defer copy to
   `design-write` but note what each state must communicate.
7. **Note accessibility intent.** Capture obvious `design-accessibility` concerns now (focus order,
   target size, color not the only signal, text alternatives) so they are designed in, not retrofit.
8. **Output the design-spec artifact** in the structure below.

## Design-spec output structure

```text
# <Feature> design spec
## Goal           - user, job-to-be-done, success outcome
## User flow      - steps, branches, decision points
## Information architecture - screens/sections, hierarchy, primary actions
## Screens        - per screen: regions, content, primary/secondary actions
## Responsive     - mobile-first layout, breakpoints, what reflows or adapts per viewport
## States         - per screen: ideal, empty, loading, error, permission, edge cases
## Accessibility notes - flagged at design time
## Open questions - unresolved decisions, assumptions to validate
```

## Gotchas

- Skipping states is the most common gap. An empty/error/loading state is design work, not a TODO.
- Do not jump to high fidelity or pick components before the flow and IA are agreed.
- One primary action per screen. Two competing primaries means the hierarchy is unresolved.
- A flow with many steps is a smell - look for a default, a merge, or a removable step first.
- IA mirrors the user's mental model, not the database schema or the team's org chart.
- Design mobile-first; a layout that only works at desktop width is incomplete, like a missing state.
