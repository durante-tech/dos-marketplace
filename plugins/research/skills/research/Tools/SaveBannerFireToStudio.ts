#!/usr/bin/env bun
/**
 * SaveBannerFireToStudio — Sync banner-fire telemetry to Studio
 *
 * RFC-0074 Phases 2-6 (V11.19). Drains MEMORY/STATE/banner-fire-events.jsonl
 * (produced by Tools/banner-fire-analyzer.ts, V11.8 RFC-0074 Phase 0.5) and
 * POSTs each per-turn record to /api/v1/banner-fire on Studio.
 *
 * Persistence on Studio is intentionally DEFERRED to v0.0.12+; the route
 * accepts records, runs auth + Zod + idempotency-key, and returns 201 with
 * `persistence: 'deferred-v0.0.12'`. This sync tool exists so the producer-
 * side ingest contract is exercised end-to-end before persistence lands.
 *
 * Event shape per JSONL line (banner-fire-analyzer.ts output):
 *   {
 *     ts: ISO-8601 string,
 *     session_id: string,
 *     turn_uuid: string,
 *     turn_idx: number,
 *     mode: "ALGORITHM"|"NATIVE"|"MINIMAL"|null,
 *     phase: "OBSERVE"|"THINK"|"PLAN"|"BUILD"|"EXECUTE"|"VERIFY"|"LEARN"|null,
 *     phase_index: 1..7|null,
 *     banner_present: boolean,
 *     is_sidechain: boolean,
 *     model: string|null,
 *     first_line_excerpt: string
 *   }
 *
 * USAGE
 * -----
 *   bun SaveBannerFireToStudio.ts --import-all
 *   bun SaveBannerFireToStudio.ts --help
 *
 * Refs:
 *   - Plans/Specs/RFC-0074-algorithm-fire-rate-dashboard.md
 *   - Plans/Roadmaps/v0.0.11-master-2026-05.md (V11.19 row)
 *   - MEMORY/WORK/20260510-200000_v1119-rfc-0074-studio-dashboard/PRD.md
 *   - Tools/banner-fire-analyzer.ts (input producer)
 */

import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

import {
  queueOrPost,
  digestOfBody,
  crossTenantGate,
} from '../Lib/dlq';
import { loadAckedKeys } from '../Lib/dlq-dedup';
import { loadEnv } from '../Lib/env';
import { requireStudioConfigOrSkip } from '../Lib/studioClient';

loadEnv();

// ─────────────────────────────────────────────────────────────────────
// Project-aware MEMORY/STATE discovery — mirrors SaveSkillActivations
// ─────────────────────────────────────────────────────────────────────

function getAllDirs(subdir: string): string[] {
  const home = homedir();
  const dosDir = process.env.DOS_DIR || join(home, '.claude');
  const dirs: string[] = [];
  const seen = new Set<string>();

  const globalDir = join(dosDir, 'MEMORY', subdir);
  if (existsSync(globalDir)) {
    dirs.push(globalDir);
    seen.add(globalDir);
  }

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
    } catch {
      /* non-critical */
    }
  }

  return dirs;
}

const { url: _STUDIO_API_URL, key: _STUDIO_API_KEY } =
  requireStudioConfigOrSkip('SaveBannerFireToStudio');

// ─────────────────────────────────────────────────────────────────────
// Event shape — matches banner-fire-analyzer.ts output
// ─────────────────────────────────────────────────────────────────────

const VALID_MODES = new Set(['ALGORITHM', 'NATIVE', 'MINIMAL']);
const VALID_PHASES = new Set([
  'OBSERVE',
  'THINK',
  'PLAN',
  'BUILD',
  'EXECUTE',
  'VERIFY',
  'LEARN',
]);

interface BannerFireEntry {
  ts: string;
  session_id: string;
  turn_uuid: string;
  turn_idx: number;
  mode: string | null;
  phase: string | null;
  phase_index: number | null;
  banner_present: boolean;
  is_sidechain: boolean;
  model: string | null;
  first_line_excerpt: string;
}

interface BannerFirePayload {
  sessionId: string;
  turnUuid: string;
  turnIdx: number;
  mode: 'ALGORITHM' | 'NATIVE' | 'MINIMAL' | null;
  phase:
    | 'OBSERVE'
    | 'THINK'
    | 'PLAN'
    | 'BUILD'
    | 'EXECUTE'
    | 'VERIFY'
    | 'LEARN'
    | null;
  phaseIndex: number | null;
  bannerPresent: boolean;
  isSidechain: boolean;
  model: string | null;
  firstLineExcerpt: string;
  ts: string;
}

