#!/usr/bin/env bun
/**
 * Upcaster — reflection-jsonl-entry
 *
 * Realizes `MEMORY/CANONICAL/upcaster-contract.md` (v0.0.18 Round 2 R2-D1,
 * 6-0 ACTION). Authored by A11 PRD (slug 20260525-143318_a11-schema-migration-adr)
 * against RFC-0115. Per the four pinned sub-decisions:
 *
 *   1. LOCATION — projection-side shared lib at this path. Imported by every
 *      consumer that reads algorithm-reflections.jsonl and needs the 8-field
 *      runtime shape. NOT a drainer-local helper; NOT inline at each consumer.
 *
 *   2. LOSSLESS via residual envelope — non-canonical fields ride along in
 *      the `_doctrine_residual` envelope on the runtime row. Q1–Q4 corpus
 *      semantic separation is preserved forever; future projections can
 *      reach back. Storage cost is rounding error.
 *
 *      v1.1.0 (Feathers council amendment, RFC-0148) — the residual is now a
 *      CATCH-ALL: every source key that is not one of the canonical 8 field
 *      names rides into `_doctrine_residual` verbatim. This supersedes the
 *      v1.0.0 fixed `DOCTRINE_RESIDUAL_FIELDS` allowlist, which silently
 *      dropped ad-hoc keys (`mode`, `profile`, `capabilities_used`, `task`,
 *      `outcome`, …) and violated the losslessness pin. The constant remains
 *      exported for backward compat but no longer filters anything.
 *
 *   3. ONE-WAY doctrine → runtime, at projection only. The JSONL file on
 *      disk stays Q1–Q4 / 12-field / quartet native forever. This module
 *      reads, materializes, never writes back. There is no inverse function;
 *      callers wanting the original doctrine shape read raw JSONL. Timestamp
 *      normalization (offset → UTC-Z, naive → assumed-UTC) is likewise a
 *      read-side projection — the source line keeps its original value.
 *
 *   4. QUARANTINE policy — un-upcastable rows return a discriminated
 *      `UpcastQuarantine` variant. Callers write quarantined rows to
 *      `MEMORY/LEARNING/REFLECTIONS/.quarantine/upcast-failure/{row-hash}.json`
 *      with a `.reason.json` sidecar. Silent-skip is forbidden.
 *
 * The discriminated return type `UpcastResult` is the contract surface:
 * every caller MUST handle both branches. Feathers' Round 2 lesson:
 * "how you discover six months later that 14% of your corpus vanished."
 *
 * SENTIMENT WORD ALIAS (v1.2.0, operator-signed 2026-07-22) — a string
 * implied_sentiment with a known word mapping (positive/productive→8, neutral→7,
 * negative→3; corpus 0-10 scale) converts at projection; unknown words still
 * quarantine. Conversion recorded in `_upcast_defaults`.
 *
 * ALIAS KEYS (v1.1.0) — applied BEFORE the required-field check, only when
 * the canonical key is absent on the source row:
 *
 *   ts           → timestamp
 *   sentiment    → implied_sentiment
 *   effort_level → effort   (doctrine variant, carried from v1.0.0)
 *   tier         → effort   (values like 'E3' pass through as strings)
 *
 * REFLECTION FAMILIES (v1.1.0) — when the source row has no `reflection`
 * key, composition tries each family in order; the FIRST family with any
 * non-empty member wins, members joined with ' | ' in stable key order:
 *
 *   1. [reflection_q1, reflection_q2, reflection_q3, reflection_q4]  (doctrine)
 *   2. [q1_what_worked, q2_what_to_improve, q3_one_thing, q4_pattern] (quartet)
 *   3. [q1_worked, q2_didnt, q3_surprise, q4_next]
 *   4. [q1_different, q2_smarter_algo, q3_capabilities, q4_smarter_design]
 *   5. [what_worked, what_failed, what_didnt, what_surprised, what_to_improve, lesson]
 *   6. [lesson]
 *   7. [insight]
 *   8. [summary, lessons[]]  (array members are flattened into parts)
 *   9. [theme, lesson]
 *
 * SENTIMENT DEFAULT (v1.1.0) — absence of `implied_sentiment` (after
 * aliasing) still quarantines (projection honesty) UNLESS the row composed
 * a reflection AND carries a `prd_id`, in which case it defaults to 7 and
 * `'implied_sentiment'` is recorded in `_doctrine_residual._upcast_defaults`.
 * Corpus-verified: 276/280 rows carry a sentiment key — the default is the
 * narrow tail, not the common path.
 *
 * TIMESTAMP NORMALIZATION (v1.1.0) — read-side projection only:
 * offset ISO-8601 (`-03:00` / `-0300` / `+00:00`) converts to UTC-Z; naive
 * date-times are assumed UTC (recorded as `'timestamp'` in
 * `_upcast_defaults`); already-Z values pass through unchanged.
 *
 * STREAMING (Engineer Round 3 AMEND) — `upcastStream()` is a `readline`-based
 * async generator with default batch size 256 rows. The poison-stream
 * detector fails fast when N>5 quarantine outcomes accumulate inside any
 * single batch — the corpus is malformed and silently grinding through it
 * pins drift into projections.
 *
 * NO SOURCE MUTATION. This module is read-only against the JSONL file. It
 * does not call writeFileSync, fs.appendFile, or any mutation API against
 * the source path. Sub-decision 3 is a hard invariant.
 */

