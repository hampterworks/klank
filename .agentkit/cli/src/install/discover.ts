import { existsSync } from "node:fs";
import { join } from "node:path";
import { readText } from "../util.js";
import { discoverNative, runDoctor } from "../doctor.js";
import { readManifest, type Manifest } from "./manifest.js";
import type { AgentId } from "../generate.js";
import type { Finding } from "../findings.js";

/** Filesystem markers that signal a target repo already uses a given agent. */
const AGENT_MARKERS: Record<AgentId, string[]> = {
  claude: [".claude", "CLAUDE.md"],
  copilot: [".github/copilot-instructions.md", ".github/instructions", ".github/prompts"],
  cursor: [".cursor"],
  junie: [".junie"],
};

const IMPORTS_AGENTS = /^@AGENTS\.md\s*$/m;

export interface TargetReport {
  root: string;
  /** Agents the target already uses (Claude is always installable; the rest are detect-and-confirm). */
  detectedAgents: AgentId[];
  hasAgentsMd: boolean;
  hasClaudeMd: boolean;
  /** True when CLAUDE.md already pulls in AGENTS.md, so we augment nothing. */
  claudeImportsAgents: boolean;
  manifest: Manifest | null;
  inventory: { rel: string; kind: string }[];
  findings: Finding[];
}

/** Inspect a target repo before installing: which agents it uses, whether files already exist, and doctor findings. */
export function discoverTarget(root: string): TargetReport {
  const detectedAgents = (Object.keys(AGENT_MARKERS) as AgentId[]).filter((a) =>
    AGENT_MARKERS[a].some((m) => existsSync(join(root, m))),
  );
  const claudePath = join(root, "CLAUDE.md");
  const hasClaudeMd = existsSync(claudePath);
  const doctor = runDoctor(root);
  return {
    root,
    detectedAgents,
    hasAgentsMd: existsSync(join(root, "AGENTS.md")),
    hasClaudeMd,
    claudeImportsAgents: hasClaudeMd && IMPORTS_AGENTS.test(readText(claudePath)),
    manifest: readManifest(root),
    inventory: discoverNative(root).map((n) => ({ rel: n.rel, kind: n.kind })),
    findings: doctor.findings,
  };
}
