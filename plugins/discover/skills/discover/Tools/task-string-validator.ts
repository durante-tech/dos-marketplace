/**
 * task-string-validator — the irreducible product of /discover (PRD 20260530-225649).
 *
 * Deterministic gate (ISC-43/44): asserts a prd-isc-fanout task string leads with a NAMED
 * load-bearing constraint, in slot order constraint -> actor -> boundary -> stack, and that the
 * constraint is a domain shape (invariant / aggregate / bounded-context / boundary) — NOT a bare
 * stack-shape (table / endpoint / library). Fails CLOSED (ISC-ANTI-10 / ISC-50) so /discover never
 * emits, and the prd-isc-fanout seam never accepts (D6 companion PRD), a constraint-less string.
 *
 * One module, two call-sites (D1): `/discover` emit path + the fanout-seam guard both import
 * `validateTaskString`. No I/O, no fork reads — pure function (ISC-53). Optional `tierModel` enables
 * the kit-entity resolution check (ISC-49) without coupling the core to disk.
 */

export type Slot = 'constraint' | 'actor' | 'boundary' | 'stack';

export interface Verdict {
  ok: boolean;
  reason: string;
  constraint: string | null;
  slotOrder: Slot[];
  warnings: string[];
}

export interface ValidateOptions {
  /** Enumerated kit tier model (e.g. ['@kit/database', ...] or ['T0'..'T5']); enables ISC-49. */
  tierModel?: string[];
}

// Canonical slot rank — the forced constituent order the fan-out models BEFORE the schema.
const RANK: Record<Slot, number> = { constraint: 0, actor: 1, boundary: 2, stack: 3 };

// Slots are LINE-START labels (e.g. "ACTOR:", "LOAD-BEARING CONSTRAINT (...):"), matched anchored
// and consumed through the first ':' on the label line. Anchoring is load-bearing: the words
// "boundary"/"stack"/"actor" recur INSIDE the constraint prose ("the consistency boundary"), and an
// un-anchored match there would false-positive a slot and corrupt the order check.
const LABELS: { slot: Slot; re: RegExp }[] = [
  { slot: 'constraint', re: /^[ \t]*(?:LOAD[-\s]?BEARING\s+)?CONSTRAINT\b[^\n:]*:/im },
  { slot: 'actor', re: /^[ \t]*ACTOR\b[^\n:]*:/im },
  { slot: 'boundary', re: /^[ \t]*BOUNDARY\b[^\n:]*:/im },
  { slot: 'stack', re: /^[ \t]*STACK\b[^\n:]*:/im },
];

// A bare stack-shape: the WHOLE constraint body is just "<thing> table|endpoint|library|...".
// Anchored ^...$ so it only matches a SHORT bare phrase, never a real invariant sentence.
const STACK_SHAPE =
  /^\W*(?:the\s+|a\s+|an\s+)?[\w./@-]+(?:\s+[\w./@-]+){0,2}\s+(?:tables?|endpoints?|routes?|apis?|librar(?:y|ies)|packages?|modules?|models?|columns?|fields?|components?|hooks?)\W*$/i;

// Domain-shape vocabulary that marks a genuine load-bearing constraint (ISC-47/48).
const ACCEPT_VOCAB =
  /\b(invariant|aggregate|bounded[-\s]context|boundar(?:y|ies)|consistency|must\s+hold|at\s+(?:every\s+)?commit|must\s+not|guarantee|rule|never\b)/i;

const KIT_ENTITY = /@kit\/[\w-]+|\bT[0-5]\b/g;

function firstIndex(hay: string, re: RegExp): number {
  const m = hay.match(re);
  return m && m.index !== undefined ? m.index : -1;
}

