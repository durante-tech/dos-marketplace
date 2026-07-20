#!/usr/bin/env bun
/**
 * SaveArtifactsToStudio — Sync skill-produced artifacts to Studio Artifacts API.
 *
 * USAGE
 * -----
 *   bun SaveArtifactsToStudio.ts --import-all        # primary sync pass
 *
 * NOTE — Phase-3 migration (Cluster M4) replaced this tool's bespoke
 * `.pending/` DLQ + `--retry-pending` retry path with the canonical
 * `queueOrPost` helper. Failed POSTs are now queued as DrainPending
 * envelopes under the shared MEMORY/QUEUE/ tree, and DrainPending.hook.ts
 * (registered on SessionStart + SessionEnd) handles drainage. The flag
 * was removed because it had no callers outside this file's own
 * docstring (verified via grep over hooks/, skills/, Packs/, Tools/).
 *
 * NOTE — G7 key-churn incident (2026-07-06). The RFC-0007 Slice-D fallback
 * (blanket-apply the latest-mtime MEMORY/WORK PRD to rows lacking their own
 * prdSlug/receiptSha) was REMOVED: it made the POST body — and therefore the
 * idempotency key — depend on ambient filesystem state, re-keying the whole
 * fallback cohort every time the fleet touched a new PRD dir (~7.4 keys/row
 * in the July 2026 ack ledger). Body/key builders now live in
 * ../Lib/artifact-body.ts as PURE functions of the JSONL row; see that
 * module's header for the full incident write-up. Backpressure now watches
 * every tree queueOrPost may enqueue into (pendingDirsFor), not only the
 * install tree.
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { loadEnv } from '../Lib/env';
import { requireStudioConfigOrSkip } from '../Lib/studioClient';
import { queueOrPost, crossTenantGate } from '../Lib/dlq';
import { loadAckedKeys, pendingDepthAcrossExceeds, pendingDirsFor, PENDING_CAP } from '../Lib/dlq-dedup';
import { buildArtifactBody, artifactsKeyFor, type ArtifactEntry } from '../Lib/artifact-body';

loadEnv();

function getAllDirs(subdir: string): string[] {
  const home = homedir();
  const dosDir = process.env.DOS_DIR || join(home, '.claude');
  const dirs: string[] = [];
  const seen = new Set<string>();

  const globalDir = join(dosDir, 'MEMORY', subdir);
  if (existsSync(globalDir)) { dirs.push(globalDir); seen.add(globalDir); }

  const projectsPath = join(dosDir, 'DOS', 'USER', 'PROJECTS', 'PROJECTS.md');
  if (existsSync(projectsPath)) {
    try {
      const content = readFileSync(projectsPath, 'utf-8');
      for (const line of content.split('\n')) {
        if (!line.startsWith('|') || line.includes('---') || line.includes('Path')) continue;
        const cells = line.split('|').map(c => c.trim()).filter(Boolean);
        if (cells.length < 2) continue;
        const rawPath = cells[1];
        if (!rawPath || rawPath === '-') continue;
        // Expand $HOME / ${HOME} / ~ to match the canonical expandPath
        // (hooks/lib/paths.ts) — a PROJECTS.md row using $HOME was silently
        // skipped before because only the ~ prefix was handled. [hooks-003]
        const fullPath = rawPath
          .replace(/^\$HOME(?=\/|$)/, home)
          .replace(/^\$\{HOME\}(?=\/|$)/, home)
          .replace(/^~(?=\/|$)/, home);
        const projectDir = join(fullPath, 'MEMORY', subdir);
        if (!seen.has(projectDir) && existsSync(projectDir)) {
          dirs.push(projectDir);
          seen.add(projectDir);
        }
      }
    } catch { /* non-critical */ }
  }

  return dirs;
}

// requireStudioConfigOrSkip preserves the early-skip when STUDIO_API_URL/KEY
// are absent. queueOrPost itself doesn't depend on these, but the skip keeps
// the tool's exit semantics identical to its peers (Sessions, Work, etc.).
requireStudioConfigOrSkip('SaveArtifactsToStudio');

// ArtifactEntry, buildArtifactBody, artifactsKeyFor moved to
// ../Lib/artifact-body.ts (G7, 2026-07-06) — PURE functions of the JSONL
// row, so the idempotency key can never churn with ambient state. The
// Slice-D findActivePrdForProject blanket fallback was removed there; see
// artifact-body.ts's module header for the incident write-up.

