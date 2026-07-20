#!/usr/bin/env bun
/**
 * KgRetractOnPrdArchive.hook.ts — Auto-retract KG facts when a PRD is archived.
 *
 * PURPOSE:
 * When a PRD.md file is written or edited inside the MEMORY/WORK/archived/ tree,
 * this hook fires bridge `invalidate` on stale KG facts for that PRD's slug:
 *   - subject=<slug>, predicate=working_on (all active instances)
 *   - subject=<slug>, predicate=phase      (all active instances)
 *
 * This closes the stale-fact gap from the 2026-05-12 audit:
 *   KG retraction (`invalidate`) fires only 4 times / 4 days; `working_on`
 *   and `phase` facts linger after PRDs move to archived state.
 *
 * TRIGGER: PostToolUse — Write, Edit, MultiEdit
 *
 * PATH FILTER (applied inside hook):
 *   file_path must match: /MEMORY/WORK/archived/<slug>/PRD.md
 *
 * DESIGN:
 *   - Slug extracted from PRD frontmatter `slug:` field; falls back to
 *     the directory name from the path match.
 *   - Queries kg_query_predicate for active working_on and phase facts.
 *   - Calls bridge invalidate for each active fact found.
 *   - Non-blocking: always exits 0; bridge errors go to stderr only.
 *   - Idempotent: invalidate on an already-expired fact is a safe no-op.
 *
 * USAGE: Triggered by Claude Code harness. Not normally run manually.
 *   For manual testing: echo '{"tool_input":{"file_path":"/path/to/archived/slug/PRD.md"}}' | bun KgRetractOnPrdArchive.hook.ts
 *
 * EXIT CODES: 0 always (non-blocking by design)
 *
 * CROSS-REFS:
 *   - ISC-51 in PRD: MEMORY/WORK/active/20260512_mempalace-findings-delivery/PRD.md
 *   - ISC-52: retraction smoke test
 *   - settings.json: PostToolUse → Write, Edit, MultiEdit
 *   - Companion: KgEntityHygiene.hook.ts (ISC-50 — entity dedup, weekly cron)
 *   - Spec: MEMORY/CANONICAL/MemPalace-capability-state.md §4
 *
 * 2026-05-12: Initial implementation (ISC-51). Uses synchronous spawnSync for
 *   bridge calls to ensure retraction completes before hook exits.
 */

import { readFileSync, existsSync } from 'fs';
import { startTimer, stopTimer } from './lib/hook-io';
import { BRIDGE_PATH, bridgeSync as invokeBridgeSync } from './lib/mempalace';

const BRIDGE_TIMEOUT_MS = 10_000;

/** PRD path regex — captures slug from directory name. */
const ARCHIVED_PRD_RE = /\/MEMORY\/WORK\/archived\/([^/]+)\/PRD\.md$/;

/**
 * KG predicates to retract when a PRD is archived.
 * Note: ISC-51 originally specified `working_on` (present tense) but that
 * predicate is not in PREDICATES.md canonical list. The ratified form is
 * `worked_on` (past tense, session-attribution). Using `worked_on` + `phase`
 * as the correct canonical targets (2026-05-12, discovered during ISC-52 test).
 */
const RETRACT_PREDICATES = ['worked_on', 'phase'] as const;

// ─── Hook input ──────────────────────────────────────────────────────────────

interface HookInput {
  tool_input?: { file_path?: string };
  session_id?: string;
}

// ─── Frontmatter parsing ─────────────────────────────────────────────────────

function parseSlugFromPrd(filePath: string): string | null {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!fmMatch) return null;
    // Strip surrounding quotes: a quoted YAML `slug: "foo"` otherwise became the KG
    // query subject WITH quotes and never matched the unquoted graph subject, so the
    // hook silently retracted nothing. Mirrors PhaseCompleteGate's receiptSlug().
    // (Forge Gen 17, verified against quoted/single/unquoted forms.)
    const slugMatch = fmMatch[1].match(/^slug:\s*["']?([^"'\s]+)["']?\s*$/m);
    if (!slugMatch) return null;
    return slugMatch[1].trim();
  } catch {
    return null;
  }
}

