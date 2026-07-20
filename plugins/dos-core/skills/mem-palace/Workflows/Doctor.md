---
name: Doctor
description: Diagnoses and repairs the MemPalace substrate via an ordered recovery ladder (reconnect, WAL checkpoint, disk-guard, repair, ratio check) when reads/writes stop landing.
status: STABLE
bestPath:
  - title: "State the Verdict"
    description: "Render HEALTHY or DEGRADED, plus the entry banner if the bridge is unreachable at all."
  - title: "Walk the Recovery Ladder"
    description: "Run reconnect, WAL checkpoint, disk-guard, and repair rungs in order, stopping at the first rung that restores HEALTHY."
  - title: "Confirm Recovery"
    description: "Check the bridge-event ratio to confirm the substrate is not just up but actually persisting."
  - title: "Restate the Closing Verdict"
    description: "Report HEALTHY with the recovering rung, or DEGRADED with the failing rung for operator escalation."
divergence_from_canonical:
  _intent-to-flag-table.md:
    partial_version: 1.0.0
    reason: "MemPalace Doctor is an ordered substrate-recovery runbook; canonical Mode/Output two-table shape does not fit"
  _workflow-output-shape.md:
    partial_version: 1.0.0
    reason: "MemPalace Doctor leads with a verdict line + recovery ladder, not the canonical Output Format section"
---

# Palace Doctor — Substrate Recovery Ladder

Diagnose and repair the MemPalace substrate when reads/writes stop landing. This is
the guided recovery path the DEGRADED banner (INV-1) points operators to.

## When to Use

- Trigger phrases: "doctor", "repair memory", "bridge down", "degraded", "recover palace".
- Situation: reads/writes have stopped landing, or the DEGRADED banner points here.
- NOT for routine hygiene audits on a healthy palace — use Garden (Doctor recovers a broken substrate; Garden audits a working one).

## Read-Only Invariant (Doctor mutates the SUBSTRATE, never the CONTENT)

The Doctor workflow writes **ZERO drawers and ZERO KG facts**. It MUST NOT mutate memory
CONTENT — it only restarts, checkpoints, and (as a last resort) repairs the substrate that
holds the content. No `add_drawer`, no `add_kg_fact`, no `mine_*`, no `update_*` calls run
from this workflow. If a rung below appears to require a content write to "fix" something,
that is out of scope — stop and hand back to the operator.

## Verdict First (ISC-42)

The FIRST output line of every Doctor run states a verdict so the operator knows the state
before reading the ladder:

```text
VERDICT: HEALTHY — substrate up; reads/writes landing.
```
or, when a rung fails:
```text
VERDICT: DEGRADED — failing rung: <rung name> (e.g. "2 · WAL checkpoint").
```

When the bridge itself is unreachable, render the entry banner (INV-1, below) as the verdict
context before walking the ladder.

## Entry Banner — bridge unreachable (ISC-43)

If the bridge cannot be reached at all, render this banner VERBATIM before anything else:

```text
🔴 MEMPALACE DEGRADED — the memory bridge is unreachable.
   Reads/writes this session are NOT landing; do not assume anything persisted.
   Recover: run the Doctor workflow (`/MemPalace Doctor`) for the guided repair ladder.
```

## Intent-to-Flag Mapping

Doctor is an ordered runbook, so this maps the operator's diagnostic intent to the rung/command
that addresses it (run the ladder top-to-bottom regardless; this table is for jumping context):

| Operator intent | Rung / action |
|---|---|
| "memory is degraded" / "bridge down" / "recover palace" | Rung 1 — `lsof` socket probe + `mempalace_reconnect()` |
| "writes aren't durable" / "fat WAL" | Rung 2 — `wal_checkpointer.py` |
| "disk / palace volume full" | Rung 3 — `MemPalaceCli.ts render-disk-guard` |
| "index corrupt" / "rebuild the palace" | Rung 4 — version-gated `mempalace repair` (>= 3.4.1) |
| "confirm recovery" / "is it persisting" | Rung 5 — `dos-memory-status.ts` bridge-event ratio |

