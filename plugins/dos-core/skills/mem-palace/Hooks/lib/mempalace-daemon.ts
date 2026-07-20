/**
 * MemPalace Bridge Daemon — TypeScript client shim (RFC-0075 V11.18 Phase 3).
 *
 * Lightweight Unix-socket client that hooks can use INSTEAD of spawning the
 * `python3 mempalace_bridge.py` subprocess. Connects to the persistent
 * `mempalace_daemon.py` listening on `$DOS_DIR/MEMORY/STATE/.mempalace.sock`,
 * sends one JSON line, reads one JSON line, closes.
 *
 * Lifecycle: connect-or-spawn
 * ---------------------------
 * 1. Try to connect to the existing socket (cheap — ~0.1ms when daemon is up)
 * 2. If ECONNREFUSED / ENOENT, spawn the daemon detached (the exact plugin
 *    uv environment in plugin mode; legacy `python3` in maintainer mode)
 *    and retry the connect with a short timeout
 * 3. If still failing, fall back to the existing subprocess path via the
 *    caller's `bridgeAsync` (we expose `bridgeAsyncDaemon` for hooks; if it
 *    rejects with `BridgeFail`, callers retry through their existing
 *    subprocess code path)
 *
 * This module DOES NOT modify the existing mempalace.ts surface — that is
 * V11.7/V11.12/V11.21 territory. Once V11.18 ships and soaks, a follow-up
 * agent will migrate `bridgeSync` / `bridgeFire` to call this shim under
 * the `DOS_USE_BRIDGE_DAEMON=1` toggle (RFC-0075 Phase 4).
 *
 * Why opt-in via env toggle (RFC-0075 Phase 4 design)
 * ---------------------------------------------------
 * The daemon is new substrate. We let it accumulate soak hours under a
 * narrow set of callers (smoke tests + this module's direct consumers)
 * before migrating the 15+ hooks that touch MemPalace. The toggle keeps
 * the rollback to "git revert one hook" instead of "rip out the daemon".
 *
 * Failure mode contract
 * ---------------------
 * - Returns BridgeOk<T> on success
 * - Returns BridgeFail with structured `reason` on every failure
 * - NEVER throws — callers can `await` without try/catch wrapping
 * - On daemon-unreachable, returns `{ ok: false, reason: 'daemon-unreachable' }`
 *   so the caller knows to fall back to subprocess
 */

import { spawn } from 'child_process';
import { connect, type Socket } from 'net';
import { dirname, join } from 'path';
import { existsSync } from 'fs';
import { homedir } from 'os';
import { fileURLToPath } from 'url';
// Reuse the ensure-hook's spawn lock so the shim's per-call autoSpawn and the
// SessionStart ensure-spawn coordinate on ONE lock file (.daemon-ensure.lock),
// not two — closing the shim-vs-ensure duplicate-daemon race (incident 2026-06-22).
// Runtime-only cycle (ensure imports bridgeAsyncDaemon from here); both bindings
// are hoisted function decls called at runtime, so the cycle resolves cleanly.
import { acquireSpawnLock, releaseSpawnLock } from './mempalace-daemon-ensure';
import {
  applyPluginEnvSeams,
  buildPluginPythonLaunch,
  isPluginInstall,
  PLUGIN_CODE_PATHS,
  type RuntimeEnv,
} from './plugin-data-env';

// Dependencies execute before importers, so this overlay also fixes the
// module-level DOS_DIR/MEMPALACE_DIR constants in hooks that import this shim.
const RUNTIME_ENV = applyPluginEnvSeams(process.env);
const DOS_DIR = RUNTIME_ENV.DOS_DIR || join(homedir(), '.claude');

/** The persistent daemon's socket path. Mirrors bridge_daemon.py's resolution. */
export const DAEMON_SOCKET_PATH =
  RUNTIME_ENV.MEMPALACE_DAEMON_SOCKET ||
  join(DOS_DIR, 'MEMORY', 'STATE', '.mempalace.sock');

