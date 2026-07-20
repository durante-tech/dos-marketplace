#!/usr/bin/env bun
/**
 * ValidateI18nCoverage — detects i18n key drift between registry and code.
 *
 * Reports:
 *   - missing_in_registry: keys used in code but absent from the registry
 *   - orphans_in_registry: keys present in registry but never referenced in code
 *
 * CLI:
 *   bun ValidateI18nCoverage.ts --registry <path> --src-glob <glob> [--call-pattern <regex>] [--json]
 *
 * Exit codes: 0 = clean, 1 = gaps found, 2 = invalid args.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

type Args = {
  registry: string;
  srcGlob: string;
  callPattern: string;
  json: boolean;
};

const SKIP_DIRS = new Set(["node_modules", ".next", "dist", ".git", "build", "coverage", ".turbo", ".cache"]);
// Match `t('key'` without requiring a closing `)`, so interpolated calls like
// t('key', { opts }) are visible too (UTIL-03). The captured key is group 1.
const DEFAULT_CALL_PATTERN = "t\\(['\"`]([^'\"`]+)['\"`]";

function parseArgs(argv: string[]): Args | null {
  const args: Partial<Args> = { callPattern: DEFAULT_CALL_PATTERN, json: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--registry") args.registry = argv[++i];
    else if (a === "--src-glob") args.srcGlob = argv[++i];
    else if (a === "--call-pattern") args.callPattern = argv[++i];
    else if (a === "--json") args.json = true;
    else if (a === "--help" || a === "-h") return null;
  }
  if (!args.registry || !args.srcGlob) return null;
  return args as Args;
}

function flattenKeys(obj: unknown, prefix = ""): string[] {
  if (obj === null || typeof obj !== "object") return prefix ? [prefix] : [];
  const out: string[] = [];
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      out.push(...flattenKeys(v, path));
    } else {
      out.push(path);
    }
  }
  return out;
}

/** Split glob into base directory and pattern; naive but sufficient for our use. */
function splitGlob(glob: string): { base: string; pattern: string } {
  const abs = resolve(glob);
  // Find first segment containing a glob char
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

/** Convert a glob pattern to a RegExp. Supports **, *, ?, and basic {a,b}. */
function globToRegex(pattern: string): RegExp {
  let re = "";
  let i = 0;
  while (i < pattern.length) {
    const c = pattern[i];
    if (c === "*" && pattern[i + 1] === "*") {
      re += ".*";
      i += 2;
      if (pattern[i] === "/") i++;
    } else if (c === "*") {
      re += "[^/]*";
      i++;
    } else if (c === "?") {
      re += "[^/]";
      i++;
    } else if (c === "{") {
      const end = pattern.indexOf("}", i);
      if (end === -1) { re += "\\{"; i++; continue; }
      const opts = pattern.slice(i + 1, end).split(",").map((s) => s.replace(/[.+^${}()|[\]\\]/g, "\\$&"));
      re += `(?:${opts.join("|")})`;
      i = end + 1;
    } else if (/[.+^${}()|[\]\\]/.test(c)) {
      re += `\\${c}`;
      i++;
    } else {
      re += c;
      i++;
    }
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

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args) {
    console.error("Usage: bun ValidateI18nCoverage.ts --registry <path> --src-glob <glob> [--call-pattern <regex>] [--json]");
    process.exit(2);
  }

  let registryRaw: string;
  try { registryRaw = readFileSync(args.registry, "utf8"); }
  catch (e: any) { console.error(`Cannot read registry: ${e.message}`); process.exit(2); }

  let registryJson: unknown;
  try { registryJson = JSON.parse(registryRaw); }
  catch (e: any) { console.error(`Registry is not valid JSON: ${e.message}`); process.exit(2); }

  const registryKeys = new Set(flattenKeys(registryJson));

  const { base, pattern } = splitGlob(args.srcGlob);
  const rx = globToRegex(pattern);
  const files = walk(base, rx);

  let callRx: RegExp;
  try { callRx = new RegExp(args.callPattern, "g"); }
  catch (e: any) { console.error(`Invalid --call-pattern regex: ${e.message}`); process.exit(2); }

  const codeKeyFiles = new Map<string, Set<string>>(); // key -> set of files
  for (const file of files) {
    let content: string;
    try { content = readFileSync(file, "utf8"); } catch { continue; }
    callRx.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = callRx.exec(content)) !== null) {
      const key = m[1];
      if (!key) continue;
      if (!codeKeyFiles.has(key)) codeKeyFiles.set(key, new Set());
      codeKeyFiles.get(key)!.add(file);
    }
  }

  const codeKeys = new Set(codeKeyFiles.keys());
  const missing: { key: string; files: string[] }[] = [];
  for (const k of [...codeKeys].sort()) {
    if (!registryKeys.has(k)) missing.push({ key: k, files: [...codeKeyFiles.get(k)!].sort() });
  }
  const orphans: { key: string }[] = [];
  for (const k of [...registryKeys].sort()) {
    if (!codeKeys.has(k)) orphans.push({ key: k });
  }

  const ok = missing.length === 0 && orphans.length === 0;
  const summary = `${missing.length} missing keys, ${orphans.length} orphan keys`;
  const report = {
    validator: "ValidateI18nCoverage",
    ok,
    missing_in_registry: missing,
    orphans_in_registry: orphans,
    summary,
  };

  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`ValidateI18nCoverage: ${ok ? "OK" : "GAPS"} — ${summary}`);
    if (missing.length) {
      console.log("Missing in registry:");
      for (const m of missing) console.log(`  - ${m.key}  (${m.files.length} file${m.files.length === 1 ? "" : "s"})`);
    }
    if (orphans.length) {
      console.log("Orphan in registry:");
      for (const o of orphans) console.log(`  - ${o.key}`);
    }
  }

  process.exit(ok ? 0 : 1);
}

main();
