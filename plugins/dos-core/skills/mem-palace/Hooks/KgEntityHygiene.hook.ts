#!/usr/bin/env bun
/**
 * KgEntityHygiene.hook.ts — Weekly KG entity deduplication scanner.
 *
 * ⚠️ SUPERSEDED (2026-07-01, RFC-0146 §D1): the case-variant entity-dedup this
 * scanner performs is now covered by LOADED weekly launchd jobs — KgMerge
 * (kg-merge-weekly: case-insensitive collision + auto-apply after 7-day soak) and
 * MemoryHygiene.ts (memory-hygiene-weekly: normalized entityMap merge proposals).
 * Its dedicated plist (com.duranteos.mempalace-kg-entity-hygiene) is intentionally
 * NOT loaded; the only non-subsumed residual is plural/singular informational
 * proposals (low-value). Kept — NOT removed — per "surgical fixes, never remove as
 * a fix". Do NOT re-flag as an "unwired hook"; non-registration is intentional.
 *
 * PURPOSE:
 * Scans the knowledge graph entity corpus for likely duplicate entity pairs:
 *   1. Case-only variants (e.g., "Lucas" vs "lucas" vs "LUCAS")
 *   2. Plural/singular pairs (e.g., "hook" vs "hooks", "session" vs "sessions")
 *
 * Writes INFORMATIONAL proposals to:
 *   $DOS_DIR/MEMORY/STATE/kg-merge-proposals.json
 *
 * DOES NOT auto-merge. Operator reviews proposals and invokes bridge
 * `merge_entities` manually when confident. This is purely informational.
 *
 * TRIGGER:
 *   launchd plist com.duranteos.mempalace-kg-entity-hygiene (Sunday 03:00)
 *   NOT triggered by Claude Code's hook system. The .hook.ts suffix follows
 *   naming convention for hooks/ directory consistency.
 *
 * USAGE:
 *   bun ~/.claude/hooks/KgEntityHygiene.hook.ts           # write proposals
 *   bun ~/.claude/hooks/KgEntityHygiene.hook.ts --dry-run # print, no write
 *
 * EXIT CODES:
 *   0 = success (proposals written or none found, or dry-run)
 *   1 = bridge error (kg_stats failed)
 *
 * CROSS-REFS:
 *   - ISC-50 in PRD: MEMORY/WORK/active/20260512_mempalace-findings-delivery/PRD.md
 *   - Plist: ~/Durante/Tools/com.duranteos.mempalace-kg-entity-hygiene.plist
 *   - Proposals output: $DOS_DIR/MEMORY/STATE/kg-merge-proposals.json
 *   - Spec: MEMORY/CANONICAL/MemPalace-capability-state.md §4
 *
 * 2026-05-12: Initial implementation (ISC-50). Informational-only; no destructive
 *   writes. Samples up to MAX_PREDICATES_TO_SAMPLE predicates to collect entity names.
 */

import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { BRIDGE_PATH, bridgeSync } from './lib/mempalace';

const DOS_DIR = process.env.DOS_DIR || join(homedir(), '.claude');
const PROPOSALS_PATH = join(DOS_DIR, 'MEMORY', 'STATE', 'kg-merge-proposals.json');

const DRY_RUN = process.argv.includes('--dry-run');
const MAX_PREDICATES_TO_SAMPLE = 30;
const BRIDGE_TIMEOUT_MS = 30_000;

// ─── Bridge invocation ───────────────────────────────────────────────────────

function bridgeCallSync(action: string, args: Record<string, unknown>): Record<string, unknown> {
  const result = bridgeSync(action, args, BRIDGE_TIMEOUT_MS);
  if (!result.ok) throw new Error(`bridge ${action} failed: ${result.reason}`);
  return result.data;
}

// ─── Duplicate detection ─────────────────────────────────────────────────────

interface MergeProposal {
  source: string;
  target: string;
  reason: 'case-only duplicate' | 'plural/singular pair';
  confidence: number;
  detected_at: string;
}

function normalize(name: string): string {
  return name.toLowerCase().trim();
}

/**
 * Strip common plural suffixes to derive a singular stem.
 * Conservative heuristic — catches clear morphological pairs only.
 */
function singularStem(name: string): string {
  const s = normalize(name);
  if (s.endsWith('ies') && s.length > 4) return s.slice(0, -3) + 'y';
  if (s.endsWith('ses') && s.length > 4) return s.slice(0, -2);
  if (s.endsWith('es') && s.length > 3) return s.slice(0, -2);
  if (s.endsWith('s') && s.length > 3) return s.slice(0, -1);
  return s;
}

