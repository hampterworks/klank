---
name: run-tests
description: Runs Vitest tests across the workspace or for a specific lib. Use after any code change before committing.
---

# run-tests

## When to use

- After any code change to `libs/` or `apps/klank/app/`
- When adding new test coverage
- As part of a pre-commit verification pass

## Procedure

1. All libs and app: `pnpm nx run-many -t test`
2. Single lib by alias: `pnpm nx test @klank/platform-api` (or `@klank/ui`, `@klank/store`)
3. Watch mode for active development: `pnpm nx test @klank/platform-api --watch`
4. With coverage: `pnpm nx test @klank/platform-api --coverage`

## Failure modes

- **Stale Zustand localStorage in jsdom** → add `localStorage.clear()` to `beforeEach` in the failing test file.
- **React Testing Library `act()` warning** → wrap state-updating calls in `act(() => { ... })`.
- **Module resolution error** → check `tsconfig.base.json §paths` has the `@klank/*` alias for the lib under test.
- **Test passes locally but fails in CI** → check if the test relies on a browser API not available in jsdom; add a mock or use `vi.stubGlobal`.
