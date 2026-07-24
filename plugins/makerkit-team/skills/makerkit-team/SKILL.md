---
name: MakerkitTeam
description: Orchestrates a 13-agent delivery team (PM, SM, UX, UI, Architect, Frontend, Backend, DB, Security, QA, E2E, DevOps, Writer) for the dos-prisma-saas-kit Makerkit framework and its forks. Full dev-team motions — deliver, fix, refactor, review, validate, explore. Includes a PR review-execute loop (review open PRs, deep-review one PR, execute the resulting TODO checklist on a side branch). USE WHEN deliver feature in the kit, ship feature to kit, makerkit team, run delivery pipeline in the kit, build feature in saas kit, makerkit pipeline, design review for kit, security audit for kit, refresh kit docs, quick fix in kit, bug fix in kit, code review for kit, refactor kit, test and validate kit, explore feature in kit, feature archaeology in the kit, review open prs in kit, review pr in kit, deep review pr in kit, execute todos for pr in kit, apply review todos in kit, makerkit pr loop, kit pr review. NOT for non-kit repos (use FeatureDelivery) or the FastAPI starter (use FastAPIStarterTeam).
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
  log_path: MEMORY/ARTIFACTS/artifacts.jsonl
capabilities:
  - customization.cascade
  - four-copy.sync
composes: [FeatureDelivery, FastAPIStarterTeam]
---
<!-- generated-from: SKILL.partials.md — DO NOT EDIT directly. Run: bun Tools/dos-build.ts skill <path> -->
## Customization