async function postArtifact(
  body: Record<string, unknown>,
  key: string,
  title: string,
): Promise<boolean> {
  const result = await queueOrPost(body, '/api/v1/artifacts', {
    tool: 'artifacts',
    idempotencyKey: key,
  });
  if (result.outcome === 'dropped') {
    console.error(`Sync dropped for ${title}: ${result.reason}`);
    return false;
  }
  return true;
}

// Incremental import + backpressure (incident 2026-06-22) live in the shared
// Lib/dlq-dedup module so all queue-mode producers share ONE implementation.
// loadAckedKeys('artifacts:') skips rows whose idempotencyKey already acked;
// pendingDepthAcrossExceeds caps a pathological queue (any tree or the sum
// across trees). See dlq-dedup.ts for the firewall contract (prefix must
// match the enqueue-key literal).

async function importAll(): Promise<void> {
  const artifactDirs = getAllDirs('ARTIFACTS');
  if (artifactDirs.length === 0) {
    process.exit(0);
  }

  // Backpressure: never pile onto an already-pathological queue (incident
  // 2026-06-22). G7 (2026-07-06): check EVERY tree queueOrPost may enqueue
  // into — the old install-only check (pendingDirFor) was blind to the
  // project-tree flood at ~/Durante/MEMORY/ARTIFACTS/.pending. Trips when
  // any single tree exceeds the cap OR the sum across trees does.
  const backpressure = pendingDepthAcrossExceeds(pendingDirsFor('ARTIFACTS'), PENDING_CAP);
  if (backpressure) {
    console.error(
      `[SaveArtifacts] ${backpressure} — skipping import (backpressure). Drain the queue first.`,
    );
    process.exit(0);
  }

  // Dedup: skip rows already synced (present in the ack ledger as a 200).
  const ackedKeys = loadAckedKeys('artifacts:');

  let synced = 0;
  let skipped = 0;
  let crossTenant = 0;
  let failed = 0;
  let total = 0;

  for (const artifactDir of artifactDirs) {
    const filepath = join(artifactDir, 'artifacts.jsonl');
    if (!existsSync(filepath)) continue;

    const lines = readFileSync(filepath, 'utf-8').split('\n').filter((l) => l.trim());
    total += lines.length;

    for (const line of lines) {
      try {
        const entry = JSON.parse(line) as ArtifactEntry;
        if (!entry.pack || !entry.title) { failed++; continue; }
        const body = buildArtifactBody(entry);
        const key = artifactsKeyFor(entry, body);
        if (ackedKeys.has(key)) { skipped++; continue; } // already synced — dedup
        // RFC-0062 F3 producer-side cross-tenant guard. This producer was the
        // un-gated leak — 297 foreign-tenant (altyaa) artifact envelopes reached
        // ARTIFACTS/.pending and were parked by dlq-reconcile on 2026-07-01.
        // entry.path becomes body.filePath, but artifact paths are NOT always
        // filesystem paths — they can be pseudo-URLs (mempalace://…, ephemeral://…)
        // or relative. Only an ABSOLUTE filesystem path can be a cross-tenant
        // leak; pass null for the rest so the gate lets them through (preserving
        // the "all artifacts sync" invariant). The altyaa leak was absolute
        // (/Users/…/Experiments/altyaa/…), so it is still blocked.
        const fsPath = entry.path && entry.path.startsWith('/') ? entry.path : null;
        const gate = crossTenantGate({
          tool: 'artifacts',
          endpoint: '/api/v1/artifacts',
          absPath: fsPath,
          source: 'SaveArtifactsToStudio',
          payload: body,
        });
        if (!gate.ok) { crossTenant++; continue; } // foreign FS path — gate logged/parked
        const ok = await postArtifact(body, key, entry.title);
        if (ok) synced++; else failed++;
      } catch { failed++; }
    }
  }

  console.error(
    `Import complete: ${synced} synced, ${skipped} already-synced (skipped), ${crossTenant} cross-tenant (skipped), ${failed} failed (of ${total} from ${artifactDirs.length} dirs)`,
  );
}

const args = process.argv.slice(2);
if (args[0] === '--import-all') {
  await importAll();
} else {
  console.error('Usage: bun SaveArtifactsToStudio.ts --import-all');
  process.exit(1);
}
