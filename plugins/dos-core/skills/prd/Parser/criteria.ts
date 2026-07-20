// @durante/prd Parser/criteria.ts — Extract Module from V12.0 prd-utils.ts
//
// RFC-0081 §2.1. Behavior is byte-identical to V12.0 prd-utils.ts.

import type { Criterion } from './types.ts';

/**
 * Count checked/total ISC lines in the `## Criteria` section.
 */
export function countCriteria(content: string): { checked: number; total: number } {
  const criteriaMatch = content.match(/## Criteria[ \t]*\r?\n([\s\S]*?)(?=\n## |\n---|$)/);
  if (!criteriaMatch) return { checked: 0, total: 0 };
  const lines = criteriaMatch[1].split('\n').filter(l => l.match(/^- \[[ x]\]/));
  const checked = lines.filter(l => l.startsWith('- [x]')).length;
  return { checked, total: lines.length };
}

/**
 * Parse the `## Criteria` section into typed Criterion entries.
 *
 * - `isAnti: true` when ID matches `ISC-A*` prefix (e.g. `ISC-A1`,
 *   `ISC-ANTI-1`, `ISC-A-2`) OR description LEADS with an explicit anti marker
 *   (`must not …`, `anti: …`). A bare negative word (`no`/`not`/`without`)
 *   anywhere in a positive criterion no longer flips it to anti-criterion.
 * - `status`: explicit `status=<value>` in description wins; otherwise derived
 *   from checkbox state.
 * - `verificationMethod`: extracted from backticked commands matching
 *   `test|lint|typecheck|verify` patterns; falls back to subjective with hint.
 * - `evidence`: extracted from trailing `Evidence: ...` text.
 */
export function parseCriteriaList(content: string): Criterion[] {
  const criteriaMatch = content.match(/## Criteria[ \t]*\r?\n([\s\S]*?)(?=\n## |\n---|$)/);
  if (!criteriaMatch) return [];
  return criteriaMatch[1].split('\n')
    .filter(l => l.match(/^- \[[ x]\]/))
    .flatMap<Criterion>((line, index) => {
      const checked = line.startsWith('- [x]');
      const textMatch = line.match(/^- \[[ x]\]\s*(ISC-[\w-]+):\s*(.*)/);
      if (!textMatch) return [];
      const id = textMatch[1];
      const description = textMatch[2].trim();
      const isAnti = /^ISC-A/i.test(id) || id.includes('-A-') || /^(must not\b|anti:)/i.test(description);
      const explicitStatus = description.match(/\bstatus=(pending|in_progress|completed|failed)\b/i)?.[1]?.toLowerCase();
      const evidence = description.match(/\bEvidence:\s*(.+)$/i)?.[1]?.trim();
      const command = description.match(/`([^`]*(?:test|lint|typecheck|verify)[^`]*)`/i)?.[1];
      return [{
        id,
        description,
        type: isAnti ? 'anti-criterion' as const : 'criterion' as const,
        status: (explicitStatus ?? (checked ? 'completed' : 'pending')) as Criterion['status'],
        priority: index === 0 ? 'critical' as const : 'important' as const,
        isAnti,
        verificationMethod: command
          ? { type: 'command' as const, command }
          : /\b(test|lint|typecheck|verify|spec)\b/i.test(description)
            ? { type: 'subjective' as const, hint: 'Verify via project test or lint evidence.' }
            : { type: 'subjective' as const, hint: 'Verify against the criterion description.' },
        evidence,
        createdInPhase: 'DEFINE',
        updatedInPhase: checked || explicitStatus ? 'VERIFY' : 'DEFINE',
      }];
    });
}
