# TypeScript stack reference - publishing

Concrete npm packaging for `develop-publish` in TypeScript. Make types resolve for ESM, CJS, and bundler consumers; validate before publish.

## Decide the output format first

1. **ESM-only** is the simplest correct package in 2025 and the default recommendation for new libraries. Ship ESM + `.d.ts` with plain `tsc`; no bundler needed.
2. **Dual ESM + CJS** only if consumers genuinely need `require`. This is where most breakage lives: since TS 5.0, `.d.ts` files are context-sensitive, so dual packages need a separate declaration file per format (`.d.ts` for ESM, `.d.cts` for CJS).
3. Avoid `default` exports in dual packages - ESM and CJS interop them differently and confuse consumers.

## package.json exports map

Order matters - `types` must come first in each condition, and `import`/`require` must point at matching JS:

```jsonc
{
  "name": "my-lib",
  "type": "module",
  "exports": {
    ".": {
      "import": { "types": "./dist/index.d.ts", "default": "./dist/index.js" },
      "require": { "types": "./dist/index.d.cts", "default": "./dist/index.cjs" }
    },
    "./package.json": "./package.json"
  },
  "files": ["dist"],
  "sideEffects": false
}
```

- ESM-only: drop the `require` branch and keep a single `import` condition (or a top-level `types` + `default`).
- Keep legacy `"main"`, `"module"`, and top-level `"types"` only as fallbacks for old tooling; `exports` is authoritative for modern resolvers.
- Export subpaths explicitly (`"./feature": ...`); never rely on deep imports into `dist`.

## Build

1. **`tsc`-only (preferred, ESM-only):** emit JS + declarations with `declaration: true`, `declarationMap: true`, `sourceMap: true`, `outDir: dist`. One command, no extra dependency. See `develop-configure` for the compiler block.
2. **Bundler (tsup/tsdown) only when** you need dual CJS output, bundling/tree-shaking into few files, or multiple entry points. tsup wraps esbuild and emits both formats plus declarations. Justify the dependency per `dev-principles`.
3. Match emitted declaration extensions to JS: `.d.ts` beside `.js`, `.d.cts` beside `.cjs`.
4. Build clean from `dist`; never publish source `.ts` as the entry.

## Validate before publishing

Run both, ideally in CI:

1. **`publint`** - audits the package.json itself: `exports` correctness, condition order, `files`, missing/extra fields, deprecated keys. Run `npx publint` (or `npx publint --pack`).
2. **`@arethetypeswrong/cli` (attw)** - simulates how each module system resolves your *types* and flags mismatches (masquerading ESM/CJS, missing `types` condition, wrong extension, no types found). Run `npx attw --pack .`.
3. **Smoke-test resolution** by `npm pack`, then import the tarball from a throwaway ESM project and (if dual) a CJS one.

## Publish hygiene

- Whitelist with `"files": ["dist"]` (plus an `.npmignore` fallback) so source and config stay out of the tarball.
- Set `"sideEffects": false` (or list the few files with side effects) to enable consumer tree-shaking.
- Wire `prepublishOnly` to run build + `publint` + `attw` so a broken package cannot be published.
- Publish with provenance (`npm publish --provenance` in CI) when on a supported registry.

## Gotchas

- Condition order in `exports` is significant: `types` first, then `import`/`require`/`default`. A misordered map makes types silently fail to resolve for some consumers.
- A single `.d.ts` shared across `import` and `require` is wrong for dual packages since TS 5.0 - attw flags it as a masquerade.
- `"type": "module"` makes every `.js` in the package ESM; CJS output must use the `.cjs` extension (and `.d.cts` types).
- `moduleResolution: "Bundler"` in your own tsconfig hides resolution bugs your consumers will hit; validate the published artifact with attw under node10/node16/bundler, not just your local build.
- "Compiles locally" is not "resolves for consumers" - publint and attw catch the gap; skipping them is the top source of reported breakage.
- Forgetting `"./package.json"` in `exports` breaks tools that read it (some bundlers, postinstall scripts).

## Sources

- <https://publint.dev/rules>
- <https://arethetypeswrong.github.io/>
