/**
 * dlq-dedup — shared ack-ledger dedup + backpressure for the Save*ToStudio
 * `--import-all` producers.
 *
 * PROVENANCE: incident 2026-06-22. The `--import-all` producers re-read and
 * re-enqueue their ENTIRE corpus on every SessionEnd. Without dedup, rows that
 * already synced pile into MEMORY/<subdir>/.pending faster than the 500/run
 * drain removes them (ARTIFACTS grew to 4.4M files, CPU pinned, palace froze).
 * The cure is to skip any row whose idempotencyKey is already in the ack ledger
 * — a 2xx/409 from Studio, recorded VERBATIM by dlq-drain `bufferAck`. This
 * module was extracted verbatim from SaveArtifactsToStudio.ts (the first
 * producer to get the fix, incident commit 198013ef) so all ~20 queue-mode
 * producers share ONE implementation rather than copy-paste it (DRY follow-up).
 *
 * ── THE FIREWALL (silent-data-loss trap) ────────────────────────────────────
 * loadAckedKeys(prefix) only dedups rows whose enqueue idempotencyKey starts
 * with `prefix`. Each caller MUST:
 *   1. pass the SAME prefix its keys are built with, and
 *   2. compute the per-row dedup-check key byte-identically to the key it
 *      passes to queueOrPost.
 * If (1) drifts → dedup silently matches nothing (no-op, the flood returns).
 * If (2) drifts → dedup skips a row that was never acked (silent data loss).
 * The key prefix is NOT the SYNC_TOOLS dlqTool name: `reflections` keys on
 * `reflection:`, `voice-events` on `voice:`. Derive the prefix from the actual
 * key literal, never from the registry. Each producer pins this with a test
 * asserting its enqueue key `.startsWith(KEY_PREFIX)`.
 */

