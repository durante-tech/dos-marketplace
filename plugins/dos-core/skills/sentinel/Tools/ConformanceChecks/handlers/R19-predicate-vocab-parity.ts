/**
 * R19 (RFC-0059) — Every distinct KG predicate is in PREDICATES.md canonical
 * or alias map.
 *
 * Queries the MemPalace KG sqlite3 database for all distinct predicate values
 * used in the `triples` table, then checks each against the canonical predicate
 * list in PREDICATES.md. Any predicate not present in the canonical set or its
 * declared alias map is flagged as a vocabulary violation.
 *
 * This is a dynamic/live-only check: it requires both the KG database and
 * PREDICATES.md to be present. Missing either returns `not_applicable`.
 *
 * Vocabulary parity prevents graph fragmentation — e.g., `built_on` vs
 * `built_with` encoding the same relationship. Unchecked drift was surfaced by
 * the 2026-04-25 acceptance battery (197 distinct predicates with 8+ near-
 * duplicate clusters across 2075 triples).
 *
 * Note on R-id namespace: RFC-0028 registered R19 (frozen-release-invariant,
 * check key `presence.frozen-release-invariant`). This handler uses the distinct
 * check key `presence.predicate-vocab-parity` (RFC-0059 §13.1). Both coexist.
 *
 * KG path resolution (first found):
 *   1. $HOME/.claude/MEMORY/MEMPALACE/knowledge_graph.sqlite3
 *   2. $HOME/.claude/MEMORY/MEMPALACE/knowledge_graph.db
 *
 * PREDICATES.md path resolution (first found):
 *   1. ctx.packRoot + /PREDICATES.md
 *   2. $HOME/.claude/skills/mem-palace/PREDICATES.md
 *   3. $HOME/Durante/Packs/mem-palace/src/PREDICATES.md
 */

