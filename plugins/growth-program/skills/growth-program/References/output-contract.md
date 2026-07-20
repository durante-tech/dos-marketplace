# Output contract — the `docs/growth/` program

The deliverable. **Social presence + campaigns + materials lead; GEO is one pillar.** Generalizes
`durante-tech/altyaa-turbo#251` (which shipped the GEO pillar + a week-1 asset drop). Lazy-loaded by the
conductor (not auto-loaded).

## Artifacts — presence + campaign core (first-class)
| File / dir | Purpose |
|---|---|
| `strategy.md` | Brand + audience/ICP + channel mix (per-channel cadence + format fit) + the wedge |
| `campaigns.md` | Every campaign (C*) — brief, hypothesis, channels, pillar(s) served, success signal + overview table |
| `content-calendar.md` | **Dated, multi-channel** calendar (GBP/FB/IG/TikTok/LinkedIn/YouTube) — what posts where, when |
| `materials/` | Produced creative — posts, reels, carousels, hero/vertical images, logo — **plus** the repeatable production spec (brand-locked templates), not just one batch |
| `social-media-plan.md` | The ongoing **ops loop**: schedule → publish → engage → pull insights → feed back; channel playbooks |
| `*-deck.html`, `*-deliverable.html` | Standalone HTML deck + a first-cycle deliverable page |

## Artifacts — GEO/AEO pillar (one workstream)
| File | Purpose |
|---|---|
| `geo/recommendation-roadmap.md` | Be-the-default-AI-recommendation spine — baseline (sourced), corpus supply-chain, answer-targets, pillars (P*), gated sequencing (PH*) |
| `geo/architecture.md` | In-repo ADR + component/file map (JSON-LD, llms.txt, programmatic pages) |
| `geo/query-basket.md` | Share-of-AI-Voice seed queries (Q*) EN + locale + results-log template |

## Artifacts — measurement + coordination (cross-cutting)
| File | Purpose |
|---|---|
| `measurement.md` | **Both lenses:** social insights (reach/engagement/follower growth/GBP actions) **+** Share-of-AI-Voice methodology + GA4 AI-referral setup + verified tool stack |
| `coordination.md` | RACI (campaigns × roles), owners, milestone calendar (M*) + Gantt, dependency map, weekly cadence, the single Definition-of-Winning check |

## Stable-ID scheme (load-bearing — cross-reference everywhere)
Two **disjoint** ID namespaces so IDs never collide across artifacts:
- **Social / program:** `C*` campaigns (owned by `CampaignCalendar`) · `M*` milestones (owned by `coordination`).
- **GEO:** `GC*` campaigns · `GM*` milestones (owned by `GeoPillar`) · `P*`/`PH*` pillars/phases.
- **Shared:** `Q*` SoAV queries · asset IDs in `materials/`.

Every calendar entry cites its campaign; every campaign cites the milestone(s) + channel(s) it serves; a
GEO-serving social campaign may reference a GEO milestone by its `GM*` id. Coordination RACI keys off
`C*`/`GC*`; measurement keys off `C*` (social) and `Q*`/`GM*` (GEO). Append-only; the `C*`/`M*` and
`GC*`/`GM*` ranges must stay disjoint — never reuse a number across the two namespaces.

## Quality bars
- The calendar is **dated and per-channel**, not a vague plan.
- Materials ship with a **repeatable spec**, not just a one-off batch.
- Presence is an **ops loop with a measurement feedback edge**, not a static document.
- Every baseline/competitor figure has a **source**; no fabricated stat ships (see `integrity-guard.md`).
- GEO's reviews/corpus pillar is explicitly **gated on a real paying-customer base**.
