---
name: CodeReview
description: "Non-security code-surface critique across four parallel lenses (structure, handlers, tests, schema DTOs), synthesized into a prioritized action list — read-only."
status: STABLE
bestPath:
  - title: "Read"
    description: "PM scopes the file/module/package and drafts reviewer ISCs, one per critique axis."
  - title: "Review"
    description: "Architect, Backend, QA, and Schema review in parallel, each owning a distinct critique axis."
  - title: "Synthesize"
    description: "SM consolidates the four streams into a prioritized critique list with recommended follow-on workflow routing."
---

# CodeReview Workflow

Critique a code surface (file / module / package). Non-security focus — for security, use `SecurityAudit`. Sibling to `MakerkitTeam/Workflows/CodeReview.md`.

## When to Use

- Trigger phrases: "code review for starter", "review this code in starter", "critique surface in starter" (non-security).
- Fits when you want a read-only, multi-axis critique of an existing code surface without writing any fixes.
- NOT for a security-focused critique — use `SecurityAudit` instead.

## Pre-flight

1. Voice notify: `bash "$DOS_DIR/DOS/Tools/voice.sh" main "Running CodeReview workflow in fastapi-starter-team skill to critique code"`
2. Confirm scope: file / module / package paths to review.

## Phase 1 — Read (PM solo)

**Agent:** `pm`
**Brief:** scope paths + review goals
**Outputs:** PRD with reviewer ISCs (one per axis: clarity, async discipline, type coverage, test coverage, schema discipline, etc.)

## Phase 2 — Review (parallel: Architect + Backend + QA + Schema)

**Agents:** `architect`, `backend`, `qa`, `schema`

**Team spawn:** `TeamCreate({ team_name: "fst-codereview-<slug>", ... })`.

**Pre-Delegation Contract:**
- Architect owns: structural critique — package placement, async boundary discipline, dependency flow, FastCRUD vs custom service trade-off
- Backend owns: handler critique — `Depends` chains, response_model selection, error envelope (RFC 9457), rate-limit attachment
- QA owns: test critique — Test Pyramid Plan completeness against `_test-pyramid-gate.md`, fixture quality, async-test discipline
- Schema owns: DTO critique — Read/Create/Update/Internal ladder, validator quality, ConfigDict(from_attributes=True) wiring, response_model accuracy

### MCP Touchpoints

- **`mcp__dos_fastapi__run_checks`** — orchestrator runs at start of Phase 2; surface result to all reviewers
- **`mcp__dos_fastapi__list_routes`** — Backend + Architect
- **`mcp__dos_fastapi__alembic_check`** — Architect rules in/out drift hypothesis

## Phase 3 — Synthesize (SM solo)

**Agent:** `sm`
**Brief:** PRD with all four streams' critiques
**Outputs:** prioritized critique list (by axis), recommended actions (with workflow routing — QuickFix / BugFix / Refactor / DeliverFeature), red flags for operator attention.

**Read-only — no code writes.** PRD `phase: complete`. Operator decides whether to act.
