# docs/agents

| File | Purpose |
|------|---------|
| `ARCHITECTURE.md` | Seven invariants the agent system depends on |
| `agent-setup.md` | Naming conventions, update matrix, skill catalogue |

Role identities are self-contained in `.claude/agents/` (Claude), `.github/agents/` (Copilot), and `.junie/agents/` (Junie), routed by `description`. Skills live once in `.claude/skills/` (auto-discovered by Claude/Copilot/Cursor, imported by Junie). All files are hand-maintained - there is no generator.