/** Validate a prd-isc-fanout task string. Pure + deterministic (ISC-44). */
export function validateTaskString(input: string, opts: ValidateOptions = {}): Verdict {
  const text = input ?? '';
  const warnings: string[] = [];

  // Locate each recognized slot label by first occurrence.
  const found = LABELS
    .map(({ slot, re }) => ({ slot, idx: firstIndex(text, re), len: (text.match(re)?.[0].length ?? 0) }))
    .filter((s) => s.idx >= 0)
    .sort((a, b) => a.idx - b.idx);

  const slotOrder = found.map((s) => s.slot);

  const constraint = found.find((s) => s.slot === 'constraint');
  if (!constraint) {
    return { ok: false, reason: 'fail-closed: no named load-bearing constraint section found', constraint: null, slotOrder, warnings };
  }

  // ISC-45: constraint must be the FIRST recognized slot.
  if (slotOrder[0] !== 'constraint') {
    return { ok: false, reason: `constraint is not in the first slot (found ${slotOrder[0]} first)`, constraint: null, slotOrder, warnings };
  }

  // ISC-46: remaining slots must follow the canonical rank order.
  for (let i = 1; i < found.length; i++) {
    if (RANK[found[i].slot] < RANK[found[i - 1].slot]) {
      return { ok: false, reason: `slots out of order: ${found[i].slot} after ${found[i - 1].slot}`, constraint: null, slotOrder, warnings };
    }
  }

  // Extract the constraint body: from after its label to the next slot label (or end).
  const bodyStart = constraint.idx + constraint.len;
  const nextIdx = found.filter((s) => s.idx > constraint.idx).reduce((min, s) => Math.min(min, s.idx), text.length);
  const body = text.slice(bodyStart, nextIdx).replace(/^[\s:().,-]+/, '').trim();

  if (!body) {
    return { ok: false, reason: 'fail-closed: constraint slot is empty', constraint: null, slotOrder, warnings };
  }

  // ISC-ANTI-9 / ISC-50: reject a bare stack-shape that carries no domain vocabulary.
  const firstSentence = body.split(/(?<=[.\n])/)[0].trim();
  if (STACK_SHAPE.test(firstSentence) && !ACCEPT_VOCAB.test(body)) {
    return { ok: false, reason: `pure stack-shape constraint ("${firstSentence}") — re-derive a domain invariant/aggregate/boundary`, constraint: null, slotOrder, warnings };
  }

  // A constraint with no domain vocabulary at all is not a named load-bearing constraint.
  if (!ACCEPT_VOCAB.test(body)) {
    return { ok: false, reason: 'constraint names no domain invariant/aggregate/boundary — re-derive', constraint: null, slotOrder, warnings };
  }

  // ISC-49: optional kit-entity resolution against the enumerated tier model (non-fatal warnings).
  if (opts.tierModel && opts.tierModel.length) {
    const model = new Set(opts.tierModel.map((t) => t.toLowerCase()));
    for (const ent of body.match(KIT_ENTITY) ?? []) {
      if (!model.has(ent.toLowerCase())) warnings.push(`named kit entity "${ent}" does not resolve against the tier model`);
    }
  }

  return { ok: true, reason: 'constraint-first task string is well-formed', constraint: body.slice(0, 200), slotOrder, warnings };
}

// Any structured slot label present? (constraint/actor/boundary/stack as a line-start header).
const SLOT_ANY = /^[ \t]*(?:(?:LOAD[-\s]?BEARING\s+)?CONSTRAINT|ACTOR|BOUNDARY|STACK)\b[^\n:]*:/im;

/**
 * guardTaskString — the SEAM-GUARD policy (PRD 20260531-093152 / D2,D5): the same constraint-first
 * RULES as validateTaskString, wrapped with a legacy bypass. A fully UNSTRUCTURED free-form task
 * (no slot labels) is a legacy direct call to prd-isc-fanout and passes (ISC-A4 backward-compat); a
 * STRUCTURED-but-malformed string (has slot labels but the constraint is missing / not first / a bare
 * stack-shape) fails CLOSED. This is the canonical logic the workflow's inline seam guard mirrors.
 */
export function guardTaskString(input: string, opts: ValidateOptions = {}): Verdict & { legacy?: boolean } {
  if (!SLOT_ANY.test(input ?? '')) {
    return { ok: true, reason: 'unstructured free-form task — seam guard not applicable (legacy direct call)', constraint: null, slotOrder: [], warnings: [], legacy: true };
  }
  return validateTaskString(input, opts);
}

// ISC-43: CLI entry — `bun task-string-validator.ts <file>` exits 0 (pass) / 1 (fail-closed).
if (import.meta.main) {
  const path = process.argv[2];
  if (!path) {
    console.error('usage: task-string-validator <task-string-file>');
    process.exit(2);
  }
  const content = await Bun.file(path).text();
  const v = validateTaskString(content);
  console.log(JSON.stringify(v, null, 2));
  process.exit(v.ok ? 0 : 1);
}
