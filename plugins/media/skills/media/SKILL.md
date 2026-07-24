---
name: Media
description: Visual, audio, and video content creation — illustrations, diagrams, infographics, thumbnails, comics, speech and voice generation, AI video, image editing, music, and programmatic video via Remotion. USE WHEN art, header images, visualizations, mermaid, diagrams, flowcharts, infographics, pack icons, video, animation, motion graphics, Remotion, YouTube thumbnails, comics, maps, timelines, taxonomies, stats, aphorisms, recipe cards, annotated screenshots, D3 dashboards, essay illustration, content to animation, generate image, Midjourney, text to speech, TTS, voice synthesis, narrate, voice design, voice clone, podcast intro, social kit, model bakeoff, image edit, style transfer, AI video, text to video, image to video, video edit, seedance, kling, veo, runway, grok video, wan video, remove background, transparent background, green screen, blur background, restore image, denoise, face restoration, old photo, face swap, generate emoji, music generation, soundtrack, jingle, upscale image, super resolution.
role: generator
accepts:
  - text
icon: Film
colorVar: secondary
colorHex: "#deb7ff"
tier: primary
category: Media
displayLabel: Media
marketingDescription: 5 image generation models (Flux, Nano Banana, GPT-Image-1, Midjourney, Recraft SVG), Remotion video production, D3.js dashboards, 20+ visual workflows.
capabilities:
  - artifact.write
  - customization.cascade
  - voice.emit
  - four-copy.sync
elevator: 5 image models, video production, D3 dashboards, 20+ workflows
highlightWorkflows:
  - name: Image Generation
    technicalName: ImageGeneration
  - name: Video Production
    technicalName: VideoProduction
  - name: Interactive Dashboards
    technicalName: D3Dashboards
  - name: Comic Strips
    technicalName: Comics
  - name: Architecture Diagrams
    technicalName: TechnicalDiagrams
roots:
  - PROJECT.ARTIFACTS
visibility: public
feature_capabilities:
  - 5 image generation models with model comparison
  - Comic strips, diagrams, infographics
  - D3.js interactive dashboards
  - Remotion-powered video production
  - Voice synthesis and audio editing
---
<!-- generated-from: SKILL.partials.md — DO NOT EDIT directly. Run: bun Tools/dos-build.ts skill <path> -->
## Customization

