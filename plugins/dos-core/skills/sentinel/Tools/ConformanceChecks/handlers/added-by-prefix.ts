/**
 * added_by-prefix — RFC-0005 §14.13 convention.
 *
 * Drawers MUST carry provenance in their `added_by` field using one of
 * three prefixes:
 *
 *   mechanical:<tool-name>   — deterministic hook or script
 *   human:<who>              — direct user action
 *   llm_judge:<model>        — LLM-classified content
 *
 * Handler scans *.hook.ts files for both direct invocations
 *   add_drawer({ added_by: "..." })
 * and queued operations (common in batch paths)
 *   queueOp(ops, "add_drawer", { added_by: "..." })
 *
 * A call is flagged when:
 *   1. The `add_drawer` argument object is missing the `added_by` property
 *      (→ unknown provenance)
 *   2. `added_by` is a non-string value (e.g. variable without resolvable
 *      literal) — flagged as "cannot statically verify"
 *   3. `added_by` is a string literal that does NOT start with one of the
 *      three accepted prefixes
 *
 * Exempt pragma: `// conformance:added-by-exempt`
 */

import {
  SyntaxKind,
  createCheckProject,
  hasExemptPragma,
  walkFiles,
  type CallExpression,
} from "../lib/ast-utils.ts";
import type { CheckContext, CheckResult } from "../types.ts";

const VALID_PREFIXES = ["mechanical:", "human:", "llm_judge:"];
const EXEMPT_PRAGMA = /conformance:added-by-exempt/;

interface AddDrawerCall {
  call: CallExpression;
  objectArgIndex: number;
}

/**
 * Returns the argument index of the `add_drawer` options object, or null
 * when this is not an add_drawer invocation.
 *
 * Shapes recognized:
 *   - `add_drawer({ ... })`                       → index 0
 *   - `queueOp(ops, "add_drawer", { ... })`       → index 2
 *   - `bridgeFire("add_drawer", { ... })`         → index 1
 */
function identifyAddDrawerCall(call: CallExpression): AddDrawerCall | null {
  const callee = call.getExpression().getText();
  const args = call.getArguments();

  if (callee === "add_drawer" && args.length >= 1) {
    return { call, objectArgIndex: 0 };
  }

  if (callee === "queueOp" && args.length >= 3) {
    const op = args[1];
    if (op?.getKind() === SyntaxKind.StringLiteral && op.getText().replace(/['"]/g, "") === "add_drawer") {
      return { call, objectArgIndex: 2 };
    }
  }

  if (callee === "bridgeFire" && args.length >= 2) {
    const action = args[0];
    if (action?.getKind() === SyntaxKind.StringLiteral && action.getText().replace(/['"]/g, "") === "add_drawer") {
      return { call, objectArgIndex: 1 };
    }
  }

  return null;
}

type Verdict =
  | { ok: true }
  | { ok: false; reason: string };

function inspectAddedBy(call: CallExpression, objectArgIndex: number): Verdict {
  const args = call.getArguments();
  const obj = args[objectArgIndex];
  if (!obj || obj.getKind() !== SyntaxKind.ObjectLiteralExpression) {
    return { ok: false, reason: "add_drawer options argument is not an object literal — cannot statically verify" };
  }

  const props = obj.getDescendantsOfKind(SyntaxKind.PropertyAssignment);
  const prop = props.find((p) => {
    const name = p.getFirstChildByKind(SyntaxKind.Identifier)?.getText()
      ?? p.getFirstChildByKind(SyntaxKind.StringLiteral)?.getText().replace(/['"]/g, "");
    return name === "added_by";
  });
  if (!prop) {
    return { ok: false, reason: "add_drawer call missing `added_by` property" };
  }

  const initializer = prop.getLastChild();
  if (!initializer) return { ok: false, reason: "`added_by` has no value" };

  const kind = initializer.getKind();
  if (kind === SyntaxKind.StringLiteral || kind === SyntaxKind.NoSubstitutionTemplateLiteral) {
    const raw = initializer.getText().replace(/^['"`]|['"`]$/g, "");
    if (VALID_PREFIXES.some((p) => raw.startsWith(p))) return { ok: true };
    return { ok: false, reason: `added_by: ${JSON.stringify(raw)} must start with mechanical:|human:|llm_judge:` };
  }

  if (kind === SyntaxKind.TemplateExpression) {
    const head = initializer.getFirstChildByKind(SyntaxKind.TemplateHead)?.getText() ?? "";
    const headStr = head.replace(/^`/, "").replace(/\$\{$/, "");
    if (VALID_PREFIXES.some((p) => headStr.startsWith(p))) return { ok: true };
    return { ok: false, reason: `added_by template starts with ${JSON.stringify(headStr)} — must begin with mechanical:|human:|llm_judge:` };
  }

  return { ok: false, reason: `added_by value is a ${SyntaxKind[kind]} — cannot statically verify prefix` };
}

export async function addedByPrefix(ctx: CheckContext): Promise<CheckResult> {
  const files = walkFiles(ctx.hooksRoot, (name) => name.endsWith(".hook.ts") || name.endsWith(".ts"));
  if (files.length === 0) {
    return {
      rId: "added_by_prefix",
      requirement: "add_drawer callers emit mechanical:|human:|llm_judge: prefix on added_by",
      status: "not_applicable",
      evidence: [`no *.ts files found under ${ctx.hooksRoot}`],
    };
  }

  const project = createCheckProject();
  project.addSourceFilesAtPaths(files);
  const evidence: string[] = [];
  let callsInspected = 0;

  for (const sf of project.getSourceFiles()) {
    const fullText = sf.getFullText();
    if (!fullText.includes("add_drawer")) continue;
    const filePath = sf.getFilePath();
    const lines = fullText.split("\n");
    const calls = sf.getDescendantsOfKind(SyntaxKind.CallExpression);

    for (const call of calls) {
      const ident = identifyAddDrawerCall(call);
      if (!ident) continue;
      callsInspected++;
      if (hasExemptPragma(call, lines, EXEMPT_PRAGMA)) continue;
      const verdict = inspectAddedBy(ident.call, ident.objectArgIndex);
      if (!verdict.ok) {
        evidence.push(`${filePath}:${call.getStartLineNumber()}  ${verdict.reason}`);
      }
    }
  }

  if (callsInspected === 0) {
    return {
      rId: "added_by_prefix",
      requirement: "add_drawer callers emit mechanical:|human:|llm_judge: prefix on added_by",
      status: "not_applicable",
      evidence: [`no add_drawer call-sites found under ${ctx.hooksRoot}`],
    };
  }

  return {
    rId: "added_by_prefix",
    requirement: "add_drawer callers emit mechanical:|human:|llm_judge: prefix on added_by",
    status: evidence.length === 0 ? "pass" : "fail",
    evidence: evidence.length === 0
      ? [`${callsInspected} add_drawer call-site(s) clean`]
      : evidence,
  };
}
