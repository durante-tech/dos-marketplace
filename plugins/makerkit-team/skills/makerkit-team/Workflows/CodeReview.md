---
name: CodeReview
description: Read-only multi-lens critique of an existing code surface (Architect, Frontend, Backend, Database, QA) that synthesizes findings into a severity-ranked redline report for operator triage.
status: STABLE
bestPath:
  - title: "Pre-flight & Auto-route"
    description: "Run the capability probe and auto-route the review scope to the relevant reviewer subset."
  - title: "Parallel Critique"
    description: "Each reviewer agent produces PROCEED/REVISE/REJECT findings with file:line citations and fix snippets."
  - title: "Synthesis"
    description: "Merge findings into one redline report grouped by severity, highlighting agreements and disagreements."
  - title: "Operator Triage"
    description: "Operator decides per finding: fix now, defer, or accept the risk in writing."
divergence_from_canonical:
  _intent-to-flag-table.md:
    partial_version: 1.0.0
    reason: "Fixed-subcommand / native-tool invocations - no intent-variant flags exist to map; the section deliberately documents the fixed invocation table instead of the canonical Mode Selection shape"
    rationale_link: null
  _workflow-output-shape.md:
    partial_version: 1.0.0
    reason: "MakerkitTeam workflows have bespoke per-pipeline Output sections (artifact paths + redline reports); canonical shape doesn't fit"
---

# CodeReview Workflow

<!-- partial: _workflow-voice.md skill_name=MakerkitTeam workflow_name=CodeReview action_phrase=" to critique surface" -->

Multi-lens critique of an existing code surface. Non-security (use SecurityAudit for that). Read-only.

## When to Use

- Pre-merge review of a PR or branch
- Periodic critique of a load-bearing surface
- "Is this code OK?" before refactor or extension
- After a hotfix lands — was the surgical fix actually surgical?

## When NOT to Use

- Need security-specific critique → SecurityAudit
- Need to understand the code first → ExploreFeature
- Want behavior-preserving improvements applied → Refactor (this is review-only)

## Pipeline

### Phase 0 — Pre-flight

1. Preflight: `bun Tools/MakerkitCli.ts preflight` — emit the capability manifest for this run (repo, roster health, scripts, doctrine). Exit 1 = unresolvable repo or invalid roster: STOP and remediate before proceeding.
2. Operator provides: scope (file paths, package, PR diff, or branch range)
3. **Auto-route** by scope:
   - Frontend-only files → Architect + Frontend + QA
   - Backend-only files → Architect + Backend + QA + DB (DB only if Prisma touched)
   - Mixed → Architect + Frontend + Backend + QA
   - DB-heavy → Architect + Backend + DB + QA

### Phase 1 — Parallel Critique

**Pre-Delegation Contract:**
- Architect owns: package layering violations, abstraction smells, integration risks, "is this in the right place"
- Frontend owns: RSC boundary correctness, render-prop usage, form patterns, i18n key correctness, loader caching
- Backend owns: action-middleware chain (authn → org → permission), Zod schema completeness, transaction usage, redirect-error handling
- Database owns: index strategy, tenant scoping, N+1 risk, migration safety
- QA owns: testability, missing edge cases, ISC coverage gaps

**Brief constraint per agent:** verdict format `PROCEED / REVISE / REJECT` per finding, severity `CRITICAL / HIGH / MEDIUM / LOW / INFO`, every finding cites file:line, every recommendation includes the fix snippet (or "extract helper here").

**Cross-skill mandates:**
- Architect SHOULD invoke `Skill("sentinel", "convention scan on <scope>")` for repo-pattern violations
- Frontend reviewer is the team's `frontend` role — composes `Skill("react-form-builder")` for form patterns and `Skill("frontend-design")` for design-system review (per `_skill-composition.md`)
- Backend reviewer is the team's `backend` role — composes `Skill("server-actions-expert")` for server-action/RBAC/policy patterns
- Database reviewer is the team's `database` role — composes `Skill("prisma-expert")` for Prisma/schema patterns

<!-- partial: _workflow-mcp-touchpoints.md phase="Phase 1" -->

- **`mcp__makerkit__run_checks`** — orchestrator MUST invoke this BEFORE findings synthesis (Phase 2). Compile/lint/format/typecheck failures are auto-CRITICAL findings; agents shouldn't waste time re-discovering them. Attach the output verbatim under PRD `## Decisions → ### Pre-review run_checks`. If `mcp__makerkit__run_checks` is unavailable (server not connected — check the capability manifest from `bun Tools/MakerkitCli.ts preflight`), fall back to the read-only ladder `pnpm lint && pnpm typecheck && pnpm test:unit`. NEVER run `pnpm healthcheck` in review/read-only contexts — it mutates files.
- **`mcp__makerkit__get_components`** — Frontend reviewer cross-references the diff against the catalog (DRY violations: are we re-implementing an existing component?)
- **`mcp__makerkit__components_search`** with feature keywords from the diff — surface candidate reuses
- **`mcp__makerkit__get_database_tables`** + **`mcp__makerkit__get_table_info`** — Database reviewer verifies tenant scoping (`organizationId` column present on every multi-tenant table)
- **`mcp__makerkit__kit_translations_stats`** — Frontend reviewer flags any new component missing i18n keys

### Phase 2 — Synthesis (orchestrator)

Merge findings into a single redline report:
- Findings grouped by severity (CRITICAL → INFO)
- Each finding: agent, file:line, description, fix snippet
- Cross-agent agreements highlighted as strong signal
- Cross-agent disagreements flagged for operator decision

### Phase 3 — Operator Triage

Per finding, operator picks: Fix now (spawn QuickFix or BugFix), Defer (log to follow-ons with concrete slug), Accept (sign off in writing).

## Intent-to-Flag Mapping

CodeReview's only bun-CLI invocation is fixed by design — Phase 0 always runs the same capability probe; which reviewer roles spawn is decided by the Auto-route rule (file-type based), not by a CLI flag.

| Command | Input Contract | When It Fires |
|---------|-----------------|----------------|
| `bun Tools/MakerkitCli.ts preflight` | flags: `[--kit-repo <p>] [--roster <p>] [--skills-dir <p>] [--doctrine <p>]` (no stdin) | Phase 0 step 1 — capability manifest gate before auto-routing reviewers; exit 1 STOPs the run. Re-cited in Phase 1's `mcp__makerkit__run_checks` fallback note as a pointer to this same manifest, not a second invocation. |

## Operator Gates (v0.1.0)

- **G-review:** approve the redline report before triage decisions

## Output

`MEMORY/ARTIFACTS/code-review-<slug>.md` with all findings + triage decisions. Logged as type `code_review`.

## Constraint

**Read-only.** No code edits. Findings include fix snippets but agents do NOT apply them — that's the next workflow's job.
