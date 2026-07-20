---
name: Visual Brief
description: Has Dream Team visual experts (Visual Designer, Brand Strategist, 3D Artist) produce a structured, human-approved visual asset brief that the media skill then executes and deploys.
status: STABLE
bestPath:
  - title: "Need Identification"
    description: "Capture the visual asset need surfaced by a reviewing expert."
  - title: "Expert Brief Fan-Out"
    description: "Spawn the Visual Designer, Brand Strategist, and 3D Artist via the Agent tool."
  - title: "Brief Synthesis"
    description: "Merge the expert contributions into one unified visual brief."
  - title: "Human Approval"
    description: "Present the complete brief for approval, modification, or rejection before generation."
  - title: "Generation & Deploy"
    description: "Generate via the media skill, run post-processing, and deploy the assets."
---

# DreamTeam Visual Brief

**Mode:** Experts spec visual assets, human approves, media skill executes | **Time:** 5-15 min

## When to Use

- Logo evaluation or redesign
- Brand asset creation (social media packs, OG images, marketing visuals)
- Section-specific visual enhancements (hero art, section backgrounds)
- Icon or illustration needs surfaced during section reviews
- Any time an expert says "this section needs a visual" or "the logo should change"

## Why Experts Spec, Not Generate

AI image generation requires iteration. The dream team's value is in the **brief** -- knowing exactly what an asset needs to accomplish, what style matches the brand, what sizes are needed, and which model will produce the best result. The human approves the brief, then generation happens with full control.

## The Visual Brief Format

When a dream team expert recommends a visual asset, they produce a structured brief:

```yaml
VISUAL BRIEF
============
Asset: [what it is -- logo mark, section background, icon, OG image, etc.]
Purpose: [what it needs to accomplish -- brand recognition, trust signal, visual interest]
Style: [specific visual direction -- low-poly geometric, flat minimal, photorealistic, etc.]

Reference Images:
  - [path to existing asset for consistency]
  - [path to style reference if available]

Capability Intent (NOT a model id — Media resolves the current model at generation):
  Primary intent: [capability tag] -- [why this intent fits the asset]
  Fallback intent: [alternative capability tag]

Capability-intent vocabulary (provider-stable; the media skill maps each to the current best model):
  - reference-consistency  -- match existing brand assets from reference images
  - text-in-image          -- logo / icon / banner with rendered text
  - artistic-stylized      -- illustration / stylized art
  - photoreal              -- photo-realistic product or scene shot
  - fast-draft             -- quick, low-cost iteration
  - vector-output          -- SVG / vector paths
  - style-transfer         -- apply a reference image's style

Sizes Needed:
  - [size1]: [usage -- e.g., "128x128 for header icon"]
  - [size2]: [usage -- e.g., "32x32 for favicon"]
  - [size3]: [usage -- e.g., "1200x630 for OG image"]

Color Requirements:
  - Primary: [color hex or CSS variable]
  - Background: [transparent / white / dark / specific color]
  - Must work in: [light mode / dark mode / both]

Post-Processing:
  - [ ] Background removal (rembg or manual)
  - [ ] Resize to multiple sizes (ImageMagick)
  - [ ] Format conversion (webp for web, png for transparency)
  - [ ] Favicon generation (16px + 32px + .ico)
  - [ ] Trim/crop whitespace

Prompt Draft:
  "[detailed prompt for image generation]"

Negative Prompt (if applicable):
  "[what to avoid]"
```

## Execution

### Step 1: Identify the Visual Need

During a section-review or full review, an expert recommends a visual change. Examples:
- "The logo should use the fox mark" -- triggers logo brief
- "This section needs a hero illustration" -- triggers illustration brief
- "The OG image is missing" -- triggers OG image brief
- "The favicon doesn't match the new brand" -- triggers favicon brief

### Step 2: Spawn the Visual Experts

For visual briefs, use the **Agent tool** to run the extended panel (not just core trio):

| Expert | Role in Brief |
|--------|---------------|
| Visual Designer | Art direction, composition, style, model selection |
| Brand Strategist | Brand consistency, color alignment, positioning |
| 3D/Visual Artist | Technical execution, reference image strategy, 3D considerations |

Task template:
```
VISUAL BRIEF REQUEST

You are the [ROLE]. We need a visual asset.

NEED: [what's needed]
CURRENT STATE: [what exists now, if anything]
BRAND CONTEXT: [colors, style, visual signature]
REFERENCE IMAGES AVAILABLE: [list paths]

Produce a VISUAL BRIEF section for your expertise area:
- Visual Designer: art direction, composition, style, size requirements
- Brand Strategist: color alignment, positioning, consistency with brand story
- 3D Artist: model recommendation, reference image strategy, technical approach

Format as structured YAML. 100-150 words.
```

### Step 3: Merge into Single Brief

Combine the 3 expert contributions into one unified brief. Resolve any conflicts.

### Step 4: Present to Human for Approval

Show the complete brief. The human approves, modifies, or rejects before any generation.

### Step 5: Generate (via Media Skill)

Once approved, execute using the **media skill** with the specified model, prompt, references, and output path. Then run post-processing (background removal, resize, format conversion).

### Step 6: Deploy

Move generated assets to the correct paths, update code references, verify in-browser.

## Post-Processing Pipeline

After generation, the standard pipeline:

```bash
# 1. Background removal (if needed)
rembg i input.png output-transparent.png

# 2. Trim whitespace
magick output-transparent.png -trim +repage trimmed.png

# 3. Resize to needed sizes
magick trimmed.png -resize 128x128 icon-128.webp
magick trimmed.png -resize 32x32 icon-32.webp
magick trimmed.png -resize 16x16 icon-16.png

# 4. Favicon generation
magick icon-16.png icon-32.png favicon.ico

# 5. Format conversion
magick input.png -quality 85 output.webp
```

## Model resolution — owned by the media skill (do NOT embed model ids here)

DreamTeam carries **capability intent**, not model ids. The image-model catalog is owned by the **Media** skill (`Packs/media/src/Lib/catalog.ts` is the source of truth); model ids rename frequently, so embedding a snapshot here guarantees drift. At Step 5 the media skill resolves each capability-intent tag to the current best model:

| Capability intent | What it asks Media for |
|---|---|
| `reference-consistency` | match existing brand assets from reference images |
| `text-in-image` | a logo / icon / banner with rendered text |
| `artistic-stylized` | illustration / stylized art |
| `photoreal` | a photo-realistic product or scene shot |
| `fast-draft` | a quick, low-cost iteration |
| `vector-output` | SVG / vector paths |
| `style-transfer` | apply a reference image's style |

Pass the intent + the style/size/purpose; Media picks the model. (The brief is text-output, human-approved before generation, so the capability tag is advisory and safe even if Media's intent flags lag.)

## Validation

- [ ] Brief reviewed and approved by human before generation
- [ ] Generated assets checked visually before deployment
- [ ] All size variants created and verified
- [ ] Light and dark mode variants tested
- [ ] Code references updated to use new assets
- [ ] Old assets preserved (renamed, not deleted) for rollback