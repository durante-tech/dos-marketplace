---
name: Deliver Tier
description: Execute one tier of the landing page PRD (Tier 1 quick wins, Tier 2 scroll storytelling, or Tier 3 WebGL/sound), verify, and report.
status: STABLE
divergence_from_canonical:
  _intent-to-flag-table.md:
    partial_version: 1.0.0
    reason: "Fixed-subcommand / native-tool invocations - no intent-variant flags exist to map; the section deliberately documents the fixed invocation table instead of the canonical Mode Selection shape"
    rationale_link: null
bestPath:
  - title: "Tier Identification"
    description: "Load the PRD, check completed tiers, and identify the next tier to deliver."
  - title: "Implementation"
    description: "Execute tier-specific component patterns with theme-token and z-index discipline."
  - title: "Verification"
    description: "Run component checks, typecheck, lint, and an optional DreamTeam review gate."
  - title: "Report & KG Recording"
    description: "Report delivery status and emit `composes` KG facts per shipped component."
---

# Deliver Tier

Execute one tier of the landing page PRD. Each tier builds on the previous.

## When to Use

- PRD exists with tier specifications
- User says "build tier 1", "deliver tier 2", "implement tier 3"
- Or "continue" / "next tier" after completing a previous tier

## Prerequisites

- PRD with tier specs (from `CreatePrd` workflow)
- Previous tier(s) delivered and verified (for tier 2+)

## Workflow

### Step 0: Load SoT

See `~/.claude/DOS/PARTIALS/LoadSoT.md`.

### Step 1: Load PRD + Identify Tier

1. Find and read the DOS PRD — search `MEMORY/WORK/` for the landing page PRD (grep for "landing" or "cinematic" in PRD slugs)
2. Check ISC criteria for completed tiers (checked `- [x]` criteria)
3. Identify next tier to deliver
4. Read current page source and components

### Step 2: Create Verification Criteria

Create binary-testable criteria for this tier's deliverables. Always include:
- One criterion per major component/feature
- One criterion for typecheck + lint clean (critical)
- One criterion for reduced-motion support (important)

### Step 3: Execute -- Tier-Specific Patterns

**Ground named animation libraries via Ref (mirrors MakerkitTeam Phase 1/7 skill-composition).** Before wiring any version-sensitive library API in the recipes below — Lenis, GSAP / ScrollTrigger, Framer Motion, Three.js / React Three Fiber — fire `Skill("research", "DocsLookup")` to pull the current doc surface through Ref instead of relying on training-data recall (these APIs drift across majors; recall mis-fires on prop names, hook signatures, and import paths). Cost guard: ≤2 lookups per tier; beyond that, `AskUserQuestion` triage. Failure mode: lookup empty/error → wire from the recipe as written and flag the call site `⚠️ docs-unverified`. Skip path: tier touches no new library (token/copy-only polish).

### Theme Token Rule (applies to ALL tiers)

Every code recipe in this workflow uses semantic Tailwind classes:
- `bg-background` not `bg-[#050816]` or `bg-black`
- `text-foreground` not `text-white`
- `text-muted-foreground` not `text-zinc-400`
- `bg-card` not `bg-[#07111d]`
- `border-border` not `border-white/10`

For glassmorphism/overlay effects, use theme-aware opacity patterns:
- `bg-foreground/5` not `bg-white/5` (adapts per theme)
- `bg-background/30` not `bg-black/30` (adapts per theme)

If a pattern truly requires different values per theme, use Tailwind dark: variant:
- `bg-white/5 dark:bg-black/30` for glass overlays that need different opacities

### Package-Manager Resolution (applies to ALL tiers)

The `<pm-install>` placeholder in the recipes below resolves to the consumer repo's package manager — mirror the DreamTeam consumer contract (`Packs/dream-team/src/Workflows/ConsumerContract.md`, C3) so both source-mutating packs share one rule:

1. Honor an explicit `package.json` `packageManager` field first.
2. Else detect by lockfile: `pnpm-lock.yaml` → pnpm · `yarn.lock` → yarn · `bun.lockb` → bun · `package-lock.json` (or none) → npm.
3. Map the install verb: `npm install <pkg>` · `pnpm add <pkg>` · `yarn add <pkg>` · `bun add <pkg>`.

