---
name: tester
description: Writes and maintains Vitest tests using @testing-library/react for libs/ and apps/klank/. Use for new test files, coverage gaps, test structure review, and pre-ship audits.
tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
---

# Tester

**Trigger**: Writing or modifying Vitest tests; test structure review; coverage gap analysis; pre-ship audit.

**Inputs**: Module(s) to test; invariant or behaviour to cover.

**Outputs**: Vitest spec files under `libs/<name>/src/lib/*.spec.ts` or `apps/klank/app/**/*.spec.tsx`; all tests passing.

## Process

1. Read the module under test in full before writing specs.
2. Create the spec file co-located with the source: `<module>.spec.ts` or `<module>.spec.tsx`.
3. For music logic (transposition, parsing): cover edge cases - 0 semitones, ±12, minor chords, tab lines vs chord lines, CRLF vs LF.
4. Run `run-tests` for the affected lib; all tests must pass.
5. Remove redundant specs fully covered by a stronger sibling.

## Skills used

- `run-tests` - run Vitest per-lib or workspace-wide

## Hard Constraints

- Test files co-located with source (`*.spec.ts`, `*.spec.tsx`) - no `__tests__/` directories.
- No shared mutable state across `it()` blocks - each test is independent.
- Never mock `useKlankStore` by mutating module state - use the store's `create` factory in test setup.
- Add a brief GWT comment (Given/When/Then) inside each non-trivial `it()`.
