---
name: Diary
description: Reads and writes the per-agent episodic diary (room=diary) so an agent can record or replay what it did across sessions, using the lowercase agent_name convention.
status: STABLE
bestPath:
  - title: "Resolve Mode"
    description: "Determine write or read intent and lowercase the agent_name."
  - title: "Execute the Diary Call"
    description: "Invoke diary_write or diary_read via the MCP tool or bridge diary action."
  - title: "Report the Verdict"
    description: "Echo the entry id and topic on write, or the entry count and wing scope on read."
divergence_from_canonical:
  _intent-to-flag-table.md:
    partial_version: 1.0.0
    reason: "MemPalace Diary maps a single bridge action with a read/write mode; canonical Mode/Output two-table shape doesn't fit"
  _workflow-output-shape.md:
    partial_version: 1.0.0
    reason: "MemPalace workflow has bespoke Output Format section"
---

# Agent Diary — Per-Agent Episodic Memory

Read and write the agent-diary surface: a per-agent journal stored in the palace
(`room=diary`) where an agent records what it did, decided, or noticed across
sessions. The diary is the single source of truth for "what was I working on?"
continuity — bridge writes are visible to MCP reads and vice versa (unified
2026-05-12 per RFC-0094 Option A).

## Your Task

Append a diary entry for an agent (`diary_write`) or replay an agent's recent
entries (`diary_read`). Both map to the one bridge action `diary` with a `mode`
selected via the `action` arg (`"write"` or `"read"`, default `read`), and to the
MCP tools `mempalace_diary_write` / `mempalace_diary_read`.

The FIRST line of output is a verdict: write → echo the entry id + agent + topic;
read → entry count + agent + wing scope. The SECOND line NAMES the executed
surface (MCP tool or bridge action).

## When to Use

- Trigger phrases: "agent diary", "diary write", "diary read".
- Situation: an agent needs to record or replay its own episodic journal across sessions.
- NOT for general content search — use Recall or Search (Diary is a per-agent journal, not the general palace).

## The LOWERCASE-agent convention (load-bearing)

**Agent names are lowercased before they are written, and the read path filters on
the lowercased key.** mempalace lib v3.3.4 (RFC-0028 Tier A §4.2) made
`tool_diary_read` filter on the `agent` metadata key *after* lowercasing it.
Entries written under the previous version stored `agent` with the original
capitalization (e.g. `"Fox"`, `"Lucius"`) and are unreachable from the post-fix
read path.

- Always pass `agent_name` in lowercase (`"fox"`, not `"Fox"`) on both write and read.
- Pre-fix diary entries are repaired by the migration tool
  `~/.claude/skills/mem-palace/Tools/migrate-diary-agent-lowercase.py` (RFC-0028 §9
  R-4): `--dry-run` reports candidates, `--apply` rewrites `metadata.agent` to its
  lowercase form (timestamped backup first; idempotent — a re-run reports 0
  candidates). After `--apply`, run `mempalace_reconnect` (or restart the MCP
  server) so the cached HNSW index does not serve pre-migration metadata.

## Step 1: Write a Diary Entry

**Preferred: MCP tool if available:**

```
mempalace_diary_write(agent_name="fox", entry="VERBATIM_ENTRY", topic="TOPIC", wing="WING")
```

**Fallback: Bridge (`diary` action, write mode):**

```bash
uv run --with mempalace python ~/.claude/DOS/Tools/mempalace_bridge.py diary '{"action":"write","agent_name":"fox","entry":"VERBATIM_ENTRY","topic":"TOPIC","wing":"WING"}'
```

`agent_name` and `entry` are required; `topic` defaults to `general`, `wing`
defaults to empty. A successful write returns `{"status":"ok","entry_id":...,"timestamp":...}`.

## Step 2: Read Diary Entries

**Preferred: MCP tool if available:**

```
mempalace_diary_read(agent_name="fox", last_n=10, wing="WING")
```

**Fallback: Bridge (`diary` action, read mode — the default):**

```bash
uv run --with mempalace python ~/.claude/DOS/Tools/mempalace_bridge.py diary '{"action":"read","agent_name":"fox","last_n":10,"wing":"WING"}'
```

`agent_name` is required; `last_n` defaults to 10, `wing` is an optional filter.
A read returns `{"status":"ok","entries":[...],"count":N}`. If `count` is 0 for an
agent you expect entries from, suspect the LOWERCASE-agent gap above — run the
migration tool's `--dry-run` to confirm.

## Bridge failure — render the DEGRADED banner

If the MCP tool errors or the bridge/daemon (`$DOS_DIR/MEMORY/STATE/.mempalace.sock`)
is unreachable, do NOT present an empty read as "no diary entries" or report a write
as landed — render the DEGRADED banner and stop:

```text
🔴 MEMPALACE DEGRADED — the memory bridge is unreachable.
   Reads/writes this session are NOT landing; do not assume anything persisted.
   Recover: run the Doctor workflow (`/MemPalace Doctor`) for the guided repair ladder.
```

## Intent-to-Flag Mapping

This workflow shells out to the MemPalace bridge (action `diary`) per CreateSkill
workflow Step 6 + CliFirstArchitecture.md. Translate operator phrasing into
deterministic mode selection and JSON-arg shape.

### Mode / Action

| User Says | Surface | Effect |
|-----------|---------|--------|
| "diary write" / "log to my diary" / "record what I did for <agent>" | `diary` (write mode) / MCP `mempalace_diary_write` | Append an entry to the agent's diary (`agent_name` lowercased) |
| "diary read" / "what was I working on?" / "replay <agent>'s diary" | `diary` (read mode — default) / MCP `mempalace_diary_read` | Return the agent's last N entries (`agent_name` lowercased) |
| "old diary entries are missing" / "fix Fox's diary" | `migrate-diary-agent-lowercase.py` | Lowercase `metadata.agent` on pre-fix drawers so reads find them |

### JSON Argument Shape

| Mode | Required JSON Args | Optional JSON Args |
|------|--------------------|--------------------|
| `diary` write | `action:"write"`, `agent_name` (lowercase), `entry` | `topic` (default `general`), `wing` |
| `diary` read | `agent_name` (lowercase) — `action` defaults to `read` | `last_n` (int, default 10), `wing` |

## Output Format

```
Diary entry filed for "fox" · topic: session-continuity
  Surface: mempalace_diary_write (bridge action: diary)
  entry_id: ENTRY_ID · timestamp: TIMESTAMP

— or, on read —

3 diary entries for "fox" · wing: durante
  Surface: mempalace_diary_read (bridge action: diary)
    [TIMESTAMP] topic — entry preview…
    [TIMESTAMP] topic — entry preview…
    [TIMESTAMP] topic — entry preview…
```
