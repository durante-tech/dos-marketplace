/**
 * R73 — curated-pointer-upstream. RFC-0107 §3 A2.
 *
 * For every pack where `packKind(packPath) === "curated-pointer"`, enforce
 * two sub-checks:
 *   (a) `plugin.json.upstream` is a non-empty URL (regex: starts with
 *       `http://` or `https://`). This is the canonical Aggregate identity
 *       (RFC-0107 §2).
 *   (b) Provenance-trail consistency: IF `src/extension.yaml` carries
 *       `metadata.open_design.upstream`, that value MUST equal
 *       `plugin.json.upstream`. The extension.yaml field is the migration
 *       provenance trail (where the pack came from); the plugin.json field
 *       is the canonical source. If both exist they must agree, or the pack
 *       is telling two stories about its origin. A *present-and-divergent*
 *       value fails; an absent value is fine (the field is optional).
 *
 * For all other pack kinds, the rule is `not_applicable`.
 *
 * Co-ships with RFC-0107 Phase 1 cohort (Cockburn C1 + Feathers C3 + Beck C4
 * convergent — co-ship with cohort, not deferred). Sub-check (b) added
 * 2026-05-19 per operator Q5 approval.
 *
 * Status:
 *   - pass: every curated-pointer pack passes both (a) and (b)
 *   - fail: at least one curated-pointer pack fails (a) OR (b); evidence names
 *     which sub-check tripped and the offending value(s)
 *   - not_applicable: no curated-pointer packs found under <repoRoot>/Packs/
 *
 * Test seam: ctx.repoRoot (handler walks <repoRoot>/Packs/{X}/ for plugin.json).
 *
 * Detection:
 *   1. List top-level dirs under <repoRoot>/Packs/
 *   2. For each, read plugin.json (skip if absent — R11's responsibility)
 *   3. If packKind() !== "curated-pointer", skip
 *   4. (a) Check plugin.json.upstream is non-empty string starting with
 *          `http://` or `https://`
 *   5. (b) If src/extension.yaml has metadata.open_design.upstream, check it
 *          equals plugin.json.upstream. Missing/unparseable extension.yaml is
 *          NOT a (b) failure — R11 governs extension.yaml presence; R73 (b)
 *          only fires on a present-and-divergent value.
 *
 * Why URL-prefix and not full URL validation: per RFC-0107 Q4, broken upstream
 * URLs (404s) are warnings emitted by a separate follow-up tool, not gating
 * errors here. R73 only enforces shape-presence + provenance consistency,
 * not reachability.
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
// pack-kind is vendored into the ConformanceChecks subtree (mirrors the
// ast-utils.ts precedent) so the sentinel pack stays self-contained and the
// live-deployed handler resolves without reaching repo-root Tools/. The
// canonical copy lives at Tools/lib/pack-kind.ts; .dos-sync-manifest.json
// declares the pair so drift between the two is caught by sync-check.
import { packKind } from "../lib/pack-kind.ts";
import type { CheckContext, CheckResult } from "../types.ts";

const REQUIREMENT =
  'Every pack with `kind: "curated-pointer"` in plugin.json MUST have a non-empty `plugin.json.upstream` URL starting with http:// or https://';

const URL_PREFIX_RE = /^https?:\/\//i;

interface UpstreamProbe {
  packName: string;
  packPath: string;
  /** Reason for failure, or null if the pack is well-formed. */
  failure: null | string;
}

function readPluginJsonUpstream(packPath: string): unknown {
  const pluginJsonPath = join(packPath, "plugin.json");
  if (!existsSync(pluginJsonPath)) return undefined;
  try {
    const raw = readFileSync(pluginJsonPath, "utf-8");
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return parsed["upstream"];
  } catch {
    return undefined;
  }
}

/**
 * Read `metadata.open_design.upstream` from `src/extension.yaml`.
 *
 * Returns the value if present, or `undefined` when the file is missing,
 * unparseable, or the nested key is absent. Per RFC-0107 §3 A2(b) a missing
 * value is NOT a failure — R11 governs extension.yaml presence, and the
 * open_design.upstream field is an optional migration provenance trail.
 */
