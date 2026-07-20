---
name: MineDir
description: Bulk-indexes a known directory tree into the MemPalace semantic index via bridgeSync mine_dir, with no gap analysis.
status: STABLE
bestPath:
  - title: "Disk-Guard Preflight"
    description: "Abort the mining write if the palace volume is below the safety floor."
  - title: "Parse Directory and Options"
    description: "Extract the target dir, wing, room, and recursive flag from the request."
  - title: "Dry Run"
    description: "Count indexable files and confirm scope before committing."
  - title: "Mine the Directory"
    description: "Bulk-index the directory via the bridge mine_dir action, daemon-warm."
  - title: "Report Results"
    description: "Lead with a verdict — drawers added, skipped, and errored."
divergence_from_canonical:
  _intent-to-flag-table.md:
    partial_version: 1.0.0
    reason: "MemPalace MineDir maps bridgeSync mine_dir fields; canonical Mode/Output two-table shape does not fit"
---

# Bulk-Index a Directory into MemPalace

Mine all files in a directory tree into the MemPalace semantic index. Each file becomes one or more drawers (chunked by content size). This is the operator-facing wrapper for `bridgeSync('mine_dir', ...)` — useful for bootstrapping a new wing, backfilling historical files, or indexing a directory of notes that was never indexed.

Use `MineProject` for full project discovery (gap analysis + targeted mining). Use this workflow when you already know the directory and want a direct bulk-index with no gap scan.

## When to Use

- Trigger phrases: "mine directory", "bulk index", "index this folder", "backfill files into palace".
- Situation: you already know the directory and want a direct bulk-index, no gap analysis needed.
- NOT for full project discovery with gap analysis — use MineProject (MineDir is a direct bulk-index; MineProject does targeted gap-aware mining).

## Bounded Ingest Contract (shared by Mine · MineDir · MineProject · SyncTelos)

Every mining write follows the same four-step contract — never open-code a divergent loop:
1. **Disk-guard** — run the Step-0 preflight (INV-2 / `MemPalaceCli.ts render-disk-guard`); abort below the 5GB floor.
2. **Warm daemon** — set `DOS_USE_BRIDGE_DAEMON=1` on every bridge call (amortizes the ~8-9s cold ONNX load to ~0.18s warm).
3. **Per-tree ingest** — prefer one `mine_dir` per directory over per-file `mine_file` loops (O(dirs) spawns, not O(files)).
4. **Verify-persisted** — confirm by a `kg_stats`/drawer-count DELTA (never `memories_filed_away`).

## Step 0: Disk-Guard Preflight (MANDATORY before any mining write)

Run this BEFORE any mining write. If it aborts, do not proceed to Step 3.

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

## Step 1: Parse the Request

Extract from the operator's request:
- **dir**: Absolute path to directory to mine (required)
- **wing**: MemPalace wing to target (default: detect from PROJECTS.md or use `work`)
- **room**: Optional room prefix. Files will be placed in `{room}/{filename}` rooms.
- **recursive**: Whether to descend into subdirectories. Default: true.

## Step 2: Dry Run (Recommended)

Before committing, show what would be indexed:

```bash
# Count indexable files
IGNORE_INTEL_FIRST=1 find DIR_PATH -type f \( -name "*.md" -o -name "*.txt" -o -name "*.ts" -o -name "*.py" \) | wc -l
```

Report: `N files found in DIR — proceed with indexing?`

## Step 3: Mine the Directory

**Via bridge (primary path — MCP has no mine_dir surface).** Set `DOS_USE_BRIDGE_DAEMON=1` on every bridge call (warm daemon — amortizes the ~8-9s cold ONNX load to ~0.18s warm):

```bash
DOS_USE_BRIDGE_DAEMON=1 uv run --with mempalace python ~/.claude/DOS/Tools/mempalace_bridge.py mine_dir \
  '{"dir":"DIR_PATH","wing":"WING","room":"OPTIONAL_ROOM"}'
```

With explicit options:

```bash
DOS_USE_BRIDGE_DAEMON=1 uv run --with mempalace python ~/.claude/DOS/Tools/mempalace_bridge.py mine_dir \
  '{"dir":"DIR_PATH","wing":"WING","room":"ROOM","mode":"incremental"}'
```

The `mode: "incremental"` flag makes the operation idempotent — files already indexed (matched by deterministic drawer key from `source_file + chunk_index`) are skipped.

**If the bridge call fails (non-zero exit, connection refused, or no drawer delta), the write did NOT land. Surface this banner and stop:**

```text
🔴 MEMPALACE DEGRADED — the memory bridge is unreachable.
   Reads/writes this session are NOT landing; do not assume anything persisted.
   Recover: run the Doctor workflow (`/MemPalace Doctor`) for the guided repair ladder.
```

**Alternative — use the batch mine tool for rate-limited runs:**

```bash
DOS_USE_BRIDGE_DAEMON=1 bun ~/.claude/skills/mem-palace/Tools/mine-historical-prds.ts \
  --apply --rate 5 --max 100
```

(This tool is PRD-specific but demonstrates the rate-limited incremental pattern.)

## Intent-to-Flag Mapping

| User Says | Action | Notes |
|-----------|--------|-------|
| "mine directory X" / "index folder X" / "bulk-index X" | `mine_dir` bridge call | Incremental by default |
| "mine X into wing Y" | `mine_dir` (dir=X, wing=Y) | Explicit wing routing |
| "mine X into Y/Z" | `mine_dir` (dir=X, wing=Y, room=Z) | Wing + room addressing |
| "re-mine X" / "force re-index X" | `mine_dir` (mode=full) | Full re-mine, replaces existing drawers |

### JSON Argument Shape

| Arg | Type | Required | Default |
|-----|------|----------|---------|
| `dir` | string | yes | — |
| `wing` | string | no | project wing or `work` |
| `room` | string | no | none (uses filename as room) |
| `mode` | string | no | `incremental` |

## Step 4: Report Results

After the bridge call completes, lead with a one-line verdict, then the detail block:

```
✅ MINED — DIR_PATH: +M drawers persisted (N files, K skipped, E errors).
```

(Verdicts: `✅ MINED` when drawers persisted with no errors · `⚠️ PARTIAL` when E > 0 or some files skipped unexpectedly · `🔴 DEGRADED` when the drawer delta is 0 — surface the INV-1 banner.)

```
MineDir complete:
  Directory: DIR_PATH
  Wing:      WING
  Files processed: N
  Drawers added:   M
  Drawers skipped: K (already indexed)
  Errors:          E

Run "recall X" to verify content is searchable.
```

## Notes

- `mine_dir` recurses into subdirectories by default. Large trees (1000+ files) may take several minutes. Rate-limit with the `--rate` flag on the standalone tool.
- Binary files, images, and files > 500KB are skipped by the bridge automatically.
- Supported file types: `.md`, `.txt`, `.ts`, `.js`, `.py`, `.json`, `.yaml`, `.yml`, `.toml`. Other types are silently skipped.
