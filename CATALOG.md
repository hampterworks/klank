# Klank - Catalog

> Routing index for this agent-content repository. Authored under `.agentkit/`; generated into each agent's native files. 40 items.


## Skills

### agentkit

- **agentkit-doctor** - Diagnoses and safely fixes a repo's existing native agent files (CLAUDE.md, AGENTS.md, .cursor/rules, SKILL.md, hooks) against these rules. Use when auditing or cleaning up another repo's agent setup.  
  `.agentkit/skills/agentkit/agentkit-doctor/SKILL.md` → `.claude/skills/agentkit-doctor/`
- **agentkit-evaluate** - Runs the local behavioral eval harness (promptfoo plus golden datasets) to check that skills trigger and behave correctly. Use when changing a skill's description or behavior; requires an API key.  
  `.agentkit/skills/agentkit/agentkit-evaluate/SKILL.md` → `.claude/skills/agentkit-evaluate/`
- **agentkit-generate** - Regenerates per-agent native files (AGENTS.md, CLAUDE.md, .claude, .github, .cursor, .junie) from .agentkit/ and keeps them in sync. Use after editing .agentkit/ or when generated files drift.  
  `.agentkit/skills/agentkit/agentkit-generate/SKILL.md` → `.claude/skills/agentkit-generate/`
- **agentkit-install** - Installs or updates a chosen subset of this library into a target repo, picking domains, detecting agents, reconciling files. Use when setting up or syncing agentkit, not for authoring content.  
  `.agentkit/skills/agentkit/agentkit-install/SKILL.md` → `.claude/skills/agentkit-install/`
- **agentkit-learn** - Analyzes a human-agent transcript for where the agent setup (skills, instructions, routing, context) lost efficiency, then ships fixes. Use after a session to improve future runs; not a PR review.  
  `.agentkit/skills/agentkit/agentkit-learn/SKILL.md` → `.claude/skills/agentkit-learn/`
- **agentkit-release** - Regenerates the CATALOG index and prepares a versioned release of the agent-content repo. Use when cutting a release or after a batch of content changes.  
  `.agentkit/skills/agentkit/agentkit-release/SKILL.md` → `.claude/skills/agentkit-release/`
- **agentkit-review** - Reviews an agent-content diff against the authoring catalogue checklist. Use when reviewing a PR that changes skills, instructions, or AGENTS.md - not for general code review.  
  `.agentkit/skills/agentkit/agentkit-review/SKILL.md` → `.claude/skills/agentkit-review/`
- **agentkit-scaffold** - Creates a new agent-content item (skill, instruction, subagent, command, hook, or MCP) with correct layout and frontmatter. Use when adding content to a .agentkit/-based agent repo.  
  `.agentkit/skills/agentkit/agentkit-scaffold/SKILL.md` → `.claude/skills/agentkit-scaffold/`
- **agentkit-tighten** - Refactors a .agentkit/ agent file to follow the context-architecture rules - disclosure, ordering, descriptions, budgets. Use when a SKILL.md or instruction here is bloated, vague, or oversized.  
  `.agentkit/skills/agentkit/agentkit-tighten/SKILL.md` → `.claude/skills/agentkit-tighten/`
- **agentkit-validate** - Runs schema, structure, and metadata-budget checks over .agentkit/ and docs. Use for the deterministic pre-commit pass, not the qualitative PR review (agentkit-review) or app-code linting.  
  `.agentkit/skills/agentkit/agentkit-validate/SKILL.md` → `.claude/skills/agentkit-validate/`

### cicd

- **cicd-debug** - Diagnoses a failing CI/CD run via failed-step logs, debug logging, re-runs, flaky triage, and local repro. Loads a platform reference (e.g. github-actions). Use when a pipeline run is failing.  
  `.agentkit/skills/cicd/cicd-debug/SKILL.md` → `.claude/skills/cicd-debug/`
- **cicd-harden** - Audits and hardens an existing CI/CD pipeline against supply-chain and injection attacks. Loads a platform reference (e.g. github-actions) with a full checklist. Use when securing pipelines.  
  `.agentkit/skills/cicd/cicd-harden/SKILL.md` → `.claude/skills/cicd-harden/`
- **cicd-maintain** - Keeps CI/CD pipelines healthy via dependency and runner-image updates, pruning, and reusable-pipeline versioning. Loads a platform reference (e.g. github-actions). Use for routine upkeep.  
  `.agentkit/skills/cicd/cicd-maintain/SKILL.md` → `.claude/skills/cicd-maintain/`
- **cicd-scaffold** - Scaffolds a secure-by-default CI/CD pipeline - least-privilege, pinned deps, caching, matrices, reusable parts. Loads a platform reference (e.g. github-actions). Use when creating a pipeline.  
  `.agentkit/skills/cicd/cicd-scaffold/SKILL.md` → `.claude/skills/cicd-scaffold/`

### design

- **design-accessibility** - Makes a product design inclusive at the design stage - WCAG 2.2 POUR, inclusive design across impairments, an a11y checklist. Use when designing for or auditing accessibility.  
  `.agentkit/skills/design/design-accessibility/SKILL.md` → `.claude/skills/design-accessibility/`
- **design-draft** - Creates a product design as a structured design spec - user flows, information architecture, low-fidelity first, every state covered. Use when designing a new feature, flow, or screen.  
  `.agentkit/skills/design/design-draft/SKILL.md` → `.claude/skills/design-draft/`
