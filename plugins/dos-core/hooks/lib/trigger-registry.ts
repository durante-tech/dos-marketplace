/**
 * TRIGGER_REGISTRY — RFC-0154 (ACCEPTED 2026-07-08): typed task-shape →
 * capability joins with obligations. The registry is inert data until the
 * operator advances DOS_TRIGGER_REGISTRY_MODE past 'off' AND Amendment N
 * (§6.1.k3 TRIGGER-MATCH) is flipped ACTIVE.
 *
 * Row-shape discipline (RFC-0154 §3, SandiMetz-reviewed): the smallest thing
 * that works. No schema field ships without a seed row populating it; no
 * mandatory row fires on keywords alone (structural-pairing, Fowler).
 * One canonical matcher — matchTriggerRows() — is the single core called by
 * both the doctrine substep and any future hook adapter (Cockburn).
 */

export type TriggerObligation = 'mandatory-or-declined' | 'advisory';

/**
 * Amendment R §R.1-companion pilot (R1, 2026-07-08): trigger-class taxonomy.
 * 'explicit' — task names the capability or its signature phrase (default).
 * 'proactive' — task-shape condition fires without the skill being named
 *   (structural repo gates, deliverable-shape keywords).
 * 'specification' — a noun-phrase deliverable that IS the capability's output
 *   ("pitch deck"); the spec is the request, no verb needed.
 * PILOT SCOPE: telemetry/selection-display dimension ONLY — classes do not
 * change matching behavior. Doctrine-wide adoption is gated on warn-mode
 * precision telemetry per the RFC-0154 promotion criteria (red-team condition:
 * an unbounded specification class repeats the 121:0 advisory-graveyard shape).
 */
export type TriggerClass = 'explicit' | 'proactive' | 'specification';

/** §1.2 profiles TRIGGER-MATCH runs under; all others are an explicit no-op. */
export const TRIGGER_ELIGIBLE_PROFILES = ['standard', 'multi-file', 'strategic'] as const;

export interface TriggerRow {
  /** kebab, stable — decline lines cite it. */
  id: string;
  /** Registry-resolvable skill/workflow id (RFC-0026). */
  capability: string;
  obligation: TriggerObligation;
  /** STRUCTURAL field: repo-root basename substrings. REQUIRED for mandatory rows. */
  repos?: string[];
  /** FUZZY field: lowercase task-text substrings. */
  keywordsAny?: string[];
  /** ≤16 words, shown in the selection block. */
  reason: string;
  /** Trigger-class pilot (R1): telemetry dimension, absent = 'explicit'. */
  triggerClass?: TriggerClass;
}

export interface TriggerMatchResult {
  rows: TriggerRow[];
  /** Non-empty when matching was skipped (profile gate / mode off). */
  skippedReason?: string;
}

export const TRIGGER_REGISTRY: TriggerRow[] = [
  {
    id: 'kit-feature-makerkit',
    capability: 'makerkit-team',
    obligation: 'mandatory-or-declined',
    repos: ['dos-prisma-saas-kit', 'next-prisma-kit', 'prisma-saas'],
    keywordsAny: ['feature', 'deliver', 'build', 'ship'],
    reason: 'Kit delivery team owns kit feature motions',
  },
  {
    id: 'feature-scope-archetypes',
    capability: 'archetypes/SeedScope',
    obligation: 'mandatory-or-declined',
    repos: ['dos-prisma-saas-kit', 'next-prisma-kit', 'prisma-saas', 'dos-fastapi-starter'],
    keywordsAny: ['feature', 'user-facing', 'new capability'],
    reason: 'T1 rows built-or-deferred, never silently absent',
  },
  {
    id: 'fastapi-feature-team',
    capability: 'fastapi-starter-team',
    obligation: 'mandatory-or-declined',
    repos: ['dos-fastapi-starter'],
    keywordsAny: ['feature', 'deliver', 'build', 'ship'],
    reason: 'Starter team owns starter feature motions',
  },
  {
    id: 'media-output',
    capability: 'media',
    obligation: 'advisory',
    keywordsAny: ['image', 'video', 'diagram', 'thumbnail', 'audio'],
    reason: 'media pack owns generation pipelines',
    // R1 proactive pilot: deliverable-shape keywords, skill never named.
    triggerClass: 'proactive',
  },
  {
    // R1 specification pilot: the noun phrase IS the deliverable — a "pitch
    // deck" request needs no verb to be a pitch-deck task. Advisory-only by
    // pilot rule; promotion gated on precision telemetry (RFC-0154 §13).
    // Deliberately repo-unscoped (pilot posture): bare-substring looseness is
    // the thing the precision gate measures — do NOT copy this shape for new
    // rows without the gate, and never promote it to mandatory (validated).
    id: 'pitch-deck-specification',
    capability: 'pitch-deck',
    obligation: 'advisory',
    keywordsAny: ['pitch deck', 'sales deck', 'outbound deck', 'prospect deck'],
    reason: 'Noun-phrase deliverable is the request (specification pilot)',
    triggerClass: 'specification',
  },
  {
    id: 'repo-conventions-sentinel',
    capability: 'sentinel',
    obligation: 'advisory',
    keywordsAny: ['onboard', 'conventions', 'new repo', 'initialize'],
    reason: 'Sentinel owns convention discovery',
  },
];

