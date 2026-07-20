import { getScalarField } from './prd-utils';
// V12.3 canary migration (RFC-0082 §1): Frontmatter type now sourced from
// @durante/prd (RFC-0081 shared parser library). Runtime function getScalarField
// stays from local prd-utils until the broader shim wiring lands (V12.3-β).
import type { Frontmatter } from '@durante/prd';
import type { BridgeOp } from './mempalace';

export interface HookPayload {
  tool_input?: {
    file_path?: unknown;
  };
}

export function prdPathFromHookPayload(input: HookPayload | null | undefined): string | null {
  const filePath = input?.tool_input?.file_path;
  if (typeof filePath !== 'string') return null;
  if (!filePath.includes('MEMORY/WORK/')) return null;
  if (!filePath.endsWith('PRD.md')) return null;
  return filePath;
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function buildPrdPhaseOp(
  fm: Frontmatter | null | undefined,
  oldPhase: string | null | undefined,
  validFrom: string = todayIsoDate(),
): BridgeOp | null {
  const slug = getScalarField(fm, 'slug')?.trim();
  const phase = getScalarField(fm, 'phase')?.trim();
  if (!slug || !phase) return null;

  const newPhase = phase.toLowerCase();
  const priorPhase = oldPhase?.trim().toLowerCase() ?? '';
  const isTransition = priorPhase !== '' && priorPhase !== newPhase;

  return {
    action: 'add_kg_fact',
    args: {
      subject: slug,
      predicate: isTransition ? 'phase_transition' : 'phase',
      object: newPhase,
      valid_from: validFrom,
      confidence: 1.0,
    },
  };
}

// Closes [R-session-attribution-3] — doctrine prescribes worked_on at OBSERVE-end
// (Algorithm v0.0.7-enhanced §6.1, sub-docs/memory-integration.md §1.8) but no
// hook produced it. PhaseCompleteGate enforces existence at LEARN; this builder
// emits the matching write so each session that touches a PRD attests its work.
//
// Fires when EITHER (a) this is the first PRD edit for the slug (oldPhase empty),
// OR (b) the registry's recorded sessionUUID differs from the current session
// (resumed-PRD case — a later session walks an existing PRD to phase: complete
// and the gate would otherwise block on missing per-session attribution).
export function buildPrdSessionWorkedOnOp(
  fm: Frontmatter | null | undefined,
  oldPhase: string | null | undefined,
  sessionId: string | null | undefined,
  priorSessionUUID?: string | null,
  validFrom: string = todayIsoDate(),
): BridgeOp | null {
  const slug = getScalarField(fm, 'slug')?.trim();
  if (!slug) return null;
  if (!sessionId || sessionId === 'unknown') return null;

  const isFirstWrite = (oldPhase ?? '').trim() === '';
  const isResumedByDifferentSession = !!priorSessionUUID && priorSessionUUID !== sessionId;
  if (!isFirstWrite && !isResumedByDifferentSession) return null;

  return {
    action: 'add_kg_fact',
    args: {
      subject: `session-${sessionId}`,
      predicate: 'worked_on',
      object: slug,
      valid_from: validFrom,
      confidence: 1.0,
    },
  };
}
