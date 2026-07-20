---
name: Closets
description: Builds and maintains the closet-pointer index that boosts hybrid BM25 search, and ranks candidate lineage parents for new artifacts.
status: STABLE
bestPath:
  - title: "Choose the Maintenance Action"
    description: "Pick build_closets, rebuild_closets, backfill_closets, or suggest_parent based on the situation."
  - title: "Run the Closet Action"
    description: "Execute the chosen bridge action against one file, a wing, or the whole palace."
  - title: "Handle Bridge Failure"
    description: "Render the DEGRADED banner and stop if the bridge or daemon is unreachable."
  - title: "Report the Verdict"
    description: "Lead with the closets-created count and scope, or the ranked lineage-parent candidates."
divergence_from_canonical:
  _intent-to-flag-table.md:
    partial_version: 1.0.0
    reason: "MemPalace Closets maps four maintenance bridge actions; canonical Mode/Output two-table shape doesn't fit"
  _workflow-output-shape.md:
    partial_version: 1.0.0
    reason: "MemPalace workflow has bespoke Output Format section"
---

# Closets — Closet-Pointer Index Maintenance + Lineage Suggestion

Build and maintain the closet-pointer index — the compact pointer lines that give
the hybrid BM25 search path its boost — and suggest lineage parents for new
artifacts. Closet coverage matters: when a drawer's source file has no closet,
the BM25 boost path is silent for that drawer (live coverage sat at 17.3% before
backfill — RFC-0073 audit C.9).

## When to Use

- Trigger phrases: "closets", "build closets", "rebuild closets", "suggest parent".
- Situation: closet coverage needs maintenance (BM25 boost path), or a new PRD/artifact needs a ranked lineage-parent suggestion.
- NOT for repairing a degraded substrate — use Doctor (Closets maintains coverage; Doctor recovers a broken bridge/daemon).

## Your Task

Pick the right closet maintenance action for the situation, or rank candidate
lineage parents for a PRD task. The four surfaces map to bridge actions
`build_closets`, `rebuild_closets`, `backfill_closets`, and `suggest_parent`
(MCP exposes `suggest_parent` via planning tools; the three closet builders are
bridge-side maintenance utilities).

The FIRST line of output is a verdict: closet builders → closets-created count +
scope (source file / wing / "all"); `suggest_parent` → candidate count + echoed
task. The SECOND line NAMES the executed surface.

## When to use which

| Action | Use when | Behavior |
|--------|----------|----------|
| `build_closets` | A single source file's drawers need closets (first-time construction for that file). | Finds all drawers matching `source_file`, purges its stale closets, rebuilds pointer lines for just that file. Targeted. |
| `rebuild_closets` | Full recompute — upgrading a pre-3.3.0 palace, or closets drifted and you want a clean rebuild. | Scans **all** drawers (optionally one `wing`), regenerates every closet from scratch. O(drawers); the heavy hammer. |
| `backfill_closets` | Incremental gap-closing — close the coverage gap without recomputing already-covered files. | Scans the closets collection first to learn covered `source_file`s, emits closets only for **uncovered** drawers. Idempotent; bounded via `max_files`; designed for the weekly cron. |
| `suggest_parent` | A new PRD/artifact needs a lineage parent suggested. | Thin post-processor over `search`: ranks candidate parent artifacts (RFC/SPEC/PLAN/ROADMAP/PRD ids) by confidence for a task description. |

Default for routine hygiene is `backfill_closets` (incremental, idempotent, cheap).
Reach for `rebuild_closets` only when you need a from-scratch recompute.

## Step 1: Build closets for one source file

**Bridge (`build_closets`):**

```bash
uv run --with mempalace python ~/.claude/DOS/Tools/mempalace_bridge.py build_closets '{"source_file":"/abs/path/to/file.md"}'
```

`source_file` is required (a bare positional string is also accepted as the
`source_file` shorthand). Returns `{"status":"ok","drawers_found":N,"closets_created":M}`.

