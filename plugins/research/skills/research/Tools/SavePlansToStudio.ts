#!/usr/bin/env bun
/**
 * SavePlansToStudio - Sync plans and specs to Studio Plans API
 *
 * Walks <project-root>/Plans/** for .md files.
 * Project root resolves via CLAUDE_PROJECT_DIR → cwd fallback. No-op if
 * neither location has a Plans/ directory (operator machine without the
 * DOS-author layout).
 *
 * USAGE
 * -----
 *   bun SavePlansToStudio.ts --import-all
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { basename, join } from 'path';
import { homedir } from 'os';
import { requireStudioConfigOrSkip } from '../Lib/studioClient';
import { classifyArtifactPath } from '../Lib/artifact-classifier';

/**
 * File mtime as an ISO string, swallowing errors. We prefer mtime over
 * the sync-time default because it approximates when the plan was
 * actually written. Returns null if the path can't be stat'd.
 */
function safeMtime(path: string): string | null {
  try {
    return statSync(path).mtime.toISOString();
  } catch {
    return null;
  }
}

import { queueOrPost, digestOfBody, crossTenantGate } from '../Lib/dlq';
import { loadAckedKeys } from '../Lib/dlq-dedup';
import { loadEnv } from '../Lib/env';

loadEnv();

const { url: STUDIO_API_URL, key: STUDIO_API_KEY } =
  requireStudioConfigOrSkip('SavePlansToStudio');

/**
 * Resolve the project root that contains a Plans/ directory.
 * Cascade: CLAUDE_PROJECT_DIR → process.cwd(). Returns null on operator
 * machines that don't have Plans/ (e.g. non-DOS-author repos).
 */
function resolvePlansRoot(): string | null {
  const projectDir = process.env.CLAUDE_PROJECT_DIR;
  if (projectDir) {
    const home = homedir();
    const expanded = projectDir
      .replace(/^\$HOME(?=\/|$)/, home)
      .replace(/^\$\{HOME\}(?=\/|$)/, home)
      .replace(/^~(?=\/|$)/, home);
    if (existsSync(join(expanded, 'Plans'))) return expanded;
  }
  try {
    const cwd = process.cwd();
    if (existsSync(join(cwd, 'Plans'))) return cwd;
  } catch {}
  return null;
}

const PROJECT_ROOT = resolvePlansRoot();
const PLANS_DIR = PROJECT_ROOT ? join(PROJECT_ROOT, 'Plans') : '';

function extractTitle(content: string, fallbackFilename: string): string {
  // Try first # heading
  const headingMatch = content.match(/^#\s+(.+)$/m);
  if (headingMatch) return headingMatch[1].trim();

  // Try first | Title | table cell
  const tableMatch = content.match(/\|\s*Title\s*\|\s*(.+?)\s*\|/i);
  if (tableMatch) return tableMatch[1].trim();

  // Fallback to filename without .md, cleaned up
  return fallbackFilename.replace(/\.md$/, '').replace(/[-_]/g, ' ');
}

type SyncOutcome = 'synced' | 'skipped' | 'failed';

async function syncPlan(filepath: string, acked: Set<string>): Promise<SyncOutcome> {
  const filename = basename(filepath);
  // RFC-0062 F3 — gate cross-tenant plan source paths at the producer.
  // The plan markdown's absolute filepath is the tenant-anchored field;
  // foreign trees produce plan rows that land on the wrong Studio project.
  const earlyGate = crossTenantGate({
    tool: 'plans',
    endpoint: '/api/v1/plans',
    absPath: filepath,
    source: 'SavePlansToStudio',
    payload: { filepath, filename },
  });
  if (!earlyGate.ok) return 'failed';

  const content = readFileSync(filepath, 'utf-8');
  const title = extractTitle(content, filename);
  const classification = classifyArtifactPath(filepath, PROJECT_ROOT ?? undefined);
  const slug = classification.id;
  const planType = classification.studioPlanType === 'unknown'
    ? 'plan'
    : classification.studioPlanType;
  const filePath = classification.relativePath;

  // Preserve the original write time — file mtime is the closest reliable
  // proxy for when the plan was actually written. Without this, Studio
  // defaults createdAt = now() at sync and every row shows "Nm ago".
  const writtenAt = safeMtime(filepath);

  const body = {
    title,
    slug,
    planType,
    content,
    filePath,
    ...(writtenAt ? { writtenAt } : {}),
  };

  const key = `plan:${body.slug}:${digestOfBody(body)}`;
  if (acked.has(key)) return 'skipped'; // already synced — skip

  const queueResult = await queueOrPost(body, '/api/v1/plans', {
    tool: 'plans',
    idempotencyKey: key,
  });
  if (queueResult.outcome === 'dropped') {
    console.error(`Sync dropped for ${slug}: ${queueResult.reason}`);
    return 'failed';
  }
  return 'synced';
}

function collectMdFiles(dir: string): Array<{ path: string }> {
  const results: Array<{ path: string }> = [];
  if (!existsSync(dir)) return results;

  const entries = readdirSync(dir).sort();
  for (const entry of entries) {
    const full = join(dir, entry);
    try {
      const st = statSync(full);
      if (st.isDirectory()) {
        results.push(...collectMdFiles(full));
      } else if (st.isFile() && entry.endsWith('.md')) {
        results.push({ path: full });
      }
    } catch {
      // skip unreadable
    }
  }
  return results;
}

async function importAll(): Promise<void> {
  if (!PROJECT_ROOT || !existsSync(PLANS_DIR)) {
    console.error('No Plans directory found (no DOS-author layout on this machine)');
    process.exit(0);
  }

  const files = collectMdFiles(PLANS_DIR);

  // Skip rows already in the ack ledger — without this the --import-all
  // producer re-enqueues the entire corpus every SessionEnd (incident
  // 2026-06-22) and floods the DLQ faster than the drain removes it.
  const acked = loadAckedKeys("plan:");

  let synced = 0;
  let failed = 0;
  let skipped = 0;

  for (const file of files) {
    const outcome = await syncPlan(file.path, acked);
    if (outcome === 'synced') synced++;
    else if (outcome === 'skipped') skipped++;
    else failed++;
  }

  console.error(`Import complete: ${synced} synced, ${skipped} skipped, ${failed} failed (of ${files.length} total)`);
}

const args = process.argv.slice(2);
if (args[0] === '--import-all') {
  await importAll();
} else {
  console.error('Usage: bun SavePlansToStudio.ts --import-all');
  process.exit(1);
}