import { createHash } from "node:crypto";

// ---------------------------------------------------------------------------
// PUBLIC TYPES
// ---------------------------------------------------------------------------

/**
 * The canonical 8-field runtime shape per R62 (RFC-0098 §13.4). Every Studio
 * route, KG predicate emitter, and DOSUpgrade mining workflow consumes THIS
 * shape. Non-canonical fields ride along in `_doctrine_residual`.
 */
export interface RuntimeReflection {
  readonly timestamp: string;
  readonly effort: string;
  readonly phase: string;
  readonly prd_id: string;
  readonly implied_sentiment: number;
  readonly reflection: string;
  readonly session_id: string;
  readonly tags: readonly string[];
  /**
   * Optional residual envelope carrying every non-canonical field found on
   * the source row, verbatim (catch-all per the Feathers council amendment,
   * RFC-0148). Present iff the source row carried any key outside the
   * canonical 8, OR any projection default was applied (see
   * `_upcast_defaults` inside the envelope). Underscore-prefix marks the
   * field as projection-machinery, not domain data — callers SHOULD NOT
   * mutate or rely on its inner shape.
   */
  readonly _doctrine_residual?: Readonly<Record<string, unknown>>;
}

/**
 * Discriminated quarantine variant — rows that fail to upcast. Returned by
 * the upcaster instead of being thrown. Callers MUST handle this branch.
 *
 * The `category` field matches RFC-0062 FailureBucket discriminators
 * (`quarantine-poison` / `quarantine-route` / `quarantine-auth`). For
 * upcaster failures we always use `quarantine-poison` (malformed source
 * data); the field is kept on the wire for forward-compatibility with the
 * unified quarantine catalogue.
 */
export interface UpcastQuarantine {
  readonly kind: "quarantine";
  readonly category: "quarantine-poison";
  readonly reason: UpcastFailureReason;
  /** Stable hash of the source row, used as quarantine-file basename. */
  readonly rowHash: string;
  /** Verbatim source line. Operators inspect this when recovering. */
  readonly sourceLine: string;
  /** Optional partially-parsed object (when JSON parsed but fields missing). */
  readonly parsedObject?: Readonly<Record<string, unknown>>;
}

export type UpcastFailureReason =
  | { code: "invalid-json"; message: string }
  | { code: "not-object"; actualType: string }
  | { code: "missing-required-field"; fields: readonly string[] }
  | { code: "field-type-mismatch"; field: string; expected: string; actual: string };

export type UpcastResult = RuntimeReflection | UpcastQuarantine;

/**
 * Required fields on the projection-target shape. A source row that cannot
 * supply these (directly OR via the alias/family mappings below) lands in
 * quarantine. `tags` is intentionally NOT required (the molecule spec
 * declares `required: false` for tags).
 */
const REQUIRED_RUNTIME_FIELDS = [
  "timestamp",
  "effort",
  "phase",
  "prd_id",
  "implied_sentiment",
  "reflection",
  "session_id",
] as const;

