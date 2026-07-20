/**
 * R2 — Shared state files use atomic-write + flock.
 *
 * Walks the AST of every *.hook.ts under CheckContext.hooksRoot. A call
 * site is a VIOLATION when:
 *   1. The callee is a known write syscall (see WRITE_CALLEES), AND
 *   2. The first argument statically resolves to a string containing
 *      "MEMORY/STATE", AND
 *   3. There is no same-line or prior-line `// conformance:R2-exempt`.
 *
 * Matched callee shapes: `writeFileSync`, `writeFile`, `fs.writeFileSync`,
 * `fs.writeFile`, `fs.promises.writeFile`, `Bun.write`, `createWriteStream`.
 * NOT matched (by design — pragma if needed): aliased imports like
 * `fsp.writeFile`, `node:fs/promises` destructured renames.
 */

import {
  SyntaxKind,
  calleeName,
  createCheckProject,
  hasExemptPragma,
  walkFiles,
  type CallExpression,
} from "../lib/ast-utils.ts";
import type { CheckContext, CheckResult } from "../types.ts";

const WRITE_CALLEES = new Set<string>([
  "writeFileSync",
  "writeFile",
  "promises.writeFile",
  "Bun.write",
  "createWriteStream",
]);

const STATE_NEEDLE = "MEMORY/STATE";
const EXEMPT_PRAGMA = /conformance:R2-exempt/;

function firstArgStaticallyContainsState(call: CallExpression): boolean {
  const args = call.getArguments();
  if (args.length === 0) return false;
  const arg = args[0]!;
  if (arg.getText().includes(STATE_NEEDLE)) return true;
  if (arg.getKind() === SyntaxKind.Identifier) {
    const sym = arg.getSymbol();
    const decl = sym?.getDeclarations()?.[0];
    if (decl?.getText().includes(STATE_NEEDLE)) return true;
  }
  return false;
}

export async function r2AtomicStateWrites(ctx: CheckContext): Promise<CheckResult> {
  const files = walkFiles(ctx.hooksRoot, (name) => name.endsWith(".hook.ts"));
  const evidence: string[] = [];
  if (files.length === 0) {
    return {
      rId: "R2",
      requirement: "Shared state files use atomic-write + flock",
      status: "not_applicable",
      evidence: [`no *.hook.ts found under ${ctx.hooksRoot}`],
    };
  }
  const project = createCheckProject();
  project.addSourceFilesAtPaths(files);

  for (const sf of project.getSourceFiles()) {
    const fullText = sf.getFullText();
    // Cheap string prefilter — if no write-callee token appears at all,
    // skip the descendant walk (~5-30ms per clean file saved).
    // Lowercased so the capital-W in createWriteStream still matches "write".
    const lowerText = fullText.toLowerCase();
    if (!lowerText.includes("write") && !lowerText.includes("bun.")) continue;
    const filePath = sf.getFilePath();
    const lines = fullText.split("\n");
    const calls = sf.getDescendantsOfKind(SyntaxKind.CallExpression);
    for (const call of calls) {
      const name = calleeName(call);
      if (!name || !WRITE_CALLEES.has(name)) continue;
      if (!firstArgStaticallyContainsState(call)) continue;
      if (hasExemptPragma(call, lines, EXEMPT_PRAGMA)) {
        evidence.push(`${filePath}:${call.getStartLineNumber()}  ${name}(...)  — exempt pragma`);
        continue;
      }
      evidence.push(
        `${filePath}:${call.getStartLineNumber()}  ${name}(...) writes MEMORY/STATE without atomicWriteSync`,
      );
    }
  }

  return {
    rId: "R2",
    requirement: "Shared state files use atomic-write + flock",
    status: evidence.length === 0 ? "pass" : "fail",
    evidence: evidence.length === 0 ? [`${files.length} *.hook.ts clean`] : evidence,
  };
}
