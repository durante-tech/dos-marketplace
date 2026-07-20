---
name: Review PRs
description: Lead a team review across every open PR in the current repo
status: STABLE
bestPath:
  - title: "Enumeration & Filtering"
    description: "List open PRs, skip drafts/stale by default, rank by CI/size/age."
  - title: "Reviewer Team Assembly"
    description: "Pick a per-PR reviewer team based on diff shape (docs, tests, refactor, arch, bug, feature)."
  - title: "Parallel Multi-Perspective Review"
    description: "Spawn reviewer agents in parallel and aggregate verdicts via the tested precedence rule."
  - title: "Comment & Fix Proposal"
    description: "Post one summary comment per PR; optionally propose fixes on a side branch."
  - title: "Gated Merge Decision"
    description: "Surface merge-ready PRs via AskUserQuestion — never auto-merge."
divergence_from_canonical:
  _intent-to-flag-table.md:
    partial_version: 1.0.0
    reason: "Github ReviewPRs workflow uses workflow-specific intent-to-flag vocabulary; canonical Mode/Output two-table shape doesn't fit"
---

# ReviewPRs Workflow

## When to Use

- User wants a full team review across every open PR ("review the open prs", "sweep prs", "fleet review", "lead the review team")
- Multiple PRs need multi-perspective verdicts (architecture, refactoring, clean code, conventions, QA) and posted comments
- NOT for a quick status-only sweep with no reviewer agents — use `ListPRs.md` instead
- NOT for deep review of one named PR — use `ReviewSinglePR.md` instead

The team-leader workflow. Lists open PRs, fans each one out to a multi-perspective reviewer team, aggregates verdicts, posts comments, proposes fixes on side branches, and **stops at the merge boundary** — merge requires explicit user approval per `SKILL.md → Safety Profile`.

<!-- partial: _workflow-voice.md skill_name=Github workflow_name=ReviewPRs action_phrase=" to lead team review across open pull requests" -->

## Pre-Flight Checks

```bash
# 1. Verify gh CLI authed
gh auth status || { echo "gh not authenticated — run 'gh auth login' and retry"; exit 1; }

# 2. Verify we are inside a git repo with a github remote
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || { echo "not inside a git repo"; exit 1; }
gh repo view --json nameWithOwner -q .nameWithOwner || { echo "no github remote — gh repo view failed"; exit 1; }
```

If pre-flight fails, abort and tell the user what's missing. Do NOT attempt to run gh in a non-repo or unauth state.

## Step 1: Enumerate Open PRs

```bash
gh pr list \
  --state open \
  --limit 50 \
  --json number,title,author,isDraft,labels,createdAt,updatedAt,headRefName,baseRefName,mergeable,reviewDecision,statusCheckRollup
```

## Intent-to-Flag Mapping

### Scope filters

| User Says | Filter | Effect |
|---|---|---|
| (default) "review the prs" | `--state open`, skip drafts, skip stale (>30d) | Active, ready-for-review PRs |
| "include drafts" | drop the draft skip | Drafts are reviewed too |
| "include stale" | drop the >30d cutoff | Stale PRs included |
| "only mine" | `gh pr list --author @me` | PRs authored by current user |
| "only failing CI" | post-filter on `statusCheckRollup` | PRs where required checks are red |
| "label X" | `--label X` | Restrict to a single label |

### Depth selector

| User Says | Reviewer Team | Use When |
|---|---|---|
| (default) | Sentinel + QA + 1 of {Cockburn, Fowler, UncleBob} based on diff shape | Mixed PR fleet |
| "full team" / "deep" | All 5 reviewers (Cockburn, Fowler, UncleBob, Sentinel, QA) | Architectural / large diff |
| "fast" / "quick sweep" | Sentinel only | Pure status sweep with light verdicts |

### Output options

| User Says | Behavior |
|---|---|
| (default) | Post per-PR summary comment + emit team-leader table |
| "no comments" | Skip `gh pr comment` writes, emit table only |
| "side-branch fixes" | For PRs in CHANGES-REQUESTED, propose fix commits on `fix/pr-N-slug` branches |

## Step 2: Filter & Rank

For each PR returned by `gh pr list`:

