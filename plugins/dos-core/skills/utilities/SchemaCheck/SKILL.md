---
disable-model-invocation: true
name: SchemaCheck
description: Schema Pre-Flight library — four validators that catch class-of-bug failures before BUILD/data-migration. Validates YAML duplicate keys, i18n key coverage, .mdoc frontmatter completeness, and Prisma table consumer query patterns. USE WHEN schema check, schema validate, yaml duplicate keys, i18n coverage, mdoc frontmatter, table consumers, prisma migration safety, pre-flight, schema preflight, validate yaml, validate i18n, validate mdoc, validate consumers, before migration, before edit, schema audit.
role: validator
accepts:
  - text
  - repo_path
roots: []
visibility: public
capabilities:
  - voice.emit
---
<!-- generated-from: SKILL.partials.md — DO NOT EDIT directly. Run: bun Tools/dos-build.ts skill <path> -->
## Customization

**Before executing, check for user customizations at:**
`~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/SchemaCheck/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.

# SchemaCheck

**Purpose:** Pre-flight validation library. Catches schema/coverage/consumer issues BEFORE BUILD or data-migration so the algorithm doesn't ship a regression. Born from a real DOS reflection theme (15× signal) and a real session bug (C1 reconciliation regression caught at VERIFY).

**Four validators, project-agnostic, Bun-runnable, no heavy deps.**

## Validators

| Validator | Catches | Tool |
|-----------|---------|------|
| **ValidateYamlKeys** | Duplicate keys at any nesting level in a YAML file | `Tools/ValidateYamlKeys.ts` |
| **ValidateI18nCoverage** | i18n keys used in code but missing from registry, AND orphan registry keys | `Tools/ValidateI18nCoverage.ts` |
| **ValidateMdocFrontmatter** | Required frontmatter fields missing or empty in .mdoc/.md files | `Tools/ValidateMdocFrontmatter.ts` |
| **ValidateTableConsumers** | Prisma `distinct` / `findFirst` / `groupBy` / `_count` / raw SQL on a table — surfaces consumer assumptions a data migration might break | `Tools/ValidateTableConsumers.ts` |

## When to invoke

- **Before editing YAML configs** (settings.json fragments, Algorithm rules with embedded YAML, Pack manifests) → `ValidateYamlKeys`
- **Before adding i18n strings** OR **after editing the registry** → `ValidateI18nCoverage`
- **Before editing or publishing .mdoc files** → `ValidateMdocFrontmatter`
- **Before authoring ANY Prisma data migration** that adds, removes, or changes rows → `ValidateTableConsumers` (the marquee validator — read its workflow doc for the C1-lesson rationale)

The active Algorithm doctrine (resolve via `~/.claude/DOS/Algorithm/LATEST`) has a `### Schema Pre-Flight` step in OBSERVE that names these validators when the task profile matches — SchemaCheck IS that Schema-Pre-Flight library.

## CLI shape (consistent across all four)

```bash
bun Tools/Validate<Name>.ts <required-args> [--json]
```

- Exit `0` = clean (no violations)
- Exit `1` = violations found (review needed; not necessarily a bug for ValidateTableConsumers)
- Exit `2` = invalid args / file missing

`--json` prints a stable JSON object for CI integration; without it, output is human-readable.

## Anti-patterns

- ❌ Skipping pre-flight because "I know the schema" — it's exactly when you're confident that you miss things
- ❌ Running validators AFTER BUILD as a polish pass — they're cheap, run them upstream
- ❌ Adding new heavy deps to validators — keep them tight, regex + `yaml` lib + Bun built-ins
- ❌ Hardcoding project-specific paths — all validators take config via CLI args

## Workflow files

See `Workflows/Validate*.md` for per-validator usage details, examples, and CI integration patterns.

## Test/verify

```bash
cd ~/.claude/skills/utilities/SchemaCheck
bun Tests/ValidateYamlKeys.test.ts
bun Tests/ValidateI18nCoverage.test.ts
bun Tests/ValidateMdocFrontmatter.test.ts
bun Tests/ValidateTableConsumers.test.ts
```

All four should print `PASS`. See `VERIFY.md` for the canonical test recipe.
