---
name: List PRs
description: Lightweight status sweep of open PRs — no reviewer team, no comments
status: STABLE
bestPath:
  - title: "Pre-Flight Verification"
    description: "Confirm gh CLI auth and a github remote in the current repo."
  - title: "Enumerate Open PRs"
    description: "List open PRs with author, age, CI state, labels via gh CLI."
  - title: "Compute Derived Fields"
    description: "Calculate age, staleness, CI state, and rank per PR."
  - title: "Render Table"
    description: "Output the ranked markdown table with summary footer."
  - title: "Optional Drill-In"
    description: "On request, fetch detailed metadata for a single PR — no reviewer spawning."
divergence_from_canonical:
  _intent-to-flag-table.md:
    partial_version: 1.0.0
    reason: "Github ListPRs workflow uses workflow-specific intent-to-flag vocabulary; canonical Mode/Output two-table shape doesn't fit"
---

# ListPRs Workflow

## When to Use

- User wants a quick status snapshot of open PRs ("list open prs", "what prs are open", "pr status")
- Pairs naturally with `/loop` for a recurring daily morning brief
- No comments, no reviewer agents, no writes needed — pure read
- NOT for multi-perspective team review — use `ReviewPRs.md` (fleet) or `ReviewSinglePR.md` (one PR) instead

Read-only status sweep. Lists open PRs with author, age, CI state, labels, and ranking. **No reviewer agents. No comments. No writes.** Pairs naturally with `/loop` for a daily morning brief.

<!-- partial: _workflow-voice.md skill_name=Github workflow_name=ListPRs action_phrase=" to sweep open pull request status" -->

## Pre-Flight

```bash
gh auth status >/dev/null 2>&1 || { echo "gh not authenticated"; exit 1; }
gh repo view --json nameWithOwner -q .nameWithOwner >/dev/null 2>&1 || { echo "no github remote in cwd"; exit 1; }
```

## Step 1: Enumerate

```bash
gh pr list \
  --state open \
  --limit 100 \
  --json number,title,author,isDraft,labels,createdAt,updatedAt,headRefName,reviewDecision,statusCheckRollup,mergeable
```

## Intent-to-Flag Mapping

| User Says | Flag / Filter |
|---|---|
| (default) | All open, drafts grouped at bottom |
| "only mine" | `--author @me` |
| "only failing" | post-filter `statusCheckRollup` for FAILURE |
| "only ready to merge" | `reviewDecision=APPROVED` AND `mergeable=MERGEABLE` AND CI green |
| "stale" | `updatedAt > 14d ago` only |
| "label X" | `--label X` |
| "JSON" | emit raw JSON instead of table |
| "by author" | group rows by author |

## Step 2: Compute Derived Fields

For each PR:

- **age**: `now - createdAt` in days
- **stale**: `now - updatedAt > 14d`
- **ci_state**: `green` / `red` / `pending` / `none` from `statusCheckRollup`
- **size**: `gh pr diff {N} --patch | wc -l` (only on demand — skip in `--fast` mode)
- **review_state**: from `reviewDecision` — `APPROVED` / `CHANGES_REQUESTED` / `REVIEW_REQUIRED` / null
- **rank**: red-CI first, then `CHANGES_REQUESTED`, then stale, then oldest, then everything else

## Step 3: Render Table

Default output is a markdown table sorted by rank:

```
| #   | Title                              | Author    | Age   | CI   | Review            | Labels        |
|-----|------------------------------------|-----------|-------|------|-------------------|---------------|
| 42  | Add OAuth refresh                  | @[REDACTED:operator-username]  | 3d    | red  | CHANGES_REQUESTED | bug, p0       |
| 51  | Refactor pipeline runner           | @[REDACTED:operator-username]  | 6d    | green| APPROVED          | refactor      |
| 47  | (draft) New dashboard layout       | @[REDACTED:operator-username]  | 12d   | -    | -                 | wip           |
```

Footer:

```
N open · M ready-to-merge · K failing CI · L stale · D drafts
```

## Step 4: Optional Drill-In

If the user asks "tell me more about #42", run:

```bash
gh pr view 42 --json title,body,author,createdAt,statusCheckRollup,reviewDecision,reviewThreads
gh pr checks 42
gh pr diff 42 --name-only
```

…and surface a brief summary. Do **NOT** spawn reviewer agents — that's `ReviewSinglePR.md`.

## Anti-Goals

- **NEVER** post comments.
- **NEVER** approve / request changes / merge / close.
- **NEVER** spawn reviewer agents — this workflow is reads only.
