---
name: Github
description: GitHub PR fleet coordinator — list open PRs, orchestrate multi-perspective team reviews (Cockburn/Fowler/UncleBob/Sentinel), post comments, propose fixes, and gate merges with explicit approval. Wraps the gh CLI; the agent is the team leader. USE WHEN review prs, review pull requests, triage prs, github review, pr team review, fleet review, sweep prs, github fleet, comment on pr, merge pr, gh pr review, pr orchestration, list open prs, github prs, pr team, lead pr review.
role: executor
accepts:
  - text
icon: GitPullRequest
tier: primary
category: Engineering
displayLabel: GitHub
marketingDescription: Team-leader PR review pack — fan a fleet of open PRs out to a multi-perspective reviewer team, aggregate verdicts, post comments, propose fixes on a side branch, and merge only with explicit human approval.
capabilities:
  - artifact.write
  - customization.cascade
  - four-copy.sync
elevator: Lead a review team across every open PR — opinions in, comments out, merges only with your nod.
highlightWorkflows:
  - name: Review PRs
    technicalName: ReviewPRs
  - name: List PRs
    technicalName: ListPRs
  - name: Review Single PR
    technicalName: ReviewSinglePR
roots:
  - PRINCIPAL
visibility: public
feature_capabilities:
  - Aggregate per-PR verdicts into a single team-leader recommendation (tested precedence fold in GithubCli.ts)
  - Rank and render the PR fleet via Tools/GithubCli.ts — the deterministic verdict-aggregation, ranking, and report/comment engine (the tested 3%)
  - List and triage open PRs in the current repo via gh CLI
  - Merge PRs only with explicit human approval and green CI
  - Post review comments on PRs (auto)
  - Propose fix commits on a side branch (gated by explicit approval)
  - Spawn multi-perspective reviewer team (architecture, refactoring, clean code, conventions, QA)
---
<!-- generated-from: SKILL.partials.md — DO NOT EDIT directly. Run: bun Tools/dos-build.ts skill <path> -->
## Customization

