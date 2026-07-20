/**
 * coverage-check.ts — pure ISC Coverage Saturation decision logic
 * (PRD 20260520-194114_isc-coverage-saturation, WS-5).
 *
 * Shared by PhaseCompleteGate.hook.ts (the gate consumer) and the test suite,
 * so the rule is DEFINED ONCE (ISC-39 / ISC-51 — mirrors subagent-reconcile.ts).
 * No filesystem access — callers read the subprocess JSON, the PRD body, and
 * the session transcript and pass strings/data in; this keeps the logic
 * deterministically unit-testable.
 *
 * This module is the OBSERVE-side mirror of subagent-reconcile.ts (the
 * EXECUTE-side Amendment G reconciliation). A `📐 COVERED:` discharge/waive
 * line mirrors Amendment G's `📐 RECONCILED:` line; the `## Coverage Log`
 * section mirrors `## Reconciliation Log`.
 *
 * ── Provenance of the re-declared shapes below ───────────────────────────
 * CoverageReport, Obligation, COVERED_LINE_RE, COVERAGE_LOG_HEADING below
 * mirror Tools/lib/coverage-types.ts — see WS-0 contract; intentional
 * duplication per customer-install isolation (subagent-reconcile.ts/
 * LedgerEntry precedent). A shipped hook lib cannot statically import from
 * ~/Durante/Tools/* (absent on customer installs → fatal module-load error).
 * coverage-types.ts remains the SPEC of record; this is the documented
 * known-debt of Council D1.
 * ─────────────────────────────────────────────────────────────────────────
 */

// ════ Re-declared contract shapes (mirror Tools/lib/coverage-types.ts) ════

/** One concrete obligation: an implied artifact a touched file requires. */
export interface Obligation {
  /** ruleId of the ConventionRule that produced this obligation. */
  ruleId: string;
  /** The implied artifact — a path, or a path-like descriptor. */
  impliedFile: string;
  /** Why — what impliedFile IS (e.g. "submodule copy", "companion test"). */
  impliedRole: string;
  /** The touched file that armed the rule. */
  triggeredBy: string;
}

export type CoverageStatus = 'clean' | 'undischarged' | 'error';

/**
 * `isc-coverage.ts --format json` emits this shape on stdout. Re-declared as a
 * structural subset of the contract's CoverageReport — see the provenance note.
 */
export interface CoverageReport {
  slug: string;
  prdPath: string;
  touchedFiles: string[];
  matchedRuleIds: string[];
  obligations: Obligation[];
  discharged: Obligation[];
  undischarged: Obligation[];
  status: CoverageStatus;
  /** Populated only when status === 'error' — the fail-safe path. */
  error?: string;
}

/** The canonical PRD section heading for the discharge/waive ledger. */
export const COVERAGE_LOG_HEADING = '## Coverage Log';

/**
 * Canonical `📐 COVERED:` line grammar — copied VERBATIM from
 * Tools/lib/coverage-types.ts COVERED_LINE_RE (see the provenance note above;
 * this file cannot import the contract).
 *
 * Capture groups: 1=rule-id 2=implied-file 3=status 4=isc 5=reason
 */
export const COVERED_LINE_RE =
  /^\s*📐 COVERED:\s+rule=(\S+)\s+file=(\S+)\s+status=(discharged|waived)(?:\s+isc=(\S+))?(?:\s+reason=(.+?))?\s*$/;

export type CoveredStatus = 'discharged' | 'waived';

/** A parsed `📐 COVERED:` line. */
export interface CoveredLine {
  ruleId: string;
  file: string;
  status: CoveredStatus;
  /** Present iff status === 'discharged'. */
  isc?: string;
  /** Present iff status === 'waived'. */
  reason?: string;
  /** false when the line matched the RegExp but failed status⇒field validation. */
  wellFormed: boolean;
}

// ════ transcript-E extraction (ISC-38) ═══════════════════════════════════

/**
 * Extract the explored file set E from a Claude Code session transcript.
 *
 * Each transcript line is a JSONL record; an assistant message carries a
 * `message.content[]` array whose `tool_use` blocks describe tool calls. We
 * collect:
 *   - Read tool calls       → `input.file_path`
 *   - Grep / Glob tool calls → `input.path` (the search root, when present)
 *
 * Its own pure, testable function (ISC-38) — no filesystem access, lines in,
 * Set out. A structural undercount by construction (Grep/Glob target a root
 * not a file; subagent reads are invisible) — its result feeds a WARN only,
 * NEVER a hard block (ISC-32 / Council D3). Unparseable lines are skipped so
 * a malformed transcript can never throw.
 */
