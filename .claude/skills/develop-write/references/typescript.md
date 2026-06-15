# TypeScript stack reference - authoring

Concrete patterns for `develop-write` in TypeScript. The compiler is the proof engine: model state precisely, narrow instead of cast, ban the escape hatches.

## Core rules

- Prefer `unknown` over `any`. `any` disables checking and spreads silently; `unknown` forces a narrow before use.
- Avoid the non-null assertion `!` and `as` casts. Each is an unchecked claim; narrow or validate instead.
- Make illegal states unrepresentable. A union of valid shapes beats a wide object with optional fields and runtime guards.
- Infer, do not annotate, when the inferred type is correct and readable. Annotate function parameters, public return types, and module boundaries.

## Patterns

1. **Discriminated unions** for variant data and state machines. Give each member a shared literal `kind`/`type` tag, then switch on it.

   ```ts
   type Result<T> =
     | { kind: "ok"; value: T }
     | { kind: "err"; error: Error };
   ```

2. **`satisfies`** to validate a literal against a type while keeping its narrow inferred type. Use it instead of a type annotation when the precise literal types matter (keys, const maps, config).

   ```ts
   const routes = {
     home: "/",
     user: "/user/:id",
   } satisfies Record<string, string>; // keys stay literal, values checked
   ```

3. **`as const`** to freeze literals into the narrowest type; pairs well with `satisfies` and with deriving unions via `typeof x[number]`.
4. **Type predicates** (`x is T`) for reusable narrowing; **assertion functions** (`asserts x is T`) when a failed check should throw.

   ```ts
   function isString(x: unknown): x is string {
     return typeof x === "string";
   }
   ```

5. **Exhaustiveness checks** with `never`. A `default` (or final `else`) that assigns to `never` turns a missed union member into a compile error.

   ```ts
   function area(s: Shape): number {
     switch (s.kind) {
       case "circle": return Math.PI * s.r ** 2;
       case "square": return s.side ** 2;
       default: { const _x: never = s; throw new Error(`unhandled: ${_x}`); }
     }
   }
   ```

6. **Branded (opaque) types** for nominal distinctions the structural system would otherwise merge - `UserId` vs `OrderId`, validated `Email`, units. Construct only through a validating factory.

   ```ts
   type Brand<T, B> = T & { readonly __brand: B };
   type UserId = Brand<string, "UserId">;
   const asUserId = (s: string): UserId => s as UserId; // single trusted cast site
   ```

7. **Generics** for reusable, relationship-preserving code. Constrain with `extends`; let inference fill type arguments; avoid generics that appear in only one position (a plain type is clearer).
8. **Utility & derived types** instead of restating shapes: `Pick`, `Omit`, `Partial`, `Required`, `Readonly`, `ReturnType`, `Awaited`, `Parameters`. Derive from one source of truth.
9. **Mapped + template-literal + conditional types** for typed transforms and key derivation - event maps (`on${Capitalize<K>}`), `Record`-style tables, recursive `DeepReadonly`. Keep them shallow and named; deep type gymnastics hurt readability and build time.

## Validation at boundaries

- Data crossing a runtime boundary (network, disk, env, `JSON.parse`) is `unknown`. Validate it before trusting its type.
- Prefer a small schema validator (e.g. Zod, Valibot) or hand-written type predicates over blind casts. Per `dev-principles`, do not add a dependency for a single boundary a predicate already covers.

## Gotchas

- `satisfies` checks but does not widen - the variable keeps its literal type. Use `: T` when you actually want the wider type.
- A branded type still needs one `as` at the factory; keep that the only cast and validate inside it.
- `useUnknownInCatchVariables` (on under `strict`) makes `catch (e)` give `unknown` - narrow before accessing `.message`.
- Excess-property checks fire only on fresh object literals; assigning through a variable skips them, so `satisfies` on the literal is what catches typos.
- Overusing conditional/mapped types tanks editor responsiveness and build speed; reach for a named helper or a plain union first.
- `enum` has runtime and module-interop quirks; prefer `as const` object maps plus a derived union (or `const enum` only with `isolatedModules` caveats in mind).

## Sources

- <https://www.typescriptlang.org/docs/handbook/2/narrowing.html>
