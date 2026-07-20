#!/usr/bin/env bun
/**
 * WorkOsReconcile.ts — SessionEnd backstop that fires the Work OS local
 * reconciler out-of-band.
 *
 * WHY A SYNC_TOOLS ENTRY (RFC-0133 P2 / RFC-0151 council §8 P3 row):
 * the P3 design specifies a "special-mode SYNC_TOOLS entry" so the reconcile
 * rides the existing SessionEnd detached fan-out (StudioSync.daemon.ts)
 * rather than adding a whole new hook. This tool is NOT a Save*ToStudio
 * producer — it POSTs nothing to Studio. It spawns `bun Tools/work-os.ts
 * reconcile` in the dos repo, detached + fire-and-forget, so a slow `gh`
 * reconcile never touches the SessionEnd critical path.
 *
 * CONTRACT (council §8 P3 + P3 build constraints):
 *   - DEBOUNCE: skip if a reconcile fired < 30 min ago. The kick time is
 *     stamped in <repoRoot>/MEMORY/STATE/work-os-last-reconcile.json — anchored
 *     to the reconcile TARGET (repoRoot), not the session's project-first
 *     MEMORY, so the throttle is GLOBAL across sessions/projects (cross-project
 *     SessionEnd churn would otherwise each miss the other's stamp and re-fire).
 *   - ABSENT-REPO NO-OP: if the dos repo / Tools/work-os.ts is not present
 *     (a customer install WITHOUT Work OS), exit 0 with ONE log line, no
 *     spawn, no error. Work OS is a Durante-internal subsystem (RFC-0133
 *     F6); its absence is the normal case downstream.
 *   - ERRORS → <repoRoot>/MEMORY/STATE/work-os-errors.jsonl (the sink work-os.ts
 *     uses when it reconciles that same repo) — never thrown, never fatal.
 *   - Always exit 0. This runs on the SessionEnd path; it must never fail it.
 *
 * BOT IDENTITY (RFC-0151 F4 residual #1): the daemon spawns this tool in
 * special-mode with the FULL env (no DOS_DLQ_QUEUE_ONLY), so DOS_WORK_OS_TOKEN
 * propagates through to work-os.ts → `gh` as the single bot identity shared
 * with the nightly Action. spawnDetached inherits process.env by design.
 *
 * TESTABILITY: every fs/clock/spawn effect funnels through a ReconcileCtx
 * seam. defaultCtx() wires the real implementations; the test injects fakes.
 * The pure debounce + path helpers are exported and tested directly.
 */

