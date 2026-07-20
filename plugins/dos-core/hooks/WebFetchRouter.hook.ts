#!/usr/bin/env bun
/**
 * WebFetchRouter.hook.ts — RFC-0030 §11 capability-aware tool routing
 * (walking-skeleton, web.fetch capability) + RFC-0031 Phase −1 telemetry.
 *
 * TRIGGER: PreToolUse on WebFetch
 *
 * Fires before a WebFetch tool call. Inspects the URL host and emits an
 * advisory <system-reminder> when a known JS-heavy / bot-protected /
 * paywalled host is detected, suggesting the operator escalate to:
 *   - Skill("scraping") for JS-rendered + bot-detected sites (Bright Data
 *     progressive escalation, Apify actors)
 *   - Skill("research") for multi-source synthesis on a topic
 *   - Skill("investigation") for OSINT / due-diligence shapes
 *
 * Phase 1 (this version): ADVISORY ONLY — never blocks the WebFetch call.
 *   The reminder appears in stderr; the LLM sees it on next turn and can
 *   choose to re-route. Walking-skeleton: validate the routing signal
 *   before deciding to block.
 *
 * RFC-0031 Phase −1 measurement (added 2026-04-30):
 *   Every advisory fire writes a JSONL entry to
 *   `<project>/MEMORY/ARTIFACTS/web-fetch-router-telemetry.jsonl`. The
 *   telemetry feeds Beck's "first failing test is a measurement test"
 *   gate at RFC-0031 §6 — we need to see whether operators actually
 *   re-route on advisory before committing to Phase 0 (`dos-scrape.ts`
 *   walking skeleton). Decision threshold: ≥30% switch rate. Non-blocking:
 *   any I/O error degrades to silent pass.
 *
 * Phase 2 (post-soak): may flip selected hosts to BLOCK with explicit
 *   re-route guidance, gated on `DOS_FETCH_ROUTER_MODE=block`.
 *
 * OPT-OUT: set `DOS_FETCH_ROUTER_DISABLE=1` to silence the hook entirely
 *   (useful for sessions that intentionally want raw WebFetch). Disables
 *   BOTH the reminder AND telemetry.
 *
 * NON-BLOCKING ON ERROR: any parse / probe / write error degrades to silent
 *   pass. The hook MUST NOT break a normal WebFetch.
 */

import { startTimer, stopTimer } from './lib/hook-io';
import { getMemorySubdir, loadProjectEnv } from './lib/paths';

loadProjectEnv();
import { rotateIfNeeded } from './lib/rotate';
import { appendFileSync } from 'node:fs';
import { join } from 'node:path';

interface HookInput {
  tool_name?: string;
  session_id?: string;
  tool_input?: {
    url?: string;
    prompt?: string;
  };
}

interface RouteSuggestion {
  /** Human-readable label of the matched host class. */
  label: string;
  /** Short rationale shown to the operator. */
  why: string;
  /** Suggested DOS skill(s) to escalate to, in priority order. */
  suggestions: string[];
}

/**
 * Host-pattern → routing suggestion table. Keep this list narrow and
 * factual — false positives waste operator attention. Each entry should
 * encode a real failure mode WebFetch hits today.
 */
const HOST_ROUTES: Array<{ match: RegExp; route: RouteSuggestion }> = [
  {
    match: /(^|\.)linkedin\.com$/i,
    route: {
      label: 'LinkedIn (auth-walled, bot-detected)',
      why: 'LinkedIn returns 999 / login wall to unauthenticated UAs. WebFetch will fail or return a placeholder page.',
      suggestions: ['Skill("scraping")', 'Skill("investigation")'],
    },
  },
  {
    match: /(^|\.)(x|twitter)\.com$/i,
    route: {
      label: 'X / Twitter (JS-rendered, auth-walled)',
      why: 'X content requires auth for most pages and is fully JS-rendered. WebFetch returns the SPA shell.',
      suggestions: ['Skill("scraping")', 'Skill("research")'],
    },
  },
  {
    match: /(^|\.)(instagram|facebook|threads)\.com$/i,
    route: {
      label: 'Meta property (auth-walled, bot-detected)',
      why: 'Meta sites require auth; WebFetch returns redirect-to-login or empty SPA shell.',
      suggestions: ['Skill("scraping")'],
    },
  },
  {
    match: /(^|\.)tiktok\.com$/i,
    route: {
      label: 'TikTok (JS-rendered, bot-detected)',
      why: 'TikTok aggressively bot-detects and returns blank pages for non-browser UAs.',
      suggestions: ['Skill("scraping")'],
    },
  },
  {
    match: /(^|\.)reddit\.com$/i,
    route: {
      label: 'Reddit (rate-limited, often returns interstitial)',
      why: 'Reddit serves interstitial "are you human" pages to non-browser UAs; old.reddit.com is more predictable but still rate-limits.',
      suggestions: ['Skill("scraping")', 'Skill("research")'],
    },
  },
  {
    match: /(^|\.)(nytimes|wsj|ft|economist|bloomberg|washingtonpost)\.com$/i,
    route: {
      label: 'Paywalled news (returns paywall preview)',
      why: 'Major news paywalls return only the paywall preview to WebFetch. Use Research for multi-source synthesis instead of trying to bypass.',
      suggestions: ['Skill("research")'],
    },
  },
  {
    match: /(^|\.)medium\.com$/i,
    route: {
      label: 'Medium (member-walled, JS-rendered)',
      why: 'Medium articles are member-walled and JS-rendered; WebFetch returns the paywall stub.',
      suggestions: ['Skill("scraping")'],
    },
  },
  {
    match: /(^|\.)(github|gitlab)\.com$/i,
    route: {
      label: 'Git host (raw fetch is best for code; WebFetch is fine for issues/PRs)',
      why: 'For repository CONTENT, prefer the raw.githubusercontent.com or `gh` CLI. WebFetch on github.com pages renders OK for issues/PRs but not for the file viewer.',
      suggestions: ['gh CLI', 'WebFetch (acceptable for issues/PRs)'],
    },
  },
];

