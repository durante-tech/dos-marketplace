---
name: Save
description: Files verbatim content into the palace drawer layer for later semantic retrieval, with optional duplicate checking, upsert, and guarded delete.
status: STABLE
bestPath:
  - title: "Parse the Save Request"
    description: "Extract the content, wing, room, and hall (memory type) to file under."
  - title: "Check for Duplicates"
    description: "Run a similarity check before filing to avoid redundant drawers."
  - title: "File the Content"
    description: "Call add_drawer, upsert_drawer, or the guarded delete_drawer for destructive removal."
  - title: "Confirm Persisted"
    description: "Lead with a verdict from the read-back delta, then report wing/room/drawer detail."
divergence_from_canonical:
  _intent-to-flag-table.md:
    partial_version: 1.0.0
    reason: "MemPalace Save maps drawer filing fields; canonical Mode/Output two-table shape does not fit"
---

# Save Content to MemPalace

File verbatim content into the palace for later retrieval. This is the canonical path for recording anything worth remembering — decisions, findings, summaries, or raw notes. Content is stored in the drawer layer (verbatim, never summarized) and becomes immediately searchable via semantic search.

## When to Use

- Trigger phrases: "save", "file this", "store this", "remember this", "write to memory", "file a drawer".
- Situation: recording verbatim content — decisions, findings, summaries, notes — into the palace for later retrieval.
- NOT for forcing content into always-loaded L1 context — use Pin (Save files normally; Pin additionally sets the always-loaded flag).

## Step 1: Parse the Save Request

Extract from the operator's request:
- **content**: The verbatim text to store (required)
- **wing**: Project slug or domain (e.g., `durante`, `altyaa`, `work`). Default: detect from current project via PROJECTS.md, fall back to `work`.
- **room**: Named idea or topic (e.g., `auth-migration`, `pricing-decision`). Default: derive from content if omitted.
- **hall**: Memory type. One of `hall_facts`, `hall_events`, `hall_discoveries`, `hall_preferences`, `hall_advice`, `hall_diary`. Default: `hall_facts`.
- **source_file**: Absolute path to the originating file, if applicable.

## Step 2: Check for Duplicates (Optional but Recommended)

Before filing, check similarity to avoid redundant drawers:

```
mempalace_check_duplicate(content="CONTENT_PREVIEW", threshold=0.92, wing="WING")
```

If similarity >= 0.92, surface the existing drawer and ask the operator whether to file anyway or update the existing one.

## Step 3: File the Content

**Preferred: MCP tool if available:**

```
mempalace_add_drawer(
  content="VERBATIM_CONTENT",
  wing="WING",
  room="ROOM",
  hall="hall_facts",
  source_file="OPTIONAL_PATH"
)
```

**Fallback: Bridge:**

```bash
uv run --with mempalace python ~/.claude/DOS/Tools/mempalace_bridge.py add_drawer \
  '{"content":"VERBATIM_CONTENT","wing":"WING","room":"ROOM","hall":"hall_facts"}'
```

## Step 3b: Upsert and Guarded Delete

Two adjacent write modes share this workflow. Both are bridge actions in their own right.

**Upsert — `upsert_drawer`.** Idempotent file-or-update: if a drawer with the same `wing`/`room`/content key already exists, `upsert_drawer` updates it in place; otherwise it files a new one. Prefer `upsert_drawer` over `add_drawer` when re-running an ingest that may have partially landed, to avoid duplicate drawers.

```bash
uv run --with mempalace python ~/.claude/DOS/Tools/mempalace_bridge.py upsert_drawer \
  '{"content":"VERBATIM_CONTENT","wing":"WING","room":"ROOM","hall":"hall_facts"}'
```

**Guarded delete — `delete_drawer` (DESTRUCTIVE).** `delete_drawer` permanently removes a drawer and cannot be undone. It is GUARDED: never delete by content match, room sweep, or wing. The action requires BOTH an explicit `drawer_id` AND an explicit operator confirmation in the same turn.

1. Resolve the exact `drawer_id` first (via `search` or `mempalace_get_drawer`) and show the operator the drawer content.
2. Require an explicit "yes, delete drawer DRAWER_ID" confirmation. Absent the literal drawer id + confirmation, REFUSE and stop.
3. Only then issue:

```bash
# GUARDED — requires explicit drawer_id + prior operator confirmation
uv run --with mempalace python ~/.claude/DOS/Tools/mempalace_bridge.py delete_drawer \
  '{"drawer_id":"DRAWER_ID","confirm":true}'
```

After a `delete_drawer`, run the Verify-Persisted read-back (Step 4) and expect a NEGATIVE drawer-count delta to confirm the removal landed.

## Intent-to-Flag Mapping

| User Says | Action | Notes |
|-----------|--------|-------|
| "save this to memory" / "file this" / "remember this" | `add_drawer` | Use current project wing; derive room from content |
| "save to <wing>" / "store in <wing>" | `add_drawer` (wing=named) | Explicit wing routing |
| "save as a decision" / "file this decision" | `add_drawer` (hall=hall_facts, room=derive from content) | Decisions live in hall_facts |
| "save this to <wing>/<room>" | `add_drawer` (wing + room explicit) | Direct addressing |
| "update the existing memory about X" | `mempalace_update_drawer` | Fetch drawer_id first via search, then update |
| "re-file / upsert this so it doesn't duplicate" | `upsert_drawer` | Idempotent file-or-update on wing/room/content key |
| "delete drawer DRAWER_ID" (with explicit id + confirm) | `delete_drawer` (GUARDED) | Requires explicit `drawer_id` + operator confirmation; destructive |

### JSON Argument Shape

| Arg | Type | Required | Default |
|-----|------|----------|---------|
| `content` | string | yes | — |
| `wing` | string | no | project wing or `work` |
| `room` | string | no | derived from content |
| `hall` | string | no | `hall_facts` |
| `source_file` | string | no | none |

## Step 4: Confirm (Verify-Persisted)

**Verdict first.** Lead the confirmation with a one-line verdict before any detail — `✅ PERSISTED (drawers +N, KG +M)` on a landed write, or `🔴 NOT PERSISTED (delta 0)` when the read-back delta is zero. Do NOT confirm a save from the bridge's own success echo or from `memories_filed_away`; confirm only from the read-back delta below.

## Verify Persisted (read-back delta — never `memories_filed_away`)

1. BEFORE writing, capture a baseline count via `kg_stats` (KG facts) and/or `status` (drawer count).
2. AFTER writing, re-read the same counts and report the DELTA (e.g. "Drawers persisted: +N, KG facts: +M").
3. If the delta is 0 after a write, the write did NOT land — surface the INV-1 DEGRADED banner.
4. Surface the bridge-event ratio from `dos-memory-status.ts` (healthy band [0.99, 1.01]) as the persistence signal.

Then print the detail block:

```
Saved to MemPalace:
  Wing:   WING
  Room:   ROOM
  Hall:   HALL
  Drawer: DRAWER_ID
  Drawers persisted: +N   (read-back delta from status)
  KG facts:          +M   (read-back delta from kg_stats)
```

If the duplicate check surfaced a near-match, report both the new drawer ID and the existing one.

**If the bridge or daemon is unreachable** (the read-back errors, or the delta cannot be captured), do NOT claim the save persisted — surface the DEGRADED banner verbatim:

```text
🔴 MEMPALACE DEGRADED — the memory bridge is unreachable.
   Reads/writes this session are NOT landing; do not assume anything persisted.
   Recover: run the Doctor workflow (`/MemPalace Doctor`) for the guided repair ladder.
```
