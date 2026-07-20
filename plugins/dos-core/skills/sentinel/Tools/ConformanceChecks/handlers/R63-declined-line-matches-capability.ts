/**
 * R63 (RFC-0098 §13.5, extended by RFC-0114) — Decline Protocol lifecycle for
 * capability records in PRDs with `🏹 CAPABILITIES SELECTED:` blocks.
 *
 * Legacy behavior (toggle OFF — `DOS_R63_LIFECYCLE_ENABLED` unset/empty):
 *   Detects WRONG-EXECUTION only: capability appears in both `🏹 CAPABILITIES
 *   SELECTED:` AND `Declined:` line (dual-state violation). Preserved
 *   byte-for-byte from the pre-RFC-0114 implementation. Characterization
 *   tests pin the legacy outputs.
 *
 * Lifecycle behavior (toggle ON — `DOS_R63_LIFECYCLE_ENABLED=1`):
 *   Models the full 7-state Aggregate per RFC-0114 §2:
 *     pass states:  selected | declined | merged | superseded | deferred
 *                   | renamed | not_applicable
 *     fail states:  silent-drop | dual-state | unresolved-merge-target
 *                   | unresolved-supersede-target
 *
 *   Closes the Cato HIGH-priority finding (RFC-0098 §15.1 SPEC-BS-3):
 *   "R63 dual-state proxy catches wrong-execution but NOT missing-execution
 *   (cap selected at OBSERVE, never invoked, no Declined line)."
 *
 * Refactoring catalog entry (Fowler R-13): Replace Type Code with State/Strategy.
 * Aggregate Root (Evans, Blue Book §6.4): the reflection-jsonl-entry capability
 *   record — A7/A8/A11 mutations route through this Aggregate's invariants.
 *
 * Tier: warning per RFC-0085 council default.
 * Scope: PRDs at phase >= execute (so the Decline Protocol has had opportunity to fire).
 */

import { existsSync, readFileSync, readdirSync, statSync } from "fs";
import { join, dirname, basename } from "path";
import type { CheckContext, CheckResult } from "../types.ts";
import { isPreCutoffISO } from "../lib/grandfather.ts";

const REQUIREMENT =
  "PRDs with capabilities selected and declined must declare each declined capability in `## Decisions` per Algorithm v0.0.8 §4 Decline Protocol";

const RULE_CUTOFF_ISO = "2026-05-08";
// Evidence-pipeline (P3) install date. A silent-drop on a PRD whose session
// predates this could never have produced live invocation evidence and may have
// no surviving transcript to backfill — so it is grandfathered (RFC-0114 ISC-32).
const EVIDENCE_HOOK_ISO = "2026-05-29";
const EXECUTING_PHASES = new Set(["execute", "verify", "learn", "complete"]);

interface Frontmatter {
  phase?: string;
  effort?: string;
  started?: string;
}

function listPrdPaths(workDir: string): string[] {
  if (!existsSync(workDir)) return [];
  const out: string[] = [];
  for (const layer of ["active", "archived", ""]) {
    const base = layer ? join(workDir, layer) : workDir;
    if (!existsSync(base)) continue;
    try {
      for (const dir of readdirSync(base)) {
        const prd = join(base, dir, "PRD.md");
        try {
          if (statSync(prd).isFile()) out.push(prd);
        } catch {}
      }
    } catch {}
  }
  return out;
}

