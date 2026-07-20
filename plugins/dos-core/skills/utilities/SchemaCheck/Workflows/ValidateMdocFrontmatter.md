# ValidateMdocFrontmatter

Presence-and-non-empty check for YAML frontmatter on Markdoc / Keystatic
`.mdoc` and `.md` files. One of four validators in the `SchemaCheck` pack.

## Trigger

- Before editing any `.mdoc` / `.md` file with structured frontmatter
- Before publishing a content batch (Markdoc/Keystatic collections, docs site)
- In CI, gating PRs that touch content directories
- After a collection schema changes, to locate stale documents

## CLI contract

```
bun Tools/ValidateMdocFrontmatter.ts \
  --files <glob> \
  --required <csv> \
  [--json]
```

Exit codes: `0` = all valid, `1` = violations found, `2` = invalid args.

The caller owns the required-field list — the validator is project-agnostic.

## Usage examples

Markdoc docs collection (Next.js / Markdoc):

```bash
bun Tools/ValidateMdocFrontmatter.ts \
  --files 'apps/web/content/docs/**/*.mdoc' \
  --required title,description,publishedAt
```

Keystatic post collection with tags:

```bash
bun Tools/ValidateMdocFrontmatter.ts \
  --files 'content/posts/**/*.mdoc' \
  --required title,slug,summary,publishedAt,tags \
  --json | jq '.violations[]'
```

Single file before editing:

```bash
bun Tools/ValidateMdocFrontmatter.ts \
  --files 'content/posts/2026-04-16-launch.mdoc' \
  --required title,description,publishedAt
```

## JSON output

```json
{
  "validator": "ValidateMdocFrontmatter",
  "ok": false,
  "violations": [
    {
      "file": "/abs/path/docs/foo.mdoc",
      "missing": ["publishedAt"],
      "empty": ["description"]
    }
  ],
  "summary": "1 file with violations across 2 fields"
}
```

Violations are grouped by file. `missing[]` = key absent from frontmatter.
`empty[]` = key present but value is `null`, `""`, or `[]`. A file with no
leading `---` block is treated as "every required field missing."

## Scope (MVP)

- Presence only: key exists
- Non-empty only: value is not `null`/`undefined`/empty-string/empty-array

## Out of scope (future upgrades)

- Type validation (string vs. array vs. date) — needs `ajv` or `zod`
- Format validation (ISO dates, slug regex, URL shape)
- Cross-field constraints (e.g. `draft: false` requires `publishedAt`)
- Required-by-collection profiles (Markdoc schema awareness)

When those become necessary, keep this validator as the cheap presence gate
and add a companion `ValidateMdocSchema.ts` that consumes a Zod/AJV schema.

## Exit behavior in CI

```yaml
- name: frontmatter presence check
  run: |
    bun Packs/utilities/src/SchemaCheck/Tools/ValidateMdocFrontmatter.ts \
      --files 'content/**/*.mdoc' \
      --required title,description,publishedAt \
      --json | tee frontmatter-report.json
```

Exit 1 fails the job; the JSON artifact feeds a PR comment bot.

## Smoke test

```
bun Tests/ValidateMdocFrontmatter.test.ts
```

Uses the three fixtures in `Tests/fixtures/` (good / bad / empty-field) and
asserts exit codes + JSON shape.
