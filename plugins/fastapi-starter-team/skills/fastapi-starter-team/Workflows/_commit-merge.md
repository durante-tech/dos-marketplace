# Commit + Merge Hygiene (binding)

Shared substrate for every FastAPIStarterTeam workflow that lands a commit, opens a PR, posts a PR comment, or merges. Codifies the project's commit/merge patterns so workflow prescriptions match what the orchestrator actually does.

**Source of truth:**
- `~/Developer/dos-fastapi-starter/AGENTS.md` (Hard Rule 8 no emojis; commit-message concision)
- `Workflows/_pr-loop-shared.md` (safety tier table)
- DOS principal preferences: HEREDOC commit messages, `Co-Authored-By: DuranteOS <tech@duranteos.com>` trailer, explicit-list staging, NEW commit (not amend) after pre-commit hook failure, `git fetch && git status` before `git add` for concurrent-landing safety
- starter pre-commit chain: ruff format → ruff check → mypy → pytest

**Sibling:** `MakerkitTeam/Workflows/_commit-merge.md` (TS/pnpm flavor). Same shape; ruff/mypy/pytest replaces ESLint/Prettier/Vitest.

## Commit Message Format (binding)

Every commit follows this shape:

```
<type>(<scope>): <concise subject ≤72 chars>

<body bullets — concise, one bullet per material change>
- ...

Co-Authored-By: DuranteOS <tech@duranteos.com>
```

**Conventional Commits types** (in scope for this starter):

| Type | When |
|---|---|
| `feat` | New feature or user-visible behavior change (new endpoint, new agent, new model) |
| `fix` | Bug fix |
| `refactor` | Behavior-preserving improvement |
| `chore` | Tooling, deps (uv.lock), repo hygiene |
| `docs` | Documentation changes only (mkdocs, AGENTS.md, ADR) |
| `test` | Test-only changes (tests/unit/, tests/integration/, conftest.py) |
| `style` | Formatting / whitespace / non-behavior (ruff format) |
| `perf` | Performance improvement |
| `revert` | Reverts a prior commit |

**`<scope>`** mirrors the starter's package convention — feature slug, module name, or `pr-N` for PR-loop batches (e.g., `feat(webhook-receipts):`, `fix(rate-limit):`, `fix(pr-42):`, `refactor(crud):`, `docs(deployments):`).

**Subject line rules**:
- ≤72 characters; aim for ≤50
- Lowercase after the colon
- No trailing period
- Concise — sacrifice grammar for concision when needed
- Imperative mood when natural (`add`, `fix`, `extract`) but concision wins

**Body rules**:
- One blank line between subject and body
- Concise bullets describing material changes — what changed and why, not how
- Cite file paths when relevant (`src/app/api/v1/users.py:42`)
- Skip the body for trivial single-file fixes — subject alone is fine

