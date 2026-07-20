---
name: Model Bakeoff
description: 
status: STABLE
---

# Model Bakeoff Workflow

**Generate the same prompt across 3-5 models in parallel to compare quality and pick a winner.**

## Voice Notification

```bash
bash "$DOS_DIR/DOS/Tools/voice.sh" main "Running the Model Bakeoff workflow in the Art skill to compare image models"
```

Running **ModelBakeoff** in **Art**...

---

## Purpose

When you need the best possible image for a use case, run the same prompt through multiple models simultaneously and compare the results. This eliminates model bias and gives concrete visual evidence for which model handles a given prompt best.

**Use this workflow for:**
- Finding the best model for a specific visual style
- Evaluating new models against established baselines
- Comparing speed vs quality tradeoffs
- Building intuition for model strengths and weaknesses
- Selecting the production model for a recurring content type

---

## Workflow Steps

### Step 1: User Provides the Prompt

Get a clear, detailed prompt from the user. The same prompt will be sent to all models, so it should be model-agnostic (no model-specific syntax).

```
PROMPT: "A fox sitting on a cliff at golden hour, cinematic lighting, 
shallow depth of field, photorealistic, warm tones"
```

### Step 2: Select the Comparison Set

Choose which models to compare based on the intent:

| Comparison Set | Models | When to Use |
|----------------|--------|-------------|
| **Default (balanced)** | `flux`, `seedream`, `imagen-4-ultra`, `flux-2-max` | General comparison |
| **Quality tier** | `flux-2-max`, `seedream`, `imagen-4-ultra` | Maximum quality, cost not a concern |
| **Speed tier** | `flux`, `grok-imagine`, `nano-banana` | Need results fast, comparing speed |
| **Full sweep** | `flux`, `flux-2-pro`, `flux-2-max`, `seedream`, `imagen-4-ultra`, `grok-imagine` | Comprehensive evaluation |
| **Reference-capable** | `flux-2-pro`, `flux-2-max`, `seedream`, `nano-banana-replicate` | Only models that support refs |

### Step 3: Run All Models in Parallel

Execute each model as a separate background process. All output files go to `~/Downloads/` with a model-name suffix for easy comparison.

```bash
# Default bakeoff: flux, seedream, imagen-4-ultra, flux-2-max
PROMPT="A fox sitting on a cliff at golden hour, cinematic lighting, shallow depth of field, photorealistic, warm tones"

bun run ~/.claude/skills/media/Art/Tools/Generate.ts \
  --model flux \
  --prompt "$PROMPT" \
  --size 16:9 \
  --output ~/Downloads/bakeoff-flux.png &

bun run ~/.claude/skills/media/Art/Tools/Generate.ts \
  --model seedream \
  --prompt "$PROMPT" \
  --size 16:9 \
  --output ~/Downloads/bakeoff-seedream.png &

bun run ~/.claude/skills/media/Art/Tools/Generate.ts \
  --model imagen-4-ultra \
  --prompt "$PROMPT" \
  --size 16:9 \
  --output ~/Downloads/bakeoff-imagen-4-ultra.png &

bun run ~/.claude/skills/media/Art/Tools/Generate.ts \
  --model flux-2-max \
  --prompt "$PROMPT" \
  --size 16:9 \
  --output ~/Downloads/bakeoff-flux-2-max.png &

wait
echo "All models complete."
```

### Step 4: Review All Outputs

```bash
# Open all results at once for side-by-side comparison
open ~/Downloads/bakeoff-flux.png \
     ~/Downloads/bakeoff-seedream.png \
     ~/Downloads/bakeoff-imagen-4-ultra.png \
     ~/Downloads/bakeoff-flux-2-max.png
```

### Step 5: User Picks a Winner

Present the results and let the user choose. Note key differences:

| Criteria | What to Compare |
|----------|----------------|
| **Fidelity** | Which model best matched the prompt description? |
| **Aesthetics** | Which looks most visually appealing? |
| **Detail** | Which has the finest detail and sharpest rendering? |
| **Typography** | If text was requested, which rendered it best? |
| **Style** | Which best captured the intended mood or style? |
| **Artifacts** | Which has the fewest visual artifacts or distortions? |

---

## Intent-to-Flag Mapping

