// @durante/prd Parser — public API
//
// RFC-0081 §2.2 — seven public exports (operator P2.2 — corrected from "six"
// after parsePRD split into File/Content variants):
//   parsePRDFile, parsePRDContent, writePRDStub, appendDecision,
//   appendVerification, detectFormatVersion, migrateV2toV3
//
// V12.2 ships parsePRDFile, parsePRDContent, detectFormatVersion. Writer +
// Migrate live in adjacent modules and are re-exported here.

import { readFileSync } from 'fs';
import { parseFrontmatter } from './frontmatter.ts';
import { parseCriteriaList } from './criteria.ts';
import { parseSections } from './sections.ts';
import { detectFormatVersion } from './version.ts';
import type { PRDDocument } from './types.ts';

// Re-export types
export type {
  Frontmatter,
  Criterion,
  Section,
  FeatureSlice,
  TestRow,
  FormatVersionDetection,
  PRDDocument,
} from './types.ts';

// Re-export low-level functions for back-compat shims
export { parseFrontmatter, getScalarField, writeFrontmatterField } from './frontmatter.ts';
export { parseCriteriaList, countCriteria } from './criteria.ts';
export { parseSections, classifySectionOrder, VNEXT_SECTION_ORDER, V2_SECTION_ORDER } from './sections.ts';
export { detectFormatVersion } from './version.ts';

/**
 * Parse a PRD from disk. Reads the file then dispatches to parsePRDContent.
 *
 * Distinguishable from parsePRDContent at the TypeScript type level (operator
 * P1.3 finding — the single-string parser shape was not a valid TypeScript
 * discriminator between path and content). RFC-0081 §2.2.
 */
export function parsePRDFile(path: string): PRDDocument {
  const content = readFileSync(path, 'utf-8');
  return parsePRDContent(content);
}

/**
 * V14.1 + V14.4 sunset gate (RFC-0080 §5 + RFC-0087 sunset date).
 *
 * When sunset is active, `parsePRDContent` throws `UnsupportedFormatVersion`
 * on v2.1 content. Dormant by default — flips on either of:
 *   1. `process.env.DOS_PRD_V14_1_SUNSET === '1'` (operator-controlled flag)
 *   2. RFC-0087 contains `Sunset-date: YYYY-MM-DD` AND today >= that date
 *
 * Operator workflow: fill RFC-0087 sunset date → status: accepted → bump
 * the env var on hosts as they migrate. Until then, dual-mode dispatch
 * continues per RFC-0081 §2.3. Failure-closed: invalid format_version values
 * throw regardless of sunset state.
 */
function v2SunsetActive(): { active: boolean; reason: string } {
  if (process.env.DOS_PRD_V14_1_SUNSET === '1') {
    return { active: true, reason: 'DOS_PRD_V14_1_SUNSET=1' };
  }
  // Optional file-based sunset (RFC-0087). Test-seam: skip when no fs access.
  try {
    // Lazy-imported to avoid an fs dep at module-load time when the env var
    // path is sufficient. The library is otherwise zero-fs in this hot path.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fs = require('fs') as typeof import('fs');
    const path = require('path') as typeof import('path');
    const home = process.env.HOME ?? '';
    const candidates = [
      process.env.DOS_RFC_0087_PATH,
      home && path.join(home, 'Durante', 'Plans', 'Specs', 'RFC-0087-format-v2-sunset-date.md'),
    ].filter((p): p is string => Boolean(p));
    for (const p of candidates) {
      if (!fs.existsSync(p)) continue;
      const content = fs.readFileSync(p, 'utf-8');
      const status = content.match(/^status:\s*(\S+)/m)?.[1];
      if (status !== 'accepted') return { active: false, reason: 'RFC-0087 not accepted' };
      const sunset = content.match(/^[Ss]unset[- ]?date:\s*(\d{4}-\d{2}-\d{2})$/m)?.[1];
      if (!sunset) return { active: false, reason: 'RFC-0087 has no sunset date' };
      const today = new Date().toISOString().slice(0, 10);
      if (today >= sunset) return { active: true, reason: `RFC-0087 sunset-date ${sunset} reached (today ${today})` };
      return { active: false, reason: `RFC-0087 sunset-date ${sunset} future` };
    }
  } catch {
    // No fs access (browser/sandbox) — treat as dormant. Env var is the only signal.
  }
  return { active: false, reason: 'sunset dormant' };
}

/**
 * Parse a PRD from an in-memory content string. Dual-mode: dispatches on
 * `format_version` per RFC-0080 §2.2 closed enum {2, 3}. NO body-shape
 * inference fallback (RFC-0081 §2.3 — sparse vNext PRDs without `## Features`
 * would misclassify under heuristic).
 *
 * Invalid `format_version` values throw — failure-closed per RFC-0081 §2.3.
 *
 * V14.1 + V14.4 sunset (RFC-0087): when sunset is active, `format_version: 2`
 * content also throws `UnsupportedFormatVersion`. Sunset is dormant by default;
 * see `v2SunsetActive()` above for activation conditions.
 */
export function parsePRDContent(content: string): PRDDocument {
  const version = detectFormatVersion(content);
  if (version.status === 'invalid') {
    throw new Error(`UnsupportedFormatVersion: format_version=${JSON.stringify(version.raw)} (closed enum {2, 3} per RFC-0080 §2.2)`);
  }
  if (version.version === 2) {
    const sunset = v2SunsetActive();
    if (sunset.active) {
      throw new Error(`UnsupportedFormatVersion: format_version=2 reads sunset per V14.1 (${sunset.reason}); migrate this PRD to vNext via Skill("prd", "MigrateToVNext") or list it in RFC-0088 residual archive`);
    }
  }
  const frontmatter = parseFrontmatter(content) ?? {};
  const sections = parseSections(content);
  const criteria = parseCriteriaList(content);
  return {
    formatVersion: version.version,
    frontmatter,
    sections,
    criteria,
    rawContent: content,
  };
}