**Before executing, check for user customizations at:**
`~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/MakerkitTeam/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.

# MakerkitTeam

Orchestrates the 13-agent makerkit delivery team. Each agent is a saved composition at `~/.claude/custom-agents/<slug>.md` with a trait-derived identity (missing compositions are reproducible via `RosterBootstrap.md`). The team is invoked by a workflow that confirms scope with the operator at each phase.

**Status:** v0.8.0 — Host-resilience wave: kit repo is RESOLVED, not assumed (`Tools/ResolveRepo.ts` ladder: explicit path > `$KIT_REPO` override > `git rev-parse --show-toplevel`); every workflow Phase 0 runs `bun Tools/MakerkitCli.ts preflight` for a JSON capability manifest (repo, roster health, scripts, doctrine, MCP); `_algorithm-team-spawn.md` is a spawn DEGRADATION LADDER (L1 team choreography only when the manifest confirms team primitives / L2 DEFAULT Task-Agent fan-out / L3 serial solo); `FrameworkDigest.md` pins regenerate via `Tools/BuildDigest.ts` and verify via `Tools/VerifyDigest.ts` (exit 0 verified / 1 drift / 2 VACUOUS); gates were wired-or-deleted — `layer-map-check` / `pyramid-missing-tests` / `contract-check` are wired into workflow phases with a shared `findMissingUnitTests()` heuristic and a vacuous-input exit contract, `commit-msg-check` is DELETED (prose rule in `_commit-merge.md` stays authoritative); voice is retired (2026-07-02) — identities are trait-derived prompts; deploy parity via `RosterBootstrap.md`. Builds on v0.7.1 (verifier promotion), v0.7.0 (docs-alignment + agentic bridge), v0.6.0 (Skill Composition), v0.5.x (pyramid gate, commit/merge, GitHub collaboration, Algorithm integration). 14 user-facing workflows spanning the lifecycle (explore, deliver, review, fix, refactor, test, validate, ship, audit, refresh, plus the PR loop — ReviewOpenPRs / ReviewSinglePR / ExecuteOpenTodos), bound by SIX shared partials: `_pr-loop-shared.md` (safety tiers + side-branch convention + artifact JSON schema), `_test-pyramid-gate.md` (two-tier pyramid non-negotiable), `_algorithm-team-spawn.md` (capability-probed spawn degradation ladder), `_commit-merge.md` (Conventional Commits + HEREDOC + Co-Authored-By + Gated merge tier), `_github-collaboration.md` (read-before-write + TODO lockstep + reviewer engagement + status cadence), `_skill-composition.md` (per-role authorized DOS skills with conditional-fire + cost guard + failure mode + skip path). Each workflow names which `mcp__makerkit__*` tools fit at which phase; each role has a per-cluster MCP authorization list AND a `composed_skills` list in `Data/Roster.json`. The PR loop uses the same 13-agent kit-native roster as reviewers (NOT the github skill's generic-principles team) — that is the wedge.

## Workflow Routing

Grouped by motion type:

### Discovery (read-only)
| Trigger | Workflow |
|---|---|
| "explore feature", "map feature", "how does X work", "feature archaeology" | `Workflows/ExploreFeature.md` |
| "code review", "review this code", "critique surface" (non-security) | `Workflows/CodeReview.md` |
| "design review", "review design" | `Workflows/DesignReview.md` |
| "security audit", "security review" | `Workflows/SecurityAudit.md` |
| "test and validate", "run tests and check drift", "validate feature" | `Workflows/TestAndValidate.md` |
| "review open prs in kit", "sweep prs in kit", "fleet review kit prs" | `Workflows/ReviewOpenPRs.md` |
| "review pr #N in kit", "deep review pr in kit", "team review pr in kit" | `Workflows/ReviewSinglePR.md` |

### Change (writes code)
| Trigger | Workflow |
|---|---|
| "deliver feature", "ship feature", "build feature" | `Workflows/DeliverFeature.md` |
| "quick fix", "patch", "tiny fix" (≤2 files, surgical) | `Workflows/QuickFix.md` |
| "bug fix", "fix bug", "diagnose and fix" (multi-file or unclear root cause) | `Workflows/BugFix.md` |
| "refactor", "restructure", "extract", "tidy first", "behavior-preserving change" | `Workflows/Refactor.md` |
| "refresh docs", "update docs" | `Workflows/DocsRefresh.md` |
| "execute todos for pr #N", "apply review todos", "execute open todos" | `Workflows/ExecuteOpenTodos.md` |

### Meta
| Trigger | Workflow |
|---|---|
| "show team", "list team", "team roster" | `Workflows/ShowRoster.md` |

## Examples

**Example 1: Delivering a feature end-to-end through the 13-agent pipeline**

```
User: "Ship a multi-tenant team-invite feature into the kit."
→ Invokes DeliverFeature workflow
→ Auto-classifies scope, spawns PM/SM/UX/UI/Architect at G1 (kit_status + run_checks via Makerkit MCP), then Frontend/Backend/DB at G2, Security/QA/E2E at G3, DevOps/Writer at G4. /code-review runs inline in BUILD.
→ Per-phase artifacts (PRD, design spec, threat model, test plan, delivery summary) logged to MEMORY/ARTIFACTS/artifacts.jsonl, with PR opened only after G4 passes.
```

**Example 2: Auditing a feature without writing code**

```
User: "Security review the billing module."
→ Invokes SecurityAudit workflow
→ Spawns the security agent (skeptical/adversarial traits, audits MCP cluster: run_checks, kit_db_status, kit_env_schema) with the DB Engineer in parallel (Phase 1b) — the DB Engineer always runs, landing either a schema.prisma diff or an explicit "no schema changes required" memo in the audit artifact.
→ A threat model + remediation list + DB memo, scoped to the kit's actual surface (auth, RLS, env exposure), with no code writes.
```

**Example 3: Surgical bug fix with classification override**

```
User: "Quick fix: timezone bug in scheduled-report cron."
→ Invokes QuickFix workflow (≤2 files, surgical)
→ Backend agent owns the diagnosis-and-fix; QA validates; no Frontend/UX involvement. If ISC fails, routes back to Backend (3-strike escalation rule). Operator can override classification at G1 if BugFix is the right scope instead.
→ Two-file diff with regression test, mapped through Phase 4 BUILD without convening the full 13-agent team.
```

**Example 4: PR review-execute loop (the v0.4.0 surface)**

```
Operator: "review pr #42 in kit"
→ Invokes ReviewSinglePR workflow
→ Spawns full 13-agent team in parallel; each emits TODOs in the canonical (agent:X) (priority:Y) format.
→ Aggregator computes team verdict (typed Verdict union: PASS | BLOCK | CHANGES{minor|substantial}).
→ Renders one PR comment via gh pr comment --edit-last --create-if-none + writes MEMORY/ARTIFACTS/makerkit-pr-42-todos.json.

