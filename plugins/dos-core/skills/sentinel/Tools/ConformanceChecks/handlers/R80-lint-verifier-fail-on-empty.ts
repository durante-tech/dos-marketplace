/**
 * R80 — lint.verifier-fail-on-empty (RFC-0129 clause #9 keystone, Wave-3).
 *
 * The corpus's FIRST `lint.*` static-source-scan rule. Every existing rule is
 * `presence.*` / `ast.*` / `regex.*`; this introduces the `lint.*` namespace
 * for "scan workflow source for a dangerous CODE SHAPE." It is the council's
 * proof-of-concept (wave2-4-ratification-and-spikes.md, per-clause #9) that a
 * Sentinel rule can assert a behavioral property of source, not PRD prose.
 *
 * What it flags
 * -------------
 * A fan-out verifier whose result set can collapse to `[]` and still flow
 * downstream as "all clean" — the FALSE GREEN. Concretely, inside a region
 * that fans out verification (`parallel(... .map(...))` paired with a
 * `verify`/`agent('verify'`/`phase: 'verify'` marker), it flags an empty-collapse
 * signal:
 *
 *   - `.catch(() => [])`              (the version-council-review.js shape)
 *   - `if (!x.length) return []`      (short-circuit to empty)
 *
 * UNLESS the source routes the fan-out through the shared `fanoutVerifiers`
 * helper (whose fail-on-empty contract throws on an all-empty set), or the
 * catch falls back to a NON-empty array.
 *
 * Warn-only ship (mirrors R72 advisory + manifest-completeness-gate)
 * -----------------------------------------------------------------
 * The handler ALWAYS returns `status: "pass"`. The violation is surfaced via
 * evidence count only — it never blocks a scan and changes no existing
 * verdict. baseline.json is intentionally NOT touched: a check whose verdict
 * is absent from the verdict_matrix is additive. Promote to fail-tier in a
 * later sprint after FP-rate measurement (R75 precedent: DOS_R75_MODE=strict).
 *
 * The decision logic lives in the exported `__testing__.evaluateWorkflowSource`
 * so the meta-test can exercise the REAL decision function (never a proxy) —
 * the council's central requirement for clause #9.
 */

import { readFileSync } from "fs";
import { relative } from "path";
import { walkFiles } from "../lib/ast-utils.ts";
import type { CheckContext, CheckResult } from "../types.ts";

const REQUIREMENT =
  "lint.verifier-fail-on-empty: workflow fan-out verifiers must not be able to pass on zero output (route through fanoutVerifiers or assert non-empty)";

const R_ID = "R80";

/** Markers that a region is doing VERIFICATION fan-out (not just any map). */
const VERIFY_MARKER_RE =
  /\b(verify|verifier|verdict|refut)\w*|agent\(\s*['"`]verify|phase:\s*['"`]verify['"`]|label:\s*['"`]verify/i;

/** Fan-out marker: a parallel/map construct that distributes work. */
const FANOUT_MARKER_RE = /\bparallel\s*\(|\.map\s*\(\s*\w+\s*=>/;

/** Empty-collapse signals — the false-green shapes. */
const CATCH_EMPTY_RE = /\.catch\s*\(\s*\(?\s*[\w$]*\s*\)?\s*=>\s*\[\s*\]\s*\)/;
const SHORTCIRCUIT_EMPTY_RE = /if\s*\(\s*!\s*[\w$.]+(?:\.length)?\s*\)\s*return\s*\[\s*\]/;

/** Opt-out / safety signals that neutralize a hit. */
const SAFE_HELPER_RE = /\bfanoutVerifiers\b/;

interface WorkflowVerdict {
  /** True when at least one false-green verifier shape was detected. */
  fires: boolean;
  /** Per-hit evidence lines (relative-loc + message). */
  hits: string[];
}

/**
 * Pure decision function — scan a single workflow's source text. The window
 * approach: a violation requires a VERIFY marker, a FAN-OUT marker, and an
 * empty-collapse signal to co-occur within a small line window, and NOT be
 * neutralized by the fanoutVerifiers helper. Exercised directly by the test.
 */
function evaluateWorkflowSource(loc: string, src: string): WorkflowVerdict {
  // The shared helper makes fail-on-empty structural — its presence neutralizes
  // the file (the helper THROWS on all-empty, so no false green is possible).
  if (SAFE_HELPER_RE.test(src)) {
    return { fires: false, hits: [] };
  }

  const lines = src.split("\n");
  const WINDOW = 6; // lines of context that constitute one fan-out region
  const hits: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isEmptyCatch = CATCH_EMPTY_RE.test(line);
    const isShortCircuit = SHORTCIRCUIT_EMPTY_RE.test(line);
    if (!isEmptyCatch && !isShortCircuit) continue;

    // Gather the window around this empty-collapse line.
    const from = Math.max(0, i - WINDOW);
    const to = Math.min(lines.length, i + WINDOW + 1);
    const region = lines.slice(from, to).join("\n");

    const hasVerify = VERIFY_MARKER_RE.test(region);
    const hasFanout = FANOUT_MARKER_RE.test(region);
    if (!hasVerify || !hasFanout) continue;

    const shape = isEmptyCatch ? ".catch(() => [])" : "if (!x.length) return []";
    hits.push(
      `${loc}:${i + 1}  verifier fan-out can collapse to [] (${shape}) — ` +
        `false green; route through fanoutVerifiers or assert non-empty (RFC-0129 #9).`,
    );
  }

  return { fires: hits.length > 0, hits };
}

/**
 * R80 handler. Scans every `*.js` whose path contains `/workflows/` under
 * repoRoot (top-level or nested) for the false-green verifier shape. Always
 * returns `status: "pass"` (warn-only); violations surface in evidence.
 */
export async function r80LintVerifierFailOnEmpty(
  ctx: CheckContext,
): Promise<CheckResult> {
  const jsFiles = walkFiles(ctx.repoRoot, (name) => name.endsWith(".js"));
  const workflowFiles = jsFiles.filter((f) => f.includes("/workflows/"));

  if (workflowFiles.length === 0) {
    return {
      rId: R_ID,
      requirement: REQUIREMENT,
      status: "not_applicable",
      evidence: [`no workflows/*.js found under ${ctx.repoRoot}`],
    };
  }

  const violations: string[] = [];
  for (const file of workflowFiles) {
    let src: string;
    try {
      src = readFileSync(file, "utf-8");
    } catch {
      continue;
    }
    const loc = relative(ctx.repoRoot, file);
    const verdict = evaluateWorkflowSource(loc, src);
    if (verdict.fires) violations.push(...verdict.hits);
  }

  // WARN-ONLY: always pass. Evidence count is the signal (R72 advisory pattern).
  const summary =
    violations.length === 0
      ? `lint.verifier-fail-on-empty: ${workflowFiles.length} workflow(s) scanned, 0 violations (clean)`
      : `lint.verifier-fail-on-empty (WARN-ONLY): ${violations.length} false-green verifier shape(s) across ${workflowFiles.length} workflow(s)`;

  return {
    rId: R_ID,
    requirement: REQUIREMENT,
    status: "pass",
    evidence: [summary, ...violations.slice(0, 25), ...(violations.length > 25 ? [`(... +${violations.length - 25} more)`] : [])],
  };
}

export const __testing__ = { evaluateWorkflowSource };
