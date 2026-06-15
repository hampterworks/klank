import pc from "picocolors";

export type Level = "error" | "warn" | "info";

export interface Finding {
  level: Level;
  rule: string;
  message: string;
  /** Repo-relative file path the finding concerns. */
  file: string;
  line?: number;
}

export function err(rule: string, file: string, message: string, line?: number): Finding {
  return { level: "error", rule, file, message, line };
}
export function warn(rule: string, file: string, message: string, line?: number): Finding {
  return { level: "warn", rule, file, message, line };
}
export function info(rule: string, file: string, message: string, line?: number): Finding {
  return { level: "info", rule, file, message, line };
}

export function countByLevel(findings: Finding[]): Record<Level, number> {
  const c: Record<Level, number> = { error: 0, warn: 0, info: 0 };
  for (const f of findings) c[f.level]++;
  return c;
}

export function formatFinding(f: Finding): string {
  const loc = f.line ? `${f.file}:${f.line}` : f.file;
  const tag =
    f.level === "error" ? pc.red("error") : f.level === "warn" ? pc.yellow("warn") : pc.cyan("info");
  return `  ${tag} ${pc.dim(`[${f.rule}]`)} ${loc}\n        ${f.message}`;
}

export function printReport(findings: Finding[], title: string): Record<Level, number> {
  const counts = countByLevel(findings);
  if (findings.length === 0) {
    process.stdout.write(pc.green(`✓ ${title}: no issues\n`));
    return counts;
  }
  process.stdout.write(`${title}:\n`);
  // Stable order: errors, warns, info — then by file.
  const order: Level[] = ["error", "warn", "info"];
  const sorted = [...findings].sort(
    (a, b) =>
      order.indexOf(a.level) - order.indexOf(b.level) ||
      a.file.localeCompare(b.file) ||
      (a.line ?? 0) - (b.line ?? 0) ||
      a.rule.localeCompare(b.rule),
  );
  for (const f of sorted) process.stdout.write(formatFinding(f) + "\n");
  const parts: string[] = [];
  if (counts.error) parts.push(pc.red(`${counts.error} error(s)`));
  if (counts.warn) parts.push(pc.yellow(`${counts.warn} warning(s)`));
  if (counts.info) parts.push(pc.cyan(`${counts.info} info`));
  process.stdout.write(`\n${parts.join(", ")}\n`);
  return counts;
}
