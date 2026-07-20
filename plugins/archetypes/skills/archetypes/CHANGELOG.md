# Archetypes — Changelog

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
- Deliberately NOT in v0.0.1: the Algorithm §4.2 trigger row making SeedScope self-invoking (pending RFC, operator-gated); sub-ISC hierarchy (bracket convention `[tier row-id]` bridges until ratified).
