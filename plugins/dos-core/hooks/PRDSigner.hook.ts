#!/usr/bin/env bun
/**
 * PRDSigner.hook.ts — Signs PRDs on phase→complete transition.
 *
 * TRIGGER: PostToolUse(Write, Edit) on MEMORY/WORK/{slug}/PRD.md
 *
 * Behavior:
 *   1. Only acts on PRD.md files inside MEMORY/WORK/
 *   2. Only acts when frontmatter phase is "complete" and no
 *      receipt_signature field is already present (idempotent)
 *   3. Silently no-ops if ~/.claude/.dos-identity/ed25519.key is missing
 *      (user hasn't onboarded) — never interrupts work
 *   4. Computes the canonical prd_sha256, builds ReceiptPayloadV1, signs
 *      with ed25519, and appends receipt_* fields to frontmatter
 *   5. Persists a signed-receipt JSON to
 *      ~/.claude/MEMORY/SECURITY/pending-receipts/{timestamp}-{slug}.json
 *      for later drain to Studio (Phase 5b ships the drain worker)
 *   6. Updates the local chain head
 *      ~/.claude/MEMORY/SECURITY/pending-receipts/.last-sha
 *
 * Security:
 *   - Hard-fails if private key perms are wider than 0600 (identity.ts enforces)
 *   - Signs only what the normalizer in prd-hash.ts produces — idempotent
 *     across repeated saves
 *
 * Failure mode: any error is logged to stderr and the hook exits 0 so
 * the user's flow is never blocked. Integrity is enforceable server-side
 * when Phase 5b ships.
 */

import { appendFileSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, basename, dirname } from 'node:path';

import { readIdentity } from '../DOS/Tools/identity';
import { hashPrd, RECEIPT_FRONTMATTER_KEYS } from '../DOS/Tools/prd-hash';
import { buildSignedReceipt } from '../DOS/Tools/prd-receipt-builder';
import { PRD_PHASE_COMPLETE } from './lib/tab-constants';

const PENDING_DIR = join(homedir(), '.claude', 'MEMORY', 'SECURITY', 'pending-receipts');
const LAST_SHA_PATH = join(PENDING_DIR, '.last-sha');
// Durable bootstrap marker — lives OUTSIDE .dos-identity (survives key-dir loss)
// and outside pending-receipts churn (survives .last-sha drains). Written by
// identity-bootstrap.ts and refreshed on every successful sign.
const BOOTSTRAP_MARKER_PATH = join(
  homedir(),
  '.claude',
  'MEMORY',
  'SECURITY',
  'identity-bootstrap-marker.json',
);
const IDENTITY_LOST_LOG = join(
  homedir(),
  '.claude',
  'MEMORY',
  'SECURITY',
  'identity-lost.log',
);

type HookInput = {
  tool_input?: { file_path?: string };
};

function readHookInput(): HookInput | null {
  try {
    return JSON.parse(readFileSync(0, 'utf8')) as HookInput;
  } catch {
    return null;
  }
}

function parseFrontmatter(content: string): Record<string, string> | null {
  const m = content.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return null;
  const fm: Record<string, string> = {};
  for (const line of m[1]!.split('\n')) {
    const idx = line.indexOf(':');
    if (idx > 0) {
      const key = line.slice(0, idx).trim();
      const val = line.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
      fm[key] = val;
    }
  }
  return fm;
}

function appendFrontmatterFields(
  content: string,
  fields: Record<string, string>,
): string {
  const m = content.match(/^(---\n[\s\S]*?)\n---/);
  if (!m) return content;
  const head = m[1]!;
  const rest = content.slice(m[0].length);
  const appended = Object.entries(fields)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n');
  return `${head}\n${appended}\n---${rest}`;
}

