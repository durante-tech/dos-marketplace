---
name: Name Product
description: Full naming pipeline with linguistic analysis and availability screening
status: BETA
---

# Name Product

Full naming pipeline for products, features, and companies. Generates candidates, screens availability, and produces a naming rationale document.

## When to Use

- Naming a new product, feature, or company
- Evaluating name candidates against availability and brand fit
- Need systematic naming exploration, not just brainstorming

## Steps

### Step 0: Load SoT

See `~/.claude/DOS/PARTIALS/LoadSoT.md`.

### Step 1: Gather Naming Brief

Collect from user:
- What is being named (company, product, feature, CLI command)
- Brand positioning and values (read from Strategy outputs if available)
- Naming constraints (length, pronunciation, cultural considerations)
- Naming style preference: descriptive (Salesforce), invented (Spotify), metaphorical (Amazon), acronym (IBM)
- Must-avoid list (competitor names, negative associations)

### Step 2: Generate Name Candidates

Generate 50-100 candidates across naming strategies:
- **Descriptive**: What it does (e.g., Dropbox, Cloudflare)
- **Invented**: Novel words (e.g., Vercel, Supabase)
- **Metaphorical**: Conceptual reference (e.g., Slack, Linear)
- **Compound**: Combined words (e.g., GitHub, YouTube)
- **Truncation**: Shortened forms (e.g., Figma from "figure" + "magnet")

### Step 3: Screen Availability

For each shortlisted candidate (top 10-15), check:
- [ ] Domain availability (.com, .io, .dev, .app)
- [ ] npm package name availability
- [ ] GitHub organization/repo availability
- [ ] Social media handle availability (Twitter/X, LinkedIn)
- [ ] Preliminary trademark search (TESS/USPTO)
- [ ] Linguistic screening (negative meanings in major languages)

### Step 4: Evaluate and Rank

Score each candidate against:
- Brand fit (alignment with positioning and personality)
- Memorability (distinctive, easy to recall)
- Pronounceability (no ambiguity in verbal communication)
- Availability (domain, npm, trademark clear)
- Extensibility (can it grow with the product line?)

### Step 5: Produce Naming Document

Output:
- Top 3 recommendations with rationale
- Full candidate list with screening results
- Naming principles derived from the process (for future naming decisions)
- Availability matrix (visual summary of what's clear)
