---
name: Followup
description: Post-meeting action-item extraction, commitment ledger update, day-12 circle-back discipline
status: STABLE
featured: true
icon: CheckSquare
bestPath:
  - title: "Capture Meeting Source"
    description: "Ingest transcript, notes, or verbal debrief. MCP calendar lookup for context."
  - title: "Extract Action Items"
    description: "Parse into atomic who-owes-what-by-when rows for commitments.md."
  - title: "Persist and Schedule"
    description: "Write followups/ log, update commitments, refresh Tier-1 relationship notes."
divergence_from_canonical:
  _intent-to-flag-table.md:
    partial_version: 1.0.0
    reason: "ChiefOfStaff Followup workflow uses workflow-specific intent-to-flag vocabulary; canonical Mode/Output two-table shape doesn't fit"
---

# Followup Workflow

## When to Use

- User says "follow up", "log the meeting", "action items", "capture commitments", "meeting follow-up"
- After a meeting, to extract action items and update the commitment ledger from a transcript, notes, or verbal debrief
- Use "close loop on {commitment}" to close a specific open commitment
- NOT for pre-meeting prep — use Brief instead

<!-- partial: _workflow-voice.md skill_name=ChiefOfStaff workflow_name=Followup action_phrase=" to log meeting" -->

## Step 1: Load Principal + Meeting Source

Read `~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/ChiefOfStaff/principal.md` (reuse session cache if loaded).

Meeting source, priority order:

1. **Prior brief** — if `~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/ChiefOfStaff/briefs/{date}_{attendee-slug}.md` exists, read it for desired outcome, attendees, and prior commitments.
2. **Calendar port** — resolve the `calendar.read` port (`use-spark`; no calendar MCP exists on this surface). If it resolves, fetch the event for timing, attendees, and description; else paste.
3. **Transcript** — Granola / Fireflies / Otter / Zoom, pasted or file path.
4. **Notes or verbal debrief** — principal pastes or tells the skill what happened.

## Step 2: Extract Action Items

Parse into atomic rows: `({who}) will ({what}) by ({when}) — source: {meeting name}`.

Rules:
- **Vague verbs rejected.** No "follow up", "circle back", "touch base", "sync up". Demand a specific verb (send, schedule, write, decide, review).
- **Every item needs a date.** Default to the principal's chase window (5 business days) if the meeting didn't set one.
- **Every item needs an owner.** Ambiguous ownership defaults to the principal.
- **Classify FROM / TO:** `Principal-owes-X` vs `X-owes-principal`.

## Step 3: Update the Commitment Ledger

Ledger: `~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/ChiefOfStaff/commitments.md`

Create the file with this header if missing:

```markdown
# Commitment Ledger

> Every `I'll get back to you` from every meeting and email. The Chase Date column is the single source of truth — Morning reads from here directly.

## Open

| Commitment | Owner | To / From | Made | Source | Deadline | Chase Date | Status |
|-----------|-------|-----------|------|--------|----------|-----------|--------|

## Closed

