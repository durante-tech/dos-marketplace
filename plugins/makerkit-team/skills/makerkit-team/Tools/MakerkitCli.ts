#!/usr/bin/env bun
// MakerkitCli.ts — deterministic helpers for the DeliverFeature workflow.
//
// Two render/gate templates relocated out of Workflows/DeliverFeature.md prose:
//
//   1. validateDecomposeGate() + renderDecomposeGate() — the Phase 1.5
//      decompose-gate verdict (OK vs BLOCKED) over a prd-projector record, and
//      the one-line operator-facing status string.
//
//   2. renderPrBody() — the Phase 7 PR creation body skeleton (## Summary
//      bullets + ## Test plan checklist + Co-Authored-By trailer). The bullet
//      and checklist CONTENT is supplied by the agent (judgment); the skeleton,
//      spacing, and trailer are deterministic and byte-preserved here.

import { existsSync, readFileSync, readdirSync } from 'fs';
import { join, resolve } from 'path';
import { homedir } from 'os';

import {
  readStdin,
  formatVerdict,
  findMissingUnitTests,
  vacuousMessage,
  EXIT_VACUOUS,
} from './_shared';
import { resolveKitRepo, type KitRepoProfile } from './ResolveRepo';
import rosterData from '../Data/Roster.json';

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

// Clipboard glyph (U+1F4CB), middle dot (U+00B7), em dash (U+2014) — these are
// operator-facing OUTPUT bytes carried over verbatim from the template, not code
// decoration. Named as escapes so the source stays ASCII.
const GLYPH_CLIPBOARD = '\u{1F4CB}';
const SEP_DOT = '·';
const SEP_DASH = '—';

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
// Phase 7 — PR creation body render
//
// Prose template (DeliverFeature.md Phase 7 line 310):
//   body of `## Summary` (1-3 bullets) + `## Test plan` (markdown checklist)
//   + `Co-Authored-By: DuranteOS <tech@duranteos.com>` trailer.
//
// The summary bullets and test-plan items are the agent's judgment content; this
// helper owns the deterministic skeleton (headings, bullet/checkbox markers,
// blank-line spacing, trailer). Byte-preserved markdown body for `gh pr create`.
// ---------------------------------------------------------------------------

export const COAUTHOR_TRAILER = 'Co-Authored-By: DuranteOS <tech@duranteos.com>';

export interface PrBodyData {
  summary: string[]; // 1-3 bullets
  testPlan: string[]; // checklist items
}

