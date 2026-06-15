import { join } from "node:path";
import { frontmatter, mdDoc, scopeOf, targetsAgent, type EmitContext, type OutputFile } from "../emit.js";

/**
 * GitHub Copilot / VS Code outputs. Globals are covered by root AGENTS.md (native since
 * Aug 2025), so copilot-instructions.md is intentionally NOT emitted (avoids duplicate context).
 */
export function emitCopilot(ctx: EmitContext): OutputFile[] {
  const out: OutputFile[] = [];

  // Path-scoped → .github/instructions/<id>.instructions.md with applyTo (comma-joined globs).
  for (const r of ctx.instructions.filter((i) => scopeOf(i) === "path" && targetsAgent(i, "copilot"))) {
    const globs = (r.frontmatter.applyTo as string[] | undefined) ?? [];
    const fm = frontmatter({ applyTo: globs.join(",") }, ["applyTo"]);
    out.push({
      path: join(".github", "instructions", `${r.id}.instructions.md`),
      content: mdDoc({ frontmatter: fm, body: `# ${String(r.frontmatter.title ?? r.id)}\n\n${r.body.trim()}` }),
    });
  }

  // Commands → .github/prompts/<name>.prompt.md (frontmatter uses `agent`, not `mode`).
  for (const c of ctx.commands) {
    const fm = frontmatter(
      { description: c.frontmatter.description, agent: "agent", model: c.frontmatter.model },
      ["description", "agent", "model"],
    );
    out.push({ path: join(".github", "prompts", `${c.id}.prompt.md`), content: mdDoc({ frontmatter: fm, body: c.body.trim() }) });
  }

  // Subagents → .github/agents/<name>.agent.md (current format; .chatmode.md is legacy).
  for (const a of ctx.subagents) {
    const fm = frontmatter(
      { name: a.frontmatter.name, description: a.frontmatter.description, tools: a.frontmatter.tools },
      ["name", "description", "tools"],
    );
    out.push({ path: join(".github", "agents", `${a.id}.agent.md`), content: mdDoc({ frontmatter: fm, body: a.body.trim() }) });
  }

  return out;
}
