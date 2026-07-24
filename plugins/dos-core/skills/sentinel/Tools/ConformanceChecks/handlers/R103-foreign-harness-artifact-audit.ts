/**
 * R103 — presence.foreign-harness-artifact-audit (Archer Run 5 gen-62;
 * fold finding `7c1ae69c`). Git-level guard: no foreign-harness RUNTIME
 * artifact is TRACKED in git, outside declared baseline/fixture allowlists.
 *
 * Background — the "cc-studio runtime-pollution vector." `.gitignore` ignores
 * `.claude/` (line 124) but re-includes the whole submodule tree with a
 * `!/Releases/<ver>/.claude` un-ignore (lines 168-169) so versioned release
 * snapshots, the live submodule, and the ConformanceChecks fixture subtrees
 * under Releases/.claude all ship. Under maintainer symlink mode
 * (`~/.claude` points at `Releases/<ver>/.claude`), the Claude Code harness
 * writes runtime artifacts — job dirs, worktrees, driver locks, session and
 * agent journals, shell-snapshots, tool-results, runlogs — INTO that
 * re-included tree, where git no longer ignores them. Empirical at rule birth
 * (`git check-ignore -v`): 4 of 4 probed harness paths under
 * `Releases/<ver>/.claude` returned NOT IGNORED. Field data:
 * `tailor/MUTATIONS/gen-011-probe/journal.jsonl` was already tracked.
 *
 * Why a Sentinel rule and not more gitignore: gitignore cannot express "no
 * harness runtime class, ANYWHERE, EXCEPT under declared baseline/fixture
 * roots" without breaking the load-bearing fixture-shipping re-include. A scan
 * over the TRACKED SET (`git ls-files`) can. Reads the git index / tracked set —
 * f(index), which equals f(HEAD) on a clean checkout; committed-class per the
 * R98 precedent (WARN-only, so the index-vs-HEAD nuance never gates).
 *
 * Precision — the allowlist spares deliberately-tracked matches:
 *   - `evals/baselines/` — agent-output baselines captured on purpose
 *     (e.g. `evals/baselines/fable/.../agent-<hex>.jsonl`).
 *   - any `__fixtures__/` dir — test fixtures (the .gitignore comment
 *     explicitly ships the `__fixtures__` Releases/.claude subtrees).
 * Skill `.md` content (a skill named "Scratchpad") never matches — the patterns
 * key on runtime-artifact shapes (locks, jobs, worktrees, journals, snapshots),
 * not markdown or source.
 *
 * Tier: WARN-only (always `pass`; tracked artifacts surface via evidence,
 * capped at 20 plus a remainder count — no silent caps). Classified `committed`
 * plus force-advisory in determinism.ts: the verdict is invariant `pass`, so
 * the always-on baseline sweep only snapshots it and it never gates (the
 * R82/R83/R84 force-advisory precedent). Remediation of a real hit is the
 * OWNING loop's call (K7 deconfliction): the guard surfaces, it does not delete.
 *
 * Failure modes:
 *   - `git ls-files` unavailable (not a git repo) -> not_applicable
 *   - 0 tracked artifacts -> pass ("0 ... across N tracked file(s)")
 */

import { spawnSync } from "child_process";
import type { CheckContext, CheckResult } from "../types.ts";

const REQUIREMENT =
  "No foreign-harness runtime artifact (job dir, worktree, driver lock, session/agent journal, shell-snapshot, tool-results, runlog) is tracked in git, outside declared baseline/fixture allowlists (git-level; f(HEAD), WARN-only)";

const EVIDENCE_CAP = 20;