The operator MAY override at invocation. Repos already on npm see no behavior change.

---

#### TIER 1: Quick Wins

**Smooth Scroll (Lenis)**
```bash
# <pm-install> resolves per "Package-Manager Resolution" above (npm install | pnpm add | yarn add | bun add)
<pm-install> lenis
```
Create `smooth-scroll-provider.tsx`:
- `'use client'` component wrapping `<ReactLenis root>`
- Config: `{ lerp: 0.1, duration: 1.2, smoothWheel: true }`
- Add to layout (inside body, wrapping children)

**ParallaxArt Fix (section-relative)**
```tsx
// BROKEN: global scroll
const { scrollY } = useScroll();
const y = useTransform(scrollY, [0, 1400], [0, -160]);

// FIXED: section-relative
const ref = useRef(null);
const { scrollYProgress } = useScroll({
  target: ref,
  offset: ['start end', 'end start']
});
const y = useTransform(scrollYProgress, [0, 1], [speed, -speed]);
```

**Section Wrapper Enhancement**
Add props to `LandingSection` or equivalent:
- `fullViewport` -- removes card wrapper, adds `min-h-[80vh]`
- `titleSize` -- 'sm' | 'md' | 'lg' | 'xl' for heading variety
- `eyebrowVariant` -- vary color/style per section

**Typography Scale**
| Location | Size |
|----------|------|
| Hero h1 | text-6xl sm:text-7xl xl:text-8xl |
| Problem headline | text-5xl sm:text-6xl |
| Section titles | text-4xl sm:text-5xl |
| Subsection titles | text-3xl sm:text-4xl |
| Final CTA | text-5xl sm:text-6xl |

---

#### TIER 2: Scroll-Driven Storytelling

**Problem Section**
- Two-column before/after contrast
- "Before" column: red accents, pain points, frustrated state
- "After" column: emerald accents, solution teaser, clarity
- Scroll-driven opacity transition between columns
- Background: AI-generated art (use media skill) with red/orange tension palette

**GSAP Pinned Story Section**
```bash
# <pm-install> resolves per "Package-Manager Resolution" above (npm install | pnpm add | yarn add | bun add)
<pm-install> gsap
```
Pattern:
- Section with `400vh` height (or `300vh` for 3 phases)
- GSAP ScrollTrigger pins visible area
- `scrub: 1` maps scroll position to phase index
- Each phase: icon, title, bullet points, typewriter artifact
- Phase colors match the color arc (cyan, amber, violet, emerald)

Key implementation detail:
```tsx
ScrollTrigger.create({
  trigger: sectionRef.current,
  pin: contentRef.current,
  scrub: 1,
  start: 'top top',
  end: `+=${(phases.length - 1) * 100}%`,
});
```

**Interactive Demo (Terminal Simulation)**
Pattern:
- Terminal-style container (bg-card, mono font, traffic light dots) -- terminal aesthetic preserved via semantic tokens
- Auto-play on viewport entry with `useInView`
- Phase progression: Observe, Define, Make, Verify
- Typewriter effect: `setInterval` at 18ms per character
- Phase timing: ~2200ms per phase
- "Run complete" banner at end with CheckCircle2 icon

**Section Art Generation**
Generate minimum 4 unique pieces using the **media skill**:

| Section | Prompt Keywords | Palette |
|---------|-----------------|---------|
| Problem | fractured, broken, tension, disruption | red-400, orange-400, transparent/neutral bg |
| Reveal | golden light paths, structured flow, clarity | amber-300, gold, transparent/neutral bg |
| Proof | verified nodes, connected network, confidence | emerald-300, green, transparent/neutral bg |
| Depth | deep space, constellation, sophistication | violet-300, indigo, transparent/neutral bg |

Generate art with transparent or neutral backgrounds when possible. For section art that requires an opaque background, generate both light and dark variants and conditionally render with `dark:hidden` / `hidden dark:block` on `<Image>` elements.

**ScrollReveal Wrapper**
```tsx
// Reusable scroll-driven reveal wrapper
// Uses motion/react useScroll + useTransform
// Maps scrollYProgress to opacity [0->1] and y [30->0]
// Respects prefers-reduced-motion
```

**Feature Grid Evolution**
- Staggered scroll reveal (AnimatedGroup or sequential InView)
- Varied card sizes: 2 large (span-2) + 3 small
- Icon animation on hover
- Detail blocks slide in on card hover/focus

