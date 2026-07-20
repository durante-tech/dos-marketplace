#!/usr/bin/env bun
/**
 * SaveFailuresToStudio - Sync failure reports to Studio Failures API
 *
 * Walks MEMORY/LEARNING/FAILURES/{YYYY-MM}/{slug}/ directories,
 * reads sentiment.json, tool-calls.json, CONTEXT.md and POSTs
 * each failure to /api/v1/failures.
 *
 * USAGE
 * -----
 *   bun SaveFailuresToStudio.ts --import-all
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
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
  requireStudioConfigOrSkip('SaveFailuresToStudio');

interface SentimentData {
  rating?: number;
  summary?: string;
  session_id?: string;
  captured_at?: string;
}

/**
 * File/dir mtime as an ISO string, swallowing errors. Preferred over
 * `new Date()` for capturedAt fallback because the failure directory's
 * mtime is the closest reliable proxy for when the failure happened.
 */
function safeMtime(path: string): string | null {
  try {
    return statSync(path).mtime.toISOString();
  } catch {
    return null;
  }
}

async function syncFailure(
  body: Record<string, any>,
  acked: Set<string>,
): Promise<'synced' | 'failed' | 'skipped'> {
  // FIREWALL: one key, reused for both the dedup check and the
  // idempotencyKey. Never two separate expressions — a divergence would
  // let an already-synced row through (silent re-flood) or skip a row
  // under the wrong key (silent data loss).
  const key = `failure:${body.slug}:${digestOfBody(body)}`;
  if (acked.has(key)) return 'skipped'; // already synced — skip
  const queueResult = await queueOrPost(body, '/api/v1/failures', {
    tool: 'failures',
    idempotencyKey: key,
  });
  if (queueResult.outcome === 'dropped') {
    console.error(`Sync dropped for ${body.slug}: ${queueResult.reason}`);
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

  const acked = loadAckedKeys("failure:");

  let synced = 0;
  let failed = 0;
  let skipped = 0;

  for (const learningDir of learningDirs) {
    const failuresDir = join(learningDir, 'FAILURES');
    if (!existsSync(failuresDir)) continue;

    // Walk YYYY-MM directories
    const monthDirs = readdirSync(failuresDir).filter((d) => {
      const p = join(failuresDir, d);
      return statSync(p).isDirectory();
    });

    for (const monthDir of monthDirs) {
      const monthPath = join(failuresDir, monthDir);
      const slugDirs = readdirSync(monthPath).filter((d) => {
        const p = join(monthPath, d);
        return statSync(p).isDirectory();
      });

      for (const slug of slugDirs) {
        const slugPath = join(monthPath, slug);

        // Read sentiment.json
        let sentiment: SentimentData = {};
        const sentimentPath = join(slugPath, 'sentiment.json');
        if (existsSync(sentimentPath)) {
          try {
            sentiment = JSON.parse(readFileSync(sentimentPath, 'utf-8'));
          } catch { /* skip */ }
        }

        // Read tool-calls.json
        let toolCalls: any[] = [];
        const toolCallsPath = join(slugPath, 'tool-calls.json');
        if (existsSync(toolCallsPath)) {
          try {
            toolCalls = JSON.parse(readFileSync(toolCallsPath, 'utf-8'));
            if (!Array.isArray(toolCalls)) toolCalls = [];
          } catch { /* skip */ }
        }

        // Read CONTEXT.md
        let detailedContext = '';
        const contextPath = join(slugPath, 'CONTEXT.md');
        if (existsSync(contextPath)) {
          try {
            detailedContext = readFileSync(contextPath, 'utf-8');
          } catch { /* skip */ }
        }

        // rating is required server-side; skip the failure rather than
        // POST a null that the route will 400 on forever.
        if (sentiment.rating == null) {
          failed++;
          continue;
        }

        const body: Record<string, unknown> = {
          slug,
          rating: Number(sentiment.rating),
          toolCalls,
          // Prefer sentiment-captured time, then dir mtime (when the
          // failure was written), and only fall through to now() as a
          // last resort. Without this, failures without sentiment
          // metadata would all cluster at sync time.
          capturedAt:
            sentiment.captured_at ||
            safeMtime(slugPath) ||
            new Date().toISOString(),
        };
        // Omit null/empty optional fields — the server schema uses
        // z.string().optional() which rejects explicit null.
        if (sentiment.session_id) body.sessionId = sentiment.session_id;
        if (sentiment.summary) body.sentimentSummary = sentiment.summary;
        if (detailedContext) body.detailedContext = detailedContext;

        const result = await syncFailure(body, acked);
        if (result === 'synced') synced++;
        else if (result === 'skipped') skipped++;
        else failed++;
      }
    }
  }

  console.error(`Import complete: ${synced} synced, ${skipped} skipped, ${failed} failed (from ${learningDirs.length} dirs)`);
}

const args = process.argv.slice(2);
if (args[0] === '--import-all') {
  await importAll();
} else {
  console.error('Usage: bun SaveFailuresToStudio.ts --import-all');
  process.exit(1);
}
