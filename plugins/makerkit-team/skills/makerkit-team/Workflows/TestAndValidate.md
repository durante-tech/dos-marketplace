---
name: TestAndValidate
description: Parallel QA/E2E test run against a scope plus a Tech Writer doc-drift check against live code, synthesized into a per-item HEALTHY/DEGRADED/BROKEN verdict for operator triage into BugFix or DocsRefresh.
status: STABLE
bestPath:
  - title: "Pre-flight & Resolve Docs"
    description: "Run the capability probe and auto-resolve the doc paths matching the operator-provided scope."
  - title: "Test"
    description: "QA runs unit tests and E2E runs relevant Playwright specs in parallel, reporting pass/fail with failure context."
  - title: "Validate"
    description: "Tech Writer checks each doc claim against current code and reports drift by severity."
  - title: "Synthesis"
    description: "Orchestrator merges test results and drift findings into a combined HEALTHY/DEGRADED/BROKEN verdict per scope item."
  - title: "Triage"
    description: "Operator routes non-HEALTHY items to BugFix, DocsRefresh, or both in sequence."
divergence_from_canonical:
  _intent-to-flag-table.md:
    partial_version: 1.0.0
    reason: "Fixed-subcommand / native-tool invocations - no intent-variant flags exist to map; the section deliberately documents the fixed invocation table instead of the canonical Mode Selection shape"
    rationale_link: null
  _workflow-output-shape.md:
    partial_version: 1.0.0
    reason: "MakerkitTeam workflows have bespoke per-pipeline Output sections (artifact paths + redline reports); canonical shape doesn't fit"
---

# TestAndValidate Workflow

<!-- partial: _workflow-voice.md skill_name=MakerkitTeam workflow_name=TestAndValidate action_phrase=" to test and check drift" -->

Run tests for a scope + check feature behavior against documentation. Flags both code regressions and doc drift.

## When to Use

- Pre-release smoke check on a feature surface
- Periodic validation that feature X still matches its docs
- After a dependency upgrade — does anything silently broke?
- Operator suspects code drifted from documented behavior

## When NOT to Use

- Already know what's broken → BugFix
- Want a critique not a verdict → CodeReview
- Just need docs updated → DocsRefresh

## Pipeline

### Phase 0 — Pre-flight

1. Preflight: `bun Tools/MakerkitCli.ts preflight` — emit the capability manifest for this run (repo, roster health, scripts, doctrine). Exit 1 = unresolvable repo or invalid roster: STOP and remediate before proceeding.
2. Operator provides: scope (feature name, package, route, or "the whole auth surface")
3. **Auto-resolve doc paths** for the scope:
   - Map `auth/sign-in` → `docs/authentication/sign-in.mdoc` + `apps/web/content/documentation/authentication/`
   - Map `billing` → `docs/billing/*.mdoc`
   - Etc. per `FrameworkDigest.md` §12

### Phase 1 — Test (parallel: QA + E2E)

**Pre-Delegation Contract:**
- QA owns: run unit tests for affected packages (`pnpm --filter <pkg> test:unit`), report PASS/FAIL with failure context, identify coverage gaps
- E2E owns: run relevant Playwright specs (`pnpm --filter web-e2e exec playwright test <scope> --workers=1`), report PASS/FAIL with traces for failures

**Cross-skill:**
- E2E patterns are owned by the team's `e2e` role (`technical-specialist-contrarian-investig` composition — Playwright spec authoring, page-object models, mailpit assertions, flake mitigation), which composes `Skill("playwright-e2e-expert")` per `_skill-composition.md`.

### MCP Touchpoints (Phase 1)