async function readStdin(): Promise<HookInput | null> {
  try {
    const raw = await Promise.race([
      Bun.stdin.text(),
      new Promise<string>((_, reject) => setTimeout(() => reject(new Error('timeout')), 200)),
    ]);
    return raw.trim() ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function classifyUrl(url: string): RouteSuggestion | null {
  let host: string;
  try {
    host = new URL(url).host;
  } catch {
    return null;
  }
  for (const { match, route } of HOST_ROUTES) {
    if (match.test(host)) return route;
  }
  return null;
}

function emitReminder(url: string, route: RouteSuggestion): void {
  const lines = [
    '<system-reminder>',
    `WebFetch routing advisory: ${route.label}`,
    `URL: ${url}`,
    `Why: ${route.why}`,
    `Consider escalating to: ${route.suggestions.join(' OR ')}`,
    '',
    'This is advisory — WebFetch will still execute. Re-route on the next turn if WebFetch returns junk.',
    'Disable: DOS_FETCH_ROUTER_DISABLE=1',
    '</system-reminder>',
  ];
  process.stderr.write(lines.join('\n') + '\n');
}

interface TelemetryRecord {
  timestamp: string;
  port: 'web.fetch';
  host: string;
  url: string;
  route_label: string;
  suggestions: string[];
  session_id: string | null;
  source_hook: 'WebFetchRouter';
  /**
   * Slot for future Phase 0 enrichment. Today: `null` (advisory mode).
   * After Phase −1 evaluation: populated from operator action — one of
   * `'switched' | 'ignored' | 'wrong_target'` per RFC-0031 §6 measurement gate.
   */
  operator_action: null;
}

/**
 * Per-session rotation threshold override. When `DOS_FETCH_TELEMETRY_MAX_BYTES`
 * is set (numeric), it overrides `rotate.ts`'s 5 MB default. Hoisted to
 * module load — single Number() coercion per process.
 */
const TELEMETRY_MAX_BYTES = Number(process.env.DOS_FETCH_TELEMETRY_MAX_BYTES) || undefined;

/**
 * Append one telemetry record to the JSONL log. Non-blocking: any I/O error
 * is swallowed silently. Mirrors `writeArtifact()` durability stance — never
 * crash the host operation on a telemetry write failure. Rotation delegated
 * to shared `rotateIfNeeded` helper (5 MB default; override via env).
 */
function writeTelemetry(record: TelemetryRecord): void {
  try {
    const path = join(getMemorySubdir('ARTIFACTS'), 'web-fetch-router-telemetry.jsonl');
    rotateIfNeeded(path, TELEMETRY_MAX_BYTES ? { maxBytes: TELEMETRY_MAX_BYTES } : {});
    appendFileSync(path, JSON.stringify(record) + '\n', 'utf-8');
  } catch {
    // Non-blocking invariant — telemetry write failure must not break WebFetch.
  }
}

async function main(): Promise<void> {
  if (process.env.DOS_FETCH_ROUTER_DISABLE === '1') {
    process.exit(0);
  }
  const input = await readStdin();
  if (!input || input.tool_name !== 'WebFetch') process.exit(0);
  const url = input.tool_input?.url;
  if (!url || typeof url !== 'string') process.exit(0);
  const route = classifyUrl(url);
  if (route) {
    emitReminder(url, route);
    writeTelemetry({
      timestamp: new Date().toISOString(),
      port: 'web.fetch',
      host: new URL(url).host,
      url,
      route_label: route.label,
      suggestions: route.suggestions,
      // The PreToolUse payload carries session_id (the sibling BashAllowlistGuard
      // reads input.session_id on this same event), but this hook looked only at
      // CLAUDE_SESSION_ID / DOS_SESSION_ID, which are not set — so every telemetry
      // row recorded session_id: null (505 of 505 on disk) and RFC-0031's
      // "did the operator switch ports after the advisory?" analysis had no join
      // key on any record. Read the payload field first; keep the env fallbacks and
      // the null sentinel. (Forge H-104.)
      session_id: input.session_id ?? process.env.CLAUDE_SESSION_ID ?? process.env.DOS_SESSION_ID ?? null,
      source_hook: 'WebFetchRouter',
      operator_action: null,
    });
  }
  process.exit(0);
}

const _t = startTimer('WebFetchRouter');
process.on('exit', () => stopTimer(_t, 'PreToolUse'));
main().catch(() => process.exit(0));
