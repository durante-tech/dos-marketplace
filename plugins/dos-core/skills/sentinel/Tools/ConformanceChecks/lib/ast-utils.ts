/**
 * ast-utils — shared helpers used by AST-backed conformance handlers.
 *
 * Motivation: R2 and later AST handlers (R5, added_by) all share the same
 * file-walker + callee-name resolution + exempt-pragma logic. This module
 * is the common home so handlers stay focused on their rule-specific
 * detection logic. /simplify reviewer agent flagged this as reuse target
 * during PR1 review; extracted as part of PR2.
 */

import { existsSync, readdirSync, statSync } from "fs";
import { join } from "path";
import {
  Project,
  SyntaxKind,
  type CallExpression,
  type Node,
} from "ts-morph";

/**
 * The runner-discoverable test-file basename set — a SINGLE source of truth
 * for every lint.* rule that reasons about "a file `bun test` executes"
 * (R94 no-test-process-exit, R97 archive-test-suffix). Covers the full cross
 * product bun discovers: {`.`|`_`} × {test|spec} × {ts,tsx,js,jsx,mjs,cjs}.
 *
 * Deliberately OVER-inclusive on extension (mjs/cjs): for these rules an
 * over-match is a harmless warn-only evidence line, while an under-match
 * lets a discoverable test escape the rule — the strictly worse failure
 * (the honest-gate incident's own truncator was a `.test.mjs`). Hoisted here
 * 2026-07-03 (ISC-51 /code-review F1+F4) so the two consumers cannot drift.
 */
export const TEST_FILE_RE = /(?:\.|_)(?:test|spec)\.(?:ts|tsx|js|jsx|mjs|cjs)$/;

/** True when a basename is a runner-discoverable test file (see TEST_FILE_RE). */
export function isTestFile(name: string): boolean {
  return TEST_FILE_RE.test(name);
}

/**
 * Walk a directory recursively and collect every file whose basename
 * passes the supplied predicate. Skips dotfiles and node_modules. Quietly
 * skips entries that fail stat (race conditions on short-lived files).
 */
export function walkFiles(
  root: string,
  accept: (name: string) => boolean,
  out: string[] = [],
): string[] {
  if (!existsSync(root)) return out;
  for (const name of readdirSync(root)) {
    if (name.startsWith(".") || name === "node_modules") continue;
    const full = join(root, name);
    let st;
    try { st = statSync(full); } catch { continue; }
    if (st.isDirectory()) walkFiles(full, accept, out);
    else if (accept(name)) out.push(full);
  }
  return out;
}

/**
 * Resolve a CallExpression's callee to a normalized dotted name suitable
 * for Set membership checks. Strips `fs.` and `node:fs.` prefixes so
 * `fs.writeFileSync` and `writeFileSync` collapse to the same key, and
 * `fs.promises.writeFile` collapses to `promises.writeFile`.
 *
 * Returns null for invocations through complex expressions
 * (element-access, `await foo()` chains, etc.) that aren't worth
 * resolving without full type-checking.
 */
export function calleeName(call: CallExpression): string | null {
  const expr = call.getExpression();
  if (expr.getKind() === SyntaxKind.Identifier) return expr.getText();
  if (expr.getKind() === SyntaxKind.PropertyAccessExpression) {
    return expr.getText().replace(/^fs\./, "").replace(/^node:fs\./, "");
  }
  return null;
}

/**
 * Check whether a node is covered by an exempt pragma on the same or
 * previous source line. Pattern is caller-supplied so each handler can
 * scope its own pragma (e.g. `conformance:R2-exempt`,
 * `conformance:R5-exempt`).
 *
 * `lines` is hoisted out by the caller to avoid re-splitting the full
 * file text per call (~1-5ms saved per file when handler flags >1 site).
 */
export function hasExemptPragma(node: Node, lines: string[], pattern: RegExp): boolean {
  const line = node.getStartLineNumber();
  const cur = lines[line - 1] ?? "";
  const prev = lines[line - 2] ?? "";
  return pattern.test(cur) || pattern.test(prev);
}

/**
 * Create a ts-morph Project pre-configured for conformance-check workloads:
 * no lib.d.ts autoload (80-150ms cold-start savings on first symbol
 * resolution), no tsconfig discovery, no in-memory fs.
 */
export function createCheckProject(): Project {
  return new Project({
    useInMemoryFileSystem: false,
    skipAddingFilesFromTsConfig: true,
    compilerOptions: { noLib: true, skipLibCheck: true },
  });
}

export { SyntaxKind };
export type { CallExpression, Node };
