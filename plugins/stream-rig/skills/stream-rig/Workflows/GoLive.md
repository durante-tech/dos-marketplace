---
name: GoLive
description: From a live subject, provision the YouTube broadcast (metadata + thumbnail) and configure every OBS scene/overlay to reflect it, then hand the operator a ready-to-stream rig.
status: STABLE
preset: build-in-public
bestPath:
  - title: "Preflight & Episode Resolution"
    description: "Verify OBS/YouTube auth and recording dir, then resolve the episode number and branch."
  - title: "Interview & Metadata Generation"
    description: "Collect schedule/visibility/thumbnail choices, draft an agenda, and generate YouTube metadata."
  - title: "Broadcast & Thumbnail Provisioning"
    description: "Generate the thumbnail via Media and create the scheduled YouTube broadcast."
  - title: "OBS Configuration"
    description: "Set overlays on the existing live OBS sources and switch to the intro scene."
  - title: "Artifact Drafting"
    description: "Draft announcements, show notes, and a MemPalace episode entry, all draft-only."
---

# GoLive Workflow

## When to Use

- Trigger phrases: "go live about X", "new live: X", "set up a youtube live", "provision live", "schedule broadcast", "live setup"
- Starting a new live stream from a subject when a YouTube broadcast needs to be provisioned end-to-end
- NOT for a lighter pre-show scene switch with no broadcast creation — use PreShow instead

**Purpose:** Operator gives a live SUBJECT; this provisions the YouTube side
(broadcast metadata + thumbnail), configures every OBS scene/overlay on the
EXISTING live sources, drafts announcements + show-notes, and leaves the rig on
`01_Intro` ready to stream. ~2-4 min, ~1 Media credit + ~200 YT API units.

<!-- partial: _workflow-voice.md skill_name=StreamRig workflow_name=GoLive action_phrase="provision a YouTube live and configure OBS" -->


**Purpose:** Operator gives a live SUBJECT; this provisions the YouTube side
(broadcast metadata + thumbnail), configures every OBS scene/overlay on the
EXISTING live sources, drafts announcements + show-notes, and leaves the rig on
`01_Intro` ready to stream. ~2-4 min, ~1 Media credit + ~200 YT API units.

<!-- partial: _workflow-voice.md skill_name=StreamRig workflow_name=GoLive action_phrase="provision a YouTube live and configure OBS" -->

## Prerequisites (checked in Step 1, not assumed)
- OBS running with WebSocket v5 on `ws://localhost:4455` (`obs current` returns a scene).
- YouTube authorized once: `bun ~/.claude/skills/stream-rig/Tools/YouTubeLive.ts whoami` succeeds (else point the operator to `Tools/SETUP-YouTube.md`).
- Preset `build-in-public` loaded (scene/overlay/metadata contract).

## Inputs
- `subject` — the live topic (required; the skill argument). e.g. "Wiring Fable 5 into a real build".
- `n` — episode number (optional; default `lastN + 1` from `~/.config/streamrig/session.json`).
- Interview answers (Step 3): schedule, visibility, thumbnail vibe, announcements.

## Steps

### 1. Preflight (fail fast, fix cheap)
```bash
PRESET=~/.claude/skills/stream-rig/Presets/build-in-public.yaml
# OBS reachable?
obs current >/dev/null 2>&1 || echo "WARN: OBS not reachable on :4455 — start OBS / enable WebSocket."
# YouTube authorized?
bun ~/.claude/skills/stream-rig/Tools/YouTubeLive.ts whoami 2>/dev/null || echo "NEEDS-AUTH: run Tools/SETUP-YouTube.md then 'YouTubeLive.ts auth'."
# Recording dir exists (the sweep found it missing → recording would fail):
mkdir -p "$HOME/Documents/Durante Technologies/Recordings"
# Audio (non-fatal): warn if BlackHole/aggregate absent
system_profiler SPAudioDataType 2>/dev/null | grep -qi blackhole || echo "NOTE: BlackHole not installed — desktop audio won't be captured on stream."
# Premium capture quality (auto-fix then confirm): supersample the Retina screen
# (4K canvas -> kept output, Lanczos), match scale filters, HEVC-hardware record.
# Idempotent — a rig already at spec is a clean no-op. Skipped if OBS unreachable.
PREMIUM_REPORT="(OBS unreachable — premium preflight skipped)"
if obs current >/dev/null 2>&1; then
  PREMIUM_REPORT=$(bun ~/.claude/skills/stream-rig/Tools/ObsPremiumPreflight.ts --record-profile "DuranteOS - Record" 2>&1)
fi
echo "$PREMIUM_REPORT"
```
Surface any WARN/NEEDS-AUTH lines to the operator. `NEEDS-AUTH` is the only hard
blocker for broadcast creation — offer to run `auth` (opens browser) before continuing.
Keep `$PREMIUM_REPORT` — it lists exactly what the premium preflight changed (or
"already at spec") and is echoed back in the Step 8 ready-to-go summary so the
operator confirms the capture quality alongside the broadcast metadata. If the report
contains a `STILL NEEDS OPERATOR` line (e.g. the record profile is the active one),
relay it — the HEVC switch lands when they next select that profile.

