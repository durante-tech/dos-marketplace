#!/usr/bin/env bun
/**
 * SaveResearchVaultsToStudio - Sync research entries and vaults to Studio
 *
 * Walks ~/.claude/MEMORY/RESEARCH/{YYYY-MM}/ directories.
 * Single .md files become STANDARD research entries.
 * Directories with INDEX.md/SUMMARY.md become EXTENSIVE entries with vaultFiles.
 *
 * USAGE
 * -----
 *   bun SaveResearchVaultsToStudio.ts --import-all
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
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
  requireStudioConfigOrSkip('SaveResearchVaultsToStudio');

function extractTitle(content: string, fallback: string): string {
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : fallback;
}

function walkFiles(dir: string): string[] {
  const results: string[] = [];
  if (!existsSync(dir)) return results;

  const entries = readdirSync(dir);
  for (const entry of entries) {
    const full = join(dir, entry);
    try {
      const st = statSync(full);
      if (st.isDirectory()) {
        results.push(...walkFiles(full));
      } else if (st.isFile()) {
        results.push(full);
      }
    } catch {
      // skip unreadable entries
    }
  }
  return results;
}

async function syncSingleFile(
  filepath: string,
  slug: string,
  acked: Set<string>,
): Promise<'synced' | 'skipped' | 'failed'> {
  const content = readFileSync(filepath, 'utf-8');
  const title = extractTitle(content, slug);

  const body = {
    topic: title,
    content,
    mode: 'STANDARD',
    agentCount: 1,
    agents: 'vault-sync',
    slug,
    hasVault: false,
  };

  const key = `research:${slug}:${digestOfBody(body)}`;
  if (acked.has(key)) return 'skipped'; // already synced — skip

  const queueResult = await queueOrPost(body, '/api/v1/research', {
    tool: 'research',
    idempotencyKey: key,
  });
  if (queueResult.outcome === 'dropped') {
    console.error(`Sync dropped for ${slug}: ${queueResult.reason}`);
    return 'failed';
  }
  return 'synced';
}

async function syncDirectory(
  dirPath: string,
  slug: string,
  acked: Set<string>,
): Promise<'synced' | 'skipped' | 'failed'> {
  // Read INDEX.md or SUMMARY.md as main content
  let mainContent = '';
  const indexPath = join(dirPath, 'INDEX.md');
  const summaryPath = join(dirPath, 'SUMMARY.md');

  if (existsSync(indexPath)) {
    mainContent = readFileSync(indexPath, 'utf-8');
  } else if (existsSync(summaryPath)) {
    mainContent = readFileSync(summaryPath, 'utf-8');
  }

  const title = mainContent
    ? extractTitle(mainContent, slug)
    : slug;

  // Walk all files and build vaultFiles object
  const allFiles = walkFiles(dirPath);
  const vaultFiles: Record<string, string> = {};

  for (const filePath of allFiles) {
    const relPath = relative(dirPath, filePath);
    try {
      vaultFiles[relPath] = readFileSync(filePath, 'utf-8');
    } catch {
      // skip unreadable files
    }
  }

  const body = {
    topic: title,
    content: mainContent || `Research vault: ${slug}`,
    mode: 'EXTENSIVE',
    agentCount: 1,
    agents: 'vault-sync',
    slug,
    vaultFiles,
    hasVault: true,
  };

  const key = `research:${slug}:${digestOfBody(body)}`;
  if (acked.has(key)) return 'skipped'; // already synced — skip

  const queueResult = await queueOrPost(body, '/api/v1/research', {
    tool: 'research',
    idempotencyKey: key,
  });
  if (queueResult.outcome === 'dropped') {
    console.error(`Sync dropped for ${slug}: ${queueResult.reason}`);
    return 'failed';
  }
  return 'synced';
}

async function importAll(): Promise<void> {
  const researchDirs = getAllDirs('RESEARCH');
  if (researchDirs.length === 0) {
    console.error('No RESEARCH directories found');
    process.exit(0);
  }

  const acked = loadAckedKeys("research:");

  let synced = 0;
  let failed = 0;
  let skipped = 0;

  for (const researchDir of researchDirs) {
    // Walk month directories (YYYY-MM)
    const monthDirs = readdirSync(researchDir).filter((d) => {
      const full = join(researchDir, d);
      try { return statSync(full).isDirectory(); } catch { return false; }
    });

    for (const month of monthDirs) {
      const monthPath = join(researchDir, month);
      const entries = readdirSync(monthPath);

      for (const entry of entries) {
        const entryPath = join(monthPath, entry);

        try {
          const st = statSync(entryPath);

          if (st.isFile() && entry.endsWith('.md')) {
            // Single .md file
            const slug = entry.replace(/\.md$/, '');
            const result = await syncSingleFile(entryPath, slug, acked);
            if (result === 'synced') synced++;
            else if (result === 'skipped') skipped++;
            else failed++;
          } else if (st.isDirectory()) {
            // Directory with vault
            const result = await syncDirectory(entryPath, entry, acked);
            if (result === 'synced') synced++;
            else if (result === 'skipped') skipped++;
            else failed++;
          }
        } catch {
          failed++;
        }
      }
    }
  }

  console.error(`Import complete: ${synced} synced, ${skipped} skipped, ${failed} failed (from ${researchDirs.length} dirs)`);
}

const args = process.argv.slice(2);
if (args[0] === '--import-all') {
  await importAll();
} else {
  console.error('Usage: bun SaveResearchVaultsToStudio.ts --import-all');
  process.exit(1);
}