**Trailer**:
- `Co-Authored-By: DuranteOS <tech@duranteos.com>` is mandatory on every commit produced by a FastAPIStarterTeam workflow
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
- **Never include**: `MEMORY/`, `.env*` (production secrets), `.venv/`, `__pycache__/`, `.mypy_cache/`, `.ruff_cache/`, `.pytest_cache/`, anything in `.gitignore`
- **`git fetch && git status`** BEFORE `git add` to detect concurrent landings — if origin advanced since session start, surface to operator before staging
- **Submodule edits** stage the submodule ref via `git add <submodule-path>` AFTER the inner commit (FastAPIStarterTeam doesn't currently produce submodule edits, but starter projects may host their own submodules)

## Pre-Commit Hook Failure Handling

The starter's pre-commit chain (typical via `.pre-commit-config.yaml`):

1. `ruff format` — formatting
2. `ruff check` — linting
3. `mypy` — type checking
4. `pytest` (often skipped in pre-commit; some projects gate on a fast subset)

**Rule (CRITICAL, from `~/.claude/CLAUDE.md` git safety protocol):** when a pre-commit hook fails, the commit did NOT happen. **NEVER `--amend`** — that would modify the PREVIOUS commit. Instead:

1. Read the hook's error output verbatim
2. Fix the underlying issue (don't bypass with `--no-verify` unless operator explicitly requests)
3. Re-stage the fixed files (`git add ...`)
4. Create a NEW commit (`git commit ...`)

Common fix patterns:

| Hook | Common failure | Fix |
|---|---|---|
| `ruff format` | Whitespace/quotes drift | `uv run ruff format src tests` then re-stage |
| `ruff check` | Import order, unused vars | `uv run ruff check --fix src tests` then re-stage |
| `mypy` | Type error | Edit code to satisfy type; re-stage |
| `pytest` | Failing test | Fix code or fix test; re-stage both |

`--no-verify`, `--no-gpg-sign`: never use unless operator explicitly requests.

## PR Creation

```bash
gh pr create --title "<concise title>" --body "$(cat <<'EOF'
## Summary
<1-3 bullets describing what shipped and why>

## Test plan
- [ ] uv run pytest tests/unit
- [ ] uv run pytest tests/integration (with docker-compose stack up)
- [ ] mcp__dos_fastapi__run_checks (ruff + mypy + pytest)
- [ ] <feature-specific verification — e.g., curl the new endpoint, open Swagger UI>

Co-Authored-By: DuranteOS <tech@duranteos.com>
EOF
)"
```

**Title rules**: Conventional Commits prefix encouraged; ≤70 chars; concise.

**Body shape** (always two H2 sections):

- `## Summary` — 1-3 bullets answering "what shipped and why"
- `## Test plan` — markdown checkbox list of verification steps the reviewer (or CI) should run

**Branch convention**:
- Feature: `feat/<feature-slug>`
- Bugfix: `fix/<bug-slug>`
- Refactor: `refactor/<refactor-slug>`
- PR-loop side branch: `fix/pr-{N}-todos` (per `_pr-loop-shared.md`)

**Pushing the PR's head branch** for non-PR-loop workflows: feature branch only, never push to `main`.

## PR Comment

Per `_pr-loop-shared.md` Auto-write low-blast tier — single comment per PR per session, edited via `--edit-last`:

```bash
gh pr comment {N} --edit-last --create-if-none --body-file /tmp/pr-{N}-comment.md
```

Re-runs UPDATE the existing comment. NEVER post additional comments — that's thread spam. The `Tools/RenderTodoComment.ts` renderer produces the deterministic body for PR-loop workflows.

## Merge Gate (Gated tier)

**NEVER auto-merge.** **NEVER infer merge from team verdict.**

Merge requires BOTH:
1. **Explicit operator approval via `AskUserQuestion`** — never silent, never inferred
2. **All required CI checks green** — verify with `gh pr checks {N}` before merging

Canonical merge invocation (after both conditions hold):

```bash
gh pr merge {N} --squash --delete-branch
```

(`--squash` per typical convention — clean linear history. Operator may override to `--merge` or `--rebase` if requested.)

**Forbidden under any circumstance**:
- `gh pr merge` without operator confirmation in this session
- `gh pr merge` while CI is red, pending, or unknown
- `gh pr review --approve` / `--request-changes` based on team verdict alone
- `gh pr close` / `gh pr ready` without explicit operator instruction

## Push Safety

**NEVER**:
- `git push --force` anywhere (use `--force-with-lease` only if operator explicitly requests + understands the trade-off)
- `git push origin <pr-head-ref>` — push to PR head branch (forbidden by `_pr-loop-shared.md`)
- Push to `main` without explicit operator approval

**Always**:
- `git push -u origin <branch>` for first push of a new branch
- `git fetch origin` before any push to detect concurrent commits

## Per-Step Commits (Refactor)

Refactor workflow's Phase 3 lands one commit per refactor step — small, reversible, individually testable. Pattern:

```bash
# Step 1: extract function
git add <files> && git commit -m "$(cat <<'EOF'
refactor(<scope>): extract <function-name>

Co-Authored-By: DuranteOS <tech@duranteos.com>
EOF
)"
# Run scoped tests; if red, REVERT this step and report
uv run pytest tests/unit/test_<module>.py -x
```

**On test red after a step**: `git revert HEAD --no-edit` and report to operator. Do NOT chain another step on a red working tree.

**Squashing happens only if operator explicitly requests it at G3-refactor.** Default = preserved per-step commits.

## Working-Tree-Clean Expectation

The Algorithm v0.0.7-enhanced LEARN phase declares a `wt-clean` evidence: `phase: complete` is blocked unless the working tree is clean OR `DOS_ALLOW_DIRTY_LEARN=1` is set as an audited bypass.

**FastAPIStarterTeam workflow rule**: every change-producing workflow that reaches its terminal phase MUST either:

- Land all changes via commits per this partial (working tree clean), OR
- Surface explicitly to the operator that work is staged-but-uncommitted with a clear next-step

The audited bypass is for the orchestrator's own bookkeeping, not for routine workflow output.

## Per-Workflow Application

| Workflow | Commit/Merge surface | Cites this partial at |
|---|---|---|
| DeliverFeature | Phase 7 (Ship — opens feature PR via `gh pr create`) | Phase 7 PR creation block |
| BugFix | Phase 4 → Phase 5 (lands fix as one commit; postmortem appends to PRD) | Phase 4 commit hygiene block |
| QuickFix | Phase 1-3 (single surgical commit, optional integration commit) | Phase 1 commit hygiene block |
| Refactor | Phase 3 (per-step commits) | Phase 3 commit hygiene block |
| ReviewSinglePR | Phase 7 (Stop at Merge Boundary) | Phase 7 merge gate block |
| ReviewOpenPRs | Phase 9 (Surface Final Report + merge gate) | Phase 9 merge gate block |
| ExecuteOpenTodos | Phase 5 (per-batch commit), Phase 6 (push side branch), Phase 8 (stop at merge) | Phase 5 / 6 / 8 |

## Anti-Patterns to Catch

1. **`git add -A` or `git add .`** — accidentally stages secrets / `.env` / `MEMORY/` / `.venv/` / OS scratch files. Always explicit list.
2. **Single-line commit message via `git commit -m "..."`** when the change has 3+ material parts — body bullets give reviewers context.
3. **Missing Co-Authored-By trailer** — every FastAPIStarterTeam workflow commit MUST carry it.
4. **`--amend` after pre-commit hook failure** — destroys prior commit context. Always NEW commit.
5. **`--no-verify` to bypass a failing hook** — bypasses the gate that exists to catch the bug. Fix the bug; if the hook itself is wrong, fix the hook.
6. **`gh pr merge` based on team verdict alone** — verdict informs the operator; only the operator merges.
7. **Pushing to `main` from any workflow** — feature branch + PR is mandatory.
8. **`--force` on a shared branch** — destroys reviewer comments / approvals / context. Use `--force-with-lease` only if operator explicitly requests.
9. **Emojis in commit messages or code** — Hard Rule 8 violation. Technical prose only.

## Cross-references

- **`~/.claude/CLAUDE.md`** Git Safety Protocol — the canonical principal-level rules
- **`~/Developer/dos-fastapi-starter/AGENTS.md`** — starter's commit-message concision rule + Hard Rule 8 (no emojis)
- **`Workflows/_pr-loop-shared.md`** — safety tier table + side-branch convention + artifact JSON schema
- **`~/.claude/DOS/Algorithm/sub-docs/dag-playbook.md`** — 8-step pattern's integration step
- **`~/.claude/DOS/Algorithm/v0.0.7-enhanced.md`** §6.7 LEARN phase + working-tree-clean evidence
