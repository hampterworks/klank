---
id: doc-principles
title: Documentation principles (Diataxis)
scope: path
applyTo: ["docs/**", "README.md"]
agents: [all]
priority: 21
---

Human-facing documentation (the `docs/` tree, READMEs, in-app tutorials and how-tos) follows
**Diataxis**: every page is exactly one of four modes, never mixed, because each serves a different need.

- **Tutorial** - a guided lesson that takes a newcomer through doing something (learning-oriented).
- **How-to** - numbered steps that accomplish one real task for someone who already knows the basics
  (task-oriented).
- **Reference** - precise, exhaustive, lookup-oriented facts; describe, do not teach (information-oriented).
- **Explanation** - the why, the context, the trade-offs (understanding-oriented).

Diataxis is for **humans**. Agent-facing content (skills, instructions, subagents) is self-contained and
stays out of `docs/`; never link agent context into the `docs/` tree.
