---
name: CinematicLanding
description: Build cinematic, Awwwards-level landing pages through a tiered delivery pipeline. Audit, PRD, Tier 1 (quick wins), Tier 2 (scroll-driven storytelling), Tier 3 (WebGL, sound, micro-animations). Concrete component patterns, not vague delegation. USE WHEN landing page, cinematic page, scroll storytelling, awwwards, page redesign, LP upgrade, interactive demo, scroll animation, hero particles, ambient sound, narrative UX, audit landing page, build tier, landing page PRD.
role: executor
accepts:
  - text
icon: Layout
colorVar: secondary
colorHex: "#deb7ff"
tier: secondary
category: Engineering
displayLabel: Cinematic Landing
marketingDescription: Award-level landing pages with GSAP, WebGL, scroll storytelling
elevator: Awwwards-level landing pages with scroll storytelling
highlightWorkflows:
  - name: Audit
    technicalName: Audit
  - name: Deliver Tier
    technicalName: DeliverTier
roots:
  - PROJECT.WORK
  - PROTECTED_LOCAL
derivative_workflows:
  - Workflows/Audit
  - Workflows/CreatePrd
  - Workflows/DeliverTier
  - Workflows/FixOverlap
visibility: public
capabilities:
  - artifact.write
  - customization.cascade
  - four-copy.sync
  - voice.emit
---
<!-- generated-from: SKILL.partials.md — DO NOT EDIT directly. Run: bun Tools/dos-build.ts skill <path> -->
# CinematicLanding -- Tiered Award-Level Page Delivery

Build Awwwards-level landing pages through structured tiers, not vague delegation. Every workflow produces concrete components with verified quality.

## Customization

**Before executing, check for user customizations at:**
`~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/CinematicLanding/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.

## Workflow Routing

| Workflow | Trigger | File |
|----------|---------|------|
| **Audit** | "audit my landing page", "score this page", "what's wrong with my LP" | `Workflows/Audit.md` |
| **CreatePrd** | "create landing page PRD", "plan the redesign", "LP PRD" | `Workflows/CreatePrd.md` |
| **DeliverTier** | "build tier 1", "deliver tier 2", "implement tier 3", "next tier" | `Workflows/DeliverTier.md` |
| **FixOverlap** | "fix overlap", "sections overlapping", "z-index issue" | `Workflows/FixOverlap.md` |

## Core Philosophy

1. **Narrative first** -- every page tells a story: tension, reveal, proof, invitation
2. **Tiered delivery** -- ship quick wins fast, layer complexity incrementally
3. **Concrete patterns** -- reusable component recipes, not abstract guidelines
4. **Verification at every tier** -- typecheck, lint clean before moving on
5. **Sensory depth** -- visual (particles, parallax), auditory (ambient sound), kinetic (scroll-driven)
6. **Theme-aware by default** -- every component uses semantic tokens (bg-background, text-foreground, bg-card, border-border). Hardcoded colors (bg-black, text-white, bg-[#hex]) are prohibited. Components must render correctly in both light and dark modes.
7. **Motion-accessible by default** -- every animation honors `prefers-reduced-motion` (scroll/parallax -> static, particles/WebGL -> not rendered, typewriter -> instant, looping motion -> paused). This is a hard accessibility gate, not a preference: the `Audit` workflow FAIL-GATES on it (an unmet `prefers-reduced-motion` fallback fails the audit regardless of the 10-dimension average).

## Component Library (Built Patterns)

These are proven components from successful deliveries.

| Component | Purpose | Tier | Theme |
|-----------|---------|------|-------|
| `ParticleField` | Canvas particle background with mouse repulsion, mobile optimization | 3 | Semantic (reads CSS vars) |
| `CinematicSection` | GSAP ScrollTrigger wrapper with fade-scale/parallax-up/reveal-left effects | 3 | Semantic (bg-background) |
| `ScrollProgress` | Fixed nav with section dot tracking via IntersectionObserver | 3 | Semantic (bg-card, text-foreground) |
| `ScrollReveal` | Scroll-driven fade+translate wrapper for sections | 2 | Semantic (bg-background) |
| `AlgorithmDemo` / `ProductDemo` | Multi-scenario terminal simulation with typewriter, phase progression | 2-3 | Semantic (bg-card, text-foreground) |
| `PinnedStory` | GSAP-pinned scroll section (400vh, 4 phases at 100vh each) | 2 | Semantic (bg-background) |
| `ProblemSection` | Before/after contrast with red/emerald accents | 2 | Semantic (bg-card, text-foreground) |
| `AnimatedIcon` | CSS micro-animations (pulse/float/spin-slow/bounce-subtle) | 3 | Semantic (reads CSS vars) |
| `AmbientSound` | Opt-in audio toggle with visibility API pause | 3 | Semantic (bg-card, text-foreground) |
| `ParallaxArt` | Section-relative parallax with AI-generated art | 1 | Semantic (bg-background) |
| `SmoothScrollProvider` | Lenis wrapper for butter-smooth scrolling | 1 | Semantic (reads CSS vars) |

## Narrative Architecture Template

```
Hero (full-viewport, cinematic)     -- Hook: what is this in 3 seconds
  color: cyan/blue (precision)
