---
name: ExploreFeature
description: Read-only, four-agent (Architect, Frontend, Backend, Database) archaeology pass that traces a feature's actual wiring end-to-end and synthesizes a file:line-cited feature map, without any code changes.
status: STABLE
bestPath:
  - title: "Pre-flight"
    description: "Run the capability probe and auto-classify exploration depth from the entry-point hint."
  - title: "Parallel Archaeology"
    description: "Architect, Frontend, Backend, and Database each trace their layer read-only, citing file:line for every claim."
  - title: "Synthesis"
    description: "Orchestrator merges the four reports into a surface inventory, data-flow trace, and hidden-dependency list."
  - title: "Operator Decision"
    description: "Operator continues to BugFix/Refactor/DeliverFeature with the map, archives it, or spawns DocsRefresh."
divergence_from_canonical:
  _workflow-output-shape.md:
    partial_version: 1.0.0
    reason: "MakerkitTeam workflows have bespoke per-pipeline Output sections (artifact paths + redline reports); canonical shape doesn't fit"
---

# ExploreFeature Workflow

<!-- partial: _workflow-voice.md skill_name=MakerkitTeam workflow_name=ExploreFeature action_phrase=" to map feature surface" -->

Read-only archaeology. "Explain how feature X actually works in this kit" before touching it. No code changes.

## When to Use

- Operator new to a surface and needs orientation
- Before refactoring or extending a feature — ground truth check
- "Where is the org-switching logic actually wired?"
- "How does the billing webhook flow end-to-end?"
- Pre-bug-fix triage when symptom is unclear

## When NOT to Use

- Already know the surface → skip straight to BugFix or DeliverFeature
- Need a critique, not just a map → use CodeReview
- Need to validate behavior against docs → use TestAndValidate

## Pipeline

### Phase 0 — Pre-flight

1. Preflight: `bun Tools/MakerkitCli.ts preflight` — emit the capability manifest for this run (repo, roster health, scripts, doctrine). Exit 1 = unresolvable repo or invalid roster: STOP and remediate before proceeding.
2. Operator provides: feature name, entry-point hint (URL, route, or file path), depth (skim / standard / deep)
3. **Auto-classify depth** if not given: skim if entry-point is a single page, standard if multi-file feature, deep if cross-package

### Phase 1 — Parallel Archaeology

**Agents:** `architect`, `frontend`, `backend`, `database`
**Pre-Delegation Contract:**
- Architect owns: package layering, server vs client boundary, RBAC/policy touchpoints, lifecycle hooks invoked
- Frontend owns: pages, components, loaders, forms, i18n keys, navigation entries
- Backend owns: server actions, schemas, Better Auth wiring, webhook handlers, action-middleware chains
- Database owns: schema models touched, indexes used, query patterns, transaction boundaries
- Each writes to its own subsection of the feature map; no overlap

**Each agent's brief:**
- Feature: <name>
- Entry point: <hint>
- Read-only — make ZERO edits
- Output: file:line citations for every claim
- Constraint: trace, don't critique. Critique is `CodeReview`, not this workflow.

### MCP Touchpoints (Phase 1)

Read-only archaeology authorized for parallel discovery:

- **Architect:** `mcp__makerkit__get_database_summary`, `mcp__makerkit__get_database_tables` (data shape map), `mcp__makerkit__get_scripts` (entry-point hints)
- **Frontend:** `mcp__makerkit__get_components` + `mcp__makerkit__components_search <feature>` (which @kit/ui components are wired in?), `mcp__makerkit__kit_translations_list` (i18n surface)
- **Backend:** `mcp__makerkit__search_database_functions <feature>`, `mcp__makerkit__get_function_details` for hits, `mcp__makerkit__kit_env_schema` (env-var dependencies)
- **Database:** `mcp__makerkit__get_table_info` for each model touched, `mcp__makerkit__get_migrations` to read recent schema history

ALL tools above are read-only — no writes during ExploreFeature.

### Phase 2 — Synthesis (orchestrator, not an agent)

Orchestrator merges the 4 reports into a single feature map:
- **Surface inventory:** every file touched, by layer
- **Data flow:** request → action → DB → response, with file:line at each hop
- **Hidden dependencies:** lifecycle hooks, policy registrations, env vars, webhook subscriptions
- **Open questions:** anything an agent flagged as "unclear" or "couldn't trace"

### Phase 3 — Operator Decision

Operator reads the feature map and chooses next move:
- Continue to BugFix / Refactor / DeliverFeature with this map as upstream input
- Archive map to `MEMORY/ARTIFACTS/feature-map-<slug>.md` for future reference
- Spawn DocsRefresh if doc drift detected

## Operator Gates (v0.1.0)

- **G-explore:** review the synthesized map before deciding next move

## Output

`MEMORY/ARTIFACTS/feature-map-<slug>.md` — the synthesized 4-perspective map. Logged in `artifacts.jsonl` as type `feature_map`.

## Constraint

**ZERO writes to source code.** Any agent making an Edit/Write call to repo source is a CRITICAL FAILURE — orchestrator must enforce read-only mode in agent briefs.
