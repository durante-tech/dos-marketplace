/**
 * project-context.ts — resolve the active project slug for DOS sync, and gate
 * cross-tenant filesystem paths at the producer.
 *
 * Two surfaces:
 *
 *   1. resolveProjectSlug() — reads .dos-projects.json (canonical registry
 *      with Studio slug IDs) and matches the current working directory
 *      against each project's root_path. Longest prefix wins. Returns null
 *      when no match. Module-level cached. Studio's auth-bearer resolves
 *      slug → UUID at ingest time.
 *
 *   2. isDosTenantPath(absPath) — RFC-0062 F3 producer-side cross-tenant
 *      guard. Returns true iff `absPath` resolves under a known DOS tenant
 *      tree: any `.dos-projects.json` `root_path`, or one of the hardcoded
 *      install/meta-repo allowlist entries (~/.claude, ~/Durante). False
 *      means the path is foreign — Save*ToStudio producers must NOT enqueue
 *      envelopes that reference foreign trees, since downstream Studio rows
 *      would land on the wrong tenant.
 *
 * Both surfaces share one local registry loader (no network, no Studio
 * round-trip). The loader resolves the registry along the RFC-0168 D1 chain:
 *   0. $DOS_PROJECTS_REGISTRY                          (env override — test seam)
 *   1. $DOS_DIR|~/.claude /DOS/projects/registry.json  (install-class canonical)
 *   2. ~/Durante/Tools/.dos-projects.json              (maintainer legacy)
 *   3. ~/Durante/.dos-projects.json                    (legacy fallback root)
 *
 * Cache is module-level (one read per process). Thread-safe for single-
 * threaded Bun execution; no locking needed.
 *
 * Cross-references:
 *   PRD MEMORY/WORK/20260505-154846_f3-cross-tenant-producer-guard/PRD.md
 *   RFC-0062 §9 R-DLQ-6-cross-tenant-isolation
 *   D-2026-05-05-1 (default block) / D-2026-05-05-2 (allowlist)
 */

import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

interface DosProjectEntry {
  id: string;           // slug — e.g. "durante", "donne"
  name: string;
  wing: string | null;
  root_path: string | null;
  description?: string;
}

interface DosProjectsFile {
  projects: DosProjectEntry[];
}

// Module-level caches — populated on first call. `undefined` means
// "not yet computed"; `null` is a valid resolved value (no match).
let _cachedSlug: string | null | undefined = undefined;
let _cachedRoots: string[] | undefined = undefined;

function expandTilde(p: string): string {
  if (p === '~') return homedir();
  if (p.startsWith('~/')) return join(homedir(), p.slice(2));
  return p;
}

/**
 * Resolve the canonical .dos-projects.json file path. Honors the operator
 * override env var DOS_PROJECTS_REGISTRY (test seam) when set, otherwise
 * walks the documented fallback chain.
 */
function registryPathCandidates(): string[] {
  const override = process.env.DOS_PROJECTS_REGISTRY;
  if (override && override.length > 0) return [override];
  const home = homedir();
  // Install-class canonical home first (RFC-0168 D1): ships with ~/.claude so
  // fork-day machines can register without the maintainer's ~/Durante monorepo.
  // DOS_DIR honors relocated installs (same seam the hook config uses).
  const dosRoot = process.env.DOS_DIR && process.env.DOS_DIR.length > 0
    ? process.env.DOS_DIR
    : join(home, '.claude');
  return [
    join(dosRoot, 'DOS', 'projects', 'registry.json'),
    join(home, 'Durante', 'Tools', '.dos-projects.json'),
    join(home, 'Durante', '.dos-projects.json'),
  ];
}

function loadRegistry(): DosProjectEntry[] {
  for (const candidate of registryPathCandidates()) {
    if (!existsSync(candidate)) continue;
    try {
      const raw = readFileSync(candidate, 'utf-8');
      const parsed = JSON.parse(raw) as DosProjectsFile;
      if (Array.isArray(parsed?.projects)) return parsed.projects;
    } catch {
      // fall through to next candidate
    }
  }
  return [];
}

/**
 * Resolve the active project slug from CLAUDE_PROJECT_DIR or process.cwd().
 *
 * Returns the `id` field from .dos-projects.json (e.g. "durante") or null
 * when the working directory does not match any registered project root.
 *
 * Result is cached per process — safe because cwd never changes after
 * Claude Code spawns the hook subprocess.
 */
