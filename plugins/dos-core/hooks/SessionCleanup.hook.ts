#!/usr/bin/env bun
/**
 * SessionCleanup.hook.ts - Mark Work Complete and Clear State (SessionEnd)
 *
 * PURPOSE:
 * Finalizes a Claude Code session by marking the current work directory as
 * COMPLETED, clearing session state, resetting Kitty tab, and cleaning up
 * session name entries.
 *
 * TRIGGER: SessionEnd
 *
 * INPUT:
 * - stdin: Hook input JSON (session_id, transcript_path)
 * - Files: MEMORY/STATE/current-work.json
 *
 * OUTPUT:
 * - stdout: None
 * - stderr: Status messages
 * - exit(0): Always (non-blocking)
 *
 * SIDE EFFECTS:
 * - Updates: MEMORY/WORK/<dir>/PRD.md or META.yaml (status: Implemented — canonical per RFC-0086 §4, V13.7-α 2026-05-13)
 * - Deletes: MEMORY/STATE/current-work.json (clears session state)
 * - Resets: Kitty tab title and color to defaults
 * - Cleans: session-names.json entry (prevents ghost entries)
 *
 * INTER-HOOK RELATIONSHIPS:
 * - COORDINATES WITH: WorkCompletionLearning (both run at SessionEnd)
 * - MUST RUN AFTER: WorkCompletionLearning (learning capture uses state before clear)
 *
 * PERFORMANCE:
 * - Non-blocking: Yes
 * - Typical execution: <50ms
 */

import { existsSync, readFileSync, unlinkSync, readdirSync, statSync } from 'fs';
import { atomicWriteSync } from './lib/atomic-write';
import { join } from 'path';
import { getISOTimestamp } from './lib/time';
import { setTabState, cleanupKittySession } from './lib/tab-setter';
import { getWorkDir } from './lib/paths';
import { startTimer, stopTimer } from './lib/hook-io';

const BASE_DIR = process.env.DOS_DIR || join(process.env.HOME!, '.claude');
const MEMORY_DIR = join(BASE_DIR, 'MEMORY');
const STATE_DIR = join(MEMORY_DIR, 'STATE');
const WORK_DIR = getWorkDir();

// Session-scoped state file lookup with legacy fallback
function findStateFile(sessionId?: string): string | null {
  if (sessionId) {
    const scoped = join(STATE_DIR, `current-work-${sessionId}.json`);
    if (existsSync(scoped)) return scoped;
  }
  const legacy = join(STATE_DIR, 'current-work.json');
  if (existsSync(legacy)) return legacy;
  return null;
}

interface CurrentWork {
  session_id: string;
  session_dir: string;
  created_at: string;
  prd_path?: string;
  // Legacy fields (backward compat)
  current_task?: string;
  task_title?: string;
  task_count?: number;
}

/**
 * Mark work directory as completed and clear session state
 */
function clearSessionWork(sessionId?: string): void {
  try {
    const stateFile = findStateFile(sessionId);
    if (!stateFile) {
      console.error('[SessionCleanup] No current work to complete');
      return;
    }

    // Read current work state
    const content = readFileSync(stateFile, 'utf-8');
    const currentWork: CurrentWork = JSON.parse(content);

    // Guard: don't process another session's state
    if (sessionId && currentWork.session_id !== sessionId) {
      console.error('[SessionCleanup] State file belongs to different session, skipping');
      return;
    }

    // Mark work directory as Implemented (canonical per RFC-0086 §4) — update PRD.md
    // frontmatter (primary) or META.yaml (legacy).
    //
    // V13.7-α canonical-terminology migration (2026-05-13):
    //   Legacy `status: COMPLETED` → canonical `status: Implemented` per RFC-0086 §4
    //   mechanical-metadata allowlist. `completed_at` write preserved because
    //   WorkCompletionLearning.hook.ts:208-210 still consumes it for duration calc;
    //   full `completed_at` retirement is V13.7-β (carries to v0.0.14) after
    //   WorkCompletionLearning migrates to a different timestamp source.
    if (currentWork.session_dir) {
      const workPath = join(WORK_DIR, currentWork.session_dir);
      const prdPath = join(workPath, 'PRD.md');
      const metaPath = join(workPath, 'META.yaml');
      let marked = false;

      // Primary: update PRD.md frontmatter (consolidated format) — atomic write
      // because SessionEnd hooks run in parallel and a torn write would
      // break PRDSigner's content-hash chain.
      if (existsSync(prdPath)) {
        const before = readFileSync(prdPath, 'utf-8');
        let prdContent = before.replace(/^status: ACTIVE$/m, 'status: Implemented');
        prdContent = prdContent.replace(/^completed_at: null$/m, `completed_at: "${getISOTimestamp()}"`);
        // Only write + mark when a transition ACTUALLY happened. If the status
        // line doesn't match (already Implemented, quoted, different whitespace),
        // String.replace no-ops and this used to write byte-identical content yet
        // still log 'Marked as Implemented' — a false completion signal to
        // WorkCompletionLearning / Studio (H-073). Gate on content change.
        if (prdContent !== before) {
          atomicWriteSync(prdPath, prdContent);
          marked = true;
        }
      }

      // Legacy fallback: update META.yaml if it exists
      if (existsSync(metaPath)) {
        const beforeMeta = readFileSync(metaPath, 'utf-8');
        let metaContent = beforeMeta.replace(/^status: "ACTIVE"$/m, 'status: "Implemented"');
        metaContent = metaContent.replace(/^completed_at: null$/m, `completed_at: "${getISOTimestamp()}"`);
        // Same content-changed gate as the PRD block (H-073): don't log a false
        // completion when the status line didn't actually transition.
        if (metaContent !== beforeMeta) {
          atomicWriteSync(metaPath, metaContent);
          marked = true;
        }
      }

      if (marked) {
        console.error(`[SessionCleanup] Marked work directory as Implemented: ${currentWork.session_dir}`);
      }
    }

    // Delete state file
    unlinkSync(stateFile);
    console.error('[SessionCleanup] Cleared session work state');

    // Clean session-names.json entry to prevent IDLE ghost on activity page
    if (sessionId || currentWork.session_id) {
      const sid = sessionId || currentWork.session_id;
      const snPath = join(STATE_DIR, 'session-names.json');
      try {
        if (existsSync(snPath)) {
          const names = JSON.parse(readFileSync(snPath, 'utf-8'));
          if (names[sid]) {
            delete names[sid];
            // RFC-0005 §13.1 R2: atomic write — session-names.json is read+rewritten
            // by multiple SessionEnd hooks concurrently; torn writes would orphan entries.
            atomicWriteSync(snPath, JSON.stringify(names, null, 2));
            console.error(`[SessionCleanup] Removed session ${sid} from session-names.json`);
          }
        }
      } catch (e) {
        console.error(`[SessionCleanup] Failed to clean session-names.json: ${e}`);
      }
    }
  } catch (error) {
    console.error(`[SessionCleanup] Error clearing session work: ${error}`);
  }
}

