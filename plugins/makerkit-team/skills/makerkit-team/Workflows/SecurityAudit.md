---
name: SecurityAudit
description: Security Engineer audit of an existing or proposed surface — threat model, severity-ranked findings, and a compliance checklist — paired with an always-on Database Engineer schema-security memo, for operator triage.
status: STABLE
bestPath:
  - title: "Pre-flight"
    description: "Run the capability probe and gather the audit scope from the operator."
  - title: "Security Audit & DB Memo"
    description: "Security Engineer produces a threat model and severity-ranked findings while Database Engineer runs the always-on schema-security memo in parallel."
  - title: "Operator Triage"
    description: "Operator picks fix-now, defer, or accept-risk for each CRITICAL/HIGH finding."
divergence_from_canonical:
  _workflow-output-shape.md:
    partial_version: 1.0.0
    reason: "MakerkitTeam workflows have bespoke per-pipeline Output sections (artifact paths + redline reports); canonical shape doesn't fit"
---

# SecurityAudit Workflow

<!-- partial: _workflow-voice.md skill_name=MakerkitTeam workflow_name=SecurityAudit action_phrase=" to audit security surface" -->

Security Engineer agent on existing or proposed code in the makerkit framework, plus the always-on DB Engineer memo (coordination policy #2: DB always runs).

## When to Use

- Before merging an auth/billing/RBAC PR
- Periodic audit of a critical surface (auth.ts, action-middleware, policies)
- After a dependency upgrade affecting security packages
- Before going to production

## Pipeline

### Phase 0 — Pre-flight
1. Preflight: `bun Tools/MakerkitCli.ts preflight` — emit the capability manifest for this run (repo, roster health, scripts, doctrine). Exit 1 = unresolvable repo or invalid roster: STOP and remediate before proceeding.
2. Operator provides: scope (file paths / package / endpoint / "the whole auth surface")

### Phase 1 — Audit (Security Engineer solo)

**Agent:** `security`
**Brief:**
- Scope: <operator-provided>
- Framework digest §5 (Better Auth) + §4 (RBAC/Policies) + §10 gotchas
- Required output:
  - Threat model (STRIDE or similar)
  - Findings list with severity (CRITICAL / HIGH / MEDIUM / LOW / INFO)
  - For each: location (file:line), description, exploit scenario, recommended fix
  - Compliance check: CSP headers, rate limit on the path, RBAC enforced, Zod validation, no client-trusted IDs

**Cross-skill:** Security agent SHOULD invoke `Skill("security", "<scope> threat model")` for richer methodology.

### Skill Composition (Phase 1, per `Workflows/_skill-composition.md`)

- Security → `Skill("security", "web assessment")` when the audit scope includes HTTP-exposed surfaces; `Skill("security", "annual reports" | "news")` when third-party integrations are in scope. Cost guard: 1 web-assessment + ≤3 vendor lookups per audit. Failure → static OWASP checklist fallback + `⚠️ recon-not-run` flag in the threat model.

### Phase 1b — DB Engineer memo (parallel with Phase 1)

**Agent:** `database` — always runs, per coordination policy #2, even when the scope looks schema-free (SKILL.md Example 2 promises this memo).
**Brief:**
- Review the audited surface for schema-level security posture: tenant scoping (`organizationId` on multi-tenant tables), index-backed lookups on rate-limited paths, migration safety of any recommended fix
- Required output: `schema.prisma` diff (only when a recommended fix requires a schema change) OR an explicit "no schema changes required" memo — one of the two lands in the audit artifact every run

### Phase 2 — Operator Triage

Operator triages findings. Each CRITICAL/HIGH gets a remediation plan:
- Fix now → spawn `QuickFix` or `DeliverFeature` (depending on scope)
- Defer → log to follow-ons with concrete slug + scope
- Accept risk → operator signs off in writing

## Output

`MEMORY/ARTIFACTS/security-audit-<slug>.md` with threat model + findings + DB memo (schema diff or "no schema changes required") + triage decisions.
