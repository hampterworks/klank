# TypeScript stack reference - code review

Concrete TypeScript review checklist for `develop-review`. Read alongside the language-agnostic steps; these are the TS-specific things to flag.

## Type-safety

- `any` (explicit or implicit), `as` casts, non-null `!`, and `@ts-ignore` - each is an unchecked claim. Ask for `unknown` + narrowing, a validator, or a real type. `@ts-expect-error` with a reason is acceptable; bare `@ts-ignore` is not.
- Boundary data (network, `JSON.parse`, env, disk) typed as a trusted shape without runtime validation - flag it; types do not check bytes.
- A `switch`/union with no exhaustiveness check (`never` default) - adding a variant will silently skip it.
- Wide types where a literal/union would make illegal states unrepresentable (e.g. `status: string` instead of `"open" | "closed"`).
- `enum` where an `as const` map + derived union is simpler and interop-safe.

## Correctness and API

- Public/exported API: stable names, precise return types annotated, no accidental `any` leaking through inference at the boundary.
- `Promise` handling: floating promises (missing `await`), `Promise.all` vs sequential, unhandled rejection paths.
- `readonly`/immutability where mutation would surprise; array index access without `noUncheckedIndexedAccess` awareness.

## Least-code (TS-flavored)

- Hand-rolled types that `Pick`/`Omit`/`ReturnType`/`Parameters` already derive from one source of truth.
- A dependency added for something the stdlib or an existing util covers; a `class` where a function and a type suffice.
- Deep conditional/mapped type gymnastics where a named helper or plain union reads better and compiles faster.

## Tests and tooling

- New behavior without a `*.test.ts` pinning it and its edges (see `qa-test`).
- Does it still pass under the project's strict `tsconfig` (see `develop-configure`) - or did strictness get loosened to make it compile?
- `eslint`/`tsc --noEmit` clean; no new `eslint-disable` without a reason.

## Gotchas

- "Compiles" is not "correct": inference can hide an `any` flowing from an untyped boundary. Trace where external data enters.
- A green build with a loosened flag is a regression, not a pass - check the diff did not weaken `tsconfig`.
