/**
 * R12 — Bridge __version__ matches library __version__.
 *
 * Convention (established in RFC-0005 §13.2 R12 fix at mempalace_bridge.py):
 * the bridge's `__version__` string MUST be resolved dynamically from the
 * imported library, not hardcoded. The reference shape is:
 *
 *   def _resolve_bridge_version() -> str:
 *       try:
 *           import mempalace
 *           return getattr(mempalace, "__version__", "unknown")
 *       except Exception:
 *           return "unknown"
 *
 *   __version__ = _resolve_bridge_version()
 *
 * Handler verifies both anchors exist in the configured bridge file.
 * If the bridge file is absent, returns `not_applicable` (fresh machine
 * or non-DOS repo).
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

// V11.13 split bridge.py into a facade + 3 modules. The dynamic version
// resolver lives in _bridge_palace.py post-split; the facade re-exports
// __version__. We scan the resolved bridge path; if a sibling
// _bridge_palace.py exists, co-scan it (handles the post-split shape
// transparently). Test fixtures targeting a single bridge.py with no
// sibling continue to scan only that one file.
function bridgeScanPaths(ctxPath: string | undefined): string[] {
  const facade = ctxPath ?? DEFAULT_BRIDGE;
  const palace = join(dirname(facade), "_bridge_palace.py");
  return existsSync(palace) ? [facade, palace] : [facade];
}

const RESOLVER_DEF_RE = /^def\s+_resolve_bridge_version\s*\([^)]*\)\s*->\s*str\s*:/m;
const DYNAMIC_ASSIGN_RE = /^__version__\s*=\s*_resolve_bridge_version\s*\(\s*\)/m;
const HARDCODED_RE = /^__version__\s*=\s*["'][\d.]+["']/m;

export async function r12BridgeVersionSync(ctx: CheckContext): Promise<CheckResult> {
  const paths = bridgeScanPaths(ctx.bridgePath);
  const existing = paths.filter((p) => existsSync(p));

  if (existing.length === 0) {
    return {
      rId: "R12",
      requirement: "Bridge __version__ matches library __version__",
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
        rId: "R12",
        requirement: "Bridge __version__ matches library __version__",
        status: "fail",
        evidence: [`${p} unreadable: ${err instanceof Error ? err.message : String(err)}`],
      };
    }
  }

  const label = existing.length === 1 ? existing[0] : existing.join(" + ");
  const evidence: string[] = [];
  if (!RESOLVER_DEF_RE.test(combined)) {
    evidence.push(`${label}: missing \`def _resolve_bridge_version() -> str:\``);
  }
  if (!DYNAMIC_ASSIGN_RE.test(combined)) {
    evidence.push(`${label}: missing \`__version__ = _resolve_bridge_version()\``);
  }
  if (HARDCODED_RE.test(combined)) {
    const m = combined.match(HARDCODED_RE);
    evidence.push(`${label}: hardcoded version string detected: ${m?.[0]}`);
  }

  return {
    rId: "R12",
    requirement: "Bridge __version__ matches library __version__",
    status: evidence.length === 0 ? "pass" : "fail",
    evidence: evidence.length === 0 ? [`${label}: dynamic resolution present`] : evidence,
  };
}
