/**
 * Pack-local shim → canonical `~/.claude/hooks/lib/envLoader.ts`.
 *
 * Authored by Tools/migrate-pack-imports-to-shim.ts per PRD-D1 (C1-RedTeam-refined,
 * council-ratified 2026-05-21). Uses sync Bun `require()` of the homedir()-resolved
 * absolute path so the import works at BOTH pack-source paths and deployed
 * `~/.claude/skills/<P>/Lib/envLoader.ts` paths (the dual-path-resolution gap).
 *
 * DO NOT replace this with a relative-path import — the 5-up form breaks under
 * symlink-mode deployment. See:
 *   MEMORY/CANONICAL/patterns/pack-tool-stable-import-resolution.md
 */
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { readFile, writeFile, chmod } from 'node:fs/promises';

const canonical = join(homedir(), '.claude/hooks/lib/envLoader.ts');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const mod = require(canonical);

export const loadEnv: typeof import('../../../../../.claude/hooks/lib/envLoader').loadEnv = mod.loadEnv;
export const loadEnvAsync: typeof import('../../../../../.claude/hooks/lib/envLoader').loadEnvAsync = mod.loadEnvAsync;
export type { EnvLoadOptions } from '../../../../../.claude/hooks/lib/envLoader';

// ── OAuth token-persistence helpers ──────────────────────────────────────
// Restored after the env-shim migration (8caf8481) unified env LOADING but
// orphaned these env-WRITING helpers, build-breaking Facebook + LinkedIn
// Login.ts token persistence. Out of the canonical loader's (read-only) scope.
// (DEFECT: socialmedia-env-write-helpers-orphaned)

export function envPath(): string {
  const dosDir = process.env.DOS_DIR || resolve(process.env.HOME!, '.claude');
  return resolve(dosDir, '.env');
}

function parseEnvText(content: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

export async function readExistingEnv(): Promise<Record<string, string>> {
  try {
    const content = await readFile(envPath(), 'utf-8');
    return parseEnvText(content);
  } catch {
    return {};
  }
}

export function renderEnv(env: Record<string, string>): string {
  const lines: string[] = [];
  for (const [key, value] of Object.entries(env)) {
    const needsQuotes = /[\s#"']/.test(value);
    lines.push(`${key}=${needsQuotes ? JSON.stringify(value) : value}`);
  }
  return lines.join('\n') + '\n';
}

/**
 * Returns the list of keys whose values differ from what's already stored —
 * the caller decides whether to overwrite.
 */
export function diffEnvKeys(
  existing: Record<string, string>,
  updates: Record<string, string>,
): string[] {
  const conflicts: string[] = [];
  for (const [key, value] of Object.entries(updates)) {
    if (existing[key] !== undefined && existing[key] !== value) {
      conflicts.push(key);
    }
  }
  return conflicts;
}

/**
 * Write a merged env to disk with chmod 600. Caller resolves conflicts first.
 */
export async function writeMergedEnv(
  merged: Record<string, string>,
): Promise<string> {
  const path = envPath();
  // writeArtifact:exempt — operator credential state (OAuth tokens) persisted
  // at $DOS_DIR/.env with chmod 600. Not a user-visible artifact.
  await writeFile(path, renderEnv(merged));
  await chmod(path, 0o600);
  return path;
}
