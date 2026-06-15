import fg from "fast-glob";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, relative } from "node:path";
import { countLines, parseFrontmatter } from "./util.js";
import {
  bannerNoiseFindings,
  citationTierFindings,
  descriptionFindings,
  emDashFindings,
  ghostRefFindings,
  localLinkFindings,
  nameFindings,
  orderingFindings,
  pointerBodyFindings,
  routingTableFindings,
  BUDGETS,
} from "./rules.js";
import { err, info, warn, type Finding } from "./findings.js";

const IGNORE = [
  "**/node_modules/**", "**/.git/**", "**/dist/**", "**/.next/**", "**/build/**",
  // Installer state under .agentkit/: vendored CLI + backups are not the target's native agent files.
  "**/.agentkit/cli/**", "**/.agentkit/backups/**",
];

export type Kind = "memory" | "skill" | "rule" | "prompt" | "agent" | "reference" | "generic";

export interface Native {
  abs: string;
  rel: string;
  kind: Kind;
}

/** Per-run context shared across files: which subagents/skills exist, so rules can reason about mirrors. */
interface Ctx {
  root: string;
  agentNames: Set<string>;
  canonicalSkills: Set<string>;
}

/** Inventory the native agent files already present in a repo (shared by `doctor` and the installer's discover). */
export function discoverNative(root: string): Native[] {
  const found = new Map<string, Kind>();
  const add = (files: string[], kind: Kind) => {
    for (const f of files) if (!found.has(f)) found.set(f, kind);
  };
  const glob = (patterns: string[]) => fg.sync(patterns, { cwd: root, absolute: true, dot: true, ignore: IGNORE });

  add(glob(["**/CLAUDE.md", "**/AGENTS.md", "**/AGENT.md", ".github/copilot-instructions.md", ".junie/guidelines.md"]), "memory");
  // SKILL.md under an agents/subagents dir is a subagent mirror, not a skill — scan it as an agent.
  add(glob(["**/SKILL.md", "!**/agents/**", "!**/subagents/**"]), "skill");
  add(glob([".cursor/rules/**/*.mdc", ".junie/rules/**/*.md", ".github/instructions/**/*.instructions.md", ".claude/rules/**/*.md"]), "rule");
  add(glob([".github/prompts/**/*.prompt.md", ".claude/commands/**/*.md", ".cursor/commands/**/*.md"]), "prompt");
  add(
    glob([
      ".github/agents/**/*.agent.md",
      ".claude/agents/**/*.md",
      ".junie/agents/**/*.md",
      ".junie/subagents/**/*.md",
      ".github/chatmodes/**/*.chatmode.md",
    ]),
    "agent",
  );
  // Agent reference docs (deep Tier-3 material) — TOC + link checks, not skill/agent metadata rules.
  add(glob(["docs/agents/**/*.md", "**/.agents/**/*.md"]), "reference");

  return [...found.entries()].map(([abs, kind]) => ({ abs, rel: relative(root, abs), kind })).sort((a, b) => a.rel.localeCompare(b.rel));
}

/** Derive the skill name a mirror file stands for (`.github/agents/<x>.agent.md`, `.junie/skills/<x>/SKILL.md`, …). */
function mirrorSkillName(rel: string): string | null {
  const norm = rel.replace(/\\/g, "/");
  let m = norm.match(/(?:^|\/)\.github\/agents\/(.+)\.agent\.md$/);
  if (m) return m[1] ?? null;
  m = norm.match(/(?:^|\/)\.junie\/skills\/(.+)\/SKILL\.md$/);
  if (m) return m[1] ?? null;
  return null;
}

function isCanonicalSkill(rel: string): boolean {
  return /(?:^|\/)\.claude\/skills\/[^/]+\/SKILL\.md$/.test(rel.replace(/\\/g, "/"));
}