/** The full canonical 8 (required 7 + optional `tags`). */
const CANONICAL_FIELD_NAMES: ReadonlySet<string> = new Set([...REQUIRED_RUNTIME_FIELDS, "tags"]);

/**
 * @deprecated v1.1.0 — superseded by the catch-all residual (Feathers
 * council amendment, RFC-0148). No longer used for filtering: EVERY
 * non-canonical source key now rides into `_doctrine_residual` verbatim,
 * so this allowlist is redundant. Kept exported for backward compat with
 * consumers that referenced it as documentation of the doctrine field set.
 */
export const DOCTRINE_RESIDUAL_FIELDS = [
  "effort_level",
  "task_description",
  "criteria_count",
  "criteria_passed",
  "criteria_failed",
  "reflection_q1",
  "reflection_q2",
  "reflection_q3",
  "reflection_q4",
  "within_budget",
  // Quartet-variant residuals (kept for archaeology)
  "q1_what_worked",
  "q2_what_to_improve",
  "q3_one_thing",
  "q4_pattern",
] as const;

/**
 * Alias-key mappings, applied BEFORE the required-field check. Precedence is
 * list order: the first alias present on the source (with the canonical key
 * absent) wins; later aliases for the same canonical target ride in residual.
 */
const ALIAS_KEY_MAPPINGS = [
  { alias: "ts", canonical: "timestamp" },
  { alias: "sentiment", canonical: "implied_sentiment" },
  { alias: "effort_level", canonical: "effort" },
  { alias: "tier", canonical: "effort" },
] as const;

/**
 * v1.2.0 — word→number sentiment alias table (corpus 0-10 integer scale; two float
 * outliers 0.8/0.85 exist in the corpus and are untouched — this map fires on strings
 * only). OBSERVED corpus words: "positive" (×2), "productive" (×1); "confident" (×1,
 * project corpus) is deliberately unmapped and still quarantines. "neutral"/"negative"
 * are SPECULATIVE forward-cover on the same scale (adversarial-review finding d —
 * acknowledged, not observed); remove them if strict observed-only discipline is
 * preferred over forward-cover.
 */
const SENTIMENT_WORD_MAP: Record<string, number> = {
  positive: 8,
  productive: 8,
  neutral: 7,   // speculative (unobserved)
  negative: 3,  // speculative (unobserved; below observed numeric floor 6 by design)
};

/**
 * Reflection-composition families, in precedence order. First family with
 * any non-empty member wins; contributing values join with ' | ' in the
 * stable key order declared here. Array-valued members (`lessons`) are
 * flattened — each non-empty string item becomes one part.
 */
const REFLECTION_FAMILIES: ReadonlyArray<{ readonly name: string; readonly keys: readonly string[] }> = [
  { name: "doctrine-triplet", keys: ["reflection_q1", "reflection_q2", "reflection_q3", "reflection_q4"] },
  { name: "quartet", keys: ["q1_what_worked", "q2_what_to_improve", "q3_one_thing", "q4_pattern"] },
  { name: "adhoc-q1-worked", keys: ["q1_worked", "q2_didnt", "q3_surprise", "q4_next"] },
  { name: "adhoc-q1-different", keys: ["q1_different", "q2_smarter_algo", "q3_capabilities", "q4_smarter_design"] },
  { name: "adhoc-what-worked", keys: ["what_worked", "what_failed", "what_didnt", "what_surprised", "what_to_improve", "lesson"] },
  { name: "adhoc-lesson", keys: ["lesson"] },
  { name: "adhoc-insight", keys: ["insight"] },
  { name: "adhoc-summary-lessons", keys: ["summary", "lessons"] },
  { name: "adhoc-theme-lesson", keys: ["theme", "lesson"] },
];

// ---------------------------------------------------------------------------
// PUBLIC ENTRY POINT — single row
// ---------------------------------------------------------------------------

/**
 * Upcast a single raw row to the canonical 8-field runtime shape. Returns
 * a discriminated union; callers MUST handle both branches.
 *
 * @param raw - Either a verbatim JSONL string OR a pre-parsed object. The
 *   string form is the primary path (streaming readers pass lines directly).
 *   Object form is used in tests + when an in-memory consumer already
 *   parsed the row.
 *
 * @returns RuntimeReflection on success; UpcastQuarantine on any failure.
 *   Never throws (except on programmer error — invalid `raw` parameter type).
 */