function normalizeMode(
  raw: string | null,
): 'ALGORITHM' | 'NATIVE' | 'MINIMAL' | null {
  if (raw === null || raw === undefined) return null;
  const upper = String(raw).toUpperCase();
  if (VALID_MODES.has(upper)) {
    return upper as 'ALGORITHM' | 'NATIVE' | 'MINIMAL';
  }
  return null;
}

function normalizePhase(
  raw: string | null,
):
  | 'OBSERVE'
  | 'THINK'
  | 'PLAN'
  | 'BUILD'
  | 'EXECUTE'
  | 'VERIFY'
  | 'LEARN'
  | null {
  if (raw === null || raw === undefined) return null;
  const upper = String(raw).toUpperCase();
  if (VALID_PHASES.has(upper)) {
    return upper as
      | 'OBSERVE'
      | 'THINK'
      | 'PLAN'
      | 'BUILD'
      | 'EXECUTE'
      | 'VERIFY'
      | 'LEARN';
  }
  return null;
}

function transform(entry: BannerFireEntry): BannerFirePayload | null {
  if (!entry.session_id || !entry.turn_uuid || !entry.ts) return null;
  if (!Number.isFinite(entry.turn_idx) || entry.turn_idx < 1) return null;
  return {
    sessionId: entry.session_id,
    turnUuid: entry.turn_uuid,
    turnIdx: Math.floor(entry.turn_idx),
    mode: normalizeMode(entry.mode),
    phase: normalizePhase(entry.phase),
    phaseIndex:
      entry.phase_index === null ||
      entry.phase_index === undefined ||
      !Number.isFinite(entry.phase_index)
        ? null
        : Math.floor(entry.phase_index),
    bannerPresent: Boolean(entry.banner_present),
    isSidechain: Boolean(entry.is_sidechain),
    model: entry.model ?? null,
    firstLineExcerpt: typeof entry.first_line_excerpt === 'string'
      ? entry.first_line_excerpt.slice(0, 160)
      : '',
    ts: entry.ts,
  };
}

async function syncEntry(
  entry: BannerFireEntry,
  acked: Set<string>,
): Promise<'synced' | 'failed' | 'acked'> {
  const body = transform(entry);
  if (!body) return 'failed';

  // RFC-0062 F3 — refuse to enqueue a foreign-tenant payload. banner-fire
  // entries have no explicit project_path field (they're keyed on session-id
  // alone); pass null to the gate which exits ok-true for null path.
  const gate = crossTenantGate({
    tool: 'banner-fire',
    endpoint: '/api/v1/banner-fire',
    absPath: null,
    source: 'SaveBannerFireToStudio',
    payload: body,
  });
  if (!gate.ok) return 'failed';

  // Idempotency-key contract per RFC-0062: digest the canonical body once
  // here so producer + Studio agree on the hash. Per-turn scope keeps replays
  // a no-op even across drainer retries.
  const key = `banner-fire:${entry.session_id}:${entry.turn_uuid}:${digestOfBody(body)}`;
  // Ack-dedup firewall (incident 2026-06-22): if this key is already in the
  // ack ledger it has been confirmed-synced to Studio; skip re-enqueue so the
  // corpus does not re-flood the DLQ every SessionEnd. SAME `key` variable is
  // reused for the idempotencyKey below — never two separate expressions.
  if (acked.has(key)) return 'acked';

  const queueResult = await queueOrPost(body, '/api/v1/banner-fire', {
    tool: 'banner-fire',
    idempotencyKey: key,
  });
  if (queueResult.outcome === 'dropped') {
    console.error(
      `[SaveBannerFireToStudio] dropped ${entry.session_id}/${entry.turn_uuid}: ${queueResult.reason}`,
    );
    return 'failed';
  }
  return 'synced';
}

// V12.B6 cursor pattern (RFC-0086 ratified 2026-05-12 council, Beck-named
// stub-marker discovery): per-state-dir watermark keyed by max ISO `ts` seen.
// Sister pattern to MEMORY/STATE/mine-convos-watermark.json.
// Skips lines whose ts is <= cursor; advances cursor only after the line
// successfully syncs.
type BannerFireCursor = Record<string, string>; // stateDir → max ISO ts seen

function getCursorPath(): string {
  // Cursor lives at the FIRST resolved STATE dir (project-first per getAllDirs).
  const stateDirs = getAllDirs('STATE');
  const root = stateDirs[0] ?? join(homedir(), '.claude', 'MEMORY', 'STATE');
  return join(root, 'cursors', 'banner-fire-cursor.json');
}

