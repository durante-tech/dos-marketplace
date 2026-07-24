---
name: StreamRig
description: Build-in-public livestream operations layer for creators — orchestrates brand kit generation, OBS scene setup, Stream Deck profile, runtime phase control, and the post-stream content multiplier (transcript to newsletter, social posts, clips, show notes). Composes Brand, DesignSystem, Media, ContentAnalysis, Dispatch, SocialMedia, MemPalace. USE WHEN stream, livestream, OBS, podcast, scene, overlay, intro, outro, brand kit for stream, stream deck profile, post-stream, episode notes, episode memory, refresh stream brand, build stream rig, streamrig, recording marker, show notes from stream, go live, new live, set up youtube live, schedule broadcast, provision live, live setup, create a live about, going live about.
role: orchestrator
accepts: [text]
icon: Radio
tier: primary
category: Creator
displayLabel: StreamRig
roots: []
visibility: public
capabilities: [artifact.write, customization.cascade, four-copy.sync]
---
<!-- generated-from: SKILL.partials.md — DO NOT EDIT directly. Run: bun Tools/dos-build.ts skill <path> -->
## Customization

**Before executing, check for user customizations at:**
`~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/StreamRig/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.

# StreamRig

**Status:** v0.0.2 — orchestrator skill for creators running livestreams. Generates the brand kit and turns each recording into a multi-channel content pack today. **v0.0.2 adds the `GoLive` workflow + `build-in-public` preset + `Tools/YouTubeLive.ts`** — from a live subject it provisions the YouTube broadcast (metadata + thumbnail) and configures every OBS scene/overlay on the operator's existing live sources. GoLive reuses the operator's on-PATH `obs` / `dos-stream` CLIs (no scene rebuild); the standalone `Tools/Obs.ts`/`Tools/Stream.ts`/`Tools/StreamdeckBuild.ts` distribution-lift remains deferred.

StreamRig is the creator-facing analog of the Sales orchestrator: it owns only the runtime control plane (OBS WebSocket bridge + phase state machine + preset schema + overlay templates) and composes existing DOS skills for everything else — Brand and DesignSystem for tokens, Media for assets, ContentAnalysis + Dispatch + SocialMedia for the post-stream multiplier, MemPalace for episode persistence.

v0.0.1 ships the **podcast** preset as the v0.1 reference build. Build-in-public, gaming, tutorial, pomodoro, and variety presets land in v0.2.

**Platform**: macOS only in v0.0.1. OBS Studio ≥ 30.0 with WebSocket v5 required.

**Authoring spec**: `MEMORY/WORK/20260512-160000_streamrig-v01-spec/` (PRD + ARCHITECTURE + DATAMODEL + ROADMAP + podcast.yaml).

## Workflow Routing

| Workflow | Trigger | File |
|----------|---------|------|
| **GoLive** | "go live about X", "new live: X", "set up a youtube live", "provision live", "schedule broadcast", "live setup" | `Workflows/GoLive.md` |
| **InitRig** | "init the rig", "first run", "setup stream", "build stream rig" | `Workflows/InitRig.md` |
| **PreShow** | "preshow", "start show", "ready to stream" (lighter than GoLive — no broadcast creation) | `Workflows/PreShow.md` |
| **EndShow** | "endshow", "wrap show", "end stream" | `Workflows/EndShow.md` |
| **PostStream** | "post stream", "content multiplier", "episode artifacts", "show notes from stream" | `Workflows/PostStream.md` |
| **EpisodeMemory** | "episode memory", "save episode", "persist episode" | `Workflows/EpisodeMemory.md` |
| **RefreshBrand** | "refresh brand", "re-skin", "regen assets", "DESIGN.md changed" | `Workflows/RefreshBrand.md` |

## Examples

**Example 0: Go live from a subject (v0.0.2)**
```
Operator: "go live about wiring Fable 5 into a real build"
→ Invokes GoLive workflow (preset build-in-public)
→ Preflight: OBS reachable, YouTube authorized, recording dir ensured
→ Asks ≤4 questions (schedule, visibility, thumbnail vibe, announcements) with defaults
→ Generates title/description/tags + a Media thumbnail (1280x720, brand)
→ YouTubeLive.ts creates the scheduled broadcast + binds stream + sets thumbnail
→ Sets intro agenda + lower-third + terminal-frame overlays on the LIVE OBS sources, switches to 01_Intro (no rebuild)
→ Drafts X + LinkedIn announcements + ShowNotes + a MemPalace episode entry
→ Operator gets watch + studio URLs and a ready-to-stream rig; starts streaming in OBS
```

**Example 1: First-time rig setup for a new podcast**
```
User: "Set up a stream rig for my new podcast 'Deep Work Hours'"
→ Invokes InitRig workflow
→ Asks 4 brand questions (channel name, mood words, vertical=podcast, light/dark)
→ Generates DESIGN.md via design-system skill
→ media skill generates wordmark, webcam frame, intro/outro/BRB cards (~25 credits)
→ Builds 4 OBS scenes via WebSocket; installs Stream Deck profile
→ User gets a branded, ready-to-record rig in ~5 minutes
```

**Example 2: Mid-stream phase transition**
```
User: "moving to Q&A"
→ Invokes runtime phase shift: streamrig phase qa
→ Updates session.json currentPhase, rewrites overlay URL with ?phase=qa
→ Switches to OBS scene if preset declares a scene for this phase
→ Creates a chapter marker labeled "Q&A"
→ Overlay updates live; no scene reload needed
```

**Example 3: Post-stream content multiplier**
```
User: "I just finished episode 12 — run the post-stream pipeline"
→ Invokes PostStream workflow
→ ContentAnalysis extracts wisdom + show notes from recording transcript
→ Dispatch drafts a newsletter post; Media generates 3 short-form clips + thumbnail
→ SocialMedia drafts 3 cross-platform posts (FB/IG/LinkedIn) — NEVER auto-publishes
→ MemPalace persists Episode 12 drawer with topic/guest KG facts
→ User gets ~7 deliverables in ~10 minutes, all branded consistently, awaiting review
```

## Dependencies

| Skill | Used By | Failure mode if unavailable |
|---|---|---|
| brand | InitRig (deep brand path) | Falls back to 4-question fast path |
| design-system | InitRig + RefreshBrand | Manual DESIGN.md authoring required |
| media | InitRig + PostStream + RefreshBrand + **GoLive** (thumbnail) | Asset generation blocked; GoLive skips thumbnail (warned), broadcast still creates |
| content-analysis | PostStream | Skips to social drafts with stub notes |
| dispatch | PostStream | Newsletter draft skipped |
| social-media | PostStream + **GoLive** (announcements) | Social drafts skipped |
| mem-palace | EpisodeMemory + **GoLive** (episode entry) | Episode persistence skipped (warned, not fatal) |
| sentinel | InitRig | Conformance scan skipped (warned) |

**External**: OBS Studio ≥ 30.0 with WebSocket v5 on `ws://localhost:4455`, Stream Deck app (Elgato), `rsvg-convert` (via `brew install librsvg`), Bun runtime, macOS. **GoLive also requires**: the on-PATH `obs` + `dos-stream` CLIs (from `~/dotfiles/scripts/scripts/`), and a one-time YouTube OAuth grant via `Tools/SETUP-YouTube.md` (`Tools/YouTubeLive.ts auth`).

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

echo '{"timestamp":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","pack":"StreamRig","workflow":"WORKFLOW_NAME","type":"ARTIFACT_TYPE","title":"TITLE","path":"ABSOLUTE_PATH","contentPreview":"FIRST_500_CHARS_ESCAPED","wing":"WING_OR_GENERAL","sessionId":"'$CLAUDE_SESSION_ID'"}' >> "$ARTIFACTS_DIR/artifacts.jsonl"
```

If this skill is read-only (no Write tool usage), this section is informational only.

## Four-Copy Compliance

This skill exists in up to four locations per the DOS Four-Copy Rule (`Durante/CLAUDE.md`):

1. `~/.claude/skills/stream-rig/` — live install (what Claude Code runs)
2. `Releases/<active-version>/.claude/skills/stream-rig/` — active release submodule (versioned)
3. `Packs/*/src/StreamRig/` — pack source (distributable)
4. `Packs/agents/StreamRig/` — agent runtime (only if applicable)

After editing any file in this skill, verify all copies via `bun ~/Durante/Tools/sync-check.ts`. Exit code 0 = clean. Exit code 1 = drift; resolve with `--fix` before commit.
