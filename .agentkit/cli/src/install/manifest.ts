import { existsSync } from "node:fs";
import { join } from "node:path";
import { readText, toPosix, writeText } from "../util.js";
import type { Domain } from "./bundles.js";
import type { AgentId } from "../generate.js";

export const MANIFEST_PATH = ".agentkit/manifest.json";

export interface Manifest {
  schema: 1;
  agentkitVersion: string;
  installedAt: string;
  domains: Domain[];
  agents: AgentId[];
  withCli: boolean;
  managedPaths: string[];
}

/** Read a target's manifest; returns null when absent or not a recognized schema (re-install treats it as fresh). */
export function readManifest(root: string): Manifest | null {
  const abs = join(root, MANIFEST_PATH);
  if (!existsSync(abs)) return null;
  try {
    const m = JSON.parse(readText(abs)) as Manifest;
    if (!(m && m.schema === 1 && Array.isArray(m.managedPaths))) return null;
    // Normalize any legacy backslash paths so comparisons are platform-stable.
    return { ...m, managedPaths: m.managedPaths.map(toPosix) };
  } catch {
    return null;
  }
}

/** Deterministic write (sorted arrays + fixed key order) so the manifest never causes its own drift. */
export function writeManifest(root: string, m: Manifest): void {
  const stable: Manifest = {
    schema: 1,
    agentkitVersion: m.agentkitVersion,
    installedAt: m.installedAt,
    domains: [...m.domains].sort(),
    agents: [...m.agents].sort(),
    withCli: m.withCli,
    managedPaths: [...m.managedPaths].map(toPosix).sort(),
  };
  writeText(join(root, MANIFEST_PATH), JSON.stringify(stable, null, 2) + "\n");
}

export interface ManifestDiff {
  add: string[];
  replace: string[];
  remove: string[];
}

/** Managed = replaceable: paths in `next` are added or replaced; previously-managed paths not in `next` are removed. */
export function diffManifest(prev: Manifest | null, nextPaths: string[]): ManifestDiff {
  const prevSet = new Set((prev?.managedPaths ?? []).map(toPosix));
  const next = nextPaths.map(toPosix);
  const nextSet = new Set(next);
  return {
    add: next.filter((p) => !prevSet.has(p)).sort(),
    replace: next.filter((p) => prevSet.has(p)).sort(),
    remove: [...prevSet].filter((p) => !nextSet.has(p)).sort(),
  };
}
