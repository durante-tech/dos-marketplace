---
name: StreamRig
pack-id: durante-streamrig-v1.0.0
version: 1.0.0
author: durante-tech
description: Build-in-public livestream operations layer for creators — orchestrates brand kit generation, OBS scene setup, Stream Deck profile, runtime phase control, and the post-stream content multiplier (transcript to newsletter, social posts, clips, show notes). Composes Brand, DesignSystem, Media, ContentAnalysis, Dispatch, SocialMedia, MemPalace. USE WHEN stream, livestream, OBS, podcast, scene, overlay, intro, outro, brand kit for stream, stream deck profile, post-stream, episode notes, episode memory, refresh stream brand, build stream rig, streamrig, recording marker, show notes from stream.
type: skill
role: executor
visibility: public
category: Creator
platform: claude-code
dependencies: []
keywords: [streamrig, stream, livestream, obs, podcast, scene, overlay, intro, outro, brand kit for stream, stream deck profile, post-stream]
---

# StreamRig

> Build-in-public livestream operations layer for creators — orchestrates brand kit generation, OBS scene setup, Stream Deck profile, runtime phase control, and the post-stream content multiplier (transcript to newsletter, social posts, clips, show notes)

---

## The Problem

Operating a multi-step capability ad-hoc per session forfeits the structured workflow that makes results consistent. Without a packaged set of workflows + tools + manifests, the same task gets re-invented every time.

---

## The Solution

The **StreamRig** pack packages 6 workflows behind a single SKILL.md entry card with the canonical RFC-0011 distribution manifest.


**Core capabilities:**

- **EndShow** — `Workflows/EndShow.md`
- **EpisodeMemory** — `Workflows/EpisodeMemory.md`
- **InitRig** — `Workflows/InitRig.md`
- **PostStream** — `Workflows/PostStream.md`
- **PreShow** — `Workflows/PreShow.md`
- **RefreshBrand** — `Workflows/RefreshBrand.md`

---

## Installation

This pack is designed for AI-assisted installation. Give this directory to your AI and ask it to install using `INSTALL.md`.

```
"Install the stream-rig pack from DOS/Packs/stream-rig/"
```

Your AI reads `INSTALL.md` and walks through a 5-phase wizard (system analysis → user questions → backup → install → verify).

**What is DOS?** See the [DOS Project Overview](https://github.com/durante-tech/dos#what-is-dos).

---

## What's Included

| Component | Path | Purpose |
|-----------|------|---------|
| Skill definition | `src/SKILL.md` | Skill routing, configuration, documentation |
| Skill source | `src/SKILL.partials.md` | RFC-0006 partials (if present) |
| Extension manifest | `src/extension.yaml` | RFC-0002 pack manifest |
| Workflows | `src/Workflows/` | 6 workflow definition(s) |
| Distribution manifest | `plugin.json` | RFC-0011 §5.2 manifest with `dos.bridge[]` |

**Summary:**
- Directories: 4 (Overlays, Presets, Tools, Workflows)
- Files in src/: 11
- Workflows: 6
- Hooks registered: 0
- Bridge actions: none (zero-bridge)
- Visibility: public

---

## Workflow Routing

| Workflow | Path |
|----------|------|
| **EndShow** | `src/Workflows/EndShow.md` |
| **EpisodeMemory** | `src/Workflows/EpisodeMemory.md` |
| **InitRig** | `src/Workflows/InitRig.md` |
| **PostStream** | `src/Workflows/PostStream.md` |
| **PreShow** | `src/Workflows/PreShow.md` |
| **RefreshBrand** | `src/Workflows/RefreshBrand.md` |

---

## Invocation Scenarios

- `EndShow` workflow — see `src/Workflows/EndShow.md` for triggers and behavior
- `EpisodeMemory` workflow — see `src/Workflows/EpisodeMemory.md` for triggers and behavior
- `InitRig` workflow — see `src/Workflows/InitRig.md` for triggers and behavior
- `PostStream` workflow — see `src/Workflows/PostStream.md` for triggers and behavior
- `PreShow` workflow — see `src/Workflows/PreShow.md` for triggers and behavior
- `RefreshBrand` workflow — see `src/Workflows/RefreshBrand.md` for triggers and behavior

---

## Customization

User customizations live separately and are never overwritten by updates:

```
~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/StreamRig/
```

Place per-user overrides here; they merge with base configuration at runtime where applicable.

---

## Credits

- **Pack family:** durante-tech / DOS
- **Distribution protocol:** RFC-0011 (Packs Distribution & Release Authoring)
- **Skill definition format:** RFC-0004
- **Extension manifest format:** RFC-0002

---

## Changelog

### 1.0.0 - $(date +%Y-%m-%d)
- Initial published version with canonical pack-distribution scaffolding (INSTALL.md / README.md / VERIFY.md)
- See git history for prior incremental commits
