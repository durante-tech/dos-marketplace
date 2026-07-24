#!/usr/bin/env bun
/**
 * FleetDispatch.ts — SessionEnd cadence for the RFC-0161 fleet intake engine
 * (RFC-0161 §4 — claim-ledger dispatch cycle).
 *
 * The fleet intake ledger (RFC-0161) needs a periodic dispatch pass, but the
 * engine is a Durante-internal Tools/ CLI with no scheduler. This tool gives
 * it a real cadence by riding the SessionEnd detached fan-out as a
 * special-mode SYNC_TOOLS entry (the BannerFireCollect / WorkOsReconcile
 * precedent verbatim):
 *
 *   - DEBOUNCE: skip if a dispatch fired < 30 min ago. Stamp lives at
 *     <repoRoot>/MEMORY/STATE/fleet-dispatch-last-run.json — anchored to the
 *     engine's repo so the throttle is GLOBAL across sessions/projects.
 *   - ABSENT-REPO NO-OP: the engine is a Durante-internal Tools/ CLI; a
 *     customer install without ~/Durante exits 0 with ONE log line.
 *   - BOUNDED RUN: spawns `bun Tools/fleet-dispatch-cycle.ts --once` in the
 *     dos repo with a 120s timeout and captures the engine's exit code back
 *     into the stamp (exitCode; -1 on timeout/kill) for observability.
 *   - Always exit 0 — this rides the SessionEnd path and must never fail it,
 *     even when the engine is missing, times out, or exits nonzero.
 *
 * The ENGINE lives dos-side (Tools/fleet-dispatch-cycle.ts in ~/Durante) —
 * this cc-side tool is a thin cadence shim only: no dispatch logic here.
 * NOT a Save*ToStudio producer: POSTs nothing. dlqTool null; endpoint is a
 * LOCAL route label (kept unique to satisfy the registry contract).
 */

