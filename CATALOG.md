# Klank - Catalog

> Routing index for klank's agent setup. Hand-maintained native files under `.claude/` (auto-discovered by Claude, Copilot, Cursor; imported by Junie). No generator or CLI.

## Skills

### klank

- **add-hook** - Adds a Claude Code hook as a TypeScript file under .claude/hooks/ and registers it in .claude/settings.json. Use when a mechanically checkable constraint is currently only a documented bullet.  
  `.claude/skills/add-hook/`
- **add-role** - Creates a new self-contained subagent identity in .claude/agents/ and its .github/agents/ Copilot mirror. Use when introducing a new expert identity to the klank agent system.  
  `.claude/skills/add-role/`
- **add-skill** - Creates a new procedure-skill with SKILL.md and a catalogue entry. Use when adding any new auto-triggered procedure to the klank agent system.  
  `.claude/skills/add-skill/`
- **audit-agent-setup** - Checks klank's agent setup for consistency - mirror parity, frontmatter, cross-refs, stale paths, descriptions. Use before any commit under .claude/, .github/agents/, or docs/agents/.  
  `.claude/skills/audit-agent-setup/`
- **build** - Runs the full NX build pipeline including TypeScript type-check and lint. Use before any PR or to verify structural changes.  
  `.claude/skills/build/`
