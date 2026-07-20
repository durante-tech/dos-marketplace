---
name: Mine
description: Bootstraps MemPalace by mining DOS's own MEMORY/ trees (learnings, work PRDs, TELOS, research, session transcripts) into searchable drawers and KG facts.
status: STABLE
bestPath:
  - title: "Disk-Guard and Prerequisites"
    description: "Abort below the disk-safety floor and confirm the bridge is reachable."
  - title: "Survey Existing Memory"
    description: "Count available files across learnings, work, TELOS, ratings, and research."
  - title: "Mine Each Source Tree"
    description: "Per-tree ingest of learnings, work PRDs, TELOS, research, and optionally conversation transcripts."
  - title: "Verify Persisted"
    description: "Confirm the drawer/KG-fact delta and bridge-event ratio before reporting the mining complete."
---

# Mine Existing DOS Memory into MemPalace

> **Note:** This workflow mines DOS internal memory files (learnings, work PRDs, TELOS, research) into MemPalace. To mine a **project's source code** into its wing, use the **MineProject** workflow instead (`mine this project`).

Bootstrap MemPalace by mining DOS's existing memory files into searchable palace drawers and knowledge graph facts.

## When to Use

- Trigger phrases: "mine DOS memory", "mine learnings", "mine conversations", "bootstrap mempalace".
- Situation: bootstrapping MemPalace from DOS's own MEMORY/ trees (learnings, work PRDs, TELOS, research, session transcripts).
- NOT for mining a project's source code — use MineProject (Mine reads DOS's own MEMORY/ trees; MineProject reads a project repo).

## Your Task

Ingest DOS's file-based memory into MemPalace so past learnings, work, and TELOS data become semantically searchable.

## Bounded Ingest Contract (shared by Mine · MineDir · MineProject · SyncTelos)

Every mining write follows the same four-step contract — never open-code a divergent loop:
1. **Disk-guard** — run the Step-0 preflight (INV-2 / `MemPalaceCli.ts render-disk-guard`); abort below the 5GB floor.
2. **Warm daemon** — set `DOS_USE_BRIDGE_DAEMON=1` on every bridge call (amortizes the ~8-9s cold ONNX load to ~0.18s warm).
3. **Per-tree ingest** — prefer one `mine_dir` per directory over per-file `mine_file` loops (O(dirs) spawns, not O(files)).
4. **Verify-persisted** — confirm by a `kg_stats`/drawer-count DELTA (never `memories_filed_away`).

## Step 0: Disk-Guard Preflight (MANDATORY — runs before any write)

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

(Or invoke `~/.claude/skills/mem-palace/Tools/MemPalaceCli.ts render-disk-guard` — identical output.)

## Step 1: Check Prerequisites

```bash
# Verify MemPalace is installed and palace exists
uv run --with mempalace python -c "import mempalace; print('OK')"
ls ~/.mempalace/palace/

# Verify bridge is available (daemon-warm)
DOS_USE_BRIDGE_DAEMON=1 uv run --with mempalace python ~/.claude/DOS/Tools/mempalace_bridge.py status
```

If bridge or mempalace is missing, inform user to run INSTALL.md first. If the bridge call errors or the daemon is unreachable, STOP and surface the DEGRADED banner — do not assume any write below will land:

```text
🔴 MEMPALACE DEGRADED — the memory bridge is unreachable.
   Reads/writes this session are NOT landing; do not assume anything persisted.
   Recover: run the Doctor workflow (`/MemPalace Doctor`) for the guided repair ladder.
```

## Step 2: Survey Existing Memory

```bash
# Count available files
echo "=== LEARNINGS ==="
find ~/.claude/MEMORY/LEARNING/ALGORITHM -name "*.md" 2>/dev/null | wc -l
find ~/.claude/MEMORY/LEARNING/SYSTEM -name "*.md" 2>/dev/null | wc -l
find ~/.claude/MEMORY/LEARNING/FAILURES -name "CONTEXT.md" 2>/dev/null | wc -l

echo "=== WORK (project-level) ==="
find MEMORY/WORK -name "PRD.md" 2>/dev/null | wc -l
echo "=== WORK (global) ==="
find ~/.claude/MEMORY/WORK -name "PRD.md" 2>/dev/null | wc -l

echo "=== TELOS ==="
ls ~/.durante/user/TELOS/*.md 2>/dev/null | wc -l

echo "=== RATINGS ==="
wc -l ~/.claude/MEMORY/LEARNING/SIGNALS/ratings.jsonl 2>/dev/null

echo "=== RESEARCH ==="
find ~/.claude/MEMORY/RESEARCH -name "*.md" 2>/dev/null | wc -l
```

Report counts to user and confirm before proceeding.

## Step 3: Mine Learnings

Per-tree ingest — one `mine_dir` per learnings room (O(dirs) spawns, not O(files)):

