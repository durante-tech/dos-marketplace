---
name: MergeReconcile
description: Surfaces KG reconciliation findings (orphaned triples, unknown predicates, empty entities, alias predicates) from KgReconcile.hook.ts and applies operator-approved corrections.
status: STABLE
bestPath:
  - title: "Locate the Latest Reconcile Report"
    description: "Resolve the most-recent kg-reconcile JSON report deterministically."
  - title: "Parse and Present Findings"
    description: "Load the report and render corrections grouped by category with a verdict line."
  - title: "Apply Corrections"
    description: "Execute the ordered bridge-call plan per correction type, confirming ambiguous renames first."
  - title: "Update the Ledger"
    description: "Mark each processed correction applied or skipped in the report JSON."
divergence_from_canonical:
  _intent-to-flag-table.md:
    partial_version: 1.0.0
    reason: "MemPalace reconcile review maps report review and merge actions; canonical Mode/Output two-table shape does not fit"
---

# Review KG Reconcile Findings

`KgReconcile.hook.ts` (Stream C) runs a reconciliation pass on the knowledge graph and writes its findings to `MEMORY/STATE/kg-reconcile-{date}.json`. This workflow surfaces those findings for operator review. The most recent run produced 29 corrections — orphaned triples, invalid predicates, entities with no triples, and predicate aliases that need collapsing.

## When to Use

- Trigger phrases: "reconcile findings", "KG reconcile", "fix orphans", "invalid triples cleanup".
- Situation: reviewing and applying the KgReconcile hook's findings — orphaned triples, unknown predicates, empty entities, alias predicates.
- NOT for duplicate-entity merges — use MergeEntities (MergeReconcile fixes structural KG defects, not name collisions).

## Step 1: Locate the Latest Report

Resolve the most-recent `kg-reconcile-*.json` deterministically. The CLI handles
the project-first priority (project-level `MEMORY/STATE` beats global) and the
newest-by-mtime selection — do NOT hand-type `ls -t` globs (drift-risk):

```bash
RECONCILE_FILE_PATH=$(bun ~/.claude/skills/mem-palace/Tools/MemPalaceCli.ts find-latest-reconcile)
```

Helper: `findLatestReconcileReport()` in `Packs/mem-palace/src/Tools/MemPalaceCli.ts`
(tested in `MemPalaceCli.test.ts`). Exit code 1 with empty output means no
reconcile report exists yet — nothing to review.

## Step 2: Load and Parse the Report

Parse + validate the report deterministically — do NOT `cat` and eyeball the
JSON (RFC-0126 §9 B7). The CLI parses, asserts the `corrections` array is
present, and fails loudly on malformed JSON:

```bash
bun ~/.claude/skills/mem-palace/Tools/MemPalaceCli.ts load-reconcile "$RECONCILE_FILE_PATH"
```

Helper: `loadReconcileReport(filePath)` (pure parse path `parseReconcileReport`,
both tested in `MemPalaceCli.test.ts`).

Report shape:

```json
{
  "run_at": "YYYY-MM-DDTHH:MM:SSZ",
  "session_id": "session-XXXXX",
  "summary": {
    "total_corrections": 29,
    "orphaned_triples": 4,
    "unknown_predicates": 11,
    "empty_entities": 8,
    "alias_predicates": 6
  },
  "corrections": [
    {
      "id": "corr-001",
      "type": "unknown_predicate",
      "subject": "entity-name",
      "predicate": "old_pred",
      "object": "target",
      "suggestion": "canonical_pred",
      "status": "pending"
    }
  ]
}
```

## Step 3: Present Findings by Category

Lead with the verdict — the run's correction count from `summary.total_corrections`, then the per-category render:

```
🔎 KG Reconcile: N corrections pending (orphaned-triples / unknown-predicates / empty-entities / alias-predicates)
```

The by-category findings markdown is a deterministic render of the report JSON —
do NOT hand-type the skeleton (RFC-0126 §9 B1). Render it via the CLI:

```bash
bun ~/.claude/skills/mem-palace/Tools/MemPalaceCli.ts render-reconcile "$RECONCILE_FILE_PATH"
```