Operator: "execute todos for pr #42"
→ Invokes ExecuteOpenTodos workflow
→ Checks out side branch fix/pr-42-todos from origin/{head_ref} (rebases if exists).
→ Groups TODOs by agent, sorts batches by priority, spawns each batch SERIALLY.
→ Per-batch: agent commits → pnpm healthcheck + scoped tests → on failure, revert + mark blocked.
→ Pushes side branch, regenerates PR comment from updated artifact, stops at merge boundary.
→ Operator decides whether to merge fix/pr-42-todos into the PR head — workflow never does.
```

## The Team (13 roles)

Loaded from `Data/Roster.json`. Each role: id · saved-composition slug · traits · owns/consumes/produces.

| id | Role | Traits |
|---|---|---|
| `pm` | Product Manager | product · analytical · systematic |
| `sm` | Scrum Master | communications · empathetic · consultative |
| `ux` | UX Designer | creative · empathetic · exploratory |
| `ui` | UI Designer | creative · meticulous · thorough |
| `architect` | Software Architect | technical · analytical · thorough |
| `frontend` | Frontend Developer | technical · pragmatic · systematic |
| `backend` | Backend Developer | technical · meticulous · systematic |
| `database` | Database Engineer | data · analytical · thorough |
| `security` | Security Engineer | security · skeptical · adversarial |
| `qa` | QA Engineer | technical · skeptical · thorough |
| `e2e` | E2E Tester | technical · contrarian · investigative |
| `devops` | DevOps / SRE | technical · cautious · systematic |
| `writer` | Tech Writer | communications · meticulous · synthesizing |

## Coordination Policy (v0.8.0 — locked)

1. **Auto-classify scope.** No confirmation prompt. PRD `## Decisions` records the classification with reasoning. Operator overrides at G1 if wrong.
2. **DB Engineer always runs.** No skip — even when no schema changes are needed, output is an explicit "no schema changes required, here's why" memo.
3. **`/code-review` is part of Phase 4 BUILD.** Runs after Frontend + Backend return; original implementer addresses findings before G4. Not a separate gate.
4. **Trait-derived identities (voice retired 2026-07-02).** Audible voice output was retired platform-wide; each role's identity is its trait-derived prompt composition (`~/.claude/custom-agents/<slug>.md`, reproducible via `RosterBootstrap.md`). Distinct per-role perspectives are kept — 13 trait-composed identities, not a uniform delivery persona.
5. **ISC failures route to original implementer.** Frontend or Backend (by code ownership) gets a surgical-fix re-spawn with failure context. After 3 consecutive failures from same agent, escalate to operator.
6. **Test pyramid is non-negotiable.** Every change-producing workflow gates on the ships-with-tests rule in `Workflows/_test-pyramid-gate.md`. Two-tier per Makerkit canon — Vitest unit + Playwright e2e. No PR opens / no QuickFix completes / no BugFix verifies / no Refactor closes / no DeliverFeature reaches G7 unless: unit-layer green, e2e-layer green, `run_checks` clean, `data-testid` on new interactive elements, bootstrap helpers used for e2e auth, per-ISC layer mapping in PRD `### Test Pyramid Plan`. PR-loop reviewers (qa, e2e) auto-emit high-priority TODOs for missing-layer files — the file-level heuristic is defined ONCE as `findMissingUnitTests()` in `Tools/_shared.ts`, run via `bun Tools/MakerkitCli.ts pyramid-missing-tests` (never re-derived in prose).
7. **Algorithm-driven execution + capability-probed fan-out for parallel phases.** Workflows respect the active DOS Algorithm doctrine resolved via `~/.claude/DOS/Algorithm/LATEST` — every multi-agent phase runs the §6.3 PARALLELISM PRE-CHECK, then selects a rung from the degradation ladder in `Workflows/_algorithm-team-spawn.md`, branching on the capability manifest from `bun Tools/MakerkitCli.ts preflight`: L1 team-parallel choreography only when a future harness exposes team primitives; L2 (DEFAULT today) Task/Agent fan-out — multi-agent parallel phases (DeliverFeature 2/4/5/7, BugFix 4, Refactor 4, ReviewSinglePR 2, ReviewOpenPRs 4) spawn kit roles via `subagent_type: "general-purpose"` + `name: <role-id>` + `run_in_background: true` with the saved-composition prompt, rendezvous via structured returns or `MEMORY/WORK/{slug}/reports/<role>.md` before the phase gate; L3 serial solo when an escape clause fires (documented in PRD `## Decisions`). Never write a workflow step that hard-depends on team primitives the harness may not expose. PRDs follow Algorithm §2 PRD format (RFC-0080 vNext / RFC-0086 Amendment A) with atomic ISCs verified at gates.
8. **Commit + merge hygiene.** Every workflow that lands a commit, opens a PR, posts a PR comment, or merges follows the contract in `Workflows/_commit-merge.md`. Conventional Commits prefix + concise subject (kit AGENTS.md rule) + HEREDOC body + `Co-Authored-By: DuranteOS <tech@duranteos.com>` trailer. Explicit-list staging, NEVER `-A` or `.`. NEW commit (not `--amend`) after pre-commit hook failure. PR creation via `gh pr create` with `## Summary` + `## Test plan` H2 sections. PR comments via `gh pr comment --edit-last --create-if-none` (single comment per session). Merge gate is Gated tier per `Workflows/_pr-loop-shared.md`: explicit `AskUserQuestion` approval + all required CI checks green; never inferred from team verdict. Push safety: NEVER `--force`, NEVER to PR head branch, NEVER `--no-verify`. `chmod 755` on new `*.hook.ts` / `*.daemon.ts` before staging.
9. **GitHub collaboration discipline.** Every workflow that interacts with a PR over time follows `Workflows/_github-collaboration.md`. Read external comments via `gh pr view {N} --json comments,reviews,statusCheckRollup` BEFORE any write. Keep the auto-managed TODO comment in lockstep with the artifact JSON — re-render on every state change. Three comment types: auto-managed TODO comment (one per session, edit-last), reply to reviewer (engage every reviewer point with one of four categories — acknowledged-queued / done / push-back / surface-to-operator; never silent), status update folded into Type 1 (status header in comment preamble, never separate). PR body / title freshness via `gh pr edit {N} --body` / `--title` when scope shifts. Label discipline matches kit's existing taxonomy. Issue linking via `Closes #N` / `Fixes #N` / `Refs #N`. Status cadence: refresh the auto-managed comment at every batch boundary, every blocker, and session end — the comment IS the heartbeat.

