---
name: CinematicLanding
pack-id: durante-cinematiclanding-v1.0.0
version: 1.0.0
author: durante-tech
description: Build cinematic, Awwwards-level landing pages through a tiered delivery pipeline — audit, PRD, and 3-tier implementation with concrete component patterns, scroll-driven storytelling, and performance budgets
type: skill
purpose-type: [delivery, landing-page, design, animation, narrative-ux]
platform: claude-code
dependencies: []
keywords: [landing-page, cinematic, scroll-animation, gsap, webgl, motion, narrative-ux, awwwards, sound-design, tiered-delivery, prd, audit, scroll-storytelling]
---

# CinematicLanding

> Build Awwwards-level landing pages through structured tiers, not vague delegation. Every workflow produces concrete components with verified quality.

---

## The Problem

Building a truly cinematic landing page is one of the hardest front-end challenges. Most attempts produce either a generic template or an over-engineered mess. The typical experience:

- **No structured pipeline** -- jumping straight to code without auditing what exists or planning tiers
- **Vague delegation** -- "make it look like Stripe" without concrete component patterns or scroll specs
- **No narrative architecture** -- sections are random blocks instead of a story (tension, reveal, proof, invitation)
- **No tiered delivery** -- everything attempted at once, nothing finished properly
- **No verification** -- shipping without performance budgets, accessibility checks, or reduced-motion fallbacks

The fundamental issue: cinematic pages require a structured pipeline from audit to PRD to tiered delivery, with concrete patterns at every step.

---

## The Solution

CinematicLanding provides a complete pipeline for building award-level landing pages through 4 workflows that produce concrete, verified deliverables.

**What's included:**

1. **Audit** -- Deep 10-dimension scoring (visual hierarchy, color harmony, whitespace, imagery, flow, animation, motion, interactivity, narrative UX, award readiness) with structured scorecard
2. **CreatePrd** -- Tiered implementation PRD from audit findings covering narrative architecture, color arc, component evolution, scroll motion, performance budgets, and reduced-motion strategy
3. **DeliverTier** -- Execute a specific tier (1/2/3) with concrete component patterns, code recipes, and verification criteria
4. **FixOverlap** -- Debug and fix visual overlap between GSAP-pinned sections and adjacent content

---

## Installation

This pack is designed for AI-assisted installation. Give this directory to your AI and ask it to install using `INSTALL.md`.