| User Intent | Comparison Set | Models |
|-------------|---------------|--------|
| "compare models" | Default | `flux`, `seedream`, `imagen-4-ultra`, `flux-2-max` |
| "compare quality" | Quality tier | `flux-2-max`, `seedream`, `imagen-4-ultra` |
| "compare speed" | Speed tier | `flux`, `grok-imagine`, `nano-banana` |
| "which model is best for X" | Default | `flux`, `seedream`, `imagen-4-ultra`, `flux-2-max` |
| "full model test" | Full sweep | `flux`, `flux-2-pro`, `flux-2-max`, `seedream`, `imagen-4-ultra`, `grok-imagine` |
| "compare ref models" | Reference-capable | `flux-2-pro`, `flux-2-max`, `seedream`, `nano-banana-replicate` |
| "bakeoff" | Default | `flux`, `seedream`, `imagen-4-ultra`, `flux-2-max` |

---

## Examples

### Example 1: Default Bakeoff for a Blog Header

User says: "Compare models for a blog header about AI agents."

```bash
PROMPT="A network of glowing nodes connected by light beams, abstract representation of AI agents collaborating, dark background, electric blue and gold accents, cinematic wide shot"

bun run ~/.claude/skills/media/Art/Tools/Generate.ts \
  --model flux --prompt "$PROMPT" --size 16:9 \
  --output ~/Downloads/bakeoff-flux.png &

bun run ~/.claude/skills/media/Art/Tools/Generate.ts \
  --model seedream --prompt "$PROMPT" --size 16:9 \
  --output ~/Downloads/bakeoff-seedream.png &

bun run ~/.claude/skills/media/Art/Tools/Generate.ts \
  --model imagen-4-ultra --prompt "$PROMPT" --size 16:9 \
  --output ~/Downloads/bakeoff-imagen-4-ultra.png &

bun run ~/.claude/skills/media/Art/Tools/Generate.ts \
  --model flux-2-max --prompt "$PROMPT" --size 16:9 \
  --output ~/Downloads/bakeoff-flux-2-max.png &

wait
open ~/Downloads/bakeoff-flux.png ~/Downloads/bakeoff-seedream.png \
     ~/Downloads/bakeoff-imagen-4-ultra.png ~/Downloads/bakeoff-flux-2-max.png
```

### Example 2: Speed Tier for Rapid Iteration

User says: "I need fast results, compare the quick models."

```bash
PROMPT="Minimalist logo mark, geometric fox silhouette, single color on white background"

bun run ~/.claude/skills/media/Art/Tools/Generate.ts \
  --model flux --prompt "$PROMPT" --size 1:1 \
  --output ~/Downloads/bakeoff-flux.png &

bun run ~/.claude/skills/media/Art/Tools/Generate.ts \
  --model grok-imagine --prompt "$PROMPT" --size 1:1 \
  --output ~/Downloads/bakeoff-grok-imagine.png &

bun run ~/.claude/skills/media/Art/Tools/Generate.ts \
  --model nano-banana --prompt "$PROMPT" --size 1:1 \
  --output ~/Downloads/bakeoff-nano-banana.png &

wait
open ~/Downloads/bakeoff-flux.png ~/Downloads/bakeoff-grok-imagine.png \
     ~/Downloads/bakeoff-nano-banana.png
```

### Example 3: Quality Tier for Hero Image

User says: "I need the absolute best quality for a landing page hero."

```bash
PROMPT="Dramatic aerial view of a lone figure standing at the edge of a vast canyon at sunrise, volumetric light rays, ultra-detailed landscape, cinematic color grading"

bun run ~/.claude/skills/media/Art/Tools/Generate.ts \
  --model flux-2-max --prompt "$PROMPT" --size 16:9 \
  --output ~/Downloads/bakeoff-flux-2-max.png &

bun run ~/.claude/skills/media/Art/Tools/Generate.ts \
  --model seedream --prompt "$PROMPT" --size 16:9 \
  --output ~/Downloads/bakeoff-seedream.png &

bun run ~/.claude/skills/media/Art/Tools/Generate.ts \
  --model imagen-4-ultra --prompt "$PROMPT" --size 16:9 \
  --output ~/Downloads/bakeoff-imagen-4-ultra.png &

wait
open ~/Downloads/bakeoff-flux-2-max.png ~/Downloads/bakeoff-seedream.png \
     ~/Downloads/bakeoff-imagen-4-ultra.png
```

---

**The workflow: Define prompt -> Select comparison set -> Run parallel -> Review all -> Pick winner**