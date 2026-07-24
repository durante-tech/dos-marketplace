---
name: Refactor
description: Behavior-preserving restructuring pipeline — Architect plan, pre-refactor test coverage, per-step commits, and a before/after run_checks parity check that treats any post-refactor behavioral diff as broken, not improved.
status: STABLE
bestPath:
  - title: "Pre-flight & Plan"
    description: "Run the capability probe and have the Architect name the refactoring, plan mechanical steps, and identify invariant ISCs."
  - title: "Test-First Coverage"
    description: "QA adds tests for any invariant lacking coverage, confirmed green on pre-refactor code, before touching anything."
  - title: "Refactor"
    description: "The owning implementer applies the plan step-by-step with per-step commits, reverting on any red test."
  - title: "Verify"
    description: "QA and E2E confirm all invariant ISCs pass and run_checks output matches the pre-refactor snapshot exactly."
  - title: "Document"
    description: "Tech Writer updates any doc referencing renamed or moved symbols, when the refactor wasn't purely internal."
divergence_from_canonical:
  _intent-to-flag-table.md:
    partial_version: 1.0.0
    reason: "Fixed-subcommand / native-tool invocations - no intent-variant flags exist to map; the section deliberately documents the fixed invocation table instead of the canonical Mode Selection shape"
    rationale_link: null
  _workflow-output-shape.md:
    partial_version: 1.0.0
    reason: "MakerkitTeam workflows have bespoke per-pipeline Output sections (artifact paths + redline reports); canonical shape doesn't fit"
---

# Refactor Workflow

<!-- partial: _workflow-voice.md skill_name=MakerkitTeam workflow_name=Refactor action_phrase=" to improve without changing behavior" -->

Behavior-preserving improvement of existing code. Extract, rename, restructure, deduplicate. No feature change.

**V13.3c PRD-scaffolding routing (RFC-0083 §5.5 split, Sprout pattern):** For vNext-format PRDs (`format_version: 3`), invoke `Skill("prd", "scaffold")` BEFORE the workflow's native PRD-creation step below. The Skill produces the vNext frontmatter + skeleton; the workflow then continues editing PRD sections directly. The legacy "create PRD stub" prose remains as fallback until v0.0.14 V14.6 retires it after a 30-day Sprout adoption soak.

## When to Use

- CodeReview surfaced refactor-worthy findings
- Duplication detected across packages (e.g., `/code-review` flagged it)
- Naming/structure makes a future feature painful
- Pre-extension cleanup ("tidy first" — Kent Beck)

## When NOT to Use

- Adding behavior → DeliverFeature
- Fixing a bug → BugFix
- Want only critique → CodeReview

## Pipeline

### Phase 0 — Pre-flight

1. Capability probe (per `Workflows/_algorithm-team-spawn.md` Phase 0): `bun ~/.claude/skills/makerkit-team/Tools/MakerkitCli.ts preflight` — capability manifest + roster health; exit 1 = STOP and remediate
2. Operator provides: scope (files / package / "all duplicated form-validation helpers"), motivation (what future this enables)
3. **Auto-classify scope** — small (single file extraction) / medium (cross-file in same package) / large (cross-package)
4. Create PRD stub — refactors get a PRD because behavior-preservation must be verifiable

### Phase 1 — Plan (Architect solo)

**Agent:** `architect`
**Brief:**
- Scope: <operator-provided>
- Read the affected code, identify the refactoring catalog name (Extract Method, Move Class, Rename, Inline, Replace Conditional with Polymorphism, etc.)
- Define the refactor as a sequence of mechanical steps
- Identify behavioral invariants that MUST hold post-refactor (these become ISCs)
- Identify which existing tests cover the invariants (and call out which invariants have NO test coverage — those need new tests BEFORE refactor)

**Cross-skill:** SHOULD invoke `Skill("fowler", "name the refactoring")` for catalog matching, `Skill("kent-beck", "tidy first applicability")` for sequence guidance, `Skill("sandi-metz", "TRUE properties check")` for shape validation

**Output:** PRD `## Decisions → ### Refactor Plan` with the named refactoring + step sequence + invariant ISCs

**Operator gate G1-refactor:** approve plan + ISCs before any code touched

### Phase 2 — Test First (QA solo, conditional)

**Skip when:** Architect's plan confirmed all invariants already have test coverage.
**Agent:** `qa`
**Brief:** add tests covering the invariants that lack coverage, BEFORE the refactor begins. These new tests must pass on current (pre-refactor) code.

**Cross-skill:** SHOULD invoke `Skill("kent-beck", "characterization tests")` if working with poorly-tested code, `Skill("feathers", "WELC seam strategy")` if dependency-breaking is needed

### MCP Touchpoints (Phase 2)

- **`mcp__makerkit__run_checks`** — capture BEFORE-state output verbatim into PRD `## Decisions → ### Pre-Refactor Snapshot`. This is the invariant-baseline; Phase 4's run_checks MUST match this exactly (refactor preserves behavior including check passes/fails). If mcp__makerkit__run_checks is unavailable (server not connected — check the capability manifest from `bun Tools/MakerkitCli.ts preflight`), fall back to the read-only ladder `pnpm lint && pnpm typecheck && pnpm test:unit` (capture the same baseline from it). NEVER run `pnpm healthcheck` in review/read-only contexts — it mutates files.

**Operator gate G2-refactor:** confirm new tests added and passing on current code

### Phase 3 — Refactor (1 agent by code ownership)