import { existsSync, readFileSync, writeFileSync, appendFileSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

/** Debounce window — skip a dispatch fired < 30 min ago. */
export const DEBOUNCE_MS = 30 * 60 * 1000;

/** Hard ceiling on one engine run — the SessionEnd path must stay bounded. */
export const RUN_TIMEOUT_MS = 120 * 1000;

export interface DispatchCtx {
  now(): number;
  existsFile(p: string): boolean;
  readText(p: string): string | null;
  writeText(p: string, s: string): void;
  appendText(p: string, s: string): void;
  mkdirp(p: string): void;
  /** Run to completion (bounded by timeoutMs); return exit code, -1 on timeout/kill. */
  spawnWait(cmd: string, args: string[], cwd: string, timeoutMs: number): number;
  log(msg: string): void;
  stateDir: string;
  repoRoot: string;
}

/** `$DOS_FLEET_DISPATCH_REPO` overrides for tests; default anchors on ~/Durante. */
export function resolveRepoRoot(
  env: Record<string, string | undefined>,
  home: string,
): string {
  const override = (env.DOS_FLEET_DISPATCH_REPO ?? '').trim();
  return override || join(home, 'Durante');
}

export function engineToolPath(repoRoot: string): string {
  return join(repoRoot, 'Tools', 'fleet-dispatch-cycle.ts');
}

/** Same accepting parser as BannerFireCollect/WorkOsReconcile: `{ ts }` or `{ lastRunMs }`. */
export function parseLastRun(text: string | null): number | null {
  if (!text) return null;
  try {
    const j = JSON.parse(text) as { ts?: unknown; lastRunMs?: unknown };
    if (typeof j.lastRunMs === 'number' && Number.isFinite(j.lastRunMs)) return j.lastRunMs;
    if (typeof j.ts === 'string') {
      const t = Date.parse(j.ts);
      return Number.isNaN(t) ? null : t;
    }
    return null;
  } catch {
    return null;
  }
}

export interface DebounceDecision {
  skip: boolean;
  reason: string;
}

export function debounceDecision(
  lastRunMs: number | null,
  nowMs: number,
  windowMs: number = DEBOUNCE_MS,
): DebounceDecision {
  if (lastRunMs === null) return { skip: false, reason: 'no prior dispatch timestamp' };
  const age = nowMs - lastRunMs;
  if (age < 0) return { skip: false, reason: 'future timestamp (clock skew) — proceeding' };
  const mins = Math.round(age / 60000);
  const windowMins = Math.round(windowMs / 60000);
  if (age < windowMs) return { skip: true, reason: `last dispatch ${mins}m ago (< ${windowMins}m debounce)` };
  return { skip: false, reason: `last dispatch ${mins}m ago (>= ${windowMins}m debounce)` };
}

/** Sequence: absent-repo no-op → debounce → stamp-then-run → stamp exit code. Always 0. */
export function runDispatch(ctx: DispatchCtx): number {
  const toolPath = engineToolPath(ctx.repoRoot);
  if (!ctx.existsFile(toolPath)) {
    ctx.log(`[FleetDispatch] no-op — ${toolPath} absent (engine not installed here)`);
    return 0;
  }

  const tsPath = join(ctx.stateDir, 'fleet-dispatch-last-run.json');
  const decision = debounceDecision(parseLastRun(ctx.readText(tsPath)), ctx.now());
  if (decision.skip) {
    ctx.log(`[FleetDispatch] skip — ${decision.reason}`);
    return 0;
  }

  const nowMs = ctx.now();
  try {
    ctx.mkdirp(ctx.stateDir);
    // Stamp the KICK time BEFORE running — the timestamp throttles the kick,
    // not completion (BannerFireCollect/WorkOsReconcile precedent).
    ctx.writeText(
      tsPath,
      JSON.stringify({ ts: new Date(nowMs).toISOString(), lastRunMs: nowMs }) + '\n',
    );
    const exitCode = ctx.spawnWait(
      'bun',
      ['Tools/fleet-dispatch-cycle.ts', '--once'],
      ctx.repoRoot,
      RUN_TIMEOUT_MS,
    );
    // Capture the engine's exit code back into the stamp for observability.
    ctx.writeText(
      tsPath,
      JSON.stringify({ ts: new Date(nowMs).toISOString(), lastRunMs: nowMs, exitCode }) + '\n',
    );
    ctx.log(`[FleetDispatch] engine run complete (--once) in ${ctx.repoRoot} — exit ${exitCode} — ${decision.reason}`);
  } catch (err) {
    try {
      ctx.mkdirp(ctx.stateDir);
      ctx.appendText(
        join(ctx.stateDir, 'fleet-dispatch-errors.jsonl'),
        JSON.stringify({ ts: new Date(nowMs).toISOString(), action: 'FleetDispatch.spawn', error: String(err) }) + '\n',
      );
    } catch {
      /* error sink unavailable — swallow; never throw on the SessionEnd path */
    }
    ctx.log('[FleetDispatch] error firing engine — logged to fleet-dispatch-errors.jsonl');
  }
  return 0;
}

export function defaultCtx(overrides: Partial<DispatchCtx> = {}): DispatchCtx {
  const home = homedir();
  const repoRoot = resolveRepoRoot(process.env, home);
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
    // writeArtifact:exempt — writeText adapter for engine state files under MEMORY/STATE
    writeText: (p, s) => writeFileSync(p, s),
    appendText: (p, s) => appendFileSync(p, s),
    mkdirp: (p) => mkdirSync(p, { recursive: true }),
    spawnWait: (cmd, args, cwd, timeoutMs) => {
      try {
        const proc = Bun.spawnSync([cmd, ...args], {
          cwd,
          stdio: ['ignore', 'ignore', 'ignore'],
          timeout: timeoutMs,
        });
        return typeof proc.exitCode === 'number' ? proc.exitCode : -1;
      } catch {
        return -1;
      }
    },
    log: (msg) => console.error(msg),
    stateDir: join(repoRoot, 'MEMORY', 'STATE'),
    repoRoot,
    ...overrides,
  };
}

if (import.meta.main) {
  process.exit(runDispatch(defaultCtx()));
}
