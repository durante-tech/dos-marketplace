---
name: SentinelGuard
description: On-demand convention enforcement — checks staged changes or recent commits against discovered conventions.
status: STABLE
bestPath:
  - title: "Load Conventions"
    description: "Merge conventions from MemPalace KG, CLAUDE.md, and the convention cache."
  - title: "Get Changes"
    description: "Detect staged, unstaged, or branch-level diffs to check (or a specific file)."
  - title: "Analyze with Inference"
    description: "Classify each convention against the changes as VIOLATION, EVOLUTION, or PASS via Sonnet."
  - title: "Render Report"
    description: "Shape the inference verdict into a GuardReport and render violations, evolutions, and passing counts."
divergence_from_canonical:
  _intent-to-flag-table.md:
    partial_version: 1.0.0
    reason: "Sentinel Guard workflow uses workflow-specific intent-to-flag vocabulary; canonical Mode/Output two-table shape doesn't fit"
---

# Sentinel Guard — Convention Enforcement

Checks code changes against known conventions and reports violations.

<!-- partial: _workflow-voice.md skill_name=Sentinel workflow_name=Guard action_phrase=" to check conventions" -->

## When to Use

- Triggered by "sentinel guard", "check conventions", "convention check", "check my changes", "check my code".
- Fits a fast pre-commit check of staged/unstaged changes against the convention cache, before work lands.
- NOT for a full branch/PR review — use Review (Guard is the narrowest-scope, staged-changes check; Review covers the whole branch diff).

## Intent-to-Flag Mapping

| User Says | Tool | Flag | When to Use |
|-----------|------|------|-------------|
| "sentinel guard" | ConventionCache.ts | `"$(pwd)"` | Rebuild convention cache for current repo |
| "guard /path/to/repo" | ConventionCache.ts | `/path/to/repo` | Cache for specific directory |
| "convention cache --help" | ConventionCache.ts | `--help` | Show tool usage info |
| "check R<n>" / "rfc conformance" | → see `Workflows/Conformance.md` | — | Single R-point or profile conformance is Conformance's job, not Guard's. Guard is the fast convention-cache check; `check R<n>` (and `check added-by`) route to Conformance. |

## Prerequisites

Sentinel Scan must have been run at least once on this repo. Check:
- `.sentinel/scan-report.json` exists
- `.sentinel/conventions.json` exists (optional but helpful)
- MemPalace KG has triples for this project

If not found, suggest running `sentinel scan` first.

## Workflow

### Step 1: Load Conventions

**From MemPalace KG (primary source):**

Via MCP tool:
```
mempalace_kg_query(entity="project:{wing}", direction="outgoing")
```

Or via bridge.py CLI:
```bash
uv run --with mempalace python ~/.claude/DOS/Tools/mempalace_bridge.py kg_timeline '{"entity":"project:{wing}"}'
```
Filter for predicates: `convention`, `pattern`, `decision`

**From CLAUDE.md (supplement):**
Read the `## Sentinel Conventions` section if it exists.

**From convention cache (fast path):**
Read `.sentinel/conventions.json` if it exists.

Merge all sources, deduplicate by convention description.

### Step 2: Get Changes

Detect what to check based on context:
- If there are staged changes: `git diff --staged`
- If no staged changes, check unstaged: `git diff`
- If no changes at all: `git diff main...HEAD` (branch changes)
- User can also specify: "guard this file" → read that specific file

### Step 3: Analyze with Inference

Send the conventions + changed files to Sonnet:

```bash
bun ~/.claude/DOS/Tools/Inference.ts --level standard --json \
  "You are an architecture guardian checking code changes against established conventions. Classify each finding as VIOLATION (accidental drift), EVOLUTION (intentional new pattern), or PASS." \
  "CONVENTIONS:
{list of conventions with categories}

CHANGES:
{git diff output or file contents}

For each convention, check if any change violates it. Output JSON:
{
  \"violations\": [{
    \"category\": \"string\",
    \"file\": \"path\",
    \"line\": number or null,
    \"convention\": \"what was expected\",
    \"actual\": \"what was found\",
    \"fix\": \"suggested fix\",
    \"confidence\": 0.0-1.0
  }],
  \"evolutions\": [{
    \"category\": \"string\",
    \"file\": \"path\",
    \"old_pattern\": \"previous convention\",
    \"new_pattern\": \"what this introduces\",
    \"recommendation\": \"run sentinel evolve if intentional\"
  }],
  \"passing\": number
}"
```

### Step 4: Output Report

The report markdown is rendered by a tested helper, not hand-typed. Take the Step 3
inference JSON (the agent's VIOLATION / EVOLUTION / PASS verdict — that classification
is the judgment), shape it into a `GuardReport`, and render:

```bash
# renderGuardReport(GuardReport) in SentinelGuard.ts is the byte-exact source of truth
# for the report skeleton (numbered Violations + Potential Evolutions blocks, Summary,
# and the clean-bill-of-health note when zero violations). Pinned by a golden test.
bun ~/.claude/skills/sentinel/Tools/SentinelGuard.ts render <guard-report.json>
```

**GuardReport shape:** `projectName`, `conventionsChecked`, `changesAnalyzed`,
`violations [{category, file, description, convention, actual, fix, confidence}]`,
`evolutions [{category, file, description, oldPattern, newPattern}]`, `passing`.

The agent's job is to map the Step 3 inference output into this shape honestly; the
render (including the zero-violation clean bill of health) is deterministic and pinned
by `SentinelGuard.test.ts`, so the operator-facing report cannot drift from this prose.

## Integration with FeatureDelivery

Guard output can be referenced during FeatureDelivery's review phase:
- Guard covers: conventions (FeatureDelivery point 1), naming, imports, architecture patterns
- FeatureDelivery covers: types (2), security (3), error handling (4), performance (5), testing (6), i18n (7), a11y (8), data integrity (9), build (10)

When invoked from within a FeatureDelivery pipeline, Guard adds its findings as an additional review section — it does not replace the 10-point checklist.
