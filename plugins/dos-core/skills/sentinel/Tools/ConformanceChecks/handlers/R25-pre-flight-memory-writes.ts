/**
 * R25 — Recent sessions emit worked_on + learned KG facts (Algorithm trace obligations).
 *
 * The Algorithm v0.0.7-enhanced LEARN phase mandates two KG writes per session:
 *   - `worked_on`: entity → session fact (OBSERVE phase obligation)
 *   - `learned`: session → insight fact (LEARN phase obligation)
 *
 * This check queries the KG for sessions from the last 7 days that have BOTH
 * predicates. A session without `worked_on` never filed its entity focus;
 * a session without `learned` never executed the LEARN phase write obligations.
 *
 * This is a dynamic/live-only check: it requires the KG sqlite3 database.
 * Returns `not_applicable` if the KG is not found.
 *
 * KG path resolution:
 *   1. $HOME/.claude/MEMORY/MEMPALACE/knowledge_graph.sqlite3
 *   2. $HOME/.claude/MEMORY/MEMPALACE/knowledge_graph.db
 *
 * Pass criteria: at least one session in the last 7 days has both predicates.
 * Rationale: this is a liveness check, not an exhaustive audit. If sessions
 * exist without both predicates, that's a pattern worth surfacing.
 *
 * Failure modes:
 *   - KG not found → not_applicable
 *   - KG query fails → not_applicable (infrastructure error)
 *   - No sessions in last 7 days → not_applicable (new install or no work)
 *   - Sessions present but none have both worked_on + learned → fail
 *
 * Why R-class: LEARN phase write obligations are the Algorithm's primary memory
 * mechanism. Silent non-execution means sessions produce no durable knowledge.
 */

import { existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import type { CheckContext, CheckResult } from "../types.ts";

const REQUIREMENT =
  "Recent sessions (last 7 days) must emit both worked_on and learned KG predicate triples";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function resolveKgPath(): string | null {
  const home = homedir();
  const candidates = [
    join(home, ".claude", "MEMORY", "MEMPALACE", "knowledge_graph.sqlite3"),
    join(home, ".claude", "MEMORY", "MEMPALACE", "knowledge_graph.db"),
  ];
  return candidates.find((p) => existsSync(p)) ?? null;
}

interface TripleRow {
  subject: string;
  predicate: string;
  created_at?: string;
}

export async function r25PreFlightMemoryWrites(ctx: CheckContext): Promise<CheckResult> {
  const kgPath = resolveKgPath();

  if (!kgPath) {
    return {
      rId: "R25",
      requirement: REQUIREMENT,
      status: "not_applicable",
      evidence: ["KG sqlite3 not found — MemPalace not initialised"],
    };
  }

  const nowMs = ctx.nowMs ?? Date.now();
  const cutoffMs = nowMs - SEVEN_DAYS_MS;
  const cutoffIso = new Date(cutoffMs).toISOString();

  let rows: TripleRow[];
  try {
    // @ts-ignore bun:sqlite is a Bun built-in
    const { Database } = await import("bun:sqlite") as { Database: new (path: string, opts?: { readonly?: boolean }) => { query: (sql: string) => { all: () => unknown[] }; close: () => void } };
    const db = new Database(kgPath, { readonly: true });
    const stmt = db.query(
      `SELECT subject, predicate, created_at
       FROM triples
       WHERE predicate IN ('worked_on', 'learned')
         AND (created_at IS NULL OR created_at >= '${cutoffIso}')
       ORDER BY created_at DESC`,
    );
    rows = stmt.all() as TripleRow[];
    // If the table doesn't have created_at, fall back to all rows
    if (rows.length === 0) {
      rows = db.query(
        `SELECT subject, predicate FROM triples WHERE predicate IN ('worked_on', 'learned') LIMIT 200`,
      ).all() as TripleRow[];
    }
    db.close();
  } catch (err) {
    return {
      rId: "R25",
      requirement: REQUIREMENT,
      status: "not_applicable",
      evidence: [
        `KG query failed — ${err instanceof Error ? err.message : String(err)}`,
      ],
    };
  }

  if (rows.length === 0) {
    return {
      rId: "R25",
      requirement: REQUIREMENT,
      status: "not_applicable",
      evidence: [
        "No worked_on or learned triples in KG for last 7 days — new install or no work performed",
      ],
    };
  }

  const predicates = new Set(rows.map((r) => r.predicate));
  const hasWorkedOn = predicates.has("worked_on");
  const hasLearned = predicates.has("learned");

  if (!hasWorkedOn || !hasLearned) {
    const missing: string[] = [];
    if (!hasWorkedOn) missing.push("worked_on");
    if (!hasLearned) missing.push("learned");
    return {
      rId: "R25",
      requirement: REQUIREMENT,
      status: "fail",
      evidence: [
        `Missing KG predicate(s) in last 7d: ${missing.join(", ")}`,
        `Predicates found: ${[...predicates].join(", ") || "(none)"}`,
        "Check that OBSERVE phase fires intel-context and LEARN phase writes reflection",
      ],
    };
  }

  return {
    rId: "R25",
    requirement: REQUIREMENT,
    status: "pass",
    evidence: [
      `Both worked_on and learned triples present in KG (${rows.length} total matching rows)`,
    ],
  };
}
