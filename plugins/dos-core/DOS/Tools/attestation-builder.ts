/**
 * attestation-builder.ts — pure mechanical attestation generator.
 *
 * Slice B of RFC-0007 §10.3 Phase 3 (v1-self-validated profile). Inspects
 * a PRD body + frontmatter and returns an array of unsigned
 * ValidatorAttestation entries. PRDSigner (Slice C) later fills
 * `validator_key_id` and signs each entry over
 * `receipt_sha256 || attestation_type || validator_role` per §5.7.
 *
 * Every attestation emitted here carries `trust_type: 'mechanical'`. §5.3
 * reserves the `validator_key_id !== executor_key_id` inequality requirement
 * for `trust_type: 'llm_judge'` only, so mechanical entries are valid under
 * v1-self-validated even when validator and executor share a key.
 *
 * Contract: pure function. No I/O, no env, no file reads, no network.
 * The only external dependency is the ISC counter from the classifier module.
 */

import type { ValidatorAttestation } from './receipt-types';
import { countIscFromContent } from './replay-tier-classifier';

const BRAND_VOICE_SIGNAL = /\b(brand-voice|validate-brand-voice)\b/;
const TEST_COMMAND_SIGNAL = /\b(pnpm test|vitest|playwright|bun test)\b/;

export interface BuildAttestationOpts {
  /** Test seam so unit tests can assert deterministic output. */
  timestamp?: string;
}

export function buildMechanicalAttestations(
  prdContent: string,
  _frontmatter: Record<string, string>,
  opts: BuildAttestationOpts = {},
): ValidatorAttestation[] {
  const timestamp = opts.timestamp ?? new Date().toISOString();
  const attestations: ValidatorAttestation[] = [];

  const { total, passed } = countIscFromContent(prdContent);
  if (total > 0 && total === passed) {
    attestations.push({
      validator_key_id: '',
      validator_role: 'isc-gate',
      trust_type: 'mechanical',
      attestation_type: 'isc-count-match',
      signature: '',
      timestamp,
      evidence_ref: null,
    });
  }

  if (BRAND_VOICE_SIGNAL.test(prdContent)) {
    attestations.push({
      validator_key_id: '',
      validator_role: 'brand-voice',
      trust_type: 'mechanical',
      attestation_type: 'lint-clean',
      signature: '',
      timestamp,
      evidence_ref: null,
    });
  }

  if (TEST_COMMAND_SIGNAL.test(prdContent)) {
    attestations.push({
      validator_key_id: '',
      validator_role: 'qa-tester',
      trust_type: 'mechanical',
      attestation_type: 'tests-pass',
      signature: '',
      timestamp,
      evidence_ref: null,
    });
  }

  return attestations;
}
