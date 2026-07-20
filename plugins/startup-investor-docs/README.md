---
name: StartupInvestorDocs
pack-id: durante-startupinvestordocs-v1.0.0
version: 1.0.0
author: durante-tech
description: Generate, scan, and enhance investor documentation for startups at any funding stage -- pitch decks, executive summaries, financial projections, market analysis, competitive landscape, and team narratives
type: skill
purpose-type: [investor, startup, funding, documentation, pitch]
platform: claude-code
dependencies: []
keywords: [investor, startup, funding, pitch-deck, executive-summary, financial-model, market-analysis, competitive-analysis, cap-table, due-diligence, fundraise, pre-seed, seed, series-a]
---

# StartupInvestorDocs

> Complete investor documentation suite for startups at any funding stage -- from pre-seed through Series B+.

---

## The Problem

Preparing investor materials is one of the highest-stakes documentation tasks a startup founder faces. Most founders either wing it or copy generic templates that could describe any company. The typical experience:

- **No stage calibration** -- using the same pitch deck format for pre-seed as Series A, despite dramatically different investor expectations
- **Missing critical documents** -- not knowing which documents are required vs optional at each funding stage
- **Weak data presentation** -- vague claims ("large market") instead of investor-grade specifics ("$47B market growing 23% CAGR")
- **No readiness assessment** -- going into investor meetings without knowing where the materials are weakest
- **Generic narratives** -- feature dumps instead of problem-solution-traction-vision arcs that VCs respond to

The fundamental issue: investor documentation requires stage-specific calibration and systematic gap analysis, not generic business writing.

---

## The Solution

The startup-investor-docs pack provides a complete system for generating, evaluating, and enhancing investor materials calibrated to funding stage.

**What's included:**

1. **Generate** -- Complete documentation suite with parallel specialist agents for each document type
2. **Scan** -- Score existing materials against stage-specific benchmarks across 8 investor dimensions
3. **Gap Analysis** -- Identify missing documents and weak areas with prioritized fix recommendations
4. **Research** -- Market sizing (TAM/SAM/SOM), competitive landscape, and comparable company analysis
5. **Enhance** -- Strengthen storytelling, data presentation, competitive positioning, and financial rigor
6. **Single Doc** -- Generate individual documents (pitch deck, exec summary, financials, etc.)

---

## Installation

This pack is designed for AI-assisted installation. Give this directory to your AI and ask it to install using `INSTALL.md`.