/**
 * The ONE canonical matcher (RFC-0154 §3/§4). Match rule, stated plainly:
 * a row matches when `repos` (if present) matches the repo root AND any
 * `keywordsAny` entry substring-hits the lowercased task text.
 * Profile gate: non-eligible profiles return zero rows with a skippedReason —
 * callers MUST surface it (explicit no-op print, never a silent skip).
 */
export function matchTriggerRows(
  taskText: string,
  repoRoot: string,
  profile: string = 'standard',
): TriggerMatchResult {
  if (!(TRIGGER_ELIGIBLE_PROFILES as readonly string[]).includes(profile)) {
    return { rows: [], skippedReason: `n/a (profile=${profile})` };
  }
  const text = taskText.toLowerCase();
  const repo = repoRoot.toLowerCase();
  const rows = TRIGGER_REGISTRY.filter((row) => {
    // Empty arrays are treated as absent — a [] leg must not silently kill a row.
    const repos = row.repos?.length ? row.repos : undefined;
    const keywords = row.keywordsAny?.length ? row.keywordsAny : undefined;
    if (repos && !repos.some((r) => repo.includes(r.toLowerCase()))) return false;
    if (keywords && !keywords.some((k) => text.includes(k.toLowerCase()))) return false;
    return Boolean(repos || keywords);
  });
  return { rows };
}

/**
 * Registry self-validation (consumed by the trigger-registry-integrity rule):
 * ids unique/kebab, mandatory rows structurally keyed, reasons ≤16 words.
 */
export function validateTriggerRegistry(rows: TriggerRow[] = TRIGGER_REGISTRY): string[] {
  const findings: string[] = [];
  const seen = new Set<string>();
  const kebab = /^[a-z0-9]+(-[a-z0-9]+)*$/;
  for (const row of rows) {
    if (!kebab.test(row.id)) findings.push(`${row.id}: id not kebab-case`);
    if (seen.has(row.id)) findings.push(`${row.id}: duplicate id`);
    seen.add(row.id);
    if (row.obligation === 'mandatory-or-declined' && !(row.repos && row.repos.length > 0)) {
      findings.push(`${row.id}: mandatory row without repos (structural-pairing violation)`);
    }
    if (!row.repos?.length && !row.keywordsAny?.length) {
      findings.push(`${row.id}: no predicate fields — row can never match`);
    }
    if (row.reason.trim().split(/\s+/).length > 16) {
      findings.push(`${row.id}: reason exceeds 16 words`);
    }
    // R1 pilot rule: specification-class rows stay advisory until the
    // precision gate promotes the class (RFC-0154 promotion criteria).
    if (row.triggerClass === 'specification' && row.obligation !== 'advisory') {
      findings.push(`${row.id}: specification-class row must be advisory (pilot rule)`);
    }
  }
  return findings;
}
