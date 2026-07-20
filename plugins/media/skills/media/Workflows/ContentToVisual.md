---
name: Content To Visual
description: Transform a blog post or essay into a complete multimedia package — key scene illustrations plus a narrated version.
status: STABLE
bestPath:
  - title: "Analyze Source Content"
    description: "Read the source material and identify title, word count, core argument, and tone."
  - title: "Extract Key Visual Scenes"
    description: "Apply Create Story Explanation (CSE) to pull 3-5 pivotal, sequentially ordered visual moments."
  - title: "Generate Illustrations & Narration"
    description: "Produce one illustration per scene and a full narrated audio track of the content."
  - title: "Output Numbered Set"
    description: "Deliver the scenes and narration as a cohesive numbered asset package ready for distribution."
divergence_from_canonical:
  _intent-to-flag-table.md:
    partial_version: 1.0.0
    reason: "Media ContentToVisual workflow uses workflow-specific intent-to-flag vocabulary; canonical Mode/Output two-table shape doesn't fit"
---

# ContentToVisual Workflow

## When to Use

- User wants to turn a blog post, essay, article, or newsletter into illustrations plus narration
- User says "turn this into a visual package", "illustrate this article", "content to visual"
- NOT for a single standalone image (use `Art/SKILL.md` directly) or narration-only (use `Speech/SKILL.md` → Narrate)

**Transform a blog post or essay into a complete multimedia package: key scene illustrations + narrated version.**

<!-- partial: _workflow-voice.md skill_name=Media workflow_name=ContentToVisual action_phrase=" to create illustrations and narration from written content" -->

## Purpose

Turn long-form written content (blog posts, essays, articles, newsletters) into a rich multimedia package. This compound workflow chains the Art skill (scene illustrations) with the Speech skill (full narration) to produce a numbered asset set ready for social distribution, presentations, or enhanced blog posts.

---

## Workflow Steps

### Step 1: Read and Analyze Source Content

Read the source material provided by the user (file path, URL, or pasted text).

```bash
# If source is a local file
cat ~/path/to/blog-post.md
```

Identify:
- **Title and subtitle** of the piece
- **Total word count** (affects narration model choice)
- **Core argument or thesis**
- **Tone** (technical, narrative, persuasive, reflective)

---

### Step 2: Extract Key Visual Scenes (CSE)

Apply **Create Story Explanation (CSE)** to extract 3-5 pivotal visual moments from the content. Each scene must be:

1. **Visually concrete** -- describable as a single image
2. **Narratively significant** -- represents a key turning point or concept
3. **Sequentially ordered** -- follows the content's logical flow

Output format:
```
Scene 1: [Title] -- [2-sentence visual description]
Scene 2: [Title] -- [2-sentence visual description]
Scene 3: [Title] -- [2-sentence visual description]
...
```

For content under 800 words, extract 3 scenes. For 800-2000 words, extract 4. For 2000+ words, extract 5.

---

### Step 3: Generate Scene Illustrations

Generate one illustration per scene. Choose the aesthetic approach:

**Option A: Charcoal Architectural Sketch (default for essays)**

Uses the Essay workflow's charcoal aesthetic -- gestural lines, hatching, charcoal texture with burnt sienna (#8B4513) warmth and deep purple (#4A148C) technology accents.

```bash
bun run ~/.claude/skills/media/Art/Tools/Generate.ts \
  --model seedream \
  --prompt "Charcoal architectural sketch style. Gestural lines, hatching, textured paper. [SCENE_DESCRIPTION]. Burnt sienna warmth accents, deep purple technology accents. Signed small charcoal bottom-right." \
  --size 16:9 \
  --output ~/Downloads/content-visual-[slug]-scene-01.png
```

**Option B: User-specified model/aesthetic**

If the user requests a different style, use the appropriate model:

```bash
# Cinematic film style
bun run ~/.claude/skills/media/Art/Tools/Generate.ts \
  --model seedream \
  --prompt "[SCENE_DESCRIPTION]. Cinematic lighting, film grain, rich color palette." \
  --size 16:9 \
  --output ~/Downloads/content-visual-[slug]-scene-01.png

# Maximum detail
bun run ~/.claude/skills/media/Art/Tools/Generate.ts \
  --model flux-2-max \
  --prompt "[SCENE_DESCRIPTION]. Hyper-detailed, editorial quality." \
  --size 16:9 \
  --output ~/Downloads/content-visual-[slug]-scene-01.png
```

Generate all scenes sequentially, numbered `scene-01` through `scene-05`.

---

### Step 4: Generate Full Narration

Use `replicate-minimax-hd` for long-form narration quality. This model handles extended text, multiple languages, and produces audiobook-grade output.

```bash
bun run ~/.claude/skills/media/Speech/Tools/Speak.ts \
  --model replicate-minimax-hd \
  --text "[FULL_ARTICLE_TEXT]" \
  --output ~/Downloads/content-visual-[slug]-narration.mp3
```

**Model selection by content length:**

