/**
 * R43 — Bridge-symbol grep must co-locate post-V11.13 split.
 *
 * Background: 2026-05-09 incident. R1, R3, R12 all grep mempalace_bridge.py
 * for Python symbols (ACTIONS dict, _maybe_quarantine_stale_hnsw,
 * _resolve_bridge_version). V11.13 (RFC-0075) split the bridge into a
 * facade + 3 modules, moving these symbols into _bridge_palace.py. The
 * R-rules kept grepping only the facade and produced false-failures —
 * forcing operators to bypass pre-commit with --no-verify, which masked
 * other real issues during wave merges.
 *
 * Convention (post-V11.13): any conformance rule that scans
 * mempalace_bridge.py for a Python symbol MUST also scan _bridge_palace.py
 * (and the other split modules where applicable). The bridge is now a
 * multi-file concept; rules that hardcode a single-file model are stale.
 *
 * Detection: scan handler files under handlers/ for either:
 *   1. A regex literal that anchors to the exact filename
 *      "mempalace_bridge.py" without also referencing "_bridge_palace.py"
 *      OR a sibling-walk pattern (`existsSync(... _bridge_palace.py)`)
 *   2. A path constant `mempalace_bridge.py` that is not paired with a
 *      sibling-or-co-scan helper
 *
 * Heuristic: a handler file is suspect if it
 *   • mentions `mempalace_bridge.py` (single-file path)
 *   • does NOT also mention `_bridge_palace.py` OR `bridgeScanPaths` OR
 *     a similar co-locating helper
 *
 * Pass: every handler that targets the bridge co-locates the split modules.
 * Fail: at least one handler hardcodes the single-file mempalace_bridge.py
 * without sibling co-scan.
 * Not_applicable: handlers/ directory not present (non-Sentinel install).
 *
 * Exempt pragma: `// conformance:R43-exempt <reason>` for handlers that
 * intentionally only target the facade (e.g., a dispatch-table parity check).
 */

import { existsSync, readFileSync, readdirSync } from "fs";
import { join } from "path";
import type { CheckContext, CheckResult } from "../types.ts";

const REQUIREMENT =
  "Conformance handlers that scan mempalace_bridge.py must also scan _bridge_palace.py (post-V11.13 split — symbols moved out of the facade)";
const FACADE_NEEDLE = "mempalace_bridge.py";
const PALACE_NEEDLE = "_bridge_palace.py";
const COSCAN_HELPER_NEEDLES = [
  "bridgeScanPaths",
  "_bridge_palace",
  "bridgePathsForCheck",
];
const EXEMPT_PRAGMA = /conformance:R43-exempt/;

export async function r43BridgeSymbolCoLocation(ctx: CheckContext): Promise<CheckResult> {
  const handlersDir = join(
    ctx.repoRoot,
    "Packs",
    "sentinel",
    "src",
    "Tools",
    "ConformanceChecks",
    "handlers",
  );

  if (!existsSync(handlersDir)) {
    return {
      rId: "R43",
      requirement: REQUIREMENT,
      status: "not_applicable",
      evidence: [`Sentinel handlers/ not found at ${handlersDir}`],
    };
  }

  const files = readdirSync(handlersDir).filter((f) => f.endsWith(".ts"));
  const offenders: string[] = [];
  let scanned = 0;
  let coScanned = 0;

  for (const fname of files) {
    // Skip self — R43 references the needles in its own description
    if (fname.startsWith("R43-")) continue;
    const path = join(handlersDir, fname);
    let content: string;
    try {
      content = readFileSync(path, "utf-8");
    } catch {
      continue;
    }
    if (!content.includes(FACADE_NEEDLE)) continue;
    scanned++;

    // Check exempt pragma anywhere in the file (handlers can opt out)
    if (EXEMPT_PRAGMA.test(content)) {
      coScanned++;
      continue;
    }

    const hasCoScan =
      content.includes(PALACE_NEEDLE) ||
      COSCAN_HELPER_NEEDLES.some((n) => content.includes(n));

    if (hasCoScan) {
      coScanned++;
    } else {
      offenders.push(`${path}: references ${FACADE_NEEDLE} but does not co-scan ${PALACE_NEEDLE} (post-V11.13 split invariant)`);
    }
  }

  if (offenders.length === 0) {
    return {
      rId: "R43",
      requirement: REQUIREMENT,
      status: "pass",
      evidence: [
        `${scanned} handler(s) reference mempalace_bridge.py — all ${coScanned} co-scan _bridge_palace.py or use a co-scan helper`,
      ],
    };
  }

  return {
    rId: "R43",
    requirement: REQUIREMENT,
    status: "fail",
    evidence: [
      `${offenders.length} of ${scanned} bridge-touching handlers omit _bridge_palace.py co-scan:`,
      ...offenders,
      `Fix: extend bridgeScanPaths() (or equivalent helper) to include the sibling _bridge_palace.py before the regex match. Reference R3 + R12 + R1 post-V11.13 fix as the canonical pattern.`,
    ],
  };
}