export function renderPrBody(data: PrBodyData): string {
  const lines: string[] = [];
  lines.push('## Summary');
  lines.push('');
  for (const bullet of data.summary) lines.push(`- ${bullet}`);
  lines.push('');
  lines.push('## Test plan');
  lines.push('');
  for (const item of data.testPlan) lines.push(`- [ ] ${item}`);
  lines.push('');
  lines.push(COAUTHOR_TRAILER);
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Phase 0 step 3 — Auto-classify feature scope (B5 gate/predicate)
//
// Relocates the Phase 0 scope-classification prose out of DeliverFeature.md.
// The agent extracts the SIGNALS per run (file count from the request, whether
// the request reads as a fix/tweak/patch, whether it touches a sensitive
// boundary); this function applies the deterministic rule over those signals so
// the same inputs always yield the same scope. The rule (byte-for-byte the prose):
//   - small : <=2 files OR described as "fix" / "tweak" / "patch"
//   - large : 11+ files OR touches auth / billing / RBAC / policies / multi-tenancy
//   - medium: everything else (3-10 files, single feature surface)
// Precedence: large boundary wins over a small file-count signal (an auth change
// is never "small"); otherwise small wins over the default medium.
// ---------------------------------------------------------------------------

export type FeatureScope = 'small' | 'medium' | 'large';

export interface ScopeSignals {
  fileCount: number;
  // true when the request reads as "fix" / "tweak" / "patch" / "small change".
  isFixLike: boolean;
  // true when the change touches auth / billing / RBAC / policies / multi-tenancy.
  touchesSensitiveBoundary: boolean;
}

export interface ScopeResult {
  scope: FeatureScope;
  // reasons that drove the classification (audit trail for PRD ## Decisions).
  reasons: string[];
  // small scope routes to QuickFix and exits the pipeline.
  routeToQuickFix: boolean;
}

export function classifyFeatureScope(signals: ScopeSignals): ScopeResult {
  // large takes precedence — a sensitive-boundary touch is never small.
  if (signals.fileCount >= 11 || signals.touchesSensitiveBoundary) {
    const reasons: string[] = [];
    if (signals.fileCount >= 11) reasons.push(`${signals.fileCount} files (>= 11)`);
    if (signals.touchesSensitiveBoundary)
      reasons.push('touches auth/billing/RBAC/policies/multi-tenancy boundary');
    return { scope: 'large', reasons, routeToQuickFix: false };
  }
  if (signals.fileCount <= 2 || signals.isFixLike) {
    const reasons: string[] = [];
    if (signals.fileCount <= 2) reasons.push(`${signals.fileCount} files (<= 2)`);
    if (signals.isFixLike) reasons.push('request described as fix/tweak/patch');
    return { scope: 'small', reasons, routeToQuickFix: true };
  }
  return {
    scope: 'medium',
    reasons: [`${signals.fileCount} files (3-10), single feature surface`],
    routeToQuickFix: false,
  };
}

// ---------------------------------------------------------------------------
// Phase 6 — ships-with-tests gate (B5 gate/predicate)
//
// Relocates the six-check G6 ships-with-tests gate out of DeliverFeature.md /
// _test-pyramid-gate.md. The agent supplies the six observed booleans (each from
// a deterministic command — pnpm test:unit, playwright, run_checks, etc.); this
// function applies the AND over all six and lists which failed. Gate passes only
// when ALL six are true (per _test-pyramid-gate.md "ALL six checks pass").
// ---------------------------------------------------------------------------

export interface TestPyramidChecks {
  unitLayerGreen: boolean;
  e2eLayerGreen: boolean;
  runChecksClean: boolean;
  dataTestIdKebabCase: boolean;
  bootstrapHelpersUsed: boolean;
  perIscLayerMappingDocumented: boolean;
}

export interface TestPyramidGateResult {
  ok: boolean;
  failed: string[]; // labels of the checks that are not green
}

// Ordered to match the six numbered checks in DeliverFeature.md Phase 6 / G6.
const PYRAMID_CHECK_LABELS: ReadonlyArray<[keyof TestPyramidChecks, string]> = [
  ['unitLayerGreen', 'Unit-layer green'],
  ['e2eLayerGreen', 'E2E-layer green'],
  ['runChecksClean', 'run_checks clean'],
  ['dataTestIdKebabCase', 'data-testid kebab-case on new interactive elements'],
  ['bootstrapHelpersUsed', 'bootstrap helpers used for e2e auth setup'],
  ['perIscLayerMappingDocumented', 'per-ISC layer mapping documented in PRD'],
];

export function validateTestPyramidGate(checks: TestPyramidChecks): TestPyramidGateResult {
  const failed: string[] = [];
  for (const [key, label] of PYRAMID_CHECK_LABELS) {
    if (!checks[key]) failed.push(label);
  }
  return { ok: failed.length === 0, failed };
}

// ---------------------------------------------------------------------------
// ISC-23 — layer-map-check (B5 gate/predicate)
//
// Mechanizes the per-ISC Test-Pyramid-Plan rubric from _test-pyramid-gate.md
// (### Per-ISC Layer Mapping Rubric). Every ISC in a change-producing PRD MUST
// carry exactly one of the four canonical layer labels. The gate FAILs when an
// ISC has no Test-Pyramid-Plan row (no/empty label) OR an out-of-vocabulary label.
//
// Valid labels are byte-faithful to the four rubric rows.
// ---------------------------------------------------------------------------

// The four canonical layer labels, verbatim from the _test-pyramid-gate.md rubric.
export const VALID_PYRAMID_LABELS = [
  'unit-covered',
  'e2e-covered',
  'verification-only (justified)',
  'documentation-only',
] as const;
export type PyramidLabel = (typeof VALID_PYRAMID_LABELS)[number];

export interface IscLayerEntry {
  id: string;
  // A missing/empty label === "no Test-Pyramid-Plan row" for this ISC.
  label?: string;
}

export interface LayerMapResult {
  ok: boolean;
  total: number;
  unlabeled: string[]; // ISC ids with no/empty label
  invalid: Array<{ id: string; label: string }>; // ISC ids with an out-of-vocab label
}

export function validateLayerMap(iscs: IscLayerEntry[]): LayerMapResult {
  const unlabeled: string[] = [];
  const invalid: Array<{ id: string; label: string }> = [];
  for (const isc of iscs) {
    const label = (isc.label ?? '').trim();
    if (label === '') {
      unlabeled.push(isc.id);
    } else if (!(VALID_PYRAMID_LABELS as readonly string[]).includes(label)) {
      invalid.push({ id: isc.id, label });
    }
  }
  return {
    ok: unlabeled.length === 0 && invalid.length === 0,
    total: iscs.length,
    unlabeled,
    invalid,
  };
}

export function renderLayerMap(result: LayerMapResult): string {
  if (result.ok) {
    return formatVerdict({
      kind: 'PASS',
      detail: `layer-map-check: ${result.total}/${result.total} ISC labeled`,
    });
  }
  const parts: string[] = [];
  if (result.unlabeled.length > 0) parts.push(`unlabeled: ${result.unlabeled.join(', ')}`);
  if (result.invalid.length > 0)
    parts.push(`invalid: ${result.invalid.map((i) => `${i.id} ('${i.label}')`).join(', ')}`);
  return formatVerdict({ kind: 'BLOCK', reason: `layer-map-check: ${parts.join('; ')}` });
}

// ---------------------------------------------------------------------------
// ISC-24 — pyramid-missing-tests (B5 gate/predicate)
//
// Mechanizes the QA pyramid-completeness check from _test-pyramid-gate.md
// (## QA + E2E Pyramid Reviewer Framing): for every changed source file under
// packages/** (.ts AND .tsx) that lacks a matching __tests__/<name>.test.ts
// sibling IN THE SAME diff, emit one byte-faithful Vitest-unit TODO.
// File-level heuristic only — no branch-coverage parsing.
//
// The heuristic itself (scope, exclusions, sibling path, TODO text) lives in
// _shared.findMissingUnitTests — shared with ReviewOpenPRsCli qa-gaps (TV-5).
// ---------------------------------------------------------------------------

export interface PyramidMissingResult {
  ok: boolean;
  sourcesChecked: number;
  todos: string[]; // byte-faithful "- [ ] (agent:qa) ..." checklist rows
}

export function validatePyramidMissing(changedPaths: string[]): PyramidMissingResult {
  const { ok, sourcesChecked, todos } = findMissingUnitTests(changedPaths);
  return { ok, sourcesChecked, todos };
}

export function renderPyramidMissing(result: PyramidMissingResult): string {
  if (result.ok) {
    return formatVerdict({
      kind: 'PASS',
      detail: `pyramid-missing-tests: ${result.sourcesChecked} source(s), 0 missing unit sibling`,
    });
  }
  return formatVerdict({
    kind: 'BLOCK',
    reason: `pyramid-missing-tests: ${result.todos.length} of ${result.sourcesChecked} source(s) missing a __tests__/ unit sibling`,
  });
}

// ---------------------------------------------------------------------------
// ISC-26 — contract-check (B5 gate/predicate)
//
// Mechanizes the Pre-Delegation Contract file-ownership boundary
// (DeliverFeature.md "### Pre-Delegation Contract" + Data/Roster.json owns/produces).
// Given a role and the files it wrote, validate every written file falls inside
// the role's ownership globs; FAIL listing out-of-glob writes (a frontend agent
// writing a backend .action.ts, etc.).
//
// The role's ownership globs are DERIVED from Data/Roster.json — the path/glob
// tokens embedded in the role's `owns` + `produces` arrays (placeholders <x> are
// normalized to *). This keeps the roster the single source of truth.
// ---------------------------------------------------------------------------

export interface RosterRole {
  id: string;
  role?: string;
  owns?: string[];
  produces?: string[];
}
export interface RosterFile {
  team: RosterRole[];
}

export interface ContractCheckResult {
  ok: boolean;
  role: string;
  knownRole: boolean;
  globs: string[];
  outOfGlob: string[];
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Placeholders like <feature> / <domain> / <name> -> a single-segment wildcard.
function normalizeGlob(glob: string): string {
  return glob.replace(/<[^>]+>/g, '*');
}

// A whitespace token qualifies as a path/glob (vs prose) when it carries a path
// separator, a wildcard, a placeholder, or a known source-file extension.
function isGlobToken(t: string): boolean {
  return (
    t.length > 0 &&
    (t.includes('/') ||
      t.includes('*') ||
      /<[^>]+>/.test(t) ||
      /\.(ts|tsx|prisma|mdoc|md|json|sql|css)$/.test(t))
  );
}

function stripWrap(t: string): string {
  return t.replace(/^[([]+/, '').replace(/[)\],]+$/, '');
}

function findRole(roster: RosterFile, roleKey: string): RosterRole | undefined {
  const key = roleKey.toLowerCase();
  return roster.team.find(
    (r) => r.id.toLowerCase() === key || (r.role ?? '').toLowerCase() === key,
  );
}

export function ownershipGlobs(roster: RosterFile, roleKey: string): string[] {
  const role = findRole(roster, roleKey);
  if (!role) return [];
  const phrases = [...(role.owns ?? []), ...(role.produces ?? [])];
  const globs = new Set<string>();
  for (const phrase of phrases) {
    for (const raw of phrase.split(/\s+/)) {
      const tok = stripWrap(raw);
      if (isGlobToken(tok)) globs.add(normalizeGlob(tok));
    }
  }
  return [...globs];
}

// Suffix-aware glob match. Slash globs match as a path tail (a single * spans one
// path segment); bare globs match the basename (* spans zero-or-more, a leading-dot
// token matches by extension suffix, an extensionful bare token matches exactly).
export function matchesGlob(file: string, glob: string): boolean {
  if (glob.includes('/')) {
    // `**` spans path segments (any depth incl. slashes); a single `*` stays
    // within one segment. Tokenize on `**` first so a multi-segment ownership
    // glob (apps/web/**/page.tsx) matches a nested write, instead of the old
    // `*`->[^/]+ expansion that false-BLOCKed it once contract-check went live.
    const src =
      '(^|/)' +
      glob
        .split('**')
        .map((seg) => seg.split('*').map(escapeRegex).join('[^/]*'))
        .join('.*') +
      '$';
    return new RegExp(src).test(file);
  }
  const base = file.split('/').pop() ?? file;
  if (glob.includes('*')) {
    return new RegExp('^' + glob.split('*').map(escapeRegex).join('[^/]*') + '$').test(base);
  }
  if (glob.startsWith('.')) return base.endsWith(glob);
  return base === glob;
}

export function validateContract(
  input: { role: string; files_written: string[] },
  roster: RosterFile,
): ContractCheckResult {
  const knownRole = findRole(roster, input.role) !== undefined;
  const globs = ownershipGlobs(roster, input.role);
  const outOfGlob: string[] = [];
  if (knownRole) {
    for (const f of input.files_written) {
      if (!globs.some((g) => matchesGlob(f, g))) outOfGlob.push(f);
    }
  }
  return { ok: knownRole && outOfGlob.length === 0, role: input.role, knownRole, globs, outOfGlob };
}

export function renderContractCheck(result: ContractCheckResult): string {
  if (!result.knownRole) {
    return formatVerdict({ kind: 'BLOCK', reason: `contract-check: unknown role '${result.role}'` });
  }
  if (result.ok) {
    return formatVerdict({
      kind: 'PASS',
      detail: `contract-check: ${result.role} — all writes in-glob`,
    });
  }
  return formatVerdict({
    kind: 'BLOCK',
    reason: `contract-check: ${result.role} wrote ${result.outOfGlob.length} out-of-glob file(s): ${result.outOfGlob.join(', ')}`,
  });
}

// ---------------------------------------------------------------------------
// preflight — substrate readiness manifest.
//
// Checks (a) target-repo resolution via ResolveRepo.ts, (b) roster health
// (Data/Roster.json parses, required role fields, slug -> saved_agents_dir
// file, composed_skills -> ~/.claude/skills/ dir), (c) cited scripts exist in
// the target repo package.json, (d) ~/.claude/DOS/Algorithm/LATEST resolves.
// Emits ONE JSON manifest to stdout. Exit 1 only when the repo is unresolvable
// or Roster.json is invalid; missing compositions/skills are WARNINGS (the
// spawn ladder degrades, it does not block).
// ---------------------------------------------------------------------------

/** Roster fields every role must carry for the delegation contract to work. */
export const REQUIRED_ROLE_FIELDS = [
  'id',
  'role',
  'slug',
  'traits',
  'owns',
  'consumes',
  'produces',
  'mcp_tools',
] as const;

/** Scripts the workflows cite in the target repo (read-only ladder + healthcheck). */
export const REQUIRED_KIT_SCRIPTS = ['healthcheck', 'test:unit', 'lint', 'typecheck'] as const;

export interface PreflightManifest {
  repo: { root: string; name: string; kind: string; lintTool: string } | null;
  roster: { ok: boolean; missing_compositions: string[]; missing_skills: string[] };
  scripts: { present: string[]; missing: string[] };
  doctrine: string | null;
  // MCP connectivity and team primitives are harness tool surfaces — not visible
  // from a CLI process. The manifest carries the probe INSTRUCTION the
  // orchestrator executes at run start, not a value pretending to be a probe.
  mcp: { status: 'unknown-from-cli'; probe: string; fallback: string };
  spawn: { default: 'task-fanout'; probe: string };
  warnings: string[];
  errors: string[];
}

export interface PreflightOptions {
  kitRepo?: string;
  rosterPath?: string;
  skillsDir?: string;
  doctrinePath?: string;
}

function expandTilde(p: string): string {
  return p.startsWith('~') ? join(homedir(), p.slice(1)) : p;
}

export function runPreflight(opts: PreflightOptions = {}): {
  manifest: PreflightManifest;
  exitCode: number;
} {
  const warnings: string[] = [];
  const errors: string[] = [];

  // (a) repo resolution
  let profile: KitRepoProfile | null = null;
  try {
    profile = resolveKitRepo(opts.kitRepo);
  } catch (e) {
    errors.push(e instanceof Error ? e.message : String(e));
  }

  // (b) roster health
  const rosterPath = opts.rosterPath ?? resolve(import.meta.dir, '../Data/Roster.json');
  const skillsDir = opts.skillsDir ?? join(homedir(), '.claude/skills');
  const missingCompositions: string[] = [];
  const missingSkills: string[] = [];
  let rosterOk = false;
  try {
    const roster = JSON.parse(readFileSync(rosterPath, 'utf8')) as {
      saved_agents_dir?: string;
      team?: Array<Record<string, unknown>>;
    };
    if (!Array.isArray(roster.team) || roster.team.length === 0) {
      throw new Error(`Roster.json has no team[] roles (${rosterPath})`);
    }
    rosterOk = true;
    for (const role of roster.team) {
      const id = typeof role.id === 'string' ? role.id : '<no id>';
      const missingFields = REQUIRED_ROLE_FIELDS.filter((f) => !(f in role));
      if (missingFields.length > 0) {
        rosterOk = false;
        errors.push(`Roster role ${id} missing required field(s): ${missingFields.join(', ')}`);
      }
    }

    const savedAgentsDir = expandTilde(roster.saved_agents_dir ?? '');
    const savedAgents =
      savedAgentsDir && existsSync(savedAgentsDir) ? readdirSync(savedAgentsDir) : null;
    if (savedAgents === null) {
      warnings.push(
        `saved_agents_dir not found: ${savedAgentsDir || '(unset)'} — see RosterBootstrap.md`,
      );
    }
    for (const role of roster.team) {
      const id = typeof role.id === 'string' ? role.id : '<no id>';
      const slug = typeof role.slug === 'string' ? role.slug : '';
      if (slug && !(savedAgents ?? []).some((f) => f === slug || f.startsWith(slug))) {
        missingCompositions.push(id);
      }
      for (const skill of Array.isArray(role.composed_skills) ? role.composed_skills : []) {
        if (typeof skill === 'string' && !existsSync(join(skillsDir, skill))) {
          if (!missingSkills.includes(skill)) missingSkills.push(skill);
        }
      }
    }
    if (missingCompositions.length > 0) {
      warnings.push(
        `${missingCompositions.length} role(s) have no composed agent file in saved_agents_dir ` +
          `(${missingCompositions.join(', ')}) — spawn ladder degrades to base agents; see RosterBootstrap.md`,
      );
    }
    if (missingSkills.length > 0) {
      warnings.push(
        `composed_skills missing under ${skillsDir}: ${missingSkills.join(', ')} — see RosterBootstrap.md`,
      );
    }
  } catch (e) {
    rosterOk = false;
    errors.push(`Roster.json invalid: ${e instanceof Error ? e.message : String(e)}`);
  }

  // (c) cited scripts in the target repo package.json
  const present: string[] = [];
  const missing: string[] = [];
  for (const script of REQUIRED_KIT_SCRIPTS) {
    (profile && script in profile.scripts ? present : missing).push(script);
  }
  if (profile && missing.length > 0) {
    warnings.push(`target repo package.json missing script(s): ${missing.join(', ')}`);
  }

  // (d) doctrine pointer
  const doctrinePath = opts.doctrinePath ?? join(homedir(), '.claude/DOS/Algorithm/LATEST');
  const doctrine = existsSync(doctrinePath) ? doctrinePath : null;
  if (!doctrine) warnings.push(`doctrine pointer does not resolve: ${doctrinePath}`);

  const manifest: PreflightManifest = {
    repo: profile
      ? { root: profile.root, name: profile.name, kind: profile.kind, lintTool: profile.lintTool }
      : null,
    roster: { ok: rosterOk, missing_compositions: missingCompositions, missing_skills: missingSkills },
    scripts: { present, missing },
    doctrine,
    mcp: {
      status: 'unknown-from-cli',
      probe: 'orchestrator: check the tool surface for mcp__makerkit__* at run start',
      fallback: 'read-only ladder: pnpm lint && pnpm typecheck && pnpm test:unit',
    },
    spawn: {
      default: 'task-fanout',
      probe:
        'orchestrator: check the tool surface for team primitives (team-create / team-scoped messaging); absent => L2 fan-out per _algorithm-team-spawn.md',
    },
    warnings,
    errors,
  };
  return { manifest, exitCode: profile === null || !rosterOk ? 1 : 0 };
}

// CLI entry: subcommand dispatch.
//   echo '{"record":{...},"expectedIscCount":N,"slug":"..."}' | bun MakerkitCli.ts decompose-gate
//   echo '{"summary":[...],"testPlan":[...]}'                  | bun MakerkitCli.ts pr-body
//   echo '{"fileCount":4,"isFixLike":false,...}'               | bun MakerkitCli.ts classify-scope
//   echo '{"unitLayerGreen":true,...}'                         | bun MakerkitCli.ts pyramid-gate
//   echo '{"iscs":[{"id":"ISC-1","label":"unit-covered"}]}'    | bun MakerkitCli.ts layer-map-check
//   echo '{"changedPaths":["packages/rbac/src/x.ts"]}'         | bun MakerkitCli.ts pyramid-missing-tests
//   echo '{"role":"backend","files_written":["..."]}'          | bun MakerkitCli.ts contract-check
//   bun MakerkitCli.ts preflight [--kit-repo <p>] [--roster <p>] [--skills-dir <p>] [--doctrine <p>]
//
// Exit codes: 0 = gate passed, 1 = gate BLOCKED, 2 = usage error,
// 3 (EXIT_VACUOUS) = zero items to verify — the gate did not run (never a
// silent 0 over an empty input).
if (import.meta.main && process.argv[2] === 'preflight') {
  // preflight takes flags, not stdin — dispatched before the stdin read below.
  const flags: PreflightOptions = {};
  const argv = process.argv.slice(3);
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--kit-repo') flags.kitRepo = argv[++i];
    else if (argv[i] === '--roster') flags.rosterPath = argv[++i];
    else if (argv[i] === '--skills-dir') flags.skillsDir = argv[++i];
    else if (argv[i] === '--doctrine') flags.doctrinePath = argv[++i];
  }
  const { manifest, exitCode } = runPreflight(flags);
  process.stdout.write(JSON.stringify(manifest, null, 2) + '\n');
  process.exit(exitCode);
} else if (import.meta.main) {
  const sub = process.argv[2];
  const input = JSON.parse(await readStdin());
  // Vacuous-input contract: a gate with zero items to verify exits EXIT_VACUOUS
  // with a stderr message — never a silent 0.
  const vacuous = (gate: string, what: string): never => {
    process.stderr.write(vacuousMessage(gate, what) + '\n');
    process.exit(EXIT_VACUOUS);
  };
  if (sub === 'decompose-gate') {
    if (!input.record || !(input.expectedIscCount > 0)) {
      vacuous('decompose-gate', 'ISCs (no record / non-positive expectedIscCount)');
    }
    const result = validateDecomposeGate(input.record, input.expectedIscCount);
    process.stdout.write(renderDecomposeGate(input.slug, result) + '\n');
    if (!result.ok) process.exit(1);
  } else if (sub === 'pr-body') {
    process.stdout.write(renderPrBody(input as PrBodyData) + '\n');
  } else if (sub === 'classify-scope') {
    process.stdout.write(JSON.stringify(classifyFeatureScope(input as ScopeSignals), null, 2) + '\n');
  } else if (sub === 'pyramid-gate') {
    if (!PYRAMID_CHECK_LABELS.some(([key]) => key in input)) {
      vacuous('pyramid-gate', 'checks');
    }
    const result = validateTestPyramidGate(input as TestPyramidChecks);
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    if (!result.ok) process.exit(1);
  } else if (sub === 'layer-map-check') {
    if (!Array.isArray(input.iscs) || input.iscs.length === 0) {
      vacuous('layer-map-check', 'ISCs');
    }
    const result = validateLayerMap(input.iscs as IscLayerEntry[]);
    process.stdout.write(renderLayerMap(result) + '\n');
    if (!result.ok) process.exit(1);
  } else if (sub === 'pyramid-missing-tests') {
    if (!Array.isArray(input.changedPaths) || input.changedPaths.length === 0) {
      vacuous('pyramid-missing-tests', 'changed paths');
    }
    const result = validatePyramidMissing(input.changedPaths as string[]);
    process.stdout.write(renderPyramidMissing(result) + '\n');
    for (const todo of result.todos) process.stdout.write(todo + '\n');
    if (!result.ok) process.exit(1);
  } else if (sub === 'contract-check') {
    if (!Array.isArray(input.files_written) || input.files_written.length === 0) {
      vacuous('contract-check', 'written files');
    }
    const result = validateContract(
      input as { role: string; files_written: string[] },
      rosterData as unknown as RosterFile,
    );
    process.stdout.write(renderContractCheck(result) + '\n');
    if (!result.ok) process.exit(1);
  } else {
    process.stderr.write(
      'usage: MakerkitCli.ts <decompose-gate|pr-body|classify-scope|pyramid-gate|layer-map-check|pyramid-missing-tests|contract-check>  (JSON on stdin)  |  MakerkitCli.ts preflight [flags]\n',
    );
    process.exit(2);
  }
}
