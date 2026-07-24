---
name: Mine Reflections
description: Mine algorithm reflections for recurring patterns suggesting Algorithm or system upgrades.
status: STABLE
---

# MineReflections Workflow

## Overview

The Algorithm writes a structured reflection after every Standard+ run to `MEMORY/LEARNING/REFLECTIONS/algorithm-reflections.jsonl`. Each entry contains three questions focused on algorithm performance:

- **Q1 (Self):** What would I have done differently?
- **Q2 (Algorithm):** What would a smarter algorithm have done?
- **Q3 (AI):** What would a fundamentally smarter AI have done?

This workflow mines those reflections for **recurring themes** and produces **actionable upgrade candidates** for the Algorithm, skills, hooks, or system architecture.

---

## Data Schema

Each JSONL entry contains:

```json
{
  "timestamp": "ISO or epoch",
  "effort_level": "Standard|Extended|Advanced|...",
  "task_description": "What was being done",
  "criteria_count": 12,
  "criteria_passed": 12,
  "criteria_failed": 0,
  "prd_id": "PRD-YYYYMMDD-slug",
  "implied_sentiment": 8,
  "reflection_q1": "Self-reflection on algorithm execution",
  "reflection_q2": "What a smarter algorithm would do differently",
  "reflection_q3": "What a fundamentally smarter AI would do",
  "within_budget": true,
  "rework_count": 0
}
```

---

## Execution

### Step 1: Read All Reflections

**Source:** Studio-first with local fallback. Pull cross-session, cross-device reflections from Studio merged with the local JSONL via the `FetchReflections` CLI. Studio is the canonical post-sync record; local `algorithm-reflections.jsonl` carries current-session pre-sync entries. Conflicts dedupe by `prd_id` with Studio winning. If Studio env is unset or the endpoint errors, the tool degrades silently to local-only (exit 0).

```bash
bun ~/.claude/skills/utilities/DOSUpgrade/Tools/FetchReflections.ts --merge-local > /tmp/reflections.jsonl
```

```
Read /tmp/reflections.jsonl (pre-populated by FetchReflections — Studio + local merged, deduped).

Parse each line as JSON. Collect all entries into an array.
Report: "Found N reflections spanning [date range]"
```

### Step 2: Signal Prioritization

**Not all reflections are equally valuable.** Weight entries by signal strength:

| Signal | Weight | Rationale |
|--------|--------|-----------|
| `implied_sentiment` <= 5 | HIGH | Low satisfaction = something went wrong worth fixing |
| `implied_sentiment` 6-7 | MEDIUM | Room for improvement |
| `implied_sentiment` 8-10 | LOW | Things went well — less urgent |
| `within_budget: false` | BOOST | Over-budget = structural issue |
| `criteria_failed > 0` | BOOST | Failed criteria = verification gap |
| `rework_count > 0` | BOOST | Rework = initial approach was wrong |

**Highest signal entries:** Low sentiment + substantive Q2 answer + over-budget. These are the gold.

### Step 2.5: Objective-Signal Corroboration (P4 — the non-sentiment counterweight)

**Step 2's weighting is SELF-RATED.** `implied_sentiment` is the model scoring its own output from tone (the model is forbidden from reading the operator's real `ratings.jsonl`). On its own, the loop event-sources opinions — a clean projection over self-graded confidence. This step adds the OBJECTIVE counterweight: facts the system already logs but never reads back into the loop.

```bash
bun ~/Durante/Tools/objective-signal.ts --days 30 --json > /tmp/objective-signal.json
```

The digest aggregates the existing objective ledgers (hook blocks, mode-floor escalations, worktree-write blocks, git reverts) into `objective_events_in_window`. Use it two ways:

1. **Corroborate each Step-4 candidate.** A candidate whose claimed problem maps to objective events (a gate that actually fired, a block, a revert tied to the theme) is **grounded**; one with zero corroborating objective events is flagged **`[opinion-only — no objective corroboration]`** and ranked below any grounded candidate of equal frequency. Opinion-only candidates are still surfaced (low sentiment can precede a real-but-unlogged problem) — labelled, never silently dropped.
2. **Surface dead-weight gates (H5).** `shadow-would-block` sources with high counts and zero real blocks (e.g. a guard logging tens of thousands of would-blocks while disabled) are arm-or-prune candidates — append to the report's `## Dead-Weight / Prune Candidates` section.

