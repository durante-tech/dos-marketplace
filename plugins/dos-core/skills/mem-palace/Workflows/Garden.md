---
name: Garden
description: Run the MemoryGardener autonomous hygiene agent from inside a session. Exercises the full bridge surface (audit + low-risk fixes + soak-gated destructive ops) across all wings, files a JSON report + drawer + KG health_score, and raises an IncidentResponder envelope on degradation.
status: STABLE
bestPath:
  - title: "Parse Operator Request"
    description: "Extract optional scope, apply, and max-size-kb flags from the request."
  - title: "Invoke MemoryGardener"
    description: "Run the agent pack, defaulting to dry-run unless --apply-ratified is explicitly requested."
  - title: "Surface the Report"
    description: "Print the one-word verdict, then the JSON report, drawer, and KG health_score."
  - title: "Interpret Exit Code"
    description: "Map the exit code to HEALTHY, findings to address, bridge-unreachable, or a held lockfile."
divergence_from_canonical:
  _intent-to-flag-table.md:
    partial_version: 1.0.0
    reason: "MemoryGardener skill wrapper maps scope/apply/max-size safety flags; canonical Mode/Output two-table shape does not fit"
---

# Garden — Run MemoryGardener From a Session

Wraps the [MemoryGardener agent pack](../../../Agents/MemoryGardener/) so it can be invoked from inside a Claude Code session, in addition to its cron / studio paths.

## When to Use

- Trigger phrases: "garden", "run gardener", "hygiene pass", "audit palace", "prune drawers", "MemoryGardener".
- Situation: running a full-palace hygiene audit (health score, low-risk fixes, soak-gated destructive ops) from inside a session.
- NOT for substrate recovery when the bridge is unreachable — use Doctor (Garden audits a healthy palace; Doctor repairs a broken one).

## Defaults vs cron

The skill path **forces dry-run** unless the operator explicitly passes `--apply-ratified`. This is intentional: interactive sessions should not silently apply destructive ops. The cron path passes `--apply-ratified` automatically because it drains the soak queue without supervision.

## Step 1: Parse the operator's request

Extract:

- **scope** (optional): single wing to limit the run to (e.g., `durante`, `donne`)
- **apply** (optional): if the operator explicitly asks to apply ratified ops, pass `--apply-ratified`. Default is dry-run.
- **max-size-kb** (optional): override the indexing size cap (default `100`)

If the operator did NOT explicitly request `--apply`, default to dry-run.

## Intent-to-Flag Mapping

| Operator intent | Command / flag pattern | Notes |
|---|---|---|
| "run memory garden" | `DOS_INVOCATION_SOURCE=skill bun ~/Durante/Packs/agents/MemoryGardener/src/index.ts` | Full audit, dry-run by default. |
| "limit to wing X" | add `--scope <wing>` | Runs the audit for one wing. |
| "apply ratified operations" | add `--apply-ratified` | Only when the operator explicitly asks to apply. |
| "change indexing cap" | add `--max-size-kb <N>` | Overrides the default 100 KB cap. |

## Step 2: Invoke the agent

```bash
DOS_INVOCATION_SOURCE=skill bun ~/Durante/Packs/agents/MemoryGardener/src/index.ts \
  ${SCOPE:+--scope $SCOPE} \
  ${APPLY:+--apply-ratified} \
  ${MAX_SIZE:+--max-size-kb $MAX_SIZE}
```

Examples:

```bash
# Default — full audit, dry-run, all wings
DOS_INVOCATION_SOURCE=skill bun ~/Durante/Packs/agents/MemoryGardener/src/index.ts

# Surgical — single wing, still dry-run
DOS_INVOCATION_SOURCE=skill bun ~/Durante/Packs/agents/MemoryGardener/src/index.ts --scope durante

# Operator-confirmed apply
DOS_INVOCATION_SOURCE=skill bun ~/Durante/Packs/agents/MemoryGardener/src/index.ts --apply-ratified
```

## Step 3: Surface the report

The agent writes:

- JSON report to `~/.claude/MEMORY/STATE/memory-gardener-{date}.json` (logged to `MEMORY/ARTIFACTS/artifacts.jsonl` per the house artifact-tracking pattern)
- Markdown drawer to `wing=durante, room=health-archives`
- KG fact: `memory-gardener health_score N`
- Optional incident envelope to IncidentResponder webhook (degraded triggers only)
- Terminal summary printed to stdout

**The FIRST line of your output MUST be a one-word verdict — `HEALTHY` or `DEGRADED`** — derived
from the agent's exit code (0 → HEALTHY; 1/2/3 → DEGRADED). Print it before any other prose so the
operator sees the verdict at a glance.

After the agent exits, surface the terminal summary verbatim, plus a one-line status (e.g., "HEALTHY (score 87/100)" / "DEGRADED — 3 findings — incident envelope filed").

If the agent exits `2` (BRIDGE_UNREACHABLE) — or any bridge call is otherwise unreachable — the
verdict is `DEGRADED`; surface this banner verbatim and hand off to the Doctor workflow:

```text
🔴 MEMPALACE DEGRADED — the memory bridge is unreachable.
   Reads/writes this session are NOT landing; do not assume anything persisted.
   Recover: run the Doctor workflow (`/MemPalace Doctor`) for the guided repair ladder.
```

## Step 4: Interpret exit code

| Exit | Meaning | Surface |
|------|---------|---------|
| 0 | HEALTHY | "All green." |
| 1 | DEGRADED / NEEDS_FIX | Surface findings list. Recommend follow-up. |
| 2 | BRIDGE_UNREACHABLE | Tell operator the Python bridge could not be reached. Run the Doctor workflow for the guided recovery ladder. |
| 3 | Lockfile already held | Another invocation (cron / studio / different skill call) is running. Wait or check `~/.claude/MEMORY/STATE/.memory-gardener.lock`. |

## When NOT to use this workflow

- **Production data emergency** — go straight to the agent CLI; the skill wrapper adds latency.
- **Repeated dry-runs in tight loop** — the bridge `reconcile` call is heavy (5-30s). Use the JSON report from the cron run instead.
- **Editing the MemPalace surface** — this workflow audits, never structurally changes the palace. For schema work see `MergeReconcile`, `MergeEntities`, `MergePredicates`.

## Notes

- **Successor relationship**: this is the v0.0.10-class evolution of the deprecated `PalaceMaintenance` agent. The old agent's cron is still running (until MemoryGardener is observed healthy for one week); see `Packs/agents/PalaceMaintenance/DEPRECATED.md`.
- **Three invocation paths share a single lockfile** at `~/.claude/MEMORY/STATE/.memory-gardener.lock`. Concurrent fire returns exit code 3 from the late-arriving caller.
- **The skill defaults to dry-run** because the cron path is the canonical place for destructive op application.
