#!/usr/bin/env bun
/**
 * ArchivePromote.hook.ts — SessionEnd auto-promotion of completed PRDs (P3).
 *
 * Scans MEMORY/WORK/ slug dirs for PRD.md files meeting BOTH criteria:
 *   1. Frontmatter `phase: complete`
 *   2. Frontmatter `updated` is older than 7 days from now
 *
 * Matching dirs are moved (one-way) to MEMORY/ARCHIVE/{YYYY-MM}/{slug}/.
 * Promotion is logged to MEMORY/STATE/archive-promotions.jsonl.
 *
 * One-way invariant (ISC-A4.4): ARCHIVE/ dirs are never auto-moved back.
 * Rollback requires explicit operator command.
 *
 * Trigger: SessionEnd
 * ISCs: A4.1–A4.4
 */

import {
  existsSync, mkdirSync, readdirSync, readFileSync,
  appendFileSync, renameSync, statSync,
} from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { startTimer, stopTimer } from './lib/hook-io';
import { getAllMemorySubdirs } from './lib/paths';

const SOAK_DAYS = 7; // days after phase:complete before promotion

// ─── Frontmatter parser ───────────────────────────────────────────────────

/**
 * Parse YAML frontmatter from a PRD.md string.
 * Only handles simple key: value pairs (no nesting needed here).
 */
function parseFrontmatter(content: string): Record<string, string> {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  const result: Record<string, string> = {};
  for (const line of match[1].split(/\r?\n/)) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    // Strip surrounding quotes: a quoted `phase: "complete"` must still match the
    // promotion check, and a quoted `updated: "2026-..."` must still parse as a
    // date for the soak-cutoff comparison (H-053, latent — no quoted PRDs today).
    const val = line.slice(colonIdx + 1).trim().replace(/^["']|["']$/g, '');
    if (key && val) result[key] = val;
  }
  return result;
}

// ─── Promotion logic ──────────────────────────────────────────────────────

interface Promotion {
  slug: string;
  from: string;
  to: string;
  phase: string;
  updated: string;
  promoted_at: string;
}

/**
 * ISC-A4.1: scan MEMORY/WORK dirs for promotable PRDs.
 * Returns list of { from, to, slug } promotion specs.
 */
// RFC-0037 §4.1: a WORK dir holds PRDs flat (WORK/{slug}) AND/OR nested under the
// active/ bucket. Collect slug dirs from both so nested PRDs are not silently
// skipped (the active/ path trap — new PRDs were never promoted).
// Descend ONLY active/, NOT archived/: WORK/archived/ is the cold holding bucket
// (a PRD parked there is operator-intended to stay in WORK), so auto-moving it
// into the git-tracked MEMORY/ARCHIVE tree would surprise the operator. Readers
// (mine-historical, radiator) still scan archived/; only this MOVER skips it.
const WORK_BUCKETS = ['active'];
function collectSlugDirs(workDir: string): Array<{ slug: string; slugDir: string }> {
  const out: Array<{ slug: string; slugDir: string }> = [];
  let entries: string[];
  try {
    entries = readdirSync(workDir);
  } catch { return out; }
  for (const name of entries) {
    const p = join(workDir, name);
    try {
      if (!statSync(p).isDirectory()) continue;
    } catch { continue; }
    if (WORK_BUCKETS.includes(name)) {
      let sub: string[];
      try { sub = readdirSync(p); } catch { continue; }
      for (const s of sub) {
        const sp = join(p, s);
        try { if (statSync(sp).isDirectory()) out.push({ slug: s, slugDir: sp }); } catch { /* skip */ }
      }
    } else {
      out.push({ slug: name, slugDir: p });
    }
  }
  return out;
}

function findPromotable(workDir: string): Promotion[] {
  if (!existsSync(workDir)) return [];
  const promotable: Promotion[] = [];
  const cutoffMs = Date.now() - SOAK_DAYS * 24 * 60 * 60 * 1000;

  for (const { slug, slugDir } of collectSlugDirs(workDir)) {
    const prdPath = join(slugDir, 'PRD.md');
    if (!existsSync(prdPath)) continue;

    let content: string;
    try {
      content = readFileSync(prdPath, 'utf-8');
    } catch { continue; }

    const fm = parseFrontmatter(content);
    if (fm.phase !== 'complete') continue;

    // Parse updated date
    const updatedStr = fm.updated || fm.date;
    if (!updatedStr) continue;
    const updatedMs = new Date(updatedStr).getTime();
    if (isNaN(updatedMs) || updatedMs >= cutoffMs) continue;

    // Derive YYYY-MM from the updated date
    const month = new Date(updatedMs).toISOString().slice(0, 7); // YYYY-MM

    promotable.push({
      slug,
      from: slugDir,
      // ISC-A4.2: archive at <MEMORY>/ARCHIVE/{YYYY-MM}/{slug}/.
      // workDir is a MEMORY/WORK directory; one '..' lifts to MEMORY/, then ARCHIVE/.
      // Two '..' would land at repo root — see 2026-04 incident where 555 PRDs
      // landed at repo-root ARCHIVE/ instead of canonical MEMORY/ARCHIVE/.
      to: join(workDir, '..', 'ARCHIVE', month, slug),
      phase: fm.phase,
      updated: updatedStr,
      promoted_at: new Date().toISOString(),
    });
  }

  return promotable;
}

// ─── Main ─────────────────────────────────────────────────────────────────

const _t = startTimer('ArchivePromote');
process.on('exit', () => {
  try { stopTimer(_t, 'SessionEnd'); } catch { /* never fail */ }
});

// ISC-A4.1: scan all WORK dirs (project-scoped + global)
const workDirs = getAllMemorySubdirs('WORK');

let totalPromoted = 0;

for (const workDir of workDirs) {
  const promotable = findPromotable(workDir);

  for (const promo of promotable) {
    // ISC-A4.2: move to MEMORY/ARCHIVE/{YYYY-MM}/{slug}/
    try {
      const archiveParent = join(promo.to, '..');
      mkdirSync(archiveParent, { recursive: true });

      // ISC-A4.4: ARCHIVE is one-way — never overwrite an existing archive entry
      if (existsSync(promo.to)) {
        console.error(
          `[ArchivePromote] skip ${promo.slug}: target already exists at ${promo.to}`,
        );
        continue;
      }

      renameSync(promo.from, promo.to);

      // ISC-A4.3: log promotion
      const stateDir = join(
        process.env.DOS_DIR || join(homedir(), '.claude'),
        'MEMORY',
        'STATE',
      );
      mkdirSync(stateDir, { recursive: true });
      appendFileSync(
        join(stateDir, 'archive-promotions.jsonl'),
        JSON.stringify(promo) + '\n',
      );

      console.error(
        `[ArchivePromote] promoted: ${promo.slug} → ARCHIVE/${promo.to.split('/ARCHIVE/')[1] ?? promo.slug}`,
      );
      totalPromoted++;
    } catch (err) {
      console.error(`[ArchivePromote] error promoting ${promo.slug}: ${err}`);
    }
  }
}

if (totalPromoted === 0) {
  console.error('[ArchivePromote] nothing to promote');
} else {
  console.error(`[ArchivePromote] promoted ${totalPromoted} PRD(s) to MEMORY/ARCHIVE`);
}

process.exit(0);
