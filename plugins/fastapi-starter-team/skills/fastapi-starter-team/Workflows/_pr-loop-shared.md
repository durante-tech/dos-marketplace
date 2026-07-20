# PR Loop Shared Conventions

Shared substrate for `ReviewOpenPRs`, `ReviewSinglePR`, and `ExecuteOpenTodos`. Defines safety tiers, side-branch convention, artifact JSON schema, and the TODO checklist markdown protocol. Workflows reference this file rather than duplicating the contracts inline.

**Sibling:** `MakerkitTeam/Workflows/_pr-loop-shared.md`. Same shape; reflavored AgentId list (apidx/schema/agent replace ux/ui/frontend) and artifact name (`fastapistarter-pr-{N}-todos.json`).

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

- **Branch name:** `fix/pr-{N}-todos` where `{N}` is the PR number.
- **Base:** every run branches FRESH from current `origin/{pr_head_ref}`.
- **Subsequent runs:** create a NEW side branch — first run gets `fix/pr-{N}-todos`, later runs get the `-r{n}` variant (pick the lowest `{n}` that does not collide with an existing branch). NEVER rebase a previously pushed side branch: it may hold commits the operator already reviewed or merged, and rewriting it would require the forbidden `--force`. (Ported from MakerkitTeam 2026-07-09 — the prior "rebase, then push, NEVER --force" instruction was self-contradictory. Naming is derived inline here; MakerkitTeam's `Tools/PrLoopSideBranch.ts` was not ported.)
- **Push:** `git push -u origin <derived-name>` (base or the `-r{n}` variant). NEVER `--force`.

## Artifact JSON Schema

Path: `MEMORY/ARTIFACTS/fastapistarter-pr-{N}-todos.json` (project-level if `$CLAUDE_PROJECT_DIR/MEMORY/ARTIFACTS/` exists, else global).

```json
{
  "schemaVersion": 1,
  "prNumber": 42,
  "prTitle": "Add webhook receipts endpoint",
  "headRef": "feat/webhook-receipts",
  "baseRef": "main",
  "reviewers": ["backend", "security", "qa", "agent"],
  "teamVerdict": "CHANGES — minor",
  "createdAt": "2026-05-06T18:00:00Z",
  "updatedAt": "2026-05-06T18:30:00Z",
  "sideBranch": "fix/pr-42-todos",
  "todos": [
    {
      "agent": "backend",
      "priority": "high",
      "description": "Move auth check before payload parse",
      "file": "src/app/api/v1/webhooks.py:42",
      "done": false,
      "blocked": null
    },
    {
      "agent": "agent",
      "priority": "medium",
      "description": "Wrap chat endpoint in EventSourceResponse for >2s tasks",
      "file": "src/app/agents/chat/router.py:18",
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
- [ ] (agent:backend) (priority:high) (file:src/app/api/v1/users.py:12) Move auth check
- [x] (agent:database) (priority:medium) Add tenant_id index
- [ ] (agent:e2e) (priority:low) Add integration spec <!-- blocked: needs PR-A merge first -->
- [ ] (agent:agent) (priority:high) (file:src/app/agents/chat/service.py:8) Wrap construction in lru_cache
```

**Required tags per row:** `(agent:X)` and `(priority:Y)`.
**Optional tags:** `(file:path:line)` references the file and line being addressed.
**Blocked marker:** `<!-- blocked: reason -->` HTML comment at end of row. ExecuteOpenTodos skips blocked rows.
**Done state:** `- [x]` mark.

**Valid agent values:** `pm`, `sm`, `apidx`, `schema`, `architect`, `agent`, `backend`, `database`, `security`, `qa`, `e2e`, `devops`, `writer` (the 13 FastAPIStarterTeam roster ids from `Data/Roster.json`).
**Valid priority values:** `high`, `medium`, `low`.

Rows that don't match the row regex `^\s*-\s\[([ x])\]\s+(.+)$` or that lack required tags are SKIPPED by the parser without throwing. This keeps the parser robust against operator-edited comments and reviewer-agent freeform text mixed into the checklist.

## Loop Idempotency

- **Re-running ReviewOpenPRs / ReviewSinglePR on the same PR**: `gh pr comment --edit-last --create-if-none` UPDATES the existing comment in place. The artifact JSON is overwritten with fresh reviewer findings. Operator gets one comment per PR per session, not N.
- **Re-running ExecuteOpenTodos on the same PR**: side branch is reused, new commits append, healthcheck (`uv run pytest` + `mcp__dos_fastapi__run_checks`) runs after each batch. Already-`done` TODOs are skipped (the parser preserves done-state from the comment).


## Reviewer Per-Stream Prompt Template

`ReviewOpenPRs` and `ReviewSinglePR` compose reviewer prompts from THIS template — NOT the delivery per-stream template in `_algorithm-team-spawn.md`. Reviewers read a diff and emit verdicts + TODOs; they have no delivery PRD, no ISCs, and no file-ownership zones, so those delivery-mandatory fields are omitted here. Spawn mechanics (ladder rung, `subagent_type`, `name`, `run_in_background`, Non-response policy) still come from `_algorithm-team-spawn.md`; only the prompt content differs. (Ported from MakerkitTeam `_pr-loop-shared.md` 2026-07-09, adapted to the starter roster.)

```markdown
You are starter role `<role-id>` (<role-name>) reviewing PR #<N> on the FastAPIStarterTeam.

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
<the role's framing prompt from ReviewOpenPRs.md Phase 4>

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
