#!/usr/bin/env bun
/**
 * SaveWorkToStudio - Sync PRD work sessions to the Studio Work API
 *
 * Reads PRD.md files from ~/.claude/MEMORY/WORK/, parses YAML frontmatter
 * and body sections, and POSTs to Studio's /api/v1/work endpoint.
 *
 * USAGE
 * -----
 *   bun SaveWorkToStudio.ts <prd-file-path>
 *   bun SaveWorkToStudio.ts --import-all
 *
 * ENVIRONMENT
 * -----------
 *   STUDIO_API_URL   Base URL of the Studio API
 *   STUDIO_API_KEY   Bearer token for the Studio gateway
 */

import { readFileSync, readdirSync, existsSync, statSync } from 'fs';
import { join, dirname, basename } from 'path';
import { homedir } from 'os';

import { queueOrPost, digestOfBody, crossTenantGate } from '../Lib/dlq';
import { loadAckedKeys } from '../Lib/dlq-dedup';
import { loadEnv } from '../Lib/env';
import { requireStudioConfigOrSkip } from '../Lib/studioClient';

// ---------------------------------------------------------------------------
// ENV
// ---------------------------------------------------------------------------

loadEnv();

const { url: STUDIO_API_URL, key: STUDIO_API_KEY } =
  requireStudioConfigOrSkip('SaveWorkToStudio');

// ---------------------------------------------------------------------------
// PRD PARSER
// ---------------------------------------------------------------------------

interface PrdFrontmatter {
  task: string;
  slug: string;
  effort: string;
  phase: string;
  progress: string;
  mode: string;
  started: string | undefined;
  updated: string | undefined;
}

