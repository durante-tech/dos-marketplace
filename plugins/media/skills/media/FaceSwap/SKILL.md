---
name: FaceSwap
description: Swap faces between images using AI — replace one person's face with another in any photo. USE WHEN face swap, swap face, replace face, face replacement, put my face on, switch faces, face merge.
role: executor
accepts:
  - url
roots:
  - PROJECT.ARTIFACTS
visibility: public
capabilities:
  - customization.cascade
  - voice.emit
---
<!-- generated-from: SKILL.partials.md — DO NOT EDIT directly. Run: bun Tools/dos-build.ts skill <path> -->
## Customization

**Before executing, check for user customizations at:**
`~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/FaceSwap/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.

# FaceSwap Skill

Swap faces between two images using a single AI model via Replicate.

## Available Models

| Model | Provider | Best For |
|-------|----------|----------|
| `codeplugtech/face-swap` | CodePlugTech (Replicate) | General face swapping between two images |

## Intent-to-Flag Mapping

| User Says | Flags |
|-----------|-------|
| "swap my face onto this" | `--target <scene> --source <face>` |
| "replace the face" | `--target <image-with-face-to-replace> --source <new-face>` |
| "put my face on this photo" | `--target <photo> --source <selfie>` |
| "switch faces" | `--target <image1> --source <image2>` |

## Workflow Routing

| Request Pattern | Route To |
|---|---|
| Swap face, replace face, face swap | `Workflows/SwapFace.md` |

## Usage

```bash
# Basic face swap
bun run ~/.claude/skills/media/FaceSwap/Tools/Swap.ts \
  --target ~/Downloads/target-photo.jpg \
  --source ~/Downloads/source-face.jpg \
  --output ~/Downloads/face-swapped.png

# Using URLs
bun run ~/.claude/skills/media/FaceSwap/Tools/Swap.ts \
  --target https://example.com/photo.jpg \
  --source https://example.com/face.jpg
```

## Environment Variables

| Variable | Required For |
|----------|-------------|
| `STUDIO_API_KEY` | All models (via Studio gateway) |

## Examples

**Example 1: Swap face onto group photo**
```
User: "put my face on this photo"
-> Uses --target <group-photo> --source <selfie>
-> Outputs face-swapped PNG to ~/Downloads/
```

**Example 2: Replace face in headshot**
```
User: "replace the face in this headshot with mine"
-> Uses --target <headshot> --source <user-face>
-> Clean face replacement preserving pose and lighting
```

**Example 3: Fun face swap between two people**
```
User: "switch our faces in this photo"
-> Uses --target <photo> --source <other-face>
-> Swaps face while keeping scene intact
```
