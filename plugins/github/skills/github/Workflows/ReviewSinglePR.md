---
name: Review Single PR
description: Deep team review of one PR — full reviewer panel, structured report, optional side-branch fixes
status: STABLE
bestPath:
  - title: "PR Resolution"
    description: "Resolve the target PR number from user input, current branch, or the latest open PR."
  - title: "Parallel Batch Read"
    description: "Fetch PR metadata, diff, and CI checks in one tool-call block."
  - title: "Full Reviewer Team Spawn"
    description: "Spawn all 5 reviewers (Cockburn, Fowler, UncleBob, Sentinel, QA) in parallel."
  - title: "Structured Report & Comment"
    description: "Aggregate verdicts into a structured report and post one summary comment."
  - title: "Gated Fix & Merge Decisions"
    description: "Offer side-branch fixes and surface the merge decision — both require explicit approval."
divergence_from_canonical:
  _intent-to-flag-table.md:
    partial_version: 1.0.0
    reason: "Github ReviewSinglePR workflow uses workflow-specific intent-to-flag vocabulary; canonical Mode/Output two-table shape doesn't fit"
---

# ReviewSinglePR Workflow

## When to Use

- User names a specific PR for deep review ("review pr #42", "deep review pr", "team review on pr 42")
- The full 5-reviewer panel and a structured PASS/CHANGES/BLOCK report are needed for one PR
- NOT for reviewing every open PR at once — use `ReviewPRs.md` instead
- NOT for a lightweight status check — use `ListPRs.md` instead

Full-depth review of a single PR by number. Spawns the entire reviewer team in parallel, aggregates verdicts into a structured report, posts one summary comment, and **stops at the merge boundary**.

This is the depth workflow. For the fleet sweep, use `ReviewPRs.md`. For a status snapshot, use `ListPRs.md`.

<!-- partial: _workflow-voice.md skill_name=Github workflow_name=ReviewSinglePR action_phrase=" to lead deep team review of one pull request" -->

## Pre-Flight

```bash
gh auth status >/dev/null 2>&1 || { echo "gh not authenticated"; exit 1; }
gh repo view --json nameWithOwner -q .nameWithOwner >/dev/null 2>&1 || { echo "no github remote in cwd"; exit 1; }
```

## Step 1: Resolve PR Number

The user must give a PR number. If they say "the latest" or "the one I'm on":

```bash
# "the one I'm on" — current branch's PR
gh pr view --json number -q .number

# "the latest" — most recently updated open PR
gh pr list --state open --limit 1 --json number -q '.[0].number'
```

Confirm the resolved PR number with the user before proceeding.

## Step 2: Read the PR (Parallel Batch)

In a SINGLE tool-call block, fan out the gh reads:

```bash
gh pr view "${N}" --json number,title,body,author,createdAt,headRefName,baseRefName,labels,statusCheckRollup,reviewDecision,reviewThreads,mergeable
gh pr diff "${N}"
gh pr checks "${N}"
```

## Step 3: Spawn Full Reviewer Team In Parallel

In **one** message, spawn all 5 reviewers via the `Skill` tool. Each gets the same payload (PR metadata + diff + body) and a reviewer-specific framing prompt.

| Reviewer | Skill Invocation | Framing |
|---|---|---|
| **Architecture** | `Skill("cockburn")` | "Hexagonal lens. Are domain and adapters separated? Use case at the right goal level? Verdict: PASS / CHANGES / BLOCK + reasoning ≤ 200 words." |
| **Refactoring** | `Skill("fowler")` | "Top 3 code smells + named refactorings from the catalog. Verdict + ≤ 200 words." |
| **Clean Code** | `Skill("uncle-bob")` | "SOLID/Clean Code lens. Function sizes, naming, single-responsibility, test coverage. Verdict + ≤ 200 words." |
| **Conventions** | `Skill("sentinel")` | "Convention conformance vs the repo + any RFC the diff cites. Verdict + ≤ 200 words." |
| **QA** | composed agent — see below | "Edge cases, race conditions, error paths, regressions this diff might break. Verdict + ≤ 200 words." |

For QA, compose the agent first:

```bash
bun ~/.claude/skills/agents/Tools/ComposeAgent.ts \
  --traits "technical,skeptical,thorough" \
  --output json
```

