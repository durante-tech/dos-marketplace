---
name: PresenceOps
description: Phase 4 — ongoing social presence ops (schedule → publish → engage → pull-insights) behind a mandatory approval gate; writes social-media-plan.md
status: STABLE
bestPath:
  - title: "Load & Reconcile"
    description: "Pull the next publishing window from content-calendar.md and confirm every slot's bound asset is spec-compliant."
  - title: "Draft & Integrity Pass"
    description: "Adapt per-channel copy in brand voice, then route every claims-bearing caption through the Skeptic before approval."
  - title: "The Approval Gate"
    description: "Present the publish manifest and stop for an explicit, itemized operator approval token — never auto-publish."
  - title: "Publish & Engage"
    description: "Post approved entries via SocialMedia/StreamRig and run the live reply/UGC/crisis loop."
  - title: "Insights & Feedback"
    description: "Pull post insights and emit proposed content-calendar diffs that close the loop."
---

# PresenceOps Workflow

## When to Use
- Trigger phrases: "publish", "run our socials", "presence ops", "engagement loop".
- Situation: `materials/` and `content-calendar.md` already exist and the program is ready to run the ongoing schedule → publish → engage → measure loop.
- NOT for producing the creative assets themselves (use `MaterialsEngine`) or the recurring analytics roll-up (use `Measurement`) — PresenceOps only schedules, gates, and publishes.

**Purpose:** The loop that turns a calendar into *presence*: schedule → **approval gate** → publish → engage → pull insights → feed back into the calendar. This phase owns the per-channel publishing playbook, the live engagement + comment/crisis handling, the SocialMedia + StreamRig invocation recipes (FB / IG / LinkedIn / GBP + content-multiplier clips), and the feedback edge back into `content-calendar.md`. It **NEVER auto-publishes** — every live action passes a human approval gate owned by the operator and vetted by the Channel seat.

**Budget:** 45–90 min to author `social-media-plan.md` (one-time); then ~10–20 min per publish batch + ~15 min/day engagement windows on the recurring loop. Credits: low for the plan (mostly `dispatch`/`Channel` reasoning); per-batch publish is near-zero (direct Graph/LinkedIn REST); content-multiplier clip generation via `media`/`stream-rig` is the main recurring cost.

## Inputs
- `content-calendar.md` — the dated, per-channel calendar (Phase 2). Source of truth for *what posts where, when*; every entry cites its campaign (`C*`).
- `campaigns.md` — campaign briefs (`C*`): hypothesis, channels, pillar(s) served, success signal. The success signal is what the loop measures against.
- `materials/` — the produced creative + the repeatable production spec (Phase 3). Each scheduled post binds an asset ID.
- `strategy.md` — brand voice + per-channel cadence + format fit (Phase 1). The voice contract every reply and caption is checked against.
- **Operator credentials state** — whether SocialMedia is authenticated (FB Page token, IG Business ID, LinkedIn token, GBP location). Drives the publish-vs-stage decision.
- **Live signal (recurring runs)** — `measurement.md` deltas from the prior cycle; comments/DMs awaiting reply; any active incident.

## Prerequisites (+ graceful degradation when a composed pack is absent)

| Composed pack | Used for | Degradation when absent |
|---|---|---|
| **SocialMedia** | Publish + insights + comments on FB Page / IG Business / LinkedIn; the publish recipe and the pull-insights edge | Fall back to **staged-only** mode: write fully-formed `STAGED` post objects (copy + asset + target time + channel) the operator publishes manually. The loop still runs; only the automated REST publish + insights pull are skipped. Flag the auth gap as a blocker in the plan. |
| **StreamRig** | Content multiplier for live/build-in-public: transcript → clips + cross-posts + show notes (its `PostStream` workflow) | Skip the multiplier; presence runs on calendar-native posts only. Note `materials/` will not auto-replenish from streams. |
| **Dispatch** | Drafting/adapting per-channel copy + reply templates in brand voice | Author copy inline from `strategy.md` voice notes; warn that copy is un-metered (no citation/credit trail). |
| **Media** | Per-channel format derivatives (vertical reel, square carousel, GBP photo) from a master asset | Reuse existing `materials/` assets as-is; flag any channel whose format spec can't be met (e.g. no 9:16 cut for a reel slot). |
| **Channel seat** (`growth-channel`) | Vets placement + cadence + the approval gate; rejects any plan with no live loop or feedback edge | The conductor runs the gate itself but cannot self-veto — log that the cadence/placement vet was skipped (lower confidence). |
| **Skeptic seat** (`growth-skeptic`) | Integrity pass on every public-facing claim, review/UGC tactic, hashtag, and stat in a caption | **Hard stop** — do not publish claims-bearing copy without the integrity pass. Stage it, flag for verify. |
| **MemPalace** | Recall prior reply templates, what worked, channel-specific learnings | Proceed without recall; cold-start the playbook from `strategy.md` only. |

