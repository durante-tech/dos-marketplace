#!/usr/bin/env bun
/**
 * SaveVoiceEventsToStudio - Sync voice events to Studio Voice API
 *
 * Reads MEMORY/VOICE/voice-events.jsonl and batch-POSTs all entries
 * to /api/v1/voice/events.
 *
 * USAGE
 * -----
 *   bun SaveVoiceEventsToStudio.ts --import-all
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
  requireStudioConfigOrSkip('SaveVoiceEventsToStudio');

interface VoiceEventEntry {
  timestamp: string;
  session_id: string;
  message: string;
  character_count: number;
  voice_engine: string;
  voice_id: string;
  event_type: string;
  status_code?: number;
  error?: string;
}

async function importAll(): Promise<void> {
  const filepath = join(homedir(), '.claude', 'MEMORY', 'VOICE', 'voice-events.jsonl');

  if (!existsSync(filepath)) {
    console.error('No voice-events.jsonl found');
    process.exit(0);
  }

  const lines = readFileSync(filepath, 'utf-8').split('\n').filter((l) => l.trim());
  const events: Record<string, any>[] = [];

  for (const line of lines) {
    try {
      const entry = JSON.parse(line) as VoiceEventEntry;
      if (!entry.session_id) continue;
      events.push({
        sessionId: entry.session_id,
        message: entry.message || '',
        characterCount: entry.character_count || 0,
        voiceEngine: entry.voice_engine || '',
        voiceId: entry.voice_id || '',
        eventType: entry.event_type || '',
        statusCode: entry.status_code ?? null,
        error: entry.error || null,
        recordedAt: entry.timestamp,
      });
    } catch { /* skip malformed lines */ }
  }

  if (events.length === 0) {
    console.error('No valid voice events found');
    process.exit(0);
  }

  const acked = loadAckedKeys("voice:");
  let skipped = 0;

  try {
    const body = { events };
    const key = `voice:${digestOfBody(body)}`;
    if (acked.has(key)) {
      skipped++;
      console.error(`Import complete: 0 voice events synced, ${skipped} skipped (already acked)`);
      return;
    }
    const queueResult = await queueOrPost(body, '/api/v1/voice/events', {
      tool: 'voice-events',
      idempotencyKey: key,
    });
    const res = queueResult.outcome === 'dropped'
      ? { ok: false, status: 0, text: async () => queueResult.reason }
      : { ok: true, status: 201, text: async () => '' };

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error(`Studio API error (${res.status}): ${text.slice(0, 200)}`);
    } else {
      console.error(`Import complete: ${events.length} voice events synced, ${skipped} skipped`);
    }
  } catch (err) {
    console.error(`Network error: ${(err as Error).message}`);
  }
}

const args = process.argv.slice(2);
if (args[0] === '--import-all') {
  await importAll();
} else {
  console.error('Usage: bun SaveVoiceEventsToStudio.ts --import-all');
  process.exit(1);
}
