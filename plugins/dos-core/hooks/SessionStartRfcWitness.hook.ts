#!/usr/bin/env bun
/**
 * SessionStartRfcWitness.hook.ts — RFC-0079 Phase 4 SessionStart integration.
 *
 * PURPOSE
 * -------
 * Runs `bun ~/Durante/Tools/rfc-witness.ts --json` at SessionStart, snapshots
 * the result to `MEMORY/STATE/rfc-witness-snapshot.json`, and emits a single
 * banner line into the conversation when drift is detected. Silent on clean.
 *
 * Same architectural shape as MemoryObservationRadiator (additionalContext
 * via hookSpecificOutput) and StudioBannerCache (snapshot to STATE), but
 * scoped to RFC corpus drift rather than memory ops or org context.
 *
 * TRIGGER
 * -------
 * SessionStart (registered in settings.json alongside MemPalaceWakeUp,
 * StudioBannerCache, etc.). Fires once per session.
 *
 * BEHAVIOR
 * --------
 * 1. Spawn `bun ~/Durante/Tools/rfc-witness.ts --json` (timeout 5s).
 * 2. Parse JSON; tolerate any failure (network/exec/parse) by silently
 *    exiting 0 — RFC drift detection must NEVER break SessionStart.
 * 3. Write snapshot to `MEMORY/STATE/rfc-witness-snapshot.json` with the
 *    raw report + meta (ts, exit_code).
 * 4. If drift > 0 OR parse_errors > 0: emit a one-line banner via
 *    `additionalContext`. Otherwise emit `{}` (silent).
 *
 * SNAPSHOT SHAPE
 * --------------
 *   {
 *     ts: 1714000000000,
 *     exit_code: 0 | 1 | 2,
 *     witnessed: 5,
 *     verified: 21,
 *     drift: 0,
 *     parse_errors: 0,
 *     drift_rfcs: ["RFC-0035", ...],   // populated only when drift > 0
 *     report: <raw RunReport JSON>,    // for downstream consumers
 *   }
 *
 * BANNER FORMAT
 * -------------
 * Drift example:
 *   "📜 RFC drift: 2 RFC(s) with 3 missing deliverable(s) — run: bun
 *    ~/Durante/Tools/rfc-witness.ts --full"
 *
 * Parse-error example:
 *   "📜 RFC manifest error: 1 RFC frontmatter parse failure — run: bun
 *    ~/Durante/Tools/rfc-witness.ts --full"
 *
 * Capped at 200 chars to stay aligned with the radiator convention.
 *
 * SAFETY
 * ------
 * - Subagent sessions: skip (no banner pollution in delegated work).
 * - Tool missing: silent skip.
 * - Timeout (>5s): silent skip — corpus is small, but defense in depth.
 * - Exec / parse failure: silent skip + breadcrumb for diagnostics.
 * - Snapshot write failure: non-fatal, banner still emits.
 * - Always exits 0; banner emission failures must never break SessionStart.
 *
 * Spec: Plans/Specs/RFC-0079-rfc-witness-corpus-drift-detector.md
 * Sprint slot: V11.23 (Phase 4 + 5 + 6).
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { getDosDir } from './lib/paths';

const MAX_BANNER_CHARS = 200;
const WITNESS_TIMEOUT_MS = 5_000;

const STATE_DIR = join(getDosDir(), 'MEMORY', 'STATE');
const SNAPSHOT_PATH = join(STATE_DIR, 'rfc-witness-snapshot.json');
const WITNESS_TOOL = join(homedir(), 'Durante', 'Tools', 'rfc-witness.ts');

/**
 * Subset of the witness tool's RunReport — only the fields this hook reads.
 * The tool's full schema lives in Tools/rfc-witness.ts; we keep the
 * snapshot's `report` field as `RunReport` to preserve the rest of the
 * payload for downstream consumers without binding to it.
 */
interface RfcReport {
  rfc_id: string;
  witnessed: boolean;
  parse_error?: string;
  drift: number;
}

interface RunReport {
  witnessed: number;
  total_verified: number;
  total_drift: number;
  total_parse_errors: number;
  rfcs: RfcReport[];
  exit_code: 0 | 1 | 2;
}

interface SnapshotRecord {
  ts: number;
  exit_code: 0 | 1 | 2;
  witnessed: number;
  verified: number;
  drift: number;
  parse_errors: number;
  drift_rfcs: string[];
  report: RunReport;
}