10. **Skill composition discipline.** Per `Workflows/_skill-composition.md`, kit agents compose other DOS skills as tools where the role's deliverable benefits from a specific composed skill's output: UI Designer → Media + DesignSystem (Phase 2); UX Designer → Brand (Phase 2); PM → Research (Phase 1); Writer → Dispatch.Enhance + Research (Phase 7 / DocsRefresh); Security → security skill (Phase 5 / SecurityAudit); Frontend → react-form-builder + frontend-design; Backend → server-actions-expert; Database → prisma-expert; E2E → playwright-e2e-expert (Phase 6 / TestAndValidate — Playwright execution stays the canonical pnpm path; the Browser tie was removed, QA composes nothing). The same Council-G2 pattern applies at the per-agent scope: Conditional fire (skip silently when not applicable) + Cost guard (per-tie numeric ceiling, `AskUserQuestion` triage when exceeded) + Failure mode (composed-skill errors degrade to `⚠️ unverified`/flagged-deferred, never block the parent phase) + Skip path. The `composed_skills` array per role in `Data/Roster.json` enumerates the authorized DOS skills; the partial's per-role sections define the trigger, cost guard, failure mode, and skip path.

11. **Agentic bridge + digest currency (v0.7.0).** The kit owns an always-fresh agent-onboarding surface the team must defer to, not duplicate: every `BuildBrief.ts` brief opens with a "Read first — the kit agentic bridge" block routing the agent to the **local package `AGENTS.md`** (auto-loaded via its `CLAUDE.md`=`@AGENTS.md` shim) + the matching `docs/development-guide/*.mdoc` (behavioral SoT), and surfaces the kit's drift anti-patterns (`redirect`/`isRedirectError`, `revalidatePath`, `'use server'`/`'server-only'` split, the service pattern for server-side APIs per root `AGENTS.md`). The kit toolchain is oxlint+oxfmt — there is no eslint and no depcruise script; `pnpm healthcheck` MUTATES files, the read-only ladder is `pnpm lint && pnpm typecheck && pnpm test:unit`. `FrameworkDigest.md` is no longer a competing stack-of-record: its load-bearing version/fact pins are machine-checked against the resolved kit repo's AGENTS.md by `Tools/VerifyDigest.ts`, run as DocsRefresh Phase 0 so the digest can't silently rot (it is sliced into all 13 briefs).

