---
name: BugFix
description: "Multi-file, root-cause-first bug diagnosis and fix — Architect diagnoses before a single implementer patches, then QA+E2E verify and SM postmortems."
status: STABLE
bestPath:
  - title: "Scope"
    description: "PM captures the bug report, reproduction steps, and hypothesis ISCs in a PRD."
  - title: "Diagnose"
    description: "Architect confirms reproduction, root-causes the failure, and routes the fix to an implementer by code ownership."
  - title: "Fix"
    description: "The routed implementer produces a surgical diff with regression tests."
  - title: "Verify"
    description: "QA and E2E run in parallel to confirm all ships-with-tests checks are green."
  - title: "Postmortem"
    description: "SM appends a short postmortem identifying a preventive guard for the bug class."
---

# BugFix Workflow

Multi-file diagnose-and-fix for unclear root cause OR scope spanning ≥3 files. Sibling to `MakerkitTeam/Workflows/BugFix.md`.

## When to Use

- Trigger phrases: "bug fix in starter", "fix bug in starter", "diagnose and fix in starter" (multi-file or unclear root cause).
- Fits when the failure spans 3+ files, or the root cause isn't yet known and needs Architect-level diagnosis before a fix is attempted.
- NOT for a ≤2-file surgical fix with a known cause — use `QuickFix` instead.

## Pre-flight

1. Voice notify: `bash "$DOS_DIR/DOS/Tools/voice.sh" main "Running BugFix workflow in fastapi-starter-team skill to diagnose and fix"`
2. If reported scope is ≤2 files surgical → suggest `QuickFix` instead.

## Phase 1 — Scope (PM solo)

**Agent:** `pm`
**Brief:** bug report, reproduction steps if known
**Outputs:** PRD with reproduction ISC, expected-vs-actual ISC, hypothesis ISCs, anti-criteria

## Phase 2 — Diagnose (Architect solo)

**Agent:** `architect`
**Brief:** PRD, framework digest §1-2 + relevant subsystem section
**Required outputs:** root-cause analysis, reproduction confirmed, fix shape sketch, decision: 1-implementer (Agent or Backend or Database) by code ownership.

**Solo escape clause:** "narrative coherence required — single-author root-cause analysis".

### MCP Touchpoints

- **`mcp__dos_fastapi__list_routes`** — Architect verifies the failing endpoint exists
- **`mcp__dos_fastapi__alembic_check`** — Architect rules in/out schema-drift hypothesis
- **`mcp__dos_fastapi__run_checks`** — confirm reproduction reproduces under standard checks

## Phase 3 — Fix (1 implementer solo)

**Agent:** routed by code ownership (Architect's call from Phase 2):
- Pydantic AI agent surface → `agent`
- Migrations or model definitions → `database`
- Otherwise → `backend`

**Brief:** PRD, root-cause analysis, fix shape from Phase 2.
**Required outputs:** surgical diff, regression tests (unit + integration as appropriate per `_test-pyramid-gate.md`), commit per `_commit-merge.md`.

**Solo escape clause:** "single-file work — surgical single-implementer".

## Phase 4 — Verify (QA + E2E parallel)

**Agents:** `qa`, `e2e`

**Team spawn (per `_algorithm-team-spawn.md`):** `TeamCreate({ team_name: "fst-bugfix-phase4-<slug>", description: "2-stream parallel verify", agent_type: "team-lead" })`.

**Pre-Delegation Contract:**
- QA owns: regression unit test green, surrounding unit suite still green
- E2E owns: regression integration test green, surrounding integration suite still green

**Gate:** all six ships-with-tests checks green per `_test-pyramid-gate.md`. Failure routes back to Phase 3 implementer with surgical-fix constraint. After 3 strikes → escalate to operator.

### MCP Touchpoints (Phase 4)

- **`mcp__dos_fastapi__run_checks`** — final green check

## Phase 5 — Postmortem (SM solo)

**Agent:** `sm`
**Brief:** PRD with all phases, root-cause analysis, fix
**Outputs:** ≤200-word postmortem appended to PRD `## Decisions → ### Postmortem`. Identifies preventive guard (test, lint rule, monitoring alert) for the bug class.

**Solo escape clause:** "synthesis solo — single-file work".

Update PRD frontmatter `phase: complete`, `progress: N/N`.
