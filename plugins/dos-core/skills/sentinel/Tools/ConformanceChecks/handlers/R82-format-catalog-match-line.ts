/**
 * R82 — format.catalog-match-line (RFC-0134 §10.5 — C4 enforcement).
 *
 * Format-class rule (modeled on R63) that validates the `## Catalog Match` PRD
 * section the §6.1.k CATALOG-MATCH forcing function writes. It is the capture-
 * reliability backstop the C4 audit depends on: a malformed disposition block or a
 * stale provenance hash makes the SURFACED×DISPOSITION×INVOKED join unreliable, so
 * this rule keeps the corpus parseable.
 *
 * Scope: `effort: deep|advanced` PRDs whose run REACHED §6.1.k — detected by the
 *   presence of a `## Catalog Match` section OR a surfaced-sidecar row for the slug
 *   (so the omission hole — sidecar written, section forgotten — is caught).
 *
 * Checks (all → fail; the failing line/PRD is the evidence):
 *   - presence:   reached-§6.1.k PRD must have the section + the machine-only
 *                 provenance comment.
 *   - parse:      every `- ` line satisfies the §10.2 grammar (word-count, separator,
 *                 one-id-per-line); every id resolves to the live registry.
 *   - hash skew:  the provenance registryHash equals the surfaced sidecar's hash
 *                 (stale Catalog Match — scorer ran against a different registry).
 *
 * Tier: warning (R63/RFC-0085 council default) — returns real `fail` but is routed
 *   to baseline-corpus.json via ADVISORY_CHECKS (it reads gitignored MEMORY/WORK +
 *   MEMORY/STATE), so it never gates the structural tripwire. Findings are advisory
 *   (RFC-0134 §10.5 — the only hard mechanism is measurement existence).
 * Grandfathered: PRDs authored before the C3+C4 ship date (RULE_CUTOFF_ISO).
 *
 * Helper reuse (§10.5): stripCodeFences / extractSection / normalizeCapability come
 *   from lib/markdown-catalog.ts (lifted verbatim from R63).
 */

import { existsSync, readFileSync, readdirSync, statSync } from "fs";
import { join, dirname, basename } from "path";
import type { CheckContext, CheckResult } from "../types.ts";
import { isPreCutoffISO } from "../lib/grandfather.ts";
import { parseCatalogMatchSection, flagUnknownIds } from "../lib/markdown-catalog.ts";

const REQUIREMENT =
  "deep/advanced PRDs that reach §6.1.k CATALOG-MATCH must carry a well-formed `## Catalog Match` section (RFC-0134 §10.2/§10.5)";

// C4 ship date — PRDs authored before this never ran §6.1.k, so they are grandfathered.
const RULE_CUTOFF_ISO = "2026-06-25";
const IN_SCOPE_EFFORT = new Set(["deep", "advanced"]);

interface Frontmatter {
  effort?: string;
  started?: string;
}

function listPrdPaths(workDir: string): string[] {
  if (!existsSync(workDir)) return [];
  const out: string[] = [];
  for (const layer of ["active", "archived", ""]) {
    const base = layer ? join(workDir, layer) : workDir;
    if (!existsSync(base)) continue;
    try {
      for (const dir of readdirSync(base)) {
        const prd = join(base, dir, "PRD.md");
        try { if (statSync(prd).isFile()) out.push(prd); } catch {}
      }
    } catch {}
  }
  return out;
}