---

#### TIER 3: Aspirational

**Canvas Particle Field**
Pattern -- `particle-field.tsx`:
- HTML Canvas (not WebGL -- lighter, sufficient)
- Configurable: count, color, secondaryColor, connectionDistance, speed
- Mouse repulsion: particles flee cursor within 120px radius
- Connection lines between nearby particles (distance < threshold)
- Mobile optimization: `window.innerWidth < 768` -> 50% particle count, 70% connection distance
- Respects `prefers-reduced-motion` -> returns null
- DPR-aware: `Math.min(devicePixelRatio, 2)`
- Cleanup: `cancelAnimationFrame` + event listener removal

**GSAP Cinematic Sections**
Pattern -- `cinematic-section.tsx`:
- Wrapper component with `effect` prop: `'fade-scale' | 'parallax-up' | 'reveal-left'`
- Dynamic GSAP import (code splitting)
- `scrub: 0.8` for smooth scroll-driven entry
- Parallax for `[data-parallax-art]` children
- Graceful fallback if GSAP unavailable

**Multi-Scenario Demo**
Upgrade terminal demo:
- Scenario selector (pill buttons above terminal)
- 3+ preset scenarios (e.g., "Upgrade signup page", "Build REST API", "Security audit")
- Replay button (appears after completion)
- Each scenario has unique spec, phases, and verification output

**Scroll Progress Indicator**
Pattern -- `scroll-progress.tsx`:
- Fixed right side, vertical dots/bars
- IntersectionObserver tracks which section is visible (threshold: 0.3)
- Section IDs: `lp-hero`, `lp-problem`, `lp-algorithm`, etc.
- Active dot = wider + brighter, past dots = dimmer
- Labels appear on hover
- Only visible on `xl:` breakpoint (hidden mobile)

**Ambient Sound**
Pattern -- `ambient-sound.tsx`:
- Generate 30s ambient loop using **media skill**
- Prompt: "Subtle ambient electronic soundscape, minimal, low drone, soft digital textures, futuristic control room, no melody no beats, atmosphere only"
- Component: opt-in toggle button (fixed bottom-right)
- Pauses on `document.hidden` (visibility API)
- Volume: 0.08 (very subtle)
- `prefers-reduced-motion` -> component not rendered

**Icon Micro-Animations**
Pattern -- `animated-icon.tsx`:
- 4 animation types: pulse, float, spin-slow, bounce-subtle
- `hoverOnly` prop for subtle hover-triggered motion
- Wrap key icons: hero eyebrow sparkles, CTA icons, trust signal checkmarks

### Step 4: Z-Index Management

Critical for pinned sections coexisting with subsequent content:

```
Pinned section: z-0 (or no z-index)
All sections AFTER pinned: relative z-10 bg-background (semantic -- adapts to theme)
Fixed UI (scroll progress, sound toggle): z-50
```

Without this, pinned content bleeds through subsequent sections.

### Step 5: Verify

Run verification:
1. One check per component (use Grep to verify file existence and key patterns)
2. Typecheck: `npx tsc --noEmit`
3. Lint: `npx eslint [new files]`

### Step 5.5: DreamTeam Review (optional ship-gate — Tier 2 & Tier 3 only)

**Tier 1 skips this step** — quick wins land directly. For Tier 2 and Tier 3, spawn DreamTeam as a subagent to evaluate the tier's deliverables through a conversion or visual lens before reporting completion.

**Tier 2 — conversion lens** (narrative restructure + interactive demo + section art changes affect funnel performance):

```ts
Task({
  subagent_type: "general-purpose",
  description: "DreamTeam conversion review for Tier 2",
  prompt: "Invoke the dream-team skill, Review workflow with lens=conversion (Review is the lens-aware workflow; SectionReview takes no lens). Review the just-shipped Tier 2 deliverables (Problem section, GSAP pinned story, interactive demo, section art, ScrollReveal wrappers, feature grid evolution) against the landing page PRD's narrative architecture and primary conversion action. Return: top 3 conversion risks, top 3 wins, and any blocking issues that should re-open ISC criteria. Under 400 words."
})
```

