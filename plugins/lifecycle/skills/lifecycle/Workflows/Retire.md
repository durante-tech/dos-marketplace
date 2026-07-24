---
name: Retire
description: Retire a DOS capability — pack, skill, hook, tool, or agent — with verified closure
bestPath:
  - title: "Keep-Test"
    description: "Five evidence-backed questions — field use, uniqueness, dependents, replacement, ownership — before touching anything."
  - title: "Advisory or Compulsory"
    description: "Default advisory with a re-review date; compulsory requires a named justification and ships the dependent migration."
  - title: "Class Mechanics + Tombstone"
    description: "Execute the per-class removal motion, regenerate generated surfaces, leave exactly one discoverable marker."
  - title: "Closure Verification"
    description: "Citation-resolution grep, sync-check 0, lint green, ledger entry, rollback anchor verified pre-merge."
divergence_from_canonical:
  _intent-to-flag-table.md:
    partial_version: 1.0.0
    reason: "Fixed tool/command reference table (sync-check, generate-packs-index, tools-catalog, git mv, grep) — no intent-variant flags exist to map; the section deliberately documents which command serves which retirement intent, not the canonical Mode Selection flag-shape."
---

# Retire Workflow

## When to Use

- "retire <capability>", "remove this pack/skill/hook", "kill this feature", decommission requests
- A capability failed its keep-test: zero field use, superseded in-corpus, or ownerless-but-depended-on
- NOT for adopted external imports with upstream attribution — use `SunsetImport` (it wraps this)
- NOT for moving a surface to a new home — use `MigrateSurface`

## Step 1 — The keep-test (decide before touching anything)

Answer all five with evidence, recorded in the driving PRD, ledger, or CHANGELOG:

1. **Field use** — when did a real session last exercise it? Consult what already exists:
   `MEMORY/STATE/skill-activations.jsonl`, `MEMORY/ARTIFACTS/artifacts.jsonl`, fleet ledger rows.
2. **Uniqueness** — does anything else now cover it? Grep the Packs/README.md index, the live
   skills list, installed plugins, and the native-feature set. Duplicated coverage fails the test.
3. **Dependents** — who references it? Grep the corpus for the capability name; check the
   SYNC_TOOLS registry, settings hook wiring, workflow routing tables, and RFC citations.
4. **Replacement** — if dependents exist, does a working successor exist BEFORE removal?
5. **Ownership** — does the fleet board or a sibling ledger claim the surface? A live claim means
   coordinate through the board, never unilateral removal. Anything you did not create needs the
   ADR path before deletion.

A capability that passes stays. Retirement proceeds only on a named failure with its evidence.

## Step 2 — Advisory or compulsory

- **Advisory (default):** tombstone + deprecation note in the capability's own docs; dependents
  migrate on their cadence. Re-review on a stated date — advisory-forever is a red flag.
- **Compulsory** requires at least one: security class, protected-surface or doctrine conflict,
  license/compliance defect, or sustained zero field use while carrying real maintenance cost.
  Compulsory retirement ships the dependent migration in the same PR series — the remover
  migrates the dependents.

## Step 3 — Mechanics per class

| Class | Motion |
|---|---|
| Pack | `git mv Packs/<name> Packs/.retired/<name>`, then regenerate the Packs/README.md index, the CLAUDE.md pack-count phrase, AND the funnel manifest (`bun Tools/dos-generate-funnel-manifest.ts`) when the pack carries a visibility entry — three generated surfaces, generator-run, never hand-edited (field lesson, Prospector Gen-56b: the committed funnel manifest went stale when a pack changed without the regen) |
| Skill (deployed) | Remove every copy per the Four-Copy table (pack source, live install, submodule) in cc-first PR order; `bun Tools/sync-check.ts` must exit 0 after |
| Hook | Un-wire the settings hooks entry, remove the `.hook.ts` from all copies, delete its SYNC_TOOLS row if registered; note the committed exec-bit blob mode changes with it. **Preserve-list caveat (field lesson, Forge Gen-150 / F6 Prewarm retirement, 2026-07-21):** a dereg that rides `settings.json` does NOT reach the maintainer machine — the pull leg's preserve mechanism keeps the operator-SoT settings copy over the incoming dereg, leaving a dangling registration that errors every SessionStart. For preserve-listed files, the dependent-migration step is an OPERATOR (or interactive-session) action — queue it explicitly; do not count the retirement complete until the live settings copy is verified clean |
| Tools/ CLI | Remove the file, regenerate the Tools/README.md catalog (`bun Tools/tools-catalog.ts`), tombstone the Docs/TOOLING.md rationale entry |
| Agent | Remove the agents registry entry plus any composes/traits references — the Weave seam files are Tailor territory; coordinate before editing them |

## Step 4 — Tombstone

Leave exactly one discoverable marker at the old home's class ledger: what was retired, when,
why, and where the successor lives. One line, not a preserved corpse — a full dead file kept
"just in case" is the thing this workflow exists to prevent.

## Step 5 — Closure verification

- [ ] Corpus grep for the retired name: every surviving citation resolves to the tombstone or the successor (RFC-0092 standard)
- [ ] Generated surfaces regenerated and diff-verified: pack index, CLAUDE.md counts, Tools catalog, funnel manifest (`dos-generate-funnel-manifest.ts`) when any visibility entry changed
- [ ] `sync-check` exit 0 · lint green · test suite shows no NEW failures beyond the pinned set
- [ ] The retirement is ledgered where the capability was born (pack CHANGELOG, fleet ledger, or PRD Decisions)
- [ ] Rollback anchor (tag + restorable backup) verified BEFORE the removal PR merges

## Intent-to-Flag Mapping

| Intent | Command |
|---|---|
| Verify all copies after a multi-copy removal | `bun ~/Durante/Tools/sync-check.ts` (drift detail: `--full`; machine-readable: `--json`) |
| Regenerate the pack index + count check after a pack retirement | `bun ~/Durante/Tools/generate-packs-index.ts` (verify-only: `--check`) |
| Regenerate the Tools catalog after a CLI retirement | `bun ~/Durante/Tools/tools-catalog.ts` |
| Move a pack into the retirement directory | `git mv Packs/<name> Packs/.retired/<name>` (history-preserving move — never `rm` + re-add) |
| Confirm no dangling citations post-removal | `grep -rn "<retired-name>" --include="*.md" ~/Durante` (every hit must resolve to tombstone or successor) |

## Field precedents

- **Vendored document-skills retirement (2026-07-12):** license class forced removal; the cluster
  SKILL.md was rewritten as a router to the official plugin — replacement-first, attribution
  preserved, cc-first ship order.
- **LoopSmith (fleet, 2026-07):** pack moved to `Packs/.retired/`, live copy flagged for the next
  hygiene pass — the residue convention this workflow codifies.
