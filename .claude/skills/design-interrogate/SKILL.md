---
name: design-interrogate
description: Elicits requirements by questioning the user in exhaustive, batched rounds, then outputs a structured spec. Use when turning a vague feature idea or improvement item into a buildable spec.
---

# Interrogating to a spec

Pull a complete, unambiguous spec out of the user by adversarial, exhaustive questioning that
surfaces hidden assumptions. Ask in batched, mutually-exclusive questions across minimal rounds, then
output a structured spec that feeds `design-draft`.

Use when: a feature idea or improvement item is too vague to design - requirements must be elicited.
Works for both new feature specs and grooming existing improvement items. Not for designing screens
(`design-draft`) or critiquing a built UI (`design-review`).

Apply `design-principles`: probe for the smallest scope that solves the real problem; challenge every
step and option; push toward a strong default over a setting.

## Steps

1. **Restate the ask** in one line and reflect it back, including your read of the underlying problem.
   Misalignment surfaces fastest here.
2. **Interrogate in batched rounds.** Group questions by theme and ask many at once, not one at a
   time. Make options mutually exclusive (a/b/c) so answers are unambiguous. Target 1-3 rounds total;
   each round resolves the biggest remaining unknowns.
3. **Be adversarial about assumptions.** For every claim, ask "how do we know", "what about the user
   who...", "what happens when this fails / is empty / at scale". Probe scope edges, success metric,
   and the cost of doing nothing. Name assumptions explicitly so they can be confirmed or killed.
4. **Cover the full surface** (checklist below) - users, problem, goals, non-goals, scope, edge
   cases, constraints, success criteria. Note what stays unknown.
5. **Converge.** When further questions stop changing the answer, stop asking. Do not interrogate past
   diminishing returns.
6. **Output the structured spec** in the format below. Mark every unresolved item under Open questions
   rather than guessing.
7. **Propose recording durable principles.** When interrogation distills a durable, general principle
   (an architectural or product convention, a naming rule, a recurring decision), propose recording it
   in the right place - the project's shared conventions or principles doc (a design system, a product
   brief, or a shared instructions file). Only write it AFTER the user confirms; never record silently.

## Question checklist

- **Users** - who, primary vs secondary, their context, frequency, expertise.
- **Problem** - the real pain, current workaround, cost of not solving it.
- **Goals** - measurable outcome; what "done well" looks like.
- **Non-goals** - explicitly out of scope; what this is deliberately NOT.
- **Scope** - must-have vs nice-to-have; first version vs later.
- **Edge cases and states** - empty, error, permission, scale, offline, conflicting input.
- **Constraints** - technical, legal, brand, platform, timeline, dependencies.
- **Acceptance** - how to verify it works; concrete pass/fail conditions.

## Spec output structure

```text
# <Feature / item> spec
## Problem            - who, the pain, why now
## Goals              - measurable outcomes
## Non-goals          - explicitly out of scope
## Scope              - must-have vs later
## Requirements       - numbered, specific, testable
## Acceptance criteria - per requirement, concrete pass/fail
## Open questions     - unresolved, with owner if known
## Assumptions        - stated, to be validated
```

## Gotchas

- Batch questions; one-at-a-time interrogation wastes the user's rounds and patience.
- Make choices mutually exclusive - vague open questions get vague answers.
- Non-goals are as load-bearing as goals; an unstated boundary causes scope creep.
- Requirements must be testable. "Fast" and "easy" are not requirements; "under 2s" is.
- Surface assumptions explicitly - the spec's biggest risk is the question no one thought to ask.
- Record a durable principle only after explicit confirmation, and put it at the right tier.
