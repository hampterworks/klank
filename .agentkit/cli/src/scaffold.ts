import { existsSync } from "node:fs";
import { join } from "node:path";
import { isKebabCase, writeText } from "./util.js";
import { SOURCE_DIR, type ContentType } from "./model.js";

const TEMPLATES: Record<ContentType, (name: string, group?: string) => { path: string; content: string }> = {
  skill: (name, group) => ({
    path: join(SOURCE_DIR, "skills", ...(group ? [group] : []), name, "SKILL.md"),
    content: `---
name: ${name}
description: TODO one sentence — WHAT it does and WHEN to use it (third person, ≤200 chars). Use when …
---

# ${title(name)}

TODO: one-line summary of what this skill does.

## Quick start

TODO: the smallest useful example.

## Workflow

1. TODO step
2. TODO step

## Gotchas

- TODO: edge cases accrete here, not in the main instructions.
`,
  }),
  instruction: (name) => ({
    path: join(SOURCE_DIR, "instructions", `${name}.md`),
    content: `---
id: ${name}
title: ${title(name)}
scope: global
agents: [all]
priority: 100
---

TODO: the instruction body (terse, high-signal). For path-scoped, set \`scope: path\` and add \`applyTo: ["glob"]\`.
`,
  }),
  subagent: (name) => ({
    path: join(SOURCE_DIR, "subagents", `${name}.md`),
    content: `---
name: ${name}
description: TODO — what this subagent does and when to delegate to it.
tools: [Read, Grep, Glob]
model: inherit
---

TODO: the subagent system prompt.
`,
  }),
  command: (name) => ({
    path: join(SOURCE_DIR, "commands", `${name}.md`),
    content: `---
name: ${name}
description: TODO — what this command does and when to use it.
argument-hint: "[args]"
---

TODO: the command body. Use $ARGUMENTS or $1 for positional args.
`,
  }),
  hook: (name) => ({
    path: join(SOURCE_DIR, "hooks", `${name}.yaml`),
    content: `event: PreToolUse
matcher: "Bash"
type: command
command: "echo hook"
scope: project
`,
  }),
  mcp: (name) => ({
    path: join(SOURCE_DIR, "mcp", `${name}.yaml`),
    content: `name: ${name}
transport: stdio
command: npx
args: ["-y", "@modelcontextprotocol/server-everything"]
`,
  }),
};

function title(name: string): string {
  return name.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export interface ScaffoldResult {
  path: string;
  created: boolean;
  /** Additional files created alongside the primary one (e.g. a skill's eval stub). */
  extra?: string[];
  error?: string;
}

/** A skill is born with a golden eval stub so its routing/behavior coverage is never silently skipped. */
function evalStub(name: string): string {
  return JSON.stringify(
    {
      skills: [name],
      query: `TODO: a realistic user request that should route to ${name}`,
      files: [],
      expected_behavior: ["TODO: a checkable behavior this skill must exhibit"],
    },
    null,
    2,
  ) + "\n";
}

export function scaffold(root: string, type: ContentType, name: string, group?: string): ScaffoldResult {
  if (!isKebabCase(name)) return { path: "", created: false, error: `name must be kebab-case: "${name}"` };
  if (group && !isKebabCase(group)) return { path: "", created: false, error: `group must be kebab-case: "${group}"` };
  if (group && type !== "skill") return { path: "", created: false, error: `--group only applies to skills` };
  const tpl = TEMPLATES[type](name, group);
  const abs = join(root, tpl.path);
  if (existsSync(abs)) return { path: tpl.path, created: false, error: `already exists: ${tpl.path}` };
  writeText(abs, tpl.content);

  const extra: string[] = [];
  if (type === "skill") {
    const evalRel = join("evals", "golden", `${name}.json`);
    if (!existsSync(join(root, evalRel))) {
      writeText(join(root, evalRel), evalStub(name));
      extra.push(evalRel);
    }
  }
  return { path: tpl.path, created: true, extra };
}
