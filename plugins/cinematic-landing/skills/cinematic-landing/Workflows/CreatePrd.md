---
name: Create Prd
description: Generate a complete, implementation-ready landing page PRD with 3 delivery tiers, narrative architecture, color arc, and DOS Algorithm integration.
status: STABLE
bestPath:
  - title: "Context & Brand Alignment"
    description: "Load the audit scorecard, page source, tech stack, and brand tokens."
  - title: "Narrative & Visual Design"
    description: "Define narrative architecture, color arc, component evolution, and theme mode strategy."
  - title: "Tier Specification"
    description: "Detail Tier 1/2/3 deliverables, performance budgets, and reduced-motion strategy."
  - title: "PRD Authoring"
    description: "Write ISC criteria into the DOS PRD and gate on a computed COMPLETE verdict."
---

# Create Landing Page PRD

Generate a complete, implementation-ready PRD with 3 delivery tiers, integrated with the DOS Algorithm PRD system.

## When to Use

- After `Audit` workflow produces a scorecard
- User says "plan the redesign", "create LP PRD"
- Starting a new page from scratch (skip audit, use defaults)

## DOS Integration

**This workflow produces a DOS-standard PRD.** Output goes to `MEMORY/WORK/{slug}/PRD.md` in the prd pack's vNext format (`format_version: 3`). The landing-page-specific sections (narrative architecture, color arc, tier specs) are written as subsections within the PRD's `## Context` section.

**PRD creation routes through the prd pack (the format owner).** Invoke `Skill("prd", "scaffold")` to produce the vNext frontmatter + skeleton, THEN continue editing the landing-page-specific sections directly. `Skill("prd", "scaffold")` is the single PRD-creation path — the prd pack owns the format SoT, so the format stays current across the repo and consumer installs without this workflow re-stating it.

**If the Algorithm is already running:** This workflow is invoked during the Algorithm's PLAN phase. The PRD already exists — edit it to add landing-page-specific context.

**If invoked standalone:** Create a new PRD stub following the Algorithm entry pattern:
1. `mkdir -p MEMORY/WORK/{slug}/` (slug format: `YYYYMMDD-HHMMSS_landing-page-description`)
2. Write `MEMORY/WORK/{slug}/PRD.md` with frontmatter per the prd pack's vNext format (`format_version: 3`)

## Prerequisites

- Audit scorecard (from Audit workflow or user-provided context)
- Understanding of project tech stack (framework, styling, i18n, components)

## Workflow

### Step 0: Load SoT

See `~/.claude/DOS/PARTIALS/LoadSoT.md`.

### Step 1: Load Context

1. Read the audit scorecard using Read tool
2. Read the current page source
3. Identify the tech stack (Next.js version, styling, animation libs, i18n)
4. Map existing components with their evolution potential
5. **Brand alignment check.** Look for `brand-tokens.json` (canonical W3C DTCG 2025.10) at the project root, falling back to `brand-token-spec.md`.
   - **If present:** spawn Brand to verify the spec is current and the page can align to it:
     ```ts
     Task({
       subagent_type: "general-purpose",
       description: "Brand alignment check for landing page",
       prompt: "Invoke the brand skill, Audit workflow. Read the existing brand tokens at the project root (prefer the canonical brand-tokens.json DTCG artifact, else brand-token-spec.md) and the current landing page source. Return: (a) whether the page already aligns with brand tokens (primary, accent, font-display, mood), (b) any mismatches that must be reconciled before tier delivery, (c) the canonical token bag the PRD should reference. Under 250 words."
     })
     ```
   - **If absent:** spawn Brand to produce the spec so the PRD can encode color-arc + typography decisions against a real source-of-truth:
     ```ts
     Task({
       subagent_type: "general-purpose",
       description: "Generate brand-token-spec for landing page",
       prompt: "Invoke the brand skill, Research workflow then Implementation/TokenSpec workflow. Subject: the product whose landing page is being redesigned (infer from page source). Produce the canonical brand-tokens.json (W3C DTCG 2025.10) plus its brand-token-spec.md companion at the project root covering primary/accent/bg, display + body fonts, mood descriptors, and visual references. Return: paths to the written brand-tokens.json (canonical) + companion the PRD will reference. Under 400 words."
     })
     ```
   Capture the returned token bag — Step 3 (Color Arc) and Step 5 (Tier Specs) read from it to ensure tier deliverables align with brand.

