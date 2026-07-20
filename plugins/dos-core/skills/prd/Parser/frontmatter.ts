// @durante/prd Parser/frontmatter.ts — Extract Module from V12.0 prd-utils.ts
//
// RFC-0081 §2.1. Moved per Extract Module + Move Method (catalog refactoring).
// Behavior is byte-identical to V12.0 prd-utils.ts — V12.0's 39 characterization
// tests (test/parser.test.ts) are the regression contract.

import yaml from 'yaml';
import type { Frontmatter } from './types.ts';

/**
 * Pre-process YAML frontmatter to tolerate unquoted special chars in scalar
 * values. Quotes scalar values containing YAML-breaking chars (unquoted colons,
 * `=>` arrows, etc.) but leaves list/array/object lines and already-quoted
 * values alone. Adapted from V12.0 prd-utils.ts; keeps the library dependency
 * surface to just `yaml`.
 */
function sanitizeYamlFrontmatter(raw: string): string {
  return raw
    .split('\n')
    .map((line) => {
      const m = line.match(/^(\s*\w[\w\s-]*?):\s+(.+)$/);
      if (!m) return line;
      const [, key, val] = m;
      const trimmed = val.trim();
      if (/^["'|>]/.test(trimmed)) return line;
      if (/^\[/.test(trimmed) || /^\{/.test(trimmed)) return line;
      if (/[=>{}[\]#]/.test(val) || (val.includes(':') && !val.startsWith('"'))) {
        const escaped = val.replace(/"/g, '\\"');
        return `${key}: "${escaped}"`;
      }
      return line;
    })
    .join('\n');
}

/**
 * Legacy line-based frontmatter parser preserved verbatim as a fallback for
 * malformed PRDs whose content predates RFC-0010 (content-inside-frontmatter,
 * markdown blocks between --- delimiters). Returns scalar-only key/value pairs
 * via `last-wins` semantics. Never throws.
 */
function legacyLineBasedParse(frontmatterBody: string): Record<string, string> {
  const fm: Record<string, string> = {};
  for (const line of frontmatterBody.split('\n')) {
    const idx = line.indexOf(':');
    if (idx > 0) fm[line.slice(0, idx).trim()] = line.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
  }
  return fm;
}

/**
 * Parse YAML frontmatter from markdown content into a key/value map.
 *
 * RFC-0010 Phase 0: YAML-list-aware. Scalar values return as strings; list
 * values return as `string[]`. Runtime behavior for scalar keys is identical
 * to the V12.0 prd-utils.ts version (confirmed via the V12.0 39-test
 * characterization suite).
 *
 * When yaml.parse fails (duplicate keys in strict mode, malformed content-
 * inside-frontmatter), the function falls back to the legacy line-based
 * parser so no in-flight PRD regresses. Fallback emits scalar-only output.
 *
 * @returns key/value map, or null when the `---` frontmatter block is absent.
 */
export function parseFrontmatter(content: string): Frontmatter | null {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;
  let parsed: unknown;
  try {
    parsed = yaml.parse(sanitizeYamlFrontmatter(match[1]), { uniqueKeys: false });
  } catch {
    return legacyLineBasedParse(match[1]);
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return legacyLineBasedParse(match[1]);
  }
  const fm: Frontmatter = {};
  for (const [key, raw] of Object.entries(parsed as Record<string, unknown>)) {
    if (raw === null || raw === undefined) continue;
    if (Array.isArray(raw)) {
      fm[key] = raw.map((item) => (item === null || item === undefined ? '' : String(item)));
    } else if (typeof raw === 'object') {
      fm[key] = JSON.stringify(raw);
    } else {
      fm[key] = String(raw);
    }
  }
  return fm;
}

/**
 * Narrow a frontmatter field to a scalar string. Returns undefined when the
 * field is absent OR is a list. Lets scalar-expecting consumers opt out of
 * the `string | string[]` union without casting.
 */
export function getScalarField(
  fm: Frontmatter | null | undefined,
  name: string,
): string | undefined {
  if (!fm) return undefined;
  const v = fm[name];
  return typeof v === 'string' ? v : undefined;
}

/**
 * Update a single SCALAR frontmatter field in markdown content. If the field
 * exists, its value is replaced in place. If absent, it's appended to the
 * frontmatter block before the closing `---`. Returns content unchanged when no
 * frontmatter block is present.
 *
 * Scalar-only precondition: a YAML block-list field (key line followed by
 * indented `  - item` rows) is NOT rewritten — replacing the key line with a
 * scalar would orphan the list items and emit invalid YAML. When the target
 * field is list-valued the function leaves the content unchanged rather than
 * corrupt it. Callers needing list semantics must parse → mutate → re-serialize.
 */
export function writeFrontmatterField(content: string, field: string, value: string): string {
  const fmMatch = content.match(/^(---\n)([\s\S]*?)(\n---)/);
  if (!fmMatch) return content;
  const lines = fmMatch[2].split('\n');
  let found = false;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith(`${field}:`)) {
      // Refuse to clobber a block-list field: if the next line is an indented
      // list item, the existing field is list-valued — rewriting the key line
      // as a scalar would orphan those items. Leave content untouched.
      if (/^\s+-\s/.test(lines[i + 1] ?? '')) return content;
      lines[i] = `${field}: ${value}`;
      found = true;
      break;
    }
  }
  if (!found) lines.push(`${field}: ${value}`);
  return fmMatch[1] + lines.join('\n') + fmMatch[3] + content.slice(fmMatch[0].length);
}
