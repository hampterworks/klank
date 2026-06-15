import { join } from "node:path";
import {
  buildHooks,
  buildMcpServers,
  byPriority,
  frontmatter,
  isClaudeOnly,
  mdDoc,
  pick,
  scopeOf,
  stableJson,
  targetsAgent,
  type EmitContext,
  type OutputFile,
} from "../emit.js";

const SUBAGENT_KEYS = [
  "name", "description", "tools", "disallowedTools", "model", "permissionMode",
  "maxTurns", "skills", "mcpServers", "hooks", "memory", "background", "effort",
  "isolation", "color", "initialPrompt",
];
const COMMAND_KEYS = ["description", "argument-hint", "allowed-tools", "model"];

/** Claude Code outputs. CLAUDE.md imports AGENTS.md (Claude does NOT read AGENTS.md natively). */
export function emitClaude(ctx: EmitContext): OutputFile[] {
  const out: OutputFile[] = [];

  // CLAUDE.md = @AGENTS.md import (stable prefix) + Claude-only global modules.
  const claudeOnly = byPriority(ctx.instructions.filter((i) => scopeOf(i) === "global" && isClaudeOnly(i)));
  const md: string[] = [`# ${ctx.title} - Claude Code`, "", "@AGENTS.md"];
  for (const m of claudeOnly) {
    md.push("", `## ${String(m.frontmatter.title ?? m.id)}`, "", m.body.trim());
  }
  out.push({ path: "CLAUDE.md", content: md.join("\n").trimEnd() + "\n" });

  // Path-scoped rules → .claude/rules/<id>.md with paths: frontmatter.
  for (const r of ctx.instructions.filter((i) => scopeOf(i) === "path" && targetsAgent(i, "claude"))) {
    const fm = frontmatter({ paths: r.frontmatter.applyTo }, ["paths"]);
    out.push({
      path: join(".claude", "rules", `${r.id}.md`),
      content: mdDoc({ frontmatter: fm, body: `# ${String(r.frontmatter.title ?? r.id)}\n\n${r.body.trim()}` }),
    });
  }

  // Subagents → .claude/agents/<name>.md
  for (const a of ctx.subagents) {
    const fm = frontmatter(pick(a.frontmatter, SUBAGENT_KEYS), SUBAGENT_KEYS);
    out.push({ path: join(".claude", "agents", `${a.id}.md`), content: mdDoc({ frontmatter: fm, body: a.body.trim() }) });
  }

  // Commands → .claude/commands/<name>.md
  for (const c of ctx.commands) {
    const fm = frontmatter(pick(c.frontmatter, COMMAND_KEYS), COMMAND_KEYS);
    out.push({ path: join(".claude", "commands", `${c.id}.md`), content: mdDoc({ frontmatter: fm, body: c.body.trim() }) });
  }

  // Hooks → .claude/settings.json (project-scope only; local stays out of git).
  const hooks = buildHooks(ctx.hooks, "project");
  if (Object.keys(hooks).length > 0) {
    out.push({
      path: join(".claude", "settings.json"),
      content: stableJson({ $schema: "https://json.schemastore.org/claude-code-settings.json", hooks }),
    });
  }

  // MCP → .mcp.json
  if (ctx.mcp.length > 0) {
    out.push({ path: ".mcp.json", content: stableJson({ mcpServers: buildMcpServers(ctx.mcp) }) });
  }

  return out;
}
