---
name: Trim
description: Runs a density-focused Dream Team review with 4 experts to identify and implement unanimous cuts/shortenings against a page's content and effects, reporting before/after metrics.
status: STABLE
bestPath:
  - title: "Contract Verification"
    description: "VERIFY-PROBE the consumer-repo contract read-only before any cuts."
  - title: "Baseline Measurement"
    description: "Measure JSX lines, translation calls, effect systems, and section counts."
  - title: "Density Expert Review"
    description: "Spawn 4 experts (Conversion, Visual, Copy, Brand) with a density lens."
  - title: "Cut Implementation"
    description: "Remove killed sections/effects, shorten trimmed copy, clean up unused imports."
  - title: "Delta Report"
    description: "Re-measure after state and report the before/after metrics with kill/trim/protect lists."
---

# DreamTeam Trim

**Mode:** Density-focused review + implementation | **Time:** 3-8 minutes

## When to Use

- "There's too much content"
- "The page feels heavy"
- "Too many effects"
- Post-build polish pass
- Pre-launch content diet

## Execution

### Step 0: VERIFY-PROBE the consumer contract (BEFORE any mutation)

Trim mutates consumer source (removes sections/effects from `page.tsx`, shortens copy in locale files, cleans imports). Before Step 4 cuts anything, assert the consumer-repo contract read-only -- full definition in `ConsumerContract.md`:

| Check | Assertion | If unmet |
|-------|-----------|----------|
| **C1 page source** | the page file to trim resolves (default `page.tsx`; operator may override the path) | STOP or `--delegate` |
| **C2 copy surface** | translation/locale files exist for copy cuts (else copy is inline JSX) | STOP or `--delegate` |
| **C3 verify command** | a verify command exists and runs GREEN on the untouched tree (default `pnpm healthcheck`) | STOP or `--delegate` |
| **C4 revertable tree** | git working tree is clean or operator-acknowledged | STOP or `--delegate` |

A baseline that is already RED means later breakage can't be attributed to the trim -- STOP and report.

**`--delegate` seam:** if the contract is unmet, or the operator passes `--delegate` (dry-run), do NOT mutate consumer source and do NOT run the verify command. Run Steps 1-3 (measure + density experts + unanimous cuts) and emit the kill/trim/protect set as an applyable bundle (file -> before/after) for the operator or a downstream executor to apply. Trim degrades to review-only; it never half-cuts a repo whose contract it could not assert.

### Step 1: Measure Current State

Use Bash tool to gather metrics:
```bash
# Page metrics
wc -l page.tsx                    # JSX lines
grep -c "t('" page.tsx            # Translation calls
# Count animation/effect systems used
# Count sections
# Count text elements per section
```

### Step 2: Spawn 4 Density Experts

Use the **Agent tool** to run 4 expert tasks with the density lens:

| Role | Question |
|------|----------|
| Conversion | What sections/content should be CUT to maximize conversion? |
| Visual | What effects are noise? KEEP / CUT / SIMPLIFY each one |
| Copy | What text should be CUT, SHORTENED, or KEPT? Target 40% reading time reduction |
| brand | Maximalist vs minimalist -- which approach for THIS stage? |

Each expert gets the full page context + the measured metrics.

### Step 3: Find Unanimous Cuts

From the 4 responses, extract:
- **Kill list** -- items ALL 4 agree should go
- **Trim list** -- items ALL 4 agree should be shortened
- **Protect list** -- items ALL 4 agree should stay

### Step 4: Implement Cuts

Order:
1. Remove killed sections/components from page.tsx
2. Remove killed effects/imports
3. Shorten trimmed copy in all locale files
4. Clean up unused imports

### Step 5: Measure After State

Same metrics as Step 1. Report the delta:

```markdown
## Trim Report

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| Sections | | | |
| JSX lines | | | |
| Translation calls | | | |
| Animation systems | | | |
| Text elements in heaviest section | | | |

### Killed
[list with rationale]

### Shortened
[list with before/after word counts]

### Protected
[list -- these survive because all experts agreed they're essential]
```

## The Density Test

A well-trimmed page passes this test:
- **No section has more than 8 text elements**
- **No paragraph exceeds 2 sentences**
- **Every animation serves exactly one purpose**
- **One visual signature, not competing focal points**
- **A developer can evaluate the page in under 30 seconds of scanning**