export function upcastReflectionJsonlEntry(raw: string | Record<string, unknown>): UpcastResult {
  const sourceLine = typeof raw === "string" ? raw : JSON.stringify(raw);
  const rowHash = hashRow(sourceLine);

  // ----- Phase 1: parse to object (or quarantine) -----
  let obj: Record<string, unknown>;
  if (typeof raw === "string") {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      return {
        kind: "quarantine",
        category: "quarantine-poison",
        reason: { code: "invalid-json", message: (e as Error).message },
        rowHash,
        sourceLine,
      };
    }
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {
        kind: "quarantine",
        category: "quarantine-poison",
        reason: {
          code: "not-object",
          actualType: parsed === null ? "null" : Array.isArray(parsed) ? "array" : typeof parsed,
        },
        rowHash,
        sourceLine,
      };
    }
    obj = parsed as Record<string, unknown>;
  } else if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return {
      kind: "quarantine",
      category: "quarantine-poison",
      reason: {
        code: "not-object",
        actualType: raw === null ? "null" : Array.isArray(raw) ? "array" : typeof raw,
      },
      rowHash,
      sourceLine,
    };
  } else {
    obj = raw;
  }

  // ----- Phase 2: build runtime fields (one-way source→runtime mappings) -----
  const candidate: Record<string, unknown> = { ...obj };
  const upcastDefaults: string[] = [];

  // Phase 2a — alias keys (BEFORE required-field check). Assignment fills the
  // canonical slot, so later aliases for the same target (tier after
  // effort_level) do not override.
  for (const { alias, canonical } of ALIAS_KEY_MAPPINGS) {
    if (!(canonical in candidate) && alias in obj) {
      candidate[canonical] = obj[alias];
    }
  }

  // F3 (code-review): the legacy session_id placeholder hash MUST use the
  // ORIGINAL source timestamp, not the normalized one — v1.0.0 hashed the raw
  // value, and changing the hash input across a version bump re-keys every
  // pre-canonical row in Studio (duplicate ingestion on next sync).
  const originalTimestampForLegacyHash =
    typeof candidate.timestamp === "string" ? (candidate.timestamp as string) : undefined;

  // Phase 2b — timestamp normalization (read-side projection only; the
  // source line keeps its original value). Offset → UTC-Z; naive → assumed
  // UTC (recorded in _upcast_defaults); already-Z unchanged.
  if (typeof candidate.timestamp === "string" && candidate.timestamp.length > 0) {
    const norm = normalizeTimestamp(candidate.timestamp);
    candidate.timestamp = norm.value;
    if (norm.assumedUtc) upcastDefaults.push("timestamp");
  }

  // Phase 2c — phase: legacy doctrine emitted only at LEARN-phase terminal;
  // map to "complete"
  if (!("phase" in candidate)) {
    candidate.phase = "complete";
  }

  // Phase 2d — reflection: first non-empty family wins, joined ' | '
  if (!("reflection" in candidate)) {
    const composed = composeReflectionFromFamilies(obj);
    if (composed) {
      candidate.reflection = composed.reflection;
    }
  }

  // Phase 2e0 — implied_sentiment WORD alias (v1.2.0, operator-signed 2026-07-22):
  // 2 real 2026-05-25 engineer rows carry word sentiments ("productive", "positive")
  // on the CANONICAL key. Convert word → corpus-scale number ONLY when the value is a
  // string with a known mapping; unknown words still quarantine (projection honesty).
  // SCALE NOTE (deviation from the signed sketch, recorded in gen-112): the corpus is
  // 0-10 (observed: mode 8, neutral-default 7) — the sketched -1/0/+1 mapping would
  // have written "very negative" numbers for positive words. Mapping follows the
  // corpus. Conversion recorded in _upcast_defaults as "implied_sentiment:word-alias".
  if (typeof candidate.implied_sentiment === "string") {
    const w = SENTIMENT_WORD_MAP[(candidate.implied_sentiment as string).trim().toLowerCase()];
    if (w !== undefined) {
      candidate.implied_sentiment = w;
      upcastDefaults.push("implied_sentiment:word-alias");
    }
  }

  // Phase 2e — implied_sentiment default: absence still quarantines
  // (projection honesty) UNLESS the row composed a reflection AND carries a
  // prd_id — then default 7 and record the default in the residual envelope.
  if (candidate.implied_sentiment === undefined || candidate.implied_sentiment === null) {
    const hasReflection = typeof candidate.reflection === "string" && candidate.reflection.length > 0;
    const hasPrd = typeof candidate.prd_id === "string" && candidate.prd_id.length > 0;
    if (hasReflection && hasPrd) {
      candidate.implied_sentiment = 7;
      upcastDefaults.push("implied_sentiment");
    }
  }

  // Phase 2e2 — effort default (RFC-0148 corpus tail): 37 real ad-hoc rows
  // carry no effort/tier/effort_level key at all. Same honesty contract as
  // the sentiment default: only when the row composed a reflection AND
  // carries a prd_id, default "unknown" and record it in _upcast_defaults.
  if (candidate.effort === undefined || candidate.effort === null) {
    const hasReflection = typeof candidate.reflection === "string" && candidate.reflection.length > 0;
    const hasPrd = typeof candidate.prd_id === "string" && candidate.prd_id.length > 0;
    if (hasReflection && hasPrd) {
      candidate.effort = "unknown";
      upcastDefaults.push("effort");
    }
  }

  // Phase 2f — tags: molecule spec says optional; default to []
  if (!("tags" in candidate)) {
    candidate.tags = [];
  }

  // Phase 2g — session_id: legacy entries pre-date session_id capture; assign
  // a deterministic placeholder derived from prd_id + timestamp so downstream
  // dedup keys remain stable.
  if (!("session_id" in candidate) || typeof candidate.session_id !== "string" || (candidate.session_id as string).length === 0) {
    const prd = typeof candidate.prd_id === "string" ? candidate.prd_id : "<unknown-prd>";
    const ts = originalTimestampForLegacyHash ?? "<unknown-ts>";
    candidate.session_id = `legacy-${hashRow(`${prd}|${ts}`).slice(0, 12)}`;
  }

  // ----- Phase 3: required-field check -----
  const missing = REQUIRED_RUNTIME_FIELDS.filter((f) => !(f in candidate) || candidate[f] === undefined || candidate[f] === null);
  if (missing.length > 0) {
    return {
      kind: "quarantine",
      category: "quarantine-poison",
      reason: { code: "missing-required-field", fields: missing },
      rowHash,
      sourceLine,
      parsedObject: obj,
    };
  }

  // ----- Phase 4: type checks on required fields -----
  const typeError = checkRuntimeTypes(candidate);
  if (typeError) {
    return {
      kind: "quarantine",
      category: "quarantine-poison",
      reason: typeError,
      rowHash,
      sourceLine,
      parsedObject: obj,
    };
  }

  // ----- Phase 5: catch-all residual envelope (Feathers amendment, RFC-0148) -----
  // Every non-canonical source key rides verbatim — consumed alias/family
  // keys included (archaeology: semantic separation preserved forever).
  const residual: Record<string, unknown> = {};
  if ("tags" in candidate && !Array.isArray(candidate.tags)) {
    // F7 (code-review): a non-array tags value must not be silently destroyed
    // by the [] coercion — losslessness pin. Original value rides the residual.
    residual.tags = candidate.tags;
    upcastDefaults.push("tags");
  }
  for (const k of Object.keys(obj)) {
    if (!CANONICAL_FIELD_NAMES.has(k)) {
      residual[k] = obj[k];
    }
  }
  if (upcastDefaults.length > 0) {
    residual._upcast_defaults = Object.freeze([...upcastDefaults]);
  }

  // ----- Phase 6: assemble final RuntimeReflection -----
  const out: RuntimeReflection = {
    timestamp: candidate.timestamp as string,
    effort: candidate.effort as string,
    phase: candidate.phase as string,
    prd_id: candidate.prd_id as string,
    implied_sentiment: candidate.implied_sentiment as number,
    reflection: candidate.reflection as string,
    session_id: candidate.session_id as string,
    tags: Array.isArray(candidate.tags) ? (candidate.tags as readonly string[]) : [],
    // (non-array tags handled above — original value rides the residual, F7)
    ...(Object.keys(residual).length > 0 ? { _doctrine_residual: Object.freeze(residual) } : {}),
  };
  return out;
}

