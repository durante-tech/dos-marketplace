/**
 * phase-gate-classify.ts — pure block-vs-warn partition for PhaseCompleteGate.
 *
 * Extracted as a pure function (mirrors lib/subagent-reconcile.ts + lib/coverage-check.ts —
 * "decision rule defined once") so the gate's block-vs-warn decision is unit-testable
 * WITHOUT driving PhaseCompleteGate.hook.ts's top-level stdin/exec path.
 *
 * A failed check tagged `severity: 'warn'` is surfaced (observe) but never blocks
 * `phase: complete`. A failed check with NO severity defaults to BLOCKING — so every
 * existing check keeps its current behavior unless explicitly staged to warn.
 *
 * Staged-warn lever added 2026-05-29 so Amendment G reconciliation can collect ledger
 * data in observe-mode before it is flipped to blocking. Spec: RFC-0060.
 */
export interface ClassifiableCheck {
  name: string;
  passed: boolean;
  severity?: 'block' | 'warn';
}

export interface FailureClassification<T> {
  failedBlocking: T[];
  failedWarn: T[];
}

export function classifyFailures<T extends ClassifiableCheck>(checks: T[]): FailureClassification<T> {
  const failed = checks.filter((c) => !c.passed);
  return {
    failedBlocking: failed.filter((c) => c.severity !== 'warn'),
    failedWarn: failed.filter((c) => c.severity === 'warn'),
  };
}
