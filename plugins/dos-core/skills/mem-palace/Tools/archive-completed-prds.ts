#!/usr/bin/env bun
/**
 * archive-completed-prds.ts — Auto-promote completed PRDs from MEMORY/WORK/ to MEMORY/ARCHIVE/.
 *
 * P3 from post-tragedy audit (2026-05-04): 32 MB of completed PRD work sits in
 * gitignored MEMORY/WORK/ forever. This tool moves WORK/{slug}/ to
 * ARCHIVE/{YYYY-MM}/{slug}/ once the PRD's frontmatter has phase: complete AND
 * the directory's mtime is ≥7 days old. ARCHIVE is git-tracked under the
 * .gitignore exception `!MEMORY/ARCHIVE/`.
 *
 * USAGE:
 *   bun archive-completed-prds.ts                 # Dry-run (default — list candidates only)
 *   bun archive-completed-prds.ts --apply         # Actually move files
 *   bun archive-completed-prds.ts --json          # JSON summary instead of human output
 *   bun archive-completed-prds.ts --age-days 14   # Override 7-day minimum
 *   bun archive-completed-prds.ts --work-dir <p>  # Override default WORK dir resolution
 *
 * SAFETY:
 *   - Dry-run is default. --apply must be explicit.
 *   - Frontmatter parse failures → SKIP (never move ambiguous PRDs).
 *   - Already-existing destination → SKIP (never overwrite).
 *   - Non-zero exit only on hard error (filesystem failure).
 */

import { existsSync, readFileSync, readdirSync, statSync, renameSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";

interface ArchiveCandidate {
  slug: string;
  phase: string;
  ageDays: number;
  source: string;
  destination: string;
}

interface ArchiveSummary {
  candidates: number;
  moved: number;
  skipped: number;
  errors: { slug: string; reason: string }[];
  dryRun: boolean;
  workDir: string;
  archiveDir: string;
}

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const JSON_OUT = args.includes("--json");

function flagValue(flag: string, fallback: string): string {
  const i = args.indexOf(flag);
  return i >= 0 && i + 1 < args.length ? args[i + 1] : fallback;
}

const AGE_DAYS = parseInt(flagValue("--age-days", "7"), 10);

function resolveDir(subdir: "WORK" | "ARCHIVE"): string {
  const override = flagValue(subdir === "WORK" ? "--work-dir" : "--archive-dir", "");
  if (override) return override;

  const projectDir = process.env.CLAUDE_PROJECT_DIR;
  if (projectDir && existsSync(join(projectDir, "MEMORY", subdir))) {
    return join(projectDir, "MEMORY", subdir);
  }
  return join(homedir(), ".claude", "MEMORY", subdir);
}

const WORK_DIR = resolveDir("WORK");
const ARCHIVE_DIR = resolveDir("ARCHIVE");

function parseFrontmatterPhase(prdPath: string): string | null {
  try {
    const text = readFileSync(prdPath, "utf-8");
    if (!text.startsWith("---")) return null;
    const end = text.indexOf("\n---", 3);
    if (end < 0) return null;
    const block = text.slice(3, end);
    for (const line of block.split("\n")) {
      const m = line.match(/^phase:\s*(.+?)\s*$/);
      if (m) return m[1].replace(/^["']|["']$/g, "").trim();
    }
    return null;
  } catch {
    return null;
  }
}

function ageInDays(p: string): number {
  try {
    const ms = Date.now() - statSync(p).mtimeMs;
    return Math.floor(ms / 86_400_000);
  } catch {
    return -1;
  }
}

function archiveMonthBucket(p: string): string {
  const d = new Date(statSync(p).mtimeMs);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function findCandidates(): ArchiveCandidate[] {
  if (!existsSync(WORK_DIR)) return [];

  const entries = readdirSync(WORK_DIR, { withFileTypes: true })
    .filter(e => e.isDirectory())
    .map(e => e.name);

  const candidates: ArchiveCandidate[] = [];
  for (const slug of entries) {
    const dir = join(WORK_DIR, slug);
    const prd = join(dir, "PRD.md");
    if (!existsSync(prd)) continue;

    const phase = parseFrontmatterPhase(prd);
    if (phase !== "complete") continue;

    const age = ageInDays(dir);
    if (age < AGE_DAYS) continue;

    const bucket = archiveMonthBucket(dir);
    const dest = join(ARCHIVE_DIR, bucket, slug);
    candidates.push({ slug, phase, ageDays: age, source: dir, destination: dest });
  }
  return candidates;
}

function archive(candidates: ArchiveCandidate[]): ArchiveSummary {
  const summary: ArchiveSummary = {
    candidates: candidates.length,
    moved: 0,
    skipped: 0,
    errors: [],
    dryRun: !APPLY,
    workDir: WORK_DIR,
    archiveDir: ARCHIVE_DIR,
  };

  for (const c of candidates) {
    if (existsSync(c.destination)) {
      summary.skipped++;
      summary.errors.push({ slug: c.slug, reason: "destination exists" });
      continue;
    }

    if (!APPLY) continue;

    try {
      mkdirSync(dirname(c.destination), { recursive: true });
      renameSync(c.source, c.destination);
      summary.moved++;
    } catch (err) {
      summary.errors.push({ slug: c.slug, reason: String(err).slice(0, 200) });
    }
  }

  return summary;
}

const candidates = findCandidates();
const summary = archive(candidates);

if (JSON_OUT) {
  console.log(JSON.stringify({ ...summary, candidates }, null, 2));
} else {
  const tag = summary.dryRun ? "[DRY-RUN]" : "[APPLY]";
  console.log(`${tag} archive-completed-prds`);
  console.log(`  WORK:    ${WORK_DIR}`);
  console.log(`  ARCHIVE: ${ARCHIVE_DIR}`);
  console.log(`  Min age: ${AGE_DAYS} days`);
  console.log(`  Candidates: ${summary.candidates}`);

  if (candidates.length === 0) {
    console.log("  No completed PRDs ≥7 days old. Nothing to archive.");
    process.exit(0);
  }

  console.log("");
  for (const c of candidates) {
    const exists = existsSync(c.destination) ? " (skip — destination exists)" : "";
    console.log(`  • ${c.slug} — ${c.ageDays}d old${exists}`);
  }

  if (!APPLY) {
    console.log("");
    console.log("  DRY-RUN. To actually move: bun archive-completed-prds.ts --apply");
  } else {
    console.log("");
    console.log(`  Moved: ${summary.moved}, skipped: ${summary.skipped}, errors: ${summary.errors.length}`);
  }
}

process.exit(0);
