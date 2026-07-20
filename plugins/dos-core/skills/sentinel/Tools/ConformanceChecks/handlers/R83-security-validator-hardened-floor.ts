/**
 * R83 — SecurityValidator hardened-floor (RFC-0112 §11.3 item 6).
 *
 * The SecurityValidator no-patterns-file path (`loadPatterns()` `!patternsPath`
 * branch) must fail CLOSED onto HARDENED_FALLBACK, never onto a permissive
 * allow-all config. A fresh DOS install with no provisioned `patterns.yaml`
 * must still block catastrophic shell commands. RFC-0112 §10's escalation
 * ("should a security validator fail open at all?") is closed with NO.
 *
 * Why a dedicated rule (RedTeam R5, RFC-0112 §11.2): a check that only inspects
 * the `philosophy.mode` LABEL is theater — an attacker (or a regression) can
 * write `mode: 'hardened-fallback'` with an EMPTY blocked list and pass. So R83
 * verifies the EFFECTIVE floor, not the label, statically:
 *
 *   (a1) the legacy fail-OPEN shape is gone — no `mode:'permissive'` allow-all
 *        config returned from loadPatterns;
 *   (a2) the `!patternsPath` branch routes to HARDENED_FALLBACK;
 *   (a3) HARDENED_FALLBACK's blocked set NAMES every catastrophic category
 *        (rm -rf /, raw-disk dd, mkfs, fork bomb, curl|bash) — i.e. the floor is
 *        a SUPERSET, not a narrowed set. This reads the floor's CONTENT, which
 *        is exactly what R5 demands ("superset, not label-equal").
 *
 * The RUNTIME proof (spawn the hook against an empty fixture → `rm -rf /` exits
 * 2, with the full catastrophic vector) deliberately lives in
 * `SecurityValidator.test.ts` (the §11 negative test), NOT here: a Sentinel scan
 * handler that spawns N subprocesses per run is slow and flaky under the
 * concurrent baseline sweep. R83 is the fast, deterministic standing guard; the
 * behavioral assertion is the test's job.
 *
 * Determinism class: `install` (reads ctx.hooksRoot ~/.claude/hooks source).
 * force-advisory — its gating path is the per-RFC ValidateRfcConformance
 * dispatch (manifest island in RFC-0112), mirroring R82; the baseline sweep
 * only snapshots it.
 */

import { existsSync, readFileSync } from "fs";
import { join } from "path";
import type { CheckContext, CheckResult } from "../types.ts";

// Each catastrophic category: a stable reason-substring expected in the
// HARDENED_FALLBACK source block. One entry per category so the floor cannot
// pass on a single exemplar while silently narrowed (RedTeam: "a floor that
// drops mkfs/dd/fork-bomb still passes green").
const CATASTROPHIC: ReadonlyArray<{ label: string; reason: RegExp }> = [
  { label: "rm -rf /", reason: /root wipe/i },
  { label: "raw-disk dd", reason: /Raw disk writes/i },
  { label: "mkfs on device", reason: /Filesystem creation/i },
  { label: "fork bomb", reason: /Fork bomb/i },
  { label: "curl | bash", reason: /remote code execution/i },
];

export async function r83SecurityValidatorHardenedFloor(ctx: CheckContext): Promise<CheckResult> {
  const rId = "R83";
  const requirement =
    "SecurityValidator no-patterns-file path must fail CLOSED onto HARDENED_FALLBACK (RFC-0112 §11.3 item 6) — the effective blocked set must be a SUPERSET of the catastrophic floor (rm -rf /, raw-disk dd, mkfs, fork bomb, curl|bash). Label inspection is insufficient (R5).";
  const hookPath = join(ctx.hooksRoot, "SecurityValidator.hook.ts");

  if (!existsSync(hookPath)) {
    return { rId, requirement, status: "not_applicable", evidence: [`${hookPath} not found — SecurityValidator not installed`] };
  }

  const src = readFileSync(hookPath, "utf-8");
  const findings: string[] = [];
  const passed: string[] = [];

  // (a1) label-spoof / fail-open guard: no permissive allow-all return.
  if (/philosophy:\s*\{\s*mode:\s*['"]permissive['"]/.test(src) ||
      /mode:\s*['"]permissive['"][^}]*No patterns loaded/.test(src)) {
    findings.push("loadPatterns still returns a permissive allow-all config (mode:'permissive') — the no-patterns-file path is fail-OPEN");
  } else {
    passed.push("no permissive allow-all return present in source");
  }

  // (a2) the !patternsPath branch routes to HARDENED_FALLBACK.
  const noFile = src.match(/if\s*\(\s*!patternsPath\s*\)\s*\{([\s\S]*?)\n\s{2}\}/);
  if (!noFile) {
    findings.push("could not locate the `if (!patternsPath)` branch in loadPatterns — structure changed; manual review required");
  } else if (!/HARDENED_FALLBACK/.test(noFile[1])) {
    findings.push("the `if (!patternsPath)` branch does not return HARDENED_FALLBACK — fail-open risk");
  } else {
    passed.push("!patternsPath branch routes to HARDENED_FALLBACK");
  }

  // (a3) SUPERSET (the R5 'effective set ⊇ floor' check, not label): the
  // HARDENED_FALLBACK.bash.blocked literal must name EVERY catastrophic category.
  const floor = src.match(/const HARDENED_FALLBACK[\s\S]*?\n\};/);
  const floorSrc = floor ? floor[0] : "";
  if (!floorSrc) {
    findings.push("HARDENED_FALLBACK const not found — cannot verify the floor superset");
  } else {
    for (const c of CATASTROPHIC) {
      if (c.reason.test(floorSrc)) {
        passed.push(`floor covers ${c.label}`);
      } else {
        findings.push(`HARDENED_FALLBACK.bash.blocked is missing the ${c.label} category — floor is a narrowed (non-superset) set`);
      }
    }
  }

  if (findings.length > 0) {
    return { rId, requirement, status: "fail", evidence: [...findings, ...passed.map((p) => `ok: ${p}`)] };
  }
  return {
    rId,
    requirement,
    status: "pass",
    evidence: [...passed, "runtime behavior proven separately by SecurityValidator.test.ts (§11 no-patterns-file negative test)"],
  };
}
