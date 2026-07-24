/**
 * prd-receipt-builder.ts — pure RFC-0007 §5.7 signing pipeline.
 *
 * Slice C of §10.3 Phase 3. Assembles the full v1.1 receipt shape declaring
 * `conformance_profile: v1-self-validated` (§14.2) and signs per §5.7:
 *
 *   1. Build payload shell (no signatures, no receipt_sha256).
 *   2. Strip `validator_attestations[*].signature` to form the preimage shell
 *      (these fields are EXCLUDED from the receipt_sha256 preimage per §5.7).
 *   3. Canonicalize preimage → UTF-8 bytes.
 *   4. receipt_sha256 = sha256(DOMAIN_SEP_TAG || canonical_bytes).
 *   5. executor_signature = signBytes(hexToBytes(receipt_sha256), identity).
 *   6. Each attestation signs `receipt_sha256 || attestation_type || validator_role`.
 *
 * Contract: pure function. The only I/O is through the identity key-material
 * that the caller has already loaded. No file reads, no env, no network here.
 */

import { createHash } from 'node:crypto';

import { canonicalize } from './canonical-json';
import { hashPrd } from './prd-hash';
import { classifyReplayTier } from './replay-tier-classifier';
import { buildMechanicalAttestations } from './attestation-builder';
import { signBytes } from './identity';
import type { Identity } from './identity';
import type {
  ReceiptPayloadV1_1,
  ValidatorAttestation,
} from './receipt-types';

export const DOMAIN_SEP_TAG = 'DOS-RFC0007-v1\n';

export interface BuildSignedReceiptOpts {
  timestamp?: string;
  previousReceiptSha256?: string | null;
  algorithmVersion?: string;
  executorModelFamily?: string;
}

export interface SignedReceiptBuildResult {
  payload: ReceiptPayloadV1_1;
  signature: string;
  receiptSha256: string;
}

function countIscFromContent(prdContent: string): { total: number; passed: number } {
  let total = 0;
  let passed = 0;
  for (const line of prdContent.split('\n')) {
    const m = line.match(/^\s*-\s*\[([ xX])\]\s*ISC-/);
    if (!m) continue;
    total += 1;
    if (m[1] === 'x' || m[1] === 'X') passed += 1;
  }
  return { total, passed };
}

export function buildSignedReceipt(
  content: string,
  fm: Record<string, string>,
  slug: string,
  identity: Identity,
  opts: BuildSignedReceiptOpts = {},
): SignedReceiptBuildResult {
  const timestamp = opts.timestamp ?? new Date().toISOString();
  const algorithmVersion = opts.algorithmVersion ?? '0.0.1';
  const previousReceiptSha256 = opts.previousReceiptSha256 ?? null;
  const executorModelFamily = opts.executorModelFamily ?? 'anthropic-claude';

  const { total, passed } = countIscFromContent(content);
  const prdSha256 = hashPrd(content);

  const { replay_tier, replay_waiver_reason } = classifyReplayTier(content, fm);

  const unsignedAttestations = buildMechanicalAttestations(content, fm, { timestamp });
  const attestationsWithKey: ValidatorAttestation[] = unsignedAttestations.map((a) => ({
    ...a,
    validator_key_id: identity.keyId,
  }));

  const payloadShell: ReceiptPayloadV1_1 = {
    v: 1,
    type: 'prd_completion',
    key_id: identity.keyId,
    slug,
    prd_sha256: prdSha256,
    isc_total: total,
    isc_passed: passed,
    algorithm_version: algorithmVersion,
    previous_receipt_sha256: previousReceiptSha256,
    timestamp,
    receipt_version: '1.1.0',
    conformance_profile: 'v1-self-validated',
    completion_status: attestationsWithKey.length > 0 ? 'validated' : 'proposed',
    replay_tier,
    ...(replay_waiver_reason ? { replay_waiver_reason } : {}),
    executor_key_id: identity.keyId,
    validator_diversity: {
      executor_model_family: executorModelFamily,
      validator_model_families: ['mechanical'],
      diversity_class: 'MECHANICAL_ONLY',
    },
    validator_attestations: attestationsWithKey,
  };

  // §5.7 preimage: strip validator_attestations[*].signature before canonicalizing.
  const preimageShell = {
    ...payloadShell,
    validator_attestations: attestationsWithKey.map(({ signature: _s, ...rest }) => rest),
  };
  const canonical = canonicalize(preimageShell);
  const canonicalBytes = Buffer.from(canonical, 'utf8');
  const domainSepBytes = Buffer.from(DOMAIN_SEP_TAG, 'utf8');
  const receiptSha256 = createHash('sha256')
    .update(Buffer.concat([domainSepBytes, canonicalBytes]))
    .digest('hex');
  const receiptShaBytes = Buffer.from(receiptSha256, 'hex');

  const executorSignature = signBytes(receiptShaBytes, identity);

  const signedAttestations: ValidatorAttestation[] = attestationsWithKey.map((a) => {
    const preimage = Buffer.concat([
      receiptShaBytes,
      Buffer.from(a.attestation_type, 'utf8'),
      Buffer.from(a.validator_role, 'utf8'),
    ]);
    return { ...a, signature: signBytes(preimage, identity) };
  });

  const finalPayload: ReceiptPayloadV1_1 = {
    ...payloadShell,
    validator_attestations: signedAttestations,
  };

  return {
    payload: finalPayload,
    signature: executorSignature,
    receiptSha256,
  };
}
