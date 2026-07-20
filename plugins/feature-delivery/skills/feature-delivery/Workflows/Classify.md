---
name: Classify
description: Assess feature complexity (simple/medium/complex) and determine worktree/spec/council/review pipeline behavior.
status: STABLE
bestPath:
  - title: "Feature Description Intake"
    description: "Parse the user's feature request, asking clarifying questions if vague."
  - title: "Complexity Signal Analysis"
    description: "Check the codebase for schema, package-scope, auth, route, real-time, and background-job signals."
  - title: "Impact Estimation"
    description: "Estimate the approximate number of files that will need modification."
  - title: "Classification & Report"
    description: "Assign a tier and communicate the resulting pipeline behavior to the user."
---

# Classify Feature

**Purpose:** Assess feature complexity to determine pipeline behavior.

## When to Use

- Starting a new feature delivery pipeline
- User asks "how complex is this feature"
- Need to determine what level of process is appropriate

## Classification Criteria

| Tier | Signals | Pipeline Behavior |
|------|---------|-------------------|
| **Simple** | Single file change, config update, copy change, styling tweak | No worktree, no spec, no council, quick review |
| **Medium** | Multi-file, single package, no schema change, new UI page | Worktree, spec, quick council at plan, standard review |
| **Complex** | Schema changes, multi-package, auth/RBAC, new routes, real-time, background jobs | Worktree, spec, full council at plan + review, thorough review |

## Steps

### Step 1: Read Feature Description

Parse the user's feature request. If vague, ask clarifying questions before classifying.

### Step 2: Analyze Complexity Signals

Use the Grep and Glob tools to check the codebase for:
- **Schema involvement** -- Will this need new database models or migrations?
- **Package scope** -- How many packages/directories will be touched?
- **Auth/security** -- Does this involve authentication, authorization, or sensitive data?
- **New routes** -- Are new API routes or pages being added?
- **Real-time** -- WebSockets, subscriptions, or event streaming?
- **Background jobs** -- Queue workers, cron tasks, or async processing?

### Step 3: Estimate Impact

Use the Bash tool to count approximate files changed:
```
Use Glob to find files matching the feature area.
Estimate total files that will need modification.
```

### Step 4: Classify and Report

Present the classification:

```
Feature: [DESCRIPTION]
Tier: [SIMPLE / MEDIUM / COMPLEX]

Signals:
- [Signal 1]: [Evidence]
- [Signal 2]: [Evidence]

Pipeline:
- Worktree: [Yes/No]
- Spec: [Yes/No]
- Council gates: [None / Quick at plan / Full at plan + review]
- Review: [Quick / Standard / Thorough]
```

If ambiguous between tiers, note the uncertainty and ask the user: "This could be medium or complex. Want a quick council check to decide?"

## Validation

- [ ] Feature description analyzed
- [ ] Complexity signals checked against codebase
- [ ] Tier assigned with rationale
- [ ] Pipeline behavior communicated to user