// ─── Bridge helpers ──────────────────────────────────────────────────────────

interface KgFact {
  subject?: string;
  predicate?: string;
  object?: string;
  valid_to?: string | null;
}

function bridgeSync(action: string, args: Record<string, unknown>): Record<string, unknown> {
  const result = invokeBridgeSync(action, args, BRIDGE_TIMEOUT_MS);
  if (!result.ok) throw new Error(`bridge ${action} failed: ${result.reason}`);
  return result.data;
}

/**
 * Get all active (non-expired) KG facts for a given subject + predicate.
 * Returns [] on bridge error (non-fatal path).
 */
function getActiveFacts(slug: string, predicate: string): KgFact[] {
  try {
    const result = bridgeSync('kg_query_predicate', { predicate, subject: slug });
    const facts = (result.facts as KgFact[] | undefined) ?? [];
    return facts.filter(
      f => f.subject === slug && typeof f.object === 'string' && !f.valid_to
    );
  } catch (err) {
    console.error(`[KgRetractOnPrdArchive] kg_query_predicate(${predicate}) failed: ${err}`);
    return [];
  }
}

/**
 * Invalidate a single KG fact. Idempotent: bridge returns ok for already-expired facts.
 * Returns true on success, false on error.
 */
function retractFact(slug: string, predicate: string, object: string): boolean {
  try {
    bridgeSync('invalidate', { subject: slug, predicate, object });
    return true;
  } catch (err) {
    console.error(`[KgRetractOnPrdArchive] invalidate(${slug}, ${predicate}, ${object}) failed: ${err}`);
    return false;
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  // Read Claude Code hook envelope from stdin
  let input: HookInput | null = null;
  try {
    const raw = readFileSync(0, 'utf-8');
    input = raw.trim() ? (JSON.parse(raw) as HookInput) : null;
  } catch {
    process.exit(0);
  }

  const filePath = input?.tool_input?.file_path ?? '';

  // Path guard: only PRD.md files inside MEMORY/WORK/archived/
  const match = ARCHIVED_PRD_RE.exec(filePath);
  if (!match) {
    process.exit(0);
  }

  if (!existsSync(BRIDGE_PATH)) {
    console.error('[KgRetractOnPrdArchive] Bridge not installed — skipping');
    process.exit(0);
  }

  // Slug: prefer frontmatter field, fall back to directory name
  const slugFromPath = match[1];
  const slugFromFrontmatter = existsSync(filePath) ? parseSlugFromPrd(filePath) : null;
  const slug = slugFromFrontmatter ?? slugFromPath;

  console.error(
    `[KgRetractOnPrdArchive] Archived PRD detected: slug=${slug} ` +
    `(source=${slugFromFrontmatter ? 'frontmatter' : 'path'})`
  );

  // Retract working_on and phase facts for this slug
  let retractedCount = 0;
  let noFactsCount = 0;

  for (const predicate of RETRACT_PREDICATES) {
    const facts = getActiveFacts(slug, predicate);
    if (facts.length === 0) {
      console.error(`[KgRetractOnPrdArchive] No active '${predicate}' facts for slug=${slug}`);
      noFactsCount++;
      continue;
    }
    for (const fact of facts) {
      const object = fact.object as string;
      const ok = retractFact(slug, predicate, object);
      if (ok) {
        retractedCount++;
        console.error(`[KgRetractOnPrdArchive] Retracted: ${slug} --${predicate}--> ${object}`);
      }
    }
  }

  console.error(
    `[KgRetractOnPrdArchive] Done: ${retractedCount} retracted, ` +
    `${noFactsCount} predicates had no active facts (slug=${slug})`
  );
}

const _t = startTimer('KgRetractOnPrdArchive');
process.on('exit', () => stopTimer(_t, 'PostToolUse'));
main().catch((err) => {
  console.error('[KgRetractOnPrdArchive] Fatal:', err);
  process.exit(0);
});
