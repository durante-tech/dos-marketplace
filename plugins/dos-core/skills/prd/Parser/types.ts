// @durante/prd — canonical types (RFC-0081 §2 + RFC-0080 §2)
//
// Single source of truth for the PRD parser/writer model. Hooks consume
// `PRDDocument`; they never re-parse. Types are zero-runtime.

/**
 * Frontmatter — parsed YAML frontmatter from a PRD.
 *
 * Scalar values return as `string`; list values return as `string[]` per
 * RFC-0010 Phase 0 YAML-list-aware parser. Extracted from V12.0 prd-utils.ts.
 */
export type Frontmatter = Record<string, string | string[]>;

/**
 * Criterion — a single ISC line parsed from the `## Criteria` section.
 *
 * `isAnti: true` indicates anti-criterion (ISC-A-N prefix OR negative-language
 * description). Extracted verbatim from V12.0 prd-utils.ts (renamed from
 * CriterionEntry; back-compat alias deleted after /simplify confirmed zero
 * external consumers).
 */
export interface Criterion {
  id: string;
  description: string;
  type: 'criterion' | 'anti-criterion';
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  priority: 'critical' | 'important' | 'nice';
  isAnti: boolean;
  verificationMethod?: {
    type: 'command' | 'grep' | 'read' | 'subjective' | 'adapter';
    command?: string;
    path?: string;
    pattern?: string;
    contains?: string;
    hint?: string;
  };
  evidence?: string;
  createdInPhase?: string;
  updatedInPhase?: string;
}

/**
 * Section — a body section parsed from a PRD.
 *
 * vNext format defines 9 sections (Problem, Goal, Out of Scope, Principles,
 * Health & Constraints, Features, Criteria, Decisions, Verification — RFC-0080
 * §2.1). v2.1 legacy uses 4 sections (Context, Criteria, Decisions, Verification).
 * `heading` is the literal H2 text without the leading `## `.
 */
export interface Section {
  heading: string;
  level: 2 | 3;
  body: string;
  subsections?: Section[];
}

/**
 * FeatureSlice — vNext §3 delegation-addressable subunit.
 *
 * RFC-0080 §3 mandates exactly five properties (Council 2026-05-10 P2.1).
 */
export interface FeatureSlice {
  id: string;
  iscRefs: string[];
  testRefs: string[];
  owner: string;
  independentlyVerifiable: boolean;
}

/**
 * TestRow — `### Test Strategy` subsection row mapping a test to one or more ISCs.
 */
export interface TestRow {
  id: string;
  iscRefs: string[];
  type: 'unit' | 'integration' | 'e2e' | 'manual' | string;
  notes?: string;
}

/**
 * FormatVersionDetection — output of `detectFormatVersion()`.
 *
 * - `valid` — explicit `format_version: 2` or `format_version: 3` field present
 * - `missing` — no field; defaults to legacy v2
 * - `invalid` — explicit non-{2, 3} value; raw preserved for failure-closed reporting
 *
 * Per RFC-0080 §2.2 closed enum + RFC-0081 §2.3 no body-shape inference.
 */
export type FormatVersionDetection =
  | { status: 'valid'; version: 2 | 3; raw: '2' | '3' }
  | { status: 'missing'; version: 2 }
  | { status: 'invalid'; raw: string };

/**
 * PRDDocument — the canonical typed model of a parsed PRD.
 *
 * Hooks consume this; they never re-parse. The library returns this from
 * parsePRDFile / parsePRDContent. `formatVersion` is the dispatch-determining
 * field; downstream consumers branch on it.
 */
export interface PRDDocument {
  formatVersion: 2 | 3;
  frontmatter: Frontmatter;
  sections: Section[];
  criteria: Criterion[];
  features?: FeatureSlice[];
  tests?: TestRow[];
  rawContent: string;
}
