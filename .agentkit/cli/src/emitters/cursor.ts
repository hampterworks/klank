import { join } from "node:path";
import { frontmatter, mdDoc, scopeOf, targetsAgent, type EmitContext, type OutputFile } from "../emit.js";

/**
 * Cursor outputs. Globals are covered by root AGENTS.md (native since Feb 2026); we emit
 * path-scoped rules (.mdc) and slash commands.
 */
export function emitCursor(ctx: EmitContext): OutputFile[] {
  const out: OutputFile[] = [];

  for (const r of ctx.instructions.filter((i) => scopeOf(i) === "path" && targetsAgent(i, "cursor"))) {
    const globs = (r.frontmatter.applyTo as string[] | undefined) ?? [];
    const fm = frontmatter(
      { description: String(r.frontmatter.title ?? r.id), globs, alwaysApply: false },
      ["description", "globs", "alwaysApply"],
    );
    out.push({
      path: join(".cursor", "rules", `${r.id}.mdc`),
      content: mdDoc({ frontmatter: fm, body: r.body.trim() }),
    });
  }

  // Commands → .cursor/commands/<name>.md (plain markdown; filename is the slash command).
  for (const c of ctx.commands) {
    out.push({
      path: join(".cursor", "commands", `${c.id}.md`),
      content: mdDoc({ body: `# ${String(c.frontmatter.description ?? c.id)}\n\n${c.body.trim()}` }),
    });
  }

  return out;
}
