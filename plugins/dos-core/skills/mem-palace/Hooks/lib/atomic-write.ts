/**
 * atomic-write.ts — crash-safe writes for shared state files.
 *
 * RFC-0005 §13.1 R2 (P0-2 resolved): shared state files use atomic-write
 * + flock so concurrent readers never see torn writes and concurrent
 * read-modify-write cycles don't corrupt each other.
 *
 * Three helpers, picked by caller hazard model:
 *
 *   atomicWriteSync(path, content)
 *     Torn-write protection only. Writes `<path>.tmp.<pid>.<rand>`, fsyncs,
 *     renames over `path`. On Linux/macOS this is the standard
 *     write-temp → fsync → rename pattern. Use for single-writer hooks
 *     where the race is "crashed mid-write leaves a partial file".
 *
 *   atomicAppendSync(path, line)
 *     POSIX `O_APPEND` is atomic for writes ≤ PIPE_BUF (typically 4096B).
 *     Each JSONL line fits comfortably. Use for append-only logs (ratings,
 *     events, errors). The kernel serializes appends across processes on
 *     a single file descriptor; multiple processes opening the same path
 *     separately each get atomic appends.
 *
 *   withFileLock(path, fn)
 *     Cross-process mutual exclusion via `mkdir` (POSIX-atomic on every
 *     sane filesystem: APFS, ext4, XFS, NTFS). Retries on EEXIST with a
 *     short backoff. Use for read-modify-write cycles where two callers
 *     must serialize (e.g. a counter increment in a shared JSON file).
 *
 * Never throws on filesystem errors the caller can't do anything about —
 * the advisory rule is that a broken log/lock must not crash the hook.
 * `atomicWriteSync` and `atomicAppendSync` swallow errors silently so
 * they're drop-in replacements for `writeFileSync` / `appendFileSync`.
 * `withFileLock` throws only if the lock can't be acquired before timeout.
 */

import {
  closeSync,
  fsyncSync,
  mkdirSync,
  openSync,
  renameSync,
  rmdirSync,
  unlinkSync,
  writeSync,
} from 'node:fs';
import { dirname, basename, join } from 'node:path';
import { Buffer } from 'node:buffer';

function ensureDirSync(path: string): void {
  try {
    mkdirSync(dirname(path), { recursive: true });
  } catch {
    // Parent exists already, or filesystem says no — caller's write will surface the real error.
  }
}

/**
 * Write `content` to `path` atomically: temp-file, fsync, rename.
 * Silent on failure. Returns true on success, false on any error.
 */
export function atomicWriteSync(path: string, content: string | Buffer): boolean {
  ensureDirSync(path);
  const tmp = join(
    dirname(path),
    `.${basename(path)}.tmp.${process.pid}.${Math.random().toString(36).slice(2, 8)}`,
  );
  let fd: number | undefined;
  try {
    fd = openSync(tmp, 'w', 0o644);
    const buf = typeof content === 'string' ? Buffer.from(content, 'utf8') : content;
    writeSync(fd, buf, 0, buf.length, 0);
    fsyncSync(fd);
    closeSync(fd);
    fd = undefined;
    renameSync(tmp, path);
    return true;
  } catch {
    if (fd !== undefined) {
      try { closeSync(fd); } catch {}
    }
    try { unlinkSync(tmp); } catch {}
    return false;
  }
}

/**
 * Append `line` to `path` atomically using `O_APPEND`. Small writes are
 * serialized by the kernel; each call produces an atomic record boundary.
 * `line` does NOT need a trailing newline — one is added if missing.
 */
export function atomicAppendSync(path: string, line: string): boolean {
  ensureDirSync(path);
  const normalized = line.endsWith('\n') ? line : line + '\n';
  let fd: number | undefined;
  try {
    // O_APPEND | O_CREAT | O_WRONLY — kernel guarantees each write ≤ PIPE_BUF is atomic.
    fd = openSync(path, 'a', 0o644);
    const buf = Buffer.from(normalized, 'utf8');
    writeSync(fd, buf, 0, buf.length, null);
    closeSync(fd);
    return true;
  } catch {
    if (fd !== undefined) {
      try { closeSync(fd); } catch {}
    }
    return false;
  }
}

/**
 * Execute `fn` holding an exclusive lock on `<path>.lock`. Retries with
 * exponential backoff until `timeoutMs` elapses. Throws on timeout.
 *
 * Lock is a directory (POSIX-atomic `mkdir`). On crash, the directory
 * survives and subsequent callers will retry until timeout — callers that
 * can't afford a stale-lock wedge should use a shorter timeout and handle
 * the throw.
 */
export function withFileLock<T>(path: string, fn: () => T, timeoutMs: number = 5000): T {
  const lockDir = path + '.lock';
  const deadline = Date.now() + timeoutMs;
  let delayMs = 2;
  while (Date.now() < deadline) {
    try {
      mkdirSync(lockDir);
      try {
        return fn();
      } finally {
        try { rmdirSync(lockDir); } catch {}
      }
    } catch (err) {
      const e = err as { code?: string };
      if (e.code !== 'EEXIST') throw err;
      // Busy — wait and retry. Sync sleep via spin: a small, bounded busy-wait
      // is acceptable here because lock hold times are milliseconds.
      const waitUntil = Date.now() + delayMs;
      while (Date.now() < waitUntil) { /* busy-spin */ }
      delayMs = Math.min(delayMs * 2, 100);
    }
  }
  throw new Error(`withFileLock: timeout acquiring ${lockDir} after ${timeoutMs}ms`);
}
