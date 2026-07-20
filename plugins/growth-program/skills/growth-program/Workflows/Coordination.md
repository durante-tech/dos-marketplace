---
name: Coordination
description: Phase 7 — coordination hub (roles, RACI, milestone calendar + Gantt, dependency map, weekly cadence, Definition of Winning) + the program-wide integrity sign-off
status: STABLE
bestPath:
  - title: "Roster & Ownership"
    description: "Resolve human/agent owners and map each to the artifacts and IDs they're accountable for."
  - title: "RACI & Milestones"
    description: "Fill the RACI matrix per campaign and extract a dated milestone calendar with a Gantt view."
  - title: "Dependency Mapping"
    description: "Chart what blocks what, including the off-repo-vs-in-repo GEO split."
  - title: "Weekly Cadence & Definition of Winning"
    description: "Define the recurring operating rhythm and the single falsifiable success sentence."
  - title: "Integrity Sign-Off"
    description: "Run the mechanical floor check and the Skeptic adversarial verify pass that gates status: shipped."
---

# Coordination Workflow

## When to Use
- Trigger phrases: "coordination", "RACI", "milestones", "who owns what".
- Situation: final phase — all upstream artifacts (strategy, campaigns, calendar, materials, presence plan, GEO, measurement) already exist and need binding into an operating contract plus the program-wide integrity sign-off.
- NOT for authoring any of the upstream artifacts — Coordination reads them, it does not re-derive them.

**Purpose:** Make the program *runnable by a team and trustworthy enough to ship*. This is the final
phase: it converts the six upstream artifacts (`strategy.md`, `campaigns.md`, `content-calendar.md`,
`materials/`, `social-media-plan.md`, `geo/*`, `measurement.md`) into a single operating contract —
who owns what (RACI keyed on `C*`), when milestones (`M*`) land, what blocks what, and the weekly rhythm
that keeps it alive — and then runs the **integrity guard** as a gate: the Skeptic's adversarial verify
pass, the do-not-cite quarantine, and the FTC / schema / ToS / gating checklist applied program-wide.
No artifact is `status: shipped` until the integrity sign-off passes.

**Budget:** ~10–25 min, ~15–40 credits (most spend is the Skeptic's per-stat refute pass + the council
reconciliation; coordination scaffolding itself is cheap).

<!-- partial: _workflow-voice.md skill_name=GrowthProgram workflow_name=Coordination action_phrase="assemble the coordination hub and run the integrity sign-off" -->

## Inputs

- The full program — all phase 1–6 outputs in `docs/growth/`. **Coordination reads them; it does not
  re-derive them.** It is a binding layer over IDs that already exist.
- `subject` — the campaign subject / wedge (for the Definition of Winning headline).
- **Roster** — the human + agent owners available. Mine `mem-palace` (`kg_query` for prior `owns` /
  `committed_to` facts) + the repo `CODEOWNERS`; ask the operator only for names not derivable. If the
  program runs solo (founder-operated), collapse the RACI to two columns (Operator, Fox) — never invent
  a team that does not exist.
