---
name: Execute Open Todos
description: Parses the TODO checklist left on a PR comment by ReviewOpenPRs or ReviewSinglePR, groups TODOs by responsible kit agent, and executes each batch serially on a side branch with per-batch healthcheck verification and lockstep PR-comment re-rendering.
status: STABLE
bestPath:
  - title: "Preflight & Resolve PR"
    description: "Verify gh auth, git repo, and GitHub remote, then resolve the target PR number from operator input or the latest TODO artifact."
  - title: "Load TODOs & Branch Setup"
    description: "Load the artifact JSON (or parse the PR comment as fallback) and cut a fresh side branch from the PR head."
  - title: "Group & Execute Batches"
    description: "Group pending TODOs by agent, sort by priority, and execute each batch serially with per-batch verify-before-implement, edits, and healthcheck."
  - title: "Push & Re-render"
    description: "Push the side branch and re-render the PR TODO comment in lockstep with the updated artifact."
  - title: "Post Execution Summary"
    description: "Post an execution summary comment and stop at the merge boundary for operator review."
---

# ExecuteOpenTodos Workflow

Parse the TODO checklist on a PR comment, group by responsible agent, execute each batch on a side branch with per-batch verification, and re-render the comment as work progresses. Companion to `ReviewOpenPRs` / `ReviewSinglePR` (those workflows generate the TODOs this one consumes).

Read `Workflows/_pr-loop-shared.md` for the safety tier table, side-branch convention, artifact JSON schema, and TODO markdown protocol.

## When to Use

- After `ReviewOpenPRs` or `ReviewSinglePR` left a TODO checklist on a PR
- To apply CHANGES-tier review feedback without manually dispatching to the right kit role
- To re-run after a partial completion (already-`done` TODOs are skipped; blocked TODOs surface for operator)

## When NOT to Use

- No prior TODO comment exists → run `ReviewSinglePR` or `ReviewOpenPRs` first
- TODOs require human judgement (architecture rewrite, product scope) → operator handles directly
- Want the TODOs but not execution → just read the artifact JSON

<!-- partial: _workflow-voice.md skill_name=MakerkitTeam workflow_name=ExecuteOpenTodos -->

## Phase 0 — Preflight

```bash
bun Tools/MakerkitCli.ts preflight
```

Emit the capability manifest for this run (repo, roster health, scripts, doctrine). Exit 1 = unresolvable repo or invalid roster: STOP and remediate before proceeding. Branch on the manifest per `_algorithm-team-spawn.md` (spawn ladder) and the run_checks fallback ladder.

## Pipeline

### Phase 0 — Pre-flight

```bash
gh auth status || { echo "gh not authenticated"; exit 1; }
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || { echo "not in git repo"; exit 1; }
gh repo view --json nameWithOwner -q .nameWithOwner || { echo "no github remote"; exit 1; }
which pnpm || { echo "pnpm required for kit healthcheck — install and retry"; exit 1; }
```

**Read before write (per `Workflows/_github-collaboration.md`):** before applying any TODOs, refresh the PR state to ingest any reviewer feedback that landed since the originating review:

```bash
gh pr view "$PR_NUMBER" --json comments,reviews,statusCheckRollup,labels
gh api "repos/$(gh repo view --json nameWithOwner -q .nameWithOwner)/pulls/${PR_NUMBER}/comments"
```

If reviewer feedback contains new TODO-shaped points not in the artifact, add them per the canonical markdown protocol (`(agent:X) (priority:Y)`) before grouping batches in Phase 4. Queue Type 2 replies for the reviewer's comments per `_github-collaboration.md` reply categories — never silent.

### Phase 1 — Resolve PR

Operator provides `prNumber` explicitly OR omits it (workflow scans latest artifact):

```bash
# Explicit
PR_NUMBER=42

# Implicit — resolve the latest makerkit-pr-*-todos.json artifact deterministically.
# resolvePrArtifact() owns the artifacts-dir fallback chain (project-first, global
# fallback), the glob, the latest-by-mtime selection, and the PR-number extraction —
# see Tools/ExecuteOpenTodos.ts. Prints the PR number; exits nonzero if none found.
PR_NUMBER=$(bun ~/.claude/skills/makerkit-team/Tools/ExecuteOpenTodos.ts)
```

If both fail (no explicit `prNumber` and the resolver exits nonzero), abort with a one-line note ("no PR# given and no artifact found — run ReviewSinglePR first").

### Phase 2 — Load Artifact + Parse Comment

Source-of-truth precedence:

