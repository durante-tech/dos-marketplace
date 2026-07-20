---
name: Review
description: Run a structured 10-point multi-perspective code review, classify findings by severity, and gate progression on blockers.
status: STABLE
bestPath:
  - title: "Change Discovery"
    description: "List all files changed against the base branch."
  - title: "Checklist Review"
    description: "Read each changed file and evaluate it against the 10-point review checklist."
  - title: "Issue Classification"
    description: "Classify each finding as skippable, tech-debt, or blocker."
  - title: "Review Presentation"
    description: "Present a structured summary of blockers, tech-debt, and skippable items with a recommendation."
  - title: "Blocker Handling"
    description: "Route back to build on blockers, or proceed to the council gate/ship on a clean pass."
---

# Code Review

**Purpose:** Structured multi-perspective review during the verify phase.

## When to Use

- After building a feature, before shipping
- User asks "review the code" or "code review"
- Part of the full feature delivery pipeline

## Review Checklist

1. **Conventions** -- Follows project patterns?
2. **Types** -- TypeScript correct, no `any`, schemas match?
3. **Security** -- Auth applied, no exposed secrets, RBAC enforced?
4. **Error Handling** -- Errors caught, user-friendly messages?
5. **Performance** -- No N+1 queries, pagination, indexes?
6. **Testing** -- Tests written, meaningful assertions, edge cases?
7. **i18n** -- User text uses translation keys?
8. **Accessibility** -- ARIA labels, keyboard nav, screen reader?
9. **Data Integrity** -- Cascading deletes, referential integrity?
10. **Build** -- Types compile, lint passes, no circular imports?

## Steps

### Step 1: List Changed Files

Use the Bash tool to identify all changes:
```bash
git diff --name-only main
```

### Step 2: Read Each Changed File

Use the Read tool to examine each changed file. For large diffs, use Bash to get the specific diff:
```bash
git diff main -- path/to/file
```

### Step 3: Check Against 10-Point Checklist

For each changed file, evaluate against the review checklist. Focus on:
- Items relevant to the file type (e.g., skip i18n for backend-only changes)
- Project-specific conventions (use Grep to find patterns in existing code)

### Step 4: Classify Issues

Classify each finding:

| Severity | Meaning | Action |
|----------|---------|--------|
| **Skippable** | Style preference, minor inconsistency | Note but don't block |
| **Tech-debt** | Not ideal but functional, should be addressed later | Note with TODO recommendation |
| **Blocker** | Bug, security issue, missing error handling, broken types | Must fix before shipping |

### Step 5: Present Review

```
Code Review -- [FEATURE NAME]
Tier: [SIMPLE / MEDIUM / COMPLEX]
Files reviewed: [N]

Blockers: [count]
  - [File]: [Issue] -- [Why it blocks]

Tech-debt: [count]
  - [File]: [Issue] -- [Recommendation]

Skippable: [count]
  - [File]: [Note]

Recommendation: [PASS / FIX-AND-RETRY / MAJOR-REWORK]
```

### Step 6: Handle Blockers

- If **blockers found**: Return to build phase. Maximum 2 review loops before escalating.
- If **clean or tech-debt only**: Proceed to council review gate (if tier warrants) or ship.
- If **major rework**: Present concerns and discuss with user before proceeding.

## Review Depth by Tier

| Tier | Approach |
|------|----------|
| Simple | Quick scan -- conventions, types, obvious bugs only |
| Medium | Standard -- full 10-point checklist, all changed files |
| Complex | Thorough -- full checklist + cross-file interaction analysis + security deep-dive |

## Validation

- [ ] All changed files reviewed
- [ ] Issues classified by severity
- [ ] Blockers addressed before proceeding
- [ ] Review summary presented to user