#!/usr/bin/env bun
// conformance:R13-exempt — single UI-cache fetch — read-only, sub-200ms wall, fail-soft (operator-authorized R13 closure 2026-05-18; Engineer council triage)
/**
 * StudioBannerCache.hook.ts - Pre-fetch Studio org context for banner (SessionStart)
 *
 * PURPOSE:
 * Populates MEMORY/STATE/studio-banner-cache.json so the DOS CLI banner's
 * studio segment (banner/segments/studio.ts) can render org name, tier,
 * credits, and team size at launch without blocking on network I/O.
 *
 * ENDPOINT:
 * GET ${STUDIO_API_URL}/api/v1/org/context
 *   → 200 { orgName, tier, credits, teamSize }
 *   → 404 endpoint not yet deployed — silent skip
 *   → any other error — silent skip
 *
 * TRIGGER: SessionStart
 *
 * OFFLINE-SAFE:
 * - Missing env vars → exit 0 silently
 * - Network error / timeout (2s) → exit 0 silently, no cache write
 * - Non-2xx response → exit 0 silently
 * - Subagent session → exit 0 silently
 *
 * CACHE SHAPE (consumed by banner/data.ts loadStudioContext):
 *   { ts: number (ms), context: { orgName, tier, credits, teamSize } }
 *   TTL = 1h enforced by reader.
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { getDosDir, loadProjectEnv } from './lib/paths';
import { startTimer, stopTimer } from './lib/hook-io';

async function main() {
  if (process.env.CLAUDE_AGENT_TYPE !== undefined) process.exit(0);

  loadProjectEnv();
  const url = process.env.STUDIO_API_URL;
  const key = process.env.STUDIO_API_KEY;
  if (!url || !key) process.exit(0);

  try {
    const resp = await fetch(`${url}/api/v1/org/context`, {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(2000),
    });
    if (!resp.ok) process.exit(0);

    const data = (await resp.json()) as {
      orgName?: string | null;
      tier?: 'pilot' | 'standard' | 'premium' | null;
      credits?: number | null;
      teamSize?: number | null;
    };

    const context = {
      orgName: data.orgName ?? null,
      tier: data.tier ?? null,
      credits: data.credits ?? null,
      teamSize: data.teamSize ?? null,
    };

    const cachePath = join(
      getDosDir(),
      'MEMORY',
      'STATE',
      'studio-banner-cache.json',
    );
    mkdirSync(dirname(cachePath), { recursive: true });
    writeFileSync(
      cachePath,
      JSON.stringify({ ts: Date.now(), context }, null, 2),
    );
  } catch {
    // offline or endpoint unimplemented — silent
  }

  process.exit(0);
}

const _t = startTimer('StudioBannerCache');
process.on('exit', () => stopTimer(_t, 'SessionStart'));
main();
