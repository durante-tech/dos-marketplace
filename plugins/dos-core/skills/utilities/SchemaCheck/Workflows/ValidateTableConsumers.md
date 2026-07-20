# ValidateTableConsumers

Find Prisma consumer query patterns that carry implicit assumptions about a
table's row distribution — the kind a data migration can silently invalidate.

## C1-LESSON — why this validator exists

A DOS-Studio reconciliation job was producing the wrong percentage. The math
was visible and wrong:

```
expected: 1400 / 14000 * 100 = 10.00
got:      1400 / 18000 * 100 =  7.77
```

The denominator drifted after a migration added the FIRST row of a new
`provider` value to `providerPricing`. Nothing in the migration touched the
reconciliation service. Nothing in the reconciliation service changed. But a
consumer query looked like this:

```ts
db.providerPricing.findMany({
  select: { provider: true, price: true },
  distinct: ['provider'],
});
```

`distinct` is a pure function of the current row set. When the set of
`provider` values changed from 14 to 18, the consumer's output shape changed
with it. The reconciliation math used `.length` downstream and produced a new
answer that still parsed, still typed, still tested green against the old
fixtures — and was wrong in production.

The migration author had no way to discover the consumer without grepping. The
consumer author had no idea a migration was coming. This validator closes that
loop: given a table, surface every consumer whose behavior depends on implicit
assumptions about the row set.

## Trigger

Run **before authoring any data migration** that adds, removes, or changes
rows in a Prisma table — schema migrations, seed changes, backfills, one-off
scripts, admin panels, anything that mutates row distribution.

Exit `1` does **not** mean "there is a bug". It means "these consumers have
assumptions the migration author should think about". Read each one, decide
whether the migration invalidates it, and either adjust the consumer or
document why the migration is safe.

## Flagged patterns

**Family A — Prisma client queries:**

| Signal | Why it's risky |
|---|---|
| `findFirst` / `findFirstOrThrow` | Result depends on row ordering; new rows may win the race. |
| `groupBy` | Output groups reshape when row distribution shifts. |
| `aggregate` | Rolls up the current row set — silently absorbs new rows. |
| `distinct` argument | Row set is the function's domain; new values enlarge it. |
| `_count`, `_sum`, `_max`, `_min`, `_avg` | Any aggregate keyword anywhere in the call args. |

**Family B — Raw SQL:**

Any `$queryRaw`, `$executeRaw`, `$queryRawUnsafe`, or `$executeRawUnsafe`
whose source references the table name. Raw SQL is opaque to static analysis;
surface it so the migration author can eyeball each one.

## CLI

```bash
bun Tools/ValidateTableConsumers.ts --table <name> --src-glob <glob> [--json]
```

The table name is the Prisma camelCase model name (what you write after
`db.` / `prisma.`). The glob targets your application source.

## Usage

Typical run before a migration touching `providerPricing`:

```bash
bun Tools/ValidateTableConsumers.ts \
  --table providerPricing \
  --src-glob 'packages/**/*.ts'
```

JSON mode for scripted gates:

```bash
bun Tools/ValidateTableConsumers.ts \
  --table providerPricing \
  --src-glob 'apps/**/*.ts' \
  --json
```

## Exit codes

| Code | Meaning |
|---|---|
| 0 | No consumers with risky patterns found. Review is still advised if the table has any consumers; this validator filters for implicit-assumption patterns only. |
| 1 | Risky patterns found — informational. Read, decide, proceed. |
| 2 | Invalid arguments. |

## Output

JSON report groups hits by file, each with a line number, method name, the
flags that fired, and an ~80-char snippet. Raw SQL hits are a parallel list.
The human-readable output mirrors the same structure, one consumer per
indent-block, suitable for pasting into a migration PR description.

## Known limits

- Regex-based. It recognizes `db.<table>.<method>(` and `prisma.<table>.<method>(`
  equally — any `<identifier>.<table>.<method>(`. It won't see queries routed
  through a deep wrapper that hides the table name.
- Raw SQL detection is heuristic: the table name must appear in the same line
  or the next two. False negatives are possible for multi-line templated SQL.
- No semantic understanding of `where` clauses — a tightly-scoped `findFirst`
  is still flagged. That is intentional; the reviewer confirms safety.
