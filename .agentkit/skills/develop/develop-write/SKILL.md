---
name: develop-write
description: Writes idiomatic, type-safe code - precise modeling, narrowing, boundary validation. Loads a stack reference (e.g. typescript). Use when writing or modifying source, not tidying (develop-clean).
argument-hint: <stack>
---

# Writing idiomatic, type-safe code

Write code the type checker can prove correct: model state so illegal combinations cannot be expressed, narrow values instead of asserting them, and ban the escape hatches that hide bugs. Follow `dev-principles` - the least code, leaning on built-in language features before reaching for libraries.

Use when authoring or refactoring source in any language. For toolchain and strictness setup see `develop-configure`; for migrating existing code to stricter types see `develop-maintain`; for packaging a library see `develop-publish`.

## Stack guidance

Load `references/typescript.md` for the target language's concrete syntax (add more stacks as reference files); with no file for the user's language, apply the guidance below and say so.

## Core principles

- **Make illegal states unrepresentable.** A sum / tagged-union / enum of valid shapes beats a wide record of optional fields plus runtime guards. If a combination must never occur, the type should forbid it.
- **Pick the most precise type; avoid escape hatches.** Every unchecked cast, force-unwrap, or `any`-equivalent is an unproven claim that spreads silently. Prefer an `unknown`-equivalent at the edge and narrow before use.
- **Narrow, do not assert.** Replace casts with checks the checker understands - tag switches, type predicates, validators. The compiler should follow your reasoning, not be told to trust it.
- **Infer where correct, annotate at boundaries.** Let inference carry local code; annotate parameters, public return types, and exported boundaries so APIs stay stable and errors land where the mistake is.
- **One source of truth per type.** Derive related types from a base (utility / derived types, generics) instead of restating shapes that then drift apart.
- **Exhaustiveness.** When branching on a finite set of variants, make a missed case a compile error (a `never`-equivalent), so adding a variant forces handling it everywhere.
- **Nominal distinctions where structure would merge them.** Give `UserId` vs `OrderId`, a validated `Email`, or units a distinct identity (branded / newtype / opaque), constructed through one validating factory.

## Validation at boundaries

- Data crossing a runtime boundary (network, disk, env, deserialization) is untrusted and untyped. Validate its shape before the rest of the code trusts it.
- Prefer the language's own checks or a small schema validator over blind casts. Per `dev-principles`, do not add a dependency for a single boundary a hand-written guard already covers.

## Gotchas

- A cast or force-unwrap that "makes the error go away" usually moves a real bug downstream; treat each as a TODO to narrow.
- Deep type-level cleverness (elaborate generic or type-level computation) hurts readability and checker speed - reach for a named helper or a plainer type first.
- "Compiles" is not "correct at the boundary": types describe in-process values, not the bytes arriving from outside. Validate.
- An ever-growing pile of optional fields is a smell that the state should be split into distinct variants.
