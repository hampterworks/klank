# TypeScript stack reference - cleanup

Concrete, mostly behavior-preserving TypeScript cleanups for `develop-clean`. Apply within the chosen intensity and latitude; keep the type-checker and tests green after each batch.

## light (in place, zero risk)

- Remove dead code, unused imports, unreachable branches, and unused exports (find with `knip` or `ts-prune`; confirm before deleting a public export).
- Delete redundant type annotations where inference is identical and readable; drop `as` casts that are now provably unnecessary.
- Replace `x !== null && x !== undefined` chains with `?.` / `??`; collapse trivial ternaries and double negations.

## standard (simplify + tighten types)

- Replace `any` with `unknown` + a narrow, or the real type; remove non-null `!` by narrowing or validating.
- Derive types from one source of truth (`Pick`/`Omit`/`ReturnType`/`Parameters`) instead of restating shapes.
- Turn a wide object + runtime guards into a discriminated union where it makes illegal states unrepresentable; add a `never` exhaustiveness check to switches.
- Deduplicate copy-pasted logic into a small named helper; replace a hand-rolled utility with a stdlib or already-imported one.
- `as const` for literal tables; `enum` -> `as const` map + derived union where interop matters.

## exhaustive (every smell)

- Naming: intention-revealing names; kill abbreviations and misleading names.
- Tighten `tsconfig`-adjacent debt: add `readonly`, handle `noUncheckedIndexedAccess` access, narrow `catch (e: unknown)`.
- Comments: delete the ones that restate code; keep/add the ones that explain why.
- Break long functions into cohesive units (latitude `safe`+); colocate related code.

## What stays behind a latitude gate

- Renaming or changing an exported symbol, moving files, or splitting modules - `safe` or `free` only.
- Changing a public signature/return type, removing a dependency, or restructuring an API - `free` only, with tests updated and the change noted.

## Verify

- `tsc --noEmit` (strict) and the test suite green after each batch; `eslint` clean. A cleanup that needed a new `eslint-disable` or a loosened flag is not behavior-preserving - revert it.
- `attw`/`publint` if the package is published and the cleanup touched `exports`/types (see `develop-publish`).

## Gotchas

- `as const` and narrowing can change inferred types that other code depends on; let `tsc` catch the ripples before committing.
- Removing an "unused" export can break an external consumer; for a library, treat exports as API (latitude `free`).