1. Skip `isDraft: true` unless `--include-drafts`
2. Skip if `updatedAt > 30d ago` unless `--include-stale`
3. Tag CI state: `green` / `red` / `pending` / `none` from `statusCheckRollup`
4. Tag size: `small` (< 50 lines diff), `medium` (50-500), `large` (> 500). Use `gh pr diff {N} --patch | wc -l` if a precise number is needed.

The skip/tag steps above are judgment (which PRs survive the filter). The RANK order over the survivors is a fixed rule — "red CI first, then large diffs, then oldest, then everything else" — do NOT hand-sort. Feed the tagged survivors (`{ number, ci, sizeLines, createdAt }` each) to the tested comparator:

```bash
bun ~/.claude/skills/github/Tools/GithubCli.ts rank-prs <data.json>
# <data.json>: { "prs": [ { "number": 13, "ci": "red", "sizeLines": 5, "createdAt": "2026-05-29T00:00:00Z" }, ... ] }
```

It returns the survivors in review order (`rankPRs` in `Github/src/Tools/GithubCli.ts`, oracle-tested per tier: red-CI → larger-diff → older → PR-number tiebreak).

## Step 3: Pick Reviewer Team Per PR

The team-leader picks reviewers per PR based on diff shape. Default rules:

| Diff Shape | Team |
|---|---|
| Pure docs (only `.md`, `README*`, `Docs/**`) | Sentinel only |
| Pure tests (only `*test*`, `*.test.*`, `__tests__/**`) | UncleBob + QA |
| Refactor PR (label `refactor`, or rename-heavy diff) | Fowler + Sentinel + QA |
| Architecture PR (label `arch`/`rfc`, or new module) | Cockburn + Fowler + Sentinel + QA |
| Bug fix (label `bug`/`fix`, single-file change) | UncleBob + QA |
| Feature (default, anything else) | Sentinel + QA + UncleBob |
| User said "full team" | Cockburn + Fowler + UncleBob + Sentinel + QA |

## Step 4: Spawn Reviewers In Parallel

For each PR-team pair, spawn the reviewers via the `Skill` tool **all in one message** (parallelism contract). Each reviewer receives:

- PR number, title, author, base/head refs
- Full diff (`gh pr diff {N}`)
- PR description (`gh pr view {N} --json body -q .body`)
- The reviewer-specific framing question (see below)

### Reviewer-specific framing prompts

| Reviewer | Framing |
|---|---|
| **Cockburn** | "Review this PR's diff through Hexagonal/ports-and-adapters. Are domain and adapters correctly separated? Does the use case live at the right goal level? Verdict: PASS / CHANGES / BLOCK + reasoning ≤ 200 words." |
| **Fowler** | "Identify the top 3 code smells in this diff and the named refactorings from the catalog that would address them. Verdict: PASS / CHANGES / BLOCK + ≤ 200 words." |
| **UncleBob** | "Apply the SOLID/Clean Code lens. Function sizes? Naming? Single-responsibility violations? Test coverage? Verdict: PASS / CHANGES / BLOCK + ≤ 200 words." |
| **Sentinel** | "Run convention conformance against the repo's conventions and any RFC the diff cites. Verdict: PASS / CHANGES / BLOCK + ≤ 200 words." |
| **QA (composed)** | "Compose via `bun ~/.claude/skills/agents/Tools/ComposeAgent.ts --traits 'technical,skeptical,thorough' --output json` and spawn with `subagent_type: general-purpose`. Framing: 'What edge cases, race conditions, error paths, or regressions might this diff break? Verdict: PASS / CHANGES / BLOCK + ≤ 200 words.'" |

## Step 5: Aggregate Verdicts

For each PR, the per-reviewer verdict tokens are your JUDGMENT; the single team-leader verdict they roll up to is a fixed precedence rule — do NOT hand-apply it. Pass the verdict array (and reviewer names, in seat order) to the tested predicate:

```bash
bun ~/.claude/skills/github/Tools/GithubCli.ts aggregate-verdicts <data.json>
# <data.json>: { "verdicts": ["PASS","BLOCK","CHANGES"], "reviewerNames": ["Sentinel","QA","UncleBob"] }
```

It returns `{ category, line, blockingIndex }`; use `line` verbatim as the team verdict. The precedence it encodes (`aggregateVerdicts` in `Github/src/Tools/GithubCli.ts`, oracle-tested on every boundary):

