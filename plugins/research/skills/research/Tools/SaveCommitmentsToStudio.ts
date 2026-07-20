#!/usr/bin/env bun
/**
 * SaveCommitmentsToStudio - Sync commitments from KG to Studio
 *
 * Reads committed_to facts via MemPalace bridge, POSTs to /api/v1/commitments.
 *
 * USAGE
 * -----
 *   bun SaveCommitmentsToStudio.ts --import-all
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { loadEnv } from '../Lib/env';
import { requireStudioConfigOrSkip } from '../Lib/studioClient';
import { queueOrPost, digestOfBody, crossTenantGate } from '../Lib/dlq';
import { loadAckedKeys } from '../Lib/dlq-dedup';

loadEnv();

requireStudioConfigOrSkip('SaveCommitmentsToStudio');

interface KGFact {
  subject: string;
  predicate: string;
  object: string;
  valid_from?: string;
  context?: string;
}

function parseDeadline(text: string): string | undefined {
  const match = text.match(/\[deadline:\s*(\d{4}-\d{2}-\d{2})\]/i);
  return match ? match[1] : undefined;
}

function extractWing(fact: KGFact): string | null {
  if (fact.context) {
    const wingMatch = fact.context.match(/wing[:\s]+(\S+)/i);
    if (wingMatch) return wingMatch[1]!;
  }
  return null;
}

/**
 * Detect a cross-tenant filesystem path embedded in a KG-fact field.
 *
 * Commitments and deferrals are KG-driven and don't carry a single
 * canonical path field, but operators sometimes embed source-of-truth
 * paths in `context` or in the fact body (e.g., a commitment to ship
 * `~/Experiments/altyaa/PRD.md`). RFC-0062 F3 §D-2026-05-05-3 keeps
 * this surgical: extract the first absolute-path-like token and gate it.
 *
 * Returns the absolute path token (verbatim) when one is found, else null.
 * Empty/relative/ambiguous text returns null — no false-positive blocks.
 */
function extractAbsPath(fact: KGFact): string | null {
  // Probe `context` first (most common annotation slot), then fall back
  // to the fact `object` body. Each match is a single absolute path; we
  // do not attempt to extract multiple. The regex covers POSIX absolute
  // paths starting with `/Users/...` or `/opt/...` (the realistic shape
  // for cross-tenant leaks on macOS dev machines).
  const probes = [fact.context, fact.object];
  const absRegex = /\B\/(?:Users|opt|var|home|tmp|private)\/[^\s'"]+/;
  for (const probe of probes) {
    if (typeof probe !== 'string') continue;
    const match = probe.match(absRegex);
    if (match && match[0]) return match[0];
  }
  return null;
}

async function syncCommitment(fact: KGFact, acked: Set<string>): Promise<'synced' | 'skipped' | 'failed'> {
  const body: Record<string, unknown> = {
    content: fact.object,
    assignee: fact.subject,
    wing: extractWing(fact),
    committedAt: fact.valid_from || new Date().toISOString(),
  };

  const deadline = parseDeadline(fact.object);
  if (deadline) {
    body.deadline = deadline;
  }

  // RFC-0062 F3 — gate cross-tenant absolute paths embedded in the fact
  // body or context. When the fact has no path-shaped token, the helper
  // is a no-op (D-2026-05-05-3 surgical scope — no false-positive blocks).
  const gate = crossTenantGate({
    tool: 'commitments',
    endpoint: '/api/v1/commitments',
    absPath: extractAbsPath(fact),
    source: 'SaveCommitmentsToStudio',
    payload: body,
  });
  if (!gate.ok) return 'failed';

  // Ack-dedup firewall (incident 2026-06-22): the SAME key drives both the
  // already-synced check and the enqueue idempotencyKey — never two
  // separate expressions — so a row we skip is exactly a row already acked.
  const key = `commitments:${digestOfBody(body)}`;
  if (acked.has(key)) return 'skipped';

  const result = await queueOrPost(body, '/api/v1/commitments', {
    tool: 'commitments',
    idempotencyKey: key,
  });
  if (result.outcome === 'dropped') {
    console.error(`Sync dropped for commitment "${fact.object.slice(0, 60)}": ${result.reason}`);
    return 'failed';
  }
  return 'synced';
}

async function importAll(): Promise<void> {
  const bridgeResult = Bun.spawnSync(
    ['uv', 'run', '--with', 'mempalace>=3.3.5,<4',
     'python', join(homedir(), '.claude', 'DOS', 'Tools', 'mempalace_bridge.py'),
     'kg_query_predicate', JSON.stringify({ predicate: 'committed_to' })],
    { timeout: 15000 }
  );

  if (bridgeResult.exitCode !== 0) {
    const stderr = bridgeResult.stderr.toString();
    console.error(`Bridge error: ${stderr.slice(0, 300)}`);
    process.exit(0);
  }

  let facts: KGFact[];
  try {
    const data = JSON.parse(bridgeResult.stdout.toString());
    facts = data.facts || [];
  } catch {
    console.error('Failed to parse bridge output');
    process.exit(0);
  }

  if (facts.length === 0) {
    console.error('No committed_to facts found');
    process.exit(0);
  }

  const acked = loadAckedKeys("commitments:");

  let synced = 0;
  let failed = 0;
  let skipped = 0;

  for (const fact of facts) {
    if (!fact.object) { failed++; continue; }
    const outcome = await syncCommitment(fact, acked);
    if (outcome === 'synced') synced++;
    else if (outcome === 'skipped') skipped++;
    else failed++;
  }

  console.error(`Import complete: ${synced} synced, ${skipped} skipped, ${failed} failed (of ${facts.length} total)`);
}

const args = process.argv.slice(2);
if (args[0] === '--import-all') {
  await importAll();
} else {
  console.error('Usage: bun SaveCommitmentsToStudio.ts --import-all');
  process.exit(1);
}
