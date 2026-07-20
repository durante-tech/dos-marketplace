#!/usr/bin/env bun
/**
 * update-telos - Update TELOS life context with automatic backups and change tracking
 *
 * This command manages updates to the TELOS life context files, ensuring:
 * - Automatic timestamped backups before any modification
 * - Change tracking in updates.md
 * - Complete version history
 *
 * Usage:
 *   update-telos <file> "<content>" "<change-description>"
 *
 * Example:
 *   update-telos BOOKS.md "- Project Hail Mary by Andy Weir" "Added new favorite book"
 *
 * Files that can be updated:
 * - BELIEFS.md - Core beliefs and world model
 * - BOOKS.md - Favorite books
 * - CHALLENGES.md - Current challenges
 * - FRAMES.md - Mental frames and perspectives
 * - GOALS.md - Life goals
 * - LESSONS.md - Lessons learned
 * - MISSION.md - Life mission
 * - MODELS.md - Mental models
 * - MOVIES.md - Favorite movies
 * - NARRATIVES.md - Personal narratives
 * - PREDICTIONS.md - Predictions about the future
 * - PROBLEMS.md - Problems to solve
 * - PROJECTS.md - Active projects
 * - STRATEGIES.md - Strategies being employed
 * - TELOS.md - Main TELOS document
 * - TRAUMAS.md - Past traumas
 * - WISDOM.md - Accumulated wisdom
 * - WRONG.md - Things I was wrong about
 */

