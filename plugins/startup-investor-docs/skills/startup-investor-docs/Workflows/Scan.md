---
name: Scan
description: Score existing investor materials against stage-specific benchmarks across 8 dimensions and produce a readiness report.
status: STABLE
bestPath:
  - title: "Materials Intake"
    description: "Read all available investor documents provided by the user."
  - title: "Expert Review"
    description: "Score each of the 8 dimensions 1-10 with what's good, what's missing, and what to fix first."
  - title: "Benchmark Comparison"
    description: "Compare scores against stage-specific minimum thresholds to flag deal-breakers."
  - title: "Readiness Report"
    description: "Produce the overall score, readiness verdict, critical gaps, and quick wins."
---

# Scan for Investor Readiness

Review all existing materials. Score against funding stage requirements. Identify strengths and critical gaps.

## When to Use

User says: "review my investor docs", "are my materials ready for fundraising", "scan my pitch deck".

## Workflow

### Step 1: Read Existing Materials

Read all available investor documents provided by the user (pitch deck, exec summary, financials, etc.).

### Step 2: Expert Review

Score the materials against stage-appropriate standards across 8 dimensions (1-10 each):

1. **Story clarity** -- Problem/solution narrative
2. **Market opportunity** -- TAM/SAM/SOM backed by data
3. **Product evidence** -- Demo, screenshots, metrics
4. **Traction proof** -- Revenue, users, growth rate
5. **Team credibility** -- Relevant experience, completeness
6. **Financial projections** -- Realistic, detailed
7. **Competitive analysis** -- Honest, differentiated
8. **Ask clarity** -- Amount, use of funds, milestones

For each: provide score, what's good, what's missing, what to fix first.

### Step 3: Stage-Specific Scoring Benchmarks

Apply these minimum score thresholds based on funding stage:

| Dimension | Pre-Seed | Seed | Series A | Series B+ |
|-----------|:--------:|:----:|:--------:|:---------:|
| Story clarity | 6+ | 7+ | 8+ | 8+ |
| Market opportunity | 5+ | 7+ | 8+ | 9+ |
| Product evidence | 4+ (prototype OK) | 6+ (working product) | 8+ (usage data) | 9+ (scale metrics) |
| Traction proof | 3+ (idea-stage OK) | 6+ (early metrics) | 8+ (growth trends) | 9+ (unit economics) |
| Team credibility | 7+ | 7+ | 8+ | 8+ |
| Financial projections | 4+ (rough OK) | 7+ (real model) | 8+ (detailed) | 9+ (auditable) |
| Competitive analysis | 5+ | 6+ | 8+ | 8+ |
| Ask clarity | 6+ | 7+ | 8+ | 9+ |

**Scoring guidance:**
- **Below benchmark:** Flag as P0 (deal-breaker) -- must fix before investor meetings
- **At benchmark:** Acceptable -- focus on other areas first
- **Above benchmark:** Strength -- emphasize this in the narrative

### Step 4: Readiness Report

Produce a structured report:

```markdown
## Investor Readiness Report

### Overall Score: [X/80] ([X/10] average)
### Readiness: [Ready / Almost Ready / Needs Work / Not Ready]

| Dimension | Score | Status | Priority Fix |
|-----------|-------|--------|-------------|
| Story Clarity | X/10 | ... | ... |

### Critical Gaps
1. [Most important thing missing]

### Quick Wins
1. [Easy improvements with high impact]
```

## Validation

- [ ] All materials reviewed
- [ ] Scored against stage requirements
- [ ] Gaps identified with priority