function parseFrontmatter(content: string): Frontmatter | null {
  const m = content.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return null;
  const fm = m[1]!;
  const read = (k: string) => fm.match(new RegExp(`^${k}:\\s*(.+)$`, "m"))?.[1]?.trim().replace(/^["']|["']$/g, "");
  return { effort: read("effort")?.toLowerCase(), started: read("started") };
}

/** slug → { ids, hash } from the surfaced sidecars (best-effort; missing dir → empty). */
function readSurfaced(dir: string): Map<string, { ids: Set<string>; hash: string }> {
  const out = new Map<string, { ids: Set<string>; hash: string }>();
  if (!existsSync(dir)) return out;
  let files: string[];
  try { files = readdirSync(dir).filter((f) => f.endsWith(".jsonl")); } catch { return out; }
  for (const f of files) {
    let raw: string;
    try { raw = readFileSync(join(dir, f), "utf-8"); } catch { continue; }
    for (const line of raw.split("\n")) {
      const t = line.trim();
      if (!t) continue;
      try {
        const rec = JSON.parse(t) as { schema?: string; prd_slug?: string; id?: string; registryHash?: string };
        if (rec.schema !== "dos-capability-surfaced/v1" || !rec.prd_slug || !rec.id) continue;
        const e = out.get(rec.prd_slug) ?? { ids: new Set<string>(), hash: rec.registryHash ?? "" };
        e.ids.add(rec.id);
        out.set(rec.prd_slug, e);
      } catch { /* skip malformed */ }
    }
  }
  return out;
}

export async function r82FormatCatalogMatchLine(ctx: CheckContext): Promise<CheckResult> {
  const workDir = join(ctx.repoRoot, "MEMORY", "WORK");
  const prds = listPrdPaths(workDir);
  if (prds.length === 0) {
    return { rId: "R82", requirement: REQUIREMENT, status: "not_applicable", evidence: ["no MEMORY/WORK PRDs found"] };
  }

  const surfacedDir = ctx.catalogSurfacedDir ?? join(ctx.repoRoot, "MEMORY", "STATE", "capability-surfaced");
  const surfaced = readSurfaced(surfacedDir);
  const registryIds = ctx.catalogRegistryIds ?? new Set<string>(); // empty → unknown-id check skips (degrade)

  const fails: string[] = [];
  let applicable = 0;
  for (const path of prds) {
    let content: string;
    try { content = readFileSync(path, "utf-8"); } catch { continue; }
    const fm = parseFrontmatter(content);
    if (!fm) continue;
    if (!fm.effort || !IN_SCOPE_EFFORT.has(fm.effort)) continue;
    if (isPreCutoffISO(fm.started, RULE_CUTOFF_ISO)) continue;

    const slug = basename(dirname(path));
    const sidecar = surfaced.get(slug);
    const parsed = parseCatalogMatchSection(content);

    // §6.1.k reached? section present OR a sidecar row exists for the slug.
    const reached = parsed.found || !!sidecar;
    if (!reached) continue;
    applicable++;

    // presence: a reached PRD must have the section + provenance.
    if (!parsed.found) {
      fails.push(`${path}: surfaced sidecar exists but no \`## Catalog Match\` section (omission)`);
      continue;
    }
    if (!parsed.provenance) {
      fails.push(`${path}: \`## Catalog Match\` present but missing/malformed provenance comment`);
    }

    // parse: grammar + unknown-id.
    const checked = flagUnknownIds(parsed.dispositions, registryIds);
    const bad = checked.filter((d) => d.malformed);
    for (const d of bad.slice(0, 3)) {
      fails.push(`${path}: malformed disposition (line ${d.lineNo}): ${d.malformed} — "${d.raw.trim()}"`);
    }

    // hash skew: provenance hash must equal the sidecar's registryHash.
    if (parsed.provenance && sidecar && sidecar.hash && parsed.provenance.registryHash !== sidecar.hash) {
      fails.push(`${path}: registryHash skew (PRD=${parsed.provenance.registryHash} sidecar=${sidecar.hash}) — stale Catalog Match`);
    }
  }

  if (applicable === 0) {
    return { rId: "R82", requirement: REQUIREMENT, status: "not_applicable", evidence: [`scanned ${prds.length} PRDs; none were deep/advanced + reached §6.1.k`] };
  }
  if (fails.length === 0) {
    return { rId: "R82", requirement: REQUIREMENT, status: "pass", evidence: [`${applicable}/${applicable} reached-§6.1.k PRDs carry a well-formed \`## Catalog Match\``] };
  }
  return {
    rId: "R82",
    requirement: REQUIREMENT,
    status: "fail",
    evidence: [`${fails.length} \`## Catalog Match\` defect(s) across ${applicable} reached PRDs:`, ...fails.slice(0, 5)],
  };
}

export const __testing__ = { listPrdPaths, parseFrontmatter, readSurfaced };
