---
name: EndShow
description: Switch to outro scene with shipped/runtime metadata; auto-trigger PostStream
status: STABLE
bestPath:
  - title: "Runtime & Highlights Resolution"
    description: "Compute session runtime and resolve highlights via the preset's endshowExtractor."
  - title: "Outro Overlay Push"
    description: "Push the outro overlay (episode, runtime, highlights) and switch OBS to the outro scene with a chapter marker."
  - title: "PostStream Handoff"
    description: "Auto-schedule the PostStream workflow unless suppressed."
  - title: "Session Reset"
    description: "Clear session.json state so the next episode starts clean."
---

# EndShow Workflow

## When to Use

- Trigger phrases: "endshow", "wrap show", "end stream"
- Wrapping a live episode — switching to the outro scene and closing out session state
- NOT for the post-stream content multiplier itself — that's PostStream, which EndShow auto-schedules by default

**Purpose:** Compute runtime from session-start, push outro overlay with highlights/runtime, switch to outro scene, create marker, optionally auto-schedule PostStream.

<!-- partial: _workflow-voice.md skill_name=StreamRig workflow_name=EndShow action_phrase="wrap the show" -->


**Purpose:** Compute runtime from session-start, push outro overlay with highlights/runtime, switch to outro scene, create marker, optionally auto-schedule PostStream.

<!-- partial: _workflow-voice.md skill_name=StreamRig workflow_name=EndShow action_phrase="wrap the show" -->

## Inputs

- `n` — episode number (defaults to `currentEpisodeN` from session.json)
- `highlights` — pipe-separated highlights (optional; preset-dependent extractor used if absent)
- `runtime` — `HH:MM:SS` (optional; computed from `sessionStartMs` if omitted)
- `nextEp` — preview text for next episode (optional)

## Steps

### 1. Compute runtime

If `runtime` arg present, use it. Otherwise:
```bash
NOW_MS=$(date +%s)000
START_MS=$(jq -r '.sessionStartMs // 0' ~/.config/streamrig/session.json)
RUNTIME=$(awk "BEGIN{secs=int(($NOW_MS - $START_MS) / 1000); printf \"%02d:%02d:%02d\", secs/3600, (secs%3600)/60, secs%60}")
```

### 2. Resolve highlights via preset extractor

Read preset's `endshowExtractor` field:
- `manual` — require `--highlights` arg (most podcast presets)
- `outline` — read `~/.claude/MEMORY/STREAMRIG/Episodes/{n}/Outline.md` `## Topics covered` section
- `git-shipped` — `git log --since=midnight --format="%s"` (build-in-public preset)
- `linear` — query Linear API for completed tickets in window (v0.2+)

### 3. Push outro overlay + switch scene

```bash
# dos-stream endshow takes positional [n] [shipped-pipe-separated] [runtime HH:MM:SS];
# highlights map to the outro.html `shipped` param (its contract is n/shipped/runtime).
dos-stream endshow "$N" "$HIGHLIGHTS" "$RUNTIME"
```

`dos-stream` (on-PATH) sets the `Outro` browser-source URL (`outro.html?n=$N&shipped=...&runtime=$RUNTIME`), switches to scene `05_Outro`, and drops an "Outro" chapter marker. Note: `next-ep` has no slot in the outro.html contract — surface it to the operator separately if provided.

### 4. Schedule PostStream

Unless `--no-poststream` flag passed, auto-schedule the PostStream workflow:
```
Skill("stream-rig", "post stream for episode $N")
```

PostStream runs asynchronously after the operator stops recording (it needs the final recording file).

### 5. Update session state

```json
{
  "currentEpisodeN": null,
  "currentPhase": null,
  "lastEpisodeEndedAt": "<ISO timestamp>",
  "lastEpisodeRuntime": "<HH:MM:SS>"
}
```

<!-- partial: _intent-to-flag-table.md skill_name=StreamRig workflow_name=EndShow -->
## Intent-to-Flag Mapping

### Runtime source

| User Says | Flag | Effect |
|-----------|------|--------|
| (default) | (no flag) | Compute from session.json `sessionStartMs` |
| Explicit `01:42:00` | `--runtime 01:42:00` | Use literal value |
| "no runtime", "skip duration" | `--no-runtime` | Omit runtime from overlay |

### Highlight extraction

| User Says | Flag | Effect |
|-----------|------|--------|
| Pipe list (`auth\|billing\|Q&A`) | `--highlights "..."` | Use literal list |
| (default per preset) | (no flag) | Use preset's endshowExtractor |
| "manual fill", "I'll add later" | `--highlights "-"` | Placeholder; outro shows runtime only |

### PostStream control

| User Says | Flag | Effect |
|-----------|------|--------|
| (default) | (no flag) | Auto-schedule PostStream |
| "skip post-stream", "I'll run it later" | `--no-poststream` | Don't schedule |

<!-- partial: _workflow-output-shape.md skill_name=StreamRig workflow_name=EndShow -->
## Output

- OBS scene = `04_Outro`
- Outro overlay shows: episode N, runtime, highlights, next-episode preview
- Recording chapter marker "Outro" created
- `~/.config/streamrig/session.json` reset for next session
- PostStream workflow scheduled (unless suppressed)

## Done

EndShow complete. Stop OBS recording; PostStream will pick up the recording file when it runs.