**Why:** GregYoung — *"a hook-block is a fact; sentiment is an opinion; a clean projection over corrupt events is a well-rendered lie."* Without this step the loop amends the doctrine from a corpus it rates itself (H6). Wiring shipped by the doctrine-mechanization effort (PRD `20260629-230258_doctrine-mechanization-foundation`, Phase B).

### Step 3 Pre-Step: Canonical Auto-Skip (Discovery-First)

Before clustering or spawning analyst agents, probe the canonical patterns corpus to avoid re-authoring patterns that already exist.

1. **Enumerate canonical patterns**: `ls ~/Durante/MEMORY/CANONICAL/patterns/*.md` (live count as of 2026-05-26: **14 patterns** — corpus grows over time, so always re-read).
2. **Token-overlap scan**: for each Q2 theme keyword set (and Q1/Q3 if surfaced), grep each canonical pattern's body + frontmatter for slug/keyword overlap. Example: theme = "code review HIGH triggers re-recount" → grep finds `code-review-as-discovery-completeness.md`.
3. **Classify each candidate**:
   - **FULLY-COVERED** → mark `ALREADY_CANONICAL — skip authoring`; reference the existing pattern in the report's `## ⏭️ Skipped (Already Canonical)` subsection.
   - **PARTIALLY-COVERED** → pattern exists but a named enforcement surface (R-rule, Algorithm clause, etc.) is still missing; narrow the candidate to just the missing surface.
   - **NET-NEW** → proceed to theme extraction below.
4. **Output**: report includes `## ⏭️ Skipped (Already Canonical)` BEFORE `## Top Upgrade Candidates`, listing each skipped candidate with matched canonical filename + canonical file date + skip reason.

**Redundancy proof from parent session**: PRD `20260526-191054` produced 8 candidates; manual Discovery-First probe of canonical dir caught 3 redundant (token-bridge → `token-bridge-adoption.md`; code-review-as-discovery → `code-review-as-discovery-completeness.md`; file-redirected-stdio → `file-redirected-child-stdio-for-subprocess-tests.md`). Auto-skip would have flagged these without the manual probe — 6-8 hours of redundant authoring saved.

### Step 3: Theme Extraction (with Trait-Composed Analysts)

When spawning parallel agents for theme extraction, compose each from traits to get differentiated perspectives:

| Analyst | Traits | Focus |
|---------|--------|-------|
| Pattern Miner | `research,analytical,investigative` | Find recurring clusters in Q1/Q2/Q3 |
| Root Cause | `technical,contrarian,thorough` | Challenge surface-level themes, dig deeper |
| Prioritizer | `product,pragmatic,rapid` | Focus on highest-impact, lowest-effort fixes |

Compose via: `bun run ~/.claude/skills/agents/Tools/ComposeAgent.ts --traits "<traits>" --output json`
Use returned `prompt` as agent system prompt with `subagent_type: "general-purpose"`.

For each question category (Q1, Q2, Q3), cluster the answers into themes:

**Q2 Themes (Algorithm Improvements) — PRIMARY OUTPUT:**
- Group similar Q2 answers together
- Count frequency: how many reflections mention this theme?
- Identify the underlying structural issue each theme points to
- Example themes: "ISC quality gates too lenient", "Phase budgets not enforced", "Capability selection too conservative"

**Q1 Themes (Execution Patterns) — SECONDARY:**
- Recurring execution mistakes (e.g., "should have read file before editing", "agent overhead for simple tasks")
- These suggest workflow guardrails or pre-flight checks

**Q3 Themes (Fundamental Improvements) — ASPIRATIONAL:**
- Patterns in what a smarter AI would do differently
- These inform longer-term architecture decisions

### Step 4 Pre-Step: Substrate Audit Auto-Trigger (R-Rule Detector)

Before synthesizing candidates into ISCs, detect any candidate proposing new Sentinel R-rules and gate authoring on substrate freshness.

1. **R-RULE-PROPOSING detector**: regex-scan each candidate's `Proposed fix` and `Target file(s)` fields for any of:
   - `Sentinel R-rule`, `presence.*`, `/Packs/sentinel/`, `R\d+-`, `handlers/`, `registry.ts`, `Conformance`
   - Match → flag candidate as **R-RULE-PROPOSING**.
2. **Staleness check**: if ≥1 R-RULE-PROPOSING candidates are detected, check the most recent Sentinel substrate audit:
   - mtime on `MEMORY/WORK/*/audit-report.md` matching `*sentinel-substrate-health-audit*`, OR
   - `generated` timestamp in `.sentinel/health.json`.
   - If absent OR > 7 days old → trigger mandatory pre-authoring gate.
