---
name: PRDLint
description: Lints every WORK PRD against doctrine obligations (frontmatter, ISC floor, DATETIME parity, DAG contract, archive eligibility, verification section).
status: STABLE
bestPath:
  - title: "Discover PRDs"
    description: "Resolve MEMORY/WORK/*/PRD.md project-first, falling back to global paths."
  - title: "Apply Six Checks"
    description: "Validate frontmatter completeness, ISC floor, DATETIME parity, DAG contract, archive eligibility, and verification section per PRD."
  - title: "Aggregate & Exit"
    description: "Group findings by severity and exit 0 (no criticals) or 1 (any critical)."
divergence_from_canonical:
  _workflow-voice.md:
    partial_version: 1.1.0
    reason: "PRDLint keeps a manually inlined voice block from the pre-partial Sentinel workflow set"
  _intent-to-flag-table.md:
    partial_version: 1.0.0
    reason: "PRDLint maps workflow-specific lint flags; canonical Mode/Output two-table shape does not fit"
  _workflow-output-shape.md:
    partial_version: 1.0.0
    reason: "PRDLint has a bespoke doctrine lint report format"
---

# Sentinel PRDLint — WORK PRD Doctrine Lint

Walks every `MEMORY/WORK/*/PRD.md` and validates against six doctrine rules drawn from RFCs R17-R24 and the v0.0.7 Algorithm's PRD template. One command answers: "are my PRDs compliant?"

## Intent-to-Flag Mapping

| User Says | Tool | Flag | When to Use |
|-----------|------|------|-------------|
| "lint PRDs" / "check PRDs" | PRDLint.ts | (no flags) | Human report, all severities |
| "PRD lint json" | PRDLint.ts | `--json` | Pipeline / Studio sync |
| "show only critical" | PRDLint.ts | `--severity critical` | Filter to blocking issues |
| "what can I archive?" | PRDLint.ts | `--auto-archive` | Print archive commands without executing |

## Pipeline (3 Phases)

### Phase 1: Discover PRDs

```bash
bun ~/.claude/skills/sentinel/Tools/PRDLint.ts
```

The tool resolves PRDs project-first (`$CLAUDE_PROJECT_DIR/MEMORY/WORK/*/PRD.md`), falling back to `~/Durante/MEMORY/WORK/*/PRD.md` and `~/.claude/MEMORY/WORK/*/PRD.md`. Frontmatter is parsed by simple key:value extraction (no full YAML library — kept dependency-free).

### Phase 2: Apply six checks per PRD

For each PRD:

1. **Frontmatter completeness** (R17 logic mirror) — required fields: `slug`, `started`, `effort`, `phase`, `domain`, `complexity`, `intent`, `outcome`. Missing field = critical.
2. **ISC count vs effort floor** (R18 logic mirror) — count `## ISC-*` headings in body. Floors: Light 1+, Standard 4+, Heavy 7+, Hardcore 10+. Below floor = critical.
3. **DATETIME parity** (R20 logic mirror) — slug timestamp prefix (`YYYYMMDD-HHMMSS_`) must match frontmatter `started` within 30 seconds. Drift = warning.
4. **DAG contract** (R24 logic mirror) — if ISC count ≥4 AND distinct stream count ≥2 (heuristic: count distinct ISC `stream:` tags or sub-section groupings), the PRD must contain `## Pre-Delegation Contract` (or "Pre-Delegation Contract" header). Missing = critical.
5. **Stale-archive eligibility** — if `phase: complete` AND file mtime ≥7 days ago, surface an info finding "ready to archive" with the archive command (does not execute).
6. **Verification section presence** — if `phase: complete`, `## Verification` heading must exist with >50 chars of content after the heading. Missing/empty = warning.

### Phase 3: Aggregate & exit

Findings group by severity. Exit codes:

- **0** — zero critical findings
- **1** — any critical finding

`--severity {critical|warning|info}` filters the output (and the JSON `findings` array). `--auto-archive` adds an `auto_fix_command` field for stale completes pointing at the archive script (caller decides whether to run them).

## Output

Per-PRD line, severity icon, slug, message:

```
============================================================
  PRD LINT REPORT
============================================================

TOTAL PRDS:     604
CRITICAL:       7
WARNING:        12
INFO:           41

------------------------------------------------------------
[CRITICAL] 20260415-103000_kg-failsafe          Missing frontmatter field: complexity
[CRITICAL] 20260420-091500_voice-failover        ISC count 2 below Standard floor (4)
[WARNING]  20260422-140000_dag-protocol          DATETIME drift: slug=20260422-140000 frontmatter=2026-04-22T14:00:45Z
[INFO]     20260301-100000_v005-walking-skeleton ready to archive (phase: complete, mtime: 64d ago)
------------------------------------------------------------
```

JSON shape:

```json
{
  "timestamp": "2026-05-04T21:15:00Z",
  "total_prds": 604,
  "by_severity": { "critical": 7, "warning": 12, "info": 41 },
  "findings": [
    {
      "slug": "20260415-103000_kg-failsafe",
      "severity": "critical",
      "category": "frontmatter",
      "message": "Missing frontmatter field: complexity",
      "auto_fix_command": null
    }
  ]
}
```

## When to Use

- Before shipping a PRD-heavy week (catch frontmatter rot)
- After a doctrine bump (re-validate the corpus against new floors)
- Before Studio sync (avoid syncing malformed PRDs)
- Periodically to surface archive candidates without manual scanning
