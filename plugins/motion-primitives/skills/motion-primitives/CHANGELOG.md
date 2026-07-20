# Changelog — MotionPrimitives

## v1.0.0

Canonicalized the imported `motion-primitives` native skill into a DOS pack (2026-06-09).

- Created the 4-file pack-distribution contract (plugin.json + INSTALL.md + README.md + VERIFY.md).
- Added RFC-0002 `src/extension.yaml` manifest (zero-bridge, advisor role, MIT provenance block).
- Canonicalized `src/SKILL.md`: TitleCase name, full frontmatter (role / accepts / visibility / roots), voice notification block, `## Customization`, `## Examples` (3 patterns), Status line.
- Preserved the upstream `reference/` mirror byte-intact (207 files, 33 components, MIT attribution).
- Registered the `pack:MotionPrimitives` pair in `.dos-sync-manifest.json` for three-leg sync coverage.
- Added `reference/CATALOG.json` (115KB) — structured per-component knowledge layer (props, shadcn/@kit pairing, migration-use, adapt-notes, reduced-motion guard) distilled from the 33 docs, for design-system migration workflows.
- Added `Workflows/deep-ui-audit.workflow.js` — RFC-0121 distributable 4-lens design-system migration AUDIT engine (Tailwind→kit · tokens · motion · a11y), 4/4 acceptance ACCEPT, installed to `~/.claude/workflows/`. Companion gated-loop doc `Workflows/DEEP-UI-MIGRATE.md`. First run: altyaa-turbo coach/facebook-page subtree (67 findings → batched migration, 8 files, typecheck-clean).
