#!/usr/bin/env bun
/**
 * ResearchVaultGates - pure entity-gate predicates for the DeepInvestigation
 * workflow's progressive-narrowing funnel (RFC-0126 section 9 B5 remediation).
 *
 * The DeepInvestigation workflow maintains an on-disk ENTITIES.md catalog with
 * a status/value/effort table. Reading that markdown and turning it into the
 * structured Entity[] below is the AGENT's judgment work. The decisions ABOUT
 * those structured records -- thin-category detection, next-entity selection,
 * the breadth gate, the depth gate, and the iteration-state branch -- are
 * deterministic functions of the parsed data. They were previously prose
 * conditionals that could silently drift run-to-run. This module is their one
 * tested owner.
 *
 * Each function is PURE: structured Entity[] (plus a couple of file-existence
 * booleans for iteration state) -> a boolean / list / phase verdict.
 *
 * SUBCOMMANDS (the CLI is a thin shell over the pure functions for parity with
 * the rest of the Research Tools; the unit test exercises the functions
 * directly):
 *   thin-categories <entities-json>      -> JSON array of thin category names
 *   next-entity <entities-json>          -> JSON of the selected entity (or null)
 *   breadth-gate <entities-json>         -> "true"/"false"
 *   depth-gate <entities-json>           -> "true"/"false"
 *   iteration-state <state-json>         -> phase verdict string
 *
 * EXIT CODES
 * ----------
 *   0  success
 *   1  CLI usage error (unknown subcommand) or malformed JSON
 */

/** Status tracked per entity in ENTITIES.md. */
export type EntityStatus = "PENDING" | "RESEARCHED" | "SKIP";

/** Value (domain impact) score. */
export type EntityValue = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

/** Effort (information accessibility) score. */
export type EntityEffort = "EASY" | "MODERATE" | "HARD";

/**
 * One parsed row of the ENTITIES.md catalog. `value`/`effort` are undefined
 * for not-yet-scored PENDING entities (matching the "—" placeholder in the
 * markdown table).
 */
export interface Entity {
  name: string;
  category: string;
  status: EntityStatus;
  value?: EntityValue;
  effort?: EntityEffort;
}

const THIN_CATEGORY_FLOOR = 3;

// ---------------------------------------------------------------------------
// Step 3: Discover — thin-category detection
// ---------------------------------------------------------------------------

/**
 * Categories with fewer than THIN_CATEGORY_FLOOR (3) entities — the targets for
 * a discovery expansion pass. Counts ALL entities in a category regardless of
 * status (the prose says "categories with fewer than 3 entities", full stop).
 * Returns category names in first-seen order, deduplicated.
 */
export function findThinCategories(
  entities: Entity[],
  floor: number = THIN_CATEGORY_FLOOR,
): string[] {
  const counts = new Map<string, number>();
  const order: string[] = [];
  for (const e of entities) {
    if (!counts.has(e.category)) order.push(e.category);
    counts.set(e.category, (counts.get(e.category) ?? 0) + 1);
  }
  return order.filter((cat) => (counts.get(cat) ?? 0) < floor);
}

// ---------------------------------------------------------------------------
// Step 4: Investigate — next-entity selection
// ---------------------------------------------------------------------------

const VALUE_RANK: Record<EntityValue, number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
};

const EFFORT_RANK: Record<EntityEffort, number> = {
  EASY: 0,
  MODERATE: 1,
  HARD: 2,
};

/**
 * Select the highest-priority PENDING entity to deep-dive next.
 *
 * Sort key: VALUE (CRITICAL first), then EFFORT (EASY first) — exactly the
 * "Sort by VALUE (CRITICAL first), then EFFORT (EASY first); pick the top one"
 * rule from Step 4. Only PENDING entities are eligible. Unscored value/effort
 * sort last within their tier. Ties beyond (value, effort) preserve input
 * order (stable). Returns null when no PENDING entity exists.
 */
export function selectNextEntity(entities: Entity[]): Entity | null {
  const pending = entities.filter((e) => e.status === "PENDING");
  if (pending.length === 0) return null;

  const valueRank = (e: Entity) =>
    e.value === undefined ? Number.MAX_SAFE_INTEGER : VALUE_RANK[e.value];
  const effortRank = (e: Entity) =>
    e.effort === undefined ? Number.MAX_SAFE_INTEGER : EFFORT_RANK[e.effort];

  // Stable sort: decorate with original index, compare (value, effort, index).
  const decorated = pending.map((e, i) => ({ e, i }));
  decorated.sort((a, b) => {
    const v = valueRank(a.e) - valueRank(b.e);
    if (v !== 0) return v;
    const f = effortRank(a.e) - effortRank(b.e);
    if (f !== 0) return f;
    return a.i - b.i;
  });
  const best = decorated[0];
  return best ? best.e : null;
}

