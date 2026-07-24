/**
 * mempalace-daemon-ensure.ts — v0.0.20 campaign slice 0a-MEMORY.
 *
 * SessionStart "daemon ensure": a bounded BLOCK until the daemon answers a
 * cheap KG-level probe, so the first bridge consumer in the SessionStart
 * sequence (MemPalaceWakeUp, which runs with 200ms-per-call budgets) finds a
 * daemon that is provably answering instead of silently degrading to the
 * cached snapshot.
 *
 * Ratified design (Council 3-0 option C + RedTeam mitigations, wf_6cb97bbc-ce3;
 * PRD 20260610-153232_v0020-slice-0a-memory; /code-review remediation pass):
 *
 *  - DELEGATE-REAP-TO-BINDER. We NEVER unlink the socket client-side. On darwin
 *    a connect() against a live cold-loading daemon whose serial accept backlog
 *    is full returns ECONNREFUSED — a client unlink would orphan that live
 *    daemon's socket and let a second daemon bind a fresh one: two writers, one
 *    HNSW index (the corruption class the daemon's MP-090 reap guards against).
 *    On ECONNREFUSED we spawn the Python daemon and let ITS startup sequence
 *    (_maybe_unlink_stale_socket + the EADDRINUSE bind backstop) decide whether
 *    the socket is stale. Spawning is always safe; unlinking is not.
 *
 *  - ASSUME-LIVE on connect-timeout (mirror of the daemon's MP-090 bias): a
 *    connect timeout may be a busy daemon, not a dead one. No ensure-spawn.
 *
 *  - SPAWN LOCK. O_EXCL lockfile holding {pid, epoch_boot, started_at} so
 *    concurrent sessions' ensure hooks spawn at most one daemon. Stale-holder
 *    reclaim uses write-tmp + atomic-rename + read-back-confirm (the dlq-lock
 *    pattern) so two racing reclaimers cannot both believe they won. EADDRINUSE
 *    remains the last-resort backstop, not the coordination mechanism.
 *
 *  - CHEAP PROBE, HONEST WARM. The phase-1 probe is `kg_stats` (SQLite-only) —
 *    exactly the readiness MemPalaceWakeUp's kg_query_predicate calls need —
 *    bounded at 400ms. The heavyweight `status` action (which can trigger a
 *    full wing-index rebuild) is deliberately NOT used on the boot path, and a
 *    kg_stats answer is reported as `warm` for KG purposes only.
 *
 *  - WARM TAIL ALWAYS. The detached 60s prewarm worker (absorbed from the
 *    MemPalaceDaemonPrewarm hook — retired 2026-07-21) fires on EVERY non-disabled
 *    outcome — including `warm` — preserving the old hook's unconditional
 *    contract: the worker's `search` forces the ONNX-model warm-up that
 *    kg_stats cannot prove, and is a cheap ~50ms no-op when already warm. Its
 *    connect-or-spawn runs outside the ensure lock by design (legacy behavior;
 *    protected by the daemon's EADDRINUSE backstop).
 *
 *  - FAIL-OPEN, HARD CAP. Default 1500ms (DOS_DAEMON_ENSURE_CAP_MS, clamped to
 *    [250, 15000]); every awaited probe — including the autoSpawn path, whose
 *    internal SPAWN_GRACE is not cap-aware — is raced against the remaining
 *    budget. Past the cap the session proceeds untouched (campaign LEG-2).
 */
import { spawn } from 'child_process';
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
  writeSync,
} from 'fs';
import { homedir, uptime as osUptime } from 'node:os';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import { bridgeAsyncDaemon, type DaemonResult } from './mempalace-daemon';
import { applyPluginEnvSeams } from './plugin-data-env';

// Do not rely on mempalace-daemon's seam application here: these two modules
// intentionally form a runtime cycle, so this module can evaluate first.
const RUNTIME_ENV = applyPluginEnvSeams(process.env);
const DOS_DIR = RUNTIME_ENV.DOS_DIR || join(homedir(), '.claude');
const ENSURE_LOCK_PATH = join(DOS_DIR, 'MEMORY', 'STATE', '.daemon-ensure.lock');
// Code follows the module, not DOS_DIR: plugin mode deliberately points
// DOS_DIR at persistent data, while this worker ships beside this file.
const PREWARM_WORKER_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  'mempalace-prewarm-worker.ts',
);

/**
 * Boot-epoch identity. NOTE: intentionally simpler than dlq-lock's
 * bootEpochSeconds() (no /proc/stat btime branch) — Date.now()/uptime drift of
 * ±1s is tolerated because the reclaim predicate below also requires a dead
 * holder PID; epoch only disambiguates PID reuse across reboots.
 */
const BOOT_EPOCH = Math.round(Date.now() / 1000 - osUptime());
/** A spawn lock whose holder PID is gone and older than this is reclaimable. */
const LOCK_STALE_MS = 30_000;

const DEFAULT_CAP_MS = 1500;
const CAP_FLOOR_MS = 250;
const CAP_CEILING_MS = 15_000;
/** Phase-1 probe budget — a warm daemon answers kg_stats in ~50ms. */
const PROBE_REQUEST_MS = 400;

