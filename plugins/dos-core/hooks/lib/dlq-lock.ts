/**
 * dlq-lock — process-level lock for DrainPending.hook.ts.
 *
 * Provenance: PRD ISC-B11 + ISC-B12, decision D-2026-05-05-1 row 5
 * (council 2026-05-05). Overlapping SessionStart/SessionEnd drains have
 * been observed finishing within 1s of each other (2026-05-05T05:16:35).
 * The reclaim 3-check rule prevents data loss but adds work — a drainer
 * sees another drainer's .inflight files, atomic rename loses the race,
 * and the loser produces wasted "another drainer claimed it" log lines.
 *
 * The lock is a tiny JSON sidecar at `~/.claude/MEMORY/STATE/.drain.lock`.
 * Only one process holds it at a time. The no-file claim path uses an
 * O_EXCL ('wx') atomic create, so two cold-start drainers racing on an
 * empty STATE/ cannot both win — exactly one openSync succeeds, the other
 * gets EEXIST and backs off. The stale-reclaim path (file already present)
 * cannot use O_EXCL; it falls back to atomic-rename + read-back confirm,
 * gated by the conservative 3-check below so reclaimers are serialised in
 * practice. Holders identify themselves by `{pid, epoch_boot, started_at}`,
 * mirroring the existing `.inflight` 3-check rule. Stale-detection requires
 * ALL THREE of:
 *
 *   - kill -0 fails        (the holder PID is gone)
 *   - epoch_boot mismatch  (current boot is different from the holder's)
 *   - age > 60s            (lock has been there long enough to be unowned)
 *
 * If even one of those checks suggests the holder is alive, we BACK OFF.
 * That's the conservative default — a wasted drain is cheaper than a
 * concurrent-drain race that ends up double-classifying envelopes.
 *
 * The lock is best-effort. Filesystem hiccups produce one stderr line and
 * we proceed without the lock; the caller falls back to inflight-claim
 * race semantics that still preserve correctness.
 *
 * Public API:
 *   acquireDrainLock()  → { acquired: true } | { acquired: false; holder }
 *   releaseDrainLock()
 *   __dlqLockInternals  (test surface — path resolution, manual stale)
 */

