#!/usr/bin/env bun
/**
 * SaveSkillActivationsToStudio - Sync skill-activation telemetry to Studio
 *
 * Reads skill-activation events from MEMORY/STATE/skill-activations.jsonl and
 * POSTs each entry to /api/v1/skills/activations. The events originate from
 * Anthropic's `claude_code.skill_activated` OTEL semantic-convention emitter
 * (Claude Code v2.1.126+); a separate hook (out of scope for this tool) writes
 * the JSONL append-stream that this script drains.
 *
 * Per RFC-0068 §7 ISC-10 + §1 Problem statement: this is the first ground-truth
 * channel for the CAPABILITIES line in NATIVE/ALGORITHM banners. Pairing it
 * with the v0.0.8 Mode Classifier observability lets downstream analysis detect
 * under-/over-reporting drift mechanically (claimed-capabilities vs activated-
 * capabilities).
 *
 * Event shape (JSONL line):
 *   {
 *     timestamp: ISO-8601 string,
 *     skill_name: string,
 *     session_id: string,
 *     source: "ALGORITHM" | "NATIVE" | "MINIMAL",
 *     duration_ms?: number,
 *     project_path?: string
 *   }
 *
 * USAGE
 * -----
 *   bun SaveSkillActivationsToStudio.ts --import-all
 *   bun SaveSkillActivationsToStudio.ts --help
 */

import { readFileSync, existsSync } from 'fs';
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
// Project-aware MEMORY/STATE discovery
// ─────────────────────────────────────────────────────────────────────
//
// Mirrors SaveSignalsToStudio.getAllDirs — walks the global STATE dir
// plus every project's STATE dir registered in PROJECTS.md. Skill-activation
// events are STATE-mapped (per dlq TOOL_TO_SUBDIR convention) because the
// stream is operationally session-coordination data, parallel to sessions/.

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
    } catch { /* non-critical */ }
  }

  return dirs;
}

const { url: _STUDIO_API_URL, key: _STUDIO_API_KEY } =
  requireStudioConfigOrSkip('SaveSkillActivationsToStudio');

// ─────────────────────────────────────────────────────────────────────
// Event shape — claude_code.skill_activated minimal contract
// ─────────────────────────────────────────────────────────────────────
//
// `source` is one of NATIVE | ALGORITHM | MINIMAL — the Mode Classifier
// label for the response that triggered the activation. Pairing this with
// the existing Mode Classifier output lets Studio answer "did the
// CAPABILITIES line match what actually fired?" without re-parsing every
// transcript turn-by-turn.

const VALID_SOURCES = new Set(['NATIVE', 'ALGORITHM', 'MINIMAL']);

interface SkillActivationEntry {
  timestamp: string;
  skill_name: string;
  session_id: string;
  source: string;
  duration_ms?: number;
  project_path?: string;
}

interface SkillActivationPayload {
  sessionId: string;
  skillName: string;
  source: 'NATIVE' | 'ALGORITHM' | 'MINIMAL';
  activatedAt: string;
  durationMs?: number;
  projectPath?: string;
}

function normalizeSource(raw: string): 'NATIVE' | 'ALGORITHM' | 'MINIMAL' | null {
  const upper = String(raw ?? '').toUpperCase();
  if (VALID_SOURCES.has(upper)) return upper as 'NATIVE' | 'ALGORITHM' | 'MINIMAL';
  return null;
}

