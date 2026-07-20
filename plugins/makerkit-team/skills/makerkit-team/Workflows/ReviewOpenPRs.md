---
name: Review Open PRs
description: Fleet review across every open PR in the kit repo — classifies each PR's diff shape, fans out to the matching kit-native reviewer subset, aggregates PASS/CHANGES/BLOCK verdicts, and posts a per-PR TODO checklist comment, always stopping at the merge boundary.
status: STABLE
bestPath:
  - title: "Enumerate & Rank PRs"
    description: "List open PRs, filter drafts/stale entries, and rank by CI status and diff size."
  - title: "Classify & Spawn Reviewers"
    description: "Classify each PR's diff shape into kit-native lenses and fan out the matched reviewer agents in parallel."
  - title: "Aggregate Verdicts"
    description: "Combine per-reviewer PASS/CHANGES/BLOCK verdicts into one team-leader recommendation per PR."
  - title: "Render & Post TODO Comment"
    description: "Render the grouped TODO checklist and post or edit-last the auto-managed PR comment."
  - title: "Write Artifact & Surface Merge Options"
    description: "Write the artifact JSON, then surface eligible PRs to the operator for an explicit merge decision."
---

# ReviewOpenPRs Workflow

Fleet review across every open PR in the current Makerkit kit repo. Lists PRs, classifies each by diff shape, fans out to a kit-aware reviewer team, aggregates verdicts, posts (or edits-last) the per-PR TODO comment, and stops at the merge boundary. **Never auto-merges.** Companion to `ExecuteOpenTodos` (separate workflow that consumes the TODO list this one produces).

Read `Workflows/_pr-loop-shared.md` for the safety tier table, side-branch convention, artifact JSON schema, and TODO markdown protocol that bind this workflow.

## When to Use

- Sweeping all open PRs in a kit repo to surface review burden
- Periodic team-leader review across a long-lived branch fleet
- Pre-release triage to flag PRs that need work vs. ready-to-merge

## When NOT to Use

- Need deep single-PR review with full 13-agent team → `ReviewSinglePR`
- Want to apply the TODOs from a prior review → `ExecuteOpenTodos`
- Need security-focused critique → `SecurityAudit` (kit-internal, no PR scope)

<!-- partial: _workflow-voice.md skill_name=MakerkitTeam workflow_name=ReviewOpenPRs -->

## Phase 0 — Preflight

```bash
bun Tools/MakerkitCli.ts preflight
```

Emit the capability manifest for this run (repo, roster health, scripts, doctrine). Exit 1 = unresolvable repo or invalid roster: STOP and remediate before proceeding. Branch on the manifest per `_algorithm-team-spawn.md` (spawn ladder) and the run_checks fallback ladder.

## Pipeline

### Phase 0 — Pre-flight

```bash
gh auth status || { echo "gh not authenticated — run 'gh auth login' and retry"; exit 1; }
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || { echo "not inside a git repo"; exit 1; }
gh repo view --json nameWithOwner -q .nameWithOwner || { echo "no github remote — gh repo view failed"; exit 1; }
```

If pre-flight fails, abort and tell the operator what is missing. Do NOT attempt `gh` calls in a non-repo or unauth state.

### Phase 1 — Enumerate Open PRs

```bash
gh pr list \
  --state open \
  --limit 50 \
  --json number,title,author,isDraft,labels,createdAt,updatedAt,headRefName,baseRefName,mergeable,reviewDecision,statusCheckRollup
```

<!-- partial: _intent-to-flag-table.md skill_name=MakerkitTeam workflow_name=ReviewOpenPRs -->

## Intent-to-Flag Mapping

| Operator Says | Filter | Effect |
|---|---|---|
| (default) "review the open prs" | `--state open`, skip drafts, skip stale (>30d) | Active, ready-for-review PRs |
| "include drafts" | drop the draft skip | Drafts are reviewed too |
| "include stale" | drop the >30d cutoff | Stale PRs included |
| "only mine" | `gh pr list --author @me` | PRs authored by current operator |
| "only failing CI" | post-filter on `statusCheckRollup` | PRs where required checks are red |
| "label X" | `--label X` | Restrict to a single label |

