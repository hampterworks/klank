---
name: develop-review
description: Reviews source code or a diff - correctness, least-code, type-safety, security, test adequacy - as severity-rated findings with fixes. Loads a stack reference (e.g. typescript). Use for code review.
argument-hint: <stack>
---

# Reviewing source code

Critique a diff for defects and least-code; output prioritized findings with concrete fixes. Apply `review-principles` (the shared critique rules) and `dev-principles` (the simplest correct change wins). Pairs with `develop-write` the way `design-review` pairs with `design-draft`.

Use for code review of a PR or change. For verifying behavior against acceptance criteria see `qa-review`; for applying cleanups see `develop-clean`; for critiquing a UI/design see `design-review`.

## Stack guidance

Load `references/typescript.md` for the target language's review checklist (add more stacks as reference files); with no file for the user's language, apply the steps below and say so.

## Steps

1. **Frame the review.** Understand the change's intent and scope from the description and diff, and run the build and tests before opining - the real bugs do not show in a static read.
2. **Correctness first.** Logic errors, off-by-one, null/empty/boundary handling, error paths, concurrency and races, resource leaks. These are the highest-value findings.
3. **Least-code and reuse.** Is there a simpler form, an existing helper to compose, or code to delete? Flag added complexity, abstractions, or dependencies that do not earn their place (`dev-principles`).
4. **Safety rail (lazy, not negligent).** Escape hatches (`any`-equivalents, unchecked casts, force-unwraps), unvalidated input at trust boundaries, missing error handling, and security - injection, secrets in code, broken authz (`security-principles`). Never wave these through for brevity.
5. **Tests.** Does the change pin the new behavior and its edges with tests? Missing or weak tests are a finding (hand to `qa-test`).
6. **Readability, at the right altitude.** Naming, cohesion, comments that explain why. Separate must-fix from preference; lean on the formatter/linter for style, and do not block on taste.
7. **Output severity-rated findings,** each with a concrete fix and a reason tied to a real cost. Sort by severity; no finding without a fix.

## Severity

`0` taste/preference, `1` minor, `2` should-fix, `3` must-fix (bug or risk), `4` blocker (broken or unsafe). Call out the top few.

## Gotchas

- If a diff is too large to hold in your head, ask to split it rather than rubber-stamp it.
- Review is critique only; hand fixes back to the author or apply them via `develop-clean` - do not silently rewrite.
