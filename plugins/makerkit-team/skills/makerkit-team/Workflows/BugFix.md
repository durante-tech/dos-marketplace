---
name: BugFix
description: Diagnose-then-fix pipeline for bugs too big for QuickFix — an Architect root-cause diagnosis phase precedes a surgical fix, verified with failing-test-first QA/E2E and closed out with a postmortem.
status: STABLE
bestPath:
  - title: "Pre-flight & Scope"
    description: "Run the capability probe, auto-classify bug severity, and confirm repro steps and ISCs with the PM."
  - title: "Diagnose"
    description: "Architect performs root-cause analysis and records diagnosis, blast radius, and recommended fix shape."
  - title: "Fix"
    description: "The owning implementer applies a surgical fix, reviewed by /code-review and the kit's adversarial reviewer."
  - title: "Verify"
    description: "QA and E2E write failing tests first, confirm they fail pre-fix, then confirm green post-fix."
  - title: "Postmortem"
    description: "Scrum Master records a 5-question postmortem citing the regression-test path added to prevent recurrence."
divergence_from_canonical:
  _workflow-output-shape.md:
    partial_version: 1.0.0
    reason: "MakerkitTeam workflows have bespoke per-pipeline Output sections (artifact paths + redline reports); canonical shape doesn't fit"
---

# BugFix Workflow

<!-- partial: _workflow-voice.md skill_name=MakerkitTeam workflow_name=BugFix action_phrase=" to diagnose and fix" -->

Diagnose-then-fix for bugs too big for QuickFix. Multi-file, root-cause required, may touch sensitive surfaces.

**V13.3c PRD-scaffolding routing (RFC-0083 §5.5 split, Sprout pattern):** For vNext-format PRDs (`format_version: 3`), invoke `Skill("prd", "scaffold")` BEFORE the workflow's native PRD-creation step below. The Skill produces the vNext frontmatter + skeleton; the workflow then continues editing PRD sections directly. The legacy "create PRD stub" prose remains as fallback until v0.0.14 V14.6 retires it after a 30-day Sprout adoption soak.

## When to Use

- Bug touches ≥3 files OR root cause is unclear
- Bug in auth, billing, RBAC, multi-tenancy, or policies (anything QuickFix excludes)
- Customer-reported issue with unclear repro
- Regression — used to work, now doesn't, root cause unknown

## When NOT to Use

- 1-2 file surgical fix, root cause obvious → QuickFix
- New feature with bugs → DeliverFeature handles its own QA
- Need to understand surface first without fixing → ExploreFeature

## Pipeline

### Phase 0 — Pre-flight

1. Capability probe (per `Workflows/_algorithm-team-spawn.md` Phase 0): `bun ~/.claude/skills/makerkit-team/Tools/MakerkitCli.ts preflight` — capability manifest + roster health; exit 1 = STOP and remediate
2. Operator provides: bug report (symptom, expected vs actual, repro steps if known)
3. **Auto-classify severity:** P0 (production breaking) / P1 (user-facing degradation) / P2 (edge case)
4. Create PRD stub at `MEMORY/WORK/{slug}/PRD.md` — bug fixes get a PRD because they often produce hidden ISCs (regressions to prevent)

### MCP Touchpoints (Phase 0)

- **`mcp__makerkit__kit_dev_status`** — confirm dev server status before attempting repro; if down, **`mcp__makerkit__kit_dev_start`** to bring it up (record this in PRD so a kit_dev_stop can be paired in cleanup if Bug Fix orchestrator started it)
- **`mcp__makerkit__kit_db_status`** — DB-touching bugs need a healthy DB before repro
- **`mcp__makerkit__kit_emails_list`** — for auth/billing-flow bugs that emit email — does the expected email exist in mailpit?

### Phase 1 — Repro & Scope (PM)

**Agent:** `pm`
**Brief:** confirm repro steps, scope the affected surfaces, list ISCs that capture the desired post-fix behavior plus regression-prevention criteria
**Output:** PRD `## Context` (bug summary + repro), `## Criteria` (atomic ISCs)

**Operator gate G1-bug:** approve scope + ISCs before diagnosis

### Phase 2 — Diagnose (Architect solo)

