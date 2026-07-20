---
name: DreamTeam
pack-id: durante-dreamteam-v1.0.0
version: 1.0.0
author: durante-tech
description: World-class virtual expert council for landing page and content review — 7 named industry experts channeling real frameworks (CRO, conversion copy, Stripe-caliber design) to evaluate, critique, and evolve user-facing content
type: skill
purpose-type: [review, content-strategy, conversion, ux, design-critique]
platform: claude-code
dependencies: []
keywords: [dream-team, expert-council, content-review, conversion-audit, copy-review, ux-review, visual-review, brand-review, landing-page, section-review, visual-brief, peep-laja, joanna-wiebe, katie-dill]
---

# DreamTeam

> A virtual council of the world's best landing page creators, channeling their real frameworks and methodologies to evaluate and evolve user-facing content.

---

## The Problem

Getting expert feedback on landing pages and user-facing content is expensive and slow. Most teams either skip review entirely or rely on generic "looks good" feedback from teammates. The typical experience:

- **No structured methodology** -- ad-hoc opinions instead of framework-driven analysis
- **Single perspective** -- one reviewer catches one type of issue, misses everything else
- **Abstract advice** -- "make it better" without specific component recommendations or copy changes
- **No implementation path** -- reviews produce critique but not actionable changes with specific UI primitives

The fundamental issue: content review requires multiple specialized lenses applied simultaneously, with concrete recommendations tied to available components.

---

## The Solution

DreamTeam assembles 3-7 named expert personas -- each channeling real industry frameworks -- to evaluate content from conversion, visual design, copy, motion, 3D, brand, and architecture perspectives simultaneously.

**What's included:**

1. **SectionReview** -- Battle-tested section-by-section workflow with 3 core experts (conversion + visual + copy), component inventory, unanimous agreement extraction, and implementation
2. **Review** -- Full 7-expert parallel review with custom lens support (conversion, differentiation, density, coherence, narrative)
3. **QuickReview** -- Fast 3-expert review for quick iterations and pre-launch checks
4. **Evolve** -- Review + implement cycle: expert critique followed by code changes for unanimous recommendations
5. **Trim** -- Content density audit focused on cutting text, reducing sections, and simplifying effects
6. **VisualBrief** -- Experts produce structured visual asset briefs with model recommendations, style direction, and size specs

---

## Installation

This pack is designed for AI-assisted installation. Give this directory to your AI and ask it to install using `INSTALL.md`.