import {
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { uptime as osUptime } from 'node:os';
import { dirname, join } from 'node:path';

import { dosPath } from './paths';

// ─────────────────────────────────────────────────────────────────────
// Boot-epoch identity (mirrors dlq-drain's BOOT_EPOCH derivation)
// ─────────────────────────────────────────────────────────────────────

function bootEpochSeconds(): number {
  // Linux: /proc/stat btime <seconds>
  try {
    const s = readFileSync('/proc/stat', 'utf-8');
    const m = s.match(/^btime\s+(\d+)/m);
    if (m && m[1]) return Number.parseInt(m[1], 10);
  } catch { /* not linux */ }

  // macOS: derive from system uptime.
  try {
    const now = Math.floor(Date.now() / 1000);
    const up = Math.floor(osUptime());
    if (up > 0) return now - up;
  } catch { /* fall through */ }

  return 0;
}

const BOOT_EPOCH = bootEpochSeconds();

function isProcessAlive(pid: number): boolean {
  if (!Number.isFinite(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────
// Lock file layout + path
// ─────────────────────────────────────────────────────────────────────

const LOCK_FILENAME = '.drain.lock';
const STALE_AGE_MS = 60_000;

interface LockHolder {
  pid: number;
  epoch_boot: number;
  started_at: string; // ISO-8601
}

function lockPath(): string {
  return join(dosPath('MEMORY'), 'STATE', LOCK_FILENAME);
}

function holderSummary(h: LockHolder | null): string {
  if (!h) return 'unknown';
  return `pid=${h.pid} epoch=${h.epoch_boot} started=${h.started_at}`;
}

function readHolder(target: string): LockHolder | null {
  try {
    const raw = readFileSync(target, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<LockHolder>;
    if (
      typeof parsed.pid === 'number' &&
      typeof parsed.epoch_boot === 'number' &&
      typeof parsed.started_at === 'string'
    ) {
      return { pid: parsed.pid, epoch_boot: parsed.epoch_boot, started_at: parsed.started_at };
    }
    return null;
  } catch {
    return null;
  }
}

function lockAgeMs(target: string): number {
  try {
    return Date.now() - statSync(target).mtimeMs;
  } catch {
    return 0;
  }
}

/**
 * Stale rule: the holder is not alive, and the lock is older than the grace age.
 *
 * The boot epoch decides whether `holder.pid` is MEANINGFUL — it is not itself a
 * precondition for staleness. A pid only identifies a process within the boot that
 * produced it; after a reboot the same number may belong to something unrelated, so
 * `isProcessAlive()` cannot be trusted and we fall back to age alone.
 *
 * The previous rule required a boot MISMATCH to declare staleness. That made a
 * same-boot crash unrecoverable: a drainer SIGKILLed mid-drain (OOM, `pkill -9`,
 * sleep/wake reaping) never runs its `finally { releaseDrainLock() }`, and every
 * later drain then found a lock whose pid was confirmed dead and whose age was hours
 * — yet returned "not stale" because the boot epoch still matched. The DLQ silently
 * stopped draining until the machine rebooted. (Forge H-096.)
 *
 * Safety is preserved: a live same-boot holder is still never displaced. The only
 * newly-reclaimable cases are a dead same-boot holder past the grace age, and a
 * cross-boot holder whose pid was never trustworthy — and a cross-boot holder cannot
 * still be running, because the reboot killed it.
 */
function isStale(holder: LockHolder | null, target: string): boolean {
  if (!holder) {
    // Malformed/missing holder content — treat as stale only if the file is
    // also old enough. Otherwise a freshly-writing peer mid-flight would
    // get its lock stolen.
    return lockAgeMs(target) > STALE_AGE_MS;
  }
  const sameBoot = holder.epoch_boot === BOOT_EPOCH;
  if (sameBoot && isProcessAlive(holder.pid)) return false;
  return lockAgeMs(target) > STALE_AGE_MS;
}

/**
 * Claim the lock by writing our holder JSON to `target`.
 *
 * Two modes:
 *   - exclusive=true (the no-file fast path): open `target` with O_EXCL
 *     ('wx'), which atomically fails if the file already exists. This is
 *     the true mutual-exclusion primitive — two cold-start drainers racing
 *     here cannot BOTH win, because exactly one openSync('wx') succeeds and
 *     the other gets EEXIST → contended. No rename last-write-wins window.
 *   - exclusive=false (the stale-reclaim path): the file already exists, so
 *     O_EXCL would always fail. Fall back to tmp-write + atomic renameSync
 *     (last-write-wins) followed by a read-back confirm. The conservative
 *     3-check isStale() gate already serialises reclaimers in practice; the
 *     read-back catches a racing reclaimer that rolled over us.
 */
function tryClaim(target: string, exclusive: boolean): boolean {
  const holder: LockHolder = {
    pid: process.pid,
    epoch_boot: BOOT_EPOCH,
    started_at: new Date().toISOString(),
  };
  const dir = dirname(target);
  try {
    mkdirSync(dir, { recursive: true });
  } catch {
    return false;
  }

  if (exclusive) {
    // O_EXCL atomic create — exactly one racer wins; EEXIST means contended.
    let fd: number | undefined;
    try {
      fd = openSync(target, 'wx', 0o600);
      writeFileSync(fd, JSON.stringify(holder));
      fsyncSync(fd);
      closeSync(fd);
      return true;
    } catch {
      if (fd !== undefined) {
        try { closeSync(fd); } catch { /* best-effort */ }
      }
      return false;
    }
  }

  const tmp = `${target}.tmp.${process.pid}.${Math.random().toString(36).slice(2, 8)}`;
  let fd: number | undefined;
  try {
    fd = openSync(tmp, 'w', 0o600);
    writeFileSync(fd, JSON.stringify(holder));
    fsyncSync(fd);
    closeSync(fd);
    fd = undefined;
    renameSync(tmp, target);
  } catch {
    if (fd !== undefined) {
      try { closeSync(fd); } catch { /* best-effort */ }
    }
    try { unlinkSync(tmp); } catch { /* best-effort */ }
    return false;
  }
  // Read-back race-confirm — if another writer rolled over us we'll see
  // their pid here.
  const winner = readHolder(target);
  return winner !== null && winner.pid === process.pid && winner.epoch_boot === BOOT_EPOCH;
}

// ─────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────

export type AcquireResult =
  | { acquired: true }
  | { acquired: false; holder: string };

/**
 * Try to acquire the drain lock.
 *
 * Logic:
 *   1. If no lock file → claim.
 *   2. If lock exists → read holder.
 *      - If holder appears alive (any of the 3 checks fails) → back off.
 *      - If all 3 checks confirm staleness → take over (claim).
 *
 * Returns { acquired: false, holder } when contended; the caller should
 * exit cleanly (the existing holder is doing the work).
 */
export function acquireDrainLock(): AcquireResult {
  const target = lockPath();
  if (!existsSync(target)) {
    // No-file fast path → O_EXCL exclusive create. Two cold-start drainers
    // racing here cannot both win (EEXIST → race-lost for the loser).
    return tryClaim(target, true)
      ? { acquired: true }
      : { acquired: false, holder: 'race-lost' };
  }
  const holder = readHolder(target);
  if (!isStale(holder, target)) {
    return { acquired: false, holder: holderSummary(holder) };
  }
  // Stale — reclaim. The file already exists, so we cannot use O_EXCL here;
  // fall back to rename + read-back confirm. If a fresh holder grabbed
  // between our isStale() and our claim, the read-back catches it.
  return tryClaim(target, false)
    ? { acquired: true }
    : { acquired: false, holder: 'race-lost' };
}

/**
 * Release the lock. Only deletes the file if WE are the listed holder
 * (avoids stomping on a takeover by someone else in the same process
 * lifetime — pathological but cheap to defend).
 */
export function releaseDrainLock(): void {
  const target = lockPath();
  if (!existsSync(target)) return;
  const holder = readHolder(target);
  if (!holder) {
    // Malformed — best-effort delete.
    try { unlinkSync(target); } catch { /* best-effort */ }
    return;
  }
  if (holder.pid !== process.pid || holder.epoch_boot !== BOOT_EPOCH) {
    // Not ours; leave it alone.
    return;
  }
  try { unlinkSync(target); } catch { /* best-effort */ }
}

// ─────────────────────────────────────────────────────────────────────
// Test surface
// ─────────────────────────────────────────────────────────────────────

export const __dlqLockInternals = {
  lockPath,
  STALE_AGE_MS,
  BOOT_EPOCH,
  readHolder,
  isStale,
  tryClaim,
};
