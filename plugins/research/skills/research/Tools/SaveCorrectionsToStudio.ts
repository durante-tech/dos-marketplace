#!/usr/bin/env bun
/**
 * SaveCorrectionsToStudio - Sync correction queue to Studio Corrections API
 *
 * Reads correction-queue-*.json files from MEMORY/STATE and POSTs
 * each correction to /api/v1/corrections.
 *
 * USAGE
 * -----
 *   bun SaveCorrectionsToStudio.ts --import-all
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, basename } from 'path';
import { homedir } from 'os';

import { queueOrPost, digestOfBody } from '../Lib/dlq';
import { loadAckedKeys } from '../Lib/dlq-dedup';
import { loadEnv } from '../Lib/env';
import { requireStudioConfigOrSkip } from '../Lib/studioClient';

loadEnv();

const { url: STUDIO_API_URL, key: STUDIO_API_KEY } =
  requireStudioConfigOrSkip('SaveCorrectionsToStudio');

async function syncCorrection(
  sessionId: string,
  content: string,
  detectedAt: string,
  legacyDetectedAt: string,
  acked: Set<string>,
): Promise<'synced' | 'failed' | 'skipped'> {
  // H-127 (Forge Gen 113): detectedAt is the queue file's BIRTHTIME — stable
  // across appends — where it used to be mtime. mtime bumped on every append,
  // re-keying every previously-synced correction in the file (the key digest
  // is body-bound per the R-DLQ-1 contract: Studio re-hashes rawBody against
  // the Idempotency-Key digest, so the key cannot change independently of the
  // body). A RESUMED session appending one correction re-synced them all as
  // duplicate Studio rows.
  const body = { sessionId, content, detectedAt };
  const key = `correction:${sessionId}:${digestOfBody(body)}`;
  // Dual-check migration: rows acked under the legacy mtime-keyed scheme must
  // not mass re-sync on the key change. A file untouched since its last ack
  // still derives the same legacy key from its current mtime → skip. A file
  // whose mtime moved since ack would have re-synced under the OLD scheme
  // anyway — no new duplicates versus status quo, strictly fewer over time.
  const legacyKey = `correction:${sessionId}:${digestOfBody({ sessionId, content, detectedAt: legacyDetectedAt })}`;
  if (acked.has(key) || acked.has(legacyKey)) return 'skipped'; // already synced — skip
  const queueResult = await queueOrPost(body, '/api/v1/corrections', {
    tool: 'corrections',
    idempotencyKey: key,
  });
  if (queueResult.outcome === 'dropped') {
    console.error(`Sync dropped for ${sessionId}: ${queueResult.reason}`);
    return 'failed';
  }
  return 'synced';
}

async function importAll(): Promise<void> {
  // DOS_DIR-aware like every sibling reader (loadAckedKeys, CorrectionDetector,
  // MemoryHarvest) — the hardcoded homedir was the latent H-103 shape.
  const dosDir = process.env.DOS_DIR || join(homedir(), '.claude');
  const stateDir = join(dosDir, 'MEMORY', 'STATE');
  if (!existsSync(stateDir)) {
    console.error('No STATE directory found');
    process.exit(0);
  }

  const files = readdirSync(stateDir).filter((f) => f.startsWith('correction-queue-') && f.endsWith('.json'));
  if (files.length === 0) {
    console.error('No correction queue files found');
    process.exit(0);
  }

  const acked = loadAckedKeys("correction:");

  let synced = 0;
  let failed = 0;
  let skipped = 0;

  for (const file of files) {
    const filePath = join(stateDir, file);
    // Extract sessionId from filename: correction-queue-{sessionId}.json
    const sessionId = basename(file, '.json').replace('correction-queue-', '');

    // Read + stat inside ONE try: a file can vanish between readdir and here
    // (historically MemoryHarvest's unlink — removed in Forge H-125 — but any
    // future GC recreates the window). A bare statSync outside the try crashed
    // the WHOLE remaining import on ENOENT.
    let corrections: string[];
    let mtime: string;
    let detectedAt: string;
    try {
      corrections = JSON.parse(readFileSync(filePath, 'utf-8'));
      if (!Array.isArray(corrections)) continue;
      const st = statSync(filePath);
      mtime = st.mtime.toISOString();
      // Birthtime is stable across appends (H-127). Filesystems without a real
      // birthtime report epoch-ish values — fall back to mtime (old behavior).
      const birth = st.birthtime;
      detectedAt = birth && birth.getTime() > 946684800000 ? birth.toISOString() : mtime;
    } catch { continue; }

    for (const content of corrections) {
      if (typeof content !== 'string' || !content.trim()) continue;
      const result = await syncCorrection(sessionId, content, detectedAt, mtime, acked);
      if (result === 'synced') synced++;
      else if (result === 'skipped') skipped++;
      else failed++;
    }
  }

  console.error(`Import complete: ${synced} synced, ${failed} failed, ${skipped} skipped`);
}

const args = process.argv.slice(2);
if (args[0] === '--import-all') {
  await importAll();
} else {
  console.error('Usage: bun SaveCorrectionsToStudio.ts --import-all');
  process.exit(1);
}
