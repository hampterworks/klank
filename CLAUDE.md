Read `AGENTS.md` first - project briefing, build/test commands, and boundaries. For why the agent setup is shaped the way it is: `docs/agents/ARCHITECTURE.md`.

Specialist work routes to the subagents in `.claude/agents/` automatically by their `description` - there is no lookup table to maintain. For multi-role tasks, invoke the Orchestrator before delegating. Extend the setup with `add-skill`, `add-role`, or `add-hook`; run `audit-agent-setup` before any commit touching `.claude/`, `.github/agents/`, or `docs/agents/`.

---

## Critical Constraints

Silent failures - the hardest bugs to diagnose:

- **Never add default exports** - TypeScript named exports only throughout all libs and app code.
- **Never rename `transpose`, `fontSize`, `scrollSpeed` in `TabSetting`** - persisted in `klank-storage`; renaming silently drops all user settings.
- **Tab files must use `.tab.txt` extension** - `fs.ts` filter and `mapTreeStructure` depend on this exact string.
- **Tauri capabilities must be declared in `apps/klank/src-tauri/capabilities/`** - never bypass with `dangerouslyAllowedUri` or inline CSP overrides.
- **NX path aliases must match `tsconfig.base.json §paths`** - `@klank/ui`, `@klank/store`, `@klank/platform-api`; crossing lib boundaries with relative imports breaks the build silently in some configurations.
- **Every Rust command must appear in `generate_handler![]` in `lib.rs`** - an unregistered command compiles cleanly but is silently unreachable from JS.
- **Never import `@tauri-apps/*` directly in `apps/klank/app/` components** - wrap all platform calls in `@klank/platform-api`.
- **Never edit `libs/ui/` without Frontend Engineer role** - shared component changes cascade to all consumers without type errors.

---

## Skills

Auto-triggered procedure-skills live under `.claude/skills/` (Claude, Copilot, and Cursor discover that directory automatically). See `docs/agents/agent-setup.md §Skill Catalogue` for the full list and trigger conditions. Hooks live under `.claude/hooks/`; registration in `.claude/settings.json`.

---

## Gotchas

- Subagents route by `description` - there is no role table. Keep each subagent's first sentence specific so routing stays accurate.
- A subagent body is its full identity, not a redirect - never point it at a parallel doc.
- Skills live once under `.claude/skills/` - never mirror them into `.github/agents/` (Copilot auto-discovers the directory; Junie imports it).
