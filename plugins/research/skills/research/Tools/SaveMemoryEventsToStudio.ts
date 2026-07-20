#!/usr/bin/env bun
/**
 * SaveMemoryEventsToStudio - Sync MemPalace bridge memory events to Studio.
 *
 * Reads `MEMORY/STATE/memory-events.jsonl` (Agent-D's producer) and POSTs
 * batches to /api/v1/memory/events for cross-session observability.
 *
 * Cursor lives in `MEMORY/STATE/memory-events-studio-cursor.json`:
 *   { "last_byte_offset": N }
 *
 * USAGE
 * -----
 *   bun SaveMemoryEventsToStudio.ts --import-all
 */

import {
  existsSync,
  readFileSync,
  statSync,
  writeFileSync,
  renameSync,
  mkdirSync,
  openSync,
  closeSync,
} from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import { loadEnv } from '../Lib/env';
import { requireStudioConfigOrSkip } from '../Lib/studioClient';
import { queueOrPost, digestOfBody } from '../Lib/dlq';

loadEnv();

// Side-effect call: exits process if Studio config is missing.
// queueOrPost reads STUDIO_API_URL/KEY from env directly.
requireStudioConfigOrSkip('SaveMemoryEventsToStudio');

const EVENTS_PATH = join(homedir(), '.claude', 'MEMORY', 'STATE', 'memory-events.jsonl');
const CURSOR_PATH = join(homedir(), '.claude', 'MEMORY', 'STATE', 'memory-events-studio-cursor.json');
const BATCH_SIZE = 100;

interface MemoryEvent {
  ts?: string;
  v?: number;
  session_id?: string | null;
  op_kind?: string;
  via?: string;
  args_summary?: string;
  result_summary?: string;
  duration_ms?: number;
  status?: string;
}

interface StudioCursor {
  last_byte_offset: number;
}

function readCursor(): StudioCursor {
  if (!existsSync(CURSOR_PATH)) return { last_byte_offset: 0 };
  try {
    const raw = readFileSync(CURSOR_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.last_byte_offset === 'number') {
      return { last_byte_offset: parsed.last_byte_offset };
    }
    return { last_byte_offset: 0 };
  } catch {
    return { last_byte_offset: 0 };
  }
}

function writeCursorAtomic(cursor: StudioCursor): void {
  mkdirSync(dirname(CURSOR_PATH), { recursive: true });
  const tmp = `${CURSOR_PATH}.tmp.${process.pid}`;
  const fd = openSync(tmp, 'w');
  try {
    writeFileSync(fd, JSON.stringify(cursor));
  } finally {
    closeSync(fd);
  }
  renameSync(tmp, CURSOR_PATH);
}

function readNewEvents(fromOffset: number): { events: MemoryEvent[]; newOffset: number } {
  if (!existsSync(EVENTS_PATH)) return { events: [], newOffset: 0 };
  const size = statSync(EVENTS_PATH).size;
  // If cursor is ahead of file (rotation) or negative, restart from beginning
  // so a freshly-rotated file gets fully shipped. Studio is the SoT — duplicates
  // are idempotent at the (session_id, ts, op_kind) tuple level.
  let start = fromOffset;
  if (start > size || start < 0) start = 0;
  if (start === size) return { events: [], newOffset: size };
  const buf = readFileSync(EVENTS_PATH);
  const slice = buf.subarray(start, size).toString('utf-8');
  const events: MemoryEvent[] = [];
  for (const line of slice.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      events.push(JSON.parse(trimmed) as MemoryEvent);
    } catch {
      // skip malformed lines
    }
  }
  return { events, newOffset: size };
}

async function syncBatch(batch: MemoryEvent[]): Promise<boolean> {
  const body = { events: batch };
  const result = await queueOrPost(body, '/api/v1/memory/events', {
    tool: 'memory-events',
    idempotencyKey: `memory-events:${digestOfBody(body)}`,
  });
  if (result.outcome === 'dropped') {
    console.error(`Sync dropped for batch (${batch.length} events): ${result.reason}`);
    return false;
  }
  return true;
}

async function importAll(): Promise<void> {
  if (!existsSync(EVENTS_PATH)) {
    console.error('No memory-events.jsonl found — nothing to sync.');
    process.exit(0);
  }

  const cursor = readCursor();
  const { events, newOffset } = readNewEvents(cursor.last_byte_offset);

  if (events.length === 0) {
    console.error('No new memory events since last cursor.');
    return;
  }

  let synced = 0;
  let failed = 0;
  for (let i = 0; i < events.length; i += BATCH_SIZE) {
    const batch = events.slice(i, i + BATCH_SIZE);
    const ok = await syncBatch(batch);
    if (ok) synced += batch.length;
    else failed += batch.length;
  }

  // Only advance cursor on full success — otherwise we'll retry the same
  // window next session. The DLQ envelope already idempotency-keys the body
  // hash so duplicates are safe; advancing on partial-failure would skip
  // the failing slice forever.
  if (failed === 0) {
    writeCursorAtomic({ last_byte_offset: newOffset });
  }

  console.error(
    `Import complete: ${synced} synced, ${failed} failed (of ${events.length} new events)`,
  );
}

const args = process.argv.slice(2);
if (args[0] === '--import-all') {
  await importAll();
} else {
  console.error('Usage: bun SaveMemoryEventsToStudio.ts --import-all');
  process.exit(1);
}
