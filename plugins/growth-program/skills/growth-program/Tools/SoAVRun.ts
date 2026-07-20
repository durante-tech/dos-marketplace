#!/usr/bin/env bun
/**
 * SoAVRun.ts — Share-of-AI-Voice harness for the GrowthProgram Measurement phase.
 *
 * It does NOT call the AI engines — the Q* run is operator-time across logged-out sessions (per the
 * Measurement playbook). It scaffolds the results log and scores the FILLED log. Never invents data.
 *
 *   bun SoAVRun.ts --scaffold --basket <query-basket.md|.jsonl> [--engines a,b,c] [--out soav-results.jsonl]
 *       → one row per (Q* × engine) for the operator to fill from logged-out runs.
 *   bun SoAVRun.ts --score <soav-results.jsonl>
 *       → deterministic scoreboard: presence %, citation %, blended SoAV %, per engine.
 *
 * Exit: 0 ok · 2 bad args / no data.
 */
import { writeFileSync, existsSync, readFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const argv = process.argv.slice(2);
const arg = (f: string, d = ""): string => {
  const i = argv.indexOf(f);
  return i >= 0 && argv[i + 1] ? argv[i + 1]! : d;
};
const DEFAULT_ENGINES = arg("--engines", "chatgpt,perplexity,gemini,claude,le_chat")
  .split(",").map((s) => s.trim()).filter(Boolean);
const num = (v: unknown): number => (typeof v === "number" ? v : Number(v));

function parseBasket(path: string): Array<{ q_id: string; query: string; locale: string; engines: string[] }> {
  const raw = readFileSync(path, "utf8");
  if (path.endsWith(".json") || path.endsWith(".jsonl")) {
    // Normalize each row to the declared shape. A JSONL row may omit `engines`
    // (or give it as a comma-string); without this, `q.engines.length` in --scaffold
    // throws on such a row instead of falling back to --engines defaults the way
    // markdown baskets do.
    return raw.trim().split("\n").filter(Boolean).map((l) => {
      const r = JSON.parse(l);
      const engines = Array.isArray(r.engines)
        ? r.engines.map((s: unknown) => String(s).trim()).filter(Boolean)
        : typeof r.engines === "string"
          ? r.engines.split(",").map((s: string) => s.trim()).filter(Boolean)
          : [];
      return { q_id: r.q_id, query: r.query || "", locale: r.locale || "en", engines };
    });
  }
  // Markdown table — resolve columns by HEADER NAME, not fixed position, so the
  // parser tolerates column order/count and never misreads a taxonomy column
  // (e.g. Category) as engines (issue #69). The basket's authoritative schema is
  // `ID | Query | Lang | Intent | Category` (GeoPillar "How this basket works");
  // a trailing `Engines` column is optional. Recognized headers (case-insensitive):
  //   q_id    ← "id"             (fallback: first cell matching /^Q\d+$/, else col 0)
  //   query   ← "query"         (fallback: col 1)
  //   locale  ← "locale"|"lang" (fallback: col 2)
  //   engines ← "engines"       (absent → [] → DEFAULT_ENGINES, matching the
  //                              run-protocol "every query × the engine set" design)
  const lines = raw.split("\n");
  const splitRow = (l: string) => l.replace(/^\s*\|/, "").replace(/\|\s*$/, "").split("|").map((x) => x.trim());
  const isSep = (cs: string[]) => cs.length > 0 && cs.every((x) => /^:?-+:?$/.test(x));
  // Header = first table row that names a Query column (skip the |---| separator).
  let header: string[] | null = null;
  for (const l of lines) {
    if (!/^\s*\|/.test(l)) continue;
    const cs = splitRow(l);
    if (isSep(cs)) continue;
    if (cs.some((h) => /^query$/i.test(h))) { header = cs; break; }
  }
  const col = (re: RegExp, dflt = -1): number => (header ? header.findIndex((h) => re.test(h)) : dflt);
  const iId = col(/^id$/i);
  const iQuery = col(/^query$/i, 1);
  const iLocale = col(/^(locale|lang)$/i, 2);
  const iEngines = col(/^engines?$/i); // -1 when absent → fall back to DEFAULT_ENGINES
  const rows: Array<{ q_id: string; query: string; locale: string; engines: string[] }> = [];
  for (const line of lines) {
    if (!/^\s*\|\s*Q\d+\s*\|/.test(line)) continue;
    const c = splitRow(line);
    const qId = (iId >= 0 ? c[iId] : c.find((x) => /^Q\d+$/.test(x))) || c[0] || "";
    rows.push({
      q_id: qId,
      query: (iQuery >= 0 ? c[iQuery] : c[1]) || "",
      locale: (iLocale >= 0 ? c[iLocale] : c[2]) || "en",
      engines: iEngines >= 0
        ? (c[iEngines] || "").split(",").map((s) => s.trim()).filter(Boolean)
        : [],
    });
  }
  return rows;
}

if (argv.includes("--scaffold")) {
  const basket = arg("--basket");
  const out = arg("--out", "soav-results.jsonl");
  if (!basket || !existsSync(basket)) { console.error("error: --basket <file> required"); process.exit(2); }
  const qs = parseBasket(basket);
  if (!qs.length) { console.error("error: no Q* rows found in basket"); process.exit(2); }
  let lines = "", n = 0;
  for (const q of qs) for (const engine of (q.engines.length ? q.engines : DEFAULT_ENGINES)) {
    lines += JSON.stringify({
      q_id: q.q_id, query: q.query, locale: q.locale, engine,
      present: null, rank: null, sentiment: null, cited: null, total_brands: null, source: "", snippet: "",
    }) + "\n"; n++;
  }
  mkdirSync(dirname(out) || ".", { recursive: true });
  // writeArtifact:exempt — emits an operator-fillable results log (filled offline from logged-out runs), not a tracked DOS artifact
  writeFileSync(out, lines);
  console.log(`scaffolded ${n} rows (${qs.length} queries × engines) → ${out}`);
  console.log(`fill present(0/1) rank sentiment cited(0/1) total_brands source snippet from logged-out runs, then:`);
  console.log(`  bun SoAVRun.ts --score ${out}`);
  process.exit(0);
}

const scoreFile = arg("--score");
if (scoreFile) {
  if (!existsSync(scoreFile)) { console.error("error: results file not found"); process.exit(2); }
  const rows = readFileSync(scoreFile, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));
  const filled = rows.filter((r) => r.present !== null && r.present !== "");
  if (!filled.length) { console.error("error: no filled rows (present is null) — fill the log first"); process.exit(2); }
  // SoAV per row = 1 / distinct brands named — ONLY when present AND a valid brand
  // count is recorded. A present mention with no/zero total_brands is NOT 100%:
  // its share is uncomputable, so it returns null and is excluded from the SoAV
  // average (it still counts toward presence). Defaulting to 1 overstated SoAV.
  const soav = (r: any): number | null => {
    if (num(r.present) !== 1) return 0; // not present → known 0 share
    const tb = num(r.total_brands);
    return Number.isFinite(tb) && tb >= 1 ? 1 / tb : null; // present-but-no-brand-count → uncomputable
  };
  const agg = (rs: any[]) => {
    const soavVals = rs.map(soav).filter((v): v is number => v !== null);
    const excluded = rs.length - soavVals.length;
    return {
      n: rs.length,
      presence: ((rs.filter((r) => num(r.present) === 1).length / rs.length) * 100).toFixed(0) + "%",
      citation: ((rs.filter((r) => num(r.cited) === 1).length / rs.length) * 100).toFixed(0) + "%",
      soav: soavVals.length
        ? ((soavVals.reduce((a, v) => a + v, 0) / soavVals.length) * 100).toFixed(1) + "%" + (excluded ? `*` : "")
        : "n/a",
    };
  };
  const engines = [...new Set(filled.map((r) => r.engine))];
  console.log(`Share-of-AI-Voice scoreboard (${filled.length} filled obs)\n`);
  console.log(`${"engine".padEnd(13)}  n   presence  citation   SoAV`);
  for (const e of engines) {
    const a = agg(filled.filter((r) => r.engine === e));
    console.log(`${e.padEnd(13)} ${String(a.n).padStart(2)}   ${a.presence.padStart(7)}   ${a.citation.padStart(7)}  ${a.soav.padStart(6)}`);
  }
  const b = agg(filled);
  console.log(`${"BLENDED".padEnd(13)} ${String(b.n).padStart(2)}   ${b.presence.padStart(7)}   ${b.citation.padStart(7)}  ${b.soav.padStart(6)}`);
  const excludedTotal = filled.filter(
    (r) => num(r.present) === 1 && !(Number.isFinite(num(r.total_brands)) && num(r.total_brands) >= 1),
  ).length;
  if (excludedTotal) console.log(`\n* ${excludedTotal} present row(s) excluded from SoAV — missing total_brands; fill it to score their share`);
  process.exit(0);
}

console.error("usage:\n  SoAVRun.ts --scaffold --basket <query-basket.md|.jsonl> [--engines a,b,c] [--out soav-results.jsonl]\n  SoAVRun.ts --score <soav-results.jsonl>");
process.exit(2);