// ---------------------------------------------------------------------------
// Step 5: Progress Check — Breadth Gate
// ---------------------------------------------------------------------------

/**
 * Breadth Gate: PASS iff every entity category has >= 3 entities with
 * status != SKIP. An empty catalog vacuously passes (no categories to fail) —
 * matching the "for each category" prose which iterates nothing.
 */
export function evaluateBreadthGate(
  entities: Entity[],
  floor: number = THIN_CATEGORY_FLOOR,
): boolean {
  const counts = new Map<string, number>();
  for (const e of entities) {
    if (!counts.has(e.category)) counts.set(e.category, 0);
    if (e.status !== "SKIP") counts.set(e.category, (counts.get(e.category) ?? 0) + 1);
  }
  for (const count of counts.values()) {
    if (count < floor) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Step 5: Progress Check — Depth Gate
// ---------------------------------------------------------------------------

/**
 * Depth Gate: PASS iff every CRITICAL or HIGH entity has status RESEARCHED or
 * SKIP (i.e. none are still PENDING). Entities with no value, or MEDIUM/LOW
 * value, are not gated. No CRITICAL/HIGH entities -> vacuously PASS.
 */
export function evaluateDepthGate(entities: Entity[]): boolean {
  const gated = entities.filter((e) => e.value === "CRITICAL" || e.value === "HIGH");
  return gated.every((e) => e.status === "RESEARCHED" || e.status === "SKIP");
}

// ---------------------------------------------------------------------------
// Step 0: Detect Iteration State
// ---------------------------------------------------------------------------

/** Which phase the loop-resumption logic jumps to. */
export type IterationPhase =
  | "STEP_1_LANDSCAPE" // first iteration — no artifacts yet
  | "STEP_4_INVESTIGATE" // continuation — PENDING CRITICAL/HIGH remain
  | "STEP_3_DISCOVER" // continuation — categories incomplete
  | "EXIT_COMPLETE"; // continuation — both gates pass

/** File-existence + entity inputs the Step 0 branch reads. */
export interface IterationStateInput {
  landscapeExists: boolean;
  entitiesExists: boolean;
  entities: Entity[];
}

/**
 * Decide which phase Step 0 jumps to. Deterministic translation of the prose
 * branch:
 *
 *   - Neither LANDSCAPE.md nor ENTITIES.md exists -> FIRST ITERATION (Step 1).
 *   - Continuation: PENDING entity with VALUE CRITICAL/HIGH -> Step 4.
 *   - Continuation: all CRITICAL/HIGH done but breadth incomplete -> Step 3.
 *   - Continuation: both gates pass -> EXIT.
 *
 * The "all gates pass" branch reuses evaluateBreadthGate + evaluateDepthGate so
 * the exit condition can't drift from Step 5.
 */
export function detectVaultIterationState(input: IterationStateInput): IterationPhase {
  const isContinuation = input.landscapeExists || input.entitiesExists;
  if (!isContinuation) return "STEP_1_LANDSCAPE";

  const hasPendingCriticalHigh = input.entities.some(
    (e) => e.status === "PENDING" && (e.value === "CRITICAL" || e.value === "HIGH"),
  );
  if (hasPendingCriticalHigh) return "STEP_4_INVESTIGATE";

  const breadth = evaluateBreadthGate(input.entities);
  const depth = evaluateDepthGate(input.entities);
  if (breadth && depth) return "EXIT_COMPLETE";

  return "STEP_3_DISCOVER";
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseEntities(raw: string | undefined): Entity[] {
  return JSON.parse(raw ?? "[]") as Entity[];
}

function main(argv: string[]): number {
  const [subcommand, ...rest] = argv;

  try {
    switch (subcommand) {
      case "thin-categories":
        process.stdout.write(JSON.stringify(findThinCategories(parseEntities(rest[0]))) + "\n");
        return 0;
      case "next-entity":
        process.stdout.write(JSON.stringify(selectNextEntity(parseEntities(rest[0]))) + "\n");
        return 0;
      case "breadth-gate":
        process.stdout.write(String(evaluateBreadthGate(parseEntities(rest[0]))) + "\n");
        return 0;
      case "depth-gate":
        process.stdout.write(String(evaluateDepthGate(parseEntities(rest[0]))) + "\n");
        return 0;
      case "iteration-state": {
        const state = JSON.parse(rest[0] ?? "{}") as IterationStateInput;
        process.stdout.write(detectVaultIterationState(state) + "\n");
        return 0;
      }
      default:
        process.stderr.write(
          `ResearchVaultGates: unknown subcommand '${subcommand ?? ""}'.\n` +
            `Usage: bun ResearchVaultGates.ts thin-categories <json> | next-entity <json> | ` +
            `breadth-gate <json> | depth-gate <json> | iteration-state <json>\n`,
        );
        return 1;
    }
  } catch {
    process.stderr.write("ResearchVaultGates: malformed JSON argument.\n");
    return 1;
  }
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}