12. **Resolve, then probe.** Every workflow Phase 0 runs `bun Tools/MakerkitCli.ts preflight`; repo = cwd unless `$KIT_REPO` explicitly overrides (the `Tools/ResolveRepo.ts` ladder). The skill OWNS orchestration, gates, and artifact schemas; it DEFERS stack facts, conventions, and commands to the resolved repo (its `AGENTS.md` tree, `docs/`, `package.json`).

Decisions 1–5 came from operator review of v0.0.1's open questions. Decisions 6–7 came from v0.5.0 (Test Pyramid Gate + Algorithm/DAG integration). Decision 8 came from v0.5.1 (commit + merge hygiene). Decision 9 came from v0.5.2 (GitHub collaboration discipline). Decision 10 came from v0.6.0 (skill composition — Council G2 pattern at per-agent scope). Decision 11 came from v0.7.0 (docs-alignment + agentic bridge). Decision 12 came from v0.8.0 (host resilience — resolve-then-probe). Decisions 4 and 7 were rewritten at v0.8.0 (voice retirement; spawn degradation ladder). Documented in `CHANGELOG.md`. Future tuning lands in `Decisions` section there.

## Makerkit MCP Integration (v0.3.0)

The Makerkit MCP server (`mcp__makerkit__*`) exposes 50+ tools spanning project status, dev server lifecycle, Prisma DB, components, env, email/mailpit, translations, scripts/checks, and PRDs/stories. The skill wires this MCP into three layers:

1. **Skill-level** — this section + the cluster catalogue at `Data/McpToolMap.json` (10 named clusters, 50+ tools)
2. **Workflow-level** — every workflow has a `### MCP Touchpoints` subsection per phase where MCP tools fit naturally. Verification phases mandate `mcp__makerkit__run_checks` (the canonical "is the codebase healthy?" tool); if the server is not connected (check the capability manifest from `bun Tools/MakerkitCli.ts preflight`), verification falls back to the read-only ladder `pnpm lint && pnpm typecheck && pnpm test:unit` — NEVER `pnpm healthcheck` in review/read-only contexts (it mutates files). Other touchpoints are SHOULD with prerequisite-aware fallback (kit_dev_status before kit_dev_start, kit_db_status before kit_db_migrate, kit_mailbox_status before mailpit assertions).
3. **Agent-level** — `Data/Roster.json` adds an `mcp_tools: [cluster, ...]` field per role. `Tools/BuildBrief.ts` reads `Data/McpToolMap.json` and renders an `## Authorized MCP Tools` section per role. Tools NOT in the role's authorized clusters are out of scope — agents surface findings to the orchestrator instead of overreaching.

