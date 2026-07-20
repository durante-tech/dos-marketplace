---
name: Compact
description: Surfaces the most recent PreCompact emergency checkpoint by querying the KG's compacted_with_digest predicate and fetching the linked drawer.
status: STABLE
bestPath:
  - title: "Determine the Session Subject"
    description: "Resolve the session id from the environment or query broadly across all sessions."
  - title: "Query the Compaction Record"
    description: "Query the KG for the compacted_with_digest fact tied to the session."
  - title: "Fetch and Present the Checkpoint"
    description: "Fetch the linked drawer's verbatim content and present it, or report no record found."
divergence_from_canonical:
  _intent-to-flag-table.md:
    partial_version: 1.0.0
    reason: "MemPalace Compact maps precompact checkpoint lookup fields; canonical Mode/Output two-table shape does not fit"
---

# Show Last Compaction

Surface the most recent PreCompact save — the emergency checkpoint written by `MemPalacePreCompact.hook.ts` before a context compaction fires. Each precompact run writes a KG fact with predicate `compacted_with_digest` linking the session entity to the saved drawer ID. This workflow queries that predicate to find and display the checkpoint.

## When to Use

- Trigger phrases: "last compaction", "last checkpoint", "precompact save", "show compaction record".
- Situation: you need to see what the PreCompact hook most recently saved before a context compaction fired.
- NOT for filing new content — use Save (Compact only reads the existing checkpoint record).

## Step 1: Determine the Session Subject

The KG fact is keyed on `session-{id}`. If the current session ID is available from `$CLAUDE_SESSION_ID` or the hook telemetry, use it directly. Otherwise query broadly across all sessions.

```bash
# Session ID from environment (preferred)
echo $CLAUDE_SESSION_ID
```

## Step 2: Query the KG for Compaction Record

**MCP preferred:**

```
mempalace_kg_query(subject="session-SESSION_ID", predicate="compacted_with_digest")
```

For a wing-scoped query (current project):

```
mempalace_kg_query(subject="session-SESSION_ID", predicate="compacted_with_digest", wing="PROJECT_WING")
```

**Fallback — query by predicate across all subjects:**

```bash
uv run --with mempalace python ~/.claude/DOS/Tools/mempalace_bridge.py kg_query \
  '{"predicate":"compacted_with_digest","limit":5}'
```

Falls back silently if no compaction record exists (see Step 4).

## Step 3: Fetch the Drawer

Once the `compacted_with_digest` fact returns a drawer ID, fetch its content:

```
mempalace_get_drawer(drawer_id="DRAWER_ID")
```

This returns the full verbatim checkpoint text plus `filed_at` timestamp.

## Intent-to-Flag Mapping

| User Says | Action | Notes |
|-----------|--------|-------|
| "show last compaction" / "what was saved before compact?" / "last precompact" | `kg_query` (predicate=compacted_with_digest) + `get_drawer` | Full two-step retrieval |
| "show compaction for session X" | `kg_query` (subject=session-X) | Specific session lookup |
| "list recent compactions" | `kg_query` (predicate=compacted_with_digest, limit=5) | Multi-session scan |

### JSON Argument Shape

| Action | Required Args | Optional Args |
|--------|--------------|---------------|
| `kg_query` | `predicate="compacted_with_digest"` | `subject` (session-{id}), `wing`, `limit` |
| `get_drawer` | `drawer_id` (string from KG fact object) | none |

## Step 4: Present Results

On success (lead with the verdict — the checkpoint found and its session):

```
✅ Found compaction checkpoint for session-SESSION_ID

Last Compaction:
  Session:  session-SESSION_ID
  Drawer:   DRAWER_ID
  Filed at: YYYY-MM-DD HH:MM:SS
  Wing:     WING / Room: ROOM

Checkpoint preview (first 400 chars):
  ...
```

On no record found (silent fallback — do not error):

```
No compaction record found for this session.

The PreCompact hook writes this record when a context compaction is
about to fire. If no compaction has occurred this session, this is expected.
```

On bridge/daemon failure (distinct from a silent no-record fallback — the `kg_query` itself could not run), render the DEGRADED banner and stop:

```text
🔴 MEMPALACE DEGRADED — the memory bridge is unreachable.
   Reads/writes this session are NOT landing; do not assume anything persisted.
   Recover: run the Doctor workflow (`/MemPalace Doctor`) for the guided repair ladder.
```
