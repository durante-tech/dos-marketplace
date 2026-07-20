/**
 * R5 — MemPalaceWakeUp matches ^phase: and uses getWorkDir().
 *
 * Detects the exact bug §13.1 R5 was written to prevent: reading DOS
 * PRD.md v4 frontmatter with `/^status:/`, which never matches because
 * the v4 convention is `phase:`. Caught in the 2026-04-21 conformance
 * closure at MemPalaceWakeUp.hook.ts:108.
 *
 * The regex is legitimate against META.yaml (legacy) and other files
 * that genuinely use `status:`. To keep false-positives low, the handler
 * flags `/^status:/` ONLY when it is applied to a variable whose name
 * contains "prd" (case-insensitive) — the standard DOS naming for PRD
 * content: `prdHead`, `prdContent`, `prdBody`, etc. Variables named
 * `meta*`, `yaml*`, etc. are ignored.
 *
 * Exempt pragma: `// conformance:R5-exempt`.
 */

import {
  SyntaxKind,
  createCheckProject,
  hasExemptPragma,
  walkFiles,
  type Node,
} from "../lib/ast-utils.ts";
import type { CheckContext, CheckResult } from "../types.ts";

const BANNED_REGEX_LITERAL = /\/\^status:/;
const EXEMPT_PRAGMA = /conformance:R5-exempt/;
const PRD_VARIABLE_RE = /prd/i;

/**
 * Walk up from a regex literal to find its receiver in a `.match(regex)`
 * call. Returns the receiver's source text, or null if the literal is not
 * used as the argument to a `.match` call.
 */
function matchReceiver(literal: Node): string | null {
  const parent = literal.getParent();
  if (!parent || parent.getKind() !== SyntaxKind.CallExpression) return null;
  const callExpr = parent.asKindOrThrow(SyntaxKind.CallExpression);
  const calleeExpr = callExpr.getExpression();
  if (calleeExpr.getKind() !== SyntaxKind.PropertyAccessExpression) return null;
  const access = calleeExpr.asKindOrThrow(SyntaxKind.PropertyAccessExpression);
  if (access.getName() !== "match") return null;
  return access.getExpression().getText();
}

export async function r5PhaseRegex(ctx: CheckContext): Promise<CheckResult> {
  const files = walkFiles(ctx.hooksRoot, (name) => name.endsWith(".hook.ts"));
  const evidence: string[] = [];
  if (files.length === 0) {
    return {
      rId: "R5",
      requirement: "MemPalaceWakeUp matches ^phase: and uses getWorkDir()",
      status: "not_applicable",
      evidence: [`no *.hook.ts found under ${ctx.hooksRoot}`],
    };
  }

  const project = createCheckProject();
  project.addSourceFilesAtPaths(files);

  for (const sf of project.getSourceFiles()) {
    const fullText = sf.getFullText();
    if (!fullText.includes("^status:")) continue;

    const filePath = sf.getFilePath();
    const lines = fullText.split("\n");
    const regexLiterals = sf.getDescendantsOfKind(SyntaxKind.RegularExpressionLiteral);
    for (const lit of regexLiterals) {
      if (!BANNED_REGEX_LITERAL.test(lit.getText())) continue;
      const receiver = matchReceiver(lit);
      if (!receiver || !PRD_VARIABLE_RE.test(receiver)) continue;
      if (hasExemptPragma(lit, lines, EXEMPT_PRAGMA)) {
        evidence.push(`${filePath}:${lit.getStartLineNumber()}  ${lit.getText()}  — exempt pragma`);
        continue;
      }
      evidence.push(
        `${filePath}:${lit.getStartLineNumber()}  ${receiver}.match(${lit.getText()}) never matches — use /^phase:/ (DOS PRD convention)`,
      );
    }
  }

  return {
    rId: "R5",
    requirement: "MemPalaceWakeUp matches ^phase: and uses getWorkDir()",
    status: evidence.length === 0 ? "pass" : "fail",
    evidence: evidence.length === 0 ? [`${files.length} *.hook.ts clean`] : evidence,
  };
}
