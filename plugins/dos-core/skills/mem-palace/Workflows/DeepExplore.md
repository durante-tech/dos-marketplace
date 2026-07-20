---
name: Deep Explore
description: Gap-aware project exploration — scans codebase against MemPalace state, identifies coverage gaps, and mines missing content with proper drawers and KG facts.
status: STABLE
bestPath:
  - title: "Scan for Gaps"
    description: "Run PalaceExplore against the project to compare its files against current MemPalace state."
  - title: "Present the Gap Report"
    description: "Render the coverage/gaps skeleton and confirm the mining plan with the operator."
  - title: "Mine P0 and P1 Gaps"
    description: "File missing content as summary drawers and KG triples, prioritizing critical rooms first."
  - title: "Checkpoint and Verify"
    description: "Record the explore timestamp and confirm the coverage delta improved before reporting."
divergence_from_canonical:
  _intent-to-flag-table.md:
    partial_version: 1.0.0
    reason: "MemPalace workflow uses custom Bridge-action vocabulary (mempalace_search/traverse); canonical Mode/Output two-table shape doesn't fit"
  _workflow-output-shape.md:
    partial_version: 1.0.0
    reason: "MemPalace workflow has bespoke Output Format section"
---

# Deep Explore — Gap-Aware MemPalace Mining

Scans the current project, compares it to what MemPalace already knows, and mines the delta. Unlike `MineProject` (which mines blind), DeepExplore only touches what's missing or stale.

<!-- partial: _workflow-voice.md skill_name=MemPalace workflow_name=DeepExplore action_phrase=" to analyze gaps and mine missing content" -->

## Step 0: Disk-Guard Preflight (MANDATORY before any mining write)

Run the disk-guard preflight before any mining write — it aborts ingest if the palace volume is below the safety floor (2026-06-22 disk-fill prevention).

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

## Step 1: Run PalaceExplore Scanner

```bash
bun ~/.claude/skills/mem-palace/Tools/PalaceExplore.ts "$(pwd)"
```

This produces `.mempalace/explore-report.json` (log it to `MEMORY/ARTIFACTS/artifacts.jsonl` per the house artifact-tracking pattern) with:
- Current MemPalace state (drawers, rooms, KG entities)
- Project file inventory (grouped by room mapping)
- Coverage gaps (missing rooms, thin rooms, stale content, missing KG entities)
- Mining plan (ordered list of actions)

**Read the JSON output** and present a summary to the user.

## Step 2: Present Gap Report

Show the user the gap analysis before mining. The gap-report markdown is a
deterministic render of the Step 1 `explore-report.json` — do NOT hand-type the
skeleton (RFC-0126 §9 B2). Render it via the helper:

```bash
bun ~/.claude/skills/mem-palace/Tools/PalaceExplore.ts --dry "$(pwd)" \
  | bun -e 'import {renderGapReport} from "~/.claude/skills/mem-palace/Tools/PalaceExplore"; \
            const r=JSON.parse(await Bun.stdin.text()); console.log(renderGapReport(r));'
```

Or call `renderGapReport(exploreReport)` directly (exported from
`Packs/mem-palace/src/Tools/PalaceExplore.ts`, golden-tested in
`PalaceExplore.test.ts`). It emits the Palace-Explore / Coverage / Gaps-by-P0-P1-P2
/ Mining-Plan skeleton byte-for-byte from the JSON.

**Ask for confirmation** before proceeding. The user may want to skip certain rooms or adjust priority — that judgment stays with you; only the skeleton is mechanized.

## Step 3: Mine P0 Gaps (Critical)

For each P0 gap in the explore report, mine the missing content. P0 gaps are rooms with artifacts that have ZERO representation in MemPalace.

## Bounded Ingest Contract (shared by Mine · MineDir · MineProject · SyncTelos)

Every mining write follows the same four-step contract — never open-code a divergent loop:
1. **Disk-guard** — run the Step-0 preflight (INV-2 / `MemPalaceCli.ts render-disk-guard`); abort below the 5GB floor.
2. **Warm daemon** — set `DOS_USE_BRIDGE_DAEMON=1` on every bridge call (amortizes the ~8-9s cold ONNX load to ~0.18s warm).
3. **Per-tree ingest** — prefer one `mine_dir` per directory over per-file `mine_file` loops (O(dirs) spawns, not O(files)).
4. **Verify-persisted** — confirm by a `kg_stats`/drawer-count DELTA (never `memories_filed_away`).