### 2. Resolve episode number + branch
```bash
SESSION=~/.config/streamrig/session.json
N=${ARG_N:-$(( $(jq -r '.lastN // 0' "$SESSION" 2>/dev/null || echo 0) + 1 ))}
BRANCH=$(git -C "$PWD" branch --show-current 2>/dev/null || echo main)
```

### 3. Interview (AskUserQuestion — ONE call, ≤4 questions, smart defaults)
Ask, with the first option as the recommended default:
- **Schedule** → `Go live now` (start = now+2min) | `In 1 hour` | `Tonight 20:00 BRT` | (Other = custom RFC3339)
- **Visibility** → `Public` | `Unlisted` | `Private`
- **Thumbnail vibe** → `Terminal-glow (brand)` | `Code-on-dark` | `Face + big title` | `Minimal wordmark`
- **Also draft** (multiSelect) → `X + LinkedIn announcements` | `Show-notes doc` | `MemPalace episode entry`

Then generate a draft **agenda** (3-4 punchy items) from the subject and show it for
confirmation in Step 4 (operator edits via free text if desired). Agenda items use the
intro overlay's `|`-separated contract; `<em class="cyan">…</em>` may wrap key phrases.

### 4. Generate metadata (from preset `golive.youtube` templates)
Fill the preset templates with `{SUBJECT}`, `{N}`, `{AGENDA_BULLETS}`, `{LINKS}`:
- **title** = `"{SUBJECT} — DuranteOS Build Log #{N}"` (≤100 chars; truncate subject if needed)
- **description** = descriptionTemplate with agenda as `- ` bullets + links
- **tags** = preset.defaultTags (+ any subject keywords)
- **category** = `28`
- **scheduledStartTime** = from Step 3 schedule (RFC3339, future)
Show the operator a compact preview (title + first 3 desc lines + agenda + visibility + when). One confirm.

### 5. Thumbnail (media skill)
Fill `golive.thumbnail.promptTemplate` with the chosen vibe + `{SUBJECT_SHORT}` + brand tokens (read DESIGN.md if present), then:
```
Skill("media", "generate a 1280x720 YouTube thumbnail: <filled promptTemplate>. Save to ~/.claude/MEMORY/STREAMRIG/Episodes/<N>/thumbnail.jpg")
```
Capture the output path `THUMB`. If Media is unavailable, skip thumbnail (broadcast still creates) and warn.

### 6. Create the broadcast (YouTubeLive.ts)
```bash
bun ~/.claude/skills/stream-rig/Tools/YouTubeLive.ts create-broadcast \
  --title "$TITLE" \
  --description "$DESCRIPTION" \
  --start "$START_RFC3339" \
  --visibility "$VISIBILITY" \
  --tags "$TAGS_CSV" \
  --category 28 \
  ${THUMB:+--thumbnail "$THUMB"} \
  --json
```
Parse the JSON result → `BROADCAST_ID`, `WATCH`, `STUDIO`, `ingestion{address,key}`.
(Add `--auto-start` only if the operator wants the broadcast to go live the instant
OBS starts pushing. Default leaves them in control.) On `--dry-run` (operator said
"preview"), print bodies and STOP before this call.