import {
  existsSync,
  readFileSync,
  writeFileSync,
  appendFileSync,
  mkdirSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

// ─────────────────────────── constants ────────────────────────────

/** Debounce window — skip a SessionEnd reconcile fired < 30 min ago. */
export const DEBOUNCE_MS = 30 * 60 * 1000;

// ─────────────────────────── ctx seam ─────────────────────────────

/** The single injection seam — every fs / clock / spawn effect goes here. */
export interface ReconcileCtx {
  now(): number;
  existsFile(p: string): boolean;
  readText(p: string): string | null;
  writeText(p: string, s: string): void;
  appendText(p: string, s: string): void;
  mkdirp(p: string): void;
  spawnDetached(cmd: string, args: string[], cwd: string): void;
  log(msg: string): void;
  stateDir: string;
  repoRoot: string;
}

// ─────────────────────── pure path resolution ─────────────────────

/**
 * Resolve the dos repo root the way the sibling SessionEnd tools do —
 * SaveProjectsToStudio anchors on `~/Durante`. `$DOS_WORK_OS_REPO` overrides
 * for tests and non-standard checkouts.
 */
export function resolveRepoRoot(
  env: Record<string, string | undefined>,
  home: string,
): string {
  const override = (env.DOS_WORK_OS_REPO ?? '').trim();
  return override || join(home, 'Durante');
}

/** Absolute path to the reconcile tool inside a resolved dos repo root. */
export function workOsToolPath(repoRoot: string): string {
  return join(repoRoot, 'Tools', 'work-os.ts');
}

// ───────────────────── pure debounce decision ─────────────────────

export interface DebounceDecision {
  skip: boolean;
  reason: string;
  lastRunMs: number | null;
}

/**
 * Read the last-reconcile epoch-ms from the timestamp file's JSON. Accepts
 * either `{ ts: <iso> }` or `{ lastRunMs: <number> }`; returns null on any
 * parse failure or missing field (→ treated as "never reconciled").
 */
export function parseLastRun(text: string | null): number | null {
  if (!text) return null;
  try {
    const j = JSON.parse(text) as { ts?: unknown; lastRunMs?: unknown };
    if (typeof j.lastRunMs === 'number' && Number.isFinite(j.lastRunMs)) {
      return j.lastRunMs;
    }
    if (typeof j.ts === 'string') {
      const t = Date.parse(j.ts);
      return Number.isNaN(t) ? null : t;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Deterministic debounce verdict. A null prior (never reconciled) or a
 * future/clock-skewed timestamp both PROCEED; a prior inside the window SKIPS.
 */
export function debounceDecision(
  lastRunMs: number | null,
  nowMs: number,
  windowMs: number = DEBOUNCE_MS,
): DebounceDecision {
  if (lastRunMs === null) {
    return { skip: false, reason: 'no prior reconcile timestamp', lastRunMs };
  }
  const age = nowMs - lastRunMs;
  if (age < 0) {
    return { skip: false, reason: 'future timestamp (clock skew) — proceeding', lastRunMs };
  }
  const mins = Math.round(age / 60000);
  const windowMins = Math.round(windowMs / 60000);
  if (age < windowMs) {
    return { skip: true, reason: `last reconcile ${mins}m ago (< ${windowMins}m debounce)`, lastRunMs };
  }
  return { skip: false, reason: `last reconcile ${mins}m ago (>= ${windowMins}m debounce)`, lastRunMs };
}

// ─────────────────────────── runner ───────────────────────────────

/**
 * The reconcile backstop. Pure w.r.t. the ctx seam; always returns an exit
 * code (0). Sequence: absent-repo no-op → debounce → stamp-then-spawn.
 */
export function runReconcile(ctx: ReconcileCtx): number {
  const toolPath = workOsToolPath(ctx.repoRoot);
  if (!ctx.existsFile(toolPath)) {
    // Customer install without Work OS — the normal downstream case.
    ctx.log(`[WorkOsReconcile] no-op — ${toolPath} absent (Work OS not installed here)`);
    return 0;
  }

  const tsPath = join(ctx.stateDir, 'work-os-last-reconcile.json');
  const decision = debounceDecision(parseLastRun(ctx.readText(tsPath)), ctx.now());
  if (decision.skip) {
    ctx.log(`[WorkOsReconcile] skip — ${decision.reason}`);
    return 0;
  }

  const nowMs = ctx.now();
  try {
    ctx.mkdirp(ctx.stateDir);
    // Stamp the KICK time BEFORE spawning so a slow/failed reconcile still
    // debounces the next SessionEnd fire (the timestamp is a throttle on the
    // kick, not a completion marker; on-demand + nightly triggers still run).
    ctx.writeText(
      tsPath,
      JSON.stringify({ ts: new Date(nowMs).toISOString(), lastRunMs: nowMs }) + '\n',
    );
    ctx.spawnDetached('bun', ['Tools/work-os.ts', 'reconcile'], ctx.repoRoot);
    ctx.log(`[WorkOsReconcile] spawned reconcile in ${ctx.repoRoot} — ${decision.reason}`);
  } catch (err) {
    // The error sink itself must never throw (a broken/permission-denied
    // MEMORY/STATE must not turn "log the spawn failure" into an uncaught throw
    // — the tool's contract is always-exit-0). mkdirp + append are both guarded.
    try {
      ctx.mkdirp(ctx.stateDir);
      ctx.appendText(
        join(ctx.stateDir, 'work-os-errors.jsonl'),
        JSON.stringify({
          ts: new Date(nowMs).toISOString(),
          action: 'WorkOsReconcile.spawn',
          error: String(err),
        }) + '\n',
      );
    } catch {
      /* error sink unavailable — swallow; never throw on the SessionEnd path */
    }
    ctx.log(`[WorkOsReconcile] error firing reconcile — logged to work-os-errors.jsonl`);
  }
  return 0;
}

// ─────────────────────────── ctx wiring ───────────────────────────

export function defaultCtx(overrides: Partial<ReconcileCtx> = {}): ReconcileCtx {
  const repoRoot = resolveRepoRoot(process.env, homedir());
  return {
    now: () => Date.now(),
    existsFile: (p) => existsSync(p),
    readText: (p) => {
      try {
        return readFileSync(p, 'utf-8');
      } catch {
        return null;
      }
    },
    // writeArtifact:exempt — injected fs-port adapter (the seam itself); artifact policy is applied at call sites, not in the port
    writeText: (p, s) => writeFileSync(p, s),
    appendText: (p, s) => appendFileSync(p, s),
    mkdirp: (p) => {
      mkdirSync(p, { recursive: true });
    },
    spawnDetached: (cmd, args, cwd) => {
      // nohup + detached so the reconcile survives the daemon's exit and never
      // pins the SessionEnd path. Inherits process.env → DOS_WORK_OS_TOKEN
      // reaches work-os.ts → gh as the single bot identity.
      const child = Bun.spawn(['nohup', cmd, ...args], {
        cwd,
        stdout: 'ignore',
        stderr: 'ignore',
        stdin: 'ignore',
        env: { ...process.env },
      });
      child.unref();
    },
    log: (m) => process.stderr.write(m.endsWith('\n') ? m : m + '\n'),
    // Anchor state to the reconcile TARGET (repoRoot), NOT the session's
    // project-first MEMORY — so the 30-min debounce is GLOBAL across sessions
    // and projects (cross-project churn would otherwise each miss the other's
    // stamp and re-fire), and the error sink co-locates with the repo the
    // reconcile actually runs in.
    stateDir: join(repoRoot, 'MEMORY', 'STATE'),
    repoRoot,
    ...overrides,
  };
}

// ─────────────────────────────── main ─────────────────────────────

if (import.meta.main) {
  const code = runReconcile(defaultCtx());
  process.exit(code);
}
