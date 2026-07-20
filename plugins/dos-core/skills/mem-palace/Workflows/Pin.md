---
name: Pin
description: Forces a drawer into the always-loaded L1 context by setting its pinned metadata flag, bypassing the automatic top-15 ranking.
status: STABLE
bestPath:
  - title: "Identify What to Pin"
    description: "Use an existing drawer id, or file new content and pin it in one step."
  - title: "Set the Pin Flag"
    description: "Call update_drawer or add_drawer with metadata.pinned=true."
  - title: "Verify the Pin"
    description: "Read the drawer back and confirm metadata.pinned flipped to true."
divergence_from_canonical:
  _intent-to-flag-table.md:
    partial_version: 1.0.0
    reason: "MemPalace Pin maps drawer and L1 pinning controls; canonical Mode/Output two-table shape does not fit"
---

# Pin a Drawer to L1 Always-Loaded Context

Force a drawer into L1 — the always-loaded memory layer (~500-800 tokens) injected at every session start by `MemPalaceWakeUp.hook.ts`. Pinned drawers bypass the automatic top-15 ranking and are surfaced in the L1 context regardless of recency or usage frequency.

Use this for information that must be available without any retrieval — active constraints, current sprint goals, critical architecture decisions, or anything the operator needs Fox to "always know."

## When to Use

- Trigger phrases: "pin", "always-load", "L1 pin", "force into context", "sticky memory".
- Situation: information must be available without retrieval — active constraints, sprint goals, critical decisions.
- NOT for filing new content without pinning — use Save (Pin sets the pinned flag; Save is the general filing path).

## Step 1: Identify What to Pin

Either:
- An existing drawer ID (from a prior search or save)
- New content to file and pin in one step

## Step 2A: Pin Existing Drawer

If you already have a `drawer_id`, update it in place to set the pin flag:

```
mempalace_update_drawer(
  drawer_id="DRAWER_ID",
  metadata={"pinned": true}
)
```

**Fallback:**

```bash
uv run --with mempalace python ~/.claude/DOS/Tools/mempalace_bridge.py update_drawer \
  '{"drawer_id":"DRAWER_ID","metadata":{"pinned":true}}'
```

## Step 2B: File New Content and Pin in One Step

```
mempalace_add_drawer(
  content="VERBATIM_CONTENT",
  wing="WING",
  room="ROOM",
  hall="hall_facts",
  metadata={"pinned": true}
)
```

**Fallback:**

```bash
uv run --with mempalace python ~/.claude/DOS/Tools/mempalace_bridge.py add_drawer \
  '{"content":"VERBATIM_CONTENT","wing":"WING","room":"ROOM","metadata":{"pinned":true}}'
```

## Step 3: Verify Pin (Verify-Persisted)

**Verdict first.** Lead with a one-line verdict — `✅ PINNED (drawer DRAWER_ID metadata.pinned=true)` or `🔴 NOT PINNED (delta 0)`. Do NOT verify the pin from `mempalace_last_checkpoint()` or `memories_filed_away` — neither reflects the live write. The checkpoint surface shows the last SessionStop snapshot, not the drawer you just edited. Confirm only from a read-back of the drawer's own pinned metadata.

Read the drawer back and assert the `pinned` flag flipped:

```bash
uv run --with mempalace python ~/.claude/DOS/Tools/mempalace_bridge.py get_drawer \
  '{"drawer_id":"DRAWER_ID"}'
# expect metadata.pinned == true (the read-back delta: false/absent -> true)
```

## Verify Persisted (read-back delta — never `memories_filed_away`)

1. BEFORE writing, capture a baseline count via `kg_stats` (KG facts) and/or `status` (drawer count).
2. AFTER writing, re-read the same counts and report the DELTA (e.g. "Drawers persisted: +N, KG facts: +M").
3. If the delta is 0 after a write, the write did NOT land — surface the INV-1 DEGRADED banner.
4. Surface the bridge-event ratio from `dos-memory-status.ts` (healthy band [0.99, 1.01]) as the persistence signal.

For a pin, the read-back delta is the drawer's `metadata.pinned` flipping `false`/absent → `true` (or `true` → `false` on unpin). If the flag did not flip, the pin did NOT land — surface the DEGRADED banner verbatim:

```text
🔴 MEMPALACE DEGRADED — the memory bridge is unreachable.
   Reads/writes this session are NOT landing; do not assume anything persisted.
   Recover: run the Doctor workflow (`/MemPalace Doctor`) for the guided repair ladder.
```

## Intent-to-Flag Mapping

| User Says | Action | Notes |
|-----------|--------|-------|
| "pin this to memory" / "always remember this" / "keep this in L1" | `add_drawer` (metadata.pinned=true) | File + pin in one step |
| "pin drawer DRAWER_ID" / "force DRAWER_ID into L1" | `update_drawer` (metadata.pinned=true) | Update existing |
| "unpin drawer DRAWER_ID" / "remove from L1" | `update_drawer` (metadata.pinned=false) | Clear pin flag |
| "what's pinned?" / "show L1 pins" | `mempalace_list_drawers` (filter: metadata.pinned=true) | Enumerate pinned drawers |

### JSON Argument Shape

| Action | Required Args | Optional Args |
|--------|--------------|---------------|
| `add_drawer` | `content`, `metadata: {"pinned": true}` | `wing`, `room`, `hall`, `source_file` |
| `update_drawer` | `drawer_id`, `metadata: {"pinned": true}` | none |

## L1 Semantics

| Layer | Size | When Loaded |
|-------|------|-------------|
| L0 | ~100 tokens | Always — identity only |
| **L1** | ~500-800 tokens | **Always — top-15 ranked drawers + all pinned** |
| L2 | ~200-500/room | On demand |
| L3 | Unlimited | On demand (semantic search) |

Pinned drawers are merged into the top-15 ranked set and injected together. The 500-800 token L1 budget is shared — pinning many large drawers compresses the ranked slots. Recommend pinning short, dense facts (under 200 tokens each) and limiting pins to 3-5 items per wing.

## Notes

- Pin flag lives in drawer metadata and persists across sessions.
- Verify the pin by reading the drawer back (`get_drawer`) and asserting `metadata.pinned == true` — NOT via `mempalace_last_checkpoint()` or `memories_filed_away`, which show the SessionStop snapshot, not the live write. `wake_up --dry_run` previews next session's L1 injection but is not a persistence check.
- To audit all pinned drawers across wings, search for `metadata.pinned=true` in `mempalace_list_drawers` or via the bridge status output.
