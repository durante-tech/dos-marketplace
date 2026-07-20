# GitHub Collaboration (binding)

Shared substrate for every MakerkitTeam workflow that interacts with a PR over time — not just the one-shot ship. Codifies the team's discipline: keep TODOs current, engage with reviewers, post status when work meaningfully advances, keep the PR body fresh.

**Source of truth:**
- `Workflows/_pr-loop-shared.md` (safety tier table — Auto-read / Auto-write low-blast / Gated / NEVER — preserved by reference; this partial does NOT relax any tier)
- `Workflows/_commit-merge.md` (commit/merge format + PR creation template — preserved by reference)
- the kit repo's root `AGENTS.md` (repo resolved per `Tools/ResolveRepo.ts` — explicit > `$KIT_REPO` > git toplevel; the "extremely concise" rule applies to comment text too)

This partial layers ON TOP of the safety tier table; every action below maps to an existing tier from `_pr-loop-shared.md`.

## Read Before Write (mandatory)

Every PR-touching workflow phase MUST run `gh pr view` BEFORE any write operation:

```bash
gh pr view {N} --json number,title,body,state,isDraft,labels,assignees,reviewRequests,reviews,comments,statusCheckRollup,headRefName,baseRefName,mergeable
```

For inline diff comments specifically (the threaded discussion on lines of code):

```bash
gh api repos/{owner}/{repo}/pulls/{N}/comments
```

Incorporate prior discussion before adding new commits / TODOs / comments. Silent override of reviewer feedback is an anti-pattern (see `## Anti-Patterns` below).

## TODO State Management

The artifact JSON at `MEMORY/ARTIFACTS/makerkit-pr-{N}-todos.json` is the source of truth; the PR comment is the rendered view (per `_pr-loop-shared.md` Artifact JSON Schema). Update both in lockstep.

**As work progresses:**

| Event | Action |
|---|---|
| Batch starts | TODO stays `done: false`; if work spans >30 min, refresh the auto-managed comment with a status header (see Comment type 3) |
| Batch commit lands green | Mark `done: true` in artifact JSON; re-render comment via `Tools/RenderTodoComment.ts`; `gh pr comment {N} --edit-last --create-if-none --body-file ...` |
| Batch fails verify | Mark `blocked: "<reason>"` in artifact; `git revert HEAD --no-edit` (per `_commit-merge.md`); re-render comment with `<!-- blocked: ... -->` marker |
| Reviewer addresses a TODO directly via inline commit | Mark `done: true` if reviewer's commit closed it; reply to the inline comment acknowledging |
| Reviewer raises a new concern not in the TODO list | Add a new TODO row using the canonical markdown protocol from `_pr-loop-shared.md` (`(agent:X) (priority:Y)`); re-render |

**The lockstep rule**: when artifact JSON changes, re-render and `--edit-last` in the same step. Stale renders mean the public state lies about the work.

## Comment Engagement

Three comment types, each with its own pattern. All three are Auto-write low-blast tier per `_pr-loop-shared.md` — allowed without per-action approval, but only because comments are reversible.

### Type 1 — Auto-managed TODO comment

Single comment per PR per session, edited via `--edit-last --create-if-none`. Per `_pr-loop-shared.md` Loop Idempotency rule. The `Tools/RenderTodoComment.ts` renderer produces the deterministic body.

```bash
gh pr comment {N} --edit-last --create-if-none --body-file /tmp/pr-{N}-comment.md
```

Re-runs UPDATE the existing comment. NEVER post a second top-level comment of this type — that's thread spam.

### Type 2 — Reply to reviewer

When an external reviewer raises a point — top-level or inline — engage. Two surfaces:

**Top-level reply** (issue thread):

```bash
gh pr comment {N} --body "$(cat <<'EOF'
> @reviewer raised: <quoted excerpt or paraphrase ≤2 lines>

<our response — pick one of the four reply categories below>
EOF
)"
```

