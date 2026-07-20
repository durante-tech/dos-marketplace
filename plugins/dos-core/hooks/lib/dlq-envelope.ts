/**
 * dlq-envelope — v2 envelope concern for the Studio sync DLQ
 *
 * Phase-4 sprout from dlq.ts. Owns the envelope concern (pure: canonicalJson,
 * digestOfBody, wrapEnvelope, EnvelopeV2 type, ENVELOPE_VERSION). No I/O,
 * no env reads, no mutable module state — pure functions only.
 *
 * Re-exported by dlq.ts for back-compat with existing importers (dlq.test.ts
 * imports `canonicalJson` and `digestOfBody` from `./dlq`; the re-export shim
 * preserves that surface).
 *
 * Provenance: dlq.ts §v2 envelope (PR1 Primitive #1) + §Canonical digest
 * (content-addressable idempotency keys). Carve performed under Feathers's
 * "smallest carve, re-export shim" prescription + Fowler's Extract Module
 * refactoring (Phase-4 Cluster E, ISC-1..ISC-7 in studio-sync-resilience.md).
 *
 * Public API (pure):
 *   canonicalJson(value)          — deterministic, key-sorted JSON serializer
 *   digestOfBody(body)            — sha256 hex digest of canonicalJson(body)
 *   wrapEnvelope(...)             — produce a v2 envelope record
 *
 * Types:
 *   EnvelopeV2                    — the on-disk + in-flight envelope shape
 *   ENVELOPE_VERSION              — `2 as const`
 */

import { createHash } from 'node:crypto';

import { resolveProjectSlug } from './project-context';
// Type-only import keeps the cycle erased at runtime — dlq.ts imports values
// from this module; this module only references DLQTool as a type.
import type { DLQTool } from './dlq';

// ─────────────────────────────────────────────────────────────────────
// v2 envelope
// ─────────────────────────────────────────────────────────────────────

export const ENVELOPE_VERSION = 2 as const;

export interface EnvelopeV2 {
  version: typeof ENVELOPE_VERSION;
  tool: DLQTool;
  endpoint: string;
  idempotencyKey: string | null;
  capturedAt: string;
  payload: unknown;
  /**
   * Client-generated UUID v4 threaded through as `x-dos-correlation-id` so
   * a single user turn can be traced UserPromptSubmit → hook → queueOrPost
   * → drain POST → Prisma row → UI event strip. Nullable for forward-
   * compat with v2 envelopes written before the field existed.
   */
  correlationId?: string | null;
  /**
   * DOS project slug (from .dos-projects.json `id` field, e.g. "durante").
   * Sent as `x-dos-project-slug` request header; Studio's auth-bearer
   * resolves slug → Project.id UUID and sets ctx.projectId. Nullable for
   * forward-compat with v2 envelopes written before the field existed.
   */
  projectSlug?: string | null;
  /**
   * Producer-attempt counter (PRD ISC-H8, council 2026-05-05). Incremented
   * by the drainer on every requeue so `classifyFailure` can implement
   * N-strike quarantine without external state. Backward-compatible:
   * undefined is treated as 0; envelopes written before this field
   * existed simply start their first retry at attempts=1 after the
   * drainer rewrites them.
   */
  attempts?: number;
}

export function wrapEnvelope(
  payload: unknown,
  endpoint: string,
  tool: DLQTool,
  idempotencyKey: string | undefined,
  correlationId?: string,
): EnvelopeV2 {
  return {
    version: ENVELOPE_VERSION,
    tool,
    endpoint,
    idempotencyKey: idempotencyKey ?? null,
    capturedAt: new Date().toISOString(),
    payload,
    correlationId: correlationId ?? globalThis.crypto?.randomUUID() ?? null,
    projectSlug: resolveProjectSlug(),
    attempts: 0,
  };
}

// ─────────────────────────────────────────────────────────────────────
// Canonical digest (for content-addressable idempotency keys)
// ─────────────────────────────────────────────────────────────────────

export function canonicalJson(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'number' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return '[' + value.map((v) => canonicalJson(v)).join(',') + ']';
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj)
      .filter((k) => obj[k] !== undefined)
      .sort();
    return '{' + keys.map((k) => JSON.stringify(k) + ':' + canonicalJson(obj[k])).join(',') + '}';
  }
  return 'null';
}

export function digestOfBody(body: unknown): string {
  return createHash('sha256').update(canonicalJson(body)).digest('hex');
}
