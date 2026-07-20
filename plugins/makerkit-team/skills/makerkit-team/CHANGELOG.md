# MakerkitTeam — Changelog

## v0.8.0 — 2026-07-02

Host-resilience wave. The skill stops assuming a specific host: the kit repo is resolved
(not hardcoded), harness capabilities are probed (not presumed), the spawn contract degrades
gracefully, the digest verifier reports vacuity honestly, prose gates were wired-or-deleted,
and voice — retired platform-wide 2026-07-02 — is stripped end-to-end.

### Added

- **`Tools/ResolveRepo.ts`** (+ `__tests__/ResolveRepo.test.ts`) — `resolveKitRepo(explicit?)` ladder: explicit path > `$KIT_REPO` (stderr-logged override) > `git rev-parse --show-toplevel` > actionable throw. Profiles `{root, name, kind fork|upstream|unknown, scripts, lintTool oxlint|eslint|unknown, packageManager}`; runnable as a CLI printing JSON. (ISC-1..3)
- **`Tools/BuildDigest.ts`** — derives `FrameworkDigest.md`'s machine-checkable pins (catalog versions, workspace count, docs corpus counts, AGENTS.md file count, toolchain detection, healthcheck script text) from the resolved repo and rewrites ONLY the `<!-- generated:pins:start/end -->` region — the curated prose around it is hand-maintained and never touched. `bun Tools/BuildDigest.ts [--repo <path>] [--json]`; exit 0 = region rewritten, 1 = repo unresolvable or markers missing. Companion to `VerifyDigest.ts`; runs at DocsRefresh Phase 0.
- **`Tools/MakerkitCli.ts preflight`** (+ `__tests__/MakerkitCli-preflight.test.ts`) — one JSON capability manifest per run: repo resolution, roster health (8 required role fields, slug→saved_agents_dir, composed_skills→skills dir), 4 cited scripts, doctrine `LATEST` pointer, `mcp: "probe-at-runtime"`, `spawn: "task-fanout-default"`. Missing compositions degrade to warnings with `RosterBootstrap.md` remediation; exit 1 only on unresolvable repo or invalid roster. (ISC-4..7, OH-4)
- **`RosterBootstrap.md`** — 13 copy-pasteable `ComposeAgent -r "<traits>" --save` commands, a preflight verification step, and the documented degraded path (BuildBrief works from `Data/Roster.json` alone). (OH-1)
- **`Tools/_shared.ts` `findMissingUnitTests()` + `unitSiblingPath` + `EXIT_VACUOUS`/`vacuousMessage`** (+ `__tests__/SharedGates.test.ts`, 21 tests) — ONE canonical missing-unit-test heuristic consumed by both `MakerkitCli pyramid-missing-tests` and `ReviewOpenPRsCli qa-gaps`; every gate subcommand exits 3 with `VACUOUS: <gate> — 0 <what> to verify` on empty input, never a silent 0. (TV-5)
- **Strike-ledger contract** — `MEMORY/WORK/{slug}/strike-ledger.json`, reset-on-pass, escalation reads the file; wired in DeliverFeature with pointers from BugFix/Refactor/QuickFix. (OH-5)
- **`SKILL` Coordination Policy decision #12** — "Resolve, then probe": every workflow Phase 0 runs `bun Tools/MakerkitCli.ts preflight`; repo = cwd unless `$KIT_REPO` overrides; the skill OWNS orchestration/gates/artifact schemas and DEFERS stack facts/conventions/commands to the resolved repo.
- **`SkillLifecycle.md`** — the interop protocol between the two skill-creation systems: Utilities CreateSkill owns create/update/validate (pack-source-only pipeline); the official skill-creator plugin is restricted to eval methodology over `evals/evals.json`; its copy-to-/tmp update flow is FORBIDDEN on this generated four-copy skill (SL-4).
- **ContractEval (h)(i)(j)** — version parity across SKILL.partials.md / generated SKILL.md / CHANGELOG (SL-2 guard); voice-retirement sweep (no `voice` tool tokens outside CHANGELOG); pin-restatement lint (stack-version pins only inside the digest generated region — the charter's pointer-not-restatement rule, mechanized for its proven rot class).
- **Preflight manifest `mcp`/`spawn` fields are self-describing probe objects** — a CLI cannot see harness tool surfaces, so the manifest now carries the probe INSTRUCTION the orchestrator executes at run start (status/probe/fallback), not a constant pretending to be a probe.
- **Preflight is mandatory Phase 0 in all 14 workflows** — the retired voice-notify step in the 10 remaining workflows was replaced by the preflight step, making the SKILL.md "every workflow Phase 0" claim true.
- **`extension.yaml` `dependencies` section** — external deps (KIT_REPO env, custom-agents dir, mcp__makerkit, doctrine LATEST, bun) each with probe, failure mode, and fallback.

### Changed

- **`Workflows/_algorithm-team-spawn.md`** — rewritten as a capability-probed spawn DEGRADATION LADDER: Phase 0 preflight probe; L1 team choreography only when the manifest confirms team primitives (current harness ground truth: it does not — no `TeamCreate`, `Agent` `team_name` deprecated/ignored); L2 DEFAULT Task/Agent fan-out (`subagent_type: general-purpose`, `name: <role-id>`, `run_in_background`, rendezvous via structured returns or `MEMORY/WORK/{slug}/reports/<role>.md`); L3 serial solo with the escape-clause table. New binding non-response policy (timeout budgets, N-of-M quorum, one re-spawn, operator escalation). Anti-pattern #1 inverted: never hard-depend on team primitives the harness may not expose. (OH-2, SC-01, WF-07)
- **`Tools/VerifyDigest.ts`** — rewired to `resolveKitRepo` (hardcoded `~/Developer/dos-prisma-saas-kit` default deleted); exit contract now 0 = N>0 pins verified, 1 = drift, 2 = `VACUOUS: 0 pins extractable` — digest unverified is reported, never silently passed. (SC-02, WF-08)
- **`FrameworkDigest.md`** — header + §1 rebuilt around the `generated:pins` region (rewritten by `BuildDigest.ts`, never hand-edited); literal `.dependency-cruiser.cjs` / `depcruise` / eslint cites replaced with explicit does-not-exist-in-this-repo negations — the kit toolchain is oxlint+oxfmt and layer boundaries are convention-enforced per root `AGENTS.md`. (DC-03, SC-04, SC-05)
- **`Data/Roster.json`** — all 13 `voice_id` fields removed (SL-8, voice retired 2026-07-02); `Browser` dropped from qa/e2e `composed_skills` — no such skill exists (TV-6); `sm` entry shrunk to blocker tracking + status synthesis with coordination moved to an orchestrator note (OH-6); `database` entry made phase-consistent — produces "schema.prisma diff or no-changes memo (consumed by backend)" (OH-8).
- **`Workflows/{DeliverFeature,BugFix,Refactor,QuickFix}.md`** — `pnpm healthcheck` (MUTATING) runs exactly once before the batch commit, never in read-only contexts (DC-04); canonical run_checks fallback ladder pasted at all 5 MUST sites (TV-2); `<feature>-server-actions.ts` naming (DC-07); Next.js-docs-first step in every implementation phase (DC-08); kit `Skill("reviewer")` alongside every /code-review site (DC-11); doctrine cites → `~/.claude/DOS/Algorithm/LATEST` (SC-06); "3 findings" phrasing dropped (SC-07); `MEMORY/WORK/{slug}/` paths (WF-11); G1–G7 gate mechanics recorded to the PRD Gate log (OH-7); `layer-map-check` + `contract-check` wired with exact commands; all TeamCreate/SendMessage spawn blocks rewritten to the L2 fan-out ladder.
- **`Workflows/{ReviewOpenPRs,ReviewSinglePR,ExecuteOpenTodos,_pr-loop-shared}.md`** — deterministic `ARTIFACT_JSON_PATH` assignment (WF-01); explicit artifact-producer step before `writeArtifactJson` (WF-02); rebase mandate deleted — every ExecuteOpenTodos run cuts a FRESH side branch via `Tools/PrLoopSideBranch.ts` (WF-03); PR-head checkout before run_checks and the pyramid heuristic (WF-04); per-batch checks replaced with commands that exist (WF-09); review-scoped Reviewer Per-Stream Prompt Template (WF-10); empty-set report-and-exit before any spawn (WF-12).
- **`Workflows/{_test-pyramid-gate,CodeReview,TestAndValidate,DocsRefresh,SecurityAudit,_commit-merge,_skill-composition,ShowRoster}.md`** — missing-unit-test heuristic defined ONCE via `pyramid-missing-tests`, prose re-derivation forbidden (TV-5); fallback ladder at all run_checks MUST sites (TV-2); DocsRefresh Phase 0 = `BuildDigest.ts --repo <resolved>` then VerifyDigest exit 0/1/2 with VACUOUS→STOP; SecurityAudit Phase 1b always-on DB Engineer memo; Browser tie removed (e2e→playwright-e2e-expert, qa→none); doctrine and kit-repo cites made pointer-neutral; ShowRoster voice column dropped + RosterBootstrap remediation added.
- **`SKILL.partials.md`** — status → v0.8.0; policy #7 → capability-probed fan-out ladder; policy #4 → voice retired, trait-derived identities; NEW policy #12; policy #10/#11 corrected to live composed-skill ties and the real kit toolchain (oxlint+oxfmt — no eslint, no depcruise script; the `*.service.ts` strong-form and `pnpm depcruise:check` cites removed); Quick Reference gains ResolveRepo/preflight/BuildDigest/RosterBootstrap/gate exit contract; Scope-Tuning Disclaimer recomputed (6 partials, 13 `.ts` files; volatile test counts dropped from prose — ContractEval asserts the structural counts); description gains kit-qualified triggers + NOT-clause (SL-10); `voice.emit` capability dropped.

### Removed

- **`MakerkitCli.ts commit-msg-check`** — deleted end-to-end (subcommand dispatch, `validateCommitMsg`/`renderCommitMsg`/`COMMIT_TYPES`/`MAX_SUBJECT_LEN`, usage line, its 6 tests) per the wire-or-delete adjudication: no workflow phase invoked it. The prose rule in `Workflows/_commit-merge.md` stays authoritative.
- **Voice, end-to-end** — 13 `voice_id` roster fields, workflow voice-notification Phase 0 steps, "13 audible identities" claims, `voice.emit` capability. Voice was retired platform-wide 2026-07-02.

### Verification

- `bun test`: 197 pass / 0 fail across 13 files (127 at v0.7.1 → +22 repo-resolution/preflight, +21 SharedGates, +BuildDigest, +18 ContractEval, −6 commit-msg-check).

### Finding IDs closed (waves 1–3)

ISC-1..7, OH-1/2/4/5/6/7/8, SC-01/02/04/05/06/07, WF-01..04, WF-07..12, TV-2/5/6/7, DC-03/04/05/07/08/11, SL-8/SL-10, plus the MG2 wire-or-delete adjudication.

## v0.7.1 — 2026-06-26

Verifier promotion (MG2). Four named PR-loop contracts that were prose the orchestrator
self-enforced are now executable `MakerkitCli` gate subcommands — extending the proven
`decompose-gate`/`pyramid-gate`/`classify-scope`/`pr-body` host (JSON-stdin → typed verdict,
exit 1 on FAIL). Judgment-heavy contracts (reviewer reply discipline, merge gate, threat-real)
stay orchestrator-enforced prose (Knuth 97/3).

### Added

- **`MakerkitCli.ts layer-map-check`** — fails when any ISC lacks a Test-Pyramid-Plan row or carries an out-of-vocab label (the four `_test-pyramid-gate.md` rubric labels).
- **`MakerkitCli.ts pyramid-missing-tests`** — emits byte-faithful missing-sibling-test QA TODOs from a changed-paths diff (packages source without its `__tests__/*.test.ts` sibling).
- **`MakerkitCli.ts commit-msg-check`** — verifies Conventional-Commits prefix + ≤70-char subject + `Co-Authored-By:` trailer (`_commit-merge.md`). *(Deleted in v0.8.0 — wire-or-delete; the prose rule in `_commit-merge.md` remains authoritative.)*
- **`MakerkitCli.ts contract-check`** — validates `files_written` against the role's ownership glob derived from `Data/Roster.json` (`owns`+`produces`).
- **19 new tests** (`__tests__/MakerkitCli.feature6.test.ts`) — every subcommand has both a pass and a fail fixture (no pass-only coverage); the existing PR-loop suite stays byte-unchanged. `bun test` 108 → 127 pass / 0 fail.

## v0.7.0 — 2026-06-26

Docs-alignment + agentic-bridge wave. The kit's `docs/` were substantially improved for agentic behaviour (root AGENTS.md task→doc map, 66 `CLAUDE.md`=`@AGENTS.md` shims, 60-pkg roster, Sentinel 74-workspace refresh, drift anti-patterns, dependency-cruiser gate). MakerkitTeam's `FrameworkDigest.md` — sliced into all 13 agent briefs by `BuildBrief.ts` — had drifted (Prisma 6.x, no Base UI version, no Oxc, no bridge awareness). This wave re-aligns the skill to the live kit and makes the digest drift-proof.

### Added

- **`Tools/VerifyDigest.ts`** (+ `__tests__/VerifyDigest.test.ts`, 5 tests) — asserts the digest's machine-checkable pins (Prisma major, Base UI / Next / Better Auth versions, zod major, workspace count, Oxc) against `$KIT_REPO`/AGENTS.md. `bun run Tools/VerifyDigest.ts`; exit 1 = drift. Wired into `DocsRefresh.md` Phase 0.
- **`FrameworkDigest.md` §13** — "The Agentic Bridge + kit↔fork seam": per-package `AGENTS.md` + `docs/development-guide` routing, service pattern, kit↔fork seam (ADR-0003/0004). Added to `DIGEST_SLICE_BY_ROLE` for architect/frontend/backend/database/security/devops/writer.
- **`BuildBrief.ts` "Read first — the kit agentic bridge"** block in every brief — routes each agent to the local package `AGENTS.md` + matching dev-guide before editing; surfaces the drift anti-patterns (`redirect`/`isRedirectError`, `revalidatePath`, `'use server'`/`'server-only'`, `*.service.ts`, `depcruise:check`).
- **Coordination Policy decision #11** — agentic bridge + digest currency.

### Changed

- **`FrameworkDigest.md` §1 / header** — refreshed pins: Prisma 6.x→7 (`^7.8.0`), Base UI→1.6.0, Next.js→16.2, +zod 4 / Better Auth 1.6 / Oxc / 74 workspaces / depcruise; tooling dirs corrected; header counts 154 mdoc/25 domains → 196 docs/33 domains.
- **`BuildBrief.ts` + `Data/Roster.json` + `_skill-composition.md`** — un-gated the four shipped kit-specialist skills (`react-form-builder`, `server-actions-expert`, `prisma-expert`, `playwright-e2e-expert`); added them to the relevant roles' `composed_skills`.
- **`ReviewSinglePR.md`** — added `## Intent-to-Flag Mapping` (R14 lint).

## v0.6.0 — 2026-05-15

Skill Composition partial. Wires six inter-skill composition ties at the per-agent scope using the same Council-G2 pattern (Conditional fire + Cost guard + Failure mode + Skip path) that ships in `Packs/thinking/src/Council/Workflows/Debate.md` Step 1b. Builds on G4 (`commit 955a1ade`) which had already wired MakerkitTeam→Thinking-Council at the workflow scope; v0.6.0 extends composition INTO the agent phases.

### Added

- **`Workflows/_skill-composition.md`** — single source of truth for per-role authorized DOS skills. Defines the universal pattern (Trigger + Skip path + Cost guard + Failure handling) and a per-role section for each of six ties: UI Designer → Media + DesignSystem (Phase 2); UX Designer → Brand (Phase 2); PM → Research (Phase 1); Writer → Dispatch.Enhance + Research (Phase 7); Security → security skill (Phase 5); QA + E2E → Browser (Phase 6). Each section: trigger conditions, cost guard ceiling, failure mode, skip path, example invocation. Includes 5-pattern anti-pattern catalog (firing-on-every-phase, mega-brief bundling, treating composed output as ground truth, opaque recursion, skipping the cost guard).
- **`SKILL.md` Coordination Policy decision #10** — "Skill composition discipline." Ten locked decisions: 1-5 (v0.0.1 ops policy), 6 (Test Pyramid Gate, v0.5.0), 7 (Algorithm + DAG, v0.5.0), 8 (Commit + Merge, v0.5.1), 9 (GitHub Collaboration, v0.5.2), 10 (Skill Composition, v0.6.0).
- **`Data/Roster.json` `composed_skills` field per role** — new array parallel to `mcp_tools`:

  | Role | composed_skills |
  |---|---|
  | pm | research |
  | ux | brand |
  | ui | Media, DesignSystem |
  | security | security |
  | qa | Browser |
  | e2e | Browser |
  | writer | Dispatch, Research |

### Changed

- **`Workflows/DeliverFeature.md`** — added `### Skill Composition` subsection to Phases 1 (PM→Research), 2 (UI→Media+DesignSystem, UX→Brand), 5 (Security→security skill), 6 (QA+E2E→Browser), 7 (Writer→Dispatch+Research). Each cites the partial; cost guard + failure mode + skip path stated inline for the phase-specific tie.
- **`Workflows/DocsRefresh.md` Phase 1** — added `### Skill Composition` for Writer → Dispatch.Enhance + Research (citation-grounding for external framework/SDK references).
- **`Workflows/SecurityAudit.md` Phase 1** — added `### Skill Composition` for Security → security skill (web assessment + vendor threat intel) alongside the existing cross-skill cite.
- **`Workflows/TestAndValidate.md` Phase 1** — added `### Skill Composition` for E2E → Browser (drives the in-scope Playwright specs).
- **`SKILL.md` Status v0.5.2 → v0.6.0** — bumped + status line now lists SIX shared partials (was FIVE).
- **`SKILL.md` Coordination Policy header** v0.5.2 → v0.6.0.

### Decisions Locked

- **D1 (v0.6.0):** Shared partial, not per-workflow inline. The Council G2 pattern ships its rules in one place (`Debate.md` Step 1b); MakerkitTeam mirrors that — one `_skill-composition.md` cited from each affected workflow rather than restating the cost guard / failure mode / skip path per workflow.
- **D2 (v0.6.0):** Per-agent scope, NOT per-workflow scope. G4 already wired MakerkitTeam→Thinking-Council at the workflow scope (operator-gate escape). v0.6.0 extends composition INTO the agent phases (PM, UI, UX, Security, QA, E2E, Writer) where the role's deliverable benefits from a specific composed skill's output. Architect+Backend+Frontend+DB+DevOps+SM stay tool-only at v0.6.0 — their work is the kit-native target, not a composition surface (re-evaluate in v0.7.0 if patterns emerge).
- **D3 (v0.6.0):** `composed_skills` array parallel to `mcp_tools`. Same shape; same authorization semantics. Roles without composition stay as-is (no empty array required).
- **D4 (v0.6.0):** Cost guard ceilings are per-tie, not global. PM Research = ≤3 (mirrors Council Round 0 G2). UI Media = ≤2. UX Brand = 1. Writer Dispatch = 1, Research = ≤2. Security web-assessment = 1, news = ≤3. Browser = 1 feature at a time. Numeric ceilings are operator-tunable in the partial.
- **D5 (v0.6.0):** Failure mode is degrade-not-block. Every composed-skill failure produces a `⚠️ unverified`/flagged-deferred marker in PRD; downstream phases read those flags but never wait. Test pyramid gate G6 explicitly NOT relaxed when Browser is unavailable (canonical pnpm path remains the ground truth).
- **D6 (v0.6.0):** Skip path is silent. Council G2 skips Round 0 silently when no external claims; v0.6.0 inherits that — UI skips Media for token-only changes, PM skips Research for internal-only features, etc., without ceremony.

### Files Changed

- `Workflows/_skill-composition.md` (new)
- `Workflows/{DeliverFeature,DocsRefresh,SecurityAudit,TestAndValidate}.md` (per-phase Skill Composition subsections)
- `Data/Roster.json` (`composed_skills` per role for pm, ux, ui, security, qa, e2e, writer)
- `SKILL.md` + `SKILL.partials.md` (Coordination Policy decision #10, status v0.6.0, Quick Reference entry, FIVE→SIX partials)
- This CHANGELOG

## v0.5.2 — 2026-05-05

GitHub Collaboration partial. Codifies the team's discipline for ongoing PR collaboration — read external comments before writing, keep the auto-managed TODO comment in lockstep with the artifact JSON, engage every reviewer point with one of four reply categories (never silent), refresh PR body when scope shifts, manage labels per kit taxonomy, status cadence for multi-batch runs.

### Added

- **`Workflows/_github-collaboration.md`** — single source of truth for ongoing PR collaboration. Defines: read-before-write rule (`gh pr view {N} --json comments,reviews,statusCheckRollup` plus `gh api .../pulls/{N}/comments` for inline diff threads BEFORE any write), TODO state lockstep (artifact JSON and PR comment update in same step on every state change), three comment types (Type 1 auto-managed TODO comment via `--edit-last --create-if-none`, Type 2 reply to reviewer via `gh pr comment` or `gh api .../comments` with `in_reply_to`, Type 3 status update folded into Type 1's preamble), four reply categories (acknowledged-queued / done / push-back / surface-to-operator — never silent), PR body/title freshness via `gh pr edit {N} --body --title`, label discipline (read existing taxonomy first, never invent), issue linking (`Closes #N` / `Fixes #N` / `Refs #N`), status cadence rule for multi-batch runs (refresh at every batch boundary + every blocker + session end), per-workflow application table, 10-pattern anti-pattern catalog.
- **`SKILL.md` Coordination Policy decision #9** — "GitHub collaboration discipline". Nine locked decisions: 1-5 (v0.0.1 ops policy), 6 (Test Pyramid Gate, v0.5.0), 7 (Algorithm + DAG, v0.5.0), 8 (Commit + Merge, v0.5.1), 9 (GitHub Collaboration, v0.5.2).

### Changed

- **`Workflows/ReviewOpenPRs.md` Phase 4** — added explicit `**Read before write (per Workflows/_github-collaboration.md):**` block fetching `comments,reviews,reviewRequests,statusCheckRollup,labels` plus inline diff comments via `gh api .../pulls/{N}/comments`. Reviewers receive prior-comments digest in their briefs.
- **`Workflows/ReviewOpenPRs.md` Phase 7** — comment-posting block now cites `_github-collaboration.md` Comment type 1; reviewer points not absorbed by team verdict trigger Type 2 replies (one of four categories; never silent).
- **`Workflows/ReviewSinglePR.md` Phase 1** — renamed to "Resolve PR (read before write per `Workflows/_github-collaboration.md`)"; `gh pr view` json fields extended with `comments,reviews,reviewRequests`; inline-comment listing added.
- **`Workflows/ReviewSinglePR.md` Phase 5** — comment-posting block now cites Comment type 1 + queues Type 2 replies for prior-comments digest items.
- **`Workflows/ExecuteOpenTodos.md` Phase 0** — added Read-before-write block ingesting reviewer feedback that landed since the originating review; new TODO-shaped points added to the artifact via canonical markdown protocol; Type 2 replies queued for the reviewer's comments.
- **`Workflows/ExecuteOpenTodos.md` Phase 5 step 5** — extended On-success rule with the `_github-collaboration.md` lockstep rule: artifact + comment update in same step on every batch DONE; status header preamble line refreshed.
- **`Workflows/ExecuteOpenTodos.md` Phase 7** — renamed to "Re-render PR Comment (per `Workflows/_github-collaboration.md` status cadence)"; status header line is the public heartbeat.

### Decisions Locked

- **D1 (v0.5.2):** Solo execution justified — narrative coherence + per-file single-zone.
- **D2 (v0.5.2):** v0.5.2 separate release. v0.5.1 already shipped at submodule `998ff05` + locally committed at parent `3a3ee38a`.
- **D3 (v0.5.2):** New partial layers ON TOP of `_pr-loop-shared.md` safety tiers — does NOT relax any tier; codifies HOW to operate within them.
- **D4 (v0.5.2):** Three comment types are the right cardinality. Auto-managed (one per session, edited) + reply-to-reviewer (engagement) + status (folded into auto-managed). More types = thread spam risk.
- **D5 (v0.5.2):** Status updates fold into the auto-managed TODO comment. Per `_pr-loop-shared.md` "single comment per PR per session" rule — status header in the comment preamble, not a separate comment.
- **D6 (v0.5.2):** Reviewer feedback is NEVER silently ignored. Four reply categories (acknowledged-queued / done / push-back / surface-to-operator) cover every case.

### Files Changed

- `Workflows/_github-collaboration.md` (new)
- `Workflows/{ReviewOpenPRs,ReviewSinglePR,ExecuteOpenTodos}.md` (collaboration integration)
- `SKILL.md` + `SKILL.partials.md` (Coordination Policy decision #9, status v0.5.2, Quick Reference entry)
- This CHANGELOG

## v0.5.1 — 2026-05-05

Commit + Merge Hygiene partial. Codifies the project's commit/merge patterns into a single shared partial so workflow prescriptions match what the orchestrator actually does. Conventional Commits + HEREDOC + `Co-Authored-By: DuranteOS <tech@duranteos.com>` trailer + explicit-list staging + NEW-commit-after-hook-failure + Gated merge tier.

### Added

- **`Workflows/_commit-merge.md`** — single source of truth for kit-flavored commit/merge contract. Defines: commit message format (Conventional Commits prefix `<type>(<scope>):` + concise subject ≤72 chars per kit AGENTS.md + HEREDOC body bullets + Co-Authored-By trailer), staging rules (explicit list, never `-A`, never include `MEMORY/` / `.env*` / credentials), pre-commit hook failure handling (NEW commit not `--amend`; never `--no-verify` without operator approval), submodule-first sequence (`bun ~/Durante/Tools/ship-submodule.ts` for DOS submodule edits), concurrent-landing safety (`git fetch && git status` before `git add`), PR creation template (`gh pr create` with `## Summary` + `## Test plan` H2 sections), PR comment edit-last protocol (`gh pr comment --edit-last --create-if-none`), merge gate (Gated tier — explicit `AskUserQuestion` approval + `gh pr checks {N}` green), push safety (NEVER `--force`, NEVER to PR head, NEVER `--no-verify`), per-step commits in Refactor (revert-on-red), `chmod 755` on new `*.hook.ts` / `*.daemon.ts` before staging, working-tree-clean expectation before phase: complete, per-workflow application table, anti-pattern catalog (8 kit-flavored patterns).
- **`SKILL.md` Coordination Policy decision #8** — "Commit + merge hygiene". Eight locked decisions: 1-5 (v0.0.1 ops policy), 6 (Test Pyramid Gate, v0.5.0), 7 (Algorithm + DAG, v0.5.0), 8 (Commit + Merge, v0.5.1).

### Changed

- **`Workflows/DeliverFeature.md` Phase 7** — added explicit `**PR creation (per Workflows/_commit-merge.md):**` block with `gh pr create` template, branch convention `feat/<feature-slug>`, hook-failure-NEW-commit rule.
- **`Workflows/BugFix.md`** — added `### Commit (per Workflows/_commit-merge.md)` subsection between G4-bug and Phase 5 Postmortem with Conventional Commits format + HEREDOC body bullets + trailer.
- **`Workflows/QuickFix.md`** — added `## Commit (per Workflows/_commit-merge.md)` section before Operator Gates with single-concise-commit guidance.
- **`Workflows/Refactor.md` Phase 3** — replaced "Make commits per step (small, reversible)" prose with explicit `Workflows/_commit-merge.md` reference + HEREDOC + Co-Authored-By + `git revert HEAD --no-edit` on red.
- **`Workflows/ReviewSinglePR.md` Phase 7** — extended "Stop at Merge Boundary" rule with explicit Merge Gate cite (AskUserQuestion approval + `gh pr checks {N}` green + default `gh pr merge --squash --delete-branch`).
- **`Workflows/ReviewOpenPRs.md` Phase 9** — extended "NEVER auto-merge" rule with explicit Merge Gate cite identical to ReviewSinglePR.
- **`Workflows/ExecuteOpenTodos.md` Phase 5 step 3** — replaced single-line `git commit -m "..."` with HEREDOC form including Co-Authored-By trailer; cites partial.
- **`Workflows/ExecuteOpenTodos.md` Phase 6 push** — annotated push-safety rule with cite to partial.
- **`Workflows/ExecuteOpenTodos.md` Phase 8 stop at merge** — extended Gated-tier rule with explicit Merge Gate cite.

### Decisions Locked

- **D1 (v0.5.1):** Solo execution justified — narrative coherence required across all workflow edits; per-file single-zone.
- **D2 (v0.5.1):** v0.5.1 separate release. v0.5.0 already shipped to submodule + locally committed in parent (commit `2bd5db0d`); amending would invalidate origin/main relationship.
- **D3 (v0.5.1):** Partial cites kit AGENTS.md "concise" rule explicitly. Codifies kit's only commit guidance so workflows propagate it.
- **D4 (v0.5.1):** Reuse `_pr-loop-shared.md` safety tier table by reference. Don't duplicate; new partial cites the canonical PR-loop safety contract.
- **D5 (v0.5.1):** HEREDOC commit messages everywhere. Both for DOS-internal and kit-internal commits — the principal pattern.
- **D6 (v0.5.1):** Conventional Commits prefix non-negotiable. Subject MUST start with `<type>(<scope>):` per kit's actual log convention.

### Files Changed

- `Workflows/_commit-merge.md` (new)
- `Workflows/{DeliverFeature,BugFix,QuickFix,Refactor,ReviewSinglePR,ReviewOpenPRs,ExecuteOpenTodos}.md` (commit/merge integration)
- `SKILL.md` + `SKILL.partials.md` (Coordination Policy decision #8, status v0.5.1, Quick Reference entry)
- This CHANGELOG

## v0.5.0 — 2026-05-05

Test Pyramid Gate. Two-tier per Makerkit canon (Vitest unit + Playwright e2e) is now non-negotiable across every change-producing workflow. New shared partial `Workflows/_test-pyramid-gate.md` defines the ships-with-tests rule. DeliverFeature splits Phase 6 into 6a (Unit) + 6b (E2E); BugFix Phase 4 enforces failing-test-first; QuickFix Phase 2 always adds 1 regression test (escalates to BugFix when budget blows); Refactor Phase 4 explicitly runs both layers; ReviewOpenPRs auto-emits file-level pyramid TODOs alongside `run_checks → CRITICAL`; ExecuteOpenTodos requires green tests (not just typecheck/lint) for batch "done".

### Added

- **`Workflows/_test-pyramid-gate.md`** — single source of truth for the pyramid contract. Defines: the two-tier pyramid (Vitest unit in `__tests__/<name>.test.ts` adjacent + Playwright e2e in `apps/e2e/tests/<feature>/`), the six ships-with-tests gate checks, canonical commands verbatim from Makerkit docs, file conventions, bootstrap helper catalogue, Page Object pattern with worked example, do/don't list, per-ISC layer mapping rubric (`unit-covered` / `e2e-covered` / `verification-only (justified)` / `documentation-only`), QA + E2E PR-loop framing, anti-patterns to catch.
- **`SKILL.md` Coordination Policy decision #6** — "Test pyramid is non-negotiable". Five v0.1.0 decisions plus this one. Status bumped to v0.5.0.
- **`Data/Roster.json` owns expansion:**
  - `qa.owns` += "Test Pyramid Plan per feature", "Vitest unit-test authorship for business-logic ISCs", "Acceptance gate against the ships-with-tests pyramid", "data-testid wiring requests"
  - `e2e.owns` += "Bootstrap helper usage (...) over UI login flows", "Polling assertions for async (await expect(...).toPass())"
  - `frontend.owns` += "data-testid attributes (kebab-case) on new interactive elements"
  - `ui.owns` += "data-testid attribute spec in component visual specs"
- **`FrameworkDigest.md` §10 expansion** — promoted from a 4-line bullet block to a first-class section with sub-sections 10.1 (pyramid layers) · 10.2 (canonical commands) · 10.3 (file conventions) · 10.4 (bootstrap helpers) · 10.5 (do/don't) · 10.6 (Page Object example) · 10.7 (production / monitoring / analytics / docker — preserved). Becomes the brief slice every dev agent receives.

### Changed

- **`Workflows/DeliverFeature.md` Phase 5** — QA's deliverable renamed from "test plan" to **Test Pyramid Plan** (per-ISC layer mapping table at PRD `## Decisions → ### Test Pyramid Plan`). G5 gates on Test Pyramid Plan approval.
- **`Workflows/DeliverFeature.md` Phase 6** — split into 6a (Unit, QA solo) + 6b (E2E, E2E Tester solo). 6a runs `pnpm --filter @kit/<pkg> test:unit` per affected package then aggregate `pnpm test:unit`; 6b runs production-build path `pnpm --filter web build:test` + `start:test` + `pnpm --filter web-e2e exec playwright test <feature> --workers=1`. G6 becomes pyramid-complete: all six ships-with-tests checks green.
- **`Workflows/BugFix.md` Phase 4** — TDD enforcement. QA writes a failing Vitest test FIRST; E2E writes a failing Playwright spec FIRST when bug is flow-shaped. Confirms FAIL on pre-fix, GREEN on post-fix.
- **`Workflows/BugFix.md` Phase 5 Postmortem Q4** — prescriptive. Now requires citing the test path that prevents recurrence; Vitest if unit-layer, Playwright if flow, both if cross-cutting.
- **`Workflows/QuickFix.md` Phase 2** — always adds ONE regression test (Vitest if logic, deferred to E2E Phase 3 if user-facing). Documentation/config-only is the only exception. Budget escalation rule: if test would blow the 15-min budget, operator promotes QuickFix → BugFix. The test obligation does NOT bend.
- **`Workflows/QuickFix.md` Phase 3** — uses bootstrap helpers + data-testid contract; runs `pnpm --filter web-e2e exec playwright test` and confirms green.
- **`Workflows/Refactor.md` Phase 4** — pyramid-explicit: QA runs `pnpm --filter @kit/<pkg> test:unit` per affected package; E2E runs `pnpm --filter web-e2e exec playwright test` for user-facing surfaces. Output captured into PRD `### Unit-layer parity` and `### E2E-layer parity`.
- **`Workflows/ReviewOpenPRs.md` Phase 4 reviewer table** — `qa` and `e2e` framing prompts now include explicit pyramid completeness checks per the file-level heuristic.
- **`Workflows/ReviewOpenPRs.md` Phase 4 MCP Touchpoints** — adds the file-level pyramid auto-CRITICAL bullet alongside the existing `run_checks → CRITICAL` stream. Procedure: every changed `packages/**/src/**/*.{ts,tsx}` without sibling `__tests__/<basename>.test.ts` → auto-emit `(agent:qa) (priority:high)` TODO; every new user-facing flow without sibling spec → auto-emit `(agent:e2e) (priority:high)`.
- **`Workflows/ReviewSinglePR.md`** — inherits the pyramid completeness checks via its existing "inherit from `ReviewOpenPRs.md` Phase 4" reference. No direct edit needed.
- **`Workflows/ExecuteOpenTodos.md` Phase 5 step 5** — batch "done" now requires (a) `pnpm healthcheck` clean AND (b) green scoped `pnpm --filter <pkg> test:unit`. Typecheck/lint passing without green tests is no longer sufficient.

### Decisions Locked

- **D1 (v0.5.0):** Two-tier pyramid (Vitest unit + Playwright e2e). Matches Makerkit canon strictly. No formal integration tier — folds into "E2E with real DB" or "unit with mocks".
- **D2 (v0.5.0):** Foundation partial authored before workflow references. The shared substrate (`_test-pyramid-gate.md`, FrameworkDigest §10, Roster owns, SKILL Coordination Policy #6) is the source of truth; workflow files cite the partial rather than restating contracts inline.
- **D3 (v0.5.0):** File-level pyramid heuristic for PR auto-TODOs. Cheap, never-false-positive: `packages/**/src/**/*.{ts,tsx}` without sibling `__tests__/<basename>.test.ts`. Branch-coverage parsing deferred (can lift later as a sub-doc).
- **D4 (v0.5.0):** QuickFix budget escalation rule. Adding a regression test is mandatory; the budget bend is the operator's escalation trigger from QuickFix → BugFix. The test obligation does NOT bend.
- **D5 (v0.5.0):** `data-testid` scope = PR-scope only. Frontend's new contract applies to new interactive elements introduced in the diff; sweeping legacy code into compliance is a separate Refactor.

### Files Changed

- `Workflows/_test-pyramid-gate.md` (new)
- `Workflows/{DeliverFeature,BugFix,QuickFix,Refactor,ReviewOpenPRs,ExecuteOpenTodos}.md`
- `Data/Roster.json` (qa, e2e, frontend, ui owns expansions)
- `FrameworkDigest.md` (§10 expansion)
- `SKILL.md` + `SKILL.partials.md` (Coordination Policy decision #6, status v0.5.0)
- This CHANGELOG

### Algorithm + DAG integration (v0.5.0 — same release)

Workflows now respect the DOS Algorithm v0.0.7-enhanced. Every multi-agent parallel phase uses the canonical `TeamCreate` + `Agent(team_name: ...)` spawn pattern.

**Added:**

- **`Workflows/_algorithm-team-spawn.md`** — single source of truth for kit-native team spawning. Codifies: when to spawn a team (decision tree), `TeamCreate` template with `mkt-<workflow>-phase<N>-<slug>` naming convention, `Agent` spawn template (subagent_type=general-purpose, kit role id, team_name, run_in_background:true), per-stream prompt template (composed from saved-composition + Pre-Delegation Contract slice + ISC slice + authorized MCP), `SendMessage` acknowledgment protocol, shutdown sequence, solo escape-clause table (15 phases enumerated), PARALLELISM PRE-CHECK at every workflow entry, kit-flavored anti-pattern catalog. Cites `~/.claude/DOS/Algorithm/sub-docs/dag-playbook.md` as the canonical 8-step pattern.
- **`SKILL.md` Coordination Policy decision #7** — "Algorithm-driven execution + DAG default for parallel phases". Five v0.1.0 decisions + Test Pyramid Gate (#6) + Algorithm/DAG integration (#7).

**Changed:**

- **`Workflows/DeliverFeature.md` Phases 2/4/5/7** — each parallel phase now emits a `**Team spawn (per Workflows/_algorithm-team-spawn.md):**` block with concrete `TeamCreate` invocation + parallel `Agent` calls + `SendMessage` ack + shutdown. Phase 2 = 3-stream (UX + UI + Architect); Phase 4 = 2-stream (Frontend + Backend); Phase 5 = 2-stream (Security + QA); Phase 7 = 2-stream (DevOps + Writer).
- **`Workflows/BugFix.md` Phase 4** — 2-stream parallel TDD verify (QA + E2E) team spawn block.
- **`Workflows/Refactor.md` Phase 4** — 2-stream parallel verify (QA + E2E) team spawn block.
- **`Workflows/ReviewSinglePR.md` Phase 2** — replaced "parallel `Skill` calls" prose with proper 13-stream `TeamCreate` + 13 parallel `Agent` calls. The team_name `mkt-review-pr<N>` is per-PR; teammates are `pm`, `sm`, `ux`, `ui`, `architect`, `frontend`, `backend`, `database`, `security`, `qa`, `e2e`, `devops`, `writer`.
- **`Workflows/ReviewOpenPRs.md` Phase 4** — replaced "parallel `Skill` calls" prose with proper M-stream `TeamCreate` + parallel `Agent` calls per matched roles from the diff-shape classifier output. The team_name `mkt-fleet-pr<N>` is per-PR.
- **`Workflows/QuickFix.md`** — added explicit `## Algorithm Note (v0.5.0)` declaring solo-by-design per the dag-playbook escape clause "≤2 files AND ≤6 ISCs". No `TeamCreate` ceremony; orchestrator coordinates serially.
- **`Workflows/ExecuteOpenTodos.md` Phase 5** — added explicit Algorithm note declaring serial-by-design per the dag-playbook escape clause "Shared mutable state precludes file-zone partition" (one branch, one commit-stream). No `TeamCreate`; one `Agent` per batch with no `team_name`.

**Decisions Locked:**

- **D6 (v0.5.0):** Algorithm-driven execution. Workflows respect the DOS Algorithm v0.0.7-enhanced — PARALLELISM PRE-CHECK at every multi-agent phase, `TeamCreate` + `Agent(team_name:...)` for parallel spawning, atomic ISCs verified at gates.
- **D7 (v0.5.0):** TeamCreate naming convention `mkt-<workflow>-phase<N>-<slug>` (e.g., `mkt-deliver-phase4-team-invite`, `mkt-review-pr42`, `mkt-fleet-pr42`). Predictable + traceable + collision-free.
- **D8 (v0.5.0):** Kit-native composed agents stay `subagent_type: "general-purpose"` with the saved-composition prompt injected — Claude Code's canonical specialized subagents (Engineer, Architect, etc.) don't carry the kit-native voice/trait composition.
- **D9 (v0.5.0):** Solo phases are first-class. Solo execution is correct — and required — for 15 enumerated phase shapes (DeliverFeature 1/3/6a/6b/8, BugFix 1/2/3/5, QuickFix all, Refactor 1/2/3, ExecuteOpenTodos all batches). Each solo phase logs the dag-playbook escape clause inline.

**Files Changed (Algorithm integration):**

- `Workflows/_algorithm-team-spawn.md` (new)
- `Workflows/{DeliverFeature,BugFix,Refactor,ReviewSinglePR,ReviewOpenPRs,QuickFix,ExecuteOpenTodos}.md` (team-spawn block or solo/serial Algorithm note)
- `SKILL.md` + `SKILL.partials.md` (Coordination Policy decision #7, Quick Reference entry for the partial)
- This CHANGELOG (this section)

## v0.4.1 — 2026-05-01

PR-loop follow-ons applied. Three deferred /simplify findings from v0.4.0 closed in one cycle. No behavior change to the workflow contracts; tightening only.

### Added

- **`Tools/_shared.ts`** — pure primitives shared across the 3 PR-loop tools. Exports:
  - `readStdin(): Promise<string>` — chunk-collect-from-stdin helper, replaces 3-instance duplication
  - `Verdict` discriminated union: `{kind: 'PASS', detail?} | {kind: 'BLOCK', reason} | {kind: 'CHANGES', severity: 'minor'|'substantial'}`
  - `formatVerdict(v): string` — canonical display rendering for the 4 verdict shapes

### Changed

- **`Tools/RenderTodoComment.ts`** — `RenderMeta.teamVerdict` promoted from freeform `string` to typed `Verdict` discriminated union. Eliminates aggregator/renderer drift risk (previously, only convention guarded the verdict string format).
- **`Tools/ParsePrTodos.ts` + `ClassifyPrShape.ts` + `RenderTodoComment.ts` CLI entries** — refactored to `import { readStdin } from './_shared'` (dynamic import, only loads when `import.meta.main`). Library import surface stays clean.
- **`Workflows/{ReviewOpenPRs,ReviewSinglePR,ExecuteOpenTodos}.md`** — added `## Output` section to each, naming the artifacts produced (PR comment URL, JSON path, index entry, side branch ref). Shape parity with sibling workflows (`CodeReview`, `BugFix`).

### Verification

- 24/24 tests pass (no behavior change)
- `bun ~/Durante/Tools/sync-check.ts` → 2049 identical, 0 drift
- /simplify follow-on backlog: empty

## v0.4.0 — 2026-05-01

PR review-execute loop. Two-workflow pair (`ReviewOpenPRs` / `ReviewSinglePR` to generate, `ExecuteOpenTodos` to apply) linked by a TODO checklist as the work queue. The PR comment is the rendered view; the artifact JSON at `MEMORY/ARTIFACTS/makerkit-pr-{N}-todos.json` is the source of truth.

### Added

- **`Workflows/ReviewOpenPRs.md`** — fleet review across all open PRs in the current kit repo. Uses `Tools/ClassifyPrShape.ts` to map each PR's diff to a kit-aware reviewer subset. Posts (or edits-last) one TODO comment per PR. Stops at the merge boundary.
- **`Workflows/ReviewSinglePR.md`** — deep review of one PR# with the full 13-agent roster (skips the classifier — full team always).
- **`Workflows/ExecuteOpenTodos.md`** — parses the TODO checklist on a PR comment, groups by responsible agent, executes each batch on a side branch (`fix/pr-{N}-todos`) with per-agent-batch `pnpm healthcheck` + scoped tests. Serial (not parallel) — per-batch verify only works when commits land one-at-a-time. Blocked-batch failures get reverted; loop continues to next batch.
- **`Workflows/_pr-loop-shared.md`** — shared substrate for the three workflows: safety tier table (Auto-read / Auto-write low-blast / Gated / NEVER), side-branch convention with already-merged-into-head retry handling, artifact JSON schema (`schemaVersion: 1`), TODO checklist markdown protocol with worked example.
- **`Tools/ParsePrTodos.ts`** — pure parser, markdown checklist → typed `Todo[]`. Required tags `(agent:X)` + `(priority:Y)`; optional `(file:path:line)` and `<!-- blocked: reason -->`. Skips malformed rows silently.
- **`Tools/ClassifyPrShape.ts`** — pure classifier, file paths → `ReviewerSet`. Lens table covers database, backend-action, frontend-rsc, e2e, ui, devops, docs; ≥3-package crosscut spawns full team; QA always rides along on non-pure-docs.
- **`Tools/RenderTodoComment.ts`** — pure renderer, `Todo[] + meta` → markdown for `gh pr comment`. Groups by agent, sorts within group by priority then done-state, deterministic output.
- **`Tools/__tests__/ParsePrTodos.test.ts`** — 10 cases (well-formed, blocked, malformed-tolerance, case-insensitive, missing-required, mixed done states, order preservation).
- **`Tools/__tests__/ClassifyPrShape.test.ts`** — 14 cases (every lens row, crosscut, mixed lenses, fallback, pure-docs detection, empty input).

### Pre-Build Reuse Decision

DOS orchestrator at `Releases/v0.0.4/.claude/DOS/Tools/orchestrator/prd-interop.ts` exports `importLegacyCriteriaMarkdown` + `renderCriteriaMarkdown` for PRD criteria parsing. **Not reused** — different format (colon-separator vs paren-tagged), different schema (10 PRD-specific fields vs 5 PR-loop fields), different consumer, RFC-0001 type coupling. Per Sandi Metz: duplication is far cheaper than the wrong abstraction.

### Anti-Pattern Avoided

The github skill (`~/.claude/skills/github/Workflows/ReviewPRs.md`) uses a 5-reviewer pool (Cockburn / Fowler / UncleBob / Sentinel / QA). MakerkitTeam's workflows deliberately use the kit-native 13-agent roster INSTEAD — that is the wedge between the two skills. NO references to generic-principles reviewers in any new workflow (anti-criterion ISC-A2/A6).

### Constraints

- Side-branch only — never push to PR head branch.
- Per-batch healthcheck mandatory (override with `--fast` flag, accept bisection trade-off).
- Serial batch execution — parallel batches race on the side branch.
- Stop at merge boundary — `gh pr merge` requires explicit operator approval via `AskUserQuestion`.
- One PR comment per session — re-runs UPDATE via `gh pr comment --edit-last --create-if-none`.

## v0.3.0 — 2026-04-28

Makerkit MCP server (`mcp__makerkit__*`) wired in as a first-class capability layer across skill, workflows, and agent roles.

### Added

- **`Data/McpToolMap.json`** — 10-cluster catalogue mapping the 50+ Makerkit MCP tools to named groups (`project_status`, `dev_server`, `database`, `components`, `checks`, `env`, `email`, `translations`, `prds_stories`, `deps`). Each cluster has `purpose`, `tools` (verbatim names), and `notes` (when to call which tool, precedence rules, destructive-tool guards). Single source of truth.
- **`Data/Roster.json` `mcp_tools` field per role** — every one of the 13 roles gets a list of authorized cluster names:

  | Role | Authorized clusters |
  |---|---|
  | pm | prds_stories, project_status |
  | sm | project_status, prds_stories |
  | ux | components, translations |
  | ui | components |
  | architect | project_status, database, components, checks |
  | frontend | components, translations, checks, project_status |
  | backend | database, checks, env, project_status |
  | database | database, checks |
  | security | env, deps, checks, project_status |
  | qa | checks, project_status |
  | e2e | email, dev_server, checks |
  | devops | dev_server, env, database, deps, project_status, checks |
  | writer | translations |

- **`Tools/BuildBrief.ts` `## Authorized MCP Tools` section** — reads `McpToolMap.json` and renders the role's authorized clusters with full tool list + notes into every brief.

### Workflow Touchpoints

Each workflow gained `### MCP Touchpoints` subsections:

- **DeliverFeature** — Phase 0 (`kit_prerequisites`, `kit_status`, `get_improvement_suggestions`), Phase 1 (`add_user_story`, `update_story_status` for kit-native PRD mirror), Phase 3 (`get_database_summary`, `get_database_tables`, `get_table_info`, `search_database_functions`, `generate_migration`, `kit_db_status`), Phase 4 (`components_search`, `get_component_content`, `get_component_props`, `kit_translations_update`, `kit_env_read`, `run_checks` MUST), Phase 7 (`kit_env_schema`, `kit_env_read`, `kit_env_update`, `kit_dev_status`, `deps_upgrade_advisor`, `kit_translations_stats`)
- **ExploreFeature** — Phase 1 read-only archaeology with role-specific MCP tools (Architect: `get_database_summary` + `get_database_tables` + `get_scripts`; Frontend: `get_components` + `components_search` + `kit_translations_list`; Backend: `search_database_functions` + `get_function_details` + `kit_env_schema`; Database: `get_table_info` + `get_migrations`)
- **CodeReview** — Phase 1 mandatory `run_checks` before findings synthesis; component DRY checks via `get_components` + `components_search`; tenant-scoping audit via `get_database_tables` + `get_table_info`; i18n drift via `kit_translations_stats`
- **BugFix** — Phase 0 `kit_dev_status` + `kit_dev_start` for repro, `kit_db_status`, `kit_emails_list` for auth/billing email bugs; Phase 4 mandatory `run_checks`, mailpit assertion via `kit_emails_list` + `kit_emails_read` + `kit_emails_set_read_status`
- **TestAndValidate** — Phase 1 mandatory `run_checks` first; `kit_db_status`, `kit_dev_status`, `kit_mailbox_status` prereq checks; Phase 2 `kit_translations_stats` + `kit_translations_list` + `kit_env_schema` for doc drift
- **Refactor** — Phase 2 captures `run_checks` Pre-Refactor Snapshot; Phase 4 verifies behavioral parity by comparing `run_checks` output verbatim against snapshot

### Documentation

- **SKILL.md** — new `## Makerkit MCP Integration (v0.3.0)` section explaining the 3-layer model (skill / workflow / agent), anti-overlap rule with DOS PRD ledger, and destructive-tool operator-gate policy. Quick Reference now lists `Data/McpToolMap.json`.

### Files Changed

- `Data/McpToolMap.json` (new)
- `Data/Roster.json` (mcp_tools added per role)
- `Tools/BuildBrief.ts` (renders authorized MCP section)
- `SKILL.md` (status v0.3.0, new MCP Integration section)
- `Workflows/DeliverFeature.md` · `Workflows/ExploreFeature.md` · `Workflows/CodeReview.md` · `Workflows/BugFix.md` · `Workflows/TestAndValidate.md` · `Workflows/Refactor.md`
- This CHANGELOG

### Decisions Locked

- **D1:** McpToolMap separate from Roster — global tool→cluster definitions live in McpToolMap; per-role cluster authorizations live in Roster. Splitting prevents cross-edit cascades when MCP tool inventory changes.
- **D2:** Cluster-level authorization, not per-tool — 10 clusters keep brief size bounded; per-tool guidance lives in cluster `notes`.
- **D3:** Workflow MCP touchpoints are SHOULD by default, MUST for `run_checks` in verification phases (CodeReview, BugFix Phase 4, TestAndValidate Phase 1, Refactor Phase 2 + Phase 4). Other touchpoints are advisory because prerequisites (DB up, dev server up, mailpit up) may not hold offline.
- **D4:** DOS PRD ledger is canonical; Makerkit MCP `create_prd`/`add_user_story`/`update_story_status` is a MIRROR surface for kit projects that independently use Makerkit-native PRDs. Default flow stays DOS-only.

## v0.2.0 — 2026-04-28

Full dev-team motion coverage. Added 5 workflows that complete the team's lifecycle responsibilities (was: 6 workflows; now: 11).

### Added Workflows

| Workflow | Motion | agents |
|---|---|---|
| **ExploreFeature** | Read-only archaeology — "how does X actually work" | Architect + Frontend + Backend + Database (parallel, read-only) |
| **CodeReview** | Multi-lens critique of existing code (non-security) | Architect + Frontend/Backend (by scope) + QA |
| **BugFix** | Diagnose-then-fix for bugs too big for QuickFix | PM (scope) → Architect (diagnose) → implementer → QA + E2E (parallel verify) → SM (postmortem) |
| **TestAndValidate** | Run tests for a scope + check feature behavior against docs | QA + E2E (parallel test) → Writer (drift check) |
| **Refactor** | Behavior-preserving improvement (extract, rename, restructure) | Architect (plan) → QA (test-first if needed) → implementer → QA + E2E (regression verify) → Writer (if public API renamed) |

### Routing Reorganization

Workflows in SKILL.md now grouped by motion type:
- **Discovery (read-only):** ExploreFeature, CodeReview, DesignReview, SecurityAudit, TestAndValidate
- **Change (writes code):** DeliverFeature, QuickFix, BugFix, Refactor, DocsRefresh
- **Meta:** ShowRoster

### Coverage Map

The team now spans the standard dev-team lifecycle:

| Need | Workflow | Read-only? |
|---|---|---|
| Understand existing code | ExploreFeature | Yes |
| Critique existing code | CodeReview | Yes |
| Critique a design | DesignReview | Yes |
| Audit security posture | SecurityAudit | Yes |
| Test + check doc drift | TestAndValidate | Yes |
| Build new feature | DeliverFeature | No |
| Surgical 1-2 file fix | QuickFix | No |
| Multi-file bug with diagnosis | BugFix | No |
| Behavior-preserving improvement | Refactor | No |
| Update docs | DocsRefresh | No |

### Cross-Skill Mandates Tightened

Each new workflow names the cross-skill it SHOULD invoke. Cross-skills marked **(aspirational)** do not yet exist as installed DOS skills or plugins; the team's internal role (`frontend`/`backend`/`database`/`e2e` from Roster.json) is the canonical authority for that domain until a dedicated cross-skill ships.

- ExploreFeature: agents Read repo directly, no cross-skill
- CodeReview: `sentinel` ✓, `frontend-design` ✓ (claude-plugins-official). Aspirational: `react-form-builder`, `server-actions-expert`, `prisma-expert` — until those land, the `frontend`/`backend`/`database` internal roles handle their respective domains.
- BugFix: `sentinel` ✓, `thinking` ✓ (for non-obvious root cause)
- TestAndValidate: aspirational `playwright-e2e-expert` — until it lands, the `e2e` internal role (Roster.json `technical-specialist-contrarian-investig`) is canonical for Playwright patterns.
- Refactor: `Fowler` ✓, `KentBeck` ✓, `SandiMetz` ✓, `Feathers` ✓ (all native specialists shipped 2026-04-27)

### Inherited Coordination Policy (v0.1.0, still locked)

1. Auto-classify scope (Phase 0, no operator confirm)
2. DB Engineer always weighs in (when DB-touching motions run)
3. `/simplify` is part of BUILD, not a separate gate
4. Distinctive voices kept per agent
5. ISC failures route to original implementer with 3-strike escalation

## v0.1.0 — 2026-04-28

Coordination policy locked in based on operator review of v0.0.1 open questions.

### Decisions (locked)

1. **Auto-classify scope** — no operator confirmation step. Pre-flight runs the classifier (small/medium/large) and records the result + reasoning in PRD `## Decisions`. Operator can override at G1 (the first artifact gate). Small fix-class requests auto-redirect to QuickFix.

2. **DB Engineer always runs** — never skipped. Even when no schema changes are needed, the agent produces an explicit "no schema changes required, here's why" memo with citations to the existing schema. This catches false-negatives where the architect missed a needed schema touch.

3. **`/simplify` is part of Phase 4 BUILD** — runs immediately after Frontend + Backend return. The 3 simplify findings (reuse / quality / efficiency) get appended to PRD `## Decisions → ### /simplify Findings`. Findings requiring code changes route back to the original implementer (frontend or backend by ownership) to address BEFORE G4. Not a separate gate.

4. **Distinctive voices kept per agent** — each role retains its trait-derived prosody. The user hears 13 audible identities, not a uniform "delivery cadence" prosody. Voice diversity is a feature, not noise.

5. **ISC failures route to original implementer** — Frontend or Backend (by code ownership) gets re-spawned with: failure context, file:line of the failing assertion, expected-vs-actual behavior, and a constraint to make the smallest possible surgical fix. After 3 consecutive failures from the same agent, escalate to operator (operator may then spawn fresh fix agent, pull in Architect, or other).

### Operator Gates (renamed)

7 named gates at artifact boundaries instead of "every phase":
- **G1** PRD draft (after Phase 1)
- **G2** Design package (after Phase 2)
- **G3** Schema diff or no-changes memo (after Phase 3)
- **G4** Code diff with /simplify findings addressed (after Phase 4)
- **G5** Threat model + test plan (after Phase 5)
- **G6** ISC verification matrix (after Phase 6)
- **G7** Deploy plan + docs (after Phase 7)

Phase 8 (Wrap) is informational only — no gate.

### Files updated

- `SKILL.md` — replaced "Operator Tuning Principle" with "Coordination Policy (locked)" + status v0.1.0
- `Workflows/DeliverFeature.md` — replaced per-phase confirmation with G1-G7 artifact gates; auto-classify Phase 0; mandatory Phase 3; /simplify inline at Phase 4; ISC-failure routing at Phase 6
- `Workflows/QuickFix.md` — auto-classify Phase 0, single G-fix gate, same ISC-failure routing

### v0.0.1 → v0.1.0 deltas at a glance

| Surface | v0.0.1 | v0.1.0 |
|---|---|---|
| Scope classification | Operator confirms | Auto-classify, override at G1 |
| Phase 3 skip rule | Conditional skip | Always runs |
| `/simplify` placement | Mentioned, unspecified | Phase 4 inline, before G4 |
| Voice prosody | Per-agent (default) | Per-agent (locked) |
| ISC failure remediation | Operator picks | Original implementer, 3-strike escalation |
| Operator gates | Every phase | G1-G7 at artifact boundaries |

## v0.0.1 — 2026-04-28

Initial scaffold.

### Added
- `SKILL.md` — top-level routing for 6 workflows + roster summary
- `Workflows/DeliverFeature.md` — full 8-phase pipeline with operator gates per phase
- `Workflows/QuickFix.md` — compressed lane (3 agents max)
- `Workflows/DesignReview.md` — UX + UI + Architect council, no implementation
- `Workflows/SecurityAudit.md` — Security Engineer solo
- `Workflows/DocsRefresh.md` — Tech Writer solo
- `Workflows/ShowRoster.md` — read-only team listing
- `Tools/InvokeAgent.ts` — resolves role id → saved composition system prompt
- `Tools/BuildBrief.ts` — composes per-agent brief with framework-digest slice
- `Data/Roster.json` — 13-agent manifest (id, slug, traits, voice, owns/consumes/produces)
- `FrameworkDigest.md` — 12-section synthesis of `dos-prisma-saas-kit/docs/`