**Before executing, check for user customizations at:**
`~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/Media/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.

## Voice Notification

```bash
bash "$DOS_DIR/DOS/Tools/voice.sh" main "Working in the media skill"
```

Working in the **media** skill...

# Media

Unified skill for visual, audio, and video content creation.

## Workflow Routing

**Route To entries are FILE PATHS relative to this skill's directory — load them with the Read tool and follow their instructions.** Sub-components (Art/, Speech/, Video/, Music/, Remotion/, …) are NOT separately registered skills: never invoke `Skill("media:Art")` or any `media:<Component>` form — it fails with "Unknown skill". Chained entries (`Art/SKILL.md → Workflows/ImageEdit.md`) mean: Read the first file, then the second (path relative to the first file's directory).

| Request Pattern | Route To |
|---|---|
| Art, header images, visualizations, diagrams, flowcharts, infographics, pack icons | `Art/SKILL.md` |
| Edit existing image, image manipulation | `Art/SKILL.md` → `Workflows/ImageEdit.md` |
| Compare image models side-by-side, model bakeoff | `Art/SKILL.md` → `Workflows/ModelBakeoff.md` |
| Style transfer, character consistency across images | `Art/SKILL.md` → `Workflows/StyleTransfer.md` |
| Speech generation, text to speech, TTS, voice synthesis | `Speech/SKILL.md` |
| Narrate a blog post, essay, document | `Speech/SKILL.md` → `Workflows/Narrate.md` |
| Design a voice from description | `Speech/SKILL.md` → `Workflows/VoiceDesign.md` |
| Clone a voice from audio sample | `Speech/SKILL.md` → `Workflows/CloneVoice.md` |
| Compare speech models side-by-side | `Speech/SKILL.md` → `Workflows/CompareModels.md` |
| Podcast intro, branded intro package | `Workflows/PodcastIntro.md` |
| Blog/essay to multimedia (illustrations + narration) | `Workflows/ContentToVisual.md` |
| Social media content kit (images + audio for all platforms) | `SocialMedia/SKILL.md` → `Workflows/SocialKit.md` |
| Social media images, platform-specific formats | `SocialMedia/SKILL.md` |
| AI video generation, text to video, image to video | `Video/SKILL.md` |
| Animate image, video from still | `Video/SKILL.md` → `Workflows/ImageToVideo.md` |
| Edit existing video with AI | `Video/SKILL.md` → `Workflows/VideoEdit.md` |
| Restore image, fix old photo, enhance, upscale, denoise | `ImageRestoration/SKILL.md` |
| Remove background, transparent PNG, green screen, blur bg | `BackgroundRemoval/SKILL.md` |
| Face swap, replace face in image | `FaceSwap/SKILL.md` |
| Generate emoji, custom emoji, emoji style | `Emoji/SKILL.md` |
| Music generation, compose music, soundtrack, jingle | `Music/SKILL.md` |
| Upscale image, enlarge, super resolution, 2x/4x | `ImageUpscale/SKILL.md` |
| Programmatic video, React animation, Remotion | `Remotion/SKILL.md` |


## Content Safety (consent gate)

The liability-grade modalities are gated by a shared `Lib/consent-gate.ts` enforced
**before any gateway call** (no per-tool path bypasses it). It is **warn-then-block with a
single affirmative `--consent-attested` flag**, audit-logged to the artifact JSONL — legitimate
own-face / own-voice / synthetic-subject flows still ship by passing the flag once.

| Modality | Tool | Blocks without `--consent-attested` when… |
|---|---|---|
| Deepfake | `FaceSwap/Tools/Swap.ts` | always (synthesizes a person's likeness) |
| Biometric voice-clone | `Speech/Tools/Speak.ts` | a `--ref-audio` voice sample is present (plain TTS passes) |
| Copyright / style-mimicry | `Music/Tools/Compose.ts` | the prompt names an artist's style ("in the style of …") |
| AI image of a real person | `Art/Tools/Generate.ts` | a `--reference-image` is present |

The gate enforces **legal preconditions** — it does not judge artistic intent. Pass
`--consent-attested` to confirm you are authorized (you hold the depicted person's / voice
owner's consent, or no real person is depicted).

## Examples

**Example 1: Generate a blog header image**
```
User: "create a header for my AI agents post"
→ Routes to Art/SKILL.md → Essay workflow
→ Generates image with charcoal aesthetic
→ Outputs to ~/Downloads/ for preview
```

**Example 2: Narrate a newsletter in Portuguese**
```
User: "narrate this blog post in PT-BR"
→ Routes to Speech/SKILL.md → Narrate workflow
→ Uses replicate-minimax-hd with --language pt
→ Outputs MP3 to ~/Downloads/
```

**Example 3: Generate a cinematic video**
```
User: "create a 10s cinematic video of a fox in a neon city"
→ Routes to Video/SKILL.md → TextToVideo workflow
→ Uses seedance with --generate-audio --duration 10
→ Outputs MP4 to ~/Downloads/
```

**Example 4: Create a podcast intro package**
```
User: "generate a podcast intro for Builder's Compass"
→ Routes to Workflows/PodcastIntro.md
→ Generates cover art (seedream) + spoken intro (minimax-turbo)
→ Outputs both to ~/Downloads/
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

echo '{"timestamp":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","pack":"Media","workflow":"WORKFLOW_NAME","type":"ARTIFACT_TYPE","title":"TITLE","path":"ABSOLUTE_PATH","contentPreview":"FIRST_500_CHARS_ESCAPED","wing":"WING_OR_GENERAL","sessionId":"'$CLAUDE_SESSION_ID'"}' >> "$ARTIFACTS_DIR/artifacts.jsonl"
```

If this skill is read-only (no Write tool usage), this section is informational only.

## Four-Copy Compliance

This skill exists in up to four locations per the DOS Four-Copy Rule (`Durante/CLAUDE.md`):

1. `~/.claude/skills/media/` — live install (what Claude Code runs)
2. `Releases/<active-version>/.claude/skills/media/` — active release submodule (versioned)
3. `Packs/*/src/Media/` — pack source (distributable)
4. `Packs/agents/Media/` — agent runtime (only if applicable)

After editing any file in this skill, verify all copies via `bun ~/Durante/Tools/sync-check.ts`. Exit code 0 = clean. Exit code 1 = drift; resolve with `--fix` before commit.