function readCursor(): BannerFireCursor {
  const path = getCursorPath();
  if (!existsSync(path)) return {};
  try { return JSON.parse(readFileSync(path, 'utf-8')) as BannerFireCursor; }
  catch { return {}; }
}

function writeCursor(cursor: BannerFireCursor): void {
  const path = getCursorPath();
  try {
    const dir = path.substring(0, path.lastIndexOf('/'));
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(path, JSON.stringify(cursor, null, 2));
  } catch (e) {
    console.error(`[SaveBannerFireToStudio] cursor write failed: ${(e as Error).message}`);
  }
}

async function importAll(opts: { resetCursor?: boolean } = {}): Promise<void> {
  const stateDirs = getAllDirs('STATE');
  if (stateDirs.length === 0) {
    console.error('[SaveBannerFireToStudio] no STATE directories found');
    process.exit(0);
  }

  const cursor: BannerFireCursor = opts.resetCursor ? {} : readCursor();

  // Ack-dedup (incident 2026-06-22): load the confirmed-synced key ledger ONCE
  // for this run; syncEntry skips any row whose idempotencyKey is already acked.
  const acked = loadAckedKeys('banner-fire:');

  let synced = 0;
  let failed = 0;
  let total = 0;
  let skipped = 0;
  let ackedSkipped = 0;

  for (const stateDir of stateDirs) {
    const filepath = join(stateDir, 'banner-fire-events.jsonl');
    if (!existsSync(filepath)) continue;

    const lastSeen = cursor[stateDir] ?? '';
    let maxTs = lastSeen;
    let dirFailures = 0;

    const lines = readFileSync(filepath, 'utf-8')
      .split('\n')
      .filter((l) => l.trim());
    total += lines.length;

    for (const line of lines) {
      try {
        const entry = JSON.parse(line) as BannerFireEntry;
        // Skip lines at or before the cursor — already synced.
        if (entry.ts && lastSeen && entry.ts <= lastSeen) {
          skipped++;
          continue;
        }
        const result = await syncEntry(entry, acked);
        if (result === 'synced') {
          synced++;
          if (entry.ts && entry.ts > maxTs) maxTs = entry.ts;
        } else if (result === 'acked') {
          // Already confirmed-synced to Studio — advance the watermark so the
          // cursor reflects this row, but do not re-enqueue it.
          ackedSkipped++;
          if (entry.ts && entry.ts > maxTs) maxTs = entry.ts;
        } else {
          failed++;
          dirFailures++;
        }
      } catch {
        failed++;
        dirFailures++;
      }
    }

    // Only advance the cursor for a dir with zero failures. A single failed
    // (or out-of-order failing) entry would otherwise be stranded behind the
    // high-watermark forever. Mirrors SaveMemoryEventsToStudio's `if (failed === 0)`.
    if (dirFailures === 0 && maxTs !== lastSeen) cursor[stateDir] = maxTs;
  }

  writeCursor(cursor);

  console.error(
    `[SaveBannerFireToStudio] import complete: ${synced} synced, ${failed} failed, ${skipped} skipped-by-cursor, ${ackedSkipped} skipped-by-ack (of ${total} total from ${stateDirs.length} dirs)`,
  );
}

function printHelp(): void {
  console.error(
    [
      'SaveBannerFireToStudio — drain banner-fire-analyzer.ts events to Studio',
      '',
      'Usage:',
      '  bun SaveBannerFireToStudio.ts --import-all',
      '  bun SaveBannerFireToStudio.ts --help',
      '',
      'Reads MEMORY/STATE/banner-fire-events.jsonl from every registered',
      'project (PROJECTS.md) plus the global ~/.claude/MEMORY/STATE/ dir,',
      'POSTs each event to Studio /api/v1/banner-fire via queueOrPost',
      '(DLQ-routed; idempotency-keyed per RFC-0062).',
      '',
      'Event shape per JSONL line:',
      '  { ts, session_id, turn_uuid, turn_idx, mode, phase, phase_index,',
      '    banner_present, is_sidechain, model, first_line_excerpt }',
      '',
      'See: Plans/Specs/RFC-0074-algorithm-fire-rate-dashboard.md',
      '     Plans/Roadmaps/v0.0.11-master-2026-05.md (V11.19)',
    ].join('\n'),
  );
}

const args = process.argv.slice(2);
if (args[0] === '--import-all') {
  await importAll();
} else if (args[0] === '--help' || args[0] === '-h') {
  printHelp();
} else {
  printHelp();
  process.exit(1);
}
