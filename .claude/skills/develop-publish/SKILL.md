---
name: develop-publish
description: Ships a library so types and entry points resolve for every consumer, validated before release. Loads a stack reference (e.g. typescript). Use when packaging for publish or debugging resolution.
argument-hint: <stack>
---

# Publishing a library

Ship a package whose entry points and types resolve correctly for every consumer and shape, and validate that shape before it reaches the registry. Follow `dev-principles`: the toolchain's own emit over an added bundler unless you genuinely need multi-format output.

Use when preparing a package for publish or debugging a consumer's resolution errors. For the compiler/build options behind emit see `develop-configure`; for the code itself see `develop-write`.

## Stack guidance

Load `references/typescript.md` for the target language's concrete syntax (add more stacks as reference files); with no file for the user's language, apply the guidance below and say so.

## Principles

1. **Decide the output format(s) first.** Single modern format is the simplest correct package; support a legacy/second format only if consumers genuinely need it. Most packaging breakage lives in multi-format support, so do not add it speculatively.
2. **Declare entry points explicitly.** The manifest's entry-point map is authoritative for modern resolvers: name each public entry, point types and runtime at matching files, and order conditions so types resolve first. Never rely on consumers reaching into internal output paths.
3. **Ship types beside code, per format.** Each format needs its own matching type-declaration file; a single declaration shared across formats resolves wrong for some consumers.
4. **Whitelist what ships.** Publish only built output; keep source, configs, and tooling out of the tarball. Mark the package side-effect-free (or list the exceptions) so consumers can tree-shake.
5. **Validate the real artifact before publishing.** "Compiles locally" is not "resolves for consumers." Run the ecosystem's package linter and a type-resolution simulator, and smoke-test by installing the packed tarball from a throwaway project in each format. Wire these into a pre-publish gate so a broken package cannot ship.
6. **Publish with provenance** where the registry supports it, from CI.

## Gotchas

- Condition order in the entry-point map is significant: types first, then the runtime conditions. A misordered map makes types silently fail to resolve for some consumers.
- A type-declaration file shared across two output formats is a "masquerade" that resolution simulators flag - emit one per format.
- A "strict for me, loose for consumers" resolution mode in your own build hides bugs your consumers hit; validate under the consumer resolution modes, not just your local build.
- Forgetting to expose the manifest file itself in the entry-point map breaks tools that read it.
- Skipping the package linter and type-resolution simulator is the top source of reported breakage; they catch the gap between local build and consumer resolution.