function parseFrontmatter(content: string): Frontmatter | null {
  const m = content.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return null;
  const fm = m[1];
  const read = (k: string) => fm.match(new RegExp(`^${k}:\\s*(.+)$`, "m"))?.[1]?.trim().replace(/^["']|["']$/g, "");
  return { phase: read("phase")?.toLowerCase(), effort: read("effort")?.toLowerCase(), started: read("started") };
}

// Meta-header lines inside the 🏹 block that describe the block rather than
// name a capability. RFC-0114 Class-A fix (soak 2026-05-29): `🏹 SELECTION
// RATIONALE:` was parsed as a phantom capability named `SELECTION`. These are
// matched on the uppercased content after the emoji; a real capability entry
// (`🏹 Explore (×6) — …`, `🏹 PRD (this document) — …`) never starts with one.
const META_HEADER_PREFIXES: readonly string[] = [
  "CAPABILITIES SELECTED",
  "SELECTION RATIONALE",
  "CAPABILITIES CONSIDERED",
  "RATIONALE",
];

function isMetaHeaderLine(afterEmoji: string): boolean {
  const upper = afterEmoji.toUpperCase();
  // A header ends at a non-alphanumeric boundary (`:`, space, `(`, `—`, end),
  // so `CAPABILITIES SELECTED (E3 tier):` and `SELECTION RATIONALE:` match, while
  // a real capability like `RationaleEngine` (next char is a letter) does not.
  return META_HEADER_PREFIXES.some((p) => {
    if (!upper.startsWith(p)) return false;
    const next = upper[p.length];
    return next === undefined || !/[A-Z0-9]/.test(next);
  });
}

// Legacy capture (toggle OFF). FROZEN — byte-identical to pre-RFC-0114. The
// Class-A meta-header fix (SELECTION RATIONALE) lives ONLY in the lifecycle
// extractor below; in the legacy dual-state check a phantom `SELECTION` is
// harmless (it is never also in a Declined: line), so changing this shared
// function would needlessly perturb the characterized legacy path.
function extractCapabilityBlock(body: string): string[] {
  const caps: string[] = [];
  const startIdx = body.indexOf("🏹 CAPABILITIES SELECTED");
  if (startIdx < 0) return caps;
  const afterStart = body.slice(startIdx);
  // End at next ## heading or 🤔 considered-but-skipped marker or EOF
  const endMatch = afterStart.match(/\n(?:##\s|🤔)/);
  const section = endMatch ? afterStart.slice(0, endMatch.index!) : afterStart;
  for (const line of section.split("\n")) {
    if (line.includes("CAPABILITIES SELECTED")) continue; // skip header
    const trimmed = line.trim();
    if (!trimmed.startsWith("🏹")) continue;
    const afterEmoji = trimmed.slice("🏹".length).trim();
    const m = afterEmoji.match(/^([A-Za-z][A-Za-z0-9_/-]*)/);
    if (m) caps.push(m[1].trim());
  }
  return caps;
}

interface CapabilityEntry {
  /** narrow first-token name — used for resolution/dual-state matching + display (back-compat with legacy capture) */
  name: string;
  /** normalized evidence key derived from the fuller descriptor — e.g. `Skill("prompting")` → `prompting` */
  key: string;
}

/**
 * Lifecycle-path capability extractor (RFC-0114 P3). Same line iteration as
 * extractCapabilityBlock, but also derives a normalized evidence `key` from the
 * fuller descriptor (the text up to the first ` — ` boundary) so SELECTED forms
 * like `Skill("prompting")`, `WebSearch`, `Explore (×6)` match the invocation
 * ledger. Legacy path keeps using extractCapabilityBlock (narrow, unchanged).
 */
function extractCapabilityEntries(body: string): CapabilityEntry[] {
  const out: CapabilityEntry[] = [];
  const startIdx = body.indexOf("🏹 CAPABILITIES SELECTED");
  if (startIdx < 0) return out;
  const afterStart = body.slice(startIdx);
  const endMatch = afterStart.match(/\n(?:##\s|🤔)/);
  const section = endMatch ? afterStart.slice(0, endMatch.index!) : afterStart;
  for (const line of section.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("🏹")) continue;
    const afterEmoji = trimmed.slice("🏹".length).trim();
    if (isMetaHeaderLine(afterEmoji)) continue;
    const m = afterEmoji.match(/^([A-Za-z][A-Za-z0-9_/-]*)/);
    if (!m) continue;
    const name = m[1].trim();
    const descriptor = afterEmoji.split(/\s+—\s+/)[0].trim(); // up to first em-dash
    out.push({ name, key: normalizeCapability(descriptor) });
  }
  return out;
}

function extractDeclinedLines(body: string): string[] {
  const declined: string[] = [];
  const startMatch = body.match(/^##\s+Decisions\b/m);
  if (!startMatch || startMatch.index === undefined) return declined;
  const afterStart = body.slice(startMatch.index + startMatch[0].length);
  // End at next \n## heading or EOF
  const endMatch = afterStart.match(/\n##\s/);
  const section = endMatch ? afterStart.slice(0, endMatch.index!) : afterStart;
  for (const line of section.split("\n")) {
    const m = line.match(/Declined:\s*([A-Za-z][A-Za-z0-9_/-]*)/);
    if (m) declined.push(m[1].trim());
  }
  return declined;
}

// ─── Legacy path (toggle OFF) ──────────────────────────────────────────────
// This function is byte-for-byte equivalent to the pre-RFC-0114 handler body.
// Characterization tests pin its outputs across all 5 legacy scenarios.

async function legacyDualStateCheck(ctx: CheckContext): Promise<CheckResult> {
  const workDir = join(ctx.repoRoot, "MEMORY", "WORK");
  const prds = listPrdPaths(workDir);
  if (prds.length === 0) {
    return { rId: "R63", requirement: REQUIREMENT, status: "not_applicable", evidence: ["no MEMORY/WORK PRDs found"] };
  }

  const fails: string[] = [];
  let scanned = 0;
  let applicable = 0;
  for (const path of prds) {
    let content: string;
    try { content = readFileSync(path, "utf-8"); } catch { continue; }
    scanned++;
    const fm = parseFrontmatter(content);
    if (!fm) continue;
    if (isPreCutoffISO(fm.started, RULE_CUTOFF_ISO)) continue;
    if (!fm.phase || !EXECUTING_PHASES.has(fm.phase)) continue;

    const caps = extractCapabilityBlock(content);
    if (caps.length === 0) continue;
    applicable++;

    // Heuristic: any capability present in the block but never invoked in the body
    // OR explicitly absent from a later phase-block update can't be detected statically.
    // We use the simpler signal: each declined-named capability must NOT also still
    // appear in the SELECTED block (the dual-write rule says edit the list AND add
    // the Declined: line — keeping both is the violation).
    const declined = extractDeclinedLines(content);
    const stillSelectedAndDeclined = declined.filter((d) => caps.includes(d));
    if (stillSelectedAndDeclined.length > 0) {
      fails.push(`${path}: capabilities are both selected and declined (dual-write violation): [${stillSelectedAndDeclined.join(", ")}]`);
    }
  }

  if (applicable === 0) {
    return { rId: "R63", requirement: REQUIREMENT, status: "not_applicable", evidence: [`scanned ${scanned} PRDs; none had capabilities-selected block + execute+ phase`] };
  }
  if (fails.length === 0) {
    return { rId: "R63", requirement: REQUIREMENT, status: "pass", evidence: [`${applicable}/${applicable} applicable PRDs respect Decline Protocol dual-write`] };
  }
  return {
    rId: "R63",
    requirement: REQUIREMENT,
    status: "fail",
    evidence: [`${fails.length}/${applicable} applicable PRDs violate dual-write:`, ...fails.slice(0, 5)],
  };
}

// ─── Lifecycle path (toggle ON — RFC-0114) ─────────────────────────────────

type LifecycleState =
  | "selected"
  | "declined"
  | "merged"
  | "superseded"
  | "deferred"
  | "renamed"
  | "not_applicable"
  | "silent-drop"
  | "dual-state"
  | "unresolved-merge-target"
  | "unresolved-supersede-target";

const TERMINAL_PASS_STATES: ReadonlySet<LifecycleState> = new Set([
  "selected", "declined", "merged", "superseded", "deferred", "renamed", "not_applicable",
]);

interface CapabilityRecord {
  name: string;
  state: LifecycleState;
  evidence: string;
}

/**
 * Resolution marker grammar per RFC-0114 §3. Two shapes by arity:
 *   Shape A (single name = source): Declined, Not-applicable
 *   Shape B (source merged-into/superseded-by/deferred-to/renamed-to target)
 *
 * Shape A markers carry a single capability token = the SOURCE. Shape B
 * markers carry two tokens: SOURCE before the verb-with-preposition and
 * TARGET after the colon.
 */
interface ResolutionMarker {
  predicate: LifecycleState;
  re: RegExp;
  /** index of capture group holding the SOURCE capability name (= record name) */
  sourceGroup: number;
  /** index of capture group holding the TARGET (Shape B only), 0 = no target */
  targetGroup: number;
}

const RESOLUTION_MARKERS: readonly ResolutionMarker[] = [
  // Shape A — single name = source
  { predicate: "declined",        re: /^-\s+Declined:\s+([A-Za-z][A-Za-z0-9_/-]*)\s+—\s+.+$/,         sourceGroup: 1, targetGroup: 0 },
  { predicate: "not_applicable",  re: /^-\s+Not-applicable:\s+([A-Za-z][A-Za-z0-9_/-]*)\s+—\s+.+$/,   sourceGroup: 1, targetGroup: 0 },
  // Shape B — source merged-into/superseded-by/deferred-to/renamed-to target
  { predicate: "merged",          re: /^-\s+([A-Za-z][A-Za-z0-9_/-]*)\s+merged-into:\s+([A-Za-z][A-Za-z0-9_/-]*)\b/,         sourceGroup: 1, targetGroup: 2 },
  { predicate: "superseded",      re: /^-\s+([A-Za-z][A-Za-z0-9_/-]*)\s+superseded-by:\s+([A-Za-z][A-Za-z0-9_/-]*)\b/,       sourceGroup: 1, targetGroup: 2 },
  { predicate: "deferred",        re: /^-\s+([A-Za-z][A-Za-z0-9_/-]*)\s+deferred-to:\s+([A-Za-z0-9][A-Za-z0-9_/.-]*)\b/,     sourceGroup: 1, targetGroup: 2 },
  { predicate: "renamed",         re: /^-\s+([A-Za-z][A-Za-z0-9_/-]*)\s+renamed-to:\s+([A-Za-z][A-Za-z0-9_/-]*)\b/,          sourceGroup: 1, targetGroup: 2 },
];

/**
 * Strip fenced code blocks (```…``` and ~~~…~~~) from body before regex scan.
 * Closes R38-style false positives where resolution markers appear inside
 * literal markdown samples. Single-pass, fence-balanced; preserves line count
 * so anchored positional regexes still anchor on correct lines (replaces
 * fenced content with empty lines).
 */
function stripCodeFences(body: string): string {
  const lines = body.split("\n");
  const out: string[] = new Array(lines.length);
  let inFence = false;
  let fenceMarker = "";
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fenceMatch = line.match(/^(\s*)(```+|~~~+)/);
    if (fenceMatch) {
      const marker = fenceMatch[2][0]; // ` or ~
      if (!inFence) {
        inFence = true;
        fenceMarker = marker;
        out[i] = ""; // strip the fence opener line itself
        continue;
      }
      if (inFence && marker === fenceMarker) {
        inFence = false;
        fenceMarker = "";
        out[i] = ""; // strip the fence closer line itself
        continue;
      }
    }
    out[i] = inFence ? "" : line;
  }
  return out.join("\n");
}

/**
 * Section locator that respects fence-stripped content. Returns the slice
 * between `^##\s+<name>\b` and the next `^##\s` heading (or EOF).
 */
function extractSection(body: string, name: string): string {
  const stripped = stripCodeFences(body);
  const startRe = new RegExp(`^##\\s+${name}\\b`, "m");
  const startMatch = stripped.match(startRe);
  if (!startMatch || startMatch.index === undefined) return "";
  const afterStart = stripped.slice(startMatch.index + startMatch[0].length);
  const endMatch = afterStart.match(/\n##\s/);
  return endMatch ? afterStart.slice(0, endMatch.index!) : afterStart;
}

interface Resolution {
  state: LifecycleState;
  line: string;
  /** target capability name (Shape B only); undefined for Shape A */
  target?: string;
}

/**
 * Detect resolution markers within the `## Decisions` section. Returns map
 * of SOURCE-capability-name → its terminal lifecycle state per the first
 * matching marker (markers are checked in declaration order). Shape B
 * markers also capture the TARGET for downstream `unresolved-*` checks.
 */
function detectResolutions(body: string): Map<string, Resolution> {
  const section = extractSection(body, "Decisions");
  const out = new Map<string, Resolution>();
  if (!section) return out;
  for (const raw of section.split("\n")) {
    const line = raw.replace(/\s+$/, "");
    for (const marker of RESOLUTION_MARKERS) {
      const m = line.match(marker.re);
      if (m) {
        const source = m[marker.sourceGroup].trim();
        const target = marker.targetGroup > 0 ? m[marker.targetGroup].trim() : undefined;
        out.set(source, { state: marker.predicate, line: line.trim(), target });
        break;
      }
    }
  }
  return out;
}

/**
 * Compute the lifecycle state of each capability record in a PRD. The
 * Aggregate invariant: exactly one terminal state per record.
 *
 * R38 regression guard: this function operates on a fence-stripped view of
 * the body so resolution markers inside fenced code blocks are never
 * counted. The SELECTED capability list is extracted from raw body (the
 * 🏹 emoji prefix is unlikely to appear in code blocks; if a future
 * regression surfaces, switch this to the stripped view as well).
 */
/**
 * Normalize a capability token for evidence matching (RFC-0114 P3). Reconciles
 * the SELECTED-block form with the invocation-ledger form:
 *   Skill("prompting") → prompting · /code-review → code-review · WebSearch → websearch
 */
const CAPABILITY_SYNONYMS: Readonly<Record<string, string>> = {
  simplify: "code-review", // /simplify renamed to /code-review (Claude Code v2.1.146); evidence uses canonical
};

function normalizeCapability(raw: string): string {
  let s = raw.trim();
  const skillMatch = s.match(/^Skill\(\s*["']?([^"')]+)["']?\s*\)/i);
  if (skillMatch) s = skillMatch[1];
  s = s.replace(/^\//, "");      // slash-command prefix
  s = s.replace(/\(.*$/, "");    // trailing parenthetical / args
  const out = s.trim().toLowerCase();
  return CAPABILITY_SYNONYMS[out] ?? out;
}

/**
 * Read ALL invocation evidence once from the SessionEnd-emitted ledgers at
 * `MEMORY/STATE/capability-invocations/*.jsonl` (RFC-0114 P3) into a
 * slug → normalized-capability-set map. Built once per scan (not per PRD) to
 * avoid re-parsing the whole ledger corpus N times. Missing dir → empty map.
 */
function readAllInvocationEvidence(repoRoot: string): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  const dir = join(repoRoot, "MEMORY", "STATE", "capability-invocations");
  if (!existsSync(dir)) return out;
  let files: string[];
  try { files = readdirSync(dir).filter((f) => f.endsWith(".jsonl")); } catch { return out; }
  for (const f of files) {
    let raw: string;
    try { raw = readFileSync(join(dir, f), "utf-8"); } catch { continue; }
    for (const line of raw.split("\n")) {
      const t = line.trim();
      if (!t) continue;
      try {
        const rec = JSON.parse(t) as { prd_slug?: string; capability?: string };
        if (rec.prd_slug && rec.capability) {
          let set = out.get(rec.prd_slug);
          if (!set) { set = new Set(); out.set(rec.prd_slug, set); }
          set.add(normalizeCapability(rec.capability));
        }
      } catch { /* skip malformed line */ }
    }
  }
  return out;
}

const EMPTY_EVIDENCE: ReadonlySet<string> = new Set();

function computeRecords(body: string, evidence: ReadonlySet<string> = new Set()): CapabilityRecord[] {
  const entries = extractCapabilityEntries(body);
  if (entries.length === 0) return [];
  const capNames = entries.map((e) => e.name);

  const stripped = stripCodeFences(body);
  const resolutions = detectResolutions(body); // detectResolutions already uses stripped via extractSection
  // Dual-state check uses fence-stripped view so fenced `Declined:` lines are ignored (R38 guard)
  const legacyDeclined = new Set(extractDeclinedLines(stripped));

  const records: CapabilityRecord[] = [];
  for (const { name, key } of entries) {
    const resolution = resolutions.get(name);
    if (legacyDeclined.has(name)) {
      // Dual-state: still in SELECTED block AND has a Declined: line
      records.push({ name, state: "dual-state", evidence: `${name} appears in both 🏹 SELECTED and Declined:` });
      continue;
    }
    if (!resolution) {
      // RFC-0114 P3: a listed cap with invocation evidence resolves to `selected`
      // (terminal pass). Only listed-AND-no-marker-AND-no-evidence is a true silent-drop.
      if (evidence.has(key)) {
        records.push({ name, state: "selected", evidence: `${name} invoked (invocation-evidence ledger)` });
        continue;
      }
      // Silent-drop: listed at OBSERVE, no resolution marker, no invocation evidence
      records.push({ name, state: "silent-drop", evidence: `${name} listed at OBSERVE but no Decisions resolution marker and no invocation evidence` });
      continue;
    }
    // Validate merge/supersede targets exist as records in same PRD
    if ((resolution.state === "merged" || resolution.state === "superseded") && resolution.target) {
      if (!capNames.includes(resolution.target)) {
        const violationState: LifecycleState =
          resolution.state === "merged" ? "unresolved-merge-target" : "unresolved-supersede-target";
        records.push({
          name,
          state: violationState,
          evidence: `${name} ${resolution.state === "merged" ? "merged-into" : "superseded-by"} ${resolution.target} (target not in SELECTED block)`,
        });
        continue;
      }
    }
    records.push({ name, state: resolution.state, evidence: resolution.line });
  }
  return records;
}

async function lifecycleCheck(ctx: CheckContext): Promise<CheckResult> {
  const workDir = join(ctx.repoRoot, "MEMORY", "WORK");
  const prds = listPrdPaths(workDir);
  if (prds.length === 0) {
    return { rId: "R63", requirement: REQUIREMENT, status: "not_applicable", evidence: ["no MEMORY/WORK PRDs found"] };
  }

  const evidenceMap = readAllInvocationEvidence(ctx.repoRoot); // once per scan, not per PRD
  const fails: string[] = [];
  let scanned = 0;
  let applicable = 0;
  let totalRecords = 0;
  let passingRecords = 0;
  for (const path of prds) {
    let content: string;
    try { content = readFileSync(path, "utf-8"); } catch { continue; }
    scanned++;
    const fm = parseFrontmatter(content);
    if (!fm) continue;
    if (isPreCutoffISO(fm.started, RULE_CUTOFF_ISO)) continue;
    if (!fm.phase || !EXECUTING_PHASES.has(fm.phase)) continue;

    const prdSlug = basename(dirname(path));
    const evidence = evidenceMap.get(prdSlug) ?? EMPTY_EVIDENCE;
    const records = computeRecords(content, evidence);
    if (records.length === 0) continue;
    applicable++;

    const evidenceExempt = isPreCutoffISO(fm.started, EVIDENCE_HOOK_ISO);
    for (const rec of records) {
      totalRecords++;
      if (TERMINAL_PASS_STATES.has(rec.state)) {
        passingRecords++;
        continue;
      }
      // Grandfather: pre-hook-install silent-drops are not fairly assertable
      // (no live capture possible, transcript may be rotated). Other violation
      // states (dual-state, unresolved-target) still fail regardless of date.
      if (rec.state === "silent-drop" && evidenceExempt) {
        passingRecords++;
        continue;
      }
      fails.push(`${path}: ${rec.state} — ${rec.evidence}`);
    }
  }

  if (applicable === 0) {
    return { rId: "R63", requirement: REQUIREMENT, status: "not_applicable", evidence: [`scanned ${scanned} PRDs; none had capabilities-selected block + execute+ phase`] };
  }
  if (fails.length === 0) {
    return {
      rId: "R63",
      requirement: REQUIREMENT,
      status: "pass",
      evidence: [`${applicable}/${applicable} PRDs clean; ${passingRecords}/${totalRecords} capability records in terminal pass state (RFC-0114 lifecycle)`],
    };
  }
  return {
    rId: "R63",
    requirement: REQUIREMENT,
    status: "fail",
    evidence: [
      `RFC-0114 lifecycle: ${fails.length}/${totalRecords} capability records in violation state across ${applicable} PRDs:`,
      ...fails.slice(0, 5),
    ],
  };
}

// ─── Feature toggle gate (RFC-0114 §7) ─────────────────────────────────────

export async function r63DeclinedLineMatchesCapability(ctx: CheckContext): Promise<CheckResult> {
  // Default-ON since 2026-05-29 (RFC-0114 P3 pipeline + grandfather shipped, ISC-28).
  // Escape hatch preserved: DOS_R63_LIFECYCLE_ENABLED=0 forces the legacy path.
  // Full toggle removal remains a separate v0.0.19 step.
  const lifecycleEnabled = process.env.DOS_R63_LIFECYCLE_ENABLED !== "0";
  return lifecycleEnabled ? lifecycleCheck(ctx) : legacyDualStateCheck(ctx);
}

// Re-exported for characterization tests pinning legacy behavior.
export const __testing__ = { legacyDualStateCheck, lifecycleCheck, stripCodeFences, computeRecords, extractCapabilityBlock, extractCapabilityEntries, normalizeCapability, readAllInvocationEvidence, isMetaHeaderLine };
