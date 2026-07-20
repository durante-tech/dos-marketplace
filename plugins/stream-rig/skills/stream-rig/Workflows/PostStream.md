---
name: PostStream
description: Recording → wisdom + show notes + newsletter + clips + thumbnail + social drafts
status: STABLE
bestPath:
  - title: "Recording Location"
    description: "Locate the latest recording file from the OBS output directory (or an explicit path)."
  - title: "Content Extraction"
    description: "Extract wisdom and show notes with timestamps via ContentAnalysis."
  - title: "Multi-Channel Drafting"
    description: "Draft the newsletter, short-form clips, episode thumbnail, and cross-platform social posts."
  - title: "Review Gate"
    description: "Mandatory operator approval — nothing publishes without explicit per-artifact sign-off."
  - title: "Memory Persistence"
    description: "Persist the episode to MemPalace via the EpisodeMemory workflow."
---

# PostStream Workflow

## When to Use

- Trigger phrases: "post stream", "content multiplier", "episode artifacts", "show notes from stream"
- Turning a finished episode recording into the multi-channel deliverable set
- NOT for saving episode memory alone — PostStream calls EpisodeMemory as its final step; use EpisodeMemory directly for memory-only persistence

**Purpose:** The content multiplier. Turns one recording into ~7 deliverables across 5 channels by orchestrating ContentAnalysis, Dispatch, Media, SocialMedia, and MemPalace. **Never auto-publishes** — drafts only, review gate non-negotiable.

**Budget:** ~5-15 min, ~10-30 credits depending on output set.

<!-- partial: _workflow-voice.md skill_name=StreamRig workflow_name=PostStream action_phrase="multiply the post-stream content" -->


**Purpose:** The content multiplier. Turns one recording into ~7 deliverables across 5 channels by orchestrating ContentAnalysis, Dispatch, Media, SocialMedia, and MemPalace. **Never auto-publishes** — drafts only, review gate non-negotiable.

**Budget:** ~5-15 min, ~10-30 credits depending on output set.

<!-- partial: _workflow-voice.md skill_name=StreamRig workflow_name=PostStream action_phrase="multiply the post-stream content" -->

## Inputs

- `n` — episode number (required; defaults to `lastEpisodeEndedAt` episode)
- Optional `--recording <path>` — override auto-detection from OBS output dir
- Optional `--skip <step>` — skip a downstream step (clips, newsletter, social)

## Prerequisites

- Episode recording file exists (default: latest file in OBS recording-output dir)
- All composed skills available (PostStream degrades gracefully — see ARCHITECTURE.md dependencies table)

## Steps

### 1. Locate recording

```bash
REC_DIR=$(obs raw GetRecordDirectory 2>/dev/null | jq -r '.recordDirectory')
RECORDING=${RECORDING:-$(ls -t "$REC_DIR"/*.mkv "$REC_DIR"/*.mp4 2>/dev/null | head -1)}
```

Uses the on-PATH `obs` CLI (obs-websocket v5). If OBS is unreachable, pass the recording explicitly via `--recording <path>` or set `REC_DIR` to your OBS output directory.

### 2. Extract wisdom + show notes

```
Skill("content-analysis", "extract wisdom from $RECORDING — output show notes with timestamps, key quotes, topic list")
```

Writes to `~/.claude/MEMORY/STREAMRIG/Episodes/{n}/Notes.md` (frontmatter holds the Episode object, body holds the notes).

### 3. Draft newsletter

```
Skill("dispatch", "draft newsletter from $RECORDING transcript + Notes.md")
```

Writes to `~/.claude/MEMORY/STREAMRIG/Episodes/{n}/Newsletter.md`. **Draft only — does not publish.**

### 4. Generate clips

```
Skill("media", "generate 3-5 short-form clip cuts from $RECORDING — anchor on key-quote timestamps from Notes.md")
```

Writes to `~/.claude/MEMORY/STREAMRIG/Episodes/{n}/Clips/`.

### 5. Generate episode thumbnail

```
Skill("media", "generate episode thumbnail using DESIGN.md tokens + guest portrait (if available) + episode title")
```

Writes to `~/.claude/MEMORY/STREAMRIG/Episodes/{n}/Thumbnail.png`.

### 6. Draft social posts

