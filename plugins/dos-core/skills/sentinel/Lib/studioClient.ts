/**
 * Pack-local shim → canonical `~/.claude/hooks/lib/studioClient.ts`.
 *
 * Authored by Tools/migrate-pack-imports-to-shim.ts per PRD-D1 (C1-RedTeam-refined,
 * council-ratified 2026-05-21). Uses sync Bun `require()` of the homedir()-resolved
 * absolute path so the import works at BOTH pack-source paths and deployed
 * `~/.claude/skills/<P>/Lib/studioClient.ts` paths (the dual-path-resolution gap).
 *
 * DO NOT replace this with a relative-path import — the 5-up form breaks under
 * symlink-mode deployment. See:
 *   MEMORY/CANONICAL/patterns/pack-tool-stable-import-resolution.md
 */
import { homedir } from 'node:os';
import { join } from 'node:path';

const canonical = join(homedir(), '.claude/hooks/lib/studioClient.ts');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const mod = require(canonical);

export const requireStudioConfigOrSkip: typeof import('../../../../../.claude/hooks/lib/studioClient').requireStudioConfigOrSkip = mod.requireStudioConfigOrSkip;
export const getStudioConfig: typeof import('../../../../../.claude/hooks/lib/studioClient').getStudioConfig = mod.getStudioConfig;
export const studioFetch: typeof import('../../../../../.claude/hooks/lib/studioClient').studioFetch = mod.studioFetch;
