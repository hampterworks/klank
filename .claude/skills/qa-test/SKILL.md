---
name: qa-test
description: Writes an effective automated test suite - testing pyramid, behavior over implementation, deterministic tests. Loads a stack reference (e.g. typescript). Use when adding or improving tests.
argument-hint: <stack>
---

# Writing an automated test suite

Build a fast, trustworthy safety net that tests behavior, not implementation, and fails for exactly one reason. Apply `test-principles` (the testing philosophy) and `dev-principles` (the least test code that pins the behavior).

Use when writing or restructuring tests. For hands-on bug-hunting see `qa-explore`; for verifying a change against acceptance criteria see `qa-review`; for reviewing the source itself see `develop-review`.

## Stack guidance

Load `references/typescript.md` for the target stack's test runner and idioms (add more stacks as reference files); with no file for the user's stack, apply the principles below and say so.

## Test design (beyond `test-principles`)

`test-principles` covers behavior-over-implementation, determinism, the pyramid/risk balance, property-based testing, and the regression-test-per-fix rule. In addition:

- **One reason to fail per test.** Arrange-act-assert; a name that states the expected behavior, so a failure names the cause.
- **Test the boundaries and every state.** Empty, error, permission, and edge inputs (zero/one/many, long, unicode) - not just the happy path.
- **Fake only at real seams.** Stub the clock, network, or filesystem; do not mock internal collaborators - over-mocking tests the mock and couples the test to the structure you want free to change.

## Gotchas

- Testing implementation details or private internals makes the suite brittle and blocks refactoring; test the public contract.
- A flaky test erodes trust in the whole suite - quarantine and fix it, do not add a retry loop.
- 100% coverage with assertions that never fail is theater; assert the behavior, not mere execution.
- Slow tests do not get run; keep the unit layer fast so the feedback loop stays tight.
- A test that changes whenever the code is refactored is testing structure, not behavior - move it down or rewrite it against the contract.
