---
name: MergePredicates
description: Collapses alias predicates to their canonical forms in the live MemPalace KG via a dry-run/apply cluster tool, gated on strict predicate validation.
status: STABLE
bestPath:
  - title: "Validate Predicates Strict"
    description: "Confirm validate-predicates.py --strict exits 0 before merging any cluster."
  - title: "Dry Run"
    description: "Preview which alias rows would collapse to their canonical predicate."
  - title: "Apply the Merge"
    description: "Collapse one named cluster or all alias clusters into their canonical predicate."
  - title: "Verify Post-Merge"
    description: "Re-run strict validation and confirm the alias bucket is now empty."
divergence_from_canonical:
  _intent-to-flag-table.md:
    partial_version: 1.0.0
    reason: "MemPalace predicate merge uses dry-run/apply/list-cluster safety flags; canonical Mode/Output two-table shape does not fit"
---

# MergePredicates Workflow

Collapse alias predicates to their canonical forms in the live MemPalace KG.

## When to use

Run this after any `validate-predicates.py` report that shows alias predicates in the KG.
Alias predicates are not wrong — they are legible to the validator — but canonical form
makes KG queries simpler (one predicate name to query instead of N aliases).

Before running, confirm that `validate-predicates.py --strict` exits 0 (no unknowns).
Never apply a merge when there are unknown predicates in the KG.

## Intent-to-Flag Mapping

| Operator intent | Command / flag pattern | Notes |
|---|---|---|
| "show what would change" | `python3 ~/.claude/DOS/Tools/merge-predicates.py --dry-run` | No writes. Review before any apply. |
| "apply one alias cluster" | `python3 ~/.claude/DOS/Tools/merge-predicates.py --apply --cluster <name>` | Surgical merge for one cluster. |
| "apply all alias clusters" | `python3 ~/.claude/DOS/Tools/merge-predicates.py --apply` | Requires strict validation first. |
| "list available clusters" | `python3 ~/.claude/DOS/Tools/merge-predicates.py --list-clusters` | Reads the alias map only. |

## Invocation

```bash
# Dry run — shows what would change, no writes
python3 ~/.claude/DOS/Tools/merge-predicates.py --dry-run

# Apply a specific cluster
python3 ~/.claude/DOS/Tools/merge-predicates.py --apply --cluster decision

# Apply all alias clusters
python3 ~/.claude/DOS/Tools/merge-predicates.py --apply

# Show counts from PREDICATES.md alias map
python3 ~/.claude/DOS/Tools/merge-predicates.py --list-clusters
```

## What it does

For each cluster (alias → canonical pair from PREDICATES.md §2):

```sql
UPDATE triples
   SET predicate = '<canonical>'
 WHERE predicate = '<alias>';
```

Then records a merge event in `MEMORY/STATE/merge-predicates.jsonl`.

## Output

Lead with the verdict — the merged-row count:

```
✅ MergePredicates: collapsed N alias rows across M clusters → canonical (0 rows → nothing to merge)
```

If the tool cannot reach the KG / bridge (missing sqlite, no socket, or non-zero exit), render the DEGRADED banner and stop — do not report a merge result:

```text
🔴 MEMPALACE DEGRADED — the memory bridge is unreachable.
   Reads/writes this session are NOT landing; do not assume anything persisted.
   Recover: run the Doctor workflow (`/MemPalace Doctor`) for the guided repair ladder.
```

## Current clusters (as of 2026-05-04)

Collapsed by PRD `decision`→`decided` and `e2e_with`→`e2e_tested_with` (RFC-0028 P4.3).

| Alias | Canonical | Notes |
|-------|-----------|-------|
| `decision` | `decided` | Pre-canonical write; new code uses `decided` |
| `e2e_with` | `e2e_tested_with` | Pre-canonical abbreviation |
| `is` | `is_a` | Pre-canonical shorthand |
| `type_of` | `is_a` | — |
| `built_on` | `derives_from` | Lineage alias (see §1.2 disambiguation rule) |
| `chose` | `decided` | — |
| `picked` | `decided` | — |
| ...and all other aliases in PREDICATES.md §2 | — | — |

## Safety notes

- `--apply` writes are **irreversible** on the sqlite level (no undo log).
- Always `--dry-run` first; review the output before `--apply`.
- The tool operates on `~/.mempalace/knowledge_graph.sqlite3` by default
  (palace root, NOT a `palace/` subdir, NOT `kg.sqlite3`).
  Override with `MEMPALACE_KG_PATH` env or `--kg <path>`.
- Temporal validity: the merge does not touch `valid_from` / `valid_to` columns.
  Fact timestamps are preserved as-is. Only the `predicate` column is updated.
- Re-running `--apply` is safe (idempotent): if no alias rows remain, UPDATE affects 0 rows.

## Post-merge verification

```bash
python3 validate-predicates.py --strict   # must exit 0
python3 validate-predicates.py --json     # alias bucket should now be empty
```