- **Cycle horizon** — the calendar window the milestones span (default: one 12-week quarter; inherit
  from `content-calendar.md`'s date range if present).

## Prerequisites (+ graceful degradation when a composed pack is absent)

| Dependency | Used for | Degradation when absent |
|---|---|---|
| **The 5-seat council** (canonical roster: `References/council-roster.md`) | RACI ownership reconciliation + the integrity sign-off (Skeptic owns it) | If the council can't be convened, the **Skeptic seat is non-negotiable** — run it standalone (`Task` → `growth-skeptic`). The other four can degrade to a single self-review pass by the conductor, but the integrity sign-off CANNOT be skipped. |
| **`mem-palace`** | recall prior owners / commitments / deferrals; persist the coordination drawer + `owns` / `blocks` KG facts | Skip recall; ask the operator for the roster. Still write the drawer at the end (bridge offline → queue via DLQ, do not fail the phase). |
| **`sentinel`** | confirm in-repo GEO milestones (`GM*` that touch JSON-LD / `llms.txt` / programmatic pages) are real, scoped tickets | Mark GEO in-repo milestones `unverified-scope` in the dependency map; flag for a follow-up scan. |
| **`research` / `WebSearch`** (Skeptic's tools) | the adversarial verify pass against primary sources | **Hard stop on the sign-off.** No web access → no refute pass → the program ships with `integrity: UNVERIFIED` stamped on the cover and every load-bearing stat quarantined to do-not-cite by default. Never silently pass. |

Coordination produces **no creative and publishes nothing.** It binds, schedules, and certifies.

## Steps

### 1. Build the roster + Roles & Owners table

1a. **Resolve owners.** `kg_query` MemPalace for `owns` and `committed_to` facts on this project; cross
    with repo `CODEOWNERS`. Each owner is one of two kinds — **Human** (named person) or **Agent**
    (a council seat or composed skill that does the work autonomously). Tag each row.

1b. **Map each owner to the artifacts/IDs they own.** Owners key off the stable-ID scheme: a Channel
    owner owns `C*` placement + `social-media-plan.md`; the GEO owner owns `P*`/`PH*` + `geo/*`; the
    Analyst owns `Q*` + `measurement.md`. **One accountable owner per artifact** — no shared accountability
    (you can share Responsible, never Accountable).

1c. **Decision rule — solo vs team.** If the resolved roster is one person, collapse to (Operator,
    Fox-as-agent) and skip the RACI matrix's redundant columns; otherwise build the full matrix in Step 2.

### 2. RACI matrix (campaigns `C*` × roles)

2a. **Rows = campaigns** (`C1, C2, …` from `campaigns.md`) **plus** the cross-cutting workstreams
    (GEO pillar, Measurement, Materials engine, Presence ops). Columns = the resolved roles.

2b. **Fill each cell** with exactly one of `R` (Responsible — does the work), `A` (Accountable — single
    sign-off, exactly one per row), `C` (Consulted — two-way), `I` (Informed — one-way). The council
    seats reconcile: Strategist defends campaign logic, Channel defends placement ownership, Creative
    defends materials ownership, Analyst defends measurement ownership, **Skeptic defends that every
    `A` is a real, reachable owner** (no phantom accountability).

2c. **Decision rule — exactly one `A` per row.** Two A's → escalate to the Strategist to break the tie.
    Zero A's → the campaign is unowned; **block it** (it cannot enter the milestone calendar until owned).

### 3. Milestone calendar (`M*`) + Gantt-style timeline

3a. **Extract milestones.** Each milestone (`M1, M2, …`) is a dated, verifiable checkpoint pulled from
    the upstream artifacts: a calendar launch date, a materials-batch ship, a GEO phase gate (`PH*`),
    a measurement baseline capture, a review point. Every `M*` cites the `C*` / `P*` / `Q*` it advances.

3b. **Place on the horizon** (week columns `W1…Wn`). Use the Gantt block convention in the Output
    Template (`█` active, `▓` gated/blocked, `·` idle). A milestone that depends on a gate cannot start
    before the gate clears — enforce in Step 4.

3c. **Decision rule — gated milestones render `▓`, never `█`.** The reviews/corpus GEO milestone is the
    canonical example: it is **arithmetically gated on a real paying-customer base** (integrity guard,
    sequencing). It renders `▓ (gated: paying-customer base)` until the gate clears — never scheduled as
    a day-0 `█` bar.

### 4. Dependency map (what blocks what)

4a. **Walk every `M*`** and record its upstream blockers as `M* ← M*` (or `← gate:<name>`). Distinguish
    **hard blocks** (cannot start) from **soft blocks** (degraded if started early).

4b. **Surface the off-repo P0 vs in-repo split** (integrity guard): claiming directory profiles + building
    the entity graph is an *off-repo* prerequisite for the GEO corpus pillar — it must not be hidden behind
    an easy in-repo schema sprint that looks like the highest-leverage move. Render both as explicit nodes.

4c. **Decision rule — no milestone may start before all its hard blockers clear.** A scheduled `█` bar
    whose hard blocker is still open is an integrity violation; the Skeptic flags it in Step 7.

### 5. Weekly operating cadence

5a. **Define the recurring rhythm** that keeps presence + GEO + measurement alive between milestones:
    a weekly publish/engage loop (Channel), a weekly insights pull feeding the calendar (Analyst), a
    bi-weekly creative batch (Creative), a monthly SoAV `Q*` run (Analyst), and a monthly integrity
    re-check (Skeptic). Each cadence item names its owner, trigger, and the artifact it touches.

5b. **Decision rule — every cadence item has a feedback edge.** A cadence step that produces no signal
    fed back into another artifact is ceremony; the Channel seat rejects it (mirrors the "no static social
    plan" rule from PresenceOps).

### 6. The single Definition of Winning check

6a. **Write ONE sentence** that says, unambiguously, what success means for this `subject` this cycle —
    tied to a measurable from `measurement.md` (both lenses allowed: a social metric AND/OR a SoAV `Q*`
    threshold). It must be falsifiable. "Grow awareness" fails; "Be cited in ≥ 40% of the `Q1–Q12` basket
    on ChatGPT+Perplexity by `M9`, and reach 5k engaged followers across IG+LinkedIn by `M9`" passes.

6b. **Decision rule — if it can't be measured by the harness in `measurement.md`, it is not the
    Definition of Winning.** Rewrite until it keys off an existing metric or `Q*`.

### 7. Integrity guard — the program-wide sign-off (owned by the Skeptic)

This is the gate. Lazy-load `References/integrity-guard.md`.

**7.0 — Mechanical floor FIRST (the non-self-graded check that survives council degradation).** Before convening the Skeptic, run the deterministic integrity gate. It mechanically enforces the SHAPE the integrity rules already mandate — citation-presence, quarantine-physical, schema-without-data, stable-ID uniqueness, and RACI one-`A` — so a floor holds even when `Task(subagent_type:"growth-skeptic")` does not resolve (an unregistered council seat silently collapses the sign-off to conductor self-review). It is the one check the LLM cannot rubber-stamp.

```bash
bun ~/.claude/skills/growth-program/Tools/VerifyProgram.ts --verify docs/growth
# exit 0 → mechanical floor clean · exit 2 → BLOCK: fix the listed violations before the Skeptic pass
```

Shape only — it never judges whether a stat is *true* (that is the Skeptic's irreducible job). A non-zero exit is a hard BLOCK independent of the council verdict. Then run the Skeptic as the dedicated truth-refutation pass:

```ts
Task({
  subagent_type: "growth-skeptic",
  description: "Integrity sign-off for the full docs/growth/ program",
  prompt: "Read every file in docs/growth/. (1) STAT VERIFY: list every load-bearing number (market size, competitor review counts, AI-citation %, traffic shares, follower baselines). For each, try to REFUTE it against a primary source via WebSearch/WebFetch. Confirmed → keep with inline source. Refuted/unverifiable → move to a `> DO NOT CITE — unverified` block and strike it from anywhere it is load-bearing. (2) CHECKLIST: confirm no fake/incentivized reviews are recommended (FTC Consumer Review Rule), no AggregateRating/Review schema ships without verified data, the reviews/corpus GEO pillar is rendered as GATED on a paying-customer base (not a day-0 task), every platform action respects that platform's ToS, brand voice is respected, and non-EN locale research is flagged as a known gap if thin. (3) DEPENDENCY AUDIT: flag any `█` milestone whose hard blocker is still open. Return: a verdict (PASS / PASS-WITH-QUARANTINE / BLOCK), the quarantine list, and the filled checklist. Under 400 words."
})
```

7a. **Adversarial verify pass.** Every load-bearing stat in the *whole program* gets a refute attempt.
    This is the pass that kept `altyaa-turbo#251` honest — it refuted 5 fabricated/misattributed figures.

7b. **Do-not-cite quarantine.** Refuted/unverifiable stats are physically moved into a quarantine block in
    `coordination.md` (and struck at their original site). They may inform intuition; they NEVER carry weight.

7c. **The checklist** (FTC / schema / ToS / gating / brand voice / locale) is filled with PASS/FAIL/N-A +
    evidence per row.

7d. **Decision rule — the verdict gates `status: shipped`.**
    - `PASS` → stamp `integrity: SIGNED` + date; the program may ship as drafts.
    - `PASS-WITH-QUARANTINE` → ships, but with the quarantine block intact and the cover stamped with the
      count of quarantined stats.
    - `BLOCK` → an FTC/schema/ToS violation or a no-web-access situation; the program does NOT ship.
      Emit the blocker list and stop. **Never ship a BLOCK.**
    - **Mechanical precondition (7.0):** a non-zero `VerifyProgram --verify` exit is a BLOCK on its own,
      independent of the Skeptic verdict — the deterministic floor cannot be overridden by a PASS judgment,
      and it is the gate that still fires when the council seat does not resolve.

### 8. Write `coordination.md` + persist

Write the artifact per the Output Template below. Then persist the coordination drawer + KG facts via the
canonical bridge (delegated to a subagent so the bridge-invocation-log ratio stays clean, RFC-0035 §6):
one drawer (`wing=growthprogram, room=Programs, title="Coordination — <subject>"`), one `owns` fact per
accountable owner, one `blocks` fact per hard dependency edge, and one `integrity_signed` fact carrying the
verdict + date. Log one line per artifact to `MEMORY/ARTIFACTS/artifacts.jsonl`.

## Output Template (THE artifact — `docs/growth/coordination.md`)

> The literal structure below is what the phase writes. Fill every `«placeholder»`; keep the stable IDs;
> the example rows are illustrative for a "default booking + reputation tool for local salons, French-first"
> subject, generalize to any subject. Append-only — never renumber `C*`/`M*`/`Q*`.

```markdown
# Coordination — «subject»

**Cycle:** «horizon, e.g. Q3 2026 (W1–W12)» · **Owner of record:** «accountable lead»
**Integrity:** SIGNED ✅ «date» (verdict: PASS-WITH-QUARANTINE — 2 stats quarantined) · Skeptic: growth-skeptic
**Cross-refs:** strategy.md · campaigns.md · content-calendar.md · materials/ · social-media-plan.md · geo/* · measurement.md

---

## 1. Roles & Owners

| Owner | Kind | Owns (artifacts + IDs) | Accountable for |
|---|---|---|---|
| Lucas | Human | strategy.md, the wedge | Definition of Winning; final ship gate |
| growth-channel | Agent | content-calendar.md, social-media-plan.md, C1–C4 placement | Presence ops loop, ToS compliance |
| growth-creative | Agent | materials/ (+ production spec), asset IDs | On-brand, format-fit creative |
| growth-strategist | Agent | campaigns.md (C1–C4), geo answer-targets | Campaign logic + sequencing |
| growth-analyst | Agent | measurement.md, Q1–Q12 basket | Both-lens baselines + harness |
| growth-skeptic | Agent | this sign-off, integrity-guard.md | Stat integrity, FTC/schema/ToS, gating |

## 2. RACI matrix (campaigns C* × roles)

| Workstream | Lucas | Channel | Creative | Strategist | Analyst | Skeptic |
|---|---|---|---|---|---|---|
| **C1** — Salon launch-month presence push | A | R | R | C | I | I |
| **C2** — UGC / before-after reels engine | I | R | A | C | I | C |
| **C3** — "Best reputation tool" GEO wedge | A | I | C | R | C | C |
| **C4** — Review-velocity activation (gated) | A | C | I | R | C | **R** |
| GEO pillar (P1–P3 / PH1–PH3) | I | I | C | A | R | R |
| Measurement harness (both lenses) | I | C | I | C | A | C |
| Materials engine (repeatable spec) | I | C | A | I | I | C |
| Presence ops (publish→engage→insights) | I | A | C | I | R | I |

> Rule applied: exactly one **A** per row. C4 carries a Skeptic **R** because its gate is the integrity guard's
> paying-customer-base check — the Skeptic does the work of confirming the gate, not just consulting.

## 3. Milestone calendar (M*) + Gantt

| ID | Milestone | Serves | Owner | Target | Status |
|---|---|---|---|---|---|
| **M1** | Strategy + channel mix signed | C1,C2 | Strategist | W1 | ✅ done |
| **M2** | First materials batch shipped (drafts) | C1,C2 | Creative | W2 | ▶ active |
| **M3** | Content calendar live (W3–W12 dated) | C1 | Channel | W2 | ▶ active |
| **M4** | Presence ops loop running weekly | C1,C2 | Channel | W3 | ◻ planned |
| **M5** | GEO off-repo P0 (directory profiles + entity graph) | P1,C3 | Strategist | W4 | ◻ planned |
| **M6** | GEO in-repo schema (JSON-LD, llms.txt) — PH1 | P2,C3 | Strategist | W5 | ◻ planned (Sentinel-scoped) |
| **M7** | SoAV baseline captured (Q1–Q12, EN+FR) | C3 | Analyst | W4 | ◻ planned |
| **M8** | Review-velocity activation — PH3 | C4 | Skeptic→Channel | gated | ⛔ gated: paying-customer base |
| **M9** | Cycle review — Definition of Winning check | all | Lucas | W12 | ◻ planned |

```
ID   W1  W2  W3  W4  W5  W6  W7  W8  W9 W10 W11 W12
M1   █   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·
M2   ·   █   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·
M3   ·   █   █   ·   ·   ·   ·   ·   ·   ·   ·   ·
M4   ·   ·   █   █   █   █   █   █   █   █   █   █
M5   ·   ·   ·   █   ·   ·   ·   ·   ·   ·   ·   ·
M6   ·   ·   ·   ·   █   █   ·   ·   ·   ·   ·   ·
M7   ·   ·   ·   █   ·   ·   ·   ·   ·   ·   ·   ·
M8   ▓   ▓   ▓   ▓   ▓   ▓   ▓   ▓   ▓   ▓   ▓   ▓   ← gated, never scheduled until gate clears
M9   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   █
```
> Legend: `█` active · `▓` gated/blocked · `·` idle. M8 stays `▓` for the whole cycle because the
> reviews/corpus pillar is arithmetically gated on a real paying-customer base (integrity guard).

## 4. Dependency map (what blocks what)

```
M1 ──► M2 ──► M3 ──► M4 ──(weekly loop)──► M9
                      │
M5 (off-repo P0) ─────┼──► M6 (in-repo PH1) ──► M7 (SoAV needs entity graph live)
   directory profiles │
   + entity graph     └──► gate:paying-customer-base ──► M8 (PH3 review velocity)
```

| Edge | Type | Note |
|---|---|---|
| M2 ← M1 | hard | No materials before strategy/voice signed |
| M6 ← M5 | hard | In-repo schema is downstream of off-repo entity graph — **not** a standalone day-0 sprint |
| M7 ← M5 | soft | SoAV can baseline early but reads thin until the entity graph exists |
| M8 ← gate:paying-customer-base | **hard / integrity** | Review velocity is gated; surfaced as a blocker, not a task |
| M9 ← M4,M7 | hard | Definition of Winning needs the live loop + a SoAV reading to evaluate |

> Off-repo P0 (M5) is rendered as its own node so an easy in-repo schema sprint (M6) can't masquerade as
> the highest-leverage GEO move (integrity guard, sequencing).

## 5. Weekly operating cadence

| Cadence | Owner | Trigger | Touches | Feedback edge |
|---|---|---|---|---|
| Publish + engage | Channel | Mon/Wed/Fri | content-calendar.md | engagement → calendar reprioritization |
| Insights pull | Analyst | Fri | measurement.md (social lens) | top performers → next batch brief |
| Creative batch | Creative | bi-weekly Thu | materials/ | reuses winning formats from insights |
| SoAV run (Q1–Q12) | Analyst | monthly (1st) | measurement.md (GEO lens) | citation gaps → geo answer-targets |
| Integrity re-check | Skeptic | monthly (last) | this file's sign-off | new stats → verify or quarantine |

> Rule applied: every cadence item has a feedback edge — no ceremony steps.

## 6. Definition of Winning (single check)

> **WIN =** By **M9 (W12)**: cited in **≥ 40%** of the Q1–Q12 basket on ChatGPT + Perplexity (EN + FR),
> **AND** ≥ 5,000 engaged followers across IG + LinkedIn, **AND** GBP "directions/calls" actions up
> ≥ 25% vs the W1 baseline. Measured entirely by `measurement.md`; falsifiable; no vanity metrics.

## 7. Integrity sign-off (Skeptic — growth-skeptic)

**Verdict:** PASS-WITH-QUARANTINE · **Date:** «date» · **Stats verified:** «n» · **Quarantined:** 2

### Checklist (program-wide)
| Check | Result | Evidence |
|---|---|---|
| Every load-bearing stat sourced + survived refute pass | ✅ PASS | «n»/«n» confirmed against primary sources; 2 moved to quarantine |
| No fake / incentivized reviews recommended (FTC Consumer Review Rule) | ✅ PASS | C4 uses earned-velocity prompts only; no self-seeding |
| No AggregateRating / Review schema without verified data | ✅ PASS | geo/architecture.md emits Organization + Product only; rating schema deferred until real reviews exist |
| Reviews/corpus pillar gated on paying-customer base | ✅ PASS | M8 rendered ▓ gated; surfaced as blocker in §3/§4 |
| Off-repo P0 vs in-repo split made explicit | ✅ PASS | M5 separate node; M6 dependent in §4 |
| Platform ToS respected (all channels) | ✅ PASS | social-media-plan.md cites per-platform posting limits; no automation banned by ToS |
| Brand voice respected across materials | ✅ PASS | Creative confirmed token + voice lock |
| Non-EN locale research flagged if thin (FR primary market) | ⚠️ KNOWN GAP | FR SoAV basket extrapolated from EN — flagged for a dedicated deep-research pass before FR budget commits |
| No `█` milestone with an open hard blocker | ✅ PASS | dependency audit clean |

### > DO NOT CITE — unverified (quarantined; never load-bearing)
> - "The salon software market is $X B and growing Y%." — refuted: no primary source resolved; the cited
>   figure traced to a vendor blog with no methodology. Informs intuition only.
> - "Z% of consumers pick a salon by online reviews." — unverifiable: stat circulates uncited across
>   listicles; no original study located. Struck from strategy.md where it was load-bearing.

---
*Coordination is the binding + certification layer. Nothing here publishes. Ship = drafts, integrity SIGNED.*
```

## Integrity checkpoints (this phase)

Coordination is where the integrity guard becomes a **gate**, not a guideline — so the checks below are
not advisory, they are blocking:

- **The sign-off is the gate.** No `docs/growth/` artifact reaches `status: shipped` until §7 returns
  `PASS` or `PASS-WITH-QUARANTINE`. A `BLOCK` stops the program; emit the blocker list and do not ship.
- **No-web-access is a BLOCK, not a pass.** If the Skeptic has no `research`/`WebSearch`, the refute pass
  cannot run; stamp `integrity: UNVERIFIED`, quarantine every load-bearing stat by default, and treat the
  program as un-shippable until a verify pass runs. Never silently certify.
- **Quarantine is physical.** Refuted stats are *moved* into the do-not-cite block AND struck at their
  origin — a stat that stays in `strategy.md` while "also" appearing in quarantine is still load-bearing
  and fails the check.
- **The gated pillar must render gated.** If `M8` (review-velocity activation — the program milestone owned
  here; distinct from GeoPillar's `GM8` PH3-defensibility gate) or any reviews/corpus milestone appears as a
  scheduled `█` bar instead of `▓ gated: paying-customer base`, the dependency audit fails — the FTC
  sequencing rule is violated.
- **Exactly one Accountable per RACI row + no phantom owners.** The Skeptic confirms every `A` maps to a
  real, reachable owner; an `A` pointing at a role that does not exist is a phantom-capability failure.
- **The Definition of Winning must key off the harness.** If it cites a metric `measurement.md` cannot
  produce, it is not falsifiable — rewrite before sign-off.

## Worked example

> **Subject:** "Be the default booking + reputation tool for local salons, French-first." (the SKILL's
> Example 0, carried through to Phase 7.)

The conductor finishes phases 1–6 and routes to Coordination with the six artifacts in `docs/growth/`.

1. **Roster** — MemPalace recall returns Lucas as the only human `owns` fact; the five council seats are the
   agent owners. Coordination keeps the full RACI (the agents are real autonomous owners), with Lucas
   Accountable for the wedge, the GEO campaign (C3), the gated activation (C4), and the final ship gate.
2. **RACI** — C4 (review-velocity activation) gets a Skeptic **R**: the work of C4 *is* confirming the
   paying-customer gate, so the integrity seat owns the doing, not just the consulting. Every other row
   resolves to exactly one A; no ties to escalate.
3. **Milestones** — M1–M9 extracted. M5 (off-repo directory profiles + entity graph) and M6 (in-repo
   JSON-LD/llms.txt schema) land as *separate* nodes so the in-repo sprint can't pose as the highest-leverage
   GEO move. M8 (review-velocity activation) renders `▓` across the whole 12-week Gantt — gated, never scheduled.
4. **Dependencies** — the map shows `M5 → M6 → M7`, and `gate:paying-customer-base → M8` as a hard
   integrity edge. Sentinel confirms M6 is a real, scoped in-repo ticket; M5 is flagged off-repo P0.
5. **Cadence** — weekly publish/engage + Friday insights pull + monthly SoAV `Q1–Q12` run + monthly Skeptic
   re-check, each with a feedback edge into the calendar or answer-targets.
6. **Definition of Winning** — one falsifiable sentence keyed to the harness: ≥40% citation across the
   Q1–Q12 basket on ChatGPT+Perplexity (EN+FR), ≥5k engaged IG+LinkedIn followers, +25% GBP actions, all
   by M9.
7. **Sign-off** — the Skeptic runs the refute pass over the whole program. It confirms most figures, but
   **refutes two**: an unsourced "salon software market is $X B" (vendor-blog origin, no methodology) and an
   uncited "Z% pick a salon by reviews" (listicle circulation, no original study). Both move to the
   `> DO NOT CITE` block and are struck from `strategy.md`. The checklist passes except FR locale research,
   flagged as a **known gap** (FR SoAV extrapolated from EN — needs a dedicated deep-research pass before FR
   budget commits). Verdict: **PASS-WITH-QUARANTINE**.

`coordination.md` is written with `integrity: SIGNED` + the 2-stat quarantine count on the cover; the
coordination drawer + `owns`/`blocks`/`integrity_signed` KG facts persist to MemPalace; artifacts log to
`artifacts.jsonl`. The program ships **as drafts** — Coordination publishes nothing.

## Intent-to-Flag Mapping

The only CLI this workflow shells is the deterministic integrity gate (Step 7.0). It is not
operator-phrasing-driven — it is a fixed pre-ship invocation — so the mapping is a single command.

| Intent | Command | Effect |
|--------|---------|--------|
| "run the integrity gate" / "is the program shippable" / Step 7.0 pre-Skeptic floor | `bun ~/.claude/skills/growth-program/Tools/VerifyProgram.ts --verify docs/growth` | Scans the emitted program; exit `0` clean · exit `2` BLOCK (a non-zero exit is a hard block independent of the Skeptic verdict). |
| "show the violations as data" | `bun ~/.claude/skills/growth-program/Tools/VerifyProgram.ts --verify docs/growth --json` | Same scan, machine-readable `{ ok, count, violations[] }`. |

The Skeptic truth-refutation pass is invoked via `Task(subagent_type: "growth-skeptic")`, not a CLI — it is
not a flag-mapped command.