**Agent picked by package:**
- `apps/web/**` frontend code → `frontend`
- `packages/**` backend/shared → `backend`
- `packages/database/**` → `database`

**Brief:**
- Apply the refactor steps in order from PRD `### Refactor Plan`
- After EACH step: run the test suite (or relevant subset). All tests MUST stay green.
- Make per-step commits per `Workflows/_commit-merge.md` — small + reversible. Format: `refactor(<scope>): <concise ≤72>` HEREDOC + `Co-Authored-By: DuranteOS <tech@duranteos.com>` trailer. If any step turns tests red, `git revert HEAD --no-edit` and report — do NOT chain another step on a red working tree.
- Do NOT add behavior. Do NOT change public API signatures unless plan explicitly calls for rename.
- For any Next.js-surface refactor (`apps/web/**`), read the relevant doc under `apps/web/node_modules/next/dist/docs/` BEFORE coding (kit AGENTS.md — the shipped docs are the source of truth).
- Cite files:lines changed in response.

**After refactor returns:** orchestrator runs `Skill("code-review", "high")` AND the kit's adversarial reviewer `Skill("reviewer")` on the diff (per the doctrine resolved via `~/.claude/DOS/Algorithm/LATEST`, BUILD phase).

### Phase 4 — Verify (parallel: QA + E2E — pyramid-explicit per `Workflows/_test-pyramid-gate.md`)

**Pre-Delegation Contract:**
- QA owns: run `pnpm --filter @kit/<pkg> test:unit` for every affected package, confirm all invariant ISCs pass, identify any test that needed updating (and explain why — refactoring should rarely require test changes). Capture output verbatim into PRD `## Verification → ### Unit-layer parity`.
- E2E owns: when the refactor touched user-facing code (`apps/web/**/page.tsx` / `_components/` / user-visible action signature), run `pnpm --filter web-e2e exec playwright test <feature> --workers=1` for affected surfaces. Confirm zero behavioral diff visible to users. Capture output into PRD `## Verification → ### E2E-layer parity`. Skip only when the refactor is purely internal (no user-visible code touched) — and log that determination in PRD.

**Team spawn (per `Workflows/_algorithm-team-spawn.md` degradation ladder):** default rung L2 Agent fan-out. Single message, two parallel `Agent` calls — one per role (`qa`, `e2e`); each `subagent_type: "general-purpose"`, `name: <role-id>`, `model: "sonnet"`, `run_in_background: true`, prompt composed per the partial template + Pre-Delegation Contract slice. L1 team choreography ONLY if the Phase 0 capability manifest confirms team primitives. Rendezvous: structured returns or report files at `MEMORY/WORK/{slug}/reports/<role>.md`; cross-check claims per Algorithm §6.6; mark ISCs `[ ]→[x]` in PRD; run G3-refactor gate.

### MCP Touchpoints (Phase 4)

- **`mcp__makerkit__run_checks`** — QA MUST invoke and compare output verbatim against the Pre-Refactor Snapshot from Phase 2. Any new failure (or fixed failure!) is a behavioral diff — refactor is BROKEN, not "improved". Attach the diff under `## Verification → ### run_checks parity check`. If mcp__makerkit__run_checks is unavailable (server not connected — check the capability manifest from `bun Tools/MakerkitCli.ts preflight`), fall back to the read-only ladder `pnpm lint && pnpm typecheck && pnpm test:unit` (compare against the same-ladder baseline). NEVER run `pnpm healthcheck` in review/read-only contexts — it mutates files.

**Operator gate G3-refactor:** all tests green, all ISCs PASS. Any failure → original implementer re-spawned per v0.1.0 policy, with 3-strike escalation tracked in `MEMORY/WORK/{slug}/strike-ledger.json` per DeliverFeature's strike-ledger contract.

### Phase 5 — Document (Tech Writer, conditional)

**Skip when:** refactor was internal-only (no public API rename, no doc reference to renamed symbols).
**Agent:** `writer`
**Brief:** update any doc that references renamed/moved symbols. Cite each updated location.

## Intent-to-Flag Mapping

Refactor's only bun-CLI invocation is fixed by design — Phase 0 always runs the identical capability probe; which implementer picks up Phase 3 is decided by code-ownership (package path), not by a CLI flag.

| Command | Input Contract | When It Fires |
|---------|-----------------|----------------|
| `bun ~/.claude/skills/makerkit-team/Tools/MakerkitCli.ts preflight` | flags: `[--kit-repo <p>] [--roster <p>] [--skills-dir <p>] [--doctrine <p>]` (no stdin) | Phase 0 step 1 — capability manifest gate before planning; exit 1 STOPs the run. Re-cited in Phase 2 and Phase 4's `mcp__makerkit__run_checks` fallback notes as pointers to this same manifest, not additional invocations. |

## Operator Gates Summary

G1-refactor (plan) · G2-refactor (test coverage if needed) · G3-refactor (verification)

## Output

PRD at `MEMORY/WORK/{slug}/PRD.md` with refactor plan + invariants + verification. Artifact type: `refactor_prd`.

## Hard Constraints

- **Behavior preservation.** If verification reveals any behavioral diff, the refactor is BROKEN, not "in progress" — revert, re-plan.
- **No scope creep.** Refactor adds zero features. If implementer surfaces a "while I'm in here" idea, log it to follow-ons; do not include in the refactor commit.
- **Per-step commits.** Each refactor step is its own commit. Squashing happens only if operator explicitly requests it at G3.
