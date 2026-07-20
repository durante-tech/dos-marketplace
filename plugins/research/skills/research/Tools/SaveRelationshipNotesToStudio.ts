#!/usr/bin/env bun
/**
 * SaveRelationshipNotesToStudio - Sync relationship notes to Studio API
 *
 * Walks MEMORY/RELATIONSHIP/{YYYY-MM}/{YYYY-MM-DD}.md and POSTs
 * each note to /api/v1/relationships/notes.
 *
 * USAGE
 * -----
 *   bun SaveRelationshipNotesToStudio.ts --import-all
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
  requireStudioConfigOrSkip('SaveRelationshipNotesToStudio');

type SyncOutcome = 'synced' | 'failed' | 'skipped';

async function syncNote(
  content: string,
  noteDate: string,
  acked: Set<string>,
): Promise<SyncOutcome> {
  const body = { content, noteDate };
  const key = `relnote:${noteDate}:${digestOfBody(body)}`;
  if (acked.has(key)) return 'skipped'; // already synced — skip
  const queueResult = await queueOrPost(body, '/api/v1/relationships/notes', {
    tool: 'relationships-notes',
    idempotencyKey: key,
  });
  if (queueResult.outcome === 'dropped') {
    console.error(`Sync dropped for ${noteDate}: ${queueResult.reason}`);
    return 'failed';
  }
  return 'synced';
}

async function importAll(): Promise<void> {
  const relationshipDir = join(homedir(), '.claude', 'MEMORY', 'RELATIONSHIP');
  if (!existsSync(relationshipDir)) {
    console.error('No RELATIONSHIP directory found');
    process.exit(0);
  }

  const acked = loadAckedKeys("relnote:");

  let synced = 0;
  let failed = 0;
  let skipped = 0;

  // Walk YYYY-MM directories
  const monthDirs = readdirSync(relationshipDir).filter((d) => {
    const p = join(relationshipDir, d);
    return statSync(p).isDirectory();
  });

  for (const monthDir of monthDirs) {
    const monthPath = join(relationshipDir, monthDir);
    const mdFiles = readdirSync(monthPath).filter((f) => f.endsWith('.md'));

    for (const mdFile of mdFiles) {
      const filePath = join(monthPath, mdFile);
      let content: string;
      try {
        content = readFileSync(filePath, 'utf-8');
      } catch { continue; }

      // Extract YYYY-MM-DD from filename
      const noteDate = basename(mdFile, '.md');

      const outcome = await syncNote(content, noteDate, acked);
      if (outcome === 'synced') synced++;
      else if (outcome === 'skipped') skipped++;
      else failed++;
    }
  }

  console.error(`Import complete: ${synced} synced, ${failed} failed, ${skipped} skipped`);
}

const args = process.argv.slice(2);
if (args[0] === '--import-all') {
  await importAll();
} else {
  console.error('Usage: bun SaveRelationshipNotesToStudio.ts --import-all');
  process.exit(1);
}
