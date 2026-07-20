#!/usr/bin/env bun
/**
 * SaveProjectsToStudio.ts — sync DOS project registry to Studio
 *
 * Reads Tools/.dos-projects.json (canonical registry) and upserts each
 * project to POST /api/v1/projects. Idempotent — the Studio endpoint
 * does upsert on (userId, slug) so re-runs are safe.
 *
 * Exit contract (RSCH-04): exits 0 when there is nothing to sync (no
 * registry / empty / unparseable) or every upsert succeeds; exits 1 when
 * any POST returns non-2xx or throws (network error), with a one-line
 * stderr warning per failure. This surfaces auth/credit outages that the
 * former unconditional exit-0 made invisible. The SessionEnd daemon spawns
 * this detached and ignores both exit code and stderr, so the non-zero exit
 * is only observed on direct/manual invocation — exactly the debug path the
 * operator uses when Studio looks empty.
 * ProjectId slugs from this run are what Studio uses for projectId lookups
 * when the x-dos-project-slug header arrives on ingest routes.
 *
 * Invoked by StudioSync.hook.ts at SessionEnd.
 */

import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { requireStudioConfigOrSkip } from '../Lib/studioClient';

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

function expandTilde(p: string): string {
  if (p === '~') return homedir();
  if (p.startsWith('~/')) return join(homedir(), p.slice(2));
  return p;
}

async function main() {
  const { url: studioUrl, key: studioKey } =
    requireStudioConfigOrSkip('SaveProjectsToStudio');

  const registryPath = join(homedir(), 'Durante', 'Tools', '.dos-projects.json');
  if (!existsSync(registryPath)) {
    process.exit(0);
  }

  let projects: DosProjectEntry[];
  try {
    const raw = readFileSync(registryPath, 'utf-8');
    const parsed = JSON.parse(raw) as DosProjectsFile;
    projects = Array.isArray(parsed?.projects) ? parsed.projects : [];
  } catch {
    process.exit(0);
  }

  if (projects.length === 0) {
    process.exit(0);
  }

  const endpoint = new URL('/api/v1/projects', studioUrl).toString();

  const sends = projects
    .filter((p) => p.id && p.name)
    .map(async (p): Promise<boolean> => {
      const body: Record<string, unknown> = {
        slug: p.id,
        name: p.name,
      };
      if (p.description) body.description = p.description;
      if (p.root_path) body.path = expandTilde(p.root_path);

      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${studioKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(5000),
        });
        if (!res.ok) {
          // RSCH-04: surface non-2xx (auth 401/403, credit 402, route 404,
          // server 5xx) instead of swallowing it into a silent exit 0.
          console.error(
            `[SaveProjectsToStudio] ${p.id}: Studio returned ${res.status} ${res.statusText}`,
          );
          return false;
        }
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[SaveProjectsToStudio] ${p.id}: request failed — ${msg}`);
        return false;
      }
    });

  const results = await Promise.allSettled(sends);
  const failures = results.filter(
    (r) => r.status !== 'fulfilled' || r.value === false,
  ).length;

  if (failures > 0) {
    console.error(
      `[SaveProjectsToStudio] ${failures}/${results.length} project upsert(s) failed — ` +
      `Studio may be unreachable or credentials rejected (see warnings above).`,
    );
    process.exit(1);
  }
  process.exit(0);
}

main().catch(() => process.exit(0));
