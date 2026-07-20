/**
 * Centralized Path Resolution
 *
 * Handles environment variable expansion for portable DOS configuration.
 * Claude Code doesn't expand $HOME in settings.json env values, so we do it here.
 *
 * Usage:
 *   import { getDosDir, getSettingsPath } from './lib/paths';
 *   const dosDir = getDosDir(); // Always returns expanded absolute path
 */

import { homedir } from 'os';
import { join } from 'path';

/**
 * Expand shell variables in a path string
 * Supports: $HOME, ${HOME}, ~
 */
export function expandPath(path: string): string {
  const home = homedir();

  return path
    .replace(/^\$HOME(?=\/|$)/, home)
    .replace(/^\$\{HOME\}(?=\/|$)/, home)
    .replace(/^~(?=\/|$)/, home);
}

/**
 * Get the DOS directory (expanded)
 * Priority: DOS_DIR env var (expanded) → ~/.claude
 */
export function getDosDir(): string {
  const envPaiDir = process.env.DOS_DIR;

  if (envPaiDir) {
    return expandPath(envPaiDir);
  }

  return join(homedir(), '.claude');
}

/**
 * Get the settings.json path
 */
export function getSettingsPath(): string {
  return join(getDosDir(), 'settings.json');
}

/**
 * Get a path relative to DOS_DIR
 */
export function dosPath(...segments: string[]): string {
  return join(getDosDir(), ...segments);
}

/**
 * Get the hooks directory
 */
export function getHooksDir(): string {
  return dosPath('hooks');
}

/**
 * Get the skills directory
 */
export function getSkillsDir(): string {
  return dosPath('skills');
}

/**
 * Get the MEMORY directory
 */
export function getMemoryDir(): string {
  return dosPath('MEMORY');
}

// ─── Folder-repair buffer (RFC-0020 P0-2) ─────────────────────────────
//
// `getMemorySubdir` self-heals missing directories via `mkdirSync`. When
// a repair happens we buffer a structured record here; LoadContext.hook.ts
// drains the buffer via `drainFolderRepairs()` and merges entries into
// `health.json.folder_repairs[]`. Writing to `health.json` directly would
// risk circularity (health.json lives under STATE, itself resolved via
// this function during writes).

interface FolderRepair {
  component: string;
  subdir: string;
  action: 'created';
}

const folderRepairBuffer: FolderRepair[] = [];

/**
 * Return and clear the folder-repair buffer. Called by LoadContext at
 * health.json flush time. Idempotent — returns [] when nothing was
 * repaired this session.
 */
export function drainFolderRepairs(): FolderRepair[] {
  const copy = folderRepairBuffer.slice();
  folderRepairBuffer.length = 0;
  return copy;
}

/**
 * Get a MEMORY subdirectory — project-level if it exists, otherwise global.
 *
 * Project memory belongs WITH the project. When working inside a project
 * that has its own MEMORY/{subdir}/, data lives there. Hooks must read/write
 * from the same place.
 *
 * Resolution order:
 * 1. CLAUDE_PROJECT_DIR/MEMORY/{subdir}/ (if exists)
 * 2. process.cwd()/MEMORY/{subdir}/ (if exists)
 * 3. ~/.claude/MEMORY/{subdir}/ (global fallback) — self-healed via mkdirSync
 *
 * RFC-0020 P0-2: the global fallback is self-healed on first access with
 * `mkdirSync({ recursive: true })`. A structured record is appended to
 * the folder-repair buffer for the next LoadContext flush into health.json.
 * The self-heal NEVER throws — filesystem errors are swallowed and the
 * path is still returned so callers can produce a clearer ENOENT later.
 *
 * Project-eligible subdirs: WORK, LEARNING, RESEARCH, ARTIFACTS, SECURITY,
 *                           MEMPALACE (RFC-0100 Option C, 2026-05-15 — lives
 *                           at ~/Durante/MEMORY/MEMPALACE/ to survive submodule
 *                           deinit during release-freeze ritual),
 *                           STATE (split-eligible per CLAUDE.md — resolves
 *                           project-first like every other subdir; the prior
 *                           "global-only" label here was WRONG, RFC-0125 finding 4)
 * Global-only subdirs: VOICE, RELATIONSHIP (use getMemoryDir() + join)
 */
