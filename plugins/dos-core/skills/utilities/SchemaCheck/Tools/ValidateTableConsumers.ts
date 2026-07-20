#!/usr/bin/env bun
/**
 * ValidateTableConsumers — surfaces Prisma query patterns that carry implicit
 * assumptions a data migration might break (distinct, findFirst, groupBy,
 * aggregate methods, and raw SQL referencing the table).
 *
 * Born from a DOS-Studio reconciliation regression: a migration added the FIRST
 * row of a new kind, which silently changed the behavior of a consumer using
 * `findMany({ distinct: ['provider'] })`. The math went from
 *   1400 / 14000 * 100 = 10   (expected)
 * to
 *   1400 / 18000 * 100 = 7.77  (got).
 * Run this BEFORE authoring a migration that adds, removes, or changes rows.
 *
 * CLI:
 *   bun ValidateTableConsumers.ts --table <name> --src-glob <glob> [--json]
 *
 * Exit codes:
 *   0 = no consumers with risky patterns found (review is still advised if any
 *       consumers exist; see Workflow doc).
 *   1 = consumers with implicit-assumption patterns found — informational.
 *   2 = invalid args.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

type Args = { table: string; srcGlob: string; json: boolean };

type PatternHit = {
  method: string;
  line: number;
  flags: string[];
  snippet: string;
};

type ConsumerFile = { file: string; patterns: PatternHit[] };
type RawSqlRef = { file: string; line: number; snippet: string };

const SKIP_DIRS = new Set([
  "node_modules", ".next", "dist", ".git", "build", "coverage",
  ".turbo", ".cache", "generated",
]);
const PRISMA_METHODS = [
  "findMany", "findFirst", "findFirstOrThrow", "findUnique", "findUniqueOrThrow",
  "count", "aggregate", "groupBy", "create", "createMany", "update", "updateMany",
  "upsert", "delete", "deleteMany",
];
const RISKY_METHODS = new Set(["findFirst", "findFirstOrThrow", "groupBy", "aggregate"]);
const RISKY_ARG_KEYWORDS = ["distinct", "_count", "_sum", "_max", "_min", "_avg"];
const LOOKAHEAD_LINES = 15;

function parseArgs(argv: string[]): Args | null {
  const args: Partial<Args> = { json: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--table") args.table = argv[++i];
    else if (a === "--src-glob") args.srcGlob = argv[++i];
    else if (a === "--json") args.json = true;
    else if (a === "--help" || a === "-h") return null;
  }
  if (!args.table || !args.srcGlob) return null;
  return args as Args;
}

function splitGlob(glob: string): { base: string; pattern: string } {
  const abs = resolve(glob);
  const parts = abs.split("/");
  const baseParts: string[] = [];
  for (const p of parts) {
    if (p.includes("*") || p.includes("?") || p.includes("[") || p.includes("{")) break;
    baseParts.push(p);
  }
  const base = baseParts.join("/") || "/";
  const pattern = abs.slice(base.length + (base === "/" ? 0 : 1));
  return { base, pattern: pattern || "**/*" };
}

function globToRegex(pattern: string): RegExp {
  let re = "";
  let i = 0;
  while (i < pattern.length) {
    const c = pattern[i];
    if (c === "*" && pattern[i + 1] === "*") {
      re += ".*"; i += 2;
      if (pattern[i] === "/") i++;
    } else if (c === "*") { re += "[^/]*"; i++; }
    else if (c === "?") { re += "[^/]"; i++; }
    else if (c === "{") {
      const end = pattern.indexOf("}", i);
      if (end === -1) { re += "\\{"; i++; continue; }
      const opts = pattern.slice(i + 1, end).split(",")
        .map((s) => s.replace(/[.+^${}()|[\]\\]/g, "\\$&"));
      re += `(?:${opts.join("|")})`;
      i = end + 1;
    } else if (/[.+^${}()|[\]\\]/.test(c)) { re += `\\${c}`; i++; }
    else { re += c; i++; }
  }
  return new RegExp(`^${re}$`);
}