1. **Artifact JSON** at `MEMORY/ARTIFACTS/makerkit-pr-{N}-todos.json` — canonical when present
2. **PR comment** parsed via `Tools/ParsePrTodos.ts` — fallback when artifact missing or stale

```bash
# Assign the artifact path deterministically ONCE — same fallback chain as
# resolveArtifactsDir() in Tools/ExecuteOpenTodos.ts (project-level first, else global).
ARTIFACTS_DIR="${CLAUDE_PROJECT_DIR:-.}/MEMORY/ARTIFACTS"
[ -d "$ARTIFACTS_DIR" ] || ARTIFACTS_DIR="$HOME/.claude/MEMORY/ARTIFACTS"
ARTIFACT_JSON_PATH="${ARTIFACTS_DIR}/makerkit-pr-${PR_NUMBER}-todos.json"

# Try artifact first
if [ -f "$ARTIFACT_JSON_PATH" ]; then
  TODOS_JSON=$(cat "$ARTIFACT_JSON_PATH")
else
  # Fallback: parse the PR comment
  COMMENT_BODY=$(gh pr view "$PR_NUMBER" --json comments --jq '.comments[] | select(.body | contains("DOS MakerkitTeam review")) | .body' | tail -1)
  TODOS_JSON=$(echo "$COMMENT_BODY" | bun ~/.claude/skills/makerkit-team/Tools/ParsePrTodos.ts)
fi
```

### Phase 3 — Branch Setup

Every run cuts a FRESH side branch from current `origin/{pr_head_ref}` (per `_pr-loop-shared.md` Side-Branch Convention — never rebase a previously pushed side branch). `nextAvailableSideBranch()` in `Tools/PrLoopSideBranch.ts` picks the lowest non-colliding name: `fix/pr-{N}-todos` on the first run, `-r{n}` variants after.

```bash
HEAD_REF=$(gh pr view "$PR_NUMBER" --json headRefName -q .headRefName)

git fetch origin

# Derive the next free side-branch name (local + remote — pushed names never reused)
EXISTING=$(git branch --all --list "*fix/pr-${PR_NUMBER}-todos*" --format '%(refname:short)' \
  | sed 's|^origin/||' | sort -u | jq -R . | jq -s .)
SIDE_BRANCH=$(jq -n --argjson e "$EXISTING" "{prNumber: ${PR_NUMBER}, existing: \$e}" \
  | bun ~/.claude/skills/makerkit-team/Tools/PrLoopSideBranch.ts next)

git checkout -B "$SIDE_BRANCH" "origin/${HEAD_REF}"
```

### Phase 4 — Group TODOs by Agent

`groupAndSortTodos()` in `Tools/ExecuteOpenTodos.ts` owns the deterministic transform — filter out done + blocked, group by agent, sort batches by max-priority (high before medium before low). It is byte-for-byte equivalent to the prior jq pipeline (verified against `jq` in `Tools/__tests__/ExecuteOpenTodos.test.ts`).

```bash
# Reads the artifact JSON on stdin, prints TodoBatch[] (agent + its pending todos),
# batches ordered high-priority-first. Excludes done + blocked rows.
PENDING_BATCHES=$(echo "$TODOS_JSON" | bun ~/.claude/skills/makerkit-team/Tools/ExecuteOpenTodos.ts group-todos)
```

### Phase 5 — Execute Batches Serially

**SERIAL — NOT PARALLEL.** Per-batch verify only works if commits land one-at-a-time. Parallel batches → racy commits → useless healthcheck signal. v1 enforces serial.

**Algorithm Note:** ExecuteOpenTodos is **serial-by-design** per `Workflows/_algorithm-team-spawn.md` escape clause: "Shared mutable state precludes file-zone partition" — one branch, one commit-stream. Ladder rung L3 (solo agent per batch, no fan-out): each batch spawns one `Agent` (`subagent_type: "general-purpose"`); the orchestrator awaits completion before advancing to the next batch.

For each batch (in priority order):

```bash
AGENT_ID="<this batch's kit role id — the (agent:X) grouping key from Phase 4>"
```