## Step 2: Full recompute (migration / clean rebuild)

**Bridge (`rebuild_closets`):**

```bash
uv run --with mempalace python ~/.claude/DOS/Tools/mempalace_bridge.py rebuild_closets '{}'
```

Scope to one wing with `{"wing":"durante"}`. Returns
`{"status":"ok","drawers_processed":N,"closets_created":M,"wing_filter":...}`.

## Step 3: Incremental backfill (routine hygiene / cron)

**Bridge (`backfill_closets`):**

```bash
uv run --with mempalace python ~/.claude/DOS/Tools/mempalace_bridge.py backfill_closets '{"max_files":50}'
```

Optional args: `wing` (restrict), `max_files` (cap per run; `0` = no cap),
`dry_run` (compute coverage + candidates without writing). Reports starting and
ending coverage so the operator can watch the gap close across runs. Safe to run
repeatedly — a no-op once coverage = 100%.

## Step 4: Suggest a lineage parent

**Bridge (`suggest_parent`):**

```bash
uv run --with mempalace python ~/.claude/DOS/Tools/mempalace_bridge.py suggest_parent '{"task":"PRD task description","limit":3,"min_confidence":0.15}'
```

`task` is required (a bare positional string is accepted as the `task`
shorthand). Optional: `limit` (default 3), `min_confidence` (default 0.15),
`wing`, `require_projects_file`. Returns ranked candidates with `artifactId`,
`title`, `confidence`, and `signal_source` (`hybrid` | `distance`).

## Bridge failure — render the DEGRADED banner

If the MCP tool errors or the bridge/daemon (`$DOS_DIR/MEMORY/STATE/.mempalace.sock`)
is unreachable, do NOT report `closets_created: 0` as "nothing to do" or present
empty `suggest_parent` candidates as "no parent" — render the DEGRADED banner and stop:

```text
🔴 MEMPALACE DEGRADED — the memory bridge is unreachable.
   Reads/writes this session are NOT landing; do not assume anything persisted.
   Recover: run the Doctor workflow (`/MemPalace Doctor`) for the guided repair ladder.
```

## Intent-to-Flag Mapping

This workflow shells out to the MemPalace bridge per CreateSkill workflow Step 6 +
CliFirstArchitecture.md. Translate operator phrasing into deterministic action
selection and JSON-arg shape.

### Mode / Action

| User Says | Bridge Action | Effect |
|-----------|---------------|--------|
| "build closets for <file>" / "index this file's closets" | `build_closets` | First-time closet construction for one source file |
| "rebuild all closets" / "recompute the closet index" / "migrate closets" | `rebuild_closets` | Full from-scratch recompute over all drawers (optional wing) |
| "backfill closets" / "close the closet coverage gap" / "weekly closet sweep" | `backfill_closets` | Incremental: only emit closets for uncovered drawers (idempotent) |
| "suggest a parent for this PRD" / "what should this artifact descend from?" | `suggest_parent` | Rank candidate lineage-parent artifacts by confidence |

### JSON Argument Shape

| Action | Required JSON Args | Optional JSON Args |
|--------|--------------------|--------------------|
| `build_closets` | `source_file` (string; positional shorthand accepted) | none |
| `rebuild_closets` | none — `{}` is valid | `wing` (string) |
| `backfill_closets` | none — `{}` is valid | `wing`, `max_files` (int, 0 = no cap), `dry_run` (bool) |
| `suggest_parent` | `task` (string; positional shorthand accepted) | `limit` (int, default 3), `min_confidence` (float, default 0.15), `wing`, `require_projects_file` (bool) |

## Output Format

```
Closets rebuilt: +M across N drawers · scope: wing=durante
  Surface: bridge action rebuild_closets

— or, for suggest_parent —

2 parent candidates · task: "PRD task description"
  Surface: bridge action suggest_parent
    RFC-0073  "MemPalace runtime hygiene"  confidence 0.61 (hybrid)
    RFC-0037  "Session memory recall"      confidence 0.42 (distance)
```
