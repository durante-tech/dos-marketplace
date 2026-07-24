---
name: DoctrineDrift
description: Verifies the live codebase honors the Algorithm doctrine's MUST/MANDATORY/REQUIRED/CRITICAL obligations. Coverage % gate.
status: STABLE
bestPath:
  - title: "Resolve Doctrine"
    description: "Follow ~/.claude/DOS/Algorithm/LATEST to the active doctrine file and version label."
  - title: "Parse Obligations"
    description: "Extract every MUST/MANDATORY/REQUIRED/CRITICAL paragraph as an obligation."
  - title: "Heuristic-Classify"
    description: "Match each obligation's keywords against known enforcers (hooks, files, dirs) to bucket passing/failing/manual_review_required."
  - title: "Compute Coverage & Exit"
    description: "Compute the coverage percentage and exit 0/1 against the threshold (default 80%)."
divergence_from_canonical:
  _workflow-voice.md:
    partial_version: 1.1.0
    reason: "DoctrineDrift keeps a manually inlined voice block from the pre-partial Sentinel workflow set"
  _intent-to-flag-table.md:
    partial_version: 1.0.0
    reason: "DoctrineDrift maps coverage and JSON flags; canonical Mode/Output two-table shape does not fit"
  _workflow-output-shape.md:
    partial_version: 1.0.0
    reason: "DoctrineDrift has a bespoke doctrine coverage report format"
---

# Sentinel DoctrineDrift — Doctrine ↔ Codebase Coverage

Parses the active Algorithm doctrine (`~/.claude/DOS/Algorithm/LATEST` → resolved `.md`), extracts every `MUST` / `MANDATORY` / `REQUIRED` / `CRITICAL` obligation, and heuristically verifies each one is honored by an actual file, hook, or tool in the live codebase.

The output is a single coverage % — what fraction of doctrine obligations have a verifiable artifact backing them. Falling below the threshold means doctrine is drifting away from implementation (or vice versa).

## Intent-to-Flag Mapping

| User Says | Tool | Flag | When to Use |
|-----------|------|------|-------------|
| "doctrine drift" / "is doctrine honored?" | DoctrineDrift.ts | (no flags) | Default — coverage % + table of failures |
| "doctrine drift json" | DoctrineDrift.ts | `--json` | Pipeline / Studio sync |
| "stricter gate" | DoctrineDrift.ts | `--threshold 90` | Custom coverage floor (default 80) |

## Pipeline (4 Phases)

### Phase 1: Resolve doctrine

```bash
bun ~/.claude/skills/sentinel/Tools/DoctrineDrift.ts
```

Reads `~/.claude/DOS/Algorithm/LATEST`. If symlink → follows it; if regular file → reads first non-empty line as the active filename and joins it to the Algorithm directory. Records the resolved path + version label (filename minus `.md`).

### Phase 2: Parse obligations

For each line containing `MUST` / `MANDATORY` / `REQUIRED` / `CRITICAL` (case-sensitive whole-word match — avoids matching `must` inside prose), capture the surrounding paragraph (lines until blank line above and below) as the obligation text. Truncate to first 200 chars for the report.

### Phase 3: Heuristic-classify each obligation

Per obligation, scan the text for the following keyword families and produce a verification:

| Keyword family | Verification |
|----------------|--------------|
| `INTEL-FIRST` / `intel-context` | check `~/.claude/hooks/IntelFirstGuard.hook.ts` exists AND state-file dir `~/.claude/MEMORY/STATE/intel-context-fired/` exists |
| `ISC count` / `Splitting Test` / `effort floor` | mark `prd_class` (covered by PRDLint, not this tool) |
| `voice` / `voice.sh` | check `${DOS_DIR}/DOS/Tools/voice.sh` exists AND is executable |
| `PREDICATES.md` | check `~/.claude/DOS/PREDICATES.md` exists |
| `WORKING-TREE-CLEAN GATE` / `working-tree-clean-gate` | check `~/Durante/Tools/working-tree-clean-gate.ts` exists |
| `PRD frontmatter` / `frontmatter` | mark `prd_class` |
| `MEMORY/WORK` / `MEMORY/STATE` | check the directory exists |
| `RmGuard` / `PreToolUse` | check `~/.claude/settings.json` registers a matching hook entry |
| (no match) | mark `manual_review_required` |

Each obligation lands in one of three buckets: `passing`, `failing`, `manual_review_required`. PRD-class obligations count as passing (they have a separate enforcer — PRDLint).

### Phase 4: Compute coverage & exit

```
coverage_percent = (passing / (passing + failing)) × 100
```

Manual-review obligations are excluded from the denominator (they're acknowledged gaps, not failures). Exit codes:

- **0** — coverage ≥ threshold (default 80)
- **1** — coverage < threshold

## Output

Header with coverage %, then a table of failing + manual_review obligations:

```
============================================================
  DOCTRINE DRIFT REPORT
============================================================

DOCTRINE:       v0.0.7-enhanced
PATH:           ~/.claude/DOS/Algorithm/v0.0.7-enhanced.md
TOTAL OBLS:     21
COVERAGE:       85.7%   (12 passing / 14 verifiable)
THRESHOLD:      80%     STATUS: PASSING

------------------------------------------------------------
PASSING:                12
FAILING:                2
MANUAL REVIEW:          7
------------------------------------------------------------

FAILING:
[Ob-04] keyword=MUST    classification=intel_first
        text: "All ALGORITHM-mode runs MUST emit intel-context fired..."
        evidence: hook missing at ~/.claude/hooks/IntelFirstGuard.hook.ts

MANUAL REVIEW:
[Ob-09] keyword=MANDATORY  text: "Background agents...MUST NEVER make voice curl calls"
        (no automatable check — manual review)
```

JSON shape matches the spec — `obligations[]` with id, keyword_matched, text, classification, status, evidence.

## When to Use

- After every doctrine version bump (immediate drift baseline)
- Weekly during active doctrine evolution
- As a Sentinel R-rule — surface any new MUST that lacks an enforcer
- Before shipping a release (gate at 80% minimum coverage)