export type EnsureState = 'disabled' | 'warm' | 'spawned-cold-warming' | 'fail-open';

export interface EnsureResult {
  state: EnsureState;
  /** Machine-greppable cause: fast-warm | palace-cold | spawned-bound | bound-by-other |
   *  connect-timeout-assume-live | no-bind-within-cap | spawn-failed | spawn-lock-held |
   *  flag-off | error:<msg> */
  detail: string;
  elapsed_ms: number;
  warm_tail_fired: boolean;
}

/** Injectable probe seam for tests — production default is bridgeAsyncDaemon. */
export type DaemonProbe = (
  action: string,
  args: Record<string, unknown>,
  options: { connectTimeoutMs?: number; requestTimeoutMs?: number; autoSpawn?: boolean },
) => Promise<DaemonResult>;

export interface EnsureOptions {
  capMs?: number;
  /** Fire the detached warm tail (default true — the legacy unconditional contract). */
  fireWarmTail?: boolean;
  probe?: DaemonProbe;
  /** Injectable warm-tail spawner for tests. */
  spawnWarmTail?: () => boolean;
  /** Lock-file path override for tests. */
  lockPath?: string;
}

function clampCap(raw: number | undefined): number {
  const fromEnv = Number(process.env.DOS_DAEMON_ENSURE_CAP_MS);
  const candidate = raw ?? (Number.isFinite(fromEnv) && fromEnv > 0 ? fromEnv : DEFAULT_CAP_MS);
  return Math.min(CAP_CEILING_MS, Math.max(CAP_FLOOR_MS, candidate));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Race a probe against the remaining cap budget. bridgeAsyncDaemon's autoSpawn
 * path carries an internal SPAWN_GRACE that is not cap-aware; the race keeps
 * the advertised cap a HARD ceiling. An abandoned probe finishes (or times out)
 * harmlessly in the background — it holds no lock and never unlinks.
 */
function raceWithBudget(p: Promise<DaemonResult>, budgetMs: number): Promise<DaemonResult | 'budget-exceeded'> {
  if (budgetMs <= 0) return Promise.resolve('budget-exceeded');
  return Promise.race([
    p,
    sleep(budgetMs).then(() => 'budget-exceeded' as const),
  ]);
}

function pidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * O_EXCL spawn lock. Returns true when this process holds the lock.
 * No-file path: atomic O_EXCL create. Stale-reclaim path: write-tmp +
 * atomic-rename + read-back-confirm (two racing reclaimers cannot both win —
 * the rename loser's read-back shows the winner's pid). Reclaim only from a
 * provably-dead holder: PID gone AND (different boot OR older than 30s).
 */
export function acquireSpawnLock(lockPath: string = ENSURE_LOCK_PATH): boolean {
  const payload = JSON.stringify({ pid: process.pid, epoch_boot: BOOT_EPOCH, started_at: Date.now() });
  const tryExclusiveCreate = (): boolean => {
    try {
      mkdirSync(dirname(lockPath), { recursive: true });
      const fd = openSync(lockPath, 'wx');
      writeSync(fd, payload);
      closeSync(fd);
      return true;
    } catch {
      return false;
    }
  };
  if (tryExclusiveCreate()) return true;
  try {
    const holder = JSON.parse(readFileSync(lockPath, 'utf8')) as {
      pid?: number;
      epoch_boot?: number;
      started_at?: number;
    };
    const holderDead = typeof holder.pid !== 'number' || !pidAlive(holder.pid);
    const differentBoot = holder.epoch_boot !== BOOT_EPOCH;
    const aged = typeof holder.started_at !== 'number' || Date.now() - holder.started_at > LOCK_STALE_MS;
    if (holderDead && (differentBoot || aged)) {
      // Atomic-rename reclaim (dlq-lock pattern): never unlink-then-create,
      // which lets a racing reclaimer delete OUR fresh lock.
      const tmp = `${lockPath}.${process.pid}.tmp`;
      // writeArtifact:exempt — atomic spawn-lock scratch file, renamed immediately
      writeFileSync(tmp, payload);
      renameSync(tmp, lockPath);
      const after = JSON.parse(readFileSync(lockPath, 'utf8')) as { pid?: number };
      return after.pid === process.pid;
    }
  } catch {
    // Unreadable lock or fs hiccup — back off; a skipped ensure-spawn is
    // cheaper than a double-spawn race.
  }
  return false;
}

export function releaseSpawnLock(lockPath: string = ENSURE_LOCK_PATH): void {
  try {
    const holder = JSON.parse(readFileSync(lockPath, 'utf8')) as { pid?: number };
    if (holder.pid === process.pid) unlinkSync(lockPath);
  } catch {
    // Already gone or not ours — nothing to release.
  }
}

/**
 * Detached warm tail — the absorbed body of the retired MemPalaceDaemonPrewarm hook.
 * Forces the ~11s palace cold-load (incl. ONNX model) in the background so the
 * next consumer finds a warm daemon. Exported so the ensure HOOK can use it as
 * a last-resort fallback when this module's heavier path fails.
 */
export function spawnWarmTailDetached(): boolean {
  try {
    if (!existsSync(PREWARM_WORKER_PATH)) return false;
    const child = spawn(process.execPath, [PREWARM_WORKER_PATH], {
      detached: true,
      stdio: 'ignore',
      env: process.env,
    });
    child.unref();
    return child.pid != null;
  } catch {
    return false;
  }
}

export async function ensureDaemon(opts: EnsureOptions = {}): Promise<EnsureResult> {
  const t0 = performance.now();
  const elapsed = () => Math.round(performance.now() - t0);
  const fireTail = opts.fireWarmTail !== false;
  const probe: DaemonProbe = opts.probe ?? bridgeAsyncDaemon;
  const tailSpawner = opts.spawnWarmTail ?? spawnWarmTailDetached;
  const lockPath = opts.lockPath ?? ENSURE_LOCK_PATH;

  if (process.env.DOS_USE_BRIDGE_DAEMON !== '1') {
    return { state: 'disabled', detail: 'flag-off', elapsed_ms: elapsed(), warm_tail_fired: false };
  }

  const capMs = clampCap(opts.capMs);
  const remaining = () => Math.max(0, capMs - elapsed());

  // Warm tail fires on EVERY non-disabled outcome (legacy unconditional contract).
  const finish = (state: Exclude<EnsureState, 'disabled'>, detail: string): EnsureResult => ({
    state,
    detail,
    elapsed_ms: elapsed(),
    warm_tail_fired: fireTail ? tailSpawner() : false,
  });

  try {
    // Phase 1 — one cheap, non-spawning KG-level probe classifies the socket.
    const first = await raceWithBudget(
      probe('kg_stats', {}, {
        autoSpawn: false,
        connectTimeoutMs: Math.min(250, remaining()),
        requestTimeoutMs: Math.min(PROBE_REQUEST_MS, Math.max(1, remaining())),
      }),
      remaining(),
    );
    if (first === 'budget-exceeded') return finish('fail-open', 'no-bind-within-cap');
    if (first.ok) return finish('warm', 'fast-warm');

    if (first.reason === 'request-timeout') {
      // Connected (daemon live) but slow — still cold-loading.
      return finish('spawned-cold-warming', 'palace-cold');
    }
    if (first.reason === 'connect-timeout') {
      // MP-090 assume-live: maybe a busy serial accept loop. No ensure-spawn.
      return finish('fail-open', 'connect-timeout-assume-live');
    }
    if (first.reason === 'action-error') {
      // Daemon answered with an error envelope — it is up and dispatching.
      return finish('spawned-cold-warming', `action-error:${first.detail ?? 'unknown'}`);
    }
    if (first.reason !== 'daemon-unreachable' && first.reason !== 'spawn-failed') {
      return finish('fail-open', `error:${first.reason}`);
    }

    // Phase 2 — daemon-unreachable: ENOENT (no socket) or ECONNREFUSED (stale
    // socket OR full backlog). Delegate-reap-to-binder: spawn under lock and
    // let the daemon's startup reap + EADDRINUSE backstop decide.
    const haveLock = acquireSpawnLock(lockPath);
    try {
      if (haveLock && remaining() > 0) {
        const spawned = await raceWithBudget(
          probe('daemon_status', {}, {
            autoSpawn: true,
            connectTimeoutMs: Math.min(250, remaining()),
            requestTimeoutMs: Math.min(1000, Math.max(1, remaining())),
          }),
          remaining(),
        );
        if (spawned === 'budget-exceeded') return finish('fail-open', 'no-bind-within-cap');
        if (spawned.ok) return finish('spawned-cold-warming', 'spawned-bound');
        if (spawned.reason === 'spawn-failed') {
          // The daemon binary cannot start — polling would only burn the cap.
          return finish('fail-open', 'spawn-failed');
        }
      }
      // No lock (another session is spawning) or the first attempt missed:
      // poll bind-level liveness with tight per-tick bounds until the cap.
      while (remaining() > 0) {
        await sleep(Math.min(150, remaining()));
        if (remaining() <= 0) break;
        const poll = await raceWithBudget(
          probe('daemon_status', {}, {
            autoSpawn: false,
            connectTimeoutMs: Math.min(100, remaining()),
            requestTimeoutMs: Math.min(250, Math.max(1, remaining())),
          }),
          remaining(),
        );
        if (poll === 'budget-exceeded') break;
        if (poll.ok) return finish('spawned-cold-warming', haveLock ? 'spawned-bound' : 'bound-by-other');
      }
      return finish('fail-open', haveLock ? 'no-bind-within-cap' : 'spawn-lock-held');
    } finally {
      if (haveLock) releaseSpawnLock(lockPath);
    }
  } catch (err) {
    return finish('fail-open', `error:${(err as Error).message ?? String(err)}`);
  }
}

/** Test surface — lock path + boot epoch (mirrors __dlqLockInternals convention). */
export const __ensureInternals = {
  ENSURE_LOCK_PATH,
  BOOT_EPOCH,
  LOCK_STALE_MS,
  DEFAULT_CAP_MS,
  PROBE_REQUEST_MS,
  clampCap,
};
