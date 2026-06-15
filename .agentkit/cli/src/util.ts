import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;

/**
 * Split YAML frontmatter from a markdown body. Replaces gray-matter (we already ship js-yaml): matches
 * its output for well-formed `---` blocks, stripping the delimiters and the single newline after them.
 */
export function parseFrontmatter(raw: string): { data: Record<string, unknown>; content: string } {
  const m = FRONTMATTER.exec(raw);
  if (!m) return { data: {}, content: raw };
  return { data: (yaml.load(m[1] ?? "") ?? {}) as Record<string, unknown>, content: raw.slice(m[0].length) };
}

/** Walk up from a starting directory to the first directory containing `marker`. */
export function walkUpTo(start: string, marker: string): string | undefined {
  let dir = resolve(start);
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (existsSync(join(dir, marker))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}

/** Root of the agentkit package itself (works whether run via tsx or compiled to `dist/`). */
export function pkgRoot(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const root = walkUpTo(here, "package.json");
  if (!root) throw new Error("Could not locate agentkit package root");
  return root;
}

/** Directory holding the JSON Schemas, shipped alongside the package. */
export function schemasDir(): string {
  return join(pkgRoot(), "schemas");
}

export function readText(path: string): string {
  return readFileSync(path, "utf8");
}

export function writeText(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, "utf8");
}

/** Normalize OS path separators to POSIX `/` so manifests and path comparisons are platform-stable. */
export function toPosix(p: string): string {
  return p.split("\\").join("/");
}

/**
 * Byte-offset of `marker` in `text`, ignoring occurrences inside ``` / ~~~ fenced blocks (so a marker
 * shown in a code example is not mistaken for the real one). Throws if it appears outside fences more
 * than once; returns -1 when absent. Offsets index the original string, so slicing stays byte-exact.
 */
export function findSoleMarker(text: string, marker: string): number {
  let inFence = false;
  let found = -1;
  const lineRe = /^.*$/gm; // `.` excludes \n, so each match is one line; m.index is its start offset
  for (let m: RegExpExecArray | null; (m = lineRe.exec(text)); ) {
    const line = m[0];
    if (/^\s*(```|~~~)/.test(line)) inFence = !inFence;
    else if (!inFence) {
      const i = line.indexOf(marker);
      if (i !== -1) {
        if (found !== -1) throw new Error(`multiple "${marker}" markers found`);
        found = m.index + i;
      }
    }
    if (m.index === lineRe.lastIndex) lineRe.lastIndex++; // guard against a zero-length match looping
  }
  return found;
}

export function countLines(text: string): number {
  if (text.length === 0) return 0;
  return text.split(/\r?\n/).length;
}

const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export function isKebabCase(s: string): boolean {
  return KEBAB.test(s);
}

export function containsXmlTag(s: string): boolean {
  return /<\/?[a-zA-Z][^>]*>/.test(s);
}

export interface Heading {
  level: number;
  text: string;
  line: number;
}

/** Parse ATX headings, ignoring fenced code blocks. */
export function headings(body: string): Heading[] {
  const out: Heading[] = [];
  let inFence = false;
  let fence = "";
  const lines = body.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const fenceMatch = line.match(/^\s*(```+|~~~+)/);
    if (fenceMatch) {
      const marker = fenceMatch[1] ?? "";
      if (!inFence) {
        inFence = true;
        fence = marker[0] ?? "`";
      } else if (marker[0] === fence) {
        inFence = false;
      }
      continue;
    }
    if (inFence) continue;
    const h = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (h) out.push({ level: (h[1] ?? "").length, text: (h[2] ?? "").trim(), line: i + 1 });
  }
  return out;
}

/** Best-effort: does the body contain a table-of-contents near the top? */
export function hasTableOfContents(body: string): boolean {
  const head = body.split(/\r?\n/).slice(0, 40).join("\n").toLowerCase();
  return /(^|\n)\s*#{1,6}\s*(table of contents|contents|toc)\b/.test(head);
}

/** Extract markdown links [text](target), excluding images. */
export function markdownLinks(body: string): { text: string; target: string }[] {
  const out: { text: string; target: string }[] = [];
  const re = /(?<!!)\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    out.push({ text: m[1] ?? "", target: m[2] ?? "" });
  }
  return out;
}
