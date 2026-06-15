---
name: qa-review
description: Verifies a change meets its acceptance criteria and is safe to ship - regression, bug triage, ship/no-ship call. Use for QA sign-off on behavior, not source-code review (develop-review).
---

# QA review and sign-off

The quality gate between built and shipped. Verify behavior against the acceptance criteria, decide ship or no-ship, and report defects so they are actually fixable - applying `review-principles` (severity-rated, every finding with a fix). This closes the loop that `design-interrogate` (criteria) and the build phase opened.

Use for QA sign-off on a change or build. For writing the automated tests see `qa-test`; for hands-on bug-hunting see `qa-explore`; for critiquing the source code see `develop-review`.

## Steps

1. **Anchor on the acceptance criteria.** Pull them from the spec (`design-interrogate`). No criteria means stop and get them - you cannot verify against nothing, and "looks fine" is not sign-off.
2. **Verify each criterion explicitly.** Pass or fail, with evidence, walking the real user task rather than a feature tour. List unmet criteria as blocking.
3. **Regress by risk.** Re-check what this change could plausibly have broken (shared code, adjacent flows, data migrations), not the whole product. Confirm the automated suite is green and pull in `qa-explore` for the states and edges.
4. **Report each defect so it is actionable.** Exact repro steps, expected vs actual, environment/build, and a severity (below). No bug without a repro.
5. **Make the call.** Ship, ship-with-known-issues (list them), or no-ship - tied to severity and unmet criteria, not vibes. Record the decision and its rationale.

## Severity

- **0 Trivial** - cosmetic; fix when convenient.
- **1 Minor** - small friction, easy workaround.
- **2 Major** - blocks a non-critical path or frustrates many users; fix before release if feasible.
- **3 Critical** - blocks a core task, data loss risk, or security issue; no-ship.
- **4 Blocker** - broken build, unmet must-have criterion, or unsafe; no-ship, fix now.

## Gotchas

- Signing off without acceptance criteria is theater; verify against something concrete and written.
- Severity inflation erodes trust; reserve Critical/Blocker for genuine ship-stoppers.
- "Works on my machine" is not verification - state the build and environment you tested.
- Regression-testing everything wastes the window; target by risk and let the automated suite cover the rest.
- A defect without repro steps gets bounced back; spend the minute to capture them.
