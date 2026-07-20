/**
 * R4 — MEMPALACE_PKG_SPEC pins upper bound.
 *
 * `Packs/mem-palace/src/Hooks/lib/mempalace.ts` hands the `uv run --with`
 * command its package spec via `MEMPALACE_PKG_SPEC`. Without an upper
 * bound, a future breaking release from upstream can silently be
 * ingested on next `uv sync`. The convention (§12.1.1) is a spec of the
 * form `mempalace>=X.Y.Z,<A.B`.
 *
 * Handler reads the file, locates the default-spec string, and flags
 * when the string either:
 *   - lacks any `<` upper-bound clause, OR
 *   - pins only a lower bound (e.g. `mempalace>=3.3.2`)
 *
 * Accepts any `<N.N[.N]` upper bound (3.4 / 4.0 / 3.3.3 — all count).
 * Exempt pragma: `// conformance:R4-exempt`.
 */

import { existsSync, readFileSync } from "fs";
import { join } from "path";
import type { CheckContext, CheckResult } from "../types.ts";

const DEFAULT_PKG_SPEC_PATH = "Packs/mem-palace/src/Hooks/lib/mempalace.ts";
const DEFAULT_SPEC_RE = /const\s+MEMPALACE_PKG_SPEC\s*=\s*[^'"`]*['"`]([^'"`]+)['"`]/;
const UPPER_BOUND_RE = /<\s*\d+(?:\.\d+){0,2}/;
const EXEMPT_PRAGMA_RE = /conformance:R4-exempt/;

export async function r4PkgSpecUpperBound(ctx: CheckContext): Promise<CheckResult> {
  const path = ctx.pkgSpecPath ?? join(ctx.repoRoot, DEFAULT_PKG_SPEC_PATH);

  if (!existsSync(path)) {
    return {
      rId: "R4",
      requirement: "MEMPALACE_PKG_SPEC pins upper bound",
      status: "not_applicable",
      evidence: [`${path} not found — pkg spec file not installed`],
    };
  }

  let content: string;
  try {
    content = readFileSync(path, "utf-8");
  } catch (err) {
    return {
      rId: "R4",
      requirement: "MEMPALACE_PKG_SPEC pins upper bound",
      status: "fail",
      evidence: [`${path} unreadable: ${err instanceof Error ? err.message : String(err)}`],
    };
  }

  if (EXEMPT_PRAGMA_RE.test(content)) {
    return {
      rId: "R4",
      requirement: "MEMPALACE_PKG_SPEC pins upper bound",
      status: "not_applicable",
      evidence: [`${path}: exempt pragma \`conformance:R4-exempt\` present in source`],
    };
  }

  const match = DEFAULT_SPEC_RE.exec(content);
  if (!match) {
    return {
      rId: "R4",
      requirement: "MEMPALACE_PKG_SPEC pins upper bound",
      status: "fail",
      evidence: [`${path}: could not locate default \`MEMPALACE_PKG_SPEC\` literal — was the declaration renamed?`],
    };
  }

  const spec = match[1];
  if (!UPPER_BOUND_RE.test(spec)) {
    return {
      rId: "R4",
      requirement: "MEMPALACE_PKG_SPEC pins upper bound",
      status: "fail",
      evidence: [`${path}: default spec ${JSON.stringify(spec)} lacks an upper-bound clause (e.g. \`<3.4\`)`],
    };
  }

  return {
    rId: "R4",
    requirement: "MEMPALACE_PKG_SPEC pins upper bound",
    status: "pass",
    evidence: [`${path}: spec ${JSON.stringify(spec)} pins upper bound`],
  };
}