import { existsSync, readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import type { CheckContext, CheckResult } from "../types.ts";

const REQUIREMENT =
  "Every distinct KG predicate must be in PREDICATES.md canonical or alias map";

interface Triple {
  predicate: string;
}

/** Resolve KG sqlite path. Returns first found path, or null. */
function resolveKgPath(): string | null {
  const home = homedir();
  const candidates = [
    join(home, ".claude", "MEMORY", "MEMPALACE", "knowledge_graph.sqlite3"),
    join(home, ".claude", "MEMORY", "MEMPALACE", "knowledge_graph.db"),
  ];
  return candidates.find((p) => existsSync(p)) ?? null;
}

/** Resolve PREDICATES.md path. Returns first found, or null. */
function resolvePredicatesPath(ctx: CheckContext): string | null {
  const home = homedir();
  const candidates = [
    ctx.packRoot ? join(ctx.packRoot, "PREDICATES.md") : null,
    join(home, ".claude", "skills", "mem-palace", "PREDICATES.md"),
    join(home, "Durante", "Packs", "mem-palace", "src", "PREDICATES.md"),
  ].filter(Boolean) as string[];
  return candidates.find((p) => existsSync(p)) ?? null;
}

/**
 * Parse PREDICATES.md for canonical predicate names and their aliases.
 * Extracts snake_case identifiers from table rows and bold headings.
 * Returns a Set of all known predicates (canonical + alias).
 */
function parsePredicatesFile(content: string): Set<string> {
  const known = new Set<string>();
  // Match snake_case-or-dotted words in table rows (| `predicate_name` | or | predicate_name |
  // or | `predicate_name.value` |). Dots accepted for version-suffixed predicates
  // like `points_to_v0.0.8` that occur in the live KG.
  const tableRe = /\|\s*`?([a-z][a-z0-9_.]*)`?\s*\|/g;
  let m: RegExpExecArray | null;
  while ((m = tableRe.exec(content)) !== null) {
    const word = m[1];
    // Accept any token >= 4 chars OR containing _ OR . (so `uses` and
    // `points_to_v0.0.8` both register, narrative words like `is`/`to`
    // stay excluded).
    if (word.includes("_") || word.includes(".") || word.length >= 4) {
      known.add(word);
    }
  }
  // Also match bold `**predicate_name**` patterns
  const boldRe = /\*\*([a-z][a-z0-9_]+)\*\*/g;
  while ((m = boldRe.exec(content)) !== null) {
    if (m[1].includes("_")) known.add(m[1]);
  }
  // Also match JSON-string keys in fenced ```json``` blocks (alias map in §2 is
  // a JSON object; the table-regex misses it because the cells aren't pipe-
  // separated). Accepts "predicate_name": as a key.
  const jsonKeyRe = /"([a-z][a-z0-9_.]*)"\s*:/g;
  while ((m = jsonKeyRe.exec(content)) !== null) {
    const word = m[1];
    if (word.includes("_") || word.includes(".") || word.length >= 4) {
      known.add(word);
    }
  }
  return known;
}

export async function r19PredicateVocabParity(ctx: CheckContext): Promise<CheckResult> {
  const kgPath = resolveKgPath();

  if (!kgPath) {
    return {
      rId: "R19-RFC0059",
      requirement: REQUIREMENT,
      status: "not_applicable",
      evidence: [
        "KG sqlite3 database not found — MemPalace not initialised or KG path unknown",
      ],
    };
  }

  const predicatesPath = resolvePredicatesPath(ctx);

  if (!predicatesPath) {
    return {
      rId: "R19-RFC0059",
      requirement: REQUIREMENT,
      status: "not_applicable",
      evidence: [
        "PREDICATES.md not found at any of: ctx.packRoot, ~/.claude/skills/mem-palace/, ~/Durante/Packs/mem-palace/src/",
      ],
    };
  }

  // --- Parse PREDICATES.md ---
  let predicatesContent: string;
  try {
    predicatesContent = readFileSync(predicatesPath, "utf-8");
  } catch (err) {
    return {
      rId: "R19-RFC0059",
      requirement: REQUIREMENT,
      status: "fail",
      evidence: [
        `Failed to read ${predicatesPath}: ${err instanceof Error ? err.message : String(err)}`,
      ],
    };
  }

  const knownPredicates = parsePredicatesFile(predicatesContent);

  if (knownPredicates.size === 0) {
    return {
      rId: "R19-RFC0059",
      requirement: REQUIREMENT,
      status: "fail",
      evidence: [
        `${predicatesPath}: could not extract any canonical predicates — PREDICATES.md may be malformed`,
      ],
    };
  }

  // --- Query KG for distinct predicates ---
  let distinctPredicates: string[];
  try {
    // Dynamic import of bun:sqlite (Bun built-in — available at runtime, not in tsc types).
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore bun:sqlite is a Bun built-in; tsc does not resolve it but Bun does
    const { Database } = await import("bun:sqlite") as { Database: new (path: string, opts?: { readonly?: boolean }) => { query: (sql: string) => { all: () => unknown[] }; close: () => void } };
    const db = new Database(kgPath, { readonly: true });
    const rows = db.query("SELECT DISTINCT predicate FROM triples ORDER BY predicate").all() as Triple[];
    db.close();
    distinctPredicates = rows.map((r) => r.predicate).filter(Boolean);
  } catch (err) {
    return {
      rId: "R19-RFC0059",
      requirement: REQUIREMENT,
      status: "not_applicable",
      evidence: [
        `KG query failed — ${err instanceof Error ? err.message : String(err)}`,
      ],
    };
  }

  if (distinctPredicates.length === 0) {
    return {
      rId: "R19-RFC0059",
      requirement: REQUIREMENT,
      status: "not_applicable",
      evidence: ["KG has no predicate triples — nothing to verify"],
    };
  }

  const unknown = distinctPredicates.filter((p) => !knownPredicates.has(p));

  if (unknown.length > 0) {
    const preview = unknown.slice(0, 10).join(", ");
    const overflow = unknown.length > 10 ? ` (+${unknown.length - 10} more)` : "";
    return {
      rId: "R19-RFC0059",
      requirement: REQUIREMENT,
      status: "fail",
      evidence: [
        `${unknown.length} unknown predicate(s) not in PREDICATES.md: ${preview}${overflow}`,
        `PREDICATES.md canonical set: ${knownPredicates.size} predicates`,
        `Total KG distinct predicates checked: ${distinctPredicates.length}`,
      ],
    };
  }

  return {
    rId: "R19-RFC0059",
    requirement: REQUIREMENT,
    status: "pass",
    evidence: [
      `${distinctPredicates.length} distinct KG predicate(s) verified — all in PREDICATES.md canonical/alias set`,
      `PREDICATES.md canonical set: ${knownPredicates.size} predicates`,
    ],
  };
}