async function syncEntry(
  entry: SkillActivationEntry,
  acked: Set<string>,
): Promise<'synced' | 'skipped' | 'failed'> {
  const source = normalizeSource(entry.source);
  if (!source) return 'failed';

  const body: SkillActivationPayload = {
    sessionId: entry.session_id,
    skillName: entry.skill_name,
    source,
    activatedAt: entry.timestamp,
    ...(typeof entry.duration_ms === 'number' && Number.isFinite(entry.duration_ms)
      ? { durationMs: Math.max(0, Math.floor(entry.duration_ms)) }
      : {}),
    ...(entry.project_path ? { projectPath: entry.project_path } : {}),
  };

  // RFC-0062 F3 — refuse to enqueue a foreign-tenant payload. When
  // project_path is present and outside the tenant allowlist the gate
  // logs drift + skips. No project_path → pass-through (gate returns ok).
  const gate = crossTenantGate({
    tool: 'skill-activations',
    endpoint: '/api/v1/skills/activations',
    absPath: body.projectPath ?? null,
    source: 'SaveSkillActivationsToStudio',
    payload: body,
  });
  if (!gate.ok) return 'failed';

  // Idempotency-key contract per RFC-0062: digest the canonical body once
  // here so producer + Studio agree on the hash. Per-event scope (one
  // activation = one row) keeps replays a no-op even across drainer retries.
  //
  // Ack-dedup firewall (incident 2026-06-22): compute the key ONCE and reuse
  // the SAME variable for both the dedup check and the idempotencyKey, so a
  // skipped row can never diverge from what would have been enqueued. Rows
  // already in the ack ledger are skipped to stop --import-all re-flooding
  // the DLQ every SessionEnd.
  const key = `skill-activation:${entry.session_id}:${entry.skill_name}:${entry.timestamp}:${digestOfBody(body)}`;
  if (acked.has(key)) return 'skipped'; // already synced — skip

  const queueResult = await queueOrPost(body, '/api/v1/skills/activations', {
    tool: 'skill-activations',
    idempotencyKey: key,
  });
  if (queueResult.outcome === 'dropped') {
    console.error(
      `[SaveSkillActivationsToStudio] dropped ${entry.session_id}/${entry.skill_name}: ${queueResult.reason}`,
    );
    return 'failed';
  }
  return 'synced';
}

async function importAll(): Promise<void> {
  const stateDirs = getAllDirs('STATE');
  if (stateDirs.length === 0) {
    console.error('[SaveSkillActivationsToStudio] no STATE directories found');
    process.exit(0);
  }

  // Load the ack ledger ONCE before the loop — rows already synced (their
  // idempotencyKey is in the ledger) are skipped to stop re-flooding the DLQ
  // every SessionEnd (incident 2026-06-22).
  const acked = loadAckedKeys("skill-activation:");

  let synced = 0;
  let failed = 0;
  let skipped = 0;
  let total = 0;

  for (const stateDir of stateDirs) {
    const filepath = join(stateDir, 'skill-activations.jsonl');
    if (!existsSync(filepath)) continue;

    const lines = readFileSync(filepath, 'utf-8').split('\n').filter((l) => l.trim());
    total += lines.length;

    for (const line of lines) {
      try {
        const entry = JSON.parse(line) as SkillActivationEntry;
        if (!entry.session_id || !entry.skill_name || !entry.timestamp || !entry.source) {
          failed++;
          continue;
        }
        const result = await syncEntry(entry, acked);
        if (result === 'synced') synced++;
        else if (result === 'skipped') skipped++;
        else failed++;
      } catch {
        failed++;
      }
    }
  }

  console.error(
    `[SaveSkillActivationsToStudio] import complete: ${synced} synced, ${skipped} skipped (already acked), ${failed} failed (of ${total} total from ${stateDirs.length} dirs)`,
  );
}

function printHelp(): void {
  console.error(
    [
      'SaveSkillActivationsToStudio — drain skill_activated OTEL events to Studio',
      '',
      'Usage:',
      '  bun SaveSkillActivationsToStudio.ts --import-all',
      '  bun SaveSkillActivationsToStudio.ts --help',
      '',
      'Reads MEMORY/STATE/skill-activations.jsonl from every registered',
      'project (PROJECTS.md) plus the global ~/.claude/MEMORY/STATE/ dir,',
      'POSTs each event to Studio /api/v1/skills/activations via queueOrPost',
      '(DLQ-routed; idempotency-keyed per RFC-0062).',
      '',
      'Event shape per JSONL line:',
      '  { timestamp, skill_name, session_id, source: NATIVE|ALGORITHM|MINIMAL,',
      '    duration_ms?, project_path? }',
      '',
      'See: Plans/Specs/RFC-0068-dos-stability-dag-v009.md §7 ISC-10',
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
