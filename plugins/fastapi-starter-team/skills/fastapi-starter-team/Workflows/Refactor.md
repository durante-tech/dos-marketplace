---
name: Refactor
description: "Behavior-preserving restructuring with an invariant catalogue and per-step commits, verified against characterization tests and the full test suite."
status: STABLE
bestPath:
  - title: "Plan"
    description: "Architect drafts the refactor sequence, an invariant catalogue, and a test-gap analysis."
  - title: "Test First"
    description: "QA adds characterization tests for any invariant gaps found in Plan, run against the pre-refactor code (conditional — skipped if no gaps)."
  - title: "Refactor"
    description: "The routed implementer lands one commit per refactor step, reverting on red."
  - title: "Verify"
    description: "QA and E2E run in parallel to confirm the full suite and route surface are unchanged."
---

# Refactor Workflow

Behavior-preserving improvement. No new functionality. Sibling to `MakerkitTeam/Workflows/Refactor.md`.

## When to Use

- Trigger phrases: "refactor in starter", "restructure in starter", "extract in starter", "tidy first in starter", "behavior-preserving change in starter".
- Fits when you want to restructure code while preserving exact existing behavior.
- NOT for changes that introduce new behavior — escalate to `DeliverFeature` instead.

## Pre-flight

1. Voice notify: `bash "$DOS_DIR/DOS/Tools/voice.sh" main "Running Refactor workflow in fastapi-starter-team skill to restructure code"`
2. Confirm scope: behavior preserved exactly. If new behavior introduced → escalate to DeliverFeature.

## Phase 1 — Plan (Architect solo)

**Agent:** `architect`
**Brief:** refactor goal (extract / inline / rename / move / structural change), acceptance criteria
**Required outputs:**
- PRD with the refactor sequence (one step per future commit)
- Invariant catalogue: pure functions, type signatures, return shapes, side effects — what MUST be preserved
- Test gap analysis: which invariants lack characterization tests

**Solo escape clause:** "narrative coherence required — single-author plan".

### MCP Touchpoints

- **`mcp__dos_fastapi__list_routes`** — Architect verifies route surface unchanged is achievable
- **`mcp__dos_fastapi__run_checks`** — baseline green confirmed before any edit

## Phase 2 — Test First (QA solo, conditional)

**Agent:** `qa`
**Trigger:** Phase 1 invariant catalogue identified gaps in characterization coverage
**Required outputs:** pytest unit tests in `tests/unit/test_<module>.py` for every uncovered invariant. Tests pass against the CURRENT (pre-refactor) code.
**Solo escape clause:** "single-file work".

If no gaps → skip Phase 2.

## Phase 3 — Refactor (1 implementer solo, per-step commits)

**Agent:** routed by code ownership:
- Pydantic AI agent code → `agent`
- Models / migrations → `database`
- Otherwise → `backend`

**Required outputs:** one commit per refactor step per `_commit-merge.md` Per-Step Commits section. After each step, run scoped tests. If red, `git revert HEAD --no-edit` and report.

**Solo escape clause:** "single-file work — surgical refactor".

### MCP Touchpoints (Phase 3)

- **`mcp__dos_fastapi__run_checks`** — green required after every step

## Phase 4 — Verify (parallel: QA + E2E)

**Agents:** `qa`, `e2e`

**Team spawn (per `_algorithm-team-spawn.md`):** `TeamCreate({ team_name: "fst-refactor-phase4-<slug>", ... })`.

**Pre-Delegation Contract:**
- QA owns: full unit suite green; characterization tests from Phase 2 still green; no new test added that mocks behavior the refactor changed
- E2E owns: full integration suite green; route surface unchanged (verify via `mcp__dos_fastapi__list_routes` before/after diff is empty)

**Gate:** all six ships-with-tests checks green per `_test-pyramid-gate.md`. Failure → revert the offending step from Phase 3 (per `_commit-merge.md`); re-plan.

## Anti-criteria

- ✗ Behavior changed — refactor introduces or removes user-visible side effects
- ✗ Per-step commits squashed without explicit operator request — preserved by default
- ✗ Test changed to make refactor pass — invariant violation; the test was the spec

Update PRD frontmatter `phase: complete`, `progress: N/N`.