// Strip the 5 receipt_* lines from the frontmatter without touching whitespace
// elsewhere. Used when drift is detected and we need to hand the "pre-sign"
// body back to buildSignedReceipt so the new receipt covers current content
// (not content-plus-stale-receipt-fields). normalizePrd in prd-hash.ts also
// strips, but additionally normalizes LF + trims trailing whitespace, which
// would change the operator's file on disk. This helper keeps the file shape
// stable; only the 5 receipt lines go.
function stripReceiptFrontmatter(content: string): string {
  const lines = content.split('\n');
  let inFrontmatter = false;
  let frontmatterEnded = false;
  const out: string[] = [];
  for (const line of lines) {
    if (!frontmatterEnded) {
      if (line.trim() === '---') {
        if (!inFrontmatter) {
          inFrontmatter = true;
          out.push(line);
          continue;
        }
        frontmatterEnded = true;
        inFrontmatter = false;
        out.push(line);
        continue;
      }
      if (inFrontmatter) {
        const colonIdx = line.indexOf(':');
        if (colonIdx > 0) {
          const key = line.slice(0, colonIdx).trim();
          if (RECEIPT_FRONTMATTER_KEYS.includes(key)) continue;
        }
      }
    }
    out.push(line);
  }
  return out.join('\n');
}

function readLastSha(): string | null {
  if (!existsSync(LAST_SHA_PATH)) return null;
  const raw = readFileSync(LAST_SHA_PATH, 'utf8').trim();
  return raw.length > 0 ? raw : null;
}

function writeLastSha(sha: string): void {
  writeFileSync(LAST_SHA_PATH, sha + '\n', 'utf8');
}

function ensurePendingDir(): void {
  if (!existsSync(PENDING_DIR)) mkdirSync(PENDING_DIR, { recursive: true });
}

/**
 * Distinguishes "never bootstrapped" (first-time user, silent no-op is correct)
 * from "identity lost while chain existed" (upgrade bug, disk failure, user
 * accidentally rm'd the dir). When the chain head .last-sha exists but the
 * identity does not, the operator has a broken chain they almost certainly
 * don't know about — log it so SessionStart hooks / `durante status` can surface
 * it. Still returns cleanly (exit 0) to avoid blocking Claude Code writes.
 */
function logIdentityLossIfChainExists(prdPath: string, slug: string | undefined): void {
  // Never bootstrapped (no chain head AND no durable marker) — silent no-op is
  // correct. The marker closes the gap where .last-sha drained after a Studio
  // sync and a subsequently-lost key produced zero warnings (Work-OS follow-up).
  if (!existsSync(LAST_SHA_PATH) && !existsSync(BOOTSTRAP_MARKER_PATH)) return;

  const entry = {
    timestamp: new Date().toISOString(),
    prd_path: prdPath,
    slug: slug ?? null,
    last_sha: readLastSha(),
    bootstrap_marker_present: existsSync(BOOTSTRAP_MARKER_PATH),
    reason: 'identity_missing_with_chain_present',
    hint: 'Private key at ~/.claude/.dos-identity/ed25519.key is missing but chain head exists. Run `bun ~/.claude/DOS/Tools/identity-bootstrap.ts` or restore the key from backup.',
  };
  try {
    appendFileSync(IDENTITY_LOST_LOG, JSON.stringify(entry) + '\n', 'utf8');
  } catch {
    // don't block on log write failure
  }
  console.error(
    `[PRDSigner] identity missing but chain present — PRD ${slug ?? prdPath} left unsigned. ` +
      `Details in ${IDENTITY_LOST_LOG}`,
  );
}