/** Parse frontmatter without crashing on malformed YAML; a parse failure becomes a finding instead. */
export function safeMatter(raw: string, rel: string): { data: Record<string, unknown>; content: string; error?: Finding } {
  try {
    return parseFrontmatter(raw);
  } catch (e) {
    const first = (e instanceof Error ? e.message : String(e)).split("\n")[0];
    return {
      data: {},
      content: raw,
      error: err(
        "frontmatter-unparseable",
        rel,
        `frontmatter does not parse as YAML: ${first}. Common cause: an unquoted value containing ": " (colon-space) or a leading special character — quote the value or rephrase.`,
      ),
    };
  }
}

function lintNative(n: Native, ctx: Ctx): Finding[] {
  const raw = readFileSync(n.abs, "utf8");
  const { data: fm, content: body, error } = safeMatter(raw, n.rel);
  if (error) return [error];
  const base = dirname(n.abs);
  const f: Finding[] = [];
  // Em dashes are disallowed in any authored prose; every kind below returns this same `f`.
  f.push(...emDashFindings(n.rel, body));

  if (n.kind === "memory") {
    const lines = countLines(raw);
    const bytes = Buffer.byteLength(raw);
    if (lines > BUDGETS.MEMORY_LINES || bytes > BUDGETS.MEMORY_BYTES)
      f.push(warn("memory-size", n.rel, `memory file is ${lines} lines / ${(bytes / 1024).toFixed(1)}KB; keep under ${BUDGETS.MEMORY_LINES} lines / 25KB`));
    f.push(...orderingFindings(n.rel, body));
    f.push(...localLinkFindings(n.rel, body, base, { strict: false }));
    f.push(...ghostRefFindings(n.rel, body, base, ctx.root));
    f.push(...routingTableFindings(n.rel, body, ctx.agentNames));
    f.push(...bannerNoiseFindings(n.rel, body));
    f.push(...citationTierFindings(n.rel, body));
    return f;
  }

  if (n.kind === "reference") {
    f.push(...orderingFindings(n.rel, body, { gotchas: false })); // TOC + links only; gotchas is noise on reference docs
    f.push(...localLinkFindings(n.rel, body, base, { strict: false }));
    f.push(...ghostRefFindings(n.rel, body, base, ctx.root));
    f.push(...bannerNoiseFindings(n.rel, body)); // citations are fine in the reference tier; banners are not
    return f;
  }

  if (n.kind === "skill") {
    const name = fm.name as string | undefined;
    const desc = fm.description as string | undefined;
    if (typeof name === "string") f.push(...nameFindings(n.rel, name, { kebab: true }));
    if (typeof desc === "string") f.push(...descriptionFindings(n.rel, desc));
    const lines = countLines(body);
    if (lines >= BUDGETS.SKILL_LINES_MAX) f.push(warn("skill-lines", n.rel, `SKILL.md body ${lines} lines; keep under ${BUDGETS.SKILL_LINES_MAX}`));
    const mirror = mirrorSkillName(n.rel);
    f.push(...pointerBodyFindings(n.rel, body, { redundantMirror: !!mirror && ctx.canonicalSkills.has(mirror) }));
    f.push(...orderingFindings(n.rel, body));
    f.push(...localLinkFindings(n.rel, body, base));
    f.push(...ghostRefFindings(n.rel, body, base, ctx.root));
    f.push(...bannerNoiseFindings(n.rel, body));
    f.push(...citationTierFindings(n.rel, body));
    return f;
  }

  // rule / prompt / agent / generic
  const name = fm.name as string | undefined;
  const desc = fm.description as string | undefined;
  if (n.kind === "agent" && typeof name === "string") f.push(...nameFindings(n.rel, name, { kebab: true }));
  // For rules, `description` is a title/label, not a router — only check router quality on agents/prompts.
  if (typeof desc === "string" && (n.kind === "agent" || n.kind === "prompt")) f.push(...descriptionFindings(n.rel, desc));
  if (n.kind === "agent") {
    const mirror = mirrorSkillName(n.rel);
    f.push(...pointerBodyFindings(n.rel, body, { redundantMirror: !!mirror && ctx.canonicalSkills.has(mirror) }));
  }
  f.push(...orderingFindings(n.rel, body));
  f.push(...localLinkFindings(n.rel, body, base, { strict: false }));
  f.push(...ghostRefFindings(n.rel, body, base, ctx.root));
  f.push(...bannerNoiseFindings(n.rel, body));
  return f;
}

