---
name: Sync Telos
description: Parses DOS's TELOS markdown (goals, beliefs, projects, challenges) and maps it into MemPalace's temporal knowledge graph as queryable entity-relationship facts.
status: STABLE
bestPath:
  - title: "Disk-Guard and Discover TELOS Docs"
    description: "Abort below the disk-safety floor, then enumerate the TELOS corpus."
  - title: "Parse and Map Entities"
    description: "Key each section by its telos:<uuid> anchor and extract relationships to other goals/projects."
  - title: "Write KG Facts and Drawers"
    description: "Add temporal KG triples and mine each TELOS document as a searchable drawer."
  - title: "Invalidate Removed Entities"
    description: "Sweep the corpus against the KG and set valid_to on subjects no longer anchored."
  - title: "Verify"
    description: "Confirm goal/project counts match the corpus anchors."
---

# Sync TELOS Documents to Knowledge Graph

Map DOS's TELOS documents (goals, beliefs, projects, challenges, etc.) into MemPalace's temporal knowledge graph as queryable entity-relationship facts.

## Your Task

Parse TELOS markdown files and create structured KG facts with temporal validity.

## When to Use

- Trigger phrases: "sync telos", "knowledge graph", "map goals", "map beliefs".
- Situation: mapping TELOS markdown (goals, beliefs, projects, challenges) into the knowledge graph as temporal facts.
- NOT for mining a project repo or DOS memory trees — use MineProject or Mine (SyncTelos reads TELOS markdown specifically).

## Bounded Ingest Contract (shared by Mine · MineDir · MineProject · SyncTelos)

Every mining write follows the same four-step contract — never open-code a divergent loop:
1. **Disk-guard** — run the Step-0 preflight (INV-2 / `MemPalaceCli.ts render-disk-guard`); abort below the 5GB floor.
2. **Warm daemon** — set `DOS_USE_BRIDGE_DAEMON=1` on every bridge call (amortizes the ~8-9s cold ONNX load to ~0.18s warm).
3. **Per-tree ingest** — prefer one `mine_dir` per directory over per-file `mine_file` loops (O(dirs) spawns, not O(files)).
4. **Verify-persisted** — confirm by a `kg_stats`/drawer-count DELTA (never `memories_filed_away`).

## Step 0: Disk-Guard Preflight

```bash
# Step 0 — Disk-Guard Preflight (MANDATORY before any mining write)
# 2026-06-22 disk-fill prevention: abort ingest if the palace volume is below the safety floor.
PALACE_DIR="${MEMPALACE_DIR:-$HOME/.mempalace}"
FREE_GB=$(df -Pk "$PALACE_DIR" 2>/dev/null | awk 'NR==2 {printf "%d", $4/1048576}')
if [ "${FREE_GB:-0}" -lt 5 ]; then
  echo "🔴 DISK-GUARD ABORT — ${FREE_GB}GB free on the palace volume (< 5GB floor)."
  echo "   Mining halted to prevent a disk-fill freeze (2026-06-22). Free space, then re-run."
  exit 2
fi
echo "🟢 DISK-GUARD — ${FREE_GB}GB free (>= 5GB floor); safe to mine."
```

If any bridge or daemon call below is unreachable, surface the DEGRADED banner and stop:

```text
🔴 MEMPALACE DEGRADED — the memory bridge is unreachable.
   Reads/writes this session are NOT landing; do not assume anything persisted.
   Recover: run the Doctor workflow (`/MemPalace Doctor`) for the guided repair ladder.
```

## Step 1: Find TELOS Documents

```bash
ls ~/.durante/user/TELOS/ 2>/dev/null || echo "NO_TELOS"
```

Expected documents (live corpus, lowercase): mission.md, goals.md, projects.md, beliefs.md, models.md, strategies.md, narratives.md, learned.md, challenges.md, ideas.md, lessons.md, updates.md, visions.md, wisdom.md, frames.md, telos.md (and others — enumerate with ls)

## Step 2: Parse and Map Each Document

Read each TELOS file and extract entities and relationships.

### Mapping Rules

