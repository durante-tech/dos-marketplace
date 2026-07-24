---
name: DesignSystem
description: Extract, initialize, manage, and apply AI-native design systems via a DESIGN.md file. Deterministic UI generation from semantic design tokens -- colors, typography, spacing, and component blueprints. Accepts brand token specs from brand skill. USE WHEN create a design system, extract design from URL, build component using design system, audit UI against design system, update primary color, component library, UI kit, style guide, design tokens, shadcn components, DESIGN.md, brand to design system. NOT for defining brand tokens (use Brand) or adding animations/micro-interactions (use MotionPrimitives).
role: extractor
accepts:
  - text
icon: Palette
colorVar: tertiary
colorHex: "#ffb95a"
tier: secondary
category: Engineering
displayLabel: Design System
marketingDescription: Design tokens, colors, typography for deterministic UI
elevator: AI-native design system with semantic tokens
highlightWorkflows:
  - name: Extract System
    technicalName: ExtractSystem
  - name: Generate Tokens
    technicalName: GenerateTokens
  - name: Apply Theme
    technicalName: ApplyTheme
roots:
  - PROJECT.ARTIFACTS
  - PROTECTED_LOCAL
sot_domains:
  - brand
derivative_workflows:
  - Workflows/Init
  - Workflows/Update
visibility: public
capabilities:
  - artifact.write
  - customization.cascade
  - four-copy.sync
composes: [Brand, MotionPrimitives]
---
<!-- generated-from: SKILL.partials.md — DO NOT EDIT directly. Run: bun Tools/dos-build.ts skill <path> -->
# DesignSystem

AI-native design system management via the DESIGN.md paradigm. Treats design systems as AI-readable markdown specifications containing semantic design tokens and component rules, enabling deterministic and consistent UI generation.

## Core Concepts

1. **The DESIGN.md File** -- A strict, agent-friendly markdown specification mapping out Colors, Typography, Spacing, and Component Blueprints. Lives at the project root.
2. **Deterministic UI Generation** -- When generating UI code, ALWAYS read DESIGN.md first and strictly apply the tokens (e.g., mapping `brand-primary` to the correct CSS variable or Tailwind class). No hallucinating colors.
3. **Semantic Naming** -- All tokens use semantic names (e.g., `brand-primary`, `neutral-surface`, `text-muted`) not raw values.
4. **Three-Layer Tokens** -- Option (raw values) -> Decision (semantic assignments) -> Component (applied patterns).

## Numeric-Thresholded Principles (NEW 2026-05-15, D24)

Codified principles with **numeric thresholds + research citations**. Pattern adopted from `ItsssssJack/power-design` (GitHub Trending 2026-05-03, 235⭐). Turns qualitative design guidance into deterministic pass/fail gates that AI generation can audit at output time and Sentinel can audit at scan time.

Each principle: **name** · **threshold** · **citation** · **applies-to** · **failure mode it prevents**.

| Principle | Threshold | Citation | Applies To | Prevents |
|---|---|---|---|---|
| **Color contrast — normal text** | ≥ 4.5:1 (WCAG AA) | WCAG 2.2 §1.4.3 | Body copy, links inline with text | Illegibility for low-vision readers |
| **Color contrast — large text** | ≥ 3.0:1 (WCAG AA) | WCAG 2.2 §1.4.3 | Headings ≥ 18pt regular OR ≥ 14pt bold | Headline contrast violations |
| **Color contrast — non-text** | ≥ 3.0:1 (WCAG AA) | WCAG 2.2 §1.4.11 | Button borders, focus rings, icon glyphs | Boundary/focus invisibility |
| **Cognitive chunking** | ≤ 7 ± 2 items per group | Miller (1956) "The Magical Number Seven" | Nav menus, card grids, option lists, table-of-contents | Working-memory overflow |
| **Whitespace ratio** | ≥ 40% on hero / landing surfaces | Editorial design heritage (Bringhurst, Tufte) | Marketing pages, hero sections, decks | Cluttered-feeling pages that hurt conversion |
| **Reading line length** | 45-75 characters (~60 optimal) | Bringhurst *Elements of Typographic Style* §2.1.2 | Body copy paragraphs, blog posts, docs | Line-tracking fatigue, slower reading |
| **Tap target — touch** | ≥ 44 × 44 pt (iOS) / ≥ 48 × 48 dp (Android Material) | Apple HIG / Material Design | Buttons, links, form controls on touch surfaces | Fitts's-law touch errors |
| **Color count — primary palette** | ≤ 5 distinct hues | Tufte *Envisioning Information* (data-ink ratio) | Brand/UI palette declarations | Visual noise, decision fatigue |
| **Typography stack — font count** | ≤ 2 type families | Reynolds *Presentation Zen* + Bringhurst | A single product surface | Visual incoherence, slow page-load |
| **Line height (leading)** | 1.4-1.6× font size for body | Bringhurst §2.1.4 | Body copy | Cramped or floaty text blocks |
| **Animation duration** | 150-400ms for UI feedback | Material Motion + Apple HIG | Hover, focus, tap micro-interactions | Sluggish-feeling UI OR distracting overcorrection |
| **First Contentful Paint** | ≤ 1.8s for "good" (Core Web Vitals) | Google Web Vitals | Landing pages | Bounce-rate cliff |
| **Cumulative Layout Shift** | ≤ 0.1 for "good" | Google Web Vitals | Above-the-fold render | Reader frustration / accidental clicks |