**Universal floor:** if *everything* composed is absent, this phase still produces a complete `social-media-plan.md` (loop + per-channel playbooks + crisis runbook + staged post queue). The plan is the deliverable; live publishing is gated and degradable.

## Steps

### 1. Load the calendar and reconcile against live state
1.1 Read `content-calendar.md`; extract the next publishing window's entries (default: the next 7 days). Each row carries a calendar entry ID, channel, target datetime, bound asset ID, and its `C*` campaign.
1.2 Recall via **MemPalace** (`mempalace search`) any prior-cycle learnings for these channels (best-performing format, reply templates, dead hours).
1.3 Reconcile: for each entry confirm the bound asset exists in `materials/` and the per-channel format spec is met. Missing asset or wrong aspect ratio → route back to `MaterialsEngine` (call `media` for the derivative) or down-rank the slot. **Decision rule:** never publish a slot with an unbound or off-spec asset — stage it `BLOCKED` with the reason.

### 2. Draft + adapt per-channel copy (Dispatch)
2.1 For each entry, invoke **Dispatch** to draft/adapt the caption to the channel's voice + format fit (LinkedIn ≠ IG ≠ GBP). Dispatch's mandatory research step keeps any factual claim citation-backed.
2.2 Apply the channel playbook (§ "Per-channel playbook" below) for length, hashtag/discovery, CTA, and first-comment strategy.
2.3 **Decision rule (voice):** if the adapted copy drifts from `strategy.md` voice, the Channel seat sends it back. Brand voice is a gate, not a suggestion.

### 3. Integrity pass (Skeptic) — BEFORE the approval gate
3.1 Route every claims-bearing caption, stat, comparison, hashtag campaign, and any UGC/review-ask through the **Skeptic seat** (`References/integrity-guard.md`).
3.2 Enforce the hard rules:
- No fabricated/misattributed stat in a caption → confirmed-with-source or moved to a `> DO NOT CITE — unverified` note and stripped from the public copy.
- **No fake/incentivized reviews** (FTC Consumer Review Rule + platform ToS). A "leave us a review for X" ask is allowed only if it is unconditional and unincentivized; an incentivized ask is rejected.
- **No `AggregateRating`/`Review` schema or "rated 4.9★ by N users" claim** without verified data behind it.
- Brand voice + each platform's ToS respected (no engagement-bait that violates Meta/LinkedIn policy).
3.3 **Decision rule:** Skeptic has veto. A vetoed post is staged, never queued for publish.

