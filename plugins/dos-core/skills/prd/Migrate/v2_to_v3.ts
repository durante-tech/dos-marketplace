// @durante/prd Migrate — V12.2 minimal API surface
//
// RFC-0081 §2.2 migration contract. V12.2 ships the function signature; full
// implementation per RFC-0080 §5.1 migration grammar table lands when V12.4
// Skills/PRD scaffolds the `migrate-to-vnext` workflow.

import { writeFrontmatterField } from '../Parser/frontmatter.ts';

export interface MigrationWarning {
  code: string;
  message: string;
  line?: number;
}

/**
 * Migrate a v2.1 PRD to vNext (format_version: 3). V12.2 minimal: stamps
 * `format_version: 3` into frontmatter and warns that body-level migration
 * (section split per RFC-0080 §5.1 grammar) is V12.4 scope.
 *
 * Full grammar:
 * - `## Context` prose → split per §5.1 (WHY → `## Problem`; goal → `## Goal`;
 *   constraints → `## Health & Constraints`)
 * - `## Context > ### Risks` → `## Health & Constraints > ### Risks`
 * - etc.
 *
 * Bulk migration tool deferred to v0.0.13 per RFC-0080 §5 sunset trigger.
 */
export function migrateV2toV3(content: string): { content: string; warnings: MigrationWarning[] } {
  const stamped = writeFrontmatterField(content, 'format_version', '3');
  return {
    content: stamped,
    warnings: [{
      code: 'migrate-v2-to-v3-partial',
      message: 'V12.2 stamps format_version:3 only; full body migration (## Context split, ## Constraints rename) lands in V12.4 Skills/PRD migrate-to-vnext workflow per RFC-0080 §5.1.',
    }],
  };
}
