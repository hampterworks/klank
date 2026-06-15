---
name: agentkit-learn
description: Analyzes a human-agent transcript for where the agent setup (skills, instructions, routing, context) lost efficiency, then ships fixes. Use after a session to improve future runs; not a PR review.
---

# Learning from a session

Mine a finished human-agent session for where the **setup** (skills, instructions, descriptions/routing,
tools, context tiering, sub-agent orchestration) cost efficiency or effectiveness, then ship durable fixes so
future sessions run better. You improve the setup, not the model: the committed agent-content is the agent's
long-term memory. Method is error analysis (open-code, then axial-code into failure modes), root-caused to the
setup and locked behind evals.

Use when: a session/task just wrapped and you want to fold its lessons back into this repo. Not a PR-diff review
(`agentkit-review`), not eliciting a product spec (`design-interrogate`), not tidying one bloated file
(`agentkit-tighten`).

Apply `agentkit-authoring-principles`, `review-principles`.

## Steps

1. **Frame it (blameless, setup-focused).** The goal is a better setup for the next session, not judging the
   model; assume each actor used the best information available. Use the transcript as evidence, not memory.
2. **Open-code the trajectory.** Walk the session start to end; write a terse note on every friction moment AND
   on what worked (sustains), each tagged with a lever (below). Quote the turn as evidence.
3. **Axial-code into failure modes.** Cluster the notes into a small taxonomy. Seed it with the common agentic
   modes - routing/spec, context-efficiency, orchestration, verification, interaction - but let the real
   categories emerge; iterate until new turns reveal no new mode (saturation).
4. **Root-cause to the setup (5 Whys).** Per cluster, ask "why" until the cause is a fixable, systemic property
   of the agent-content (a vague description, missing or contradictory instruction, untiered context, an absent
   skill/tool), not the model or a one-off. Demand transcript evidence; ask what would disprove it. Stop where a
   concrete change prevents recurrence.
5. **Interrogate to confirm and prioritize.** Put the clusters, root causes, and candidate changes to the user
   in batched, mutually-exclusive choices (confirm/refute, severity, desired fix). Prioritize by frequency x
   cost; seek counter-examples. Never fix one at a time; never promote a single odd turn to a pattern.
6. **Map each learning to its durable home (reuse before add).** Prefer, in order: a deterministic rule in
   `src/rules.ts` (when the smell is structural and lintable) > a principle instruction (global, or path-scoped
   via `applyTo`) > a tweak to an existing skill's description/router/body/`Gotcha` or a tool > a new
   skill/command. Grep the instructions first - never duplicate (verify-first already lives in
   `review-principles`). Spend the smallest high-signal change: tighten a description or tiering before adding
   words; a description should read like onboarding a teammate. Drop harness/operator habits - they are not
   repo content.
7. **Implement, lock with evals, schedule a check-back.** Edit `.agentkit/` (or `src/`), run `pnpm generate`
   then `pnpm validate`/`verify`. For any routing or behavior fix, ship a golden + promptfoo case under
   `evals/` that would have caught it (error analysis precedes evals - it is the regression net). Note a
   check-back to confirm future sessions improved, and revert a change that only adds noise.

## Levers

Scan each for both friction and sustains:

- **Routing / triggering** - did the right skill/command fire? mis-trigger, missed trigger, overlapping or
  vague descriptions.
- **Instruction / spec adherence** - repeated corrections, missing or contradictory guidance, bad ordering, a
  capability the agent had to improvise.
- **Context efficiency** - wasted or oversized context, re-reads, bloated tool output, redundant sub-agent
  dispatch, no just-in-time reference.
- **Orchestration** - delegate-and-also-do-it-yourself, misaligned sub-agent prompts, step repetition, lost
  history.
- **Verification** - false or unverified claims, fabricated facts, missed defects.
- **Interaction / scope** - requirements or hard constraints surfaced late, plan churn, deferral the user did
  not want.

## Output: Learnings to Changes

```text
# Session learnings - <date / topic>
## Scope          - which session/trajectory analyzed
## Open notes     - friction + sustains, lever-tagged, with quoted evidence
## Failure modes  - axial clusters, each with frequency x cost
## Root causes    - per mode: the systemic SETUP cause (5 Whys)
## Sustains       - what worked; keep / reinforce
## Confirmed      - modes the user accepted, with priority
## Changes        - per learning: home (rule|principle|skill|tool|new) | owner | exact edit | why-not-duplicate
## Evals to add   - golden + promptfoo per behavior/routing fix
## Dropped        - one-offs and harness/operator facts
## Check-back     - how/when to confirm future sessions improved
```

## Gotchas

- Blameless and setup-focused: the fix lives in context/skills/tools, not in "the model is weak" - that framing
  is what surfaces a fixable change.
- Open-code before clustering; let the modes emerge from the transcript and only then refine the seed taxonomy -
  do not rubber-stamp it.
- Stop at a systemic setup cause; a one-off prompt slip is not content.
- Prioritize by frequency x cost; do not gold-plate a rare annoyance.
- Reuse before add - context is finite, so sharpen a description or re-tier before adding words or a skill.
- Lock every routing or behavior fix with a golden + promptfoo eval, or it silently regresses.
- A lesson noted is not learned: each change needs an owner and a check-back, or it rots.
- A self-hosting agent-content repo must pass its own shipped skills (a CI edit checked against
  `cicd-harden`).
- Record a durable principle only after explicit user confirmation; never write it silently.
