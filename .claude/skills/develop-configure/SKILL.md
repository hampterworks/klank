---
name: develop-configure
description: Configures a project's type checker and build for strictness, correct module resolution, and fast builds. Loads a stack reference (e.g. typescript). Use when creating or tuning toolchain config.
argument-hint: <stack>
---

# Configuring the toolchain for strictness and correct builds

Turn the type checker to its strictest setting. Match module and output format to how the code runs. Add incremental or cached builds only when the repo is big enough to need them. Follow `dev-principles`: reach for the toolchain's built-in flags first; add extra tooling only when a real need appears.

Use when bootstrapping a project or tightening compiler/checker options. For writing the code see `develop-write`; for migrating an existing config to stricter settings see `develop-maintain`; for packaging a library see `develop-publish`.

## Stack guidance

Load `references/typescript.md` for the target language's concrete syntax (add more stacks as reference files); with no file for the user's language, apply the guidance below and say so.

## Principles

1. **Start at maximum strictness, then loosen only with cause.** Enable every strictness/correctness check the checker offers (null-safety, no-implicit-any-equivalent, unchecked-index, exhaustiveness). It is far cheaper to start strict than to retrofit; new projects have zero migration cost.
2. **Never disable a strictness flag to silence one site.** Fix or locally annotate the one site; a globally relaxed flag hides every other instance forever.
3. **Match module + output to the runtime.** Pick the module system, resolution mode, and target/output level from how the code is loaded and run (direct runtime vs bundler vs published library), not from habit. A mismatch surfaces as runtime "module not found" or wrong-format errors that the build never caught.
4. **Emit what consumers need, nothing more.** Libraries emit type declarations and source maps; app-only code consumed by a bundler often needs neither. See `develop-publish` for the full library story.
5. **Scope inputs explicitly.** Keep tests, generated output, and tooling files out of the build's input set; use a separate config that extends the base for test type-checking when needed.
6. **Add build performance only when measured.** Incremental caches and project/workspace references pay off on medium-plus repos and cost complexity on small ones. Turn them on when builds are slow, not preemptively.

## Gotchas

- Strictness flags are correctness nudges, not bugs: an error after enabling one is usually a latent bug the looser setting hid.
- `target`/language-level and lib settings change which features type-check, but they do not polyfill - match them to the lowest runtime you support.
- A separate "strict for me, loose for consumers" resolution mode (e.g. bundler resolution in a published lib) hides bugs your consumers will hit; validate the real artifact, not just the local build.
- Mixing a plain build entry point with an orchestrated/incremental one confuses the build cache; pick one entry point per build.
