#!/usr/bin/env node
import { Command } from "commander";
import { execSync } from "node:child_process";
import { resolve } from "node:path";
import pc from "picocolors";
import { CONTENT_TYPES, loadSrc, byType, type ContentType } from "../model.js";
import { runValidate, runDocsCheck } from "../validate.js";
import { checkGenerated, printDrift, writeGenerated } from "../generate.js";
import { scaffold } from "../scaffold.js";
import { runDoctor } from "../doctor.js";
import { discoverTarget } from "../install/discover.js";
import { runInstall } from "../install/run.js";
import { DOMAINS, isDomain, type Domain } from "../install/bundles.js";
import type { AgentId } from "../generate.js";
import { metadataBudget, BUDGETS } from "../rules.js";
import { countByLevel, printReport, type Finding } from "../findings.js";

const program = new Command();
program.name("agentkit").description("Author, generate, validate, and doctor AI-agent content.").version("0.1.0");

/** Repo root for whole-repo commands: the git top-level, so `pnpm -C src agentkit <cmd>` (cwd=src) still
 *  targets the repo, not src/. Falls back to cwd outside a git work tree. `--root` always wins. */
function gitToplevel(): string {
  try {
    const top = execSync("git rev-parse --show-toplevel", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    return top || process.cwd();
  } catch {
    return process.cwd();
  }
}

function root(opts: { root?: string }): string {
  return resolve(opts.root ?? gitToplevel());
}

function finish(findings: Finding[], title: string): void {
  const counts = printReport(findings, title);
  if (counts.error > 0) process.exitCode = 1;
}

program
  .command("new")
  .argument("<type>", `content type: ${CONTENT_TYPES.join(" | ")}`)
  .argument("<name>", "kebab-case name")
  .option("--root <dir>", "repo root")
  .option("--group <group>", "skill group (subdirectory under .agentkit/skills)")
  .description("scaffold a new content item with correct layout + frontmatter")
  .action((type: string, name: string, opts) => {
    if (!CONTENT_TYPES.includes(type as ContentType)) {
      process.stderr.write(pc.red(`unknown type "${type}". Use one of: ${CONTENT_TYPES.join(", ")}\n`));
      process.exitCode = 1;
      return;
    }
    const r = scaffold(root(opts), type as ContentType, name, opts.group);
    if (r.created) {
      process.stdout.write(pc.green(`✓ created ${r.path}\n`));
      for (const e of r.extra ?? []) process.stdout.write(pc.green(`✓ created ${e}\n`));
    } else {
      process.stderr.write(pc.red(`✗ ${r.error}\n`));
      process.exitCode = 1;
    }
  });

program
  .command("generate")
  .option("--root <dir>", "repo root")
  .option("--check", "verify committed files are in sync with .agentkit/ (no writes)")
  .description("generate per-agent native files from .agentkit/ (or --check for drift)")
  .action((opts) => {
    const r = root(opts);
    if (opts.check) {
      const drift = checkGenerated(r);
      printDrift(drift);
      if (drift.length > 0) process.exitCode = 1;
    } else {
      const res = writeGenerated(r);
      process.stdout.write(pc.green(`✓ generated ${res.written} file(s)${res.removed ? `, removed ${res.removed} stale` : ""}\n`));
    }
  });

program
  .command("validate")
  .option("--root <dir>", "repo root")
  .option("--no-docs", "skip docs/ checks")
  .description("schema + structure + budget validation of .agentkit/ (and docs/)")
  .action((opts) => {
    finish(runValidate(root(opts), { docs: opts.docs }), "validate");
  });

program
  .command("docs-check")
  .option("--root <dir>", "repo root")
  .description("lint docs/ and top-level prose against the content rules")
  .action((opts) => {
    finish(runDocsCheck(root(opts)), "docs-check");
  });

program
  .command("budgets")
  .option("--root <dir>", "repo root")
  .description("report skill metadata budget (per-skill + cumulative vs the ceiling)")
  .action((opts) => {
    const items = loadSrc(root(opts));
    const skills = byType(items).skill;
    const rep = metadataBudget(skills);
    process.stdout.write(`Skill metadata budget (ceiling ${(BUDGETS.METADATA_MAX_BYTES / 1024).toFixed(0)}KB, warn ${(BUDGETS.METADATA_WARN_BYTES / 1024).toFixed(0)}KB):\n`);
    for (const e of [...rep.entries].sort((a, b) => b.bytes - a.bytes)) {
      process.stdout.write(`  ${String(e.bytes).padStart(5)} B  ${e.id}\n`);
    }
    const kb = (rep.totalBytes / 1024).toFixed(1);
    const line = `  total: ${kb}KB across ${rep.entries.length} skill(s)`;
    if (rep.over) {
      process.stdout.write(pc.red(`${line} — OVER CEILING\n`));
      process.exitCode = 1;
    } else if (rep.warn) process.stdout.write(pc.yellow(`${line} — over warn threshold\n`));
    else process.stdout.write(pc.green(`${line} — ok\n`));
  });

program
  .command("catalog")
  .option("--root <dir>", "repo root")
  .description("regenerate CATALOG.md (runs full generate to keep everything in sync)")
  .action((opts) => {
    const res = writeGenerated(root(opts));
    process.stdout.write(pc.green(`✓ regenerated CATALOG.md (+${res.written} file(s) total)\n`));
  });

program
  .command("doctor")
  .argument("[path]", "repo to inspect", ".")
  .option("--fix", "apply safe format-level repairs in place")
  .description("diagnose (and optionally --fix) native agent files in any repo")
  .action((path: string, opts) => {
    const r = resolve(path);
    const res = runDoctor(r, { fix: opts.fix });
    process.stdout.write(`Scanned ${res.files} native agent file(s) in ${r}\n`);
    if (opts.fix) process.stdout.write(pc.cyan(`applied ${res.fixed} safe format fix(es); remaining issues need manual edits\n`));
    const counts = countByLevel(res.findings);
    printReport(res.findings, "doctor");
    if (counts.error > 0) process.exitCode = 1;
  });

const list = (s: string): string[] => s.split(",").map((x) => x.trim()).filter(Boolean);

const AGENT_IDS: AgentId[] = ["claude", "copilot", "cursor", "junie"];
const isAgentId = (s: string): s is AgentId => (AGENT_IDS as string[]).includes(s);

program
  .command("discover")
  .argument("[path]", "target repo to inspect", ".")
  .option("--json", "emit the report as JSON")
  .description("inspect a target repo before installing: detected agents, existing files, doctor findings")
  .action((path: string, opts) => {
    const report = discoverTarget(resolve(path));
    if (opts.json) {
      process.stdout.write(JSON.stringify(report, null, 2) + "\n");
      return;
    }
    process.stdout.write(`Target: ${report.root}\n`);
    process.stdout.write(`Detected agents: ${report.detectedAgents.join(", ") || "(none)"}\n`);
    process.stdout.write(`AGENTS.md: ${report.hasAgentsMd ? "present" : "absent"}  CLAUDE.md: ${report.hasClaudeMd ? (report.claudeImportsAgents ? "imports @AGENTS.md" : "present (would augment)") : "absent"}\n`);
    process.stdout.write(`Existing install: ${report.manifest ? `v${report.manifest.agentkitVersion} (${report.manifest.domains.join(", ")})` : "none"}\n`);
    process.stdout.write(`Native files: ${report.inventory.length}; doctor findings: ${report.findings.length}\n`);
  });

program
  .command("install")
  .argument("[path]", "target repo", ".")
  .option("--select <domains>", `comma-separated domains: ${DOMAINS.join(",")} (agentkit always included)`)
  .option("--agents <ids>", "comma-separated agents: claude,copilot,cursor,junie (claude always included)")
  .option("--with-cli", "also vendor the agentkit CLI + .agentkit/ source skeleton into the target")
  .option("--dry-run", "plan only: print the diff and conflicts without writing")
  .option("--json", "emit the result as JSON")
  .option("--src <dir>", "source library root (defaults to this CLI's package)")
  .option("--force", "back up and overwrite colliding user files")
  .description("install or re-sync a chosen subset of this library into a target repo")
  .action((path: string, opts) => {
    const select = (opts.select ? list(opts.select) : []).filter((d): d is Domain => {
      if (!isDomain(d)) process.stderr.write(pc.yellow(`ignoring unknown domain "${d}"\n`));
      return isDomain(d);
    });
    const agents = (opts.agents ? list(opts.agents) : []).filter((a): a is AgentId => {
      if (!isAgentId(a)) process.stderr.write(pc.yellow(`ignoring unknown agent "${a}"\n`));
      return isAgentId(a);
    });
    const r = runInstall(resolve(path), {
      select,
      agents,
      withCli: opts.withCli,
      dryRun: opts.dryRun,
      force: opts.force,
      srcRoot: opts.src ? resolve(opts.src) : undefined,
    });
    if (opts.json) {
      process.stdout.write(JSON.stringify(r, null, 2) + "\n");
      if (!r.applied && r.conflicts.length > 0 && !opts.dryRun) process.exitCode = 1;
      return;
    }
    process.stdout.write(`Domains: ${r.domains.join(", ")}  Agents: ${r.agents.join(", ")}\n`);
    process.stdout.write(`Skills: ${r.skills.length}  Principles: ${r.principles.join(", ")}\n`);
    process.stdout.write(`Diff: +${r.diff.add.length} add, ~${r.diff.replace.length} replace, -${r.diff.remove.length} remove\n`);
    if (r.conflicts.length > 0) {
      process.stdout.write(pc.yellow(`Conflicts (${r.conflicts.length}): ${r.conflicts.map((c) => c.path).join(", ")}\n`));
    }
    if (opts.dryRun) {
      process.stdout.write(pc.cyan("dry run: nothing written\n"));
    } else if (r.applied) {
      process.stdout.write(pc.green(`✓ installed agentkit v${r.version}${r.backups.length ? ` (backed up ${r.backups.length} file(s))` : ""}\n`));
    } else {
      process.stdout.write(pc.red("✗ halted on unresolved conflicts; re-run with --force or resolve them\n"));
      process.exitCode = 1;
    }
  });

program.parseAsync(process.argv);
