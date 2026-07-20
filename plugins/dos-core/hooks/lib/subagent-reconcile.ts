/**
 * subagent-reconcile.ts — pure reconciliation logic for Amendment G
 * (v0.0.10 Part 4, Subagent Return Reconciliation).
 *
 * Shared by PhaseCompleteGate.hook.ts (the gate consumer) and the test suite,
 * so the rule is DEFINED ONCE (RedTeam D1, 2026-05-20). No filesystem access —
 * callers read the session ledger + the PRD body and pass strings in; this
 * keeps the logic deterministically unit-testable.
 */

export interface ReconcileResult {
  passed: boolean;
  evidence: string;
  remediation: string;
}

export interface ReconcileInput {
  /** Raw JSONL lines from the session return-ledger ([] when no ledger exists). */
  ledgerLines: string[];
  /** Full PRD.md text ('' when unreadable). */
  prdBody: string;
  /** PRD slug — ledger entries are filtered to this slug. */
  slug: string;
  /** Session-override `reconcile: "skip"`. */
  overrideSkip?: boolean;
  overrideReason?: string;
}

interface LedgerEntry {
  prd_slug?: string;
  attribution?: string;
  enumerables?: { total?: number };
}

/**
 * Reconcile logged subagent returns against the PRD's `📐 RECONCILED:` lines.
 *
 * - L = ledger entries for this slug; R = `📐 RECONCILED:` lines in the PRD.
 * - Blocks (passed:false) when R < L — a subagent returned without a
 *   reconciliation entry.
 * - When R >= L, passes; surfaces a non-blocking magnitude discrepancy when the
 *   ledger counted far more enumerables than the agent claimed as new ISC.
 * - Fails OPEN: unparseable ledger lines are skipped, empty ledger passes.
 */
export function reconcileCheck(input: ReconcileInput): ReconcileResult {
  const { ledgerLines, prdBody, slug, overrideSkip, overrideReason } = input;

  if (overrideSkip) {
    return {
      passed: true,
      evidence: `session-override reconcile=skip (reason: ${overrideReason || 'unspecified'})`,
      remediation: '',
    };
  }

  const returns: LedgerEntry[] = [];
  let unattributed = 0;
  for (const line of ledgerLines) {
    if (!line.trim()) continue;
    try {
      const e = JSON.parse(line) as LedgerEntry;
      // RFC-0125: a return whose spawn-attribution MISSed records
      // attribution:"fallback"/prd_slug:"unknown". It matches no real sealing
      // slug, so it silently drops from L. Count it separately and surface it
      // so the vacuous pass (and a writer/reader STATE-dir split, which makes
      // EVERY return fall back) is visible — "honest observe-mode" requires this
      // to be 0, or the data under-reports.
      if (e.attribution === 'fallback' || e.prd_slug === 'unknown') unattributed++;
      if (e.prd_slug === slug) returns.push(e);
    } catch { /* skip unparseable line — fail open */ }
  }

  // Observe-mode honesty signal (RFC-0125) — appended to every evidence string.
  const honesty = unattributed > 0
    ? ` | ⚠ ${unattributed} unattributed return(s) (attribution:fallback) — observe-mode data not fully honest until 0 (RFC-0125)`
    : '';

  const L = returns.length;
  if (L === 0) {
    return {
      passed: true,
      evidence: `ledger has 0 returns for ${slug} — nothing to reconcile${honesty}`,
      remediation: '',
    };
  }

  // Count `📐 RECONCILED:` lines only within the `## Reconciliation Log`
  // section — a line quoted in ## Decisions prose or a code fence elsewhere
  // must not inflate R and let a genuinely-missing reconciliation pass.
  let R = 0;
  let claimedNewIsc = 0;
  let inLog = false;
  for (const l of prdBody.split('\n')) {
    if (/^## /.test(l)) { inLog = /^## Reconciliation Log\s*$/.test(l); continue; }
    if (!inLog || !/^\s*📐 RECONCILED:/.test(l)) continue;
    R++;
    const m = l.match(/new-ISC=(\d+)/);
    if (m) claimedNewIsc += parseInt(m[1], 10);
  }

  if (R < L) {
    return {
      passed: false,
      evidence: `${L} subagent return(s) logged for ${slug}, only ${R} "📐 RECONCILED:" line(s) in the PRD${honesty}`,
      remediation:
        `Amendment G §G.2: append one "📐 RECONCILED: subagent=<desc> enumerables=<N> new-ISC=<k>" line per ` +
        `subagent return to the PRD's "## Reconciliation Log" section (${L - R} missing). Run the Recount ` +
        `Procedure (§G.1) and add any genuinely-new ISC-{base}-EX-{N} criteria first.`,
    };
  }

  const ledgerTotal = returns.reduce((s, e) => s + (e.enumerables?.total ?? 0), 0);
  const discrepancy = ledgerTotal > 0 && claimedNewIsc * 4 < ledgerTotal
    ? ` ⚠ discrepancy: ledger counted ${ledgerTotal} enumerables across returns vs ${claimedNewIsc} new-ISC claimed — confirm the recount was honest`
    : '';
  return {
    passed: true,
    evidence: `${R} "📐 RECONCILED:" line(s) cover ${L} logged return(s) for ${slug}${discrepancy}${honesty}`,
    remediation: '',
  };
}
