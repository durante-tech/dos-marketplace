---
name: Review Single PR
description: Deep review of one PR using the full 13-agent kit-native roster regardless of diff shape, producing an aggregated verdict, a grouped TODO checklist comment, and an artifact JSON, then stopping at the merge boundary.
status: STABLE
divergence_from_canonical:
  _intent-to-flag-table.md:
    partial_version: 1.0.0
    reason: "Shells `gh` + PR-loop Tools (ParsePrTodos.ts / RenderTodoComment.ts) with fixed invocations — operator intent maps to specific gh subcommands, not mode-selection flags; merge/approve intents are deliberately Gated (operator-only), not mapped."
bestPath:
  - title: "Preflight & Resolve PR"
    description: "Verify gh auth and repo state, then fetch the full PR state including prior comments and review threads."
  - title: "Spawn Full 13-Agent Team"
    description: "Fan out all 13 kit roles in parallel against the full diff, skipping the diff-shape classifier."
  - title: "Aggregate & Render TODOs"
    description: "Combine all reviewer verdicts and render the grouped TODO checklist."
  - title: "Post Comment & Write Artifact"
    description: "Post or edit-last the PR comment and write the artifact JSON for ExecuteOpenTodos to consume."
  - title: "Stop at Merge Boundary"
    description: "Emit a structured report to the operator and stop — merge/approve decisions require explicit operator instruction."
---

# ReviewSinglePR Workflow

Deep review of one PR with the full 13-agent MakerkitTeam roster. Use when a PR is large, architecturally significant, or when the operator wants every kit-native lens applied regardless of diff shape. Output: TODO checklist on the PR comment + artifact JSON.

Read `Workflows/_pr-loop-shared.md` for the safety tier table, side-branch convention, artifact JSON schema, and TODO markdown protocol.

## When to Use

- Architecturally significant PR (new package, new service, schema redesign)
- PR you want every kit-native lens on, regardless of diff shape
- Pre-release scrutiny on the one PR that matters most this week

## When NOT to Use

- Sweeping all open PRs → `ReviewOpenPRs`
- Want to apply prior review TODOs → `ExecuteOpenTodos`
- Quick smoke check → just use `gh pr view {N}` directly

<!-- partial: _workflow-voice.md skill_name=MakerkitTeam workflow_name=ReviewSinglePR -->

## Phase 0 — Preflight

```bash
bun Tools/MakerkitCli.ts preflight
```

Emit the capability manifest for this run (repo, roster health, scripts, doctrine). Exit 1 = unresolvable repo or invalid roster: STOP and remediate before proceeding. Branch on the manifest per `_algorithm-team-spawn.md` (spawn ladder) and the run_checks fallback ladder.

## Pipeline

### Phase 0 — Pre-flight

Same as `ReviewOpenPRs` Phase 0:

```bash
gh auth status || { echo "gh not authenticated"; exit 1; }
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || { echo "not in git repo"; exit 1; }
gh repo view --json nameWithOwner -q .nameWithOwner || { echo "no github remote"; exit 1; }
```

### Phase 1 — Resolve PR (read before write per `Workflows/_github-collaboration.md`)

Operator provides `prNumber`. Workflow fetches the full PR state INCLUDING prior comments and review threads:

```bash
gh pr view {N} --json number,title,author,isDraft,headRefName,baseRefName,body,statusCheckRollup,labels,comments,reviews,reviewRequests
gh pr diff {N}                                       # full diff
gh pr diff {N} --name-only                           # file list
gh api repos/{owner}/{repo}/pulls/{N}/comments       # inline diff comments (threaded review discussion)
```

Pass the comments + reviews digest into each reviewer's brief so they engage prior reviewer points (per `_github-collaboration.md` reply categories — acknowledged-queued / done / push-back / surface-to-operator) rather than reinvent.

If `isDraft` and operator did not say "review draft", abort with a one-line note. Otherwise continue.

### Phase 2 — Spawn Full 13-Agent Team In Parallel

**Skip the diff-shape classifier — this workflow always spawns the full team.** The classifier is for fleet review where right-sizing matters; here the operator explicitly wants every lens.

**Team spawn (per `Workflows/_algorithm-team-spawn.md` degradation ladder):** run the Phase 0 capability probe (`bun Tools/MakerkitCli.ts preflight`). Default rung is L2 Agent fan-out: in **a single message**, fire 13 parallel `Agent` calls — one per kit role (`pm`, `sm`, `ux`, `ui`, `architect`, `frontend`, `backend`, `database`, `security`, `qa`, `e2e`, `devops`, `writer`). Each: `subagent_type: "general-purpose"`, `name: <role-id>`, `model: "sonnet"`, `run_in_background: true`. L1 team choreography only when the preflight manifest confirms team primitives. Each reviewer prompt includes:

- PR metadata (number, title, body, head/base refs)
- Full diff
- The reviewer-specific framing prompt from `ReviewOpenPRs.md` Phase 4 reviewer table
- The TODO emission protocol from `_pr-loop-shared.md`
- The Reviewer Per-Stream Prompt Template from `_pr-loop-shared.md` (review-scoped — no PRD path, no ISC evidence fields; MCP authorized clusters still rendered from `Data/Roster.json`)

Wait for all 13 reports (structured returns or `MEMORY/WORK/{slug}/reports/<role>.md` files; teammate `SendMessage` only on L1) before aggregating verdicts. Apply the Non-response policy from `_algorithm-team-spawn.md` to silent streams. On L1 only, after the comment posts and the artifact JSON lands: `SendMessage shutdown_request` to each teammate.

