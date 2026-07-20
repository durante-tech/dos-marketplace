/**
 * rotate.ts — size-based JSONL rotation helper for hook log files.
 *
 * Used by hooks that append unbounded JSONL streams:
 *   - WebFetchRouter.hook.ts     → web-fetch-router-telemetry.jsonl
 *   - ArtifactAutoLogger.hook.ts → artifacts.jsonl
 *   - hook-io.ts (timing)        → hook-timing.jsonl
 *   - VoiceNotification handler  → voice-events.jsonl
 *
 * Rotates the file when size > maxBytes by renaming it with an ISO-stamp
 * suffix. Non-blocking — every error path is silent so the host hook
 * never crashes on a rotation failure.
 *
 * Designed for per-process invocation (each hook spawn calls rotateIfNeeded
 * once before the appendFileSync). Concurrent multi-process rotation is
 * benign: second rename throws ENOENT, the catch swallows it, the second
 * append continues on the (now fresh) file.
 */
import { statSync, renameSync } from 'node:fs';

/** 5 MB default. Sized to keep typical 7-day soaks on one file. */
export const DEFAULT_ROTATION_BYTES = 5_000_000;

export interface RotateOpts {
  /**
   * Threshold in bytes. Files with `size > maxBytes` get rotated. Default
   * `DEFAULT_ROTATION_BYTES` (5 MB).
   */
  maxBytes?: number;
}

/**
 * Rotate the JSONL file at `path` if its size exceeds the threshold.
 * Renames to `<base>-<ISO-stamp>.jsonl` (colons replaced with dashes for
 * filesystem-portability). The next append at `path` creates a fresh file.
 *
 * Silent on every error path — host hooks must continue regardless.
 */
export function rotateIfNeeded(path: string, opts: RotateOpts = {}): void {
  const maxBytes = opts.maxBytes ?? DEFAULT_ROTATION_BYTES;

  let size = 0;
  try {
    size = statSync(path).size;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return;
    return; // unexpected stat error — silent (host hook must continue)
  }
  if (size <= maxBytes) return;

  const stamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+$/, '');
  const rotated = path.replace(/\.jsonl$/, `-${stamp}.jsonl`);
  try {
    renameSync(path, rotated);
  } catch {
    // Concurrent-writer race or permission issue — silent. Append continues
    // on the unrotated file; next invocation retries.
  }
}