- **design-interrogate** - Elicits requirements by questioning the user in exhaustive, batched rounds, then outputs a structured spec. Use when turning a vague feature idea or improvement item into a buildable spec.  
  `.agentkit/skills/design/design-interrogate/SKILL.md` → `.claude/skills/design-interrogate/`
- **design-review** - Critiques an existing design or UI with a heuristic evaluation - Nielsen heuristics, cognitive load, hierarchy, consistency, plus a11y. Use when reviewing or auditing a design for rated fixes.  
  `.agentkit/skills/design/design-review/SKILL.md` → `.claude/skills/design-review/`
- **design-write** - Writes product copy and microcopy - buttons, errors, empty states, labels - using a clarity-concision-consistency and voice-and-tone framework. Use when writing or fixing in-product wording.  
  `.agentkit/skills/design/design-write/SKILL.md` → `.claude/skills/design-write/`

### develop

- **develop-clean** - Cleans up code at a chosen intensity/latitude over a scope (diff/area/repo) - simplify, de-cruft. Loads a stack reference. Use when tidying, not reviewing or strictness upgrades (develop-maintain).  
  `.agentkit/skills/develop/develop-clean/SKILL.md` → `.claude/skills/develop-clean/`
- **develop-configure** - Configures a project's type checker and build for strictness, correct module resolution, and fast builds. Loads a stack reference (e.g. typescript). Use when creating or tuning toolchain config.  
  `.agentkit/skills/develop/develop-configure/SKILL.md` → `.claude/skills/develop-configure/`
- **develop-maintain** - Upgrades toolchain versions and migrates code to stricter types, removing escape hatches. Loads a stack reference (e.g. typescript). Use when bumping versions or migrating to stricter checks.  
  `.agentkit/skills/develop/develop-maintain/SKILL.md` → `.claude/skills/develop-maintain/`
- **develop-publish** - Ships a library so types and entry points resolve for every consumer, validated before release. Loads a stack reference (e.g. typescript). Use when packaging for publish or debugging resolution.  
  `.agentkit/skills/develop/develop-publish/SKILL.md` → `.claude/skills/develop-publish/`
- **develop-review** - Reviews source code or a diff - correctness, least-code, type-safety, security, test adequacy - as severity-rated findings with fixes. Loads a stack reference (e.g. typescript). Use for code review.  
  `.agentkit/skills/develop/develop-review/SKILL.md` → `.claude/skills/develop-review/`
- **develop-write** - Writes idiomatic, type-safe code - precise modeling, narrowing, boundary validation. Loads a stack reference (e.g. typescript). Use when writing or modifying source, not tidying (develop-clean).  
  `.agentkit/skills/develop/develop-write/SKILL.md` → `.claude/skills/develop-write/`

### qa

- **qa-capture** - Captures web page or running-app screenshots with Playwright - full-page, element, viewport variants - for visual QA, verification, and bug evidence. Use when a UI state needs capturing.  
  `.agentkit/skills/qa/qa-capture/SKILL.md` → `.claude/skills/qa-capture/`
- **qa-explore** - Exploratory and manual testing to find what automation misses - session charters, bug-hunting heuristics, every state and edge case. Use when probing a build by hand for defects before sign-off.  
  `.agentkit/skills/qa/qa-explore/SKILL.md` → `.claude/skills/qa-explore/`
- **qa-review** - Verifies a change meets its acceptance criteria and is safe to ship - regression, bug triage, ship/no-ship call. Use for QA sign-off on behavior, not source-code review (develop-review).  
  `.agentkit/skills/qa/qa-review/SKILL.md` → `.claude/skills/qa-review/`
- **qa-test** - Writes an effective automated test suite - testing pyramid, behavior over implementation, deterministic tests. Loads a stack reference (e.g. typescript). Use when adding or improving tests.  
  `.agentkit/skills/qa/qa-test/SKILL.md` → `.claude/skills/qa-test/`
- **qa-vet** - Evaluates and maintains third-party dependencies across their lifecycle - adoption vetting, health and security audits, updates, pruning. Use when adding or auditing a dependency.  
  `.agentkit/skills/qa/qa-vet/SKILL.md` → `.claude/skills/qa-vet/`


## Instructions

- **agentkit-authoring-principles** (path) - agentkit authoring principles (context architecture)  
  `.agentkit/instructions/agentkit-authoring-principles.md`
- **design-principles** (global) - Design principles (minimalism and impact)  
  `.agentkit/instructions/design-principles.md`
- **dev-principles** (global) - Development principles (least code, fewest deps)  
  `.agentkit/instructions/dev-principles.md`
- **doc-principles** (path) - Documentation principles (Diataxis)  
  `.agentkit/instructions/doc-principles.md`
- **overview** (global) - Project briefing  
  `.agentkit/instructions/overview.md`
- **review-principles** (global) - Review principles (critique with a fix)  
  `.agentkit/instructions/review-principles.md`
- **security-principles** (global) - Security principles (least privilege, distrust input)  
  `.agentkit/instructions/security-principles.md`
- **test-principles** (path) - Testing principles (trustworthy tests)  
  `.agentkit/instructions/test-principles.md`

## Subagents

- **content-reviewer** - Reviews agent-content changes (SKILL.md, instructions, AGENTS.md) against the authoring catalogue. Use when reviewing a diff touching .agentkit/ or generated agent files, not general code review.  
  `.agentkit/subagents/content-reviewer.md`

## Commands

- **/sync-check** - Verify generated agent files are in sync with .agentkit/ and validation passes. Use before committing or when CI reports drift.  
  `.agentkit/commands/sync-check.md`
