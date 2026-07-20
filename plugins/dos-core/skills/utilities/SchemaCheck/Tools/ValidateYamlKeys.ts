#!/usr/bin/env bun
/**
 * ValidateYamlKeys — detects duplicate keys at any nesting level in a YAML file.
 *
 * CLI:
 *   bun ValidateYamlKeys.ts <yaml-file>          Pretty output
 *   bun ValidateYamlKeys.ts <yaml-file> --json   JSON output
 *
 * Exit codes: 0 clean, 1 duplicates found, 2 invalid args / file missing.
 */
import { parseDocument, isPair, isScalar, LineCounter, visit } from "yaml";
import { readFileSync, existsSync } from "node:fs";

type Occurrence = { line: number };
type Violation = { key: string; occurrences: Occurrence[] };
type Result = {
  validator: "ValidateYamlKeys";
  ok: boolean;
  violations: Violation[];
  summary: string;
};

function usage(): never {
  console.error("usage: bun ValidateYamlKeys.ts <yaml-file> [--json]");
  process.exit(2);
}

function main(): void {
  const args = process.argv.slice(2);
  if (args.length < 1 || args.length > 2) usage();
  const file = args[0];
  const jsonMode = args.includes("--json");
  if (!file || file.startsWith("--")) usage();
  if (!existsSync(file)) {
    console.error(`error: file not found: ${file}`);
    process.exit(2);
  }

  const src = readFileSync(file, "utf8");
  const lc = new LineCounter();
  let doc;
  try {
    doc = parseDocument(src, { uniqueKeys: false, lineCounter: lc });
  } catch (err) {
    console.error(`error: failed to parse YAML: ${(err as Error).message}`);
    process.exit(2);
  }

  const violations: Violation[] = [];

  visit(doc, {
    Map(_k, node, path) {
      // Build dot-notation ancestor key path from enclosing Pair nodes.
      const ancestors: string[] = [];
      for (const anc of path) {
        if (isPair(anc) && isScalar(anc.key)) {
          ancestors.push(String(anc.key.value));
        }
      }
      const seen = new Map<string, Occurrence[]>();
      for (const pair of node.items) {
        if (!isPair(pair) || !isScalar(pair.key)) continue;
        const keyStr = String(pair.key.value);
        const range = pair.key.range;
        const line = range ? lc.linePos(range[0]).line : 0;
        const arr = seen.get(keyStr) ?? [];
        arr.push({ line });
        seen.set(keyStr, arr);
      }
      for (const [keyStr, occ] of seen) {
        if (occ.length > 1) {
          const dotted = [...ancestors, keyStr].join(".");
          violations.push({ key: dotted, occurrences: occ });
        }
      }
    },
  });

  const totalOccurrences = violations.reduce((n, v) => n + v.occurrences.length, 0);
  const summary = violations.length === 0
    ? "No duplicate keys found"
    : `${violations.length} duplicate key${violations.length === 1 ? "" : "s"} found across ${totalOccurrences} occurrences`;

  const result: Result = {
    validator: "ValidateYamlKeys",
    ok: violations.length === 0,
    violations,
    summary,
  };

  if (jsonMode) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    if (result.ok) {
      console.log(`OK  ${file}`);
      console.log(summary);
    } else {
      console.log(`FAIL  ${file}`);
      for (const v of violations) {
        const lines = v.occurrences.map(o => `line ${o.line}`).join(", ");
        console.log(`  - ${v.key}  (${lines})`);
      }
      console.log(summary);
    }
  }

  process.exit(result.ok ? 0 : 1);
}

main();