**What is DOS?** See the [DOS Project Overview](https://github.com/durante-tech/dos#what-is-dos).

---

## What's Included

| Component | Path | Purpose |
|-----------|------|---------|
| SKILL.md | `src/SKILL.md` | Skill definition with routing, component library, narrative architecture |
| Audit | `src/Workflows/Audit.md` | 10-dimension landing page audit |
| CreatePrd | `src/Workflows/CreatePrd.md` | Tiered PRD generation |
| DeliverTier | `src/Workflows/DeliverTier.md` | Tier execution with code recipes |
| FixOverlap | `src/Workflows/FixOverlap.md` | Z-index and overlap debugging |

**Summary:**
- **Directories:** 1 (Workflows)
- **Files:** 5
- **Hooks registered:** 0
- **Dependencies:** None

---

## What Makes This Different

This sounds similar to just asking an AI "build me a landing page" which also produces code. What makes this approach different?

CinematicLanding provides concrete component patterns (ParticleField, CinematicSection, PinnedStory, ScrollProgress) with actual code recipes, not abstract guidelines. The tiered delivery system (Tier 1: quick wins, Tier 2: scroll-driven storytelling, Tier 3: WebGL/sound/micro-animations) ensures incremental quality with verification at each step. Narrative architecture templates map story arcs to section order with per-section color progression. Performance budgets (LCP < 2.5s, bundle < 300KB gzipped) and mandatory reduced-motion fallbacks prevent the "looks amazing but unusable" trap.

---

## The 3 Tiers

| Tier | Focus | Sessions | Key Deliverables |
|------|-------|----------|-----------------|
| 1 | Quick Wins | 1-2 | Smooth scroll (Lenis), typography scale, parallax fix, section spacing |
| 2 | Scroll-Driven Storytelling | 3-5 | GSAP pinned sections, interactive demos, section art, color arc |
| 3 | Aspirational | 5-8 | Canvas particles, cinematic transitions, ambient sound, micro-animations |

---

## Invocation Scenarios

| Trigger | What Happens |
|---------|--------------|
| "Audit the landing page" | Runs **Audit** workflow, scoring across 10 dimensions with a structured scorecard and prioritized recommendations |
| "Create a PRD for the landing page" | Runs **CreatePrd** workflow, producing a tiered implementation PRD from audit findings with narrative architecture and performance budgets |
| "Deliver Tier 1" | Runs **DeliverTier** for Tier 1 -- implements quick wins: smooth scroll, typography scale, parallax fix, section spacing with verification |
| "Deliver Tier 2" | Runs **DeliverTier** for Tier 2 -- implements scroll-driven storytelling: GSAP pinned sections, interactive demos, color arc with verification |
| "Deliver Tier 3" | Runs **DeliverTier** for Tier 3 -- implements aspirational features: canvas particles, cinematic transitions, ambient sound, micro-animations |
| "Fix the overlap between hero and features" | Runs **FixOverlap** workflow, debugging and fixing z-index and visual overlap between GSAP-pinned sections and adjacent content |

---

## Example Usage

### Audit an Existing Landing Page

```
User: Audit our landing page at src/app/page.tsx

DOS:  [Runs Audit workflow]
      - Reads all landing page components and styles
      - Scores across 10 dimensions (1-10 each):
        Visual Hierarchy: 6/10 — headline doesn't dominate
        Color Harmony: 7/10 — palette is cohesive but no arc
        Animation: 4/10 — no scroll-driven motion
        Narrative UX: 5/10 — sections feel disconnected
        Award Readiness: 4/10 — missing signature moments
      - Produces prioritized fix list organized by tier
```

### Create a Tiered PRD

```
User: Create a PRD from the audit results.

DOS:  [Runs CreatePrd workflow]
      - Generates narrative architecture: tension → reveal → proof → invitation
      - Maps color arc across sections (dark → accent → light → dark)
      - Defines Tier 1/2/3 deliverables with component patterns
      - Sets performance budgets: LCP < 2.5s, bundle < 300KB gzipped
      - Includes reduced-motion fallback strategy for every animation
```

### Deliver a Tier

```
User: Deliver Tier 2 for the landing page.

DOS:  [Runs DeliverTier workflow for Tier 2]
      - Implements GSAP pinned sections with ScrollTrigger
      - Adds interactive demo components with scroll-driven reveals
      - Applies per-section color progression from the PRD
      - Verifies: smooth 60fps scroll, no layout shifts,
        reduced-motion fallbacks functional
      - Returns verification checklist with pass/fail per criterion
```

---

## Configuration

This pack works out of the box with no configuration required. Component patterns, performance budgets, and tier definitions are built into the skill definition.

| Setting | Default | Notes |
|---------|---------|-------|
| Target tier | Specified per invocation | Tier 1, 2, or 3 -- determines scope and complexity |
| Performance budget | LCP < 2.5s, bundle < 300KB | Built-in thresholds for verification |
| Animation library | GSAP + ScrollTrigger | Component patterns assume GSAP; adaptable to other libraries |
| Scroll library | Lenis | Tier 1 quick win; can be swapped |

---

## Customization

### Recommended Customization

- Run Audit before CreatePrd to establish baseline scores and prioritize work
- Deliver tiers in order (1 then 2 then 3) -- each tier builds on the previous
- Provide your design system or component library so tier deliverables use your existing primitives

### Optional Customization

| Customization | How | Effect |
|---------------|-----|--------|
| Narrative template | Describe your story arc in the prompt | Overrides default tension-reveal-proof-invitation structure |
| Color arc | Specify section color progression | Overrides default dark-accent-light-dark palette arc |
| Animation library | Mention Framer Motion, Motion One, etc. | Code recipes adapt to your preferred animation library |
| Performance targets | Specify stricter/looser budgets | Adjusts verification thresholds for LCP, bundle size, CLS |
| Component patterns | Reference your own components | DeliverTier uses your components instead of built-in patterns |

---

## Credits

- **Component patterns:** Battle-tested across real Awwwards-level builds
- **Original skill work:** Lucas Gertel / DuranteOS

---

## Related Work

- [Awwwards](https://www.awwwards.com/) -- Award-winning web design showcase and standards
- [GSAP ScrollTrigger](https://greensock.com/scrolltrigger/) -- The animation engine behind most cinematic scroll effects
- [Lenis](https://lenis.darkroom.engineering/) -- Smooth scroll library used in Tier 1

---

## Works Well With

- **DreamTeam** -- Expert council review after each tier delivery to evaluate and evolve
- **Brand** -- Brand tokens feed color arc, typography scale, and component styling
- **DesignSystem** -- Design system provides the primitive vocabulary for tier deliverables
- **Media** -- Visual asset creation for section art, hero imagery, and background elements
- **Thinking** -- Strategic analysis for narrative architecture decisions

---

## Changelog

### 1.0.0 - 2026-04-09
- Initial release as DOS Pack
- 4 workflows: Audit, CreatePrd, DeliverTier, FixOverlap
- Migrated from deprecated cinematic-landing skill, stripped Pi-runtime references
