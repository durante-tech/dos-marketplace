#!/usr/bin/env bun
// FastapiCli.ts — deterministic gate helpers for the DeliverFeature workflow.
//
// Two gate verdicts relocated out of Workflows/DeliverFeature.md prose:
//
//   1. validateDecomposeGate() + renderDecomposeGate() — the Phase 1.5
//      decompose-gate verdict (OK vs BLOCKED) over a prd-projector record, and
//      the one-line operator-facing status string. Sibling to
//      MakerkitTeam/Tools/MakerkitCli.ts decompose-gate.
//
//   2. validateShipsWithTestsGate() + renderShipsWithTestsGate() — the Phase 6
//      G6 pyramid-complete verdict over the six ships-with-tests checks defined
//      in `_test-pyramid-gate.md`. The six booleans are agent-determined per run
//      (unit-green, integration-green, run_checks clean, async discipline,
//      bootstrap-fixture usage, per-ISC layer mapping); this helper owns the
//      deterministic AND-gate + the byte-preserved status line.

import { readStdin } from './_shared';

// Glyph bytes carried verbatim from the operator-facing templates (not code
// decoration). Named as escapes so the source stays ASCII.
const GLYPH_CLIPBOARD = '\u{1F4CB}';
const SEP_DOT = '·';
const SEP_DASH = '—';

// ---------------------------------------------------------------------------
// Phase 1.5 — Decompose-gate verdict + render
//
// Prose mandate (DeliverFeature.md Phase 1.5):
//   - placeholder_isc_present: false   (PRD has no placeholder section)
//   - isc_count matches operator-approved scope at G1 within +/-10%
//   - fat_isc_count: 0  OR  each fat-criterion ISC has a pairing-exception line
//
// Output template (byte-preserved, including the U+1F4CB clipboard glyph, the
// U+00B7 middle-dot separators, and the U+2014 em-dash before the verdict):
//   "<glyph> DECOMPOSE-GATE: <slug> · isc_count=N · placeholder=false · fat=0 — OK"
// On failure the trailing token becomes "BLOCKED" and the reason is appended.
// ---------------------------------------------------------------------------

// A prd-projector `characterize` record (only the fields the gate reads).
export interface PrdProjectorRecord {
  placeholder_isc_present: boolean;
  isc_count: number;
  fat_isc_count: number;
  // true when every fat-criterion ISC carries a `pairing-exception:` line (R70).
  fat_pairings_satisfied?: boolean;
}

export interface DecomposeGateResult {
  ok: boolean;
  iscCount: number;
  placeholderPresent: boolean;
  fatCount: number;
  reasons: string[];
}

// Pure gate evaluation. `expectedIscCount` is the operator-approved G1 scope.
// isc_count must be within +/-10% of the expected count (inclusive).
export function validateDecomposeGate(
  record: PrdProjectorRecord,
  expectedIscCount: number,
): DecomposeGateResult {
  const reasons: string[] = [];

  if (record.placeholder_isc_present) {
    reasons.push('placeholder ISC section present');
  }

  const lower = expectedIscCount * 0.9;
  const upper = expectedIscCount * 1.1;
  if (record.isc_count < lower || record.isc_count > upper) {
    reasons.push(
      `isc_count ${record.isc_count} outside +/-10% of approved scope ${expectedIscCount}`,
    );
  }

  if (record.fat_isc_count > 0 && record.fat_pairings_satisfied !== true) {
    reasons.push(
      `${record.fat_isc_count} fat ISC(s) without pairing-exception (R70)`,
    );
  }

  return {
    ok: reasons.length === 0,
    iscCount: record.isc_count,
    placeholderPresent: record.placeholder_isc_present,
    fatCount: record.fat_isc_count,
    reasons,
  };
}

// Render the one-line decompose-gate status. Byte-identical to the prose template:
//   "<clipboard> DECOMPOSE-GATE: <slug> . isc_count=N . placeholder=false . fat=0 - OK"
// (dots = U+00B7, dash = U+2014). On BLOCKED the reasons are appended after the verdict.
export function renderDecomposeGate(slug: string, result: DecomposeGateResult): string {
  const head =
    `${GLYPH_CLIPBOARD} DECOMPOSE-GATE: ${slug} ${SEP_DOT} ` +
    `isc_count=${result.iscCount} ${SEP_DOT} ` +
    `placeholder=${result.placeholderPresent} ${SEP_DOT} ` +
    `fat=${result.fatCount} ${SEP_DASH} `;
  if (result.ok) return head + 'OK';
  return head + 'BLOCKED: ' + result.reasons.join('; ');
}

