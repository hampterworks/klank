---
name: add-hook
description: Adds a Claude Code hook as a TypeScript file under .claude/hooks/ and registers it in .claude/settings.json. Use when a mechanically checkable constraint is currently only a documented bullet.
---

# add-hook

## When to use

- A constraint in a subagent's Hard Constraints is violated repeatedly
- A new field name or file extension must be guarded against accidental changes
- A lint or verify step should run automatically on every file edit

## Procedure

1. Pick the event type: `PreToolUse` (block before action), `PostToolUse` (verify after action).
2. Determine the matcher: `Edit|Write` for file edits, `Bash` for shell commands.
3. Write the hook at `.claude/hooks/<name>.ts`. The script reads the tool-use JSON payload from STDIN, outputs `{"decision": "block", "reason": "..."}` to STDOUT to block, or exits 0 to allow.
4. Register in `.claude/settings.json §hooks`:
   ```json
   {
     "matcher": "Edit|Write",
     "hooks": [{ "type": "command", "command": "npx tsx ${CLAUDE_PROJECT_DIR}/.claude/hooks/<name>.ts" }]
   }
   ```
5. Document in `docs/agents/agent-setup.md §Hook Catalogue`.
6. Run `agentkit-doctor`.

## Failure modes

- **Hook blocks every edit** → check the payload parsing; log the raw STDIN to debug.
- **`npx tsx` not found** → `tsx` is available via devDependencies; run `pnpm install` first.
- **Hook runs but doesn't block** → verify JSON output goes to STDOUT (not STDERR) and uses exact `{"decision": "block"}` shape.
