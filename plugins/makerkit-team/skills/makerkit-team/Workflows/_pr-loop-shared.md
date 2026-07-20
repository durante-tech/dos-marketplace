# PR Loop Shared Conventions

Shared substrate for `ReviewOpenPRs`, `ReviewSinglePR`, and `ExecuteOpenTodos`. Defines safety tiers, side-branch convention, artifact JSON schema, and the TODO checklist markdown protocol. Workflows reference this file rather than duplicating the contracts inline.

## Safety Tier Table (binding)

PR actions split into three tiers. Workflows MUST enforce the split — never blur it.

| Action | Tier | Behavior |
|---|---|---|
| `gh pr list`, `gh pr view`, `gh pr diff`, `gh pr checks` | **Auto-read** | Always allowed. Read-only on remote. |
| `gh pr comment` (one summary per PR per loop, edited via `--edit-last --create-if-none`) | **Auto-write low-blast** | Allowed without explicit approval — comments are reversible. Re-runs UPDATE the prior comment, never append. |
| Pushing commits to side branch `fix/pr-{N}-todos` | **Auto-write low-blast** | Side-branch only. Never the PR head branch. |
| `gh pr review --approve` / `--request-changes` | **Gated** | Requires explicit operator "yes, approve PR #N". Never inferred from team verdict. |
| `gh pr merge` | **Gated + CI-check** | Requires (1) operator approval via `AskUserQuestion`, (2) all required CI checks green. Never auto-merge. |
| `gh pr close`, `gh pr ready` | **Gated** | Requires explicit operator instruction. |
| `git push origin {pr_head_ref}` (PR head branch) | **NEVER** | Forbidden. Side branch is the only write target. |
| `git push --force` anywhere | **NEVER** | Forbidden. |

## Side-Branch Convention

The branch-NAME derivation is owned by `Tools/PrLoopSideBranch.ts` (pure, tested in `Tools/__tests__/PrLoopSideBranch.test.ts`) — `sideBranchName(N)` → `fix/pr-{N}-todos`, `retrySideBranchName(N, n)` → the `-r{n}` variant, and `nextAvailableSideBranch(N, existingBranches)` picks the lowest non-colliding name given the set of branches that already exist. The git ORCHESTRATION below (checkout / push) stays narrated here because it is working-tree + network I/O; only the duplication-prone naming is in code.

- **Branch name:** `fix/pr-{N}-todos` where `{N}` is the PR number, from `sideBranchName(N)`.
- **Base:** every run branches FRESH from current `origin/{pr_head_ref}`.
- **Subsequent runs:** create a NEW side branch via `nextAvailableSideBranch(N, existing)` — first run gets `fix/pr-{N}-todos`, later runs get the `-r{n}` variant (incrementing `{n}`). NEVER rebase a previously pushed side branch: it may hold commits the operator already reviewed or merged, and rewriting it would require the forbidden `--force`.
- **Push:** `git push -u origin <derived-name>` (base or the `-r{n}` variant). NEVER `--force`.

```bash
# Derive the next free side-branch name from the set of existing branches
# (local AND remote — a name pushed by a prior run must not be reused).
EXISTING=$(git branch --all --list "*fix/pr-{N}-todos*" --format '%(refname:short)' \
  | sed 's|^origin/||' | sort -u | jq -R . | jq -s .)
jq -n --argjson e "$EXISTING" '{prNumber: {N}, existing: $e}' \
  | bun ~/.claude/skills/makerkit-team/Tools/PrLoopSideBranch.ts next
```

## Artifact JSON Schema

Path: `MEMORY/ARTIFACTS/makerkit-pr-{N}-todos.json` (project-level if `$CLAUDE_PROJECT_DIR/MEMORY/ARTIFACTS/` exists, else global).

```json
{
  "schemaVersion": 1,
  "prNumber": 42,
  "prTitle": "Add billing webhooks",
  "headRef": "feat/billing-webhooks",
  "baseRef": "main",
  "reviewers": ["backend", "security", "qa"],
  "teamVerdict": "CHANGES — minor",
  "createdAt": "2026-05-01T18:00:00Z",
  "updatedAt": "2026-05-01T18:30:00Z",
  "sideBranch": "fix/pr-42-todos",
  "todos": [
    {
      "agent": "backend",
      "priority": "high",
      "description": "Move auth check into action middleware",
      "file": "apps/web/app/(app)/billing/webhook.action.ts:42",
      "done": false,
      "blocked": null
    }
  ]
}
```

**Required fields per todo:** `agent`, `priority`, `description`, `done`. **Optional:** `file`, `blocked` (string reason if blocked, else `null` or omitted).

