import { type EmitContext, type OutputFile } from "../emit.js";
import type { ParsedItem } from "../model.js";

/** CATALOG.md - the repo's L0 routing index (llms.txt-style: H1 + blockquote + curated links). */
export function emitCatalog(ctx: EmitContext): OutputFile[] {
  const L: string[] = [];
  L.push(`# ${ctx.title} - Catalog`);
  L.push("");
  L.push(`> Routing index for this agent-content repository. Authored under \`.agentkit/\`; generated into each agent's native files. ${count(ctx)} items.`);
  L.push("");

  skillSection(L, ctx.skills);
  section(L, "Instructions", ctx.instructions, (i) => `**${i.id}** (${i.frontmatter.scope ?? "global"}) - ${String(i.frontmatter.title ?? i.id)}  \n  \`${i.relPath}\``);
  section(L, "Subagents", ctx.subagents, (a) => `**${a.frontmatter.name ?? a.id}** - ${oneLine(String(a.frontmatter.description ?? ""))}  \n  \`${a.relPath}\``);
  section(L, "Commands", ctx.commands, (c) => `**/${c.frontmatter.name ?? c.id}** - ${oneLine(String(c.frontmatter.description ?? ""))}  \n  \`${c.relPath}\``);
  section(L, "Hooks", ctx.hooks, (h) => `**${h.id}** - ${h.data?.event} (${h.data?.type})  \n  \`${h.relPath}\``);
  section(L, "MCP servers", ctx.mcp, (m) => `**${m.data?.name ?? m.id}** - ${m.data?.transport}  \n  \`${m.relPath}\``);

  return [{ path: "CATALOG.md", content: L.join("\n").trimEnd() + "\n" }];
}

function count(ctx: EmitContext): number {
  return ctx.items.length;
}

function oneLine(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function section<T extends { id: string }>(L: string[], title: string, items: T[], render: (t: T) => string): void {
  if (items.length === 0) return;
  L.push("", `## ${title}`, "");
  // Sort by the rendered text so the listed order matches the displayed name even if id !== name.
  for (const it of [...items].sort((a, b) => render(a).localeCompare(render(b)))) L.push(`- ${render(it)}`);
}

/** Skills render grouped by their src subdirectory: ungrouped first (no subheading), then `### <group>`. */
function skillSection(L: string[], skills: ParsedItem[]): void {
  if (skills.length === 0) return;
  L.push("", "## Skills", "");
  const buckets = new Map<string, ParsedItem[]>();
  for (const s of skills) {
    const g = s.group ?? "";
    (buckets.get(g) ?? buckets.set(g, []).get(g)!).push(s);
  }
  const render = (s: ParsedItem): string => {
    const name = String(s.frontmatter.name ?? s.id);
    return `- **${name}** - ${oneLine(String(s.frontmatter.description ?? ""))}  \n  \`${s.relPath}\` → \`.claude/skills/${name}/\``;
  };
  for (const g of [...buckets.keys()].sort()) {
    const list = [...buckets.get(g)!].sort((a, b) => a.id.localeCompare(b.id));
    if (g) L.push(`### ${g}`, "");
    for (const s of list) L.push(render(s));
    if (g) L.push("");
  }
}