1. **Spawn agent via `Skill` tool** with the batch's TODOs scoped:
   ```typescript
   Skill("agents", "compose --traits 'technical,pragmatic,systematic' --output json")
   // Use returned prompt; spawn via Task with subagent_type=general-purpose
   // Brief includes: PR metadata, this agent's TODOs, file paths, fix snippets from review
   // Brief MUST also include the verify-before-implementing gate below, verbatim
   // Constraint: agent ONLY edits files referenced in its TODOs
   ```
   Roster mapping is in `Data/Roster.json` — use the role's saved-composition slug.

   **Verify before implementing (review-reception gate).** Before ANY edit, the agent checks each
   TODO against codebase reality at the cited file:line: restate the requirement in its own words,
   confirm the reviewer's claim is actually true THERE, and evaluate whether the fix is right for
   THIS codebase. A TODO that is wrong, stale, or unclear is NOT implemented — mark it
   `blocked: "<one-line technical reason>"` (the lockstep re-render publishes the reasoned pushback
   to the PR comment). Reviewer TODOs are claims, not orders; blind implementation and performative
   agreement are the failure modes this gate exists to stop. *(Adapted from obra/superpowers
   `receiving-code-review`, MIT — see pack README Credits.)*

2. **Agent applies edits**, runs file-scoped check (cheap):
   ```bash
   pnpm exec oxlint <touched files>   # kit lints with oxlint — there is no eslint
   pnpm typecheck                     # package-scoped via turbo --affected; tsc has no --files flag
   ```

3. **Commit per-batch (per `Workflows/_commit-merge.md`):**
   ```bash
   git add <agent-touched files>
   git commit -m "$(cat <<EOF
fix(pr-${PR_NUMBER}): ${AGENT_ID} batch — ${N} todos applied

Co-Authored-By: DuranteOS <tech@duranteos.com>
EOF
)"
   ```
   Concise subject (kit AGENTS.md rule); HEREDOC for the trailer. Pre-commit hook failure → fix the issue and create a NEW commit (never `--amend`). NEVER `git add -A` — explicit list only.

4. **Per-batch verify (mandatory unless `--fast`):**
   ```bash
   pnpm healthcheck   # MUTATES: oxlint --fix && oxfmt && typecheck && manypkg fix
   # Plus scoped tests for files touched
   for pkg in $(echo <touched files> | xargs dirname | grep -oE 'packages/[^/]+|apps/[^/]+' | sort -u); do
     pnpm --filter "${pkg##*/}" test:unit
   done
   ```
   `pnpm healthcheck` is allowed here BECAUSE this is a change-producing workflow on its own side branch (review/read-only contexts use the read-only ladder instead). If healthcheck mutated files, fold the mutations into this batch with a follow-up commit (`style(pr-{N}): healthcheck fixes — {agent} batch`) — never `--amend`, never leave the tree dirty between batches.

5. **On success (per `Workflows/_test-pyramid-gate.md` + `Workflows/_github-collaboration.md` lockstep rule):** the batch counts as DONE only when (a) `pnpm healthcheck` returns clean, AND (b) every scoped `pnpm --filter <pkg> test:unit` returns green. Typecheck/lint/format passing without green tests is NOT enough — the pyramid gate requires test-layer evidence. Mark this batch's TODOs `done: true` in the artifact JSON, **immediately re-render the comment via `Tools/RenderTodoComment.ts` and `gh pr comment {N} --edit-last`** — artifact and comment update in lockstep, never batch the public refresh until session end. The status header line in the comment preamble reflects new counts (`Execution status: X/Y done, Z blocked`). Advance to next batch.

6. **On failure (healthcheck or scoped tests fail):**
   ```bash
   git revert --no-edit HEAD                                # revert the batch commit
   # Mark this batch's TODOs as blocked in artifact. markTodosBlocked() in
   # Tools/ExecuteOpenTodos.ts owns the transform (sets .blocked = reason on this
   # agent's undone, not-already-blocked todos) — byte-equivalent to the prior jq.
   echo "$(cat "$ARTIFACT_JSON_PATH")" \
     | bun ~/.claude/skills/makerkit-team/Tools/ExecuteOpenTodos.ts mark-blocked "$AGENT_ID" "$FAILURE_REASON" \
     > "$ARTIFACT_JSON_PATH.tmp" && mv "$ARTIFACT_JSON_PATH.tmp" "$ARTIFACT_JSON_PATH"
   ```
   Continue to next batch — one bad batch does not abort the loop.

<!-- partial: _intent-to-flag-table.md skill_name=MakerkitTeam workflow_name=ExecuteOpenTodos -->

## Intent-to-Flag Mapping

| Operator Says | Effect |
|---|---|
| (default) "execute todos for pr #N" | Per-batch healthcheck after each commit |
| "fast execute" / `--fast` | Skip per-batch healthcheck; one healthcheck at the end. 5x faster but bisection-unfriendly on failure. |
| "dry run" / `--dry-run` | Group batches, print plan, do NOT spawn agents or commit |
| "only agent X" | Filter batches to a single agent role |
| "skip blocked" | Default behavior — blocked TODOs are not retried |
| "retry blocked" | Clear `blocked` field on TODOs and re-attempt their batches |

