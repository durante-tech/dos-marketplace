---
name: Recall
description: Fuses semantic vector search with a knowledge-graph entity query, fanning out in parallel to return top-N drawers plus KG facts relevant to the query subject.
status: STABLE
bestPath:
  - title: "Parse the Recall Request"
    description: "Extract the query, KG subject, optional wing/room scope, and result limit."
  - title: "Fan Out Search and KG Query"
    description: "Run semantic search and a KG entity query in parallel."
  - title: "Enrich and Merge Results"
    description: "Grade similarity bands, group KG facts by predicate, and deduplicate overlapping results."
  - title: "Present Results and Offer Follow-ups"
    description: "Lead with a verdict, then offer deeper drawer views, KG timelines, or refined searches."
divergence_from_canonical:
  _intent-to-flag-table.md:
    partial_version: 1.0.0
    reason: "MemPalace Recall maps semantic search and KG query parameters; canonical Mode/Output two-table shape does not fit"
---

# Recall from MemPalace

Retrieve specific knowledge from the palace by combining semantic vector search (what does this mean?) with knowledge graph query (what facts do we hold about this entity?). Returns top-N drawers plus KG facts relevant to the query subject.

> **Scope — Recall deterministically owns "recall X".** The **"recall X"** trigger routes here, NOT to Search: Recall is the canonical surface for "recall X" (semantic search fused with knowledge-graph recall). Search owns literal/keyword-only phrasing; Recall owns recall + entity-fact fusion.

## When to Use

- Trigger phrases: "recall", "recall X", "retrieve", "remember", "what do we know about", "query memory", "semantic recall", "semantic+KG fanout".
- Situation: retrieving specific knowledge by fusing semantic search with knowledge-graph facts about an entity.
- NOT for literal/keyword-only lookups — use Search (Search owns literal/keyword phrasing; Recall owns "recall X" plus semantic+KG fusion).

## Step 1: Parse the Recall Request

Extract from the operator's request:
- **query**: The natural-language search string (required). Strip preamble ("what did we decide about", "recall", "do we know anything on").
- **subject**: KG entity name to query (often same as query; required for KG path).
- **wing** (optional): Scope to a specific project wing. If in a mapped project directory, detect from PROJECTS.md.
- **room** (optional): Further narrow to a specific room.
- **limit**: Number of semantic results. Default 5.

## Step 2: Fan Out — Search + KG Query in Parallel

Run both paths simultaneously.

**Path A — Semantic search (MCP preferred):**

```
mempalace_search(query="QUERY", limit=5, wing="OPTIONAL_WING", room="OPTIONAL_ROOM")
```

**Fallback:**

```bash
uv run --with mempalace python ~/.claude/DOS/Tools/mempalace_bridge.py search \
  '{"query":"QUERY","limit":5,"wing":"OPTIONAL_WING"}'
```

**Path B — KG entity query:**

```
mempalace_kg_query(subject="SUBJECT", limit=20)
```

**Fallback:**

```bash
uv run --with mempalace python ~/.claude/DOS/Tools/mempalace_bridge.py kg_query \
  '{"subject":"SUBJECT","limit":20}'
```

If either path errors because the bridge/daemon (`$DOS_DIR/MEMORY/STATE/.mempalace.sock`) is unreachable, do NOT report "nothing found" — render the DEGRADED banner and stop:

```text
🔴 MEMPALACE DEGRADED — the memory bridge is unreachable.
   Reads/writes this session are NOT landing; do not assume anything persisted.
   Recover: run the Doctor workflow (`/MemPalace Doctor`) for the guided repair ladder.
```

## Step 3: Enrich and Merge Results

- For each semantic result: check `similarity` (0..1, higher is better) and grade against the shared band table:

| Band   | similarity   | Label         |
|--------|--------------|---------------|
| HIGH   | >= 0.70      | strong match  |
| MEDIUM | 0.40 – 0.69  | partial match |
| LOW    | < 0.40       | loose match   |

- For KG facts: group by predicate. Surface `decided`, `committed_to`, `deferred_to`, `worked_on` facts prominently.
- Deduplicate: if a drawer appears in both paths, merge into one result row.

## Intent-to-Flag Mapping

| User Says | Action | Notes |
|-----------|--------|-------|
| "recall X" / "what do we know about X?" / "find memories about X" | `search` + `kg_query` | Full fan-out |
| "what did we decide about X?" | `search` + `kg_query` (predicate filter: `decided`) | KG result takes priority |
| "search memory for X in <wing>" | `search` (wing=named) | Scoped semantic only |
| "show KG facts for X" | `kg_query` only | Graph path only |
| "recall recent work on X" | `search` + `kg_query` (predicate filter: `worked_on`) | Temporal sort on KG results |
| "is it true that X?" / "did we decide X?" / "verify: X" (a CLAIM, not an open query) | `fact_check` | VERIFY-MODE sub-mode — returns true / false / unknown (see below) |

### JSON Argument Shape

| Action | Required Args | Optional Args |
|--------|--------------|---------------|
| `search` | `query` (string) | `limit` (int, default 5), `wing`, `room` |
| `kg_query` | `subject` (string) | `predicate` (filter), `limit` (int, default 20) |
| `fact_check` | `claim` (string) | `wing` (string) |

## VERIFY-MODE (fact_check sub-mode)

This is a Recall sub-mode, NOT a separate workflow. When the operator gives a **claim** to verify (not an open-ended query) — "is it true that X?", "did we decide X?", "verify: X" — call the bridge `fact_check` action instead of the search + kg_query fan-out, and return a single verdict: **true / false / unknown**.

**MCP preferred:**

```
mempalace_fact_check(claim="CLAIM")
```

**Fallback:**

```bash
uv run --with mempalace python ~/.claude/DOS/Tools/mempalace_bridge.py fact_check \
  '{"claim":"CLAIM"}'
```

Map the bridge result to one verdict and cite the supporting drawers/KG facts:

```
fact_check: "CLAIM"
Verdict: TRUE | FALSE | UNKNOWN
  Evidence: [wing/room] preview… / KG fact: <predicate> "…"
```

`UNKNOWN` is the honest default when the palace holds no corroborating evidence — never coerce it to TRUE/FALSE. If the bridge is unreachable, render the DEGRADED banner above rather than returning a verdict.

## Step 4: Present Results

The FIRST line is a verdict (semantic + KG counts + echoed query). The SECOND line NAMES the executed surface and wing scope.

```
N semantic results | M KG facts · query: "QUERY"
Recall — semantic + knowledge-graph [wing: WING]

Semantic Matches:
  1. [wing/room] (HIGH|MEDIUM|LOW)
     Preview (first 200 chars)...

  2. [wing/room] ...

Knowledge Graph Facts:
  decided:       "X was decided on YYYY-MM-DD"
  committed_to:  "Y"
  worked_on:     "Z"
```

If no results in either path:

```
Nothing found for "QUERY".

Try:
  - A broader query
  - Remove wing/room filter
  - "mine this project" to index missing content
```

## Step 5: Offer Follow-ups

After presenting results:
- "Want to see the full drawer for result N?"
- "Explore KG connections from [entity]?" — invoke `mempalace_kg_timeline`
- "Search with different terms?"
