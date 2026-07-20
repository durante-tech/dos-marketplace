---
name: Triage
description: Four-bucket inbox classification with voice-matched drafts and Processing Rules canon application
status: STABLE
featured: true
icon: Inbox
bestPath:
  - title: "Load Principal Context"
    description: "Read principal.md and rules.md; apply personal voice and edge-case rules."
  - title: "Four-Bucket Sort"
    description: "Classify every message into Principal-Must-Reply, Read-Only-FYI, EA-Handles, or Archive."
  - title: "Draft, Present, Persist"
    description: "Draft replies in the principal's voice; present for approval; write the FYI rollup."
divergence_from_canonical:
  _intent-to-flag-table.md:
    partial_version: 1.0.0
    reason: "ChiefOfStaff Triage workflow uses workflow-specific intent-to-flag vocabulary; canonical Mode/Output two-table shape doesn't fit"
---

# Triage Workflow

## When to Use

- User says "triage", "triage my inbox", "process inbox", "what's in my inbox", "run triage"
- To classify unread inbox messages into the four-bucket model and draft voice-matched replies
- Use "ADD TO RULES: {rule}" to append a new Processing Rule without running a full triage

<!-- partial: _workflow-voice.md skill_name=ChiefOfStaff workflow_name=Triage action_phrase=" to classify inbox" -->

## Step 1: Load Principal Context

Read these files (seed from `Templates/` if missing, then prompt the principal to fill in the basics before proceeding). Reuse the session cache if already loaded this session:

- `~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/ChiefOfStaff/principal.md`
- `~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/ChiefOfStaff/rules.md`

Extract Tier-1 contact list, do-not-bother list, voice markers, bad-news register direction, and all active rules.

## Step 2: Ingest Messages

Sources, in priority order:

1. **Email ports** — resolve the `email.search` / `email.read` ports (SKILL → "Capability Ports + Adapters"; `search_gmail_messages` / `get_gmail_message_content`). If they resolve, fetch the target messages (unread in primary inbox, or a label the principal names); if not (absent / unloaded / unauthed), degrade to paste. Honor `redact_patterns` before persisting any fetched content.
2. **Paste** — principal pastes a block of email text into the chat.
3. **File path** — `.mbox`, `.eml`, `.txt`, or exported JSON.

Parse each message into `{from, subject, body, received_at, thread_id}`. For
the deterministic file-path formats (`.mbox` / `.eml`, RFC-5322), do NOT
hand-extract the headers — call `parseMboxMessages(raw)` in
`Tools/ChiefOfStaffHelpers.ts` (unit-tested in `ChiefOfStaffHelpers.test.ts`),
which splits on the mbox `From ` envelope separator and pins the five-field
shape. MCP passthrough already returns structured JSON; freeform paste has no
fixed grammar, so reducing pasted text to those fields stays your judgment.

## Step 3: Four-Bucket Classification

For every message, apply rules in order and assign exactly one bucket.

### Bucket 1 — Principal-Must-Reply

Assign when ANY is true:
- Sender is in the Tier-1 contact list
- Message contains emotional / urgent / legal tone (anger, crisis, deadline, "compliance", "attorney") — this supersedes all other buckets
- Direct question from a relationship the principal must personally own
- A Processing Rule explicitly routes here

Draft a reply in the principal's voice (Step 4), tag `[DRAFT — REVIEW REQUESTED]`, present for approval.

### Bucket 2 — Read-Only-FYI

Assign when strategic but requires no reply and sender is not Tier-1. Prepend a one-line TLDR. These are grouped into the Step 6 rollup — never surfaced individually.

### Bucket 3 — EA-Handles

Assign when routine / procedural / covered by a Processing Rule AND would not damage the relationship AND the principal's ideal reply fits in two sentences. Draft in the principal's voice, tag `[DRAFT — OK TO SEND?]`. Default is review-mode; send-without-review requires an explicit rule.

### Bucket 4 — Archive / Delete

Cold pitch, vendor spam, newsletter with no action item. **Never actually delete** — archive with a label via the `email.archive` port (`modify_gmail_message_labels`: apply an archive label / remove `INBOX`). If the port doesn't resolve, leave it for manual handling — the "never delete" invariant holds either way. Apply the two-touch rule: if the same sender follows up twice, elevate to Principal-Must-Reply.

### Special cases

- **First-time stranger** — not Tier-1, no prior thread. Generate a 3-line enrichment (who / why / mutual) and route to EA-Handles with a `[FIRST CONTACT]` tag. Delegate to Research / Investigation if stakes warrant.
- **`ADD TO RULES:` prefix** — any inbound from the principal themselves that starts with this prefix is appended to `rules.md` as a new rule; do not treat as a normal email. Detecting the prefix and extracting the rule text is deterministic — call `parseRulePrefix(message)` in `Tools/ChiefOfStaffHelpers.ts` (case-insensitive, leading-whitespace-tolerant, first-line only; unit-tested) rather than eyeballing the string. When `isRule` is true, format the line with `formatRuleLine(ruleText)` before appending so it matches the canon `- WHEN ... THEN ...` shape. WHO counts as "the principal themselves" stays your judgment.

