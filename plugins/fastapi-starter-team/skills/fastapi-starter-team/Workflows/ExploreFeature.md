---
name: ExploreFeature
description: "Read-only feature archaeology — maps a feature's flow, entry points, and gotchas across four parallel agent lenses without writing code."
status: STABLE
bestPath:
  - title: "Scope"
    description: "PM captures the feature name and the operator's guiding question as sub-questions."
  - title: "Map"
    description: "Architect, Backend, Agent Engineer, and Database map the feature in parallel, each owning a distinct subsystem lens."
  - title: "Synthesize"
    description: "SM produces a unified flow diagram, entry-point manifest, and gotcha list."
---

# ExploreFeature Workflow

Read-only feature archaeology — map a feature, surface entry points, dependencies, gotchas. No code writes.

**Sibling:** `MakerkitTeam/Workflows/ExploreFeature.md`.

## When to Use

- Trigger phrases: "explore feature in starter", "map feature in starter", "how does X work in starter", "feature archaeology in starter".
- Fits when you need to understand how an existing feature works — its flow, files, and gotchas — before deciding what to do next.
- NOT for fixing a bug found during exploration — route to `BugFix` instead.

## Pre-flight

1. Voice notify: `bash "$DOS_DIR/DOS/Tools/voice.sh" main "Running ExploreFeature workflow in fastapi-starter-team skill to map feature"`

## Phase 1 — Scope (PM solo)

**Agent:** `pm`
**Brief:** the feature name + operator's question ("how does X work?")
**Outputs:** PRD with sub-questions ("what files? what flow? what tests? what gotchas?")

## Phase 2 — Map (parallel: Architect + Backend + Agent + DB)

**Agents:** `architect`, `backend`, `agent` (Pydantic AI), `database`

**Team spawn (per `_algorithm-team-spawn.md`):** `TeamCreate({ team_name: "fst-explore-<slug>", description: "4-stream parallel feature archaeology", agent_type: "team-lead" })`.

**Pre-Delegation Contract:**
- Architect owns: top-level flow diagram, package placement, async boundaries, entry-point file:line citations
- Backend owns: route handlers, CRUD layer, JWT/auth touchpoints, ARQ enqueue surfaces
- Agent owns: Pydantic AI agent endpoints (if any) — Agent construction, @agent.tool registrations, system prompts
- Database owns: model definitions, FK relationships, index strategy, migration history relevant to the feature

### MCP Touchpoints

- **`mcp__dos_fastapi__list_routes`** — Architect + Backend
- **`mcp__dos_fastapi__alembic_history`** — Database
- **`mcp__dos_fastapi__alembic_current`** — Database

## Phase 3 — Synthesize (SM solo)

**Agent:** `sm`
**Brief:** PRD with all four streams' findings
**Outputs:** unified flow diagram + entry-point manifest + gotcha list + suggested-test-coverage gap (if any)

**No code writes — read-only workflow.** PRD `phase: complete`, `progress: N/N`. Operator decides whether to invoke `DeliverFeature` / `BugFix` / `Refactor` based on findings.
