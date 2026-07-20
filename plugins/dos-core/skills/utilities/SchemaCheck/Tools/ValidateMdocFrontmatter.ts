#!/usr/bin/env bun
/**
 * ValidateMdocFrontmatter — SchemaCheck pack
 *
 * MVP scope: validates that .mdoc/.md files declare all required YAML
 * frontmatter keys AND that each required key has a non-empty value.
 * No type/schema validation — that is future work (ajv/zod).
 *
 * CLI:
 *   bun Tools/ValidateMdocFrontmatter.ts \
 *     --files '<glob>' --required <csv> [--json]
 *
 * Exit codes: 0 ok · 1 violations · 2 invalid args.
 */
import { parse as parseYaml } from "yaml";
import { readFileSync, statSync } from "node:fs";

type Violation = { file: string; missing: string[]; empty: string[] };
type Result = {
  validator: "ValidateMdocFrontmatter";
  ok: boolean;
  violations: Violation[];
  summary: string;
};

function parseArgs(argv: string[]): { files?: string; required?: string; json: boolean } {
  const out: { files?: string; required?: string; json: boolean } = { json: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--files") out.files = argv[++i];
    else if (a === "--required") out.required = argv[++i];
    else if (a === "--json") out.json = true;
  }
  return out;
}

function isEmpty(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === "string") return v.trim() === "";
  if (Array.isArray(v)) return v.length === 0;
  return false;
}

function extractFrontmatter(src: string): Record<string, unknown> | null {
  // Frontmatter MUST start at file byte 0 with `---\n` (or `---\r\n`).
  if (!/^---\r?\n/.test(src)) return null;
  const rest = src.replace(/^---\r?\n/, "");
  const m = rest.match(/^([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return null;
  const block = m[1];
  try {
    const doc = parseYaml(block);
    return doc && typeof doc === "object" && !Array.isArray(doc)
      ? (doc as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

async function resolveGlob(glob: string): Promise<string[]> {
  // Bun >= 1.x ships `Bun.Glob`. Scan from cwd so the contract matches other tools.
  // Anchor absolute globs at their first non-magic prefix so `Bun.Glob` works.
  const abs = glob.startsWith("/");
  if (abs) {
    const firstMagic = glob.search(/[*?[]/);
    const cut = firstMagic === -1 ? glob.lastIndexOf("/") + 1 : glob.lastIndexOf("/", firstMagic) + 1;
    const root = glob.slice(0, cut) || "/";
    const pat = glob.slice(cut);
    const g = new Bun.Glob(pat);
    const out: string[] = [];
    for await (const f of g.scan({ cwd: root, onlyFiles: true, absolute: true })) out.push(f);
    return out;
  }
  const g = new Bun.Glob(glob);
  const out: string[] = [];
  for await (const f of g.scan({ cwd: process.cwd(), onlyFiles: true, absolute: true })) out.push(f);
  return out;
}

async function main(): Promise<number> {
  const { files, required, json } = parseArgs(process.argv.slice(2));
  if (!files || !required) {
    process.stderr.write(
      "usage: bun Tools/ValidateMdocFrontmatter.ts --files <glob> --required <csv> [--json]\n",
    );
    return 2;
  }
  const requiredFields = required.split(",").map((s) => s.trim()).filter(Boolean);
  if (requiredFields.length === 0) {
    process.stderr.write("error: --required must list at least one field\n");
    return 2;
  }

  const matches = await resolveGlob(files);
  const violations: Violation[] = [];

  for (const file of matches) {
    try {
      if (!statSync(file).isFile()) continue;
    } catch {
      continue;
    }
    const src = readFileSync(file, "utf8");
    const fm = extractFrontmatter(src);
    const missing: string[] = [];
    const empty: string[] = [];
    if (fm === null) {
      // No frontmatter → every required field is missing.
      missing.push(...requiredFields);
    } else {
      for (const key of requiredFields) {
        if (!(key in fm)) missing.push(key);
        else if (isEmpty(fm[key])) empty.push(key);
      }
    }
    if (missing.length || empty.length) violations.push({ file, missing, empty });
  }

  const fieldsHit = violations.reduce((n, v) => n + v.missing.length + v.empty.length, 0);
  const summary =
    violations.length === 0
      ? `0 violations across ${matches.length} file${matches.length === 1 ? "" : "s"}`
      : `${violations.length} file${violations.length === 1 ? "" : "s"} with violations across ${fieldsHit} field${fieldsHit === 1 ? "" : "s"}`;
  const result: Result = {
    validator: "ValidateMdocFrontmatter",
    ok: violations.length === 0,
    violations,
    summary,
  };

  if (json) {
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  } else {
    process.stdout.write(`${result.ok ? "PASS" : "FAIL"} — ${summary}\n`);
    for (const v of violations) {
      process.stdout.write(`  ${v.file}\n`);
      if (v.missing.length) process.stdout.write(`    missing: ${v.missing.join(", ")}\n`);
      if (v.empty.length) process.stdout.write(`    empty:   ${v.empty.join(", ")}\n`);
    }
  }
  return result.ok ? 0 : 1;
}

if (import.meta.main) {
  main().then((code) => process.exit(code));
}

export { extractFrontmatter, isEmpty, resolveGlob, main };
