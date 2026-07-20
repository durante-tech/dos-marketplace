/**
 * Archetype schema — the typed source of truth for feature-archetype
 * completeness matrices (schema-first per the RFC-0139 ruling: typed data
 * is the source, markdown is a generated projection).
 *
 * Zero external deps by design: deployed skill tools cannot rely on
 * node_modules in the live install, so validation is hand-rolled runtime
 * checks in Tools/ValidateArchetype.ts against these shapes.
 */

/** T1 absence reads as broken; T2 absence is a known limitation; T3 is a differentiator. */
export type Tier = 'T1' | 'T2' | 'T3';

/**
 * Gap-ledger verdicts emitted by the AuditFeature workflow.
 * WAIVED is the T3-only state SeedScope allows (bare waiver, no reason required).
 */
export type Verdict = 'BUILT' | 'PARTIAL' | 'ABSENT' | 'AHEAD' | 'DEFERRED' | 'WAIVED';

export interface CohortEvidence {
  /** Cohort id — must match an entry in Archetype.cohorts. */
  cohort: string;
  /** How many cohort references ship this capability. */
  shipping: number;
  /** Cohort size. */
  of: number;
  note?: string;
  /**
   * Sources backing this count: inline URLs, members of Archetype.sources,
   * or numeric indexes into it (archer gen-17, H3 narrow — required on new
   * mints; the pre-gen-17 corpus is grandfathered, its counts were
   * skeptic-audited at mint).
   */
  refs?: string[];
  /**
   * Set when any part of the count is inferred rather than doc-quoted.
   * The T1 universality override refuses counts marked inferred (the gen-5
   * probe promoted a row to T1 off evidence the miner flagged "inferred").
   */
  inferred?: boolean;
  /**
   * Doc-confirmed sub-count of `shipping` (archer gen-32, H25,
   * operator-approved). Miner tables state "N confirmed / M total"; without
   * this field a partially-inferred count is indistinguishable from a fully
   * inferred one, so every high-coverage inferred row cost an adjudication.
   * When present alongside `inferred`, checks accept T1 if the confirmed
   * portion alone clears the band or universality. Must be <= shipping.
   */
  confirmed?: number;
}

export interface ArchetypeRow {
  /** Stable kebab-case key — ledger entries and deferrals reference this. */
  id: string;
  capability: string;
  /** Grouping dimension (Ingest, Organization, Retrieval, Lifecycle, ...). */
  dimension: string;
  tier: Tier;
  /**
   * Market grounding. May be empty ONLY when contextRider or
   * groundingException is set (deployment-shape rows like charge-once
   * have no market cohort). Enforced for ALL tiers by ValidateArchetype.
   */
  evidence: CohortEvidence[];
  /** Fork-agnostic pass criterion, 5-16 words, liftable into PRD Criteria. */
  seedISC: string;
  notes?: string;
  /**
   * When set, the row applies only under this deployment shape
   * (e.g. "saas-multitenant", "metered", "generation").
   */
  contextRider?: string;
  /**
   * Escape hatch for the T1 numeric grounding bar: rows that are
   * universal in practice but evidence-thin in docs (empty states,
   * loading states) declare WHY here. Required when a T1 row's best
   * evidence ratio is below 0.75 and no contextRider applies.
   */
  groundingException?: string;
  /**
   * When set, this row's tier is MANDATED by a doctrine source rather than
   * derived from evidence counts — names the anti-criterion id (or RFC ref)
   * that forces it. Counts + universality override + declared exceptions +
   * declared mandates = the complete tiering function (archer gen-13, H13;
   * operator-approved). Mandates are declared by the author, never inferred.
   */
  mandatedBy?: string;
  /**
   * For contextRider rows only: one line stating the within-shape tier basis
   * (archer gen-18, operator-approved). Required when contextRider is set and
   * evidence is empty — completes the declared-judgment family (exceptions,
   * mandates, rider rationales); every non-count tier is auditable.
   */
  riderRationale?: string;
}

export interface AntiCriterion {
  /** Stable kebab-case key, prefixed a- by convention. */
  id: string;
  /** The must-NOT rule, phrased as an ISC-A seed. */
  rule: string;
  why: string;
}

export interface Cohort {
  id: string;
  label: string;
  /** Product/service names surveyed. */
  references: string[];
}

export interface Archetype {
  /** kebab-case archetype key, e.g. "media-asset-library". */
  name: string;
  title: string;
  /** Matrix version — bump when rows are added/retiered (compounding loop). */
  version: string;
  /** ISO date of last grounding pass. */
  updated: string;
  cohorts: Cohort[];
  tierDefinitions: Record<Tier, string>;
  rows: ArchetypeRow[];
  antiCriteria: AntiCriterion[];
  /** Source URLs/docs from the grounding pass. */
  sources?: string[];
}

/** A single gap-ledger line produced by AuditFeature / consumed by SeedScope. */
export interface LedgerEntry {
  rowId: string;
  verdict: Verdict;
  /** file:line citation for BUILT/PARTIAL/AHEAD; grep no-hit note for ABSENT; reason for DEFERRED. */
  evidence: string;
}

export const TIERS: readonly Tier[] = ['T1', 'T2', 'T3'] as const;
export const VERDICTS: readonly Verdict[] = [
  'BUILT',
  'PARTIAL',
  'ABSENT',
  'AHEAD',
  'DEFERRED',
  'WAIVED',
] as const;
