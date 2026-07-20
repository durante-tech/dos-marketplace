# SchemaCheck — Verify

Acceptance tests + diagnostics for the four validators.

## Canonical smoke test recipe

From the pack root (live, submodule, or pack-source — all three should be byte-identical per the four-copy rule):

```bash
cd ~/.claude/skills/utilities/SchemaCheck   # or pack source / submodule
bun install   # only on first run after clone

bun Tests/ValidateYamlKeys.test.ts        && \
bun Tests/ValidateI18nCoverage.test.ts    && \
bun Tests/ValidateMdocFrontmatter.test.ts && \
bun Tests/ValidateTableConsumers.test.ts
```

Expected stdout:

```
PASS                                   # ValidateYamlKeys
PASS                                   # ValidateI18nCoverage
PASS 5/5                               # ValidateMdocFrontmatter
PASS
  consumers: 1
  patterns:  3
  raw_sql:   1
  summary:   1 consumer file, 3 risky patterns (distinct, findFirst, groupBy), 1 raw-SQL ref
```

If all four print `PASS`, the install is complete and validators are functional.

## Per-validator quick check on real DOS files

Run each validator against a known-good real file to confirm CLI ergonomics:

```bash
# ValidateYamlKeys: pick any YAML in DOS — should exit 0
bun Tools/ValidateYamlKeys.ts <your-repo>/.dos-sync-manifest.json --json
# Note: .dos-sync-manifest.json is JSON — substitute any actual .yaml/.yml file

# ValidateTableConsumers against the real producerPricing table
bun Tools/ValidateTableConsumers.ts \
  --table providerPricing \
  --src-glob '<your-repo>/packages/**/*.ts' \
  --json
# Expected: at least one consumer (gateway-reconciliation.service.ts) flagged with `distinct`
```

## Diagnostics

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| `Cannot find module 'yaml'` | `bun install` not run | `cd <pack-root> && bun install` |
| `bun: command not found` | Bun not installed | Install Bun: `curl -fsSL https://bun.sh/install \| bash` |
| Smoke test prints `FAIL: <reason>` | Validator regressed OR fixture corrupted | Read the reason; if fixture was edited, restore from git history |
| `Bun.Glob` not found | Older Bun version | Upgrade Bun: `bun upgrade` |
| `--src-glob` returns no files | Glob doesn't match anything | Try `'**/*.ts'` or absolute path; some shells expand globs — wrap in single quotes |

## Four-copy parity check

The pack lives in three copies (live + submodule + pack source) per the DOS four-copy rule. Verify parity:

```bash
bun ~/Durante/Tools/sync-check.ts --summary
```

Should report `CLEAN` (all 1425+ files identical). If `DRIFT` is reported on `skills/utilities/SchemaCheck`, run `--fix --dry-run` to inspect, then `--fix` to apply (live → submodule canonical direction).