/**
 * Where the daemon binary lives — resolved plugin-aware (V23-W2-S6 Finding 4,
 * Docs/Research/v0023-w2-s6-real-daemon-under-plugin-2026-07-07.md).
 *
 * Two candidate shapes, probed live-install-first:
 *
 *   1. LIVE-INSTALL shape: `$DOS_DIR/DOS/Tools/mempalace_daemon.py` — the
 *      maintainer/operator topology, where DOS_DIR defaults to `~/.claude`
 *      (a real, populated install). Wins whenever it actually exists on
 *      disk — this is the original, unchanged resolution.
 *
 *   2. PLUGIN-TREE shape: derived from the canonical MemPalace vendored lock,
 *      NOT DOS_DIR and not a fixed number of parent directories. dos-core
 *      emits this library both at `hooks/lib` and at
 *      `skills/mem-palace/Hooks/lib`; both copies resolve the same daemon at
 *      `${CLAUDE_PLUGIN_ROOT}/skills/mem-palace/Tools/bridge_daemon.py`.
 *      `plugin-data-env.ts` owns this dual-layout contract.
 *
 * `mempalace_daemon.py` / `bridge_daemon.py` are the same file under the
 * install-alias-rename convention (see `.dos-sync-manifest.json` aliases —
 * pack-canonical name `bridge_daemon.py`, install-alias `mempalace_daemon.py`,
 * mirroring the `bridge.py` → `mempalace_bridge.py` precedent).
 */
/**
 * `new URL(url).pathname` does NOT percent-decode (a module path containing
 * `%20`, `#`, or other encodable characters resolves wrong); `fileURLToPath`
 * does the full, platform-correct file-URL → path conversion. Exported as a
 * pure helper so the percent-decoding behavior is directly testable without
 * needing an on-disk fixture with an encodable path.
 */
export function dirFromModuleUrl(url: string): string {
  return dirname(fileURLToPath(url));
}

/** Live-install candidate (unchanged legacy resolution). */
export const LIVE_INSTALL_DAEMON_SCRIPT_PATH = join(DOS_DIR, 'DOS', 'Tools', 'mempalace_daemon.py');

/** Plugin-tree candidate shared by both emitted helper depths. */
export const PLUGIN_TREE_DAEMON_SCRIPT_PATH = PLUGIN_CODE_PATHS.daemonPath;

export type DaemonScriptResolution =
  | { ok: true; path: string; source: 'live-install' | 'plugin-tree' }
  | { ok: false; detail: string };

/**
 * Resolve the daemon script path, live-install-first, plugin-tree-fallback.
 * Pure aside from the injectable `exists` predicate (defaults to
 * `fs.existsSync`) — tests drive it with fake candidate paths + a fake
 * predicate instead of depending on real filesystem state. Returns a
 * structured failure naming BOTH probed paths when neither exists, so
 * callers (spawnDaemon below) can surface a clear, actionable error instead
 * of a bare "spawn returned no pid".
 */
export function resolveDaemonScriptPath(
  livePath: string = LIVE_INSTALL_DAEMON_SCRIPT_PATH,
  pluginTreePath: string = PLUGIN_TREE_DAEMON_SCRIPT_PATH,
  exists: (p: string) => boolean = existsSync,
): DaemonScriptResolution {
  if (exists(livePath)) return { ok: true, path: livePath, source: 'live-install' };
  if (exists(pluginTreePath)) return { ok: true, path: pluginTreePath, source: 'plugin-tree' };
  return {
    ok: false,
    detail:
      `mempalace-daemon: cannot locate the daemon script binary. Probed live-install path ` +
      `"${livePath}" (DOS_DIR-relative) and plugin-tree path "${pluginTreePath}" ` +
      `(derived from the MemPalace vendored lock) — neither exists.`,
  };
}

/**
 * Best-effort constant kept for backward compatibility with any existing
 * import of `DAEMON_SCRIPT_PATH` as a plain string. Computed once at module
 * load via `resolveDaemonScriptPath()`; falls back to the live-install shape
 * (matching pre-W2-S6 behavior) when neither candidate exists at import
 * time. Prefer calling `resolveDaemonScriptPath()` directly where the
 * failure detail matters (e.g. spawnDaemon()).
 */
export const DAEMON_SCRIPT_PATH = (() => {
  const resolution = resolveDaemonScriptPath();
  return resolution.ok ? resolution.path : LIVE_INSTALL_DAEMON_SCRIPT_PATH;
})();

/**
 * Default timeouts. Connect timeout is short (we want to fall back fast if
 * daemon is dead). Request timeout matches the existing subprocess timeout
 * for the slowest action (search ~6000ms).
 */
const DEFAULT_CONNECT_TIMEOUT_MS = 250;
const DEFAULT_REQUEST_TIMEOUT_MS = 8000;
const SPAWN_GRACE_MS = 1500;  // how long to wait for daemon to bind socket after spawn

/**
 * Discriminated union for daemon results — same contract as mempalace.ts's
 * BridgeResult so callers can adopt the daemon shim as a drop-in once they
 * decide to migrate.
 */
