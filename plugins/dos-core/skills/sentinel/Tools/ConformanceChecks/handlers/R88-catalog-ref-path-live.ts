/**
 * R88 — Atomic-design catalog specs must not cite the catalog's own dead path.
 *
 * The catalog relocated from `Docs/Artifacts/` to
 * `Docs/AtomicDesign/artifact-catalog/source/`, but the 2026-06-26 self-
 * compliance audit found ~10+ specs still citing the OLD `Docs/Artifacts/...`
 * path in `references:` / `location:` / `instances_at:` (and body), while their
 * `## Drift Watch` sections asserted "No known drift." A `Docs/Artifacts/`
 * citation is provably dead — that root no longer exists — so this is a
 * zero-false-positive staleness signal, and it directly contradicts a "No known
 * drift" claim.
 *
 * Pass: no spec references `Docs/Artifacts/`.
 * Fail: at least one spec cites the dead catalog root.
 * Not_applicable: catalog missing / no specs / the dead root still exists on
 *   disk (don't fire mid-migration — if someone re-created Docs/Artifacts/ the
 *   citations aren't dead).
 *
 * Tier: warning (RFC-0085 default for new presence checks).
 */

import { existsSync, readFileSync } from "fs";
import { join } from "path";
import type { CheckContext, CheckResult } from "../types.ts";
import { listSpecFiles } from "../lib/catalog-layers.ts";

const REQUIREMENT =
  "No atomic-design catalog spec cites the relocated-away `Docs/Artifacts/` path (catalog now lives at Docs/AtomicDesign/artifact-catalog/source/)";

const DEAD_ROOT = "Docs/Artifacts/";

export async function r88CatalogRefPathLive(ctx: CheckContext): Promise<CheckResult> {
  const catalogRoot = join(ctx.repoRoot, "Docs", "AtomicDesign", "artifact-catalog", "source");
  if (!existsSync(catalogRoot)) {
    return { rId: "R88", requirement: REQUIREMENT, status: "not_applicable", evidence: ["catalog directory not found"] };
  }
  // Guard: if the dead root still exists, citations are not dead — skip.
  if (existsSync(join(ctx.repoRoot, "Docs", "Artifacts"))) {
    return { rId: "R88", requirement: REQUIREMENT, status: "not_applicable", evidence: ["Docs/Artifacts/ still exists on disk — citations not dead"] };
  }
  const specs = listSpecFiles(catalogRoot);
  if (specs.length === 0) {
    return { rId: "R88", requirement: REQUIREMENT, status: "not_applicable", evidence: ["no spec files found"] };
  }

  const fails: string[] = [];
  let scanned = 0;
  for (const path of specs) {
    let content: string;
    try { content = readFileSync(path, "utf-8"); } catch { continue; }
    scanned++;
    const lines = content.split("\n");
    const hits: number[] = [];
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(DEAD_ROOT)) hits.push(i + 1);
    }
    if (hits.length > 0) {
      const rel = path.replace(ctx.repoRoot + "/", "");
      fails.push(`${rel}: dead "${DEAD_ROOT}" citation at line(s) ${hits.slice(0, 4).join(", ")}`);
    }
  }

  if (fails.length === 0) {
    return { rId: "R88", requirement: REQUIREMENT, status: "pass", evidence: [`${scanned} specs; no dead Docs/Artifacts/ citations`] };
  }
  return {
    rId: "R88",
    requirement: REQUIREMENT,
    status: "fail",
    evidence: [`${fails.length}/${scanned} specs cite the dead catalog root:`, ...fails.slice(0, 6)],
  };
}
