#!/usr/bin/env bun
/**
 * SaveLearningsToStudio - Sync learning files to Studio Learnings API
 *
 * Walks MEMORY/LEARNING/{ALGORITHM,SYSTEM}/{YYYY-MM}/*.md and POSTs
 * each learning to /api/v1/learnings.
 *
 * USAGE
 * -----
 *   bun SaveLearningsToStudio.ts --import-all
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, basename } from 'path';
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
  requireStudioConfigOrSkip('SaveLearningsToStudio');

type SyncOutcome = 'synced' | 'skipped' | 'failed';

async function syncLearning(
  body: Record<string, any>,
  acked: Set<string>,
): Promise<SyncOutcome> {
  const key = `learning:${body.category}:${body.fileName}:${digestOfBody(body)}`;
  if (acked.has(key)) return 'skipped'; // already synced — skip
  const queueResult = await queueOrPost(body, '/api/v1/learnings', {
    tool: 'learnings',
    idempotencyKey: key,
  });
  if (queueResult.outcome === 'dropped') {
    console.error(`Sync dropped for ${body.fileName}: ${queueResult.reason}`);
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

  const acked = loadAckedKeys("learning:");
  const categories = ['ALGORITHM', 'SYSTEM'];
  let synced = 0;
  let failed = 0;
  let skipped = 0;

  for (const learningDir of learningDirs) {
    for (const category of categories) {
      const categoryDir = join(learningDir, category);
      if (!existsSync(categoryDir)) continue;

      // Walk YYYY-MM directories
      const monthDirs = readdirSync(categoryDir).filter((d) => {
        const p = join(categoryDir, d);
        return statSync(p).isDirectory();
      });

      for (const monthDir of monthDirs) {
        const monthPath = join(categoryDir, monthDir);
        const mdFiles = readdirSync(monthPath).filter((f) => f.endsWith('.md'));

        for (const mdFile of mdFiles) {
          const filePath = join(monthPath, mdFile);
          let content: string;
          try {
            content = readFileSync(filePath, 'utf-8');
          } catch { continue; }

          const mtime = statSync(filePath).mtime.toISOString();
          const fileName = basename(mdFile);

          const body = {
            category,
            fileName,
            content,
            learnedAt: mtime,
          };

          const outcome = await syncLearning(body, acked);
          if (outcome === 'synced') synced++;
          else if (outcome === 'skipped') skipped++;
          else failed++;
        }
      }
    }
  }

  console.error(`Import complete: ${synced} synced, ${skipped} skipped, ${failed} failed (from ${learningDirs.length} dirs)`);
}

const args = process.argv.slice(2);
if (args[0] === '--import-all') {
  await importAll();
} else {
  console.error('Usage: bun SaveLearningsToStudio.ts --import-all');
  process.exit(1);
}
