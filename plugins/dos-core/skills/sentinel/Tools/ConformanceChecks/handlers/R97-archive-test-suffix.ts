/**
 * R97 — lint.archive-test-suffix (eighth-generation lint.* rule).
 *
 * The 2026-07-02 dead-code sweep (maturity roadmap P4.3, ISC-50) moved 19
 * completed one-shot scripts to Tools/archive/ and renamed each companion
 * test `<name>.test.ts.archived`. The rename is load-bearing, not cosmetic:
 * the canonical suite runs `bun test --timeout 60000 Tools Packs Packages`,
 * and `bun test`'s discovery walks those roots recursively for the
 * runner-discoverable test basenames (`{.|_}{test|spec}.{ts,tsx,js,jsx,...}`).
 * A retired test left as `*.test.ts` under an archive/ dir is therefore
 * RE-EXECUTED against dead code — reintroducing exactly the
 * failing/flaky/suite-truncating class the archive sweep removed (sibling
 * hazard to R94's process.exit truncator; the incident's own truncator was a
 * `.test.mjs`). The `.archived` suffix is the whole mechanism that keeps a
 * retired test out of discovery.
 *
 * Invariant: no runner-discoverable test file may live under an `archive/`
 * directory segment. Retired tests carry the `.archived` suffix (which no
 * longer matches a test basename, so discovery skips them). This rule names
 * any offender at its path. The discovery basename set is the SHARED
 * `TEST_FILE_RE` in lib/ast-utils.ts — the same one R94 uses, so the two
 * rules cannot drift on "what counts as a test file" (/code-review F1+F4).
 *
 * Scope: files under any `archive/` path segment (lowercase — MEMORY/ARCHIVE/
 * and other capitalized dirs are out of scope by construction), via walkFiles
 * (prunes dot-dirs + node_modules). fixtures/__fixtures__ excluded.
 *
 * The related `Tools/archive/README.md` convention (documents the retirement
 * process + restore path) is intentionally NOT enforced here — kept
 * single-concern per SandiMetz, mirroring R94's shape.
 *
 * Warn-only ship (mirrors R80/R91/R93/R94 advisory precedent): non-empty
 * corpus ALWAYS returns `status: "pass"` with violations in evidence only;
 * an empty corpus (no test files at all) returns `not_applicable`, matching
 * every sibling lint.* rule so a dropped-into-empty-repo run signals it
 * inspected nothing rather than a false green. Promote to fail-tier after
 * FP-rate soak. Decision logic lives in `__testing__.isArchivedTestViolation`.
 */

import { relative } from "path";
import { TEST_FILE_RE, isTestFile, walkFiles } from "../lib/ast-utils.ts";
import type { CheckContext, CheckResult } from "../types.ts";

const REQUIREMENT =
  "lint.archive-test-suffix: no runner-discoverable *.test file under an archive/ dir (retired tests carry .archived so bun test discovery skips them)";

const R_ID = "R97";

/** A lowercase `archive/` path segment. Capitalized ARCHIVE/ (MEMORY/) is out of scope. */
const ARCHIVE_SEG_RE = /(?:^|\/)archive\//;

/** Dirs excluded from violations (walkFiles already prunes dot-dirs + node_modules). */
const EXCLUDE_RE = /\/(?:node_modules|\.git|__fixtures__|fixtures)\//;

/**
 * Pure decision function on a repo-relative path. Fires when the path lives
 * under an `archive/` segment AND still matches a runner-discoverable test
 * basename (shared TEST_FILE_RE). `.archived`-suffixed files never match, so
 * they are clean by construction.
 */
export function isArchivedTestViolation(relPath: string): boolean {
  if (EXCLUDE_RE.test(`/${relPath}`)) return false;
  return ARCHIVE_SEG_RE.test(relPath) && TEST_FILE_RE.test(relPath);
}

/**
 * R97 handler. Repo-wide file walk; flags any runner-discoverable test file
 * physically under an `archive/` directory. `not_applicable` on an empty
 * corpus; otherwise always `status: "pass"` (warn-only AUDIT tier — the CI
 * file-count floor + green suite are the load-bearing gates), violations in
 * evidence.
 */
export async function r97ArchiveTestSuffix(ctx: CheckContext): Promise<CheckResult> {
  const files = walkFiles(ctx.repoRoot, isTestFile);

  if (files.length === 0) {
    return {
      rId: R_ID,
      requirement: REQUIREMENT,
      status: "not_applicable",
      evidence: [`no runner-discoverable test files under ${ctx.repoRoot}`],
    };
  }

  const violations: string[] = [];
  for (const file of files) {
    const rel = relative(ctx.repoRoot, file);
    if (isArchivedTestViolation(rel)) {
      violations.push(
        `${rel} — runner-discoverable test under an archive/ dir; ` +
          `bun test will execute this retired test. Rename to "${rel}.archived" (the archive-sweep convention).`,
      );
    }
  }

  const summary =
    violations.length === 0
      ? `lint.archive-test-suffix: ${files.length} test file(s) scanned, 0 under an archive/ dir (clean)`
      : `lint.archive-test-suffix (WARN-ONLY): ${violations.length} runner-discoverable test(s) under archive/ — dead-test re-execution hazard`;

  return {
    rId: R_ID,
    requirement: REQUIREMENT,
    status: "pass",
    evidence: [
      summary,
      ...violations.slice(0, 25),
      ...(violations.length > 25 ? [`(... +${violations.length - 25} more)`] : []),
    ],
  };
}

export const __testing__ = { isArchivedTestViolation };
