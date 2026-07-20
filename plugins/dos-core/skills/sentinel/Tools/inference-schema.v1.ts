/**
 * inference-schema.v1.ts — the versioned SoT for the Scan Phase-2/2b inference
 * INPUT schema.
 *
 * Pre-extraction, this schema lived as ~60 lines of inline prompt prose in
 * Scan.md — unversioned, and free to silently drift from the Phase-3 parser
 * (SentinelScan.ts) that consumes the inferred output. Extracting it here makes
 * it: (a) versioned (`INFERENCE_SCHEMA_VERSION`), (b) golden-tested (a field
 * rename breaks the test), and (c) the single artifact the prompt (Scan.md
 * embeds this exact block — parity-tested) and the parser both reference.
 *
 * Regenerate the Scan.md prompt block from this artifact; the parity test
 * `inference-schema.v1.test.ts` fails if Scan.md drifts from `INFERENCE_SCHEMA_JSON`.
 */

export const INFERENCE_SCHEMA_VERSION = "v1" as const;

/** Top-level keys the Phase-3 parser expects in the inferred object. */
export const INFERENCE_SCHEMA_FIELDS = [
  "architecture_pattern",
  "conventions",
  "key_decisions",
  "tech_stack_summary",
  "setup_commands",
  "architecture_overview",
] as const;

/** Per-convention object fields (Phase-3 ConventionCache consumes these). */
export const CONVENTION_FIELDS = [
  "category",
  "pattern",
  "evidence",
  "confidence",
  "enforceable",
  "regex",
  "negative_regex",
  "applies_to",
] as const;

/**
 * The canonical schema block, byte-stable. This is the literal text the Scan.md
 * Phase-2 prompt embeds; the parity test pins Scan.md against it.
 */
export const INFERENCE_SCHEMA_JSON = `{
  "architecture_pattern": "monolith|monorepo|microservices|modular",
  "conventions": [{
    "category": "naming|file_organization|imports|error_handling|testing|api|database|state_management|styling|other",
    "pattern": "description of the convention",
    "evidence": "where this was observed",
    "confidence": 0.0-1.0,
    "enforceable": true/false,
    "regex": "OPTIONAL — JS regex (without delimiters) that MUST appear in conformant files. Omit if not regex-enforceable.",
    "negative_regex": "OPTIONAL — JS regex (without delimiters) that MUST NOT appear in conformant files. Omit if not regex-enforceable.",
    "applies_to": ["OPTIONAL — glob patterns like *.ts, *.tsx, package.json, *.md. Omit to default to *.ts/*.tsx."]
  }],
  "key_decisions": [{
    "decision": "description",
    "reasoning": "why this was chosen",
    "evidence_file": "path"
  }],
  "tech_stack_summary": "2-3 sentences",
  "setup_commands": {"install": "...", "dev": "...", "build": "...", "test": "...", "lint": "..."},
  "architecture_overview": "3-5 sentences"
}`;

/** The schema block as it appears embedded in a workflow prompt (version-tagged). */
export function renderInferenceSchema(): string {
  return INFERENCE_SCHEMA_JSON;
}