export type DaemonOk<T = Record<string, unknown>> = { ok: true; data: T; latency_ms: number };
export type DaemonFail = {
  ok: false;
  reason:
    | 'daemon-unreachable'
    | 'connect-timeout'
    | 'request-timeout'
    | 'invalid-response'
    | 'spawn-failed'
    | 'protocol-error'
    | 'action-error';
  detail?: string;
  latency_ms: number;
};
export type DaemonResult<T = Record<string, unknown>> = DaemonOk<T> | DaemonFail;

/**
 * Sleep for `ms` — used during spawn-and-wait. Plain Promise wrapper so we
 * don't pull in node:timers/promises (Bun-friendly).
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Connection-failure tags used by tryConnect / sendRequest. Carrying these
 * as discriminator strings on `error.tag` lets the top-level
 * bridgeAsyncDaemon classifier route to the right DaemonFail.reason without
 * regex-matching error messages.
 */
type DaemonClientErrorTag =
  | 'connect-timeout'
  | 'daemon-unreachable'
  | 'request-timeout'
  | 'invalid-response'
  | 'protocol-error';

class DaemonClientError extends Error {
  constructor(public readonly tag: DaemonClientErrorTag, public readonly detail?: string) {
    super(detail ? `${tag}:${detail}` : tag);
    this.name = 'DaemonClientError';
  }
}

/**
 * Open a Unix socket connection to the daemon. Resolves with the socket if
 * connected within `timeoutMs`, otherwise rejects with a DaemonClientError.
 */
function tryConnect(socketPath: string, timeoutMs: number): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const sock: Socket = connect({ path: socketPath });
    const timer = setTimeout(() => {
      sock.destroy();
      reject(new DaemonClientError('connect-timeout'));
    }, timeoutMs);

    sock.once('connect', () => {
      clearTimeout(timer);
      resolve(sock);
    });
    sock.once('error', (err: NodeJS.ErrnoException) => {
      clearTimeout(timer);
      // ENOENT = socket file doesn't exist (daemon never bound or already shut down)
      // ECONNREFUSED = stale socket file with no listener
      reject(new DaemonClientError('daemon-unreachable', err.code || 'unknown'));
    });
  });
}

/**
 * Spawn the daemon detached. Inherits stdout/stderr to the daemon's log
 * (configured by env var), unrefs so the parent process can exit.
 *
 * Re-resolves the daemon script path on every call (live-install-first,
 * plugin-tree-fallback — see `resolveDaemonScriptPath()`) rather than trusting
 * the module-load-time `DAEMON_SCRIPT_PATH` constant, so a caller always gets
 * the freshest on-disk answer. Returns `{ ok: false, detail }` naming BOTH
 * probed paths when neither exists, so the caller can surface a clear error
 * instead of an opaque "spawn returned no pid".
 */
export type DaemonLaunch = {
  cmd: string[];
  env: RuntimeEnv;
  source: 'maintainer-python3' | 'provisioned-venv' | 'uv-on-demand';
  packageSpec?: string;
};

/**
 * Pure command builder for the lifecycle boundary. Plugin installs use the
 * exact pinned, plugin-scoped Python environment; non-plugin installs preserve
 * the historical `python3 <live daemon>` behavior byte-for-byte.
 */
export function resolveDaemonLaunch(
  scriptPath: string,
  env: RuntimeEnv = RUNTIME_ENV,
  options: {
    packageSpec?: string;
    exists?: (path: string) => boolean;
    readText?: (path: string) => string;
  } = {},
): DaemonLaunch {
  if (isPluginInstall(env)) {
    return buildPluginPythonLaunch([scriptPath], env, options);
  }
  const dosDir = env.DOS_DIR || join(homedir(), '.claude');
  return {
    cmd: ['python3', scriptPath],
    env: { ...env, DOS_DIR: dosDir },
    source: 'maintainer-python3',
  };
}

function spawnDaemon(): { ok: true; pid: number } | { ok: false; detail: string } {
  const resolution = resolveDaemonScriptPath();
  if (!resolution.ok) return resolution;
  try {
    const launch = resolveDaemonLaunch(resolution.path);
    const child = spawn(launch.cmd[0], launch.cmd.slice(1), {
      detached: true,
      stdio: 'ignore',
      env: launch.env,
    });
    child.unref();
    if (child.pid == null) return { ok: false, detail: 'spawn returned no pid' };
    return { ok: true, pid: child.pid };
  } catch (e) {
    return { ok: false, detail: (e as Error).message };
  }
}

/**
 * Wait until the socket file exists and is connectable, up to `graceMs`.
 * Polling is cheap because existsSync is a stat call.
 */
