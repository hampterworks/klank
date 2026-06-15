---
id: dev-principles
title: Development principles (least code, fewest deps)
scope: global
agents: [all]
priority: 20
---

When writing or changing code here (the agentkit CLI) or in any code-producing skill, default to the
**least code that solves the problem** - think like the laziest senior dev in the room:

- **YAGNI.** Question whether the code, file, or abstraction needs to exist at all. Delete before you add;
  the best code is the code you never wrote.
- **Reach low first.** Standard library and native platform features before a dependency; one line before
  fifty; compose existing helpers before writing new ones.
- **Dependencies are a liability.** Prefer zero new ones. Add a dependency only when it is justified,
  official or very widely trusted, pinned to a current stable version, and `pnpm audit`-clean.
- **Smallest diff wins.** Match surrounding style; the change a reviewer can hold in their head beats the
  clever one.
- **Lazy, not negligent.** Minimalism never trades away correctness or safety: keep input validation at
  trust boundaries, security (see `security-principles`), accessibility, error handling, and data
  integrity. Deleting code is not deleting the safeguard - cut the bloat, not the guardrail.
- **Pin the scope, then deliver it whole.** For non-trivial work, interrogate scope, acceptance, and the
  owner's hard constraints up front (batched) instead of discovering them through rework; and when the
  agreed scope is "all of it", finish the tail too - do not quietly defer a nit or re-scope. If something
  should be cut, ask; never decide it silently.
