/**
 * delegation-bundle.ts — pure heuristics for PreDelegationBundle.hook.ts
 * (V21-W1-S2).
 *
 * Classifies an Agent/Task spawn prompt as BARE or BUNDLED. The failure mode
 * being enforced: bare spawns (short prompt, no inline context, no declared
 * output contract) produce schema-drifted subagent output — the roadmap's
 * "schema-valid subagent output 0%" finding on replayed multi-angle reviews.
 *
 * CONSERVATIVE BY CONSTRUCTION (low false-positive is the contract): a spawn
 * is bare only when ALL THREE hold —
 *   1. the prompt is short (< maxBareChars, default 300), AND
 *   2. no context-bundle marker matches (paths, fenced content, context
 *      sections, ground-truth phrasing), AND
 *   3. no output-contract marker matches (return/output phrasing near a
 *      structure noun, Return:/Output: headers, schema mentions, JSON
 *      skeletons).
 * A long prompt is never flagged, whatever it contains — length alone is
 * treated as evidence of an inlined bundle.
 */

export interface SpawnClassification {
  bare: boolean;
  promptChars: number;
  hasContextBundle: boolean;
  hasOutputContract: boolean;
}

export const DEFAULT_MAX_BARE_CHARS = 300;

const CONTEXT_MARKERS: RegExp[] = [
  /```/, // fenced code/content block — inlined ground truth
  /(?:^|\n)\s*(?:#{1,4}\s*)?(?:CONTEXT|Context)\b\s*[:—-]/, // explicit context section
  /<context>/i,
  /\bground[- ]truth\b/i,
  /\bfile contents?\b/i,
  /\bread these files? first\b/i,
  // A concrete path (absolute or ~-anchored, at least two segments) is
  // context grounding: the subagent is pointed at real files. The leading
  // character class keeps URL slashes ("https://…") from matching.
  /(?:^|[\s"'`(=])(?:~\/|\/)[\w.@-]+\/[\w./@-]+/,
];

const OUTPUT_CONTRACT_MARKERS: RegExp[] = [
  // "return/output/report … <structure noun>" within one clause
  /\b(?:return|respond|reply|report|output|deliver|emit|give me)\b[^.\n]{0,120}\b(?:JSON|schema|format|structure|structured|fields?|table|markdown|bullets?|list|paths?|summary|verdict|report)\b/i,
  // Declared section headers: "Return:", "Output:", "Deliverable:", "Report back:"
  /(?:^|\n)\s*(?:#{1,4}\s*)?(?:Return|Output|Deliverables?|Report(?: back)?|Response format)\b\s*[:\n]/i,
  /\b(?:output|response) schema\b/i,
  /\breturn contract\b/i,
  /\bstructured output\b/i,
  // Inline JSON skeleton — {"field": or { field:
  /\{\s*"?\w+"?\s*:/,
];

export function hasContextBundle(prompt: string): boolean {
  return CONTEXT_MARKERS.some((re) => re.test(prompt));
}

export function hasOutputContract(prompt: string): boolean {
  return OUTPUT_CONTRACT_MARKERS.some((re) => re.test(prompt));
}

export function classifySpawn(
  prompt: string,
  maxBareChars: number = DEFAULT_MAX_BARE_CHARS,
): SpawnClassification {
  const trimmed = prompt.trim();
  const promptChars = trimmed.length;
  const context = hasContextBundle(trimmed);
  const contract = hasOutputContract(trimmed);
  return {
    bare: promptChars > 0 && promptChars < maxBareChars && !context && !contract,
    promptChars,
    hasContextBundle: context,
    hasOutputContract: contract,
  };
}
