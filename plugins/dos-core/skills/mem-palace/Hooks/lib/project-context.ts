/**
 * MemPalace hook shim for the canonical DOS project registry loader.
 *
 * The root hooks tree owns parsing and fallback policy. This shim only resolves
 * that implementation across live, plugin, and pack-source layouts.
 */
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

export interface DosProjectEntry {
  id: string;
  name: string;
  wing: string | null;
  root_path: string | null;
  description?: string;
}

interface CanonicalProjectContext {
  loadProjectRegistry(): DosProjectEntry[];
  expandProjectRootPath(path: string): string;
  enumerateRegisteredMemorySubdirs(subdir: string): string[];
}

function activeReleaseProjectContextCandidate(): string | null {
  let cursor = resolve(import.meta.dir);
  for (let depth = 0; depth < 10; depth++) {
    const gitmodules = join(cursor, '.gitmodules');
    if (existsSync(gitmodules)) {
      try {
        const content = readFileSync(gitmodules, 'utf8');
        const activePath = content.match(
          /^\s*path\s*=\s*(Releases\/v[^/\s]+\/\.claude)\s*$/m,
        )?.[1];
        if (activePath) {
          return join(cursor, activePath, 'hooks', 'lib', 'project-context.ts');
        }
      } catch {
        return null;
      }
    }
    const parent = dirname(cursor);
    if (parent === cursor) break;
    cursor = parent;
  }
  return null;
}

const installRoot = process.env.DOS_DIR || join(homedir(), '.claude');
const candidates = [
  process.env.CLAUDE_PLUGIN_ROOT
    ? join(process.env.CLAUDE_PLUGIN_ROOT, 'hooks', 'lib', 'project-context.ts')
    : null,
  resolve(import.meta.dir, '..', '..', '..', '..', 'hooks', 'lib', 'project-context.ts'),
  activeReleaseProjectContextCandidate(),
  process.env.DOS_LIVE_TREE
    ? join(process.env.DOS_LIVE_TREE, 'hooks', 'lib', 'project-context.ts')
    : null,
  join(installRoot, 'hooks', 'lib', 'project-context.ts'),
].filter((candidate): candidate is string => Boolean(candidate));

const canonicalPath = candidates.find((candidate) => existsSync(candidate));
if (!canonicalPath) {
  throw new Error('Canonical DOS hooks/lib/project-context.ts was not found');
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const canonical = require(canonicalPath) as CanonicalProjectContext;

export const loadProjectRegistry = canonical.loadProjectRegistry;
export const expandProjectRootPath = canonical.expandProjectRootPath;
export const enumerateRegisteredMemorySubdirs =
  canonical.enumerateRegisteredMemorySubdirs;