function walk(base: string, rx: RegExp): string[] {
  const out: string[] = [];
  const stack: string[] = [base];
  while (stack.length) {
    const dir = stack.pop()!;
    let entries;
    try { entries = readdirSync(dir); } catch { continue; }
    for (const name of entries) {
      if (SKIP_DIRS.has(name)) continue;
      const full = join(dir, name);
      let st;
      try { st = statSync(full); } catch { continue; }
      if (st.isDirectory()) stack.push(full);
      else if (st.isFile()) {
        const rel = relative(base, full);
        if (rx.test(rel)) out.push(full);
      }
    }
  }
  return out;
}

function escapeForRegex(s: string): string {
  return s.replace(/[.+^${}()|[\]\\*?]/g, "\\$&");
}

function trimSnippet(raw: string, max = 80): string {
  const flat = raw.replace(/\s+/g, " ").trim();
  return flat.length > max ? flat.slice(0, max - 1) + "…" : flat;
}

/** Pull the argument block of a single call: everything between the opening
 * '(' (already consumed) and its matching ')'. Bounded by LOOKAHEAD_LINES so
 * a syntactically invalid file can't run away. String and template literals
 * are tracked so parens inside them don't confuse the depth counter. */
function argBlock(content: string, startCharIdx: number, lines: string[], startLine: number): string {
  // Scan forward in the full content from startCharIdx until the call's
  // matching ')'. We start at paren-depth = 1 because the opening '(' was
  // already consumed by the regex.
  let depth = 1;
  let i = startCharIdx;
  const maxChar = content.length;
  // Cap the scan at LOOKAHEAD_LINES past startLine so runaway never happens.
  let linesSeen = 0;
  let inStr: '"' | "'" | "`" | null = null;
  let inLineComment = false;
  let inBlockComment = false;
  while (i < maxChar) {
    const c = content[i];
    const n = content[i + 1];
    if (inLineComment) {
      if (c === "\n") { inLineComment = false; linesSeen++; if (linesSeen >= LOOKAHEAD_LINES) break; }
      i++; continue;
    }
    if (inBlockComment) {
      if (c === "*" && n === "/") { inBlockComment = false; i += 2; continue; }
      if (c === "\n") { linesSeen++; if (linesSeen >= LOOKAHEAD_LINES) break; }
      i++; continue;
    }
    if (inStr) {
      if (c === "\\") { i += 2; continue; }
      if (c === inStr) { inStr = null; i++; continue; }
      if (c === "\n") { linesSeen++; if (linesSeen >= LOOKAHEAD_LINES) break; }
      i++; continue;
    }
    if (c === "/" && n === "/") { inLineComment = true; i += 2; continue; }
    if (c === "/" && n === "*") { inBlockComment = true; i += 2; continue; }
    if (c === '"' || c === "'" || c === "`") { inStr = c; i++; continue; }
    if (c === "(") { depth++; i++; continue; }
    if (c === ")") { depth--; if (depth === 0) { i++; break; } i++; continue; }
    if (c === "\n") { linesSeen++; if (linesSeen >= LOOKAHEAD_LINES) break; }
    i++;
  }
  return content.slice(startCharIdx, i);
}

