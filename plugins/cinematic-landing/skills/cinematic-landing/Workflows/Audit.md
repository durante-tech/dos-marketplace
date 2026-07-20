---
name: Audit
description: Score an existing landing page across 10 dimensions, producing a scorecard with tier recommendations that feeds into CreatePrd.
status: STABLE
bestPath:
  - title: "Evidence Gathering"
    description: "Read page source, screenshot, and map existing components, motion, and content sources."
  - title: "Ten-Dimension Scoring"
    description: "Score visual hierarchy, color, whitespace, imagery, flow, animation, motion, interactivity, narrative, award readiness."
  - title: "Scorecard & Compliance Gates"
    description: "Produce the scorecard with light-mode compliance and the motion-accessibility FAIL-GATE."
  - title: "Save to DOS PRD"
    description: "Write the scorecard into MEMORY/WORK/{slug}/PRD.md, ready to feed CreatePrd."
---

# Audit Landing Page

Score an existing landing page across 10 dimensions. Output feeds directly into `CreatePrd`.

**PRD-scaffolding routing:** Audit itself does not scaffold a PRD — its scorecard is consumed by `CreatePrd`, which routes PRD creation through `Skill("prd", "scaffold")` (the prd pack owns the format SoT). If `Audit` is ever extended to author a PRD directly, route it through the same Skill.

## When to Use

- Before any redesign work begins
- User says "audit my landing page", "score this page", "what's wrong with my LP"
- As first step of a full pipeline run

## Workflow

### Step 0: Load SoT

See `~/.claude/DOS/PARTIALS/LoadSoT.md`.

### Step 1: Gather Evidence

1. **Read the page source** -- use Read tool to find the page component file(s)
2. **Screenshot the page** -- capture desktop (1280x720) and mobile (390x844) views if possible
3. **Map existing components** -- use Grep/Glob to list every component used on the page with its file path
4. **Map existing motion** -- identify all animation libraries, scroll handlers, transition components
5. **Map content source** -- hardcoded, i18n keys, CMS, MDX

### Step 2: Score 10 Dimensions (1-10 each)

| # | Dimension | What to Evaluate |
|---|-----------|------------------|
| 1 | **Visual Hierarchy & Typography** | Heading scale variety, weight contrast, line-height, letter-spacing, readability |
| 2 | **Color Harmony & Mood** | Palette coherence, section-to-section color variation, dark/light consistency. Light-mode specific: contrast ratios on light backgrounds, muted text readability (min 4.5:1), glassmorphism legibility on white surfaces, art/image visibility on light surfaces, no invisible borders (border-white/10 on white bg). |
| 3 | **Whitespace & Breathing Room** | Padding variety, section spacing, content density, visual rest areas |
| 4 | **Imagery/Art Impact** | Unique art per section, quality of visuals, parallax depth, variety vs repetition |
| 5 | **Section-to-Section Flow** | Narrative progression, transition quality, scroll continuity, story arc |
| 6 | **Animation Architecture** | Motion libraries in use, GPU acceleration, will-change usage, reduced-motion support |
| 7 | **Motion Quality** | Purpose of each animation, scroll-driven vs decorative, timing/easing quality |
| 8 | **Interactivity Depth** | Hover states, click interactions, embedded demos, user agency |
| 9 | **Narrative UX** | Problem-to-solution flow, tension building, progressive disclosure, emotional arc |
| 10 | **Award Readiness** | Compared to Awwwards winners: Vercel, Ink Games, Linear, Stripe, Loom |

### Step 3: Produce Scorecard

