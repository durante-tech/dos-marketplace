# Archetypes — Changelog

## v0.0.5 — 2026-07-22 (corpus #6 — feature-flags FIELD mint, archer gen-54)

- Sixth archetype: `feature-flags` v0.1.0 — 46 rows / 5 dimensions / 6 anti-criteria, two-cohort live grounding (GitLab/PostHog/Firebase/AWS AppConfig/Azure/Vercel/Harness/Optimizely × LaunchDarkly/Flagsmith/Unleash/ConfigCat/Split/Statsig, 34 sources), full gen-39 recipe. Zero validator findings at first encoding (2nd consecutive field-clean). Step-4b blind skeptic: 43/45 tiers exact, 0 confirmed re-tiers, 11 findings ALL applied (1 silent-absence row added, 4 inferred-flag corrections, 1 carved-count removal, 2 context riders, 1 new anti-criterion `a-eval-without-default`, 1 why-provenance fix). 8 rows are T1 via the services-universality override. Longitudinal note: same domain as the gen-4 probe (24 validator/17 skeptic/12 absences under gen-3 law) — now 0/11/1 under gen-39 law.
- Changelog backfill note: Stage-1/Run-3 field mints (auth-session v0.1.1, notifications v0.1.1 confirmed-field enrichment; audit-log v0.1.0, corpus #5, gen-40) shipped while this changelog was not maintained — their receipts live in the archer ledger fitness table.

## v0.0.4 — 2026-07-22 (Stage-2 ratification — RFC-0164, archer gen-50)

- Sub-ISC relation RATIFIED (RFC-0164 D-C): the `[T<tier> <row-id>]` bracket is the parent's normative archetype-row provenance; children take dotted ids `ISC-S<n>.<m>`; VERIFY rollup law applies (a `build` parent with zero children is a finding). The v0.0.1 "bridges until ratified" framing is retired — the syntax is not (D-C.1).
- Scope layer is a first-class PRD section with the mandatory-or-declined applicability predicate (D-A); completeness enforcement is Sentinel R101 `presence.archetype-scope-completeness` (D-B, WARN-ONLY birth tier, dos#705 + cc#332).
- No schema/validator/corpus surface changes in this entry (obligation law unchanged — RFC-0164 §5). SeedScope.md Step 4 prose updated to cite the ratified relation.

## v0.0.3 — 2026-07-09 (Stage-1 field mints)

- Third archetype: `auth-session` v0.1.0 — 39 rows / 11 anti-criteria, two-cohort live grounding (GitHub/Slack/Notion/Linear/Figma/Vercel/Shopify/Atlassian × Auth0/Clerk/WorkOS/Firebase/Stytch/Kinde), full gen-22 recipe law, Step-4b skeptic (5 findings, all applied). Corpus = 3.
- Fourth archetype: `notifications` v0.1.0 — 29 rows / 9 anti-criteria (GitHub/Slack/Linear/Notion/Asana/Figma/Intercom/Jira × Knock/Novu/Courier/OneSignal/MagicBell/Braze), gen-24 contract block first measured use (zero contract-class encoding findings). Corpus = 4 — Stage-1 "≥3 archetypes" exit threshold crossed.
- Validator: `sources-shape` guard (gen-23 — field mint emitted a sources dict; crash became a finding).

## v0.0.2 — 2026-07-09 (archer gen-1)

- Second archetype: `billing` v0.1.0 minted 2026-07-08 (46 rows, 10 anti-criteria, two-cohort live grounding; skeptic verdict ADJUST, all fixes applied) — corpus = 2.
- Corpus → media `v0.2.0` + billing `v0.2.0`: 5 rows re-tiered T2→T1 under the enforced universality clause (media bulk-upload/url-import/download-original/multi-kind; billing seat-add-remove-midcycle).
- Validator ratchet `universality-demotion`: a row universal in any cohort (≥4) cannot sit below T1 without contextRider/groundingException. Regression guard: `Tools/ValidateArchetype.test.ts` (bun:test, inline fixtures); `validate()` exported, CLI guarded by `import.meta.main`.
- Harness evolution memory lives at `Packs/archetypes/archer/` (repo-side only, not deployed).
- gen-2: media → `v0.3.0` — 6/8 boundary overlap resolved to the billing-precedent bands (T2 = 4-5/8; every count maps to exactly one tier); 4 rows re-tiered T2→T1 (rename-title, user-sort, bulk-delete, replace-preserve-url); recipe Step 3 thresholds fixed to match.
- gen-3: media → `v0.4.0`, billing → `v0.3.0` — tierDefinitions rule-completeness (text-only, zero tier values changed): the universal-services T1 override is stated as unconditional; "segment leaders" removed (dead text that minted unsanctioned T2 readings); 0-count rows homed in T3; services-cohort labels no longer say "corroboration" (it contradicted the override); recipe Step 3 states the only two tiering paths.

## v0.0.1 — 2026-07-08

- Initial release: schema-first archetype corpus (`Schema/Archetype.ts`, typed `Data/*.archetype.ts` modules).
- First archetype: `media-asset-library` v0.1.0 — 42 rows across 6 dimensions, 6 anti-criteria, two-cohort live grounding (8 in-app products + 6 dedicated services, fetched 2026-07-08); migrated from the dos-repo pilot (`Docs/Research/feature-archetype-media-pilot.md`).
- Workflows: AuthorArchetype (two-cohort mining → typed encoding), AuditFeature (evidence-cited gap ledger), SeedScope (PLAN-time scope ISCs + deferral ledger; T1 never silently absent).
- Tools: ValidateArchetype.ts + RenderArchetype.ts — zero external deps (live-install safe).
- Deliberately NOT in v0.0.1: the Algorithm §4.2 trigger row making SeedScope self-invoking (pending RFC, operator-gated); sub-ISC hierarchy (the bracket convention `[tier row-id]` bridged the join until RFC-0164 D-C ratified it normative, 2026-07-22 — see v0.0.4).