export function resolveProjectSlug(): string | null {
  // Return cached result if already computed (including explicit null).
  if (_cachedSlug !== undefined) return _cachedSlug;

  const cwd = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
  const entries = loadRegistry();

  if (entries.length === 0) {
    _cachedSlug = null;
    return null;
  }

  // Collect all entries whose root_path is a prefix of cwd.
  const matches: Array<{ slug: string; pathLen: number }> = [];
  for (const entry of entries) {
    if (!entry.root_path || !entry.id) continue;
    const root = expandTilde(entry.root_path);
    if (cwd === root || cwd.startsWith(root + '/')) {
      matches.push({ slug: entry.id, pathLen: root.length });
    }
  }

  if (matches.length === 0) {
    _cachedSlug = null;
    return null;
  }

  // Longest prefix wins (most specific match).
  matches.sort((a, b) => b.pathLen - a.pathLen);
  _cachedSlug = matches[0]!.slug;
  return _cachedSlug;
}

/**
 * Hardcoded DOS-tenant allowlist (D-2026-05-05-2). These prefixes are
 * load-bearing infrastructure and survive `.dos-projects.json` being
 * absent, malformed, or empty. The set is intentionally minimal — only
 * paths that MUST resolve as on-tenant for a fresh-install bootstrap.
 *
 *   - ~/.claude  — DOS install root (live tree, possibly symlinked to
 *                  Releases/v{X}/.claude under the maintainer pattern)
 *   - ~/Durante  — meta-repo (canonical for the principal's machine; the project
 *                  registry itself, RFCs, plans, and Releases live here)
 *
 * These two are also the most commonly-blocked false positives if a sync
 * tool runs before .dos-projects.json is populated, so anchoring them
 * here protects bootstrap drains from being treated as cross-tenant.
 */
function dosAllowlistRoots(): string[] {
  const home = homedir();
  return [join(home, '.claude'), join(home, 'Durante')];
}

/** Return the cached DOS-tenant root list, expanded once per process. */
function dosTenantRoots(): string[] {
  if (_cachedRoots !== undefined) return _cachedRoots;
  const out: string[] = [];
  // Hardcoded allowlist comes first — they are guaranteed even when
  // the registry is missing.
  for (const root of dosAllowlistRoots()) {
    if (!out.includes(root)) out.push(root);
  }
  // Registry roots are added next; duplicates collapse.
  for (const entry of loadRegistry()) {
    if (!entry.root_path) continue;
    const expanded = expandTilde(entry.root_path);
    if (!out.includes(expanded)) out.push(expanded);
  }
  _cachedRoots = out;
  return _cachedRoots;
}

/**
 * RFC-0062 F3 — producer-side cross-tenant scope guard.
 *
 * Returns `true` iff `absPath` resolves under one of the DOS-tenant trees:
 *
 *   1. Any `.dos-projects.json` `root_path` entry (longest-prefix
 *      semantics; here a simple "is-prefix" check suffices since false
 *      positives only happen if a registered root is itself a prefix of
 *      another, which the registry forbids by convention).
 *   2. The hardcoded allowlist (~/.claude, ~/Durante) — D-2026-05-05-2.
 *
 * Returns `false` for:
 *
 *   - Empty/non-string input
 *   - Non-absolute path (relative paths are by-construction on-tenant
 *     because the producer's cwd is itself on-tenant — but we don't
 *     vouch for paths we can't resolve, so relative ⇒ false-cautious)
 *   - Absolute paths that don't sit under any DOS-tenant root
 *   - Malformed input (e.g., embedded NULs)
 *
 * Synchronous + local-only (anti-criterion: no network round-trip).
 *
 * Field-by-field behaviour:
 *
 *   isDosTenantPath('~/Durante/MEMORY/WORK')    → true (allowlist)
 *   isDosTenantPath('~/.claude/MEMORY/STATE')  → true (allowlist)
 *   isDosTenantPath('/opt/example/acme/x')      → false (foreign)
 *   isDosTenantPath('relative/path')            → false
 *   isDosTenantPath('')                         → false
 *   isDosTenantPath('~/.claudefoo')             → false (boundary)
 */
export function isDosTenantPath(absPath: string): boolean {
  if (typeof absPath !== 'string' || absPath.length === 0) return false;
  // Reject embedded NUL or other obviously-malformed input.
  if (absPath.includes('\0')) return false;

  // Expand a leading ~ for callers that pass tilde-prefixed paths. The
  // helper is documented to take absolute paths but ~ is a common DOS
  // shorthand and accepting it costs nothing.
  const expanded = expandTilde(absPath);
  if (!expanded.startsWith('/')) return false;

  for (const root of dosTenantRoots()) {
    if (expanded === root) return true;
    if (expanded.startsWith(root + '/')) return true;
  }
  return false;
}

/**
 * Expose cache reset for unit tests only.
 * Production callers never need this — one process = one slug.
 */
export function __resetProjectSlugCache(): void {
  _cachedSlug = undefined;
  _cachedRoots = undefined;
}
