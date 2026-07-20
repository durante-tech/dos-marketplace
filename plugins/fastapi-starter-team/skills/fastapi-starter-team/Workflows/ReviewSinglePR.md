---
name: ReviewSinglePR
description: "Deep multi-agent team review of one PR — classifies and spawns the reviewer set, aggregates a typed PASS/BLOCK/CHANGES verdict, and posts one canonical TODO-checklist comment."
status: STABLE
bestPath:
  - title: "Resolve PR"
    description: "Read-before-write pull of the PR's state, diff, and prior comments."
  - title: "Classify & Spawn Team"
    description: "Determine the reviewer set via ClassifyPrShape and spawn the classified agents in parallel."
  - title: "Aggregate Verdict"
    description: "Collect per-stream reports and compute a typed PASS/BLOCK/CHANGES verdict."
  - title: "Cross-Check & Render"
    description: "Verify load-bearing claims directly, then post the TODO-checklist comment."
  - title: "Reply & Stop at Merge Boundary"
    description: "Engage existing reviewer comments, then surface the merge decision to the operator."
divergence_from_canonical:
  _intent-to-flag-table.md:
    partial_version: 1.0.0
    reason: "FastAPIStarterTeam single-PR review maps GitHub PR-loop commands; canonical Mode/Output two-table shape does not fit"
---

# ReviewSinglePR Workflow

Deep team review of one PR. Spawns full classified reviewer set, emits one comment, writes artifact. Sibling to `MakerkitTeam/Workflows/ReviewSinglePR.md`.

## When to Use

- Trigger phrases: "review pr #N in starter", "deep review pr in starter", "team review pr in starter".
- Fits when you want a deep, multi-agent review of one specific PR, producing a TODO checklist for follow-up.
- NOT for sweeping every open PR in one pass — use `ReviewOpenPRs` instead.

## Pre-flight

1. Voice notify: `bash "$DOS_DIR/DOS/Tools/voice.sh" main "Running ReviewSinglePR workflow in fastapi-starter-team skill to deep-review PR"`
2. Operator passes PR number `N`.

## Intent-to-Flag Mapping

| Operator intent | Command / flag pattern | Notes |
|---|---|---|
| "review PR N" | `gh pr view N --json ...` plus `gh pr diff N --name-only` | Read-before-write context load. |
| "classify reviewers" | `gh pr diff N --name-only \| bun ~/.claude/skills/fastapi-starter-team/Tools/ClassifyPrShape.ts` | Produces reviewer set. |
| "post/update the review comment" | `gh pr comment N --edit-last --create-if-none --body-file /tmp/pr-N-comment.md` | Keeps one canonical PR-loop comment. |

## Phase 1 — Resolve PR (read-before-write)

```bash
gh pr view N --json number,title,body,state,labels,assignees,reviewRequests,reviews,comments,statusCheckRollup,headRefName,baseRefName,mergeable
gh pr diff N --name-only
gh api repos/{owner}/{repo}/pulls/N/comments   # inline comments
```

Capture into PRD `## Context → ### PR <N> resolved state`. Per `_github-collaboration.md`.

## Phase 2 — Classify + spawn team

Via `Tools/ClassifyPrShape.ts`:

```bash
gh pr diff N --name-only | bun ~/.claude/skills/fastapi-starter-team/Tools/ClassifyPrShape.ts
```

Returns reviewer set. Spawn team per `_algorithm-team-spawn.md`:

```typescript
TeamCreate({ team_name: "fst-review-pr<N>", description: "<reviewer-count>-stream parallel review of PR #<N>", agent_type: "team-lead" })
```

In a single message, fire `Agent` calls for every role in the classified reviewer set. Per `_test-pyramid-gate.md`, QA + E2E auto-emit pyramid-completeness TODOs for missing-layer files.

Each reviewer emits TODOs in the canonical markdown protocol from `_pr-loop-shared.md`:

```
- [ ] (agent:backend) (priority:high) (file:src/app/api/v1/x.py:42) Move auth check
```

### MCP Touchpoints (Phase 2)

- **`mcp__dos_fastapi__run_checks`** — orchestrator runs after `gh pr checkout`; per-stream view of pre-existing breakage
- **`mcp__dos_fastapi__list_routes`** — Backend + Architect verify route surface integrity
- **`mcp__dos_fastapi__alembic_check`** — Database verifies no drift introduced

## Phase 3 — Aggregate verdict

Collect per-stream `SendMessage` reports. Compute typed `Verdict` (PASS / BLOCK / CHANGES{minor|substantial}) via `Tools/_shared.ts → formatVerdict()`.

Verdict logic:
- Any reviewer returns BLOCK → team verdict BLOCK
- Else any reviewer returns CHANGES — substantial → team verdict CHANGES — substantial
- Else any reviewer returns CHANGES — minor → team verdict CHANGES — minor
- Else (all PASS) → team verdict PASS

## Phase 4 — Cross-check

Per Algorithm §6.6 Critical Claim Cross-Check: for every reviewer claim that affected verdict (e.g., "auth check missing on POST /webhooks"), parent runs direct `Read` / `Grep` to verify before incorporating into final report.

## Phase 5 — Render + post comment

Build artifact JSON per `_pr-loop-shared.md` schema:

```json
{
  "schemaVersion": 1,
  "prNumber": <N>,
  "prTitle": "<title>",
  "headRef": "<head>",
  "baseRef": "<base>",
  "reviewers": [<agent ids>],
  "teamVerdict": "<verdict>",
  "createdAt": "<ISO>",
  "updatedAt": "<ISO>",
  "sideBranch": "fix/pr-<N>-todos",
  "todos": [...]
}
```

Write to `MEMORY/ARTIFACTS/fastapistarter-pr-<N>-todos.json`. Render comment:

```bash
echo '<artifact JSON>' | bun ~/.claude/skills/fastapi-starter-team/Tools/RenderTodoComment.ts > /tmp/pr-N-comment.md
gh pr comment N --edit-last --create-if-none --body-file /tmp/pr-N-comment.md
```

## Phase 6 — Reply to existing reviewer comments (if any)

For each external reviewer comment surfaced in Phase 1, pick one of the four reply categories from `_github-collaboration.md` (acknowledged-queued / done / push-back / surface-to-operator). Never silent.

## Phase 7 — Shutdown + Stop at Merge Boundary

Per `_algorithm-team-spawn.md` shutdown sequence. Per `_commit-merge.md` Merge Gate — STOP. Surface verdict to operator. Operator decides whether to merge via `AskUserQuestion`:

```
Question: PR #<N> verdict: <verdict>. Approve merge?
Options: Merge now (gh pr merge --squash) | Apply TODOs (ExecuteOpenTodos) | Wait | Skip
```

PRD `phase: complete`.

## Anti-criteria

- ✗ Auto-merging based on team verdict — Gated tier
- ✗ Skipping read-before-write at Phase 1 — anti-pattern
- ✗ Posting a fresh comment instead of `--edit-last` — Loop Idempotency violation
