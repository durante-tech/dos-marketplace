---
name: DocsRefresh
description: "Docs-only refresh of MkDocs pages, AGENTS.md, ADRs, and README — inventories stale/missing coverage, rewrites with source-of-truth citations, and validates before shipping."
status: STABLE
bestPath:
  - title: "Inventory"
    description: "Writer inventories stale references and missing coverage, then drafts one ISC per docs file to update."
  - title: "Refresh"
    description: "Writer updates the docs, AGENTS.md, ADRs, and README, citing a source-of-truth for every claim."
  - title: "Validate"
    description: "PM confirms onboarding value and flags any aspirational claim not backed by code."
  - title: "Commit + ship"
    description: "Commit and open a PR per the commit-merge convention."
---

# DocsRefresh Workflow

Refresh MkDocs operator pages, AGENTS.md, ADRs, README. No code writes. Sibling to `MakerkitTeam/Workflows/DocsRefresh.md`.

## When to Use

- Trigger phrases: "refresh starter docs", "update starter docs", "mkdocs refresh".
- Fits when documentation has drifted from the code (stale routes, env vars, missing coverage) and needs a docs-only refresh.
- NOT for entangled code changes alongside doc updates — escalate to `DeliverFeature` instead.

## Pre-flight

1. Voice notify: `bash "$DOS_DIR/DOS/Tools/voice.sh" main "Running DocsRefresh workflow in fastapi-starter-team skill to refresh docs"`
2. Scope check: docs only. If code changes are entangled → escalate to DeliverFeature.

## Phase 1 — Inventory (Writer solo)

**Agent:** `writer`
**Brief:** the docs surface to refresh (mkdocs section / AGENTS.md / ADR / README)
**Required outputs:**
- Inventory of stale references (route paths, env var names, version strings)
- Inventory of missing coverage (recently-shipped features without docs)
- PRD with one ISC per docs file to update

### MCP Touchpoints

- **`mcp__dos_fastapi__list_routes`** — read OpenAPI surface; cross-check route docs
- **`mcp__dos_fastapi__alembic_history`** — read migration history; cross-check migration docs

**Solo escape clause:** "single-author plan — narrative coherence".

## Phase 2 — Refresh (Writer solo)

**Agent:** `writer`
**Brief:** Phase 1 inventory + PRD ISCs
**Required outputs:**
- Updated `docs/{section}/{file}.md` files
- Updated AGENTS.md if conventions changed
- New ADRs if architecture decisions crystallized since last refresh
- Updated README sections
- All edits cite source-of-truth (route, model, ADR) for every claim

**Solo escape clause:** "single-author content — narrative coherence".

## Phase 3 — Validate (PM solo)

**Agent:** `pm`
**Brief:** PRD, refreshed docs
**Required outputs:**
- Confirm operator value: "would a new contributor onboard from these docs alone?"
- Flag any aspirational claim not backed by code
- Approve or request revision

**Gate:** Phase 3 PASS = ship; revision request → re-spawn Writer Phase 2 with revision constraints.

## Phase 4 — Commit + ship

Per `_commit-merge.md`:
- Type: `docs(<scope>): <subject>`
- Branch: `docs/<refresh-slug>`
- PR via `gh pr create` with `## Summary` + `## Test plan` (mkdocs build green; markdownlint clean if configured)

Update PRD frontmatter `phase: complete`, `progress: N/N`.
