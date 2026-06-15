---
name: qa-explore
description: Exploratory and manual testing to find what automation misses - session charters, bug-hunting heuristics, every state and edge case. Use when probing a build by hand for defects before sign-off.
---

# Exploratory testing

Structured manual probing to find defects the automated suite never anticipated. Time-boxed, charter-driven, and recorded - not aimless clicking. The mindset is to break it, not to confirm it works.

Use when hands-on bug-hunting a build or feature. For writing automated tests see `qa-test`; for the formal sign-off and bug reports see `qa-review`.

## Steps

1. **Charter each session.** State a goal ("explore <area> to discover <risk>"), a time-box (~60-90 min), and scope. A charter makes exploration systematic and reviewable.
2. **Work heuristics and tours.** Probe boundaries (min/max/zero/empty/huge), CRUD round-trips, interruptions (cancel, back, refresh, double-submit, kill the network mid-action), data variety (unicode, RTL, very long, injection-looking), and sequencing. "Tour" by feature, by data, and by user role.
3. **Force every state.** Empty, loading, error, permission/logged-out, offline, slow network, and edge inputs - the same states `design-draft` specifies. Most defects live here, not on the happy path.
4. **Use oracles.** A bug is a violation of a credible expectation: the acceptance criteria/spec, internal consistency, comparable products, or plain reasonableness. Name the oracle you violated.
5. **Record as you go.** What you did, what you saw, and exact repro steps; capture it while fresh. Log new questions as follow-up charters.
6. **Vary the angle.** Different users, devices, viewports, inputs, and timing; chase the surprising result, not the scripted path.

## Gotchas

- Confirmation bias finds fewer bugs: trying to prove it works beats nothing; trying to break it beats everything.
- Happy-path-only misses most defects - errors, edges, and interruptions are where they hide.
- An unrecorded bug is nearly worthless; if you cannot repro it later, it cannot be fixed.
- Exploratory is not unstructured - without a charter and heuristics it is just clicking around.
- Found bugs are an input to `qa-review`, not the sign-off itself; hand them over with repro and severity.