export function getMemorySubdir(subdir: string): string {
  const { existsSync, mkdirSync } = require('fs');
  const { join } = require('path');

  // Try CLAUDE_PROJECT_DIR first (set by Claude Code)
  const envDir = process.env.CLAUDE_PROJECT_DIR;
  if (envDir) {
    const projectDir = join(expandPath(envDir), 'MEMORY', subdir);
    if (existsSync(projectDir)) return projectDir;
  }

  // Try cwd
  try {
    const cwdDir = join(process.cwd(), 'MEMORY', subdir);
    if (existsSync(cwdDir)) return cwdDir;
  } catch { /* cwd may not be accessible */ }

  // Global fallback — self-heal on miss (RFC-0020 P0-2)
  const globalDir = dosPath('MEMORY', subdir);
  if (!existsSync(globalDir)) {
    try {
      mkdirSync(globalDir, { recursive: true });
      folderRepairBuffer.push({
        component: 'getMemorySubdir',
        subdir,
        action: 'created',
      });
    } catch { /* swallow — caller will surface ENOENT more clearly if the mkdir really failed */ }
  }
  return globalDir;
}

/**
 * Canonical session-id sourcing for hooks (RFC-0125 finding 5).
 *
 * The spawn-map WRITER (SubagentSpawnAttribution, PreToolUse) and the ledger
 * READER (SubagentReturnTally, PostToolUse) MUST key the per-session spawn-map
 * file under the SAME session id, or every lookup misses and the ledger
 * silently degrades to the mtime guess. Both call this helper so the sourcing
 * is symmetric. Order matches the pre-existing reader convention
 * (`input.session_id || CLAUDE_SESSION_ID || 'unknown'`).
 */
export function resolveSessionId(input: { session_id?: string } | null | undefined): string {
  return input?.session_id || process.env.CLAUDE_SESSION_ID || 'unknown';
}

/**
 * Get ALL instances of a MEMORY subdirectory across all projects + global.
 * Used by sync tools that need to scan across all projects.
 */
export function getAllMemorySubdirs(subdir: string): string[] {
  const { existsSync, readFileSync } = require('fs');
  const { join } = require('path');

  const dirs: string[] = [];
  const seen = new Set<string>();

  // Global
  const globalDir = dosPath('MEMORY', subdir);
  if (existsSync(globalDir)) {
    dirs.push(globalDir);
    seen.add(globalDir);
  }

  // All projects from PROJECTS.md.
  //
  // Parse header-aware (RFC-0125-style): locate the Path column by NAME from
  // the header row rather than assuming it is the 2nd cell. The prior parser
  // used `cells[1]` (positional) plus `line.includes('Path')` to skip the
  // header — but `includes('Path')` ALSO drops any data row whose path string
  // contains the substring 'Path' (e.g. `~/dev/PathFinder/app`), and the
  // positional index silently mis-reads after a column reorder. See
  // project-resolver.loadProjects() lines 56-63 for the same hazard note.
  const projectsPath = dosPath('DOS', 'USER', 'PROJECTS', 'PROJECTS.md');
  if (existsSync(projectsPath)) {
    try {
      const content = readFileSync(projectsPath, 'utf-8');
      const lines = content.split('\n');

      // Locate the table header row (the one naming a Project column) and
      // build a column-name → index map from it.
      const headerIdx = lines.findIndex((l: string) => /\|\s*Project\s*\|/i.test(l));
      let pathCol = -1;
      let headerRow = -1;
      if (headerIdx !== -1) {
        headerRow = headerIdx;
        const headerCells = lines[headerIdx].split('|').map((c: string) => c.trim()).filter(Boolean);
        pathCol = headerCells.findIndex((c: string) => c.toLowerCase() === 'path');
      }

      lines.forEach((line: string, i: number) => {
        if (i <= headerRow) return; // skip everything up to and including the header
        if (!line.startsWith('|') || line.includes('---')) return;
        const cells = line.split('|').map((c: string) => c.trim()).filter(Boolean);
        // Header-aware column when we found a Path column; else fall back to
        // the legacy 2nd-cell position (preserves behavior for header-less tables).
        const rawPath = pathCol !== -1 ? cells[pathCol] : cells[1];
        if (!rawPath || rawPath === '-') return;
        const fullPath = expandPath(rawPath);
        const projectDir = join(fullPath, 'MEMORY', subdir);
        if (!seen.has(projectDir) && existsSync(projectDir)) {
          dirs.push(projectDir);
          seen.add(projectDir);
        }
      });
    } catch { /* non-critical */ }
  }

  return dirs;
}