/** Identical non-trivial lines repeated across memory files — one fact should have one home. */
function duplicateBlockFindings(natives: Native[]): Finding[] {
  const seen = new Map<string, string[]>();
  for (const n of natives) {
    if (n.kind !== "memory") continue;
    let body = "";
    try {
      body = parseFrontmatter(readFileSync(n.abs, "utf8")).content;
    } catch {
      continue; // unparseable frontmatter is reported by lintNative
    }
    const lines = new Set(
      body
        .split("\n")
        .map((l) => l.trim())
        // Skip headings, tables, quotes, list items, code fences, and HTML comments/banners (e.g. the GENERATED banner).
        .filter((l) => l.length >= 60 && !/^[#|>`*<-]/.test(l) && !/GENERATED/.test(l)),
    );
    for (const l of lines) seen.set(l, [...(seen.get(l) ?? []), n.rel]);
  }
  const f: Finding[] = [];
  for (const [line, files] of seen) {
    if (files.length >= 2)
      f.push(info("duplicate-block", files[1]!, `line duplicated across ${files.join(", ")} — keep one home: "${line.slice(0, 60)}…"`));
  }
  return f;
}

/**
 * Redirect-stub subagents + a hand-maintained routing table = a split role identity. The individual
 * `pointer-body` and `routing-table` findings are easy to wave off one by one; surfaced together they
 * name the real architectural fix: collapse into self-contained subagents routed by description.
 */
export function splitIdentityFindings(findings: Finding[]): Finding[] {
  const hollow = findings.filter((f) => f.rule === "pointer-body" && f.message.startsWith("pointer body"));
  const tables = findings.filter((f) => f.rule === "routing-table");
  if (hollow.length === 0 || tables.length === 0) return [];
  return [
    warn(
      "split-identity",
      tables[0]!.file,
      `role identity is split across ${hollow.length} redirect-stub subagent(s) and ${tables.length} routing table(s) — ` +
        `collapse to self-contained subagents: inline each identity into its agent file (routed by \`description\`), then delete the parallel identity docs and the routing table(s). Address this early; don't keep the split as an "intentional" deviation.`,
    ),
  ];
}

export interface DoctorResult {
  files: number;
  findings: Finding[];
  fixed: number;
}

/** Diagnose (and optionally safe-fix) the native agent files already present in any repo. */
export function runDoctor(root: string, opts: { fix?: boolean } = {}): DoctorResult {
  const natives = discoverNative(root);
  const ctx: Ctx = {
    root,
    agentNames: new Set(
      natives
        .filter((n) => n.kind === "agent")
        .map((n) => {
          try {
            return String((parseFrontmatter(readFileSync(n.abs, "utf8")).data).name ?? "").trim();
          } catch {
            return "";
          }
        })
        .filter(Boolean),
    ),
    canonicalSkills: new Set(
      natives.filter((n) => n.kind === "skill" && isCanonicalSkill(n.rel)).map((n) => n.rel.replace(/\\/g, "/").replace(/.*\.claude\/skills\/([^/]+)\/SKILL\.md$/, "$1")),
    ),
  };
  const findings: Finding[] = [];
  let fixed = 0;
  for (const n of natives) {
    findings.push(...lintNative(n, ctx));
    if (opts.fix) fixed += applySafeFixes(n.abs);
  }
  findings.push(...duplicateBlockFindings(natives));
  findings.push(...splitIdentityFindings(findings));
  return { files: natives.length, findings, fixed };
}

/** Only truly safe, format-level repairs. Structural fixes (ordering, rewriting descriptions) stay manual. */
function applySafeFixes(abs: string): number {
  const raw = readFileSync(abs, "utf8");
  let next = raw.replace(/[ \t]+$/gm, "");
  if (!next.endsWith("\n")) next += "\n";
  next = next.replace(/\n{4,}/g, "\n\n\n");
  if (next !== raw) {
    writeFileSync(abs, next, "utf8");
    return 1;
  }
  return 0;
}