**What is DOS?** See the [DOS Project Overview](https://github.com/durante-tech/dos#what-is-dos).

---

## What's Included

| Component | Path | Purpose |
|-----------|------|---------|
| SKILL.md | `src/SKILL.md` | Skill definition with expert roster, routing, and proven patterns |
| SectionReview | `src/Workflows/SectionReview.md` | Section-by-section 3-expert review (default workflow) |
| Review | `src/Workflows/Review.md` | Full 7-expert parallel review |
| QuickReview | `src/Workflows/QuickReview.md` | Fast 3-expert review |
| Evolve | `src/Workflows/Evolve.md` | Review + implement cycle |
| Trim | `src/Workflows/Trim.md` | Content density audit |
| VisualBrief | `src/Workflows/VisualBrief.md` | Visual asset brief generation |

**Summary:**
- **Directories:** 1 (Workflows)
- **Files:** 7
- **Hooks registered:** 0
- **Dependencies:** None

---

## What Makes This Different

This sounds similar to just asking an AI "review my page" which also produces feedback. What makes this approach different?

DreamTeam uses named expert personas channeling real frameworks -- Peep Laja's CRO methodology, Joanna Wiebe's conversion copywriting, Katie Dill's Stripe-caliber design standards. Each expert evaluates through their specific lens with word-count-enforced responses (100-150 words), preventing rambling. The unanimous agreement principle means only changes where 2+ experts independently converge get implemented, avoiding optimization of one dimension at the expense of another. The component inventory requirement ensures experts recommend specific UI primitives, not abstract advice.

---

## The 7 Experts

| # | Role | Channeling | Lens |
|---|------|-----------|------|
| 1 | Conversion Strategist | Peep Laja (CXL), Oli Gardner (Unbounce) | Attention ratio, directional cues, CRO |
| 2 | Visual Designer | Katie Dill (Stripe), Karri Saarinen (Linear) | Stripe craft standard, precision aesthetic |
| 3 | Copywriter | Joanna Wiebe (Copyhackers), Eddie Shleyner (VeryGoodCopy) | Conversion copy, 4-pillar method |
| 4 | Motion Designer | Felix Peault (Flayks), Jesper Landberg | Animation-heavy sections |
| 5 | 3D/Visual Artist | Bruno Simon (Three.js), Peter Tarka (Apple/Google 3D) | WebGL/R3F elements |
| 6 | Brand Strategist | Emily Heyward (Red Antler), Marty Neumeier (The Brand Gap) | Hero, final CTA, brand identity |
| 7 | Technical Architect | (feasibility lens) | Performance, complex implementations |

---

## Invocation Scenarios

| Trigger | What Happens |
|---------|--------------|
| "Review the hero section" | Runs **SectionReview** (default) with 3 core experts evaluating the specified section, producing component inventory and unanimous recommendations |
| "Full review of the landing page" | Runs **Review** with all 7 experts in parallel, each applying their specialized lens with 100-150 word responses |
| "Quick review before launch" | Runs **QuickReview** with 3 experts for fast iteration feedback and pre-launch checks |
| "Evolve the pricing section" | Runs **Evolve** -- experts critique the section, then unanimous recommendations are implemented as code changes |
| "Trim the landing page copy" | Runs **Trim** -- content density audit focused on cutting text, reducing sections, and simplifying effects |
| "Create visual briefs for the hero" | Runs **VisualBrief** -- experts produce structured asset briefs with model recommendations, style direction, and size specs |

---

## Example Usage

### Section-by-Section Review

```
User: Review the hero section of our landing page.

DOS:  [Runs SectionReview workflow]
      - Inventories current components in the hero section
      - 3 experts evaluate independently:
        Peep Laja (conversion): "Attention ratio is 3:1 — should be 1:1.
          Remove nav links, single CTA..."
        Katie Dill (visual): "Typography hierarchy needs a 1.5x scale bump
          on the headline. Badge feels disconnected..."
        Joanna Wiebe (copy): "Headline is feature-focused. Lead with the
          transformation: 'Ship in days, not months'..."
      - Extracts unanimous agreements (changes 2+ experts converge on)
      - Implements agreed changes with specific component swaps
```

### Full Expert Council Review

```
User: Full review of the landing page with a differentiation lens.

DOS:  [Runs Review workflow with differentiation lens]
      - All 7 experts evaluate in parallel
      - Each produces 100-150 word analysis through their lens
      - Motion and 3D experts activate for animation-heavy sections
      - Brand strategist evaluates hero and final CTA for identity coherence
      - Technical architect flags performance concerns
      - Synthesizes cross-expert patterns and contradictions
```

### Evolve a Section

```
User: Evolve the social proof section.

DOS:  [Runs Evolve workflow]
      - Phase 1: Expert critique of current social proof section
      - Phase 2: Identifies unanimous recommendations
      - Phase 3: Implements code changes for each agreed recommendation
      - Returns diff of changes made with expert rationale
```

---

## Configuration

This pack works out of the box with no configuration required. Expert personas, review frameworks, and word-count constraints are built into the skill definition.

| Setting | Default | Notes |
|---------|---------|-------|
| Expert count | 3 (SectionReview/QuickReview) or 7 (Review) | Workflow selection determines expert count |
| Word limit per expert | 100-150 words | Enforced to prevent rambling and ensure focused critique |
| Unanimous threshold | 2+ experts agree | Only convergent recommendations get implemented |

---

## Customization

### Recommended Customization

- Specify a review lens (conversion, differentiation, density, coherence, narrative) to focus expert attention
- Point to your design system or component library so experts recommend available primitives
- Use SectionReview for iterative work, Review for comprehensive audits

### Optional Customization

| Customization | How | Effect |
|---------------|-----|--------|
| Custom lens | Add lens name to Review invocation | Focuses all experts on a specific evaluation dimension |
| Section targeting | Name specific sections in the prompt | Experts focus on named sections rather than full page |
| Component library | Reference your design system files | Experts recommend components from your actual library |
| Implementation mode | Use Evolve instead of Review | Adds automatic code implementation after expert consensus |

---

## Credits

- **Expert frameworks:** Peep Laja, Oli Gardner, Katie Dill, Karri Saarinen, Joanna Wiebe, Eddie Shleyner, Emily Heyward, Marty Neumeier, and others
- **Original skill work:** Lucas Gertel / DuranteOS

---

## Related Work

- [CXL Institute](https://cxl.com/) -- Peep Laja's conversion optimization methodology
- [Copyhackers](https://copyhackers.com/) -- Joanna Wiebe's conversion copywriting framework
- [Refactoring UI](https://www.refactoringui.com/) -- Practical design methodology for developers

---

## Works Well With

- **CinematicLanding** -- Build the page, then use DreamTeam to review and evolve it
- **Brand** -- Brand definition feeds expert evaluation of identity coherence
- **Media** -- Visual asset creation from VisualBrief outputs
- **DesignSystem** -- Design tokens provide the component vocabulary experts reference
- **Thinking** -- Multi-mode analysis for strategic content decisions before review

---

## Changelog

### 1.0.0 - 2026-04-09
- Initial release as DOS Pack
- 6 workflows: SectionReview, Review, QuickReview, Evolve, Trim, VisualBrief
- Migrated from deprecated dream-team skill, stripped Pi-runtime references
