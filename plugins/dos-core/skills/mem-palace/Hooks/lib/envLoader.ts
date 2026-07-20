/**
 * envLoader.ts — the canonical .env / .gateway.env cascade loader for DOS.
 *
 * Why this exists: pack source files (Media/, Scraping/, OpenRouter/,
 * SocialMedia/, …) each had their own copy of the same loader because Bun
 * auto-loads .env from CWD but DOS credentials live in $HOME/.claude/.env
 * (or $HOME/.config/DOS/.gateway.env under the new installer flow). Seven
 * env.ts files + four inline loadEnv functions later, the rule is the same
 * everywhere and the bug fixes never reach all of them.
 *
 * Cascade (first-file-wins per key):
 *   1. $CLAUDE_PROJECT_DIR/{file}           — per-project override
 *   2. process.cwd()/{file}                  — workspace-specific
 *   3. {extraSearchDirs}/{file}              — pack-specific (e.g. .config/X)
 *   4. $HOME/.config/DOS/{file}              — XDG-style installer canonical
 *   5. ${DOS_DIR || $HOME/.claude}/{file}    — legacy installation fallback
 *
 * Shell env always wins. File values do NOT overwrite an existing
 * process.env entry unless { overwriteExisting: true } is passed —
 * matching the behaviour every prior copy implemented.
 *
 * Usage:
 *
 *   import { loadEnv } from '../../../hooks/lib/envLoader';
 *   loadEnv();                                          // default: .gateway.env then .env
 *   loadEnv({ files: ['.scraping.env', '.env'] });      // custom file list
 *   loadEnv({ extraSearchDirs: ['~/.config/MyApp'] });  // pack-specific cascade dir
 *
 * Each pack's `Lib/env.ts` becomes a 5-line shim that imports from here.
 */

import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

export interface EnvLoadOptions {
  /**
   * Filenames to load in cascade order. Defaults to ['.gateway.env', '.env']
   * — gateway credentials first, then everything else.
   */
  files?: string[];
  /**
   * Extra search directories inserted between cwd and ~/.config/DOS in the
   * cascade. Useful for pack-specific override locations. Tilde and $HOME
   * are expanded.
   */
  extraSearchDirs?: string[];
  /**
   * If true, values from files OVERWRITE existing process.env entries.
   * Default false — shell env always wins, matching every prior copy's
   * behaviour. Use sparingly (e.g. test fixtures that need a clean slate).
   */
  overwriteExisting?: boolean;
}

function expandHome(p: string): string {
  const home = homedir();
  return p
    .replace(/^\$HOME(?=\/|$)/, home)
    .replace(/^\$\{HOME\}(?=\/|$)/, home)
    .replace(/^~(?=\/|$)/, home);
}

// envLoader:exempt — canonical-cascade pack mirror of hooks/lib/envLoader.ts (alias-tracked, 3-way byte-parity)
function collectEnvFiles(filename: string, extraDirs: readonly string[]): string[] {
  const files: string[] = [];

  // 1. CLAUDE_PROJECT_DIR (per-project override)
  const projectDir = process.env.CLAUDE_PROJECT_DIR;
  if (projectDir) {
    const p = join(expandHome(projectDir), filename);
    if (existsSync(p)) files.push(p);
  }

  // 2. cwd (workspace-specific)
  try {
    const p = join(process.cwd(), filename);
    if (existsSync(p)) files.push(p);
  } catch { /* cwd may not be accessible */ }

  // 3. Extra search dirs (pack-specific)
  for (const dir of extraDirs) {
    const p = join(expandHome(dir), filename);
    if (existsSync(p)) files.push(p);
  }

  // 4. XDG-style installer canonical (~/.config/DOS/)
  //    The pair-token bootstrap installer writes here. Missing this path
  //    silently breaks SessionEnd sync for every new operator.
  const xdgPath = join(homedir(), '.config', 'DOS', filename);
  if (existsSync(xdgPath)) files.push(xdgPath);

  // 5. Legacy installation fallback ($DOS_DIR or $HOME/.claude/)
  const dosDir = process.env.DOS_DIR
    ? expandHome(process.env.DOS_DIR)
    : join(homedir(), '.claude');
  const legacyPath = join(dosDir, filename);
  if (existsSync(legacyPath)) files.push(legacyPath);

  return files;
}

/**
 * Synchronous .env / .gateway.env cascade loader.
 *
 * Idempotent — calling repeatedly is safe (already-set keys are skipped).
 * Throws only on unreadable file content; missing files are silently
 * skipped (the cascade collects existing files at lookup time).
 */
export function loadEnv(opts: EnvLoadOptions = {}): void {
  const filenames = opts.files ?? ['.gateway.env', '.env'];
  const extraDirs = opts.extraSearchDirs ?? [];
  const overwrite = opts.overwriteExisting ?? false;

  const allFiles: string[] = [];
  for (const fn of filenames) {
    allFiles.push(...collectEnvFiles(fn, extraDirs));
  }

  const seen = new Set<string>();
  for (const envPath of allFiles) {
    const resolved = resolve(envPath);
    if (seen.has(resolved)) continue;
    seen.add(resolved);

    const lines = readFileSync(envPath, 'utf-8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
      if (overwrite || !process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

/**
 * Async variant — same behavior, returns a resolved Promise.
 * Provided for callers whose existing API was async; the work itself
 * is synchronous (file reads), so the Promise wrapper is purely for
 * call-site signature compatibility.
 */
export async function loadEnvAsync(opts: EnvLoadOptions = {}): Promise<void> {
  loadEnv(opts);
}