**Agent:** `architect`
**Brief:** root-cause analysis. Read code from PRD's named files. Output a `### Diagnosis` subsection in PRD `## Decisions` with:
- Root cause (file:line)
- Why it manifests as the reported symptom
- Why prior tests didn't catch it
- Recommended fix location and shape (NOT the implementation — that's the next phase)
- Blast radius: what else could break if we touch this

**Cross-skill:** SHOULD invoke `Skill("sentinel", "convention scan on suspect surface")` and `Skill("thinking", "first principles on bug")` if root cause is non-obvious

**Operator gate G2-bug:** approve diagnosis. Operator may request alternative root cause investigation here.

### Phase 3 — Fix (1 agent solo, by ownership)

**Agent picked by Architect's diagnosis:**
- Code under `apps/web/app/**/_components/` or `**/page.tsx` → `frontend`
- Code under `_lib/actions/`, `_lib/schemas/`, or `packages/**/src/` → `backend`
- `packages/database/` → `database`
- `apps/e2e/` → `e2e` (test bug)

**Brief:** apply the fix per Architect's diagnosis. Surgical only — no scope creep. Cite the fix file:line in the response. For any Next.js-surface fix, read the relevant doc under `apps/web/node_modules/next/dist/docs/` BEFORE coding (kit AGENTS.md — the shipped docs are the source of truth).

**After fix returns:** orchestrator runs `Skill("code-review", "high")` AND the kit's adversarial reviewer `Skill("reviewer")` on the diff (mandatory per the doctrine resolved via `~/.claude/DOS/Algorithm/LATEST`, BUILD phase).

**Operator gate G3-bug:** approve code change before verification.

### Phase 4 — Verify (QA + E2E parallel — failing-test-first)

**Pre-Delegation Contract** (per `Workflows/_test-pyramid-gate.md`):
- QA owns: write a **failing Vitest test FIRST** that captures the bug at the unit layer (in `__tests__/<name>.test.ts` adjacent to the bug location). Confirm the test FAILS on pre-fix code (or on a temporarily-reverted version of the fix). After the implementer's fix lands, re-run via `pnpm --filter @kit/<pkg> test:unit` and confirm GREEN. Then re-run the original repro, identify regression risk, verify each ISC, and identify whether existing tests missed this and why.
- E2E owns: if the bug is flow-shaped (touches `apps/web/**/page.tsx`, `_components/`, or a server action with user-visible state), write a **failing Playwright spec FIRST** at `apps/e2e/tests/<feature>/<feature>.spec.ts` (with paired `<feature>.po.ts`). Use bootstrap helpers for auth setup. Confirm the spec FAILS on pre-fix code. After the fix lands, re-run via `pnpm --filter web-e2e exec playwright test <feature> --workers=1` and confirm GREEN. Report PASS/FAIL with traces for failures.

**Team spawn (per `Workflows/_algorithm-team-spawn.md` degradation ladder):** default rung L2 Agent fan-out. Single message, two parallel `Agent` calls — one per role (`qa`, `e2e`); each `subagent_type: "general-purpose"`, `name: <role-id>`, `model: "sonnet"`, `run_in_background: true`, prompt composed per the partial template + Pre-Delegation Contract slice. L1 team choreography ONLY if the Phase 0 capability manifest confirms team primitives. Rendezvous: structured returns or report files at `MEMORY/WORK/{slug}/reports/<role>.md`; cross-check claims per Algorithm §6.6; mark ISCs `[ ]→[x]` in PRD; run G4-bug gate.

### MCP Touchpoints (Phase 4)

- **`mcp__makerkit__run_checks`** — QA MUST invoke before declaring fix verified; attach output to PRD `## Verification`. A typecheck/lint/format error introduced by the fix invalidates verification. If mcp__makerkit__run_checks is unavailable (server not connected — check the capability manifest from `bun Tools/MakerkitCli.ts preflight`), fall back to the read-only ladder `pnpm lint && pnpm typecheck && pnpm test:unit`. NEVER run `pnpm healthcheck` in review/read-only contexts — it mutates files.
- **`mcp__makerkit__kit_emails_list`** + **`mcp__makerkit__kit_emails_read`** — E2E uses these for mailpit assertion (replaces the older HTTP-fetch pattern)
- **`mcp__makerkit__kit_emails_set_read_status`** — E2E marks the asserted email as read so the next test run starts from a clean inbox

**Operator gate G4-bug:** all ISCs PASS. **Failures route to original implementer** (per v0.1.0 ISC-failure policy) with 3-strike escalation, tracked in `MEMORY/WORK/{slug}/strike-ledger.json` per DeliverFeature's strike-ledger contract.

### Commit (per `Workflows/_commit-merge.md`)

After G4-bug pass, commit the fix. Subject: `fix(<scope>): <concise ≤72>` (Conventional Commits per kit AGENTS.md concision rule). HEREDOC body: bullets describing root cause + fix location + regression test path (Vitest path if unit-layer, Playwright path if flow). Trailer: `Co-Authored-By: DuranteOS <tech@duranteos.com>`. Stage explicitly (never `-A`). Pre-commit hook failure → fix and create a NEW commit (no `--amend`).

### Phase 5 — Postmortem (Scrum Master)

**Agent:** `sm`
**Brief:** read PRD, write a 5-question postmortem:
1. What was the bug?
2. Why did it happen?
3. Why did existing tests miss it?
4. What test was added to prevent recurrence? **Cite the path** — at minimum a Vitest test if the bug was unit-layer; a Playwright spec if the bug was flow-shaped; both if cross-cutting. Per `Workflows/_test-pyramid-gate.md`, recurrence-prevention without a test artifact is incomplete.
5. What pattern, if any, should the team adopt to catch this class of bug earlier?

Append to PRD `## Verification → ### Postmortem`.

## Operator Gates Summary

G1-bug (scope) · G2-bug (diagnosis) · G3-bug (fix) · G4-bug (verification)

## Output

PRD at `MEMORY/WORK/{slug}/PRD.md` with full diagnosis + postmortem. Artifact log: type `bugfix_prd`.

## Failure Modes

| Failure | Remediation |
|---|---|
| Architect's diagnosis is wrong (Phase 4 ISCs fail despite "fix") | Re-spawn Architect with failure context. After 2 wrong diagnoses → operator escalation |
| Fix introduces regression in unrelated area | Revert, re-spawn Architect for blast-radius re-analysis |
| Repro is flaky (sometimes passes) | E2E adds polling assertion + investigates timing dependency before declaring fixed |
