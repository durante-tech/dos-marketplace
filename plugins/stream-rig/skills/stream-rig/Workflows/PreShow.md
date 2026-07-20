---
name: PreShow
description: Switch to intro scene with episode metadata; record session-start
status: STABLE
bestPath:
  - title: "Session State Read"
    description: "Read the last episode number (lastN) from session.json."
  - title: "Episode Metadata Resolution"
    description: "Resolve the episode number, title, guest, and topics for this session."
  - title: "Intro Overlay Push"
    description: "Push metadata to the intro overlay and switch OBS to the intro scene."
  - title: "Session Start Recording"
    description: "Persist sessionStartMs and episode metadata to session.json."
---

# PreShow Workflow

## When to Use

- Trigger phrases: "preshow", "start show", "ready to stream"
- Lightweight show start — switching OBS to the intro scene and recording session-start, with no broadcast creation
- NOT for provisioning a new YouTube broadcast — that's GoLive; PreShow only switches the OBS intro scene

**Purpose:** Push episode metadata to the intro overlay, switch OBS to the intro scene, record session-start timestamp. Fast — ~10 sec, no credits.

<!-- partial: _workflow-voice.md skill_name=StreamRig workflow_name=PreShow action_phrase="prepare the show" -->


**Purpose:** Push episode metadata to the intro overlay, switch OBS to the intro scene, record session-start timestamp. Fast — ~10 sec, no credits.

<!-- partial: _workflow-voice.md skill_name=StreamRig workflow_name=PreShow action_phrase="prepare the show" -->

## Inputs

- `n` — episode number (required; auto-increments from `lastN` if omitted)
- `title` — episode title (required)
- `guest` — guest name (optional)
- `guestHandle` — guest social handle (optional, for lower-third later)
- `topics` — pipe-separated topic list (optional)

## Steps

### 1. Read session state

```bash
SESSION_FILE=~/.config/streamrig/session.json
LAST_N=$(jq -r '.lastN // 0' "$SESSION_FILE" 2>/dev/null || echo 0)
```

### 2. Resolve episode metadata

If `n` arg present, use it. Otherwise `n = lastN + 1`. Echo the resolved episode number to the operator.

### 3. Push intro overlay + switch scene

```bash
# dos-stream preshow takes positional [n] [agenda-pipe-separated]; the intro.html
# overlay contract is n/in/agenda, so topics map to the agenda. Title/guest are not
# part of the intro overlay — they're persisted to session.json in Step 4.
AGENDA="${TOPICS:-$TITLE}"
dos-stream preshow "$N" "$AGENDA"
```

`dos-stream` (on-PATH, from `~/dotfiles/scripts/scripts/`) sets the `Intro` browser-source URL (`intro.html?n=$N&in=5&agenda=...`), switches to scene `01_Intro`, and drops a chapter marker.

### 4. Record session-start

Write to `~/.config/streamrig/session.json`:
```json
{
  "lastN": <N>,
  "currentEpisodeN": <N>,
  "sessionStartMs": <now-ms>,
  "currentPhase": "intro",
  "title": "<TITLE>",
  "guest": "<GUEST?>",
  "topics": ["<topic1>", "<topic2>"]
}
```

<!-- partial: _intent-to-flag-table.md skill_name=StreamRig workflow_name=PreShow -->
## Intent-to-Flag Mapping

### Episode number

| User Says | Flag | Effect |
|-----------|------|--------|
| Numeric (`7`, `episode 7`) | `--n 7` | Use literal number |
| "next", omitted | (no flag — auto-increment) | `lastN + 1` |

### Output options

| User Says | Flag | Effect |
|-----------|------|--------|
| "no marker" | `--no-marker` | Skip chapter marker |
| "preview", "what would happen" | `--dry-run` | Print resolved URL + scene; no OBS push |
| "JSON" | `--format json` | Return session.json contents as JSON |

<!-- partial: _workflow-output-shape.md skill_name=StreamRig workflow_name=PreShow -->
## Output

- OBS scene = `01_Intro`
- Intro overlay shows: episode N, title, guest (if provided), topic list
- `~/.config/streamrig/session.json` updated with `sessionStartMs` + metadata
- Optional chapter marker in recording

## Done

PreShow complete. Operator typically starts recording (`obs rec start`) next, then advances phases via `streamrig phase <name>`.