/**
 * Load environment variables with project-level cascade.
 *
 * Loads TWO file types in priority order:
 *   .gateway.env — Studio gateway credentials (managed by installer)
 *   .env         — Everything else (personal keys, user config)
 *
 * For each file type, cascade order (first file wins per key):
 * 1. CLAUDE_PROJECT_DIR/{file} (project-specific override)
 * 2. process.cwd()/{file} (workspace-specific)
 * 3. ~/.config/DOS/{file} (installer canonical — XDG-style)
 * 4. ~/.claude/{file} (legacy installation fallback)
 *
 * .gateway.env is loaded FIRST so gateway credentials take priority.
 * Keys already in process.env (from shell) are never overwritten.
 *
 * Cascade includes BOTH ~/.config/DOS/ and ~/.claude/ because the
 * pair-token bootstrap installer writes `.gateway.env` to
 * `~/.config/DOS/.gateway.env` (XDG-style config location), while
 * legacy installs and pre-v0.0.7 setups may have it at
 * `~/.claude/.gateway.env`. Operators on the new flow had their
 * SessionEnd sync silently fail until this cascade was extended —
 * the hook read ~/.claude/.gateway.env (absent), env vars stayed
 * undefined, and StudioSync exited early at the `if (!URL||!KEY)`
 * guard with no output. Every new operator hit this.
 */
export function loadProjectEnv(): void {
  // Delegated to the canonical loader at hooks/lib/envLoader.ts as of
  // 2026-04-27. Same 4-tier cascade, same first-file-wins semantics,
  // same shell-env-always-wins behavior. The body of this function used
  // to be inlined here; six pack copies and four inline duplicates later,
  // we extracted it. Backward compatibility preserved — every caller of
  // loadProjectEnv() continues to work unchanged.
  const { loadEnv } = require('./envLoader');
  loadEnv();
}

/**
 * Check if DOS is running in gateway-only mode.
 *
 * When DOS_GATEWAY_ONLY=1 (set by the installer in .gateway.env),
 * tools must use the Studio gateway for all provider calls.
 * They must NOT fall back to BYOK (individual provider API keys).
 * If gateway credentials are missing, tools should fail fast with
 * an actionable error message.
 *
 * When unset or "0", tools use the current behavior: try gateway
 * first, fall back to BYOK.
 */
export function isGatewayOnly(): boolean {
  const val = process.env.DOS_GATEWAY_ONLY;
  return val === '1' || val === 'true';
}

/**
 * Get the WORK directory — convenience alias for getMemorySubdir('WORK').
 * Kept for backward compatibility with existing callers.
 */
export function getWorkDir(): string {
  return getMemorySubdir('WORK');
}

/**
 * Get ALL work directories — convenience alias for getAllMemorySubdirs('WORK').
 * Kept for backward compatibility with existing callers.
 */
export function getAllWorkDirs(): string[] {
  return getAllMemorySubdirs('WORK');
}

// ============================================================================
// Storage-Root Enforcement — New Exports (PR1, 2026-04-17)
//
// Four new exports supporting Plans/Specs/storage-root-enforcement.md:
//   - SkillRoot type + SkillRootDeclaration interface
//   - parseSkillRoot(token)   — parse frontmatter tokens like "PROJECT.RESEARCH"
//   - resolveProjectRoot()    — CLAUDE_PROJECT_DIR > walk-up .git > walk-up CLAUDE.md > cwd
//   - resolveSkillRoot()      — resolve (root, subdir?) to absolute filesystem path
//   - pathIsUnderAnyRoot()    — check if abs path falls under any of given root decls
//
// Existing exports above are UNCHANGED. See spec PR1 scope.
// ============================================================================

const VALID_SKILL_ROOTS = [
  'PROJECT',
  'PRINCIPAL',
  'INSTALL',
  'PROTECTED_LOCAL',
] as const;

