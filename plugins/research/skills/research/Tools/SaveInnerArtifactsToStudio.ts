#!/usr/bin/env bun
/**
 * SaveInnerArtifactsToStudio — RFC-0032 Phase A Workstream W1.
 *
 * Closes the MEMORY/* coverage gap. The 19 existing Save*ToStudio.ts tools
 * each own ONE shape (artifacts.jsonl, ratings.jsonl, security YYYY/MM
 * jsonls, REFLECTIONS/algorithm-reflections.jsonl, FAILURES/{slug}/, etc.).
 * Everything else under MEMORY/{ARTIFACTS,SECURITY,LEARNING}/ — the
 * orphaned files like LEARNING/inject-field-failures.jsonl,
 * LEARNING/REFLECTIONS/skill-routing.jsonl, SECURITY/promotion-overrides.jsonl,
 * SECURITY/chain-breaks/*.json, ARTIFACTS/coach-prd-alignment-*.md, etc. —
 * is silently dropped at SessionEnd.
 *
 * This tool walks the three subdirs, classifies each file via a
 * TABLE-DRIVEN dispatch map (KIND_DISPATCH below — Fowler+Beck Council
 * condition for ratifying the design), filters out anything an existing
 * tool already covers (`exclusion` regex per row), enforces a hard-deny
 * sensitive-file allowlist (Council unanimous), and POSTs each unmatched
 * file to /api/v1/inner-artifacts.
 *
 * USAGE
 * -----
 *   bun SaveInnerArtifactsToStudio.ts --import-all
 *
 * TIER POLICY (Beck D2 dissent — pick one tier this session)
 * ----------------------------------------------------------
 *   Postgres-inline only. Files >ARTIFACT_CONTENT_INLINE_MAX_BYTES
 *   (default 256KiB) ship as REFERENCE-tier (path + sha256 + size only,
 *   no body). Files at or under that threshold ship as CONTENT-tier
 *   (full UTF-8 body in POST `content`). The Studio route handler
 *   (W4) decides where the bytes land — this tool just declares which
 *   tier the row claims.
 *
 * SAFETY (Council unanimous)
 * --------------------------
 *   SENSITIVE_DENY hard-denies MEMPALACE/{identity.txt,config.json},
 *   any path matching /secret/i, .env files, .key, .pem. Denied paths
 *   never leave the producer process — they are not enqueued, not
 *   hashed, not previewed.
 *
 * CONSTRAINTS (Phase A scope)
 * ---------------------------
 *   - DO NOT create a new endpoint route here. The body POSTs to
 *     /api/v1/inner-artifacts which W4 owns. Until W4 lands, the queue
 *     envelope is the contract — DrainPending will hold and retry
 *     until the route exists.
 *   - DO NOT touch the Artifact Prisma schema (W2 owns that).
 *   - DO NOT modify ArtifactAutoLogger.hook.ts (W3 owns that).
 *   - prdSlug is intentionally undefined at this layer — ArtifactAutoLogger
 *     populates it upstream when known.
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, basename, relative, sep } from 'path';
import { homedir } from 'os';
import { createHash } from 'crypto';
import { loadEnv } from '../Lib/env';
import { requireStudioConfigOrSkip } from '../Lib/studioClient';
import { queueOrPost, digestOfBody, crossTenantGate } from '../Lib/dlq';
import { loadAckedKeys, pendingDepthAcrossExceeds, pendingDirsFor, PENDING_CAP } from '../Lib/dlq-dedup';

loadEnv();

// ─────────────────────────────────────────────────────────────────────
// getAllDirs — project-level cascade resolver
//
// Mirrors SaveArtifactsToStudio.ts:28-58 verbatim. Reads the canonical
// Project registry from DOS/USER/PROJECTS/PROJECTS.md, prefixing the
// global ~/.claude/MEMORY/{subdir}/ then each project's MEMORY/{subdir}/.
// Identical resolver across all sync tools so per-project memory is
// observed uniformly without a shared helper module (Phase-2 todo).
// ─────────────────────────────────────────────────────────────────────

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
        const cells = line.split('|').map((c) => c.trim()).filter(Boolean);
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

requireStudioConfigOrSkip('SaveInnerArtifactsToStudio');

// ─────────────────────────────────────────────────────────────────────
// KIND_DISPATCH — table-driven kind derivation (Council condition)
//
// Each row maps (subdir, relative-path-pattern) → artifactType. The
// `exclusion` field is the OVERRIDE: if the file's relative path
// matches `exclusion`, this row treats the file as owned by another
// sync tool and drops it.
//
// Ordering matters: rows are evaluated in array order, first match
// wins. Specifically — exclusion rows for the existing per-tool readers
// (artifacts.jsonl, REFLECTIONS/algorithm-reflections.jsonl,
// SIGNALS/ratings.jsonl, FAILURES/, ALGORITHM/SYSTEM monthly md,
// SECURITY {YYYY}/{MM}/) live at the head of each subdir's block so
// they fire before the catch-all extension match.
// ─────────────────────────────────────────────────────────────────────

interface DispatchRow {
  subdir: 'ARTIFACTS' | 'SECURITY' | 'LEARNING';
  pattern: RegExp;
  artifactType: string;
  exclusion?: RegExp;
}

const KIND_DISPATCH: DispatchRow[] = [
  // ─── ARTIFACTS ─────────────────────────────────────────────────────
  // SaveArtifactsToStudio owns artifacts.jsonl exclusively. Everything
  // else under ARTIFACTS/ — telemetry jsonls, config json, report md —
  // is the orphan we are trying to capture.
  { subdir: 'ARTIFACTS', pattern: /\.jsonl$/, artifactType: 'telemetry-jsonl', exclusion: /^artifacts\.jsonl$/ },
  { subdir: 'ARTIFACTS', pattern: /\.json$/,  artifactType: 'config-json' },
  { subdir: 'ARTIFACTS', pattern: /\.md$/,    artifactType: 'report-md' },

  // ─── SECURITY ──────────────────────────────────────────────────────
  // SaveSecurityEventsToStudio owns SECURITY/{YYYY}/{MM}/*.jsonl.
  // Files at the SECURITY root (promotion-overrides.jsonl), under
  // chain-breaks/, pending-receipts/, and the .last-sha checkpoint
  // markers are the orphans.
  { subdir: 'SECURITY', pattern: /\.jsonl$/,    artifactType: 'security-jsonl',           exclusion: /^\d{4}\// },
  { subdir: 'SECURITY', pattern: /\.json$/,     artifactType: 'security-snapshot-json' },
  { subdir: 'SECURITY', pattern: /\.last-sha$/, artifactType: 'security-checksum' },

  // ─── LEARNING ──────────────────────────────────────────────────────
  // Multiple existing tools cover slices:
  //   - SaveReflectionsToStudio  → REFLECTIONS/algorithm-reflections.jsonl
  //   - SaveSignalsToStudio      → SIGNALS/ratings.jsonl
  //   - SaveFailuresToStudio     → FAILURES/{YYYY-MM}/{slug}/
  //   - SaveLearningsToStudio    → {ALGORITHM,SYSTEM}/{YYYY-MM}/*.md
  //
  // Orphans: REFLECTIONS/{skill-routing,c1-conformance,mode-header-conformance}.jsonl,
  // SIGNALS/mempalace-drift.jsonl, ENFORCEMENT/{simplify,parallelism,completion}.jsonl,
  // SYS/sync-drift-*.jsonl, calibration/N-*.md, inject-field-failures.jsonl,
  // SYS/*.md helper-stepdown notes.
  { subdir: 'LEARNING', pattern: /\.jsonl$/, artifactType: 'learning-jsonl',
    exclusion: /^(REFLECTIONS\/algorithm-reflections|SIGNALS\/ratings|FAILURES\/)/ },
  { subdir: 'LEARNING', pattern: /\.md$/,    artifactType: 'learning-md',
    exclusion: /^(ALGORITHM|SYSTEM|FAILURES)\/\d{4}-\d{2}\// },
];

// ─────────────────────────────────────────────────────────────────────
// SENSITIVE_DENY — hard-block before any POST, hash, or preview
//
// Council unanimous: identity.txt + config.json under MEMORY/MEMPALACE/
// hold KG signing keys and bridge config. Everything matching /secret/i,
// .env, .key, .pem also denied — defence-in-depth against an operator
// dropping credentials into a MEMORY/ subdir by mistake.
// ─────────────────────────────────────────────────────────────────────

const SENSITIVE_DENY: RegExp[] = [
  /\/MEMORY\/MEMPALACE\/identity\.txt$/,
  /\/MEMORY\/MEMPALACE\/config\.json$/,
  /\/secret/i,
  /\/\.env(\.|$)/,
  /\.key$/,
  /\.pem$/,
];

function isSensitive(filePath: string): boolean {
  return SENSITIVE_DENY.some((re) => re.test(filePath));
}

// ─────────────────────────────────────────────────────────────────────
// Tier policy — Beck D2 dissent satisfied (one tier this session)
// ─────────────────────────────────────────────────────────────────────

const INLINE_MAX_BYTES = parseInt(process.env.ARTIFACT_CONTENT_INLINE_MAX_BYTES ?? '262144', 10);

type Tier = 'content' | 'reference';

function tierFor(byteSize: number): Tier {
  return byteSize <= INLINE_MAX_BYTES ? 'content' : 'reference';
}

// ─────────────────────────────────────────────────────────────────────
// Wing derivation — mirrors SaveArtifactsToStudio convention
//
// The "wing" labels which palace context produced the artifact. We
// derive it from the project root directory's basename when available
// (one wing per project), defaulting to "global" for ~/.claude/MEMORY/.
// SaveArtifactsToStudio reads this from the JSONL entry; we synthesize
// it from the walked directory because raw filesystem files have no
// prior wing tag.
// ─────────────────────────────────────────────────────────────────────

function wingFor(memoryDir: string, dosDir: string): string {
  // ~/.claude/MEMORY/ARTIFACTS → 'global'
  if (memoryDir.startsWith(join(dosDir, 'MEMORY'))) return 'global';
  // ~/Durante/Platform/studio/MEMORY/ARTIFACTS → 'studio'
  // (basename of the project root, two levels up from /MEMORY/{subdir})
  const projectRoot = join(memoryDir, '..', '..');
  const name = basename(projectRoot);
  return name || 'unknown';
}

// ─────────────────────────────────────────────────────────────────────
// Walker — single recursive enumerator with .pending/.quarantine skip
//
// .pending/ and .quarantine/ are DLQ infrastructure. Walking into them
// would pick up the queue envelopes themselves and re-enqueue them as
// inner-artifacts, which is a recursion bug not a feature.
// ─────────────────────────────────────────────────────────────────────

interface WalkedFile {
  absPath: string;
  relPath: string;        // relative to the subdir root (POSIX-normalized)
  byteSize: number;
  mtimeMs: number;
}

function walkSubdir(root: string): WalkedFile[] {
  const out: WalkedFile[] = [];
  function recurse(dir: string): void {
    let entries: ReturnType<typeof readdirSync>;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const abs = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === '.pending' || entry.name === '.quarantine') continue;
        recurse(abs);
        continue;
      }
      if (!entry.isFile()) continue;
      let st;
      try {
        st = statSync(abs);
      } catch {
        continue;
      }
      const rel = relative(root, abs).split(sep).join('/');
      out.push({ absPath: abs, relPath: rel, byteSize: st.size, mtimeMs: st.mtimeMs });
    }
  }
  recurse(root);
  return out;
}

// ─────────────────────────────────────────────────────────────────────
// Classify — table-driven, returns null when no row matches OR
// when the matching row's exclusion fires.
// ─────────────────────────────────────────────────────────────────────

function classify(subdir: 'ARTIFACTS' | 'SECURITY' | 'LEARNING', relPath: string): DispatchRow | null {
  for (const row of KIND_DISPATCH) {
    if (row.subdir !== subdir) continue;
    if (!row.pattern.test(relPath)) continue;
    if (row.exclusion && row.exclusion.test(relPath)) return null;
    return row;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────
// syncFile — build body, compute idempotency key, hand to queueOrPost
// ─────────────────────────────────────────────────────────────────────

interface SyncContext {
  subdir: 'ARTIFACTS' | 'SECURITY' | 'LEARNING';
  memoryDir: string;
  dosDir: string;
  sessionId: string;
  /** Acked idempotencyKeys (incident 2026-06-22) — skip re-enqueueing synced rows. */
  ackedKeys: Set<string>;
}

