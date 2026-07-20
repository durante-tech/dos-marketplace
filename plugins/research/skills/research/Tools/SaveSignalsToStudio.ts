#!/usr/bin/env bun
/**
 * SaveSignalsToStudio - Sync feedback signals to Studio Signals API
 *
 * Reads ratings.jsonl and POSTs each entry to /api/v1/signals.
 *
 * USAGE
 * -----
 *   bun SaveSignalsToStudio.ts --import-all
 */

import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

import { queueOrPost, digestOfBody } from '../Lib/dlq';
import { loadAckedKeys } from '../Lib/dlq-dedup';
import { loadEnv } from '../Lib/env';
import { requireStudioConfigOrSkip } from '../Lib/studioClient';

loadEnv();

function getAllDirs(subdir: string): string[] {
  const home = homedir();
  const dosDir = process.env.DOS_DIR || join(home, '.claude');
  const dirs: string[] = [];
  const seen = new Set<string>();

  // Global
  const globalDir = join(dosDir, 'MEMORY', subdir);
  if (existsSync(globalDir)) { dirs.push(globalDir); seen.add(globalDir); }

  // All projects from PROJECTS.md
  const projectsPath = join(dosDir, 'DOS', 'USER', 'PROJECTS', 'PROJECTS.md');
  if (existsSync(projectsPath)) {
    try {
      const content = readFileSync(projectsPath, 'utf-8');
      for (const line of content.split('\n')) {
        if (!line.startsWith('|') || line.includes('---') || line.includes('Path')) continue;
        const cells = line.split('|').map(c => c.trim()).filter(Boolean);
        if (cells.length < 2) continue;
        const rawPath = cells[1];
        if (!rawPath || rawPath === '-') continue;
        // Expand $HOME / ${HOME} / ~ to match the canonical expandPath
        // (hooks/lib/paths.ts) — a PROJECTS.md row using $HOME was silently
        // skipped before because only the ~ prefix was handled. [hooks-003]
        const fullPath = rawPath
          .replace(/^\$HOME(?=\/|$)/, home)
          .replace(/^\$\{HOME\}(?=\/|$)/, home)
          .replace(/^~(?=\/|$)/, home);
        const projectDir = join(fullPath, 'MEMORY', subdir);
        if (!seen.has(projectDir) && existsSync(projectDir)) {
          dirs.push(projectDir);
          seen.add(projectDir);
        }
      }
    } catch { /* non-critical */ }
  }

  return dirs;
}

const { url: STUDIO_API_URL, key: STUDIO_API_KEY } =
  requireStudioConfigOrSkip('SaveSignalsToStudio');

interface SignalEntry {
  timestamp: string;
  rating: number;
  session_id: string;
  source: string;
  sentiment_summary: string;
  confidence: number;
  response_preview?: string;
}

async function syncEntry(entry: SignalEntry, acked: Set<string>): Promise<'synced' | 'skipped' | 'failed'> {
  const body = {
    sessionId: entry.session_id,
    rating: Math.max(1, Math.min(10, entry.rating)),
    source: entry.source,
    sentimentSummary: entry.sentiment_summary,
    confidence: entry.confidence,
    responsePreview: entry.response_preview || undefined,
    signaledAt: entry.timestamp,
  };

  const key = `signal:${entry.session_id}:${digestOfBody(body)}`;
  if (acked.has(key)) return 'skipped'; // already synced — skip re-enqueue

  const queueResult = await queueOrPost(body, '/api/v1/signals', {
    tool: 'signals',
    idempotencyKey: key,
  });
  if (queueResult.outcome === 'dropped') {
    console.error(`Sync dropped for ${entry.session_id}: ${queueResult.reason}`);
    return 'failed';
  }
  return 'synced';
}

async function importAll(): Promise<void> {
  const learningDirs = getAllDirs('LEARNING');
  if (learningDirs.length === 0) {
    console.error('No LEARNING directories found');
    process.exit(0);
  }

  const acked = loadAckedKeys("signal:");

  let synced = 0;
  let failed = 0;
  let skipped = 0;
  let total = 0;

  for (const learningDir of learningDirs) {
    const filepath = join(learningDir, 'SIGNALS', 'ratings.jsonl');
    if (!existsSync(filepath)) continue;

    const lines = readFileSync(filepath, 'utf-8').split('\n').filter((l) => l.trim());
    total += lines.length;

    for (const line of lines) {
      try {
        const entry = JSON.parse(line) as SignalEntry;
        if (!entry.session_id || !entry.sentiment_summary) { failed++; continue; }
        const result = await syncEntry(entry, acked);
        if (result === 'synced') synced++;
        else if (result === 'skipped') skipped++;
        else failed++;
      } catch { failed++; }
    }
  }

  console.error(`Import complete: ${synced} synced, ${skipped} skipped (already acked), ${failed} failed (of ${total} total from ${learningDirs.length} dirs)`);
}

const args = process.argv.slice(2);
if (args[0] === '--import-all') {
  await importAll();
} else {
  console.error('Usage: bun SaveSignalsToStudio.ts --import-all');
  process.exit(1);
}
