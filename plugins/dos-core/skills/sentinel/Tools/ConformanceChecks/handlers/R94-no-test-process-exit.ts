/**
 * R94 — lint.no-test-process-exit (fifth-generation lint.* rule).
 *
 * The 2026-07-02 honest-gate incident: a spike test file called
 * process.exit(0) on its own success, killing the ENTIRE `bun test` run
 * mid-suite with a green exit code — ~25 real failures were masked locally
 * AND in CI (release-readiness ran bare `bun test`) for a month. A test file
 * that exits the process truncates every test scheduled after it; when it
 * exits 0 the truncation is invisible. The CI file-count floor
 * (release-readiness "Root tests" step) is the hard backstop; this rule is
 * the AUDIT-tier companion that names offenders at the source line.
 *
 * Violation idiom (single logical line): a `process.exit(...)` call in any
 * test-runner-discoverable file — *.test.{ts,tsx,js,jsx,mjs,cjs}, *.spec.ts,
 * *_test.ts. `process.exitCode = ...` is the sanctioned alternative (sets
 * the code, lets the runner live; streams flush on natural exit).
 *
 * Scope: test files under the repo via walkFiles (prunes dot-dirs +
 * node_modules by construction). fixtures/__fixtures__ dirs are EXCLUDED —
 * fixture sources legitimately carry the idiom as data. Full-line comments
 * are inert; a trailing same-line comment still fires (documented v1
 * limitation — neutralize with the opt-out).
 *
 * Opt-out: a `lint.no-test-process-exit: ok <reason>` comment on the hit
 * line or the line above neutralizes it.
 *
 * Warn-only ship (mirrors R80/R91/R93 advisory precedent): ALWAYS returns
 * `status: "pass"`; violations surface via evidence only (`file:line`).
 * Promote to fail-tier after FP-rate soak (R75 DOS_R75_MODE precedent).
 * Decision logic lives in `__testing__.evaluateSource`.
 */

import { readFileSync } from "fs";
import { relative } from "path";
import { TEST_FILE_RE, walkFiles } from "../lib/ast-utils.ts";
import type { CheckContext, CheckResult } from "../types.ts";

const REQUIREMENT =
  "lint.no-test-process-exit: test files never call process.exit (it truncates the suite; use process.exitCode)";

const R_ID = "R94";

/** Opt-out comment — neutralizes a hit on this logical line or the physical line above. */
const ALLOW_RE = /lint\.no-test-process-exit:\s*ok/i;

// lint.no-test-process-exit: ok — the rule's own detection regex, not a call
const PROCESS_EXIT_RE = /\bprocess\.exit\s*\(/;

// Test-file basenames `bun test` discovers — the SHARED TEST_FILE_RE from
// ast-utils (hoisted 2026-07-03, ISC-51 /code-review F4) so R94 and R97 cannot
// drift on "what counts as a test file". Widened here vs the prior R94-local
// regex (now covers _test/.spec/_spec × all extensions); warn-only + evidence-
// only, so the wider scan changes evidence content only, never a verdict.

/** Dirs excluded from violations (walkFiles already prunes dot-dirs + node_modules). */
const EXCLUDE_RE = /\/(?:node_modules|\.git|__fixtures__|fixtures)\//;

export interface NoTestProcessExitVerdict {
  fires: boolean;
  hits: string[];
}

/** Full-line comment / doc-continuation — inert. */
function isCommentLine(text: string): boolean {
  const t = text.trimStart();
  return t.startsWith("#") || t.startsWith("//") || t.startsWith("*");
}

/**
 * Pure decision function. `filePath` drives the `file:line` evidence prefix
 * only — callers pre-filter to test-file basenames.
 */
export function evaluateSource(src: string, filePath: string): NoTestProcessExitVerdict {
  const hits: string[] = [];
  const lines = src.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const text = lines[i];
    const prev = lines[i - 1] ?? "";
    if (ALLOW_RE.test(text) || ALLOW_RE.test(prev)) continue;
    if (isCommentLine(text)) continue;
    if (PROCESS_EXIT_RE.test(text)) {
      hits.push(
        `${filePath}:${i + 1} — process.exit() in a test file truncates the suite at this point; ` +
          `set process.exitCode instead (streams flush, runner survives) or add "lint.no-test-process-exit: ok <reason>".`,
      );
    }
  }
  return { fires: hits.length > 0, hits };
}

/**
 * R94 handler. Test-file basenames via walkFiles, minus fixture dirs.
 * Always `status: "pass"` (warn-only AUDIT tier — the CI file-count floor is
 * the load-bearing gate); violations in evidence.
 */
export async function r94NoTestProcessExit(ctx: CheckContext): Promise<CheckResult> {
  const files = walkFiles(ctx.repoRoot, (name) => TEST_FILE_RE.test(name)).filter(
    (f) => !EXCLUDE_RE.test(f),
  );

  if (files.length === 0) {
    return {
      rId: R_ID,
      requirement: REQUIREMENT,
      status: "not_applicable",
      evidence: [`no test files under ${ctx.repoRoot}`],
    };
  }

  const violations: string[] = [];
  for (const file of files) {
    let src: string;
    try {
      src = readFileSync(file, "utf-8");
    } catch {
      continue;
    }
    const v = evaluateSource(src, relative(ctx.repoRoot, file));
    if (v.fires) violations.push(...v.hits);
  }

  const summary =
    violations.length === 0
      ? `lint.no-test-process-exit: ${files.length} test file(s) scanned, 0 process.exit calls (clean)`
      : `lint.no-test-process-exit (WARN-ONLY): ${violations.length} process.exit call(s) across ${files.length} test file(s) — suite-truncation hazard`;

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

export const __testing__ = { evaluateSource };