### MCP Touchpoints (Phase 2)

Inherit from `ReviewOpenPRs.md` Phase 4 MCP touchpoints — `mcp__makerkit__run_checks` MUST run BEFORE reviewer agents start, results auto-emit CRITICAL TODOs.

**Check out the PR head BEFORE any check runs.** `run_checks` and the pyramid heuristic read the working tree, not the diff — run `gh pr checkout {N}` (or a dedicated worktree via `git fetch origin "pull/{N}/head" && git worktree add "/tmp/mkt-pr-{N}" FETCH_HEAD`) first, and restore the original branch when the review completes.

If mcp__makerkit__run_checks is unavailable (server not connected — check the capability manifest from `bun Tools/MakerkitCli.ts preflight`), fall back to the read-only ladder `pnpm lint && pnpm typecheck && pnpm test:unit`. NEVER run `pnpm healthcheck` in review/read-only contexts — it mutates files.

### Phase 3 — Aggregate Verdicts

Same aggregation rules as `ReviewOpenPRs.md` Phase 5:

- All `PASS` → team verdict `PASS — ready to merge after CI green`
- Any `BLOCK` → team verdict `BLOCK — see {reviewer}`
- Mixed PASS / CHANGES → team verdict `CHANGES — minor`
- All `CHANGES` → team verdict `CHANGES — substantial`

### Phase 4 — Render TODO Comment

Same as `ReviewOpenPRs.md` Phase 6 — collect TODOs from every reviewer, parse via `Tools/ParsePrTodos.ts`, render via `Tools/RenderTodoComment.ts`.

Because the full team ran, expect 5-15 TODOs typical, 30+ for large PRs. Render groups TODOs by agent for readability.

### Phase 5 — Post or Edit-Last PR Comment

Per `Workflows/_github-collaboration.md` Comment type 1 (auto-managed):

```bash
gh pr comment {N} --edit-last --create-if-none --body-file /tmp/pr-{N}-comment.md
```

For reviewer points raised in the Phase 1 prior-comments digest, also queue Type 2 replies (one of the four reply categories — acknowledged-queued / done / push-back / surface-to-operator). Never silent on reviewer feedback.

### Phase 6 — Write Artifact JSON

Same as `ReviewOpenPRs.md` Phase 8 — write `MEMORY/ARTIFACTS/makerkit-pr-{N}-todos.json` per the schema, append index entry to `artifacts.jsonl`.

### Phase 7 — Stop at Merge Boundary

Emit a structured report to the operator:

```
PR #{N}: {title}
Verdict: {team verdict}
Reviewers: 13/13 returned
TODOs: N total ({n_high} high, {n_medium} medium, {n_low} low)
Comment: {comment_url}
Artifact: {artifact_path}

Next step: run `execute todos for pr #{N}` to apply, or read the comment and decide manually.
```

**NEVER auto-merge.** **NEVER call `gh pr review --approve`.** Both require explicit operator instruction (Gated tier — see `Workflows/_pr-loop-shared.md` safety table + `Workflows/_commit-merge.md` Merge Gate). Merge requires (1) explicit `AskUserQuestion` operator approval, (2) `gh pr checks {N}` confirms all required checks green; default merge is `gh pr merge {N} --squash --delete-branch`.

<!-- partial: _workflow-output-shape.md skill_name=MakerkitTeam workflow_name=ReviewSinglePR -->

## Output

- **PR comment** — single auto-generated comment, edited via `gh pr comment --edit-last --create-if-none`. Verdict + roster + TODO checklist grouped by agent. URL: `https://github.com/{owner}/{repo}/pull/{N}#issuecomment-...`.
- **Artifact JSON** — `MEMORY/ARTIFACTS/makerkit-pr-{N}-todos.json` per the schema in `_pr-loop-shared.md`. Source of truth for `ExecuteOpenTodos`.
- **Index entry** — appended to `MEMORY/ARTIFACTS/artifacts.jsonl` with `type: pr-todo-list`, `workflow: ReviewSinglePR`.
- **Operator report** — structured summary: PR number/title, team verdict, reviewer count (13/13), TODO totals by priority, comment URL, artifact path, next-step hint (`execute todos for pr #N`).

## Intent-to-Flag Mapping

This workflow shells `gh` and the PR-loop Tools. Operator intent → command/flags:

| Intent | Command / flags |
|---|---|
| "review pr #N in kit" | `gh pr view {N} --json number,title,author,...,statusCheckRollup,comments,reviews` + `gh pr diff {N}` |
| post / refresh the single team comment | `gh pr comment {N} --edit-last --create-if-none --body-file <tmp>` |
| confirm required CI before any merge talk | `gh pr checks {N}` |
| parse reviewer TODOs → typed `Todo[]` | `bun run Tools/ParsePrTodos.ts` |
| render the grouped TODO comment | `bun run Tools/RenderTodoComment.ts` |

Never map operator intent to `gh pr merge` or `gh pr review --approve` — those are Gated (operator-only; see `_pr-loop-shared.md`).

## Anti-Goals

- **NEVER** skip the full-team spawn even if the diff is small — that is what `ReviewOpenPRs` is for.
- **NEVER** merge or approve based on team verdict alone.
- **NEVER** post more than one comment per session — re-runs UPDATE via `--edit-last --create-if-none`.
- **NEVER** use generic-principles reviewers — kit-native 13-agent roster only.
- **NEVER** push commits directly to the PR head branch — `ExecuteOpenTodos` handles execution on a side branch.
