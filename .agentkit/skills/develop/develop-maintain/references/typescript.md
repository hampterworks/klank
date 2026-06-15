# TypeScript stack reference - maintaining

Concrete upgrade and strict-migration steps for `develop-maintain` in TypeScript. Small, reviewable steps; one flag at a time.

## Upgrading the TypeScript version

1. Read the release notes between current and target versions; note breaking changes and new errors (each minor can surface new diagnostics under existing flags).
2. Bump `typescript` to an exact or caret-pinned version in devDependencies; pin in CI for reproducibility.
3. Run `tsc --noEmit` (or `tsc -b`) and triage new errors. Most are real bugs the newer checker now catches.
4. Update `@types/*` packages and lint/test tooling that embeds a TS version (ts-jest, eslint typescript parser, ts-node).
5. Adopt new flags deliberately as separate commits - do not bundle a version bump with new strictness.

## Migrating to strict, incrementally

1. **Measure first.** Enable each candidate flag alone (`strictNullChecks`, `noUncheckedIndexedAccess`, etc.) and run `tsc --noEmit` to count errors per flag. Zero/low-error flags go on immediately.
2. **Order by error count, ascending.** Land the cheap flags, then `noImplicitAny`, then `strictNullChecks` last - it usually surfaces the most and gives the most safety.
3. **Per flag:** enable, fix all errors, ensure `tsc --noEmit` is clean, commit. Keep diffs small and reviewable; one flag per PR on a big repo.
4. **Bound the blast radius** with `include`/`exclude` or split tsconfigs so strict applies to a subtree first, then widens. Avoid file-by-file plugins unless the repo is too large to flip a flag at once; they are extra tooling per `dev-principles`.
5. **Track residual debt** with `// @ts-expect-error <reason + ticket>` (never bare `// @ts-ignore`). `@ts-expect-error` errors out once the underlying issue is fixed, so it self-cleans; `@ts-ignore` rots silently.
6. **Gate in CI** with `tsc --noEmit` so a regression cannot reintroduce errors under the now-enabled flag.

## Eliminating any safely

1. Find them: `tsc` with `noImplicitAny` surfaces implicit ones; grep for explicit `: any`, `as any`, `<any>`, and `!` non-null assertions.
2. Replace `any` at boundaries with `unknown`, then narrow with type predicates or a schema validator before use (see `develop-write`).
3. Replace internal `any` with the real inferred or annotated type; let inference do the work where it can.
4. Turn `as` casts and `!` into validated narrowing. Where a cast is genuinely unavoidable (branded-type factory, well-known external shape), isolate it behind one small, named, commented function.
5. Optionally forbid regressions with lint rules (`no-explicit-any`, `no-non-null-assertion`) once the count hits zero.

## Handling deprecations and breaking changes

- When a flag or option is removed/renamed, update `tsconfig` and re-run `tsc --noEmit`; watch for options folded into others across major versions.
- After enabling `useUnknownInCatchVariables` (via `strict`), fix `catch (e)` sites to narrow `e` before reading `.message`.
- When moving to `verbatimModuleSyntax`, expect a wave of "must use import type" errors; fix mechanically by adding `type` to type-only imports.
- Treat each new compiler error after an upgrade as a likely latent bug, not noise to suppress.

## Gotchas

- Do not silence migration errors with `as any` or bare `@ts-ignore` - that converts a tracked task into permanent hidden debt. Use `@ts-expect-error` with a reason.
- Flipping `strict` globally on a big repo produces an unreviewable diff and stalls; incremental per-flag PRs land.
- `strictNullChecks` interacts with everything - enable it last so earlier fixes do not get redone.
- A version bump that "passes" only because errors were suppressed is not done; suppressions are debt, count them.
- `noUncheckedIndexedAccess` can flood loops with `T | undefined`; prefer `for...of`, `.entries()`, or a local presence check over re-asserting.

## Sources

- <https://www.typescriptlang.org/docs/handbook/release-notes/overview.html>
