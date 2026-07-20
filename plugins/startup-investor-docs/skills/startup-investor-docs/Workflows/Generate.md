---
name: Generate
description: Generate a complete stage-calibrated investor documentation suite via parallel specialist subagents, tracked as a DOS PRD.
status: STABLE
bestPath:
  - title: "Company Context Gathering"
    description: "Confirm stage, product, market, traction, team, and funding target."
  - title: "Document Selection"
    description: "Select the stage-appropriate document set and depth (pre-seed through Series B+)."
  - title: "Parallel Generation"
    description: "Generate the pitch deck outline, executive summary, market research, and team narrative via parallel subagents."
  - title: "Output Writing"
    description: "Write each document to the PRD work directory and check off completed ISC criteria."
  - title: "Consistency Review"
    description: "Cross-check numbers and narrative alignment across all generated documents."
---

# Generate Complete Suite

Generate a complete investor documentation package with parallel specialist agents, integrated with DOS Algorithm PRD system.

## DOS Integration

**This workflow produces a DOS-standard PRD.** The investor document suite is tracked as ISC criteria within `MEMORY/WORK/{slug}/PRD.md`. Supporting documents are saved alongside the PRD in the work directory.

**V13.3c PRD-scaffolding routing (RFC-0083 §5.5 split, Sprout pattern):** For vNext-format PRDs (`format_version: 3`) in standalone mode, invoke `Skill("prd", "scaffold")` instead of the legacy `mkdir + Write` sequence below. The Skill produces the vNext frontmatter + skeleton (slug derived from task); the workflow then adds investor-doc-specific ISC criteria + supporting docs alongside the PRD. The legacy `mkdir/Write` prose remains as fallback until v0.0.14 V14.6 retires it after a 30-day Sprout adoption soak.

**If the Algorithm is already running:** Edit the existing PRD to add investor documentation context and ISC criteria.

**If invoked standalone:** Create a new PRD stub:
1. `mkdir -p MEMORY/WORK/{slug}/` (slug: `YYYYMMDD-HHMMSS_investor-docs-company`)
2. Write `MEMORY/WORK/{slug}/PRD.md` with frontmatter per `~/.claude/DOS/PRDFORMAT.md`

## When to Use

User says: "generate investor docs for [company]", "create pitch deck and financials", "complete investor package".

## Workflow

### Step 0: Load SoT

See `~/.claude/DOS/PARTIALS/LoadSoT.md`.

### Step 1: Gather Company Context

Confirm with user:
- **Stage:** Pre-seed / Seed / Series A / Series B+
- **Product:** What it does, key metrics
- **Market:** Industry, target customer
- **Traction:** Revenue, users, growth rate
- **Team:** Founders, key hires
- **Funding target:** Amount and use of funds
- **Timeline:** When raising, existing commitments

### Step 2: Stage-Specific Document Selection

Not every stage needs every document. Select the appropriate set:

| Document | Pre-Seed | Seed | Series A | Series B+ |
|----------|:--------:|:----:|:--------:|:---------:|
| Pitch Deck | 8-10 slides | 10-12 slides | 12-15 slides | 15-20 slides |
| Executive Summary | 1 page | 2 pages | 2-3 pages (memo format) | 3-5 pages |
| Market Analysis | Basic TAM | TAM/SAM/SOM sourced | Bottom-up + top-down | Detailed with cohort data |
| Financial Model | -- | 3-year projection | 5-year with unit economics | Detailed with scenario analysis |
| Competitive Analysis | -- | Differentiation matrix | Feature + moat analysis | Full landscape + threats |
| Team Overview | Founder bios | + Key hires plan | + Org chart + advisory | + Board composition |
| Cap Table | -- | Current ownership | + Funding history + ESOP | + Waterfall analysis |
| Due Diligence Package | -- | -- | Recommended | Required |

**Depth calibration:**
- **Pre-seed:** Investors bet on founders and vision. Keep docs concise -- 1 strong pitch deck + 1-page summary is often enough.
- **Seed:** Investors want early signal. Need real metrics (even small), credible market sizing, and a clear financial model.
- **Series A:** Investors want proof of repeatability. Need detailed unit economics, cohort analysis, and comprehensive competitive moat argument.
- **Series B+:** Investors want a machine. Need growth efficiency metrics, market expansion plan, and board-level governance docs.

### Step 3: Parallel Document Generation

Use Claude Code subagents (Task tool) to generate documents in parallel:

**Agent 1 -- Pitch Deck Outline:**
Create a pitch deck outline for the company. Structure: Problem (1 slide), Solution (1-2), Market Size TAM/SAM/SOM (1), Product (2-3 with screenshot placeholders), Traction (1), Business Model (1), Competition (1), Team (1), Financials (1), Ask (1). For each slide: title, key message, supporting data points, visual suggestion.

**Agent 2 -- Executive Summary:**
Create an executive summary (2-page investor memo). Sections: Overview (elevator pitch), Problem and Opportunity, Solution and Product, Market Size, Business Model, Traction and Metrics, Competitive Advantage, Team, Financial Projections (high-level), The Ask. Write in investor-grade prose.

**Agent 3 -- Market Research:**
Research market data for the company's investor materials. Find: TAM/SAM/SOM estimates with credible sources, industry growth rate, comparable company valuations and funding rounds, relevant market trends. Return structured data with citations.

**Agent 4 -- Team and Narrative:**
Create a team overview and company narrative. Write: founder bios (professional, highlighting relevant experience), team composition summary, key advisors/board, hiring plan. Also write the company origin story in a compelling narrative format (why this team, why now).

### Step 4: Write Output Files

Write each document to the DOS PRD work directory:
- `MEMORY/WORK/{slug}/pitch-deck-outline.md`
- `MEMORY/WORK/{slug}/executive-summary.md`
- `MEMORY/WORK/{slug}/market-research.md`
- `MEMORY/WORK/{slug}/team-narrative.md`

**Never write to `docs/investor/`.** The DOS PRD work directory is the single source of truth. If the user needs docs copied to a project directory, do so as a final step after verification.

Update the PRD: check off completed ISC criteria as each document is generated, update `progress: M/N`.

### Step 5: Consistency Review

Cross-check all documents for:
- Consistent numbers across all materials
- Aligned narrative and messaging
- Appropriate detail level for funding stage

## Validation

- [ ] PRD exists at `MEMORY/WORK/{slug}/PRD.md`
- [ ] All core investor documents generated in work directory
- [ ] Market data backed with sources
- [ ] Consistent story across documents
- [ ] Appropriate for funding stage
- [ ] ISC criteria checked off in PRD