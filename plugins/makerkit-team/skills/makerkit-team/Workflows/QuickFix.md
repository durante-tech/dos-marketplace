---
name: QuickFix
description: Compressed 3-agent lane for surgical 1-2 file bug fixes and trivial changes, with a mandatory regression test and a single operator gate, budgeted to 15 minutes.
status: STABLE
bestPath:
  - title: "Pre-flight & Auto-classify"
    description: "Run the capability probe and auto-classify the single fix-agent plus QA (and E2E if user-facing)."
  - title: "Implement"
    description: "The auto-picked agent applies the surgical fix, citing the exact file:line."
  - title: "Verify"
    description: "QA confirms the fix and adds one regression test, escalating to BugFix if the test would blow the time budget."
  - title: "E2E (conditional)"
    description: "E2E adds or updates a Playwright spec when the fix is user-facing; skipped for non-user-facing changes."
divergence_from_canonical:
  _intent-to-flag-table.md:
    partial_version: 1.0.0
    reason: "Fixed-subcommand / native-tool invocations - no intent-variant flags exist to map; the section deliberately documents the fixed invocation table instead of the canonical Mode Selection shape"
    rationale_link: null
  _workflow-output-shape.md:
    partial_version: 1.0.0
    reason: "MakerkitTeam workflows have bespoke per-pipeline Output sections (artifact paths + redline reports); canonical shape doesn't fit"
---

# QuickFix Workflow

<!-- partial: _workflow-voice.md skill_name=MakerkitTeam workflow_name=QuickFix action_phrase=" to apply surgical fix" -->

Compressed lane for small bug fixes and trivial changes. 3 agents only.

## When to Use

- Bug fix in 1-2 files, no logic change
- Typo, env var add, config tweak
- Surgical correction — smallest possible change, no scope creep

## When NOT to Use

- New feature (use DeliverFeature)
- Schema change (use DeliverFeature)
- Anything touching ≥3 files (use DeliverFeature)
- Anything touching auth, billing, RBAC, or policies (use DeliverFeature with Security in the loop)

## Pipeline

### Phase 0 — Pre-flight
1. Capability probe (per `Workflows/_algorithm-team-spawn.md` Phase 0): `bun ~/.claude/skills/makerkit-team/Tools/MakerkitCli.ts preflight` — capability manifest + roster health; exit 1 = STOP and remediate
2. Read user request
3. **Auto-classify** (no confirmation): single fix-agent + QA + (E2E if user-facing). Operator override only at the implementer-pick step below.

### Phase 1 — Implement (1 agent solo)

Auto-pick based on file location (operator may override before spawn):
- File under `apps/web/app/**/_components/` or `**/page.tsx` → `frontend`
- File under `_lib/actions/`, `_lib/schemas/`, or `packages/**/src/` → `backend`
- File under `packages/database/` → `database`
- File under `apps/e2e/` → `e2e`
- Doc file → `writer`

**Brief:** describe the bug, cite the exact file:line, state the surgical change required. For any Next.js-surface fix, read the relevant doc under `apps/web/node_modules/next/dist/docs/` BEFORE coding (kit AGENTS.md — training data is outdated; the shipped docs are the source of truth).

### Phase 2 — Verify (QA — always-add-test, per `Workflows/_test-pyramid-gate.md`)

**Agent:** `qa`
**Brief:** confirm the fix addresses the bug without regression AND add ONE regression test. Layer chosen by fix shape:
- Logic / validator / pure function fix → write a Vitest test in `__tests__/<name>.test.ts` adjacent to the fix; run via `pnpm --filter @kit/<pkg> test:unit` and confirm GREEN.
- User-facing fix (button, form, page, flow) → defer the regression test to Phase 3 (E2E owns it).
- Documentation / config-only fix with no behavior change is the ONLY exception — log the exception in the delivery summary.

ISCs:
- "fix applied at file:line, behavior corrected, no regression in surrounding tests"
- "regression test added at `<path>`, green on post-fix code, FAILS on pre-fix code (verified by reverting + re-running)"

**Budget escalation rule:** if authoring the regression test would push past QuickFix's 15-minute budget (e.g., requires fixture setup, mock scaffolding, multi-file test changes), the operator promotes QuickFix → BugFix and the work continues under BugFix's failing-test-first discipline. The budget bend is the trigger; the regression-test obligation does NOT bend.

### Phase 3 — E2E (conditional)

**Skip when:** fix is non-user-facing (doc, internal config, refactor).
**Agent:** `e2e`
**Brief:** add or update one Playwright spec at `apps/e2e/tests/<feature>/<feature>.spec.ts` to cover the bug. Use bootstrap helpers for auth setup; add `data-testid` (kebab-case) if a new interactive element was introduced. Run via `pnpm --filter web-e2e exec playwright test <feature> --workers=1` and confirm GREEN.

## Algorithm Note (v0.5.0)

QuickFix is **solo-by-design** — rung L3 of the `Workflows/_algorithm-team-spawn.md` degradation ladder, escape clause "≤3 files AND ≤6 ISCs". No fan-out ceremony — every phase has at most one agent. Each phase spawn is a direct `Agent` call; the orchestrator (you) coordinates serially.

## Commit (per `Workflows/_commit-merge.md`)

Single concise commit per the partial. Subject: `fix(<scope>): <terse ≤72>` (kit AGENTS.md concision rule). Subject alone is fine for one-file fixes; HEREDOC body for multi-file. Always include the regression test in the same commit when feasible. `Co-Authored-By: DuranteOS <tech@duranteos.com>` trailer. Stage modified files explicitly (never `-A`).

## Intent-to-Flag Mapping

QuickFix's only CLI invocation is fixed by design — the Phase-0 capability probe; fix scope is auto-classified, so no operator phrasing selects flags.

| Command | Input Contract | When It Fires |
|---------|-----------------|----------------|
| `bun ~/.claude/skills/makerkit-team/Tools/MakerkitCli.ts preflight` | flags: `[--kit-repo <p>] [--roster <p>] [--skills-dir <p>] [--doctrine <p>]` (no stdin) | Phase 0 step 1 — capability manifest + roster health; exit 1 = STOP and remediate |

## Operator Gates (v0.1.0)

Single gate: **G-fix** after the fix is applied + QA verifies. At G-fix the orchestrator also runs the kit's adversarial reviewer — `Skill("reviewer")` — on the diff. E2E (Phase 3) runs automatically if scope is user-facing. Total time budget: ≤15 minutes.

**Failed QA verification routes back to the same implementer with surgical-fix constraint** (mirrors DeliverFeature G6 policy). After 3 consecutive failures (tracked in `MEMORY/WORK/{slug}/strike-ledger.json` per DeliverFeature's strike-ledger contract), escalate to operator.

## Artifact Tracking

Logs `delivery_summary` only — no PRD ceremony for quick fixes (trivial-mechanical-change profile per the doctrine resolved via `~/.claude/DOS/Algorithm/LATEST`).