async function main(): Promise<void> {
  const input = readHookInput();
  if (!input) return;

  const filePath = input.tool_input?.file_path ?? '';
  if (!filePath.includes('MEMORY/WORK/') || !filePath.endsWith('PRD.md')) return;
  if (!existsSync(filePath)) return;

  const content = readFileSync(filePath, 'utf8');
  const fm = parseFrontmatter(content);
  if (!fm) return;

  // Terminal PRDs must be signed to start the integrity chain. The canonical
  // value is 'complete', but 6 live PRDs reach terminal state via 'done' — those
  // were never signed and their receipt chain never started (H-054). Both are
  // accepted here (a NON-destructive frontmatter+receipt write, unlike the
  // destructive ArchivePromote mover which deliberately stays complete-only).
  if (fm.phase !== PRD_PHASE_COMPLETE && fm.phase !== 'done') return;

  // Drift detection for already-signed PRDs. Pre-1.0.5 signed PRDs have no
  // receipt_prd_sha256 (the content-hash oracle) so we preserve the old
  // short-circuit for them — they're fossilized artifacts. Post-1.0.5 signed
  // PRDs carry the oracle; re-editing them flows back through signing with a
  // supersede link to the prior receipt.
  let contentToSign = content;
  let previousReceiptSha: string | null;
  if (fm.receipt_signature) {
    if (!fm.receipt_prd_sha256) return; // legacy: pre-1.0.5 sign, no oracle
    const currentPrdSha = hashPrd(content);
    if (currentPrdSha === fm.receipt_prd_sha256) return; // no drift, idempotent
    // Drift detected — strip the 5 receipt_* lines so buildSignedReceipt
    // receives the current body, not body-plus-stale-receipts. The supersede
    // link is to THIS PRD's prior receipt (per RFC-0007 §5 supersede lineage),
    // not the global chain head.
    contentToSign = stripReceiptFrontmatter(content);
    previousReceiptSha = fm.receipt_sha256 ?? null;
  } else {
    previousReceiptSha = readLastSha();
  }

  const identity = readIdentity();
  if (!identity) {
    // Silent no-op is only correct for pre-bootstrap users. If a chain head
    // exists, this is post-bootstrap identity loss and the operator needs to
    // know before they accumulate hours of unsigned PRDs.
    logIdentityLossIfChainExists(filePath, fm.slug);
    return;
  }

  const slug = fm.slug || basename(dirname(filePath));
  if (!slug) return;

  // RFC-0007 §10.3 Phase 3 Slice C — v1.1 pipeline (replaces inline v1 signing).
  // buildSignedReceipt runs the full §5.7 order: classifier → attestation builder →
  // payload shell → preimage strip → sha256(DOMAIN_SEP || canonical) → executor sig →
  // per-attestation sigs.
  const { payload, signature, receiptSha256 } = buildSignedReceipt(
    contentToSign,
    fm,
    slug,
    identity,
    { previousReceiptSha256: previousReceiptSha },
  );

  // v1.0.5: receipt_prd_sha256 is the content-hash oracle used by future
  // re-edits to detect drift. hashPrd is deterministic (prd-hash.ts strips
  // the 5 receipt_* lines before hashing) so the value stored here equals
  // the value a future re-edit will compute on byte-identical content.
  const prdSha256 = hashPrd(contentToSign);

  // 1. Append frontmatter fields on the PRD
  const updated = appendFrontmatterFields(contentToSign, {
    receipt_signature: signature,
    receipt_key_id: identity.keyId,
    receipt_previous_sha: previousReceiptSha ?? 'null',
    receipt_sha256: receiptSha256,
    receipt_prd_sha256: prdSha256,
  });
  writeFileSync(filePath, updated, 'utf8');

  // 2. Queue receipt for Studio ingestion
  ensurePendingDir();
  const ts = payload.timestamp.replace(/[:.]/g, '-');
  const outPath = join(PENDING_DIR, `${ts}_${slug}.json`);
  writeFileSync(
    outPath,
    JSON.stringify({ payload, signature, receiptSha256 }, null, 2) + '\n',
    'utf8',
  );

  // 3. Advance chain head
  writeLastSha(receiptSha256);

  // 4. Refresh the durable bootstrap marker so identity loss stays detectable
  //    even after pending-receipts (and .last-sha) drain to Studio.
  try {
    writeFileSync(
      BOOTSTRAP_MARKER_PATH,
      JSON.stringify({ key_id: identity.keyId, last_signed_at: payload.timestamp, written_by: 'PRDSigner' }) + '\n',
      'utf8',
    );
  } catch {
    // never block the flow on marker write failure
  }
}

main().catch((err) => {
  console.error('[PRDSigner] error:', err?.message ?? err);
  // Never block the user's flow.
  process.exit(0);
});