**Before executing, check for user customizations at:**
`~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/Github/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.

# Github

PR fleet coordinator. The agent acts as **team leader** — it lists open PRs in the current repo, fans each one out to a multi-perspective reviewer team, aggregates verdicts, and decides what to do next: comment, propose fixes on a side branch, request changes, or merge.

All git operations go through the system `gh` CLI (already authenticated via keyring); the deterministic render/aggregate/rank **3%** goes through `Tools/GithubCli.ts` (Knuth 97/3 — the judgment is the agent's, the fixed rules are tested code; precedent: `SentinelScan.renderDuranteNative`). The skill is the orchestration layer — which PRs to look at, which reviewers to spawn, how their verdicts roll up, and where the safety gates sit — over two surfaces: `gh` is the toolchain, `GithubCli.ts` is the tested deterministic core (`aggregateVerdicts` / `rankPRs` / `renderReviewReport` / `renderPRCommentBody`, 19 oracle+golden tests).

## Safety Profile (READ FIRST)

PR actions split into **two base tiers — Auto and Gated**. This table is the single canonical safety contract for the skill; the qualifiers in the Tier column (`read`, `write, low blast`, `+ branch-check`, `+ CI-check`) are *conditions within* a base tier, not additional tiers. The skill enforces the split — never blur it, and never re-state a conflicting tier anywhere else.

| Action | Tier | Behavior |
|---|---|---|
| `gh pr list`, `gh pr view`, `gh pr diff`, `gh pr checks` | **Auto** (read) | Always allowed. Read-only on remote. |
| `gh pr comment` (review comment, single-line note) | **Auto** (write, low blast) | Allowed without explicit approval — comments are reversible. |
| `gh pr review --approve` / `--request-changes` | **Gated** | Requires explicit user "yes, approve PR #N" or "yes, request changes on #N". Never inferred from agent verdict. |
| Pushing fix commits to PR head branch | **Gated + branch-check** | NEVER pushes directly to a PR's source branch. Always creates a side branch (`fix/pr-{N}-{slug}`) and posts a link in a comment. |
| `gh pr merge` | **Gated + CI-check** | Requires (1) explicit user approval, (2) all required CI checks green, (3) author confirmation if PR not authored by current user. Never auto-merge based on reviewer verdict alone. |
| `gh pr close`, `gh pr ready` | **Gated** | Requires explicit user instruction. |

**Authoritative rule — operator decision (single source of truth): `gh pr merge` defaults to GATED (manual approval), never Auto.** Green CI plus an all-PASS reviewer verdict are necessary but NOT sufficient — merge always requires an explicit human "yes, merge PR #N". No workflow, reviewer verdict, picker, or convenience path may promote merge to Auto; where any other doc or table implies otherwise, this rule wins.

**Hard rule:** "fix and reopen / merge" mixes safe and unsafe actions. The skill auto-runs the diagnosis (test, comment, propose fix on side branch) and **stops** at the merge boundary, surfacing a structured "ready to merge?" question with `AskUserQuestion`.

## Reviewer Team

The team-leader workflow spawns 4-5 reviewer agents in parallel per PR. Each reviewer reads the PR diff and posts a structured verdict (PASS / CHANGES-REQUESTED / BLOCK + reasoning). The team leader (this skill, primary agent) aggregates.

| Reviewer | Perspective | Spawned via |
|---|---|---|
| **Architecture** | Hexagonal/ports-and-adapters, use case shape, methodology fit | `Skill("cockburn")` |
| **Refactoring** | Code smells, named refactorings from the catalog, design patterns | `Skill("fowler")` |
| **Clean Code** | SOLID, naming, function size, TDD discipline | `Skill("uncle-bob")` |
| **Conventions** | Repo conventions, RFC conformance, project patterns | `Skill("sentinel")` |
| **QA** | What can break, edge cases, test coverage gaps | composed via `agents` skill (`expertise=technical, personality=skeptical, approach=thorough`) |

The skill picks reviewers per PR — small typo-fix PRs may only get Sentinel + QA; architectural PRs get the full team. The `ReviewPRs.md` workflow documents the picker rules.

### Deterministic core (`Tools/GithubCli.ts`)

The reviewer panel and per-reviewer verdicts are the agent's **judgment**; the **team-verdict precedence** (any BLOCK → BLOCK; all PASS → PASS; all CHANGES → substantial; mixed → minor), the **fleet ranking** (red CI → large diff → oldest → PR number), and the **report/comment render** are **fixed rules** — they live in `GithubCli.ts` as pure, oracle-tested functions (`aggregateVerdicts` / `rankPRs` / `renderReviewReport` / `renderPRCommentBody`), never hand-applied in prose. This is the deterministic 3% (Knuth 97/3); the workflows call it, they don't re-derive it.

- **Roster-agnostic seam.** `aggregateVerdicts(verdicts, reviewerNames)` is N-ary: Github passes its 5 voice-pack seats, in seat order; a kit-native team passes its own roster slugs; both flow through the same tested fold unchanged. `rankPRs` is roster-independent — it ranks PRs, not reviewers — so it is shared with no roster parameter at all.
- **Model policy (explicit, not incidental).** The review seats run at the **session / orchestrator model** (opus on the DOS dogfood path that reviews this repo's own PRs). PR review is high-stakes judgment — the seats are deliberately not downgraded. A lighter fleet sweep MAY compose the QA seat at a cheaper tier via `ComposeAgent.ts`; the voice-pack seats (`Skill("cockburn")` …) inherit the session model by design. Model choice is a stated policy here, not an accident of whatever model happens to be orchestrating.

## Workflow Routing

| Workflow | Trigger | File |
|----------|---------|------|
| **ReviewPRs** | "review prs", "sweep prs", "fleet review", "lead the review team" | `Workflows/ReviewPRs.md` |
| **ListPRs** | "list open prs", "github prs status", "what prs are open" | `Workflows/ListPRs.md` |
| **ReviewSinglePR** | "review pr #N", "deep review pr", "team review on pr 42" | `Workflows/ReviewSinglePR.md` |

**Not for kit-native PR review.** Github is the **generic-principles** fleet reviewer — any repo, voice-pack panel (Cockburn / Fowler / UncleBob / Sentinel + a composed QA seat). Inside a scaffolded fork, defer PR review to the kit-native pack that knows the stack and its roster: **MakerkitTeam** (in the Makerkit / Prisma SaaS kit) or **FastAPIStarterTeam** (in the FastAPI starter). Those packs run their own multi-agent roster and an N-agent TODO-checklist render; Github holds the tested deterministic core (`aggregateVerdicts` / `rankPRs`) and the same verdict precedence they apply. Reciprocal to Sentinel's "NOT for PR fleet ops — use Github". (The render shape and reviewer substance stay per-pack — only the deterministic verdict/rank rule is the shared contract.)

## Examples

**Example 1: Fleet review of all open PRs**
```
User: "review the open PRs"
→ Invokes ReviewPRs workflow
→ gh pr list --state open --json number,title,author,isDraft,labels,createdAt
→ Filters: skip drafts unless --include-drafts; skip stale (>30d) unless --include-stale
→ For each PR: spawn 3-5 reviewer agents in parallel (Cockburn/Fowler/UncleBob/Sentinel/QA picker)
→ Aggregate verdicts → team-leader recommendation per PR
→ Post one summary comment per PR (auto)
→ Surface AskUserQuestion: "PR #42 ready to merge / PR #51 needs your call on X — pick one"
→ Stop at the merge boundary — never auto-merge
```

**Example 2: Lightweight status sweep**
```
User: "what PRs are open"
→ Invokes ListPRs workflow
→ gh pr list with author, age, CI status, label filters
→ Returns ranked table (oldest first, CI-failing flagged, draft-grouped)
→ No reviewer spawning, no comments — pure status
→ Pairs naturally with /loop for daily morning brief
```

**Example 3: Deep review of one PR**
```
User: "team review on PR #42"
→ Invokes ReviewSinglePR workflow with prNumber=42
→ gh pr view 42 + gh pr diff 42 + gh pr checks 42
→ Spawn full reviewer team in parallel (5 agents)
→ Aggregate verdicts → structured report (PASS/CHANGES/BLOCK per reviewer)
→ Post review comment with team verdict + ASK whether to propose fix on side branch
→ If user says yes: create fix/pr-42-{slug} branch, push proposed commits, link in comment
→ Stop. Wait for explicit "merge it" before any merge action
```

## Artifact Tracking

**MANDATORY for any workflow in this skill that writes output files via the Write tool.**

After writing any output file, resolve the ARTIFACTS path and append a JSONL log entry:

```bash
# Resolve ARTIFACTS dir (project-level first)
if [ -d "${CLAUDE_PROJECT_DIR}/MEMORY/ARTIFACTS" ]; then
  ARTIFACTS_DIR="${CLAUDE_PROJECT_DIR}/MEMORY/ARTIFACTS"
