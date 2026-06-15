---
name: design-review
description: Critiques an existing design or UI with a heuristic evaluation - Nielsen heuristics, cognitive load, hierarchy, consistency, plus a11y. Use when reviewing or auditing a design for rated fixes.
---

# Reviewing a design

Run a structured heuristic evaluation of an existing design or UI. Output prioritized findings with
severity ratings and concrete fixes, not vague opinions.

Use when: critiquing, auditing, or reviewing something that already exists (screen, flow, prototype,
live UI). Not for creating a design (`design-draft`) or writing copy (`design-write`).

Apply `design-principles` as a lens (remove steps and options; the smallest surface; a default over a
choice) and `review-principles` (critique against the goal, severity-rated findings, each with a fix).

## Steps

1. **Frame the review.** Note the user, the task, and the context. Walk the actual task path, not a
   feature tour. Evaluate against the goal, not personal taste.
2. **Pass against the 10 heuristics** (below). For each screen/step, note where each is honored or
   violated, with a specific location.
3. **Assess cognitive load and friction.** Count steps, fields, choices, and decisions. Flag
   unnecessary friction, redundant input, things the system could remember or default. Flag the
   reverse too - dangerous actions with no confirmation.
4. **Check hierarchy and consistency.** Is the primary action obvious on each screen? Does visual
   weight match importance? Are patterns, labels, and components consistent across screens and with
   platform conventions?
5. **Check responsiveness and adaptation.** Walk the task at a narrow (phone) and a wide viewport. Flag
   horizontal scrolling, clipped or overlapping content, tap targets too small or too close, primary
   actions pushed off-screen, and anything that assumes hover or a pointer. Breakage on small screens is
   a finding, often high severity.
6. **Fold in an accessibility pass.** Run the `design-accessibility` design-stage checklist (contrast,
   target size, focus order, alternatives, color-alone, labels). Accessibility issues are findings,
   often high severity.
7. **Rate severity** for each finding (scale below): a function of frequency x impact x persistence.
8. **Output structured findings** with a concrete fix for each. No finding without a proposed fix.

## Nielsen's 10 usability heuristics

1. **Visibility of system status** - keep users informed with timely feedback.
2. **Match between system and the real world** - speak the user's language and concepts.
3. **User control and freedom** - clear exits, undo, redo; no dead ends.
4. **Consistency and standards** - same things look/behave the same; follow conventions.
5. **Error prevention** - prevent problems before they happen; confirm risky actions.
6. **Recognition rather than recall** - show options; do not make users remember.
7. **Flexibility and efficiency of use** - shortcuts for experts, simple path for novices.
8. **Aesthetic and minimalist design** - no irrelevant content competing for attention.
9. **Help users recognize, diagnose, and recover from errors** - plain-language errors, a way out.
10. **Help and documentation** - findable, task-focused help when needed.

## Severity rating

- **0 Not a problem** - cosmetic preference only.
- **1 Cosmetic** - fix if time allows.
- **2 Minor** - low priority; small friction.
- **3 Major** - important to fix; blocks or frustrates many users.
- **4 Catastrophic** - must fix before release; blocks the task or excludes users.

## Findings output structure

```text
# Design review - <surface>
For each finding:
- Location      - screen/step/element
- Heuristic / category (incl. accessibility)
- Issue         - what is wrong and why it hurts the user
- Severity      - 0-4
- Fix           - concrete, specific recommendation
Sort by severity, highest first. End with top 3 priorities.
```

## Gotchas

- Walk the real task path, not a screen tour - and judge against the goal, not taste (`review-principles`).
- Do not skip the accessibility pass - those are real defects, frequently severity 3-4.
- Walk the task at phone width, not just desktop - small-screen breakage is a common, high-severity miss.
