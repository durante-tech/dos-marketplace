/**
 * R3 — quarantine_stale_hnsw wired into bridge boot path.
 *
 * §9.3.2: every bridge boot path must proactively detect and quarantine
 * stale ChromaDB HNSW segments that would SIGSEGV on first access. The
 * convention is a wrapper helper `_maybe_quarantine_stale_hnsw(palace_path)`
 * defined AND called somewhere else in the bridge module (typically
 * inside `init` or a lazy collection-load path).
 *
 * Handler confirms two anchors in the configured bridge file:
 *   1. `def _maybe_quarantine_stale_hnsw(...)` — helper defined
 *   2. a call-site `_maybe_quarantine_stale_hnsw(...)` OUTSIDE the
 *      defining line — proves the helper is wired, not merely declared
 */

import { existsSync, readFileSync } from "fs";
import { homedir } from "os";
import { dirname, join } from "path";
import type { CheckContext, CheckResult } from "../types.ts";

const DEFAULT_BRIDGE = join(
  homedir(),
  ".claude",
  "DOS",
  "Tools",
  "mempalace_bridge.py",
);

// V11.13 split bridge.py into a facade + 3 modules. The boot-quarantine helper
// lives in _bridge_palace.py post-split; the facade re-exports it. We scan
// the resolved bridge path; if a sibling _bridge_palace.py exists, co-scan
// it (handles the post-split shape transparently). Test fixtures targeting
// a single bridge.py with no sibling continue to scan only that one file.
function bridgeScanPaths(ctxPath: string | undefined): string[] {
  const facade = ctxPath ?? DEFAULT_BRIDGE;
  const palace = join(dirname(facade), "_bridge_palace.py");
  return existsSync(palace) ? [facade, palace] : [facade];
}

const DEF_RE = /^def\s+_maybe_quarantine_stale_hnsw\s*\(/m;
const CALL_RE = /^(?!def\s)[^\n]*_maybe_quarantine_stale_hnsw\s*\(/m;

/** Strip Python line comments (`# ...` to EOL) without touching string literals.
 * Naive but sufficient: bridge.py doesn't embed `#` inside single-line strings
 * on lines we care about. Multi-line docstrings remain intact (they don't
 * contain a `#` comment marker at column 0 of a new line). */
function stripPyComments(src: string): string {
  return src
    .split("\n")
    .map((line) => line.replace(/(^|[^"'])#.*$/, "$1"))
    .join("\n");
}

export async function r3BridgeBootQuarantine(ctx: CheckContext): Promise<CheckResult> {
  const paths = bridgeScanPaths(ctx.bridgePath);
  const existing = paths.filter((p) => existsSync(p));

  if (existing.length === 0) {
    return {
      rId: "R3",
      requirement: "quarantine_stale_hnsw wired into bridge boot path",
      status: "not_applicable",
      evidence: [`${paths.join(", ")} not found — bridge not installed`],
    };
  }

  let combined = "";
  for (const p of existing) {
    try {
      combined += readFileSync(p, "utf-8") + "\n";
    } catch (err) {
      return {
        rId: "R3",
        requirement: "quarantine_stale_hnsw wired into bridge boot path",
        status: "fail",
        evidence: [`${p} unreadable: ${err instanceof Error ? err.message : String(err)}`],
      };
    }
  }

  const codeOnly = stripPyComments(combined);
  const label = existing.length === 1 ? existing[0] : existing.join(" + ");
  const evidence: string[] = [];
  if (!DEF_RE.test(codeOnly)) {
    evidence.push(`${label}: missing \`def _maybe_quarantine_stale_hnsw(...)\` helper`);
  }
  if (!CALL_RE.test(codeOnly)) {
    evidence.push(`${label}: helper defined but never called — boot path not wired`);
  }

  return {
    rId: "R3",
    requirement: "quarantine_stale_hnsw wired into bridge boot path",
    status: evidence.length === 0 ? "pass" : "fail",
    evidence: evidence.length === 0 ? [`${label}: helper defined and called`] : evidence,
  };
}
