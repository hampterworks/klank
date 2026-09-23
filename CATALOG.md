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
- **update-dependencies** - klank's pnpm-workspace and Cargo bump procedure - breaking-change scan, then tests. Use for any dependency update in this repo, over dev:develop-dependencies (generic vetting rules).  
  `.claude/skills/update-dependencies/`
- **update-docs** - Updates README and human-readable docs to reflect recent code or config changes. Use after any structural change - new lib, Tauri command, path alias, or route - to keep docs current.  
  `.claude/skills/update-docs/`

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
