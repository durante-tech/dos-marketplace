---
name: Status
description: Reports a comprehensive MemPalace health snapshot — daemon liveness, disk headroom, bridge-event ratio, wing/room/drawer counts, and hook/MCP registration state.
status: STABLE
bestPath:
  - title: "Verdict, Liveness, and Health Signals"
    description: "Probe daemon liveness via lsof, check palace free disk, and read the bridge-event ratio."
  - title: "Get Palace Status"
    description: "Call mempalace_status for drawer/wing/KG counts."
  - title: "Check Hook and MCP Health"
    description: "Confirm hooks are installed and registered, and the MCP server is configured."
  - title: "Compare with DOS Memory"
    description: "Compute coverage percentage against DOS's file-based memory sources."
divergence_from_canonical:
  _intent-to-flag-table.md:
    partial_version: 1.0.0
    reason: "MemPalace workflow mixes Python bridge actions with MCP-only tools; canonical Mode/Output two-table shape doesn't fit"
  _workflow-output-shape.md:
    partial_version: 1.0.0
    reason: "MemPalace workflow has bespoke Output Format section"
---

# Palace Status Overview

Show the current state of the MemPalace integration with DOS context.

## When to Use

- Trigger phrases: "status", "overview", "palace info", "wings", "rooms".
- Situation: getting a health/overview snapshot of wings, rooms, drawer counts, and hook health.
- NOT for repairing a DEGRADED substrate — use Doctor (Status reports health; Doctor repairs it).

## Your Task

Display a comprehensive overview of the palace: wings, rooms, drawer counts, KG stats, and hook health.

## Step 0: Verdict line, liveness, and health signals (run first)

**The FIRST line of your output MUST be a one-word verdict — `HEALTHY` or `DEGRADED`** —
derived from the liveness + persistence checks below. Print it before any other prose so the
operator sees the verdict at a glance.

### Daemon liveness via lsof (not a process grep)

```bash
# Daemon liveness — probe the socket with lsof, not a process grep.
SOCK="${MEMPALACE_DAEMON_SOCKET:-$DOS_DIR/MEMORY/STATE/.mempalace.sock}"
[ -z "$DOS_DIR" ] && SOCK="${MEMPALACE_DAEMON_SOCKET:-$HOME/.claude/MEMORY/STATE/.mempalace.sock}"
if lsof "$SOCK" >/dev/null 2>&1; then
  echo "🟢 daemon: LIVE (listener on $SOCK)"
else
  echo "🔴 daemon: DOWN (no listener on $SOCK) — run the Doctor workflow"
fi
```

### Palace free-disk (df on the palace volume)

```bash
# Free disk on the palace volume — a low floor is a DEGRADED signal (2026-06-22 disk-fill).
PALACE_DIR="${MEMPALACE_DIR:-$HOME/.mempalace}"
FREE_GB=$(df -Pk "$PALACE_DIR" 2>/dev/null | awk 'NR==2 {printf "%d", $4/1048576}')
echo "Palace free disk: ${FREE_GB:-0}GB on $PALACE_DIR (DEGRADED if < 5GB)"
```

### Bridge-event ratio (persistence health)

Surface the **bridge-event ratio** against the healthy band `[0.99, 1.01]` — every bridge spawn
should produce exactly one event line in `~/.claude/MEMORY/STATE/memory-events.jsonl`. A ratio
outside the band means writes are bypassing the wrapper or double-logging — a DEGRADED signal.

```bash
# Bridge-event ratio (healthy band [0.99, 1.01]) via the canonical status tool.
bun ~/.claude/skills/mem-palace/Tools/dos-memory-status.ts --json 2>/dev/null \
  | grep -o '"bridgeEventRatio"[^,}]*' || echo "bridge-event ratio: unavailable"
```

### On bridge / daemon failure — paste the DEGRADED banner verbatim

If the daemon is DOWN or any bridge call below fails (non-zero exit / unreachable), set the
verdict to `DEGRADED`, surface this banner verbatim, and **hand off to the Doctor workflow**:

```text
🔴 MEMPALACE DEGRADED — the memory bridge is unreachable.
   Reads/writes this session are NOT landing; do not assume anything persisted.
   Recover: run the Doctor workflow (`/MemPalace Doctor`) for the guided repair ladder.
```

## Step 1: Get Palace Status

**Primary: call `mempalace_status()` directly.** As of lib v3.3.4 the default
response is lean — drawer/wing counts and palace metadata in ~500 bytes:

```
mempalace_status()
```

For graph-shape questions (entities, triples, predicate types), follow up
with `mempalace_kg_stats()`. For the full wing → room → count tree, add
`mempalace_get_taxonomy()`.

