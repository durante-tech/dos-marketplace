---
name: ExecuteOpenTodos
description: "Serial, side-branch execution of the TODO checklist produced by ReviewSinglePR, with a verify-before-implementing gate on each TODO and lockstep PR-comment updates."
status: STABLE
bestPath:
  - title: "Load Artifact"
    description: "Read the ReviewSinglePR TODO JSON artifact, skipping rows already done or blocked."
  - title: "Side-Branch Setup"
    description: "Create or rebase the fix/pr-<N>-todos side branch off the PR head ref."
  - title: "Batched Serial Execution"
    description: "Group TODOs by agent and execute one at a time, each gated by a verify-before-implementing check."
  - title: "Lockstep Refresh"
    description: "Update the artifact JSON and re-render the PR comment after every batch."
  - title: "Push & Stop at Merge Boundary"
    description: "Push the side branch and surface the merge decision to the operator — the workflow never merges."
divergence_from_canonical:
  _intent-to-flag-table.md:
    partial_version: 1.0.0
    reason: "FastAPIStarterTeam TODO execution maps GitHub and git side-branch commands; canonical Mode/Output two-table shape does not fit"
---

# ExecuteOpenTodos Workflow

Execute the open TODOs from a `ReviewSinglePR` artifact on a side branch. Serial-by-design — never parallel batches. Sibling to `MakerkitTeam/Workflows/ExecuteOpenTodos.md`.

## When to Use

- Trigger phrases: "execute todos for pr #N in starter", "apply review todos in starter", "execute open todos in starter".
- Fits when a `ReviewSinglePR` TODO artifact already exists and needs to be applied on a side branch.
- NOT for reviewing a PR to produce the TODO artifact in the first place — use `ReviewSinglePR` instead.

## Pre-flight

1. Voice notify: `bash "$DOS_DIR/DOS/Tools/voice.sh" main "Running ExecuteOpenTodos workflow in fastapi-starter-team skill to apply review TODOs"`
2. Operator passes PR number `N`.
3. Read prior reviewer feedback per `_github-collaboration.md` Phase 0:

```bash
gh pr view N --json reviews,comments,statusCheckRollup
gh api repos/{owner}/{repo}/pulls/N/comments
```

## Intent-to-Flag Mapping

| Operator intent | Command / flag pattern | Notes |
|---|---|---|
| "execute TODOs for PR N" | `gh pr view N --json reviews,comments,statusCheckRollup` and `gh api repos/{owner}/{repo}/pulls/N/comments` | Loads current review context. |
| "start or refresh the side branch" | `git checkout -b fix/pr-<N>-todos origin/<head_ref>` or `git checkout fix/pr-<N>-todos && git rebase origin/<head_ref>` | Never pushes to the PR head branch. |
| "refresh the PR-loop comment" | `bun Tools/RenderTodoComment.ts < <artifact-json> > /tmp/pr-N-comment.md` then `gh pr comment N --edit-last --create-if-none --body-file /tmp/pr-N-comment.md` | Artifact and comment move in lockstep. |
| "publish the side branch" | `git push -u origin fix/pr-<N>-todos` | Never `--force`. |

## Phase 1 — Load artifact

Read `MEMORY/ARTIFACTS/fastapistarter-pr-<N>-todos.json`. Extract `todos[]`. Skip rows with `done: true` or `blocked: <reason>`.

## Phase 2 — Side-branch setup

Per `_pr-loop-shared.md` Side-Branch Convention:

```bash
git fetch origin
git checkout -b fix/pr-<N>-todos origin/<head_ref>     # first run
# OR
git checkout fix/pr-<N>-todos && git rebase origin/<head_ref>   # subsequent runs
```

If side branch was previously merged into head: create `fix/pr-<N>-todos-r<n>` (incrementing `<n>`).

## Phase 3 — Group + sort batches

Group TODOs by `agent`. Sort batches by `priority` (high → medium → low). One agent's batch executes serially (one TODO at a time).

**Solo per batch — never parallel.** Escape clause from `_algorithm-team-spawn.md`: "shared mutable state precludes partition — one branch, one commit-stream".

## Phase 4 — Per-batch execution (serial)

For each batch (one agent at a time):

For each TODO in the batch (serial):

1. **Spawn solo agent** with the role's saved composition + the TODO's description + file:line
   citation + the verify-before-implementing gate below (verbatim in the brief).

   **Verify before implementing (review-reception gate).** Before ANY edit, the agent checks the
   TODO against codebase reality at the cited file:line: restate the requirement in its own words,
   confirm the reviewer's claim is actually true THERE, and evaluate whether the fix is right for
   THIS codebase. A TODO that is wrong, stale, or unclear is NOT implemented — mark it
   `blocked: "<one-line technical reason>"` per Batch failure handling (the lockstep re-render
   publishes the reasoned pushback to the PR comment). Reviewer TODOs are claims, not orders;
   blind implementation and performative agreement are the failure modes this gate exists to stop.
   *(Adapted from obra/superpowers `receiving-code-review`, MIT — see pack README Credits.)*

2. **Agent makes the edit.** Surgical, single-purpose. Adds tests if the TODO involves behavior change.
3. **Commit per `_commit-merge.md`:**

```bash
git add <files>
git commit -m "$(cat <<'EOF'
<type>(pr-<N>): <todo description ≤72 chars>

- <body bullet 1>

Co-Authored-By: DuranteOS <tech@duranteos.com>
EOF
)"
```

4. **Healthcheck:** `mcp__dos_fastapi__run_checks` — must be green.
5. **Scoped tests:** `uv run pytest tests/unit/test_<module>.py -x` (or integration if applicable).

### Batch failure handling

If healthcheck or scoped tests fail:

```bash
git revert HEAD --no-edit
```

Mark TODO as `blocked: "<reason>"` in artifact JSON. Re-render comment via `Tools/RenderTodoComment.ts` and `--edit-last` per `_github-collaboration.md` lockstep rule.

After 3 consecutive blocks from same agent → escalate to operator.

## Phase 5 — Per-batch refresh (lockstep)

After every batch:

1. Update artifact JSON `todos[].done = true` for completed TODOs
2. Re-render comment: `bun Tools/RenderTodoComment.ts < <artifact-json> > /tmp/pr-N-comment.md`
3. `gh pr comment N --edit-last --create-if-none --body-file /tmp/pr-N-comment.md`

Per `_github-collaboration.md` lockstep rule — artifact change → re-render → edit-last in the same step.

## Phase 6 — Push side branch

```bash
git push -u origin fix/pr-<N>-todos
```

NEVER `--force`. NEVER push to PR head branch.

## Phase 7 — Final refresh + status

Update artifact JSON `updatedAt`. Add execution status header to comment:

```markdown
**Execution status: <done>/<total> done, <blocked> blocked, <pending> pending.** Branch: `fix/pr-<N>-todos`.
```

Re-render and `--edit-last`.

## Phase 8 — Stop at merge boundary

Per `_commit-merge.md` Merge Gate — STOP. Surface to operator:

```
Question: Side branch fix/pr-<N>-todos has <K> commits. Merge into PR head?
Options: Merge into head | Open separate PR | Leave for later | Cancel
```

Workflow NEVER merges. Operator decides.

PRD `phase: complete`.

## Anti-criteria

- ✗ Parallel batches — serial-by-design escape clause
- ✗ `--force` push — never
- ✗ Push to PR head branch — never; side branch only
- ✗ Skipping healthcheck after a batch — invariant violation
- ✗ Stale comment after batch lands green — lockstep rule violation