<!-- kg-writer: canonical predicates only (PREDICATES.md §3) -->
> **Predicate discipline (PREDICATES.md §3).** This workflow writes KG facts and MUST use only
> canonical predicates from PREDICATES.md §1. Resolve aliases to canonical AT WRITE TIME:
> has_skill/has_pack/has_hook/has_agent/has_schema → has_component. Validate with
> `python3 ~/.claude/skills/mem-palace/Tools/validate-predicates.py --scan-workflows ~/.claude/skills/mem-palace/Workflows`.

### Mining Strategy by Room Type

**Architecture / Stack / Configuration rooms:**
- Read the actual files listed in `artifacts[]`
- For each file, write a **summary drawer** (not raw dump): what the file defines, key patterns, important values
- Use `mempalace_add_drawer` with wing, room, and a concise content summary (500-1000 chars per drawer)

**Skills room:**
- For each `SKILL.md` found in artifacts:
  1. Read the file
  2. Extract: name, description, workflows, trigger phrases, dependencies, tier
  3. File as one drawer per skill: `mempalace_add_drawer(wing, "skills", content)`
  4. Create KG triple: `mempalace_kg_add(subject=WING, predicate="has_component", object=SKILL_NAME)`
  5. Write the MANDATORY type triple: `mempalace_kg_add(subject=SKILL_NAME, predicate="is_a", object="skill")`

**Hooks room:**
- For each `.hook.ts` found in artifacts:
  1. Read the file (first 80 lines is usually enough — hooks are concise)
  2. Extract: purpose, lifecycle event, what it calls, dependencies
  3. File as one drawer per hook: `mempalace_add_drawer(wing, "hooks", content)`
  4. Create KG triple: `mempalace_kg_add(subject=WING, predicate="has_component", object=HOOK_NAME)`
  5. Write the MANDATORY type triple: `mempalace_kg_add(subject=HOOK_NAME, predicate="is_a", object="hook")`
  6. Create relationship: `mempalace_kg_add(subject=HOOK_NAME, predicate="fires_on", object=LIFECYCLE_EVENT)`

**Packs room:**
- For each `README.md` or `SKILL.md` in pack artifacts:
  1. Read the file
  2. Extract: pack name, purpose, key capabilities, install method
  3. File as one drawer per pack: `mempalace_add_drawer(wing, "packs", content)`
  4. Create KG triple: `mempalace_kg_add(subject=WING, predicate="has_component", object=PACK_NAME)`
  5. Write the MANDATORY type triple: `mempalace_kg_add(subject=PACK_NAME, predicate="is_a", object="pack")`

**Agents room:**
- For each `*Context.md` or agent pack source:
  1. Read the file
  2. Extract: agent name, personality, capabilities, when to use
  3. File as one drawer per agent: `mempalace_add_drawer(wing, "agents", content)`
  4. Create KG triple: `mempalace_kg_add(subject=WING, predicate="has_component", object=AGENT_NAME)`
  5. Write the MANDATORY type triple: `mempalace_kg_add(subject=AGENT_NAME, predicate="is_a", object="agent")`

**Database schema room:**
- Read `schema.prisma` (or equivalent)
- Extract: model names, key relationships, indexes
- File as one drawer with schema summary
- Create KG triples for each model: `mempalace_kg_add(subject=WING, predicate="has_component", object=MODEL_NAME)`
- Write the MANDATORY type triple per model: `mempalace_kg_add(subject=MODEL_NAME, predicate="is_a", object="model")`

**API routes room:**
- Group route files by domain (auth, billing, gateway, sync, etc.)
- For each group, read representative files and write a summary drawer
- Do NOT mine every route file — mine the pattern, not every instance
- Create KG triples for major API surface areas

**Routes / Pages room:**
- Group page files by route group ((public), (internal), (admin))
- Write one drawer per route group summarizing the pages
- Focus on public-facing routes for marketing accuracy

### Mining Rules