async function waitForSocket(socketPath: string, graceMs: number): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < graceMs) {
    if (existsSync(socketPath)) {
      try {
        const sock = await tryConnect(socketPath, 100);
        sock.destroy();
        return true;
      } catch {
        // not yet bound — wait a tick
      }
    }
    await sleep(50);
  }
  return false;
}

/**
 * Quick connectivity probe — does a listener answer on the socket within
 * `timeoutMs`? Wraps tryConnect; returns a bool instead of throwing.
 */
async function canConnect(socketPath: string, timeoutMs: number): Promise<boolean> {
  if (!existsSync(socketPath)) return false;
  try {
    const sock = await tryConnect(socketPath, timeoutMs);
    sock.destroy();
    return true;
  } catch {
    return false;
  }
}

/**
 * Send one request, read one response. Returns the parsed JSON object.
 * Times out at `timeoutMs` end-to-end (covers connect + send + read).
 */
async function sendRequest(
  sock: Socket,
  payload: unknown,
  timeoutMs: number,
): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const buf: Buffer[] = [];
    let settled = false;
    // MP-TS-04: hoist the request-timeout timer and clear it in BOTH settle
    // paths. Previously only tryParseAndResolve cleared it, so the sock 'error'
    // handler (→ settleReject directly) and any early settle left the timer
    // armed for up to timeoutMs (8s), keeping the Node event loop alive long
    // after the request logically completed. clearTimeout on an already-fired
    // or already-cleared timer is a safe no-op, so guarding on `settled` is
    // enough; every settle now disarms it exactly once.
    let timer: ReturnType<typeof setTimeout>;
    const settleReject = (err: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      sock.destroy();
      reject(err);
    };
    const settleResolve = (value: Record<string, unknown>) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      sock.destroy();
      resolve(value);
    };

    timer = setTimeout(
      () => settleReject(new DaemonClientError('request-timeout')),
      timeoutMs,
    );

    const tryParseAndResolve = (raw: string, allowEmpty: boolean): void => {
      clearTimeout(timer);
      if (!raw) {
        if (!allowEmpty) settleReject(new DaemonClientError('protocol-error', 'empty-response'));
        return;
      }
      try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          settleResolve(parsed as Record<string, unknown>);
        } else {
          settleReject(new DaemonClientError('invalid-response', 'not-object'));
        }
      } catch (e) {
        settleReject(new DaemonClientError('invalid-response', (e as Error).message));
      }
    };

    sock.on('data', (chunk: Buffer) => {
      buf.push(chunk);
      // Look for newline → end of one response
      if (chunk.includes(0x0a /* \n */)) {
        const all = Buffer.concat(buf);
        const nl = all.indexOf(0x0a);
        tryParseAndResolve(all.subarray(0, nl).toString('utf8'), false);
      }
    });

    sock.on('error', (err) => settleReject(err as Error));

    sock.on('end', () => {
      // EOF without newline — try to parse what we got
      tryParseAndResolve(Buffer.concat(buf).toString('utf8').trim(), false);
    });

    // Send the request
    sock.write(JSON.stringify(payload) + '\n');
  });
}

/**
 * MAIN ENTRY: call a bridge action via the persistent daemon.
 *
 * Tries to connect to the existing socket. If that fails, spawns the daemon
 * (detached) and waits for it to bind. If the daemon still can't be reached,
 * returns `{ ok: false, reason: 'daemon-unreachable' }` and the caller is
 * expected to fall back to subprocess.
 *
 * Example:
 *     import { bridgeAsyncDaemon } from './mempalace-daemon';
 *     const result = await bridgeAsyncDaemon('search', { query: 'foo', limit: 5 });
 *     if (result.ok) {
 *       console.log(result.data);
 *     } else if (result.reason === 'daemon-unreachable') {
 *       // fall back to subprocess
 *       const fallback = await bridgeSync('search', { query: 'foo', limit: 5 });
 *     }
 */