3. **Mandatory gate**: workflow OUTPUT prepends a `## 🚨 PRE-AUTHORING REQUIRED: Substrate Audit` block. Spawn a substrate-audit agent with prompt: *"Read shape model at `MEMORY/WORK/active/20260527-sentinel-substrate-health-audit/audit-report.md` and produce equivalent report on current state of `Packs/sentinel/src/Tools/ConformanceChecks/`."*
4. **Audit dimensions** (covered by the worked-example shape): rule cardinality, R-number collisions, registry parity (handlers vs registry imports), scan-health staleness, suspicious dead-rule detection, plus 2 advisory outputs (ROOLS decision, R-number allocation tool spec).

**Failure caught from parent session**: PRD `20260526-191054` authored 4 ISCs (A1-A4) against `Packs/sentinel/src/Rules/` — a directory that **does not exist**. The correct authoritative location is `Packs/sentinel/src/Tools/ConformanceChecks/handlers/`. Without the substrate audit (commissioned only after the parent PRD shipped wrong-directory ISCs), the canonical R-rules would have landed in the wrong tree. This auto-trigger prevents that failure mode.

### Step 4: Synthesize Upgrade Candidates

For each theme with **2+ occurrences** (or 1 occurrence if sentiment <= 4):

```
UPGRADE CANDIDATE: [Theme Name]
  Frequency: N reflections
  Signal strength: HIGH/MEDIUM/LOW
  Supporting reflections:
    - [timestamp] [task_description] — "[relevant Q2 quote]"
    - [timestamp] [task_description] — "[relevant Q2 quote]"
  Root cause: [What structural issue causes this pattern]
  Proposed fix: [Specific change to Algorithm, skill, hook, or system]
  Target file(s): [Which DOS files would change]
  Effort estimate: [Instant/Fast/Standard/Extended]
```

### Step 5: Prioritize and Output

Sort upgrade candidates by:
1. Frequency (most recurring first)
2. Signal strength (highest first)
3. Effort estimate (lowest first — quick wins bubble up)

### Step 5 Final Step: Cato Cross-Vendor Review (Tier-Gated)

Apply discovery-completeness check to the mining output itself by spawning a cross-vendor reviewer before shipping the report.

1. **Tier gate**: if dominant effort tier of the mined reflections is **Extended (E2+) or higher** AND the run produced ≥3 upgrade candidates → spawn the Cato subagent (`subagent_type: "Cato"`) with the prioritized mining report as input. Standard (E1) runs may skip Cato — cost outweighs benefit for small mining surfaces.
2. **Cato verdict**: per RFC-0067 §13 cross-vendor pattern, Cato returns one of **AFFIRM** / **AMEND** / **OVERTURN** plus a findings table (HIGH / MEDIUM / LOW severity).
3. **Report integration**: verdict appears as closing `## 🦊 Cato Cross-Vendor Review` section in the mining report. Section includes verdict + findings table + reconciliation note explaining what in-family review caught vs what Cato added.
4. **Ship gate**: mining report ships ONLY after Cato has reviewed. The mining workflow's own output is subject to the same discovery-completeness check it produces for downstream PRDs.

**Cross-vendor value earned (parent PRD D11)**: Wave-2 Cato pass against the parent session's Amendment I surfaced 3 HIGH findings (F1: named hook does not exist; F2: substep label collides with v0.0.10 §6.5; F5: enforcement surface unspecified) that the Claude in-family Council + RedTeam missed. Cross-vendor pattern earned its keep — forward-going default for E4+ mining runs.

---

## Output Format

```
# Internal Reflection Mining Report

**Source:** MEMORY/LEARNING/REFLECTIONS/algorithm-reflections.jsonl
**Entries analyzed:** N
**Date range:** [earliest] to [latest]
**High-signal entries:** N (sentiment <= 5 or over-budget or failed criteria)

## Top Upgrade Candidates

### 1. [Theme Name] (N occurrences, HIGH signal)
**Root cause:** ...
**Proposed fix:** ...
**Target:** ...
**Effort:** ...
**Evidence:**
- ...

### 2. [Theme Name] ...

## Execution Pattern Warnings (from Q1)
- [Recurring mistake] — seen N times
- ...

## Aspirational Insights (from Q3)
- [Fundamental improvement] — seen N times
- ...
```

---

## Integration with Upgrade Workflow

This workflow can run:
1. **Standalone:** User says "mine reflections" or "check reflections"
2. **As Thread 3 in the main Upgrade workflow:** Runs in parallel with external source collection, adding an internal perspective to upgrade recommendations