**Pre-fix workaround `[RETIRED-as-mandate]`.** Before A5 in v3.3.4,
`mempalace_status` returned ~6KB of context (palace_path + protocol prose +
AAAK dialect + room list), so workflows split into the smaller pair:

```
mempalace_kg_stats()      # entities + triples + predicate types (~200 bytes)
mempalace_list_wings()    # wing names + drawer counts (~300 bytes)
```

The pair pattern is no longer required as a workaround but remains useful
when only graph counts are needed.

**Fallback: Bridge:**
```bash
uv run --with mempalace python ~/.claude/DOS/Tools/mempalace_bridge.py status
```

> See SKILL.md "Acceptance-Discovered Workarounds" §W-3 for the history.

## Step 2: Check Hook Health

```bash
# Hooks installed?
[ -f ~/.claude/hooks/MemPalaceLearn.hook.ts ] && echo "Learn hook: installed" || echo "Learn hook: missing"
[ -f ~/.claude/hooks/MemPalaceRate.hook.ts ] && echo "Rate hook: installed" || echo "Rate hook: missing"

# Hooks registered?
grep -q "MemPalaceLearn" ~/.claude/settings.json 2>/dev/null && echo "Learn hook: registered" || echo "Learn hook: not registered"
grep -q "MemPalaceRate" ~/.claude/settings.json 2>/dev/null && echo "Rate hook: registered" || echo "Rate hook: not registered"

# Last sync times
cat ~/.claude/MEMORY/STATE/mempalace-last-sync.json 2>/dev/null || echo "Never synced"
cat ~/.claude/MEMORY/STATE/mempalace-last-rating.txt 2>/dev/null || echo "No ratings synced"
```

## Step 3: Check MCP Server

```bash
# MCP configured?
grep -qs '"mempalace"' ~/.claude.json .mcp.json 2>/dev/null && echo "MCP: configured" || echo "MCP: not configured"
```

## Step 4: Compare with DOS Memory

```bash
# DOS file counts for comparison
echo "DOS Memory:"
find ~/.claude/MEMORY/LEARNING -name "*.md" 2>/dev/null | wc -l | xargs echo "  Learnings:"
echo "  Work PRDs (project-level):" $(find MEMORY/WORK -name "PRD.md" 2>/dev/null | wc -l)
echo "  Work PRDs (global):" $(find ~/.claude/MEMORY/WORK -name "PRD.md" 2>/dev/null | wc -l)
wc -l < ~/.claude/MEMORY/LEARNING/SIGNALS/ratings.jsonl 2>/dev/null | xargs echo "  Ratings:"
```

## Intent-to-Flag Mapping

This workflow shells out to the MemPalace bridge (and falls back to filesystem checks) per CreateSkill workflow Step 6 + CliFirstArchitecture.md. Translate operator phrasing into deterministic action selection.

### Mode / Action

| User Says | Surface | Effect |
|-----------|---------------|--------|
| "palace status" / "show mempalace state" / "is the palace healthy?" | Python bridge `status` | Lean health snapshot — drawer/wing counts + palace metadata |
| "give me kg counts" / "how many facts do I have?" | Python bridge `kg_stats` or MCP `mempalace_kg_stats` | Entities + triples + predicate-type counts only |
| "list every wing and its rooms" | MCP-only `mempalace_list_wings` or `mempalace_get_taxonomy` | Wing → room → drawer-count tree |

### JSON Argument Shape

| Surface | Required JSON Args | Optional JSON Args |
|--------|--------------------|--------------------|
| `status` | none | none — invoke positionally |
| `kg_stats` / `mempalace_kg_stats` | none | none |
| `mempalace_list_wings` / `mempalace_get_taxonomy` | none | none |

## Output Format

```
HEALTHY            # verdict-first — HEALTHY or DEGRADED (Step 0)

MemPalace Status

  Daemon: LIVE (listener on .mempalace.sock)
  Free disk: NN GB on palace volume (DEGRADED if < 5GB)
  Bridge-event ratio: 1.00 (healthy band [0.99, 1.01])

  Palace: ~/.mempalace/
  Total drawers: N

  Wings:
    durante: 101 drawers (architecture, skills, gtm-strategy, brand-dna, ...)
    altyaa: 13 drawers (database-schema, routes, services, ...)
    telos: 67 drawers (goals, beliefs, projects, ...)
    work: 33 drawers (session PRDs)
    learnings: 6 drawers
    user: 1 drawer
    ratings: 2 drawers

  Knowledge Graph:
    Entities: E | Facts: F | Current: C | Expired: X

  Hooks:
    MemPalaceLearn: installed + registered | Last sync: TIMESTAMP
    MemPalaceRate: installed + registered | Last rating: TIMESTAMP

  MCP Server: configured

  DOS Memory (source):
    Learnings: L files | Work: W PRDs | Ratings: R entries
    Coverage: XX% of DOS memory is in MemPalace
```