1. **Read before filing.** Every drawer must contain verified content, never guesses.
2. **Summarize, don't dump.** A 500-char summary of a file is more useful than 5000 chars of raw content. Extract the *why* and *what*, not the implementation details.
3. **One drawer per artifact.** Don't cram 10 skills into one drawer — each skill gets its own drawer so search can find individual items.
4. **KG triples for relationships.** Every mined artifact (skill, hook, pack, agent, model) gets TWO KG triples — a `has_component` triple connecting it to the project entity, AND a MANDATORY `is_a` type triple (`subject=ARTIFACT, predicate="is_a", object="<type>"`). The `is_a` triple is uniform across every Step-3 mining strategy — never conditional on "importance".
5. **Batch when possible.** Use `bridge.py batch` for multiple operations in one subprocess call to reduce overhead.

### Batching Pattern

For rooms with many artifacts (skills, hooks, packs), use bridge batch:

```bash
DOS_USE_BRIDGE_DAEMON=1 uv run --with mempalace python ~/.claude/DOS/Tools/mempalace_bridge.py batch '{
  "operations": [
    {"action": "add_drawer", "args": {"wing": "WING", "room": "skills", "content": "...", "source_file": "SKILL.md", "added_by": "deep-explore"}},
    {"action": "add_drawer", "args": {"wing": "WING", "room": "skills", "content": "...", "source_file": "SKILL.md", "added_by": "deep-explore"}},
    {"action": "add_kg_fact", "args": {"subject": "WING", "predicate": "has_component", "object": "SkillName"}},
    {"action": "add_kg_fact", "args": {"subject": "SkillName", "predicate": "is_a", "object": "skill"}}
  ]
}'
```

Or use MCP tools directly (one call per operation):
- `mempalace_add_drawer(wing, room, content, source_file, added_by)`
- `mempalace_kg_add(subject, predicate, object)`

## Intent-to-Flag Mapping

This workflow shells out to `PalaceExplore.ts` and the MemPalace bridge per CreateSkill workflow Step 6 + CliFirstArchitecture.md. Translate operator phrasing into deterministic action selection.

### Mode / Action

| User Says | Bridge Action / CLI | Effect |
|-----------|---------------------|--------|
| "deep explore this project" / "scan gaps and mine" | `PalaceExplore.ts` then `batch` | Gap-scan + mine missing rooms in one pass |
| "preview the gaps without mining" | `PalaceExplore.ts --dry` | Print explore-report.json without writing drawers |
| "file a single artifact summary" | `add_drawer` | Insert one summary drawer into wing/room |
| "tag the project with this entity" | `add_kg_fact` | Create relationship triple (e.g., `wing has_component SkillName`) |
| "update an existing drawer" | `update_drawer` | Refresh stale content in place by drawer-id |
| "do many writes in one subprocess" | `batch` | Run an array of `{action, args}` pairs in a single bridge call |

### JSON Argument Shape

| Action | Required JSON Args | Optional JSON Args |
|--------|--------------------|--------------------|
| `add_drawer` | `wing`, `room`, `content` (strings) | `source_file`, `added_by` (strings) |
| `update_drawer` | `drawer_id`, `content` | `wing`, `room` |
| `add_kg_fact` | `subject`, `predicate`, `object` | `valid_from`, `valid_to` |
| `batch` | `operations` (array of `{action, args}`) | none |

### Options

| User Says | Flag | Effect |
|-----------|------|--------|
| "just a dry run, don't write" | `--dry` (PalaceExplore.ts) | Produce report only |
| "scan a different project" | `<absolute-path>` argument | Target a non-cwd project root |

## Step 4: Mine P1 Gaps (Important)

Same strategy as P0, but these rooms have some existing coverage that's thin. When mining P1 gaps:

1. **Search existing drawers first** — `mempalace_search(query=ROOM_NAME, wing=WING)` to see what's already there
2. **Mine only what's missing** — if a drawer already covers a file, skip it
3. **Update stale content** — if a drawer exists but the file has changed significantly, use `mempalace_update_drawer` to refresh it

## Step 5: Address KG Entity Gaps

For each `missing_entity` gap in the report:

1. Read the artifacts listed for that room
2. Extract entity names (skill names, hook names, pack names, etc.)
3. Create the composition KG triple connecting them to the project entity (canonical `has_component`):
   ```
   mempalace_kg_add(subject=WING, predicate="has_component", object=ENTITY_NAME)
   ```
