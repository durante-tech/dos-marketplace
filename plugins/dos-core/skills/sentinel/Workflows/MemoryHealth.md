---
name: MemoryHealth
description: Single-command audit of memory subsystem health across hygiene, drift, queues, backups, disk, reconcile, bridge surface, and registry consistency. Includes operator-gated --fix flag for mechanical resolution of registry-class issues.
status: STABLE
bestPath:
  - title: "Run 8-Section Audit"
    description: "Execute hygiene, drift, pending queues, backups, disk volume, reconcile freshness, bridge surface, and registry checks in one pass."
  - title: "Plan Mechanical Fixes"
    description: "With --fix, plan PROJECTS.md and palace-cache resolutions for Phase 8 registry issues (dry-run)."
  - title: "Apply Fixes"
    description: "With --fix --apply, write the planned registry resolutions (operator-gated)."
  - title: "Score & Exit"
    description: "Compute the overall 0-100 score and exit 0 (clean or warnings) or 1 (any critical)."
divergence_from_canonical:
  _workflow-voice.md:
    partial_version: 1.1.0
    reason: "MemoryHealth keeps a manually inlined voice block from the pre-partial Sentinel workflow set"
  _intent-to-flag-table.md:
    partial_version: 1.0.0
    reason: "MemoryHealth maps audit/fix flags across several subsystems; canonical Mode/Output two-table shape does not fit"
  _workflow-output-shape.md:
    partial_version: 1.0.0
    reason: "MemoryHealth has a bespoke multi-section health report format"
---

# Sentinel MemoryHealth — 8-Section Memory Audit

Operationalizes the post-tragedy 4-domain memory audit (statusbar / bridge / gitignore / runtime) and extends it with four more sections (drift telemetry, pending queues, reconcile freshness, registry consistency). One command answers: "is the memory subsystem healthy right now?"

Phase 8 (Registry consistency) was added 2026-05-09 after the empty-status-bar incident. It invokes R39, R40, R42 from the v3-resilience profile and supports `--fix --apply` for mechanical resolution.

## Voice Notification

```bash
bash "$DOS_DIR/DOS/Tools/voice.sh" main "Running the MemoryHealth workflow in the sentinel skill to audit the memory subsystem"
```

## Intent-to-Flag Mapping

| User Says | Tool | Flag | When to Use |
|-----------|------|------|-------------|
| "memory health" / "is memory ok?" | MemoryHealthCheck.ts | (no flags) | Default — human-readable ASCII report |
| "memory health json" / pipeline use | MemoryHealthCheck.ts | `--json` | CI / scripting / Studio capture |
| "memory health fix" / "preview registry fix" | MemoryHealthCheck.ts | `--fix` | Dry-run Phase 8 mechanical resolution (no writes) |
| "memory health fix apply" / "apply registry fix" | MemoryHealthCheck.ts | `--fix --apply` | Write Phase 8 fixes (PROJECTS.md mirror + palace-cache seed) |
| "memory help" | MemoryHealthCheck.ts | `--help` | Show usage |

## Pipeline (Single Phase, 8 Parallel Sections)

The tool runs all eight sections in sequence (each isolated in try/catch — one failure does not crash the others) and aggregates a single overall_score (0-100).

### Phase 1: Run all sections

```bash
bun ~/.claude/skills/sentinel/Tools/MemoryHealthCheck.ts
```

What it checks:

1. **Hygiene** — wraps `bun ~/Durante/Packs/mem-palace/src/Tools/MemoryHygiene.ts --json`. Extracts overall_score, total_drawers, total_kg_facts, last_harvest age. Inherits any issues array.
2. **Drift telemetry** — reads up to last 100 entries from `~/.claude/MEMORY/LEARNING/SIGNALS/mempalace-drift.jsonl`. Counts unique unknown actions. >0 unknowns is a warning.
3. **Pending queue depth** — counts files in `~/.claude/MEMORY/STATE/.pending/`, `MEMORY/ARTIFACTS/.pending/`, `MEMORY/VOICE/.pending/`. >200 total = critical (queue not draining).
4. **Backup freshness** — locates newest folder under `~/Library/Application Support/DOS/backups/{YYYY-MM-DD}/`, reads `MANIFEST.json` mtime. >48h = critical.
5. **Gitignore disk volume** — `du -sh` on `~/Durante/MEMORY` (parent) and submodule `Releases/v*/.claude/MEMORY` (active version). Tracks creep over time.
6. **Reconcile freshness** — reads `~/.claude/MEMORY/STATE/last-reconcile.json` if it exists. Reports last run + age in days; null if never run.
7. **Bridge surface usage** — greps `bridgeSync\|bridgeFire` invocations across `~/.claude/hooks/`. Counts unique actions called vs known surface area. Helps detect dormant code paths.
8. **Registry consistency** *(NEW — 2026-05-09)* — invokes `ValidateRfcConformance --profile v3-resilience` for R39 (PROJECTS.md ↔ JSON parity), R40 (declared-wing-provisioned), and R42 (resolver source parity). Failures bubble up as critical unless `--fix --apply` resolved them in the same run.

