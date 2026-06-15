# docs/agents

| File | Purpose |
|------|---------|
| `ARCHITECTURE.md` | Invariants the agent system depends on |
| `agent-setup.md` | Authoring model, commands, update matrix, skill groups |

Agent content is authored under `.agentkit/` and generated into the native files (`.claude/`, `.github/`,
`.cursor/`, `.junie/`, `AGENTS.md`, `CLAUDE.md`, `CATALOG.md`). Subagent identities are authored once in
`.agentkit/subagents/` and generated to every tool's copy, routed by `description`.
