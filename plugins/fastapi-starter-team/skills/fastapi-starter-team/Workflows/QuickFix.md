---
name: QuickFix
description: "Surgical ≤2-file fix with no design phase — single implementer fixes and tests, QA validates, escalates to BugFix if scope grows."
status: STABLE
bestPath:
  - title: "Diagnose + Fix"
    description: "A single agent (Backend or Agent Engineer, by file ownership) produces a ≤2-file surgical diff with a regression test."
  - title: "Validate"
    description: "QA confirms the regression test asserts expected behavior and no surrounding tests broke."
  - title: "Wrap"
    description: "Mark the PRD complete — no Scrum Master phase."
---

# QuickFix Workflow

Surgical ≤2-file fix. No design phase, no full team. Backend OR Agent owns; QA validates.

**Sibling:** `MakerkitTeam/Workflows/QuickFix.md`. Same shape; FastAPI flavor below.

## When to Use

- Trigger phrases: "quick fix in starter", "patch in starter", "tiny fix in starter" (≤2 files, surgical).
- Fits when the fix is surgical — known cause, ≤2 files, no schema/auth/rate-limit/new-dependency involvement.
- NOT for multi-file or unclear-root-cause fixes — use `BugFix` instead.

## Pre-flight

1. Voice notify: `bash "$DOS_DIR/DOS/Tools/voice.sh" main "Running QuickFix workflow in fastapi-starter-team skill to apply surgical fix"`
2. Confirm scope: ≤2 files, no schema change, no auth/rate-limit boundary touched, no new env var, no new dep. If any condition fails → suggest `BugFix` workflow.
3. Auto-route ownership:
   - Touches `src/app/agents/**` → `agent`
   - Otherwise → `backend`

## Phase 1 — Diagnose + Fix (single agent solo)

**Agent:** `agent` OR `backend` (by file ownership)
**Brief:** description of bug, expected behavior, file paths.
**Required outputs:**
- ≤2-file surgical diff
- 1 unit test (or 1 integration test) covering the regression
- Run `uv run pytest tests/unit -x` (or `tests/integration -x` for integration scope)
- Commit per `_commit-merge.md` HEREDOC format

### MCP Touchpoints

- **`mcp__dos_fastapi__run_checks`** — MUST run after fix; ruff + mypy + pytest must be green

## Phase 2 — Validate (QA solo)

**Agent:** `qa`
**Brief:** PRD path, the fix's test path
**Required outputs:** confirm regression test asserts expected behavior; confirm no surrounding tests broken.

**Gate (G-quickfix):** all six pyramid checks pass per `_test-pyramid-gate.md`.

**ISC-failure remediation:** route back to original agent (agent or backend, by ownership). After 3 consecutive failures, escalate to operator OR convert to BugFix workflow.

## Phase 3 — Wrap

Update PRD frontmatter `phase: complete` and `progress: N/N`. No SM phase.

## Anti-criteria

- ✗ Touches more than 2 files → escalate to BugFix
- ✗ Adds a new dependency → escalate to BugFix or DeliverFeature
- ✗ Touches auth, rate-limit, or migrations → escalate to BugFix or DeliverFeature
- ✗ Skips test → never; the regression test is the QuickFix's hill-climb
- ✗ Skips `_commit-merge.md` discipline → Conventional Commits + Co-Authored-By trailer always

## Solo execution

QuickFix is solo by design. Escape clause from `_algorithm-team-spawn.md`: "≤3 files AND ≤6 ISCs".