import { readFileSync, copyFileSync, existsSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { getPrincipal } from '../Lib/identity';
import { writeArtifact } from '../Lib/writeArtifact';
import { getTelosDir } from '../Lib/telos-dir';

// Canonical TELOS location: the live 21-file corpus is operator data at
// ~/.durante/user/TELOS — outside the install tree, so it survives symlink-mode
// freezes and real-dir customer installs. Resolution is delegated to getTelosDir()
// so every pack surface shares ONE rule ($DURANTE_TELOS_DIR override || the
// ~/.durante/user/TELOS default); parity with the dashboard copy is pinned by
// Tools/telos-dir.test.ts. BACKUPS_DIR/UPDATES_FILE/targetFile derive from it.
const TELOS_DIR = getTelosDir();
const BACKUPS_DIR = join(TELOS_DIR, 'backups');
const UPDATES_FILE = join(TELOS_DIR, 'updates.md');

// Valid TELOS files. Exported so the allowlist is the single source the workflow docs
// and the SKILL allowlist reconcile against (F3 — was tri-way drift). `problems.md` is
// advertised at SKILL.md:184/218/352 + Update.md but was previously rejected by the tool.
export const VALID_FILES = [
  'beliefs.md',
  'books.md',
  'challenges.md',
  'frames.md',
  'goals.md',
  'ideas.md',
  'learned.md',
  'lessons.md',
  'mission.md',
  'models.md',
  'movies.md',
  'narratives.md',
  'predictions.md',
  'problems.md',
  'projects.md',
  'strategies.md',
  'telos.md',
  'traumas.md',
  'updates.md',
  'visions.md',
  'wisdom.md',
  'wrong.md',
];

/* ──────────────────────────────────────────────────────────────────────────
 * Corpus→KG anchor contract (F1/F2). The join key MemPalace SyncTelos consumes is
 * the `<!-- telos:<uuid> -->` anchor placed DIRECTLY under a `### <title>` entity
 * header (SyncTelos.md:79-82 keys entities by the anchor, skips anchor-less sections).
 * The canonical mutation tool MUST mint that identity on append, or every machine-added
 * goal/project is silently invisible to the purpose-graph KG the Algorithm queries —
 * including the North Star's own substrate. The pure functions below are oracle-tested;
 * only the file read/write is thin I/O.
 * ────────────────────────────────────────────────────────────────────────── */

/** The only uuid-keyed entity files (SyncTelos.md:64-66). Name-keyed files are deferred. */
export const ENTITY_FILES = ['goals.md', 'projects.md'];

export function isEntityFile(filename: string): boolean {
  return ENTITY_FILES.includes(filename.toLowerCase());
}

/** Matches a `<!-- telos:<uuid> -->` anchor line (the corpus→KG join key). */
export const TELOS_ANCHOR_RE = /<!--\s*telos:[0-9a-fA-F-]+\s*-->/;
/** Matches a `### ` entity header (h3 — the SyncTelos entity boundary, not h2 sections). */
const ENTITY_HEADER_RE = /^###\s+\S/;

/**
 * mintEntityBlock — stamp a new goal/project entry in the exact shape SyncTelos parses:
 * `### <title>` then the `<!-- telos:<uuid> -->` anchor DIRECTLY under it, then the body.
 * Normalizes an incoming `##`/`###` heading (Update.md passes `## <Title>\n\n<details>`)
 * to `###` so prose, tool, and the live corpus (goals.md:5-6) agree. Pure.
 */
export function mintEntityBlock(content: string, uuid: string): string {
  const lines = content.trim().split('\n');
  const headingMatch = lines[0].match(/^#{1,6}\s+(.+?)\s*$/);
  const title = (headingMatch ? headingMatch[1] : lines[0]).trim();
  const body = lines.slice(1).join('\n').replace(/^\n+/, '').trimEnd();
  return `### ${title}\n<!-- telos:${uuid} -->${body ? `\n\n${body}` : ''}`;
}

/**
 * auditAnchors — the drift-gate the system structurally lacks: per entity file, count
 * `###` headers vs `<!-- telos: -->` anchors and report the anchor-less titles. SyncTelos's
 * own verify counts anchors not headers (SyncTelos.md:152), so an anchor-less entry is
 * undetectable there; this detects it on the SoT side where the divergence is born. Pure.
 */
export function auditAnchors(fileContent: string): { headers: number; anchors: number; missing: string[] } {
  const lines = fileContent.split('\n');
  let headers = 0;
  let anchors = 0;
  const missing: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (!ENTITY_HEADER_RE.test(lines[i])) continue;
    headers++;
    if (TELOS_ANCHOR_RE.test((lines[i + 1] ?? '').trim())) anchors++;
    else missing.push(lines[i].replace(/^###\s+/, '').trim());
  }
  return { headers, anchors, missing };
}

/**
 * backfillAnchors — stamp an anchor directly under each `###` header lacking one.
 * Idempotent (a re-run is a no-op) and anchor-PRESERVING (skips already-anchored entries,
 * so the hand-placed North Star anchor is never touched). Pure; the caller owns backup+write.
 */
export function backfillAnchors(fileContent: string, mkUuid: () => string): { content: string; stamped: number } {
  const lines = fileContent.split('\n');
  const out: string[] = [];
  let stamped = 0;
  for (let i = 0; i < lines.length; i++) {
    out.push(lines[i]);
    if (ENTITY_HEADER_RE.test(lines[i]) && !TELOS_ANCHOR_RE.test((lines[i + 1] ?? '').trim())) {
      out.push(`<!-- telos:${mkUuid()} -->`);
      stamped++;
    }
  }
  return { content: out.join('\n'), stamped };
}

function getPacificTimestamp(): string {
  const now = new Date();
  const principal = getPrincipal();
  const timezone = principal.timezone || 'UTC';
  const pacificTime = new Date(now.toLocaleString('en-US', { timeZone: timezone }));

  const year = pacificTime.getFullYear();
  const month = String(pacificTime.getMonth() + 1).padStart(2, '0');
  const day = String(pacificTime.getDate()).padStart(2, '0');
  const hours = String(pacificTime.getHours()).padStart(2, '0');
  const minutes = String(pacificTime.getMinutes()).padStart(2, '0');
  const seconds = String(pacificTime.getSeconds()).padStart(2, '0');

  return `${year}${month}${day}-${hours}${minutes}${seconds}`;
}

function getPacificDateForLog(): string {
  const now = new Date();
  const principal = getPrincipal();
  const timezone = principal.timezone || 'UTC';
  const pacificTime = new Date(now.toLocaleString('en-US', { timeZone: timezone }));

  const year = pacificTime.getFullYear();
  const month = String(pacificTime.getMonth() + 1).padStart(2, '0');
  const day = String(pacificTime.getDate()).padStart(2, '0');
  const hours = String(pacificTime.getHours()).padStart(2, '0');
  const minutes = String(pacificTime.getMinutes()).padStart(2, '0');
  const seconds = String(pacificTime.getSeconds()).padStart(2, '0');

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds} PT`;
}

async function runUpdate(args: string[]) {
  if (args.length < 3) {
    console.error('❌ Usage: update-telos <file> "<content>" "<change-description>"');
    console.error('\nExample: update-telos BOOKS.md "- New Book Title" "Added favorite book"');
    console.error('\nValid files:', VALID_FILES.join(', '));
    process.exit(1);
  }

  const [filename, content, changeDescription] = args;

  // Validate filename
  if (!VALID_FILES.includes(filename.toLowerCase())) {
    console.error(`❌ Invalid file: ${filename}`);
    console.error(`Valid files: ${VALID_FILES.join(', ')}`);
    process.exit(1);
  }

  const targetFile = join(TELOS_DIR, filename);

  // Check if file exists
  if (!existsSync(targetFile)) {
    console.error(`❌ File does not exist: ${targetFile}`);
    process.exit(1);
  }

  // Step 1: Create timestamped backup
  const timestamp = getPacificTimestamp();
  const backupFilename = filename.replace('.md', `-${timestamp}.md`);
  const backupPath = join(BACKUPS_DIR, backupFilename);

  try {
    copyFileSync(targetFile, backupPath);
    console.log(`✅ Backup created: ${backupFilename}`);
  } catch (error) {
    console.error(`❌ Failed to create backup: ${error}`);
    process.exit(1);
  }

  // Step 2: Update the target file (append content)
  try {
    const currentContent = readFileSync(targetFile, 'utf-8');
    // Entity files (goals/projects) get the corpus→KG anchor minted in the SyncTelos shape;
    // all other files append raw (their existing list/blockquote conventions).
    const block = isEntityFile(filename) ? '\n' + mintEntityBlock(content, randomUUID()) : content;
    const updatedContent = currentContent.trimEnd() + '\n' + block + '\n';
    await writeArtifact(targetFile, updatedContent, {
      pack: 'Telos',
      workflow: 'UpdateTelos',
      artifactType: 'markdown',
      title: filename,
    });
    console.log(`✅ Updated: ${filename}`);
  } catch (error) {
    console.error(`❌ Failed to update file: ${error}`);
    process.exit(1);
  }

  // Step 3: Update updates.md with change log
  try {
    const logTimestamp = getPacificDateForLog();
    const logEntry = `
## ${logTimestamp}

- **File Modified**: ${filename}
- **Change Type**: Content Addition
- **Description**: ${changeDescription}
- **Backup Location**: \`backups/${backupFilename}\`

`;

    const updatesContent = readFileSync(UPDATES_FILE, 'utf-8');

    // Insert the new entry after "## Future Changes" section
    const futureChangesMarker = '## Future Changes';
    const insertPosition = updatesContent.indexOf(futureChangesMarker);

    if (insertPosition !== -1) {
      const beforeMarker = updatesContent.substring(0, insertPosition + futureChangesMarker.length);
      const afterMarker = updatesContent.substring(insertPosition + futureChangesMarker.length);

      // Find the end of the "Document all changes below..." line
      const nextLineBreak = afterMarker.indexOf('\n');
      const headerSection = afterMarker.substring(0, nextLineBreak + 1);
      const changesList = afterMarker.substring(nextLineBreak + 1);

      const updatedUpdates = beforeMarker + headerSection + logEntry + changesList;
      await writeArtifact(UPDATES_FILE, updatedUpdates, {
        pack: 'Telos',
        workflow: 'UpdateTelos',
        artifactType: 'markdown',
        title: 'updates.md',
      });
      console.log(`✅ Change logged in updates.md`);
    } else {
      // Fallback: just append
      const updatedUpdates = updatesContent.trimEnd() + '\n' + logEntry;
      await writeArtifact(UPDATES_FILE, updatedUpdates, {
        pack: 'Telos',
        workflow: 'UpdateTelos',
        artifactType: 'markdown',
        title: 'updates.md',
      });
      console.log(`✅ Change logged in updates.md (appended)`);
    }
  } catch (error) {
    console.error(`❌ Failed to update updates.md: ${error}`);
    process.exit(1);
  }

  console.log('\n🎯 TELOS update complete!');
  console.log(`   File: ${filename}`);
  console.log(`   Backup: backups/${backupFilename}`);
  console.log(`   Change: ${changeDescription}`);
}

/**
 * `audit [<file>]` — the drift-gate (F2): report `###` headers vs `telos:` anchors per
 * entity file; exit non-zero on any divergence so it can gate continuously.
 */
function runAudit(args: string[]) {
  const named = args.find((a) => !a.startsWith('--'));
  const files = named ? [named.toLowerCase()] : ENTITY_FILES;
  let diverged = 0;
  for (const filename of files) {
    const targetFile = join(TELOS_DIR, filename);
    if (!existsSync(targetFile)) {
      console.error(`❌ File does not exist: ${targetFile}`);
      diverged++;
      continue;
    }
    const { headers, anchors, missing } = auditAnchors(readFileSync(targetFile, 'utf-8'));
    if (missing.length === 0) {
      console.log(`✅ ${filename}: ${anchors}/${headers} entities anchored`);
    } else {
      diverged++;
      console.error(`❌ ${filename}: ${anchors}/${headers} anchored — ${missing.length} anchor-less (invisible to the purpose-graph KG):`);
      for (const title of missing) console.error(`   - ${title}`);
    }
  }
  if (diverged > 0) {
    console.error(`\nRun \`UpdateTelos.ts backfill <file>\` to stamp the missing anchors.`);
    process.exit(1);
  }
  console.log('\n🎯 Anchor audit clean — every entity is visible to SyncTelos.');
}

/**
 * `backfill <file> [--dry-run]` — stamp anchors onto historical anchor-less entries (F2).
 * Idempotent + anchor-preserving (the pure backfill skips already-anchored entries), routes
 * through the existing backup path, and DEFAULTS to dry-run (the principal's files are high
 * blast radius — OoS-4). Pass `--write` to apply.
 */
async function runBackfill(args: string[]) {
  const filename = args.find((a) => !a.startsWith('--'))?.toLowerCase();
  const apply = args.includes('--write');
  if (!filename || !ENTITY_FILES.includes(filename)) {
    console.error(`❌ Usage: update-telos backfill <${ENTITY_FILES.join('|')}> [--write]   (default: dry-run)`);
    process.exit(1);
  }
  const targetFile = join(TELOS_DIR, filename!);
  if (!existsSync(targetFile)) {
    console.error(`❌ File does not exist: ${targetFile}`);
    process.exit(1);
  }
  const original = readFileSync(targetFile, 'utf-8');
  const { content, stamped } = backfillAnchors(original, () => randomUUID());
  if (stamped === 0) {
    console.log(`✅ ${filename}: already fully anchored — nothing to backfill (idempotent no-op).`);
    return;
  }
  if (!apply) {
    console.log(`🔎 [dry-run] ${filename}: would stamp ${stamped} anchor(s). Re-run with --write to apply.`);
    return;
  }
  // Apply: back up first (same path as the update flow), then write.
  const backupFilename = filename.replace('.md', `-${getPacificTimestamp()}.md`);
  copyFileSync(targetFile, join(BACKUPS_DIR, backupFilename));
  console.log(`✅ Backup created: ${backupFilename}`);
  await writeArtifact(targetFile, content, {
    pack: 'Telos',
    workflow: 'UpdateTelos',
    artifactType: 'markdown',
    title: filename,
  });
  console.log(`✅ ${filename}: stamped ${stamped} anchor(s). Run SyncTelos to converge the purpose-graph KG.`);
}

async function main() {
  const argv = process.argv.slice(2);
  const sub = argv[0];
  if (sub === 'audit') return runAudit(argv.slice(1));
  if (sub === 'backfill') return runBackfill(argv.slice(1));
  return runUpdate(argv);
}

if (import.meta.main) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
