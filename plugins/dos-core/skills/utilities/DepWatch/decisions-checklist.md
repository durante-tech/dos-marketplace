<!-- minted-by: CrunchScaffold v0.1.0 | brief-hash: f2904c | 2026-05-20T15:02:51Z -->
# DepWatch — Decisions Checklist

**Status: COMPLETE.** All irreducible domain work was authored 2026-05-20; DepWatch is
a runnable Surface Crunch skill. Retained as the completion record — the Catalog
workflow reads it to classify this instance as complete.

## A. Triggers & identity (`SKILL.partials.md`)
- [x] USE WHEN clause — dependency check, dep watch, CVE scan, breaking changes, outdated packages, supply chain check
- [x] Workflow Routing trigger phrases
- [x] Example 2 — security-only quick crunch

## B. Surfaces (`sources.json` + `Survey.md`)
- [x] Inward Surface — installed dependency set (package.json + lockfile)
- [x] Outward Surfaces — advisories, releases & changelogs, deprecations
- [x] Per-Surface Extraction Contract — inward inventory shape + outward finding shape

## C. Convergence & scoring (`Survey.md` Step 3)
- [x] Scoring rubric — `(relevance × 2) + impact + effort`, three 1-10 axes
- [x] Tier thresholds — 🔴 ≥30 or in-range CVE · 🟠 22-29 · 🟡 14-21 · 🟢 <14

## D. State dedup
- [x] Dedup key — the `ecosystem:package:id` triple

## E. Output (`Survey.md` Step 4)
- [x] Recommendations section — 4-tier tables
- [x] Quick mode (CVEs only) + error handling

## F. Conformance
- [x] Zero unresolved FILL markers remain
- [x] `lint-skills.ts --pack Utilities` — 0 findings
- [x] `sync-check.ts` — 0 drift
- [ ] `/sentinel scan` — deferred (DepWatch mirrors the existing Surface Crunch instance shape; no new convention to register)

## Provenance
Minted by CrunchScaffold `v0.1.0`, brief-hash `f2904c`, at `2026-05-20T15:02:51Z`.
Completed 2026-05-20. To retire DepWatch and its CrunchScaffold siblings, grep
`minted-by: CrunchScaffold` across `skills/`.
