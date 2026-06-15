import { byPriority, isClaudeOnly, scopeOf, type EmitContext, type OutputFile } from "../emit.js";

/**
 * Root AGENTS.md — the single global instruction file read natively by Copilot,
 * Cursor, Junie, Codex, Gemini, pi.dev, etc. Plain Markdown, no frontmatter (spec).
 * Claude-only modules are excluded here (they live in CLAUDE.md).
 */
export function emitAgentsMd(ctx: EmitContext): OutputFile[] {
  const globals = byPriority(ctx.instructions.filter((i) => scopeOf(i) === "global" && !isClaudeOnly(i)));
  const lines: string[] = [];
  lines.push(`# ${ctx.title}`);
  lines.push("");
  lines.push(`> Cross-tool agent instructions for this repository. Generated from \`.agentkit/instructions/\`.`);
  lines.push("");
  for (const m of globals) {
    lines.push("");
    lines.push(`## ${String(m.frontmatter.title ?? m.id)}`);
    lines.push("");
    lines.push(m.body.trim());
  }
  return [{ path: "AGENTS.md", content: lines.join("\n").trimEnd() + "\n" }];
}
