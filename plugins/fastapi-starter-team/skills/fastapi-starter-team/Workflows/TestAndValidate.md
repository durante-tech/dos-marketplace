---
name: TestAndValidate
description: "Read-only healthcheck + drift-detection pipeline across four parallel validation streams (tests, integration, env/docker, migrations), synthesized into a validation report."
status: STABLE
bestPath:
  - title: "Scope"
    description: "PM drafts validation ISCs covering lint, type-check, unit/integration tests, migration drift, route inventory, and env-var manifest parity."
  - title: "Validate"
    description: "QA, E2E, DevOps, and Database validate in parallel, each owning a distinct validation stream."
  - title: "Synthesize"
    description: "SM produces a validation report with green checks, drift detected, and actionable items with workflow routing."
---

# TestAndValidate Workflow

Run the full healthcheck pipeline + drift detection. Read-only. Sibling to `MakerkitTeam/Workflows/TestAndValidate.md`.

## When to Use

- Trigger phrases: "test and validate starter", "run tests and check drift in starter", "validate feature in starter".
- Fits when you want a full read-only healthcheck (lint, types, tests, migration drift, route/env parity) without patching anything found.
- NOT for patching drift found during validation — route to `BugFix` or `Refactor` instead.

## Pre-flight

1. Voice notify: `bash "$DOS_DIR/DOS/Tools/voice.sh" main "Running TestAndValidate workflow in fastapi-starter-team skill to validate state"`
2. Pre-flight slot containers running: `make compose-dev-up` and verify `mcp__dos_fastapi__fork_status` returns `slot_match: true`.

## Phase 1 — Scope (PM solo)

**Agent:** `pm`
**Outputs:** PRD with validation ISCs:
- ISC-1: ruff format clean
- ISC-2: ruff check clean
- ISC-3: mypy clean
- ISC-4: pytest tests/unit green
- ISC-5: pytest tests/integration green (with stack up)
- ISC-6: alembic_check green (no ORM↔DB drift)
- ISC-7: list_routes matches expected route inventory
- ISC-8: i18n / translations drift (if applicable)
- ISC-9: env-var manifest (`.env.example`) matches actual settings.py BaseSettings

## Phase 2 — Validate (parallel: QA + E2E + DevOps + Database)

**Agents:** `qa`, `e2e`, `devops`, `database`

**Team spawn:** `TeamCreate({ team_name: "fst-validate-<slug>", description: "4-stream parallel validation", agent_type: "team-lead" })`.

**Pre-Delegation Contract:**
- QA owns: unit suite green, ruff + mypy clean, capture verbatim into PRD
- E2E owns: integration suite green with stack up, capture verbatim
- DevOps owns: env-var consistency (`.env.example` ↔ settings.py), Docker recipe build smoke tests, slot allocator hygiene
- Database owns: alembic_check clean, migration history sane

### MCP Touchpoints

- **`mcp__dos_fastapi__run_checks`** — QA + E2E (orchestrator runs once and surfaces to both)
- **`mcp__dos_fastapi__alembic_check`** — Database
- **`mcp__dos_fastapi__list_routes`** — DevOps + E2E (route inventory drift)
- **`mcp__dos_fastapi__read_env_local`** — DevOps
- **`mcp__dos_fastapi__check_prerequisites`** — DevOps (Phase 0 follow-through)

## Phase 3 — Synthesize (SM solo)

**Agent:** `sm`
**Outputs:** validation report — green checks, drift detected, actionable items (with workflow routing).

PRD `phase: complete`. Read-only — no code writes.

## Anti-criteria

- ✗ Patches drift inline — drift becomes a BugFix or Refactor PRD
- ✗ Skips the docker-compose stack-up — integration tests hit a real Postgres + Redis + mailpit