export function extractExploredSet(transcriptLines: string[]): Set<string> {
  const explored = new Set<string>();
  const READ_TOOLS = new Set(['Read', 'NotebookRead']);
  const TARGET_TOOLS = new Set(['Grep', 'Glob']);

  for (const line of transcriptLines) {
    if (!line.trim()) continue;
    let record: unknown;
    try {
      record = JSON.parse(line);
    } catch {
      continue; // skip unparseable line — fail open (ISC-32 never throws)
    }

    // Tool-use blocks may live on an assistant message's content array, or —
    // depending on transcript shape — directly on the record. Handle both.
    const content =
      (record as { message?: { content?: unknown } })?.message?.content ??
      (record as { content?: unknown })?.content;
    if (!Array.isArray(content)) continue;

    for (const block of content) {
      if (!block || typeof block !== 'object') continue;
      const b = block as { type?: string; name?: string; input?: Record<string, unknown> };
      if (b.type !== 'tool_use' || !b.name || !b.input) continue;

      if (READ_TOOLS.has(b.name)) {
        const fp = b.input.file_path;
        if (typeof fp === 'string' && fp) explored.add(fp);
      } else if (TARGET_TOOLS.has(b.name)) {
        const p = b.input.path;
        if (typeof p === 'string' && p) explored.add(p);
      }
    }
  }

  return explored;
}

// ════ Coverage decision (ISC-35, ISC-36, ISC-37) ═════════════════════════

export interface CoverageCheckResult {
  passed: boolean;
  evidence: string;
  remediation: string;
}

export interface CoverageCheckInput {
  /**
   * Parsed CoverageReport from `isc-coverage.ts --format json` — the
   * INDEPENDENT obligation resolution (ISC-34). `null` when the tool is
   * absent / errored / its output was unparseable — fails OPEN (ISC-36).
   */
  report: CoverageReport | null;
  /** Full PRD.md text ('' when unreadable). */
  prdBody: string;
  /** Raw JSONL lines from the session transcript ([] when absent). */
  transcriptLines: string[];
  /** PRD slug — for evidence/remediation prose. */
  slug: string;
  /** Session-override `coverage: "skip"` (ISC-37). */
  overrideSkip?: boolean;
  overrideReason?: string;
}

/**
 * Parse `📐 COVERED:` discharge/waive lines, scoped to the `## Coverage Log`
 * section ONLY. Mirrors subagent-reconcile.ts scoping `📐 RECONCILED:` to
 * `## Reconciliation Log` — a line quoted in `## Decisions` prose or a code
 * fence elsewhere must not satisfy the gate (ISC-33).
 */
function parseCoverageLog(prdBody: string): CoveredLine[] {
  const lines: CoveredLine[] = [];
  let inLog = false;
  for (const l of prdBody.split('\n')) {
    if (/^## /.test(l)) {
      // The contract heading is `## Coverage Log`; match it exactly.
      inLog = l.trimEnd() === COVERAGE_LOG_HEADING;
      continue;
    }
    if (!inLog) continue;
    const m = l.match(COVERED_LINE_RE);
    if (!m) continue;
    const [, ruleId, file, statusRaw, isc, reason] = m;
    const status = statusRaw as CoveredStatus;
    // Permissive RegExp, then validate status⇒field: discharged needs isc,
    // waived needs a non-empty reason. A malformed line is marked
    // wellFormed:false rather than silently mis-bucketed.
    const wellFormed =
      status === 'discharged'
        ? Boolean(isc)
        : Boolean(reason && reason.trim());
    lines.push({ ruleId, file, status, isc, reason, wellFormed });
  }
  return lines;
}

/** The (ruleId, impliedFile) key an obligation and a Coverage Log line share. */
function obligationKey(ruleId: string, file: string): string {
  return `${ruleId} ${file}`;
}

/**
 * Decide whether the PRD's resolved convention obligations are all
 * discharged-or-waived.
 *
 * - HARD-BLOCKS (passed:false) iff a resolved obligation is neither
 *   discharged nor waived-with-reason in the `## Coverage Log` (ISC-35).
 * - The CoverageReport is the INDEPENDENT obligation source (ISC-34) — the
 *   gate does NOT merely trust the Coverage Log: an obligation the agent
 *   never wrote a `📐 COVERED:` line for still blocks.
 * - transcript-E (extractExploredSet) feeds a WARN inside `evidence` only,
 *   NEVER blocks (ISC-32 / Council D3).
 * - Fails OPEN: `report === null` (tool absent / errored), `report.status
 *   === 'error'`, or zero obligations → passed:true (ISC-36).
 * - Honors overrideSkip → passed:true (ISC-37).
 */
