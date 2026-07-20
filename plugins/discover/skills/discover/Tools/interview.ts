/**
 * interview — the deterministic, testable core of /discover's INTERVIEW stage (PRD 20260530-225649).
 *
 * The dialogic *asking* is skill prose (judgment); this module owns the parts that must be exact:
 * the question schedule (4-5 cap, exactly ONE mandatory = the named constraint, depth parameterized
 * by scope) and the DERIVE-OR-ESCALATE resolution (never a bare REFUSE). Prompts are plain language —
 * no DDD / use-case / methodology jargon reaches the operator (ANTI-6). This module never routes
 * SKIP-vs-RUN or picks build-order stages (ANTI-8) — it only surfaces a scope signal.
 */

export type Scope = 'small' | 'large';

export interface Question { id: string; prompt: string; mandatory: boolean; }
export interface Schedule { questions: Question[]; scopeSignal: Scope; }

// The mandatory constraint question, plain-language. Cites live kit tier names when available (ISC-39).
function mandatoryQuestion(tierNames: string[]): Question {
  const hint = tierNames.length ? ` (for example: ${tierNames.slice(0, 3).join(', ')})` : '';
  return {
    id: 'constraint',
    mandatory: true,
    prompt: `What is the one rule this feature must respect before any database design — the shape everything else has to fit around${hint}?`,
  };
}

const ADAPTIVE: Question[] = [
  { id: 'actor', mandatory: false, prompt: 'Who kicks this off, and what does a good result look like for them?' },
  { id: 'boundary', mandatory: false, prompt: 'What should this feature deliberately NOT do — where are its edges?' },
  { id: 'quality', mandatory: false, prompt: 'What is the quality bar here — who owns the data, any privacy or tenancy limits?' },
  { id: 'scope', mandatory: false, prompt: 'How large is this — a single change, or does it reach into accounts, billing, or many tenants?' },
];

/** Build the question schedule. small -> 4 questions, large -> 5 (ISC-33/34/35/38). */
export function buildInterview(scope: Scope, tierNames: string[] = []): Schedule {
  const depth = scope === 'large' ? 5 : 4;
  const questions = [mandatoryQuestion(tierNames), ...ADAPTIVE].slice(0, depth);
  return { questions, scopeSignal: scope };
}

export type ConstraintResolution = { status: 'named' | 'derived' | 'escalate'; constraint: string | null };

/**
 * Resolve the mandatory constraint answer (ISC-40, ANTI-7). A non-empty answer is taken as named; a
 * blank answer triggers a derivation attempt FIRST; only if derivation yields nothing do we escalate
 * (route to RUN feature-discovery) — a bare REFUSE is never the operator's first experience.
 */
export function resolveConstraint(
  answer: string,
  derive: (ctx: string) => string | null = () => null,
  ctx = '',
): ConstraintResolution {
  const a = (answer ?? '').trim();
  if (a) return { status: 'named', constraint: a };
  const derived = derive(ctx);
  if (derived) return { status: 'derived', constraint: derived };
  return { status: 'escalate', constraint: null };
}
