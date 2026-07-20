---
name: Gap Analysis
description: Audit existing investor docs against stage-specific document checklists and score quality to produce a prioritized gap report.
status: STABLE
bestPath:
  - title: "Context Gathering"
    description: "Confirm funding stage, existing materials, timeline, and prior investor feedback."
  - title: "Checklist Application"
    description: "Apply the stage-specific required-document checklist (pre-seed through Series A+)."
  - title: "Quality Scoring"
    description: "Score each existing document across 8 dimensions, or 0 for missing documents."
  - title: "Gap Prioritization"
    description: "Bucket gaps into P0 deal-breaker, P1 competitive-disadvantage, and P2 nice-to-have tiers."
  - title: "Report Delivery"
    description: "Write the gap analysis report with a recommended action plan to docs/investor/gap-analysis.md."
---

# Gap Analysis -- Stage-Specific Documentation Audit

## When to Use

- User says "what am I missing for investors", "gap analysis on my docs", "am I ready to raise"
- Before generating new documents -- identifies what exists and what's missing
- After generating documents -- validates completeness against stage requirements

## Workflow

### Step 1: Gather Context

Confirm with user:
- **Funding stage:** Pre-seed / Seed / Series A / Series B+
- **Existing materials:** What documents already exist?
- **Timeline:** When are they raising?
- **Prior investor feedback:** Any specific objections or requests from VCs?

Read all existing materials.

### Step 2: Apply Stage-Specific Document Checklist

Each stage has different documentation requirements:

**Pre-Seed (raising $50K-$500K):**
| Document | Required | Notes |
|----------|----------|-------|
| Pitch Deck (8-10 slides) | Required | Problem, solution, market, team, ask |
| Executive Summary (1 page) | Required | Elevator pitch + key metrics |
| Team Overview | Required | Founder backgrounds, relevant experience |
| Market Analysis (basic) | Recommended | TAM estimate, target customer |
| Business Plan | Optional | Most angels don't read these |
| Financial Model | Optional | Simple revenue projection is enough |

**Seed (raising $500K-$5M):**
| Document | Required | Notes |
|----------|----------|-------|
| Pitch Deck (10-12 slides) | Required | Must include traction slide with real numbers |
| Executive Summary (2 pages) | Required | Must reference comparable companies |
| Financial Model (3-year) | Required | Revenue model, unit economics, burn rate |
| Market Analysis (TAM/SAM/SOM) | Required | Sourced from credible data |
| Competitive Analysis | Required | Differentiation matrix |
| Team Overview | Required | Key hires plan, advisory board |
| Cap Table | Required | Current ownership, option pool |

**Series A (raising $5M-$25M):**
| Document | Required | Notes |
|----------|----------|-------|
| Pitch Deck (12-15 slides) | Required | Deep product + traction sections |
| Executive Summary (2-3 pages) | Required | Investor memo format |
| Financial Model (5-year) | Required | Detailed unit economics, cohort analysis |
| Market Analysis (comprehensive) | Required | Bottom-up and top-down TAM |
| Competitive Analysis (deep) | Required | Feature comparison + moat analysis |
| Team Overview + Org Chart | Required | Full leadership team, hiring plan |
| Cap Table + Funding History | Required | All prior rounds, investor rights |
| Business Plan (detailed) | Required | Go-to-market strategy, expansion plan |
| Due Diligence Package | Recommended | Legal, IP, customer references |

### Step 3: Score Documentation Quality

For each existing document, score against 8 dimensions (1-10):

1. Story clarity: Is the problem-solution narrative compelling and specific?
2. Market opportunity: Is TAM/SAM/SOM backed by credible, cited data?
3. Product evidence: Are there demos, screenshots, or usage metrics?
4. Traction proof: Are there revenue, user, or growth numbers with trends?
5. Team credibility: Does founder experience map to the problem space?
6. Financial rigor: Are projections realistic with clear assumptions?
7. Competitive honesty: Is differentiation specific and defensible?
8. Ask clarity: Are amount, use of funds, and milestones concrete?

For missing documents, score 0 and explain what's needed.

### Step 4: Prioritize Gaps

Categorize findings into three priority tiers:

**P0: Deal-Breakers** (fix before any investor meeting)
- Gaps that would cause an immediate "no" from investors

**P1: Competitive Disadvantage** (fix before term sheet)
- Gaps that weaken your position vs other startups raising at the same stage

**P2: Nice-to-Have** (polish after securing interest)
- Gaps that improve professionalism but won't change the investment decision

### Step 5: Deliver Gap Analysis Report

```markdown
# Investor Documentation Gap Analysis: [Company]

## Stage: [Pre-seed / Seed / Series A / Series B+]
## Overall Readiness: [X/80] ([X/10] average)
## Verdict: [Ready / Almost Ready / Needs Work / Not Ready]

## Document Inventory
| Document | Status | Quality Score | Priority |
|----------|--------|--------------|----------|
| Pitch Deck | Exists / Missing | X/10 | P0/P1/P2 |

## Dimension Scores
| Dimension | Score | Stage Benchmark | Gap |
|-----------|-------|----------------|-----|
| Story clarity | X/10 | [benchmark]/10 | ... |

## Priority Gaps
### P0: Deal-Breakers
[list with specific fix recommendations]

### P1: Competitive Disadvantage
[list with specific fix recommendations]

### P2: Nice-to-Have
[list]

## Recommended Action Plan
1. [First thing to fix] -- run Enhance workflow on [document]
2. [Second thing] -- run SingleDoc workflow to create [missing document]
3. [Third thing] -- run Research workflow for [missing data]
```

Write report to `docs/investor/gap-analysis.md`.