### Step 2: Define Narrative Architecture

Every page needs a story arc. Use this template and adapt:

```
Hero        -> Hook (what is this, 3 seconds)
Problem     -> Tension (why status quo fails)
Reveal      -> Product "aha" moment
Demo        -> Hands-on experience
Proof       -> Evidence (numbers, artifacts)
Depth       -> Differentiators / capabilities
Offer       -> Benefits + objection handling
FAQ         -> Remaining questions
Final CTA   -> Close with energy
```

**Key decisions to lock:**
- What is the **single primary conversion action**?
- What is the **core tension** (problem) the product solves?
- What is the **"aha" moment** that deserves a pinned scroll section?
- What can the user **interact with** (not just read)?

### Step 3: Define Color Arc

Assign per-section accent colors that create emotional progression:

| Section | Accent | Emotional Tone |
|---------|--------|----------------|
| Hero | cyan/blue | Precision, cool confidence |
| Problem | red/orange | Tension, urgency |
| Reveal | amber/gold | Insight, clarity |
| Demo | cyan/blue | Technical, hands-on |
| Proof | emerald/green | Confidence, trust |
| Depth | violet/indigo | Sophistication |
| Offer | warm gradient | Invitation |
| FAQ | neutral zinc | Calm |
| CTA | full-spectrum | Energy, callback to hero |

### Step 4: Component Evolution Map

For each existing component, classify:

| Component | Current State | Evolution | Tier |
|-----------|--------------|-----------|------|
| [name] | [what it does now] | [what it becomes] | 1/2/3 |

Categories:
- **Keep** -- works as-is
- **Fix** -- has a bug (e.g., parallax uses global scroll instead of section-relative)
- **Upgrade** -- works but needs richer motion/interaction
- **New** -- doesn't exist yet, needs to be built

### Step 4.5: Theme Mode Strategy

Define how each section handles light vs dark mode:

| Section | Light Surface | Dark Surface | Glassmorphism | Art Strategy |
|---------|--------------|-------------|---------------|-------------|
| Hero | bg-background | bg-background | bg-foreground/5 | Generate both light and dark variants |
| Problem | bg-background | bg-background | bg-foreground/8 | Same -- abstract art works on both |
| ... | ... | ... | ... | ... |

**Rules:**
- All sections use semantic tokens (bg-background, text-foreground, bg-card)
- Glassmorphism overlays: use `bg-foreground/[opacity]` instead of `bg-black/[opacity]` or `bg-white/[opacity]`
- Borders: `border-border` or `border-foreground/[opacity]`, never `border-white/10`
- Art prompts must specify both light and dark variants OR use theme-neutral imagery

### Step 5: Tier Specifications

#### Tier 1: Quick Wins (1-2 sessions)
Focus: Fix broken things, add smooth scroll, vary typography/spacing.

Standard items:
- [ ] Fix any broken parallax (section-relative scroll)
- [ ] Install Lenis smooth scroll
- [ ] Vary section padding (hero py-28/32, others py-20/24, alternate)
- [ ] Typography scale jumps (hero h1 larger, section h2s vary)
- [ ] Remove uniform wrappers from hero and CTA (full-viewport)
- [ ] Vary eyebrow treatments between sections
- [ ] All new components use semantic color tokens (zero hardcoded colors)
- [ ] Glassmorphism patterns use theme-aware opacity patterns

#### Tier 2: Medium-Term (3-5 sessions)
Focus: Narrative structure, scroll-driven storytelling, section art.

Standard items:
- [ ] Add Problem section (before/after contrast, red/emerald accents)
- [ ] Restructure page to narrative order
- [ ] Build scroll-pinned reveal section (GSAP ScrollTrigger, 400vh)
- [ ] Add scroll-driven section transitions (ScrollReveal wrappers)
- [ ] Generate 4+ unique art pieces (one per major section)
- [ ] Implement color arc with per-section accents
- [ ] Build interactive demo component (typewriter terminal simulation)
- [ ] Evolve grid components with staggered reveal + varied card sizes
- [ ] All new components use semantic color tokens (zero hardcoded colors)

