---
name: Ship
description: Step-by-step feature shipping — commit, push, and open a PR with human confirmation at each stage.
status: STABLE
bestPath:
  - title: "Commit Preparation"
    description: "Generate a conventional commit message and stage specific files by name."
  - title: "Commit Confirmation"
    description: "Show the diff and get human confirmation before committing."
  - title: "Push"
    description: "Confirm and push the branch to origin."
  - title: "PR Creation"
    description: "Confirm and open the pull request with spec, review, and council synthesis context in the body."
  - title: "Cleanup"
    description: "Offer to remove the feature worktree if one was created."
---

# Ship

**Purpose:** Step-by-step shipping with human confirmation at each stage.

## When to Use

- Feature is built and reviewed
- User says "ship it", "commit and PR", "push and PR"
- Final phase of the feature delivery pipeline

## Prerequisites

- Review complete (or skipped for simple tier)
- Review gate approved (or skipped per tier)
- Changes ready to commit

## Steps

### Step 1: Prepare Commit Message

Generate a conventional commit message:

```
feat(scope): description

- Detail 1
- Detail 2

[Include spec summary if one was generated]
[Include issue reference if applicable]
```

Format rules:
- Type: `feat`, `fix`, `refactor`, `chore`, `docs`, `test`
- Scope: the primary area affected
- Description: imperative mood, lowercase, no period
- Body: bullet points for key changes

### Step 2: Show Changes and Confirm Commit

Use the Bash tool to show the user what will be committed:

```bash
git status
git diff --stat
```

Present the commit message and ask: "Ready to commit?"

Wait for user confirmation before proceeding.

### Step 3: Commit

Use the Bash tool to create the commit:

```bash
git add [specific files]
git commit -m "[message]"
```

Stage specific files by name -- avoid `git add -A` or `git add .` to prevent accidentally including sensitive files.

### Step 4: Confirm Push

Ask: "Committed. Push to origin?"

Wait for user confirmation.

### Step 5: Push

Use the Bash tool:

```bash
git push -u origin [branch-name]
```

### Step 6: Confirm PR Creation

Ask: "Pushed. Create pull request?"

Wait for user confirmation.

### Step 7: Create PR

Use the Bash tool with `gh`:

```bash
gh pr create --title "[title]" --body "[body]"
```

PR body includes:
- Feature description
- Spec summary (if one was generated)
- Review results (checklist pass/fail)
- Council synthesis (if gates were run)
- Test coverage notes

### Step 8: Cleanup

If a worktree was created for this feature, offer to clean it up:

"Feature shipped. Want me to remove the worktree?"

## Safety Rules

- **Human confirms every destructive step** (commit, push, PR)
- **Never force-push** without explicit user permission
- **Never push to main/master** directly -- always use feature branches
- **PR body is comprehensive** -- reviewer can understand without reading all the code
- **Stage specific files** -- never use `git add -A` or `git add .`

## Validation

- [ ] Commit message follows conventional format
- [ ] Human confirmed each step (commit, push, PR)
- [ ] PR body includes spec + review results
- [ ] No force-push or direct push to main