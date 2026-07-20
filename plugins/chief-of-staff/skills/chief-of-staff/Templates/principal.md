# Principal Profile

> This is the living profile the chief-of-staff skill reads at the start of every workflow.
> Edit it directly. Every field is optional — the skill adapts to what's present.
>
> **File location (after skill init):** `~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/ChiefOfStaff/principal.md`

---

## Identity

- **Name:** `{principal_name}`
- **Role:** `{role — e.g., founder, CEO, operator}`
- **Company:** `{company_name}`
- **Timezone:** `{IANA timezone, e.g., America/Sao_Paulo}`

## Voice

Examples the principal has written (3–5 short samples covering routine, warm, and bad-news registers):

```
{paste 3–5 short sent emails here — the more varied, the better}
```

**Markers to match exactly (not approximate):**

- **Greeting style:** `{e.g., "Hi {name}", "{name} —", first name only, no greeting}`
- **Sign-off:** `{e.g., "Thanks", "Best", "—L", initials only, none}`
- **Length archetype:** `{one-sentence | 2–3 sentences | short paragraph | full paragraph}`
- **Punctuation tells:** `{em-dash vs semicolon, Oxford comma y/n, ellipses, single vs double space}`
- **Capitalization:** `{sentence case | Title Case | all-lowercase in casual mode}`
- **Emoji tolerance:** `{none | warm only | family/team only | freely}`
- **Slang / in-jokes:** `{list any recurring nicknames, codenames, phrases the principal uses}`
- **Banned phrases:** `{phrases the principal never uses — e.g., "circle back", "touch base", "reach out"}`

## Bad-news register shift

When delivering unwelcome news, does the principal get **shorter and more formal** or **longer and warmer**?

- **Direction:** `{shorter-formal | longer-warmer}`
- **Example sentence the principal would write to soften bad news:** `{paste a real example}`

## The Personal "No"

How does the principal decline? Paste the exact phrase they use:

```
{e.g., "Not a fit right now — thanks for thinking of me."}
```

## Tier-1 Contacts (VIPs)

People whose messages ALWAYS reach the principal directly and whose drafts ALWAYS stay in review-only mode. One per line, with relationship context:

```
{name} — {relationship, e.g., "Board chair, joined Series A, prefers Signal over email"}
{name} — {relationship}
{name} — {relationship}
```

## Do-Not-Bother List

Senders whose messages the principal has explicitly said should never reach them (still archived, never deleted — the two-touch rule applies):

```
{domain or email address} — {reason}
{domain or email address} — {reason}
```

## Cadence Targets

For Tier-1 relationships, the principal wants to stay in touch at least this often:

- **Board members:** every `{n}` days
- **Top investors:** every `{n}` days
- **Top customers:** every `{n}` days
- **Close friends / family:** every `{n}` days

Cold-relationship threshold — flag Tier-1 contacts not touched in `{90}` days.

## Calendar Rules

- **Focus-block template:** `{e.g., 8:00–9:30 AM + 2:00–3:30 PM daily, immovable}`
- **Meeting-free days:** `{e.g., Wednesdays, Fridays — maker days}`
- **Meeting buffer:** `{e.g., 10 minutes between, no back-to-backs > 3 in a row}`
- **Post-redeye rule:** `{e.g., no meetings before noon the day after a redeye}`
- **Default decline for:** `{e.g., unscheduled 15-min asks, first-time cold pitches, podcasts until Q3}`

## Personal Wishlist

Things the principal has mentioned once that the skill should opportunistically close:

```
- {e.g., "Want to read {book title}"}
- {e.g., "Want to reconnect with {name}"}
- {e.g., "Want to start doing {habit}"}
```

## Privacy

- **`redact_patterns:`** Regex patterns to scrub before any content leaves the local process (including when delegated to Research or Investigation skills).

```
{e.g., \b[A-Z]{3,}-\d{4,}\b     # internal ticket IDs}
{e.g., \$[\d,]+(?:\.\d{2})?     # dollar amounts}
{e.g., {company_name} revenue   # sensitive phrases}
```

- **Autonomy defaults:** `{draft-only everywhere}` unless a Processing Rule in `rules.md` explicitly grants send-without-review for a named recipient class.

## Notes

Any other context the chief-of-staff skill should read at the start of every session. The principal owns this file — edit freely.

```
{freeform notes}
```
