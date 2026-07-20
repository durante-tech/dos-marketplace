---
name: InitRig
description: First-run setup — brand → DESIGN.md → assets → OBS scenes → Stream Deck profile
status: STABLE
bestPath:
  - title: "Brand Detection"
    description: "Check for an existing DESIGN.md, or run the fast (4-question) or deep brand-skill research path."
  - title: "Design System Generation"
    description: "Produce DESIGN.md with a Streaming subsection of overlay/scene/lower-third token defaults."
  - title: "Asset Generation"
    description: "Generate branded assets (wordmark, webcam frame, intro/outro/BRB cards) via Media in parallel."
  - title: "Scene & Deck Provisioning"
    description: "Build OBS scenes and clone/re-skin the Stream Deck profile from the brand tokens."
  - title: "Verification"
    description: "Doctor check the built rig, then run a Sentinel conformance scan."
---

# InitRig Workflow

## When to Use

- Trigger phrases: "init the rig", "first run", "setup stream", "build stream rig"
- First-time rig setup for a new podcast — no DESIGN.md, OBS scenes, or Stream Deck profile exist yet
- NOT for re-skinning an already-built rig after brand-token changes — use RefreshBrand instead

**Purpose:** One-command rig setup. Detects brand context (existing DESIGN.md or fast 4-question path), orchestrates Brand → DesignSystem → Media → scene build → Stream Deck profile, finishes with a Sentinel conformance scan.

**Budget:** ~5-30 min depending on Brand mode, ~25 credits when assets generate from scratch.

<!-- partial: _workflow-voice.md skill_name=StreamRig workflow_name=InitRig action_phrase="initialize the stream rig" -->


**Purpose:** One-command rig setup. Detects brand context (existing DESIGN.md or fast 4-question path), orchestrates Brand → DesignSystem → Media → scene build → Stream Deck profile, finishes with a Sentinel conformance scan.

**Budget:** ~5-30 min depending on Brand mode, ~25 credits when assets generate from scratch.

<!-- partial: _workflow-voice.md skill_name=StreamRig workflow_name=InitRig action_phrase="initialize the stream rig" -->

## Prerequisites

- OBS Studio ≥ 30.0 running with WebSocket v5 enabled on `ws://localhost:4455`
- `~/.config/obs-cli/password` exists (mode 600) OR `$OBS_WEBSOCKET_PASSWORD` set
- `rsvg-convert` installed (`brew install librsvg`)
- Stream Deck app installed (for profile installation)
- Bun runtime in PATH

## Steps

### 1. Detect brand context

Check for an existing DESIGN.md, in this order:
- `$CLAUDE_PROJECT_DIR/DESIGN.md` (project-level)
- `~/.claude/MEMORY/BRAND/DESIGN.md` (global default)

**Branch A (DESIGN.md exists)** → read tokens (`--primary`, `--accent`, `--bg`, `--font-display`, etc.), skip to Step 4.

**Branch B (no DESIGN.md)** → ask via AskUserQuestion: fast path (4 questions) or deep path (full brand skill research).

### 2. Brand path execution

**Fast path** — ask 4 questions:
- Channel name?
- 2-3 mood words? (e.g. "warm, intimate, indie")
- Primary vertical? (default: podcast — only podcast preset is wired in v0.0.1)
- Light or dark base?

Map mood words to a vibe preset (`studio-warm`, `paper-podcast`, `gallery-minimal`, `terminal-glow`, `neon-arcade`, `vhs-retro`). The selected vibe seeds the token bundle.

**Deep path** — spawn Brand as a subagent:

```ts
Task({
  subagent_type: "general-purpose",
  description: "Brand research for stream rig",
  prompt: "Invoke the brand skill, Research workflow. Subject: stream channel '<channelName>' with vibe '<vibe>'. Produce the canonical brand-tokens.json (W3C DTCG 2025.10) plus its brand-token-spec.md companion covering primary/accent/bg colors, display + body fonts, mood descriptors, and 2-3 visual references. Return: path to the written brand-tokens.json (canonical) plus the companion. Under 400 words."
})
```

Brand writes the canonical `brand-tokens.json` (DTCG) plus its `brand-token-spec.md` companion to the project root; capture the JSON path (canonical) and pass through to DesignSystem.

### 3. Generate DESIGN.md

Spawn DesignSystem as a subagent to consume the brand token spec (deep path) or vibe-preset tokens (fast path):

