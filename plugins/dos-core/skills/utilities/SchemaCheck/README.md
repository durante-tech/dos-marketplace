# SchemaCheck

Schema Pre-Flight library for DOS — four standalone validators that catch class-of-bug failures BEFORE BUILD or data migration ships them.

## Why this exists

Mining 178 algorithm reflections produced one of the loudest signals (15×): "should have validated the schema/contract before editing the producer." Examples that triggered the build:

- **YAML duplicate keys** silently drop earlier values; the AI shipped an Agent traits config where `bold` was defined twice — only the second definition persisted, causing phantom-trait bugs
- **i18n keys** added to code but not the registry → runtime `undefined` strings in production UI
- **.mdoc frontmatter** missing required fields → Keystatic publishing fails after the page is already drafted
- **Prisma table consumers** with `findMany({ distinct })` semantics — when a data migration adds the FIRST row of a kind, the distinct lookup returns YOUR new row's defaults instead of falling back to a sane default. (This is the real DOS-Studio C1 reconciliation regression that triggered the fourth validator.)

Each validator is project-agnostic, accepts config via CLI args, and runs with Bun + minimal deps. Each ships with a smoke test.

## Validators at a glance

| # | Validator | Input | Output | Exit codes |
|---|-----------|-------|--------|-----------|
| 1 | `ValidateYamlKeys` | YAML file path | duplicate-key report w/ line numbers | 0 clean / 1 dups / 2 invalid |
| 2 | `ValidateI18nCoverage` | registry JSON + src glob + call pattern | missing + orphan keys | 0 covered / 1 gaps / 2 invalid |
| 3 | `ValidateMdocFrontmatter` | files glob + required CSV | per-file missing/empty fields | 0 valid / 1 violations / 2 invalid |
| 4 | `ValidateTableConsumers` | table name + src glob | risky consumer patterns + raw SQL refs | 0 no-risk / 1 risky-found / 2 invalid |

## Usage examples

```bash
# Catch duplicate keys before editing settings.json
bun Tools/ValidateYamlKeys.ts ~/.claude/settings.yaml --json

# Verify all i18n keys exist in en.json before adding to the UI
bun Tools/ValidateI18nCoverage.ts \
  --registry apps/web/messages/en.json \
  --src-glob 'apps/web/app/**/*.tsx' \
  --call-pattern "t\(['\"\`]([^'\"\`]+)['\"\`]\)"

# Validate Keystatic .mdoc frontmatter has all required fields
bun Tools/ValidateMdocFrontmatter.ts \
  --files 'apps/web/content/help/**/*.mdoc' \
  --required title,description,publishedAt,category

# Surface Prisma consumer risks BEFORE writing a data migration
bun Tools/ValidateTableConsumers.ts \
  --table providerPricing \
  --src-glob 'packages/**/*.ts'
```

## How this integrates with the Algorithm

Under RFC-0001, schema validators are planned against structured criteria, run during an allowed Bash phase, and recorded as verification evidence. For most schema edits, plan the relevant validator in `PLAN`, execute it in `MAKE`, and attach output in `VERIFY`.

See `SKILL.md` for the full workflow routing table and `Workflows/Validate*.md` for per-validator details.

## Composition with other DOS pieces

- **Sentinel** discovers schemas in a repo; **SchemaCheck** enforces them
- **/code-review** Reuse-Scan (THINK phase rule, shipped with H2) finds existing helpers; **SchemaCheck** confirms the contract those helpers expect is intact
- **MemPalace** Memory Recall (OBSERVE phase rule, shipped with M12) surfaces prior decisions; **SchemaCheck** validates the current state matches those decisions