**Anti-overlap with DOS PRD ledger:** The `prds_stories` cluster (Makerkit-native PRDs/stories) is authorized for `pm` and `sm` roles ONLY for projects that independently maintain Makerkit-native PRDs. The DOS PRD ledger at `MEMORY/WORK/{slug}/PRD.md` is the system of record — `mcp__makerkit__create_prd` is NEVER used for the DOS PRD itself.

**Destructive tools require operator gate:** `kit_db_reset`, `kit_translations_remove_locale`, `kit_translations_remove_namespace`, `kit_env_raw_write`, `apply_migrations` (production) — even when authorized.

## Quick Reference

- **Roster manifest:** `Data/Roster.json`
- **Roster bootstrap:** `RosterBootstrap.md` — 13 copy-pasteable `ComposeAgent --save` commands to reproduce missing saved compositions + the documented degraded path
- **MCP tool map:** `Data/McpToolMap.json` — cluster→tools→notes (single source of truth)
- **Saved compositions:** `~/.claude/custom-agents/<slug>.md`
- **Repo resolver:** `Tools/ResolveRepo.ts` — resolution ladder: explicit path > `$KIT_REPO` (stderr-logged override) > `git rev-parse --show-toplevel`; profiles root/name/kind/scripts/lintTool/packageManager
- **Preflight:** `bun Tools/MakerkitCli.ts preflight` — one JSON capability manifest (repo, roster health, cited scripts, doctrine pointer, MCP probe-at-runtime, spawn default); run at every workflow Phase 0
- **Framework digest:** `FrameworkDigest.md` — generated pin block + curated pointers, regenerated by `Tools/BuildDigest.ts` at DocsRefresh Phase 0; §13 = agentic bridge + kit↔fork seam
- **Digest verifier:** `Tools/VerifyDigest.ts` — asserts the digest's version/fact pins against the resolved kit repo's AGENTS.md (`bun run Tools/VerifyDigest.ts`; exit 0 = pins verified, 1 = drift, 2 = VACUOUS: 0 pins extractable). Run as DocsRefresh Phase 0.
- **Repo:** resolved by `Tools/ResolveRepo.ts` — cwd git toplevel unless `$KIT_REPO` explicitly overrides (no hardcoded default path)
- **Gate subcommands:** `bun Tools/MakerkitCli.ts <decompose-gate|pyramid-gate|layer-map-check|pyramid-missing-tests|contract-check>` — JSON-stdin → typed verdict; exit 1 = FAIL, exit 3 = VACUOUS (0 items to verify; gate did not run)
- **Brief builder:** `Tools/BuildBrief.ts` — composes per-agent invocation message from PRD + role + framework digest slice + authorized MCP cluster
- **Roster reader:** `Tools/InvokeAgent.ts` — resolves role id → system prompt
- **PR loop primitives** (v0.4.0+):
  - `Tools/ParsePrTodos.ts` — markdown checklist → typed `Todo[]`
  - `Tools/ClassifyPrShape.ts` — file paths → `ReviewerSet` (which kit roles to spawn)
  - `Tools/RenderTodoComment.ts` — `Todo[] + meta` → markdown for `gh pr comment`
  - `Tools/PrLoopSideBranch.ts` — fresh side-branch naming per ExecuteOpenTodos run (base, `-r2`, `-r3`, ...)
  - `Tools/_shared.ts` — `readStdin()`, `Verdict` discriminated union, `formatVerdict()`, `findMissingUnitTests()` (the ONE pyramid heuristic), `EXIT_VACUOUS`/`vacuousMessage()`
