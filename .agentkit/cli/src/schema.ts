import { Ajv2020 } from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import type { ValidateFunction } from "ajv";
import { join } from "node:path";
import { readText, schemasDir } from "./util.js";
import type { ContentType } from "./model.js";
import { err, type Finding } from "./findings.js";

const SCHEMA_FILES: Record<ContentType, string> = {
  skill: "skill.schema.json",
  instruction: "instruction.schema.json",
  subagent: "subagent.schema.json",
  command: "command.schema.json",
  hook: "hook.schema.json",
  mcp: "mcp.schema.json",
};

let cache: { ajv: Ajv2020; validators: Record<ContentType, ValidateFunction> } | undefined;

function load() {
  if (cache) return cache;
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  // ajv-formats ships as CJS; interop default.
  (addFormats as unknown as (a: Ajv2020) => void)(ajv);
  const validators = {} as Record<ContentType, ValidateFunction>;
  const known = {} as Record<ContentType, string[]>;
  for (const [type, file] of Object.entries(SCHEMA_FILES) as [ContentType, string][]) {
    const schema = JSON.parse(readText(join(schemasDir(), file)));
    validators[type] = ajv.compile(schema);
    known[type] = Object.keys((schema.properties ?? {}) as Record<string, unknown>);
  }
  cache = { ajv, validators };
  knownProps = known;
  return cache;
}

let knownProps: Record<ContentType, string[]> = {} as Record<ContentType, string[]>;

export function knownFrontmatterKeys(type: ContentType): string[] {
  load();
  return knownProps[type] ?? [];
}

export function validateFrontmatter(
  type: ContentType,
  data: Record<string, unknown>,
  file: string,
): Finding[] {
  const { validators } = load();
  const validate = validators[type];
  const ok = validate(data);
  if (ok) return [];
  return (validate.errors ?? []).map((e) => {
    const where = e.instancePath ? e.instancePath.replace(/^\//, "").replace(/\//g, ".") : "(root)";
    const detail = e.keyword === "additionalProperties" ? ` (${(e.params as { additionalProperty?: string }).additionalProperty})` : "";
    return err("schema", file, `${where} ${e.message ?? "invalid"}${detail}`);
  });
}
