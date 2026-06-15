import fg from "fast-glob";
import { readText } from "../util.js";
import { scanRefTokens } from "../rules.js";
import type { ParsedItem } from "../model.js";

export type Domain = "agentkit" | "develop" | "design" | "cicd" | "qa";
export const DOMAINS: Domain[] = ["agentkit", "develop", "design", "cicd", "qa"];

/** The agentkit upkeep bundle is always installed; it carries the in-target maintenance skills. */
const ALWAYS_DOMAINS: Domain[] = ["agentkit"];
/** Always shipped instruction: the authoring philosophy. The project overview is the *target's* own
 *  (.agentkit/instructions/overview.md), merged in by runInstall - shipping the library's overview would
 *  describe the library, not the consumer. */
const ALWAYS_INSTRUCTIONS = ["agentkit-authoring-principles"];
/** Repo-specific aux items that belong only to the agentkit bundle (never leak into a develop-only target). */
const AGENTKIT_AUX: Partial<Record<ParsedItem["type"], string[]>> = {
  subagent: ["content-reviewer"],
  command: ["sync-check"],
};

export function isDomain(s: string): s is Domain {
  return (DOMAINS as string[]).includes(s);
}

export interface ResolvedSelection {
  domains: Domain[];
  items: ParsedItem[]; // the filtered ParsedItem[] to feed collectOutputs
  skills: string[];
  principles: string[];
}

/**
 * Resolve a domain checklist into the concrete content items to install. A domain pulls its skills; each
 * skill's body and reference files are scanned for `*-principles` citations (closure), so principles come
 * along automatically. The agentkit upkeep bundle + overview are always included.
 */
export function resolveSelection(all: ParsedItem[], requested: Domain[]): ResolvedSelection {
  const domains = [...new Set([...requested, ...ALWAYS_DOMAINS])].filter(isDomain).sort();
  const skills = all.filter((i) => i.type === "skill" && isDomain(String(i.group)) && domains.includes(i.group as Domain));

  const principleIds = new Set(all.filter((i) => i.type === "instruction" && /-principles$/.test(i.id)).map((i) => i.id));
  const cited = new Set<string>();
  for (const s of skills) {
    const refBodies = fg.sync("references/**/*.md", { cwd: s.dir, absolute: true }).map(readText);
    for (const body of [s.body, ...refBodies]) {
      for (const tok of scanRefTokens(body)) if (principleIds.has(tok)) cited.add(tok);
    }
  }

  const wantInstr = new Set<string>([...cited, ...ALWAYS_INSTRUCTIONS]);
  const instructions = all.filter((i) => i.type === "instruction" && wantInstr.has(i.id));

  const aux = domains.includes("agentkit")
    ? all.filter((i) => (AGENTKIT_AUX[i.type] ?? []).includes(i.id))
    : [];

  return {
    domains,
    items: [...skills, ...instructions, ...aux],
    skills: skills.map((s) => s.id).sort(),
    principles: instructions.filter((i) => /-principles$/.test(i.id)).map((i) => i.id).sort(),
  };
}