### Phase 2 — Filter & Rank

The filter/rank rule (skip drafts unless `--include-drafts`; skip PRs `updatedAt > 30d ago` unless `--include-stale`; tag CI `green`/`red`/`pending`/`none` from `statusCheckRollup`; tag size `small` < 50 lines / `medium` 50-500 / `large` > 500; rank red CI first, then larger diffs, then oldest) is owned by `filterAndRankPRs()` in `Tools/ReviewOpenPRsCli.ts` — both sides of the 30-day stale boundary and the 50/500 size boundaries are covered in `Tools/__tests__/ReviewOpenPRsCli.test.ts`. The agent supplies each PR's `diffLineCount` (from `gh pr diff {N} --patch | wc -l`) when size precision matters; everything else is computed from the `gh pr list` JSON.

```bash
# stdin: {prs: [<gh pr list rows>], includeDrafts?: bool, includeStale?: bool}
# prints the ranked, filtered PR list (number, ci, size, updatedAt) as JSON.
jq -n --argjson prs "$PR_LIST_JSON" '{prs: $prs}' \
  | bun ~/.claude/skills/makerkit-team/Tools/ReviewOpenPRsCli.ts filter-rank
```

**Empty-set exit:** if Phase 1 returned zero open PRs, or Phase 2 filtered every PR out (all drafts/stale under the active flags), emit a one-line report to the operator — `"No open PRs to review"` or `"All {N} open PRs filtered (drafts: {d}, stale: {s}) — pass --include-drafts / --include-stale to widen"` — and STOP cleanly. No reviewer spawns, no artifact writes, no PR comments.

### Phase 3 — Classify Diff Shape (per PR)

For each PR, get the file list and run the kit-aware classifier:

```bash
gh pr diff {N} --name-only | bun ~/.claude/skills/makerkit-team/Tools/ClassifyPrShape.ts
```

The classifier reads the file paths and returns `{agents: [...], matchedLenses: [...], topLevelPackages: [...], isCrosscut, isPureDocs}` — the canonical kit lens table:

| Lens | Path Pattern | Reviewer Agents Contributed |
|---|---|---|
| `database` | `packages/database/**` | database + backend + security |
| `backend-action` | `apps/web/**/*.action.ts`, `apps/web/**/server-actions/**` | backend + security + architect |
| `frontend-rsc` | `apps/web/**/page.tsx`, `apps/web/**/layout.tsx`, `apps/web/**/_components/**` | frontend + architect + ux |
| `e2e` | `apps/e2e/**` | e2e + qa |
| `ui` | `packages/ui/**` | ui + frontend |
| `devops` | `tooling/**`, `*.config.{ts,js,mjs,cjs}`, `.github/**`, `Dockerfile*` | devops + architect |
| `docs` | `*.md`, `*.mdoc`, `docs/**` | writer (only if pure-docs) |
| crosscut (≥3 packages) | n/a | full 13-agent team |
| no-match fallback | n/a | pm + qa |

QA always rides along on any non-pure-docs change.

### Phase 4 — Spawn Reviewer Team In Parallel

**Read before write (per `Workflows/_github-collaboration.md`):** before spawning reviewers, fetch the full PR state INCLUDING prior comments and review threads:

```bash
gh pr view {N} --json number,title,body,comments,reviews,reviewRequests,statusCheckRollup,labels
gh api repos/{owner}/{repo}/pulls/{N}/comments  # inline diff comments
```

Pass the comments + reviews digest into each reviewer's brief so they engage prior reviewer points (per `_github-collaboration.md` reply categories — acknowledged-queued / done / push-back / surface-to-operator) rather than reinvent prior discussion.