This is a SEPARATE comment from the auto-managed Type 1 — it engages a specific reviewer point, not the TODO state. Keep replies short (kit AGENTS.md concision rule applies).

**Inline reply** (specific diff comment thread):

```bash
gh api repos/{owner}/{repo}/pulls/{N}/comments \
  -f body="<reply text>" \
  -F in_reply_to=<review_comment_id>
```

The `review_comment_id` comes from `gh api repos/{owner}/{repo}/pulls/{N}/comments` (the inline-comment listing). Inline replies stay threaded with the original line discussion.

**Reply timing**: reply within the same MakerkitTeam session if the reviewer's comment is fresh (< 10 min old). For older comments, surface to operator first ("reviewer X raised <point>; reply now or wait for next batch?").

### Reply Categories (pick one — never silent)

| Category | When to use | Template |
|---|---|---|
| **Acknowledged + queued** | Reviewer's point is valid; we'll address in upcoming batch | "Good catch — adding to TODO as `(agent:X) (priority:Y)`" |
| **Done** | We've already addressed it (or will in this same session) | "Addressed in commit `<sha>` — <one-line summary>" |
| **Pushing back with rationale** | We considered it and disagree | "Considered this; keeping current approach because <reason>" |
| **Surface to operator** | Decision is operator-scoped, not ours | "Surfacing to <operator> for decision before responding" |

Never silently override or ignore reviewer feedback. Pick one of the four.

### Type 3 — Status update (folded into Type 1)

Every meaningful state change emits a one-line status header in the auto-managed TODO comment's preamble — NOT a separate comment:

```markdown
**Execution status: 4/12 done, 1 blocked, 7 pending.** Last update: 2026-05-05T20:45:00Z by ExecuteOpenTodos. Branch: `fix/pr-42-todos`.

(rest of the rendered TODO checklist follows)
```

Do NOT post separate status comments. The "single comment per PR per session" rule from `_pr-loop-shared.md` is preserved by folding status into the existing auto-managed comment.

## PR Body / Title Freshness

When scope shifts mid-flight (TODOs reveal hidden work; reviewer raises a new requirement; etc.):

```bash
# Update body — preserve ## Summary + ## Test plan structure per _commit-merge.md
gh pr edit {N} --body "$(cat <<'EOF'
## Summary
<updated bullets — original + new scope>

## Test plan
- [ ] <updated checklist>
- [x] <items already complete>

Co-Authored-By: DuranteOS <tech@duranteos.com>
EOF
)"

# Update title if needed
gh pr edit {N} --title "<new concise title ≤70 chars>"
```

Mark Test plan checkboxes `[x]` as items complete in lockstep with TODO checklist updates. Body changes always preserve the `## Summary` + `## Test plan` H2 sections from `_commit-merge.md` PR Creation template.

## Label / State Discipline

Per project convention (kit-specific, configurable). Read existing labels first via `gh pr view --json labels` and match the kit's existing taxonomy — never invent labels.

| State | Label (typical) | When |
|---|---|---|
| Draft work | (none / `draft`) | Initial — `gh pr create --draft` |
| In progress | `in-progress` | After first batch — `gh pr edit {N} --add-label in-progress` |
| Blocked | `blocked` | When a batch fails — `gh pr edit {N} --add-label blocked --remove-label in-progress` |
| Ready for review | `needs-review` | After all TODOs done — `gh pr edit {N} --add-label needs-review --remove-label in-progress` |

If the kit doesn't use these labels, skip silently — the convention is project-set, not enforced here.

## Issue Linking

When a PR closes an issue:

```
<commit-or-pr-body>

Closes #<issue-number>
```

Aliases: `Fixes #N` (auto-close), `Refs #N` (tangential reference, no auto-close).

Apply in commit body (last paragraph before the `Co-Authored-By` trailer) OR in PR body's `## Summary` (last bullet).

## Status Cadence

For multi-batch runs (ExecuteOpenTodos with >3 batches OR session >30 min):

