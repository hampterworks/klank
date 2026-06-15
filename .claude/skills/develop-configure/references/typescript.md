# TypeScript stack reference - config

Concrete `tsconfig` setup for `develop-configure`. Start strict, pick resolution by runtime, add build perf only when the repo needs it.

## Baseline (ESM, Node, no bundler)

This mirrors the agentkit package in this repo - NodeNext ESM with `.js` extensions on relative imports:

```jsonc
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "dist",
    "rootDir": "src"
  }
}
```

## Steps

1. **Turn on `strict: true`.** It bundles `noImplicitAny`, `strictNullChecks`, `strictFunctionTypes`, `strictBindCallApply`, `strictPropertyInitialization`, `alwaysStrict`, `noImplicitThis`, and `useUnknownInCatchVariables`. Never disable the sub-flags individually.
2. **Add the extra strict flags** (not covered by `strict`):
   - `noUncheckedIndexedAccess` - index access (`arr[i]`, `record[key]`) yields `T | undefined`, forcing a presence check. Highest-value extra flag.
   - `exactOptionalPropertyTypes` - distinguishes "absent" from "set to `undefined`"; matches real JS semantics.
   - `noImplicitOverride` - requires the `override` keyword when overriding a base method, catching drift on rename.
   - `noFallthroughCasesInSwitch` - errors on a non-empty `case` that falls through.
3. **Pick module + resolution by runtime:**
   - `NodeNext` (module and moduleResolution) for code Node runs directly or libraries published to npm. Honors `package.json` `"type"` and `exports`; requires `.js` extensions on relative imports in ESM.
   - `Bundler` (with `module: ESNext`/`Preserve`) only when a bundler (Vite, esbuild, webpack) resolves and emits; allows extensionless imports. Do not use for code Node runs unbundled.
4. **Set `verbatimModuleSyntax: true`.** Forces explicit `import type` / `export type` and leaves runtime imports verbatim, so emit is predictable and type-only imports get erased. Under NodeNext it also flags wrong ESM/CJS import syntax.
5. **Set `isolatedModules: true`** so each file transpiles independently - mandatory if any tool (esbuild, SWC, Babel, ts-jest isolated) compiles file-by-file. Cheap insurance; keep it on.
6. **Emit settings for libraries:** `declaration: true` plus `declarationMap: true` (lets consumers go-to-definition into your source) and `sourceMap: true`. For app-only code that a bundler consumes, declarations may be unnecessary. See `develop-publish` for the full library story.
7. **Scope inputs** with `include`/`exclude` (or `files`). Keep tests and `dist` out of the build `tsconfig`; use a separate `tsconfig` extending the base for test type-checking if needed.

## Build performance

- **`incremental: true`** writes a `.tsbuildinfo` cache so rebuilds only recheck what changed. Free win for any non-trivial project.
- **Project references** for monorepos/multi-package builds: set `composite: true` on each leaf (implies `declaration` + `incremental`), list dependencies under `"references"`, and build the graph with `tsc -b` (`tsc --build`). Reported incremental builds drop 60-75% on medium-plus repos.
- **`isolatedDeclarations: true`** (TS 5.5+) requires explicit types at exported boundaries so `.d.ts` can be emitted without full type-checking, enabling parallel declaration emit by external build tools. Adopt only if a tool consumes it; it adds annotation burden.
- Keep `skipLibCheck: true` to skip checking `node_modules` `.d.ts` - large, reliable speedup.

## Gotchas

- `verbatimModuleSyntax` + NodeNext will error on a runtime `import` of a type-only symbol; switch it to `import type`. This is the intended nudge, not a bug.
- `exactOptionalPropertyTypes` breaks code that explicitly assigns `undefined` to an optional prop; widen to `prop?: T | undefined` only where the value truly may be `undefined`.
- NodeNext ESM requires `.js` (not `.ts`) extensions on relative imports - the extension names the emitted file. A missing extension is a runtime `ERR_MODULE_NOT_FOUND`, not a compile error.
- `composite` forces `declaration: true`; you cannot keep declarations off on a referenced project.
- `tsc -b` is a build orchestrator, not the same as plain `tsc`; mixing them confuses the `.tsbuildinfo` cache. Pick one entry point per build.
- `target`/`lib` set language features and built-in typings only - they do not polyfill. Match them to the lowest runtime you support.

## Sources

- <https://www.typescriptlang.org/tsconfig/>
- <https://www.typescriptlang.org/docs/handbook/project-references.html>
