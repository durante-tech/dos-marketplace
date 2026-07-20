#!/usr/bin/env bun
/**
 * DrainPending.hook.ts — detached drain for .pending/ + .streaming/
 *
 * TRIGGER: SessionStart + SessionEnd
 *
 * PURPOSE:
 * Runs the full dlq.ts drain() outside the hook lifecycle. Hooks that
 * write to Studio (StudioSync + its registry-driven children, currently
 * 22 SYNC_TOOLS entries, StreamEventDispatcher) now queue-only — all
 * network I/O happens here.
 *
 * LIFECYCLE:
 *   SessionStart fire → foreground exits in ~20ms → detached child
 *     drains every .pending/ and .streaming/ dir, POSTs to Studio,
 *     appends ack rows, can take 30+ seconds with no hook timeout.
 *   SessionEnd fire → same, covers data StudioSync just queued.
 *
 * Why detached: Claude Code SIGTERMs the hook's process group when the
 * hook exits OR when the session teardown runs long. lib/detachWorker
 * respawns self with setsid() via child_process.spawn({ detached: true }),
 * so the drain survives any kill on the parent hook.
 *
 * Observability:
 *   foreground → hook-timing.jsonl (startTimer/stopTimer, ~20ms entry)
 *   background → MEMORY/STATE/hook-bg.jsonl ({ phase: spawned | done })
 *   drain itself → MEMORY/LEARNING/SYS/sync-drift-YYYYMMDD.jsonl per envelope
 *   successful POST → MEMORY/STATE/ack-YYYYMMDD.jsonl witness row
 *
 * Kill switch:
 *   DOS_DLQ_DRAIN=off  → hook returns immediately (foreground AND bg)
 *
 * Ledger-drain self-heal:
 *   On 403 unknown_key_id from /api/v1/ledger/receipts (DB reset, fresh
 *   deploy, or missing rotation registration), ledger-drain.ts deletes the
 *   `.key-registered` marker, POSTs the current public key, and retries the
 *   receipt once. Guarded to one re-register per invocation. This preserves
 *   ledger continuity across local-dev DB resets that wipe the `user_key`
 *   table. Receipts signed against a keyId the server has never seen remain
 *   unrecoverable and are moved to `pending-receipts/.quarantine/`.
 */

import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

import { drain } from './lib/dlq';
import { acquireDrainLock, releaseDrainLock } from './lib/dlq-lock';
import { loadProjectEnv, getDosDir } from './lib/paths';
import { runDetachedOrForeground, logBg } from './lib/detachWorker';
import { startTimer, stopTimer } from './lib/hook-io';

interface HookInput {
  session_id?: string;
  hook_event_name?: string;
}

