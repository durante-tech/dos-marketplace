---
name: FastAPIStarterTeam
description: Orchestrates a 13-agent team for dos-fastapi-starter across product, API/schema/architecture, backend/database/agents, security, QA/E2E, DevOps, and docs. Runs deliver, fix, refactor, review, validate, explore, and a PR review-execute loop that turns findings into a TODO checklist on a side branch. USE WHEN deliver feature in starter, ship feature to fastapi starter, fastapi team, run delivery pipeline, build feature in starter, fastapi starter pipeline, design review for starter, security audit for starter, refresh starter docs, quick fix in starter, bug fix in starter, code review for starter, refactor starter, test and validate starter, explore feature in starter, feature archaeology, review open prs in starter, review pr in starter, deep review pr in starter, execute todos for pr in starter, apply review todos in starter, fastapi starter pr loop. NOT for non-starter repos (use FeatureDelivery) or the Prisma SaaS kit (use MakerkitTeam).
role: orchestrator
accepts:
  - text
roots:
  - PROTECTED_LOCAL
visibility: public
artifact_tracking:
  enabled: true
  roots:
    - MEMORY/WORK
    - MEMORY/ARTIFACTS
  types:
    - prd
    - delivery_summary
    - threat_model
    - test_plan
    - architecture_decision
    - design_spec
    - api_dx_memo
    - schema_diff
    - migration_plan
  log_path: MEMORY/ARTIFACTS/artifacts.jsonl
capabilities:
  - customization.cascade
  - four-copy.sync
---
<!-- generated-from: SKILL.partials.md — DO NOT EDIT directly. Run: bun Tools/dos-build.ts skill <path> -->
## Customization

