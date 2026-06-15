import fg from "fast-glob";
import yaml from "js-yaml";
import { basename, dirname, join, relative } from "node:path";
import { existsSync } from "node:fs";
import { parseFrontmatter, readText } from "./util.js";

export const CONTENT_TYPES = [
  "skill",
  "instruction",
  "subagent",
  "command",
  "hook",
  "mcp",
] as const;
export type ContentType = (typeof CONTENT_TYPES)[number];

/** Authored-source root. A dotdir the tool owns (alongside install state: manifest.json, backups/, cli/),
 *  so it never collides with a target repo's own `content/` (Hugo/Gatsby/Astro/Next/CMS). */
export const SOURCE_DIR = ".agentkit";

export interface ParsedItem {
  type: ContentType;
  /** Stable identifier: frontmatter name/id, else derived from path. */
  id: string;
  /** Absolute path to the authored source file. */
  srcPath: string;
  /** Path relative to repo root (for messages). */
  relPath: string;
  /** For skills, the skill directory; otherwise the containing directory. */
  dir: string;
  /** For skills nested as .agentkit/skills/<group>/<skill>/, the group segment; else undefined. */
  group?: string;
  frontmatter: Record<string, unknown>;
  /** Markdown body (md types) or empty for data types. */
  body: string;
  /** Parsed data for yaml types (hook/mcp); undefined for md types. */
  data?: Record<string, unknown>;
  /** Full original file contents. */
  raw: string;
}

const TYPE_GLOBS: Record<ContentType, string | string[]> = {
  // Skills may be flat (.agentkit/skills/<skill>/) or grouped (.agentkit/skills/<group>/<skill>/).
  skill: [`${SOURCE_DIR}/skills/*/SKILL.md`, `${SOURCE_DIR}/skills/*/*/SKILL.md`],
  instruction: `${SOURCE_DIR}/instructions/**/*.md`,
  subagent: `${SOURCE_DIR}/subagents/**/*.md`,
  command: `${SOURCE_DIR}/commands/**/*.md`,
  hook: `${SOURCE_DIR}/hooks/**/*.{yaml,yml}`,
  mcp: `${SOURCE_DIR}/mcp/**/*.{yaml,yml}`,
};

function deriveId(type: ContentType, fm: Record<string, unknown>, srcPath: string): string {
  const fmName = (fm.name ?? fm.id) as string | undefined;
  if (typeof fmName === "string" && fmName.trim()) return fmName.trim();
  if (type === "skill") return basename(dirname(srcPath));
  return basename(srcPath).replace(/\.(md|ya?ml)$/i, "");
}

/** Group for a skill nested as .agentkit/skills/<group>/<skill>/SKILL.md; undefined when flat. */
export function deriveGroup(type: ContentType, root: string, srcPath: string): string | undefined {
  if (type !== "skill") return undefined;
  const parts = relative(root, srcPath).split(/[\\/]/);
  // [.agentkit, skills, <group>, <skill>, SKILL.md] when grouped (length 5).
  return parts.length === 5 ? parts[2] : undefined;
}

export function loadType(root: string, type: ContentType): ParsedItem[] {
  const files = fg
    .sync(TYPE_GLOBS[type], { cwd: root, absolute: true, dot: false })
    .sort();
  return files.map((srcPath) => parseFile(root, type, srcPath));
}

export function parseFile(root: string, type: ContentType, srcPath: string): ParsedItem {
  const raw = readText(srcPath);
  let frontmatter: Record<string, unknown> = {};
  let body = "";
  let data: Record<string, unknown> | undefined;

  if (type === "hook" || type === "mcp") {
    const parsed = (yaml.load(raw) ?? {}) as Record<string, unknown>;
    data = parsed;
    frontmatter = parsed;
  } else {
    const parsed = parseFrontmatter(raw);
    frontmatter = parsed.data;
    body = parsed.content;
  }

  return {
    type,
    id: deriveId(type, frontmatter, srcPath),
    srcPath,
    relPath: relative(root, srcPath),
    dir: dirname(srcPath),
    group: deriveGroup(type, root, srcPath),
    frontmatter,
    body,
    data,
    raw,
  };
}

export function loadSrc(root: string): ParsedItem[] {
  if (!existsSync(join(root, SOURCE_DIR))) return [];
  return CONTENT_TYPES.flatMap((t) => loadType(root, t));
}

export function byType(items: ParsedItem[]): Record<ContentType, ParsedItem[]> {
  const out = Object.fromEntries(CONTENT_TYPES.map((t) => [t, [] as ParsedItem[]])) as unknown as Record<
    ContentType,
    ParsedItem[]
  >;
  for (const it of items) out[it.type].push(it);
  return out;
}
