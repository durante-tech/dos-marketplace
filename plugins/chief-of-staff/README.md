---
name: ChiefOfStaff
pack-id: durante-chiefofstaff-v0.0.1
version: 0.0.1
author: durante-tech
description: A local-first chief of staff that compounds — inbox triage, pre-meeting briefs, commitment tracking, and daily briefs, all against a living principal profile and Processing Rules canon.
type: skill
purpose-type: [operations, communication, memory, productivity]
platform: claude-code
dependencies: []
keywords: [chief-of-staff, executive-assistant, secretary, inbox-triage, meeting-brief, commitments, daily-brief, voice-matching, processing-rules, ea, cos]
---

# ChiefOfStaff

> A local-first chief of staff for founders of small teams. Triages your inbox, drafts in your voice, tracks every commitment, and tells you tomorrow what you'd have missed — with memory that compounds across every session.

---

## The Problem

Founders of 2–50 person startups live in fragmented context: investors, hires, customers, cofounder, board, family. The ambient overhead of that graph is where days disappear.

The existing AI-assistant tools each own one sliver — Superhuman makes you faster at email, Motion auto-schedules your calendar, ChatGPT-on-a-Project holds one chat tab's worth of context. None of them carry memory *across* email + calendar + commitments + relationships. None of them let you see and edit what the agent remembers. The previous generation (Clara, x.ai) died because they had neither memory nor trust-calibrated action.

The result: every session starts cold. Every meeting requires re-explaining who the attendee is. Every "I'll get back to you" falls into a void. The founder becomes the bottleneck on everything.

---

## The Solution

ChiefOfStaff is a skill with four workflows and two persistent artifacts that compound together:

**Four workflows:**
1. **Triage** — Four-bucket inbox classification (Principal-Must-Reply / Read-Only-FYI / EA-Handles / Archive) with voice-matched drafts and the Processing Rules canon applied.
2. **Brief** — One-screen pre-meeting dossier: attendees + history + talking points + landmines + asks + logistics. Read in 3 minutes.
3. **Followup** — Post-meeting action-item extraction into a commitment ledger with day-12 circle-back discipline and the 3-nudge chase rule.
4. **Morning** — Seven-section daily brief (top-of-mind / today / must-do / handled / aging / heads-up / personal), ≤90 seconds of read time.

**Two persistent artifacts (user-owned):**
- **`principal.md`** — Living profile: voice samples, Tier-1 contacts, sign-off preference, emoji tolerance, bad-news register shift, the principal's personal "no" phrase, cadence targets, redact_patterns.
- **`rules.md`** — The Processing Rules canon. Edge-case rules added over time via the `ADD TO RULES: <rule>` pattern (the Tim Ferriss outsourced-inbox method). Rules accumulate; the skill gets smarter without retraining.

**Everything is local.** All state in `~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/ChiefOfStaff/`. No cloud, no telemetry, no export without explicit invocation. Inbox data is the most sensitive corpus a founder owns — the posture is non-negotiable.

---

## Installation

This pack is designed for AI-assisted installation. Give this directory to your AI and ask it to install using `INSTALL.md`.