// Harness runtime-artifact classes, keyed on POSIX repo-relative path shape.
// `.claude/`-anchored classes (job dirs, worktrees, shell-snapshots, session
// transcripts, tool-results, history) can't false-match a pack's own `jobs/`
// or `worktrees/` dir. The workflow-journal and runlog classes are DELIBERATELY
// unanchored: a committed workflow VCR journal or runlog is pollution wherever
// it lands (the flagship `tailor/MUTATIONS/.../journal.jsonl` hit lives outside
// `.claude/`); the `__fixtures__/` allowlist spares legit fixtures.
const HARNESS_PATTERNS: ReadonlyArray<{ label: string; re: RegExp }> = [
  { label: "driver-lock", re: /(^|\/)\.driver\.lock$/ },
  { label: "harness-job-dir", re: /(^|\/)\.claude\/jobs\/[^/]+\// },
  { label: "harness-worktree", re: /(^|\/)\.claude\/worktrees\/[^/]+\// },
  { label: "shell-snapshot", re: /(^|\/)\.claude\/shell-snapshots\// },
  // Session transcripts under `.claude/projects/` — any `.jsonl` there is a
  // harness transcript (UUID-named session logs AND agent-<hex> subagent logs;
  // the standalone agent-transcript class below also catches agent logs elsewhere).
  { label: "session-transcript", re: /(^|\/)\.claude\/projects\/.+\.jsonl$/ },
  { label: "harness-history", re: /(^|\/)\.claude\/history\.jsonl$/ },
  { label: "tool-results", re: /(^|\/)\.claude\/.*tool-results\// },
  { label: "workflow-journal", re: /(^|\/)journal\.jsonl$/ },
  // {12,} hex, not {6,}: real subagent transcripts are 16-17 hex; the wider
  // floor spared all-hex English words like `agent-facade.jsonl` (JUDGE gen-62).
  { label: "agent-transcript", re: /(^|\/)agent-[0-9a-f]{12,}\.jsonl$/ },
  { label: "runlog", re: /(^|\/)[^/]+\.runlog$/ },
];

// Declared allowlist — deliberately-tracked roots that legitimately hold files
// matching a harness shape. Seam: ctx.harnessAllowlist overrides.
const DEFAULT_ALLOWLIST: ReadonlyArray<RegExp> = [
  /(^|\/)evals\/baselines\//, // agent-output baselines captured on purpose
  /(^|\/)__fixtures__\//, // test fixtures (gitignore ships these)
];

/** The tracked-file list (`git ls-files`). Seam: ctx.trackedFilesFn. */
function trackedFiles(ctx: CheckContext): string[] | null {
  const fn = (ctx as { trackedFilesFn?: () => string[] | null }).trackedFilesFn;
  if (fn) return fn();
  const r = spawnSync("git", ["ls-files"], {
    cwd: ctx.repoRoot,
    encoding: "utf-8",
    maxBuffer: 128 * 1024 * 1024,
  });
  if (r.status !== 0 || typeof r.stdout !== "string") return null;
  return r.stdout.split("\n").filter(Boolean);
}

export async function r103ForeignHarnessArtifactAudit(
  ctx: CheckContext,
): Promise<CheckResult> {
  const tracked = trackedFiles(ctx);
  if (tracked === null) {
    return {
      rId: "R103",
      requirement: REQUIREMENT,
      status: "not_applicable",
      evidence: ["`git ls-files` unavailable (not a git repo?) — no tracked set to audit"],
    };
  }

  const allow =
    (ctx as { harnessAllowlist?: ReadonlyArray<RegExp> }).harnessAllowlist ??
    DEFAULT_ALLOWLIST;

  const hits: Array<{ path: string; label: string }> = [];
  for (const raw of tracked) {
    const p = raw.replace(/\\/g, "/");
    if (allow.some((a) => a.test(p))) continue;
    const match = HARNESS_PATTERNS.find((h) => h.re.test(p));
    if (match) hits.push({ path: p, label: match.label });
  }

  const evidence: string[] = [];
  for (const { path, label } of hits.slice(0, EVIDENCE_CAP)) {
    evidence.push(
      `${path}: tracked ${label} — foreign-harness runtime artifact (should not be committed; surfaced to owning loop)`,
    );
  }
  if (hits.length > EVIDENCE_CAP) {
    evidence.push(`…${hits.length - EVIDENCE_CAP} more tracked artifact(s) beyond evidence cap`);
  }
  if (hits.length === 0) {
    evidence.push(
      `0 tracked foreign-harness artifacts across ${tracked.length} tracked file(s)`,
    );
  }

  // Warn-only AUDIT tier: tracked artifacts are evidence, never a fail verdict.
  return {
    rId: "R103",
    requirement: REQUIREMENT,
    status: "pass",
    evidence,
  };
}
