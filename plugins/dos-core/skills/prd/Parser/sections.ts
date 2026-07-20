// @durante/prd Parser/sections.ts — NEW for V12.2
//
// vNext 9-section detection per RFC-0080 §2.1. v2.1 4-section detection
// preserved. Section ordering check + body extraction.

import type { Section } from './types.ts';

/**
 * The 9 vNext section names in canonical order (RFC-0080 §2.1).
 */
export const VNEXT_SECTION_ORDER: readonly string[] = [
  'Problem',
  'Goal',
  'Out of Scope',
  'Principles',
  'Health & Constraints',
  'Features',
  'Criteria',
  'Decisions',
  'Verification',
] as const;

/**
 * The 4 v2.1 legacy section names (preserved for back-compat).
 */
export const V2_SECTION_ORDER: readonly string[] = [
  'Context',
  'Criteria',
  'Decisions',
  'Verification',
] as const;

/**
 * Parse body sections from markdown content. Returns H2 sections with optional
 * H3 subsections. The frontmatter block (between leading `---` delimiters) is
 * stripped before section detection.
 *
 * Implementation note: the per-section content boundary uses lookahead for the
 * next `## ` heading OR end of document. This mirrors V12.0 prd-utils.ts's
 * countCriteria/parseCriteriaList regex pattern.
 */
export function parseSections(content: string): Section[] {
  // Strip ONLY a frontmatter block that is anchored at the document head.
  // A bare `indexOf('\n---\n')` also matches a markdown thematic-break (`---`)
  // mid-prose, which would silently discard every section before the rule when
  // a PRD has no YAML frontmatter. Head-anchor the match so a body HR can never
  // be mistaken for the frontmatter close.
  const fm = content.match(/^---\n[\s\S]*?\n---\n/);
  const body = fm ? content.slice(fm[0].length) : content;

  const sections: Section[] = [];
  const h2Matches = [...body.matchAll(/^## (.+)$/gm)];

  for (let i = 0; i < h2Matches.length; i++) {
    const match = h2Matches[i];
    const next = h2Matches[i + 1];
    const start = match.index! + match[0].length;
    const end = next ? next.index! : body.length;
    const heading = match[1].trim();
    const rawBody = body.slice(start, end).trim();

    const subMatches = [...rawBody.matchAll(/^### (.+)$/gm)];
    const subsections: Section[] = [];
    for (let j = 0; j < subMatches.length; j++) {
      const subMatch = subMatches[j];
      const subNext = subMatches[j + 1];
      const subStart = subMatch.index! + subMatch[0].length;
      const subEnd = subNext ? subNext.index! : rawBody.length;
      subsections.push({
        heading: subMatch[1].trim(),
        level: 3,
        body: rawBody.slice(subStart, subEnd).trim(),
      });
    }

    sections.push({
      heading,
      level: 2,
      body: rawBody,
      subsections: subsections.length > 0 ? subsections : undefined,
    });
  }

  return sections;
}

/**
 * Identify which expected order a section list conforms to.
 *
 * Returns `'vnext'` when all present sections appear in VNEXT_SECTION_ORDER,
 * `'v2'` when all present sections appear in V2_SECTION_ORDER, `'mixed'`
 * otherwise. Used as a body-shape SANITY check — NOT for format dispatch
 * (use detectFormatVersion for that per RFC-0081 §2.3).
 */
export function classifySectionOrder(sections: Section[]): 'vnext' | 'v2' | 'mixed' {
  const headings = sections.map(s => s.heading);
  const inVNext = headings.every(h => VNEXT_SECTION_ORDER.includes(h));
  const inV2 = headings.every(h => V2_SECTION_ORDER.includes(h));
  if (inVNext && !inV2) return 'vnext';
  if (inV2 && !inVNext) return 'v2';
  if (inVNext && inV2) return 'v2';
  return 'mixed';
}