export async function bridgeAsyncDaemon<T extends Record<string, unknown> = Record<string, unknown>>(
  action: string,
  args: Record<string, unknown> = {},
  options: {
    connectTimeoutMs?: number;
    requestTimeoutMs?: number;
    autoSpawn?: boolean;
  } = {},
): Promise<DaemonResult<T>> {
  const {
    connectTimeoutMs = DEFAULT_CONNECT_TIMEOUT_MS,
    requestTimeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
    autoSpawn = true,
  } = options;

  const startedAt = performance.now();
  const elapsedMs = () => Math.round((performance.now() - startedAt) * 100) / 100;

  const tagToReason = (tag: DaemonClientErrorTag): DaemonFail['reason'] => tag;
  const failFromError = (e: unknown, fallbackReason: DaemonFail['reason']): DaemonFail => {
    const err = e as DaemonClientError | Error;
    if (err instanceof DaemonClientError) {
      return { ok: false, reason: tagToReason(err.tag), detail: err.detail, latency_ms: elapsedMs() };
    }
    return { ok: false, reason: fallbackReason, detail: (err as Error).message, latency_ms: elapsedMs() };
  };

  // Step 1: try connecting to existing daemon
  let sock: Socket;
  try {
    sock = await tryConnect(DAEMON_SOCKET_PATH, connectTimeoutMs);
  } catch (e) {
    if (!autoSpawn) {
      return failFromError(e, 'daemon-unreachable');
    }
    // Step 2: spawn the daemon — serialized so concurrent callers don't each
    // spawn one (duplicate-daemon race, incident 2026-06-22). The lock holder
    // spawns and waits for the socket to bind WHILE holding the lock; callers
    // that don't get the lock skip spawning and fall through to wait for it.
    if (acquireSpawnLock()) {
      try {
        // Double-check under the lock: another holder may have spawned and
        // bound the socket while we were blocked acquiring.
        if (!(await canConnect(DAEMON_SOCKET_PATH, connectTimeoutMs))) {
          const spawnResult = spawnDaemon();
          if (!spawnResult.ok) {
            return { ok: false, reason: 'spawn-failed', detail: spawnResult.detail, latency_ms: elapsedMs() };
          }
          await waitForSocket(DAEMON_SOCKET_PATH, SPAWN_GRACE_MS);
        }
      } finally {
        releaseSpawnLock();
      }
    }
    // Step 3: socket should be up now (we spawned it, or another caller did);
    // wait covers the lock-loser path that skipped spawning. Then retry connect.
    const ready = await waitForSocket(DAEMON_SOCKET_PATH, SPAWN_GRACE_MS);
    if (!ready) {
      return {
        ok: false,
        reason: 'spawn-failed',
        detail: `daemon did not bind socket within ${SPAWN_GRACE_MS}ms`,
        latency_ms: elapsedMs(),
      };
    }
    try {
      sock = await tryConnect(DAEMON_SOCKET_PATH, connectTimeoutMs);
    } catch (e2) {
      return failFromError(e2, 'connect-timeout');
    }
  }

  // Step 4: send the request, read the response
  let response: Record<string, unknown>;
  try {
    response = await sendRequest(sock, { action, args }, requestTimeoutMs);
  } catch (e) {
    return failFromError(e, 'protocol-error');
  }

  // Step 5: classify the response. The daemon mirrors bridge.main()'s shape:
  //   error: { status: 'error', error_type, message, ... }
  //   success: { ...action result }  (no `status: 'error'`)
  if (response.status === 'error' || response.isError === true) {
    const detail =
      typeof response.message === 'string'
        ? response.message
        : typeof response.error_type === 'string'
          ? response.error_type
          : 'unknown';
    return { ok: false, reason: 'action-error', detail, latency_ms: elapsedMs() };
  }

  return { ok: true, data: response as T, latency_ms: elapsedMs() };
}

/**
 * Probe whether the daemon is currently reachable. Cheap (~0.5ms when up).
 * Useful for hooks that want to short-circuit to subprocess when the daemon
 * is known-down without paying the connect-timeout penalty.
 */
export async function isDaemonAlive(timeoutMs: number = 100): Promise<boolean> {
  if (!existsSync(DAEMON_SOCKET_PATH)) return false;
  try {
    const sock = await tryConnect(DAEMON_SOCKET_PATH, timeoutMs);
    sock.destroy();
    return true;
  } catch {
    return false;
  }
}

/**
 * Operator-facing health snapshot. Returns the daemon's metrics (request_count,
 * uptime, p50/p99 latencies). Returns null if daemon is unreachable.
 *
 * Wired into RFC-0075 Phase 5 — SessionStart Signals snapshot adds one line:
 *   "Bridge daemon: alive 12m, 142 calls, p50 48ms"
 *
 * (Wiring lives in a follow-up agent's PR; this function ships the surface.)
 */
export async function daemonHealth(): Promise<Record<string, unknown> | null> {
  const result = await bridgeAsyncDaemon('daemon_status', {}, {
    connectTimeoutMs: 250,
    requestTimeoutMs: 1000,
    autoSpawn: false,  // health probe should NOT spawn — it's a status query
  });
  return result.ok ? result.data : null;
}