// ---------------------------------------------------------------------------
// PUBLIC HELPER — losslessness audit
// ---------------------------------------------------------------------------

/**
 * Pure losslessness audit: for a successfully-upcast row the invariant is
 *
 *   set(sourceKeys) ⊆ set(consumedKeys) ∪ set(residualKeys)
 *
 * where consumedKeys = the canonical 8 names present on the source, plus
 * every alias/family key that actually contributed to the projection.
 * Returns the source keys that neither got consumed nor rode in residual —
 * `lost` MUST be empty for every RuntimeReflection outcome. Quarantine
 * outcomes carry the verbatim source line, so nothing is lost by definition.
 *
 * Tests and the corpus proof assert `lost.length === 0` over every row.
 */
export function auditKeyCoverage(
  source: string | Record<string, unknown>,
  result: UpcastResult,
): { lost: string[] } {
  if ("kind" in result && result.kind === "quarantine") {
    return { lost: [] };
  }
  let obj: Record<string, unknown> | null = null;
  if (typeof source === "string") {
    try {
      const parsed = JSON.parse(source) as unknown;
      if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
        obj = parsed as Record<string, unknown>;
      }
    } catch {
      // unparseable source cannot have produced a RuntimeReflection; nothing to audit
    }
  } else if (source !== null && typeof source === "object" && !Array.isArray(source)) {
    obj = source;
  }
  if (obj === null) return { lost: [] };

  const runtime = result as RuntimeReflection;
  const residualKeys = new Set(Object.keys(runtime._doctrine_residual ?? {}));
  const consumed = deriveConsumedKeys(obj);
  const lost = Object.keys(obj).filter((k) => !consumed.has(k) && !residualKeys.has(k));
  return { lost };
}

