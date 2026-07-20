#!/usr/bin/env bun
/**
 * MemPalaceDaemonEnsure.hook.ts — v0.0.20 campaign slice 0a-MEMORY.
 *
 * SUBSUMED AT SESSIONSTART (v0.0.20 lifecycle refactor): the ensure step now
 * runs INSIDE MemPalaceWakeUp.hook.ts (ensureThenQueryLiveContext), which owns
 * the ensure-then-query ordering as a program invariant. The orchestrator
 * de-registers THIS hook from the SessionStart event. It stays on disk and
 * fully functional standalone (`bun MemPalaceDaemonEnsure.hook.ts` still ensures
 * the daemon) for manual/diagnostic use and as a fallback.
 *
 * CORRECTED ORDERING ASSUMPTION: the original design assumed this hook ran
 * "STRICTLY BEFORE MemPalaceWakeUp". That was FALSE — SessionStart hooks run in
 * PARALLEL, not in registration order, so a separate ensure hook raced the
 * wake-up's cold live-KG queries (the operator-visible "degraded snapshot /
 * live-KG read timed out" banner). The fix is the in-process merge in
 * MemPalaceWakeUp, not hook ordering.
 *
 * SessionStart daemon-readiness port. Blocks briefly until the daemon answers a
 * cheap KG-level probe, so the first bridge consumer finds a daemon that is
 * provably answering instead of silently degrading to the cached snapshot.
 *
 * Behavior (all logic in lib/mempalace-daemon-ensure.ts; ratified by Council
 * 3-0 + RedTeam, wf_6cb97bbc-ce3):
 *  - bounded BLOCK (default 1500ms, DOS_DAEMON_ENSURE_CAP_MS) until a
 *    palace-level `status` probe answers → "warm"
 *  - daemon-unreachable → spawn under a PID+epoch_boot lock and let the Python
 *    daemon's own startup reap handle any stale socket (never unlink here)
 *  - cold outcomes fire the detached 60s warm tail (absorbed from the
 *    MemPalaceDaemonPrewarm hook, now a no-op shim)
 *  - ALWAYS exits 0 — fail-open; the session never bricks on memory (LEG-2)
 *
 * The single console line is the information radiator: operator sees daemon
 * state at session start without asking.
 */
import { startTimer, stopTimer } from './lib/hook-io';

const _t = startTimer('MemPalaceDaemonEnsure');
process.on('exit', () => stopTimer(_t, 'SessionStart'));

try {
  const { ensureDaemon } = await import('./lib/mempalace-daemon-ensure');
  const r = await ensureDaemon();
  if (r.state !== 'disabled') {
    const tail = r.warm_tail_fired ? ', warm-tail fired' : '';
    console.log(`🧠 Daemon ensure: ${r.state} (${r.detail}, ${r.elapsed_ms}ms${tail})`);
  }
} catch {
  // Fail-open — but do NOT lose the warm-up entirely: the prewarm hook is now
  // a no-op shim, so if the ensure lib itself fails to load/run, fall back to
  // the legacy detached worker spawn (the old prewarm hook body, inlined).
  try {
    if (process.env.DOS_USE_BRIDGE_DAEMON === '1') {
      const { spawn } = await import('child_process');
      const { existsSync } = await import('fs');
      const { dirname, join } = await import('path');
      const { fileURLToPath } = await import('url');
      const worker = join(
        dirname(fileURLToPath(import.meta.url)),
        'lib',
        'mempalace-prewarm-worker.ts',
      );
      if (existsSync(worker)) {
        const child = spawn(process.execPath, [worker], { detached: true, stdio: 'ignore', env: process.env });
        child.unref();
        console.log('🧠 Daemon ensure: fail-open (ensure-lib-error, legacy warm-tail fired)');
      }
    }
  } catch {
    // Truly fail-open — the first real call cold-loads as before this slice.
  }
}
process.exit(0);