Draft-only context: spawn the SocialMedia publish tools under `SOCIAL_DRAFT_ONLY=1` — the unspoofable env (SocialMedia #147) that forces FB/LinkedIn to draft and hard-refuses IG, so "NEVER publish" is a structural guarantee, not a hoped-for prompt convention.

```
SOCIAL_DRAFT_ONLY=1 Skill("social-media", "draft cross-platform posts (FB, IG, LinkedIn) from Newsletter.md and key quotes — 3-5 posts total, NEVER publish")
```

Writes to `~/.claude/MEMORY/STREAMRIG/Episodes/{n}/SocialDrafts.json`.

### 7. Review gate (MANDATORY)

```
AskUserQuestion: "Review the 7 generated artifacts. Approve all? Approve subset? Regenerate any?"
```

Show paths + first-100-chars preview of each draft. Operator can:
- Approve all (artifacts marked `status: approved` in MemPalace)
- Approve subset (per-artifact approval)
- Regenerate specific artifact (re-runs that step)

**Nothing publishes from this workflow.** Approval is a memory state, not a side effect.

### 8. Persist to MemPalace

Spawn a subagent to run EpisodeMemory and write episode metadata as a drawer + KG facts via the canonical MemPalace bridge:

```ts
Task({
  subagent_type: "general-purpose",
  description: "Persist episode $N to MemPalace",
  prompt: "Invoke the stream-rig skill, EpisodeMemory workflow, for episode $N. Read frontmatter from ~/.claude/MEMORY/STREAMRIG/Episodes/$N/Notes.md (title, guest, topics[], startedAt, endedAt, runtime). Then call the canonical bridge at ~/.claude/DOS/Tools/mempalace_bridge.py with action 'add_drawer' (wing=streamrig, room=Episodes, title='Episode $N — <title>', tags=['episode','episode-$N',...topics]) and action 'add_kg_fact' (NOT 'kg_add' — that is not a bridge action) once per (topic, guest, mentioned-tool) using subject='episode-$N', the now-ratified canonical predicates (covers_topic for topics, has_guest for the guest, relates_to for mentioned tools — RFC-0140 2026-06-28; the gate is BLOCK mode), and valid_from=startedAt. Await each call so the count is real. Return: drawer ID, the REAL registered KG fact count, and any bridge/gate errors. Under 200 words."
})
```

Delegates to `Workflows/EpisodeMemory.md`, which uses the centralized bridge wrapper (`hooks/lib/mempalace.ts → bridgeSync`/`bridgeFire`) — keeps the bridge invocation log ratio (RFC-0035 §6) clean by going through the wrapper, not raw subprocess.

<!-- partial: _intent-to-flag-table.md skill_name=StreamRig workflow_name=PostStream -->
## Intent-to-Flag Mapping

### Output set

| User Says | Flag | Effect |
|-----------|------|--------|
| (default) | (no flag) | Full multiplier — all 6 outputs |
| "notes only", "just show notes" | `--minimal` | Steps 1-2, skip 3-6 |
| "no clips" / "no social" / "no newsletter" | `--skip <name>` | Omit the named step |

### Recording source

| User Says | Flag | Effect |
|-----------|------|--------|
| (default) | (no flag) | Latest file in OBS output dir |
| Explicit path | `--recording <path>` | Override auto-detection |

### Mode

| User Says | Flag | Effect |
|-----------|------|--------|
| (default) | (no flag) | Standard quality, ~25 credits |
| "draft", "rough cut" | `--draft` | Use cheaper models where available |
| "premium", "best quality" | `--premium` | Use Opus + Flux for max quality, ~50 credits |

<!-- partial: _workflow-output-shape.md skill_name=StreamRig workflow_name=PostStream -->
## Output (in `~/.claude/MEMORY/STREAMRIG/Episodes/{n}/`)

| Artifact | File | Owner skill |
|---|---|---|
| Show notes + timestamps | `Notes.md` | content-analysis |
| Newsletter draft | `Newsletter.md` | dispatch |
| Short-form clips | `Clips/clip-{1..5}.mp4` | media |
| Episode thumbnail | `Thumbnail.png` | media |
| Social drafts (FB/IG/LinkedIn) | `SocialDrafts.json` | social-media |
| Episode memory drawer + KG facts | (in MemPalace) | EpisodeMemory |
| One artifact log line per file | `$ARTIFACTS_DIR/artifacts.jsonl` | this workflow |

## Done

PostStream complete. Operator reviews via the gate; nothing publishes without explicit per-artifact approval. Episode memory persisted for cross-episode search and KG tunnels.
