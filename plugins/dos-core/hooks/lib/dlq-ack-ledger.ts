/**
 * dlq-ack-ledger — Ack-log witness of drained DLQ events
 *
 * Phase-2 sprout from dlq.ts. Owns the ack-ledger surface (drain witness
 * logging) — buffer, manifest, rotation, flush. Re-exported by dlq.ts for
 * back-compat with existing 24 importers.
 *
 * Provenance: dlq.ts §Ack log — witness of drained events (PR3a; RedTeam
 * Attack 7). Carve performed under Feathers's "smallest carve, re-export
 * shim" prescription + Fowler's Extract Module refactoring.
 *
 * File layout: ${DOS_DIR}/MEMORY/STATE/ack-{YYYYMMDD}.jsonl
 * Manifest:    ${DOS_DIR}/MEMORY/STATE/ack-manifest.json
 *
 * ack.jsonl is the CLIENT-side witness of what Studio returned 2xx for.
 * Per spec §Architecture, Studio's DB table is authoritative for PR5
 * audit; ack.jsonl provides local correlation for weekly reconciliation
 * drift-detection. On every successful POST, one line is appended. On
 * each drain invocation, any prior-day file not yet in the manifest is
 * sealed via SHA256 + file size + line count.
 *
 * Public API:
 *   bufferAck(entry)        — push a witness entry into the in-memory buffer
 *   flushAck()              — fsync the buffer to today's day-stamped file
 *   rotateAckIfNeeded()     — seal prior-day files into the manifest
 *
 * Types:
 *   AckEntry                — one drain-witness record (one per 2xx)
 *   AckManifestEntry        — one sealed-rotation record in the manifest
 */

import { createHash } from 'node:crypto';
import {
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';

import { dosPath } from './paths';
// Type-only import keeps the cycle erased at runtime — dlq.ts imports values
// from this module; this module only references DrainSource as a type.
import type { DrainSource } from './dlq';

// ─────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────

export interface AckEntry {
  endpoint: string;
  idempotencyKey: string | null;
  status: number;
  source: DrainSource;
  drainedAt: string;
  capturedAt: string;
}

export interface AckManifestEntry {
  date: string;
  file: string;
  sha256: string;
  sizeBytes: number;
  lineCount: number;
  sealedAt: string;
}

// ─────────────────────────────────────────────────────────────────────
// In-memory buffer + path helpers
// ─────────────────────────────────────────────────────────────────────

const ACK_BUFFER: AckEntry[] = [];

export function bufferAck(entry: AckEntry): void {
  ACK_BUFFER.push(entry);
}

function ackDir(): string {
  return join(dosPath('MEMORY'), 'STATE');
}

function ackTodayPath(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return join(ackDir(), `ack-${date}.jsonl`);
}

function ackManifestPath(): string {
  return join(ackDir(), 'ack-manifest.json');
}

// ─────────────────────────────────────────────────────────────────────
// flushAck — write buffered entries to today's day-stamped file
// ─────────────────────────────────────────────────────────────────────

let _flushAckMkdirWarned = false;

export function flushAck(): number {
  if (ACK_BUFFER.length === 0) return 0;
  const dir = ackDir();
  // Self-heal: STATE is project-level memory; silent no-op on a missing
  // directory drops the client-side drain witness on the floor. Consistent
  // with paths.ts:144-155 self-heal pattern.
  try {
    mkdirSync(dir, { recursive: true });
  } catch (err) {
    if (!_flushAckMkdirWarned) {
      _flushAckMkdirWarned = true;
      console.error(`[dlq.flushAck] mkdir failed for ${dir}: ${(err as Error).message}`);
    }
    return 0;
  }
  const target = ackTodayPath();
  const lines = ACK_BUFFER.map((e) => JSON.stringify(e)).join('\n') + '\n';
  try {
    // O_APPEND | O_SYNC | 0o600 — flag 0x0001 = APPEND, 0x0080 = SYNC on macOS.
    // Portable approach: open with 'a' flag which is O_APPEND; explicit fsync
    // after write provides the durability guarantee without needing O_SYNC.
    const fd = openSync(target, 'a', 0o600);
    writeFileSync(fd, lines);
    fsyncSync(fd);
    closeSync(fd);
    const flushed = ACK_BUFFER.length;
    ACK_BUFFER.length = 0;
    return flushed;
  } catch {
    return 0;
  }
}

// ─────────────────────────────────────────────────────────────────────
// Manifest read/write + prior-day rotation sealing
// ─────────────────────────────────────────────────────────────────────

function readAckManifest(): { rotations: AckManifestEntry[] } {
  const path = ackManifestPath();
  if (!existsSync(path)) return { rotations: [] };
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    return { rotations: [] };
  }
}

function writeAckManifest(manifest: { rotations: AckManifestEntry[] }): void {
  const path = ackManifestPath();
  const dir = dirname(path);
  if (!existsSync(dir)) return;
  try {
    const fd = openSync(path, 'w', 0o600);
    writeFileSync(fd, JSON.stringify(manifest, null, 2) + '\n');
    fsyncSync(fd);
    closeSync(fd);
  } catch { /* best-effort; next drain will retry */ }
}

export function rotateAckIfNeeded(): void {
  const dir = ackDir();
  if (!existsSync(dir)) return;
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  const todayName = `ack-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.jsonl`;
  const manifest = readAckManifest();
  const sealedDates = new Set(manifest.rotations.map((r) => r.date));

  let dirty = false;
  for (const name of entries) {
    if (!/^ack-\d{8}\.jsonl$/.test(name)) continue;
    if (name === todayName) continue; // never seal today
    const date = name.slice(4, 12);
    if (sealedDates.has(date)) continue;
    const full = join(dir, name);
    try {
      const raw = readFileSync(full);
      const sha = createHash('sha256').update(raw).digest('hex');
      const lineCount = raw.length === 0
        ? 0
        : raw.toString('utf-8').split('\n').filter((l) => l.length > 0).length;
      manifest.rotations.push({
        date,
        file: name,
        sha256: sha,
        sizeBytes: raw.length,
        lineCount,
        sealedAt: new Date().toISOString(),
      });
      dirty = true;
    } catch { /* skip corrupt; next drain retries */ }
  }
  if (dirty) writeAckManifest(manifest);
}

// ─────────────────────────────────────────────────────────────────────
// Test-only introspection — exposed via dlq.ts __internals when callers
// need to assert buffer state without going through flushAck side effects.
// ─────────────────────────────────────────────────────────────────────

export const __ackInternals = {
  ackBufferLength: () => ACK_BUFFER.length,
  ackBufferPeek: (): readonly AckEntry[] => ACK_BUFFER,
  ackBufferReset: () => { ACK_BUFFER.length = 0; },
  ackDir,
  ackTodayPath,
  ackManifestPath,
  readAckManifest,
};