**Check out the PR head BEFORE any check runs.** `mcp__makerkit__run_checks` and the pyramid-heuristic pre-compute read the working tree — they are meaningless against whatever branch happens to be checked out. Per PR: `gh pr checkout {N}`, or (to avoid disturbing the operator's working tree in a fleet sweep) a dedicated worktree: `git fetch origin "pull/{N}/head" && git worktree add "/tmp/mkt-pr-{N}" FETCH_HEAD`. Restore the original branch (or `git worktree remove`) when that PR's review completes.

**Team spawn (per `Workflows/_algorithm-team-spawn.md` degradation ladder):** run the Phase 0 capability probe (`bun Tools/MakerkitCli.ts preflight`) once per session. Default rung is L2 Agent fan-out: for each PR, in **a single message**, fire one `Agent` call per matched role from the classifier output. Each: `subagent_type: "general-purpose"`, `name: <role-id>`, `model: "sonnet"`, `run_in_background: true`. Sequential calls violate the Algorithm parallelism contract. L1 team choreography only when the preflight manifest confirms team primitives — never hard-depend on it.

Each reviewer prompt includes:

- PR number, title, author, base/head refs
- Full diff (`gh pr diff {N}`)
- PR description (`gh pr view {N} --json body -q .body`)
- The reviewer-specific framing question (see below)
- The TODO emission protocol from `_pr-loop-shared.md`
- The Reviewer Per-Stream Prompt Template from `_pr-loop-shared.md` (review-scoped — no PRD path, no ISC evidence fields; those are delivery-only)

Wait for all matched reviewers' reports (structured returns or `MEMORY/WORK/{slug}/reports/<role>.md` files; teammate `SendMessage` only on L1) before aggregating verdicts. Apply the Non-response policy from `_algorithm-team-spawn.md` to silent streams. On L1 only, after the comment posts: `SendMessage shutdown_request` to each teammate.

### Reviewer-specific framing prompts (kit-native, NOT generic principles)

| Reviewer | Framing |
|---|---|
| **pm** | "Read this PR's title, body, and diff. Does the implementation match the stated goal? Is scope right? Emit TODOs for missing requirements or scope-creep deletions. Verdict: PASS / CHANGES / BLOCK + ≤200 words." |
| **sm** | "Read this PR's commit history and PR body. Are commits well-structured? Is the PR description sufficient for a reviewer to context-load? Emit TODOs for changelog/commit-message gaps. Verdict + ≤200 words." |
| **ux** | "Read the diff for any visible UI changes. Are flows accessible? Empty/loading/error states present? Mobile breakpoints? Emit TODOs per gap. Verdict + ≤200 words." |
| **ui** | "Read the diff for visual changes. Tailwind tokens used correctly? @kit/ui components reused vs. reinvented? Brand consistency? Verdict + ≤200 words." |
| **architect** | "Read the diff for layering — does each change land in the right `@kit/*` package? Multi-tenant boundaries respected? Server vs. client boundary correct? Emit TODOs per boundary violation. Verdict + ≤200 words." |
| **frontend** | "Read the RSC pages, client components, forms, loaders. the kit's Next.js App Router patterns followed (version per FrameworkDigest pins)? `use client` only where needed? `useEffect` justified or removable? Verdict + ≤200 words." |
| **backend** | "Read server actions and Prisma queries. next-safe-action used? authn → org → permission middleware chain? Zod schemas complete? Redirect-error handled? Verdict + ≤200 words." |
| **database** | "Read schema.prisma changes and migrations. Tenant scoping (organizationId) on all multi-tenant tables? Indexes on common query columns? Migration safe under concurrent writes? Verdict + ≤200 words." |
| **security** | "Read auth touches, RBAC additions, env additions, action-middleware changes. New attack surface? Permission grants justified? CSP/CSRF/rate-limit implications? Verdict + ≤200 words." |
| **qa** | "What can break? Edge cases not handled? Test coverage gaps? Regression risks in adjacent surfaces? **Pyramid completeness check (per `Workflows/_test-pyramid-gate.md`):** for every changed file under `packages/**/src/**/*.{ts,tsx}` without a sibling `__tests__/<basename>.test.ts`, emit `(agent:qa) (priority:high) Add Vitest unit test for <module> in <pkg>/__tests__/`. File-level heuristic only — no branch-coverage parsing. Emit TODOs per gap. Verdict + ≤200 words." |
| **e2e** | "Does this PR need a Playwright spec? Existing specs broken by this change? Mailpit assertions needed? **Pyramid completeness check (per `Workflows/_test-pyramid-gate.md`):** for every new user-facing flow added (signals: new `apps/web/**/page.tsx`, new `apps/web/**/_components/<form>`, new server action mutating user-visible state), check whether `apps/e2e/tests/<feature>/` already contains a spec. If absent, emit `(agent:e2e) (priority:high) Add Playwright spec for <flow> in apps/e2e/tests/<feature>/`. Verdict + ≤200 words." |
| **devops** | "Read for env vars, Docker layer impact, Railway deploy implications, healthcheck route changes. Verdict + ≤200 words." |
| **writer** | "Read for documentation gaps. New API surface needs docs? AGENTS.md update? Changelog entry? Verdict + ≤200 words." |

### MCP Touchpoints (Phase 4)

The reviewer agents use MCP tools to avoid re-discovery. Each tool below is invoked under a documented contract; output captured in PRD `## Decisions → ### Phase 4 MCP Output`.

- **`mcp__makerkit__run_checks`** — orchestrator MUST invoke BEFORE reviewer agents start, with the PR head checked out (see Phase 4 checkout step). Compile/lint/format/typecheck failures auto-emit CRITICAL TODOs assigned to the agent who owns the failing surface. If mcp__makerkit__run_checks is unavailable (server not connected — check the capability manifest from `bun Tools/MakerkitCli.ts preflight`), fall back to the read-only ladder `pnpm lint && pnpm typecheck && pnpm test:unit`. NEVER run `pnpm healthcheck` in review/read-only contexts — it mutates files.
- **Pyramid completeness file-level heuristic (per `Workflows/_test-pyramid-gate.md`)** — orchestrator MUST also pre-compute coverage gaps and auto-emit high-priority TODOs alongside the `run_checks` stream. The file-level heuristic (QA: every `packages/**/src/**/*.{ts,tsx}` file lacking a sibling `__tests__/<basename>.test.ts` → unit-test TODO; E2E: every new user-facing flow under `apps/web/**/page.tsx` or `apps/web/**/_components/<form>` whose feature has no `apps/e2e/tests/<feature>/` spec in the diff → Playwright-spec TODO) is owned by `checkQAPyramidGaps()` and `checkE2EPyramidGaps()` in `Tools/ReviewOpenPRsCli.ts` — both emit the exact `(agent:X) (priority:high) ...` markdown rows, and the same-diff suppression (sibling/spec added in the same PR) is covered in `Tools/__tests__/ReviewOpenPRsCli.test.ts`. File-level only — no branch-coverage parsing. Feed the changed-file set on stdin:

  ```bash
  # stdin: JSON array of changed paths (gh pr diff {N} --name-only)
  CHANGED=$(gh pr diff {N} --name-only | jq -R . | jq -s .)
  echo "$CHANGED" | bun ~/.claude/skills/makerkit-team/Tools/ReviewOpenPRsCli.ts qa-gaps
  echo "$CHANGED" | bun ~/.claude/skills/makerkit-team/Tools/ReviewOpenPRsCli.ts e2e-gaps
  ```

  These TODOs join the `run_checks → CRITICAL` stream and follow the same checklist markdown protocol from `_pr-loop-shared.md`.
- **`mcp__makerkit__get_components`** — Frontend reviewer cross-references against the catalog (DRY violations).
- **`mcp__makerkit__components_search`** — surfaces candidate reuses by feature keyword.
- **`mcp__makerkit__get_database_tables`** + **`mcp__makerkit__get_table_info`** — Database reviewer verifies tenant scoping.
- **`mcp__makerkit__kit_translations_stats`** — Frontend reviewer flags i18n gaps in new components.

### Phase 5 — Aggregate Verdicts (per PR)

Combine reviewer verdicts into one team-leader recommendation. The aggregation rule (all `PASS` → `PASS — ready to merge after CI green`; any `BLOCK` → `BLOCK — see {reviewer} reasoning`; mixed PASS/CHANGES → `CHANGES — minor`; all `CHANGES` → `CHANGES — substantial`) is owned by `aggregateReviewVerdicts()` in `Tools/ReviewOpenPRsCli.ts` — all four rules covered in `Tools/__tests__/ReviewOpenPRsCli.test.ts`. The agent decides each reviewer's verdict (judgment); the function applies the precedence deterministically (BLOCK wins, then all-PASS, then all-CHANGES, else minor) and renders the operator-facing line. For `CHANGES — minor`, list per-reviewer asks alongside.

```bash
# stdin: [{"reviewer":"backend","verdict":"PASS"}, ...]  (verdict ∈ PASS|CHANGES|BLOCK)
echo "$REVIEWER_OUTCOMES_JSON" \
  | bun ~/.claude/skills/makerkit-team/Tools/ReviewOpenPRsCli.ts aggregate
```

### Phase 6 — Render TODO Comment

Collect every reviewer's TODOs (each reviewer emits a list using the markdown protocol from `_pr-loop-shared.md`), parse them via `Tools/ParsePrTodos.ts`, and re-render via `Tools/RenderTodoComment.ts`:

```bash
# Build a JSON payload
cat <<EOF | bun ~/.claude/skills/makerkit-team/Tools/RenderTodoComment.ts > /tmp/pr-{N}-comment.md
{
  "todos": [...],
  "meta": {
    "prNumber": {N},
    "prTitle": "...",
    "reviewers": ["backend", "security", "qa"],
    "teamVerdict": "CHANGES — minor"
  }
}
EOF
```

### Phase 7 — Post or Edit-Last PR Comment

```bash
gh pr comment {N} --edit-last --create-if-none --body-file /tmp/pr-{N}-comment.md
```

`--edit-last --create-if-none`: edits the bot's prior comment if it exists, creates a fresh one otherwise. Single comment per PR per session — no thread spam. Per `Workflows/_github-collaboration.md` Comment type 1 (auto-managed). For reviewer points raised in the Phase 4 prior-comments digest that didn't make it into the team verdict, queue Type 2 replies via `gh pr comment {N} --body "..."` — pick one of the four reply categories; never silent on reviewer feedback.

### Phase 8 — Write Artifact JSON

**Produce the artifact first.** Aggregate this PR's Phase 5 team verdict and Phase 6 parsed TODOs (the `Tools/ParsePrTodos.ts` output) into the schema-conformant JSON from `_pr-loop-shared.md` Artifact JSON Schema:

```bash
# TODOS_JSON: Todo[] from ParsePrTodos.ts (Phase 6); TEAM_VERDICT from Phase 5.
ARTIFACT_JSON=$(jq -n \
  --argjson todos "$TODOS_JSON" --argjson reviewers "$REVIEWERS_JSON" \
  --arg title "$PR_TITLE" --arg head "$HEAD_REF" --arg base "$BASE_REF" \
  --arg verdict "$TEAM_VERDICT" \
  "{schemaVersion: 1, prNumber: ${N}, prTitle: \$title, headRef: \$head,
    baseRef: \$base, reviewers: \$reviewers, teamVerdict: \$verdict,
    createdAt: (now | todate), updatedAt: (now | todate),
    sideBranch: \"fix/pr-${N}-todos\", todos: \$todos}")
```

`writeArtifactJson()` in `Tools/ReviewOpenPRsCli.ts` owns the deterministic write — it resolves the ARTIFACTS path (project-level first, cwd, else global — same fallback as `ExecuteOpenTodos.resolveArtifactsDir`), `mkdir -p`s it, writes `makerkit-pr-{N}-todos.json` per the schema in `_pr-loop-shared.md`, and appends the `artifacts.jsonl` index line (field set + order + 500-char contentPreview truncation, with quote-escaping handled by `JSON.stringify` rather than a hand-typed `sed`). Covered in `Tools/__tests__/ReviewOpenPRsCli.test.ts`.

```bash
# Reads {prNumber, artifactJson, sessionId} on stdin; writes the artifact + index
# line; prints the artifact path. wing defaults to "general". jq -n builds the
# input safely so quotes inside the artifact JSON survive (the tool re-escapes via
# JSON.stringify — no hand-typed sed).
jq -n --arg aj "$ARTIFACT_JSON" --arg sid "$CLAUDE_SESSION_ID" \
  "{prNumber: ${N}, artifactJson: \$aj, sessionId: \$sid}" \
  | bun ~/.claude/skills/makerkit-team/Tools/ReviewOpenPRsCli.ts
```

### Phase 9 — Surface Final Report (and merge gate)

Emit a team-leader table to the operator. Which PRs are *offered* as merge options is decided by `validateMergeGates()` in `Tools/ReviewOpenPRsCli.ts` — a PR is eligible only when team verdict is `PASS` AND CI is `green` AND the PR author is the current user; the function returns `{eligible, reasons}` and both sides of each of the three conditions are covered in `Tools/__tests__/ReviewOpenPRsCli.test.ts`. This decides only ELIGIBILITY; the actual merge stays gated behind the operator's `AskUserQuestion` selection below — never inferred.

```bash
# stdin: {teamVerdictKind:"PASS"|"CHANGES"|"BLOCK", ci:"green"|..., author, currentUser}
# nonzero exit when NOT eligible (reasons on stdout).
echo "$MERGE_GATE_INPUT_JSON" \
  | bun ~/.claude/skills/makerkit-team/Tools/ReviewOpenPRsCli.ts merge-gate
```

For PRs `validateMergeGates` marks eligible, surface a structured `AskUserQuestion`:

```typescript
AskUserQuestion({
  questions: [{
    header: "Merge decisions",
    question: "DOS MakerkitTeam review complete. Which PRs should merge now?",
    multiSelect: true,
    options: [
      { label: "PR #N — {title}", description: "Verdict: {verdict}; CI: green; reviewers: {agents}" },
      { label: "None — review the comments first", description: "Skip the merge round; revisit later" }
    ]
  }]
})
```

For PRs the operator picks: `gh pr merge {N} --squash --delete-branch` (or per repo policy).

**NEVER auto-merge.** **NEVER pre-select** options. **NEVER infer merge from team verdict.** Per `Workflows/_commit-merge.md` Merge Gate: requires (1) explicit `AskUserQuestion` operator approval, (2) `gh pr checks {N}` confirms all required checks green. Default merge command `gh pr merge {N} --squash --delete-branch`; operator may override to `--merge` or `--rebase` if requested.

<!-- partial: _workflow-output-shape.md skill_name=MakerkitTeam workflow_name=ReviewOpenPRs -->

## Output

Per PR reviewed:

- **PR comment** — single auto-generated comment per PR per session, edited via `gh pr comment --edit-last --create-if-none`. Contains the team verdict, reviewer roster, and TODO checklist grouped by agent. URL: `https://github.com/{owner}/{repo}/pull/{N}#issuecomment-...`.
- **Artifact JSON** — `MEMORY/ARTIFACTS/makerkit-pr-{N}-todos.json` per the schema in `_pr-loop-shared.md`. Source of truth for `ExecuteOpenTodos`.
- **Index entry** — appended to `MEMORY/ARTIFACTS/artifacts.jsonl` with `type: pr-todo-list`, `workflow: ReviewOpenPRs`.

Aggregate (all PRs): a team-leader table emitted to the operator with one row per PR (number, title, verdict, reviewers, CI state). No PRD is created — this is a review workflow, not delivery.

## Anti-Goals

- **NEVER** push commits directly to a PR's head branch — `ExecuteOpenTodos` uses the side branch only.
- **NEVER** force-push anywhere.
- **NEVER** merge without explicit operator approval, even if all reviewers said PASS.
- **NEVER** call `gh pr review --approve` / `--request-changes` based on team verdict alone — that is the operator's signal.
- **NEVER** close PRs unless the operator explicitly said so.
- **NEVER** post more than one comment per PR per session — re-runs UPDATE the prior comment via `--edit-last --create-if-none`.
- **NEVER** use generic-principles reviewers (Cockburn / Fowler / UncleBob / Sentinel-as-reviewer) — that is the `github` skill's wedge. This workflow uses the kit-native 13-agent roster from `Data/Roster.json` exclusively.