Problem (tension builder)           -- Why the status quo fails
  color: red/orange (urgency)
Algorithm Reveal (scroll-pinned)    -- The product "aha" moment
  color: amber/gold (insight)
Interactive Demo (hands-on)         -- Experience the product
  color: cyan/blue (technical)
Proof (evidence surface)            -- Numbers and artifacts
  color: emerald/green (confidence)
Behaviors (differentiators)         -- Deep-dive capabilities
  color: violet/indigo (sophistication)
Offer (conversion)                  -- Benefits + objection handling
  color: warm gradient (invitation)
FAQ (informational)                 -- Remaining questions
  color: neutral zinc (calm)
Final CTA (full-viewport)           -- Close with energy
  color: full-spectrum callback
```

## Tech Stack Layers

| Technology | Role | When |
|-----------|------|------|
| motion/react | Micro-interactions, AnimatePresence, useInView | Always |
| Lenis | Smooth scroll foundation | Tier 1 |
| GSAP + ScrollTrigger | Pinned sections, scrub animations, complex timelines | Tier 2 |
| Canvas 2D / WebGL | Particle fields, shader backgrounds | Tier 3 |

## Examples

### Example 1: Full pipeline from scratch
```
User: "build a landing page for my product"
Route: Audit.md -> CreatePrd.md -> DeliverTier.md
Action: Score existing page (or note blank slate), generate tiered PRD
        with narrative architecture and color arc, deliver Tier 1 quick wins,
        then Tier 2 scroll storytelling, then Tier 3 WebGL/sound
```

### Example 2: Upgrade existing page
```
User: "my landing page scored 4/10 on Awwwards, help me improve"
Route: Workflows/Audit.md
Action: Deep 10-dimension audit with numeric scores, produce scorecard
        with component inventory, motion inventory, and tier recommendations.
        Then proceed to PRD and delivery.
```

### Example 3: Fix post-delivery issue
```
User: "the pinned section is bleeding through the next section"
Route: Workflows/FixOverlap.md
Action: Diagnose z-index layers, apply pinned=z-0 / after=z-10+bg-background
        pattern, verify scroll behavior preserved
```

## Related Skills

| Skill | When to Use Together |
|-------|---------------------|
| dream-team | DreamTeam evaluates what CinematicLanding builds |
| media | Generate section background art, ambient audio, and visual assets used in tier deliveries |
| brand | Ensure landing page aligns with brand visual identity and color system |

## Artifact Tracking

**MANDATORY for any workflow in this skill that writes output files via the Write tool.**

After writing any output file, resolve the ARTIFACTS path and append a JSONL log entry:

```bash
# Resolve ARTIFACTS dir (project-level first)
if [ -d "${CLAUDE_PROJECT_DIR}/MEMORY/ARTIFACTS" ]; then
  ARTIFACTS_DIR="${CLAUDE_PROJECT_DIR}/MEMORY/ARTIFACTS"
elif [ -d "$(pwd)/MEMORY/ARTIFACTS" ]; then
  ARTIFACTS_DIR="$(pwd)/MEMORY/ARTIFACTS"
else
  ARTIFACTS_DIR="$HOME/.claude/MEMORY/ARTIFACTS"
fi
mkdir -p "$ARTIFACTS_DIR"

echo '{"timestamp":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","pack":"CinematicLanding","workflow":"WORKFLOW_NAME","type":"ARTIFACT_TYPE","title":"TITLE","path":"ABSOLUTE_PATH","contentPreview":"FIRST_500_CHARS_ESCAPED","wing":"WING_OR_GENERAL","sessionId":"'$CLAUDE_SESSION_ID'"}' >> "$ARTIFACTS_DIR/artifacts.jsonl"
```

If this skill is read-only (no Write tool usage), this section is informational only.

## Four-Copy Compliance

This skill exists in up to four locations per the DOS Four-Copy Rule (`Durante/CLAUDE.md`):

1. `~/.claude/skills/cinematic-landing/` — live install (what Claude Code runs)
2. `Releases/<active-version>/.claude/skills/cinematic-landing/` — active release submodule (versioned)
3. `Packs/*/src/CinematicLanding/` — pack source (distributable)
4. `Packs/agents/CinematicLanding/` — agent runtime (only if applicable)

After editing any file in this skill, verify all copies via `bun ~/Durante/Tools/sync-check.ts`. Exit code 0 = clean. Exit code 1 = drift; resolve with `--fix` before commit.
