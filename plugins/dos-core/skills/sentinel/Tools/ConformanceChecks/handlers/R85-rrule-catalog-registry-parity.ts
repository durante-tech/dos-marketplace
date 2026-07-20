/**
 * R85 (Sentinel vNext, PRD 20260626-015317) — the human-facing conformance
 * R-rule catalog must match the registry that backs it.
 *
 * The SKILL/Conformance catalog historically hand-drifted: SKILL advertised
 * R1-R43, Conformance.md showed R1-R12, while registry.ts shipped ~100 keys
 * through R84. A reader could not tell what `sentinel conformance` actually
 * checks. This handler regenerates the catalog key-set from the registry SOURCE
 * and fails when the committed catalog table (a `<!-- BEGIN/END generated-catalog -->`
 * block in Conformance.md) diverges — so adding a handler without regenerating
 * the catalog (`bun .../ConformanceChecks/catalog.ts --md`) is caught here.
 *
 * Implementation note: this handler parses registry.ts and Conformance.md as
 * TEXT (it does NOT import the registry or catalog.ts) so that registering it in
 * the registry creates no import cycle.
 */

import { existsSync, readFileSync } from "fs";
import { join } from "path";
import type { CheckContext, CheckResult } from "../types.ts";

const REQUIREMENT =
  "The Conformance R-rule catalog (generated-catalog block in Conformance.md) must list exactly the check-keys registered in registry.ts HANDLERS — regenerate with `bun Packs/sentinel/src/Tools/ConformanceChecks/catalog.ts --md`";

const RID = "R85";

const KEY_RE = /^[a-z][a-zA-Z0-9_-]*(?:\.[a-zA-Z0-9_-]+)+$/;

/** Extract the `"check.key":` set from the `HANDLERS` object literal in registry.ts. */
export function parseRegistryKeys(src: string): Set<string> {
  const start = src.indexOf("HANDLERS");
  if (start === -1) return new Set();
  const open = src.indexOf("{", start);
  if (open === -1) return new Set();
  // Walk to the matching close brace to bound the HANDLERS object.
  let depth = 0;
  let end = -1;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  const block = end === -1 ? src.slice(open) : src.slice(open, end);
  const keys = new Set<string>();
  for (const m of block.matchAll(/"([^"]+)"\s*:/g)) {
    if (KEY_RE.test(m[1])) keys.add(m[1]);
  }
  return keys;
}

/** Extract check-keys from the generated-catalog block of the Conformance doc. */
export function parseCatalogDocKeys(doc: string): Set<string> {
  const begin = doc.indexOf("BEGIN generated-catalog");
  const finish = doc.indexOf("END generated-catalog");
  const block = begin !== -1 && finish !== -1 ? doc.slice(begin, finish) : "";
  const keys = new Set<string>();
  for (const m of block.matchAll(/`([^`]+)`/g)) {
    if (KEY_RE.test(m[1])) keys.add(m[1]);
  }
  return keys;
}

export async function r85RruleCatalogRegistryParity(ctx: CheckContext): Promise<CheckResult> {
  const registryPath =
    ctx.catalogRegistryPath ??
    join(ctx.repoRoot, "Packs/sentinel/src/Tools/ConformanceChecks/registry.ts");
  const docPath =
    ctx.catalogDocPath ?? join(ctx.repoRoot, "Packs/sentinel/src/Workflows/Conformance.md");

  if (!existsSync(registryPath) || !existsSync(docPath)) {
    return {
      rId: RID,
      requirement: REQUIREMENT,
      status: "not_applicable",
      evidence: [
        `registry or catalog doc not found (registry=${existsSync(registryPath)}, doc=${existsSync(docPath)})`,
      ],
    };
  }

  const registryKeys = parseRegistryKeys(readFileSync(registryPath, "utf-8"));
  const docKeys = parseCatalogDocKeys(readFileSync(docPath, "utf-8"));

  if (registryKeys.size === 0) {
    return {
      rId: RID,
      requirement: REQUIREMENT,
      status: "not_applicable",
      evidence: [`could not parse any HANDLERS keys from ${registryPath}`],
    };
  }

  const missingFromDoc = [...registryKeys].filter((k) => !docKeys.has(k)).sort();
  const staleInDoc = [...docKeys].filter((k) => !registryKeys.has(k)).sort();

  if (missingFromDoc.length === 0 && staleInDoc.length === 0) {
    return {
      rId: RID,
      requirement: REQUIREMENT,
      status: "pass",
      evidence: [
        `catalog ↔ registry parity: ${registryKeys.size} registered check-keys all present in the generated-catalog block`,
      ],
    };
  }

  const ev: string[] = [
    `catalog ↔ registry DRIFT: ${missingFromDoc.length} registry key(s) missing from the catalog, ${staleInDoc.length} stale catalog row(s) with no handler`,
    "regenerate: bun Packs/sentinel/src/Tools/ConformanceChecks/catalog.ts --md",
  ];
  if (missingFromDoc.length) ev.push(`missing from catalog: ${missingFromDoc.slice(0, 8).join(", ")}`);
  if (staleInDoc.length) ev.push(`stale in catalog: ${staleInDoc.slice(0, 8).join(", ")}`);

  return { rId: RID, requirement: REQUIREMENT, status: "fail", evidence: ev };
}