type SyncOutcome = 'synced' | 'skipped' | 'failed' | 'cross-tenant';

// ─── Incremental import — skip already-synced rows (incident 2026-06-22) ─────
// importAll walks ARTIFACTS+SECURITY+LEARNING every run and re-enqueued already-
// synced files as fresh queue-only envelopes into ARTIFACTS/.pending, which
// (with SaveArtifactsToStudio) outran the 500/run drain to 4.4M files. Fix: skip
// any row whose idempotencyKey is already in the ack ledger (a 200 from Studio).
// Safe by construction — a key in the ledger means that exact file synced;
// un-acked rows are absent and still enqueue. Mirrors SaveArtifactsToStudio.ts.
// loadAckedKeys + pendingDepthAcrossExceeds + PENDING_CAP now live in the shared
// Lib/dlq-dedup module (DRY; one impl across all queue-mode producers).

async function syncFile(
  walked: WalkedFile,
  row: DispatchRow,
  ctx: SyncContext,
): Promise<SyncOutcome> {
  let bodyText = '';
  let contentSha256 = '';
  const tier = tierFor(walked.byteSize);

  // RFC-0062 F3 producer-side cross-tenant guard. walked.absPath is the
  // tenant-anchored field (always an absolute filesystem path from the
  // directory walk). Gate FIRST — before the disk read + sha256 below — so a
  // foreign-tenant file costs zero I/O. Sibling of the SaveArtifactsToStudio
  // leak fixed 2026-07-01; returns the distinct 'cross-tenant' outcome so the
  // caller does not conflate it with dedup 'skipped'.
  const gate = crossTenantGate({
    tool: 'inner-artifacts',
    endpoint: '/api/v1/inner-artifacts',
    absPath: walked.absPath,
    source: 'SaveInnerArtifactsToStudio',
    payload: { filePath: walked.absPath, artifactType: row.artifactType },
  });
  if (!gate.ok) return 'cross-tenant'; // foreign path — gate logged/parked, no read

  // Hash + body read happen here, AFTER isSensitive has already cleared
  // the path. Sensitive files never reach this function (caller guards).
  try {
    const buf = readFileSync(walked.absPath);
    contentSha256 = createHash('sha256').update(buf).digest('hex');
    bodyText = buf.toString('utf-8');
  } catch (err) {
    console.error(`Read failed for ${walked.absPath}: ${(err as Error).message}`);
    return 'failed';
  }

  const contentPreview = bodyText.slice(0, 500);

  const body: Record<string, unknown> = {
    pack: 'inner-substrate',
    workflow: 'sync',
    artifactType: row.artifactType,
    title: basename(walked.absPath),
    filePath: walked.absPath,
    contentPreview,
    contentSha256,
    byteSize: walked.byteSize,
    tier,
    wing: wingFor(ctx.memoryDir, ctx.dosDir),
    sessionId: ctx.sessionId,
    producedAt: new Date(walked.mtimeMs).toISOString(),
  };
  // CONTENT-tier rows ship the full body; REFERENCE-tier rows omit it
  // entirely so the POST stays bounded for large blobs (the Studio
  // route treats absent `content` as the reference signal — W4 wires
  // the storage decision).
  if (tier === 'content') body.content = bodyText;

  // Idempotency key: schema is "inner-artifacts:{filePath}:{digestOfBody}"
  // (registered in idempotency-keys.json). filePath placeholder needs a
  // sha256(filePath).slice(0,16) hash so the resulting key satisfies the
  // gateway's regex `^[A-Za-z0-9][A-Za-z0-9:._-]{0,254}$`. Mirrors
  // SaveArtifactsToStudio.ts:168 verbatim — drift between this hash and
  // Studio's keyFrom(body) silently produces a 400.
  const filePathDigest = createHash('sha256').update(walked.absPath).digest('hex').slice(0, 16);
  const bodyDigest = digestOfBody(body);
  const idempotencyKey = `inner-artifacts:${filePathDigest}:${bodyDigest}`;

  if (ctx.ackedKeys.has(idempotencyKey)) return 'skipped'; // already synced — dedup

  const result = await queueOrPost(body, '/api/v1/inner-artifacts', {
    tool: 'inner-artifacts',
    idempotencyKey,
  });
  if (result.outcome === 'dropped') {
    console.error(`Sync dropped for ${walked.absPath}: ${result.reason}`);
    return 'failed';
  }
  return 'synced';
}

