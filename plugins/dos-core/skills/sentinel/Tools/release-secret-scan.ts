#!/usr/bin/env bun
/**
 * @pack Sentinel
 * @workflow release-gate
 *
 * F-023 — release-template secret + maintainer-local scrub gate.
 *
 * The shipped release template at `Releases/v{X}/.claude/settings.json`
 * MUST NOT contain credentials, localhost endpoints, or maintainer-only
 * absolute paths. Customer installs and `durante upgrade` start from this
 * file; anything that ships becomes baseline state on every machine.
 *
 * Patterns flagged:
 *   - `sk-` / `sk-studio-` prefixed keys (any 20+ chars after the dash)
 *   - `localhost:3000` (maintainer dev gateway URL)
 *   - maintainer-local absolute home paths
 *
 * Returns a list of offenders — `{ line: number, text: string, pattern: string }[]`.
 * Empty list = clean. Non-empty = scrub before shipping.
 *
 * Source: `Plans/Reports/DOS-Release-Package-Hooks-Audit-2026-05-03.md` / RPH-001
 * Issue: durante-tech/dos#23
 */

import { spawnSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { Glob } from "bun";
import {
  CONTAINMENT_ZONES,
  PATTERN_ALLOWLIST_FILES,
  IDENTITY_PATTERNS,
  isAllowlisted,
  matchesZone,
  scanForViolations,
} from "./containment-zones";

export interface Offender {
  line: number;
  text: string;
  pattern: string;
}

// Split the platform segment so the release scanner does not flag its own
// detector definition as the maintainer-home value it is meant to catch.
const MACOS_USERS_SEGMENT = "Users";
const MAINTAINER_HOME_PATH_RE = new RegExp(
  `\\/${MACOS_USERS_SEGMENT}\\/[REDACTED:operator-username]`,
);

export const FORBIDDEN_PATTERNS: Array<{ name: string; re: RegExp }> = [
  { name: "sk-prefixed-key", re: /\bsk-[A-Za-z0-9_-]{20,}/ },
  { name: "localhost-3000", re: /localhost:3000/ },
  { name: "maintainer-home-path", re: MAINTAINER_HOME_PATH_RE },
];

/**
 * P0 gate — credentials and dev endpoints fail the CLI gate. The
 * `maintainer-home-path` pattern is REPORTED but does not fail the gate
 * because under symlink mode `Releases/v{X}/.claude/settings.json` IS the
 * operator's live config — Claude Code does NOT expand `~/` or `$HOME` in
 * the env block, so literal paths are required there at runtime. Customer
 * install must template settings.json separately (durante install scaffold).
 *
 * Aligns CLI behavior with the test's longstanding P0_GATED_PATTERNS list.
 * Flip `maintainer-home-path` into this set once customer-install templating
 * lands and the operator's live config moves out of the shipped tree.
 */
export const P0_GATED_PATTERNS: ReadonlySet<string> = new Set([
  "sk-prefixed-key",
  "localhost-3000",
]);

/**
 * Files exempt from the critical-surface gate BY PATH. The F-023
 * credential-scrub incident PRD legitimately quotes the scrubbed key literal
 * for provenance. `scanCriticalReleaseSurfaces` deliberately does NOT consult
 * PATTERN_ALLOWLIST_FILES (critical surfaces are held to a stricter standard),
 * so this path exemption is applied by the gate helper below. Single source of
 * truth shared by the `--critical` CLI and the F-025 release-readiness test —
 * a second inline copy would let the gate and its test silently disagree.
 */
export const ALLOWED_CRITICAL_SURFACE_FILES: ReadonlySet<string> = new Set([
  "MEMORY/ARCHIVE/2026-05/20260503-150400_f-023-studio-credential-scrub/PRD.md",
]);

/**
 * The blessed critical-surface gate policy, applied IDENTICALLY by the
 * `--critical` CLI and the F-025 test:
 *   1. drop offenders in ALLOWED_CRITICAL_SURFACE_FILES (provenance quotes), then
 *   2. keep only offenders whose pattern is in P0_GATED_PATTERNS.
 * Non-P0 offenders (maintainer-home-path / operator-absolute-path) are
 * report-only — they are load-bearing runtime paths in shipped settings.json,
 * not leaks (see the P0_GATED_PATTERNS doc above). Returns the flat list of
 * GATING offenders; empty list ⇒ the gate passes.
 */
export function criticalSurfaceGateOffenders(
  results: TreeFileResult[],
): Array<{ filePath: string; line: number; pattern: string; text: string }> {
  return results
    .filter((r) => r.offenders.length > 0)
    .filter((r) => !ALLOWED_CRITICAL_SURFACE_FILES.has(r.filePath))
    .flatMap((r) =>
      r.offenders
        .filter((o) => P0_GATED_PATTERNS.has(o.pattern))
        .map((o) => ({
          filePath: r.filePath,
          line: o.line,
          pattern: o.pattern,
          text: o.text,
        })),
    );
}

export function scanReleaseSettings(absPath: string): Offender[] {
  const body = readFileSync(absPath, "utf-8");
  const lines = body.split("\n");
  const offenders: Offender[] = [];
  for (let i = 0; i < lines.length; i++) {
    const text = lines[i];
    for (const { name, re } of FORBIDDEN_PATTERNS) {
      if (re.test(text)) {
        offenders.push({ line: i + 1, text, pattern: name });
      }
    }
  }
  return offenders;
}

// ─── Zone-aware tree scan (RFC-0044 W-2.65) ─────────────────────────────

export interface TreeFileResult {
  filePath: string;        // repo-relative
  offenders: Offender[];
  skipped: 'zone' | 'allowlist' | null;
  zoneName?: string;       // populated when skipped === 'zone'
}

export const RELEASE_CRITICAL_SURFACE_PATTERNS = [
  'MEMORY/ARCHIVE/**',
  'MEMORY/CANONICAL/**',
  '.env',
  '.env.*',
  '**/.env',
  '**/.env.*',
  'Releases/**/MANIFEST*',
  'Releases/**/*.manifest.*',
  'Releases/**/settings.json',
  'npm-package/bin/**',
  'npm-package/scripts/**',
  'npm-package/package.json',
] as const;

const DEFAULT_GLOB_INCLUDE = ['**/*.ts', '**/*.md', '**/*.json', '**/*.sh', '**/*.py'];
const DEFAULT_GLOB_EXCLUDE = [
  '**/node_modules/**',
  '**/.git/**',
  '**/dist/**',
  '**/build/**',
  '**/.next/**',
  // Frozen release snapshots are immutable history already on the remote; scanning
  // them on every push is noise, and the MAX_AUTO_CANDIDATES cap made any coverage
  // of them alphabetical-boundary luck anyway (2026-07-11: a Packs/ import shifted
  // the 5000-file cutoff into Releases/v0.0.1 demo fixtures and false-blocked every
  // producer's push). Live-release edits are guarded separately (validate-protected).
  'Releases/**',
];
const MAX_AUTO_CANDIDATES = 5000;

const SCANNABLE_EXT_RE = /\.(ts|md|json|sh|py)$/;

/**
 * Discover TRACKED candidate files via `git ls-files` (PRD-A ISC-3,
 * 2026-05-13 default-scope-flip). Untracked files are excluded unless the
 * caller opts in via `--include-untracked`. Previously, this function
 * globbed the whole working tree which surfaced operator-side untracked
 * content (stale `testing.txt`-class files containing example API keys)
 * and false-blocked commits whose actual diff was clean.
 *
 * Returns repo-relative paths filtered to SCANNABLE_EXT_RE.
 */
export function discoverTrackedCandidates(repoRoot: string): string[] {
  const out: string[] = [];
  for (const f of discoverTrackedFiles(repoRoot)) {
    const rel = f.replace(/\\/g, '/');
    if (DEFAULT_GLOB_EXCLUDE.some((ex) => matchExclude(ex, rel))) continue;
    if (!SCANNABLE_EXT_RE.test(rel)) continue;
    out.push(rel);
    if (out.length >= MAX_AUTO_CANDIDATES) {
      console.error(
        `[release-secret-scan] tracked-discovery hit MAX_AUTO_CANDIDATES=${MAX_AUTO_CANDIDATES}; tighten --tree scope.`,
      );
      return out;
    }
  }
  return out;
}

/**
 * FULL-TREE discovery via Glob — includes untracked files. Used only when
 * the caller explicitly passes `--include-untracked` (or for back-compat
 * via the lower-level discoverCandidates symbol).
 *
 * Bounded by MAX_AUTO_CANDIDATES; warns when threshold hit.
 */
export async function discoverCandidates(repoRoot: string): Promise<string[]> {
  const out: string[] = [];
  for (const pattern of DEFAULT_GLOB_INCLUDE) {
    const glob = new Glob(pattern);
    for await (const file of glob.scan({ cwd: repoRoot })) {
      const rel = file.replace(/\\/g, '/');
      if (DEFAULT_GLOB_EXCLUDE.some((ex) => matchExclude(ex, rel))) continue;
      out.push(rel);
      if (out.length >= MAX_AUTO_CANDIDATES) {
        console.error(
          `[release-secret-scan] auto-discovery hit MAX_AUTO_CANDIDATES=${MAX_AUTO_CANDIDATES}; tighten --tree scope.`,
        );
        return out;
      }
    }
  }
  return out;
}

function matchExclude(pattern: string, path: string): boolean {
  // minimal ** matcher for our excludes
  const re = new RegExp(
    '^' +
      pattern
        .split('**')
        .map((seg) => seg.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*'))
        .join('.*') +
      '$',
  );
  return re.test(path);
}

/**
 * Zone-aware tree scan. For each candidate file (auto-discovered if not
 * supplied):
 *   - matchesZone() → skipped:'zone' (private content allowed in zone)
 *   - isAllowlisted() → skipped:'allowlist' (legitimate exception)
 *   - else: scanForViolations() with IDENTITY_PATTERNS (the canonical SoT set)
 *
 * Returns one TreeFileResult per candidate. Files with skipped !== null
 * are documentation that the file was considered and exempted.
 *
 * PRD-A ISC-3 (2026-05-13): when `candidates` is not supplied, the default
 * discovery uses `git ls-files` (tracked-only). Pass `includeUntracked: true`
 * to fall back to the legacy full-tree glob walk (for nightly/CI sweeps).
 */
export async function scanTreeWithZones(
  repoRoot: string,
  candidates?: string[],
  opts: { includeUntracked?: boolean } = {},
): Promise<TreeFileResult[]> {
  const files = candidates ?? (
    opts.includeUntracked
      ? await discoverCandidates(repoRoot)
      : discoverTrackedCandidates(repoRoot)
  );
  const results: TreeFileResult[] = [];
  for (const rel of files) {
    const z = matchesZone(rel, CONTAINMENT_ZONES);
    if (z) {
      results.push({ filePath: rel, offenders: [], skipped: 'zone', zoneName: z.name });
      continue;
    }
    if (isAllowlisted(rel, PATTERN_ALLOWLIST_FILES)) {
      results.push({ filePath: rel, offenders: [], skipped: 'allowlist' });
      continue;
    }
    const abs = join(repoRoot, rel);
    let body: string;
    try {
      const s = statSync(abs);
      if (!s.isFile()) continue;
      body = readFileSync(abs, 'utf-8');
    } catch {
      continue;
    }
    const violations = scanForViolations(body, IDENTITY_PATTERNS);
    const offenders: Offender[] = violations.map((v) => ({
      line: v.lineNumber,
      text: v.matchedText,
      pattern: v.pattern,
    }));
    results.push({ filePath: rel, offenders, skipped: null });
  }
  return results;
}

export function isReleaseCriticalSurface(filePath: string): boolean {
  const rel = filePath.replace(/\\/g, '/').replace(/^\.\//, '');
  if (rel.startsWith('MEMORY/ARCHIVE/')) return true;
  if (rel.startsWith('MEMORY/CANONICAL/')) return true;
  if (/^(.+\/)?\.env(\..+)?$/.test(rel)) return true;
  if (/^Releases\/.+\/MANIFEST[^/]*$/i.test(rel)) return true;
  if (/^Releases\/.+\/[^/]*\.manifest\.[^/]+$/i.test(rel)) return true;
  if (/^Releases\/.+\/settings\.json$/i.test(rel)) return true;
  if (rel.startsWith('npm-package/bin/')) return true;
  if (rel.startsWith('npm-package/scripts/')) return true;
  if (rel === 'npm-package/package.json') return true;
  return false;
}

export function discoverTrackedFiles(repoRoot: string): string[] {
  const result = spawnSync('git', ['ls-files'], {
    cwd: repoRoot,
    encoding: 'utf-8',
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.error || result.status !== 0 || typeof result.stdout !== 'string') {
    return [];
  }
  return result.stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

const ARCHIVE_SECRET_PATTERN_NAMES = new Set(['api-token-sk', 'bearer-token']);

function identityPatternsForCriticalSurface(filePath: string) {
  const rel = filePath.replace(/\\/g, '/').replace(/^\.\//, '');
  if (rel.startsWith('MEMORY/ARCHIVE/')) {
    return IDENTITY_PATTERNS.filter((p) => ARCHIVE_SECRET_PATTERN_NAMES.has(p.name));
  }
  return IDENTITY_PATTERNS;
}

function forbiddenPatternsForCriticalSurface(filePath: string) {
  const rel = filePath.replace(/\\/g, '/').replace(/^\.\//, '');
  if (rel.startsWith('MEMORY/ARCHIVE/')) {
    return FORBIDDEN_PATTERNS.filter((p) => p.name === 'sk-prefixed-key');
  }
  return FORBIDDEN_PATTERNS;
}

function isCredentialPlaceholder(value: string): boolean {
  return /YOUR[_-]?KEY[_-]?HERE|REDACTED|<[^>]*KEY[^>]*>/i.test(value);
}

/**
 * Release-blocking scanner for surfaces that must be sanitized even when
 * they live inside an otherwise-private containment zone. This deliberately
 * overrides the MEMORY/ARCHIVE zone skip: committed canonical archives are
 * allowed only after sanitization.
 */
export async function scanCriticalReleaseSurfaces(
  repoRoot: string,
  candidates?: string[],
): Promise<TreeFileResult[]> {
  const files = (candidates ?? discoverTrackedFiles(repoRoot)).filter(
    isReleaseCriticalSurface,
  );
  const results: TreeFileResult[] = [];

  for (const rel of files) {
    // NOTE: Unlike scanTreeWithZones, this scanner does NOT consult
    // PATTERN_ALLOWLIST_FILES. Critical surfaces (release-shippable
    // bytes) are held to a stricter standard — even a file the general
    // allowlist would skip is scanned here, because shipping its
    // patterns publicly is the load-bearing concern. Callers that need
    // to exempt a specific critical-surface file (e.g., the F-023
    // credential-scrub PRD that legitimately quotes the leaked key for
    // provenance) MUST filter the returned offenders by file path
    // themselves. See Tools/release-readiness.test.ts F-025 for the
    // canonical post-filter pattern.

    const abs = join(repoRoot, rel);
    let body: string;
    try {
      const s = statSync(abs);
      if (!s.isFile()) continue;
      body = readFileSync(abs, 'utf-8');
    } catch {
      continue;
    }

    const offenders: Offender[] = [];
    for (const violation of scanForViolations(
      body,
      identityPatternsForCriticalSurface(rel),
    )) {
      if (isCredentialPlaceholder(violation.matchedText)) continue;
      offenders.push({
        line: violation.lineNumber,
        text: violation.matchedText,
        pattern: violation.pattern,
      });
    }

    const lines = body.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const text = lines[i];
      for (const { name, re } of forbiddenPatternsForCriticalSurface(rel)) {
        if (re.test(text)) {
          if (isCredentialPlaceholder(text)) continue;
          const alreadyReported = offenders.some(
            (o) => o.line === i + 1 && o.pattern === name,
          );
          if (!alreadyReported) {
            offenders.push({ line: i + 1, text, pattern: name });
          }
        }
      }
    }

    results.push({ filePath: rel, offenders, skipped: null });
  }

  return results;
}

// ─── CLI ─────────────────────────────────────────────────────────────────

if (import.meta.main) {
  const argv = process.argv.slice(2);
  if (argv[0] === '--critical') {
    const repoRoot = argv[1];
    if (!repoRoot) {
      console.error('usage: bun release-secret-scan.ts --critical <repo-root>');
      process.exit(2);
    }
    const results = await scanCriticalReleaseSurfaces(repoRoot);
    // Apply the blessed gate policy (shared with the F-025 test via
    // criticalSurfaceGateOffenders): exempt provenance-quote files, then gate
    // ONLY on P0 patterns. Non-P0 offenders (maintainer-home-path /
    // operator-absolute-path) are reported as non-gating — they are required
    // runtime paths in shipped settings.json, not leaks.
    const gating = criticalSurfaceGateOffenders(results);
    const nonGating = results
      .filter((r) => r.offenders.length > 0)
      .flatMap((r) =>
        r.offenders
          .filter(
            (o) =>
              ALLOWED_CRITICAL_SURFACE_FILES.has(r.filePath) ||
              !P0_GATED_PATTERNS.has(o.pattern),
          )
          .map((o) => `  ${r.filePath}:${o.line} [${o.pattern}] (non-gating) ${o.text.slice(0, 80)}`),
      );
    if (gating.length === 0) {
      console.log(
        `OK ${repoRoot} — 0 P0 critical-surface offenders | ${nonGating.length} non-gating reports | ${results.length} files scanned`,
      );
      for (const line of nonGating.slice(0, 50)) console.log(line);
      process.exit(0);
    }
    console.error(
      `FAIL ${repoRoot} — ${gating.length} P0 critical-surface offenders | ${nonGating.length} non-gating reports`,
    );
    for (const o of gating.slice(0, 50)) {
      console.error(`  ${o.filePath}:${o.line} [${o.pattern}] ${o.text.slice(0, 80)}`);
    }
    if (gating.length > 50) {
      console.error(`  ... +${gating.length - 50} more P0 offenders`);
    }
    process.exit(1);
  }

  if (argv[0] === '--tree') {
    const repoRoot = argv[1];
    if (!repoRoot) {
      console.error('usage: bun release-secret-scan.ts --tree <repo-root> [--include-untracked]');
      process.exit(2);
    }
    // PRD-A ISC-3 (2026-05-13): tracked-only by default. --include-untracked
    // re-introduces the legacy full-tree walk (untracked content + tracked).
    const includeUntracked = argv.includes('--include-untracked');
    const results = await scanTreeWithZones(repoRoot, undefined, { includeUntracked });
    const offendingFiles = results.filter((r) => r.offenders.length > 0);
    const zoneSkips = results.filter((r) => r.skipped === 'zone').length;
    const allowSkips = results.filter((r) => r.skipped === 'allowlist').length;
    const totalOff = offendingFiles.reduce((n, r) => n + r.offenders.length, 0);
    const scopeLabel = includeUntracked ? '(includes untracked)' : '(tracked-only)';
    if (offendingFiles.length === 0) {
      console.log(
        `OK ${repoRoot} — 0 offenders | ${results.length} files scanned ${scopeLabel} | ${zoneSkips} zone-skips | ${allowSkips} allow-skips`,
      );
      process.exit(0);
    }
    console.error(
      `FAIL ${repoRoot} — ${totalOff} offenders across ${offendingFiles.length} files ${scopeLabel} (${zoneSkips} zone-skips | ${allowSkips} allow-skips)`,
    );
    for (const r of offendingFiles.slice(0, 50)) {
      for (const o of r.offenders) {
        console.error(`  ${r.filePath}:${o.line} [${o.pattern}] ${o.text.slice(0, 80)}`);
      }
    }
    if (offendingFiles.length > 50) {
      console.error(`  ... +${offendingFiles.length - 50} more files with offenders`);
    }
    process.exit(1);
  }

  // legacy single-file mode (unchanged)
  const target = argv[0];
  if (!target) {
    console.error(
      'usage:\n  bun release-secret-scan.ts <path-to-shipped-settings.json>\n  bun release-secret-scan.ts --tree <repo-root> [--include-untracked]\n  bun release-secret-scan.ts --critical <repo-root>\n\n--tree default scope: tracked files only (git ls-files filtered to .ts|.md|.json|.sh|.py)\n--include-untracked: also walk untracked content (nightly/CI sweeps)',
    );
    process.exit(2);
  }
  const offenders = scanReleaseSettings(target);
  const p0Offenders = offenders.filter((o) => P0_GATED_PATTERNS.has(o.pattern));
  const nonP0Offenders = offenders.filter((o) => !P0_GATED_PATTERNS.has(o.pattern));
  if (offenders.length === 0) {
    console.log(`OK ${target} — 0 offenders`);
    process.exit(0);
  }
  if (p0Offenders.length === 0) {
    console.log(
      `OK ${target} — 0 P0 offenders | ${nonP0Offenders.length} non-gating reports`,
    );
    for (const o of nonP0Offenders) {
      console.log(`  L${o.line} [${o.pattern}] ${o.text.trim()}`);
    }
    process.exit(0);
  }
  console.error(
    `FAIL ${target} — ${p0Offenders.length} P0 offenders | ${nonP0Offenders.length} non-gating reports`,
  );
  for (const o of p0Offenders) {
    console.error(`  L${o.line} [${o.pattern}] ${o.text.trim()}`);
  }
  for (const o of nonP0Offenders) {
    console.error(`  L${o.line} [${o.pattern}] (non-gating) ${o.text.trim()}`);
  }
  process.exit(1);
}

// quiet-unused suppression for relative (helper retained for future use)
void relative;