// ---------------------------------------------------------------------------
// Phase 6 G6 — Ships-with-tests pyramid-complete verdict + render
//
// Prose mandate (DeliverFeature.md G6 + `_test-pyramid-gate.md` "The Ships-With-Tests
// Gate"): all six checks must be green before G6 closes. The six booleans are
// agent-determined per run; this gate owns the deterministic AND over them and the
// labelled failure list, so the OK/BLOCKED decision is not hand-applied in prose.
//
//   1. Unit-layer green
//   2. Integration-layer green
//   3. run_checks clean (ruff + mypy + pytest)
//   4. Async discipline (@pytest.mark.asyncio on every async test)
//   5. Bootstrap-fixture usage (no UI login round-trip unless testing login)
//   6. Per-ISC layer mapping documented
//
// Output template (byte-preserved):
//   "<glyph> SHIPS-WITH-TESTS: <slug> · 6/6 — OK"
// On failure: "<glyph> SHIPS-WITH-TESTS: <slug> · N/6 — BLOCKED: <failed labels>".
// ---------------------------------------------------------------------------

export interface ShipsWithTestsChecks {
  unitGreen: boolean;
  integrationGreen: boolean;
  runChecksClean: boolean;
  asyncDiscipline: boolean;
  bootstrapFixtureUsage: boolean;
  perIscLayerMapping: boolean;
}

export interface ShipsWithTestsGateResult {
  ok: boolean;
  passedCount: number;
  totalCount: number;
  failedLabels: string[];
}

// Fixed checklist — order is load-bearing for the operator-facing failure list
// and mirrors the six numbered checks in `_test-pyramid-gate.md`.
const SHIPS_WITH_TESTS_CHECKS: ReadonlyArray<{
  key: keyof ShipsWithTestsChecks;
  label: string;
}> = [
  { key: 'unitGreen', label: 'unit-layer green' },
  { key: 'integrationGreen', label: 'integration-layer green' },
  { key: 'runChecksClean', label: 'run_checks clean (ruff + mypy + pytest)' },
  { key: 'asyncDiscipline', label: 'async discipline' },
  { key: 'bootstrapFixtureUsage', label: 'bootstrap-fixture usage' },
  { key: 'perIscLayerMapping', label: 'per-ISC layer mapping documented' },
];

// Pure gate evaluation. All six checks must be true for OK. Any false check
// is named in failedLabels (in checklist order).
export function validateShipsWithTestsGate(
  checks: ShipsWithTestsChecks,
): ShipsWithTestsGateResult {
  const failedLabels: string[] = [];
  for (const { key, label } of SHIPS_WITH_TESTS_CHECKS) {
    if (checks[key] !== true) failedLabels.push(label);
  }
  const totalCount = SHIPS_WITH_TESTS_CHECKS.length;
  return {
    ok: failedLabels.length === 0,
    passedCount: totalCount - failedLabels.length,
    totalCount,
    failedLabels,
  };
}

// Render the one-line G6 status. Byte-identical separators to the decompose line
// (dots = U+00B7, dash = U+2014). On BLOCKED the failed labels are appended.
export function renderShipsWithTestsGate(
  slug: string,
  result: ShipsWithTestsGateResult,
): string {
  const head =
    `${GLYPH_CLIPBOARD} SHIPS-WITH-TESTS: ${slug} ${SEP_DOT} ` +
    `${result.passedCount}/${result.totalCount} ${SEP_DASH} `;
  if (result.ok) return head + 'OK';
  return head + 'BLOCKED: ' + result.failedLabels.join('; ');
}

// CLI entry: subcommand dispatch.
//   echo '{"record":{...},"expectedIscCount":N,"slug":"..."}' | bun FastapiCli.ts decompose-gate
//   echo '{"checks":{...},"slug":"..."}'                      | bun FastapiCli.ts ships-with-tests-gate
if (import.meta.main) {
  const sub = process.argv[2];
  const input = JSON.parse(await readStdin());
  if (sub === 'decompose-gate') {
    const result = validateDecomposeGate(input.record, input.expectedIscCount);
    process.stdout.write(renderDecomposeGate(input.slug, result) + '\n');
    if (!result.ok) process.exit(1);
  } else if (sub === 'ships-with-tests-gate') {
    const result = validateShipsWithTestsGate(input.checks);
    process.stdout.write(renderShipsWithTestsGate(input.slug, result) + '\n');
    if (!result.ok) process.exit(1);
  } else {
    process.stderr.write(
      'usage: FastapiCli.ts <decompose-gate|ships-with-tests-gate>  (JSON on stdin)\n',
    );
    process.exit(2);
  }
}