```bash
# Mine ALGORITHM learnings (whole tree)
DOS_USE_BRIDGE_DAEMON=1 uv run --with mempalace python ~/.claude/DOS/Tools/mempalace_bridge.py mine_dir '{"dir":"~/.claude/MEMORY/LEARNING/ALGORITHM","wing":"learnings","room":"algorithm","include_globs":["*.md"]}'

# Mine SYSTEM learnings (whole tree)
DOS_USE_BRIDGE_DAEMON=1 uv run --with mempalace python ~/.claude/DOS/Tools/mempalace_bridge.py mine_dir '{"dir":"~/.claude/MEMORY/LEARNING/SYSTEM","wing":"learnings","room":"system","include_globs":["*.md"]}'

# Mine FAILURE contexts (whole tree, CONTEXT.md only)
DOS_USE_BRIDGE_DAEMON=1 uv run --with mempalace python ~/.claude/DOS/Tools/mempalace_bridge.py mine_dir '{"dir":"~/.claude/MEMORY/LEARNING/FAILURES","wing":"learnings","room":"failures","include_globs":["CONTEXT.md"]}'
```

## Step 4: Mine Work PRDs

Per-tree ingest — one `mine_dir` per WORK root (project-level, then global); the directory walk derives per-slug rooms:

```bash
# Mine project-level WORK tree, then global — one mine_dir each, PRD.md only
for d in MEMORY/WORK ~/.claude/MEMORY/WORK; do
  [ -d "$d" ] || continue
  DOS_USE_BRIDGE_DAEMON=1 uv run --with mempalace python ~/.claude/DOS/Tools/mempalace_bridge.py mine_dir "{\"dir\":\"$d\",\"wing\":\"work\",\"include_globs\":[\"PRD.md\"]}"
done
```

## Step 5: Mine TELOS Documents

Per-tree ingest — one `mine_dir` over the TELOS root (the directory walk derives rooms):

```bash
if [ -d ~/.durante/user/TELOS ]; then
  DOS_USE_BRIDGE_DAEMON=1 uv run --with mempalace python ~/.claude/DOS/Tools/mempalace_bridge.py mine_dir '{"dir":"~/.durante/user/TELOS","wing":"telos","include_globs":["*.md"]}'
fi
```

## Step 6: Mine Research

Per-tree ingest — one `mine_dir` over the RESEARCH root (the directory walk derives per-folder rooms):

```bash
if [ -d ~/.claude/MEMORY/RESEARCH ]; then
  DOS_USE_BRIDGE_DAEMON=1 uv run --with mempalace python ~/.claude/DOS/Tools/mempalace_bridge.py mine_dir '{"dir":"~/.claude/MEMORY/RESEARCH","wing":"research","include_globs":["*.md"]}'
fi
```

## Step 7: Mine Conversation Transcripts (Optional)

Mine actual Claude Code session transcripts for richer context. Uses MemPalace's
conversation miner which handles JSONL format and chunks by Q+A exchange pairs.

```bash
# Mine Claude Code transcripts (exchange mode — Q+A pairs)
DOS_USE_BRIDGE_DAEMON=1 uv run --with mempalace python ~/.claude/DOS/Tools/mempalace_bridge.py mine_convos '{"dir":"~/.claude/projects","wing":"sessions","extract_mode":"exchange"}'

# Or with general extraction (classifies into decision/preference/milestone/problem/emotional)
DOS_USE_BRIDGE_DAEMON=1 uv run --with mempalace python ~/.claude/DOS/Tools/mempalace_bridge.py mine_convos '{"dir":"~/.claude/projects","wing":"sessions","extract_mode":"general"}'
```

## Step 8: Verify Results

```bash
DOS_USE_BRIDGE_DAEMON=1 uv run --with mempalace python ~/.claude/DOS/Tools/mempalace_bridge.py status
```

Report the palace status showing wings, rooms, and drawer counts.

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
| "mine my dos memory" / "bootstrap mempalace from learnings" | `mine_dir` (per tree — default) | Per-tree ingest of a wing/room directory (O(dirs) spawns) |
| "mine just this one file" | `mine_file` | Ingest a single markdown into wing/room (one-off only) |
| "mine learnings/work/telos in bulk" | `mine_dir` | Recursive ingest of a directory tree |
| "mine my session transcripts" / "ingest claude-code conversations" | `mine_convos` | Q+A-pair or general-mode classifier over `.jsonl` transcripts |
| "verify what was mined" / "palace status after mining" | `status` | Show updated wing/room/drawer counts |

### JSON Argument Shape

| Action | Required JSON Args | Optional JSON Args |
|--------|--------------------|--------------------|
| `mine_file` | `filepath`, `wing`, `room` | `chunk_size` (int) |
| `mine_dir` | `dir`, `wing` | `room`, `include_globs`, `exclude_globs` |
| `mine_convos` | `dir`, `wing` | `extract_mode` (`exchange` \| `general`, default `exchange`) |
| `status` | none | none |

## Output Format

```
VERDICT: MINED ✅ — N drawers persisted (read-back delta +N), bridge-event ratio in [0.99, 1.01].
(On failure: VERDICT: DEGRADED 🔴 — write did not land; see the DEGRADED banner above.)

Mining Complete

  Learnings: X drawers (algorithm: A, system: S, failures: F)
  Work: X drawers across Y projects
  TELOS: X drawers across Y documents
  Research: X drawers
  Sessions: X drawers (if conversation mining was run)

  Total: N drawers in MemPalace
  Palace: ~/.mempalace/

Your DOS memory is now semantically searchable.
Try: "search memory for [topic]"
     "explore connections from [room]"
     "classify [text]"
```