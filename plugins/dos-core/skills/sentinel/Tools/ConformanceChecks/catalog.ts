#!/usr/bin/env bun
/**
 * catalog.ts — generate the Sentinel conformance R-rule catalog FROM the
 * registry, so the human-facing catalog can never hand-drift from the code that
 * backs it ("the catalog is generated, not hand-typed" — PRD Principle).
 *
 * Source of truth: `HANDLERS` in registry.ts. Every registered check-key becomes
 * one catalog row carrying its derived R-id, category, and enforced-by
 * provenance. The `presence.rrule-catalog-registry-parity` handler (R85) gates
 * that the committed catalog table matches this generated set; regenerate with:
 *
 *   bun Packs/sentinel/src/Tools/ConformanceChecks/catalog.ts --md
 *
 * NOTE: this module imports the registry (leaf consumer). The R85 handler does
 * NOT import this module — it parses registry.ts + Conformance.md as text — so
 * registering R85 in the registry creates no import cycle.
 */

import { HANDLERS } from "./registry.ts";

export interface CatalogRow {
  rId: string;
  checkKey: string;
  category: string;
  enforcedBy: string;
}

/** Enforcement-surface provenance keyed by check-key category prefix (ISC-25). */
const ENFORCED_BY: Record<string, string> = {
  presence: "sentinel conformance",
  ast: "sentinel conformance (ts-morph AST)",
  regex: "sentinel conformance (source regex)",
  format: "sentinel conformance (format check)",
  "workflow-regex": "sentinel conformance (workflow regex)",
  "seed-array": "sentinel conformance (seed-array)",
  lint: "lint-skills / CI canary",
  "pai-acl": "PAI-as-Port ACL profile (RFC-0061)",
  dlq: "DLQ isolation profile (RFC-0062)",
};

/** Derive a human R-id from a handler function name (r18… → R18, rAcl1… → R-ACL-1). */
export function deriveRId(fnName: string): string {
  let m: RegExpExecArray | null;
  if ((m = /^rAcl(\d+)/i.exec(fnName))) return `R-ACL-${m[1]}`;
  if ((m = /^rDlq(\d+)/i.exec(fnName))) return `R-DLQ-${m[1]}`;
  if ((m = /^r(\d+)/i.exec(fnName))) return `R${m[1]}`;
  if ((m = /^c(\d+)/i.exec(fnName))) return `C${m[1]}`;
  return "—";
}

/** The full set of registered check-keys (the parity SoT). */
export function registryCheckKeys(): Set<string> {
  return new Set(Object.keys(HANDLERS));
}

/** One catalog row per registered check-key, sorted by check-key. */
export function catalogRows(): CatalogRow[] {
  return Object.entries(HANDLERS)
    .map(([checkKey, fn]) => {
      const category = checkKey.split(".")[0] ?? "";
      return {
        rId: deriveRId((fn as { name?: string }).name ?? ""),
        checkKey,
        category,
        enforcedBy: ENFORCED_BY[category] ?? "sentinel conformance",
      };
    })
    .sort((a, b) => a.checkKey.localeCompare(b.checkKey));
}

/** Render the catalog as a markdown table body (R-id | Check id | Category | Enforced by). */
export function renderCatalogMarkdown(rows: CatalogRow[] = catalogRows()): string {
  const lines = [
    "| R-id | Check id | Category | Enforced by |",
    "|---|---|---|---|",
  ];
  for (const r of rows) {
    lines.push(`| ${r.rId} | \`${r.checkKey}\` | ${r.category} | ${r.enforcedBy} |`);
  }
  return lines.join("\n");
}

if (import.meta.main) {
  const rows = catalogRows();
  if (process.argv.includes("--md")) {
    console.log(renderCatalogMarkdown(rows));
  } else {
    console.log(JSON.stringify({ count: rows.length, rows }, null, 2));
  }
}