### Phase 1b: Optional --fix (mechanical resolution)

When `--fix` is passed, after the 8 sections complete the tool plans mechanical resolutions for Phase 8 issues:

- **R39 fix**: append rows to `~/.claude/DOS/USER/PROJECTS/PROJECTS.md` for any wings that exist in `.dos-projects.json` but not in PROJECTS.md (Stack column = `(run /sentinel scan to populate)`).
- **R40 fix**: write `palace-cache-{wing}.sh` files (`palace_wing_drawers=0\npalace_total_drawers=N`, where N is read from any existing cache for snapshot consistency) for declared wings that lack one.
- **R42 fix**: NOT auto-fixable (resolver-source parity is code, not data); reported only.

`--fix` alone is dry-run — prints the plan and exits. `--fix --apply` writes the changes. The two-flag gate is intentional: registry mutation is shared-state and warrants explicit operator confirmation.

### Phase 2: Score & exit

`overall_score` is the simple mean of section scores (each 0-100). Exit codes:

- **0** — all sections clean OR warnings only
- **1** — any critical (backup >48h, pending >200, drift unknowns >0, Phase 8 fail without --fix --apply)

## Output

ASCII box-drawing summary mirrors the MemoryHygiene aesthetic:

```
============================================================
  MEMORY HEALTH AUDIT
============================================================

OVERALL SCORE: 87/100   STATUS: HEALTHY (warnings only)
TIMESTAMP:     2026-05-04T21:14:00Z

------------------------------------------------------------
[1/8] HYGIENE             score: 92/100   issues: 1
[2/8] DRIFT TELEMETRY     unknowns: 0     entries: 47
[3/8] PENDING QUEUES      total: 12       state:5 art:7 voice:0
[4/8] BACKUP              age: 4.2h       newest: 2026-05-04
[5/8] DISK VOLUME         parent: 412M    submodule: 18M
[6/8] RECONCILE           never_run       (warning)
[7/8] BRIDGE SURFACE      called: 6/8     dormant: 2
[8/8] REGISTRY            score: 100/100   R39:pass  R40:pass  R42:pass
------------------------------------------------------------
```

Critical issues render in red, warnings in yellow, info in gray (when stdout is a TTY). With `--json`, the raw object is emitted unchanged for machine consumption.

## When to Use

- Daily sanity check after the post-tragedy memory hardening (RFC-0056 W-T7)
- Before shipping anything that touches memory paths
- After any reconcile / backup rotation
- When statusbar memory-pressure indicator looks suspicious

## Boundary

MemoryHealth audits and scores the memory *subsystem* and offers an operator-gated mechanical `--fix` — it does not recover the palace substrate and does not replace the raw radiator. Pick the right surface for the question you're actually asking:

- **Sentinel MemoryHealth** (this workflow) — the audit + 0-100 scoring + operator-gated `--fix --apply` across the eight infrastructure sections: hygiene, drift, pending queues, backups, disk volume, reconcile freshness, bridge surface, and registry consistency. Run it to answer "is the memory subsystem healthy right now?" and to mechanically resolve registry-class drift.
- **MemPalace Garden / Status** — palace-side substrate recovery (rebuild/repair of the ChromaDB + SQLite store) and live knowledge-graph status. Run these when the palace *itself* is degraded — not when you want a health score.
- **`dos-memory-status.ts`** — the raw information radiator: drawer counts, KG facts, closet coverage, and the bridge-event ratio metric. Run it for the unscored underlying numbers; MemoryHealth's hygiene section consumes the same substrate but rolls it into a score.