```ts
Task({
  subagent_type: "general-purpose",
  description: "DesignSystem init from brand tokens",
  prompt: "Invoke the design-system skill, Init workflow. Source: <brand-tokens.json path (canonical DTCG) — falling back to brand-token-spec.md — OR inline token bag from vibe preset '<vibe>'>. Produce DESIGN.md at ~/.claude/MEMORY/BRAND/DESIGN.md including a ### Streaming subsection with overlay-text-size, scene-palette, and lower-third-opacity defaults derived from the primary/accent/bg tokens. Return: path to written DESIGN.md plus extracted token bag (--primary, --accent, --bg, --font-display). Under 300 words."
})
```

### 4. Generate assets via Media

For each asset in the active preset's `assets[]` list, invoke Media with the prompt template filled from DESIGN.md tokens + vibe + channel name. Run in parallel up to ~6 concurrent.

```
Skill("media", "generate asset <assetName> using prompt-template <template> with tokens <tokens>")
```

Cache key: hash of (regenTrigger tokens). Skip regeneration if `last-tokens.json` hash matches.

Default podcast asset set: `wordmark`, `webcam-frame`, `intro-splash`, `outro-card`, `brb-card`, `lower-third-bg` + Stream Deck icons per preset.

### 5. Build OBS scenes

The on-PATH `obs-scene-build` CLI builds the fixed DuranteOS scene set
(`01_Intro`..`05_Outro`) via OBS WebSocket. It is **NOT idempotent** — it
`CreateScene`s and will CLOBBER an existing collection (resetting transforms,
dropping sources). Run it ONLY on a fresh rig; hard-refuse otherwise:

```bash
if obs raw GetSceneList 2>/dev/null | jq -e '[.scenes[].sceneName] | index("01_Intro")' >/dev/null; then
  echo "REFUSING: DuranteOS scenes already exist — obs-scene-build would clobber the live collection. Rig already built; skipping."
else
  obs-scene-build
fi
```

### 6. Build Stream Deck profile

The on-PATH `streamdeck-build` CLI takes positional `<source.streamDeckProfile>
<output.streamDeckProfile>` — it CLONES a source profile and re-skins its icons
from the current brand tokens (DESIGN.md). First-time setup needs a base profile to
clone (export one from the Stream Deck app, or ship a template):
```bash
SRC=~/.config/streamrig/templates/podcast.streamDeckProfile
[ -f "$SRC" ] && streamdeck-build "$SRC" ~/.config/streamrig/streamrig-podcast.streamDeckProfile \
  || echo "NOTE: no base profile at $SRC — create/export one in the Stream Deck app, then re-run this step."
```

Surface the output path; user double-clicks to install in Stream Deck app.

### 7. Doctor check

```bash
obs current                                          # verify scene registered
ls ~/.config/streamrig/brand/                         # verify assets present
pgrep -x "Stream Deck"                                # verify app running
```

### 8. Sentinel conformance scan

```
Skill("sentinel", "scan ~/.config/streamrig/ — verify all preset-declared assets present and scenes registered")
```

<!-- partial: _intent-to-flag-table.md skill_name=StreamRig workflow_name=InitRig -->
## Intent-to-Flag Mapping

### Brand mode

| User Says | Flag | When to Use |
|-----------|------|-------------|
| "quick", "fast", "4 questions" | `--brand fast` | Speed; minimal questions |
| (default) | `--brand auto` | Detect existing DESIGN.md; fast if absent |
| "deep brand", "full research", "via brand skill" | `--brand deep` | Full brand skill research mode |

### Preset selection

| User Says | Flag | Effect |
|-----------|------|--------|
| (default), "podcast" | `--preset podcast` | v0.0.1 only-supported preset |
| "build-in-public", "gaming", "tutorial" | reject with v0.2 message | Future presets |

### Output options

| User Says | Flag | Effect |
|-----------|------|--------|
| "dry run", "preview only" | `--dry-run` | No file writes, no OBS calls |
| "force regen", "regenerate all" | `--force-regen` | Bypass asset token cache |
| "skip Sentinel" | `--no-sentinel` | Skip Step 8 |

<!-- partial: _workflow-output-shape.md skill_name=StreamRig workflow_name=InitRig -->
## Output

- `~/.claude/MEMORY/BRAND/DESIGN.md` (created or updated)
- `~/.config/streamrig/config.json` (active preset + brand path)
- `~/.config/streamrig/brand/` populated with 6+ assets + `last-tokens.json` cache
- OBS scenes registered: `01_Intro`, `02_Main`, `03_Brb`, `04_Outro`
- Stream Deck profile at `~/.config/streamrig/streamrig-podcast.streamDeckProfile`
- One log line per generated artifact in `$ARTIFACTS_DIR/artifacts.jsonl`

## Done

InitRig complete. User can now run `streamrig preshow 1 "Episode title"` to start the first episode.
