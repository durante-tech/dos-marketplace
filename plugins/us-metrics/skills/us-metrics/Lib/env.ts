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
import { join } from 'node:path';

const canonical = join(homedir(), '.claude/hooks/lib/envLoader.ts');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const mod = require(canonical);

export const loadEnv: typeof import('../../../../../.claude/hooks/lib/envLoader').loadEnv = mod.loadEnv;
export const loadEnvAsync: typeof import('../../../../../.claude/hooks/lib/envLoader').loadEnvAsync = mod.loadEnvAsync;
export type { EnvLoadOptions } from '../../../../../.claude/hooks/lib/envLoader';
