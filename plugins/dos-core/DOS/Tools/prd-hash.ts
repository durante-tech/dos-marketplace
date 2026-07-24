/**
 * prd-hash.ts — Deterministic hash of a PRD.md body.
 *
 * Goal: stable sha256 across editor save-normalization and signing idempotence.
 *
 * Rules (per moat-relocation-2026-04-17.md §2.5):
 *   1. Read as UTF-8 (caller responsibility — we take a string)
 *   2. Normalize CRLF/CR to LF
 *   3. Strip trailing whitespace from every line
 *   4. Ensure exactly one trailing LF
 *   5. Strip any existing receipt_signature / receipt_key_id / receipt_previous_sha
 *      lines from frontmatter (so re-signing an already-signed PRD yields the
 *      same hash it produced the first time)
 *   6. sha256 → hex lowercase
 */

import { createHash } from 'node:crypto';

export const RECEIPT_FRONTMATTER_KEYS = [
  'receipt_signature',
  'receipt_key_id',
  'receipt_previous_sha',
  'receipt_sha256',
  'receipt_prd_sha256',
];

export function normalizePrd(content: string): string {
  // 1. LF normalization
  let out = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // 2. Strip receipt_* lines ONLY if they appear inside frontmatter fence.
  //    Frontmatter = everything between the first two '---' lines.
  const lines = out.split('\n');
  let inFrontmatter = false;
  let frontmatterEnded = false;
  const filtered: string[] = [];
  for (const line of lines) {
    if (!frontmatterEnded) {
      if (line.trim() === '---') {
        if (!inFrontmatter) {
          inFrontmatter = true;
          filtered.push(line);
          continue;
        } else {
          frontmatterEnded = true;
          inFrontmatter = false;
          filtered.push(line);
          continue;
        }
      }
      if (inFrontmatter) {
        const colonIdx = line.indexOf(':');
        if (colonIdx > 0) {
          const key = line.slice(0, colonIdx).trim();
          if (RECEIPT_FRONTMATTER_KEYS.includes(key)) continue;
        }
      }
    }
    filtered.push(line);
  }
  out = filtered.join('\n');

  // 3. Strip trailing whitespace per line
  out = out
    .split('\n')
    .map((l) => l.replace(/[ \t]+$/, ''))
    .join('\n');

  // 4. Ensure exactly one trailing LF
  out = out.replace(/\n+$/, '') + '\n';

  return out;
}

export function hashPrd(content: string): string {
  return createHash('sha256').update(normalizePrd(content), 'utf8').digest('hex');
}