| TELOS Document | KG Subject | KG Predicate | KG Object |
|---------------|------------|--------------|-----------|
| mission.md | `user` | `mission_is` | mission statement text |
| goals.md | `goal:{uuid}` | `targets` | goal title + description |
| goals.md | `goal:{uuid}` | `depends_on` | related goal or project |
| projects.md | `project:{uuid}` | `status` | active/completed/paused |
| projects.md | `project:{uuid}` | `serves_goal` | `goal:{uuid}` of the goal it advances |
| beliefs.md | `user` | `believes` | belief statement |
| models.md | `model:{name}` | `is_a` | model type/family (free-text description stays a drawer, not a triple) |
| strategies.md | `strategy:{name}` | `serves_goal` | related goal |
| challenges.md | `challenge:{name}` | `blocks` | what it blocks |
| learned.md | `user` | `learned` | lesson text |
| ideas.md | `idea:{name}` | `relates_to` | related entity |

### Parsing Approach

For each TELOS file:
1. Read the full content
2. Identify sections (`###` headers) as entities
3. **Key entities by their `<!-- telos:<uuid> -->` anchor** (the line under the header) —
   NEVER by title text, which mutates in place. Subject = `goal:<uuid>` / `project:<uuid>`.
   The human title travels as the `targets` fact's object payload. Sections without an
   anchor are skipped with a console note (the anchor is the join key for KG, Studio, and
   telos_relevance — campaign §6).
4. Parse relationships from content (mentions of other goals, projects, etc.)
5. Use today's date as `valid_from` for all new facts. The KG store is INSERT OR IGNORE on
   identical (subject, predicate, object), so re-running this workflow is idempotent.

## Step 3: Write KG Facts

<!-- kg-writer: canonical predicates only (PREDICATES.md §3) -->
> **Predicate discipline (PREDICATES.md §3).** This workflow writes KG facts and MUST use only
> canonical predicates from PREDICATES.md §1. Resolve aliases to canonical AT WRITE TIME:
> advances → serves_goal, describes → is_a. Validate with
> `python3 ~/.claude/skills/mem-palace/Tools/validate-predicates.py --scan-workflows ~/.claude/skills/mem-palace/Workflows`.

For each extracted fact, use MCP or bridge:

**Preferred: MCP tool:**
```
mempalace_kg_add(subject="goal:improve-health", predicate="targets", object="Exercise 4x/week", valid_from="2026-04-08")
```

**Fallback: Bridge:**
```bash
DOS_USE_BRIDGE_DAEMON=1 uv run --with mempalace python ~/.claude/DOS/Tools/mempalace_bridge.py add_kg_fact '{"subject":"goal:improve-health","predicate":"targets","object":"Exercise 4x/week","valid_from":"2026-04-08"}'
```

## Step 4: Also File as Drawers

Mine each TELOS document as a palace drawer for semantic search:

Derive the room name deterministically (basename without `.md`, lowercased) via
the CLI helper — do NOT hand-type the `basename | tr` pipeline (RFC-0126 §9 B1,
drift-risk):

```bash
for f in ~/.durante/user/TELOS/*.md; do
  room=$(bun ~/.claude/skills/mem-palace/Tools/MemPalaceCli.ts derive-room "$f")
  DOS_USE_BRIDGE_DAEMON=1 uv run --with mempalace python ~/.claude/DOS/Tools/mempalace_bridge.py mine_file "{\"filepath\":\"$f\",\"wing\":\"telos\",\"room\":\"$room\"}"
done
```

## Step 5: Invalidate removed entities (idempotent-with-invalidation)

The corpus is the source of truth. After writing, query the KG's current goal subjects and
invalidate any that no longer have a matching anchor in the corpus:

```bash
# current KG goal subjects
DOS_USE_BRIDGE_DAEMON=1 uv run --with mempalace python ~/.claude/DOS/Tools/mempalace_bridge.py kg_query_predicate '{"predicate":"targets"}'
# corpus anchors
grep -o 'telos:[a-f0-9-]*' ~/.durante/user/TELOS/goals.md
```

For each KG `goal:<uuid>` subject whose uuid is absent from the corpus anchors:

