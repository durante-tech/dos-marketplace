/**
 * R17 — Sentinel conventions.json: every convention must have a non-null `rule` field.
 *
 * ConventionCache.ts emits .sentinel/conventions.json. Prior to the D1.2 fix
 * (post-tragedy delivery), the `rule` field was absent on most conventions —
 * only a handful with REGEX_TEMPLATES matches had regex/negative_regex populated.
 * The remaining 17 of 21 conventions had no machine-readable enforcement rule,
 * which made them invisible to the SentinelGuard and unverifiable by tooling.
 *
 * After D1.2, every ConventionRule carries a `rule: string` field that is:
 *   - `negative_regex:/<pattern>/`  when negative_regex is set
 *   - `regex:/<pattern>/`           when only regex is set
 *   - the first 120 chars of the natural-language pattern as a human-readable
 *     fallback (still non-null — identifies the convention for logging)
 *
 * This check reads .sentinel/conventions.json and fails if any convention
 * has `rule == null` or `rule` absent. An empty conventions array returns
 * `not_applicable` (Sentinel not initialised for this repo).
 *
 * Why R-class (not C-class): this is a structural requirement of the Sentinel
 * reporting pipeline, not a stylistic code convention. A null `rule` field
 * means the convention is invisible to enforcement tooling — the failure mode
 * is silent non-enforcement, not a style violation.
 */

import { existsSync, readFileSync } from "fs";
import { join } from "path";
import type { CheckContext, CheckResult } from "../types.ts";

interface ConventionEntry {
  id: string;
  category?: string;
  rule?: string | null;
}

interface ConventionsFile {
  conventions?: ConventionEntry[];
}

const REQUIREMENT =
  "Every convention in .sentinel/conventions.json must carry a non-null `rule` field";

export async function r17ConventionsNoNullRule(ctx: CheckContext): Promise<CheckResult> {
  const conventionsPath =
    ctx.conventionsPath ?? join(ctx.repoRoot, ".sentinel", "conventions.json");

  if (!existsSync(conventionsPath)) {
    return {
      rId: "R17",
      requirement: REQUIREMENT,
      status: "not_applicable",
      evidence: [
        `${conventionsPath} not found — Sentinel not initialised for this repo`,
      ],
    };
  }

  let parsed: ConventionsFile;
  try {
    parsed = JSON.parse(readFileSync(conventionsPath, "utf-8")) as ConventionsFile;
  } catch (err) {
    return {
      rId: "R17",
      requirement: REQUIREMENT,
      status: "fail",
      evidence: [
        `${conventionsPath} is not valid JSON: ${err instanceof Error ? err.message : String(err)}`,
      ],
    };
  }

  const conventions = parsed.conventions ?? [];

  if (conventions.length === 0) {
    return {
      rId: "R17",
      requirement: REQUIREMENT,
      status: "not_applicable",
      evidence: ["conventions array is empty — nothing to check"],
    };
  }

  const nullRuleEntries = conventions.filter(
    (c) => c.rule === null || c.rule === undefined,
  );

  if (nullRuleEntries.length === 0) {
    return {
      rId: "R17",
      requirement: REQUIREMENT,
      status: "pass",
      evidence: [
        `${conventions.length} convention(s) checked — all carry a non-null rule field`,
      ],
    };
  }

  return {
    rId: "R17",
    requirement: REQUIREMENT,
    status: "fail",
    evidence: nullRuleEntries.map(
      (c) =>
        `${c.id ?? "(no id)"}: rule is ${c.rule === null ? "null" : "absent"} (category: ${c.category ?? "unknown"})`,
    ),
  };
}
