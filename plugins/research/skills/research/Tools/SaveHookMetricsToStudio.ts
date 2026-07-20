#!/usr/bin/env bun
/**
 * SaveHookMetricsToStudio - Sync hook timing metrics to Studio API
 *
 * Reads MEMORY/STATE/hook-timing.jsonl and POSTs all entries to
 * /api/v1/hooks/metrics, then DRAINS the file: lines that were sent are
 * removed in-place via atomic-write under a file lock so the local file
 * shrinks deterministically and never accumulates a multi-thousand-row
 * backlog (which previously tripped P2028 on the server's 15s tx budget).
 * Lines appended during the flush window are preserved.
 *
 * USAGE
 * -----
 *   bun SaveHookMetricsToStudio.ts --import-all
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

import { queueOrPost, digestOfBody } from '../Lib/dlq';
import { loadAckedKeys } from '../Lib/dlq-dedup';
import { loadEnv } from '../Lib/env';
import { requireStudioConfigOrSkip } from '../Lib/studioClient';
import { atomicWriteSync, withFileLock } from '../Lib/atomic-write';

loadEnv();

const { url: STUDIO_API_URL, key: STUDIO_API_KEY } =
  requireStudioConfigOrSkip('SaveHookMetricsToStudio');

interface HookTimingEntry {
  hook: string;
  event: string;
  duration_ms: number;
  timestamp: string;
}

/**
 * Drain `path` of the leading `originalContent`. Reads current content under
 * a file lock; if it still starts with `originalContent`, atomically rewrites
 * the file with only the tail (lines appended during the flush window).
 * No-op if the file shape changed underneath us. Silent on errors — the
 * next run will retry.
 */
function drainLeadingContent(path: string, originalContent: string): boolean {
  if (originalContent.length === 0) return true;
  try {
    return withFileLock(
      path,
      () => {
        const current = readFileSync(path, 'utf-8');
        if (!current.startsWith(originalContent)) {
          return false;
        }
        return atomicWriteSync(path, current.slice(originalContent.length));
      },
      2000,
    );
  } catch {
    return false;
  }
}

async function importAll(): Promise<void> {
  const filepath = join(homedir(), '.claude', 'MEMORY', 'STATE', 'hook-timing.jsonl');

  if (!existsSync(filepath)) {
    console.error('No hook-timing.jsonl found');
    process.exit(0);
  }

  const originalContent = readFileSync(filepath, 'utf-8');
  const lines = originalContent.split('\n').filter((l) => l.trim());
  const metrics: { hookName: string; event: string; durationMs: number; recordedAt: string }[] = [];

  for (const line of lines) {
    try {
      const entry = JSON.parse(line) as HookTimingEntry;
      if (!entry.hook || !entry.event) continue;
      metrics.push({
        hookName: entry.hook,
        event: entry.event,
        durationMs: entry.duration_ms,
        recordedAt: entry.timestamp,
      });
    } catch { /* skip malformed lines */ }
  }

  if (metrics.length === 0) {
    console.error('No valid hook metrics found');
    process.exit(0);
  }

  const acked = loadAckedKeys("hookmetric:");
  let skipped = 0;

  try {
    const body = { metrics };
    const key = `hookmetric:${digestOfBody(body)}`;
    if (acked.has(key)) {
      // Already synced — skip re-enqueue so we don't reflood the DLQ.
      skipped++;
      console.error(`Import complete: 0 metrics synced (${skipped} skipped, already acked)`);
      return;
    }
    const queueResult = await queueOrPost(body, '/api/v1/hooks/metrics', {
      tool: 'hook-metrics',
      idempotencyKey: key,
    });
    if (queueResult.outcome === 'dropped') {
      console.error(`Sync dropped: ${queueResult.reason}`);
    } else {
      // Posted or queued: server (or DLQ) owns the data now. Drain the
      // lines we just sent so the local file shrinks. Lines appended
      // during the flush window are preserved.
      const drained = drainLeadingContent(filepath, originalContent);
      const drainNote = drained ? 'drained' : 'drain-skipped';
      console.error(
        `Import complete: ${metrics.length} metrics synced (${queueResult.outcome}, ${drainNote}, ${skipped} skipped)`,
      );
    }
  } catch (err) {
    console.error(`Network error: ${(err as Error).message}`);
  }
}

const args = process.argv.slice(2);
if (args[0] === '--import-all') {
  await importAll();
} else {
  console.error('Usage: bun SaveHookMetricsToStudio.ts --import-all');
  process.exit(1);
}