### Phase 6 — Push Side Branch

```bash
git push -u origin "$SIDE_BRANCH"   # per Workflows/_commit-merge.md push safety: NEVER --force; NEVER push to $HEAD_REF
```

### Phase 7 — Re-render PR Comment (per `Workflows/_github-collaboration.md` status cadence)

Update the artifact JSON with current done/blocked state, regenerate the comment from the artifact, and edit-last on the PR. The auto-managed comment IS the heartbeat — fold a status header line (`Execution status: X/Y done, Z blocked, ...`) into the preamble so the public state never goes stale.

`buildRenderPayload()` in `Tools/ExecuteOpenTodos.ts` assembles the `{todos, meta}` payload for `RenderTodoComment.ts` — it pulls `prTitle`/`reviewers` from the artifact and computes the execution-status verdict line (`Execution: X/Y done, Z blocked`) from the live done/blocked counts, so the header counts can never drift from the todos. Byte-equivalent to the prior heredoc (covered in `Tools/__tests__/ExecuteOpenTodos.test.ts`).

```bash
# Phase 5 already wrote done/blocked updates back to the artifact in lockstep
UPDATED_TODOS_JSON=$(cat "$ARTIFACT_JSON_PATH")

echo "$UPDATED_TODOS_JSON" \
  | bun ~/.claude/skills/makerkit-team/Tools/ExecuteOpenTodos.ts render-payload "$PR_NUMBER" \
  | bun ~/.claude/skills/makerkit-team/Tools/RenderTodoComment.ts \
  > /tmp/pr-${PR_NUMBER}-comment.md

gh pr comment "$PR_NUMBER" --edit-last --create-if-none --body-file /tmp/pr-${PR_NUMBER}-comment.md
```

### Phase 8 — Post Execution Summary Comment + Stop at Merge Boundary

Append (or include in the same comment edit) an execution summary:

```markdown
### Execution summary

- Side branch: `fix/pr-{N}-todos`
- Batches executed: N (Backend, Database, ...)
- TODOs done: X/Y
- TODOs blocked: Z (see `<!-- blocked: ... -->` markers above)
- Healthcheck: PASS / FAIL per batch
- Next: review the side branch and merge into PR head if you accept the fixes.

`git fetch origin && git diff origin/{head_ref}...origin/fix/pr-{N}-todos`
```

**Do NOT merge the side branch into the PR head.** That is operator territory (Gated tier — see `Workflows/_pr-loop-shared.md` + `Workflows/_commit-merge.md` Merge Gate). Merging requires (1) explicit operator `AskUserQuestion` approval, (2) `gh pr checks {N}` green.

<!-- partial: _workflow-output-shape.md skill_name=MakerkitTeam workflow_name=ExecuteOpenTodos -->

## Output

- **Side branch** — `fix/pr-{N}-todos` (or `-r{n}` retry variant) pushed to `origin`, ref: `https://github.com/{owner}/{repo}/tree/fix/pr-{N}-todos`. One commit per agent batch.
- **Updated artifact JSON** — `MEMORY/ARTIFACTS/makerkit-pr-{N}-todos.json` mutated in place: passed TODOs marked `done: true`, failed-batch TODOs gain `blocked: "<reason>"`, `updatedAt` refreshed.
- **Re-rendered PR comment** — same comment as the originating review workflow, updated via `gh pr comment --edit-last` to reflect new done/blocked state. Verdict line replaced with execution summary (`Execution: X/Y done, Z blocked`).
- **Index entry** — appended to `MEMORY/ARTIFACTS/artifacts.jsonl` with `type: pr-todo-execution`, `workflow: ExecuteOpenTodos`.

The PR head branch is **never modified** — operator reviews the side branch and decides whether to merge into the PR head.

## Anti-Goals

- **NEVER** push commits directly to the PR's head branch (`origin/${HEAD_REF}`) — side branch only.
- **NEVER** force-push (`git push --force`).
- **NEVER** merge the side branch into the PR head — operator decision.
- **NEVER** call `gh pr merge` or `gh pr review --approve`.
- **NEVER** run batches in parallel — serial-per-batch is mandatory for verify isolation.
- **NEVER** skip per-batch healthcheck unless operator passed `--fast` and accepted the bisection trade-off.
- **NEVER** use generic-principles reviewer agents — kit-native 13-agent roster only (per `Data/Roster.json`).
- **NEVER** silently rewrite a TODO's description or agent assignment — operator-edited TODOs are the operator's intent.
