/**
 * work-os-board.ts — render the `## Work OS Board` wake-up section from the
 * board projection cache (read path, council-ratified 2026-07-10).
 *
 * WRITER: `~/Durante/Tools/work-os.ts` — the `snapshot` subcommand plus
 * guarded ride-along refreshes on every board mutation (from-prd, set-status,
 * reconcile). This reader NEVER touches the network: one bounded file read.
 *
 * CONTRACTS (all council-sourced):
 * - Staleness keys on `generated_at` INSIDE the JSON against the snapshot's
 *   own `stale_after_ms` — never file mtime (a guarded writer that keeps
 *   failing must read as stale, not fresh).
 * - Absent file → '' (customer installs without Work OS see nothing).
 * - Malformed JSON → '' (never crash the wake path).
 * - Oversized file → one-line marker section, NOT '' (byte ceiling: the board
 *   grows, the wake budget does not — but a silently-vanished board section
 *   is indistinguishable from "not installed"; review F5 2026-07-10).
 * - Status names are NEVER whitelisted — counts and items derive from
 *   whatever statuses the snapshot carries, so an operator-added board
 *   status can't make open work invisible (review F3 2026-07-10).
 */

import { existsSync, readFileSync, statSync } from 'fs';
import { dirname, join } from 'path';

/** Cap what the wake path will parse. */
export const BOARD_SNAPSHOT_MAX_BYTES = 256 * 1024;

/** Top-N open items surfaced in the banner. */
export const BOARD_SECTION_TOP_N = 3;

/** Fallback staleness bound when the snapshot predates `stale_after_ms`. */
const DEFAULT_STALE_AFTER_MS = 6 * 60 * 60 * 1000;

interface SnapshotItem {
  title?: unknown;
  status?: unknown;
  priority?: unknown;
  target?: unknown;
}

/**
 * Render the board section, or '' when the section should be omitted.
 * `nowMs` is injected for testability.
 */
/** Preferred display order — statuses outside this list still render, after these. */
const STATUS_ORDER = ['In Progress', 'In Review', 'Up Next', 'Blocked', 'Backlog'];

/** Statuses whose items are preferred for the top-N line-items. */
const TOP_ITEM_STATUSES = new Set(['In Progress', 'Up Next']);

export function buildWorkOsBoardSection(snapshotFile: string, nowMs: number): string {
  try {
    if (!existsSync(snapshotFile)) return '';
    const size = statSync(snapshotFile).size;
    if (size > BOARD_SNAPSHOT_MAX_BYTES) {
      return (
        `## Work OS Board\n` +
        `_snapshot too large to render (${Math.round(size / 1024)}KB > ${Math.round(BOARD_SNAPSHOT_MAX_BYTES / 1024)}KB ceiling) — ` +
        `read it via the work-os skill or prune the board_\n`
      );
    }

    const snap = JSON.parse(readFileSync(snapshotFile, 'utf-8')) as {
      generated_at?: unknown;
      stale_after_ms?: unknown;
      counts?: Record<string, unknown>;
      open?: unknown;
      proposals?: unknown;
    };
    const generatedMs = Date.parse(String(snap?.generated_at ?? ''));
    if (!Number.isFinite(generatedMs) || !Array.isArray(snap?.open)) return '';

    const staleAfterMs =
      typeof snap.stale_after_ms === 'number' && snap.stale_after_ms > 0
        ? snap.stale_after_ms
        : DEFAULT_STALE_AFTER_MS;
    const ageMs = Math.max(0, nowMs - generatedMs);
    const ageLabel =
      ageMs < 60 * 60 * 1000
        ? `${Math.round(ageMs / 60000)}m`
        : `${Math.round((ageMs / 3600000) * 10) / 10}h`;
    const stale = ageMs > staleAfterMs;

    const counts = snap.counts ?? {};
    const isCount = (s: string) => typeof counts[s] === 'number' && (counts[s] as number) > 0;
    const orderedStatuses = [
      ...STATUS_ORDER.filter(isCount),
      ...Object.keys(counts)
        .filter((s) => s !== 'Done' && !STATUS_ORDER.includes(s) && isCount(s))
        .sort(),
    ];
    const countLine = orderedStatuses.map((s) => `${s}: ${counts[s]}`).join(' · ');

    const open = snap.open as SnapshotItem[];
    const preferred = open.filter((o) => TOP_ITEM_STATUSES.has(String(o?.status)));
    const rest = open.filter((o) => !TOP_ITEM_STATUSES.has(String(o?.status)));
    const top = [...preferred, ...rest].slice(0, BOARD_SECTION_TOP_N);

    const parts: string[] = [`## Work OS Board`];
    parts.push(
      `_snapshot ${ageLabel} old${stale ? ' — ⚠️ STALE (refresh: `bun ~/Durante/Tools/work-os.ts snapshot`)' : ''}_`,
    );
    if (countLine) parts.push(countLine);
    for (const t of top) {
      const extras = [
        t.priority ? String(t.priority) : null,
        t.target ? `due ${String(t.target)}` : null,
      ].filter(Boolean);
      parts.push(`- [${String(t.status)}] ${String(t.title ?? '')}${extras.length ? ` · ${extras.join(' · ')}` : ''}`);
    }

    // RFC-0165 §6b (proactive harness A1): the snapshot's deterministic top-3
    // Backlog proposals — the system offers before the operator asks. Absent or
    // malformed proposals render nothing (older snapshots stay valid).
    if (Array.isArray(snap.proposals) && snap.proposals.length > 0) {
      parts.push(`▶ Proposed next (machine-filed Backlog — say the word or let Prospector stake it):`);
      for (const pr of (snap.proposals as SnapshotItem[]).slice(0, 3)) {
        parts.push(`- ${String(pr?.title ?? '')}`);
      }
    }

    // RFC-0165 §6b (A2): backlog-sweep digest — per-class counts from the last
    // sweep, rendered as the per-wake backlog brief. Fail-silent by design.
    try {
      const reportFile = join(dirname(snapshotFile), 'backlog-sweep-report.json');
      if (existsSync(reportFile) && statSync(reportFile).size < 512 * 1024) {
        const rep = JSON.parse(readFileSync(reportFile, 'utf-8')) as {
          ts?: unknown; by_class?: Record<string, unknown>;
        };
        const by = rep?.by_class ?? {};
        const bits = Object.keys(by)
          .sort()
          .filter((k) => typeof by[k] === 'number' && (by[k] as number) > 0)
          .map((k) => `${k}: ${by[k]}`);
        if (bits.length) {
          const d = String(rep?.ts ?? '').slice(0, 10);
          parts.push(`_backlog sweep${d ? ` ${d}` : ''}: ${bits.join(' · ')}_`);
        }
      }
    } catch {
      /* sweep digest is best-effort — never break the banner */
    }

    parts.push('');
    return parts.join('\n');
  } catch {
    return '';
  }
}
