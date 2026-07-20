---
name: MakerkitCommitMerge
status: STABLE
divergence_from_canonical:
  _intent-to-flag-table.md:
    partial_version: 1.0.0
    reason: "Commit/merge substrate maps git and gh safety commands; canonical Mode/Output two-table shape does not fit"
---

# Commit + Merge Hygiene (binding)

Shared substrate for every MakerkitTeam workflow that lands a commit, opens a PR, posts a PR comment, or merges. Codifies the project's commit/merge patterns so workflow prescriptions match what the orchestrator actually does.

**Source of truth:**
- `<kit-repo>/AGENTS.md` (repo resolved per the `Tools/ResolveRepo.ts` ladder: explicit > `$KIT_REPO` > git toplevel; kit rule: "in commit messages, be extremely concise — sacrifice grammar for the sake of concision")
- `Workflows/_pr-loop-shared.md` (safety tier table — Auto-read / Auto-write low-blast / Gated / NEVER — preserved by reference; don't duplicate)
- DOS principal preferences: HEREDOC commit messages, `Co-Authored-By: DuranteOS <tech@duranteos.com>` trailer, explicit-list staging, NEW commit (not amend) after pre-commit hook failure, `git fetch && git status` before `git add` for concurrent-landing safety

This partial is the kit-flavored commit/merge contract. The PR-loop safety tier table in `_pr-loop-shared.md` remains canonical for PR actions.

## Intent-to-Flag Mapping

| Operator intent | Command / flag pattern | Notes |
|---|---|---|
| "commit these changes" | `git add <explicit paths>` then `git commit -m "$(cat <<'EOF' ... EOF)"` | Explicit staging only; never amend after hook failure. |
| "open a PR" | `gh pr create --title "<title>" --body "$(cat <<'EOF' ... EOF)"` | Body must include Summary and Test plan. |
| "update the PR-loop comment" | `gh pr comment {N} --edit-last --create-if-none --body-file /tmp/pr-{N}-comment.md` | One comment per PR per session. |
| "merge after approval" | `gh pr checks {N}` then `gh pr merge {N} --squash --delete-branch` | Requires explicit operator approval and green checks. |
| "push a branch" | `git push -u origin <branch>` | Never force-push unless explicitly approved. |

## Commit Message Format (binding)

Every commit follows this shape:

```
<type>(<scope>): <concise subject ≤72 chars>

<body bullets — concise, one bullet per material change>
- ...

Co-Authored-By: DuranteOS <tech@duranteos.com>
```

**Conventional Commits types** (in scope for this kit):

| Type | When |
|---|---|
| `feat` | New feature or user-visible behavior change |
| `fix` | Bug fix |
| `refactor` | Behavior-preserving improvement |
| `chore` | Tooling, deps, repo hygiene |
| `docs` | Documentation changes only |
| `test` | Test-only changes |
| `style` | Formatting / whitespace / non-behavior |
| `perf` | Performance improvement |
| `revert` | Reverts a prior commit |

**`<scope>`** mirrors the recent kit log convention — feature slug, package name, or `pr-N` for PR-loop batches (e.g., `feat(team-invite):`, `fix(billing):`, `fix(pr-42):`, `refactor(rbac):`).

**Subject line rules** (per kit AGENTS.md):
- ≤72 characters; aim for ≤50
- Lowercase after the colon
- No trailing period
- "Extremely concise — sacrifice grammar for the sake of concision"
- Imperative mood when natural (`add`, `fix`, `extract`) but concision wins

**Body rules**:
- One blank line between subject and body
- Concise bullets (each on its own `- ` line) describing material changes — what changed and why, not how
- Cite file paths or line ranges when relevant (`apps/web/x.action.ts:42`)
- Skip the body for trivial single-file fixes — subject alone is fine

**Trailer**:
- `Co-Authored-By: DuranteOS <tech@duranteos.com>` is mandatory on every commit produced by a MakerkitTeam workflow
- One blank line before the trailer

**HEREDOC always** for multi-line bodies — the canonical invocation:

```bash
git commit -m "$(cat <<'EOF'
<type>(<scope>): <subject>

- <body bullet 1>
- <body bullet 2>

Co-Authored-By: DuranteOS <tech@duranteos.com>
EOF
)"
```

The `'EOF'` quoting prevents shell expansion inside the body. Always quote.

## Staging Rules

- **Stage explicitly.** `git add <path1> <path2> ...` — never `git add -A` or `git add .`
- **Never include**: `MEMORY/`, `.env*`, `credentials.json`, `.dos-protected.json` overrides, anything in `.gitignore`
- **`git fetch && git status`** BEFORE `git add` to detect concurrent landings — if origin advanced since session start, surface to operator before staging (per Algorithm self-correction note from prior session)
- **Submodule edits** stage the submodule ref via `git add <submodule-path>` AFTER the inner commit; if Lucas's machine has the maintainer symlink, the inner commit happens via `bun ~/Durante/Tools/ship-submodule.ts "<message>"` which auto-stages the ref

## Pre-Commit Hook Failure Handling

The kit's pre-commit hooks may run typecheck / lint / format / tests. DOS's pre-commit dispatch fires 16 gates (sync, voice, build, conformance, R9/R10, manifest, env, studio, back-port, doctor, etc.).

**Rule (CRITICAL, from `~/.claude/CLAUDE.md` git safety protocol):** when a pre-commit hook fails, the commit did NOT happen. **NEVER `--amend`** — that would modify the PREVIOUS commit. Instead:

1. Read the hook's error output verbatim
2. Fix the underlying issue (don't bypass with `--no-verify` unless operator explicitly requests)
3. Re-stage the fixed files (`git add ...`)
4. Create a NEW commit (`git commit ...`)

`--no-verify`, `--no-gpg-sign`, `-c commit.gpgsign=false`: never use unless operator explicitly requests.

## PR Creation

```bash
gh pr create --title "<concise title>" --body "$(cat <<'EOF'
## Summary
<1-3 bullets describing what shipped and why>

## Test plan
- [ ] <bulleted markdown checklist of TODOs to verify the PR>
- [ ] <each item should be a concrete verification step>

Co-Authored-By: DuranteOS <tech@duranteos.com>
EOF
)"
```

**Title rules**: same as commit subject — Conventional Commits prefix optional but encouraged; ≤70 chars; concise.

**Body shape** (always two H2 sections):

- `## Summary` — 1-3 bullets answering "what shipped and why"
- `## Test plan` — markdown checkbox list of verification steps the reviewer (or CI) should run

**Branch convention** for PR-loop side branches: `fix/pr-{N}-todos` (or `-r{n}` retry variant if previously merged into head). Per `_pr-loop-shared.md` — preserved by reference.

**Pushing the PR's head branch** for non-PR-loop workflows (DeliverFeature opening a fresh feature PR): use a feature branch, never push to `main`. Branch name follows kit convention (`feat/<feature-slug>`, `fix/<bug-slug>`, `refactor/<refactor-slug>`).

## PR Comment

Per `_pr-loop-shared.md` Auto-write low-blast tier — single comment per PR per session, edited via `--edit-last`:

```bash
gh pr comment {N} --edit-last --create-if-none --body-file /tmp/pr-{N}-comment.md
```

Re-runs UPDATE the existing comment. NEVER post additional comments — that's thread spam. The `Tools/RenderTodoComment.ts` renderer produces the deterministic body for PR-loop workflows.

## Merge Gate (Gated tier)

**NEVER auto-merge.** **NEVER infer merge from team verdict.** **NEVER call `gh pr review --approve` based on team verdict alone.**

Merge requires BOTH:
1. **Explicit operator approval via `AskUserQuestion`** — never silent, never inferred
2. **All required CI checks green** — verify with `gh pr checks {N}` before merging

Canonical merge invocation (after both conditions hold):

```bash
gh pr merge {N} --squash --delete-branch
```

(`--squash` per kit convention — clean linear history. Operator may override to `--merge` or `--rebase` if requested.)

**Forbidden under any circumstance**:
- `gh pr merge` without operator confirmation in this session
- `gh pr merge` while CI is red, pending, or unknown
- `gh pr review --approve` / `--request-changes` based on team verdict alone
- `gh pr close` / `gh pr ready` without explicit operator instruction

## Push Safety

**NEVER**:
- `git push --force` anywhere (use `--force-with-lease` only if operator explicitly requests + understands the trade-off)
- `git push origin <pr-head-ref>` — push to PR head branch (forbidden by `_pr-loop-shared.md` safety tier; ExecuteOpenTodos uses side branch)
- Push to `main` without explicit operator approval

**Always**:
- `git push -u origin <branch>` for first push of a new branch
- `git fetch origin` before any push to detect concurrent commits on the branch

**Side-branch convention** (per `_pr-loop-shared.md`):
- ExecuteOpenTodos pushes to `fix/pr-{N}-todos` (or `-r{n}` if previously merged into head)
- NEVER `--force` even on the side branch

## Per-Step Commits (Refactor)

Refactor workflow's Phase 3 lands one commit per refactor step — small, reversible, individually testable. Pattern:

```bash
# Step 1: extract method
git add <files> && git commit -m "$(cat <<'EOF'
refactor(<scope>): extract <method-name>

Co-Authored-By: DuranteOS <tech@duranteos.com>
EOF
)"
# Run scoped tests; if red, REVERT this step and report
pnpm --filter @kit/<pkg> test:unit
```

**On test red after a step**: `git revert HEAD --no-edit` and report to operator. Do NOT chain another step on a red working tree.

**Squashing happens only if operator explicitly requests it at G3-refactor.** Default = preserved per-step commits.

## chmod 755

Before committing any new `*.hook.ts` or `*.daemon.ts`:

```bash
chmod 755 <path-to-new-hook-or-daemon>
git add <path>
```

Skipping `chmod` causes "Permission denied" at hook fire time — caught in the post-tragedy delivery 2026-05-04 (per `dag-playbook.md` anti-pattern catalog).

## Working-Tree-Clean Expectation

The active Algorithm doctrine's LEARN phase (resolve via `~/.claude/DOS/Algorithm/LATEST`) declares a `wt-clean` evidence: phase: complete is blocked unless the working tree is clean OR `DOS_ALLOW_DIRTY_LEARN=1` is set as an audited bypass.

**MakerkitTeam workflow rule**: every change-producing workflow that reaches its terminal phase MUST either:

- Land all changes via commits per this partial (working tree clean), OR
- Surface explicitly to the operator that work is staged-but-uncommitted with a clear next-step

The audited bypass (`DOS_ALLOW_DIRTY_LEARN=1`) is for the orchestrator's own bookkeeping when the operator is mid-conversation, not for routine workflow output.

## Per-Workflow Application

| Workflow | Commit/Merge surface | Cites this partial at |
|---|---|---|
| DeliverFeature | Phase 7 (Ship — opens feature PR via `gh pr create`) | Phase 7 PR creation block |
| BugFix | Phase 4 → Phase 5 (lands fix as one commit; postmortem appends to PRD) | Phase 4 commit hygiene block |
| QuickFix | Phase 1-3 (single surgical commit, optional E2E commit) | Phase 1 commit hygiene block |
| Refactor | Phase 3 (per-step commits) | Phase 3 commit hygiene block |
| ReviewSinglePR | Phase 7 (Stop at Merge Boundary) | Phase 7 merge gate block |
| ReviewOpenPRs | Phase 9 (Surface Final Report + merge gate) | Phase 9 merge gate block |
| ExecuteOpenTodos | Phase 5 (per-batch commit), Phase 6 (push side branch), Phase 8 (stop at merge) | Phase 5 / 6 / 8 |

The partial is the source of truth; workflows reference it rather than duplicating the rules inline.

## Anti-Patterns to Catch

The kit-flavored anti-patterns to enforce, beyond the dag-playbook + `_pr-loop-shared.md` rules:

1. **`git add -A` or `git add .`** — accidentally stages secrets / `.env` / `MEMORY/` / `.next-rfc-reservation` / OS scratch files. Always explicit list.
2. **Single-line commit message via `git commit -m "..."`** when the change has 3+ material parts — body bullets give reviewers context. HEREDOC always for multi-part work.
3. **Missing Co-Authored-By trailer** — every MakerkitTeam workflow commit MUST carry it.
4. **`--amend` after pre-commit hook failure** — destroys prior commit context. Always NEW commit.
5. **`--no-verify` to bypass a failing hook** — bypasses the gate that exists to catch the bug. Fix the bug; if the hook itself is wrong, fix the hook.
6. **`gh pr merge` based on team verdict alone** — verdict informs the operator; only the operator merges.
7. **Pushing to `main` from any workflow** — feature branch + PR is mandatory.
8. **`--force` on a shared branch** — destroys reviewer comments / approvals / context. Use `--force-with-lease` only if operator explicitly requests.

## Cross-references

- **`~/.claude/CLAUDE.md`** Git Safety Protocol — the canonical principal-level rules (HEREDOC, Co-Authored-By, never amend after hook failure, never --no-verify)
- **`<kit-repo>/AGENTS.md`** (resolved per `Tools/ResolveRepo.ts`) — kit's commit-message concision rule
- **`Workflows/_pr-loop-shared.md`** — safety tier table + side-branch convention + artifact JSON schema (preserved by reference)
- **`~/.claude/DOS/Algorithm/sub-docs/dag-playbook.md`** — chmod 755 anti-pattern catalog + 8-step pattern's integration step
- **`~/.claude/DOS/Algorithm/LATEST`** (resolves to active doctrine) LEARN phase + working-tree-clean evidence
- **`bun ~/Durante/Tools/ship-submodule.ts`** — DOS-internal canonical submodule ship tool (when MakerkitTeam edits land in a DOS submodule, not the kit itself)
