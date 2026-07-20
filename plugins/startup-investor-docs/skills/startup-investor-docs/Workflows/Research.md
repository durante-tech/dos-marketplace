---
name: Research
description: Research market sizing (TAM/SAM/SOM), comparable companies, and competitive landscape for investor materials via parallel subagents.
status: STABLE
bestPath:
  - title: "Scope Definition"
    description: "Extract industry, company stage, geography, and the specific questions investors will ask."
  - title: "Parallel Research"
    description: "Research market sizing, comparable companies, and competitive landscape concurrently via subagents."
  - title: "Package Synthesis"
    description: "Assemble sourced findings into a structured, cited research package."
---

# Market Research for Investor Materials

Market sizing (TAM/SAM/SOM), competitive landscape, comparable company analysis, industry trends.

## When to Use

User says: "research the market for [product]", "find comparable companies", "market sizing for investor deck", "competitive analysis for pitch".

## Workflow

### Step 1: Define Research Scope

Extract from user request:
- **Industry/market** to research
- **Company stage** and size for comparable filtering
- **Geographic focus** if relevant
- **Specific questions** investors will ask

### Step 2: Parallel Market Research

Use Claude Code subagents (Task tool) to research in parallel:

**Agent 1 -- Market Sizing:**
Research TAM/SAM/SOM for the industry/product. Find credible sources (Gartner, IDC, Statista, industry reports). Show methodology (top-down and bottom-up). Include growth rates (CAGR).

**Agent 2 -- Comparable Companies:**
Research 5-10 companies in similar space. Find funding rounds (amounts, investors, valuations), revenue multiples, growth metrics. Include both direct competitors and adjacent market players.

**Agent 3 -- Competitive Landscape:**
Map direct competitors (same solution), indirect competitors (different solution, same problem), potential future competitors (adjacent markets). For each: positioning, strengths, weaknesses, pricing, funding, market share.

### Step 3: Synthesize Research Package

```markdown
## Market Research: [Industry]

### Market Size
| Metric | Value | Source | Year |
|--------|-------|--------|------|
| TAM | $XB | [source] | 2025 |
| SAM | $XB | [source] | 2025 |
| SOM | $XM | [calculation] | Year 1 |
| CAGR | X% | [source] | 2025-2030 |

### Comparable Companies
| Company | Stage | Last Round | Valuation | Revenue | Growth |
|---------|-------|-----------|-----------|---------|--------|

### Competitive Landscape
[Map with positioning]

### Key Trends
- [Trend 1 with evidence]
- [Trend 2 with evidence]

### Sources
- [numbered list]
```

## Validation

- [ ] TAM/SAM/SOM with credible sources
- [ ] 5+ comparable companies identified
- [ ] Competitive landscape mapped
- [ ] All data sourced