// ---------------------------------------------------------------------------
// PUBLIC ENTRY POINT — streaming
// ---------------------------------------------------------------------------

export interface StreamOptions {
  /** Lines per batch. Default 256 (Engineer Round 3 AMEND). */
  readonly batchSize?: number;
  /** Quarantine-count threshold per batch that triggers poison-stream halt. */
  readonly poisonThreshold?: number;
}

export interface StreamBatch {
  readonly batchIndex: number;
  readonly rows: readonly UpcastResult[];
  readonly quarantineCount: number;
}

/**
 * Streaming variant — reads any AsyncIterable<string> of JSONL lines and
 * emits batches of UpcastResult. Designed for `readline.createInterface()`
 * over a `fs.createReadStream()` of algorithm-reflections.jsonl. Pure
 * generator; no side effects; callers persist quarantine results themselves.
 *
 * Poison-stream detector: throws `PoisonStreamError` when quarantineCount
 * within a single batch exceeds `poisonThreshold` (default 5). Engineer
 * Round 3 AMEND — corpus malformation should halt the migration loudly,
 * not silently grind 10K rows into the wall.
 */
export async function* upcastStream(
  lines: AsyncIterable<string>,
  opts: StreamOptions = {},
): AsyncGenerator<StreamBatch, void, void> {
  const batchSize = opts.batchSize ?? 256;
  const poisonThreshold = opts.poisonThreshold ?? 5;
  if (batchSize <= 0) throw new Error("upcastStream: batchSize must be > 0");
  if (poisonThreshold < 0) throw new Error("upcastStream: poisonThreshold must be >= 0");

  let batchIndex = 0;
  let buffer: UpcastResult[] = [];
  let quarantineInBatch = 0;

  for await (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.length === 0) continue;

    const result = upcastReflectionJsonlEntry(line);
    buffer.push(result);
    if ("kind" in result && result.kind === "quarantine") quarantineInBatch++;

    if (buffer.length >= batchSize) {
      const emittedBatch: StreamBatch = {
        batchIndex,
        rows: Object.freeze(buffer),
        quarantineCount: quarantineInBatch,
      };
      if (quarantineInBatch > poisonThreshold) {
        throw new PoisonStreamError(batchIndex, quarantineInBatch, poisonThreshold, emittedBatch);
      }
      yield emittedBatch;
      batchIndex++;
      buffer = [];
      quarantineInBatch = 0;
    }
  }

  if (buffer.length > 0) {
    const emittedBatch: StreamBatch = {
      batchIndex,
      rows: Object.freeze(buffer),
      quarantineCount: quarantineInBatch,
    };
    if (quarantineInBatch > poisonThreshold) {
      throw new PoisonStreamError(batchIndex, quarantineInBatch, poisonThreshold, emittedBatch);
    }
    yield emittedBatch;
  }
}