- **`mcp__makerkit__run_checks`** — QA MUST invoke at start of phase; surfaces typecheck/lint/format failures BEFORE the unit test run. Failures here are auto-categorized as BROKEN. If `mcp__makerkit__run_checks` is unavailable (server not connected — check the capability manifest from `bun Tools/MakerkitCli.ts preflight`), fall back to the read-only ladder `pnpm lint && pnpm typecheck && pnpm test:unit`. NEVER run `pnpm healthcheck` in review/read-only contexts — it mutates files.
- **`mcp__makerkit__kit_db_status`** — verify DB is up before any unit test that touches Prisma; surface DOWN state as a phase-failure with explicit "start DB then re-run" guidance.
- **`mcp__makerkit__kit_dev_status`** — E2E needs the dev server up; auto-`kit_dev_start` if not running (and pair with `kit_dev_stop` in cleanup)
- **`mcp__makerkit__kit_mailbox_status`** — E2E confirms mailpit is up before any spec that asserts on email
- **`mcp__makerkit__kit_emails_list`** + **`mcp__makerkit__kit_emails_read`** — E2E uses these for mailpit assertions in spec runs

### Skill Composition (Phase 1, per `Workflows/_skill-composition.md`)

- E2E → `Skill("playwright-e2e-expert")` for spec review and flake diagnosis on the in-scope Playwright specs; spec execution stays on the canonical `pnpm --filter web-e2e exec playwright test <scope> --workers=1` path, with the run summary captured into the report bundle alongside the raw Playwright output. Cost guard: ONE feature scope at a time. Failure → the canonical Playwright path is unaffected; the validation report flags `e2e-skill-unavailable`.

### Phase 2 — Validate (Tech Writer solo)

**Agent:** `writer`
**Brief:**
- Read the doc files for the scope
- Read the underlying code paths the doc claims to describe
- For each doc claim, verify against current code:
  - Method exists at named path? ✓ or drift
  - Env var documented matches code reference? ✓ or drift
  - Behavior described matches actual flow? ✓ or drift (cite file:line)
- Output: drift report with severity (BREAKING / MISLEADING / MINOR / NONE)

### MCP Touchpoints (Phase 2)

- **`mcp__makerkit__kit_translations_stats`** — Writer surfaces missing-key drift across locales. Coverage drop since last validation = MINOR or higher drift finding.
- **`mcp__makerkit__kit_translations_list`** — enumerate keys for the scope's namespace; cross-reference against doc claims about i18n
- **`mcp__makerkit__kit_env_schema`** — verify documented env vars match the actual schema (every doc claim about an env var is checkable)

### Phase 3 — Synthesis (orchestrator)

Merge into a validation report:
- Test results: pass/fail counts, failures by file:line
- Drift findings: doc vs code mismatches by severity
- Combined verdict per scope item: HEALTHY / DEGRADED / BROKEN

### Phase 4 — Triage (operator)

For each non-HEALTHY item, operator picks:
- Test failure → BugFix workflow with this report as input
- Doc drift → DocsRefresh workflow
- Both → BugFix first, then DocsRefresh after fix lands

## Intent-to-Flag Mapping

TestAndValidate's only bun-CLI invocation is fixed by design — Phase 0 always runs the same capability probe; the phase's test/E2E commands are `pnpm`/Playwright invocations owned by the kit, not this pack's CLI.

| Command | Input Contract | When It Fires |
|---------|-----------------|----------------|
| `bun Tools/MakerkitCli.ts preflight` | flags: `[--kit-repo <p>] [--roster <p>] [--skills-dir <p>] [--doctrine <p>]` (no stdin) | Phase 0 step 1 — capability manifest gate before scope resolution; exit 1 STOPs the run. Re-cited in Phase 1's `mcp__makerkit__run_checks` fallback note as a pointer to this same manifest, not a second invocation. |

## Operator Gates (v0.1.0)

- **G-validate:** approve the synthesis report before triage. No agents make code changes in this workflow.

## Output

`MEMORY/ARTIFACTS/test-validate-<slug>-<date>.md` with test results + drift report + triage. Logged as type `test_validation_report`.

## Constraint

**Read-only on source code.** Tests run, results read, docs read — but no Edit/Write to source files. Fixes go to BugFix or DocsRefresh as separate workflows.
