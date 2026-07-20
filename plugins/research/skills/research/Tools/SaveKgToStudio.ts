#!/usr/bin/env bun
/**
 * SaveKgToStudio - Sync knowledge graph to Studio KG API
 *
 * Reads entities and triples from ~/.mempalace/knowledge_graph.sqlite3
 * via sqlite3 and POSTs bulk to /api/v1/kg/sync.
 * Falls back to legacy knowledge_graph.db if .sqlite3 doesn't exist.
 *
 * USAGE
 * -----
 *   bun SaveKgToStudio.ts --import-all
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

import { queueOrPost, digestOfBody, crossTenantGate } from '../Lib/dlq';
import { loadAckedKeys } from '../Lib/dlq-dedup';
import { loadEnv } from '../Lib/env';
import { requireStudioConfigOrSkip } from '../Lib/studioClient';
import { isDosTenantPath } from '../Lib/project-context';

loadEnv();

const { url: STUDIO_API_URL, key: STUDIO_API_KEY } =
  requireStudioConfigOrSkip('SaveKgToStudio');

function resolveKgDbPath(): string {
  const sqlite3Path = join(homedir(), '.mempalace', 'knowledge_graph.sqlite3');
  const legacyPath = join(homedir(), '.mempalace', 'knowledge_graph.db');
  if (existsSync(sqlite3Path)) return sqlite3Path;
  if (existsSync(legacyPath)) return legacyPath;
  return sqlite3Path;
}

function queryDb(sql: string): any[] {
  const dbPath = resolveKgDbPath();
  const result = Bun.spawnSync(['sqlite3', '-json', dbPath, sql]);
  const stdout = result.stdout.toString().trim();
  if (!stdout) return [];
  try {
    return JSON.parse(stdout);
  } catch {
    return [];
  }
}

async function importAll(): Promise<void> {
  const dbPath = resolveKgDbPath();
  if (!existsSync(dbPath)) {
    console.error('No knowledge_graph.sqlite3 or knowledge_graph.db found');
    process.exit(0);
  }

  // Query entities
  const rawEntities = queryDb('SELECT id, name, type, properties, created_at FROM entities');
  const entities = rawEntities.map((e: any) => ({
    externalId: String(e.id),
    name: e.name,
    entityType: e.type,
    properties: (() => { try { return e.properties ? JSON.parse(e.properties) : undefined; } catch { return undefined; } })(),
  }));

  // Query triples
  const rawTriples = queryDb(
    'SELECT id, subject, predicate, object, valid_from, valid_to, confidence, source_closet, extracted_at FROM triples'
  );
  const triples = rawTriples.map((t: any) => {
    const triple: Record<string, unknown> = {
      externalId: String(t.id),
      subjectExternalId: String(t.subject),
      predicate: t.predicate,
      objectExternalId: String(t.object),
    };
    if (t.valid_from) triple.validFrom = t.valid_from;
    if (t.valid_to) triple.validTo = t.valid_to;
    if (t.confidence != null) triple.confidence = Number(t.confidence);
    if (t.source_closet) triple.source = t.source_closet;
    if (t.extracted_at) triple.extractedAt = t.extracted_at;
    return triple;
  });

  if (entities.length === 0 && triples.length === 0) {
    console.error('KG is empty, nothing to sync');
    process.exit(0);
  }

  // RFC-0062 F3 — gate entity properties.path fields. Entities synced from
  // the local KG sometimes carry filesystem paths in their `properties.path`
  // field (e.g., "file" entities indexed from prior MEMORY scans). When such
  // a path points outside DOS tenant trees, drop that entity from the bulk
  // payload. Triples are kept regardless — they reference entities by id and
  // the foreign-entity drop already prevents the cross-tenant row from
  // landing on Studio. We track block counts for the operator log.
  let blockedEntityCount = 0;
  const filteredEntities = entities.filter((e) => {
    const props = e.properties as Record<string, unknown> | undefined;
    if (!props || typeof props !== 'object') return true;
    const candidate = props.path;
    if (typeof candidate !== 'string' || candidate.length === 0) return true;
    if (!candidate.startsWith('/') && !candidate.startsWith('~')) return true;
    if (isDosTenantPath(candidate)) return true;
    blockedEntityCount++;
    return false;
  });
  if (blockedEntityCount > 0) {
    // Mirror crossTenantGate's drift-log + stderr signal at the bulk level.
    const gate = crossTenantGate({
      tool: 'kg',
      endpoint: '/api/v1/kg/sync',
      // We log a single blocking event per sync run; the path field on
      // the drift row records the count as a marker (not a real path).
      absPath: `<bulk:${blockedEntityCount} entities>`,
      source: 'SaveKgToStudio',
      payload: undefined,
    });
    // The gate result is informational here — even if it returns ok:true
    // (DOS_CROSS_TENANT=allow), we still drop the foreign entities. The
    // bulk POST itself proceeds with the filtered set. This keeps the KG
    // sync deterministic regardless of the env switch state.
    void gate;
  }

  // Ack-dedup (incident 2026-06-22): skip the bulk row when its idempotencyKey
  // is already in the ack ledger, so --import-all does not re-flood the DLQ
  // with an already-synced corpus every SessionEnd. Load the acked set ONCE.
  const acked = loadAckedKeys("kg:");
  let skipped = 0;

  try {
    const body = { entities: filteredEntities, triples };
    const key = `kg:${digestOfBody(body)}`;
    if (acked.has(key)) {
      skipped++;
      console.error(`Import skipped (already synced): ${entities.length} entities, ${triples.length} triples`);
      return;
    }
    const queueResult = await queueOrPost(body, '/api/v1/kg/sync', {
      tool: 'kg',
      idempotencyKey: key,
    });
    const res = queueResult.outcome === 'dropped'
      ? { ok: false, status: 0, text: async () => queueResult.reason }
      : { ok: true, status: 201, text: async () => '' };

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error(`Studio API error (${res.status}): ${text.slice(0, 200)}`);
    } else {
      console.error(`Import complete: ${entities.length} entities, ${triples.length} triples, ${skipped} skipped`);
    }
  } catch (err) {
    console.error(`Network error: ${(err as Error).message}`);
  }
}

const args = process.argv.slice(2);
if (args[0] === '--import-all') {
  await importAll();
} else {
  console.error('Usage: bun SaveKgToStudio.ts --import-all');
  process.exit(1);
}