import { readFileSync, readdirSync, existsSync, opendirSync, realpathSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

// Bound the in-memory ack set so loading it can't itself blow memory; the
// newest acks (loaded first) dominate the re-import flood.
export const ACK_KEY_BUDGET = 500_000;

// Hard backpressure cap, independent of dedup: if a producer's .pending is
// already pathologically deep, refuse to enqueue this run. Prevents any future
// flood the dedup misses from re-growing the queue. The drain reduces depth;
// once below the cap, normal import resumes.
export const PENDING_CAP = 100_000;

/** Resolve MEMORY/<subdir>/.pending under the live DOS dir. */
export function pendingDirFor(subdir: string): string {
  const dosDir = process.env.DOS_DIR || join(homedir(), '.claude');
  return join(dosDir, 'MEMORY', subdir, '.pending');
}

/**
 * Resolve EVERY MEMORY/<subdir>/.pending dir a queue-mode producer's
 * `queueOrPost` enqueue may target — G7 incident (2026-07-06).
 *
 * `queueOrPost` resolves the queue project-FIRST (CLAUDE_PROJECT_DIR →
 * process.cwd() → DOS_DIR global, mirroring hooks/lib/paths.ts
 * getMemorySubdir), so a backpressure check that watches only the install
 * tree (`pendingDirFor`) is structurally blind to a project-tree flood —
 * exactly how ~/Durante/MEMORY/ARTIFACTS/.pending grew past 19k envelopes
 * while the cap watched ~/.claude. Callers should gate through
 * `pendingDepthAcrossExceeds(pendingDirsFor(subdir), PENDING_CAP)`.
 * Non-existent dirs are fine to return: they count 0.
 *
 * Candidates are canonicalized with realpathSync so symlinked trees don't
 * double-count (~/.claude is a symlink into Releases/vX.Y.Z/.claude under
 * maintainer mode); a path that doesn't resolve keeps its raw form.
 *
 * RESIDUAL (drift risk, noted 2026-07-06): this hand-mirrors the deployed
 * getMemorySubdir resolution in cc-durante-studio hooks/lib/paths.ts — two
 * un-linked implementations. Belongs to the shared-substrate extraction.
 */
export function pendingDirsFor(subdir: string): string[] {
  const home = homedir();
  const expand = (p: string): string =>
    p
      .replace(/^\$HOME(?=\/|$)/, home)
      .replace(/^\$\{HOME\}(?=\/|$)/, home)
      .replace(/^~(?=\/|$)/, home);

  const dirs: string[] = [];
  const seen = new Set<string>();
  const push = (base: string | undefined | null): void => {
    if (!base) return;
    let d = join(expand(base), 'MEMORY', subdir, '.pending');
    try { d = realpathSync(d); } catch { /* missing path — keep raw; counts 0 */ }
    if (!seen.has(d)) {
      seen.add(d);
      dirs.push(d);
    }
  };

  push(process.env.CLAUDE_PROJECT_DIR);
  try { push(process.cwd()); } catch { /* cwd may be gone */ }
  push(process.env.DOS_DIR || join(home, '.claude'));
  return dirs;
}

/**
 * Load the set of idempotencyKeys already acked by Studio (2xx/409), filtered
 * to those starting with `prefix`. Reads the day-stamped ack ledgers newest
 * first and stops at ACK_KEY_BUDGET. A key in the returned set means that exact
 * row already synced; un-acked rows are absent and still enqueue — so nothing
 * un-synced is ever dropped. Worst case is re-enqueuing a row whose ack aged out
 * of the retained ledger window (redundant — Studio 409-dedups it).
 */
export function loadAckedKeys(prefix: string): Set<string> {
  const dosDir = process.env.DOS_DIR || join(homedir(), '.claude');
  const stateDir = join(dosDir, 'MEMORY', 'STATE');
  const keys = new Set<string>();
  let ackFiles: string[];
  try {
    ackFiles = readdirSync(stateDir)
      .filter((f) => /^ack-\d{8}\.jsonl$/.test(f))
      .sort()
      .reverse(); // newest first — fill the budget with the most-recent acks
  } catch {
    return keys;
  }
  for (const f of ackFiles) {
    if (keys.size >= ACK_KEY_BUDGET) break;
    let content: string;
    try {
      content = readFileSync(join(stateDir, f), 'utf-8');
    } catch {
      continue;
    }
    for (const line of content.split('\n')) {
      if (!line.trim()) continue;
      try {
        const k = (JSON.parse(line) as { idempotencyKey?: unknown }).idempotencyKey;
        if (typeof k === 'string' && k.startsWith(prefix)) keys.add(k);
      } catch {
        /* skip malformed ack row */
      }
      if (keys.size >= ACK_KEY_BUDGET) break;
    }
  }
  return keys;
}

/**
 * Count entries in `pendingDir`, streaming one at a time with an early break
 * at `limit` so the walk is bounded even on a multi-million-entry directory.
 * Unreadable/missing → 0 (never block a producer on a counting error).
 */
function countPendingUpTo(pendingDir: string, limit: number): number {
  if (!existsSync(pendingDir)) return 0;
  let dir: ReturnType<typeof opendirSync> | undefined;
  let n = 0;
  try {
    dir = opendirSync(pendingDir);
    while (n < limit && dir.readSync() !== null) n++;
  } catch {
    return 0; // unreadable → don't block on a counting error
  } finally {
    try { dir?.closeSync(); } catch { /* best-effort */ }
  }
  return n;
}

/**
 * True if `pendingDir` holds more than `cap` entries. Streams entries one at a
 * time so the early break is bounded even on a multi-million-entry directory.
 * Unreadable/missing → false (never block a producer on a counting error).
 */
export function pendingDepthExceeds(pendingDir: string, cap: number): boolean {
  return countPendingUpTo(pendingDir, cap + 1) > cap;
}

/**
 * Multi-tree backpressure verdict — G7 review follow-up (2026-07-06).
 *
 * Trips when EITHER:
 *   (a) any single dir exceeds `cap` (the original per-dir semantics), OR
 *   (b) the SUM of depths across `dirs` exceeds `cap` — a flood split across
 *       trees with each share just under cap must not escape the gate.
 *
 * Returns a human-readable reason string when tripped, null when clear.
 * Each dir's count is bounded at cap+1 entries, so the walk stays cheap.
 * Cross-tree head-of-line blocking (one tree's backlog pausing enqueues for
 * all trees) is an ACCEPTED tradeoff: over-watching is the safe direction
 * after the under-watch incident.
 */
export function pendingDepthAcrossExceeds(dirs: string[], cap: number): string | null {
  let sum = 0;
  for (const d of dirs) {
    const n = countPendingUpTo(d, cap + 1);
    if (n > cap) return `${d} exceeds ${cap} entries`;
    sum += n;
    if (sum > cap) {
      return `combined .pending depth across ${dirs.length} queue dirs exceeds ${cap} entries`;
    }
  }
  return null;
}
