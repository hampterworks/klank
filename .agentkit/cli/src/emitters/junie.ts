import { join } from "node:path";
import {
  buildMcpServers,
  frontmatter,
  mdDoc,
  scopeOf,
  stableJson,
  targetsAgent,
  type EmitContext,
  type OutputFile,
} from "../emit.js";

/**
 * JetBrains Junie outputs. Junie reads root AGENTS.md natively for globals, so we emit only
 * path-scoped rules (.junie/rules), subagents (.junie/agents — NOT .junie/subagents), and MCP.
 * .junie/guidelines.md is legacy and intentionally not generated.
 */
export function emitJunie(ctx: EmitContext): OutputFile[] {
  const out: OutputFile[] = [];

  for (const r of ctx.instructions.filter((i) => scopeOf(i) === "path" && targetsAgent(i, "junie"))) {
    const globs = (r.frontmatter.applyTo as string[] | undefined) ?? [];
    const note = globs.length ? `\n\n_Applies to: ${globs.join(", ")}_` : "";
    out.push({
      path: join(".junie", "rules", `${r.id}.md`),
      content: mdDoc({ body: `# ${String(r.frontmatter.title ?? r.id)}\n\n${r.body.trim()}${note}` }),
    });
  }

  for (const a of ctx.subagents) {
    const fm = frontmatter({ name: a.frontmatter.name, description: a.frontmatter.description }, ["name", "description"]);
    out.push({ path: join(".junie", "agents", `${a.id}.md`), content: mdDoc({ frontmatter: fm, body: a.body.trim() }) });
  }

  if (ctx.mcp.length > 0) {
    out.push({
      path: join(".junie", "mcp", "mcp.json"),
      content: stableJson({ mcpServers: buildMcpServers(ctx.mcp, { toolsFilter: true }) }),
    });
  }

  return out;
}