function readExtensionYamlProvenanceUpstream(packPath: string): unknown {
  const extYamlPath = join(packPath, "src", "extension.yaml");
  if (!existsSync(extYamlPath)) return undefined;
  let parsed: unknown;
  try {
    parsed = parseYaml(readFileSync(extYamlPath, "utf-8"));
  } catch {
    // Unparseable extension.yaml — R11's territory, not R73 (b). Skip silently.
    return undefined;
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return undefined;
  }
  const metadata = (parsed as Record<string, unknown>)["metadata"];
  if (metadata === null || typeof metadata !== "object" || Array.isArray(metadata)) {
    return undefined;
  }
  const openDesign = (metadata as Record<string, unknown>)["open_design"];
  if (openDesign === null || typeof openDesign !== "object" || Array.isArray(openDesign)) {
    return undefined;
  }
  return (openDesign as Record<string, unknown>)["upstream"];
}

function probePack(packPath: string, packName: string): UpstreamProbe | null {
  // packKind() throws if plugin.json is missing/malformed — that's R11's
  // territory. We skip silently here (returns null) so R73 doesn't double-report.
  let kind: ReturnType<typeof packKind>;
  try {
    kind = packKind(packPath);
  } catch {
    return null;
  }
  if (kind !== "curated-pointer") return null;

  const upstream = readPluginJsonUpstream(packPath);
  if (upstream === undefined || upstream === null) {
    return {
      packName,
      packPath,
      failure: `plugin.json.upstream field is missing (curated-pointer Aggregate identity required per RFC-0107 §2)`,
    };
  }
  if (typeof upstream !== "string") {
    return {
      packName,
      packPath,
      failure: `plugin.json.upstream must be a string (got ${typeof upstream})`,
    };
  }
  if (upstream.length === 0) {
    return {
      packName,
      packPath,
      failure: `plugin.json.upstream is an empty string (must be a non-empty http(s) URL)`,
    };
  }
  if (!URL_PREFIX_RE.test(upstream)) {
    return {
      packName,
      packPath,
      failure: `plugin.json.upstream "${upstream}" does not start with http:// or https://`,
    };
  }

  // (a) passed. Sub-check (b): provenance-trail consistency (RFC-0107 §3 A2(b)).
  // If extension.yaml carries metadata.open_design.upstream, it MUST equal the
  // canonical plugin.json.upstream. Absent value → skip (b), it is optional.
  const provenanceUpstream = readExtensionYamlProvenanceUpstream(packPath);
  if (provenanceUpstream !== undefined && provenanceUpstream !== null) {
    if (provenanceUpstream !== upstream) {
      return {
        packName,
        packPath,
        failure:
          `provenance drift: plugin.json.upstream "${upstream}" != ` +
          `extension.yaml metadata.open_design.upstream "${String(provenanceUpstream)}"`,
      };
    }
  }

  return { packName, packPath, failure: null };
}

export async function r73CuratedPointerUpstream(
  ctx: CheckContext,
): Promise<CheckResult> {
  const packsRoot = join(ctx.repoRoot, "Packs");
  if (!existsSync(packsRoot)) {
    return {
      rId: "R73",
      requirement: REQUIREMENT,
      status: "not_applicable",
      evidence: [`Packs/ directory not found at ${packsRoot}`],
    };
  }

  let entries: string[];
  try {
    entries = readdirSync(packsRoot);
  } catch (err) {
    return {
      rId: "R73",
      requirement: REQUIREMENT,
      status: "not_applicable",
      evidence: [
        `Could not read Packs/ at ${packsRoot}: ${(err as Error).message}`,
      ],
    };
  }

  const probes: UpstreamProbe[] = [];
  for (const entry of entries) {
    const packPath = join(packsRoot, entry);
    try {
      if (!statSync(packPath).isDirectory()) continue;
    } catch {
      continue;
    }
    const probe = probePack(packPath, entry);
    if (probe !== null) probes.push(probe);
  }

  if (probes.length === 0) {
    return {
      rId: "R73",
      requirement: REQUIREMENT,
      status: "not_applicable",
      evidence: [
        `No curated-pointer packs found under ${packsRoot} (scanned ${entries.length} entries)`,
      ],
    };
  }

  const failures = probes.filter((p) => p.failure !== null);
  if (failures.length === 0) {
    const names = probes.map((p) => p.packName).join(", ");
    return {
      rId: "R73",
      requirement: REQUIREMENT,
      status: "pass",
      evidence: [
        `${probes.length} curated-pointer pack(s) audited; all have non-empty http(s) plugin.json.upstream: ${names}`,
      ],
    };
  }

  const evidence: string[] = [
    `${failures.length}/${probes.length} curated-pointer pack(s) failed R73:`,
  ];
  for (const f of failures) {
    evidence.push(`  ${f.packPath}: ${f.failure}`);
  }
  return {
    rId: "R73",
    requirement: REQUIREMENT,
    status: "fail",
    evidence,
    loc: failures[0].packPath,
  };
}