### 4. THE APPROVAL GATE (mandatory — never bypass)
4.1 Assemble the **publish manifest**: an ordered table of every post about to go live — channel, exact datetime (in the brand's posting timezone), final copy, bound asset, first comment, `C*`, and the Skeptic verdict (`CLEARED`/`STAGED`).
4.2 Present the manifest to the operator and **STOP**. Require an explicit, affirmative approval token (e.g. operator types `APPROVE C12-batch` or approves specific entry IDs). Silence, ambiguity, or "looks good-ish" is **not** approval.
4.3 **Decision rules:**
- Approval is **per-batch and itemized** — the operator may approve a subset; un-approved entries stay `STAGED`.
- A `STAGED`/`BLOCKED`/Skeptic-vetoed entry is **never** publishable regardless of approval.
- No approval token → nothing publishes. The loop ends having produced/updated the plan + the staged queue only.
- The gate is re-armed every batch. A standing "approve everything" is not honored; each batch is its own gate.

### 5. Publish (SocialMedia + StreamRig) — only post-approval
5.1 For each `CLEARED` + approved entry, run the matching invocation recipe (§ "Invocation recipes" below): FB Page, IG Business, LinkedIn, or GBP.
5.2 For live/build-in-public source content, run **StreamRig `PostStream`** to fan a recording into clips + cross-posts + show notes — which themselves re-enter at step 2 as `materials/` (the multiplier feeds the calendar, it does not publish on its own).
5.3 Record each publish result: platform post ID, permalink, actual publish time, status. Append to the plan's **publish log**. **Decision rule:** a failed publish (token expired, rate limit, policy reject) is logged with the error and re-staged — never silently dropped, never retried blind.

### 6. Engage (the live loop)
6.1 Within each channel's reply window (§ playbook), pull comments/mentions/DMs via **SocialMedia** fetch and triage: question → answer; praise → acknowledge + optionally amplify (UGC); complaint → service-recovery template; crisis trigger → escalate (§ "Comment & crisis handling").
6.2 Reply in brand voice using recalled/approved templates; net-new public-facing claims in a reply are themselves subject to the Skeptic floor.
6.3 Surface UGC worth re-sharing back to `MaterialsEngine`/the calendar as a future slot. **Decision rule:** never fabricate or solicit incentivized engagement; never argue publicly with a complainant — recover or take it to DM.

### 7. Pull insights + feed back (the feedback edge)
7.1 On a cadence (default: 48h post-publish + weekly roll-up), pull per-post insights via **SocialMedia** (reach, impressions, engagement rate, saves/shares, link clicks, GBP actions: calls/directions/website).
7.2 Write deltas into the plan's **insight log** and hand the roll-up to **Measurement** (Phase 6) keyed by `C*`.
7.3 **Close the loop (the edge that makes it presence):** translate insights into concrete calendar edits — promote a winning format/time, kill a dead slot, shift cadence, re-queue a high-UGC topic. Emit these as explicit proposed diffs to `content-calendar.md`, re-entering at Step 1 next cycle. The Channel seat vets the diff.

## Output Template

> Writes/updates **`docs/growth/social-media-plan.md`**. This is the durable ops artifact — the loop, the per-channel playbooks, the crisis runbook, the gate record, and the running logs. Scheduled/published posts are *side effects* recorded in the logs; the file is the source of truth. IDs are append-only and cross-reference `C*` (campaigns), asset IDs (`materials/`), and `Q*`/`M*` where relevant. Posts get a stable `SP*` id; gate decisions a `GATE-*` id.

```markdown
# Social Media Plan — <Subject> (`docs/growth/social-media-plan.md`)

> The ongoing presence loop. NEVER auto-publishes. Every live action clears the §4 approval gate.
> Cross-refs: campaigns `C*` (campaigns.md) · assets (materials/) · metrics (measurement.md).

## 0. Loop at a glance
schedule → integrity (Skeptic) → **APPROVAL GATE (operator)** → publish → engage → pull insights → calendar feedback diff → repeat.
**Standing rule:** no `APPROVE` token, nothing goes live. Approval is per-batch, itemized, re-armed each batch.

## 1. Channels in scope
| Channel | Handle / ID | Auth state | Cadence (from strategy.md) | Primary format | Owner |
|---|---|---|---|---|---|
| Google Business Profile | loc:salon-paris-01 | ✅ token | 2×/wk + every offer | Photo post + offer | Channel seat |
| Instagram Business | @brand | ✅ token | 4×/wk | Reel (9:16) + carousel | Channel seat |
| Facebook Page | fb:Brand | ✅ token | 3×/wk | Photo + link + event | Channel seat |
| LinkedIn | in:brand-page | ⚠️ STAGED-ONLY (no token) | 2×/wk | Single-image + document | Channel seat |
| TikTok | @brand | ⛔ manual (no pack support) | 3×/wk | Reel cut | Operator |

## 2. Per-channel playbook
> One block per active channel. Best-practice + optimal windows + reply window + discovery + UGC.

### IG-PLAY · Instagram Business
- **Best practice:** Reels lead reach; hook in first 2s; native captions; 1 idea per post; carousel for saves.
- **Optimal post times (brand TZ, validated against §6 insight log):** Tue/Wed/Thu 11:00–13:00 & 18:00–20:00.
- **Reply/engagement window:** first **60 min** after publish (algorithm weights early engagement) + a 2nd pass at +4h.
- **Hashtag/discovery:** 3–5 niche tags in the **first comment**, not the caption; 1 geo tag; no banned/broken tags (Skeptic-checked).
- **UGC + community:** repost customer reels to Stories with credit + sticker; run a branded prompt (no incentive → FTC-safe).
- **Format spec:** 9:16 reel ≤ 90s OR 4:5 carousel ≤ 10 frames; bound asset must match (Step 1.3 gate).

### GBP-PLAY · Google Business Profile
- **Best practice:** Photo + a 100–300 char update + a real CTA (Book/Call); fresh photos lift Maps ranking.
- **Optimal post times:** weekday mornings; offer posts ≥ 7 days before expiry (GBP auto-expires standard posts at 7d).
- **Reply/engagement window:** Q&A + reviews answered within **24h** (response rate is a ranking + trust signal).
- **Discovery:** keep categories/services current; never keyword-stuff the business name (Google suspends for it).
- **UGC/reviews:** **review asks are UNINCENTIVIZED ONLY** — gated on a paying-customer base (integrity-guard) → see §7.
- **Format spec:** landscape photo ≥ 720px; offer post needs start/end dates.

### LI-PLAY · LinkedIn (STAGED-ONLY until token)
- **Best practice:** lead with a POV line; 3–5 short paragraphs; document/PDF carousels over-index for dwell.
- **Optimal post times:** Tue–Thu 08:00–10:00.
- **Reply/engagement window:** reply to every comment in first **90 min**; author replies extend reach.
- **Discovery:** 3 broad hashtags; @-mention people only when genuinely relevant (spam tanks reach).
- **UGC/community:** reshare employee/customer posts with a substantive add, not a bare "great post".

## 3. Invocation recipes (the exact pack calls)
> Run ONLY for §4-approved + Skeptic-CLEARED entries. Recipes assume SocialMedia is authenticated (else STAGED-ONLY).
> **Confirm-gate contract (SocialMedia #147):** the publish tools dry-run unless passed `--yes`. A §4-approved live publish MUST pass `--yes` — the explicit live confirm-gate; a bare invocation never goes live (it exits with a preview). Conversely, any draft/preview composition runs the publish tools under `SOCIAL_DRAFT_ONLY=1` (the unspoofable env that forces FB/LinkedIn to draft and hard-refuses IG).

| Action | Pack → workflow/tool | Inputs | Output recorded |
|---|---|---|---|
| Auth (one-time) | SocialMedia → FacebookLogin / LinkedIn login | OAuth | FB Page token, IG user ID, LI token in `~/.claude/.env` |
| Publish FB | SocialMedia → FacebookPublish | message, link?, asset, scheduled_time?, `--yes` (live confirm-gate) | fb post id + permalink |
| Publish IG | SocialMedia → InstagramPublish (2-step: create container → publish) | media (9:16/4:5), caption, first-comment, `--yes` (live confirm-gate) | ig media id + permalink |
| Publish LinkedIn | SocialMedia → LinkedIn /rest/posts | commentary, media, visibility, `--yes` (live confirm-gate) | li urn + permalink |
| Publish GBP | SocialMedia → GBP local post (photo/offer/event) | summary, CTA, photo, start/end | gbp post id |
| Pull insights | SocialMedia → Fetch insights/comments | post id, metric set | reach/eng/clicks/GBP actions |
| Content multiplier | StreamRig → PostStream | recording/transcript | clips + drafted cross-posts + show notes → re-enter as materials/ |

## 4. Approval gate record (append-only)
| Gate ID | Batch | Entries | Skeptic verdict | Operator token | Decision | When |
|---|---|---|---|---|---|---|
| GATE-001 | C12 week-1 | SP-001..SP-004 | SP-003 STAGED (unverified stat) | `APPROVE SP-001,SP-002,SP-004` | 3 published, SP-003 held | 2026-07-01 09:40 |
| GATE-002 | C14 launch | SP-010..SP-013 | all CLEARED | — (no token) | NOTHING published; re-queued | 2026-07-04 — |

## 5. Publish log (append-only — every live action)
| SP id | C* | Channel | Asset | Publish time (brand TZ) | Platform post id / permalink | Status |
|---|---|---|---|---|---|---|
| SP-001 | C12 | IG | ig-reel-007 | 2026-07-01 11:00 | 178…/p/AbC | published |
| SP-002 | C12 | GBP | gbp-photo-003 | 2026-07-01 09:15 | gbp:loc01/post:991 | published |
| SP-003 | C12 | LinkedIn | li-doc-002 | — | — | STAGED (Skeptic veto: unverified "#1 in France") |
| SP-004 | C12 | FB | fb-img-005 | 2026-07-01 12:00 | 102…/posts/55 | published |
| SP-010 | C14 | IG | ig-reel-011 | — | — | STAGED (no approval token) |

## 6. Insight log (append-only — the measurement input)
| SP id | C* | Channel | Reach | Eng. rate | Saves/Shares | Clicks / GBP actions | Pulled at |
|---|---|---|---|---|---|---|---|
| SP-001 | C12 | IG | 8,420 | 6.1% | 210 / 44 | 96 link clicks | +48h |
| SP-002 | C12 | GBP | 1,930 views | — | — | 31 calls, 58 directions | +48h |
| SP-004 | C12 | FB | 3,110 | 2.4% | 12 / 9 | 40 clicks | +48h |

## 7. UGC, community & review tactics (FTC-gated)
- **UGC engine:** repost-with-credit flow per channel (§2); track sourced UGC as future `materials/` slots.
- **Review program:** UNINCENTIVIZED asks only, **gated on a real paying-customer base** (integrity-guard). No incentive, no review-gating, no `AggregateRating` schema without verified data. Status: `GATED — N paying customers, threshold M`.
- **Community:** reply windows met (§2); DM service-recovery default for complaints.

## 8. Comment & crisis handling runbook
| Trigger | Window | First action | Escalation |
|---|---|---|---|
| Routine question | channel reply window | Answer in brand voice (approved template) | — |
| Praise / UGC | reply window | Acknowledge + credit; flag for repost | → §7 UGC |
| Single complaint | < 2h | Empathize publicly once → move to DM (service-recovery template) | If unresolved → operator |
| Coordinated negative / brigade | < 1h | Do NOT mass-delete; pause scheduled promos; hold a holding statement | **Operator + brand owner; halt publishing** |
| Legal/safety/PR-risk claim | < 30 min | No public reply yet; capture screenshots | **Operator escalation; Skeptic + legal review before any statement** |
| Platform policy strike / takedown | on notice | Stop the affected channel's queue | Operator; review ToS compliance |

**Crisis rule:** the moment a crisis trigger fires, the **approval gate tightens to operator-only** and all scheduled non-essential posts pause until cleared.

## 9. Feedback edge → calendar diffs (the loop closing)
> Proposed edits to content-calendar.md from §6 insights. Channel seat vets; operator approves before they land.
| Diff id | Signal (from SP/insight) | Proposed calendar change | Status |
|---|---|---|---|
| FB-D1 | IG Reels Tue 11:00 +40% reach vs avg | Promote Tue 11:00 reel slot to 2×/wk | proposed |
| FB-D2 | SP-002 GBP offer → 31 calls | Add recurring weekly GBP offer post for C12 | proposed |
| FB-D3 | FB SP-004 low eng (2.4%) | Demote FB photo cadence 3→2/wk; test link format | proposed |

## 10. Open blockers & known gaps
- LinkedIn STAGED-ONLY until token (auth gap) — blocks LI-PLAY automation.
- TikTok manual (no pack support) — operator publishes; insights not pulled.
- Review program GATED on paying-customer threshold (integrity-guard).
```

## Integrity checkpoints (this phase)

Owned by the **Skeptic seat**; applied to PresenceOps specifically:

1. **No auto-publish, ever.** The §4 approval gate is structural. The conductor must reach an explicit, itemized operator token before any §5 invocation. Absence of a token = nothing goes live. The gate is re-armed every batch.
2. **Every public claim survives the verify pass.** Stats, comparisons, "#1/best/most" claims in captions or replies are confirmed-with-source or stripped to a `> DO NOT CITE — unverified` note. "A study found…" with no source is treated as fabricated.
3. **No fake or incentivized reviews/engagement (FTC + ToS).** Review asks are unincentivized and unconditional; no review-gating; no engagement-bait that violates platform policy. Violations are vetoed, not "softened."
4. **No `AggregateRating`/`Review` schema or rating claim without verified data.** Applies to GBP, captions, and any link target the post drives to.
5. **Reviews/UGC review-ask program is gated on a real paying-customer base.** Surfaced as a blocker (§7), not a day-0 action.
6. **Brand voice + platform ToS on every artifact.** Channel seat gates voice drift; ToS gate covers Meta/LinkedIn/Google policy (no name keyword-stuffing on GBP, no banned hashtags, no mass-delete in a brigade).
7. **No silent failures.** A failed publish, a held post, or a skipped pack is logged with its reason (publish log / gate record / blockers) — never dropped, never blind-retried.
8. **Locale integrity.** For a non-English primary market, reply templates + captions use verified locale copy, not EN-extrapolated; thin locale research is flagged as a known gap before committing locale budget.

## Worked example

**Subject:** "Be the default booking + reputation tool for local salons, French-first." Channels: GBP, IG, FB authenticated; LinkedIn token missing; TikTok manual.

1. **Load (Step 1):** Pull week-1 of `content-calendar.md` for campaign `C12` (the launch wedge). Four entries: GBP offer, IG reel, FB photo+link, LinkedIn document. MemPalace recalls "IG Tue 11:00 over-indexed last cycle." Step 1.3 finds the LinkedIn slot has no 1200px doc asset → route to `media` for the derivative; meanwhile mark LinkedIn STAGED-ONLY (no token).
2. **Copy (Step 2):** `dispatch` adapts each caption French-first — GBP gets a short Book CTA, IG a 2s hook + 4 niche tags staged for the first comment, FB a link teaser, LinkedIn a POV opener. Channel seat confirms voice + cadence fit.
3. **Integrity (Step 3):** Skeptic catches "le #1 des salons en France" in the LinkedIn draft — unsourced. It moves to a `DO NOT CITE` note and is stripped; that entry becomes `SP-003 STAGED`.
4. **Gate (Step 4):** Manifest presented — SP-001 (IG), SP-002 (GBP), SP-004 (FB) `CLEARED`; SP-003 (LinkedIn) `STAGED`. Operator replies `APPROVE SP-001,SP-002,SP-004`. SP-003 stays held. `GATE-001` recorded.
5. **Publish (Step 5):** SocialMedia runs `InstagramPublish` (container→publish), GBP local offer post, and `FacebookPublish`. Three platform post IDs + permalinks land in the publish log. LinkedIn is skipped (staged-only + held).
6. **Engage (Step 6):** Within IG's 60-min window, two questions answered in French + one customer reel flagged for a Stories repost (UGC → future slot). A mild complaint on FB is taken to DM with the service-recovery template.
7. **Insights + feedback (Step 7):** At +48h, SocialMedia pull shows IG SP-001 at 6.1% eng / 210 saves and GBP SP-002 driving 31 calls + 58 directions. Roll-up handed to `Measurement` keyed to `C12`. Two calendar diffs emitted: `FB-D1` (promote Tue 11:00 IG slot 2×/wk) and `FB-D2` (add weekly GBP offer). Channel seat vets; operator will approve before they land — the loop closes back at Step 1 next cycle.

**Result:** `social-media-plan.md` written with the loop, three per-channel playbooks (GBP/IG/FB), the LinkedIn staged-only block, the crisis runbook, `GATE-001`, the publish + insight logs, and two proposed calendar diffs. Nothing published without the explicit token; the unsourced superlative never reached an audience.