export function coverageCheck(input: CoverageCheckInput): CoverageCheckResult {
  const { report, prdBody, transcriptLines, slug, overrideSkip, overrideReason } = input;

  // ISC-37 — session-override takes precedence over everything.
  if (overrideSkip) {
    return {
      passed: true,
      evidence: `session-override coverage=skip (reason: ${overrideReason || 'unspecified'})`,
      remediation: '',
    };
  }

  // ISC-36 — fail OPEN when there is no independent obligation resolution to
  // judge against: the tool was absent, the subprocess errored, or its JSON
  // was unparseable (caller passes null), or the tool reported its own IO
  // error. NEVER a false block.
  if (!report) {
    return {
      passed: true,
      evidence: `isc-coverage.ts produced no parseable CoverageReport for ${slug} — coverage check fails open`,
      remediation: '',
    };
  }
  if (report.status === 'error') {
    return {
      passed: true,
      evidence: `isc-coverage.ts reported status=error for ${slug} (${report.error || 'no detail'}) — coverage check fails open`,
      remediation: '',
    };
  }

  const obligations = report.obligations || [];
  if (obligations.length === 0) {
    return {
      passed: true,
      evidence: `0 convention obligations resolved for ${slug} — nothing to discharge`,
      remediation: '',
    };
  }

  // The discharge/waive ledger, scoped to `## Coverage Log` only (ISC-33).
  const coveredLines = parseCoverageLog(prdBody);
  const dischargedKeys = new Set<string>();
  const waivedKeys = new Set<string>();
  const malformedKeys = new Set<string>();
  for (const cl of coveredLines) {
    const key = obligationKey(cl.ruleId, cl.file);
    if (!cl.wellFormed) {
      malformedKeys.add(key);
      continue;
    }
    if (cl.status === 'discharged') dischargedKeys.add(key);
    else waivedKeys.add(key);
  }

  // ISC-34/ISC-35 — independently walk the resolved obligations; a resolved
  // obligation neither discharged nor waived-with-reason is the deterministic
  // HARD-BLOCK condition. Skipping the §6.1.e8 substep does NOT skip the gate.
  const unresolved: Obligation[] = [];
  const malformedObligations: Obligation[] = [];
  for (const ob of obligations) {
    const key = obligationKey(ob.ruleId, ob.impliedFile);
    if (dischargedKeys.has(key) || waivedKeys.has(key)) continue;
    if (malformedKeys.has(key)) {
      // A `📐 COVERED:` line exists but failed status⇒field validation —
      // report it as malformed, and still treat the obligation as unresolved
      // so a half-written line cannot pass the gate.
      malformedObligations.push(ob);
    }
    unresolved.push(ob);
  }

  // transcript-E — WARN only, never blocks (ISC-32). Surface how many of the
  // touched files the transcript shows the session actually opened, so a
  // coverage gap (a touched file the session never explored) is visible.
  const exploredSet = extractExploredSet(transcriptLines);
  const touched = report.touchedFiles || [];
  const unexplored = touched.filter((f) => !exploredSet.has(f));
  const transcriptWarn =
    transcriptLines.length > 0 && unexplored.length > 0
      ? ` ⚠ transcript-E: ${unexplored.length} of ${touched.length} touched file(s) show no Read/Grep/Glob in the transcript ` +
        `(${unexplored.slice(0, 3).join(', ')}${unexplored.length > 3 ? ', …' : ''}) — possible coverage gap, non-blocking`
      : '';

  if (unresolved.length > 0) {
    const sample = unresolved
      .slice(0, 5)
      .map((o) => `rule=${o.ruleId} file=${o.impliedFile} (${o.impliedRole})`)
      .join('; ');
    const malformedNote =
      malformedObligations.length > 0
        ? ` (${malformedObligations.length} of these have a malformed "📐 COVERED:" line — a discharged line needs isc=<ISC-N>, a waived line needs reason=<text>)`
        : '';
    return {
      passed: false,
      evidence:
        `${unresolved.length} of ${obligations.length} convention obligation(s) for ${slug} are neither ` +
        `discharged nor waived in "${COVERAGE_LOG_HEADING}"${malformedNote}: ${sample}${unresolved.length > 5 ? '; …' : ''}` +
        transcriptWarn,
      // ISC-40 — concrete discharge/waive remediation.
      remediation:
        `Run Algorithm §6.1.e8 (ISC Coverage Saturation): \`bun ~/Durante/Tools/isc-coverage.ts --slug ${slug} --format human\` ` +
        `to list the undischarged obligations, then for EACH add a line to the PRD's "${COVERAGE_LOG_HEADING}" section — ` +
        `discharge it (explore the implied file + author an ISC): ` +
        `"📐 COVERED: rule=<rule-id> file=<implied-file> status=discharged isc=<ISC-N>", ` +
        `or waive it (record why it does not apply): ` +
        `"📐 COVERED: rule=<rule-id> file=<implied-file> status=waived reason=<free text>". ` +
        `${unresolved.length} obligation(s) outstanding.`,
    };
  }

  return {
    passed: true,
    evidence:
      `all ${obligations.length} convention obligation(s) for ${slug} are discharged-or-waived in "${COVERAGE_LOG_HEADING}" ` +
      `(${dischargedKeys.size} discharged, ${waivedKeys.size} waived)` +
      transcriptWarn,
    remediation: '',
  };
}
