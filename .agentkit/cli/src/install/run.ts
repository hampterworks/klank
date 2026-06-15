import fg from "fast-glob";
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { CONTENT_TYPES, SOURCE_DIR, loadSrc } from "../model.js";
import { applyOutputs, collectOutputs, type AgentId } from "../generate.js";
import type { OutputFile } from "../emit.js";
import { pkgRoot, readText, writeText } from "../util.js";
import { resolveSelection, type Domain } from "./bundles.js";
import { diffManifest, readManifest, writeManifest, type ManifestDiff } from "./manifest.js";
import { discoverTarget, type TargetReport } from "./discover.js";
import { planReconcile, type Conflict } from "./reconcile.js";

export interface InstallOptions {
  select?: Domain[];
  agents?: AgentId[];
  withCli?: boolean;
  dryRun?: boolean;
  force?: boolean;
  /** Where the agentkit library lives (defaults to the running CLI's package root). */
  srcRoot?: string;
}

export interface InstallResult {
  domains: Domain[];
  agents: AgentId[];
  skills: string[];
  principles: string[];
  diff: ManifestDiff;
  conflicts: Conflict[];
  backups: string[];
  applied: boolean;
  version: string;
  report: TargetReport;
}

/** Vendor the agentkit CLI source + schemas into `.agentkit/cli/` (managed, so re-sync updates them).
 *  Authored source (`.agentkit/skills`, ...) and install state (`cli/`, `backups/`, `manifest.json`) share
 *  the `.agentkit/` dir; the per-type source globs stay scoped so they never sweep `cli/` or `backups/`. */
function vendorCliOutputs(srcRoot: string): OutputFile[] {
  const files = fg.sync(["src/**/*.ts", "src/package.json", "src/tsconfig.json", "src/schemas/**/*.json"], {
    cwd: srcRoot,
    ignore: ["src/dist/**", "src/node_modules/**", "src/test/**"],
  });
  return files.sort().map((rel) => ({ path: join(".agentkit", "cli", rel), content: readText(join(srcRoot, rel)) }));
}

/** Lay down the canonical .agentkit/ source skeleton (skip-if-exists, never managed) so the target can author. */
function scaffoldSkeleton(root: string): void {
  const ensure = (rel: string, content: string) => {
    if (!existsSync(join(root, rel))) writeText(join(root, rel), content);
  };
  // Dir = pluralized type, except mcp (its dir is `mcp`, matching model.ts TYPE_GLOBS).
  for (const t of CONTENT_TYPES) ensure(join(SOURCE_DIR, t === "mcp" ? "mcp" : `${t}s`, ".gitkeep"), "");
  ensure(
    join(SOURCE_DIR, "instructions", "overview.md"),
    "---\nid: overview\ntitle: Project overview\nscope: global\nagents: [all]\npriority: 0\n---\n\nTODO: how agents should work in this repository (build/test commands, conventions, constraints).\n",
  );
}

function agentkitVersion(): string {
  try {
    return String(JSON.parse(readText(join(pkgRoot(), "package.json"))).version ?? "0.0.0");
  } catch {
    return "0.0.0";
  }
}

/**
 * Install (or re-sync) a selected subset of the library into `root`. Pure planning when `dryRun`; otherwise
 * backs up colliding user files, applies managed outputs, and writes the manifest. Halts (applied=false)
 * when user-file conflicts remain unresolved and `force` is not set, so the caller can ask.
 */
export function runInstall(root: string, opts: InstallOptions = {}): InstallResult {
  const srcRoot = opts.srcRoot ?? pkgRoot();
  const all = loadSrc(srcRoot);
  const sel = resolveSelection(all, opts.select ?? []);
  const agents = [...new Set<AgentId>([...(opts.agents ?? []), "claude"])].sort();

  // The consumer owns their project overview/briefing: generate AGENTS.md from the target's own authored
  // instructions, never the library's (whose overview describes the library). Shipped items win id collisions.
  const shipped = new Set(sel.items.map((i) => `${i.type}:${i.id}`));
  const targetInstructions = loadSrc(root).filter(
    (i) => i.type === "instruction" && !shipped.has(`${i.type}:${i.id}`),
  );

  const outputs = [
    ...collectOutputs(root, { items: [...sel.items, ...targetInstructions], agents, srcRoot }),
    ...(opts.withCli ? vendorCliOutputs(srcRoot) : []),
  ];
  const prev = readManifest(root);
  const report = discoverTarget(root);
  const plan = planReconcile(report, outputs, prev, { force: opts.force });
  const diff = diffManifest(prev, plan.managedPaths);
  const version = agentkitVersion();

  const base: InstallResult = {
    domains: sel.domains,
    agents,
    skills: sel.skills,
    principles: sel.principles,
    diff,
    conflicts: plan.conflicts,
    backups: plan.backups.map((b) => b.to),
    applied: false,
    version,
    report,
  };

  if (opts.dryRun) return base;
  if (plan.conflicts.length > 0 && !opts.force) return base;

  // Back up colliding user files before they are overwritten.
  for (const b of plan.backups) {
    const from = join(root, b.from);
    if (!existsSync(from)) continue;
    const to = join(root, b.to);
    mkdirSync(dirname(to), { recursive: true });
    copyFileSync(from, to);
  }

  applyOutputs(root, plan.outputs, prev?.managedPaths ?? []);
  if (opts.withCli) scaffoldSkeleton(root); // greenfield authoring surface (skip-if-exists, unmanaged)
  writeManifest(root, {
    schema: 1,
    agentkitVersion: version,
    installedAt: new Date().toISOString(),
    domains: sel.domains,
    agents,
    withCli: !!opts.withCli,
    managedPaths: plan.managedPaths,
  });

  return { ...base, applied: true };
}
