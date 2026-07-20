---
name: Handoff
description: 
status: STABLE
---

# Brand Handoff to CinematicLanding

Prepare a structured brand package that feeds directly into the cinematic-landing skill's create-prd workflow. Bridges brand identity to page-level design decisions.

## When to Use

- After Define and/or Implement workflows are complete
- User says "prepare for landing page", "brand handoff", "ready for CinematicLanding"
- Before running CinematicLanding's audit or create-prd workflow

## Prerequisites

- Brand definition document (`Docs/brand-definition.md`) with token architecture
- Optionally: brand implementation files (theme.css, stage-colors.ts, motion-tokens.ts)

## Steps

### Step 0: Load SoT

See `~/.claude/DOS/PARTIALS/LoadSoT.md`.

### Step 1: Load Brand Assets

1. Read `Docs/brand-definition.md` for strategy, voice, and tokens
2. Read theme.css for implemented token values (if exists)
3. Read stage-colors.ts for color arc (if exists)
4. Read motion-tokens.ts for motion language (if exists)
5. If implementation files don't exist, derive values directly from brand definition tokens

### Step 2: Prepare Color Arc Table

Maps directly to CinematicLanding create-prd Step 3 (Define Color Arc). Produce a table with columns: Section, Accent (Light), Accent (Dark), Surface, Emotional Tone.

Cover all 9 narrative sections: Hero, Problem, Reveal, Demo, Proof, Depth, Offer, FAQ, CTA.

Provide both CSS variable references (decision-layer tokens) AND raw OKLCH values so CinematicLanding can work with either.

### Step 3: Prepare Typography Scale

Map brand typography tokens to page-level heading hierarchy for CinematicLanding Tier 1 typography scale jumps.

Cover: Hero h1, Section h2, Section h3, Card title, Body, Eyebrow, Code -- with size token, weight, line height, letter spacing, and usage.

Include font families for headings, body, and code.

### Step 4: Prepare Narrative Architecture Template

Map brand personality to CinematicLanding narrative structure. Must answer the 4 key decisions:
1. Single primary conversion action
2. Core tension (the problem)
3. "Aha" moment for pinned scroll
4. Interactive element users can try

Then provide a section blueprint: Hero (full-viewport cinematic), Problem (tension builder), Reveal (scroll-pinned), Demo (hands-on), Proof (evidence surface), Depth (differentiators), Offer (conversion), FAQ (informational), CTA (full-viewport closing).

Each section includes: content direction, visual treatment, and motion tokens to use.

### Step 5: Prepare Motion Language Tokens

Package motion tokens structured by tier matching CinematicLanding's delivery model:
- **Tier 1:** Basic transitions (section entrance, hover)
- **Tier 2:** Scroll-driven (scroll reveal, pinned sections, parallax)
- **Tier 3:** Cinematic (hero entrance, particle fields, typewriter)
- **Reduced motion:** overrides that disable non-essential motion

### Step 6: Compile Handoff Package

Write the complete handoff document to `Docs/brand-handoff-cinematic-landing.md`:
1. Color Arc
2. Typography Scale
3. Narrative Architecture
4. Motion Language
5. Brand Voice Notes for Copy (tone, do/don't, hero hook style, CTA style)
6. Integration Instructions -- how to use each section in CinematicLanding's audit, create-prd, and deliver-tier workflows

### Step 7: Validate Completeness

Check every input CinematicLanding expects is covered:

| CinematicLanding Input | Handoff Section |
|------------------------|-----------------|
| Color arc (create-prd Step 3) | Color Arc |
| Narrative architecture (create-prd Step 2) | Narrative Architecture |
| Typography scale (Tier 1) | Typography Scale |
| Motion specs (Tier 2-3) | Motion Language |
| Reduced motion strategy | Motion Language: reducedMotion |
| Brand personality | Brand Voice Notes |

All sections must be complete before handoff is considered done.

## Validation

- [ ] Color arc table has all 9 narrative sections with accent + emotional tone
- [ ] Color values include both CSS variable references AND raw OKLCH values
- [ ] Typography scale covers hero through caption with concrete rem values
- [ ] Narrative architecture maps brand voice to each section's purpose
- [ ] Motion tokens structured by tier (1/2/3) matching CinematicLanding delivery model
- [ ] Reduced motion strategy included
- [ ] Integration instructions reference specific CinematicLanding workflow steps
- [ ] Handoff document is self-contained