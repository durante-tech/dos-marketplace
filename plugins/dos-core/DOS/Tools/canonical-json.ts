/**
 * canonical-json.ts — Deterministic JSON serialization for signing.
 *
 * Rules (per moat-relocation-2026-04-17.md §2.4):
 *   1. Object keys sorted lexicographically at every nesting level
 *   2. No whitespace (no indent, no space after : or ,)
 *   3. UTF-8 encoding (native to String)
 *   4. `null` preserved (not omitted)
 *   5. Integers only in v1 receipt schema (no floats)
 *
 * This is a minimal subset of RFC 8785 JSON Canonicalization Scheme —
 * adequate for signing our own payload shapes; not a general-purpose impl.
 */

export function canonicalize(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return '[' + value.map(canonicalize).join(',') + ']';
  }
  const keys = Object.keys(value as object).sort();
  return (
    '{' +
    keys
      .map(
        (k) =>
          JSON.stringify(k) + ':' + canonicalize((value as Record<string, unknown>)[k]),
      )
      .join(',') +
    '}'
  );
}
