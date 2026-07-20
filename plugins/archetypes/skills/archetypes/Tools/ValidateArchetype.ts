#!/usr/bin/env bun
/**
 * ValidateArchetype — runtime validator for the archetype corpus.
 *
 * Usage:
 *   bun ValidateArchetype.ts                # validate all Data/*.archetype.ts
 *   bun ValidateArchetype.ts --only media-asset-library
 *   bun ValidateArchetype.ts --json         # machine-readable findings
 *
 * Exit codes: 0 = all valid, 1 = findings, 2 = load error.
 * Zero external deps by design (live-install has no node_modules).
 */
import { TIERS, type Archetype, type Tier } from '../Schema/Archetype';
import { loadCorpus } from './LoadCorpus';

/** Minimum best-evidence ratio for a T1 row without rider/exception. */
const T1_GROUNDING_FLOOR = 0.75;

/** Smallest cohort whose full coverage counts as "universal" (guards tiny cohorts). */
const UNIVERSALITY_MIN_COHORT = 4;

export interface Finding {
  archetype: string;
  rowId?: string;
  rule: string;
  detail: string;
}

const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

export function validate(a: Archetype): Finding[] {
  const f: Finding[] = [];
  const push = (rule: string, detail: string, rowId?: string) =>
    f.push({ archetype: a.name, rowId, rule, detail });

  if (!KEBAB.test(a.name)) push('name-kebab', `archetype name "${a.name}" not kebab-case`);
  if (!a.version) push('version-required', 'missing version');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(a.updated)) push('updated-iso', `updated "${a.updated}" not YYYY-MM-DD`);
  for (const t of TIERS) {
    if (!a.tierDefinitions?.[t]) push('tier-definitions', `missing definition for ${t}`);
  }
  // Container shape guard (archer gen-37, H27): a dict-shaped cohorts crashed
  // this loop instead of producing a finding — the gen-23 sources-dict class
  // one container over. Non-array cohorts is a typed finding, never a crash.
  if (a.cohorts !== undefined && !Array.isArray(a.cohorts)) {
    push('cohorts-shape', 'cohorts must be an ARRAY of {id,label,references} (got non-array)');
    return f;
  }
  if (!a.cohorts?.length) push('cohorts-required', 'at least one cohort required');
  // Cohort shape is enforced, not assumed (archer gen-8, H16): the gen-7
  // probe emitted cohorts without `references` and validation passed silently
  // — only the deterministic encoder caught it.
  for (const c of a.cohorts ?? []) {
    if (
      !Array.isArray(c.references) ||
      c.references.length === 0 ||
      c.references.some((ref) => typeof ref !== 'string' || !ref.trim())
    ) {
      push('cohort-references', `cohort "${c.id}" must carry a non-empty array of non-empty reference names`);
    }
  }
  const cohortIds = new Set(a.cohorts.map((c) => c.id));

  const ids = new Set<string>();
  for (const row of a.rows) {
    const r = (rule: string, detail: string) => push(rule, detail, row.id);
    if (!KEBAB.test(row.id)) r('row-id-kebab', `row id "${row.id}" not kebab-case`);
    if (ids.has(row.id)) r('row-id-unique', `duplicate row id "${row.id}"`);
    ids.add(row.id);
    if (!TIERS.includes(row.tier)) r('row-tier', `invalid tier "${row.tier}"`);
    if (!row.dimension?.trim()) r('row-dimension', 'empty dimension');
    const words = wordCount(row.seedISC);
    if (words < 5 || words > 16) r('seed-isc-length', `seedISC is ${words} words (want 5-16)`);
    for (const e of row.evidence) {
      if (!cohortIds.has(e.cohort)) r('evidence-cohort', `unknown cohort "${e.cohort}"`);
      if (e.shipping > e.of) r('evidence-count', `shipping ${e.shipping} > cohort size ${e.of}`);
    }
    // Empty evidence requires an explicit escape hatch — ALL tiers
    // (matches the schema's documented field invariant).
    if (row.evidence.length === 0 && !row.contextRider && !row.groundingException) {
      r('evidence-empty', 'empty evidence requires contextRider or groundingException');
    }
    // Rider tiers are judgments — judgments get recorded (archer gen-18,
    // operator-approved): an evidence-less rider row must state its basis.
    if (row.contextRider && row.evidence.length === 0 && !row.riderRationale) {
      r('rider-rationale-required', `rider row ("${row.contextRider}") with no market evidence must declare riderRationale`);
    }
    // The T1 universality clause is an enforced tiering rule, not prose
    // (archer gen-1, H1): a capability universal in any qualifying cohort
    // cannot sit below T1 unless a rider/exception declares why. Generalizes
    // the "or universal-in-services" escape hatch (the schema has no
    // cohort-kind field; in-app universality implies T1 anyway). Catches the
    // billing-skeptic class of silent demotion at encoding time.
    if (row.tier !== 'T1' && !row.contextRider && !row.groundingException) {
      // Symmetry on inferred evidence (archer gen-30, H23, operator-approved):
      // the universality that DEMANDS T1 must meet the same evidentiary bar as
      // the universality that GRANTS it (override-inferred, gen-17). A count
      // resting on inferred members neither promotes nor compels — otherwise
      // the inferred-universal row shape has no legal synthesis-emittable tier
      // (measured: auth 2, notifications 2, onboarding probe 3 adjudications).
      const uni = row.evidence.find(
        (e) =>
          e.of >= UNIVERSALITY_MIN_COHORT &&
          e.shipping === e.of &&
          (!e.inferred || e.confirmed === e.of),
      );
      if (uni) {
        r(
          'universality-demotion',
          `${row.tier} but universal in cohort "${uni.cohort}" (${uni.shipping}/${uni.of}) — must be T1 or carry contextRider/groundingException`,
        );
      }
    }
    // T1 rows must clear the numeric bar the tier definition promises:
    // best evidence ratio >= floor, OR a rider/exception saying why not.
    // Confirmed semantics (archer gen-38, H28 — the gen-32 leg this check
    // missed): an inferred count with a declared confirmed sub-count is
    // judged on that sub-count; the gen-36 probe shipped three T1s whose
    // full counts cleared the floor but whose confirmed portions could not.
    if (row.tier === 'T1' && !row.contextRider && !row.groundingException) {
      const best = Math.max(
        0,
        ...row.evidence.map((e) => {
          if (e.of <= 0) return 0;
          const counted = e.inferred && e.confirmed !== undefined ? e.confirmed : e.shipping;
          return counted / e.of;
        }),
      );
      if (best < T1_GROUNDING_FLOOR) {
        r(
          't1-grounding',
          `T1 best evidence ratio ${best.toFixed(2)} < ${T1_GROUNDING_FLOOR} (inferred counts judged on their confirmed sub-count) and no contextRider/groundingException`,
        );
      }
    }
  }

  // Container-shape guard (archer gen-23): sources, when present, must be an
  // array of non-empty strings — the auth-session field mint emitted a dict
  // of scratch paths and the refs check CRASHED instead of reporting. A
  // validator must never crash on malformed input; it reports.
  const sourcesOk = a.sources === undefined || (Array.isArray(a.sources) && a.sources.every((s) => typeof s === 'string' && s.trim()));
  if (!sourcesOk) push('sources-shape', 'sources must be an array of non-empty URL/citation strings');
  const sourceList: string[] = sourcesOk && Array.isArray(a.sources) ? a.sources : [];

  // Evidence provenance (archer gen-17, H3 narrow, operator-approved):
  // refs must resolve; the T1 universality override refuses inferred counts.
  for (const row of a.rows) {
    const r = (rule: string, detail: string) => push(rule, detail, row.id);
    for (const e of row.evidence) {
      for (const ref of e.refs ?? []) {
        const isUrl = /^https?:\/\//.test(ref);
        const isIndex = /^\d+$/.test(ref) && Number(ref) < sourceList.length;
        const isMember = sourceList.includes(ref);
        if (!isUrl && !isIndex && !isMember) {
          r('refs-resolve', `evidence ref "${ref}" is neither a URL, a sources member, nor a valid sources index`);
        }
      }
      // Confirmed sub-count sanity (archer gen-32, H25, operator-approved).
      if (e.confirmed !== undefined && e.confirmed > e.shipping) {
        r('confirmed-exceeds-shipping', `evidence for cohort "${e.cohort}" claims confirmed ${e.confirmed} > shipping ${e.shipping}`);
      }
    }
    if (row.tier === 'T1' && !row.groundingException && !row.mandatedBy) {
      // A count "carries quoted weight" if it is unflagged, OR its declared
      // confirmed sub-count alone clears the same bar (gen-32, H25): the
      // miner-stated confirmed/total split is the discriminator between
      // T1-stands-on-confirmed (clean) and T1-rests-on-inference (flag).
      const inapp = row.evidence.find((e) => e.cohort === 'inapp');
      const quotedInapp =
        inapp && inapp.shipping >= 6 && (!inapp.inferred || (inapp.confirmed ?? 0) >= 6);
      const quotedUni = row.evidence.some(
        (e) =>
          e.of >= UNIVERSALITY_MIN_COHORT &&
          e.shipping === e.of &&
          (!e.inferred || e.confirmed === e.of),
      );
      const inferredUni = row.evidence.some(
        (e) => e.inferred && e.of >= UNIVERSALITY_MIN_COHORT && e.shipping === e.of,
      );
      if (!quotedInapp && !quotedUni && inferredUni) {
        r(
          'override-inferred',
          'T1 rests solely on an inferred universal count — quote the sources, state a confirmed sub-count that clears the bar, or declare a groundingException',
        );
      }
    }
  }

  // Declared mandates close the tiering function (archer gen-13, H13,
  // operator-approved): a mandate must name a real doctrine source, and a
  // tier above its mechanical derivation must carry SOME declaration.
  const antiIdSet = new Set(a.antiCriteria.map((x) => x.id));
  const RANK: Record<Tier, number> = { T1: 3, T2: 2, T3: 1 };
  for (const row of a.rows) {
    const r = (rule: string, detail: string) => push(rule, detail, row.id);
    if (row.mandatedBy && !antiIdSet.has(row.mandatedBy) && !/^RFC-\d{4}/.test(row.mandatedBy)) {
      r('mandate-source', `mandatedBy "${row.mandatedBy}" names no anti-criterion in this archetype and is not an RFC ref`);
    }
    if (!row.contextRider && !row.groundingException && !row.mandatedBy) {
      const inapp = row.evidence.find((e) => e.cohort === 'inapp');
      const uni = row.evidence.find((e) => e.of >= UNIVERSALITY_MIN_COHORT && e.shipping === e.of);
      const mech: Tier = uni ? 'T1' : !inapp ? 'T3' : inapp.shipping >= 6 ? 'T1' : inapp.shipping >= 4 ? 'T2' : 'T3';
      if (RANK[row.tier] > RANK[mech]) {
        r('tier-underivable', `${row.tier} exceeds mechanical derivation ${mech} with no contextRider/groundingException/mandatedBy`);
      }
    }
  }

  const antiIds = new Set<string>();
  for (const anti of a.antiCriteria) {
    if (!anti.id.startsWith('a-')) push('anti-id-prefix', `anti-criterion id "${anti.id}" should start with a-`, anti.id);
    if (antiIds.has(anti.id)) push('anti-id-unique', `duplicate anti-criterion id "${anti.id}"`, anti.id);
    antiIds.add(anti.id);
    if (!anti.rule.trim() || !anti.why.trim()) push('anti-content', 'rule and why are both required', anti.id);
  }
  return f;
}