- **new-lib** - Scaffolds a new NX library with correct Vite + Vitest config and @klank/* path alias. Use when adding a new shared library to libs/.  
  `.claude/skills/new-lib/`
- **run** - Starts the Vite dev server or full Tauri desktop app. Use when starting development or verifying UI changes in the running app.  
  `.claude/skills/run/`
- **run-tests** - Runs Vitest tests across the workspace or for a specific lib. Use after any code change before committing.  
  `.claude/skills/run-tests/`
- **update-dependencies** - Upgrades pnpm workspace and Cargo.toml dependencies safely - detects breaking changes and runs tests. Use when dependencies need updating or a security advisory requires action.  
  `.claude/skills/update-dependencies/`
- **update-docs** - Updates README and human-readable docs to reflect recent code or config changes. Use after any structural change - new lib, Tauri command, path alias, or route - to keep docs current.  
  `.claude/skills/update-docs/`

### develop

- **develop-clean** - Cleans up code at a chosen intensity/latitude over a scope (diff/area/repo) - simplify, de-cruft. Loads a stack reference. Use when tidying, not reviewing or strictness upgrades (develop-maintain).  
  `.claude/skills/develop-clean/`
- **develop-configure** - Configures a project's type checker and build for strictness, correct module resolution, and fast builds. Loads a stack reference (e.g. typescript). Use when creating or tuning toolchain config.  
  `.claude/skills/develop-configure/`
- **develop-maintain** - Upgrades toolchain versions and migrates code to stricter types, removing escape hatches. Loads a stack reference (e.g. typescript). Use when bumping versions or migrating to stricter checks.  
  `.claude/skills/develop-maintain/`
- **develop-publish** - Ships a library so types and entry points resolve for every consumer, validated before release. Loads a stack reference (e.g. typescript). Use when packaging for publish or debugging resolution.  
  `.claude/skills/develop-publish/`
- **develop-review** - Reviews source code or a diff - correctness, least-code, type-safety, security, test adequacy - as severity-rated findings with fixes. Loads a stack reference (e.g. typescript). Use for code review.  
  `.claude/skills/develop-review/`
- **develop-write** - Writes idiomatic, type-safe code - precise modeling, narrowing, boundary validation. Loads a stack reference (e.g. typescript). Use when writing or modifying source, not tidying (develop-clean).  
  `.claude/skills/develop-write/`

### qa

- **qa-capture** - Captures web page or running-app screenshots with Playwright - full-page, element, viewport variants - for visual QA, verification, and bug evidence. Use when a UI state needs capturing.  
  `.claude/skills/qa-capture/`
- **qa-explore** - Exploratory and manual testing to find what automation misses - session charters, bug-hunting heuristics, every state and edge case. Use when probing a build by hand for defects before sign-off.  
  `.claude/skills/qa-explore/`
- **qa-review** - Verifies a change meets its acceptance criteria and is safe to ship - regression, bug triage, ship/no-ship call. Use for QA sign-off on behavior, not source-code review (develop-review).  
  `.claude/skills/qa-review/`
- **qa-test** - Writes an effective automated test suite - testing pyramid, behavior over implementation, deterministic tests. Loads a stack reference (e.g. typescript). Use when adding or improving tests.  
  `.claude/skills/qa-test/`
- **qa-vet** - Evaluates and maintains third-party dependencies across their lifecycle - adoption vetting, health and security audits, updates, pruning. Use when adding or auditing a dependency.  
  `.claude/skills/qa-vet/`

### cicd

- **cicd-debug** - Diagnoses a failing CI/CD run via failed-step logs, debug logging, re-runs, flaky triage, and local repro. Loads a platform reference (e.g. github-actions). Use when a pipeline run is failing.  
  `.claude/skills/cicd-debug/`
- **cicd-harden** - Audits and hardens an existing CI/CD pipeline against supply-chain and injection attacks. Loads a platform reference (e.g. github-actions) with a full checklist. Use when securing pipelines.  
  `.claude/skills/cicd-harden/`
- **cicd-maintain** - Keeps CI/CD pipelines healthy via dependency and runner-image updates, pruning, and reusable-pipeline versioning. Loads a platform reference (e.g. github-actions). Use for routine upkeep.  
  `.claude/skills/cicd-maintain/`
- **cicd-scaffold** - Scaffolds a secure-by-default CI/CD pipeline - least-privilege, pinned deps, caching, matrices, reusable parts. Loads a platform reference (e.g. github-actions). Use when creating a pipeline.  
  `.claude/skills/cicd-scaffold/`

### design

- **design-accessibility** - Makes a product design inclusive at the design stage - WCAG 2.2 POUR, inclusive design across impairments, an a11y checklist. Use when designing for or auditing accessibility.  
  `.claude/skills/design-accessibility/`
- **design-draft** - Creates a product design as a structured design spec - user flows, information architecture, low-fidelity first, every state covered. Use when designing a new feature, flow, or screen.  
  `.claude/skills/design-draft/`
- **design-interrogate** - Elicits requirements by questioning the user in exhaustive, batched rounds, then outputs a structured spec. Use when turning a vague feature idea or improvement item into a buildable spec.  
  `.claude/skills/design-interrogate/`
- **design-review** - Critiques an existing design or UI with a heuristic evaluation - Nielsen heuristics, cognitive load, hierarchy, consistency, plus a11y. Use when reviewing or auditing a design for rated fixes.  
  `.claude/skills/design-review/`
- **design-write** - Writes product copy and microcopy - buttons, errors, empty states, labels - using a clarity-concision-consistency and voice-and-tone framework. Use when writing or fixing in-product wording.  
  `.claude/skills/design-write/`

## Subagents

- **documentation-specialist** - Writes and updates AGENTS.md, CLAUDE.md, README files, subagent identities, and inline docs. Use when documentation is stale, missing, or must reflect a recent structural change.  
  `.claude/agents/documentation-specialist.md` (+ `.github/agents/documentation-specialist.agent.md`, `.junie/agents/documentation-specialist.md`)
- **frontend-engineer** - Builds React 19 components, CSS modules, routes, and Tauri IPC calls in apps/klank/app/ and libs/ui/. Use for component work, styling, React Router navigation, and platform-api integration.  
  `.claude/agents/frontend-engineer.md` (+ `.github/agents/frontend-engineer.agent.md`, `.junie/agents/frontend-engineer.md`)
- **music-theory-expert** - Implements guitar tab parsing, chord transposition, UG scraper HTML parsing, and music data structures in libs/platform-api/. Use for chords.ts, download.ts, and tab format work.  
  `.claude/agents/music-theory-expert.md` (+ `.github/agents/music-theory-expert.agent.md`, `.junie/agents/music-theory-expert.md`)
- **orchestrator** - Plans and coordinates multi-role work - produces a labelled DAG with handoff payloads and acceptance gates. Use when a task spans ≥ 2 roles or needs cross-role sequencing. Never writes code.  
  `.claude/agents/orchestrator.md` (+ `.github/agents/orchestrator.agent.md`, `.junie/agents/orchestrator.md`)
- **platform-engineer** - Maintains NX config, Vite configs, pnpm workspaces, tsconfig.base.json path aliases, CI/CD, and library scaffolding. Use for project.json, nx.json, vite.config.ts, and .github/workflows/.  
  `.claude/agents/platform-engineer.md` (+ `.github/agents/platform-engineer.agent.md`, `.junie/agents/platform-engineer.md`)
- **tauri-engineer** - Implements Rust commands, Tauri plugins, capability JSON, and platform-api TypeScript wrappers for apps/klank/src-tauri/. Use for IPC design, Cargo.toml, Tauri permissions, and src-tauri/ work.  
  `.claude/agents/tauri-engineer.md` (+ `.github/agents/tauri-engineer.agent.md`, `.junie/agents/tauri-engineer.md`)
- **tester** - Writes and maintains Vitest tests using @testing-library/react for libs/ and apps/klank/. Use for new test files, coverage gaps, test structure review, and pre-ship audits.  
  `.claude/agents/tester.md` (+ `.github/agents/tester.agent.md`, `.junie/agents/tester.md`)
- **ux-designer** - Designs UI layouts, user flows, accessibility patterns, and music-app UX for klank. Use for tab reader layout, chord display, navigation redesign, keyboard shortcuts, and accessibility reviews.  
  `.claude/agents/ux-designer.md` (+ `.github/agents/ux-designer.agent.md`, `.junie/agents/ux-designer.md`)