```markdown
# Landing Page Audit: [Project Name]
**Date:** [date]
**URL:** [url or file path]
**Overall Score: X.X/10** (average of 10 dimensions)
**Verdict: PASS | FAIL** -- FAIL (overrides the average) when the Motion Accessibility FAIL-GATE below is unmet

## Dimension Scores

| # | Dimension | Score | Key Finding |
|---|-----------|-------|-------------|
| 1 | Visual Hierarchy & Typography | X/10 | [one-line finding] |
| ... | ... | ... | ... |

## Five Critical Findings

1. **[Finding]** -- [evidence] -> [impact]
2. ...

## Component Inventory

| Component | File | Reuse Potential |
|-----------|------|----------------|
| [name] | [path] | Keep / Upgrade / Replace |

## Motion Inventory

| Library | Usage | Quality |
|---------|-------|---------|
| [lib] | [where] | [assessment] |

## Tier Recommendations

### Tier 1 (Quick Wins -- 1-2 sessions)
- [specific fix 1]
- [specific fix 2]

### Tier 2 (Medium-Term -- 3-5 sessions)
- [specific feature 1]
- [specific feature 2]

### Tier 3 (Aspirational -- 5-8 sessions)
- [specific feature 1]
- [specific feature 2]
```

## Light Mode Compliance

- [ ] All text meets WCAG AA contrast on light background
- [ ] Glassmorphism panels are visible and readable on light surface
- [ ] Section art is visible on light background (not washed out)
- [ ] No hardcoded dark colors (bg-black, text-white, bg-[#hex])
- [ ] Borders are visible on light background (not border-white/*)
- [ ] Zero `dark:` prefixes without corresponding light-mode base style

## Motion Accessibility Compliance (FAIL-GATE)

`prefers-reduced-motion` is a hard accessibility gate, not a dimension score. A page that animates without honoring it does not pass audit -- vestibular-disorder users get motion sickness from uncapped parallax, scrub, and particle motion. Evaluate every box; an unchecked box is a BLOCKING finding.

- [ ] A global `@media (prefers-reduced-motion: reduce)` rule (or a `useReducedMotion()` gate) exists -- reduced motion is honored somewhere, not silently ignored
- [ ] Scroll-driven motion (parallax, section reveal, pinned/scrub scroll) falls back to static positioning / instant visibility under reduced motion
- [ ] Particle fields / canvas / WebGL backgrounds do not render (return null) under reduced motion
- [ ] Typewriter / sequential-character effects render full text instantly under reduced motion
- [ ] Looping or infinite motion (marquee, spin-slow, float, pulse) is paused or not rendered under reduced motion
- [ ] Hover/tap motion degrades to a non-motion cue (color/opacity) under reduced motion
- [ ] Ambient sound / autoplaying audio is not rendered (stays opt-in) under reduced motion
- [ ] The reduced-motion path is actually wired (the early `return` runs AFTER all hooks), not just declared in prose

**FAIL-GATE:** If ANY box above is unchecked, the audit **verdict is FAIL** regardless of the 10-dimension average. Cap dimension #6 (Animation Architecture) at 4/10, record the gap as the first item in **Five Critical Findings** as `BLOCKING -- prefers-reduced-motion unmet`, and set the scorecard `Verdict:` to `FAIL`. Do not advance to `CreatePrd` until every unchecked box is closed by the PRD's reduced-motion strategy (CreatePrd Step 7).

### Step 4: Save Audit

**If Algorithm is running:** Write the scorecard as a subsection within the existing PRD's `## Context` section at `MEMORY/WORK/{slug}/PRD.md`. The audit feeds directly into the Algorithm's OBSERVE phase.

**If standalone:** Write the scorecard to `MEMORY/WORK/{slug}/PRD.md` as a new DOS PRD:
1. `mkdir -p MEMORY/WORK/{slug}/` (slug: `YYYYMMDD-HHMMSS_landing-page-audit`)
2. Create the PRD via `Skill("prd", "scaffold")` (vNext `format_version: 3`)
3. Scorecard content goes in `## Context`

**Never write to `docs/landing-page-audit.md`.** The DOS PRD system is the single source of truth.

## Validation

- [ ] All 10 dimensions scored with evidence
- [ ] Component inventory complete
- [ ] Motion inventory complete
- [ ] Tier recommendations are specific (not generic)
- [ ] Screenshots captured (desktop + mobile) if possible
- [ ] **Motion Accessibility FAIL-GATE evaluated** -- every box in Motion Accessibility Compliance is checked, OR the scorecard `Verdict:` is `FAIL` with a `BLOCKING -- prefers-reduced-motion unmet` critical finding (a page that ignores `prefers-reduced-motion` cannot pass audit)
- [ ] Output saved to `MEMORY/WORK/{slug}/PRD.md`