/**
 * markdown-catalog — shared parsing surface for the RFC-0134 `## Catalog Match`
 * PRD section, used by the R82 `format.catalog-match-line` handler (C4 enforcement).
 *
 * The text helpers (stripCodeFences / extractSection / normalizeCapability /
 * CAPABILITY_SYNONYMS) are lifted VERBATIM from R63
 * (handlers/R63-declined-line-matches-capability.ts:289/321/378/382) per the
 * RFC-0134 §10.5 mandate ("reuses R63's ... verbatim ... no new parsing surface").
 * R63 keeps its own local copies for now; a follow-up consolidates R63 onto this
 * lib (cover-and-modify, gated on R63's characterization suite). Until then this is
 * the canonical copy for new consumers.
 *
 * parseCatalogMatchSection implements the ratified §10.2 grammar (case-insensitive
 * id amendment, operator decision 2026-06-25). The repo-root Tools/catalog-match.ts
 * engine parser is its single-copy sibling — both transcribe the SAME §10.2 spec.
 */

/** Canonical-alias table — verbatim from R63 (handler:378). */
export const CAPABILITY_SYNONYMS: Readonly<Record<string, string>> = {
  simplify: "code-review",
};

/** Normalize a capability token for evidence matching — verbatim from R63 (handler:382). */
export function normalizeCapability(raw: string): string {
  let s = raw.trim();
  const skillMatch = s.match(/^Skill\(\s*["']?([^"')]+)["']?\s*\)/i);
  if (skillMatch) s = skillMatch[1];
  s = s.replace(/^\//, "");
  s = s.replace(/\(.*$/, "");
  const out = s.trim().toLowerCase();
  return CAPABILITY_SYNONYMS[out] ?? out;
}

/** Strip fenced code blocks, preserving line count — verbatim from R63 (handler:289). */
export function stripCodeFences(body: string): string {
  const lines = body.split("\n");
  const out: string[] = new Array(lines.length);
  let inFence = false;
  let fenceMarker = "";
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const fenceMatch = line.match(/^(\s*)(```+|~~~+)/);
    if (fenceMatch) {
      const marker = fenceMatch[2]![0]!;
      if (!inFence) {
        inFence = true;
        fenceMarker = marker;
        out[i] = "";
        continue;
      }
      if (inFence && marker === fenceMarker) {
        inFence = false;
        fenceMarker = "";
        out[i] = "";
        continue;
      }
    }
    out[i] = inFence ? "" : line;
  }
  return out.join("\n");
}

/** Section locator over a fence-stripped view — verbatim from R63 (handler:321). */
export function extractSection(body: string, name: string): string {
  const stripped = stripCodeFences(body);
  const startRe = new RegExp(`^##\\s+${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "m");
  const startMatch = stripped.match(startRe);
  if (!startMatch || startMatch.index === undefined) return "";
  const afterStart = stripped.slice(startMatch.index + startMatch[0].length);
  const endMatch = afterStart.match(/\n##\s/);
  return endMatch ? afterStart.slice(0, endMatch.index!) : afterStart;
}

/* ───────────────────────── §10.2 grammar ───────────────────────── */

export type Verdict = "SELECT" | "SKIP";

export interface CatalogDisposition {
  id: string;
  verdict: Verdict;
  reason?: string;
  lineNo: number;
  raw: string;
  malformed?: string;
}

export interface CatalogProvenance {
  registryHash: string;
  surfacedRef: string;
  prd: string;
  n: number;
}

export interface CatalogSection {
  found: boolean;
  provenance: CatalogProvenance | null;
  dispositions: CatalogDisposition[];
  abstained: boolean;
}

const ABSTAIN_LINE = "- (none cleared relevance floor)";
const PROVENANCE_RE =
  /^<!--\s*catalog-match:\s*registryHash=([0-9a-f]+)\s+surfacedRef=(\S+)\s+prd=(\S+)\s+n=(\d+)\s*-->$/;
// §10.2 per-line grammar (case-insensitive id amendment 2026-06-25). · = U+00B7, — = U+2014.
const LINE_RE = /^-\s+([A-Za-z0-9][A-Za-z0-9:_/-]*)\s+·\s+(SELECT|SKIP)(?:\s+—\s+(.+))?$/;

function wordCount(s: string): number {
  const t = s.trim();
  return t === "" ? 0 : t.split(/\s+/).length;
}

/** Parse the `## Catalog Match` section. PURE — structural validation only. */
export function parseCatalogMatchSection(body: string): CatalogSection {
  const section = extractSection(body, "Catalog Match");
  if (section === "") return { found: false, provenance: null, dispositions: [], abstained: false };

  const lines = section.split("\n");
  let provenance: CatalogProvenance | null = null;
  let abstained = false;
  const dispositions: CatalogDisposition[] = [];

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i]!.trim();
    if (trimmed === "") continue;
    if (trimmed.startsWith("<!--")) {
      const pm = trimmed.match(PROVENANCE_RE);
      if (pm) provenance = { registryHash: pm[1]!, surfacedRef: pm[2]!, prd: pm[3]!, n: parseInt(pm[4]!, 10) };
      continue;
    }
    if (trimmed === ABSTAIN_LINE) { abstained = true; continue; }
    if (trimmed.startsWith("- ") || trimmed === "-") {
      const m = trimmed.match(LINE_RE);
      if (!m) {
        dispositions.push({ id: "", verdict: "SKIP", lineNo: i + 1, raw: lines[i]!, malformed: "does not match disposition grammar (id · SELECT|SKIP — reason)" });
        continue;
      }
      const id = m[1]!;
      const verdict = m[2] as Verdict;
      const reason = m[3]?.trim();
      let malformed: string | undefined;
      if (verdict === "SKIP") {
        if (!reason) malformed = "SKIP requires a reason";
        else if (wordCount(reason) > 8) malformed = `SKIP reason exceeds 8 words (${wordCount(reason)})`;
      } else if (reason && wordCount(reason) > 8) {
        malformed = `SELECT note exceeds 8 words (${wordCount(reason)})`;
      }
      dispositions.push({ id, verdict, reason, lineNo: i + 1, raw: lines[i]!, malformed });
    }
  }
  return { found: true, provenance, dispositions, abstained };
}

/** Flag dispositions whose normalized id is not a live registry capability (§10.6). PURE. */
export function flagUnknownIds(dispositions: CatalogDisposition[], registryIds: ReadonlySet<string>): CatalogDisposition[] {
  if (registryIds.size === 0) return dispositions; // registry unavailable → skip (degrade, don't false-fail)
  const norm = new Set([...registryIds].map(normalizeCapability));
  return dispositions.map((d) => {
    if (d.malformed || d.id === "") return d;
    if (!norm.has(normalizeCapability(d.id))) return { ...d, malformed: `unknown capability id (not in registry): ${d.id}` };
    return d;
  });
}
