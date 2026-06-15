# Doctor rule catalogue

Every rule `agentkit doctor` emits, its severity, whether `--fix` can repair it (all structural rules are
**surfaced** - confirm, then edit by hand), and the fix. Rules live in `src/rules.ts` (shared with
`validate`).

## Parsing (errors - fix first)

| Rule | Sev | What to do |
|------|-----|-----------|
| `frontmatter-unparseable` | error | the file's YAML frontmatter does not load (the doctor reports it instead of crashing). Almost always an unquoted value containing a colon-space or a leading YAML indicator character. Quote the value or rephrase. Until it parses, no other rule can see the file. |

## Format (auto-fixable with `--fix`)

| Rule | Sev | Fix |
|------|-----|-----|
| trailing whitespace / final newline / 4+ blank lines | - | `--fix` rewrites in place |

## Naming & description (surfaced)

| Rule | Sev | What to do |
|------|-----|-----------|
| `name-kebab` / `name-length` / `name-xml` / `name-reserved` | error | rename to kebab-case, ≤64 chars, no XML, no `anthropic`/`claude` |
| `name-gerund` | warn | name the action with a base verb, not an `-ing` gerund (`review`, not `reviewing`) |
| `desc-length` | warn/error | ≤200 chars to route well (hard cap 1024) |
| `desc-person` | warn | third person - drop "I"/"you can…" |
| `desc-trigger` | warn | say WHEN - accepts when / after / before / during / whenever |
| `desc-clutter` | warn | cut clutter/hedges (`very`, `just`, `simply`, `in order to`, `note that`, …) |
| `em-dash` | warn | no em dashes (`U+2014`) in any prose or description; use a comma, semicolon, colon, or spaced hyphen (in a `description`, never a colon-space - it breaks frontmatter). Code fences/spans exempt |

## Structure & disclosure (surfaced)

| Rule | Sev | What to do |
|------|-----|-----------|
| `memory-size` | warn | keep CLAUDE.md/AGENTS.md ≤200 lines / 25 KB |
| `skill-lines` | warn | keep a SKILL.md body under 500 lines |
| `toc-missing` | warn | add a Table of Contents to a file >100 lines |
| `gotchas-missing` | info | add a Gotchas section (skills/memory only - suppressed on reference docs) |
| `prose-clutter` | info | cut clutter/hedge words from the body (`just`, `simply`, `actually`, …) |
| `prose-long-sentence` | info | split a sentence over ~35 words into shorter declaratives |

## Mirrors, links & duplication (surfaced - the lessons from real repos)

| Rule | Sev | What to do |
|------|-----|-----------|
| `pointer-body` | warn | a redirect-only body. If it mirrors an existing `.claude/skills/<x>` → **remove the stub** (Copilot auto-discovers `.claude/skills/`, Junie imports it). Otherwise it's a hollow subagent whose identity lives in a parallel doc → **inline the real system prompt into the agent file and delete the parallel doc** |
| `split-identity` | warn | an aggregate: redirect-stub subagents **and** a hand-maintained routing table coexist (the role identity is split across a stub + a `…/roles/*.md` doc + a table). **Decompose:** inline each identity into its agent file (routed by `description`), then delete the parallel docs and the table. Surfaced together so you fix the architecture early instead of banking the individual `pointer-body`/`routing-table` warnings as "intentional". |
| `ref-ghost` | warn | a backtick path-like `` `…/x.md` `` reference to a file that doesn't exist - fix or remove it |
| `ref-name` | warn/info | a backtick `` `skill-name` `` reference that doesn't resolve: `warn` on a one-edit typo of a real skill (suggests the match), `info` on a bare group name used where a skill is meant. Fix the name or drop the backticks |
| `ref-dead` / `path-backslash` / `ref-escape` / `ref-nested` | error/warn | broken markdown link, backslash path, `..` escape, or a reference that links onward (keep one level deep) |
| `routing-table` | info | a memory file's table re-lists subagents - route by `description`, delete the table |
| `duplicate-block` | info | the same line appears in 2+ memory files - keep one home, reference it elsewhere |

## Severity → exit

`error` sets exit code 1; `warn`/`info` are reported but non-fatal. Treat structural `warn`s as a
to-do list: confirm each is intended, then edit.