function isSubagent(): boolean {
  if (process.env.CLAUDE_AGENT_TYPE !== undefined) return true;
  const claudeProjectDir = process.env.CLAUDE_PROJECT_DIR || '';
  return claudeProjectDir.includes('/.claude/Agents/');
}

function emit(payload: Record<string, unknown>): void {
  try {
    process.stdout.write(JSON.stringify(payload));
  } catch {
    // stdout closed — silent
  }
}

function buildSnapshot(report: RunReport): SnapshotRecord {
  const drift_rfcs: string[] = [];
  for (const rfc of report.rfcs) {
    if (rfc.parse_error || (rfc.witnessed && rfc.drift > 0)) {
      drift_rfcs.push(rfc.rfc_id);
    }
  }
  return {
    ts: Date.now(),
    exit_code: report.exit_code,
    witnessed: report.witnessed,
    verified: report.total_verified,
    drift: report.total_drift,
    parse_errors: report.total_parse_errors,
    drift_rfcs,
    report,
  };
}

function buildBanner(snap: SnapshotRecord): string | null {
  // Parse errors take precedence — they signal a bad frontmatter that may
  // be hiding deliverable drift behind a YAML failure.
  if (snap.parse_errors > 0) {
    const word = snap.parse_errors === 1 ? 'failure' : 'failures';
    let line = `📜 RFC manifest error: ${snap.parse_errors} RFC frontmatter parse ${word} — run: bun ~/Durante/Tools/rfc-witness.ts --full`;
    if (line.length > MAX_BANNER_CHARS) line = line.slice(0, MAX_BANNER_CHARS - 1) + '…';
    return line;
  }

  if (snap.drift > 0) {
    const rfcCount = snap.drift_rfcs.length;
    const rfcWord = rfcCount === 1 ? 'RFC' : 'RFCs';
    const delWord = snap.drift === 1 ? 'deliverable' : 'deliverables';
    let line = `📜 RFC drift: ${rfcCount} ${rfcWord} with ${snap.drift} missing ${delWord} — run: bun ~/Durante/Tools/rfc-witness.ts --full`;
    if (line.length > MAX_BANNER_CHARS) line = line.slice(0, MAX_BANNER_CHARS - 1) + '…';
    return line;
  }

  return null;
}

function writeSnapshot(snap: SnapshotRecord): void {
  try {
    mkdirSync(STATE_DIR, { recursive: true });
    writeFileSync(SNAPSHOT_PATH, JSON.stringify(snap, null, 2));
  } catch {
    // Snapshot is observability — banner emission survives a write failure.
  }
}

function runWitness(): RunReport | null {
  if (!existsSync(WITNESS_TOOL)) return null;

  // The witness tool's findRepoRoot() ascends from cwd looking for
  // Plans/Specs/. Anchor cwd to ~/Durante so the lookup succeeds
  // regardless of where SessionStart fires from (worktrees, /tmp, etc.).
  const repoRoot = join(homedir(), 'Durante');
  if (!existsSync(join(repoRoot, 'Plans', 'Specs'))) return null;

  let result;
  try {
    result = spawnSync('bun', [WITNESS_TOOL, '--json'], {
      encoding: 'utf-8',
      timeout: WITNESS_TIMEOUT_MS,
      cwd: repoRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch {
    return null;
  }

  // Exit 0/1/2 are all defined-good outputs from the tool; only treat
  // signal-based termination (e.g. timeout) as a failure.
  if (result.signal !== null) return null;
  if (result.error) return null;

  const stdout = (result.stdout || '').toString().trim();
  if (!stdout) return null;

  try {
    return JSON.parse(stdout) as RunReport;
  } catch {
    return null;
  }
}

function main(): void {
  // Skip subagents to avoid banner pollution in delegated work
  if (isSubagent()) {
    emit({});
    return;
  }

  const report = runWitness();
  if (!report) {
    emit({});
    return;
  }

  const snap = buildSnapshot(report);
  writeSnapshot(snap);

  const banner = buildBanner(snap);
  if (banner === null) {
    emit({});
    return;
  }

  emit({
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext: banner,
    },
  });
}

try {
  main();
} catch {
  // Hard-fail safe: never break SessionStart.
  emit({});
}

process.exit(0);