- Any `BLOCK` → `BLOCK — see {first blocking reviewer}` (list per-reviewer asks)
- All `PASS` → `PASS — ready to merge after CI green`
- All `CHANGES` → `CHANGES — substantial`
- Mixed PASS / CHANGES → `CHANGES — minor` (list per-reviewer asks)

## Step 6: Post Review Comments (Auto)

For each PR, post **one** summary comment via `gh pr comment {N} --body @-`. The comment-body SKELETON is a deterministic render — do NOT hand-type it. Once the team verdict, the consulted-reviewer list, per-reviewer one-line summaries, and the top-3 asks are decided (all JUDGMENT), write them to a JSON file matching `PRCommentData` and render the body:

```bash
bun ~/.claude/skills/github/Tools/GithubCli.ts render-comment <data.json> | gh pr comment {N} --body-file -
```

`<data.json>` shape:

```json
{
  "teamVerdict": "...",
  "reviewersConsulted": ["Sentinel", "QA", "..."],
  "architecture": { "verdict": "...", "summary": "..." },
  "refactoring": { "verdict": "...", "summary": "..." },
  "cleanCode": { "verdict": "...", "summary": "..." },
  "conventions": { "verdict": "...", "summary": "..." },
  "qa": { "verdict": "...", "summary": "..." },
  "asks": ["ask 1", "ask 2", "ask 3"]
}
```

The helper (`renderPRCommentBody` in `Github/src/Tools/GithubCli.ts`, golden-tested) returns the exact comment markdown — the H2 title, verdict line, reviewers-consulted line, the fixed five Per-reviewer bullets, the Top asks list, and the trailing generated-by note. Use its output verbatim.

## Step 7: Propose Fixes on Side Branch (Opt-in)

Only if user said "side-branch fixes" OR if explicitly asked per PR. NEVER push directly to the PR's head branch.

```bash
# For PR #N with head branch HEAD_REF:
git fetch origin
git checkout -b "fix/pr-${N}-suggestions" "origin/${HEAD_REF}"
# Apply proposed fixes (Edit/Write)
git add <changed files>
git commit -m "fix(pr-${N}): apply DOS team review suggestions"
git push -u origin "fix/pr-${N}-suggestions"

# Post a comment linking to the side branch
gh pr comment "${N}" --body "DOS team applied suggested fixes on \`fix/pr-${N}-suggestions\` — review and merge into your PR head if you want them: https://github.com/${REPO}/tree/fix/pr-${N}-suggestions"
```

The PR author retains full control — they can cherry-pick, ignore, or merge the side branch into their PR head themselves.

## Step 8: Surface Merge Decisions (Gated)

Emit the final team-leader table to the user. For PRs the team verdict marks `PASS` AND CI is green AND author is current user:

```typescript
AskUserQuestion({
  questions: [{
    header: "Merge decisions",
    question: "DOS team review complete. Which PRs should merge?",
    multiSelect: true,
    options: [
      { label: "PR #N — {title}", description: "Verdict: {verdict}; CI: green; reviewers: {team}" },
      // ...
      { label: "None — review the comments first", description: "Skip merge round; revisit later" }
    ]
  }]
})
```

For PRs the user picks, run:

```bash
gh pr merge "${N}" --squash --delete-branch  # or --merge / --rebase per repo policy
```

**NEVER auto-merge.** **NEVER pre-select** options. **NEVER infer merge from reviewer PASS.**

## Step 9: Emit Final Report

Write a JSON-summary artifact to `MEMORY/ARTIFACTS/` per the artifact tracking partial:

```jsonl
{"timestamp":"...","pack":"Github","workflow":"ReviewPRs","type":"pr-fleet-review","title":"Team review of N open PRs","path":".../github-pr-review-{slug}.json","contentPreview":"...","wing":"general","sessionId":"..."}
```

The JSON file contains: PRs reviewed, reviewer verdicts, team verdicts, comments posted, side branches created, merge decisions made.

## Anti-Goals

- **NEVER** push commits directly to a PR's head branch — always side-branch.
- **NEVER** force-push anywhere.
- **NEVER** merge without explicit user approval, even if all reviewers said PASS.
- **NEVER** request changes / approve via `gh pr review --approve` based on agent verdict alone — that's a human's signal.
- **NEVER** close PRs unless the user explicitly said so.
- **NEVER** comment more than once per PR per session — re-runs UPDATE the prior comment via `gh pr comment --edit-last` if available, otherwise skip.
