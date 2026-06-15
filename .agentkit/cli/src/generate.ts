import fg from "fast-glob";
import { existsSync, readFileSync, rmSync, statSync, readdirSync } from "node:fs";
import { basename, join, relative } from "node:path";
import pc from "picocolors";
import { byType, loadSrc, type ParsedItem } from "./model.js";
import { readText, writeText } from "./util.js";
import type { EmitContext, OutputFile } from "./emit.js";
import { emitAgentsMd } from "./emitters/agentsmd.js";
import { emitClaude } from "./emitters/claude.js";
import { emitCopilot } from "./emitters/copilot.js";
import { emitCursor } from "./emitters/cursor.js";
import { emitJunie } from "./emitters/junie.js";
import { emitCatalog } from "./emitters/catalog.js";
import { README_BEGIN, readmeOverviewBlock, spliceReadme } from "./emitters/readme.js";

/** Glob patterns covering everything agentkit owns/generates (for stale detection + cleanup). */
const GENERATED_GLOBS = [
  "AGENTS.md", "CLAUDE.md", "CATALOG.md", ".mcp.json", ".claude/settings.json",
  ".claude/rules/**/*", ".claude/agents/**/*", ".claude/commands/**/*", ".claude/skills/**/*",
  ".github/instructions/**/*", ".github/prompts/**/*", ".github/agents/**/*",
  ".cursor/rules/**/*", ".cursor/commands/**/*",
  ".junie/rules/**/*", ".junie/agents/**/*", ".junie/mcp/**/*",
];

const TEXT_EXT = /\.(md|mdc|markdown|txt|json|ya?ml|toml|py|js|ts|tsx|jsx|sh|bash|csv|sql|html|css)$/i;

export type AgentId = "claude" | "copilot" | "cursor" | "junie";
const ALL_AGENTS: AgentId[] = ["claude", "copilot", "cursor", "junie"];

/** Filter generation to a subset of content items and target agents (used by `install` into a target repo). */
export interface GenSelection {
  items?: ParsedItem[];
  agents?: AgentId[];
  srcRoot?: string;
  /** Splice the generated overview into README.md. Self-generation only — never when installing into a
   *  target, where the target's README is the user's and our overview lists this library's own skills. */
  readme?: boolean;
}

export function buildContext(root: string, items: ParsedItem[]): EmitContext {
  const t = byType(items);
  return {
    root,
    title: repoTitle(root),
    items,
    skills: t.skill,
    instructions: t.instruction,
    subagents: t.subagent,
    commands: t.command,
    hooks: t.hook,
    mcp: t.mcp,
  };
}