function detectRiskyFlags(block: string): string[] {
  const flags: string[] = [];
  for (const kw of RISKY_ARG_KEYWORDS) {
    // Word-boundary-ish: keyword followed by ':' or whitespace+':'
    const rx = new RegExp(`(^|[^A-Za-z0-9_])${escapeForRegex(kw)}\\s*:`, "m");
    if (rx.test(block)) flags.push(kw);
  }
  return flags;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args) {
    console.error("Usage: bun ValidateTableConsumers.ts --table <name> --src-glob <glob> [--json]");
    process.exit(2);
  }

  const { base, pattern } = splitGlob(args.srcGlob);
  const rx = globToRegex(pattern);
  const files = walk(base, rx);

  const methodAlternation = PRISMA_METHODS.map(escapeForRegex).join("|");
  // Match `<prefix>.<table>.<method>(`
  const prismaCallRx = new RegExp(
    `\\b([A-Za-z_][A-Za-z0-9_]*)\\.${escapeForRegex(args.table)}\\.(${methodAlternation})\\s*\\(`,
    "g",
  );
  const rawSqlRx = /\$(?:queryRaw|executeRaw|queryRawUnsafe|executeRawUnsafe)\b/g;
  const tableInSqlRx = new RegExp(`\\b${escapeForRegex(args.table)}\\b`, "i");

  const consumersMap = new Map<string, PatternHit[]>();
  const rawSqlRefs: RawSqlRef[] = [];

  for (const file of files) {
    let content: string;
    try { content = readFileSync(file, "utf8"); } catch { continue; }
    const lines = content.split("\n");

    // Family A — Prisma client queries
    prismaCallRx.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = prismaCallRx.exec(content)) !== null) {
      const method = m[2];
      const absIdx = m.index + m[0].length; // position just past the '('
      const before = content.slice(0, m.index);
      const lineIdx = (before.match(/\n/g) || []).length; // 0-based

      const block = argBlock(content, absIdx, lines, lineIdx);
      const flags: string[] = [];
      if (RISKY_METHODS.has(method)) flags.push(method);
      const argFlags = detectRiskyFlags(block);
      for (const f of argFlags) if (!flags.includes(f)) flags.push(f);

      if (flags.length === 0) continue; // safe pattern, skip

      const rawLine = lines[lineIdx] ?? "";
      const snippet = trimSnippet(rawLine);
      const hit: PatternHit = { method, line: lineIdx + 1, flags, snippet };
      if (!consumersMap.has(file)) consumersMap.set(file, []);
      consumersMap.get(file)!.push(hit);
    }

    // Family B — Raw SQL references
    rawSqlRx.lastIndex = 0;
    let r: RegExpExecArray | null;
    while ((r = rawSqlRx.exec(content)) !== null) {
      const before = content.slice(0, r.index);
      const lineIdx = (before.match(/\n/g) || []).length;
      // Inspect this line + next 2 lines for the table name
      const window = lines.slice(lineIdx, lineIdx + 3).join("\n");
      if (tableInSqlRx.test(window)) {
        rawSqlRefs.push({
          file,
          line: lineIdx + 1,
          snippet: trimSnippet(lines[lineIdx] ?? ""),
        });
      }
    }
  }

  const consumers: ConsumerFile[] = [...consumersMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([file, patterns]) => ({ file, patterns: patterns.sort((a, b) => a.line - b.line) }));

  const totalPatterns = consumers.reduce((n, c) => n + c.patterns.length, 0);
  const flagCounts: Record<string, number> = {};
  for (const c of consumers) for (const p of c.patterns)
    for (const f of p.flags) flagCounts[f] = (flagCounts[f] || 0) + 1;

  const ok = consumers.length === 0 && rawSqlRefs.length === 0;
  const topFlags = Object.entries(flagCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([f]) => f)
    .slice(0, 3);
  const summary = consumers.length === 0 && rawSqlRefs.length === 0
    ? `no risky consumers found for ${args.table}`
    : `${consumers.length} consumer file${consumers.length === 1 ? "" : "s"}, ${totalPatterns} risky pattern${totalPatterns === 1 ? "" : "s"}${topFlags.length ? ` (${topFlags.join(", ")})` : ""}${rawSqlRefs.length ? `, ${rawSqlRefs.length} raw-SQL ref${rawSqlRefs.length === 1 ? "" : "s"}` : ""}`;

  const report = {
    validator: "ValidateTableConsumers",
    ok,
    table: args.table,
    consumers,
    raw_sql_references: rawSqlRefs,
    summary,
  };

  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`ValidateTableConsumers: ${ok ? "OK" : "REVIEW"} — ${summary}`);
    for (const c of consumers) {
      console.log(`  ${c.file}`);
      for (const p of c.patterns) {
        console.log(`    L${p.line}  ${p.method}  [${p.flags.join(", ")}]  ${p.snippet}`);
      }
    }
    if (rawSqlRefs.length) {
      console.log("  raw SQL references:");
      for (const r of rawSqlRefs) console.log(`    ${r.file}:${r.line}  ${r.snippet}`);
    }
  }

  process.exit(ok ? 0 : 1);
}

main();
