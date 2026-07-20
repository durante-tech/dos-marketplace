# Voice-Channeling Skill — Brief-Writing Conventions

**Purpose:** capture conventions for writing the *brief* that initiates a voice-channeling skill creation run, so the brief itself doesn't seed downstream errors.

**Why this exists:** Run #9 (GregYoung) external-fact verification (Metz Run #8 follow-on) surfaced **5 brief-drift items** in a single run — all pointing in the same direction (the brief inflated minor career details). Run #8 (SandiMetz) similarly surfaced **2 brief-drift items** (publisher attribution, conference venue). The pattern is consistent: briefs systematically over-attribute prestige (CTO over founder, exact dates over ranges, big-conference venues over actual recording locations). This doc codifies prevention.

---

## The Drift Pattern (empirical, 2 of 9 runs)

Across Runs #8 and #9, **7 distinct factual claims** in the briefs were wrong on external-fact verification:

| Run | Brief said | Reality | Fix |
|---|---|---|---|
| #8 (Metz) | "PragProg 2017/2020" | sandimetz.com self-published | INDEX correction |
| #8 (Metz) | "Polly Want a Message RailsConf 2018" | Deconstruct 2018 + OSCON 2018 | INDEX correction |
| #9 (Young) | "CTO at Event Store / Kurrent" | Founder, not CTO | Biography correction |
| #9 (Young) | "Canadian software architect" | Unverified, no source | Tag `[unverified]` |
| #9 (Young) | "Event Store founded 2013" | Product 2012-2013, company 2019, Kurrent rebrand 2024-12-18 | Biography precision |
| #9 (Young) | "GOTO Aarhus 2014" canonical CQRS talk | Code on the Beach 2014 (Florida) | Talk venue correction |
| #9 (Young) | "Polyglot Data NDC 2014" | GOTO 2014 Chicago + NCrafts Paris 2014 | Talk venue correction |

**Pattern:** the brief inflates *prestige adjacent details* — bigger venue names (RailsConf > Deconstruct, GOTO Aarhus > Code on the Beach), more senior titles (CTO > founder), more confident dates (specific year > range).

The skill content survives because Agent C's external-fact verification tier (added after Run #8) catches these. But the brief itself remains the upstream source — if we tighten the brief, we save Agent C work.

---

## Conventions for the Initiating Brief

### 1. Hedge attributable claims at the source

When the brief mentions an attributable fact (publisher, venue, founding date, title), tag it for verification:

**Bad:**
> Author: Greg Young.
> Voice differentiation: Young **founded** Event Store in 2013 and is **CTO** at Kurrent.

**Good:**
> Author: Greg Young.
> Voice differentiation: Young is associated with Event Store / Kurrent (verify: founded vs co-founded, founder vs CTO, founding date 2013 vs later).

The brief doesn't need to *know* the right answer — it needs to *not assert* the wrong one. Hedging is free; over-assertion costs Agent C effort and risks propagation.

### 2. List talks by topic, not venue

**Bad:**
> Talk: "Polyglot Data" at NDC 2014

**Good:**
> Talk: "Polyglot Data" (canonical, multiple venues 2013-2014 — verify primary recording)

Conference venue is high-noise, low-signal. The talk title is the load-bearing identifier. If the venue matters (because the skill anchors a hook to it), Agent C verifies.

### 3. Use date ranges for company milestones

**Bad:**
> Event Store founded 2013

**Good:**
> Event Store: product launched ~2012-2013, company formally founded later (verify), rebranded Kurrent late 2024 (verify date)

Companies have product-launch dates, formal-incorporation dates, and rebrand dates. They're often years apart. The brief shouldn't pick one; the skill's Biography section can capture the timeline precisely after verification.

### 4. Distinguish title-of-art from title-of-role

**Bad:**
> Greg Young — CTO at Event Store

**Good:**
> Greg Young — founder/principal at Event Store (verify exact title via press releases)

"CTO" is a corporate title that often doesn't apply to founder-led specialized companies. "Founder," "principal," "creator," "inventor" are more durable framings.

### 5. Pre-mark unverifiable biographical claims

**Bad:**
> Author: Greg Young — Canadian software architect

**Good:**
> Author: Greg Young — software consultant and inventor (nationality unverified — Wikipedia disambiguation excludes him; speaker bios omit nationality)

Nationality, education, marital status, age, and specific employment dates are usually not verifiable from public sources. Pre-marking saves Agent C the verification round.

---

## How Agent C Briefs Should Reference This Doc

Every Agent C (Voice + Bio + Talks) brief should include the boilerplate paragraph (already inherited from `voice-channeling-ip-policy.md`):

> **External-fact verification tier (Metz Run #8 follow-on, codified per `voice-channeling-brief-conventions.md`):** For EACH attributable claim in the parent brief (publisher, venue, founding date, title, nationality), run WebFetch verification. Surface a verified/unverified status table at the end. Do NOT propagate brief claims into the vault unverified.

This converts the convention into an active gate per run.

---

## Empirical Track Record (verification-tier wins)

| Run | Verification-tier finds | Outcome |
|---|---|---|
| #1-7 | (no tier) | Briefs accepted as-is; some drift may have propagated silently |
| #8 (Metz) | 2 drifts caught: PragProg → sandimetz.com self-published; RailsConf 2018 → Deconstruct 2018 | Corrections logged in INDEX |
| #9 (Young) | 5 drifts caught: CTO → founder; Canadian → unverified; 2013 → 2012-2013/2019/2024-12-18; GOTO Aarhus → Code on the Beach; NDC 2014 → GOTO Chicago + NCrafts Paris | All corrections logged in vault |

**Rate:** average ~3.5 drift items per run when the verification tier is active. The fixed-cost of verification (Agent C's WebFetch budget) is well-paid.

---

## When This Doc Doesn't Apply

If the channeled author has **clean, well-documented public attribution** (e.g., academic CS where every paper has DOI + venue), the verification tier may find nothing. Run it anyway — confirming "0 drift" is itself a useful negative result.