- **At each batch boundary**: artifact + comment refresh per "TODO state management" above
- **At any blocker**: immediate refresh + `<!-- blocked: ... -->` marker in the comment
- **At session end**: final refresh with execution summary line in the comment preamble

Never go silent for the entire duration of a multi-batch run. The auto-managed TODO comment IS the status — keeping it fresh is the discipline.

## Per-Workflow Application

| Workflow | Where it engages | Cites this partial at |
|---|---|---|
| ReviewOpenPRs | Phase 4 (read prior comments before reviewing) + Phase 7 (post comment) | Phase 4 read-before-write, Phase 7 comment edit-last |
| ReviewSinglePR | Phase 1 (Resolve PR — read existing state) + Phase 5 (post comment) | Phase 1 read-before-write, Phase 5 comment edit-last |
| ExecuteOpenTodos | Phase 0 (read prior reviewer feedback) + Phase 5 (per-batch refresh) + Phase 7 (final refresh) | Phase 0, Phase 5 step 5 lockstep, Phase 7 |
| DeliverFeature | Phase 7 (open PR) — initial state only; later collaboration delegates to Review/Execute workflows | (none — terminal at PR open) |
| BugFix | Single fix commit; no multi-batch state | (none) |
| QuickFix | Single fix commit; no multi-batch state | (none) |
| Refactor | Per-step commits but local; no PR collaboration intrinsic | (none) |

## Anti-Patterns

1. **Silent override** — applying changes without acknowledging reviewer feedback. Always pick one of the four reply categories.
2. **Stale TODO checklist** — work done in code, but the public comment still says "incomplete". Lockstep rule: artifact change → re-render → edit-last in the same step.
3. **Multiple uncoordinated comments** — posting a new top-level comment when `--edit-last` would update the existing auto-managed comment.
4. **PR body never updated** — initial Summary/Test plan stays after scope shift. Update via `gh pr edit --body` when scope changes.
5. **Reviewer comment ignored** — no reply at all. Anti-pattern even when we agree silently — visibility matters.
6. **Closing PR without comment** — silent close after issues raised. Always explain in a final comment.
7. **`gh pr review --approve` from team verdict** — Gated tier per `_pr-loop-shared.md`. Only operator approves.
8. **Posting duplicate replies** — single reply per reviewer point. If reply is already there, edit it; don't add a second.
9. **Inventing labels** — read existing label set first; match kit taxonomy. Don't apply labels that don't exist in the project.
10. **Going silent on multi-batch runs** — the auto-managed TODO comment is the heartbeat. Refresh it at every state change; never let it go stale for a whole multi-hour session.

## Cross-references

- `Workflows/_pr-loop-shared.md` — safety tier table + side-branch convention + artifact JSON schema + TODO checklist markdown protocol
- `Workflows/_commit-merge.md` — commit/merge format + PR creation template + merge gate
- `Workflows/_test-pyramid-gate.md` — ships-with-tests gate (the "done" condition for batches per `_test-pyramid-gate.md`)
- `Workflows/_algorithm-team-spawn.md` — degradation-ladder spawn contract (default L2 Agent fan-out) for parallel reviewers
- `~/.claude/CLAUDE.md` Git Safety Protocol — principal-level rules

## Intent-to-Flag Mapping

This partial shells `gh` for PR collaboration over time. Operator intent → command/flags:

| Intent | Command / flags |
|---|---|
| read all PR context before any write | `gh pr view {N} --json comments,reviews,statusCheckRollup` |
| post / update the single auto-managed comment | `gh pr comment {N} --edit-last --create-if-none --body-file <tmp>` |
| reply to an inline review thread | `gh api repos/{owner}/{repo}/pulls/{N}/comments` |
| refresh PR body / title on scope shift | `gh pr edit {N} --body <file>` / `--title <s>` |
| open a draft PR | `gh pr create --draft ...` |

Read/comment intents only — never map operator intent to `gh pr merge` / `gh pr review --approve` (Gated; operator-only).