Helper: `renderReconcileFindings(report)` in
`Packs/mem-palace/src/Tools/MemPalaceCli.ts` (golden-tested in `MemPalaceCli.test.ts`).
It groups corrections into Unknown-predicates / Orphaned-triples / Empty-entities /
Alias-predicates with a running `[N]` index (category order) and the per-type line
format, then the `Apply [1-N], skip [1-N], or "apply all" / "apply safe-only"`
footer — byte-for-byte from the JSON.

## Step 4: Apply Corrections

The correction-type → bridge-action dispatch is deterministic — do NOT hand-map
each type to a bridge call per run (RFC-0126 §9 B7). Produce the ordered
bridge-call plan from the report, then execute it:

```bash
# Full plan (every correction). Add --safe-only to drop the types that need
# manual confirmation (keeps only empty_entity + alias_predicate).
bun ~/.claude/skills/mem-palace/Tools/MemPalaceCli.ts plan-reconcile "$RECONCILE_FILE_PATH" [--safe-only]
```

Helper: `planReconcileCorrections(corrections, { safeOnly })` in
`Packs/mem-palace/src/Tools/MemPalaceCli.ts` (oracle-tested in
`MemPalaceCli.test.ts`). It returns a `ReconcileBridgeCall[]` — each entry is
`{ bridge_action, args, safe, type, correction_id }`. Empty-entity corrections
collapse into a single trailing `reconcile {action:"prune_empty_entities"}`
call. Execute each entry's `bridge_action` with its `args`.

**Judgment gate (NOT in the plan):** for `unknown_predicate` corrections the
`to` target is the CLI's *suggestion* — confirm it with the operator before
executing the `rename_predicate` call. This is why `--safe-only` excludes that
type. The plan tells you WHAT bridge calls map to the corrections; you still
own the confirm-before-rename judgment.

Each plan entry maps to a bridge call of this shape:

```bash
# reconcile (rename_predicate) — alias_predicate / unknown_predicate
uv run --with mempalace python ~/.claude/DOS/Tools/mempalace_bridge.py reconcile \
  '{"action":"rename_predicate","from":"old_pred","to":"canonical_pred"}'

# invalidate — orphaned_triple
uv run --with mempalace python ~/.claude/DOS/Tools/mempalace_bridge.py invalidate \
  '{"subject":"ghost-entity","predicate":"decided","object":"target"}'

# reconcile (prune_empty_entities) — empty_entity (single batch call)
uv run --with mempalace python ~/.claude/DOS/Tools/mempalace_bridge.py reconcile \
  '{"action":"prune_empty_entities"}'
```

If any bridge call fails (non-zero exit, no socket, or empty response), render the DEGRADED banner and stop — do not mark the correction applied:

```text
🔴 MEMPALACE DEGRADED — the memory bridge is unreachable.
   Reads/writes this session are NOT landing; do not assume anything persisted.
   Recover: run the Doctor workflow (`/MemPalace Doctor`) for the guided repair ladder.
```

## Intent-to-Flag Mapping

| User Says | Action | Notes |
|-----------|--------|-------|
| "show reconcile findings" / "review kg corrections" / "what needs fixing in the kg?" | Load latest report + present | Read-only |
| "apply correction [N]" | Appropriate bridge call per correction type | Single correction |
| "apply all safe corrections" | Batch apply empty-entity prune + unambiguous alias collapses | Skips unknown-predicate corrections (needs manual review) |
| "apply all corrections" | Full batch apply | Confirm count before executing |

### Correction Type → Bridge Action

| Type | Bridge Call |
|------|------------|
| `unknown_predicate` | `reconcile` (rename_predicate) after operator confirms target |
| `orphaned_triple` | `invalidate` |
| `empty_entity` | `reconcile` (prune_empty_entities) |
| `alias_predicate` | `reconcile` (rename_predicate) |

## Notes

- The report file path is project-eligible: check `$CLAUDE_PROJECT_DIR/MEMORY/STATE/` first.
- "Apply safe-only" means: `empty_entity` + `alias_predicate` types where the canonical target is unambiguous. Skip `unknown_predicate` and `orphaned_triple` without manual confirmation.
- After applying, update each correction's `status` in the JSON from `"pending"` to `"applied"` or `"skipped"`.