**Tier 3 — coherence lens** (WebGL particles + cinematic transitions + sound + micro-animations are visual/sensory deliverables; DreamTeam's `coherence` lens = visual-system consistency / animation language / one personality / post-iteration cleanup — the in-vocabulary lens for a craft-polish gate. NOTE: `visual` is NOT a DreamTeam lens; the valid lenses are conversion/differentiation/density/coherence/narrative):

```ts
Task({
  subagent_type: "general-purpose",
  description: "DreamTeam coherence review for Tier 3",
  prompt: "Invoke the dream-team skill, Review workflow with lens=coherence (Review is the lens-aware workflow). Review the just-shipped Tier 3 deliverables (canvas particle field, GSAP cinematic sections, multi-scenario demo, scroll progress indicator, ambient sound, icon micro-animations) for visual-system coherence, craft, polish, reduced-motion fallback quality, and Awwwards-level finish. Return: per-component pass/refine verdict + the 3 highest-leverage refinements. Under 400 words."
})
```

This is a ship-gate — if DreamTeam returns blocking issues, fold them into the report as re-opened ISC criteria before declaring the tier delivered. Operator may pass `--skip-dreamteam` to bypass on time-pressure runs.

### Step 6: Report

```markdown
## Tier [N] Delivered

| Component | File | Status |
|-----------|------|--------|
| [name] | [path] | pass |

**Verification: X/X passing**
**Typecheck: clean**
**Lint: clean**

Ready for Tier [N+1] / PRD COMPLETED
```

### Step 7: Record composition in the knowledge graph

Each delivered tier composes the landing page out of concrete sections/components. After the report, emit one `composes` KG fact per component shipped this tier so the graph knows what this page is built from. `composes` is the canonical predicate (see `Packs/mem-palace/PREDICATES.md`); the bridge validates it at write time.

Subject = the page identity (reuse the landing-page PRD slug from Step 1, prefixed `landing-page:`). Object = the component/section name (the `Component` column from the Step 6 report table). Write a real subject/predicate/object triple — do NOT stuff the component list into a metadata dict, the bridge drops it.

```bash
PRD_SLUG="<landing-page PRD slug from Step 1>"   # e.g. acme-landing
# One fact per delivered component (Component column of the Step 6 report):
for COMPONENT in "ParticleField" "CinematicSection" "ScrollProgress"; do   # replace with this tier's actual components
  python3 ~/.claude/DOS/Tools/mempalace_bridge.py add_kg_fact \
    "{\"subject\":\"landing-page:${PRD_SLUG}\",\"predicate\":\"composes\",\"object\":\"${COMPONENT}\"}"
done
```

Each successful call appends one line to the bridge invocation log. Skip silently if no MemPalace bridge is present (non-DOS host); the tier is still delivered.

## Intent-to-Flag Mapping

The workflow's only CLI invocation is fixed by design — MemPalace bookkeeping at tier close; no operator phrasing selects flags.

| Command | Input Contract | When It Fires |
|---------|-----------------|----------------|
| `python3 ~/.claude/DOS/Tools/mempalace_bridge.py add_kg_fact '<json>'` | one `{"subject":"landing-page:<slug>","predicate":"composes","object":"<Component>"}` triple per delivered component | Once per Component row of the Step 6 report, after tier delivery; skipped silently on non-DOS hosts |

## Common Pitfalls

1. **GSAP + motion/react conflict** -- use GSAP for pinning/scrub, motion/react for micro-interactions. Don't animate the same element with both.
2. **Pinned section overlap** -- always set z-index layers (see Step 4)
3. **Hooks before early return** -- `useReducedMotion()` + `useCallback` must be called before any `if (prefersReducedMotion) return null`
4. **Readonly arrays in motion/react** -- don't use `as const` on animation variant objects, motion types expect mutable arrays
5. **ParallaxArt with global scroll** -- always use section-relative `useScroll({ target: ref })`
6. **GSAP dynamic import typing** -- use `const gsap = gsapModule.default || gsapModule` pattern

## Validation

- [ ] All verification criteria pass
- [ ] Typecheck clean
- [ ] Lint clean
- [ ] PRD implementation log updated
- [ ] No z-index overlap between pinned and subsequent sections
- [ ] Reduced motion respected in all new components
- [ ] `composes` KG facts emitted (one per delivered component, subject `landing-page:<slug>`)