The artifact is the single source of truth — the PR comment is a rendered view of this JSON. Re-rendering with `Tools/RenderTodoComment.ts` produces a deterministic comment body.

## TODO Checklist Markdown Protocol

Reviewer agents emit TODOs into the PR comment in this exact format. `Tools/ParsePrTodos.ts` is the parser that reads them back.

```markdown
- [ ] (agent:backend) (priority:high) (file:apps/web/x.ts:12) Move auth check
- [x] (agent:database) (priority:medium) Add organizationId index
- [ ] (agent:e2e) (priority:low) Add Playwright spec <!-- blocked: needs PR-A merge first -->
```

**Required tags per row:** `(agent:X)` and `(priority:Y)`.
**Optional tags:** `(file:path:line)` references the file and line being addressed.
**Blocked marker:** `<!-- blocked: reason -->` HTML comment at end of row. ExecuteOpenTodos skips blocked rows.
**Done state:** `- [x]` mark.

**Valid agent values:** `pm`, `sm`, `ux`, `ui`, `architect`, `frontend`, `backend`, `database`, `security`, `qa`, `e2e`, `devops`, `writer` (the 13 MakerkitTeam roster slugs from `Data/Roster.json`).
**Valid priority values:** `high`, `medium`, `low`.

Rows that don't match the row regex `^\s*-\s\[([ x])\]\s+(.+)$` or that lack required tags are SKIPPED by the parser without throwing. This keeps the parser robust against operator-edited comments and reviewer-agent freeform text mixed into the checklist.

## Reviewer Per-Stream Prompt Template

`ReviewOpenPRs` and `ReviewSinglePR` compose reviewer prompts from THIS template — NOT the delivery per-stream template in `_algorithm-team-spawn.md`. Reviewers read a diff and emit verdicts + TODOs; they have no delivery PRD, no ISCs, and no file-ownership zones, so those delivery-mandatory fields are omitted here. Spawn mechanics (ladder rung, `subagent_type`, `name`, `run_in_background`, Non-response policy) still come from `_algorithm-team-spawn.md`; only the prompt content differs.

```markdown
You are kit role `<role-id>` (<role-name>) reviewing PR #<N> on the MakerkitTeam.

PR: #<N> — <title> (<head-ref> → <base-ref>, author <author>)

PR BODY
<body>

DIFF
<full diff, or the lens-relevant slice for fleet review>

PRIOR DISCUSSION DIGEST
<comments + reviews summary — engage these points per `_github-collaboration.md`
reply categories (acknowledged-queued / done / push-back / surface-to-operator);
do not reinvent settled discussion>

YOUR FRAMING QUESTION
<the role's framing prompt from ReviewOpenPRs.md Phase 4 table>

AUTHORIZED MCP TOOLS
<rendered from Data/Roster.json mcp_tools + Data/McpToolMap.json>

OUTPUT (exactly this shape)
1. Verdict: PASS | CHANGES | BLOCK, plus <=200 words of reasoning
2. TODOs in the checklist markdown protocol from `_pr-loop-shared.md`:
   `- [ ] (agent:<role-id>) (priority:high|medium|low) (file:path:line) <description>`
3. Report back: structured return, or `MEMORY/WORK/{slug}/reports/<role-id>.md`
   per the `_algorithm-team-spawn.md` rendezvous contract

CONSTRAINTS
- READ-ONLY: never edit files, never commit, never push, never comment on the
  PR yourself — the orchestrator owns all writes.
- Cite file:line for every TODO where possible; verdict from diff evidence only.

START NOW.
```

## Loop Idempotency

- **Re-running ReviewOpenPRs / ReviewSinglePR on the same PR**: `gh pr comment --edit-last --create-if-none` UPDATES the existing comment in place. The artifact JSON is overwritten with fresh reviewer findings. Operator gets one comment per PR per session, not N.
- **Re-running ExecuteOpenTodos on the same PR**: a FRESH side branch (`-r{n}` via `nextAvailableSideBranch`) is cut from current `origin/{pr_head_ref}`; verification runs after each batch. Already-`done` TODOs are skipped (the parser preserves done-state from the comment).

## Intent-to-Flag Mapping

This partial shells `gh` for the PR review-execute loop. Operator intent → command/flags:

| Intent | Command / flags |
|---|---|
| enumerate open PRs to sweep | `gh pr list --json number,title,headRefName,...` |
| read one PR's diff + checks | `gh pr diff {N}` / `gh pr checks {N}` |
| post / refresh the team comment | `gh pr comment {N} --edit-last --create-if-none` |
| close a PR (operator-instructed only) | `gh pr close {N}` |

Gated (operator-only, never inferred): `gh pr merge`, `gh pr review --approve` — see the safety tier table above.
