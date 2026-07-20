#!/usr/bin/env bun
/**
 * BannerFireCollect.ts — SessionEnd cadence for the banner-fire producer
 * (T20 ruling (a), decision 01KXA71MHMCQG6QP8KDZPNT94Y — Forge Gen 118).
 *
 * banner-fire-events.jsonl had a live SessionEnd drainer (SaveBannerFireToStudio)
 * and an RFC-0074 Studio panel, but the PRODUCER (Tools/banner-fire-analyzer.ts)
 * was a manual CLI with zero invokers — the dataset rotted 59 days. This tool
 * gives the producer a real cadence by riding the SessionEnd detached fan-out
 * as a special-mode SYNC_TOOLS entry (the WorkOsReconcile pattern verbatim):
 *
 *   - DEBOUNCE: skip if a collect fired < 30 min ago. Stamp lives at
 *     <repoRoot>/MEMORY/STATE/banner-fire-last-collect.json — anchored to the
 *     analyzer's repo so the throttle is GLOBAL across sessions/projects.
 *   - ABSENT-REPO NO-OP: the analyzer is a Durante-internal Tools/ CLI; a
 *     customer install without ~/Durante exits 0 with ONE log line.
 *   - APPEND-IDEMPOTENT: the analyzer dedups on (session_id, turn_uuid)
 *     (added same gen), so re-analyzing overlapping sessions is safe.
 *   - Always exit 0 — this rides the SessionEnd path and must never fail it.
 *
 * NOT a Save*ToStudio producer: POSTs nothing. SaveBannerFireToStudio drains
 * the refreshed events on the next SessionEnd pass. dlqTool null; endpoint is
 * a LOCAL route label (kept unique to satisfy the registry contract).
 */

import { existsSync, readFileSync, writeFileSync, appendFileSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

/** Debounce window — skip a collect fired < 30 min ago. */
export const DEBOUNCE_MS = 30 * 60 * 1000;

/** How many most-recent sessions each collect re-analyzes (dedup makes overlap free). */
export const COLLECT_LAST_N = 5;

export interface CollectCtx {
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

/** `$DOS_BANNER_FIRE_REPO` overrides for tests; default anchors on ~/Durante. */
export function resolveRepoRoot(
  env: Record<string, string | undefined>,
  home: string,
): string {
  const override = (env.DOS_BANNER_FIRE_REPO ?? '').trim();
  return override || join(home, 'Durante');
}

export function analyzerToolPath(repoRoot: string): string {
  return join(repoRoot, 'Tools', 'banner-fire-analyzer.ts');
}

/** Same accepting parser as WorkOsReconcile: `{ ts }` or `{ lastRunMs }`. */
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
  if (lastRunMs === null) return { skip: false, reason: 'no prior collect timestamp' };
  const age = nowMs - lastRunMs;
  if (age < 0) return { skip: false, reason: 'future timestamp (clock skew) — proceeding' };
  const mins = Math.round(age / 60000);
  const windowMins = Math.round(windowMs / 60000);
  if (age < windowMs) return { skip: true, reason: `last collect ${mins}m ago (< ${windowMins}m debounce)` };
  return { skip: false, reason: `last collect ${mins}m ago (>= ${windowMins}m debounce)` };
}

/** Sequence: absent-repo no-op → debounce → stamp-then-spawn. Always 0. */
export function runCollect(ctx: CollectCtx): number {
  const toolPath = analyzerToolPath(ctx.repoRoot);
  if (!ctx.existsFile(toolPath)) {
    ctx.log(`[BannerFireCollect] no-op — ${toolPath} absent (analyzer not installed here)`);
    return 0;
  }

  const tsPath = join(ctx.stateDir, 'banner-fire-last-collect.json');
  const decision = debounceDecision(parseLastRun(ctx.readText(tsPath)), ctx.now());
  if (decision.skip) {
    ctx.log(`[BannerFireCollect] skip — ${decision.reason}`);
    return 0;
  }

  const nowMs = ctx.now();
  try {
    ctx.mkdirp(ctx.stateDir);
    // Stamp the KICK time BEFORE spawning — the timestamp throttles the kick,
    // not completion (WorkOsReconcile precedent).
    ctx.writeText(
      tsPath,
      JSON.stringify({ ts: new Date(nowMs).toISOString(), lastRunMs: nowMs }) + '\n',
    );
    ctx.spawnDetached('bun', ['Tools/banner-fire-analyzer.ts', '--last', String(COLLECT_LAST_N)], ctx.repoRoot);
    ctx.log(`[BannerFireCollect] spawned analyzer (--last ${COLLECT_LAST_N}) in ${ctx.repoRoot} — ${decision.reason}`);
  } catch (err) {
    try {
      ctx.mkdirp(ctx.stateDir);
      ctx.appendText(
        join(ctx.stateDir, 'banner-fire-errors.jsonl'),
        JSON.stringify({ ts: new Date(nowMs).toISOString(), action: 'BannerFireCollect.spawn', error: String(err) }) + '\n',
      );
    } catch {
      /* error sink unavailable — swallow; never throw on the SessionEnd path */
    }
    ctx.log('[BannerFireCollect] error firing analyzer — logged to banner-fire-errors.jsonl');
  }
  return 0;
}

export function defaultCtx(overrides: Partial<CollectCtx> = {}): CollectCtx {
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
    // writeArtifact:exempt — writeText adapter for analyzer state files under MEMORY/STATE
    writeText: (p, s) => writeFileSync(p, s),
    appendText: (p, s) => appendFileSync(p, s),
    mkdirp: (p) => mkdirSync(p, { recursive: true }),
    spawnDetached: (cmd, args, cwd) => {
      const proc = Bun.spawn([cmd, ...args], { cwd, stdio: ['ignore', 'ignore', 'ignore'] });
      proc.unref();
    },
    log: (msg) => console.error(msg),
    stateDir: join(repoRoot, 'MEMORY', 'STATE'),
    repoRoot,
    ...overrides,
  };
}

if (import.meta.main) {
  process.exit(runCollect(defaultCtx()));
}
