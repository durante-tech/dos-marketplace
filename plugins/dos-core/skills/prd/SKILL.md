---
name: PRD
description: PRD authoring + lifecycle workflows for vNext-format documents. Seven workflows — Scaffold (vNext stub), CheckCompleteness (parse + lint), Reconcile (apply council/operator changes), MigrateToVNext (v2.1 → v3.0), Interview (OBSERVE-time elicitation), Seed (criteria from RFC ISC seeds), Append (add Decision/Verification entry). USE WHEN scaffold PRD, new PRD, check PRD completeness, migrate PRD to vnext, lint PRD, reconcile PRD, interview PRD, scope PRD criteria, elicit PRD criteria, seed PRD from RFC, seed ISCs, append decision to PRD, append verification, record PRD decision, log ISC evidence, RFC-0083, vNext PRD scaffold.
role: workflow
accepts:
  - text
roots:
  - PROJECT.WORK
visibility: public
capabilities:
  - customization.cascade
divergence_from_canonical:
  _artifact-tracking.md:
    partial_version: 1.1.0
    reason: "PRD.md authorship flows through the @durante/prd Writer library workflows, not ad-hoc artifact writes; the canonical artifacts.jsonl block does not describe this pack's write path"
    rationale_link: null
  _four-copy-footer.md:
    partial_version: 1.0.0
    reason: "Bespoke Four-Copy section — documents the pack:PRD sync-manifest pair and the @durante/prd library exclusions; the canonical footer omits both"
    rationale_link: null
---
<!-- generated-from: SKILL.partials.md — DO NOT EDIT directly. Run: bun Tools/dos-build.ts skill <path> -->
## Customization

**Before executing, check for user customizations at:**
`~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/PRD/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.

# PRD Skill

V12.4 (RFC-0083 Accepted-Partial 2026-05-13) of the PRD authoring + lifecycle skill. The skill wraps the `@durante/prd` library's writer + migrate surfaces (the writer `appendDecision`/`appendVerification` are now real — RFC-0083 PG3) — it does NOT replace AI's direct Edit/Write authorship of PRD body content per v0.0.8 §2.

## Mode: partials-generated (converted from RFC-0006 §5.2c inlined mode, V23-W0-S2 / B-20)

This pack is authored in **partials mode**: `SKILL.partials.md` is the source of record and `SKILL.md` is generated from it via `bun Tools/dos-build.ts skill Packs/PRD` (or `dos-build-v2.ts`). The pack was converted out of §5.2c inlined mode during v0.0.23 W0 pack-readiness (B-20) so the visibility classifier and `dos-build --all` cover it. Edit `SKILL.partials.md`, then rebuild — do not hand-edit `SKILL.md`.

## Workflows

| Workflow | Status | Purpose |
|---|---|---|
| `Scaffold` | ✅ V12.4-α | Generate a new vNext PRD stub at `MEMORY/WORK/active/{slug}/PRD.md` |
| `CheckCompleteness` | ✅ V12.4-α | Lint a PRD via `parsePRDFile` + R44/R45 conformance checks |
| `Reconcile` | ✅ V12.4 | Apply council/operator decisions — wired to the real `appendDecision()` writer (idempotent; fail-soft direct-Edit fallback) |
| `Interview` | ⏳ V12.4-β | Multi-turn elicitation flow for OBSERVE-time scoping |
| `MigrateToVNext` | ✅ V12.4 (stamp-only) | v2.1 → vNext: stamps `format_version: 3` + echoes the partial-migration warning; §5.1 body-split still deferred (not shipped as of v0.0.19; re-scope at the next PRDFORMAT revision) |
| `Seed` | ✅ V12.4 | Initialize criteria from RFC ISC seeds; denominator body-derived from `- [ ] ISC-N:` count |
| `Append` | ✅ V12.4 | Add Decision / Verification entry via the real `@durante/prd/Writer` (idempotent; fail-soft fallback) |

## Workflow Routing

All seven workflows are routed (≥1 trigger each):

| Request pattern | Workflow |
|---|---|
| "scaffold PRD ..." / "new PRD ..." | `Workflows/Scaffold.md` |
| "check PRD ..." / "lint PRD ..." / "is this PRD complete" | `Workflows/CheckCompleteness.md` |
| "reconcile PRD ..." / "record the decision" / "apply council verdict" | `Workflows/Reconcile.md` |
| "migrate PRD to vnext" / "migrate this old PRD" | `Workflows/MigrateToVNext.md` |
| "interview me for the PRD" / "scope this PRD" / "elicit criteria" | `Workflows/Interview.md` |
| "seed PRD from RFC ..." / "pull ISCs from RFC-NNNN" | `Workflows/Seed.md` |
| "append decision ..." / "append verification ..." / "log evidence for ISC-N" | `Workflows/Append.md` |

## Examples

**Example 1: Scaffold a vNext PRD for a new feature**
```
User: "Scaffold a PRD for the new payments-refactor work"
→ Invokes Scaffold workflow
→ Generates MEMORY/WORK/active/{YYYYMMDD-HHMMSS}_payments-refactor/PRD.md with vNext frontmatter (format_version: 3)
→ Returns the PRD path; AI then edits ## Context / ## Criteria / ## Decisions / ## Verification directly
```

**Example 2: Lint an existing PRD for completeness**
```
User: "Check the open-design migration PRD — is it complete?"
→ Invokes CheckCompleteness workflow
→ Runs parsePRDFile + R44/R45 conformance checks against MEMORY/WORK/active/{slug}/PRD.md
→ Reports per-section completeness, missing-criteria warnings, ISC-count gate status
```

**Example 3: Migrate a legacy v2.1 PRD to vNext format**
```
User: "Migrate this old PRD to the new vNext format"
→ Invokes MigrateToVNext workflow
→ Library calls Migrate/v2_to_v3.ts on the source PRD
→ Writes the migrated PRD alongside (or in-place); preserves all body content; rewrites frontmatter to format_version: 3
```

## Four-Copy

Lives in:
- `~/.claude/skills/prd/` (live)
- `Packs/prd/src/` (pack source — **populated**: `SKILL.md` + `Workflows/` are the canonical skill body)
- `Releases/v0.0.19/.claude/skills/prd/` (submodule)

Sync via `bun ~/Durante/Tools/sync-check.ts`. The manifest pair **is declared** — `pack:PRD` (`kind: pack_dir`, `PRD/src` ↔ `skills/PRD`) in `.dos-sync-manifest.json`. The `@durante/prd` workspace-package modules (`Doctrine/`, `Migrate/`, `Parser/`, `Tools/`, `Writer/`, `lifecycle/`) and `extension.yaml` are `exclude`d from that pair — they are library/metadata, not skill body, and have no live mirror.
