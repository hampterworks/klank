import { existsSync, readdirSync, statSync } from "node:fs";
import { dirname, isAbsolute, join, relative } from "node:path";
import {
  containsXmlTag,
  countLines,
  hasTableOfContents,
  isKebabCase,
  markdownLinks,
  readText,
} from "./util.js";
import { err, info, warn, type Finding } from "./findings.js";
import { knownFrontmatterKeys } from "./schema.js";
import type { ContentType, ParsedItem } from "./model.js";

/** Budgets: OFFICIAL values from Anthropic docs; [heuristic] values are ours, labelled in docs. */
export const BUDGETS = {
  NAME_MAX: 64, // official
  DESC_MAX: 1024, // official
  DESC_WARN: 200, // [heuristic] discoverability in many-skill libraries
  SKILL_LINES_WARN: 250, // [heuristic]
  SKILL_LINES_MAX: 500, // official: "under 500 lines"
  REF_LINES_TOC: 100, // official: TOC for reference files >100 lines
  REF_LINES_SPLIT: 300, // [heuristic] split large references
  MEMORY_LINES: 200, // official guidance for CLAUDE.md/AGENTS.md
  MEMORY_BYTES: 25 * 1024, // official: ~25KB
  METADATA_WARN_BYTES: 12 * 1024, // [heuristic] headroom under the ceiling
  METADATA_MAX_BYTES: 16 * 1024, // community-verified metadata ceiling
  PER_SKILL_OVERHEAD: 109, // approx XML/path overhead per advertised skill
} as const;

const RESERVED = ["anthropic", "claude"];
const FIRST_PERSON = /^\s*(i\s|i'|we\s|we'|you\s|you'|let me\b|i can\b|you can\b)/i;
const EM_DASH = "—"; // — : an em dash; authored prose uses a comma/semicolon/colon/hyphen instead

// Clutter and hedges plain-language guidance (Zinsser/Hemingway/caveman) says to cut. Tight list,
// longest phrases first, /g so String.match returns every hit. Few false positives by design.
const CLUTTER = /\b(?:in order to|it is important|note that|basically|actually|simply|really|quite|just|very|please)\b/gi;
// `-ing` words that are ordinary nouns, not gerundised verbs — exempt from the name-gerund check.
const NON_GERUND_ING = new Set(["thing", "string", "ring", "spring", "morning"]);

/* ------------------------------------------------------------------ */
/* Granular, reusable rule helpers (shared by validate AND doctor)     */
/* ------------------------------------------------------------------ */

export function nameFindings(file: string, name: string, opts: { kebab?: boolean } = {}): Finding[] {
  const f: Finding[] = [];
  if (containsXmlTag(name)) f.push(err("name-xml", file, `name must not contain XML tags: "${name}"`));
  for (const r of RESERVED) {
    if (name.toLowerCase().includes(r)) f.push(err("name-reserved", file, `name must not contain reserved word "${r}": "${name}"`));
  }
  if (opts.kebab && !isKebabCase(name)) f.push(err("name-kebab", file, `name must be kebab-case (lowercase, hyphens): "${name}"`));
  if (name.length > BUDGETS.NAME_MAX) f.push(err("name-length", file, `name exceeds ${BUDGETS.NAME_MAX} chars (${name.length})`));
  // Name the action with a base verb, not a gerund: skills are `<domain>-<verb>` (review, not reviewing).
  const action = name.split("-").pop() ?? "";
  if (/[a-z]{2,}ing$/i.test(action) && !NON_GERUND_ING.has(action.toLowerCase()))
    f.push(warn("name-gerund", file, `name ends in the gerund "${action}"; prefer the base imperative verb (e.g. "review" not "reviewing")`));
  return f;
}

export function descriptionFindings(file: string, description: string): Finding[] {
  const f: Finding[] = [];
  const d = description.trim();
  if (containsXmlTag(d)) f.push(err("desc-xml", file, "description must not contain XML tags"));
  if (d.includes(EM_DASH))
    f.push(warn("em-dash", file, "description uses an em dash (—); use a comma, semicolon, or a spaced hyphen (a colon-space would break frontmatter parsing)"));
  if (d.length > BUDGETS.DESC_MAX) f.push(err("desc-length", file, `description exceeds ${BUDGETS.DESC_MAX} chars (${d.length})`));
  else if (d.length > BUDGETS.DESC_WARN)
    f.push(warn("desc-length", file, `description is ${d.length} chars; aim ≤${BUDGETS.DESC_WARN} for discoverability (metadata budget)`));
  if (FIRST_PERSON.test(d)) f.push(warn("desc-person", file, 'write descriptions in third person (avoid "I"/"you can…")'));
  if (!/\b(use\s+(when|after|before|during|once|while)|when |after |before |during |whenever|each\s+time|once |upon |on |for )\b/i.test(d))
    f.push(warn("desc-trigger", file, 'description should say WHEN to use it (e.g. "Use when …") so it routes well'));
  const clutter = d.match(CLUTTER);
  if (clutter) {
    const uniq = [...new Set(clutter.map((c) => c.toLowerCase()))];
    f.push(warn("desc-clutter", file, `cut clutter/hedge from the description: ${uniq.slice(0, 3).join(", ")}`));
  }
  return f;
}

/* ------------------------------------------------------------------ */
/* Structural smells the doctor surfaces in foreign repos              */
/* ------------------------------------------------------------------ */

const POINTER_LINE = /^(see|read|apply)\b/i;

/** First `.md` path a pointer body redirects to (the parallel identity/role doc), if any. */
function pointerTarget(body: string): string | null {
  const m = body.match(/`([\w./-]+\.md)`/) ?? body.match(/\b([\w./-]+\.md)\b/);
  return m?.[1] ?? null;
}

/** True when a body, stripped of frontmatter/headings, is essentially just a redirect to another file. */
export function isPointerBody(body: string): boolean {
  const lines = body
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && l !== "---" && !l.startsWith("#"));
  if (lines.length === 0 || lines.length > 2) return false;
  return lines.every(
    (l) => POINTER_LINE.test(l) || /\$ARGUMENTS/.test(l) || /follow (its|the) (process|instructions)/i.test(l),
  );
}

