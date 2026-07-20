---
disable-model-invocation: true
name: TrackBootstrap
description: Bootstrap a new integration provider/domain via the 7-artifact track-bootstrap pattern (Bootstrap workflow) AND walk the resulting sub-track PRDs through topo-ordered delivery via the DAG walker (DeliverTrack workflow). Emits parent research PRD + API catalog + package design + MILESTONES + ROADMAP + DAG-deps + matrix + N sub-track PRD stubs; then walks the DAG dispatching each sub-track to MakerkitTeam/FastAPIStarterTeam DeliverFeature. USE WHEN track-bootstrap, bootstrap track, new provider, onboard integration, integration provider, API package bootstrap, multi-PRD provider, research package, scaffold track, provider bootstrap, new external provider, new API integration with multiple surfaces, deliver track, run track, ship track, walk track, deliver all sub-tracks, execute track DAG, process full set of PRDs.
role: orchestrator
accepts:
  - text
roots:
  - INSTALL
visibility: public
capabilities:
  - artifact.write
  - customization.cascade
  - voice.emit
---
<!-- generated-from: SKILL.partials.md — DO NOT EDIT directly. Run: bun Tools/dos-build.ts skill <path> -->
## Customization

**Before executing, check for user customizations at:**
`~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/TrackBootstrap/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.

# TrackBootstrap Skill

**Primary Purpose:** Bootstrap a new integration provider/domain into a kit-scaffolded repo using the 7-artifact track-bootstrap pattern. Operator says one of "track-bootstrap: {provider}" or "do a track-bootstrap for X" — the skill emits the scaffolding, orchestrates the 4 parallel research workstreams, and produces a parent research PRD + N sub-track PRD stubs ready for operator G1 review.

This skill is the **API-integration sibling** of `DOSUpgrade` (doctrine-evolution) in the **research-package meta-pattern** family. Canonical reference: `MEMORY/CANONICAL/track-bootstrap-pattern.md`.

---

## When to invoke

ALL of the following must hold:

- Non-trivial external API with ≥5 distinct surfaces / sub-APIs / capability clusters
- Multi-PRD scope (one provider = N sub-tracks, each its own PRD)
- Provider has its own OAuth-scope domain, rate-limit regime, and resource model
- Work is parallelizable across a delivery team after G1 approval

Do NOT invoke for: single-file utility additions, bug fixes, refactors of existing tracks, adding one endpoint to an already-bootstrapped track. For those, route to MakerkitTeam/FastAPIStarterTeam DeliverFeature workflow.

---

## Workflow Routing

| Workflow | Trigger | File |
|---|---|---|
| **Bootstrap** | "track-bootstrap: {provider}", "do a track-bootstrap for X", "bootstrap track Y", "scaffold the {provider} package", "new {provider} integration", "research package for {provider}" | `Workflows/Bootstrap.md` |
| **DeliverTrack** | "deliver track {ID}", "run track {ID}", "ship {ID}", "deliver all of {STACK}-stack", "execute {ID}.0..{ID}.N", "walk the {STACK} sub-tracks", "ship the full track", "process the full set of PRDs from {STACK}" | `Workflows/DeliverTrack.md` |

**Default workflow:** if the operator says "track-bootstrap" or "bootstrap" with a provider name, run **Bootstrap**. If they say "deliver track" / "ship track" / "run track" with an existing bootstrapped track, run **DeliverTrack**.

---

## Examples

**Example 1: Bootstrap a new commerce provider (Google Merchant)**
```
Operator: "Track-bootstrap: Google Merchant (merchantapi.googleapis.com) under commerce-stack. Decompose into ~9 sub-tracks. Mirror the google-business template."
→ Routes to Workflows/Bootstrap.md
→ OBSERVE reads ~/.claude/DOS/Scaffolds/track-bootstrap/ + closest sibling (google-business B4 PRD)
→ PLAN emits 📐 PARALLELISM block committing to 4 research workstreams
→ scaffold-track.ts emits 7 artifacts + 9 sub-track PRD stubs
→ 4 parallel research streams return; AI synthesizes api-catalog, package-design, MILESTONES, ROADMAP, dag-deps, matrix
→ /code-review audit, then VERIFY ISCs, then operator G1 review of parent PRD
→ Operator gets parent research PRD (phase: verify) + 9 sub-track PRD stubs ready for individual G1 approval
```

**Example 2: Terse invocation (pattern internalized)**
```
Operator: "Track-bootstrap: Resend"
→ Routes to Workflows/Bootstrap.md
→ OBSERVE infers parameters via Skill("ref") lookup for Resend API; surfaces inferred params as decision artifact for operator G1
→ Operator confirms: track=RS, stack=email-stack, provider=resend, sub-tracks=5 (templates, audiences, contacts, send, webhooks)
→ Full pipeline runs as Example 1; smaller scope (~3-4h vs ~6-8h for greenfield stack)
```

**Example 3: Decline (pattern does NOT fit)**
```
Operator: "Track-bootstrap: add a Stripe webhook handler"
→ Phase 1 pattern-fit verification fails (single sub-API, not ≥5 surfaces)
→ Skill DECLINES per Algorithm §4.2 Decline Protocol with reason: "Single-endpoint scope; track-bootstrap pattern requires ≥5 distinct surfaces"
→ Routes operator to MakerkitTeam/FastAPIStarterTeam DeliverFeature workflow instead
→ No artifacts written; PRD slug not reserved
```

---

## What the skill produces

7 artifacts in dependency order (the operator/AI fills in content; the scaffold structures it):

| # | Artifact | Target path |
|---|---|---|
| 1 | RESEARCH PRD (parent) | `MEMORY/WORK/active/${TS_UTC}_${STACK}-research-package-bootstrap/PRD.md` |
| 2 | API CATALOG | `MEMORY/ARTIFACTS/${STACK}/api-catalog-${PROVIDER_KEBAB}-complete.md` |
| 3 | PACKAGE DESIGN | `MEMORY/ARTIFACTS/${STACK}/${PROVIDER_KEBAB}-package-design.md` |
| 4 | MILESTONES | `MEMORY/ARTIFACTS/${STACK}/MILESTONES.md` |
| 5 | ROADMAP | `MEMORY/ARTIFACTS/${STACK}/ROADMAP.md` |
| 6 | DAG-DEPS + MATRIX | `MEMORY/ARTIFACTS/${STACK}/dag-deps.md` + `backend-integration-matrix.md` |
| 7 | SUB-TRACK PRD STUBS (×N) | `MEMORY/WORK/active/${TS_UTC_STUBS}_${STACK}-${TRACK_ID}.{0..N-1}-${slug}/PRD.md` |

---

## Tools used

- `bun ~/Durante/Tools/scaffold-track.ts` — generator CLI that emits the 7 artifacts with placeholder-substituted target paths. Idempotent (refuses to overwrite). See `~/Durante/Tools/scaffold-track.ts` JSDoc for full flag reference.
- `Skill("research", "extensive")` — 10-bucket dossier per the 4-stream parallelism contract.
- `Skill("ref")` — vendor-docs lookup per sub-API.
- WebFetch — verbatim method enumeration from REST reference URLs.
- MemPalace + ContextSearch — prior-art recall to confirm greenfield vs. adjacent learnings.

---

## Sibling pattern — research-package meta-family

| Instance | "Outside" phase | Catalog/enumerate | Decompose to units |
|---|---|---|---|
| **TrackBootstrap** (this) | 4 parallel research workstreams | API catalog | Sub-track PRDs |
| **DOSUpgrade** | YouTube + sources.json mining + reflections | D-items report | D-tickets per ISC |
| **Algorithm ratification** (v0.0.8/9/10) | Reflection mining | RFC ratification list | Per-ISC RFCs |

These are siblings, not interchangeable. Pick the right one by the input domain (external API integration → here; doctrine evolution → DOSUpgrade).

---

## Provenance

Pattern named 2026-05-15 during the Google Merchant run after 3 historical instances proved the shape:
1. social-stack B1/B2/B3 (Meta/IG/TikTok) — pattern unnamed
2. social-stack B4 (Google Business Profile) — pattern emerged
3. commerce-stack GM (Google Merchant) — pattern named + codified

Canonical reference + meta-pattern context: `MEMORY/CANONICAL/track-bootstrap-pattern.md`.
Scaffold templates: `~/.claude/DOS/Scaffolds/track-bootstrap/`.
Generator CLI: `~/Durante/Tools/scaffold-track.ts`.
Sentinel invariant: R69 — track-bootstrap-artifacts-complete.