**What is DOS?** See the [DOS Project Overview](https://github.com/durante-tech/dos#what-is-dos).

---

## What's Included

| Component | Path | Purpose |
|-----------|------|---------|
| Skill Definition | `src/SKILL.md` | Routing, reference tables, investor expectations |
| Generate | `src/Workflows/Generate.md` | Complete documentation suite |
| Scan | `src/Workflows/Scan.md` | Investor readiness assessment |
| Gap Analysis | `src/Workflows/GapAnalysis.md` | Documentation gap identification |
| research | `src/Workflows/Research.md` | Market and competitive research |
| Enhance | `src/Workflows/Enhance.md` | Document improvement and polishing |
| Single Doc | `src/Workflows/SingleDoc.md` | Individual document generation |

**Summary:**
- **Directories:** 2 (src, Workflows)
- **Files:** 8
- **Hooks registered:** 0
- **Dependencies:** None

---

## What Makes This Different

This sounds similar to asking an AI "write me a pitch deck" which also produces investor content. What makes this approach different?

This is not generic business writing. Every recommendation is calibrated to what investors at each specific funding stage actually evaluate. The skill includes stage-specific benchmarks (what scores are acceptable at pre-seed vs Series A), the 12-slide pitch structure with fatal mistakes per slide, common investor objections with preemptive framing, and key metrics ranges by stage. The scan workflow scores materials across 8 dimensions with minimum thresholds that change by funding round.

---

## Invocation Scenarios

| Trigger | What Happens |
|---------|--------------|
| "Generate investor docs for my Series A" | Runs **Generate** workflow with stage set to Series A, producing full documentation suite with parallel specialist agents |
| "Scan my pitch deck" | Runs **Scan** workflow, scoring existing materials against stage-specific benchmarks across 8 investor dimensions |
| "What's missing from my investor materials?" | Runs **GapAnalysis** workflow, identifying missing documents and weak areas with prioritized fix recommendations |
| "Research the market size for my startup" | Runs **Research** workflow, producing TAM/SAM/SOM analysis, competitive landscape, and comparable company data |
| "Make my executive summary stronger" | Runs **Enhance** workflow on the specified document, strengthening storytelling, data, and positioning |
| "Generate just a pitch deck outline" | Runs **SingleDoc** workflow for the specified document type at the given funding stage |

---

## Example Usage

### Generate a Full Documentation Suite

```
User: Generate investor docs for my pre-seed startup. We're building an AI-powered
      compliance tool for fintech startups.

DOS:  [Runs Generate workflow]
      - Calibrates all documents to pre-seed expectations
      - Produces: pitch deck outline, executive summary, market analysis,
        competitive landscape, team narrative, financial projections
      - Each document uses pre-seed benchmarks (vision-heavy, team-focused,
        early traction signals)
```

### Scan Existing Materials

```
User: Scan my pitch deck and exec summary — we're raising a Seed round.

DOS:  [Runs Scan workflow]
      - Scores across 8 dimensions: narrative clarity, market sizing,
        competitive positioning, financial rigor, team credibility,
        traction evidence, ask clarity, visual presentation
      - Returns scorecard with Seed-stage minimum thresholds
      - Flags dimensions below threshold with specific fix guidance
```

### Research Market Sizing

```
User: Research the TAM/SAM/SOM for AI compliance in fintech.

DOS:  [Runs Research workflow]
      - Produces top-down and bottom-up TAM/SAM/SOM estimates
      - Maps competitive landscape with positioning matrix
      - Identifies comparable companies and their funding history
      - Outputs investor-grade data points with sources
```

---

## Configuration

This pack works out of the box with no configuration required. All stage-specific benchmarks, investor expectations, and scoring thresholds are built into the skill definition.

| Setting | Default | Notes |
|---------|---------|-------|
| Funding stage | Detected from context | Can be explicitly set: pre-seed, seed, Series A, Series B+ |
| Document output location | Current working directory | Documents are written to your project |
| Research depth | Standard | Research workflow uses available web search tools if connected |

---

## Customization

### Recommended Customization

- Provide your startup's context (industry, stage, metrics, team) in the initial prompt for best calibration
- Specify your target funding stage explicitly to ensure correct benchmark thresholds
- Point to existing documents when running Scan or Enhance so they can be evaluated

### Optional Customization

| Customization | How | Effect |
|---------------|-----|--------|
| Industry-specific metrics | Mention your vertical in the prompt | Tailors key metrics and comparable companies to your sector |
| Investor audience | Specify VC vs angel vs strategic | Adjusts tone, depth, and emphasis of generated documents |
| Document subset | Request specific docs via SingleDoc | Generates only the documents you need instead of the full suite |
| Existing materials | Provide file paths to current docs | Enables Scan, GapAnalysis, and Enhance to work with your actual content |

---

## Credits

- **Investor documentation methodology:** Lucas Gertel / DuranteOS
- **Stage-specific benchmarks:** Compiled from VC partner feedback and funded startup patterns

---

## Related Work

- [YC Application Guide](https://www.ycombinator.com/library) -- Y Combinator's library on fundraising
- [Sequoia Pitch Deck Template](https://articles.sequoiacap.com/writing-a-business-plan) -- The classic VC-endorsed structure
- Fundraising guides from First Round Review, a16z, and NFX

---

## Works Well With

- **Research** -- Deep market research to feed into investor documents
- **Brand** -- Brand positioning that aligns investor narrative with go-to-market messaging
- **DreamTeam** -- Expert council review of pitch deck content and landing pages
- **Sales** -- Pipeline and revenue narrative for traction-stage decks
- **Telos** -- Project analysis for aligning investor story with strategic goals

---

## Changelog

### 1.0.0 - 2026-04-09
- Initial release
- 6 workflows: Generate, Scan, GapAnalysis, Research, Enhance, SingleDoc
- Stage-specific calibration for pre-seed through Series B+
- 12-slide pitch structure, investor objection matrix, key metrics by stage