/**
 * Flag a skill/subagent/agent whose body only redirects to another file. A per-skill mirror of an
 * existing `.claude/skills/<x>` is redundant (Copilot auto-discovers that dir, Junie imports it); any
 * other pointer body is a hollow agent whose identity lives in a parallel doc — that split (stub +
 * parallel doc + routing table) drifts, so inline the identity into the body and delete the parallel doc.
 */
export function pointerBodyFindings(file: string, body: string, opts: { redundantMirror?: boolean } = {}): Finding[] {
  if (!isPointerBody(body)) return [];
  if (opts.redundantMirror)
    return [
      warn(
        "pointer-body",
        file,
        "redundant skill mirror: body only redirects to .claude/skills/ — Copilot auto-discovers that directory and Junie imports it, so this stub can be removed (see docs/compatibility-matrix.md)",
      ),
    ];
  const tgt = pointerTarget(body);
  const msg =
    `pointer body: a subagent's body must be its real system prompt, not a redirect${tgt ? ` to \`${tgt}\`` : ""}. ` +
    `Inline the identity here${tgt ? ` and delete \`${tgt}\` plus any role-routing table` : ""} — a stub + parallel identity doc + routing table is a split identity that drifts.`;
  return [warn("pointer-body", file, msg)];
}

const PATH_MD = /`([\w.-]+(?:\/[\w.-]+)+\.md)`/g;

/** Backtick-quoted path-like `.md` references that resolve to no file (the markdown-link checker only sees `[..](..)`). */
export function ghostRefFindings(file: string, body: string, baseDir: string, root: string): Finding[] {
  const f: Finding[] = [];
  const seen = new Set<string>();
  for (const m of body.matchAll(PATH_MD)) {
    const tok = m[1];
    if (!tok || seen.has(tok) || tok.includes("..") || /[*<>]/.test(tok)) continue;
    seen.add(tok);
    if (existsSync(join(root, tok)) || existsSync(join(baseDir, tok))) continue;
    f.push(warn("ref-ghost", file, `referenced file does not exist: \`${tok}\``));
  }
  return f;
}

// Backtick-quoted kebab token: a candidate skill/instruction/group NAME reference.
const NAME_TOKEN = /`([a-z0-9]+(?:-[a-z0-9]+)*)`/g;