function repoTitle(root: string): string {
  return basename(root)
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Copy a skill's authored directory to .claude/skills/<name>/ (Claude only; Copilot/Cursor/Junie auto-discover it). */
function skillOutputs(ctx: EmitContext, agents: Set<AgentId>): OutputFile[] {
  if (!agents.has("claude")) return [];
  const out: OutputFile[] = [];
  for (const s of ctx.skills) {
    const name = String(s.frontmatter.name ?? s.id);
    const files = fg.sync("**/*", { cwd: s.dir, absolute: true, dot: false, onlyFiles: true });
    for (const abs of files.sort()) {
      const rel = relative(s.dir, abs);
      const dest = join(".claude", "skills", name, rel);
      if (!TEXT_EXT.test(abs)) {
        // Binary asset: copy bytes by re-encoding through latin1 so round-trips are stable.
        out.push({ path: dest, content: readFileSync(abs).toString("latin1"), });
      } else {
        out.push({ path: dest, content: readText(abs) });
      }
    }
  }
  return out;
}

export function collectOutputs(root: string, sel: GenSelection = {}): OutputFile[] {
  const items = sel.items ?? loadSrc(sel.srcRoot ?? root);
  const ctx = buildContext(root, items);
  const agents = new Set<AgentId>(sel.agents ?? ALL_AGENTS);
  const outputs = [
    ...emitAgentsMd(ctx),
    ...(agents.has("claude") ? emitClaude(ctx) : []),
    ...(agents.has("copilot") ? emitCopilot(ctx) : []),
    ...(agents.has("cursor") ? emitCursor(ctx) : []),
    ...(agents.has("junie") ? emitJunie(ctx) : []),
    ...emitCatalog(ctx),
    ...skillOutputs(ctx, agents),
  ];
  // README carries a generated overview region; splice it in only for self-generation (never an install
  // into a target repo) and only when the markers are present.
  if (sel.readme) {
    const readmePath = join(root, "README.md");
    if (existsSync(readmePath)) {
      const existing = readText(readmePath);
      if (existing.includes(README_BEGIN)) {
        outputs.push({ path: "README.md", content: spliceReadme(existing, readmeOverviewBlock(ctx)) });
      }
    }
  }
  // Stable order by path.
  return outputs.sort((a, b) => a.path.localeCompare(b.path));
}

function actualGeneratedFiles(root: string): string[] {
  return fg.sync(GENERATED_GLOBS, { cwd: root, dot: true, onlyFiles: true }).sort();
}

export interface GenerateResult {
  written: number;
  removed: number;
}

export function writeGenerated(root: string): GenerateResult {
  const outputs = collectOutputs(root, { readme: true });
  const expected = new Set(outputs.map((o) => o.path.split("\\").join("/")));
  // Remove stale generated files first.
  let removed = 0;
  for (const rel of actualGeneratedFiles(root)) {
    if (!expected.has(rel)) {
      rmSync(join(root, rel));
      removed++;
    }
  }
  for (const o of outputs) writeText(join(root, o.path), o.content);
  // Clean up now-empty generated directories.
  pruneEmptyDirs(root);
  return { written: outputs.length, removed };
}

export interface ApplyResult { written: string[]; removed: string[]; }

/**
 * Write outputs into a TARGET repo, pruning ONLY the files the previous install managed (passed in from the
 * manifest), never via a glob - a glob prune would delete the target's own `.claude/` content. Used by `install`.
 */
export function applyOutputs(targetRoot: string, outputs: OutputFile[], prevManaged: string[] = []): ApplyResult {
  const next = new Set(outputs.map((o) => o.path.split("\\").join("/")));
  const removed: string[] = [];
  for (const rel of prevManaged) {
    if (next.has(rel)) continue;
    const abs = join(targetRoot, rel);
    if (existsSync(abs)) {
      rmSync(abs);
      removed.push(rel);
    }
  }
  for (const o of outputs) writeText(join(targetRoot, o.path), o.content);
  pruneEmptyDirs(targetRoot);
  return { written: [...next].sort(), removed: removed.sort() };
}

function pruneEmptyDirs(root: string): void {
  const roots = [".claude", ".github", ".cursor", ".junie"];
  const walk = (dir: string): void => {
    if (!existsSync(dir) || !statSync(dir).isDirectory()) return;
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
    }
    if (readdirSync(dir).length === 0) rmSync(dir, { recursive: true, force: true });
  };
  for (const r of roots) walk(join(root, r));
}

export interface DriftEntry {
  path: string;
  kind: "missing" | "changed" | "stale";
}

export function checkGenerated(root: string): DriftEntry[] {
  const outputs = collectOutputs(root, { readme: true });
  const expected = new Map(outputs.map((o) => [o.path.split("\\").join("/"), o.content]));
  const drift: DriftEntry[] = [];
  for (const [rel, content] of expected) {
    const abs = join(root, rel);
    if (!existsSync(abs)) drift.push({ path: rel, kind: "missing" });
    else if (readFileSync(abs, TEXT_EXT.test(abs) ? "utf8" : "latin1") !== content) drift.push({ path: rel, kind: "changed" });
  }
  for (const rel of actualGeneratedFiles(root)) {
    if (!expected.has(rel)) drift.push({ path: rel, kind: "stale" });
  }
  return drift.sort((a, b) => a.path.localeCompare(b.path));
}

export function printDrift(drift: DriftEntry[]): void {
  if (drift.length === 0) {
    process.stdout.write(pc.green("✓ generated files are in sync with .agentkit/\n"));
    return;
  }
  process.stdout.write(pc.red(`✗ ${drift.length} generated file(s) out of sync with .agentkit/ — run \`pnpm generate\`:\n`));
  for (const d of drift) {
    const tag = d.kind === "missing" ? pc.yellow("missing") : d.kind === "stale" ? pc.magenta("stale  ") : pc.red("changed");
    process.stdout.write(`  ${tag}  ${d.path}\n`);
  }
}
