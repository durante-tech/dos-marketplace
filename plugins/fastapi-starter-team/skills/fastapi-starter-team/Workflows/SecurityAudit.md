---
name: SecurityAudit
description: "Adversarial, read-only security review covering JWT/auth, rate-limiting, secrets, and prompt-injection surfaces, producing a severity-ranked threat model and remediation list."
status: STABLE
bestPath:
  - title: "Scope"
    description: "PM drafts audit ISCs across JWT, bcrypt, cookies, rate-limiting, PII scrubbing, secrets discipline, and prompt-injection surface."
  - title: "Audit"
    description: "Security and Database review in parallel, each owning a distinct risk surface."
  - title: "Threat Model + Remediation"
    description: "SM consolidates a threat model and a severity-ranked remediation list with workflow routing suggestions."
---

# SecurityAudit Workflow

Adversarial security review. Read-only. Sibling to `MakerkitTeam/Workflows/SecurityAudit.md`.

## When to Use

- Trigger phrases: "security audit for starter", "security review in starter".
- Fits when you need an adversarial, read-only security assessment of auth, secrets, or the request/response surface.
- NOT for a non-security code critique — use `CodeReview` instead.

## Pre-flight

1. Voice notify: `bash "$DOS_DIR/DOS/Tools/voice.sh" main "Running SecurityAudit workflow in fastapi-starter-team skill to audit security"`

## Phase 1 — Scope (PM solo)

**Agent:** `pm`
**Outputs:** PRD with audit ISCs across:
- JWT (HS256, two-token, blacklist correctness)
- bcrypt (cost factor, hash storage)
- Refresh-token cookie (HttpOnly, SameSite, Secure)
- Rate-limit Redis key namespacing
- RFC 9457 error envelope PII scrubbing
- SecretStr discipline (SECRET_KEY, ANTHROPIC_API_KEY, LOGFIRE_TOKEN never returned in responses)
- Logfire span attribute redaction
- ARQ job payload sanitization
- Pydantic AI agent prompt injection surface
- Dependency vulnerabilities (uv.lock audit)

## Phase 2 — Audit (parallel: Security + Database)

**Agents:** `security`, `database`

**Team spawn:** `TeamCreate({ team_name: "fst-secaudit-<slug>", ... })`.

Per Coordination Policy #2, Database always weighs in (even if no schema concern: explicit "no DB-side risk identified" memo).

**Pre-Delegation Contract:**
- Security owns: threat model, JWT review, RBAC permission grants, refresh-cookie attributes, rate-limit key design, blacklist correctness, RFC 9457 PII review, env-var SecretStr discipline, prompt injection surface for Pydantic AI agents
- Database owns: index strategy for tenant scoping, FK ON DELETE behavior review, soft-delete enforcement at CRUD layer, raw SQL audit (if any)

### MCP Touchpoints

- **`mcp__dos_fastapi__read_env_local`** — Security verifies env-var hygiene; SECRET_KEY masked
- **`mcp__dos_fastapi__list_routes`** — Security maps which routes lack `Depends(get_current_user)` (must be intentional)
- **`mcp__dos_fastapi__run_checks`** — Security reviews mypy output for type-narrowing gaps that hide auth-skip paths

## Phase 3 — Threat Model + Remediation (SM solo)

**Agent:** `sm`
**Outputs:** consolidated threat model + ranked remediation list (by severity: critical / high / medium / low) + workflow routing suggestion (BugFix for high+, Refactor for medium-, DeliverFeature for new auth surface).

PRD `phase: complete`. Read-only — no code writes.

## Anti-criteria

- ✗ Patches a vulnerability inline — escalate to BugFix workflow with the threat model as input
- ✗ Suggests env-var rotation without operator awareness — surface ROTATE-NOW items prominently
