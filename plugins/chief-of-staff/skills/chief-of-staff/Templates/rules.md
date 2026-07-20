# Processing Rules Canon

> This is the living ruleset the chief-of-staff skill consults before every Triage, Brief, Followup, and Morning workflow.
> The principal adds rules here whenever an edge case surfaces.
>
> **File location (after skill init):** `~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/ChiefOfStaff/rules.md`
>
> **The `ADD TO RULES` pattern (from Tim Ferriss's outsourced-inbox method):**
> When the principal wants to teach the skill a new rule, they type or email:
>
> ```
> ADD TO RULES: <rule text>
> ```
>
> The Triage workflow detects this prefix and appends the rule to this file automatically.
> Rules accumulate — they never expire unless the principal explicitly removes them.

---

## How rules are applied

Every workflow reads this file before taking action. Rules are applied in **order of appearance** — earlier rules override later ones when they conflict. Keep the most important rules at the top.

Each rule follows this shape:

```
- WHEN <trigger condition> THEN <action> [BECAUSE <rationale>]
```

The `BECAUSE` clause is optional but recommended — it helps the skill generalize the rule to similar-but-not-identical situations.

---

## Example rules (replace with your own)

### Inbox

- WHEN sender domain is `{newsletter_domain}.substack.com` THEN bucket as Read-Only-FYI, never Principal-Must-Reply
- WHEN subject contains `[invoice]` or `[receipt]` THEN bucket as EA-Handles, draft 2-line acknowledgment, forward original to `accounting@{company}`
- WHEN sender is in Tier-1 contacts AND message contains a direct question THEN bucket as Principal-Must-Reply, flag urgency, draft a reply in the principal's voice for review
- WHEN subject contains "urgent" or "ASAP" from an unknown sender THEN bucket as Archive (spam signal) unless body contains Tier-1 name
- WHEN message is a calendar invite with no pre-read and no agenda THEN decline with the standard "can you share the outcome you're hoping for?" reply

### Calendar

- WHEN a meeting request has no stated outcome THEN do NOT book — ask the requester for the desired outcome first
- WHEN a meeting would break a focus block THEN propose an alternative time in the next Office Hours window
- WHEN a first-time external asks for a "quick call" THEN reply with the async-first default: "could you share the ask in writing first?"

### Relationships

- WHEN `{board_member_name}` emails THEN always flag for principal, never auto-reply, never mark as handled
- WHEN a Tier-1 contact has not been touched in 90 days THEN surface in the next Morning brief with a suggested outreach

### Drafts and voice

- WHEN drafting to family members THEN use all-lowercase casual mode and emojis freely
- WHEN drafting to board members or investors THEN stay in review-only mode (never send without approval)
- WHEN drafting bad news THEN shift to the principal's bad-news register (see `principal.md`)

### Follow-up discipline

- WHEN the principal says "I'll get back to you" in any meeting or email THEN capture as a commitment in `commitments.md` with a chase date 5 business days out
- WHEN the principal says "let's revisit in 2 weeks" THEN schedule the revisit at day 12, not day 14

### Commitments

- WHEN a commitment passes its chase date THEN nudge the principal once, then escalate to the Morning brief's must-do list 48 hours later
- WHEN a commitment has been chased 3 times with no action THEN draft a recovery email to the other party and surface both to the principal

---

## Principal-specific rules

Add your own rules below. Keep them atomic — one WHEN/THEN per bullet.

```
- WHEN ... THEN ...
```

---

## Rules removed

When a rule is no longer accurate, move it here rather than deleting — it helps the skill avoid re-learning deprecated behavior.

```
~ WHEN ... THEN ... (removed {date} because ...)
```
