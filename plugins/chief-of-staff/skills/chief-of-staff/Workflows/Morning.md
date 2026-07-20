---
name: Morning
description: Daily brief composer — seven sections, ≤90 seconds of read time
status: STABLE
featured: true
icon: Sunrise
bestPath:
  - title: "Gather Inputs"
    description: "Load calendar, commitment ledger, triage rollups, principal.md personal section."
  - title: "Compose Seven Sections"
    description: "Top-of-mind / today / must-do / handled / aging / heads-up / personal."
  - title: "Enforce One-Screen Discipline"
    description: "Compress to ≤90 seconds read time or the ritual dies."
divergence_from_canonical:
  _intent-to-flag-table.md:
    partial_version: 1.0.0
    reason: "ChiefOfStaff Morning workflow uses workflow-specific intent-to-flag vocabulary; canonical Mode/Output two-table shape doesn't fit"
---

# Morning Workflow

## When to Use

- User says "morning brief", "daily brief", "what's today", "good morning", "start my day"
- At the start (or the evening before) each day, for a one-screen digest of schedule, must-dos, aging commitments, and personal reminders
- NOT for pre-meeting dossiers — use Brief instead

<!-- partial: _workflow-voice.md skill_name=ChiefOfStaff workflow_name=Morning action_phrase=" to compose daily brief" -->

## Step 1: Resolve Target Day

- **Morning run:** target = today
- **Evening run (preferred):** target = tomorrow
- **Explicit:** "brief for {date}"

Record in ISO format.

## Step 2: Gather Inputs

Read the principal profile first (reuse session cache if loaded):
- `~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/ChiefOfStaff/principal.md`
- `~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/ChiefOfStaff/rules.md`

Then gather optional inputs. Missing files produce empty sections, not errors.

| Source | Purpose |
|---|---|
| **Calendar port** (`calendar.read` → `use-spark`; no calendar MCP on this surface) | Today's / tomorrow's calendar. Fall back to pasted calendar if the port doesn't resolve. |
| `commitments.md` | Open loops, chase dates active on target day, aging commitments. **Chase dates are derived from this file directly** — there is no separate chase-dates file. |
| **MemPalace KG** (`committed_to` facts — opt-in) | Cross-surface commitments: ledger rows mirrored by the F3 bridge PLUS Algorithm-originated `committed_to` facts that never passed through `commitments.md`. **Read ONLY when the operator has exported `COS_KG_BRIDGE=1`** (same flag that gates `bridgeCommitmentToKg`) — query via the MemPalace bridge `kg_query_predicate committed_to`. The markdown ledger stays canonical; the KG read is a degraded enrichment that never blocks the brief, and a failed/absent KG is an empty source, not an error. De-dupe against `commitments.md` rows by `{what, to}` so a mirrored row is surfaced once. |
| `briefs/{target_day}*.md` | Any pre-meeting briefs already prepared for the target day's meetings. |
| `triage-rollups/{recent}.md` | Rolled-up Read-Only-FYI from recent Triage runs. |
| `principal.md` | Personal wishlist, cadence targets, Tier-1 cold-relationship flags. |
| `rules.md` | Rules that affect brief composition (e.g., "always surface {name} in HEADS-UP"). |

**Aging commitments** = any row in `commitments.md` Open table where `chase_date <= target_day`. Parse each row with `parseCommitmentRow(row)` from `Tools/ChiefOfStaffHelpers.ts` and read its `.chase_date` — do NOT read by raw column position. The parser is legacy-tolerant (handles both the canonical 8-column rows and any historical 5-column rows a principal's existing file holds), so the aging calc can never mis-read the wrong column (the two-writers bug fix).

## Step 3: Compose the Seven Sections

Output in this exact order. Order matters — the principal reads top-to-bottom.

```
🌅 MORNING BRIEF — {target_day, formatted}

🧠 TOP OF MIND (3 bullets max — things that will bother you if you forget them)
  • {bullet}

📅 TODAY'S SCHEDULE (with pre-read link and 1-line context per meeting)
  • {HH:MM} — {meeting title} with {attendees}
    Context: {1-line from prior brief or relationship log}
    Pre-read: {link to briefs/{date}_{slug}.md if it exists}

🎯 MUST-DO ({n} — decisions or replies only the principal can handle)
  1. {action} — {why it is blocking}

✨ HANDLED WHILE YOU SLEPT (max 5 bullets — what the skill took care of)
  • {action + outcome}

⏰ OPEN LOOPS AGING (commitments going stale — suggest next action)
  • {commitment} — {days aging} — suggested: {draft reply / nudge / close}

🔮 HEADS-UP (tomorrow / this week — anything requiring prep today)
  • {event} — {preparation needed}
  • {chase date hitting today from commitments.md}

❤️ PERSONAL (family, health, birthdays, non-work things that matter)
  • {item}
```

## Step 4: Enforce Discipline

Apply these constraints before emitting:

1. **One-screen hard limit.** Read time ≤ 90 seconds (~200–250 words). If over, compress in this order: cut HANDLED to 3 bullets → collapse TOP OF MIND bullets to single phrases → cut schedule context lines. **Never cut MUST-DO or OPEN LOOPS AGING** — those are the brief's job.
2. **Empty sections are allowed.** Print the header with `(quiet overnight)` if nothing. Consistency of structure matters more than tight packaging.
3. **Absolute dates only.** Never "in a few days" — always "by Thursday" or "by 2026-04-16".
4. **No novel information.** Morning summarizes existing state; it does not invent surface items.
5. **PERSONAL is non-negotiable.** Print it even if empty.

## Step 5: Deliver and Persist

Save to `~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/ChiefOfStaff/morning/{target_day}.md`. If the principal gives feedback ("too long", "missed X"), ask: *"Should I `ADD TO RULES: WHEN composing morning brief THEN ...`?"*

## Important Notes

- **Read time is the metric**, not word count. Test by reading aloud.
- **Don't invent activities.** Empty HANDLED stays empty.
- **The brief is a ritual.** Consistent structure or it dies.

## Intent-to-Flag Mapping

Sub-modes only — top-level triggers live in `SKILL.md`.

| User Says | Effect |
|-----------|--------|
| "brief for {date}" | Compose for the named date |
| "evening brief" / "brief me on tomorrow" | Target = tomorrow |
