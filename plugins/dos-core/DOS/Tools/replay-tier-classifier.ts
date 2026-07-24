/**
 * replay-tier-classifier.ts — pure classifier for RFC-0007 §6 replay tier.
 *
 * Slice A of §10.3 Phase 3 (v1-self-validated profile). Inspects a PRD body
 * and its frontmatter and returns the replay tier plus the waiver reason
 * from §5.4. Consumed by PRDSigner (Slice C) when assembling v1.1 payloads.
 *
 * Under v1-self-validated (§14.2) this classifier only ever returns
 * `replay_tier: 'none'`. `strict` is disqualified by §6.1 (hosted APIs),
 * and `semantic` requires the context-bundle capture (§6.3) that Phase 3
 * scope does not include. Future phases can extend these branches.
 *
 * Contract: pure function. No I/O, no env access, no network, no file reads.
 */

import type { ReplayTier, ReplayWaiverReason } from './receipt-types';

export interface ReplayTierDecision {
  replay_tier: ReplayTier;
  replay_waiver_reason?: ReplayWaiverReason;
}

/**
 * Counts `- [ ] ISC-*` and `- [x] ISC-*` checkboxes in a PRD body.
 * Exported for tests so the counting contract can be exercised in isolation.
 */
export function countIscFromContent(prdContent: string): { total: number; passed: number } {
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

const CREATIVE_SIGNAL = /\b(creative|exploratory|brainstorm)\b/i;
const MECHANICAL_SIGNAL = /\b(pnpm test|vitest|playwright)\b/;

export function classifyReplayTier(
  prdContent: string,
  frontmatter: Record<string, string>,
): ReplayTierDecision {
  // Branch 1 — creative signal wins first. A brainstorm PRD that happens to
  // mention `pnpm test` in prose should surface honestly as creative, not
  // masquerade as mechanical validation.
  if (CREATIVE_SIGNAL.test(prdContent)) {
    return { replay_tier: 'none', replay_waiver_reason: 'creative' };
  }

  const { total, passed } = countIscFromContent(prdContent);
  const allGreen = total > 0 && total === passed;

  // Branch 2 — mechanical signal: a test command was referenced and every ISC
  // passed. The tests-passing + ISC-gate-green combination already delivers
  // stronger mechanical validation than replay would add.
  if (MECHANICAL_SIGNAL.test(prdContent) && allGreen) {
    return { replay_tier: 'none', replay_waiver_reason: 'cost_exceeds_value' };
  }

  // Branch 3 — standard-effort PRD with all ISCs green: same rationale. The
  // effort-tier signal substitutes for the explicit test-command signal.
  if (frontmatter.effort === 'standard' && allGreen) {
    return { replay_tier: 'none', replay_waiver_reason: 'cost_exceeds_value' };
  }

  // Default — cost of replay exceeds its marginal value for LLM-driven PRDs
  // under hosted-API operation (§6.1 disqualifies `strict`; semantic replay
  // needs a context bundle this phase does not build).
  return { replay_tier: 'none', replay_waiver_reason: 'cost_exceeds_value' };
}