| Commitment | Owner | To / From | Closed On | Outcome |
|-----------|-------|-----------|-----------|---------|
```

Append a row to **Open** for every action item. Classify each item into one of three chase kinds, then compute the chase date deterministically — do NOT do the date math by hand. Call `computeChaseDate()` in `Packs/chief-of-staff/src/Tools/ChiefOfStaffHelpers.ts`:

- **Hard deadline** → `kind: 'hard-deadline'`, pass `deadline` → chase date = deadline − 2 business days
- **Soft "I'll get back to you"** → `kind: 'soft-getback'` → chase date = today + 5 business days (override with `softWindowBusinessDays` from `principal.md`)
- **"Circle back in 2 weeks"** → `kind: 'circle-back-2w'` → chase date = today + 12 calendar days (day-12 rule — the buffer is the discipline)

```bash
bun -e 'import { computeChaseDate } from "./Packs/chief-of-staff/src/Tools/ChiefOfStaffHelpers.ts"; console.log(computeChaseDate({ kind: "circle-back-2w", today: "2026-06-01" }))'
```

Picking the kind is your judgment; the date arithmetic (weekend-skipping for business days, day-12 calendar offset) belongs to the helper and is unit-tested in `ChiefOfStaffHelpers.test.ts`.

Then build the row STRING with `formatCommitmentRow(record)` from `ChiefOfStaffHelpers.ts` — do NOT hand-assemble the pipes. It emits the canonical 8-column Open schema (`| Commitment | Owner | To / From | Made | Source | Deadline | Chase Date | Status |`; Status defaults to `Open`), so Triage and Followup are ONE writer-of-format and Morning's column-position aging parse can never mis-read.

**Opt-in KG mirror — default OFF.** After the canonical row is appended, call `bridgeCommitmentToKg(record)` from `Tools/ChiefOfStaffHelpers.ts`. It is a hard no-op unless the operator has exported `COS_KG_BRIDGE=1`; when enabled it mirrors the row ONE-WAY into the MemPalace KG as a `committed_to` fact tagged `[ledger: ChiefOfStaff/commitments.md]` (provenance-partitioned from Algorithm-originated commitments). The markdown ledger stays canonical — the KG mirror is degraded and never the source, and a bridge failure never blocks the ledger write.

## Step 4: Close Prior Open Loops

Read the existing Open table. For rows where attendees overlap with this meeting, ask the principal: *"Was this closed in the meeting?"* If yes, move to Closed with today's date and a 1-line outcome. Never silently close — always ask.

## Step 5: Draft Thank-You if Tier-1

For any Tier-1 attendee, draft a thank-you in the principal's voice: short (matches length archetype), specific reference to one meeting moment, no meta-commentary. Tag `[DRAFT — REVIEW REQUESTED]`.

## Step 6: Write Meeting Log

Persist a compact meeting log to `~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/ChiefOfStaff/followups/{date}_{attendee-slug}.md`:

```markdown
---
date: {YYYY-MM-DD}
attendees: [{names}]
source: {transcript | notes | debrief}
---

## Outcome
{1-line result}

## Action Items Extracted
- {row}

## Notes
{any principal context worth preserving for future Brief runs}
```

This is what the next Brief workflow reads under "Prior meetings" for recurring contacts.

## Step 7: Update Relationship Log

For each Tier-1 attendee, update their entry in `principal.md`:
- **Last contact:** today's date
- **Personal nuggets:** append anything worth remembering (kid's name, hobby, life event, strong opinion)

Append only — never overwrite existing notes.

## Step 8: Present Summary

```
📝 MEETING LOGGED — {meeting name} — {date}

✅ ACTION ITEMS EXTRACTED ({n}):
  1. ({who}) will ({what}) by ({when})

📒 COMMITMENT LEDGER:
  + {n} new rows appended
  ✓ {n} prior loops closed

📂 MEETING LOG:
  followups/{date}_{attendee-slug}.md

💌 THANK-YOU DRAFT:
  To: {tier-1 attendee}
  [DRAFT — REVIEW REQUESTED]
  ---
  {draft body}
  ---
  Send? [yes / edit / skip]

🕸️ RELATIONSHIP LOG:
  Updated Tier-1 last-contact for: {names}
```

## Important Notes

- **Vague language is a bug.** "Follow up" without owner + date is noise.
- **Day-12, not day-14.** The buffer separates elite follow-up from mediocre.
- **Never silently close a loop.** Always ask the principal first.
- **Thank-yous stay as drafts** unless a Processing Rule allows send.
- **Redact transcripts before persisting** — apply `redact_patterns` before writing the meeting log.

## Intent-to-Flag Mapping

Sub-modes only — top-level triggers live in `SKILL.md`.

| User Says | Effect |
|-----------|--------|
| "action items only" | Extract and append to ledger; skip thank-you drafting |
| "close loop on {commitment}" | Move the named row from Open to Closed with today's date |
