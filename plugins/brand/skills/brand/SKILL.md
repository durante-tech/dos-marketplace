---
name: Brand
description: Brand identity intelligence and definition. Research, strategy, naming, verbal, visual, audit, handoff, logo design, and icon systems. Three-layer token architecture (option/decision/component). 9-agent parallel research. Produces brand token specs consumed by design-system skill for code implementation. USE WHEN brand research, brand extraction, brand audit, define brand, create brand identity, brand strategy, brand token spec, visual identity, brand for landing page, logo design, create logo, icon system, icon set, reverse engineer brand, brand deep dive, score brand, brand handoff, brand mark, brand icons, full brand pipeline. NOT for code implementation of the design system (use DesignSystem) — Brand produces the token spec DesignSystem consumes.
role: extractor
accepts:
  - text
icon: PenTool
colorVar: primary
colorHex: "#00e1ab"
tier: primary
category: Brand
displayLabel: Brand
marketingDescription: Brand intelligence, 9-agent research, StoryBrand, logo design, and icon systems.
capabilities:
  - artifact.write
  - customization.cascade
  - four-copy.sync
elevator: 9-agent research, logo design, StoryBrand, icon systems
highlightWorkflows:
  - name: Brand Research
    technicalName: BrandResearch
  - name: Logo Design
    technicalName: LogoDesign
  - name: StoryBrand Messaging
    technicalName: StoryBrandMessaging
roots:
  - PROJECT.WORK
  - PROJECT.ARTIFACTS
  - PROTECTED_LOCAL
sot_domains:
  - messaging
derivative_workflows:
  - Research/Research
  - Strategy/Define
  - Strategy/Architecture
  - Verbal/BrandScript
  - Verbal/Generate
  - Verbal/Artifacts
  - Verbal/VoiceGuide
  - Naming/NameProduct
  - Naming/NamingSystem
  - Guidelines/GenerateGuidelines
  - Guidelines/EnforceConsistency
  - Workflows/Audit
  - Implementation/Handoff
  - Implementation/SocialBrand
  - Implementation/TokenSpec
  - Visual/LogoDesign
  - Visual/IconSystem
  - Visual/ColorSystem
  - Visual/Typography
  - Visual/MotionLanguage
  - Visual/IllustrationDirection
visibility: public
feature_capabilities:
  - 9-agent parallel brand research
  - Brand audit and competitive analysis
  - Logo design and icon systems
  - Three-layer token architecture (option/decision/component)
composes: [DesignSystem]
---
<!-- generated-from: SKILL.partials.md — DO NOT EDIT directly. Run: bun Tools/dos-build.ts skill <path> -->
# Brand -- Brand Intelligence, Definition, and Implementation

Complete brand system: from deep multi-agent research through strategy definition to implementable code artifacts. Produces three-layer token architecture (option/decision/component) that bridges directly to code, not just strategy documents.

## Sub-Component Routing

**Sub-component routing:** references to `<Sub>/SKILL.md` in this skill are FILE PATHS relative to this skill's directory — load them with the Read tool and follow their instructions. Sub-components (Research/, Strategy/, Naming/, Verbal/, Visual/, Guidelines/, Implementation/) are NOT separately registered skills: never invoke `Skill("brand:<Component>")` — it fails with "Unknown skill".

## Deliverables

Brand workflows produce project-level documents. Each workflow is responsible for writing its deliverable and validating it exists.

| Deliverable | Producing Workflow | Output Location |
|-------------|-------------------|-----------------|
| Brand Definition | Strategy/Define | `Docs/brand-definition.md` |
| BrandScript (SB7) | Verbal/BrandScript | `{project}/brandscript.md` |
| Core Assets | Strategy/Define | `{project}/core-assets.md` |
| Brand Token Spec | Implementation/TokenSpec | `{project}/brand-token-spec.md` |
| Brand Audit Scorecard | Audit | `Docs/brand-audit-scorecard.md` |
| Brand Guidelines | Guidelines/GenerateGuidelines | `{project}/brand-guidelines.md` |
| CinematicLanding Handoff | Implementation/Handoff | `{project}/brand-handoff-cinematic-landing.md` |

These are project deliverables, not skill-level context files. Workflows write them to the target project root.

## What Makes This Different

| Traditional Approach | This Skill |
|---------------------|-----------|
| Extraction only, no creation | Covers both extraction and creation |
| Generic YAML output | Three-layer token architecture (option/decision/component) |
| No connection to code | Produces brand token spec consumed by design-system skill |
| Single-agent research | 9-agent parallel research across 3 provider types |
| No motion identity | Motion language tokens (easing, duration, scroll behavior) |
| No downstream awareness | Direct handoff to cinematic-landing skill |
| Hex-only colors | OKLCH color system with perceptual uniformity |

## Core Philosophy

1. **Brand as code** -- every brand decision becomes an implementable token, not a PDF guideline
2. **Three-layer tokens** -- option (raw values) -> decision (semantic) -> component (applied)
3. **Research depth** -- 9 agents across 3 providers, each with distinct research dimensions
4. **Implementation bridge** -- the gap between "brand strategy" and "working code" is where most brands fail
5. **Downstream-aware** -- outputs are structured to feed directly into CinematicLanding

## Customization