**Before executing, check for user customizations at:**
`~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/FastAPIStarterTeam/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.

# FastAPIStarterTeam

Orchestrates the 13-agent dos-fastapi-starter delivery team. Each agent is a saved composition at `~/.claude/custom-agents/<slug>.md` with its own voice and trait identity. The team is invoked by a workflow that confirms scope with the operator at each phase.

**Status:** v0.5.0 — sibling to MakerkitTeam v0.5.2, lifted from FastAPIStarter v0.1.0 scaffold to full parity. 14 workflows spanning the lifecycle: explore, deliver, review, fix, refactor, test, validate, ship, audit, refresh, plus the PR loop (ReviewOpenPRs / ReviewSinglePR / ExecuteOpenTodos), bound by FIVE shared partials: `_test-pyramid-gate.md` (pytest unit + pytest integration two-tier), `_algorithm-team-spawn.md` (TeamCreate + Agent(team_name:...) for parallel phases), `_commit-merge.md` (Conventional Commits + HEREDOC + Co-Authored-By + Gated merge tier with ruff/mypy/pytest pre-commit), `_github-collaboration.md` (read-before-write + TODO lockstep + reviewer engagement + status cadence), `_pr-loop-shared.md` (safety tier table, side-branch convention, artifact JSON schema, TODO checklist markdown protocol). Each workflow names which `mcp__dos_fastapi__*` tools fit at which phase; each role has a per-cluster authorization list. The PR loop uses the same 13-agent starter-native roster as reviewers (NOT the github skill's generic-principles team) — that is the wedge.

## Workflow Routing

Grouped by motion type:

### Discovery (read-only)
| Trigger | Workflow |
|---|---|
| "explore feature in starter", "map feature in starter", "how does X work in starter", "feature archaeology in starter" | `Workflows/ExploreFeature.md` |
| "code review in starter", "review this code in starter", "critique surface in starter" (non-security) | `Workflows/CodeReview.md` |
| "design review in starter", "review design in starter" | `Workflows/DesignReview.md` |
| "security audit in starter", "security review in starter" | `Workflows/SecurityAudit.md` |
| "test and validate starter", "run tests and check drift in starter", "validate feature in starter" | `Workflows/TestAndValidate.md` |
| "review open prs in starter", "sweep prs in starter", "fleet review starter prs" | `Workflows/ReviewOpenPRs.md` |
| "review pr #N in starter", "deep review pr in starter", "team review pr in starter" | `Workflows/ReviewSinglePR.md` |

### Change (writes code)
| Trigger | Workflow |
|---|---|
| "deliver feature in starter", "ship feature to starter", "build feature in starter" | `Workflows/DeliverFeature.md` |
| "quick fix in starter", "patch in starter", "tiny fix in starter" (≤2 files, surgical) | `Workflows/QuickFix.md` |
| "bug fix in starter", "fix bug in starter", "diagnose and fix in starter" (multi-file or unclear root cause) | `Workflows/BugFix.md` |
| "refactor in starter", "restructure in starter", "extract in starter", "tidy first in starter", "behavior-preserving change in starter" | `Workflows/Refactor.md` |
| "refresh starter docs", "update starter docs", "mkdocs refresh" | `Workflows/DocsRefresh.md` |
| "execute todos for pr #N in starter", "apply review todos in starter", "execute open todos in starter" | `Workflows/ExecuteOpenTodos.md` |

### Meta
| Trigger | Workflow |
|---|---|
| "show team", "list team", "team roster", "show starter team" | `Workflows/ShowRoster.md` |

## Examples

**Example 1: Delivering a feature end-to-end through the 13-agent pipeline**

```
User: "Add a webhook-receipts endpoint to the starter."
→ Invokes DeliverFeature workflow
→ Auto-classifies scope, spawns PM at G1 (fork_status + check_prerequisites via dos-fastapi MCP), then API DX/Schema/Architect at G2, Database at G3, Agent Engineer/Backend at G4 (depending on whether it's an AI-tool endpoint or pure CRUD), Security/QA at G5, E2E/QA at G6, DevOps/Writer at G7. /code-review runs inline in BUILD.
→ Per-phase artifacts (PRD, API DX memo, schema diff, threat model, Test Pyramid Plan, deploy checklist) logged to MEMORY/ARTIFACTS/artifacts.jsonl, with PR opened only after G7 passes.
```

**Example 2: Auditing a feature without writing code**

```
User: "Security review the auth flow in the starter."
→ Invokes SecurityAudit workflow
→ Spawns the security agent with skeptical/adversarial traits and the audits cluster (run_checks, read_env_local, list_routes). DB Engineer always runs — even when no schema changes, an explicit "no schema changes required" memo lands.
→ A threat model + remediation list, scoped to the starter's actual surface (JWT two-token, bcrypt, rate-limit Redis keys, blacklist, RFC 9457 problem-details), with no code writes.
```

**Example 3: Surgical bug fix with classification override**

```
User: "Quick fix: timezone bug in scheduled-report ARQ task."
→ Invokes QuickFix workflow (≤2 files, surgical)
→ Backend agent owns the diagnosis-and-fix; QA validates; no UX/Schema/Architect involvement. If ISC fails, routes back to Backend (3-strike escalation rule). Operator can override classification at G1 if BugFix is the right scope instead.
→ Two-file diff with regression test, mapped through Phase 4 BUILD without convening the full 13-agent team.
```

**Example 4: PR review-execute loop (the v0.4.0 surface, sibling to MakerkitTeam)**

```
Operator: "review pr #42 in starter"
→ Invokes ReviewSinglePR workflow
→ Spawns full 13-agent team in parallel; each emits TODOs in the canonical (agent:X) (priority:Y) format.
→ Aggregator computes team verdict (typed Verdict union: PASS | BLOCK | CHANGES{minor|substantial}).
→ Renders one PR comment via gh pr comment --edit-last --create-if-none + writes MEMORY/ARTIFACTS/fastapistarter-pr-42-todos.json.

Operator: "execute todos for pr #42 in starter"
→ Invokes ExecuteOpenTodos workflow
→ Checks out side branch fix/pr-42-todos from origin/{head_ref} (rebases if exists).
→ Groups TODOs by agent, sorts batches by priority, spawns each batch SERIALLY.
→ Per-batch: agent commits → uv run pytest + ruff/mypy + scoped tests → on failure, revert + mark blocked.
→ Pushes side branch, regenerates PR comment from updated artifact, stops at merge boundary.
→ Operator decides whether to merge fix/pr-42-todos into the PR head — workflow never does.
```

## The Team (13 roles)

Loaded from `Data/Roster.json`. Each role: id · saved-composition slug · voice · traits · owns/consumes/produces.

| id | Role | Traits |
|---|---|---|
| `pm` | Product Manager | product · analytical · systematic |
| `sm` | Scrum Master | communications · empathetic · consultative |
| `apidx` | API DX Designer | creative · empathetic · exploratory |
| `schema` | Schema Designer | creative · meticulous · thorough |
| `architect` | Software Architect | technical · analytical · thorough |
| `agent` | Agent Engineer | technical · pragmatic · systematic |
| `backend` | Backend Developer | technical · meticulous · systematic |
| `database` | Database Engineer | data · analytical · meticulous |
| `security` | Security Engineer | security · skeptical · adversarial |
| `qa` | QA Engineer | technical · skeptical · thorough |
| `e2e` | E2E Tester | technical · contrarian · investigative |
| `devops` | DevOps / SRE | technical · cautious · systematic |
| `writer` | Tech Writer | communications · meticulous · synthesizing |

**Reflavor delta vs MakerkitTeam:** `ux→apidx` (developer experience instead of end-user UX), `ui→schema` (Pydantic v2 DTOs instead of React components), `frontend→agent` (Pydantic AI agents instead of Next.js pages). Other 10 roles structurally parallel; content reflavored for Python.

## Coordination Policy (v0.5.0 — locked)

1. **Auto-classify scope.** No confirmation prompt. PRD `## Decisions` records the classification with reasoning. Operator overrides at G1 if wrong.
2. **DB Engineer always runs.** No skip — even when no schema changes are needed, output is an explicit "no schema changes required, here's why" memo. ALWAYS runs `mcp__dos_fastapi__alembic_check` to confirm zero ORM↔DB drift.
3. **`/code-review` is part of Phase 4 BUILD.** Runs after Agent Engineer + Backend return; original implementer addresses findings before G4. Not a separate gate.
4. **Distinctive voices kept.** Each agent retains its trait-derived prosody — 13 audible identities, not a uniform delivery cadence.
5. **ISC failures route to original implementer.** Agent Engineer or Backend (by code ownership) gets a surgical-fix re-spawn with failure context. After 3 consecutive failures from same agent, escalate to operator.
6. **Test pyramid is non-negotiable.** Every change-producing workflow gates on the ships-with-tests rule in `Workflows/_test-pyramid-gate.md`. Two-tier per Python ecosystem — pytest unit + pytest integration with FastAPI TestClient. No PR opens / no QuickFix completes / no BugFix verifies / no Refactor closes / no DeliverFeature reaches G7 unless: unit-layer green, integration-layer green, `mcp__dos_fastapi__run_checks` clean (ruff + mypy + pytest), per-ISC layer mapping in PRD `### Test Pyramid Plan`. PR-loop reviewers (qa, e2e) auto-emit high-priority TODOs for missing-layer files (file-level heuristic — changed `src/app/**` files without sibling `tests/`).
7. **Algorithm-driven execution + DAG default for parallel phases.** Workflows respect the DOS Algorithm v0.0.9 (V12.7-α doctrine; inherits v0.0.8 / v0.0.7-enhanced unchanged) — every multi-agent phase runs the §6.3 PARALLELISM PRE-CHECK and uses the canonical `TeamCreate` + `Agent(team_name: ...)` spawn pattern from `Workflows/_algorithm-team-spawn.md`. Multi-agent parallel phases (DeliverFeature 2/4/5/7, BugFix 4, Refactor 4, ReviewSinglePR 2, ReviewOpenPRs 4) spawn starter roles via `subagent_type: "general-purpose"` with the saved-composition prompt + `team_name` + `name: <role-id>` + `run_in_background: true`, then collect `SendMessage` reports before running the phase gate. Solo phases declare their dag-playbook escape clause inline. PRDs follow Algorithm §2 PRD format (RFC-0080 vNext / RFC-0086 Amendment A) with atomic ISCs verified at gates.
8. **Commit + merge hygiene.** Every workflow that lands a commit, opens a PR, posts a PR comment, or merges follows the contract in `Workflows/_commit-merge.md`. Conventional Commits prefix + concise subject (starter AGENTS.md Hard Rule 8 — no emojis) + HEREDOC body + `Co-Authored-By: DuranteOS <tech@duranteos.com>` trailer. Explicit-list staging, NEVER `-A` or `.`. NEW commit (not `--amend`) after pre-commit hook failure. PR creation via `gh pr create` with `## Summary` + `## Test plan` H2 sections. PR comments via `gh pr comment --edit-last --create-if-none` (single comment per session). Merge gate is Gated tier per `Workflows/_pr-loop-shared.md`: explicit `AskUserQuestion` approval + all required CI checks green; never inferred from team verdict. Push safety: NEVER `--force`, NEVER to PR head branch, NEVER `--no-verify`. Pre-commit hooks (ruff format, ruff check, mypy) MUST pass before push.
9. **GitHub collaboration discipline.** Every workflow that interacts with a PR over time follows `Workflows/_github-collaboration.md`. Read external comments via `gh pr view {N} --json comments,reviews,statusCheckRollup` BEFORE any write. Keep the auto-managed TODO comment in lockstep with the artifact JSON — re-render on every state change. Three comment types: auto-managed TODO comment (one per session, edit-last), reply to reviewer (engage every reviewer point with one of four categories — acknowledged-queued / done / push-back / surface-to-operator; never silent), status update folded into Type 1. PR body / title freshness via `gh pr edit`. Issue linking via `Closes #N` / `Fixes #N` / `Refs #N`. Status cadence: refresh the auto-managed comment at every batch boundary, every blocker, and session end.

Decisions 1–5 inherited from MakerkitTeam v0.5.0 baseline. Decisions 6–7 from MakerkitTeam v0.5.0 (Test Pyramid Gate + Algorithm/DAG integration). Decision 8 from v0.5.1 (commit + merge hygiene). Decision 9 from v0.5.2 (GitHub collaboration discipline). Documented in `CHANGELOG.md`.

## dos-fastapi-starter MCP Integration (v0.5.0)

The starter repo (`~/Developer/dos-fastapi-starter`) ships its own MCP server at `tooling/mcp_server/` (entry: `uv run python -m dos_fastapi_mcp`). Eight+ tools spanning project status, Alembic migrations, route inventory, mailpit inspection, healthcheck script (run_checks), env reading, and fork registry. The skill wires this MCP into three layers:

1. **Skill-level** — this section + the cluster catalogue at `Data/McpToolMap.json` (6 named clusters, 8+ tools)
2. **Workflow-level** — every workflow has a `### MCP Touchpoints` subsection per phase where MCP tools fit naturally. Verification phases mandate `mcp__dos_fastapi__run_checks` (the canonical "is the codebase healthy?" tool); other touchpoints are SHOULD with prerequisite-aware fallback (`fork_status` before assuming slot, `alembic_check` before generating migrations, mailpit inspection only after E2E confirms mailpit is up).
3. **Agent-level** — `Data/Roster.json` adds an `mcp_tools: [cluster, ...]` field per role. `Tools/BuildBrief.ts` reads `Data/McpToolMap.json` and renders an `## Authorized MCP Tools` section per role. Tools NOT in the role's authorized clusters are out of scope — agents surface findings to the orchestrator instead of overreaching.

**Wiring (operator step):** add to your project-level `.mcp.json`:

```json
{
  "mcpServers": {
    "dos-fastapi": {
      "command": "uv",
      "args": ["run", "--directory", "~/Developer/dos-fastapi-starter/tooling/mcp_server", "python", "-m", "dos_fastapi_mcp"]
    }
  }
}
```

The MCP server is **cwd-locked** to the slot recorded in `.fork-slot`. Set `DOS_FORK_BYPASS=1` to override for cross-slot debugging.

**No destructive tools in this MCP surface.** All 8+ tools are read-only (or mailpit-state-mutating, which is non-destructive). Migration application happens via subprocess (`cd src && uv run alembic upgrade head`) — intentionally not exposed as an MCP tool to keep guardrails in operator hands.

## Quick Reference

- **Roster manifest:** `Data/Roster.json`
- **MCP tool map:** `Data/McpToolMap.json` — cluster→tools→notes (single source of truth)
- **Saved compositions:** `~/.claude/custom-agents/<slug>.md`
- **Framework digest:** `FrameworkDigest.md` (12-section synthesis of `dos-fastapi-starter`)
- **Repo:** `~/Developer/dos-fastapi-starter`
- **MCP server source:** `~/Developer/dos-fastapi-starter/tooling/mcp_server/src/dos_fastapi_mcp/`
- **Brief builder:** `Tools/BuildBrief.ts` — composes per-agent invocation message from PRD + role + framework digest slice + authorized MCP cluster
- **Roster reader:** `Tools/InvokeAgent.ts` — resolves role id → system prompt + voice id
- **PR loop primitives** (sibling to MakerkitTeam):
  - `Tools/ParsePrTodos.ts` — markdown checklist → typed `Todo[]`
  - `Tools/ClassifyPrShape.ts` — file paths → `ReviewerSet` (which starter roles to spawn)
  - `Tools/RenderTodoComment.ts` — `Todo[] + meta` → markdown for `gh pr comment`
  - `Tools/_shared.ts` — `readStdin()`, `Verdict` discriminated union, `formatVerdict()`
- **PR loop shared partial:** `Workflows/_pr-loop-shared.md`
- **Test Pyramid Gate partial:** `Workflows/_test-pyramid-gate.md` — pytest unit + pytest integration two-tier
- **Algorithm Team Spawn partial:** `Workflows/_algorithm-team-spawn.md`
- **Commit + Merge Hygiene partial:** `Workflows/_commit-merge.md` — Conventional Commits + ruff/mypy pre-commit
- **GitHub Collaboration partial:** `Workflows/_github-collaboration.md`

## Sibling skill: MakerkitTeam

This skill is the Python/FastAPI parallel of `makerkit-team` (TS/Next.js/Prisma). When both are installed, terminology stays disambiguated by the "in starter" / "in kit" suffix in triggers. Cross-skill PRs that touch both repos invoke each independently.

## Scope-Tuning Disclaimer

As features are delivered, each workflow's phase steps will be tightened: ISC templates per role, contract templates per phase, and verifier patterns will be promoted from prose to tooling. Until then, the orchestrator (you) is the load-bearing coordinator — the workflows are checklists, not automation.

## Four-Copy Compliance

This skill exists in up to four locations per the DOS Four-Copy Rule (`Durante/CLAUDE.md`):

1. `~/.claude/skills/fastapi-starter-team/` — live install (what Claude Code runs)
2. `Releases/<active-version>/.claude/skills/fastapi-starter-team/` — active release submodule (versioned)
3. `Packs/*/src/FastAPIStarterTeam/` — pack source (distributable)
4. `Packs/agents/FastAPIStarterTeam/` — agent runtime (only if applicable)

After editing any file in this skill, verify all copies via `bun ~/Durante/Tools/sync-check.ts`. Exit code 0 = clean. Exit code 1 = drift; resolve with `--fix` before commit.
