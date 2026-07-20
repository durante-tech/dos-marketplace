---
name: MergeEntities
description: Surfaces KG entity-merge proposals filed by the hygiene system for operator review, then applies accepted merges via the bridge's merge_entities action.
status: STABLE
bestPath:
  - title: "Load Pending Proposals"
    description: "Read the merge-proposals JSONL ledger written by KgMerge.hook.ts."
  - title: "Present for Operator Review"
    description: "Lead with a verdict — pending count split by confidence — then list each proposal."
  - title: "Apply Accepted Merges"
    description: "Re-key triples from alias entities to the canonical entity via merge_entities."
  - title: "Update the Proposal Ledger"
    description: "Rewrite each processed proposal's status to applied or rejected."
divergence_from_canonical:
  _intent-to-flag-table.md:
    partial_version: 1.0.0
    reason: "MemPalace entity merge maps proposal review and apply actions; canonical Mode/Output two-table shape does not fit"
---

# Review and Apply KG Merge Proposals

The KG hygiene system produces entity merge proposals when it detects likely duplicates (e.g., `jane-doe` vs `Jane Doe` vs `jane doe`). Proposals are written to `MEMORY/STATE/kg-merge-proposals.jsonl` by `KgMerge.hook.ts`. This workflow surfaces those proposals for operator review, then applies accepted merges via the bridge.

## When to Use

- Trigger phrases: "review entity merges", "KG entity duplicates", "apply merge proposals".
- Situation: the KG hygiene system has filed duplicate-entity merge proposals that need operator review and application.
- NOT for predicate aliases or orphaned-triple cleanup — use MergePredicates or MergeReconcile (MergeEntities only collapses duplicate entity names).

## Step 1: Load Proposals

```bash
# Count pending proposals
wc -l < ~/.claude/MEMORY/STATE/kg-merge-proposals.jsonl 2>/dev/null || echo "0"

# Read all proposals
cat ~/.claude/MEMORY/STATE/kg-merge-proposals.jsonl 2>/dev/null
```

Each JSONL line has shape:

```json
{
  "id": "merge-YYYYMMDD-HHMMSS-NNN",
  "canonical": "entity-canonical-name",
  "aliases": ["Alias One", "alias-two"],
  "triple_count": 12,
  "similarity": 0.94,
  "proposed_at": "YYYY-MM-DDTHH:MM:SSZ",
  "status": "pending"
}
```

## Step 2: Present Proposals

Lead with the verdict — a single top line that states the merge load before the per-proposal detail:

```
VERDICT — [N] merge proposals pending ([H] high-confidence >= 0.90, [R] need review < 0.90); none applied yet (or "no proposals pending").

KG Merge Proposals (N pending):

  [1] canonical: "entity-canonical-name"
      aliases:   "Alias One", "alias-two"
      facts:     12 triples would be re-keyed
      similarity: 0.94
      proposed:  YYYY-MM-DD

  [2] ...

Accept [1-N], reject [1-N], or "accept all" / "reject all"
```

## Step 3: Apply Accepted Merges

For each accepted proposal, invoke the bridge `merge_entities` action:

```bash
uv run --with mempalace python ~/.claude/DOS/Tools/mempalace_bridge.py merge_entities \
  '{"canonical":"entity-canonical-name","aliases":["Alias One","alias-two"]}'
```

This re-keys all KG triples from alias entities to the canonical entity and removes the alias entity records.

## Step 4: Update Proposal Status

After applying, mark each processed proposal in the JSONL by rewriting its `status` field:
- Accepted + applied → `"status": "applied"`
- Rejected → `"status": "rejected"`

Write the updated file back (filter + rewrite, do not append — the file is a ledger not a log).

## Related Mode — Retype or Rename an Entity (`update_entity`)

Merging collapses duplicate entities into one. The sibling `update_entity` action edits a single entity **in place** — change its **type** (retype) or its stored properties — without touching any other entity. Reach for it when an entity is correctly distinct but mis-typed (e.g., a `pack` recorded as a `skill`).

**Retype an entity:**

```bash
uv run --with mempalace python ~/.claude/DOS/Tools/mempalace_bridge.py update_entity \
  '{"entity":"mempalace","type":"pack"}'
```

`update_entity` takes `entity` (required) plus optional `type` and `properties` (a JSON string merged into the entity record).

**Rename a canonical id:** `update_entity` edits an entity's type/properties in place but does NOT rekey its name. To rename an entity's canonical id, run `merge_entities` from the old name into the new canonical name — that repoints every triple onto the new key and removes the stale entity. Treat a canonical-id rename as a one-row merge, not an in-place edit.

## Intent-to-Flag Mapping

| User Says | Action | Notes |
|-----------|--------|-------|
| "review merge proposals" / "show kg merges" / "what entities should be merged?" | Read JSONL + present | No writes until operator approves |
| "accept merge [N]" / "merge entities [canonical] and [alias]" | `merge_entities` bridge call | Single proposal apply |
| "accept all merges" | `merge_entities` for each pending proposal | Batch apply — confirm count first |
| "reject merge [N]" | Mark `status: "rejected"` in JSONL | No KG change |
| "retype [entity] to [type]" / "this entity is mis-typed" | `update_entity` bridge call | In-place type/property edit — no merge |
| "rename [old] to [new]" / "change the canonical id" | `merge_entities` (old → new) | Rekey via merge; `update_entity` cannot rename |

### JSON Argument Shape

| Action | Required Args | Optional Args |
|--------|--------------|---------------|
| `merge_entities` | `canonical` (string), `aliases` (string[]) | none |
| `update_entity` | `entity` (string) | `type` (string), `properties` (JSON string) |

## If the Bridge Is Unreachable

Steps 3 and the `update_entity` mode above shell out to the MemPalace bridge. If a bridge call errors out or the daemon socket is dead, the merge/retype did NOT land — do not mark the proposal `applied`. STOP and surface the DEGRADED banner verbatim:

```text
🔴 MEMPALACE DEGRADED — the memory bridge is unreachable.
   Reads/writes this session are NOT landing; do not assume anything persisted.
   Recover: run the Doctor workflow (`/MemPalace Doctor`) for the guided repair ladder.
```

## Notes

- The file at `MEMORY/STATE/kg-merge-proposals.jsonl` is project-eligible (resolves via `getMemorySubdir('STATE')`). Check the project-level path first: `$CLAUDE_PROJECT_DIR/MEMORY/STATE/kg-merge-proposals.jsonl`.
- `similarity` is the cosine similarity of the entity name embeddings. Proposals above 0.90 are high-confidence; 0.80-0.89 warrant manual review.
- Merges are irreversible in the KG — the alias entity's triples are re-keyed and the alias entity removed. Recommend reviewing triples before applying any merge below 0.85 similarity.