export type SkillRoot = typeof VALID_SKILL_ROOTS[number];

export interface SkillRootDeclaration {
  root: SkillRoot;
  subdir?: string;
}

/**
 * Parse a frontmatter token like "PROJECT.RESEARCH" or "PRINCIPAL".
 * Returns { root, subdir } where subdir is undefined for bare roots.
 * Throws if the root prefix is not one of the 4 valid SkillRoot values.
 */
export function parseSkillRoot(token: string): SkillRootDeclaration {
  const dot = token.indexOf('.');
  const rootStr = dot === -1 ? token : token.slice(0, dot);
  const subdir = dot === -1 ? undefined : token.slice(dot + 1);

  if (!VALID_SKILL_ROOTS.includes(rootStr as SkillRoot)) {
    throw new Error(
      `parseSkillRoot: unknown root '${rootStr}' in token '${token}'. Expected one of: ${VALID_SKILL_ROOTS.join(', ')}`
    );
  }

  return { root: rootStr as SkillRoot, subdir };
}

/**
 * Resolve the project root directory.
 *
 * Resolution order (first match wins):
 *   1. process.env.CLAUDE_PROJECT_DIR (expanded) — if set and exists
 *   2. Walk UP from startCwd looking for `.git/` directory (max 10 levels)
 *   3. Walk UP looking for CLAUDE.md
 *   4. Fall back to startCwd (or process.cwd()) with console.warn
 *
 * Used by skill-root resolution and SecurityValidator path checks.
 */
export function resolveProjectRoot(startCwd?: string): string {
  const { existsSync } = require('fs');
  const { join, dirname, resolve } = require('path');

  // 1. Explicit env
  const envDir = process.env.CLAUDE_PROJECT_DIR;
  if (envDir) {
    const expanded = expandPath(envDir);
    if (existsSync(expanded)) return expanded;
  }

  const MAX_LEVELS = 10;

  // 2. Walk up looking for .git/
  let current: string;
  try {
    current = resolve(startCwd ?? process.cwd());
  } catch {
    current = startCwd ?? '/';
  }

  for (let i = 0; i < MAX_LEVELS; i++) {
    if (existsSync(join(current, '.git'))) {
      return current;
    }
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }

  // 3. Walk up looking for CLAUDE.md (fresh walk)
  try {
    current = resolve(startCwd ?? process.cwd());
  } catch {
    current = startCwd ?? '/';
  }

  for (let i = 0; i < MAX_LEVELS; i++) {
    if (existsSync(join(current, 'CLAUDE.md'))) {
      return current;
    }
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }

  // 4. Fallback with warn
  const fallback = startCwd ?? process.cwd();
  console.warn(
    `[paths] resolveProjectRoot: no CLAUDE_PROJECT_DIR/.git/CLAUDE.md found from ${fallback}; falling back to cwd`
  );
  return fallback;
}

/**
 * Resolve a (root, subdir?) pair to an absolute filesystem path.
 *
 *   PROJECT          → ${resolveProjectRoot()}/MEMORY[/subdir]
 *   PRINCIPAL        → ${homedir}/.claude/DOS/USER[/subdir]
 *   INSTALL          → ${dosPath('MEMORY')}[/subdir]  (i.e., ~/.claude/MEMORY[/subdir])
 *   PROTECTED_LOCAL  → ${resolveProjectRoot()}[/subdir]  (subdir is file/dir inside project root)
 */
export function resolveSkillRoot(root: SkillRoot, subdir?: string): string {
  const { join } = require('path');

  switch (root) {
    case 'PROJECT': {
      const projectRoot = resolveProjectRoot();
      return subdir ? join(projectRoot, 'MEMORY', subdir) : join(projectRoot, 'MEMORY');
    }
    case 'PRINCIPAL': {
      const base = dosPath('DOS', 'USER');
      return subdir ? join(base, subdir) : base;
    }
    case 'INSTALL': {
      const base = dosPath('MEMORY');
      return subdir ? join(base, subdir) : base;
    }
    case 'PROTECTED_LOCAL': {
      const projectRoot = resolveProjectRoot();
      return subdir ? join(projectRoot, subdir) : projectRoot;
    }
  }
}

