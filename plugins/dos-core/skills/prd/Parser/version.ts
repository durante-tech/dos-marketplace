// @durante/prd Parser/version.ts — NEW for V12.2
//
// RFC-0080 §2.2 closed-enum format_version dispatch.
// RFC-0081 §2.3 — NO body-shape inference fallback (sparse vNext PRDs without
// `## Features` would misclassify under the prior heuristic).

import { parseFrontmatter, getScalarField } from './frontmatter.ts';
import type { FormatVersionDetection } from './types.ts';

/**
 * Detect the PRD's format version from frontmatter.
 *
 * Per RFC-0080 §2.2:
 * - `format_version: 3` → `{ status: 'valid', version: 3, raw: '3' }`
 * - `format_version: 2` → `{ status: 'valid', version: 2, raw: '2' }`
 * - missing field → `{ status: 'missing', version: 2 }` (legacy default)
 * - any other value (`1`, `4`, garbage) → `{ status: 'invalid', raw }`
 *
 * Invalid values are NOT collapsed to v2 — callers fail closed with `raw`
 * in evidence (RFC-0081 §2.3 + ISC-4a).
 */
export function detectFormatVersion(content: string): FormatVersionDetection {
  const fm = parseFrontmatter(content);
  if (!fm) return { status: 'missing', version: 2 };
  const raw = getScalarField(fm, 'format_version');
  if (raw === undefined) return { status: 'missing', version: 2 };
  if (raw === '2') return { status: 'valid', version: 2, raw: '2' };
  if (raw === '3') return { status: 'valid', version: 3, raw: '3' };
  return { status: 'invalid', raw };
}
