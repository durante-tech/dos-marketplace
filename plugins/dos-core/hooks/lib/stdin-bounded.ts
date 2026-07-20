/**
 * stdin-bounded.ts — shared bounded-stdin reader for hooks (RFC-0156 P1).
 *
 * `await Bun.stdin.text()` alone waits for EOF forever, so a lingering-open
 * pipe would hang the whole hook turn. A bare Promise.race is NOT enough: the
 * abandoned text() read keeps the process alive until EOF anyway (verified —
 * Forge Gen 18/21). The timer therefore force-exits via the caller-supplied
 * onTimeout, and the finally guarantees the timer can never double-fire after
 * a read rejection (the uncancelled-timer defect the 2026-07-10 code review
 * confirmed in per-hook hand copies of this block).
 *
 * Returns the stdin text, or null when the read rejected (caller decides its
 * own fail-open output). On timeout, onTimeout runs and MUST exit the process.
 */

export async function readStdinBounded(
  timeoutMs: number,
  onTimeout: () => void,
): Promise<string | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    timer = setTimeout(onTimeout, timeoutMs);
    return await Bun.stdin.text();
  } catch {
    return null;
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