**Before executing, check for user customizations at:**
`~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/Brand/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.

## Sub-Skill Routing

| Sub-Skill | Trigger | Route |
|-----------|---------|-------|
| research | Research brand, brand deep dive, extract brand, brand intelligence, reverse engineer brand | `Research/SKILL.md` |
| Strategy | Define brand, brand identity, brand strategy, brand positioning, brand architecture, sub-brands | `Strategy/SKILL.md` |
| Naming | Name product, name feature, naming conventions, brand name, check name availability | `Naming/SKILL.md` |
| Verbal | Brand voice, tone of voice, messaging, brandscript, one-liner, elevator pitch, voice guidelines | `Verbal/SKILL.md` |
| Visual | Design logo, icon system, color palette, typography, illustration style, motion language, brand mark | `Visual/SKILL.md` |
| Implementation | Brand token spec, brand handoff, prepare for DesignSystem, social brand, social templates | `Implementation/SKILL.md` |
| Guidelines | Brand guidelines, brand book, style guide, brand compliance, enforce brand consistency | `Guidelines/SKILL.md` |
| Audit | Brand audit, score brand, evaluate brand, brand quality | `Workflows/Audit.md` |

## Full Pipeline (Recommended)

End-to-end brand creation: Research -> Strategy -> Naming -> Verbal -> Visual -> Implementation -> Guidelines

## Token Architecture

All brand outputs follow the three-layer token system:

```
Layer 1: Option Tokens (raw values)
  --color-blue-600: oklch(0.55 0.2 250);
  --font-size-48: 3rem;
  --duration-300: 300ms;

Layer 2: Decision Tokens (semantic assignments)
  --color-primary: var(--color-blue-600);
  --heading-size-hero: var(--font-size-48);
  --motion-entrance: var(--duration-300);

Layer 3: Component Tokens (applied patterns)
  --hero-accent: var(--color-primary);
  --hero-heading-size: var(--heading-size-hero);
  --hero-reveal-duration: var(--motion-entrance);
```

This architecture enables brand evolution without component rewrites -- change a decision token, every component updates.

## Downstream Integration

Brand outputs feed two downstream skills:

### Brand -> DesignSystem (token implementation)

The TokenSpec workflow produces a brand token spec document that DesignSystem/Init consumes to generate DESIGN.md. This is the primary path for turning brand identity decisions into implementable code.

| Brand Output | DesignSystem Input |
|-------------|-------------------|
| Color palette (OKLCH, semantic roles) | DesignSystem/Init pre-populates color tokens |
| Typography hierarchy (scale, weights, fonts) | DesignSystem/Init pre-populates type scale |
| Motion language (easing, duration, scroll) | DesignSystem/Init pre-populates motion tokens |
| Spacing philosophy | DesignSystem/Init pre-populates spacing scale |

### Brand -> CinematicLanding (page design)

The Handoff workflow produces a structured package for CinematicLanding's create-prd workflow.

| Brand Output | CinematicLanding Input |
|-------------|------------------------|
| Color arc table (section/accent/emotional tone) | Step 3: Define Color Arc |
| Typography hierarchy | Tier 1: Typography scale jumps |
| Motion language tokens | Tier 2-3: Scroll-driven motion specs |
| Narrative architecture template | Step 2: Define Narrative Architecture |
| Brand personality + voice | Narrative tone and copy direction |

**Recommended pipeline:** Research -> Strategy -> Visual -> TokenSpec -> DesignSystem/Init -> CinematicLanding

## Examples

**Example 1: Full brand research**
```
User: "do a brand deep dive on Linear"
-> Routes to Research workflow
-> Spawns 9 agents across 3 providers (Claude, Gemini, Perplexity)
-> Each researches a distinct dimension: taxonomy, typography, color, motion, audience, competition, anti-patterns, cultural codes, dev tool patterns
-> Synthesizes into a unified brand research report
```

**Example 2: Define brand for a new product**
```
User: "define the brand for my developer analytics tool"
-> Routes to Define workflow
-> Produces: brand core (mission, vision, values, archetype), positioning, voice guidelines
-> Outputs three-layer token architecture: color system (OKLCH), typography hierarchy, motion language
-> Maps every visual decision to a brand personality trait
```

**Example 3: Prepare for landing page**
```
User: "prepare brand handoff for the landing page"
-> Routes to Handoff workflow
-> Reads brand definition and implementation files
-> Produces: color arc table, typography scale, narrative architecture template, motion tokens by tier
-> Output is structured to feed directly into CinematicLanding create-prd
```

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

echo '{"timestamp":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","pack":"Brand","workflow":"WORKFLOW_NAME","type":"ARTIFACT_TYPE","title":"TITLE","path":"ABSOLUTE_PATH","contentPreview":"FIRST_500_CHARS_ESCAPED","wing":"WING_OR_GENERAL","sessionId":"'$CLAUDE_SESSION_ID'"}' >> "$ARTIFACTS_DIR/artifacts.jsonl"
```

If this skill is read-only (no Write tool usage), this section is informational only.

**Artifact types for Brand:** `brand-research`, `brand-strategy`, `brand-tokens`, `design-doc`, `logo`, `icon-set`, `brand-handoff`, `brand-audit`, `brandscript`, `brand-guidelines`

## Four-Copy Compliance

This skill exists in up to four locations per the DOS Four-Copy Rule (`Durante/CLAUDE.md`):

1. `~/.claude/skills/brand/` — live install (what Claude Code runs)
2. `Releases/<active-version>/.claude/skills/brand/` — active release submodule (versioned)
3. `Packs/*/src/Brand/` — pack source (distributable)
4. `Packs/agents/Brand/` — agent runtime (only if applicable)

After editing any file in this skill, verify all copies via `bun ~/Durante/Tools/sync-check.ts`. Exit code 0 = clean. Exit code 1 = drift; resolve with `--fix` before commit.
