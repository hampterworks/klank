import { readFileSync } from "node:fs";
import { join } from "node:path";
import { findSoleMarker, readText, toPosix } from "../util.js";
import type { OutputFile } from "../emit.js";
import type { Manifest } from "./manifest.js";
import type { TargetReport } from "./discover.js";

export const BACKUP_DIR = ".agentkit/backups";

const CLAUDE_BEGIN = "<!-- BEGIN AGENTKIT IMPORT -->";
const CLAUDE_END = "<!-- END AGENTKIT IMPORT -->";

/**
 * Add (or refresh, idempotently) a marker-guarded `@AGENTS.md` import in a user's existing CLAUDE.md without
 * touching the rest of their file. Re-running replaces the block in place, so the emit stays byte-stable.
 */
export function spliceClaudeImport(existing: string): string {
  const block = `${CLAUDE_BEGIN}\n@AGENTS.md\n${CLAUDE_END}`;
  const b = findSoleMarker(existing, CLAUDE_BEGIN);
  const e = findSoleMarker(existing, CLAUDE_END);
  if (b !== -1 && e !== -1 && e > b) {
    return existing.slice(0, b) + block + existing.slice(e + CLAUDE_END.length);
  }
  return existing.trimEnd() + "\n\n" + block + "\n";
}

export interface Conflict {
  path: string;
  /** A user-owned file sits where a managed write would land; we back it up rather than silently clobber. */
  kind: "user-file";
}

export interface ReconcilePlan {
  /** Outputs to apply (CLAUDE.md may be dropped or swapped for an augmented user file). */
  outputs: OutputFile[];
  /** Paths agentkit fully owns and records in the manifest (excludes an augmented user CLAUDE.md). */
  managedPaths: string[];
  /** User files to copy into `.agentkit/backups/` before they are overwritten. */
  backups: { from: string; to: string }[];
  /** Collisions with user files; install halts unless `force` (then they are backed up and overwritten). */
  conflicts: Conflict[];
}

function readMaybe(abs: string): string | null {
  try {
    return readFileSync(abs, "utf8");
  } catch {
    return null;
  }
}

/**
 * Decide how the generated outputs land in a target that may already have agent files. CLAUDE.md is
 * import-and-augment (never clobbered); any other output colliding with a non-managed user file is a
 * conflict (backed up, and only overwritten with `force`). Previously-managed files are ours to replace.
 */
export function planReconcile(
  report: TargetReport,
  outputs: OutputFile[],
  prev: Manifest | null,
  opts: { force?: boolean; timestamp?: string } = {},
): ReconcilePlan {
  const root = report.root;
  const prevManaged = new Set(prev?.managedPaths ?? []);
  const ts = opts.timestamp ?? new Date().toISOString().replace(/[:.]/g, "-");
  const result: OutputFile[] = [];
  const managed: string[] = [];
  const backups: { from: string; to: string }[] = [];
  const conflicts: Conflict[] = [];

  for (const o of outputs) {
    if (o.path === "CLAUDE.md") {
      // CLAUDE.md is always augment-or-create and NEVER managed: we add our `@AGENTS.md` import to an
      // existing file (preserving the user's content and any later edits) or write ours when absent, but we
      // never track it as managed - so re-sync can't clobber edits and uninstall can't delete it. We still
      // push it into the output set so a CLAUDE.md a previous (legacy) install marked managed is not pruned.
      if (!report.hasClaudeMd) {
        result.push(o); // absent → write ours (unmanaged)
        continue;
      }
      const current = readText(join(root, "CLAUDE.md"));
      result.push({ path: "CLAUDE.md", content: report.claudeImportsAgents ? current : spliceClaudeImport(current) });
      continue;
    }

    const abs = join(root, o.path);
    const norm = toPosix(o.path);
    // Conflict only when a readable user file actually differs. A missing or unreadable file returns null
    // (readMaybe) - not a content mismatch, and an unreadable file couldn't be backed up anyway.
    const onDisk = readMaybe(abs);
    if (!prevManaged.has(norm) && onDisk !== null && onDisk !== o.content) {
      conflicts.push({ path: norm, kind: "user-file" });
      backups.push({ from: o.path, to: join(BACKUP_DIR, `${o.path}.${ts}`) });
    }
    result.push(o);
    managed.push(norm);
  }

  return { outputs: result, managedPaths: managed.sort(), backups, conflicts };
}
