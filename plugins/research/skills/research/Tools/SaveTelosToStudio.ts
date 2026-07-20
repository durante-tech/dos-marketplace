#!/usr/bin/env bun
/**
 * SaveTelosToStudio — sync the TELOS corpus + KG goal facts to Studio.
 *
 * v0.0.20 campaign slice 0b (PRD 20260610-175516_v0020-slice-0b-publish-language).
 *
 * Source:  ~/.durante/user/TELOS/*.md (getTelosDir() resolution rule) +
 *          KG `goal:<uuid>` facts (targets / serves_goal) via the bridge.
 * Dest:    POST /api/v1/telos (NET-NEW Studio route — see GATE below).
 *
 * ── GATE (campaign §6: "0b posts into the void" hazard) ────────────────────
 * The Studio route does NOT exist yet (Domain-3 roadmap slice). Until it
 * ships, this tool SKIPS SILENTLY unless DOS_TELOS_SYNC=1 — otherwise every
 * SessionEnd would 404 → quarantine-route noise in the DLQ. Activation: set
 * DOS_TELOS_SYNC=1 once /api/v1/telos lands (roadmap encodes the dependency).
 *
 * USAGE
 *   DOS_TELOS_SYNC=1 bun SaveTelosToStudio.ts --import-all
 */
import { execFileSync } from 'child_process';
import { existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

import { queueOrPost, digestOfBody } from '../Lib/dlq';
import { loadAckedKeys } from '../Lib/dlq-dedup';
import { loadEnv } from '../Lib/env';
import { requireStudioConfigOrSkip } from '../Lib/studioClient';

loadEnv();

// ── Gate AFTER loadEnv: the flag's documented home is the env-file cascade
// (~/.claude/.env beside STUDIO_API_KEY) — checking process.env before
// loadEnv() would make file-based activation a silent permanent no-op.
if (process.env.DOS_TELOS_SYNC !== '1') {
  console.error('[SaveTelosToStudio] skipped — DOS_TELOS_SYNC != 1 (route /api/v1/telos not yet live; campaign 0b gate)');
  process.exit(0);
}

requireStudioConfigOrSkip('SaveTelosToStudio');

/** Lockstep with getTelosDir() in hooks/lib/paths.ts. */
function telosDir(): string {
  const env = process.env.DURANTE_TELOS_DIR;
  if (env) return env.replace(/^~(?=\/|$)/, homedir()).replace(/^\$HOME(?=\/|$)/, homedir());
  return join(homedir(), '.durante', 'user', 'TELOS');
}

function kgFacts(predicate: string): Array<Record<string, unknown>> {
  try {
    const bridge = join(process.env.DOS_DIR || join(homedir(), '.claude'), 'DOS', 'Tools', 'mempalace_bridge.py');
    const out = execFileSync('python3', [bridge, 'kg_query_predicate', JSON.stringify({ predicate })], {
      timeout: 15000,
      encoding: 'utf8',
    });
    const parsed = JSON.parse(out);
    return Array.isArray(parsed.facts) ? parsed.facts : [];
  } catch {
    return []; // degraded bridge → corpus-only payload; honest partial beats abort
  }
}

const dir = telosDir();
if (!existsSync(dir)) {
  console.error(`[SaveTelosToStudio] skipped — TELOS corpus absent at ${dir}`);
  process.exit(0);
}

// Sorted by name: readdirSync order is filesystem-dependent and canonicalJson
// preserves array order — an unsorted corpus mints a different digest for a
// byte-identical corpus (W2-S1 review #5), degrading dedup to
// per-enumeration-order. Same for KG fact order below.
const files = readdirSync(dir)
  .filter((f) => f.endsWith('.md'))
  .sort()
  .map((f) => {
    const p = join(dir, f);
    const content = readFileSync(p, 'utf8');
    const anchors = [...content.matchAll(/<!-- telos:([a-f0-9-]{36}) -->/g)].map((m) => m[1]);
    return { name: f, anchors, content };
  });

const factKey = (f: Record<string, unknown>) => `${f.subject}|${f.predicate}|${f.object}`;
const sortFacts = (facts: Array<Record<string, unknown>>) =>
  [...facts].sort((a, b) => (factKey(a) < factKey(b) ? -1 : factKey(a) > factKey(b) ? 1 : 0));

// The wire body IS the content basis — no mtimes, no exported_at (W2-S1
// review #1): R-DLQ-1 / RFC-0062 digest contract v1 says Studio verifies
// Idempotency-Key by hashing rawBody, so any field excluded from the digest
// must be excluded from the body. A projection-digest key is structurally
// unverifiable server-side; volatile timestamps in the body would make every
// snapshot unique and destroy dedup. Studio stamps its own received_at.
const payload = {
  corpus: files,
  kg: {
    targets: sortFacts(kgFacts('targets').filter((f) => String(f.subject).startsWith('goal:'))),
    serves_goal: sortFacts(kgFacts('serves_goal')),
  },
};

// ── Ack-dedup firewall (incident 2026-06-22) ───────────────────────────────
// This producer re-enqueues the whole TELOS snapshot every SessionEnd. Skip it
// when its idempotencyKey is already in the ack ledger so already-synced
// snapshots stop piling into .pending faster than the drain clears them.
// loadAckedKeys is called ONCE; `key` is the SINGLE source of truth reused for
// BOTH the dedup check and the idempotencyKey (THE FIREWALL — never two
// separate expressions).
const acked = loadAckedKeys('telos:');
let skipped = 0;

// Contract: idempotency-keys.json /api/v1/telos = telos:{digestOfBody} —
// the family-standard full-body digest, verifiable from rawBody.
const key = `telos:${digestOfBody(payload)}`;
if (acked.has(key)) {
  skipped++;
  console.error(`[SaveTelosToStudio] skipped 1 already-acked snapshot (key=${key})`);
  process.exit(0);
}

// Absolute /api/v1 path (dlq-transport resolves via new URL(endpoint, base))
// and a RAW OBJECT payload — canonicalJson(envelope.payload) handles encoding;
// pre-stringifying double-encodes on the wire (sibling contract:
// SaveSignalsToStudio.ts).
const result = await queueOrPost(payload, '/api/v1/telos', {
  tool: 'telos',
  idempotencyKey: key,
});
console.error(`[SaveTelosToStudio] ${JSON.stringify(result).slice(0, 160)} (skipped=${skipped})`);
