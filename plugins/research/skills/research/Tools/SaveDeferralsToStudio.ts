#!/usr/bin/env bun
/**
 * SaveDeferralsToStudio - Sync deferrals from KG to Studio
 *
 * Reads deferred facts via MemPalace bridge, POSTs to /api/v1/deferrals.
 *
 * USAGE
 * -----
 *   bun SaveDeferralsToStudio.ts --import-all
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { loadEnv } from '../Lib/env';
import { requireStudioConfigOrSkip } from '../Lib/studioClient';
import { queueOrPost, digestOfBody, crossTenantGate } from '../Lib/dlq';
import { loadAckedKeys } from '../Lib/dlq-dedup';

loadEnv();

requireStudioConfigOrSkip('SaveDeferralsToStudio');

interface KGFact {
  subject: string;
  predicate: string;
  object: string;
  valid_from?: string;
  context?: string;
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
 * See SaveCommitmentsToStudio.ts for the rationale. Same heuristic.
 */
function extractAbsPath(fact: KGFact): string | null {
  const probes = [fact.context, fact.object];
  const absRegex = /\B\/(?:Users|opt|var|home|tmp|private)\/[^\s'"]+/;
  for (const probe of probes) {
    if (typeof probe !== 'string') continue;
    const match = probe.match(absRegex);
    if (match && match[0]) return match[0];
  }
  return null;
}

async function syncDeferral(fact: KGFact, acked: Set<string>): Promise<'synced' | 'failed' | 'skipped'> {
  const body = {
    content: fact.object,
    wing: extractWing(fact),
    deferredAt: fact.valid_from || new Date().toISOString(),
  };

  // RFC-0062 F3 — gate cross-tenant absolute paths embedded in the fact
  // body or context. No-op when no path-shaped token is found.
  const gate = crossTenantGate({
    tool: 'deferrals',
    endpoint: '/api/v1/deferrals',
    absPath: extractAbsPath(fact),
    source: 'SaveDeferralsToStudio',
    payload: body,
  });
  if (!gate.ok) return 'failed';

  // ack-dedup firewall: the SAME key drives both the dedup check and the
  // idempotencyKey. Skip rows already acked in the ledger so --import-all
  // does not re-flood the DLQ every SessionEnd (incident 2026-06-22).
  const key = `deferrals:${digestOfBody(body)}`;
  if (acked.has(key)) return 'skipped';

  const result = await queueOrPost(body, '/api/v1/deferrals', {
    tool: 'deferrals',
    idempotencyKey: key,
  });
  if (result.outcome === 'dropped') {
    console.error(`Sync dropped for deferral "${fact.object.slice(0, 60)}": ${result.reason}`);
    return 'failed';
  }
  return 'synced';
}

async function importAll(): Promise<void> {
  const bridgeResult = Bun.spawnSync(
    ['uv', 'run', '--with', 'mempalace>=3.3.5,<4',
     'python', join(homedir(), '.claude', 'DOS', 'Tools', 'mempalace_bridge.py'),
     'kg_query_predicate', JSON.stringify({ predicate: 'deferred' })],
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
    console.error('No deferred facts found');
    process.exit(0);
  }

  const acked = loadAckedKeys("deferrals:");

  let synced = 0;
  let failed = 0;
  let skipped = 0;

  for (const fact of facts) {
    if (!fact.object) { failed++; continue; }
    const outcome = await syncDeferral(fact, acked);
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
  console.error('Usage: bun SaveDeferralsToStudio.ts --import-all');
  process.exit(1);
}
