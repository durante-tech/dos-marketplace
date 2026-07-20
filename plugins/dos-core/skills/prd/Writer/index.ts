// @durante/prd Writer — V12.4 writer surface (RFC-0081 §2.2; RFC-0083 PG3, ISC-27..30, ISC-A-3)
//
// appendDecision + appendVerification are now REAL: string-in / string-out,
// idempotent, and byte-surgical. Only the target section's slice is rewritten;
// every other section AND the YAML frontmatter are preserved verbatim. The
// Parser (`parseSections`) locates the section; raw-offset insertion does the
// edit so no other bytes move.
//
// writePRDStub is now REAL (ISC-A-3): it emits the deterministic vNext
// frontmatter scaffold (the eight Doctrine REQUIRED_FIELDS + format_version +
// parent_rfc) under an `# <title>` H1 and stops there. Scaffold still owns the
// sole-writer PROSE path per v0.0.8 §2 (the workflow IS the writer for body
// content), so the stub carries no `## ` body sections — born phase: observe,
// progress: 0/0, ready for the author to Edit in Criteria.

import { parseSections } from '../Parser/sections.ts';

export interface StubOptions {
  title: string;
  slug: string;
  effortLevel?: string;
  mode?: 'interactive' | 'loop';
  prompt?: string;
  sessionId?: string;
  formatVersion?: 2 | 3;
}

/**
 * Generate a vNext PRD stub (RFC-0083 PG3, ISC-A-3).
 *
 * Returns the full PRD.md content as a string: a frontmatter block carrying the
 * eight Doctrine REQUIRED_FIELDS (task, slug, effort, phase, progress, mode,
 * started, updated) plus `format_version` and `parent_rfc`, under an
 * `# <title>` H1. Born `phase: observe`, `progress: 0/0` — the author Edits
 * `## Criteria` during OBSERVE and reconciles the denominator before the phase
 * transitions (Scaffold.md step 6). No `## ` body sections are emitted: the
 * Scaffold workflow remains the sole writer of section prose (v0.0.8 §2), so the
 * stub supplies only the deterministic frontmatter scaffold + title.
 *
 * String-out and deterministic (modulo the started/updated timestamp), mirroring
 * appendDecision/appendVerification. `effortLevel` defaults to 'standard',
 * `mode` to 'interactive', `formatVersion` to 3 (pass 2 for a v2.1-tagged stub).
 */
export function writePRDStub(opts: StubOptions): string {
  const now = new Date().toISOString();
  const fields: ReadonlyArray<readonly [string, string]> = [
    ['task', opts.title],
    ['slug', opts.slug],
    ['effort', opts.effortLevel ?? 'standard'],
    ['phase', 'observe'],
    ['progress', '0/0'],
    ['mode', opts.mode ?? 'interactive'],
    ['started', now],
    ['updated', now],
    ['format_version', String(opts.formatVersion ?? 3)],
    ['parent_rfc', 'none'],
  ];
  const frontmatter = fields.map(([k, v]) => `${k}: ${v}`).join('\n');
  return `---\n${frontmatter}\n---\n\n# ${opts.title}\n`;
}

// ── internals ──────────────────────────────────────────────────────────────

const FRONTMATTER_RE = /^---\n[\s\S]*?\n---\n/;

/** Split a leading YAML frontmatter block off so it is never touched. */
function splitFrontmatter(content: string): { head: string; body: string } {
  const m = content.match(FRONTMATTER_RE);
  return m ? { head: m[0], body: content.slice(m[0].length) } : { head: '', body: content };
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Append `line` to the `## <heading>` section of a PRD body.
 *
 * - Idempotent on `probe`: if the section already contains `probe`, the body is
 *   returned unchanged (a no-op — same text is never double-added).
 * - Byte-surgical: only the target section slice is rewritten. Everything before
 *   the section heading and everything from the next `## ` heading onward is
 *   sliced through verbatim, so sibling sections never move.
 * - Absent-section creation: inserts a fresh `## <heading>` block before the
 *   first present `createBefore` anchor heading, or appends it at end of body.
 *
 * `parseSections` is consulted to confirm the section's presence and read its
 * trimmed body for the idempotency probe (honoring RFC-0083's "use the Parser
 * to locate the section"); the raw-offset regex performs the actual insertion.
 */
function appendLineToSection(
  body: string,
  heading: string,
  line: string,
  probe: string,
  createBefore: readonly string[],
): string {
  const parsed = parseSections(body);
  const existing = parsed.find(s => s.heading === heading);
  if (existing && existing.body.includes(probe)) {
    return body; // idempotent no-op
  }

  const headingRe = new RegExp(`^## ${escapeRegExp(heading)}[ \\t]*$`, 'm');
  const m = headingRe.exec(body);

  if (m) {
    const afterHeading = m.index + m[0].length;
    const rest = body.slice(afterHeading);
    const nextHeading = /^## .+$/m.exec(rest);
    const end = nextHeading ? afterHeading + nextHeading.index : body.length;
    const sectionBody = body.slice(afterHeading, end);
    if (sectionBody.includes(probe)) return body; // belt-and-suspenders idempotency
    const trimmed = sectionBody.replace(/\s+$/, '');
    const newSectionBody = trimmed ? `${trimmed}\n${line}\n\n` : `\n\n${line}\n\n`;
    return body.slice(0, afterHeading) + newSectionBody + body.slice(end);
  }

  // Section absent — create it.
  const block = `## ${heading}\n\n${line}\n`;
  for (const anchor of createBefore) {
    const anchorRe = new RegExp(`^## ${escapeRegExp(anchor)}[ \\t]*$`, 'm');
    const am = anchorRe.exec(body);
    if (am) {
      const headSlice = body.slice(0, am.index).replace(/\s+$/, '');
      const tail = body.slice(am.index);
      return `${headSlice}\n\n${block}\n${tail}`;
    }
  }
  const trimmed = body.replace(/\s+$/, '');
  return trimmed.length ? `${trimmed}\n\n${block}` : block;
}

/**
 * Append a timestamped decision line to `## Decisions` (ISC-27).
 *
 * Returns the PRD content with `- <ISO-8601>: <text>` appended to the Decisions
 * section. Idempotent on `text` (re-adding the same decision is a no-op). If
 * `## Decisions` is absent it is created before `## Verification`, or at end of
 * body when Verification is also absent. Other sections + frontmatter are
 * preserved verbatim.
 */
export function appendDecision(content: string, text: string): string {
  const { head, body } = splitFrontmatter(content);
  const line = `- ${new Date().toISOString()}: ${text}`;
  return head + appendLineToSection(body, 'Decisions', line, text, ['Verification']);
}

/**
 * Append an `ISC-N evidence` line to `## Verification` (ISC-28).
 *
 * Returns the PRD content with `- <iscId>: <evidence> — <ISO-8601>` appended to
 * the Verification section. Idempotent on `<iscId>: <evidence>` (re-adding the
 * same evidence for the same ISC is a no-op). `## Verification` is the terminal
 * section in both v2.1 and vNext order, so when absent it is appended at end of
 * body. Other sections + frontmatter are preserved verbatim.
 */
export function appendVerification(content: string, iscId: string, evidence: string): string {
  const { head, body } = splitFrontmatter(content);
  const probe = `${iscId}: ${evidence}`;
  const line = `- ${probe} — ${new Date().toISOString()}`;
  return head + appendLineToSection(body, 'Verification', line, probe, []);
}