/**
 * Thrown by `upcastStream` when poison-stream detector trips. The partial
 * batch is attached so operators can inspect what was already classified
 * before the halt.
 */
export class PoisonStreamError extends Error {
  readonly batchIndex: number;
  readonly quarantineCount: number;
  readonly poisonThreshold: number;
  readonly partialBatch: StreamBatch;
  constructor(batchIndex: number, quarantineCount: number, poisonThreshold: number, partialBatch: StreamBatch) {
    super(
      `Poison-stream detector tripped at batch #${batchIndex}: ${quarantineCount} quarantine outcomes ` +
        `exceeded threshold ${poisonThreshold}. Corpus is malformed; halt and inspect quarantine sidecars before resuming.`,
    );
    this.name = "PoisonStreamError";
    this.batchIndex = batchIndex;
    this.quarantineCount = quarantineCount;
    this.poisonThreshold = poisonThreshold;
    this.partialBatch = partialBatch;
  }
}

// ---------------------------------------------------------------------------
// PUBLIC HELPER — quarantine path resolution
// ---------------------------------------------------------------------------

/**
 * Convenience: given a quarantine result and a quarantine root directory,
 * returns the absolute paths a caller should write to. This helper does NOT
 * perform IO — the caller decides whether to persist (matches Sub-decision 3:
 * never write back through this module's surface; quarantine persistence is
 * the caller's policy, not the upcaster's).
 *
 * @param quarantineRoot - typically
 *   `<MEMORY>/LEARNING/REFLECTIONS/.quarantine/upcast-failure/`
 */
export function quarantinePaths(
  result: UpcastQuarantine,
  quarantineRoot: string,
): { envelopePath: string; sidecarPath: string } {
  const base = `${quarantineRoot.replace(/\/$/, "")}/${result.rowHash}`;
  return {
    envelopePath: `${base}.json`,
    sidecarPath: `${base}.reason.json`,
  };
}

// ---------------------------------------------------------------------------
// INTERNAL HELPERS
// ---------------------------------------------------------------------------

function hashRow(line: string): string {
  return createHash("sha256").update(line, "utf8").digest("hex").slice(0, 16);
}

interface FamilyComposition {
  readonly family: string;
  readonly reflection: string;
  readonly usedKeys: readonly string[];
}

/**
 * First family with any non-empty member wins. String members contribute
 * one part each; array members (`lessons`) contribute one part per
 * non-empty string item. Parts join with ' | ' in stable key order.
 */
function composeReflectionFromFamilies(obj: Record<string, unknown>): FamilyComposition | null {
  for (const { name, keys } of REFLECTION_FAMILIES) {
    const parts: string[] = [];
    const usedKeys: string[] = [];
    for (const k of keys) {
      const v = obj[k];
      if (typeof v === "string" && v.length > 0) {
        parts.push(v);
        usedKeys.push(k);
      } else if (Array.isArray(v)) {
        const items = v.filter((item): item is string => typeof item === "string" && item.length > 0);
        if (items.length > 0) {
          parts.push(...items);
          usedKeys.push(k);
        }
      }
    }
    if (parts.length > 0) {
      return { family: name, reflection: parts.join(" | "), usedKeys };
    }
  }
  return null;
}

/**
 * Re-derives the per-row consumed-key set for `auditKeyCoverage`, mirroring
 * the projection path exactly: canonical names present on source, aliases
 * that actually mapped (first alias per canonical target wins), and the
 * winning reflection family's contributing keys.
 */