## The Recovery Ladder (run top-to-bottom; stop at the first rung that restores HEALTHY)

These steps are ordered and copy-pasteable. Run each rung, re-probe, and only descend to the
next rung if the substrate is still DEGRADED. Do not skip ahead — a lower rung (repair/rebuild)
is destructive-adjacent and must not run while an earlier, cheaper rung would have sufficed.

### Rung 1 — Reconnect (restart the daemon)

First confirm whether the socket-backed daemon is actually listening. **Probe liveness with
`lsof` on the socket — NOT a process-name grep** (the socket-backed daemon argv shows as
`python3.x`, so a `pgrep python` / `ps | grep mempalace` returns a false-negative):

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

If the daemon is DOWN (or LIVE but wedged), reconnect / restart it:

- From an MCP-connected session: call `mempalace_reconnect()`.
- Otherwise restart the daemon process so the next bridge call re-spawns it:
  ```bash
  rm -f "$SOCK"   # clear the stale socket; the next DOS_USE_BRIDGE_DAEMON=1 call re-listens
  ```

Re-probe with the `lsof` block above. If LIVE and reads land, you are HEALTHY — stop.

### Rung 2 — WAL checkpoint

If the daemon is live but writes are not durable (or SQLite reports a fat write-ahead log),
flush the WAL back into the main DB. The canonical checkpointer is **`wal_checkpointer.py`**:

```bash
uv run python ~/.claude/skills/mem-palace/Tools/wal_checkpointer.py
```

Re-probe. If reads/writes land, you are HEALTHY — stop.

### Rung 3 — Disk-guard (check free space)

A near-full palace volume causes failed writes AND makes any later repair/rebuild dangerous.
Run the disk-guard before going any deeper:

```bash
bun ~/.claude/skills/mem-palace/Tools/MemPalaceCli.ts render-disk-guard
```

If free space is below the 5GB floor, **stop and free space** before descending to repair —
never rebuild on a near-full disk (a failed rebuild forks residue and can wedge the volume).

### Rung 4 — Repair (LAST RESORT — version-gated)

Repair/rebuild is destructive-adjacent. **Before any `mempalace repair` or rebuild, verify the
installed version is >= 3.4.1:**

```bash
uv run mempalace --version   # MUST be >= 3.4.1 before any repair/rebuild
```

The 3.4.0 repair path OOMs and forks ~1.9G of residue per attempt — do NOT run repair on 3.4.0.
Upgrade to >= 3.4.1 first. Additional hard preconditions:

- NEVER rebuild while another writer is active (no live daemon writing, no concurrent mining).
- NEVER rebuild on a near-full disk (Rung 3 must have passed the 5GB floor).

Only with version >= 3.4.1, a single writer, and adequate free space:

```bash
uv run mempalace repair
```

Re-probe. If reads/writes land, you are HEALTHY — stop.

### Rung 5 — Ratio check (confirm recovery)

Finally, confirm the substrate is not just up but actually persisting, via the bridge-event
ratio (every bridge spawn must produce exactly one bridge-event line):

```bash
bun ~/.claude/skills/mem-palace/Tools/dos-memory-status.ts
```

Healthy band: **bridge-event ratio ∈ [0.99, 1.01]**. Inside the band → declare HEALTHY. Outside
the band → writes are bypassing the wrapper or the wrapper is double-logging; the substrate is
still DEGRADED — escalate to the operator with the failing-rung verdict.

## Closing Verdict

After the ladder, restate the verdict line:

```text
VERDICT: HEALTHY — substrate recovered at rung <N>; bridge-event ratio in band.
```
or
```text
VERDICT: DEGRADED — ladder exhausted; failing rung: <rung name>. Escalate to operator.
```
