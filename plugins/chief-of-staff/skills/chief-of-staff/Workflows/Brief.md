---
name: Brief
description: One-screen pre-meeting dossier — attendees, history, talking points, landmines, asks, logistics
status: STABLE
featured: true
icon: FileText
bestPath:
  - title: "Load Meeting Context"
    description: "Gather attendee list, time, topic, pre-reads. MCP calendar lookup if available."
  - title: "Enrich Attendees in Parallel"
    description: "Read principal.md history; delegate parallel Research calls for unknowns."
  - title: "Synthesize Dossier"
    description: "Produce one-screen brief — delivered the night before, not morning-of."
divergence_from_canonical:
  _intent-to-flag-table.md:
    partial_version: 1.0.0
    reason: "ChiefOfStaff Brief workflow uses workflow-specific intent-to-flag vocabulary; canonical Mode/Output two-table shape doesn't fit"
---

# Brief Workflow

## When to Use

- User says "brief me", "prep for {name}", "meeting prep", "who am I meeting with", "dossier"
- Before an upcoming meeting, to assemble attendee context, history, and talking points on one screen
- Best run the night before a meeting, not morning-of
- NOT for the daily digest — use Morning for "morning brief" / "daily brief"

<!-- partial: _workflow-voice.md skill_name=ChiefOfStaff workflow_name=Brief action_phrase=" to prepare meeting dossier" -->

## Step 1: Load Principal + Meeting Context

Read `~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/ChiefOfStaff/principal.md` (reuse session cache if loaded).

Gather meeting context, priority order:

1. **Calendar port** — resolve the `calendar.read` port (the installed `use-spark` skill reads calendar / availability; there is no calendar MCP on this surface). If it resolves, fetch the target meeting directly — "Prep for my 3pm" becomes a calendar query for today's events, filtered to 3pm.
2. **Paste** — principal pastes a calendar invite into the chat.
3. **Named attendee** — "brief me on my meeting with {name}" — look up in calendar via MCP if available, otherwise ask the principal for the time.

Parse into: `{meeting_title, when, where, attendees[], topic, pre_read}`. If critical fields are missing, ask once — do not guess.

## Step 2: Load Relationship Context

For each attendee:
- **Tier-1 match** — pull relationship note from `principal.md`
- **Open commitments** — read `~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/ChiefOfStaff/commitments.md` for any open loops with the attendee
- **Prior meetings** — check `~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/ChiefOfStaff/followups/` for recent meeting logs with the attendee

## Step 3: Parallel Enrichment for Unknowns

For attendees not in Tier-1 and with no local history, enrich via delegation:

1. Apply `redact_patterns` from `principal.md` to anything leaving the local process.
2. **Dispatch all unknown-attendee enrichment calls in parallel** — if there are 3 unknowns, issue 3 concurrent Research calls in a single tool-call block. Never sequential per-attendee round-trips.
3. Ask each for a 3-line bio: (1) what they do now, (2) what they're known for, (3) mutual connections.

Spawn one Task per unknown attendee, all in a single tool-call block:

```ts
// One Task per unknown attendee — issue them all in the SAME tool-call block (parallel)
Task({
  subagent_type: "general-purpose",
  description: "Brief enrichment — [attendee_name]",
  prompt: "Invoke the research skill, QuickResearch workflow. Query: '[attendee_name] [redacted company/role context]'. Return a 3-line bio: (1) what they do now — current role + company; (2) what they're known for — public work, talks, writing, notable projects; (3) mutual connections or shared communities visible from public sources. Apply redaction: do not echo or query any pattern matched by the principal's redact_patterns. Under 150 words."
})
Task({
  subagent_type: "general-purpose",
  description: "Brief enrichment — [next_attendee_name]",
  prompt: "Invoke the research skill, QuickResearch workflow. Query: '[next_attendee_name] ...'. Same 3-line bio contract. Under 150 words."
})
// ... one Task per remaining unknown attendee
```

Do not enrich Tier-1 attendees — wasted tokens.

## Step 4: Produce the One-Screen Dossier

```
📋 MEETING BRIEF — {attendee or company} — {date, time, location/URL}

🎯 DESIRED OUTCOME (1 line): {what does a win look like?}
⏱️ WHY NOW: {the single reason this meeting exists}

👥 ATTENDEES:
  • {Name}, {title}, {company}
    {2-line bio — role + what they're known for}
    Decision-maker: {yes/no/influencer}
    Last contact: {date — summary} | Personal: {kids, alma mater, hobby if known}

📜 HISTORY:
  • Last interaction: {date} — {1-line summary}
  • Open commitments FROM principal: {list from commitments.md}
  • Open commitments TO principal: {list from commitments.md}
  • Things the principal said they'd do or send: {list}

💡 TALKING POINTS ({3–5}):
  1. {Topic + principal's position}

⚠️ LANDMINES:
  • {Topics to avoid, sensitivities, recent bad news}

🎁 ASKS:
  • What the other side probably wants: {inference}
  • What the principal should ask for: {recommendation}

🧭 LOGISTICS:
  • Location / Zoom: {URL or address}

➡️ NEXT STEPS PLACEHOLDER:
  (Filled in after the meeting by the Followup workflow)
```

**One screen is a hard constraint.** If it overflows, cut talking points and landmines to the essentials before anything else.

## Step 5: Deliver and Save

Write the dossier to `~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/ChiefOfStaff/briefs/{date}_{attendee-slug}.md` and announce the path. Default behavior is save-automatically so the Followup workflow can pick it up later.

## Important Notes

- **One screen is non-negotiable.** Violating it breaks the ritual — the principal stops reading if briefs feel like homework.
- **No speculation in landmines.** Only verifiable issues — fabricated tensions poison the brief.
- **Redact before delegating.** All enrichment passes honor `redact_patterns` from `principal.md`.

## Intent-to-Flag Mapping

Sub-modes only — top-level triggers live in `SKILL.md`.

| User Says | Effect |
|-----------|--------|
| "quick brief" | Skip enrichment entirely — local context only |
| "brief but skip landmines" | Output without the landmines section |
