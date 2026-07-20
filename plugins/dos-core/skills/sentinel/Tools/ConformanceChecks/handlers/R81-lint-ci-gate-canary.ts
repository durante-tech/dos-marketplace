/**
 * R81 — lint.ci-gate-canary (spike #22 promotion).
 *
 * The corpus's SECOND `lint.*` static-source-scan rule (after R80). Where R80
 * scans workflow SOURCE for a dangerous code shape, R81 verifies that DOS's CI
 * GATE FILES still hash to their blessed values — a tamper-evident tripwire over
 * the 6 `.github/workflows/*.yml` gates. An author who weakens a gate
 * (secret-scan → `echo`) or appends an exfil step drifts the file's sha256; the
 * canary fires. (v1 deliberately does NOT pin `Tools/sentinel/baseline.json` —
 * it regenerates on every legit rule change, so a warn-only pin would train
 * alarm-fatigue; covering it is a documented regen-coupled follow-on.)
 *
 * The decision logic is NOT here — it lives in the reusable Tool
 * `Packs/sentinel/src/Tools/ci-canary.ts` (`verifyCanary`), which also backs the
 * standalone CLI / future CI-step / pre-push surfaces. This handler is the thin
 * Sentinel-scan adapter: load the manifest, run the real decision function,
 * surface the verdict. ONE decision function, no duplication.
 *
 * Warn-only ship (mirrors R80 + R72 advisory)
 * -------------------------------------------
 * The handler ALWAYS returns `status: "pass"`. A tripped canary surfaces via
 * evidence only — it never blocks a scan and changes no existing verdict. This
 * is the HONEST accident-catcher tier: a pure in-repo hash canary is
 * tamper-EVIDENT, not tamper-PROOF (the self-bless hole). The fail-tier flip,
 * the server-side CI step, the pre-push hook, the SECURITY-event emission, and
 * the self-bless mitigation (signature / OIDC / Environment-secret pins) are the
 * documented ladder — gated on FP-rate soak + normalization policy + an operator
 * security decision. Promote after measurement (R75 `DOS_R75_MODE` precedent).
 *
 * not_applicable when no `.github/ci-canary.json` exists under repoRoot — safe
 * on repos / fixtures without the manifest.
 */

import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { verifyCanary, safeRepoReader, type CanaryManifest, type CanaryVerdict } from "../../ci-canary.ts";
import type { CheckContext, CheckResult } from "../types.ts";

const REQUIREMENT =
  "lint.ci-gate-canary: CI gate files (.github/workflows/*.yml) must hash to their blessed sha256 in .github/ci-canary.json (tamper-evident)";

const R_ID = "R81";
const MANIFEST_REL = ".github/ci-canary.json";

export async function r81LintCiGateCanary(
  ctx: CheckContext,
): Promise<CheckResult> {
  const manifestPath = join(ctx.repoRoot, MANIFEST_REL);

  if (!existsSync(manifestPath)) {
    return {
      rId: R_ID,
      requirement: REQUIREMENT,
      status: "not_applicable",
      evidence: [`no canary manifest at ${MANIFEST_REL} under ${ctx.repoRoot}`],
    };
  }

  let manifest: CanaryManifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, "utf-8")) as CanaryManifest;
  } catch (e) {
    // A malformed manifest is itself worth surfacing, but warn-only: never block.
    return {
      rId: R_ID,
      requirement: REQUIREMENT,
      status: "pass",
      evidence: [`lint.ci-gate-canary (WARN-ONLY): manifest parse error — ${String(e)}`],
    };
  }

  if (!Array.isArray(manifest.gates) || manifest.gates.length === 0) {
    return {
      rId: R_ID,
      requirement: REQUIREMENT,
      status: "pass",
      evidence: ["lint.ci-gate-canary (WARN-ONLY): manifest has no `gates` to verify"],
    };
  }

  let verdict: CanaryVerdict;
  try {
    // safeRepoReader is path-contained + symlink-refusing (raw bytes) — a gate
    // path that escapes repoRoot or is a symlink reads as missing → trips.
    verdict = verifyCanary(manifest, safeRepoReader(ctx.repoRoot));
  } catch (e) {
    // Defense in depth: verifyCanary already guards malformed gates, but the
    // warn-only contract is sacred — never let any throw escape this handler.
    return {
      rId: R_ID,
      requirement: REQUIREMENT,
      status: "pass",
      evidence: [`lint.ci-gate-canary (WARN-ONLY): verify error — ${String(e)}`],
    };
  }

  const tripped = verdict.findings.filter((f) => f.status !== "intact");

  const summary = verdict.tripped
    ? `lint.ci-gate-canary (WARN-ONLY): TRIPPED — ${tripped.length}/${verdict.total} gate(s) tampered`
    : `lint.ci-gate-canary: ${verdict.intact}/${verdict.total} CI gate(s) intact (clean)`;

  const detail = tripped.map(
    (f) => `  [${f.status}] ${f.path}: ${(f as { reason?: string }).reason ?? ""}`,
  );

  // WARN-ONLY: always pass. Evidence count is the signal (R80 / R72 advisory pattern).
  return {
    rId: R_ID,
    requirement: REQUIREMENT,
    status: "pass",
    evidence: [summary, ...detail.slice(0, 25), ...(detail.length > 25 ? [`(... +${detail.length - 25} more)`] : [])],
  };
}

export const __testing__ = { verifyCanary };
