---
name: Research
description: 
status: STABLE
---

# Brand Research

Deep multi-agent parallel brand research. 9 agents, 3 providers, 9 distinct research dimensions.

## When to Use

- User says "research brand", "brand deep dive", "extract brand from [URL]", "brand intelligence"
- First step of a full brand pipeline (Research -> Define -> Implement -> Handoff)
- Extracting brand from an existing company for competitive analysis
- Researching brand landscape before defining a new brand

## Steps

### Step 1: Determine Research Mode

**Extraction mode** (user provides a URL or company name):
- Primary focus: reverse-engineering the existing brand
- Research dimensions weighted toward visual extraction, verbal analysis, competitive positioning

**Discovery mode** (user describes a new product/company):
- Primary focus: market landscape, audience, and inspiration
- Research dimensions weighted toward taxonomy, audience psychology, cultural context

Gather from the user:
- **Subject:** company name, URL, or product description
- **Industry/category:** the market space
- **Specific focus areas:** if any (e.g., "focus on typography" or "especially the color system")
- **Competitors:** 2-3 known competitors (or ask agents to identify them)

### Step 2: Launch 9-Agent Parallel Research

Spawn 9 agents, each with a DISTINCT research dimension. No two agents research the same topic. Use 3 different provider types for diverse perspectives.

**Claude agents (3 -- strategic/structural dimensions):**
1. **Brand Taxonomy and Architecture** -- archetype classification (12 archetypes), brand hierarchy, naming architecture, evolution timeline
2. **Typography Science** -- typeface classification, x-height ratios, contrast ratios, optical sizing, variable font axes, rendering across OS
3. **Audience Psychology and Segmentation** -- psychographic profiles, JTBD mapping, emotional triggers, trust signals

**Gemini agents (3 -- creative/visual dimensions):**
4. **Color Psychology and Systems** -- OKLCH color space, psychological associations, cultural color meanings, accessible contrast, dark mode strategy
5. **Motion Identity and Kinetic Language** -- easing curves and personality, scroll-driven patterns, duration scales, reduced-motion strategy
6. **Dev Tool and SaaS Brand Patterns** -- what top brands do differently (Vercel, Linear, Stripe, Raycast), trend freshness assessment

**Perplexity agents (3 -- evidence/verification dimensions):**
7. **Competitive Landscape and Positioning** -- direct/indirect competitors, positioning map, white space opportunities
8. **Anti-Patterns and Brand Failures** -- common mistakes in the industry, specific anti-patterns to avoid, severity ratings
9. **Cultural Context and Semiotics** -- cultural associations, regional considerations, generational preferences, industry visual language

### Step 3: Synthesize Research Findings

After all 9 agents return:
1. **Cross-reference findings** -- where do multiple agents agree? Where do they conflict?
2. **Score confidence** -- high (3+ agents agree), medium (2 agree), low (single source)
3. **Identify surprises** -- findings that contradict initial assumptions
4. **Extract actionable insights** -- what directly informs brand decisions

### Step 4: Produce Brand Research Report

Write a comprehensive report covering all 9 dimensions:
- Executive summary (3-5 sentences: key findings, biggest opportunity, biggest risk)
- Each dimension with findings, confidence level, and evidence
- Cross-agent synthesis: agreements, conflicts, surprises
- Next steps: feed into Define workflow for strategy + tokens

Save to `Docs/brand-research-report.md` in the project.

### Step 5: Handoff

1. Summarize the top 5 actionable findings for the user
2. Recommend next workflow: Define to turn research into strategy + tokens

### Code-First Tool Integration
- **BraveSearch.ts** (`bun ~/.claude/skills/research/Tools/BraveSearch.ts --type web "brand competitor analysis"`) — Privacy-respecting search for competitive intelligence and brand mention discovery.
- **Grok.ts** (`bun ~/.claude/skills/research/Tools/Grok.ts "brand sentiment"`) — X/Twitter + web + news search for real-time brand sentiment and social signals.
- **Scrape.fetch** — Call `Scrape.fetch(url)` from `Packs/scraping/src` for clean markdown extraction from competitor websites. The router escalates through WebFetch → BrightData/Firecrawl based on the anti-bot domain heuristic (RFC-0015 §7.1).

## Validation

- [ ] All 9 research dimensions covered with distinct findings
- [ ] At least 3 provider types used (Claude, Gemini, Perplexity)
- [ ] Cross-agent synthesis identifies agreements and conflicts
- [ ] OKLCH color values provided (not just hex)
- [ ] Typography includes technical specs (not just font names)
- [ ] Motion language includes concrete easing/duration values
- [ ] Anti-patterns are specific to the industry (not generic)