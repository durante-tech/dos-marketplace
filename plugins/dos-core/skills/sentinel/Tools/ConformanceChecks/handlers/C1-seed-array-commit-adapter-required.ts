/**
 * C1 — seed-array-commit-adapter-required (RFC-0021 §10.1).
 *
 * Every `ProviderPricing.costFormula` row seeded in
 * `Platform/studio/packages/database/src/services/gateway-pricing.service.ts`
 * MUST declare `commitAdapter` ∈ {RECEIPT, REEVAL, DEFERRED-INLINE,
 * DEFERRED-RECONCILIATION, FIXED}. Phase 1.1 annotated all 49 seeded rows;
 * this gate prevents regression when new rows land without an adapter
 * classification.
 *
 * The handler parses every `costFormula: { ... }` object literal in the
 * target file via brace-balanced slicing (no AST dependency) and checks
 * each for a `commitAdapter:` field. Fires `fail` with file:line evidence
 * for any unannotated block. Absence of the target file → `not_applicable`
 * (lets the check survive repo reshuffles without a spurious failure).
 */

import { existsSync, readFileSync } from "fs";
import { relative, resolve } from "path";
import type { CheckContext, CheckResult } from "../types.ts";

const SEED_FILE_PATH =
  "Platform/studio/packages/database/src/services/gateway-pricing.service.ts";

const REQUIREMENT =
  "Every ProviderPricing.costFormula row declares commitAdapter ∈ {RECEIPT, REEVAL, DEFERRED-INLINE, DEFERRED-RECONCILIATION, FIXED}";

/**
 * Walk the file character-by-character. Each time we see the text
 * `costFormula:` followed by `{`, slice out the balanced object literal
 * and yield `{ start, end, body }` (line-numbered). Strings + comments are
 * handled just enough to not miscount braces inside them.
 */
interface FormulaBlock {
  startLine: number;
  endLine: number;
  body: string;
}

function extractCostFormulaBlocks(source: string): FormulaBlock[] {
  const blocks: FormulaBlock[] = [];
  const marker = "costFormula:";
  let i = 0;
  while (i < source.length) {
    const idx = source.indexOf(marker, i);
    if (idx === -1) break;
    // Skip past the marker and any whitespace/newlines to find `{`.
    let j = idx + marker.length;
    while (j < source.length && /\s/.test(source[j]!)) j++;
    if (source[j] !== "{") {
      // `costFormula:` without an open-brace literal — likely a type decl
      // (`costFormula: CostFormula`) or an unrelated occurrence. Skip.
      i = j;
      continue;
    }
    const openIdx = j;
    let depth = 0;
    let k = openIdx;
    let inString: false | '"' | "'" | "`" = false;
    let inLineComment = false;
    let inBlockComment = false;
    for (; k < source.length; k++) {
      const c = source[k]!;
      const prev = k > 0 ? source[k - 1]! : "";

      if (inLineComment) {
        if (c === "\n") inLineComment = false;
        continue;
      }
      if (inBlockComment) {
        if (prev === "*" && c === "/") inBlockComment = false;
        continue;
      }
      if (inString) {
        if (c === inString && prev !== "\\") inString = false;
        continue;
      }
      if (c === "/" && source[k + 1] === "/") {
        inLineComment = true;
        k++;
        continue;
      }
      if (c === "/" && source[k + 1] === "*") {
        inBlockComment = true;
        k++;
        continue;
      }
      if (c === '"' || c === "'" || c === "`") {
        inString = c;
        continue;
      }
      if (c === "{") depth++;
      else if (c === "}") {
        depth--;
        if (depth === 0) {
          const body = source.slice(openIdx, k + 1);
          const startLine = source.slice(0, openIdx).split("\n").length;
          const endLine = source.slice(0, k + 1).split("\n").length;
          blocks.push({ startLine, endLine, body });
          i = k + 1;
          break;
        }
      }
    }
    if (k >= source.length) break; // unbalanced — bail
  }
  return blocks;
}

/**
 * A block satisfies the check if it contains a `commitAdapter:` field OR
 * spreads a variable whose value obviously declares it (handled via string
 * match on `...` spread syntax — conservative: we only accept a literal
 * `commitAdapter:` text inside the block body). Spread-only blocks are
 * flagged to force explicit declaration per-row for clarity.
 */
function blockHasCommitAdapter(body: string): boolean {
  return /\bcommitAdapter\s*:/.test(body);
}

export async function c1SeedArrayCommitAdapterRequired(
  ctx: CheckContext,
): Promise<CheckResult> {
  const target = resolve(ctx.repoRoot, SEED_FILE_PATH);

  if (!existsSync(target)) {
    return {
      rId: "C1-RFC0021",
      requirement: REQUIREMENT,
      status: "not_applicable",
      evidence: [`seed file absent: ${SEED_FILE_PATH}`],
    };
  }

  const source = readFileSync(target, "utf-8");
  const blocks = extractCostFormulaBlocks(source);
  const rel = relative(ctx.repoRoot, target);

  if (blocks.length === 0) {
    return {
      rId: "C1-RFC0021",
      requirement: REQUIREMENT,
      status: "not_applicable",
      evidence: [`no costFormula object literals found in ${rel}`],
    };
  }

  const violations: string[] = [];
  for (const block of blocks) {
    if (!blockHasCommitAdapter(block.body)) {
      violations.push(
        `${rel}:${block.startLine}-${block.endLine}  costFormula block missing commitAdapter field`,
      );
    }
  }

  return {
    rId: "C1-RFC0021",
    requirement: REQUIREMENT,
    status: violations.length === 0 ? "pass" : "fail",
    evidence:
      violations.length === 0
        ? [`${blocks.length} costFormula block(s) all declare commitAdapter`]
        : violations,
  };
}
