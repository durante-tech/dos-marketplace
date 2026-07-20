#!/usr/bin/env bun
/**
 * Glob → RegExp helper. Shared across DOS pattern-matching surfaces:
 *   - Tools/sync-check.ts (ant-style ** + basename *)
 *   - Tools/validate-protected.ts (single-* required-char variant)
 *   - Tools/dos-pack-doctor.ts expandPartialGlob (flat-namespace single-*)
 *
 * Consolidates 3+ hand-rolled glob-to-regex implementations that drifted in
 * subtle ways (single-* matching 0+ vs 1+ chars; ** support; sentinel
 * protection style). Surfaces those variants as explicit options.
 *
 * Mirrored to the active submodule at `Releases/v0.0.11/.claude/hooks/lib/glob.ts` for
 * SecurityValidator import. Sync-check `aliases[]` enforces byte-identical
 * across the parent canonical and the submodule mirror.
 */

export interface GlobToRegexOpts {
  /**
   * When true (default), `**` matches any characters including `/`. When
   * false, `**` is treated literally — pattern must use `*` only.
   */
  doubleStarSupport?: boolean;
  /**
   * When true, `*` matches 1+ characters (validate-protected style — every
   * `*` segment must non-empty). When false (default), `*` matches 0+
   * characters (sync-check / dos-pack-doctor / SecurityValidator style).
   */
  singleStarRequiresChar?: boolean;
}

const SENTINEL_DOUBLE = "\x00GLOB_DOUBLE_STAR\x00";
const REGEX_METACHARS = /[.+?^${}()|[\]\\]/g;

/**
 * Compile a shell-style glob to an anchored RegExp (`^pattern$`).
 *
 * Handles:
 *   - `**` → `.*` (only when doubleStarSupport, default true)
 *   - `*`  → `[^/]*` (or `[^/]+` when singleStarRequiresChar)
 *   - All other regex metacharacters escaped
 *
 * Sentinel-protects `**` before single-`*` substitution to avoid the
 * "single-star eats double-star" bug that bit early sync-check versions.
 */
export function globToRegex(pattern: string, opts: GlobToRegexOpts = {}): RegExp {
  const doubleStar = opts.doubleStarSupport !== false;
  const singleStarPattern = opts.singleStarRequiresChar ? "[^/]+" : "[^/]*";

  let body: string;
  if (doubleStar) {
    body = pattern
      .replace(/\*\*/g, SENTINEL_DOUBLE)
      .replace(REGEX_METACHARS, "\\$&")
      .replace(/\*/g, singleStarPattern)
      .replaceAll(SENTINEL_DOUBLE, ".*");
  } else {
    body = pattern
      .replace(REGEX_METACHARS, "\\$&")
      .replace(/\*/g, singleStarPattern);
  }
  return new RegExp(`^${body}$`);
}

/**
 * Test whether a path matches any of the provided glob patterns. Mirrors
 * the existing sync-check `matchesAny` behavior including the directory-
 * prefix shortcut for trailing `/**` patterns.
 */
export function matchesAnyGlob(
  relPath: string,
  patterns: readonly string[],
  opts?: GlobToRegexOpts,
): boolean {
  for (const p of patterns) {
    if (globToRegex(p, opts).test(relPath)) return true;
    // sync-check shortcut: a `Foo/**` pattern also matches the literal `Foo`
    // directory (without a trailing slash) so callers can declare directory
    // patterns once and have them cover both forms. Require a path-boundary
    // at the prefix so `Foo/**` does NOT spuriously match sibling names like
    // `Foobar` or `FooBar/x` (tools-sync-009) — only the exact `Foo` dir or
    // descendants `Foo/...` qualify.
    if (p.endsWith("/**")) {
      const prefix = p.slice(0, -3);
      if (relPath === prefix || relPath.startsWith(prefix + "/")) return true;
    }
  }
  return false;
}