### 7. Configure OBS — set overlays on EXISTING sources (NEVER rebuild)
> Anti-criterion: do NOT run `obs-scene-build` — the live collection has drifted from the builder; rebuilding would clobber it.
```bash
# Intro agenda + switch to 01_Intro (reuses the existing dos-stream path):
dos-stream preshow "$N" "$AGENDA_PIPE_SEPARATED"
# Lower Third name/handle (live source is a local-file browser; set URL with params):
obs raw SetInputSettings "$(jq -nc --arg u "file://$HOME/Durante/Overlays/lower-third.html?name=Lucas&handle=@lucasgertel" '{inputName:"Lower Third",inputSettings:{is_local_file:false,url:$u}}')"
# Terminal Frame branch + initial phase:
obs raw SetInputSettings "$(jq -nc --arg u "file://$HOME/Durante/Overlays/terminal-frame.html?branch=$BRANCH&phase=observe" '{inputName:"Terminal Frame",inputSettings:{url:$u}}')"
```
Verify: `obs current` returns `01_Intro`. (If the operator chose Path A custom ingestion,
surface `ingestion.address` + `ingestion.key` for OBS → Settings → Stream → Custom; otherwise
they pick this broadcast in OBS "Manage Broadcast".)

### 8. Confirmation summary (the "ready to go live" gate)
Print a single block:
```
READY — DuranteOS Build Log #<N>
  Subject:   <SUBJECT>
  When:      <WHEN>   Visibility: <VISIBILITY>
  Watch:     <WATCH>
  Studio:    <STUDIO>
  Thumbnail: <THUMB>
  OBS scene: 01_Intro   (overlays set: intro agenda, lower-third, terminal-frame)
  Capture:   <PREMIUM_REPORT first line — "already at spec" or what was auto-fixed>
  Next:      start streaming in OBS (or `obs stream start`), then `dos-stream phase build` as you work.
```
The `Capture:` line collapses `$PREMIUM_REPORT` to its headline (e.g. "already at spec"
or "canvas -> 3840x2160; HEVC record; rescaled 13 items"). If the report had a
`STILL NEEDS OPERATOR` line, add it as a second `Capture:` row so the operator sees the
one manual step (profile switch for HEVC) before going live.

### 9. Artifacts (per Step 3 multiselect; all draft-only)
- **Announcements** → `SOCIAL_DRAFT_ONLY=1 Skill("social-media", "draft X and LinkedIn posts from golive.announcements templates: subject=<S>, n=<N>, when=<WHEN>, watch=<WATCH>. DRAFT ONLY — do not publish.")` → save to episode dir. The `SOCIAL_DRAFT_ONLY=1` env is the unspoofable draft-only boundary (SocialMedia #147): FB/LinkedIn are forced to draft and IG is hard-refused, so "DRAFT ONLY" is a structural guarantee rather than a hoped-for prompt convention.
- **Show-notes** → write `~/.claude/MEMORY/STREAMRIG/Episodes/<N>/ShowNotes.md` (subject, agenda, links, broadcast id, watch URL, date).
- **MemPalace episode** → append a drawer (`add_drawer`) + KG facts via the canonical bridge, exactly as `EpisodeMemory` Step 2-3: use action `add_kg_fact` via the AWAITED `bridgeSync` (NOT `bridgeFire('kg_add', …)` — `kg_add` is not a bridge action and fire-and-forget hides the failure), write the now-ratified canonical predicate `covers_topic` for the topic facts (RFC-0140 2026-06-28) and `relates_to` for the broadcast facts (the bespoke `scheduled_broadcast` is still queued via `Tools/predicate-proposals.ts`, not written raw — it hits the BLOCK-mode gate), and pass `valid_from = startedAt`.
- Log every written file to `$ARTIFACTS_DIR/artifacts.jsonl` (see Artifact Tracking).

## Intent-to-Flag Mapping
| Operator says | Effect |
|---|---|
| "go live about X" / "new live: X" / "stream X" | subject=X, full GoLive |
| "preview" / "dry run" / "what would happen" | `--dry-run`: stop after Step 6 bodies; no broadcast, no OBS writes |
| "unlisted" / "private" | sets visibility |
| "now" / "in an hour" / "tonight" | sets schedule (skips that interview question) |
| "no thumbnail" | skip Step 5 |
| "auto start" | add `--auto-start` |
| "episode 12" / "n 12" | N=12 |

## Output
- A scheduled YouTube broadcast (metadata + thumbnail), watch + studio URLs.
- OBS on `01_Intro` with intro/lower-third/terminal overlays set on the live sources.
- `~/.claude/MEMORY/STREAMRIG/Episodes/<N>/` with thumbnail, ShowNotes.md, social drafts.
- `~/.config/streamrig/session.json` updated (`lastN`, `currentEpisodeN`, `sessionStartMs`, broadcast id).

## Done
GoLive complete. The operator starts streaming in OBS; the broadcast is live-ready.
Mid-stream they drive `dos-stream phase <name>` / scene swaps; afterward `EndShow` →
`PostStream` close the loop.