/** Every backtick kebab token in a body (candidate skill/instruction/group references); shared by the installer. */
export function scanRefTokens(body: string): string[] {
  return [...body.matchAll(NAME_TOKEN)].map((m) => m[1] ?? "").filter(Boolean);
}

/** True when a and b are equal or one insert/delete/substitution apart. */
function editDistanceAtMost1(a: string, b: string): boolean {
  if (a === b) return true;
  const [s, l] = a.length <= b.length ? [a, b] : [b, a];
  if (l.length - s.length > 1) return false;
  if (l.length === s.length) {
    let diffs = 0;
    for (let i = 0; i < s.length; i++) if (s[i] !== l[i] && ++diffs > 1) return false;
    return diffs === 1;
  }
  for (let i = 0; i < l.length; i++) if (l.slice(0, i) + l.slice(i + 1) === s) return true;
  return false;
}

/**
 * Backtick references to a skill/instruction NAME that don't resolve - the sibling of ghostRefFindings,
 * which only sees path-like `.md` tokens. Calibrated for near-zero false positives: a bare group name reads
 * as a mis-reference (info), and a `<group>-<word>` token one edit from a real skill is a typo (warn).
 * Generic hyphenated terms (`design-system`, `type-safe`, `setup-node`) are left alone.
 */
export function refNameFindings(items: ParsedItem[]): Finding[] {
  const f: Finding[] = [];
  const ids = new Set(items.map((i) => i.id));
  const skillNames = items.filter((i) => i.type === "skill").map((i) => i.id);
  const groups = new Set(items.map((i) => i.group).filter((g): g is string => !!g));
  for (const item of items) {
    if (!item.body) continue;
    const seen = new Set<string>();
    for (const m of item.body.matchAll(NAME_TOKEN)) {
      const tok = m[1];
      if (!tok || seen.has(tok) || ids.has(tok)) continue;
      seen.add(tok);
      if (groups.has(tok) && tok !== "agentkit") {
        // `agentkit` is also the CLI/package name, so a backtick on it is usually a legitimate tool reference.
        f.push(info("ref-name", item.relPath, `\`${tok}\` is a group, not a skill; reference a specific skill or drop the backticks`));
      } else if (tok.includes("-")) {
        const near = skillNames.find((s) => editDistanceAtMost1(tok, s));
        if (near) f.push(warn("ref-name", item.relPath, `unknown reference \`${tok}\`; did you mean \`${near}\`?`));
      }
    }
  }
  return f;
}

const SCRATCH = /\.(tmp|bak|orig|rej)$|~$/i;

/** Scratch/backup files have no place in version control (the skill-loader glob and markdownlint ignore them). */
export function scratchFileFindings(relPaths: string[]): Finding[] {
  return relPaths
    .filter((p) => SCRATCH.test(p))
    .map((p) => warn("scratch-file", p, "scratch/backup file under .agentkit/; delete it (these are now gitignored)"));
}

/** A memory file carrying a markdown table that names several subagents is a hand-maintained routing table. */
export function routingTableFindings(file: string, body: string, agentNames: Set<string>): Finding[] {
  if (agentNames.size === 0) return [];
  if (!/\|\s*:?-{3,}/.test(body)) return []; // no markdown table separator
  let hits = 0;
  for (const n of agentNames) if (n && body.includes(n)) hits++;
  if (hits >= 3)
    return [
      info(
        "routing-table",
        file,
        `table references ${hits} subagents; routing is by \`description\` — a hand-maintained routing table duplicates it and drifts`,
      ),
    ];
  return [];
}

const BANNER = /<!--[^>]*\b(generated|do not edit|auto-?generated)\b[^>]*-->/i;

/** Per-file "GENERATED / do not edit" banners are token waste in context files — state the rule once. */
export function bannerNoiseFindings(file: string, body: string): Finding[] {
  if (!BANNER.test(body)) return [];
  return [
    info(
      "banner-noise",
      file,
      'redundant "generated/do-not-edit" banner in a context file — state it once (e.g. AGENTS.md) and tag generated paths in .gitattributes, not per-file',
    ),
  ];
}

