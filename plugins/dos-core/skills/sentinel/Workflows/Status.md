---
name: SentinelStatus
description: Quick convention health report — shows tracked conventions, last scan date, and KG coverage.
status: STABLE
bestPath:
  - title: "Check Scan State"
    description: "Read .sentinel/scan-report.json and .sentinel/conventions.json for prior scan metadata."
  - title: "Query Knowledge Graph"
    description: "Count KG triples by predicate (stack, conventions, decisions, patterns, last scan)."
  - title: "Check CLAUDE.md"
    description: "Verify whether the Sentinel Conventions section exists."
  - title: "Render Status Report"
    description: "Assemble the read-only probes into StatusData and render the health and parity report."
divergence_from_canonical:
  _workflow-voice.md:
    partial_version: 1.1.0
    reason: "Status keeps a manually inlined voice block from the pre-partial Sentinel workflow set"
  _intent-to-flag-table.md:
    partial_version: 1.0.0
    reason: "Status maps read-only health probes and recommendations; canonical Mode/Output two-table shape does not fit"
---

# Sentinel Status — Convention Health

Quick overview of convention tracking for the current project.

## When to Use

- Triggered by "sentinel status", "convention health", "what conventions", "show conventions".
- Fits a read-only health snapshot of stored conventions — counts, freshness, KG coverage — with no diff-checking involved.
- NOT for checking a diff against conventions — use Guard (staged changes) or Review (branch) — Status only reports what Sentinel already knows.

## Intent-to-Flag Mapping

| Operator intent | Command / flag pattern | Notes |
|---|---|---|
| "show Sentinel status" | read `.sentinel/scan-report.json`, `.sentinel/conventions.json`, and `.sentinel/health.json` | No writes. Missing files become recommendations. |
| "include memory hygiene" | read `MEMORY/STATE/last-reconcile.json`; recommend `bun ~/Durante/Packs/mem-palace/src/Tools/MemoryHygiene.ts --reconcile` when stale | Recommendation only; do not reconcile automatically. |
| "include four-copy parity" | `bun ~/Durante/Tools/sync-check.ts --json` | Surface drift/missing counts. |

## Workflow

### Step 1: Check Scan State

1. Check if `.sentinel/scan-report.json` exists — if not, Sentinel has never scanned this repo
2. Read the scan report for project metadata and scan date
3. Check if `.sentinel/conventions.json` exists and read convention count

### Step 2: Query Knowledge Graph

```
mempalace_kg_query(entity="project:{wing}", direction="outgoing")
```

Count triples by predicate:
- `uses` → stack technologies
- `convention` → tracked conventions
- `decision` → documented decisions
- `pattern` → detected patterns
- `scanned_by_sentinel` → last scan date

### Step 3: Check CLAUDE.md

Read CLAUDE.md and check if `## Sentinel Conventions` section exists.

### Step 4: Output

The Status report markdown is rendered by a single tested helper, **not** hand-typed
here. Gather the read-only probes (KG counts, convention categories, CLAUDE.md section
presence, convention-cache rule count, architecture artifacts, `.sentinel/health.json`,
`MEMORY/STATE/last-reconcile.json`, and `sync-check --json`), assemble them into a
`StatusData` JSON object, and render:

```bash
# Architecture-artifact existence + DOCS_DIR resolution (Docs/Sentinel/ first, then
# .sentinel/docs/) is the tested checkArchitectureArtifacts(docsDir) helper — do not
# hand-probe the five files. The cadence cell uses classifyCadence (7d/14d bands).
# Assemble StatusData, then:
bun ~/.claude/skills/sentinel/Tools/SentinelStatus.ts render <status-data.json>
```

`renderStatus(StatusData)` (in `SentinelStatus.ts`) is the byte-exact source of truth
for the report skeleton — the Knowledge Graph / Conventions-by-Category / CLAUDE.md /
Convention Cache / Architecture Artifacts / Health Score / Memory Hygiene / Four-Copy
Parity / Recommendations sections, all empty-state phrasing, and the cadence and
recommendation branches. The helper is pinned by a golden test, so the operator-facing
output cannot drift from this prose. The agent's only job is to gather the probe data
honestly; the render is deterministic.

**StatusData shape** (the fields the helper consumes):
`projectName`, `wing`, `lastScan {date, daysAgo}`, `kg {stackTech, conventions, decisions, patterns, total}`,
`conventionCategories [{category, count}]`, `hasClaudeMdSection`, `conventionCacheRules` (or null),
`artifacts` (from `checkArchitectureArtifacts`), `health {score, method?, clean, total, drifting[]}` (omit if no `health.json`; when `health.json` exists but carries no measured score — `method: "unmeasured"`, e.g. only a ConventionCache freshness refresh ran — pass `score: null`, never fabricate a number),
`memoryHygiene {lastReconcile {date, daysAgo}}` (omit `lastReconcile` if `last-reconcile.json` missing),
`fourCopy {totalFiles, drift, missing}` (from `sync-check --json`, RFC-0059 fix #5).

The Memory Hygiene cadence (RFC-0059 fix #3) and Four-Copy parity are rendered inside
`renderStatus` from the gathered data — no separate manual surface step is needed.
