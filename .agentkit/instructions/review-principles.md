---
id: review-principles
title: Review principles (critique with a fix)
scope: global
agents: [all]
priority: 25
---

When reviewing anything - code, a design, a test plan, agent content - critique to improve it, not to
display taste:

- **Critique against the goal, not taste.** Judge by the requirements and the user's cost; separate
  must-fix from preference, and let tooling own style.
- **Every finding gets a fix and a reason.** No complaint without a concrete proposed change tied to a real cost.
- **Rate severity and lead with it.** Sort findings by impact and call out the top few; an unranked list
  gets ignored.
- **Verify before you opine.** Walk the real path or run it first; a static read misses the defects that matter.
