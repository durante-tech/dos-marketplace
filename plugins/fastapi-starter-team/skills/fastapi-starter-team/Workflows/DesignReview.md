---
name: DesignReview
description: "Read-only review of API DX, schema, and architecture decisions across three parallel design lenses, synthesized into a prioritized design memo."
status: STABLE
bestPath:
  - title: "Scope"
    description: "PM drafts review questions across the four axes — API DX, schema, architecture, versioning."
  - title: "Review"
    description: "API DX, Schema, and Architect review in parallel, each owning a distinct design axis."
  - title: "Synthesize"
    description: "SM produces a unified design memo with prioritized recommendations and routing suggestions."
---

# DesignReview Workflow

Review API DX, schema, and architecture decisions. Read-only. Sibling to `MakerkitTeam/Workflows/DesignReview.md`.

## When to Use

- Trigger phrases: "design review for starter", "review design in starter".
- Fits when you want to critique API DX, schema, and architecture decisions before or independent of an implementation, without writing code.
- NOT for critiquing an existing code surface's implementation quality — use `CodeReview` instead.

## Pre-flight

1. Voice notify: `bash "$DOS_DIR/DOS/Tools/voice.sh" main "Running DesignReview workflow in fastapi-starter-team skill to review design"`

## Phase 1 — Scope (PM solo)

**Agent:** `pm`
**Outputs:** PRD with review questions across 4 axes:
- API DX (error envelopes, pagination, idempotency, OpenAPI shape)
- Schema (DTO ladder, validators, response_model)
- Architecture (placement, async boundaries, FastCRUD composition)
- Versioning (api/v1 vs api/v2 transitions, deprecation policy)

## Phase 2 — Review (parallel: API DX + Schema + Architect)

**Agents:** `apidx`, `schema`, `architect`

**Team spawn:** `TeamCreate({ team_name: "fst-designreview-<slug>", description: "3-stream parallel design review", agent_type: "team-lead" })`.

**Pre-Delegation Contract:**
- API DX owns: developer experience critique — error envelope consistency, pagination semantics, idempotency keys, Swagger UI ergonomics, OpenAPI tag groupings, x-codeSamples
- Schema owns: Pydantic v2 critique — DTO ladder completeness, validator quality, type aliases, ConfigDict, response_model selection per route
- Architect owns: structural critique — package placement, async boundary discipline, FastCRUD vs custom, integration tradeoffs

### MCP Touchpoints

- **`mcp__dos_fastapi__list_routes`** — all three agents read OpenAPI surface

## Phase 3 — Synthesize (SM solo)

**Agent:** `sm`
**Outputs:** unified design memo, prioritized recommendations (by axis), routing suggestions (Refactor / DeliverFeature / DocsRefresh).

PRD `phase: complete`. Read-only — no code writes.