/**
 * Check if an absolute path falls under any of the given root declarations.
 * Returns { allowed, matchedRoot? } — matchedRoot is populated only on allow.
 *
 * Used by SecurityValidator.hook.ts skillRoots check (PR4).
 */
export function pathIsUnderAnyRoot(
  absPath: string,
  roots: SkillRootDeclaration[]
): { allowed: boolean; matchedRoot?: SkillRootDeclaration } {
  const { resolve } = require('path');

  if (!roots || roots.length === 0) return { allowed: false };

  const normalizedPath = resolve(absPath);
  const pathWithSep = normalizedPath.endsWith('/') ? normalizedPath : normalizedPath + '/';

  for (const decl of roots) {
    const rootAbs = resolveSkillRoot(decl.root, decl.subdir);
    const rootNormalized = resolve(rootAbs);
    const rootWithSep = rootNormalized.endsWith('/') ? rootNormalized : rootNormalized + '/';

    if (pathWithSep === rootWithSep || pathWithSep.startsWith(rootWithSep)) {
      return { allowed: true, matchedRoot: decl };
    }
  }

  return { allowed: false };
}

// ============================================================================
// Security Patterns Resolution
//
// 4-layer cascade mirroring getMemorySubdir() for project-aware behavior,
// layered over the existing DOS USER/SYSTEM tier:
//   1. $CLAUDE_PROJECT_DIR/MEMORY/SECURITY/patterns.yaml   (project override)
//   2. process.cwd()/MEMORY/SECURITY/patterns.yaml          (cwd fallback)
//   3. ~/.claude/DOS/USER/DOSSECURITYSYSTEM/patterns.yaml   (global personal override)
//   4. ~/.claude/DOS/DOSSECURITYSYSTEM/patterns.example.yaml (installed default)
//
// First match wins; returns null if nothing exists (caller fail-opens).
// Caches nothing — caller is responsible for caching parsed config.
// ============================================================================

/**
 * Resolve the security patterns YAML file path using 4-layer cascade.
 *
 * Returns the absolute path of the first existing file in priority order, or
 * null if no patterns file exists anywhere. Callers should fail-open (allow all)
 * when null is returned, preserving the existing safety semantic of
 * SecurityValidator.hook.ts.
 */
export function getSecurityPatternsPath(): string | null {
  const { existsSync } = require('fs');
  const { join } = require('path');

  // 1. Project override
  const envDir = process.env.CLAUDE_PROJECT_DIR;
  if (envDir) {
    const projectPath = join(expandPath(envDir), 'MEMORY', 'SECURITY', 'patterns.yaml');
    if (existsSync(projectPath)) return projectPath;
  }

  // 2. cwd fallback
  try {
    const cwdPath = join(process.cwd(), 'MEMORY', 'SECURITY', 'patterns.yaml');
    if (existsSync(cwdPath)) return cwdPath;
  } catch { /* cwd may not be accessible */ }

  // 3. Global USER override
  const userPath = dosPath('DOS', 'USER', 'DOSSECURITYSYSTEM', 'patterns.yaml');
  if (existsSync(userPath)) return userPath;

  // 4. Installed SYSTEM default
  const systemPath = dosPath('DOS', 'DOSSECURITYSYSTEM', 'patterns.example.yaml');
  if (existsSync(systemPath)) return systemPath;

  return null;
}

// ─── TELOS directory resolution (v0.0.20 slice 0a-TELOS) ─────────────────
//
// The live TELOS corpus is OPERATOR DATA at ~/.durante/user/TELOS/ — outside
// the ~/.claude install tree, so it survives symlink-mode freezes AND real-dir
// customer installs. The historic USER/TELOS path under the install tree is dead; nine
// pack surfaces that cited it were migrated in the same slice. Keep this rule
// in lockstep with the inline copy in
// skills/telos/DashboardTemplate/Lib/telos-data.ts (the dashboard template
// cannot import hooks/lib).

/**
 * Resolve the personal TELOS corpus directory.
 * $DURANTE_TELOS_DIR overrides; default is ~/.durante/user/TELOS.
 */
export function getTelosDir(): string {
  const envDir = process.env.DURANTE_TELOS_DIR;
  if (envDir) return expandPath(envDir);
  return join(homedir(), '.durante', 'user', 'TELOS');
}
