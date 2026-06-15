import yaml from "js-yaml";
import type { ParsedItem } from "./model.js";

export interface OutputFile {
  /** Path relative to repo root. */
  path: string;
  content: string;
}

export interface EmitContext {
  root: string;
  title: string;
  items: ParsedItem[];
  skills: ParsedItem[];
  instructions: ParsedItem[];
  subagents: ParsedItem[];
  commands: ParsedItem[];
  hooks: ParsedItem[];
  mcp: ParsedItem[];
}

/** Build a YAML frontmatter block with a stable, explicit key order (cache-friendly). */
export function frontmatter(obj: Record<string, unknown>, order: string[]): string {
  const ordered: Record<string, unknown> = {};
  for (const k of order) if (obj[k] !== undefined && obj[k] !== null) ordered[k] = obj[k];
  for (const k of Object.keys(obj).sort()) if (!(k in ordered) && obj[k] !== undefined && obj[k] !== null) ordered[k] = obj[k];
  if (Object.keys(ordered).length === 0) return "";
  const body = yaml.dump(ordered, { sortKeys: false, lineWidth: -1, noRefs: true }).trimEnd();
  return `---\n${body}\n---`;
}

/** Pick a subset of keys from an item's frontmatter. */
export function pick(fm: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of keys) if (fm[k] !== undefined) out[k] = fm[k];
  return out;
}

export function mdDoc(parts: { frontmatter?: string; body: string }): string {
  const segs: string[] = [];
  if (parts.frontmatter) segs.push(parts.frontmatter);
  segs.push(parts.body.trimEnd());
  return segs.join("\n\n") + "\n";
}

/** Deterministic JSON (sorted keys) — used for .mcp.json and settings.json. */
export function stableJson(value: unknown): string {
  return JSON.stringify(sortDeep(value), null, 2) + "\n";
}

function sortDeep(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortDeep);
  if (v && typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(v as Record<string, unknown>).sort()) out[k] = sortDeep((v as Record<string, unknown>)[k]);
    return out;
  }
  return v;
}

/** Sort instruction items by priority (asc), then id — stable, cache-friendly ordering. */
export function byPriority(items: ParsedItem[]): ParsedItem[] {
  return [...items].sort((a, b) => {
    const pa = Number(a.frontmatter.priority ?? 100);
    const pb = Number(b.frontmatter.priority ?? 100);
    return pa - pb || a.id.localeCompare(b.id);
  });
}

export function targetsAgent(item: ParsedItem, agent: string): boolean {
  const agents = item.frontmatter.agents as string[] | undefined;
  if (!agents || agents.length === 0) return true;
  return agents.includes("all") || agents.includes(agent);
}

export function scopeOf(item: ParsedItem): "global" | "path" {
  return (item.frontmatter.scope as "global" | "path") ?? "global";
}

/** A global instruction is Claude-only when its agents list is exactly ["claude"]. */
export function isClaudeOnly(item: ParsedItem): boolean {
  const agents = item.frontmatter.agents as string[] | undefined;
  return Array.isArray(agents) && agents.length === 1 && agents[0] === "claude";
}

/** Build the `mcpServers` object for .mcp.json / .junie/mcp/mcp.json. */
export function buildMcpServers(items: ParsedItem[], opts: { toolsFilter?: boolean } = {}): Record<string, unknown> {
  const servers: Record<string, unknown> = {};
  for (const it of [...items].sort((a, b) => a.id.localeCompare(b.id))) {
    const d = it.data ?? {};
    const name = String(d.name ?? it.id);
    const transport = String(d.transport ?? "stdio");
    const server: Record<string, unknown> = { type: transport };
    if (transport === "stdio") {
      server.command = d.command;
      if (d.args) server.args = d.args;
    } else {
      server.url = d.url;
    }
    if (d.env) server.env = d.env;
    if (d.timeout) server.timeout = d.timeout;
    if (opts.toolsFilter && d.tools) server.tools = d.tools;
    servers[name] = server;
  }
  return servers;
}

const HANDLER_KEYS = [
  "type", "command", "args", "url", "server", "tool", "input", "prompt", "model",
  "if", "timeout", "statusMessage", "once", "async", "asyncRewake", "shell", "headers", "allowedEnvVars",
];

/** Build the `hooks` object for .claude/settings.json from canonical hook items. */
export function buildHooks(items: ParsedItem[], scope: "project" | "local"): Record<string, unknown> {
  const byEvent: Record<string, Map<string, Record<string, unknown>[]>> = {};
  const ordered = [...items].sort((a, b) => a.id.localeCompare(b.id));
  for (const it of ordered) {
    const d = it.data ?? {};
    if ((String(d.scope ?? "project")) !== scope) continue;
    const event = String(d.event);
    const matcher = d.matcher === undefined ? "" : String(d.matcher);
    const handler = pick(d, HANDLER_KEYS);
    (byEvent[event] ??= new Map<string, Record<string, unknown>[]>());
    const m = byEvent[event]!;
    m.set(matcher, [...(m.get(matcher) ?? []), handler]);
  }
  const out: Record<string, unknown> = {};
  for (const event of Object.keys(byEvent).sort()) {
    const groups: Record<string, unknown>[] = [];
    const m = byEvent[event]!;
    for (const matcher of [...m.keys()].sort()) {
      const entry: Record<string, unknown> = {};
      if (matcher) entry.matcher = matcher;
      entry.hooks = m.get(matcher);
      groups.push(entry);
    }
    out[event] = groups;
  }
  return out;
}
