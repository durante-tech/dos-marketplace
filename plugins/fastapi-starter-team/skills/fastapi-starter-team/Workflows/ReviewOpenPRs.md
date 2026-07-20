---
name: ReviewOpenPRs
description: "Fleet sweep of all open PRs — classifies each PR's reviewer set, spawns a parallel per-PR team review, and posts an idempotent TODO-checklist comment per PR."
status: STABLE
bestPath:
  - title: "Inventory & Classify"
    description: "List open PRs and determine each one's reviewer set via ClassifyPrShape."
  - title: "Read Prior State"
    description: "Pull each PR's existing reviews and comments before writing, per the read-before-write rule."
  - title: "Per-PR Team Review"
    description: "Spawn the classified reviewer team for each PR in parallel and aggregate a typed verdict."
  - title: "Render & Post Comments"
    description: "Post the TODO-checklist comment per PR, idempotently via edit-last."
  - title: "Merge Gate & Report"
    description: "Surface any PASS verdicts for operator merge approval, then report per-PR verdicts."
divergence_from_canonical:
  _intent-to-flag-table.md:
    partial_version: 1.0.0
    reason: "FastAPIStarterTeam PR sweep uses GitHub PR-loop commands; canonical Mode/Output two-table shape does not fit"
---

# ReviewOpenPRs Workflow

Sweep open PRs in the dos-fastapi-starter repo, classify each, kick off team review per PR. Sibling to `MakerkitTeam/Workflows/ReviewOpenPRs.md`.

## When to Use

- Trigger phrases: "review open prs in starter", "sweep prs in starter", "fleet review starter prs".
- Fits when you want to triage and review every open PR in the repo in one pass.
- NOT for a deep, single-PR review — use `ReviewSinglePR` instead.

Reviewer prompts are composed from the **Reviewer Per-Stream Prompt Template** in `_pr-loop-shared.md` (verdict PASS|CHANGES|BLOCK + TODO checklist protocol — the review-stream output contract); spawn mechanics per `_algorithm-team-spawn.md`.

## Pre-flight

1. Voice notify: `bash "$DOS_DIR/DOS/Tools/voice.sh" main "Running ReviewOpenPRs workflow in fastapi-starter-team skill to sweep PRs"`
2. Read `_pr-loop-shared.md` (safety tier table) and `_github-collaboration.md` (read-before-write).

## Intent-to-Flag Mapping

| Operator intent | Command / flag pattern | Notes |
|---|---|---|
| "review all open PRs" | `gh pr list --state open --json number,title,headRefName,baseRefName,labels,isDraft` | Inventory only; no writes. |
| "classify reviewers for PR N" | `gh pr diff <N> --name-only \| bun ~/.claude/skills/fastapi-starter-team/Tools/ClassifyPrShape.ts` | Determines the team roster for that PR. |
| "post the review summary" | `gh pr comment N --edit-last --create-if-none --body-file /tmp/pr-N-comment.md` | Idempotent single-comment update. |

## Phase 1 — Inventory (PM solo)

```bash
gh pr list --state open --json number,title,headRefName,baseRefName,labels,isDraft
```

PRD `## Context` lists each PR with its current state.

## Phase 2 — Classify (PM solo)

For each PR, determine reviewer set via `Tools/ClassifyPrShape.ts`:

```bash
gh pr diff <N> --name-only | bun ~/.claude/skills/fastapi-starter-team/Tools/ClassifyPrShape.ts
```

Returns `{ agents: AgentId[], matchedLenses: string[], topLevelSubsystems: string[], isCrosscut: boolean, isPureDocs: boolean }`. Captured in PRD `## Decisions → ### PR <N> reviewer set`.

## Phase 3 — Read prior state (per PR, parallel via /batch)

For each PR `N`:

```bash
gh pr view N --json number,title,body,state,labels,reviews,comments,statusCheckRollup,headRefName,baseRefName
gh api repos/{owner}/{repo}/pulls/N/comments    # inline comments
```

Cite prior state into PRD `## Context → ### PR <N> prior state`. Per `_github-collaboration.md` read-before-write rule.

## Phase 4 — Per-PR Review (parallel TeamCreate per PR)

For each PR, spawn a team per `_algorithm-team-spawn.md`:

```typescript
TeamCreate({ team_name: "fst-fleet-pr<N>", description: "<reviewer-count>-stream parallel review of PR #<N>", agent_type: "team-lead" })
```

Then in a single message, fire `Agent` calls for every role in the classified reviewer set. Per `_test-pyramid-gate.md`, QA + E2E auto-emit pyramid-completeness TODOs for missing-layer files.

Reviewers emit TODOs in the canonical markdown protocol from `_pr-loop-shared.md`:

```
- [ ] (agent:backend) (priority:high) (file:src/app/api/v1/x.py:42) Move auth check
```

Aggregator collects per-stream `SendMessage` reports, computes typed `Verdict` (PASS / BLOCK / CHANGES{minor|substantial}).

### MCP Touchpoints (Phase 4)

- **`mcp__dos_fastapi__run_checks`** — orchestrator runs after `gh pr checkout` per PR
- **`mcp__dos_fastapi__list_routes`** — Backend + Architect verify route surface integrity
- **`mcp__dos_fastapi__alembic_check`** — Database verifies no drift introduced

## Phase 5 — Render comment (per PR)

```bash
echo '<artifact JSON>' | bun ~/.claude/skills/fastapi-starter-team/Tools/RenderTodoComment.ts > /tmp/pr-N-comment.md
gh pr comment N --edit-last --create-if-none --body-file /tmp/pr-N-comment.md
```

Artifact JSON written to `MEMORY/ARTIFACTS/fastapistarter-pr-<N>-todos.json` per `_pr-loop-shared.md` schema.

## Phase 6 — Shutdown teams + report

Per `_algorithm-team-spawn.md` shutdown sequence — send `shutdown_request` to each teammate. Update PRD with summary of all PR verdicts.

## Phase 7 — (Optional) merge gate per PR

If any PR returned `PASS`, surface to operator via `AskUserQuestion`:

```
Question: PR #<N> verdict: PASS. Approve merge?
Options: Merge now (gh pr merge --squash) | Wait | Skip
```

Per `_commit-merge.md` Merge Gate — never auto-merge. CI checks must be green via `gh pr checks <N>`.

## Phase 8 — Report

Final summary in PRD `## Verification`: per-PR verdict + reviewer count + TODO count + open / merged.

PRD `phase: complete`.

## Anti-criteria

- ✗ Auto-merging based on team verdict — `_commit-merge.md` Gated tier
- ✗ Posting multiple top-level comments per PR — `_pr-loop-shared.md` Loop Idempotency rule
- ✗ Skipping `gh pr view` before commenting — `_github-collaboration.md` read-before-write rule