// Local / example / reserved hosts are functional URLs in a procedure, not citations.
const FUNCTIONAL_URL = /\/\/(localhost|127\.|0\.0\.0\.0|10\.|192\.168\.|\[?::1|[\w.-]*\.(?:local|invalid|test|example))/i;

/**
 * A URL earns its place only if an agent would open it to do the task (a spec it works against, a tool's
 * rules page, canonical docs for exact details); pure provenance is noise. Surviving citations belong in a
 * `## References`/`## Sources` section or a reference doc, not scattered through prose or routing metadata.
 * Functional URLs (localhost, example hosts) and anything inside a code fence or the References section are ignored.
 */
export function citationTierFindings(file: string, body: string): Finding[] {
  const scan = body
    .replace(/```[\s\S]*?```/g, "") // functional commands in fenced code
    .replace(/^#{1,6}\s*(references|sources|see also|links)\b[\s\S]*$/im, ""); // the designated citation home
  const stray = (scan.match(/https?:\/\/[^\s)`"'<>]+/gi) ?? []).filter((u) => !FUNCTIONAL_URL.test(u));
  if (stray.length === 0) return [];
  return [info("citation-tier", file, `keep a source URL only if an agent needs it for the task, else drop it; move any survivor to a \`## Sources\` section or reference doc, not inline prose: ${stray[0]}`)];
}

/**
 * Em dashes (—) are disallowed in authored prose: a comma, semicolon, colon, or spaced hyphen reads the
 * same and keeps the text plain ASCII. Fenced and inline code are ignored (a `—` literal in an example is
 * not prose; reference the character itself by wrapping it in backticks).
 */
export function emDashFindings(file: string, body: string): Finding[] {
  const scan = body.replace(/```[\s\S]*?```/g, "").replace(/`[^`\n]*`/g, "");
  const n = (scan.match(/—/g) ?? []).length;
  if (n === 0) return [];
  return [warn("em-dash", file, `em dash (—) used ${n}×; replace with a comma, semicolon, colon, or a spaced hyphen`)];
}

/**
 * Prose smells in a body (info-level, to surface tightening targets, never block): clutter/hedge words
 * the language rule says to cut, and overlong sentences. Code fences and inline code are ignored.
 */
export function proseFindings(file: string, body: string): Finding[] {
  const scan = body.replace(/```[\s\S]*?```/g, "").replace(/`[^`\n]*`/g, "");
  const f: Finding[] = [];
  const hits = scan.match(CLUTTER);
  if (hits) {
    const uniq = [...new Set(hits.map((h) => h.toLowerCase()))];
    f.push(info("prose-clutter", file, `cut clutter/hedge word${uniq.length > 1 ? "s" : ""}: ${uniq.slice(0, 5).join(", ")}`));
  }
  const longest = scan
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .reduce((max, s) => Math.max(max, s.trim().split(/\s+/).filter(Boolean).length), 0);
  if (longest > 35) f.push(info("prose-long-sentence", file, `longest sentence is ~${longest} words; split into shorter declaratives (aim ≤25)`));
  return f;
}

/** Generic markdown-body checks usable on any agent file (skills, docs, native CLAUDE.md, etc.). */
export function orderingFindings(file: string, body: string, opts: { gotchas?: boolean } = {}): Finding[] {
  const f: Finding[] = [];
  const lines = countLines(body);
  if (lines > BUDGETS.REF_LINES_TOC && !hasTableOfContents(body))
    f.push(warn("toc-missing", file, `file has ${lines} lines (>${BUDGETS.REF_LINES_TOC}); add a Table of Contents near the top`));
  if (opts.gotchas !== false && lines > 40 && !/\bgotcha|caveat|pitfall|known issue/i.test(body))
    f.push(info("gotchas-missing", file, "consider a Gotchas section near the end (edge cases accrete here, not in main instructions)"));
  return f;
}

/**
 * Local-link integrity: dead links + backslashes always; the one-level-deep and "don't escape the item
 * directory" checks only when `strict` (i.e. for content items like SKILL.md, not cross-linking docs).
 */
export function localLinkFindings(file: string, body: string, baseDir: string, opts: { strict?: boolean } = {}): Finding[] {
  const strict = opts.strict !== false;
  const f: Finding[] = [];
  for (const { target } of markdownLinks(body)) {
    if (/^[a-z]+:/i.test(target) || target.startsWith("#") || target.startsWith("mailto:")) continue; // external/anchor → lychee
    if (target.includes("\\")) f.push(err("path-backslash", file, `use forward slashes in link target: "${target}"`));
    const clean = target.split("#")[0] ?? target;
    if (!clean) continue;
    if (strict && clean.includes("..")) f.push(warn("ref-escape", file, `reference escapes the item directory: "${target}"`));
    const abs = isAbsolute(clean) ? clean : join(baseDir, clean);
    if (!existsSync(abs)) {
      f.push(err("ref-dead", file, `broken local reference: "${target}"`));
      continue;
    }
    // One-level-deep: a referenced .md that itself links to more local .md is a nested chain.
    if (strict && /\.md$/i.test(clean)) {
      try {
        const sub = readText(abs);
        const subBase = dirname(abs);
        const nested = markdownLinks(sub).some((l) => {
          if (/^[a-z]+:/i.test(l.target) || l.target.startsWith("#")) return false;
          const t = (l.target.split("#")[0] ?? "").trim();
          return /\.md$/i.test(t) && existsSync(join(subBase, t));
        });
        if (nested) f.push(warn("ref-nested", file, `reference "${target}" links onward to more files; keep references one level deep`));
      } catch {
        /* ignore */
      }
    }
  }
  return f;
}

export function unknownKeyFindings(item: ParsedItem): Finding[] {
  const known = new Set(knownFrontmatterKeys(item.type));
  if (known.size === 0) return [];
  const out: Finding[] = [];
  for (const k of Object.keys(item.frontmatter)) {
    if (!known.has(k)) out.push(info("unknown-key", item.relPath, `unrecognized frontmatter key "${k}" (typo?)`));
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Item-level linting over the canonical .agentkit/ tree                 */
/* ------------------------------------------------------------------ */

function skillStructureFindings(item: ParsedItem): Finding[] {
  const f: Finding[] = [];
  const lines = countLines(item.body);
  if (lines >= BUDGETS.SKILL_LINES_MAX) f.push(err("skill-lines", item.relPath, `SKILL.md body has ${lines} lines; keep under ${BUDGETS.SKILL_LINES_MAX}`));
  else if (lines > BUDGETS.SKILL_LINES_WARN) f.push(warn("skill-lines", item.relPath, `SKILL.md body has ${lines} lines; aim ≤${BUDGETS.SKILL_LINES_WARN} (progressive disclosure)`));
  f.push(...orderingFindings(item.relPath, item.body));
  f.push(...localLinkFindings(item.relPath, item.body, item.dir));
  // grep-hint heuristic for large reference sets.
  const refGlobLarge = ["references", "reference"].some((d) => {
    const dir = join(item.dir, d);
    if (!existsSync(dir)) return false;
    try {
      const cnt = readDirMdCount(dir);
      return cnt >= 3;
    } catch {
      return false;
    }
  });
  if (refGlobLarge && !/\bgrep\b/i.test(item.body))
    f.push(info("grep-hint", item.relPath, "large reference set: add a grep hint in SKILL.md to help retrieval"));
  return f;
}

function readDirMdCount(dir: string): number {
  return readdirSync(dir).filter((n: string) => /\.md$/i.test(n)).length;
}

function referenceFileFindings(item: ParsedItem, root: string): Finding[] {
  if (item.type !== "skill") return [];
  const out: Finding[] = [];
  const scan = (dir: string) => {
    if (!existsSync(dir)) return;
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      const st = statSync(p);
      if (st.isDirectory()) {
        scan(p);
        continue;
      }
      if (!/\.md$/i.test(name)) continue;
      if (p === item.srcPath) continue;
      const body = readText(p);
      const lines = countLines(body);
      const rel = relative(root, p);
      if (lines > BUDGETS.REF_LINES_TOC && !hasTableOfContents(body))
        out.push(warn("toc-missing", rel, `reference file has ${lines} lines (>${BUDGETS.REF_LINES_TOC}); add a Table of Contents`));
      if (lines > BUDGETS.REF_LINES_SPLIT)
        out.push(info("ref-split", rel, `reference file has ${lines} lines; consider splitting (>${BUDGETS.REF_LINES_SPLIT})`));
    }
  };
  scan(item.dir);
  return out;
}

export interface MetadataEntry {
  id: string;
  bytes: number;
}
export interface MetadataReport {
  entries: MetadataEntry[];
  totalBytes: number;
  warn: boolean;
  over: boolean;
}

export function metadataBudget(skills: ParsedItem[]): MetadataReport {
  const entries = skills.map((s) => {
    const name = String(s.frontmatter.name ?? s.id);
    const desc = String(s.frontmatter.description ?? "");
    return { id: s.id, bytes: name.length + desc.length + BUDGETS.PER_SKILL_OVERHEAD };
  });
  const totalBytes = entries.reduce((a, e) => a + e.bytes, 0);
  return {
    entries,
    totalBytes,
    warn: totalBytes > BUDGETS.METADATA_WARN_BYTES,
    over: totalBytes > BUDGETS.METADATA_MAX_BYTES,
  };
}

/** Full lint over canonical items: schema is run separately; this is the semantic rule-set. */
export function lintItems(items: ParsedItem[], root: string): Finding[] {
  const f: Finding[] = [];

  for (const item of items) {
    f.push(...unknownKeyFindings(item));
    const name = item.frontmatter.name as string | undefined;
    const description = item.frontmatter.description as string | undefined;

    if (typeof name === "string") {
      const kebab = item.type === "skill" || item.type === "subagent" || item.type === "command";
      f.push(...nameFindings(item.relPath, name, { kebab }));
    }
    if (typeof description === "string") f.push(...descriptionFindings(item.relPath, description));
    f.push(...emDashFindings(item.relPath, item.body));
    f.push(...proseFindings(item.relPath, item.body));

    if (item.type === "skill") {
      f.push(...skillStructureFindings(item));
      f.push(...referenceFileFindings(item, root));
    }
    if (item.type === "instruction" || item.type === "subagent" || item.type === "command") {
      f.push(...orderingFindings(item.relPath, item.body));
    }
    if (item.type === "subagent" || item.type === "skill") {
      f.push(...pointerBodyFindings(item.relPath, item.body));
    }
  }

  f.push(...uniquenessFindings(items));
  f.push(...refNameFindings(items));

  // Total skill-metadata ceiling.
  const skills = items.filter((i) => i.type === "skill");
  const meta = metadataBudget(skills);
  if (meta.over)
    f.push(err("metadata-ceiling", ".agentkit/skills", `total skill metadata ${fmtKB(meta.totalBytes)} exceeds ${fmtKB(BUDGETS.METADATA_MAX_BYTES)} ceiling (Claude hides skills past this)`));
  else if (meta.warn)
    f.push(warn("metadata-ceiling", ".agentkit/skills", `total skill metadata ${fmtKB(meta.totalBytes)} > ${fmtKB(BUDGETS.METADATA_WARN_BYTES)} warn threshold`));

  return f;
}

function fmtKB(bytes: number): string {
  return `${(bytes / 1024).toFixed(1)}KB`;
}

function uniquenessFindings(items: ParsedItem[]): Finding[] {
  const f: Finding[] = [];
  // Skills and commands both create /<name> in Claude Code → must be unique together.
  const slashNamespace = new Map<string, ParsedItem[]>();
  const perType = new Map<ContentType, Map<string, ParsedItem[]>>();
  for (const it of items) {
    const tmap = perType.get(it.type) ?? new Map<string, ParsedItem[]>();
    tmap.set(it.id, [...(tmap.get(it.id) ?? []), it]);
    perType.set(it.type, tmap);
    if (it.type === "skill" || it.type === "command") {
      slashNamespace.set(it.id, [...(slashNamespace.get(it.id) ?? []), it]);
    }
  }
  for (const [type, tmap] of perType) {
    for (const [id, list] of tmap) {
      if (list.length > 1)
        f.push(err("duplicate-name", list[1]!.relPath, `duplicate ${type} name "${id}" (also ${list[0]!.relPath})`));
    }
  }
  for (const [id, list] of slashNamespace) {
    const types = new Set(list.map((l) => l.type));
    if (list.length > 1 && types.size > 1)
      f.push(err("slash-collision", list[1]!.relPath, `"/${id}" defined by both a skill and a command; names collide in Claude Code`));
  }
  return f;
}