**What is DOS?** See the [DOS Project Overview](https://github.com/durante-tech/dos#what-is-dos).

---

## What's Included

| Component | Path | Purpose |
|-----------|------|---------|
| Skill definition | `src/SKILL.md` | Skill routing, trigger words, workflow map |
| Triage workflow | `src/Workflows/Triage.md` | Four-bucket inbox classification with voice-matched drafts |
| Brief workflow | `src/Workflows/Brief.md` | One-screen pre-meeting dossier generator |
| Followup workflow | `src/Workflows/Followup.md` | Action-item extraction + commitment ledger writer |
| Morning workflow | `src/Workflows/Morning.md` | Seven-section daily brief composer |
| Principal profile template | `src/Templates/principal.md` | Living profile: voice, Tier-1 contacts, preferences |
| Processing Rules template | `src/Templates/rules.md` | Rules canon: ADD TO RULES pattern + examples |

**Summary:**
- **Workflows:** 4 (Triage, Brief, Followup, Morning)
- **Templates:** 2 (principal.md, rules.md)
- **Dependencies:** None. The skill is self-contained; optional delegation to Research and Investigation skills for attendee enrichment.

---

## What Makes This Different

This sounds like every AI assistant pitch — "drafts your email, preps your meetings." What makes this approach different?

- **Memory over model weights.** The skill gets smarter by accumulating rules in `rules.md` and voice samples in `principal.md`, not by retraining anything. The principal can see and edit every remembered fact.
- **Local-first by construction.** All state lives in the user's `~/.claude/` tree. No cloud, no telemetry, no account, no export — unless the user explicitly invokes it.
- **Generic Pack, personal instance.** The Pack ships with zero hardcoded user content. Personalization happens entirely in the principal profile and Processing Rules canon — the two files the user actually owns.
- **Drafts-by-default.** Nothing sends without approval in v0.0.1. The autonomy graduation path is per-recipient-class rules in the canon, not a global toggle.
- **One-screen discipline.** Every brief, dossier, and morning memo fits on one screen. Executive attention is the scarcest resource; the skill treats it that way.
- **Built on the craft.** The workflows encode heuristics from the actual EA literature — Melba Duncan (HBR), Sam Corcos (Levels / First Round), Tim Ferriss's Processing Rules method — not generic AI assistant tropes.

---

## Invocation Scenarios

| Trigger | What Happens |
|---------|--------------|
| "triage my inbox" | Four-bucket classification + voice-matched drafts presented for approval |
| "prep for my 3pm" / "brief me on {name}" | One-screen pre-meeting dossier (read in 3 min) |
| "follow up on that meeting" / "log the meeting" | Action items extracted, commitment ledger updated, day-12 circle-backs scheduled |
| "morning brief" / "good morning" | Seven-section daily brief (≤90 second read) |
| "brief me on tomorrow" | Evening-run variant — brief for tomorrow, delivered tonight |
| "ADD TO RULES: WHEN X THEN Y" | Appends a new rule to the Processing Rules canon |

---

## Example Usage

### First-time setup

```
User: "triage my inbox"

Skill:
1. Detects missing principal.md and rules.md in SKILLCUSTOMIZATIONS/ChiefOfStaff/
2. Copies templates from Templates/ to the user's customization directory
3. Walks the principal through filling in voice samples, Tier-1 contacts, sign-off preference
4. Once filled, proceeds to full Triage workflow
```

### Meeting prep

```
User: "prep for my 3pm with {attendee}"

Skill:
1. Reads principal.md for Tier-1 status and relationship notes
2. Reads commitments.md for any open loops with the attendee
3. Delegates to Research for first-time attendee enrichment (with redact_patterns applied)
4. Produces one-screen dossier: outcome / why now / attendees / history / talking points / landmines / asks / logistics
5. Saves to briefs/{date}_{slug}.md for the Followup workflow to pick up later
```

### Commitment capture

```
User: "follow up on my 3pm"

Skill:
1. Reads the prior brief at briefs/{date}_{slug}.md
2. Asks for transcript, notes, or verbal debrief
3. Extracts action items in atomic form: (who) will (what) by (when)
4. Appends rows to commitments.md with chase dates (day-12 rule for 2-week revisits)
5. Drafts thank-you note if attendee was Tier-1
6. Updates Tier-1 relationship log in principal.md with last-contact date and personal nuggets
```

### Morning ritual

```
User: "morning brief"

Skill:
1. Reads calendar, commitments.md, chase-dates.md, recent triage rollups, principal.md personal section
2. Composes seven sections: top-of-mind / today / must-do / handled / aging / heads-up / personal
3. Enforces ≤90-second read-time discipline
4. Saves history at morning/{date}.md
```

### Learning a new rule

```
User: "ADD TO RULES: WHEN sender domain is substack.com THEN bucket as Read-Only-FYI, never Principal-Must-Reply"

Skill:
1. Triage workflow detects the ADD TO RULES prefix
2. Appends the rule to rules.md in order of appearance
3. Every future Triage run applies the rule automatically
```

---

## Configuration

### Required

The two artifact files live at:
- `~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/ChiefOfStaff/principal.md`
- `~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/ChiefOfStaff/rules.md`

On first run, the skill copies the templates from `src/Templates/` into the user's customization directory and prompts the principal to fill them in.

### Optional (delegated skills)

- **research skill** — first-time attendee enrichment in the Brief workflow
- **investigation skill** — deeper Tier-1 due diligence when meeting stakes warrant it

The skill works fine without these — enrichment sections will simply be empty for first-time attendees.

---

## Customization

### Recommended

Create the two artifact files and keep them up to date. The more complete `principal.md` is, the better every workflow performs — voice matching, Tier-1 routing, cadence cold-flag detection, and personal-section composition all read it directly.

### Optional

| Customization | Location | Impact |
|--------------|----------|--------|
| Preferences | `SKILLCUSTOMIZATIONS/ChiefOfStaff/PREFERENCES.md` | Override workflow defaults (target brief length, default chase window, etc.) |
| Principal profile | `SKILLCUSTOMIZATIONS/ChiefOfStaff/principal.md` | The living profile |
| Rules canon | `SKILLCUSTOMIZATIONS/ChiefOfStaff/rules.md` | Edge-case rules |
| Commitment ledger | `SKILLCUSTOMIZATIONS/ChiefOfStaff/commitments.md` | Auto-created by Followup; edit directly to close or re-open loops |

---

## v0.0.1 Scope

**Shipped in this release:**
- Triage, Brief, Followup, Morning workflows
- principal.md and rules.md starter templates
- Local-first posture with redact_patterns support

**Planned for v0.0.3:**
- **`Surface`** — nightly proactive pattern scan across calendar + commitments + relationships (travel conflicts, cold Tier-1s, expiring contracts, dropped commitments, wishlist closures)
- **`Loops`** — open-loops audit with 3-nudge chase discipline and recovery-email drafts
- **`DecisionMemo`** — Bezos 6-pager narrative pre-read generator for COS-mode
- **Cross-channel integration** — Gmail + Google Calendar + Contacts via existing MCP servers
- **MemPalace wing** — Commitments / Relationships / Rules / VoiceSamples drawers for compounding graph-shaped memory
- **Cron-invoked Morning** — automatic 6pm-prior-day runs via CronCreate

---

## Credits

- **Melba Duncan** — The Case for Executive Assistants (HBR, 2011) — the canonical framing
- **Sam Corcos** (Levels) — A Tactical Guide to Working with EAs (First Round Review) and Tim Ferriss Show #694
- **Tim Ferriss** — The Holy Grail: How to Outsource the Inbox (2008) — the Processing Rules method
- **Robert Schlesinger** — White House Ghosts (2008) — the ghostwriter voice-matching canon
- **The EA Campus / Base HQ / Pivot Strategies** — practitioner writing on drafting in the principal's voice

---

## Related Work

- **DOS Research Pack** — delegated to for first-time attendee enrichment
- **DOS Investigation Pack** — delegated to for Tier-1 due diligence
- **DOS MemPalace Pack** — v0.0.3 will add a ChiefOfStaff wing for graph-shaped commitment and relationship memory
- **DOS Telos Pack** — reads ChiefOfStaff's relationship graph for multi-year life-OS planning

---

## Changelog

### 0.0.1 — 2026-04-12
- Initial release
- Four workflows: Triage, Brief, Followup, Morning
- Two artifact templates: principal.md, rules.md
- Local-first posture with redact_patterns
- Processing Rules canon with ADD TO RULES pattern
