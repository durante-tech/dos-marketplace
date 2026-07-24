---
name: Ad Hoc You Tube Thumbnail
description:
status: STABLE
---

# Ad-Hoc YouTube Thumbnail Workflow

Generate a YouTube thumbnail from content when the user has not supplied a complete asset kit.

## Purpose

Use this workflow when the prompt is content-first: a video topic, transcript, title, outline, or rough idea. If the user already has a finished asset kit and only needs validation, route to `Workflows/YouTubeThumbnailChecklist.md`.

## Workflow Steps

### Step 1: Extract the Hook

Read the content and produce:

- One thumbnail promise in 3-7 words.
- One visible tension or object the image can show.
- One emotional register: urgent, skeptical, clear, surprising, or tactical.
- One forbidden direction that would make the thumbnail generic.

### Step 2: Choose the Layout

Pick one layout only:

| Layout | Use when |
|--------|----------|
| Face plus claim | The speaker/person is the draw |
| Object plus contrast | The topic has a visible artifact, tool, chart, or product |
| Big text plus symbol | The concept is abstract but the claim is sharp |
| Before/after split | The story has a clear transformation |

### Step 3: Generate Source Art

```bash
bun run ~/.claude/skills/media/Art/Tools/Generate.ts \
  --model nano-banana-pro \
  --prompt "[specific thumbnail background or subject prompt]" \
  --size 16:9 \
  --output ~/Downloads/thumbnail-source.png
```

If a face, logo, screenshot, or product reference is available, use `Workflows/ImageEdit.md` instead of inventing it.

### Step 4: Compose the Thumbnail

Use `Tools/ComposeThumbnail.ts` when assets need deterministic text, border, logo, or headshot placement. Keep text short and readable at mobile size.

### Step 5: Validate

Run the full pre/post checklist in `Workflows/YouTubeThumbnailChecklist.md` before delivering the final image.

## Output

- Final 1280x720 PNG.
- Source image path.
- One short note describing the hook and layout chosen.

## Related Workflows

- `Workflows/YouTubeThumbnailChecklist.md` - mandatory final validation.
- `Workflows/ImageEdit.md` - preserve exact faces, logos, products, or screenshots.
- `Workflows/RemoveBackground.md` - prepare transparent subjects before composition.
