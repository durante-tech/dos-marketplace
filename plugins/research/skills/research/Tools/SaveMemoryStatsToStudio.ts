#!/usr/bin/env bun
/**
 * SaveMemoryStatsToStudio - Sync MemPalace stats to Studio Memory API
 *
 * Calls mempalace_bridge.py for status and per-wing graph_stats,
 * then POSTs each wing snapshot to /api/v1/memory/snapshots.
 *
 * USAGE
 * -----
 *   bun SaveMemoryStatsToStudio.ts --import-all
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

import { queueOrPost, digestOfBody } from '../Lib/dlq';
import { loadAckedKeys } from '../Lib/dlq-dedup';
import { loadEnv } from '../Lib/env';
import { requireStudioConfigOrSkip } from '../Lib/studioClient';

loadEnv();

const { url: STUDIO_API_URL, key: STUDIO_API_KEY } =
  requireStudioConfigOrSkip('SaveMemoryStatsToStudio');

const BRIDGE_PATH = join(homedir(), '.claude', 'DOS', 'Tools', 'mempalace_bridge.py');

function callBridge(action: string, params: Record<string, string> = {}): any {
  if (!existsSync(BRIDGE_PATH)) return null;

  const paramsJson = JSON.stringify(params);
  const result = Bun.spawnSync([
    'uv', 'run',
    '--with', 'mempalace>=3.3.5,<4',
    'python', BRIDGE_PATH,
    action, paramsJson,
  ], { timeout: 30000 });

  const stdout = result.stdout.toString().trim();
  if (!stdout) return null;
  try {
    return JSON.parse(stdout);
  } catch {
    return null;
  }
}

async function syncSnapshot(
  body: Record<string, any>,
  acked: Set<string>,
): Promise<'synced' | 'skipped' | 'failed'> {
  const key = `memsnap:${body.wing}:${digestOfBody(body)}`;
  if (acked.has(key)) return 'skipped'; // already synced — skip
  const queueResult = await queueOrPost(body, '/api/v1/memory/snapshots', {
    tool: 'memory-snapshots',
    idempotencyKey: key,
  });
  if (queueResult.outcome === 'dropped') {
    console.error(`Sync dropped for ${body.wing}: ${queueResult.reason}`);
    return 'failed';
  }
  return 'synced';
}

async function importAll(): Promise<void> {
  // Get wing list from status action
  const statusResult = callBridge('status');
  if (!statusResult || !statusResult.wings || typeof statusResult.wings !== 'object') {
    console.error('Could not retrieve wings from MemPalace');
    process.exit(0);
  }

  const wingsData = statusResult.wings as Record<string, { rooms?: Record<string, number>; total?: number }>;
  const wings = Object.keys(wingsData);
  const acked = loadAckedKeys("memsnap:");
  let synced = 0;
  let skipped = 0;
  let failed = 0;

  for (const wing of wings) {
    const wingInfo = wingsData[wing];
    if (!wingInfo) { failed++; continue; }

    const body = {
      wing,
      totalDrawers: wingInfo.total ?? 0,
      roomCounts: wingInfo.rooms ?? {},
    };

    const result = await syncSnapshot(body, acked);
    if (result === 'synced') synced++;
    else if (result === 'skipped') skipped++;
    else failed++;
  }

  console.error(`Import complete: ${synced} synced, ${skipped} skipped, ${failed} failed (of ${wings.length} wings)`);
}

const args = process.argv.slice(2);
if (args[0] === '--import-all') {
  await importAll();
} else {
  console.error('Usage: bun SaveMemoryStatsToStudio.ts --import-all');
  process.exit(1);
}
