# Utilities — Changelog

## v0.1.0 — 2026-06-26

Phase-0 hardening floor (Utilities vNext, Loop-B firing #3). Inaugural tracked release of the utilities pack. Parameterizes frozen-release / stale-doctrine paths so they survive the next version freeze, repoints a dead build-tool reference to the live tool, fills every empty workflow `description:` frontmatter line, and codifies the pack-level split ceiling that Utilities itself violates.

### Added

- **`CHANGELOG.md`** (this file) — establishes the CHANGELOG-to-Status drift anchor for lint R15. Pair with a `**Status:** v0.1.0 — …` line in the pack `SKILL.md` body (authored from `SKILL.partials.md`) so R15 can verify the two stay in sync.
- **Pack-level split ceiling doctrine** in `CreateSkill/Workflows/CreateSkill.md` (Step 4) — "one pack, one secret": a pack spanning more than ~8 unrelated sub-domains/sub-skills must split into focused packs. Complements the existing per-skill "10+ workflows to sub-skill" rule and names Utilities (21 unrelated sub-skills) as the cautionary anti-pattern.
- **One-line `description:` frontmatter** on 45 workflow files across 14 sub-skills (Aphorisms, AudioEditor, Browser, Cloudflare, CreateAgentPack, CreateCLI, CreateSkill, CrunchScaffold, DepWatch, Documents, DOSUpgrade, Evals, Fabric, Parser) — each derived from the workflow body intent.

### Changed

- **Stale-path parameterization (UG8 / ISC-34, ISC-35).** Replaced hardcoded frozen-release and stale-doctrine paths with version-agnostic resolution so they no longer re-drift at each freeze. Affected files: `DOSUpgrade/Workflows/AlgorithmFlip.md`, `CreateSkill/Workflows/CreateSkill.md`, `CreateSkill/Workflows/CanonicalizeSkill.md`, `RfcToLoop/Tools/loop-template.md`. The frozen submodule paths now resolve through `$RELEASE_PATH` (from `jq -r '.dos.releasePath' ~/.claude/settings.json`) or the `Releases/<active-version>/.claude` placeholder; the hardcoded example Algorithm version files now use the workflow's own `<to>` placeholder.

### Fixed

- **Dead-tool reference (ISC-36).** `DOSUpgrade/Workflows/AlgorithmUpgrade.md` — the dead `RebuildDOS` build-tool reference (present only in frozen release snapshots) now points at `bun ~/Durante/Tools/dos-build.ts` (the live build tool).

### Preserved (anti-regression)

- **The `AlgorithmFlip.md` Algorithm-v0.0.1 §35 historical citation** was left untouched. It is the deliberate stable anchor for the "subagents never voice" rule (constant across all Algorithm versions), not a live resolution path. (ISC-38)