elif [ -d "$(pwd)/MEMORY/ARTIFACTS" ]; then
  ARTIFACTS_DIR="$(pwd)/MEMORY/ARTIFACTS"
else
  ARTIFACTS_DIR="$HOME/.claude/MEMORY/ARTIFACTS"
fi
mkdir -p "$ARTIFACTS_DIR"

echo '{"timestamp":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","pack":"Github","workflow":"WORKFLOW_NAME","type":"ARTIFACT_TYPE","title":"TITLE","path":"ABSOLUTE_PATH","contentPreview":"FIRST_500_CHARS_ESCAPED","wing":"WING_OR_GENERAL","sessionId":"'$CLAUDE_SESSION_ID'"}' >> "$ARTIFACTS_DIR/artifacts.jsonl"
```

If this skill is read-only (no Write tool usage), this section is informational only.

## Four-Copy Compliance

This skill exists in up to four locations per the DOS Four-Copy Rule (`Durante/CLAUDE.md`):

1. `~/.claude/skills/github/` — live install (what Claude Code runs)
2. `Releases/<active-version>/.claude/skills/github/` — active release submodule (versioned)
3. `Packs/*/src/Github/` — pack source (distributable)
4. `Packs/agents/Github/` — agent runtime (only if applicable)

After editing any file in this skill, verify all copies via `bun ~/Durante/Tools/sync-check.ts`. Exit code 0 = clean. Exit code 1 = drift; resolve with `--fix` before commit.