Then spawn via the `Agent` tool with `subagent_type: "general-purpose"` and the returned `prompt` as the system prompt.

## Step 4: Aggregate Into Structured Report

Wait for all 5 reviewers. The JUDGMENT is yours: read each reviewer's full text, distill a one-line "top ask" per reviewer, and decide the recommendation. The per-reviewer verdict tokens (`PASS` / `CHANGES` / `BLOCK`) are your call; the TEAM verdict they roll up to is a fixed precedence rule — do NOT hand-apply the table. Pass the verdict array (and the matching reviewer names, in seat order) to the tested predicate:

```bash
bun ~/.claude/skills/github/Tools/GithubCli.ts aggregate-verdicts <data.json>
# <data.json>: { "verdicts": ["PASS","CHANGES","PASS","PASS","CHANGES"],
#                "reviewerNames": ["Cockburn","Fowler","UncleBob","Sentinel","QA"] }
```

It returns `{ category, line, blockingIndex }`. Use the `line` verbatim as the team verdict. The precedence it encodes (`aggregateVerdicts` in `Github/src/Tools/GithubCli.ts`, oracle-tested on every boundary):

| Reviewer Verdicts | Team Verdict (`line`) |
|---|---|
| Any BLOCK | `BLOCK — see {first blocking reviewer}` |
| All PASS | `PASS — ready to merge after CI green` |
| All CHANGES | `CHANGES — substantial` |
| Mixed PASS/CHANGES | `CHANGES — minor` |

The structured-report SKELETON (H1 + verdict line + reviewer table + per-reviewer Reasoning + CI + Recommendation) is a deterministic render — do NOT hand-type it. Once the verdicts, asks, reasoning, CI summary, and recommendation are decided, write them to a JSON file matching `ReviewReportData` and render:

```bash
bun ~/.claude/skills/github/Tools/GithubCli.ts render-review-report <data.json>
```

`<data.json>` shape (one `{ verdict, topAsk, reasoning }` per reviewer seat):

```json
{
  "prNumber": "${N}", "title": "${title}",
  "teamVerdict": "...", "ciSummary": "...", "recommendation": "ready-to-merge | needs-fixes | blocked",
  "architecture": { "verdict": "PASS", "topAsk": "...", "reasoning": "..." },
  "refactoring": { "verdict": "...", "topAsk": "...", "reasoning": "..." },
  "cleanCode": { "verdict": "...", "topAsk": "...", "reasoning": "..." },
  "conventions": { "verdict": "...", "topAsk": "...", "reasoning": "..." },
  "qa": { "verdict": "...", "topAsk": "...", "reasoning": "..." }
}
```

The helper (`renderReviewReport` in `Github/src/Tools/GithubCli.ts`, golden-tested) returns the exact report markdown. Use its output verbatim.

## Step 5: Post Summary Comment

```bash
gh pr comment "${N}" --body @- <<EOF
## DOS team review

**Verdict:** ${team_verdict}

**Reviewers:** Cockburn (architecture), Fowler (refactoring), UncleBob (clean code), Sentinel (conventions), QA

### Per-reviewer verdicts
- **Architecture:** ${cockburn_verdict} — ${cockburn_one_liner}
- **Refactoring:** ${fowler_verdict} — ${fowler_one_liner}
- **Clean Code:** ${ub_verdict} — ${ub_one_liner}
- **Conventions:** ${sentinel_verdict} — ${sentinel_one_liner}
- **QA:** ${qa_verdict} — ${qa_one_liner}

### Top asks
1. ${ask1}
2. ${ask2}
3. ${ask3}

_Generated by DOS github skill. Comments are auto. Merges and approvals require human approval._
EOF
```

## Step 6: Offer Side-Branch Fix (Gated)

If the team verdict is `CHANGES — minor` AND user wants to apply fixes, propose a side branch:

```typescript
AskUserQuestion({
  questions: [{
    header: "Apply fixes?",
    question: "Team flagged ${N} fixes. Apply on a side branch?",
    multiSelect: false,
    options: [
      { label: "Yes — create fix/pr-${N}-suggestions", description: "Side branch off PR head; you cherry-pick what you want" },
      { label: "No — leave it for the author", description: "Comment posted; PR author handles fixes" }
    ]
  }]
})
```