- **PR loop shared partial:** `Workflows/_pr-loop-shared.md` — safety tier table, side-branch convention, artifact JSON schema, TODO checklist markdown protocol
- **Test Pyramid Gate partial** (v0.5.0): `Workflows/_test-pyramid-gate.md` — two-tier pyramid contract, six ships-with-tests checks, canonical commands, do/don't list, per-ISC layer mapping rubric, file-level PR-loop heuristic
- **Algorithm Team Spawn partial** (rewritten v0.8.0): `Workflows/_algorithm-team-spawn.md` — capability-probed spawn degradation ladder (Phase 0 preflight probe; L1 team choreography only when the manifest confirms team primitives / L2 DEFAULT Task-Agent fan-out with report-file or structured-return rendezvous / L3 serial solo), per-stream prompt template, non-response policy (timeout budgets, N-of-M quorum, one re-spawn, then operator escalation), solo escape-clause table, kit-flavored anti-patterns (#1: never hard-depend on team primitives the harness may not expose)
- **Commit + Merge Hygiene partial** (v0.5.1): `Workflows/_commit-merge.md` — Conventional Commits format + HEREDOC + Co-Authored-By trailer, explicit-list staging, pre-commit hook failure handling (NEW commit not amend), PR creation template (`## Summary` + `## Test plan`), PR comment edit-last protocol, merge gate (Gated tier), push safety, per-step commits in Refactor, chmod 755 for new hooks, working-tree-clean expectation
- **GitHub Collaboration partial** (v0.5.2): `Workflows/_github-collaboration.md` — read-before-write (`gh pr view --json` before any write), TODO state lockstep (artifact + comment in lockstep), three comment types (auto-managed TODO + reply-to-reviewer + status-folded), four reply categories (acknowledged-queued / done / push-back / surface-to-operator; never silent), PR body/title freshness via `gh pr edit`, label discipline (match kit taxonomy), issue linking (`Closes` / `Fixes` / `Refs`), status cadence for multi-batch runs, 10-pattern anti-pattern catalog
- **Skill Composition partial** (v0.6.0, ties updated v0.8.0): `Workflows/_skill-composition.md` — per-role authorized DOS skills with the Council-G2 pattern at per-agent scope: PM→Research (Phase 1), UI→Media+DesignSystem (Phase 2), UX→Brand (Phase 2), Security→security skill (Phase 5/SecurityAudit), Frontend→react-form-builder+frontend-design, Backend→server-actions-expert, Database→prisma-expert, E2E→playwright-e2e-expert (Phase 6/TestAndValidate), Writer→Dispatch.Enhance+Research (Phase 7/DocsRefresh). Each tie: Conditional fire + Cost guard (per-tie numeric ceiling) + Failure mode (degrade to `⚠️ unverified`, never block) + Skip path. `composed_skills` array per role in `Data/Roster.json` enumerates the authorizations.

## Scope-Tuning Disclaimer

At v0.8.0 the skill carries six shared partials (`_pr-loop-shared`, `_test-pyramid-gate`, `_algorithm-team-spawn`, `_commit-merge`, `_github-collaboration`, `_skill-composition`) and thirteen `.ts` files under `Tools/` — twelve typed tools plus the `_shared.ts` primitives module, with the bun suite green at cut time (structural counts machine-asserted by `Tools/__tests__/ContractEval.test.ts`; volatile test counts are not restated here — run `bun test`). The executable perimeter is the `MakerkitCli` gate subcommands + `preflight` + `VerifyDigest`/`ResolveRepo`; judgment-heavy contracts (reviewer reply discipline, merge gate, threat-real) stay orchestrator-enforced prose. Next tightening lanes: ISC verifier patterns promoted from prose to tooling per role; Pre-Delegation Contract templates extracted into `Templates/`; framework-digest slice rendering parameterized through `Tools/BuildBrief.ts`; a cross-tool exit-code table (VerifyDigest VACUOUS = 2 vs gate VACUOUS = 3 asymmetry).

## Four-Copy Compliance

This skill exists in up to four locations per the DOS Four-Copy Rule (`Durante/CLAUDE.md`):

1. `~/.claude/skills/makerkit-team/` — live install (what Claude Code runs)
2. `Releases/<active-version>/.claude/skills/makerkit-team/` — active release submodule (versioned)
3. `Packs/*/src/MakerkitTeam/` — pack source (distributable)
4. `Packs/agents/MakerkitTeam/` — agent runtime (only if applicable)

After editing any file in this skill, verify all copies via `bun ~/Durante/Tools/sync-check.ts`. Exit code 0 = clean. Exit code 1 = drift; resolve with `--fix` before commit.