function parsePrd(raw: string): {
  frontmatter: PrdFrontmatter;
  content: string;
  criteria: { id: string; description: string; status: string }[];
  decisions: string;
} {
  const fmMatch = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!fmMatch) throw new Error('No YAML frontmatter found');

  const yamlBlock = fmMatch[1]!;
  const body = fmMatch[2]!;

  const fm: Record<string, string> = {};
  for (const line of yamlBlock.split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    const val = line.slice(colonIdx + 1).trim().replace(/^["']|["']$/g, '');
    fm[key] = val;
  }

  if (!fm.task || !fm.slug) {
    throw new Error(`Missing required fields: task=${fm.task}, slug=${fm.slug}`);
  }

  // Parse criteria from markdown checkboxes
  const criteria: { id: string; description: string; status: string }[] = [];
  const criteriaRegex = /- \[([ x])\] (ISC-[A-Z]?\d+):\s*(.+)/g;
  let match;
  while ((match = criteriaRegex.exec(body)) !== null) {
    criteria.push({
      id: match[2]!,
      description: match[3]!.trim(),
      status: match[1] === 'x' ? 'completed' : 'pending',
    });
  }

  // Extract decisions section
  let decisions = '';
  const decisionsMatch = body.match(/## Decisions\n([\s\S]*?)(?=\n## |\n*$)/);
  if (decisionsMatch) {
    decisions = decisionsMatch[1]!.trim();
  }

  return {
    frontmatter: {
      task: fm.task!,
      slug: fm.slug!,
      effort: fm.effort ?? 'standard',
      phase: fm.phase ?? 'complete',
      progress: fm.progress ?? '0/0',
      mode: fm.mode ?? 'interactive',
      // Leave undefined when missing — the caller substitutes file mtime.
      // Don't bake in sync-time here: it masks malformed PRDs and causes
      // every reingest to push startedAt forward to "now".
      started: fm.started,
      updated: fm.updated,
    },
    content: body,
    criteria,
    decisions,
  };
}

// ---------------------------------------------------------------------------
// NORMALIZE
// ---------------------------------------------------------------------------

function normalizeEffort(effort: string): string {
  const e = effort.toLowerCase().trim();
  const valid = ['standard', 'extended', 'advanced', 'deep', 'comprehensive'];
  return valid.includes(e) ? e.toUpperCase() : 'STANDARD';
}

function normalizePhase(phase: string): string {
  const p = phase.toLowerCase().trim();
  const valid = ['observe', 'think', 'plan', 'build', 'execute', 'verify', 'learn', 'complete'];
  return valid.includes(p) ? p.toUpperCase() : 'COMPLETE';
}

function parseProgress(progress: string): { passed: number; total: number } {
  const parts = progress.split('/').map(Number);
  return { passed: parts[0] ?? 0, total: parts[1] ?? 0 };
}

// ---------------------------------------------------------------------------
// SYNC
// ---------------------------------------------------------------------------

async function syncFile(
  filepath: string,
  acked?: Set<string>,
  onSkip?: () => void,
): Promise<boolean> {
  if (!existsSync(filepath)) {
    console.error(`File not found: ${filepath}`);
    return false;
  }

  const raw = readFileSync(filepath, 'utf-8');

  let parsed;
  try {
    parsed = parsePrd(raw);
  } catch (err) {
    console.error(`Parse error for ${filepath}: ${(err as Error).message}`);
    return false;
  }

  const { frontmatter, content, criteria, decisions } = parsed;
  const { passed, total } = parseProgress(frontmatter.progress);
  const mtime = statSync(filepath).mtime.toISOString();

  const body = {
    task: frontmatter.task,
    slug: frontmatter.slug,
    effort: normalizeEffort(frontmatter.effort),
    phase: normalizePhase(frontmatter.phase),
    progress: frontmatter.progress,
    content,
    criteria,
    decisions: decisions || undefined,
    criteriaTotal: total,
    criteriaPassed: passed,
    startedAt: frontmatter.started ?? mtime,
    completedAt: frontmatter.phase === 'complete' ? mtime : undefined,
  };

  // RFC-0062 F3 — gate cross-tenant PRD source paths at the producer.
  // The PRD file's absolute filepath is the tenant-anchored field for work
  // envelopes; foreign trees produce work rows that land on the wrong
  // Studio project. We gate before queueOrPost so blocked envelopes never
  // hit the DLQ at all.
  const gate = crossTenantGate({
    tool: 'work',
    endpoint: '/api/v1/work',
    absPath: filepath,
    source: 'SaveWorkToStudio',
    payload: body,
  });
  if (!gate.ok) return false;

  // Ack-dedup firewall (incident 2026-06-22): skip rows already in the ack
  // ledger so --import-all stops re-flooding the DLQ every SessionEnd. The
  // SAME `key` is reused for the dedup check and the idempotencyKey — never
  // two separate expressions — so a skipped row is provably already-synced.
  const key = `work:${body.slug}:${body.phase}:${digestOfBody(body)}`;
  if (acked?.has(key)) {
    onSkip?.();
    return true; // already synced — skip
  }
  const queueResult = await queueOrPost(body, '/api/v1/work', {
    tool: 'work',
    idempotencyKey: key,
  });
  if (queueResult.outcome === 'dropped') {
    console.error(`Sync dropped for ${body.slug}: ${queueResult.reason}`);
    return false;
  }
  console.error(`Synced: ${frontmatter.slug} (${queueResult.outcome})`);
  return true;
}

// ---------------------------------------------------------------------------
// IMPORT ALL
// ---------------------------------------------------------------------------

/**
 * Resolve all WORK directories — global + every project in PROJECTS.md.
 * Project memory belongs WITH the project (e.g., <project-root>/MEMORY/WORK/).
 */
function getAllWorkDirs(): string[] {
  const dirs: string[] = [];
  const seen = new Set<string>();

  const home = homedir();
  const dosDir = join(home, '.claude');

  // Global
  const globalWork = join(dosDir, 'MEMORY', 'WORK');
  if (existsSync(globalWork)) { dirs.push(globalWork); seen.add(globalWork); }

  // All projects from PROJECTS.md
  const projectsPath = join(dosDir, 'DOS', 'USER', 'PROJECTS', 'PROJECTS.md');
  if (existsSync(projectsPath)) {
    try {
      const content = readFileSync(projectsPath, 'utf-8');
      for (const line of content.split('\n')) {
        if (!line.startsWith('|') || line.includes('---') || line.includes('Path')) continue;
        const cells = line.split('|').map((c) => c.trim()).filter(Boolean);
        if (cells.length < 2) continue;
        const rawPath = cells[1];
        if (!rawPath || rawPath === '-') continue;
        // Only expand the canonical `~/` (or bare `~`) form; `~projects` is a literal path.
        const fullPath = rawPath.replace(/^~(?=\/|$)/, home);
        const projectWork = join(fullPath, 'MEMORY', 'WORK');
        if (!seen.has(projectWork) && existsSync(projectWork)) {
          dirs.push(projectWork);
          seen.add(projectWork);
        }
      }
    } catch { /* non-critical */ }
  }

  return dirs;
}

async function importAll(): Promise<void> {
  const allWorkDirs = getAllWorkDirs();

  if (allWorkDirs.length === 0) {
    console.error('No work directories found');
    process.exit(0);
  }

  // Load the ack ledger ONCE up front — skip rows already synced so we don't
  // re-enqueue the entire corpus every SessionEnd (incident 2026-06-22).
  const acked = loadAckedKeys("work:");

  let synced = 0;
  let failed = 0;
  let skipped = 0;

  for (const workDir of allWorkDirs) {
    const slugDirs = readdirSync(workDir).filter((d) => {
      const full = join(workDir, d);
      try {
        return statSync(full).isDirectory() && existsSync(join(full, 'PRD.md'));
      } catch { return false; }
    });

    for (const dir of slugDirs) {
      const before = skipped;
      const ok = await syncFile(join(workDir, dir, 'PRD.md'), acked, () => { skipped++; });
      if (skipped > before) continue; // skipped row — don't count as synced
      if (ok) synced++;
      else failed++;
    }
  }

  console.error(`Import complete: ${synced} synced, ${skipped} skipped, ${failed} failed (from ${allWorkDirs.length} directories)`);
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);

if (args.length === 0) {
  console.error('Usage: bun SaveWorkToStudio.ts <prd-path> | --import-all');
  process.exit(1);
}

if (args[0] === '--import-all') {
  await importAll();
} else {
  const ok = await syncFile(args[0]!);
  if (!ok) process.exit(1);
}