// CLI entry — guarded so importing `validate` (e.g. from the bun:test ratchet
// guard) never runs the corpus scan or process.exit (gen-1 review-gate fix).
if (import.meta.main) {
  const args = process.argv.slice(2);
  const asJson = args.includes('--json');
  const onlyIdx = args.indexOf('--only');
  const only = onlyIdx >= 0 ? args[onlyIdx + 1] : undefined;

  try {
    // Loader warnings (filename↔name mismatch, skipped broken drafts under
    // --only) are surfaced but ADVISORY — findings alone drive the exit code
    // (archer gen-10, H17; the known Media mismatch is documented-deferred).
    const warnings: import('./LoadCorpus').CorpusWarning[] = [];
    const archetypes = await loadCorpus(only, undefined, warnings);
    if (archetypes.length === 0) {
      console.error(only ? `no archetype named "${only}"` : 'no Data/*.archetype.ts files found');
      process.exit(2);
    }
    const findings = archetypes.flatMap(validate);
    if (asJson) {
      console.log(JSON.stringify({ archetypes: archetypes.map((a) => a.name), findings, warnings }, null, 2));
    } else {
      for (const w of warnings) console.log(`WARN ${w.message}`);
      for (const a of archetypes) {
        const own = findings.filter((x) => x.archetype === a.name);
        console.log(
          `${own.length === 0 ? 'OK  ' : 'FAIL'} ${a.name} v${a.version} — ${a.rows.length} rows, ${a.antiCriteria.length} anti-criteria${own.length ? `, ${own.length} finding(s)` : ''}`,
        );
        for (const x of own) console.log(`  - [${x.rule}]${x.rowId ? ` ${x.rowId}:` : ''} ${x.detail}`);
      }
    }
    process.exit(findings.length === 0 ? 0 : 1);
  } catch (err) {
    console.error(`load error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(2);
  }
}