## Step 4: Draft in the Principal's Voice

Apply the voice markers from `principal.md` exactly: greeting, length archetype, sign-off, punctuation tells, banned phrases, bad-news register shift, recipient-class register. Never "improve" the principal's style — lowercase stays lowercase, fragments stay fragments. The goal is indistinguishability.

## Step 5: Present, Commit, Persist

### Present for approval

The four-bucket presentation skeleton is deterministic given the classified
buckets — do NOT hand-type it. Build the structured presentation from your
Step 3 classification + Step 4 drafts and render it through
`renderTriagePresentation()` in `Tools/ChiefOfStaffHelpers.ts` (golden-tested,
byte-identical to the prior inline layout). Wrap the returned string in a code
block when you surface it.

```ts
import { renderTriagePresentation } from "./Tools/ChiefOfStaffHelpers";

renderTriagePresentation({
  count,                                          // total messages processed
  mustReply: [                                    // 🔴 Bucket 1 — your judgment fills the fields
    { sender, subject, context /* 1-line relationship note */, draftBody },
  ],
  fyi:          [{ text /* one-line TLDR */ }],    // 📘 Bucket 2 — rolled up for Morning brief
  eaHandles:    [{ sender, subject, ruleApplied /* rule text if any */, draftBody }], // 📗 Bucket 3
  archive:      [{ sender, detail /* reason */ }], // 🗑️ Bucket 4 — two-touch rule active
  firstContact: [{ sender, detail /* 3-line enrichment */ }], // 🆕
  newRules:     [{ text /* rule text */ }],        // ⚠️
});
```

The helper owns the layout (headers, emoji, per-bucket counts, indentation,
draft fences, the `[DRAFT — …]` tags, and the approval prompts). YOUR judgment
owns the field values — which message lands in which bucket, the voice-matched
draft body, the relationship context note, the TLDR, the enrichment. The render
is fixed; the content is yours.

### Commit approved decisions

For each approved draft, either (a) output as text for the principal to copy-paste, or (b) if the `email.draft` / `email.send` ports resolve (SKILL → "Capability Ports + Adapters") AND a Processing Rule allows it for this recipient class, call the port. Record any created commitment in the ledger at `~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/ChiefOfStaff/commitments.md`. Deciding that a commitment exists (and its `{what, to}`) is your judgment; the ledger row format is fixed — build it with `formatCommitmentRow(record)` in `Tools/ChiefOfStaffHelpers.ts` (the canonical 8-column Open schema `| Commitment | Owner | To / From | Made | Source | Deadline | Chase Date | Status |`, pipe-escaped, unit-tested) and append that line. **Opt-in KG mirror — default OFF:** after appending, call `bridgeCommitmentToKg(record)` from `Tools/ChiefOfStaffHelpers.ts` — a one-way, provenance-partitioned mirror into the MemPalace KG that is a hard no-op unless the operator exports `COS_KG_BRIDGE=1`. The markdown ledger stays canonical; the KG mirror is degraded, never the source. **Never hand-build the row** — `formatCommitmentRow` is the single writer-of-format Triage and Followup share. The `chase_date` comes from `computeChaseDate()` (see Followup). If the principal edits a draft before approving, append the edit to the voice-samples section of `principal.md`.

For each rejected draft, if the principal explains why, ask: *"Should I `ADD TO RULES: WHEN ... THEN ...`?"*

### Persist the FYI rollup

Write the Bucket-2 rollup to `~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/ChiefOfStaff/triage-rollups/{YYYY-MM-DD}.md`. Append to the day's file if it already exists. The dated filename and the rollup section format are deterministic — derive the basename with `triageRollupFilename(dateIso)` and build the section with `formatTriageRollup(fyiItems, runIso)` in `Tools/ChiefOfStaffHelpers.ts` (leading blank-line separator so multiple same-day runs stack; `(none)` when empty; unit-tested), then append that block. Selecting which TLDRs land in the FYI bucket is your judgment; the layout Morning reads back is fixed. This is what the next Morning brief consumes — without this write, the brief has no FYI content.

## Important Notes

- **No send without approval** is a hard rule in v0.0.1. Rule-gated MCP send is the only exception.
- **Never delete** — the two-touch rule requires archived messages to remain retrievable.
- **Redact before delegation** — apply `redact_patterns` from `principal.md` to any content passed to Research / Investigation / MCP tools.
- **Voice drift is a bug** — if the principal edits more than ~30% of drafts, prompt for 3–5 fresh voice samples. The voice has evolved.

## Intent-to-Flag Mapping

Sub-modes only — top-level triggers live in `SKILL.md`.

| User Says | Effect |
|-----------|--------|
| "triage just the urgent ones" | Output only Bucket 1 (Principal-Must-Reply) |
| "ADD TO RULES: {rule}" | Append rule to `rules.md`, skip full triage |