function detectDuplicates(entities: string[]): MergeProposal[] {
  const proposals: MergeProposal[] = [];
  const seen = new Set<string>();
  const now = new Date().toISOString();

  // Pass 1: case-only duplicates
  const caseGroups = new Map<string, string[]>();
  for (const e of entities) {
    const key = normalize(e);
    if (!caseGroups.has(key)) caseGroups.set(key, []);
    const group = caseGroups.get(key)!;
    if (!group.includes(e)) group.push(e);
  }

  for (const group of caseGroups.values()) {
    if (group.length < 2) continue;
    // Survivor selection MUST match KgMerge, the hook that actually executes
    // merges. Its ordering is
    //     ORDER BY (name = upper(name)) ASC, (name = lower(name)) ASC, name
    // i.e. all-caps last, all-lowercase last, alphabetical tiebreak — because a
    // degenerate variant winning a merge deletes the proper-cased entity and
    // erodes knowledge-graph name quality over time (Forge H-071).
    //
    // This hook used to prefer the FULLY-LOWERCASE variant, the exact inverse. It
    // only PROPOSES — a human applies the merge — so the trap was an operator
    // trusting a proposal that fights the executor's own rule, merging `Lucas`
    // into `lucas`. Latent today (0 case-only duplicate groups across 5495 live
    // entities) and wrong the moment one appears.
    //
    // The old `a.length - b.length` tiebreak was near-dead: `normalize()` groups
    // by lowercase+trim, so members are case variants of one name and differ in
    // length only by stray whitespace. Alphabetical mirrors KgMerge and is stable.
    const sorted = [...group].sort((a, b) => {
      const aUpper = a === a.toUpperCase();
      const bUpper = b === b.toUpperCase();
      if (aUpper !== bUpper) return aUpper ? 1 : -1;
      const aLower = a === a.toLowerCase();
      const bLower = b === b.toLowerCase();
      if (aLower !== bLower) return aLower ? 1 : -1;
      return a < b ? -1 : a > b ? 1 : 0;
    });
    const target = sorted[0];
    for (const source of sorted.slice(1)) {
      const pairKey = `${normalize(source)}→${normalize(target)}`;
      if (seen.has(pairKey)) continue;
      seen.add(pairKey);
      proposals.push({
        source,
        target,
        reason: 'case-only duplicate',
        confidence: 0.95,
        detected_at: now,
      });
    }
  }

  // Pass 2: plural/singular pairs (skip pairs already caught in Pass 1)
  const stemGroups = new Map<string, string[]>();
  for (const e of entities) {
    const stem = singularStem(e);
    if (!stemGroups.has(stem)) stemGroups.set(stem, []);
    const group = stemGroups.get(stem)!;
    if (!group.includes(e)) group.push(e);
  }

  for (const [stem, group] of stemGroups.entries()) {
    if (group.length < 2) continue;
    // Only flag if members are genuinely distinct after case-normalization
    const normalizedSet = new Set(group.map(normalize));
    if (normalizedSet.size < 2) continue;
    // Target: the member whose normalized form equals the stem (singular)
    const target = group.find(e => normalize(e) === stem) ?? group[0];
    for (const source of group) {
      if (normalize(source) === normalize(target)) continue;
      const pairKey = `${normalize(source)}→${normalize(target)}`;
      if (seen.has(pairKey)) continue;
      seen.add(pairKey);
      proposals.push({
        source,
        target,
        reason: 'plural/singular pair',
        confidence: 0.70,
        detected_at: now,
      });
    }
  }

  return proposals;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  if (!existsSync(BRIDGE_PATH)) {
    console.error(`[KgEntityHygiene] Bridge not found at ${BRIDGE_PATH} — exiting`);
    process.exit(1);
  }

  // Step 1: get KG stats and relationship type list
  let stats: Record<string, unknown>;
  try {
    stats = bridgeCallSync('kg_stats', {});
  } catch (err) {
    console.error('[KgEntityHygiene] kg_stats failed:', err);
    process.exit(1);
  }

  const relationshipTypes = (stats.relationship_types as string[] | undefined) ?? [];
  console.error(
    `[KgEntityHygiene] KG: ${stats.entities} entities, ${stats.triples} triples, ` +
    `${relationshipTypes.length} relationship types`
  );

  // Step 2: sample entity names from a cross-section of predicates
  const entityNames = new Set<string>();
  const toSample = relationshipTypes.slice(0, MAX_PREDICATES_TO_SAMPLE);

  for (const predicate of toSample) {
    try {
      const result = bridgeCallSync('kg_query_predicate', { predicate });
      const facts = (result.facts as Array<Record<string, unknown>>) ?? [];
      for (const fact of facts) {
        if (typeof fact.subject === 'string' && fact.subject) entityNames.add(fact.subject);
        if (typeof fact.object === 'string' && fact.object) entityNames.add(fact.object);
      }
    } catch {
      // Per-predicate failures are non-fatal — continue sampling
    }
  }

  const entities = [...entityNames];
  console.error(
    `[KgEntityHygiene] Sampled ${entities.length} unique entity names ` +
    `from ${toSample.length} predicates`
  );

  // Step 3: detect duplicates
  const proposals = detectDuplicates(entities);
  console.error(
    `[KgEntityHygiene] ${proposals.length} merge candidate${proposals.length === 1 ? '' : 's'} detected`
  );
  for (const p of proposals) {
    console.error(`  → '${p.source}' → '${p.target}' (${p.reason}, confidence=${p.confidence})`);
  }

  // Step 4: write proposals file (informational — no auto-merge ever)
  if (!DRY_RUN) {
    const stateDir = join(DOS_DIR, 'MEMORY', 'STATE');
    if (!existsSync(stateDir)) mkdirSync(stateDir, { recursive: true });

    const output = {
      generated_at: new Date().toISOString(),
      entity_sample_size: entities.length,
      predicates_sampled: toSample.length,
      proposal_count: proposals.length,
      note: 'INFORMATIONAL ONLY — review and invoke bridge merge_entities manually. DO NOT auto-merge.',
      proposals,
    };

    writeFileSync(PROPOSALS_PATH, JSON.stringify(output, null, 2) + '\n');
    console.error(`[KgEntityHygiene] Proposals written to ${PROPOSALS_PATH}`);
  } else {
    console.error('[KgEntityHygiene] --dry-run active: proposals NOT written to disk');
    console.log(JSON.stringify({ dry_run: true, proposals }, null, 2));
  }
}

main().catch((err) => {
  console.error('[KgEntityHygiene] Fatal:', err);
  process.exit(1);
});