**Application:** When generating UI code via this skill, evaluate each thresholded principle against the produced artifact. Surface failures as **deterministic warnings** in the generation output (not just "this looks off"). Operators can override per-component via DESIGN.md `_design_overrides:` block; overrides MUST cite the rationale.

**Sentinel hook candidate (follow-up sprint):** scan-time R-rule that parses DESIGN.md + emitted CSS/HTML and audits contrast + tap-target + whitespace ratios against this table. Tracked as v0.0.17 candidate.

**Why this pattern:** the DOS council-specialist packs (UncleBob/Fowler/Feathers/etc.) already codify code-design principles with citations to specific books + sections. This brings the same discipline to *visual* design — numeric thresholds let AI generation and human review converge on the same answer.

## Customization

**Before executing, check for user customizations at:**
`~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/DesignSystem/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.

## Workflow Routing

| Workflow | Trigger | File |
|----------|---------|------|
| Init | Create design system, extract design from URL, initialize, new DESIGN.md, brand to design system | `Workflows/Init.md` |
| Update | Change color, update font, modify spacing, edit token, update DESIGN.md | `Workflows/Update.md` |
| Generate | Build component, generate UI, create page, component using design system | `Workflows/Generate.md` |
| Audit | Audit UI, check consistency, find hardcoded values, lint styles | `Workflows/Audit.md` |

**shadcn output (framework-conditional — backs the "shadcn components" trigger):** When the target project is a shadcn/ui project (a `components.json` is present), the Generate workflow emits shadcn-registry-compatible components and can consume a DesignBundle `registry.json` as its token source. shadcn is ONE framework option alongside Tailwind, CSS Modules, vanilla CSS, and styled-components — selecting it never narrows the skill's reach to those other targets. If a project is not shadcn-based, Generate emits in the project's actual framework instead.

## Examples

**Example 1: Create a design system from scratch**
```
User: "create a design system for my app -- dark mode, blue primary, Inter font"
-> Routes to Init workflow
-> Generates DESIGN.md with OKLCH color palette, typography scale, spacing, component blueprints
-> Saves DESIGN.md to project root
```

**Example 2: Generate a component using the design system**
```
User: "build a pricing card component"
-> Routes to Generate workflow
-> Reads DESIGN.md first (mandatory)
-> Maps tokens to CSS variables / Tailwind classes
-> Generates code using ONLY defined tokens -- no hallucinated values
```

**Example 3: Audit existing code for violations**
```
User: "check if my components follow the design system"
-> Routes to Audit workflow
-> Reads DESIGN.md, scans codebase for hardcoded hex codes, font families, spacing values
-> Reports violations with file/line references
-> Optionally auto-fixes by replacing hardcoded values with tokens
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

echo '{"timestamp":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","pack":"DesignSystem","workflow":"WORKFLOW_NAME","type":"ARTIFACT_TYPE","title":"TITLE","path":"ABSOLUTE_PATH","contentPreview":"FIRST_500_CHARS_ESCAPED","wing":"WING_OR_GENERAL","sessionId":"'$CLAUDE_SESSION_ID'"}' >> "$ARTIFACTS_DIR/artifacts.jsonl"
```

If this skill is read-only (no Write tool usage), this section is informational only.

## Four-Copy Compliance

This skill exists in up to four locations per the DOS Four-Copy Rule (`Durante/CLAUDE.md`):

1. `~/.claude/skills/design-system/` — live install (what Claude Code runs)
2. `Releases/<active-version>/.claude/skills/design-system/` — active release submodule (versioned)
3. `Packs/*/src/DesignSystem/` — pack source (distributable)
4. `Packs/agents/DesignSystem/` — agent runtime (only if applicable)

After editing any file in this skill, verify all copies via `bun ~/Durante/Tools/sync-check.ts`. Exit code 0 = clean. Exit code 1 = drift; resolve with `--fix` before commit.
