import fg from "fast-glob";
import { join, relative } from "node:path";
import { existsSync } from "node:fs";
import { CONTENT_TYPES, SOURCE_DIR, loadSrc } from "./model.js";
import { validateFrontmatter } from "./schema.js";
import { lintItems, orderingFindings, localLinkFindings, emDashFindings, scratchFileFindings } from "./rules.js";
import { parseFrontmatter, readText } from "./util.js";
import type { Finding } from "./findings.js";

export interface ValidateOptions {
  docs?: boolean;
}

/** Glob the authored type subdirs only (never .agentkit/cli or .agentkit/backups in a self-hosting target). */
const SOURCE_GLOBS = CONTENT_TYPES.map((t) => `${SOURCE_DIR}/${t === "skill" ? "skills" : `${t}s`}/**/*`);

/** Validate the canonical .agentkit/ source tree: schema per item + the semantic rule-set. */
export function runValidate(root: string, opts: ValidateOptions = {}): Finding[] {
  const items = loadSrc(root);
  const findings: Finding[] = [];
  for (const item of items) {
    findings.push(...validateFrontmatter(item.type, item.frontmatter, item.relPath));
  }
  findings.push(...lintItems(items, root));
  findings.push(...scratchFileFindings(fg.sync(SOURCE_GLOBS, { cwd: root, dot: false })));
  if (opts.docs !== false) findings.push(...runDocsCheck(root));
  return findings;
}

/** Lint docs/ and top-level prose so the repo obeys its own content rules. */
export function runDocsCheck(root: string): Finding[] {
  const findings: Finding[] = [];
  const files = fg.sync(["docs/**/*.md", "README.md", "CONTRIBUTING.md"], { cwd: root, absolute: true }).sort();
  for (const abs of files) {
    if (!existsSync(abs)) continue;
    const rel = relative(root, abs);
    const body = parseFrontmatter(readText(abs)).content;
    // Human docs/README don't carry the skill/instruction "Gotchas" convention - scope that nudge out.
    findings.push(...orderingFindings(rel, body, { gotchas: false }));
    findings.push(...localLinkFindings(rel, body, join(abs, ".."), { strict: false }));
    findings.push(...emDashFindings(rel, body));
  }
  return findings;
}