If user picks "Yes":

```bash
git fetch origin
git checkout -b "fix/pr-${N}-suggestions" "origin/${HEAD_REF}"
# Apply fixes via Edit/Write
git add <changed files>
git commit -m "fix(pr-${N}): apply DOS team review suggestions"
git push -u origin "fix/pr-${N}-suggestions"
gh pr comment "${N}" --body "DOS team applied suggested fixes on \`fix/pr-${N}-suggestions\` — review and merge into your PR head if you want them."
```

**NEVER** push to `${HEAD_REF}` directly.

## Step 7: Surface Merge Decision (Gated)

If team verdict is `PASS` AND CI green AND author is current user:

```typescript
AskUserQuestion({
  questions: [{
    header: "Merge PR #${N}?",
    question: "Team verdict: PASS. CI green. Merge now?",
    multiSelect: false,
    options: [
      { label: "Yes — squash and merge", description: "gh pr merge ${N} --squash --delete-branch" },
      { label: "Yes — merge commit", description: "gh pr merge ${N} --merge" },
      { label: "Yes — rebase and merge", description: "gh pr merge ${N} --rebase --delete-branch" },
      { label: "Not yet — let it sit", description: "Skip merge; revisit later" }
    ]
  }]
})
```

**NEVER auto-select.** Default to "Not yet" if user is silent. Repo merge policy may forbid certain options — read `.github/CODEOWNERS` and branch protection rules first if uncertain.

## Intent-to-Flag Mapping

This workflow shells out to the `gh` CLI and to `ComposeAgent.ts` per CreateSkill workflow Step 6 + CliFirstArchitecture.md. Translate operator phrasing into deterministic sub-command + flag selection.

### Mode / Action — gh sub-commands

| User Says | gh Command | Effect |
|-----------|------------|--------|
| "what's pr #N about?" / "show me pr metadata" | `gh pr view N --json ...` | Fetch title, body, author, refs, labels, status, threads, mergeable |
| "show me the diff" | `gh pr diff N` | Print unified diff for the team to review |
| "what's CI saying?" | `gh pr checks N` | List status-check rollup |
| "post the team verdict comment" | `gh pr comment N --body @-` | One summary comment per session (edits prior on rerun) |
| "merge the pr — squash" | `gh pr merge N --squash --delete-branch` | Squash + clean head branch (gated by AskUserQuestion) |
| "merge the pr — merge commit" | `gh pr merge N --merge` | Standard merge commit (gated) |
| "merge the pr — rebase" | `gh pr merge N --rebase --delete-branch` | Rebase + clean head branch (gated) |
| "the one I'm on" (resolve PR number) | `gh pr view --json number -q .number` | Map current branch to its PR |
| "the latest open PR" | `gh pr list --state open --limit 1 --json number -q '.[0].number'` | Resolve "latest" to a number |

### Mode / Action — ComposeAgent.ts (QA reviewer)

| User Says | Argument | Effect |
|-----------|----------|--------|
| "give me a skeptical QA reviewer" | `--traits "technical,skeptical,thorough"` | Compose agent with the standard QA trait stack |
| "as JSON for the spawn pipeline" | `--output json` | Machine-readable composed prompt |

### Anti-patterns (DO NOT MAP)

| User Says | Refused gh Command | Reason |
|-----------|--------------------|--------|
| "approve the pr" | `gh pr review --approve` | Auto-approval forbidden — requires human approval (Anti-Goals §) |
| "request changes" | `gh pr review --request-changes` | Same — agent verdict ≠ formal review |
| "force-push fixes" | `git push --force` to head | Side-branch only; never push to PR head |
| "close the pr" | `gh pr close` | Out of scope for this workflow |

## Step 8: Emit Artifact

Write the structured report to `MEMORY/ARTIFACTS/Github/pr-${N}-review-${timestamp}.md` and log to `artifacts.jsonl` per the artifact tracking partial.

## Anti-Goals

- **NEVER** push to PR head branch directly.
- **NEVER** force-push.
- **NEVER** merge without explicit user approval.
- **NEVER** approve / request changes via `gh pr review` based on agent verdict alone.
- **NEVER** close the PR.
- **NEVER** post more than one summary comment per session — edit the prior one if re-running.
