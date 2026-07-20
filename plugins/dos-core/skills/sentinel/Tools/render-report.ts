/**
 * render-report.ts — shared, golden-tested report-rendering primitives used
 * across the Sentinel report-emitting workflows (Scan, Guard, Review, Status,
 * Conformance, MemoryHealth).
 *
 * These exist to kill the single most dangerous output bug in the pack: a
 * DEGRADED run (bridge/inference unavailable → "continue with static data only")
 * rendering IDENTICALLY to a healthy repo — empty findings + a clean health %.
 * Every report opens with a `renderReportHeader` band; any bridge/inference-
 * touching report that is degraded opens with `renderDegradedBanner` so absent
 * findings are never silently read as "clean" (ISC-37/38/43).
 *
 * The existing per-workflow renders (renderGuardReport/renderReviewOutput/
 * renderStatus) are preserved untouched (ISC-A-2); these are NEW siblings.
 */

export interface ReportHeaderInput {
  workflow: string;
  project: string;
  wing: string;
  /** ISO-8601 UTC timestamp — caller passes new Date().toISOString(). */
  utc: string;
  degraded: boolean;
}

/** A one-line provenance band that opens every report class (ISC-43). */
export function renderReportHeader(h: ReportHeaderInput): string {
  const state = h.degraded ? "DEGRADED" : "OK";
  return `── Sentinel ${h.workflow} · ${h.project} · wing ${h.wing} · ${h.utc} · ${state} ──`;
}

/**
 * The degraded banner — rendered VERBATIM at the top of any bridge/inference-
 * touching report when the run could not reach full fidelity (ISC-37/38).
 * `reasons` lists what degraded (e.g. "MemPalace bridge unreachable",
 * "inference unavailable — static data only").
 */
export function renderDegradedBanner(reasons: string[]): string {
  const why = reasons.length ? reasons.join("; ") : "one or more data sources unavailable";
  return [
    "🔴 SENTINEL DEGRADED — this run could not reach full fidelity.",
    `   Cause: ${why}.`,
    "   Findings below are PARTIAL — absent findings do NOT mean 'clean', and the",
    "   health score is NOT comparable to a full scan. Re-run once the source is back.",
  ].join("\n");
}

/**
 * Honest percentage renderer: every headline % shows its denominator, and a
 * degraded/excluded input forces a caveat rather than a bare number (ISC-41).
 * Returns `n/a` when there is nothing to measure.
 */
export function renderPercent(n: number, m: number, opts?: { degraded?: boolean; caveat?: string }): string {
  if (m <= 0) return "n/a (0 of 0)";
  const pct = Math.round((n / m) * 1000) / 10;
  const base = `${pct}% (${n} of ${m})`;
  if (opts?.degraded) return `${base} ⚠️ ${opts.caveat ?? "degraded — partial denominator"}`;
  return opts?.caveat ? `${base} — ${opts.caveat}` : base;
}

export type ConformanceStatus = "pass" | "fail" | "not_applicable";
export interface ConformanceRow {
  rId: string;
  status: ConformanceStatus;
  note?: string;
}

/** Glyph per status — three DISTINCT glyphs so na is never read as pass (ISC-40). */
export function statusGlyph(s: ConformanceStatus): string {
  return s === "pass" ? "✅" : s === "fail" ? "❌" : "⊘";
}

/**
 * The Conformance verdict render (ISC-40): a per-R glyph matrix plus a tallied
 * footer with all three states surfaced (pass / fail / not_applicable).
 */
export function renderConformanceMatrix(rows: ConformanceRow[]): string {
  const pass = rows.filter((r) => r.status === "pass").length;
  const fail = rows.filter((r) => r.status === "fail").length;
  const na = rows.filter((r) => r.status === "not_applicable").length;
  const lines = rows.map(
    (r) => `${statusGlyph(r.status)} ${r.rId}${r.note ? ` — ${r.note}` : ""}`,
  );
  lines.push("");
  lines.push(`✅ ${pass} pass · ❌ ${fail} fail · ⊘ ${na} not_applicable  (${rows.length} checks)`);
  return lines.join("\n");
}
