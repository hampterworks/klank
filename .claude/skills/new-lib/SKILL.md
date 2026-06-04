---
name: new-lib
description: Scaffolds a new NX library with correct Vite + Vitest config and @klank/* path alias. Use when adding a new shared library to libs/.
---

# new-lib

## When to use

- When a new domain area needs its own lib with a clean package boundary
- When shared utilities have outgrown a single file

## Procedure

1. Generate a React lib: `pnpm nx g @nx/react:lib <name> --directory=libs/<name> --unitTestRunner=vitest`
   For a non-React utility lib: `pnpm nx g @nx/js:lib <name> --directory=libs/<name> --unitTestRunner=vitest`
2. Add the path alias to `tsconfig.base.json §paths`: `"@klank/<name>": ["libs/<name>/src/index.ts"]`
3. Verify `libs/<name>/src/index.ts` exists as the named barrel file.
4. Run `build` to confirm the project reference graph is valid.
5. Register the lib in `AGENTS.md §Project Structure`.
6. Ensure the generated `index.ts` uses named exports only — remove any `export default` the generator added.

## Failure modes

- **Missing path alias** → TypeScript `Cannot find module '@klank/<name>'` errors; add the alias to `tsconfig.base.json §paths`.
- **Generator created `export default`** → replace with named exports throughout `libs/<name>/src/`.
- **Lib not picked up by NX** → check `pnpm-workspace.yaml` includes `libs/*` and `nx.json` plugin config covers the new lib type.
