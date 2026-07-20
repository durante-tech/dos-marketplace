---
name: SentinelReview
description: Full branch/PR review against discovered conventions — extends Guard for comprehensive branch-level analysis.
status: STABLE
bestPath:
  - title: "Determine Branch Context"
    description: "Diff the current branch against the default branch (main/master/develop)."
  - title: "Load Conventions"
    description: "Load conventions from the KG, CLAUDE.md, and convention cache (same as Guard)."
  - title: "Full Analysis"
    description: "Run inference over the full branch diff, plus cross-file impact and removed-pattern checks."
  - title: "Render Report"
    description: "Reuse the Guard body render and add the branch header, observations, and an approve/request-changes recommendation."
---

# Sentinel Review — Branch/PR Architecture Review

Full review of all changes in a branch vs the default branch. Extends Guard with branch-level context.

<!-- partial: _workflow-voice.md skill_name=Sentinel workflow_name=Review action_phrase=" to review this branch" -->

## When to Use

- Triggered by "sentinel review", "review PR", "review branch", "architecture review".
- Fits a full branch/PR review against discovered conventions once a feature is done — broader scope than a pre-commit check.
- NOT for a fast staged-changes check before work lands — use Guard (Review covers the whole branch diff; Guard is the narrowest-scope pre-commit check).

## Intent-to-Flag Mapping

| User Says | Tool | Flag | When to Use |
|-----------|------|------|-------------|
| "sentinel review" / "review branch" / "review PR" | SentinelReview.ts | `render <review-output.json>` | Full branch review — run Steps 1-3, assemble the ReviewOutput JSON, then render the Step 4 report skeleton |
| "review help" | SentinelReview.ts | `--help` / `-h` | Show tool usage (the `render` subcommand contract) |

`render` is the only backing invocation — `SentinelReview.ts` exposes a single `render` subcommand (plus `--help`); the branch diff, convention load, and inference are workflow steps, not tool flags. There is no `--json` flag: the tool consumes a ReviewOutput JSON file and emits markdown.

## Workflow

### Step 1: Determine Branch Context

```bash
# Current branch
git rev-parse --abbrev-ref HEAD

# Default branch (from scan report or git)
# Compare against: main, master, or develop

# All changes in this branch
git diff {default_branch}...HEAD --stat
git diff {default_branch}...HEAD
```

### Step 2: Load Conventions

Same as Guard Step 1 — load from KG, CLAUDE.md, and convention cache.

### Step 3: Full Analysis

Same inference approach as Guard, but with the FULL branch diff instead of just staged changes.

**Additional analysis for Review mode:**
- Cross-file impact: do changes in one file affect conventions in another?
- New file patterns: do new files follow the established organization conventions?
- Removed patterns: did any deletions remove the last instance of a convention?

### Step 4: Output

The report markdown is rendered by a tested helper, not hand-typed. It reuses the SAME
Guard render for the violations/evolutions/passing body (so the two workflows can never
drift), and adds the branch header, observations, and recommendation:

```bash
# renderReviewOutput(ReviewOutput) in SentinelReview.ts is the byte-exact source of
# truth for the Review skeleton. It embeds renderGuardReport for the shared body, then
# renders the branch header + Branch-Level Observations + Recommendation. Golden-pinned.
bun ~/.claude/skills/sentinel/Tools/SentinelReview.ts render <review-output.json>
```

**ReviewOutput shape:** `branchName`, `branch`, `defaultBranch`, `filesChanged`,
`linesAdded`, `linesRemoved`, `guard` (a `GuardReport` — see Guard Step 4),
`branchObservations` (string bullets — the cross-file / organization / impact judgment
the agent authors in Review's additional analysis above), `recommendation`
(`APPROVE | APPROVE WITH NOTES | REQUEST CHANGES`), `reasoning` (one-line judgment).

The deterministic skeleton (header, bullet list shape, verdict line) lives in the
helper; the agent supplies the genuinely inferred content — the branch observations and
the verdict + reasoning — as data. The render is golden-pinned in `SentinelReview.test.ts`.
