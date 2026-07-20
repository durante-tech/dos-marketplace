---
name: DreamTeam
description: Assemble a world-class virtual council of named industry experts to evaluate, critique, and evolve user-facing content. 7 specialist roles channeling real frameworks (Peep Laja's CRO, Joanna Wiebe's conversion copy, Katie Dill's Stripe-caliber design, etc.). USE WHEN landing page review, content review, conversion audit, copy review, UX review, visual review, brand review, marketing review, dream team, expert council, content evolution, page critique, section review, visual brief, logo review, brand assets, trim content, evolve page.
role: analyzer
accepts:
  - text
icon: Users
colorVar: primary
colorHex: "#00e1ab"
tier: secondary
category: Engineering
displayLabel: Expert Council
marketingDescription: Virtual council of 7 experts evaluating your work
elevator: 7 named industry experts critique your work
highlightWorkflows:
  - name: Section Review
    technicalName: SectionReview
  - name: Review
    technicalName: Review
roots: []
visibility: public
capabilities:
  - artifact.write
  - customization.cascade
  - four-copy.sync
  - voice.emit
---
<!-- generated-from: SKILL.partials.md — DO NOT EDIT directly. Run: bun Tools/dos-build.ts skill <path> -->
# DreamTeam -- World-Class Content Council

A virtual council of the world's best landing page creators, channeling their real frameworks and methodologies to evaluate and evolve user-facing content.

**v2.0** -- Updated with battle-tested patterns from a real 9-section enhancement session producing 30+ implemented changes.

## Customization

**Before executing, check for user customizations at:**
`~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/DreamTeam/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.

## Workflow Routing

| Workflow | Trigger | File |
|----------|---------|------|
| **SectionReview** | "review this section", "enhance this section", "improve this" | `Workflows/SectionReview.md` |
| **Review** | "dream team review", "full review", "7-expert review" | `Workflows/Review.md` |
| **QuickReview** | "quick review", "fast check", "pre-launch check" | `Workflows/QuickReview.md` |
| **Evolve** | "evolve the page", "review and implement", "review and fix" | `Workflows/Evolve.md` |
| **Trim** | "trim the page", "too much content", "simplify", "content diet" | `Workflows/Trim.md` |
| **VisualBrief** | "visual brief", "logo review", "brand assets", "asset generation" | `Workflows/VisualBrief.md` |

### Scope x Action Routing Matrix

When the trigger is ambiguous, disambiguate by **scope** (what is being worked on) x **action** (what to do with it):

| Scope \ Action | Review (critique only) | Evolve (review + implement) | Trim (reduce volume) |
|----------------|------------------------|-----------------------------|----------------------|
| **Section** | `SectionReview` | `SectionReview` (steps 4-6 implement) | `Trim` (section-scoped) |
| **Page** | `Review` (full) / `QuickReview` (fast) | `Evolve` | `Trim` |
| **Asset** (logo/brand) | `VisualBrief` | `VisualBrief` | n/a |

## What Makes This Different from Council

| Council (generic) | DreamTeam (this) |
|-------------------|-------------------|
| Generic agent roles (architect, engineer) | Named expert personas with real frameworks |
| Topic-agnostic | Specialized for user-facing content (pages, copy, visuals) |
| 4 agents, 1 round | 3-7 specialists depending on workflow |
| No domain expertise embedded | Frameworks baked in: CRO, conversion copy, Stripe-caliber design |
| Output: opinions | Output: prioritized, implementable recommendations with specific components |
| No component awareness | Component inventory provided -- agents recommend specific UI primitives |

## Recommended Workflow: Section-by-Section

**Use `SectionReview` as the default workflow.** It's battle-tested and produces the best results:

1. Read ONE section's code + copy
2. Provide component inventory to 3 core experts
3. Extract unanimous agreements
4. Implement and verify
5. Allow re-review if principal flags issues
6. Commit and move to next section

The full 7-expert review is reserved for major structural decisions.

## The 7 Roles

### Core Trio (used in every section review)

#### 1. Conversion Strategist
**Channeling:** Peep Laja (CXL), Oli Gardner (Unbounce)
**Framework:** Attention-Driven Design (attention ratio, directional cues) + research-first CRO
**Lens:** Does every element serve the conversion goal? What's the attention ratio? What leaks exist?

#### 2. Visual Designer
**Channeling:** Katie Dill (Stripe), Karri Saarinen (Linear)
**Framework:** Stripe craft standard (gradients, animations, clarity) + Linear precision aesthetic
**Lens:** Does the visual execution match world-class caliber? What specific components should be used?

#### 3. Copywriter
**Channeling:** Joanna Wiebe (Copyhackers), Eddie Shleyner (VeryGoodCopy)
**Framework:** Conversion copywriting (voice of customer, specificity) + 4-pillar method (clarity, desirability, credibility, action)
**Lens:** Does the copy persuade? Is it too long? Does it sound like the audience talks?

### Extended Panel (added when section needs it)

#### 4. Motion / Interaction Designer
**Channeling:** Felix Peault (Flayks), Jesper Landberg
**When:** Animation-heavy sections, scroll-driven experiences

#### 5. 3D / Visual Artist
**Channeling:** Bruno Simon (Three.js), Peter Tarka (Apple/Google 3D)
**When:** Sections with WebGL/R3F elements

#### 6. Brand Strategist
**Channeling:** Emily Heyward (Red Antler), Marty Neumeier (The Brand Gap)
**When:** Hero, final CTA, brand identity sections, competitive positioning

#### 7. Technical Architect
**When:** Feasibility uncertain, performance concerns, complex implementations

## Custom Lenses

| Lens | Focus | Best For |
|------|-------|----------|
| **conversion** | CTA placement, attention ratio, friction points | Pre-launch optimization |
| **differentiation** | What makes this page impossible to confuse with competitors | Competitive positioning |
| **density** | Content volume, text-heaviness, visual noise | Trimming and simplification |
| **coherence** | Visual system consistency, animation language, one personality | Post-iteration cleanup |
| **narrative** | Story arc, emotional journey, section sequencing | Structural redesign |

## Context Requirements

For best results, the dream team needs:
1. **Full section source** -- read the actual JSX for the section being reviewed
2. **Copy/translations** -- the actual text values, not just translation keys
3. **Component inventory** -- CRITICAL: list all available UI primitives the experts can recommend
4. **Conversion goal** -- what action should visitors take
5. **Stage** -- pre-traction, growth, established (changes the advice dramatically)
6. **Ecosystem context** -- product facts (skill count, agent count, key features)
7. **Screenshots** -- real visual context reveals issues code review misses

## Proven Patterns (from real sessions)

### The Asymmetric Treatment
For before/after or comparison elements, use different visual physics on each side:
- **Problem/Before:** Tilt=10 deg, BorderTrail=4s, aggressive MagicCard spotlight -- feels unstable
- **Solution/After:** Tilt=4 deg, BorderTrail=8s, gentle MagicCard spotlight -- feels controlled
- Emotional contrast through interaction physics, not just color

### The Component Upgrade Path
When a section feels "template-y":
1. **MagicCard** -- cursor-following depth (biggest single improvement)
2. **BorderTrail** -- animated edge trace (draws focus)
3. **Tilt** -- perspective hover (spatial engagement)
4. **Magnetic** -- on CTAs only (micro-interaction reward)
5. **InfiniteSlider + ProgressiveBlur** -- for logo/brand bars

### The Copy Tightening Rules
- Hero subtitle: <=15 words
- Section subtitle: <=20 words
- Value points: <=12 words each
- Body paragraphs: <=2 sentences
- Body copy: text-base (16px). Labels: text-sm. Micro: text-xs.

### The Section Trim Checklist
- Text elements: <=8 per section
- Animation systems: <=3 per section
- Competing focal points: 1 per section
- Empty blocks: conditionally render (skip when empty string)

### The Unanimous Agreement Principle
Only implement changes where 2+ experts independently converge:
- **All 3 agree** -- implement immediately
- **2 of 3 agree** -- implement with caution
- **1 only** -- flag for human decision, don't implement

## Examples

### Example 1: Section-by-section polish pass
```
User: "review the hero section"
Route: Workflows/SectionReview.md
Action: Read hero JSX, build component inventory, spawn 3 core experts,
        extract unanimous agreements, implement changes, verify with healthcheck
```

### Example 2: Full review before launch
```
User: "dream team review with conversion lens"
Route: Workflows/Review.md (lens=conversion)
Action: Gather full page context, spawn 7 experts with conversion focus,
        synthesize perspectives, extract agreements and tensions,
        produce prioritized recommendation table
```

### Example 3: Content density reduction
```
User: "the page feels too heavy, trim it"
Route: Workflows/Trim.md
Action: Measure current state (JSX lines, translation calls, effects count),
        spawn 4 density experts, find unanimous cuts, implement,
        measure after state and report delta
```

## Related Skills

| Skill | Relationship |
|-------|-------------|
| Council | DreamTeam extends Council with domain-specific expert personas |
| cinematic-landing | DreamTeam evaluates what CinematicLanding builds |
| brand | DreamTeam's brand strategist uses brand skill's token architecture |
| media | DreamTeam's visual experts produce briefs that media skill executes |

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

echo '{"timestamp":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","pack":"DreamTeam","workflow":"WORKFLOW_NAME","type":"ARTIFACT_TYPE","title":"TITLE","path":"ABSOLUTE_PATH","contentPreview":"FIRST_500_CHARS_ESCAPED","wing":"WING_OR_GENERAL","sessionId":"'$CLAUDE_SESSION_ID'"}' >> "$ARTIFACTS_DIR/artifacts.jsonl"
```

If this skill is read-only (no Write tool usage), this section is informational only.

## Four-Copy Compliance

This skill exists in up to four locations per the DOS Four-Copy Rule (`Durante/CLAUDE.md`):

1. `~/.claude/skills/dream-team/` — live install (what Claude Code runs)
2. `Releases/<active-version>/.claude/skills/dream-team/` — active release submodule (versioned)
3. `Packs/*/src/DreamTeam/` — pack source (distributable)
4. `Packs/agents/DreamTeam/` — agent runtime (only if applicable)

After editing any file in this skill, verify all copies via `bun ~/Durante/Tools/sync-check.ts`. Exit code 0 = clean. Exit code 1 = drift; resolve with `--fix` before commit.
