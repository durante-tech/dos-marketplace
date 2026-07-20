---
name: Art
description: Generate illustrations, technical diagrams, mermaid flowcharts, infographics, header images, thumbnails, comics, and DOS pack icons using multiple rendering backends. USE WHEN art, header images, visualizations, mermaid, flowchart, technical diagram, infographic, DOS icon, pack icon, YouTube thumbnails, ad hoc thumbnails, annotated screenshots, aphorisms, comics, comparisons, D3 dashboards, embossed logo wallpaper, essay illustration, frameworks, maps, recipe cards, remove background, stats, taxonomies, timelines, brand wallpaper, visualize, generate image, Midjourney, compose thumbnail, generate prompt.
role: generator
accepts:
  - text
roots:
  - PROJECT.ARTIFACTS
visibility: public
capabilities:
  - voice.emit
---
<!-- generated-from: SKILL.partials.md — DO NOT EDIT directly. Run: bun Tools/dos-build.ts skill <path> -->
# Art Skill

Complete visual content system for creating illustrations, diagrams, and visual content.

## Customization

**Before executing, check for user customizations at:**
`~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/Art/`

If this directory exists, load and apply:
- `PREFERENCES.md` - Aesthetic preferences, default model, output location
- `CharacterSpecs.md` - Character design specifications
- `SceneConstruction.md` - Scene composition guidelines

These override default behavior. If the directory does not exist, proceed with skill defaults.

## 🚨🚨🚨 MANDATORY: Output to Downloads First 🚨🚨🚨

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️  ALL GENERATED IMAGES GO TO ~/Downloads/ FIRST                   ⚠️
⚠️  NEVER output directly to project directories                    ⚠️
⚠️  User MUST preview in Finder/Preview before use                  ⚠️
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**This applies to ALL workflows in this skill.**

## Brand Token Resolution (applies to ALL workflows)

Before producing any brand-colored output, resolve colors from the project's brand tokens rather than this skill's hardcoded defaults:

