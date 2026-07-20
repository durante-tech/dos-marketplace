---
name: MigrateToVNext
description: Migrate a v2.1 PRD to vNext (format_version 3) per RFC-0080 §5.1 grammar
bestPath:
  - title: "Parse & Version Check"
    description: "Parse via parsePRDFile and confirm the PRD is v2.1, not already vNext."
  - title: "Stamp Migration"
    description: "Apply migrateV2toV3() to stamp format_version: 3 into frontmatter."
  - title: "Warning Echo"
    description: "Surface the migrate-v2-to-v3-partial warning verbatim to the operator."
  - title: "Frontmatter Finish"
    description: "Write content, add parent_rfc, and surface the orphan strategic-intent marker if needed."
---

# MigrateToVNext Workflow

## When to Use

- Trigger phrases: "migrate PRD to vnext", "migrate this old PRD"
- Situation: upgrading a legacy v2.1-format PRD's frontmatter to format_version 3
- NOT for a full body-level restructure — the §5.1 section-split grammar is deferred and NOT run today; this workflow only stamps `format_version: 3`

## Inputs

- `slug` (or `path`) — v2.1 PRD to migrate

## Current capability (read this first — ISC-31 / ISC-32 honesty)

**`migrateV2toV3()` stamps `format_version: 3` into frontmatter. That is all it does today.** It performs NO body-level section split. The §5.1 grammar below is the *deferred target*, documented for reference — it is **not** executed by this workflow. Do not tell the operator the PRD was restructured into the 9-section vNext shape; only the frontmatter version field changed.

## Procedure

1. Parse via `parsePRDFile()` from `@durante/prd`
2. Verify `detectFormatVersion()` returns `{ status: 'missing', version: 2 }` or `{ status: 'valid', version: 2 }` — fail if already vNext
3. Apply `migrateV2toV3()` from `@durante/prd/Migrate`. It returns `{ content, warnings }`.
4. **Echo every warning to the operator (ISC-31 — do NOT swallow it).** The current stub returns the `migrate-v2-to-v3-partial` warning; surface it verbatim, e.g.:
   > ⚠️ migrate-v2-to-v3-partial: stamped `format_version:3` only; body migration (`## Context` split, `## Constraints` rename) was NOT applied — deferred to the v0.0.13 sunset trigger (RFC-0080 §5.1).
5. Write the returned `content` back via Edit.
6. Add `parent_rfc:` frontmatter field (operator chooses RFC ID or `none`).
7. If orphan: surface `🪶 ORPHAN STRATEGIC INTENT:` marker in `## Goal` per §6.1 Named-Smell Policy.

## Deferred §5.1 body-split grammar (NOT run today — reference only)

When the body-split lands (behind the v0.0.13 sunset trigger), it will apply this grammar table:

- `## Context` prose → split: WHY-paragraphs → `## Problem`; goal statement → `## Goal`; constraints → `## Health & Constraints`
- `## Context > ### Risks` → `## Health & Constraints > ### Risks`
- `## Context > ### Plan` → `## Decisions > ### Plan`
- `## Context > ### Discovery-First` → `## Health & Constraints > ### Discovery-First`
- `## Context > ### Schema Pre-Flight` → `## Health & Constraints > ### Schema Pre-Flight`
- `## Context > ### Pre-Migration Constraints` → `## Health & Constraints > ### Pre-Migration Constraints`
- MEMORY HEALTH line-prefix `^📚 MEMORY HEALTH:` placement-agnostic (R38 handler verified header-agnostic)
- `## Criteria` → preserved verbatim (IDs preserved per §4 ID Stability)
- `## Decisions` → preserved verbatim
- `## Verification` → preserved verbatim

## Notes

V12.4: `migrateV2toV3()` is a deliberate **stamp-only** step (frontmatter `format_version: 3`), and it returns a partial-migration warning that this workflow now echoes (ISC-31) rather than swallows. The full body-level grammar above (ISC-32 / ISC-A-4) is **deferred behind the v0.0.13 sunset trigger** per RFC-0080 §5 — the workflow must never imply the split ran when only the frontmatter was stamped.