4. Write the MANDATORY `is_a` type triple for EVERY entity (not just "important" ones), plus the `part_of` relationship:
   ```
   mempalace_kg_add(subject=ENTITY_NAME, predicate="is_a", object="<type>")
   mempalace_kg_add(subject=ENTITY_NAME, predicate="part_of", object=WING)
   ```

## Step 6: Update Explore Timestamp

After mining is complete, record the checkpoint so the next explore only
processes the delta. The mkdir + fixed-shape JSON write is deterministic — do
NOT hand-type the `echo '{...}'` (RFC-0126 §9 B6). Invoke the CLI with the
counts you recorded during this run:

```bash
# args: <project-path> <gaps_found> <actions_taken> <wing> [date — defaults to now]
bun ~/.claude/skills/mem-palace/Tools/PalaceExplore.ts checkpoint "$(pwd)" N M WING
```

Helper: `writeExploreCheckpoint(projectPath, { date, gaps_found, actions_taken,
wing })` in `Packs/mem-palace/src/Tools/PalaceExplore.ts` (golden-tested in
`PalaceExplore.test.ts`). It creates `.mempalace/` and writes
`last-explore.json` in the exact `{date, gaps_found, actions_taken, wing}` shape
that `getLastExploreDate()` reads back on the next explore.

## Step 7: Verify and Report (MANDATORY)

**Lead with a verdict-first line.** Open the report with a single verdict before any detail, e.g. `✅ COVERAGE IMPROVED — 62% → 81% (+12 drawers, +8 triples)` or `🔴 NO IMPROVEMENT — coverage flat; investigate room/wing mismatch`.

**This step is not optional.** Run PalaceExplore again to produce a before/after comparison. Without this, there's no evidence the mining actually improved coverage.

```bash
bun ~/.claude/skills/mem-palace/Tools/PalaceExplore.ts --dry "$(pwd)"
```

Compare the new report's `coverage.pct` against the original from Step 1 (this coverage DELTA is the persistence signal — if it is flat after a write, the write did not land). If coverage didn't improve meaningfully, investigate — drawers may have been filed to wrong rooms, or the wing name may be mismatched.

**On bridge/daemon failure** — if any bridge call errored, timed out, or the coverage delta is 0 after a write, the memory bridge is unreachable. Surface the DEGRADED banner verbatim and stop:

```text
🔴 MEMPALACE DEGRADED — the memory bridge is unreachable.
   Reads/writes this session are NOT landing; do not assume anything persisted.
   Recover: run the Doctor workflow (`/MemPalace Doctor`) for the guided repair ladder.
```

Present a before/after comparison. The comparison markdown is a deterministic
render of the two explore-report JSONs plus the mining tallies you recorded — do
NOT hand-type the skeleton (RFC-0126 §9 B2). Call
`renderExploreComparison(before, after, tally)` (exported from
`Packs/mem-palace/src/Tools/PalaceExplore.ts`, golden-tested in
`PalaceExplore.test.ts`), where:

- `before` = the Step 1 explore-report.json, `after` = the Step 7 re-run
- `tally` = `{ drawers_filed, triples_created, drawers_updated, artifacts_skipped, remaining_gaps }`
  — the action counts from THIS mining run (your judgment work; not in either snapshot)

The helper computes the `(+N)` drawer/triple deltas and emits the
Before / After / Actions-taken / Remaining-gaps skeleton byte-for-byte.

## Parallelization

For large projects with many P0 gaps, the LLM orchestrator should spawn parallel agents:

- **Agent per room type**: One agent mines skills, another mines hooks, another mines API routes
- Use `subagent_type: "general-purpose"` with a focused prompt per room
- Each agent gets the explore report + its assigned room's artifact list
- Agents file drawers and KG triples independently (MemPalace handles concurrent writes)

Compose agents via trait composition for best results:
```bash
bun ~/.claude/skills/agents/Tools/ComposeAgent.ts --traits "technical,analytical,thorough" --output json
```

## When to Use

- **First time on a project**: Run after `sentinel scan` to populate MemPalace deeply
- **After major changes**: New features, refactors, dependency upgrades
- **Before launches**: Ensure MemPalace reflects the shipping product
- **Periodically**: Monthly or quarterly to catch drift

## Trigger Phrases

- "explore this project" / "deep explore"
- "update memory for this project"
- "what's missing in memory?"
- "mine the gaps"
- "refresh palace for [project]"
