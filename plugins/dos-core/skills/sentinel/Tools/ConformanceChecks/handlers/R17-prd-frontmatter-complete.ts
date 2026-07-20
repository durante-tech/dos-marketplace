/**
 * R17 (RFC-0059) — Every WORK PRD has all 8 required frontmatter fields.
 *
 * Scans MEMORY/WORK/{slug}/PRD.md files under ctx.repoRoot and verifies
 * that each PRD's YAML frontmatter block contains all 8 required fields:
 *   task, slug, effort, phase, progress, mode, started, updated
 *
 * Failure modes:
 *   - No MEMORY/WORK/ directory → not_applicable
 *   - No PRD.md files found → not_applicable
 *   - Any PRD.md is missing one or more required fields → fail
 *
 * Note on R-id namespace: RFC-0028 also registered an R17 (conventions-no-null-rule
 * with check key `presence.conventions-no-null-rule`). This handler uses the
 * distinct check key `presence.prd-frontmatter-complete` (RFC-0059 §13.1).
 * Both coexist in the registry keyed by check: string.
 *
 * Why R-class: PRD frontmatter completeness is a load-bearing structural
 * requirement of the Algorithm PRD-as-System-of-Record contract. Missing
 * fields silently break phase tracking, effort-tier gates, and Studio sync.
 */

import { existsSync, readFileSync } from "fs";
import { join } from "path";
import type { CheckContext, CheckResult } from "../types.ts";
import { REQUIRED_FIELDS_VNEXT, listPrdPaths } from "../lib/prd-doctrine.ts";

const REQUIREMENT =
  "Every WORK PRD must have all 8 required frontmatter fields: task, slug, effort, phase, progress, mode, started, updated. `progress` value must match /^\\d+\\/\\d+$/ (R-FW-4 extension, 2026-05-18)";

// REQUIRED_FIELDS is the shared prd-doctrine SoT — R17 (conformance) and PRDLint
// (advisory) check the identical field set so they cannot diverge again.
const REQUIRED_FIELDS = REQUIRED_FIELDS_VNEXT;

// R-FW-4 (2026-05-18) — `progress:` must be X/Y shape. R17 historically
// accepted `progress: foo` as pass because field was present + non-empty.
// The audit caught 5 corpus PRDs with absent `progress:` but R65 (numerator-
// denominator parity) silently no-ops on absent-field, so format drift could
// previously slip through. This regex pins the shape.
const PROGRESS_FORMAT_RE = /^\d+\/\d+$/;

interface FrontmatterResult {
  fields: Record<string, string>;
  missing: string[];
  formatErrors: string[];
}

/** Extract YAML frontmatter from a PRD file. Returns null if no frontmatter found. */
function parseFrontmatter(content: string): Record<string, string> | null {
  const lines = content.split("\n");
  if (lines[0]?.trim() !== "---") return null;

  const endIdx = lines.findIndex((l, i) => i > 0 && l.trim() === "---");
  if (endIdx === -1) return null;

  const result: Record<string, string> = {};
  for (let i = 1; i < endIdx; i++) {
    const m = lines[i].match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*(.*)$/);
    if (m) result[m[1]] = m[2].trim();
  }
  return result;
}

function checkPrdFrontmatter(prdPath: string): FrontmatterResult {
  const content = readFileSync(prdPath, "utf-8");
  const fields = parseFrontmatter(content) ?? {};
  const missing = REQUIRED_FIELDS.filter((f) => !(f in fields) || fields[f] === "");
  const formatErrors: string[] = [];
  if ("progress" in fields && fields["progress"] !== "" && !PROGRESS_FORMAT_RE.test(fields["progress"])) {
    formatErrors.push(`progress: value=${JSON.stringify(fields["progress"])} expected /^\\d+\\/\\d+$/`);
  }
  return { fields, missing, formatErrors };
}

export async function r17PrdFrontmatterComplete(ctx: CheckContext): Promise<CheckResult> {
  const workRoot = join(ctx.repoRoot, "MEMORY", "WORK");

  if (!existsSync(workRoot)) {
    return {
      rId: "R17-RFC0059",
      requirement: REQUIREMENT,
      status: "not_applicable",
      evidence: [`MEMORY/WORK/ not found under ${ctx.repoRoot}`],
    };
  }

  // R-FW-4 (2026-05-18): recurse MEMORY/WORK/active/ + archived/ (vNext-split
  // layout) plus the legacy flat layout, via the shared prd-doctrine SoT so the
  // recursion logic lives once (same enumerator R18/R44/PRDLint use).
  const prdPaths = listPrdPaths(workRoot);

  if (prdPaths.length === 0) {
    return {
      rId: "R17-RFC0059",
      requirement: REQUIREMENT,
      status: "not_applicable",
      evidence: [`No PRD.md files found under ${workRoot}`],
    };
  }

  const failEvidence: string[] = [];

  for (const prdPath of prdPaths) {
    let result: FrontmatterResult;
    try {
      result = checkPrdFrontmatter(prdPath);
    } catch (err) {
      failEvidence.push(
        `${prdPath}: could not read file — ${err instanceof Error ? err.message : String(err)}`,
      );
      continue;
    }

    if (result.missing.length > 0) {
      failEvidence.push(
        `${prdPath}: missing field(s): ${result.missing.join(", ")}`,
      );
    }
    if (result.formatErrors.length > 0) {
      failEvidence.push(
        `${prdPath}: ${result.formatErrors.join("; ")}`,
      );
    }
  }

  if (failEvidence.length > 0) {
    return {
      rId: "R17-RFC0059",
      requirement: REQUIREMENT,
      status: "fail",
      evidence: failEvidence,
    };
  }

  return {
    rId: "R17-RFC0059",
    requirement: REQUIREMENT,
    status: "pass",
    evidence: [
      `${prdPaths.length} PRD(s) checked — all carry all 8 required frontmatter fields`,
    ],
  };
}