#### Tier 3: Aspirational (5-8 sessions)
Focus: WebGL, interactivity, sound, micro-animations.

Standard items:
- [ ] Canvas particle field (hero background, mouse repulsion, mobile-optimized)
- [ ] GSAP cinematic transitions on all sections (fade-scale, parallax-up, reveal-left)
- [ ] Multi-scenario interactive demo with user selection
- [ ] Scroll progress indicator (fixed nav with section tracking)
- [ ] Ambient sound (opt-in, visibility API pause, reduced-motion respect)
- [ ] CSS micro-animations on icons (pulse, float, bounce-subtle)
- [ ] Mobile optimization (reduced particles, simplified parallax)

### Step 6: Performance Budgets

| Metric | Target |
|--------|--------|
| LCP | < 2.5s |
| CLS | < 0.1 |
| FID/INP | < 200ms |
| Total bundle (LP) | < 300KB gzipped |
| GSAP + ScrollTrigger | ~35KB gzipped (dynamic import) |
| Particle field | < 6KB component |
| All new components | < 50KB total |

### Step 7: Reduced Motion Strategy

Every animation must have a `prefers-reduced-motion` fallback:

| Animation | Full Motion | Reduced Motion |
|-----------|-------------|----------------|
| Scroll parallax | Layers at different speeds | Static positioning |
| Section transitions | Fade + translate on scroll | Instant visibility |
| Pinned scroll | Section pins, phases scrub | Standard scroll, phases stacked |
| Typewriter | Characters appear sequentially | Full text instantly |
| Particles/WebGL | Animated | Hidden |
| Hover effects | Scale/translate | Color change only |
| Ambient sound | Available toggle | Component not rendered |

### Step 8: Write to DOS PRD

**If Algorithm is running:** Edit the existing PRD at `MEMORY/WORK/{slug}/PRD.md`:
- Add all landing-page sections (narrative architecture, color arc, tiers, component evolution, performance budgets, reduced motion, theme mode) as subsections under `## Context`
- Generate ISC criteria from tier deliverables and write them to `## Criteria` section
- Each tier item becomes an atomic `- [ ] ISC-N:` criterion (apply the Splitting Test)
- Update frontmatter `progress: 0/N`

**If standalone:** Write the full PRD to `MEMORY/WORK/{slug}/PRD.md` with:
- Frontmatter per the prd pack's vNext format (`format_version: 3`)
- `## Context` containing all landing-page sections above
- `## Criteria` with atomic ISC criteria derived from tier specs

**Never write to `docs/landing-page-prd.md`.** The DOS PRD at `MEMORY/WORK/` is the single source of truth.

## Deliverables

- DOS PRD at `MEMORY/WORK/{slug}/PRD.md` with landing-page context
- Atomic ISC criteria derived from tier deliverables
- Audit reference linked in Context
- Ready for `DeliverTier` workflow

## Validation

- [ ] PRD exists at `MEMORY/WORK/{slug}/PRD.md`
- [ ] PRD follows the prd pack's vNext format (`format_version: 3`)
- [ ] PRD has narrative architecture in Context
- [ ] PRD has color arc in Context
- [ ] PRD has all 3 tiers with specific deliverables in Context
- [ ] PRD has component evolution map in Context
- [ ] PRD has performance budgets in Context
- [ ] PRD has reduced-motion strategy in Context
- [ ] ISC criteria are atomic (one verifiable thing each)
- [ ] **Completeness is COMPUTED, not asserted** — run `Skill("prd", "CheckCompleteness")` against the written PRD and gate on a COMPLETE verdict (the prd pack's 13-gate check-completeness owns the denominator/floor/Algorithm-section checks; the verdict is computed, never eyeballed). If it returns INCOMPLETE, fix the named failing gates and re-run before declaring the PRD done — do NOT hand-check "ISC count meets the floor", that is one of the 13 gates the tool runs for you.