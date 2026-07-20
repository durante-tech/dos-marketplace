#!/usr/bin/env bun
// PrLoopSideBranch.ts — deterministic side-branch NAME derivation for the PR
// review-execute loop (B6 scaffold extraction).
//
// Relocates the branch-name half of the Side-Branch Convention out of
// Workflows/_pr-loop-shared.md (shared with FastAPIStarterTeam's identical
// convention). The git ORCHESTRATION (checkout, rebase, push) stays narrated in
// prose because it is network/working-tree I/O; this file owns ONLY the pure,
// duplication-prone derivation that the prose otherwise hand-types:
//
//   - Base branch name:           fix/pr-{N}-todos
//   - Already-merged retry name:  fix/pr-{N}-todos-r{n}   (n incrementing from 2)
//
// Per _pr-loop-shared.md "Already-merged retry": if the side branch was merged
// into the PR head between loops, create fix/pr-{N}-todos-r{n} (incrementing {n})
// rather than corrupting merged history. The first retry is -r2 (the base name is
// the implicit "-r1"); each subsequent retry increments.

// The base side-branch name for a PR. Reused across loop iterations.
export function sideBranchName(prNumber: number): string {
  return `fix/pr-${prNumber}-todos`;
}

// The retry side-branch name. `retry` is the retry ordinal: 2 -> first -r variant
// (-r2), since the un-suffixed base name is the implicit r1. retry < 2 returns the
// base name (no suffix) so callers can pass the loop counter directly.
export function retrySideBranchName(prNumber: number, retry: number): string {
  if (retry < 2) return sideBranchName(prNumber);
  return `${sideBranchName(prNumber)}-r${retry}`;
}

// Given the base name and the set of branch names that already exist (locally or
// on origin), pick the next non-colliding side-branch name. Returns the base name
// when it is free; otherwise the lowest free -r{n} (n>=2). Mirrors the prose
// "incrementing {n}" rule deterministically.
export function nextAvailableSideBranch(
  prNumber: number,
  existing: ReadonlySet<string> | readonly string[],
): string {
  const taken = existing instanceof Set ? existing : new Set(existing);
  const base = sideBranchName(prNumber);
  if (!taken.has(base)) return base;
  let n = 2;
  // Bound the loop defensively; PRs never accumulate thousands of retry branches.
  while (n < 10000) {
    const candidate = retrySideBranchName(prNumber, n);
    if (!taken.has(candidate)) return candidate;
    n++;
  }
  // Unreachable in practice; satisfies the type checker.
  return retrySideBranchName(prNumber, n);
}

// CLI entry: derive the side-branch name.
//   echo '{"prNumber":42}'                                  | bun PrLoopSideBranch.ts name
//   echo '{"prNumber":42,"retry":3}'                        | bun PrLoopSideBranch.ts retry
//   echo '{"prNumber":42,"existing":["fix/pr-42-todos"]}'   | bun PrLoopSideBranch.ts next
if (import.meta.main) {
  const { readStdin } = await import('./_shared');
  const sub = process.argv[2] ?? 'name';
  const input = JSON.parse(await readStdin());
  if (sub === 'name') {
    process.stdout.write(sideBranchName(input.prNumber) + '\n');
  } else if (sub === 'retry') {
    process.stdout.write(retrySideBranchName(input.prNumber, input.retry) + '\n');
  } else if (sub === 'next') {
    process.stdout.write(nextAvailableSideBranch(input.prNumber, input.existing ?? []) + '\n');
  } else {
    process.stderr.write('usage: PrLoopSideBranch.ts <name|retry|next>  (JSON on stdin)\n');
    process.exit(2);
  }
}
