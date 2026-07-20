---
name: Evolve
description: Runs a full 7-expert Dream Team review, extracts unanimous recommendations, and implements them directly against the consumer page/copy/component source before verifying with healthcheck.
status: STABLE
bestPath:
  - title: "Contract Verification"
    description: "VERIFY-PROBE the consumer-repo contract read-only before any mutation."
  - title: "Full Review"
    description: "Run the Review workflow and collect all 7 expert perspectives."
  - title: "Unanimous Extraction"
    description: "Extract and categorize recommendations where 3+ experts independently converge."
  - title: "Implementation"
    description: "Apply changes safest-to-most-impactful, then verify with healthcheck."
  - title: "Report"
    description: "Produce an evolution report with findings, implemented/deferred changes, and metrics."
---

# DreamTeam Evolve

**Mode:** Full review then implementation of unanimous recommendations | **Time:** 3-10 minutes

## When to Use

- "Review and fix" in one pass
- Iterative page evolution sessions
- When you want the team to both diagnose AND treat

## Execution

### Step 0: VERIFY-PROBE the consumer contract (BEFORE any mutation)

Evolve mutates consumer source (translation JSON, `page.tsx`, component files). Before Step 4 changes anything, assert the consumer-repo contract read-only -- full definition in `ConsumerContract.md`:

| Check | Assertion | If unmet |
|-------|-----------|----------|
| **C1 page source** | the page file to mutate resolves (default `page.tsx`; operator may override the path) | STOP or `--delegate` |
| **C2 copy surface** | translation/locale files exist for copy edits (else copy is inline JSX) | STOP or `--delegate` |
| **C3 verify command** | the verify command exists and runs GREEN on the untouched tree (default `pnpm healthcheck`) | STOP or `--delegate` |
| **C4 revertable tree** | git working tree is clean or operator-acknowledged | STOP or `--delegate` |

The probe is read-only: resolve the paths and run the verify command once to establish a baseline. A baseline that is already RED means later breakage can't be attributed to the council's edits -- STOP and report.

**`--delegate` seam:** if the contract is unmet, or the operator passes `--delegate` (dry-run), do NOT mutate consumer source and do NOT run the verify command. Run the review (Steps 1-3) and emit the unanimous change-set as an applyable bundle (file -> before/after) for the operator or a downstream executor to apply. Evolve degrades to review-only; it never half-mutates a repo whose contract it could not assert.

### Step 1: Run Full Review

Execute the `Review.md` workflow. Collect all 7 expert perspectives.

### Step 2: Extract Unanimous Agreements

From the review output, identify recommendations where **3+ experts independently converge**. These are the safe-to-implement changes -- no risk of optimizing one dimension at the expense of another.

### Step 3: Categorize Changes

Split unanimous recommendations into:

| Category | Example | Tools |
|----------|---------|-------|
| **Copy changes** | Shorten subtitle, rewrite CTA | Edit tool on translation JSON files |
| **Structural changes** | Remove section, reorder sections | Write tool on page.tsx |
| **Component changes** | Remove animation, simplify effect | Edit tool on component files |
| **Visual changes** | Reduce parallax intensity, change grid size | Edit tool on component/CSS files |

### Step 4: Implement

Execute changes in this order (safest to most impactful):
1. Copy changes (translation files only -- zero component risk)
2. Visual simplifications (remove effects, reduce intensity)
3. Structural changes (remove sections, reorder)
4. Component changes (modify behavior)

### Step 5: Verify

```bash
pnpm healthcheck  # lint + format + typecheck
```

### Step 6: Report

```markdown
## Evolution Report

### Review Findings
[Summary of 7 expert perspectives]

### Implemented (unanimous agreements only)
| # | Change | Experts Who Agreed | Files Changed |
|---|--------|-------------------|---------------|

### Deferred (split opinions)
| # | Change | For | Against | Reason Deferred |
|---|--------|-----|---------|-----------------|

### Metrics
| Metric | Before | After | Change |
|--------|--------|-------|--------|

### Verification
- Lint: pass/fail
- Typecheck: pass/fail
- Format: pass/fail
```

## Principles

1. **Only implement unanimous agreements** -- if experts disagree, defer to the human
2. **Copy first, structure last** -- minimize blast radius
3. **Always verify** -- healthcheck after every change
4. **Report what was deferred** -- the human decides split-opinion items
5. **Track metrics** -- line count, translation calls, effect count before/after