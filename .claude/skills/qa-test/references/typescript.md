# TypeScript stack reference - test authoring

Concrete `vitest` (or Jest-compatible) practice for `qa-test` in TypeScript. Fast, deterministic, behavior-focused tests.

## Runner and layout

- **Vitest** is the default for TS/ESM (Vite-native, fast, Jest-compatible API). Co-locate unit tests as `*.test.ts` beside the source or under `test/`; keep slow integration/e2e in a separate project or `*.int.test.ts` so the unit layer stays fast.
- Type-check tests too (they are real TS); `expectTypeOf`/`assertType` cover type-level contracts for libraries.

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

describe("parseAmount", () => {
  it("rejects a negative value", () => {
    expect(() => parseAmount(-1)).toThrow(/non-negative/);
  });
});
```

## Determinism

- **Time:** `vi.useFakeTimers()` + `vi.setSystemTime(new Date("2026-01-01"))`; advance with `vi.advanceTimersByTimeAsync`. Never assert on `Date.now()` directly.
- **Randomness:** inject the RNG or `vi.spyOn(Math, "random")`; do not test against live entropy.
- **Modules/IO:** `vi.mock("node:fs")` or inject the dependency; fake the network at the boundary (e.g. MSW) rather than mocking your own fetch wrapper.
- Reset state between tests: `beforeEach(() => vi.clearAllMocks())`; avoid shared mutable module state that creates order-dependence.

## Assertions and doubles

- Prefer specific matchers (`toEqual`, `toMatchObject`, `toThrowError`) over `toBeTruthy`; assert the value, not that something ran.
- `vi.fn()` for spies; assert on observable effects, not `toHaveBeenCalledTimes` of an internal helper (that tests structure).
- For async, `await expect(p).resolves/.rejects`; never leave a floating promise.

## Coverage and CI

- `vitest run --coverage` (v8 provider). Track coverage as a trend/signal, not a hard gate that invites assertion-free tests.
- Tests must pass under `tsc --noEmit` strict settings (see `develop-configure`); a test that only compiles because of `any` is a gap.

## Gotchas

- `vi.mock` is hoisted above imports; reference factory-scoped values via `vi.hoisted`, not outer consts.
- Fake timers freeze `Promise` microtasks differently from macrotasks; use the async timer advances and `await` flushes.
- Snapshot tests rot into rubber-stamps; snapshot small, stable, intentional output only.
- `--coverage` instruments everything; exclude generated/`dist` so the number reflects real code.