1. **Prefer** a project-root `brand-tokens.json` (the canonical W3C DTCG 2025.10 artifact emitted by the brand skill's `Implementation/TokenSpec`). Bind text/accent/background to its decision-layer color groups (`$type`/`$value`).
2. **Fall back** to the companion `brand-token-spec.md`, then to each workflow's labeled default palette below.
3. **Accessibility:** for any text-bearing output, verify the chosen foreground/background pair meets **WCAG 4.5:1** contrast AND **APCA |Lc| ≥ 60**; pick the higher-contrast default if a brand pair fails.

This applies to ALL workflows — the per-workflow palettes are defaults, used only when no project brand tokens are present.

## Workflow Routing

Route to the appropriate workflow based on the request.

  - Remove background from image → `Workflows/RemoveBackground.md`
  - Brand wallpaper with logo integration → `Workflows/BrandWallpaper.md`
  - YouTube thumbnail checklist → `Workflows/YouTubeThumbnailChecklist.md`
  - Blog header or editorial illustration → `Workflows/Essay.md`
  - D3.js interactive chart or dashboard → `Workflows/D3Dashboards.md`
  - Visualization or unsure which format → `Workflows/Visualize.md`
  - Mermaid flowchart or sequence diagram → `Workflows/Mermaid.md`
  - Technical or architecture diagram → `Workflows/TechnicalDiagrams.md`
  - Taxonomy or classification grid → `Workflows/Taxonomies.md`
  - Timeline or chronological progression → `Workflows/Timelines.md`
  - Framework or 2x2 matrix → `Workflows/Frameworks.md`
  - Comparison or X vs Y → `Workflows/Comparisons.md`
  - Annotated screenshot → `Workflows/AnnotatedScreenshots.md`
  - Recipe card or step-by-step → `Workflows/RecipeCards.md`
  - Aphorism or quote card → `Workflows/Aphorisms.md`
  - Conceptual map or territory → `Workflows/Maps.md`
  - Stat card or big number visual → `Workflows/Stats.md`
  - Comic or sequential panels → `Workflows/Comics.md`
  - YouTube thumbnail (with existing assets) → `Workflows/YouTubeThumbnailChecklist.md`
  - Ad-hoc YouTube thumbnail (generate from content) → `Workflows/AdHocYouTubeThumbnail.md`
  - DOS pack icon → `Workflows/CreateDOSPackIcon.md`
  - Edit existing image with natural language → `Workflows/ImageEdit.md`
  - Compare models side-by-side on same prompt → `Workflows/ModelBakeoff.md`
  - Maintain style/character across images with refs → `Workflows/StyleTransfer.md`

---

## Core Aesthetic

**Default: DOS Blueprint** — engineering-blueprint / technical-drawing aesthetic for visualizing DOS system design. DOS primitives (ports, hooks, packs, gates, the Algorithm, knowledge graph, write/read paths, gateway, sync tools, MEMORY/, Studio) are rendered as drafted, measured, callout-labelled engineered objects.

**The three load-bearing colors:**
- **BLUEPRINT NAVY `#1E3A8A`** — line work, grid, structural elements (dominant 65–75%)
- **WARM-WHITE PAPER `#FEF7E0`** — substrate / drawing field (20–30%; --remove-bg overrides for compositing)
- **HOT ACCENT ORANGE `#F97316`** — the focus element, the hot path, the one thing the diagram is about (5–10%)

**Technique:** drafted geometric linework, varying weight by element importance, 45° parallel hatching where shading needed (never cross-hatching, never charcoal). Dimension callouts, leader arrows, monospace labels.

**References:** patent diagrams, NASA technical drawings, SpaceX engineering renderings, Edward Tufte's information design, vintage Bell Labs schematics, ISO/ANSI engineering-drawing conventions.

**Forbidden:** charcoal sketch, gestural overlapping lines, painterly washes, generic AI-stock-art aesthetic, legacy `#8B4513` sienna / `#4A148C` purple palettes.

**User customization (override seam):** Operators may override the default by populating `~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/Art/PREFERENCES.md`. This file may redefine:
- Visual style and influences
- Line treatment and rendering approach
- Color palette and accent technique
- Character / figure design specifications
- Scene composition rules

When `PREFERENCES.md` exists, its values override the DOS Blueprint defaults. When absent, the DOS Blueprint defaults above apply unconditionally.

**Load from:** `~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/Art/PREFERENCES.md`

---

## Reference Images

**User customization** may include reference images for consistent style.

Check `~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/Art/PREFERENCES.md` for:
- Reference image locations
- Style examples by use case
- Character and scene reference guidance

**Usage:** Before generating images, load relevant user-provided references to match their preferred style.

---

## Image Generation — Collections Pattern

**Default model:** Check user customization at `SKILLCUSTOMIZATIONS/Art/PREFERENCES.md`
**Fallback:** nano-banana-pro (Gemini 3 Pro)

### Available Models

| Model | Provider | Strengths | Ref Images | Size Format |
|-------|----------|-----------|------------|-------------|
| `flux` | Replicate | Reliable baseline, fast | No | Aspect ratio |
| `flux-2-pro` | Replicate | Next-gen, JSON prompts | Up to 8 | Aspect ratio |
| `flux-2-max` | Replicate | Highest quality Flux, cinematic | Up to 8 | Aspect ratio |
| `nano-banana` | Replicate | Lightweight Google model | No | Aspect ratio |
| `nano-banana-replicate` | Replicate | 4K, multilingual text | Up to 14 | Aspect ratio |
| `seedream` | Replicate | Cinematic film visuals (ByteDance) | Up to 14 | Aspect ratio |
| `imagen-4-ultra` | Replicate | Fine detail, typography (Google) | No | Aspect ratio |
| `grok-imagine` | Replicate | Text rendering, ~4s (xAI) | 1 (edit) | Aspect ratio |
| `nano-banana-pro` | Gemini API | Reference images, 4K, editing | Up to 14 | Resolution (1K/2K/4K) |
| `gpt-image-1` | OpenAI | Versatile, good text rendering | No | Pixels |

### Model Selection Guide

| Use Case | Recommended Model |
|----------|------------------|
| Blog headers (default) | `nano-banana-pro` (Gemini) or `seedream` |
| Cinematic / film quality | `flux-2-max` or `seedream` |
| Fast iteration / drafts | `flux` or `nano-banana` |
| Character consistency (refs) | `nano-banana-pro` or `flux-2-pro` |
| Fine detail / typography | `imagen-4-ultra` |
| Speed (~4s) | `grok-imagine` |
| Image editing | `grok-imagine` (single image) or `flux-2-pro` (multi-ref) |

### Intent-to-Flag Mapping

| User Says | Flag | When to Use |
|-----------|------|-------------|
| "fast", "quick", "draft" | `--model flux` | Fast iteration |
| (default), "best quality" | `--model nano-banana-pro` | Best for workflows with refs |
| "cinematic", "film-like" | `--model seedream` | Cinematic aesthetics |
| "highest quality", "max" | `--model flux-2-max` | Maximum Flux quality |
| "detail", "typography" | `--model imagen-4-ultra` | Fine detail + text |
| "reference images", "edit" | `--model flux-2-pro` | Multi-reference editing |
| "text rendering", "poster" | `--model grok-imagine` | Fast text in images |

### Size Formats by Provider

| Provider | `--size` format | Valid values | Default |
|----------|----------------|--------------|---------|
| Replicate models | Aspect ratio | `1:1`, `16:9`, `3:2`, `2:3`, `3:4`, `4:3`, `4:5`, `5:4`, `9:16`, `21:9` | `16:9` |
| `nano-banana-pro` (Gemini) | Resolution + `--aspect-ratio` | `1K`, `2K`, `4K` | `2K` |
| `gpt-image-1` (OpenAI) | Pixel dimensions | `1024x1024`, `1536x1024`, `1024x1536` | `1024x1024` |

### 🚨 CRITICAL: Always Output to Downloads First

**ALL generated images MUST go to `~/Downloads/` first for preview and selection.**

```bash
bun run ~/.claude/skills/media/Art/Tools/Generate.ts \
  --model seedream \
  --prompt "[PROMPT]" \
  --size 16:9 \
  --thumbnail \
  --output ~/Downloads/blog-header-concept.png
```

### Reference Images (Model-Aware)

Models that support `--reference-image` have different limits:

| Model | Param | Max Images |
|-------|-------|-----------|
| `flux-2-pro` / `flux-2-max` | `input_images` | 8 |
| `seedream` / `nano-banana-replicate` | `image_input` | 14 |
| `nano-banana-pro` (Gemini) | Inline data | 14 |
| `grok-imagine` | `image` (edit) | 1 |

```bash
# Flux 2 Pro with reference images (URLs required)
bun run ~/.claude/skills/media/Art/Tools/Generate.ts \
  --model flux-2-pro \
  --prompt "Character from references in a modern office..." \
  --reference-image https://example.com/face1.jpg \
  --reference-image https://example.com/face2.jpg \
  --consent-attested \
  --size 16:9

# Nano Banana Pro (Gemini) with local file references
bun run ~/.claude/skills/media/Art/Tools/Generate.ts \
  --model nano-banana-pro \
  --prompt "Person from references at a party..." \
  --reference-image face1.jpg --reference-image face2.jpg --consent-attested \
  --size 2K --aspect-ratio 16:9
```

### Environment Variables

| Variable | Required For |
|----------|-------------|
| `STUDIO_API_KEY` | All models (via Studio gateway) |

## Examples

**Example 1: Blog header image**
```
User: "create a header for my AI agents post"
→ Invokes ESSAY workflow
→ Generates DOS Blueprint prompt (drafted geometric linework — per the aesthetic doctrine above)
→ Creates image with architectural aesthetic
→ Saves to ~/Downloads/ for preview
→ After approval, copies to public/images/
```

**Example 2: Technical architecture diagram**
```
User: "make a diagram showing the SPQA pattern"
→ Invokes TECHNICALDIAGRAMS workflow
→ Creates structured architecture visual
→ Outputs PNG with consistent styling
```

**Example 3: Comparison visualization**
```
User: "visualize humans vs AI decision-making"
→ Invokes COMPARISONS workflow
→ Creates side-by-side visual
→ Blueprint linework with labeled elements
```

**Example 4: DOS pack icon**
```
User: "create icon for the skill system pack"
→ Invokes CREATEDOSPACKICON workflow
→ Reads workflow from Workflows/CreateDOSPackIcon.md
→ Generates 1K image with --remove-bg for transparency
→ Resizes to 256x256 RGBA PNG
→ Outputs to ~/Downloads/ for preview
→ After approval, copies to ${PROJECTS_DIR}/DOS/Packs/icons/
```