function deriveConsumedKeys(obj: Record<string, unknown>): Set<string> {
  const consumed = new Set<string>();
  const filled = new Set<string>();
  for (const k of Object.keys(obj)) {
    if (CANONICAL_FIELD_NAMES.has(k)) {
      consumed.add(k);
      filled.add(k);
    }
  }
  for (const { alias, canonical } of ALIAS_KEY_MAPPINGS) {
    if (!filled.has(canonical) && alias in obj) {
      consumed.add(alias);
      filled.add(canonical);
    }
  }
  if (!("reflection" in obj)) {
    const composed = composeReflectionFromFamilies(obj);
    if (composed) {
      for (const k of composed.usedKeys) consumed.add(k);
    }
  }
  return consumed;
}

/**
 * One-way read-side timestamp projection (Sub-decision 3 untouched — the
 * source line keeps its original value):
 *
 *   - already-Z              → unchanged (byte-identical short-circuit)
 *   - offset (`±HH:MM` / `±HHMM`) → converted to UTC-Z via Date
 *   - naive ISO date-time    → parsed as UTC via Date, assumedUtc=true
 *   - anything else          → passed through verbatim (type checks decide)
 *
 * GRAMMAR PARITY (CATO-RFC0148-04/05): the emitted form matches the Python
 * bridge writer's `_format_reflection_utc_z` — `YYYY-MM-DDTHH:MM:SSZ`, with
 * `.mmm` milliseconds ONLY when non-zero (Date parsing truncates any
 * sub-millisecond precision, same as Python's `microsecond // 1000`). A
 * naive leap-second string (`:60`) is Invalid Date here and unparseable in
 * Python — both sides flag rather than silently accept.
 */
function formatUtcZ(parsed: Date): string {
  const iso = parsed.toISOString(); // always YYYY-MM-DDTHH:MM:SS.mmmZ
  return iso.endsWith(".000Z") ? `${iso.slice(0, -5)}Z` : iso;
}

function normalizeTimestamp(ts: string): { value: string; assumedUtc: boolean } {
  if (ts.endsWith("Z")) {
    return { value: ts, assumedUtc: false };
  }
  const offsetMatch = /^(\d{4}-\d{2}-\d{2}T[\d:.]+)([+-]\d{2}):?(\d{2})$/.exec(ts);
  if (offsetMatch) {
    const parsed = new Date(`${offsetMatch[1]}${offsetMatch[2]}:${offsetMatch[3]}`);
    if (!Number.isNaN(parsed.getTime())) {
      return { value: formatUtcZ(parsed), assumedUtc: false };
    }
    return { value: ts, assumedUtc: false };
  }
  if (/^\d{4}-\d{2}-\d{2}T[\d:.]+$/.test(ts)) {
    const parsed = new Date(`${ts}Z`);
    if (!Number.isNaN(parsed.getTime())) {
      return { value: formatUtcZ(parsed), assumedUtc: true };
    }
    return { value: ts, assumedUtc: false };
  }
  return { value: ts, assumedUtc: false };
}

function checkRuntimeTypes(c: Record<string, unknown>): UpcastFailureReason | null {
  const checks: Array<{ field: string; expected: string; ok: (v: unknown) => boolean }> = [
    { field: "timestamp", expected: "string", ok: (v) => typeof v === "string" && v.length > 0 },
    { field: "effort", expected: "string", ok: (v) => typeof v === "string" && v.length > 0 },
    { field: "phase", expected: "string", ok: (v) => typeof v === "string" && v.length > 0 },
    { field: "prd_id", expected: "string", ok: (v) => typeof v === "string" && v.length > 0 },
    { field: "implied_sentiment", expected: "number", ok: (v) => typeof v === "number" && Number.isFinite(v) },
    { field: "reflection", expected: "string", ok: (v) => typeof v === "string" },
    { field: "session_id", expected: "string", ok: (v) => typeof v === "string" && v.length > 0 },
  ];
  for (const { field, expected, ok } of checks) {
    if (!ok(c[field])) {
      return {
        code: "field-type-mismatch",
        field,
        expected,
        actual: c[field] === null ? "null" : Array.isArray(c[field]) ? "array" : typeof c[field],
      };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// VERSION — bumped when contract surface changes (semver-minor at minimum)
// ---------------------------------------------------------------------------

export const UPCASTER_VERSION = "1.2.0";
export const UPCASTER_CONTRACT_REF = "MEMORY/CANONICAL/upcaster-contract.md";
export const UPCASTER_RFC_REF = "Plans/Specs/RFC-0115-schema-migration-reflection-jsonl-entry.md";