async function heavyWork(input: HookInput): Promise<void> {
  const mode = (process.env.DOS_DLQ_DRAIN ?? 'on').toLowerCase();
  if (mode === 'off') return;

  // Load .gateway.env / .env so STUDIO_API_URL + STUDIO_API_KEY reach
  // postDirect() inside dlq.ts. The detached child inherits the harness
  // env, but .env files may only be loaded in-process.
  loadProjectEnv();

  // Every console.error in this function is written to the stderr of a worker that
  // detachWorker spawns with `stdio: 'ignore'`. It goes to /dev/null. That is why a
  // drain which has been skipping since April was indistinguishable from a healthy
  // one: hook-bg.jsonl recorded only `phase: done`. Mirror each diagnostic into the
  // structured log that detachWorker's own header calls the channel "so silent
  // failures are detectable". (Forge H-112.)
  if (!process.env.STUDIO_API_URL || !process.env.STUDIO_API_KEY) {
    console.error('[DrainPending] Studio creds missing; skipping drain');
    logBg({ hook: 'DrainPending', mode: 'bg', phase: 'skipped', reason: 'studio-creds-missing' });
    return;
  }

  const triggerEvent = input.hook_event_name ?? 'unknown';
  const drainMode = triggerEvent === 'SessionStart' ? 'startup' : 'session';

  // PRD ISC-B11/B12 — process-level lock. If another DrainPending child is
  // already running we exit cleanly; the existing holder will do the work
  // and the duplicate-drain-within-1-second race observed at 2026-05-05T05:16
  // stops costing us readdir + reclaim cycles. Stale-detection reclaims a lock
  // whose holder is not alive and whose age exceeds the grace window; the boot
  // epoch decides whether the holder's pid is meaningful (H-096).
  const lock = acquireDrainLock();
  if (!lock.acquired) {
    console.error(
      `[DrainPending] ${triggerEvent}: lock-contended (${lock.holder}); skipping drain`,
    );
    logBg({ hook: 'DrainPending', mode: 'bg', phase: 'skipped', reason: 'lock-contended', holder: lock.holder });
    return;
  }

  try {
    const report = await drain(drainMode);
    console.error(
      `[DrainPending] ${triggerEvent}: read=${report.read} posted=${report.posted} ` +
      `requeued=${report.requeued} quarantined=${report.quarantined} ` +
      `reclaimed=${report.reclaimed} errors=${report.errors.length}`,
    );
    logBg({
      hook: 'DrainPending',
      mode: 'bg',
      phase: 'report',
      trigger: triggerEvent,
      read: report.read,
      posted: report.posted,
      requeued: report.requeued,
      quarantined: report.quarantined,
      reclaimed: report.reclaimed,
      errors: report.errors.length,
    });
  } catch (err) {
    console.error('[DrainPending] drain failed:', err);
    logBg({ hook: 'DrainPending', mode: 'bg', phase: 'error', error: String(err) });
  } finally {
    releaseDrainLock();
  }

  // RFC-0007 Operator Ledger: drain ~/.claude/MEMORY/SECURITY/pending-receipts/
  // to Studio /api/v1/ledger/receipts. Shells out to the existing
  // ledger-drain.ts CLI — self-contained, registers public key lazily,
  // handles quarantine + retry classification internally.
  try {
    const mode = (process.env.DOS_LEDGER_DRAIN ?? 'on').toLowerCase();
    if (mode === 'off') {
      console.error(`[DrainPending] ledger-drain ${triggerEvent}: skipped (DOS_LEDGER_DRAIN=off)`);
    } else {
      // getDosDir() honors the DOS_DIR override, like every sibling. The prior
      // hardcode of ~/.claude meant that under a non-default DOS_DIR this spawn
      // resolved to a nonexistent path, spawnSync failed ENOENT, and the RFC-0007
      // operator-ledger receipt drain silently stopped — with no alert, since the
      // failure only reaches the /dev/null stderr of the detached worker. Latent
      // today (DOS_DIR == ~/.claude here), real on any customized install. (H-103.)
      const drainScript = join(getDosDir(), 'DOS', 'Tools', 'ledger-drain.ts');
      const proc = spawnSync('bun', [
        drainScript,
        '--api-key', process.env.STUDIO_API_KEY ?? '',
        '--endpoint', process.env.STUDIO_API_URL ?? '',
      ], { encoding: 'utf8', timeout: 60_000 });
      const out = String(proc.stdout ?? '');
      const summary = out.split('\n').find((l: string) => l.startsWith('Summary:')) ?? `exit=${proc.status}`;
      console.error(`[DrainPending] ledger-drain ${triggerEvent}: ${summary.trim()}`);
      // Same muted channel as the main drain: this whole block runs in the detached
      // child, so the console.error above and below go to /dev/null. Mirror the result
      // and any failure to the structured log, or a broken ledger drain looks healthy
      // (the H-112 fix, extended to the RFC-0007 ledger drain — Forge H-118).
      logBg({ hook: 'DrainPending', mode: 'bg', phase: 'ledger-drain', trigger: triggerEvent, status: proc.status, summary: summary.trim() });
      if (proc.status !== 0) {
        const errOut = String(proc.stderr ?? '');
        const errTail = errOut.split('\n').slice(0, 3).filter(Boolean).join(' | ');
        if (errTail) console.error(`[DrainPending] ledger-drain stderr: ${errTail}`);
        logBg({ hook: 'DrainPending', mode: 'bg', phase: 'ledger-drain-error', status: proc.status, stderr: errTail });
      }
    }
  } catch (err) {
    console.error('[DrainPending] ledger-drain spawn failed:', err);
    logBg({ hook: 'DrainPending', mode: 'bg', phase: 'ledger-drain-spawn-failed', error: String(err) });
  }
}

// Foreground timer only — background duration is captured in hook-bg.jsonl.
if (process.env.DOS_HOOK_BG !== '1') {
  const _t = startTimer('DrainPending');
  process.on('exit', () => stopTimer(_t, 'SessionStartOrEnd'));
}

runDetachedOrForeground<HookInput>({
  hookName: 'DrainPending',
  heavyWork,
}).catch((err) => {
  console.error('[DrainPending] Fatal:', err);
  process.exit(0);
});
