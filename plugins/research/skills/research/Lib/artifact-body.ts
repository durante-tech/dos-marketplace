/**
 * artifact-body — PURE body + idempotency-key builders for the Studio
 * artifact sync (Tools/SaveArtifactsToStudio.ts).
 *
 * ── INVARIANT (incident 2026-07-06, wave-delivery board item G7) ──────────
 * The POST body — and therefore the idempotency key, which embeds
 * digestOfBody(body) — MUST be a deterministic function of the
 * artifacts.jsonl row alone. No ambient state (filesystem scans, clock,
 * "currently active PRD") may leak into the body.
 *
 * WHY: the RFC-0007 Phase-A "Slice D" fallback used to blanket-apply the
 * latest-mtime MEMORY/WORK PRD's slug + receiptSha to every row that lacked
 * its own prdSlug/receiptSha. Under a busy loop fleet the latest PRD changes
 * many times a day, so the body — and hence the key — of every fallback row
 * churned on every `--import-all` pass. The July 2026 ack ledger held 79,460
 * distinct `artifacts:` keys for only 10,679 row identities (~7.4 keys/row;
 * one row reached 2,608 keys). Every re-key defeated BOTH dedup layers
 * (the local ack-ledger skip in Lib/dlq-dedup AND Studio's idempotency
 * replay), so the corpus re-enqueued and re-POSTed indefinitely — the
 * 2026-07-06 `.pending` flood (59,739 envelopes across both trees).
 *
 * Phase A.1 already embeds prdSlug/receiptSha at JSONL-append time
 * (ArtifactAutoLogger.hook.ts), so new rows keep their linkage. Rows written
 * before A.1 now sync with null linkage — the lesser evil by four orders of
 * magnitude, and those rows had already been over-synced under rotating
 * blanket slugs anyway.
 */

import { createHash } from 'crypto';
import { digestOfBody } from './dlq';

export interface ArtifactEntry {
  timestamp: string;
  pack: string;
  workflow: string;
  type: string;
  title: string;
  path: string;
  contentPreview: string;
  wing: string;
  sessionId: string;
  // RFC-0007 × Artifact bridge — Phase A.1. Populated at JSONL-append time
  // by ArtifactAutoLogger.hook.ts for per-entry precision; absent on rows
  // written before A.1 (those rows sync with null linkage — see header).
  prdSlug?: string;
  receiptSha?: string;
}

/**
 * Build the Studio POST body from the JSONL row and NOTHING else.
 * Deterministic per row — see the module-header invariant.
 */
export function buildArtifactBody(entry: ArtifactEntry): Record<string, unknown> {
  const body: Record<string, unknown> = {
    pack: entry.pack,
    workflow: entry.workflow,
    artifactType: entry.type,
    title: entry.title,
    filePath: entry.path,
    contentPreview: entry.contentPreview,
    wing: entry.wing,
    // Aligned with artifactsKeyFor's `entry.sessionId ?? ''` — a row missing
    // sessionId must normalize identically in body and key.
    sessionId: entry.sessionId ?? '',
    producedAt: entry.timestamp,
  };
  // Per-entry precision only (Phase A.1). The Slice-D "active PRD" blanket
  // fallback was REMOVED 2026-07-06 (G7) — it poisoned idempotency keys.
  if (entry.prdSlug) body.prdSlug = entry.prdSlug;
  if (entry.receiptSha) body.receiptSha = entry.receiptSha;
  return body;
}

// V13 F5.1 R-DLQ-1 (operator approval 2026-05-13): Idempotency key MUST
// match Studio's withIdempotency.keyFrom in
// apps/web/app/api/v1/artifacts/route.ts (session scope). filePath digest
// stays as semantic prefix (operator-debug readability + keeps the key
// inside the gateway regex `^[A-Za-z0-9][A-Za-z0-9:._+-]{0,254}$` which
// forbids slashes). digestOfBody(body) is the load-bearing dedup primitive
// — hash over on-wire bytes, not parsed view. Drift between this hash and
// Studio's hash silently produces 400.
export function artifactsKeyFor(entry: ArtifactEntry, body: Record<string, unknown>): string {
  const filePathDigest = createHash('sha256').update(entry.path).digest('hex').slice(0, 16);
  return `artifacts:${entry.sessionId ?? ''}:${filePathDigest}:${digestOfBody(body)}`;
}
