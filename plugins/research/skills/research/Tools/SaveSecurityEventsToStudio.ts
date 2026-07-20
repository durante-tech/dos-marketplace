#!/usr/bin/env bun
/**
 * SaveSecurityEventsToStudio — Sync security events to Studio Security API.
 *
 * Walks MEMORY/SECURITY/{YYYY}/{MM}/*.jsonl and batch-POSTs all entries to
 * /api/v1/security/events via the canonical queueOrPost helper. On POST
 * failure queueOrPost queues the batch envelope to MEMORY/SECURITY/.pending/
 * for the canonical DrainPending hook to ship later.
 *
 * Migration note (Phase-3 / Cluster M3): the previous custom DLQ
 * (events-{ISO}.jsonl + retryPending() + --retry-pending arg) was deleted
 * in favor of queueOrPost. Filename naming flipped from event-batch-ISO to
 * the canonical {sessionId}-{seq:08d}.ready envelope; DrainPending walks
 * envelopes regardless. Atomic write semantics are owned by queueOrPost
 * (write to .inflight, fsync, rename to .ready), so the local
 * write-to-sibling-tmp dance was removed.
 *
 * USAGE
 * -----
 *   bun SaveSecurityEventsToStudio.ts --import-all
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { queueOrPost, digestOfBody } from '../Lib/dlq';
import { loadAckedKeys } from '../Lib/dlq-dedup';
import { loadEnv } from '../Lib/env';
import { requireStudioConfigOrSkip } from '../Lib/studioClient';

loadEnv();

function getAllDirs(subdir: string): string[] {
  const home = homedir();
  const dosDir = process.env.DOS_DIR || join(home, '.claude');
  const dirs: string[] = [];
  const seen = new Set<string>();

  const globalDir = join(dosDir, 'MEMORY', subdir);
  if (existsSync(globalDir)) { dirs.push(globalDir); seen.add(globalDir); }

  const projectsPath = join(dosDir, 'DOS', 'USER', 'PROJECTS', 'PROJECTS.md');
  if (existsSync(projectsPath)) {
    try {
      const content = readFileSync(projectsPath, 'utf-8');
      for (const line of content.split('\n')) {
        if (!line.startsWith('|') || line.includes('---') || line.includes('Path')) continue;
        const cells = line.split('|').map(c => c.trim()).filter(Boolean);
        if (cells.length < 2) continue;
        const rawPath = cells[1];
        if (!rawPath || rawPath === '-') continue;
        // Expand $HOME / ${HOME} / ~ to match the canonical expandPath
        // (hooks/lib/paths.ts) — a PROJECTS.md row using $HOME was silently
        // skipped before because only the ~ prefix was handled. [hooks-003]
        const fullPath = rawPath
          .replace(/^\$HOME(?=\/|$)/, home)
          .replace(/^\$\{HOME\}(?=\/|$)/, home)
          .replace(/^~(?=\/|$)/, home);
        const projectDir = join(fullPath, 'MEMORY', subdir);
        if (!seen.has(projectDir) && existsSync(projectDir)) {
          dirs.push(projectDir);
          seen.add(projectDir);
        }
      }
    } catch { /* non-critical */ }
  }

  return dirs;
}

// requireStudioConfigOrSkip is called for its side effect (early exit when
// Studio is unconfigured). queueOrPost reads STUDIO_API_URL/STUDIO_API_KEY
// internally so we don't need the returned values here.
requireStudioConfigOrSkip('SaveSecurityEventsToStudio');

interface SecurityEntry {
  timestamp: string;
  session_id: string;
  event_type: string;
  tool?: string;
  category?: string;
  target?: string;
  pattern_matched?: string;
  reason?: string;
  action_taken?: string;
  // Stop-hook diagnostic shape (stop-failures-YYYY-MM-DD.jsonl):
  // {timestamp, session_id, event_type:"stop_failure", hook_event, error_details}
  hook_event?: string;
  error_details?: string;
}

/**
 * Shape expected by POST /api/v1/security/events (single event entry).
 *
 * Studio's `BulkSecuritySchema` (apps/web/app/api/v1/security/events/route.ts):
 * - `tool`, `category`, `target`, `actionTaken` are `z.string().min(1)` (required, NOT NULL)
 * - `sessionId`, `patternMatched`, `reason`, `recordedAt`, `dosSessionId` are `z.string().optional()` (or `z.coerce.date().optional()`)
 *
 * Zod's `.optional()` accepts the field being ABSENT (undefined) but NOT
 * `null`. We therefore omit absent fields rather than serialize them as
 * `null` — JSON.stringify drops `undefined`-valued object keys, so the
 * wire payload has the right shape automatically.
 */
interface StudioEvent {
  sessionId?: string;
  eventType: string;
  tool: string;
  category: string;
  target: string;
  patternMatched?: string;
  reason?: string;
  actionTaken: string;
  recordedAt?: string;
}

/** Bound the actionTaken sentinel so a giant error_details blob doesn't
 *  blow up the row. The DB column has no length cap but the audit value
 *  past 256 chars is essentially never the actionable signal. */
function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1) + '…';
}

