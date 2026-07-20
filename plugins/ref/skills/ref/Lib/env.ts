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

const studioClientCanonical = join(homedir(), '.claude/hooks/lib/studioClient.ts');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const studioClient = require(studioClientCanonical) as {
  resolveStudioConfig: () =>
    | {
        kind: 'ok';
        config: {
          url: string;
          key: string;
        };
      }
    | {
        kind: 'missing';
        reason: 'STUDIO_API_URL' | 'STUDIO_API_KEY' | 'BOTH';
      };
};

export const loadEnv: typeof import('../../../../../.claude/hooks/lib/envLoader').loadEnv = mod.loadEnv;
export const loadEnvAsync: typeof import('../../../../../.claude/hooks/lib/envLoader').loadEnvAsync = mod.loadEnvAsync;
export type { EnvLoadOptions } from '../../../../../.claude/hooks/lib/envLoader';

export interface StudioEnv {
  apiUrl: string;
  apiKey: string;
}

export class MissingStudioEnvError extends Error {
  constructor(
    public readonly reason: 'STUDIO_API_URL' | 'STUDIO_API_KEY' | 'BOTH',
  ) {
    super(
      `Studio gateway configuration missing: ${reason}. Set STUDIO_API_URL and STUDIO_API_KEY in ~/.claude/.gateway.env.`,
    );
    this.name = 'MissingStudioEnvError';
  }
}

export function requireStudioEnv(): StudioEnv {
  const result = studioClient.resolveStudioConfig();
  if (result.kind === 'ok') {
    return {
      apiUrl: result.config.url,
      apiKey: result.config.key,
    };
  }
  throw new MissingStudioEnvError(result.reason);
}