| Content Length | Recommended Model | Reason |
|---------------|------------------|--------|
| Under 500 words | `replicate-minimax-turbo` | Fast, sufficient quality |
| 500-3000 words | `replicate-minimax-hd` | Audiobook quality, pacing |
| 3000+ words | `replicate-minimax-hd` | Long-form stability |
| Portuguese content | `replicate-minimax-hd --language pt` | Multilingual support |

For very long content (3000+ words), consider splitting into logical sections and generating multiple audio files.

---

### Step 5: Output Numbered Set

All assets output to `~/Downloads/` as a cohesive numbered set:

```
~/Downloads/content-visual-[slug]-scene-01.png
~/Downloads/content-visual-[slug]-scene-02.png
~/Downloads/content-visual-[slug]-scene-03.png
~/Downloads/content-visual-[slug]-scene-04.png   (if applicable)
~/Downloads/content-visual-[slug]-scene-05.png   (if applicable)
~/Downloads/content-visual-[slug]-narration.mp3
```

```bash
# Open all images for review
open ~/Downloads/content-visual-[slug]-scene-*.png

# Play narration
afplay ~/Downloads/content-visual-[slug]-narration.mp3
```

Report to the user:
- Number of scenes extracted and illustrated
- Model and aesthetic used for each image
- Narration duration and model
- Suggested uses (blog enhancement, social carousel, presentation slides, video B-roll)

---

## Port form (RFC-0031 Phase 1.B)

For single-image generations outside the multi-scene CSE flow above, prefer the `image.generate` Port at `Tools/dos-image.ts`. The Port routes intent → Adapter (Flux / NanoBanana / GPTImage / Replicate) and subprocess-calls this same `Generate.ts` Adapter under the hood — same Studio gateway, same credit metering, same artifact tracking. Skills/workflows emit *intent*, not *vendor*.

```bash
# Header banner — Port routes to Flux 1.1 Pro
bun Tools/dos-image.ts "AI agents in the modern enterprise" \
  --intent=header-banner \
  --output=~/Downloads/blog-header.png \
  --size=16:9 \
  --telemetry-tag=Media/ContentToVisual

# Diagram — Port routes to GPT-Image-1 (best text rendering)
bun Tools/dos-image.ts "system architecture: web → API → Studio gateway → providers" \
  --intent=diagram \
  --output=~/Downloads/architecture.png \
  --size=1024x1024

# Comic panel — Port routes to Replicate (seedream)
bun Tools/dos-image.ts "founder explaining intent vocabulary to operator" \
  --intent=comic-panel \
  --output=~/Downloads/comic-01.png \
  --size=3:2

# Draft thumbnail — Port routes to Nano Banana (cheap+fast)
bun Tools/dos-image.ts "thumbnail concept: orange charcoal sketch of architecture" \
  --intent=draft-thumbnail \
  --output=~/Downloads/thumb-draft.png \
  --size=1:1
```

Use the Port form when:
- A single image at a single intent (no scene chaining)
- Telemetry attribution matters (`--telemetry-tag` records the caller in `MEMORY/ARTIFACTS/dos-router-telemetry.jsonl`)
- The caller is bash / agent CLI / external workflow (not a Skill that wants the full multi-scene pipeline)

Use the Generate.ts CLI form (above) when:
- Multi-scene chaining (CSE flow with 3-5 scenes per content piece)
- `--reference-image`, `--remove-bg`, `--thumbnail`, `--creative-variations` flags (Port doesn't surface these yet)
- Provider-specific tuning (`--model flux-2-max`, `--model imagen-4-ultra`)

## Intent-to-Flag Mapping

| User Says | Art Action | Speech Action |
|-----------|-----------|---------------|
| "charcoal", "sketch" | Essay charcoal aesthetic | (default) |
| "cinematic", "film" | `--model seedream` cinematic prompt | (default) |
| "maximum quality" | `--model flux-2-max` | `--model replicate-minimax-hd` |
| "fast", "quick" | `--model flux` | `--model replicate-minimax-turbo` |
| "Portuguese" | (default) | `--language pt` |
| "no narration" | Generate images only | Skip speech |
| "no images" | Skip images | Generate narration only |
| "carousel" | `--size 1:1` (square) | (default) |
| "presentation" | `--size 16:9` | (default) |

---

## Examples

**Example 1: Essay to multimedia package**
```
User: "Turn my blog post about AI agents into a visual package"
-> Reads blog post, extracts 4 key scenes via CSE
-> Generates 4 charcoal-style illustrations (16:9, seedream)
-> Generates full narration with minimax-hd
-> Outputs: content-visual-ai-agents-scene-01..04.png + narration.mp3
```

**Example 2: Newsletter with cinematic style**
```
User: "Create visuals for this newsletter, cinematic style, no narration"
-> Reads newsletter, extracts 3 key scenes via CSE
-> Generates 3 cinematic illustrations (seedream, film lighting prompt)
-> Skips narration (user specified "no narration")
-> Outputs: content-visual-newsletter-scene-01..03.png
```

**Example 3: Portuguese article with audio**
```
User: "Ilustra este artigo e gera narração em português"
-> Reads article, extracts 3 scenes via CSE
-> Generates 3 charcoal illustrations with PT-BR context
-> Generates narration with minimax-hd --language pt
-> Outputs: content-visual-artigo-scene-01..03.png + narration.mp3
```