/**
 * Map an on-disk SECURITY entry to the Studio event shape, coercing
 * missing-but-NOT-NULL fields to sentinel strings so the row survives
 * Zod + Prisma validation. Audit trail is preserved: the original
 * shape can be reconstructed from `tool=hook:<event>` + `category=hook_diagnostic`.
 *
 * Sentinel choices intentionally do NOT collide with the existing
 * SECURITY_CATEGORY constants (skill_root_violation, bash_command,
 * path_access) and the `category="hook_diagnostic"` filter keeps these
 * rows out of the weekly-violation-drift aggregator that backs
 * /api/v1/artifacts/drift.
 */
function toStudioEvent(entry: SecurityEntry): StudioEvent {
  const hookEvent = entry.hook_event;
  const errorDetails = entry.error_details;

  const tool =
    entry.tool ||
    (hookEvent ? `hook:${hookEvent}` : 'unknown');
  const category = entry.category || 'hook_diagnostic';
  const target = entry.target || hookEvent || 'unknown';
  const actionTaken =
    entry.action_taken ||
    (errorDetails && errorDetails !== '(none)' ? truncate(errorDetails, 256) : 'no-op');

  // Omit (rather than null-stuff) optional fields the schema rejects
  // when they arrive as `null`. JSON.stringify drops undefined values.
  const out: StudioEvent = {
    eventType: entry.event_type,
    tool,
    category,
    target,
    actionTaken,
  };
  if (entry.session_id) out.sessionId = entry.session_id;
  if (entry.pattern_matched) out.patternMatched = entry.pattern_matched;
  if (entry.reason) out.reason = entry.reason;
  if (entry.timestamp) out.recordedAt = entry.timestamp;
  return out;
}

/** Walk all SECURITY trees and return every parsed event in a single batch. */
function collectFreshEvents(): StudioEvent[] {
  const out: StudioEvent[] = [];
  const securityDirs = getAllDirs('SECURITY');

  for (const securityDir of securityDirs) {
    let yearDirs: string[];
    try {
      yearDirs = readdirSync(securityDir).filter((d) => {
        const p = join(securityDir, d);
        try { return statSync(p).isDirectory() && /^\d{4}$/.test(d); } catch { return false; }
      });
    } catch { continue; }

    for (const yearDir of yearDirs) {
      const yearPath = join(securityDir, yearDir);

      let monthDirs: string[];
      try {
        monthDirs = readdirSync(yearPath).filter((d) => {
          const p = join(yearPath, d);
          try { return statSync(p).isDirectory(); } catch { return false; }
        });
      } catch { continue; }

      for (const monthDir of monthDirs) {
        const monthPath = join(yearPath, monthDir);
        let jsonlFiles: string[];
        try {
          jsonlFiles = readdirSync(monthPath).filter((f) => f.endsWith('.jsonl'));
        } catch { continue; }

        for (const jsonlFile of jsonlFiles) {
          const filePath = join(monthPath, jsonlFile);
          let content: string;
          try { content = readFileSync(filePath, 'utf-8'); } catch { continue; }

          const lines = content.split('\n').filter((l) => l.trim());
          for (const line of lines) {
            try {
              const entry = JSON.parse(line) as SecurityEntry;
              if (!entry.event_type) continue;
              out.push(toStudioEvent(entry));
            } catch { /* skip malformed */ }
          }
        }
      }
    }
  }

  return out;
}

async function importAll(): Promise<void> {
  const events = collectFreshEvents();
  if (events.length === 0) {
    console.error('No security events found');
    process.exit(0);
  }

  // Ack-dedup: skip the batch if its idempotencyKey is already in the ack
  // ledger (incident 2026-06-22 — --import-all re-floods the DLQ every
  // SessionEnd). Load the acked set ONCE here, before the enqueue.
  const acked = loadAckedKeys("secevt:");
  let skipped = 0;

  // Preserve the existing batch contract: { events: [...] } in one envelope.
  // queueOrPost owns atomicity, retry, and DLQ — DrainPending ships on failure.
  const body = { events };
  // FIREWALL: compute the key ONCE and reuse the SAME variable for both the
  // dedup check and the idempotencyKey — two separate expressions would risk
  // silent data loss if they ever diverged.
  // NOTE: Studio's POST /api/v1/security/events expects `secevt:<digest>`
  // (route line 78: `keyFrom: () => \`secevt:${digestBody(rawBody)}\``).
  // The DLQ-tool name remains "security-events" for envelope routing —
  // those are two separate namespaces (tool routes the DLQ; idempotencyKey
  // matches Studio's per-route schema). Mismatch detected 2026-05-10 while
  // draining /api/v1/security/events 404→4xx quarantine.
  const key = `secevt:${digestOfBody(body)}`;
  if (acked.has(key)) {
    skipped++;
    console.error(`Import skipped: ${events.length} security events already synced (${skipped} batch deduped)`);
    process.exit(0);
  }

  const result = await queueOrPost(body, '/api/v1/security/events', {
    tool: 'security-events',
    idempotencyKey: key,
  });

  if (result.outcome === 'posted') {
    console.error(`Import complete: ${events.length} security events synced (${skipped} skipped)`);
  } else if (result.outcome === 'queued') {
    console.error(`[DLQ] queued ${events.length} events to ${result.path} (${skipped} skipped)`);
  } else {
    console.error(`Sync dropped for ${events.length} events: ${result.reason}`);
    process.exit(1);
  }
}

const args = process.argv.slice(2);
if (args[0] === '--import-all') {
  await importAll();
} else {
  console.error('Usage: bun SaveSecurityEventsToStudio.ts --import-all');
  process.exit(1);
}