```bash
DOS_USE_BRIDGE_DAEMON=1 uv run --with mempalace python ~/.claude/DOS/Tools/mempalace_bridge.py invalidate '{"subject":"goal:<uuid>","predicate":"targets"}'
```

Repeat the same sweep for PROJECTS: grep `telos:` anchors from projects.md, query
`kg_query_predicate {"predicate":"status"}` for `project:<uuid>` subjects, and invalidate
`status` AND `serves_goal` facts of any project uuid absent from the corpus. Also invalidate
incoming `serves_goal` edges whose OBJECT is an invalidated `goal:<uuid>` (a dangling edge
to a removed goal is as stale as the goal itself).

Removed goals and projects get `valid_to=today` — never silently kept forever.

## Step 6: Verify

```bash
# Goal count must equal the corpus anchor count
DOS_USE_BRIDGE_DAEMON=1 uv run --with mempalace python ~/.claude/DOS/Tools/mempalace_bridge.py kg_query_predicate '{"predicate":"targets"}'
# serves_goal must be non-empty (projects → goals edges)
DOS_USE_BRIDGE_DAEMON=1 uv run --with mempalace python ~/.claude/DOS/Tools/mempalace_bridge.py kg_query_predicate '{"predicate":"serves_goal"}'
# User-level facts
DOS_USE_BRIDGE_DAEMON=1 uv run --with mempalace python ~/.claude/DOS/Tools/mempalace_bridge.py kg_timeline '{"entity":"user"}'
```

## Verify Persisted (read-back delta — never `memories_filed_away`)

1. BEFORE writing, capture a baseline count via `kg_stats` (KG facts) and/or `status` (drawer count).
2. AFTER writing, re-read the same counts and report the DELTA (e.g. "Drawers persisted: +N, KG facts: +M").
3. If the delta is 0 after a write, the write did NOT land — surface the INV-1 DEGRADED banner.
4. Surface the bridge-event ratio from `dos-memory-status.ts` (healthy band [0.99, 1.01]) as the persistence signal.

## Intent-to-Flag Mapping

This workflow shells out to the MemPalace bridge per CreateSkill workflow Step 6 + CliFirstArchitecture.md. Translate operator phrasing into deterministic action selection and JSON-arg shape.

### Mode / Action

| User Says | Bridge Action | Effect |
|-----------|---------------|--------|
| "sync telos to mempalace" / "rebuild kg from telos" | `add_kg_fact` (per parsed fact) | Create temporal entity-relationship facts from TELOS markdown |
| "also file telos as drawers" / "make telos searchable" | `mine_file` (per TELOS doc) | Add semantic-searchable drawers to the `telos` wing |
| "verify the telos sync" / "show me the user timeline" | `kg_timeline` | Inspect facts written for a given entity |
| "outdated belief — invalidate it" | `invalidate` | Mark a fact's `valid_to` so it stops counting as current |

### JSON Argument Shape

| Action | Required JSON Args | Optional JSON Args |
|--------|--------------------|--------------------|
| `add_kg_fact` | `subject`, `predicate`, `object` (strings) | `valid_from`, `valid_to` (ISO date), `source_file` |
| `mine_file` | `filepath`, `wing`, `room` (strings) | `chunk_size` (int) |
| `kg_timeline` | `entity` (string) | `predicate` (string filter) |
| `invalidate` | `subject`, `predicate`, `object` | `valid_to` (ISO date, default today) |

## Output Format

Lead with the verdict line, then the detail block:

```
VERDICT: ✅ SYNCED (M KG facts, D drawers, delta verified) | ⚠️ PARTIAL | 🔴 DEGRADED (bridge unreachable — facts NOT persisted)

TELOS Sync Complete

  Documents processed: N
  KG facts created: M
  Palace drawers filed: D

  Entity summary:
    - user: X facts (mission, beliefs, lessons)
    - goals: Y entities with Z relationships
    - projects: P entities
    - challenges: C entities

  Try: "what are my current goals?" or "what blocks [goal]?"
```

## Important Notes

- This is an additive operation — existing KG facts are not deleted
- Run this periodically when TELOS documents change
- Use `mempalace_kg_invalidate` to mark outdated facts as ended
- Cross-references between goals/projects/challenges create traversable graph paths