/**
 * RFC-0005 §13.2 R10: prune `next-session-context-*.md` snapshot files older
 * than 14 days. SessionContextSnapshot regenerates per-wing; stale ones linger
 * in MEMORY/STATE/ indefinitely otherwise. Fire-and-forget, non-blocking.
 */
const SNAPSHOT_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

function pruneStaleSnapshots(): void {
  try {
    if (!existsSync(STATE_DIR)) return;
    const now = Date.now();
    const entries = readdirSync(STATE_DIR, { withFileTypes: true });
    let pruned = 0;
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      if (!entry.name.startsWith('next-session-context-')) continue;
      if (!entry.name.endsWith('.md')) continue;
      const full = join(STATE_DIR, entry.name);
      try {
        const stat = statSync(full);
        if (now - stat.mtimeMs > SNAPSHOT_MAX_AGE_MS) {
          unlinkSync(full);
          pruned += 1;
        }
      } catch { /* skip files we can't stat/unlink */ }
    }
    if (pruned > 0) {
      console.error(`[SessionCleanup] Pruned ${pruned} stale session-context snapshot(s) (>14d)`);
    }
  } catch (err) {
    console.error(`[SessionCleanup] Snapshot prune error (non-fatal): ${err}`);
  }
}

async function main() {
  try {
    // Read input from stdin with timeout — SessionEnd hooks may receive
    // empty or slow stdin. Proceed regardless since state is read from disk.
    let sessionId: string | undefined;
    try {
      const input = await Promise.race([
        Bun.stdin.text(),
        new Promise<string>((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000))
      ]);
      if (input && input.trim()) {
        const parsed = JSON.parse(input);
        sessionId = parsed.session_id;
      }
    } catch {
      // Timeout or parse error — proceed without session_id
    }

    // Mark work as complete and clear state
    clearSessionWork(sessionId);

    // RFC-0005 §13.2 R10: prune stale next-session-context-*.md (>14d)
    pruneStaleSnapshots();

    // Reset Kitty tab to neutral styling — no lingering colored backgrounds
    try {
      setTabState({ title: '', state: 'idle', sessionId });
      console.error('[SessionCleanup] Tab reset to default styling');
    } catch {
      console.error('[SessionCleanup] Tab reset failed (non-critical)');
    }

    // Clean up per-session kitty env file (prevents unbounded file accumulation)
    if (sessionId) {
      cleanupKittySession(sessionId);
      console.error(`[SessionCleanup] Cleaned up kitty session: ${sessionId}`);
    }

    // Clean up stale intent/cooldown flag files (>24h old)
    try {
      const cutoff = Date.now() - 24 * 60 * 60 * 1000;
      // router-turn-*: per-turn classifier handshake state (router-trace.ts
      // writeTurnState) — same 24h sweep as the intent-* session files.
      // intent-canonical-* is swept by MemoryGardener state-gc, not here.
      const stalePatterns = ['intent-fired-', 'intent-cooldown-', 'router-turn-'];
      const stateFiles = readdirSync(STATE_DIR);
      let cleaned = 0;
      for (const file of stateFiles) {
        if (!stalePatterns.some(p => file.startsWith(p))) continue;
        const filePath = join(STATE_DIR, file);
        try {
          if (statSync(filePath).mtimeMs < cutoff) {
            unlinkSync(filePath);
            cleaned++;
          }
        } catch { /* skip individual file errors */ }
      }
      if (cleaned > 0) {
        console.error(`[SessionCleanup] Cleaned ${cleaned} stale intent flag files`);
      }
    } catch { /* non-critical */ }

    console.error('[SessionCleanup] Session ended, work marked complete');
    process.exit(0);
  } catch (error) {
    // Silent failure - don't disrupt workflow
    console.error(`[SessionCleanup] SessionEnd hook error: ${error}`);
    process.exit(0);
  }
}

const _t = startTimer('SessionCleanup');
process.on('exit', () => stopTimer(_t, 'SessionEnd'));
main();