// ─────────────────────────────────────────────────────────────────────
// importAll — orchestrator
// ─────────────────────────────────────────────────────────────────────

async function importAll(): Promise<void> {
  const home = homedir();
  const dosDir = process.env.DOS_DIR || join(home, '.claude');
  const sessionId = process.env.DOS_SESSION_ID ?? process.env.CLAUDE_SESSION_ID ?? '';

  // Backpressure: never pile onto an already-pathological queue (incident
  // 2026-06-22). G7 review (2026-07-06): this producer enqueues into the SAME
  // ARTIFACTS/.pending queue as SaveArtifactsToStudio via queueOrPost, which
  // resolves project-FIRST — so the gate must watch EVERY enqueue-candidate
  // tree, not just the install tree. Trips when any single tree exceeds the
  // cap OR the sum across trees does.
  const backpressure = pendingDepthAcrossExceeds(pendingDirsFor('ARTIFACTS'), PENDING_CAP);
  if (backpressure) {
    console.error(
      `[SaveInnerArtifacts] ${backpressure} — skipping import (backpressure). Drain the queue first.`,
    );
    process.exit(0);
  }

  // Dedup: skip rows already synced (present in the ack ledger as a 200).
  const ackedKeys = loadAckedKeys('inner-artifacts:');

  const subdirs: Array<'ARTIFACTS' | 'SECURITY' | 'LEARNING'> = ['ARTIFACTS', 'SECURITY', 'LEARNING'];

  let walked = 0;
  let denied = 0;
  let unmatched = 0;
  let synced = 0;
  let skipped = 0;
  let crossTenant = 0;
  let failed = 0;

  for (const subdir of subdirs) {
    const dirs = getAllDirs(subdir);
    for (const memoryDir of dirs) {
      const files = walkSubdir(memoryDir);
      walked += files.length;
      for (const f of files) {
        if (isSensitive(f.absPath)) { denied++; continue; }
        const row = classify(subdir, f.relPath);
        if (!row) { unmatched++; continue; }
        const ctx: SyncContext = { subdir, memoryDir, dosDir, sessionId, ackedKeys };
        const outcome = await syncFile(f, row, ctx);
        if (outcome === 'synced') synced++;
        else if (outcome === 'skipped') skipped++;
        else if (outcome === 'cross-tenant') crossTenant++;
        else failed++;
      }
    }
  }

  console.error(
    `Import complete: walked=${walked}, denied=${denied} (sensitive), unmatched=${unmatched} (not classified or owned by other tool), synced=${synced}, skipped=${skipped} (already-synced), crossTenant=${crossTenant} (cross-tenant skipped), failed=${failed}`,
  );
}

const args = process.argv.slice(2);
if (args[0] === '--import-all') {
  await importAll();
} else {
  console.error('Usage: bun SaveInnerArtifactsToStudio.ts --import-all');
  process.exit(1);
}
