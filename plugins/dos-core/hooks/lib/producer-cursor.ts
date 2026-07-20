/**
 * producer-cursor — best-effort high-water-mark for sync-tool producers.
 *
 * Persists a per-producer JSON document under `MEMORY/STATE/cursors/{name}.json`
 * so producers like `Save*ToStudio.ts` can skip re-emission of rows already
 * shipped. Studio's per-endpoint Idempotency-Key dedup is the correctness
 * backstop — if the producer crashes between emit and write(), the cursor
 * stays at the prior value and rows are re-emitted next fire (and dedup'd).
 * The cursor is throughput optimization, not durability.
 *
 * Caller chooses the cursor shape — JSONL byte-offset map, mtime watermark
 * map, KG fact-id map, etc. — via `openCursor<T>(name, default)` or one of
 * the typed wrappers below.
 */

import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { atomicWriteSync } from './atomic-write';

function cursorsDir(): string {
  const home = homedir();
  const dosDir = process.env.DOS_DIR || join(home, '.claude');
  return join(dosDir, 'MEMORY', 'STATE', 'cursors');
}

export interface CursorStore<T> {
  read(): T;
  write(value: T): void;
}

/**
 * Open a typed cursor backed by `MEMORY/STATE/cursors/{name}.json`.
 * `defaultValue` is returned on first read or after a parse failure.
 *
 * `name` MUST match `[A-Za-z0-9_-]+` — used as a filename.
 */
export function openCursor<T>(name: string, defaultValue: T): CursorStore<T> {
  if (!/^[A-Za-z0-9_-]+$/.test(name)) {
    throw new Error(`producer-cursor: invalid name "${name}"`);
  }
  const path = join(cursorsDir(), `${name}.json`);

  return {
    read(): T {
      try {
        return JSON.parse(readFileSync(path, 'utf-8')) as T;
      } catch {
        // ENOENT (first run / no cursor yet) and JSON parse failures both
        // collapse to the default — caller cannot distinguish, by design.
        return defaultValue;
      }
    },
    write(value: T): void {
      // atomicWriteSync ensures parent dir + does fsync; silent on failure.
      // Best-effort: if write fails, next fire re-emits (Studio idempotency dedups).
      atomicWriteSync(path, JSON.stringify(value));
    },
  };
}

/**
 * Helper for the "JSONL append-only file" pattern. Tracks byte offsets
 * per source path. On read returns 0 for unseen paths or when the file
 * was truncated (size < cursor) — that resets to a full re-emit which
 * is the safe fallback after rotation.
 */
export interface JsonlOffsetCursor {
  /** Returns the byte offset to start reading from for this path. */
  offsetFor(path: string, currentSize: number): number;
  /** Records the new offset for this path. Caller persists at end of pass. */
  advance(path: string, newOffset: number): void;
  /** Persist all advances made since the last commit. */
  commit(): void;
}

export function openJsonlOffsetCursor(name: string): JsonlOffsetCursor {
  const store = openCursor<Record<string, number>>(name, {});
  let snapshot = store.read();
  let dirty = false;

  return {
    offsetFor(path: string, currentSize: number): number {
      const prev = snapshot[path] ?? 0;
      // Truncation/rotation: file is smaller than the prior cursor.
      // Reset to 0 so we re-emit from the start (Studio idempotency
      // dedups; safer than skipping rows that may now occupy old offsets).
      if (currentSize < prev) return 0;
      return prev;
    },
    advance(path: string, newOffset: number): void {
      if (snapshot[path] !== newOffset) {
        snapshot[path] = newOffset;
        dirty = true;
      }
    },
    commit(): void {
      if (dirty) {
        store.write(snapshot);
        dirty = false;
      }
    },
  };
}

/**
 * Helper for the "walked file tree by mtime" pattern. Tracks last-seen
 * mtime per absolute file path; callers compare incoming `mtimeMs`
 * against `lastSeen(absPath)` and skip if `<=`.
 */
export interface MtimeWatermarkCursor {
  /** Returns the last mtime we shipped for this path, or 0 if unseen. */
  lastSeen(absPath: string): number;
  /** Records that we shipped at this mtime. */
  advance(absPath: string, mtimeMs: number): void;
  /** Persist all advances made since the last commit. */
  commit(): void;
}

export function openMtimeWatermarkCursor(name: string): MtimeWatermarkCursor {
  const store = openCursor<Record<string, number>>(name, {});
  let snapshot = store.read();
  let dirty = false;

  return {
    lastSeen(absPath: string): number {
      return snapshot[absPath] ?? 0;
    },
    advance(absPath: string, mtimeMs: number): void {
      if ((snapshot[absPath] ?? 0) < mtimeMs) {
        snapshot[absPath] = mtimeMs;
        dirty = true;
      }
    },
    commit(): void {
      if (dirty) {
        store.write(snapshot);
        dirty = false;
      }
    },
  };
}
