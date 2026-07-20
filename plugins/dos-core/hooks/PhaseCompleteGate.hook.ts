#!/usr/bin/env bun
/**
 * PhaseCompleteGate.hook.ts — PreToolUse mechanical enforcement of the
 * Algorithm v0.0.7 LEARN-phase ceremony (RFC-0060).
 *
 * BLOCKS Edit / Write tool calls that set `phase: complete` in PRD
 * frontmatter UNLESS the phase-complete checks all pass:
 *   1. KG `worked_on` for `session-{id}` (any subject)
 *   2. KG `learned` triple where subject = {prd-slug}
 *   3. Reflection JSONL last 50 lines contains entry with prd_id == {prd-slug}
 *   4. Decision drawer in `decision-archives` room with title containing slug
 *      (only required when PRD has ≥1 decision in `## Decisions` section)
 *   5. working-tree-clean-gate.ts exits 0 (or DOS_ALLOW_DIRTY_LEARN=1 set,
 *      OR session-override file declares wt_clean: "skip")
 *   6. vNext conformance — format_version + parent_rfc present (RFC-0080)
 *   7. Subagent Return Reconciliation — Amendment G §6.5
 *   8. ISC Coverage Saturation — §6.1.e8
 *   9. /code-review HIGH-completeness Recount — Amendment I-2 (Council β, 2026-05-26)
 * (1-5 are the original LEARN evidences; 6-9 were added later. The live count
 * is `checks.length` — messages below derive from it, never a hardcoded number.)
 *
 * Returns `{ hookSpecificOutput: { hookEventName: "PreToolUse",
 * permissionDecision: "deny", permissionDecisionReason } }` so the agent
 * receives structured remediation; the agent fires the missing traces and
 * retries the Edit, which then passes.
 *
 * Override paths (in precedence order):
 *
 * (a) Session-scoped override file (recommended for in-session bypass):
 *     ~/.claude/MEMORY/STATE/learn-overrides/{session_id}.json
 *     Schema: {wt_clean?: "skip", incomplete_learn?: "skip",
 *              reconcile?: "skip", coverage?: "skip",
 *              i2_recount?: "skip", phase_gate_mode?: "warn",
 *              reason: string, expires_at?: ISO-8601-UTC}
 *     Honored regardless of env var setup — works from any Bash call in
 *     the live session. Solves the env-propagation gotcha (shell `export`
 *     does NOT reach hook subprocesses; only `.env`/`.gateway.env` files
 *     loaded via loadProjectEnv() do).
 *
 * (b) Env vars (must be set in `.env` or `.gateway.env` at project root,
 *     NOT shell-exported in a Bash subshell):
 *     DOS_ALLOW_INCOMPLETE_LEARN=1   — one-shot bypass (audited)
 *     DOS_ALLOW_DIRTY_LEARN=1        — wt-clean check bypass only
 *     DOS_PHASE_GATE_MODE=warn       — durable backfill mode
 *
 * Coupling:
 *   - Algorithm v0.0.7-enhanced LEARN phase (advisory bullets become mechanical here)
 *   - sub-docs/memory-integration.md (predicate catalog)
 *   - working-tree-clean-gate.ts (composed check 5)
 *   - Sentinel R35 (hook-active conformance)
 *   - feedback_load_project_env.md (env-cascade canonical pattern)
 *
 * Design precedent: IntelFirstGuard.hook.ts. Three text-rule iterations of
 * LEARN obligations failed to bind. Tool-layer enforcement is the
 * intervention that finally binds. Session-override file added 2026-05-06
 * after dotfiles-conversation.txt discovery — Bash-exported env doesn't
 * propagate to Edit-tool's hook subprocess (load-bearing for in-session
 * AI overrides where AI cannot restart Claude to put env in `.env`).
 */

import { existsSync, readFileSync, openSync, mkdirSync } from 'node:fs';
import { join, basename, dirname } from 'node:path';
import { homedir } from 'node:os';
import { spawnSync, spawn } from 'node:child_process';
import { readHookInput } from './lib/hook-io';
import { loadProjectEnv, getMemorySubdir } from './lib/paths';
import { reconcileCheck } from './lib/subagent-reconcile';
import { coverageCheck, type CoverageReport } from './lib/coverage-check';
import { classifyFailures } from './lib/phase-gate-classify';

loadProjectEnv();

const input = await readHookInput();

if (!input) {
  console.log(JSON.stringify({ continue: true }));
  process.exit(0);
}

const toolName = (input as { tool_name?: string }).tool_name || '';
const toolInput = (input as { tool_input?: Record<string, unknown> }).tool_input || {};

const GUARDED_TOOLS = new Set(['Edit', 'Write', 'MultiEdit']);
if (!GUARDED_TOOLS.has(toolName)) {
  console.log(JSON.stringify({ continue: true }));
  process.exit(0);
}

const filePath = String(toolInput.file_path || toolInput.path || '');

if (!filePath.endsWith('/PRD.md') && basename(filePath) !== 'PRD.md') {
  console.log(JSON.stringify({ continue: true }));
  process.exit(0);
}

function getCandidateText(): string {
  if (toolName === 'Edit') {
    return String((toolInput as Record<string, unknown>).new_string || '');
  }
  if (toolName === 'Write') {
    return String((toolInput as Record<string, unknown>).content || '');
  }
  if (toolName === 'MultiEdit') {
    const edits = (toolInput as { edits?: Array<{ new_string?: string }> }).edits || [];
    return edits.map((e) => String(e.new_string || '')).join('\n');
  }
  return '';
}

const candidateText = getCandidateText();

const setsPhaseComplete = /^phase:\s*complete\s*$/m.test(candidateText);
if (!setsPhaseComplete) {
  console.log(JSON.stringify({ continue: true }));
  process.exit(0);
}

const slug = (() => {
  const dir = dirname(filePath);
  const base = basename(dir);
  return base;
})();

const sessionId = (input as { session_id?: string }).session_id || process.env.CLAUDE_SESSION_ID || 'unknown';

interface SessionOverride {
  wt_clean?: 'skip';
  incomplete_learn?: 'skip';
  reconcile?: 'skip';
  coverage?: 'skip';
  /**
   * Amendment I-2 (Council D2, 2026-05-26): skip the
   * `checkCodeReviewRecount()` 9th check when `/code-review` returned
   * HIGH-severity completeness findings but the operator is intentionally
   * bypassing the recount-artifact requirement (e.g. recount happened
   * out-of-band and was logged manually). The `reason` field is required;
   * absent/blank reason is treated as no override.
   */
  i2_recount?: 'skip';
  phase_gate_mode?: 'warn';
  reason?: string;
  expires_at?: string;
}

function loadSessionOverride(): SessionOverride | null {
  const overridePath = join(HOME, '.claude', 'MEMORY', 'STATE', 'learn-overrides', `${sessionId}.json`);
  if (!existsSync(overridePath)) return null;
  try {
    const parsed = JSON.parse(readFileSync(overridePath, 'utf-8')) as SessionOverride;
    if (parsed.expires_at) {
      const exp = Date.parse(parsed.expires_at);
      if (!Number.isNaN(exp) && Date.now() > exp) {
        console.error(`[PhaseCompleteGate] session-override expired at ${parsed.expires_at} — ignoring`);
        return null;
      }
    }
    return parsed;
  } catch (err) {
    console.error(`[PhaseCompleteGate] malformed session-override at ${overridePath}: ${(err as Error).message} — ignoring`);
    return null;
  }
}

const HOME = homedir();
const sessionOverride = loadSessionOverride();

if (process.env.DOS_ALLOW_INCOMPLETE_LEARN === '1' || sessionOverride?.incomplete_learn === 'skip') {
  const source = process.env.DOS_ALLOW_INCOMPLETE_LEARN === '1'
    ? 'DOS_ALLOW_INCOMPLETE_LEARN=1'
    : `session-override file (reason: ${sessionOverride?.reason || 'unspecified'})`;
  console.error(
    `[PhaseCompleteGate] OVERRIDE: ${source} active. ` +
    `Allowing phase: complete write without LEARN evidence checks.\n` +
    `File: ${filePath}`,
  );
  console.log(JSON.stringify({ continue: true }));
  process.exit(0);
}

interface CheckResult {
  name: string;
  passed: boolean;
  evidence: string;
  remediation: string;
  // Staged-warn lever (2026-05-29): a FAILED check tagged 'warn' is surfaced to
  // stderr but does NOT block `phase: complete`. Omitted ⇒ 'block' (existing
  // behavior). Lets Amendment G reconciliation observe before it gates.
  severity?: 'block' | 'warn';
}

const BRIDGE = join(HOME, '.claude', 'DOS', 'Tools', 'mempalace_bridge.py');

/**
 * RFC-0151 F1 / sig-2 — emit a durable completion RECEIPT at the exact moment
 * the phase: complete write is ALLOWED (all blocking checks passed). The Work OS
 * reconciler folds this `work_completed` KG fact as closure evidence sig-2,
 * DELIBERATELY INDEPENDENT of the frontmatter `phase: complete` write: a blocked
 * gate co-blocks the frontmatter, so the receipt is the second, independent
 * signal that a gate genuinely passed.
 *
 * Contract (council 2026-07-02): fire-and-forget with error log; it MUST NEVER
 * block or fail the gate. Implemented as a DETACHED bridge write (mirrors
 * WorkOsSync.hook.ts) so it adds zero latency to the allow path and a bridge
 * outage degrades to an error-log line, never a gate failure. Emitted ONLY on a
 * genuine pass — NOT on warn-mode / override bypasses (those are not real
 * completions and must not seed a false auto-close).
 */
function emitWorkCompletedReceipt(prdSlug: string): void {
  try {
    if (!prdSlug || !existsSync(BRIDGE)) return;
    const nowIso = new Date().toISOString();
    const payload = JSON.stringify({
      subject: `dos/${prdSlug}`,
      predicate: 'work_completed',
      object: `gate:pass ts:${nowIso}`,
      valid_from: nowIso.slice(0, 10),
      confidence: 1.0,
    });
    let errTarget: 'ignore' | number = 'ignore';
    try {
      const stateDir = getMemorySubdir('STATE');
      mkdirSync(stateDir, { recursive: true });
      errTarget = openSync(join(stateDir, 'work-os-errors.jsonl'), 'a');
    } catch {
      /* log dir unavailable — spawn without capturing stderr */
    }
    const child = spawn('python3', [BRIDGE, 'add_kg_fact', payload], {
      detached: true,
      stdio: ['ignore', 'ignore', errTarget],
    });
    child.unref();
  } catch {
    /* fire-and-forget — the receipt is best-effort; it MUST NOT block or fail the gate */
  }
}

/**
 * Prefer the PRD frontmatter `slug:` for the receipt subject. Work OS identity
 * keys on the frontmatter slug (`work-os.ts` uses `fm.slug` everywhere), NOT the
 * PRD directory basename this gate uses for its own checks. When the two diverge
 * the sig-2 receipt would silently never fold at reconcile (review #2). Falls
 * back to the directory-basename slug when the file is unreadable or slug-less.
 */
function receiptSlug(prdPath: string, fallback: string): string {
  try {
    const content = readFileSync(prdPath, 'utf-8');
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
    const scope = fmMatch ? fmMatch[1] : content;
    const m = scope.match(/^slug:\s*["']?([^"'\s]+)["']?\s*$/m);
    if (m && m[1]) return m[1];
  } catch {
    /* fall back to the directory-basename slug */
  }
  return fallback;
}

function bridgeKgQueryPredicate(predicate: string, subject: string | null): { count: number; ok: boolean } {
  if (!existsSync(BRIDGE)) return { count: 0, ok: false };
  const args: Record<string, unknown> = { predicate };
  if (subject) args.subject = subject;
  try {
    const result = spawnSync('python3', [BRIDGE, 'kg_query_predicate', JSON.stringify(args)], {
      encoding: 'utf-8',
      timeout: 5000,
    });
    if (result.status !== 0) return { count: 0, ok: false };
    const stdoutText = typeof result.stdout === 'string' ? result.stdout : new TextDecoder().decode(result.stdout);
    const parsed = JSON.parse(stdoutText) as { facts?: unknown[]; results?: unknown[]; status?: string };
    const facts = parsed.facts ?? parsed.results ?? [];
    return { count: Array.isArray(facts) ? facts.length : 0, ok: true };
  } catch {
    return { count: 0, ok: false };
  }
}

function checkWorkedOn(): CheckResult {
  const r = bridgeKgQueryPredicate('worked_on', `session-${sessionId}`);
  return {
    name: 'kg-worked-on',
    passed: r.ok && r.count > 0,
    evidence: r.ok ? `${r.count} worked_on facts for session-${sessionId}` : 'bridge unavailable or query failed',
    remediation: `python3 ${BRIDGE} add_kg_fact '{"subject":"session-${sessionId}","predicate":"worked_on","object":"${slug}"}'`,
  };
}

function checkLearned(): CheckResult {
  const r = bridgeKgQueryPredicate('learned', slug);
  return {
    name: 'kg-learned',
    passed: r.ok && r.count > 0,
    evidence: r.ok ? `${r.count} learned facts for ${slug}` : 'bridge unavailable or query failed',
    remediation: `python3 ${BRIDGE} add_kg_fact '{"subject":"${slug}","predicate":"learned","object":"<lesson summary ≤16 words>"}' (one per Q1-Q4 insight)`,
  };
}

function checkReflectionJsonl(): CheckResult {
  const path = join(HOME, '.claude', 'MEMORY', 'LEARNING', 'REFLECTIONS', 'algorithm-reflections.jsonl');
  if (!existsSync(path)) {
    return {
      name: 'reflection-jsonl',
      passed: false,
      evidence: 'algorithm-reflections.jsonl missing',
      remediation: `append a reflection entry with prd_id="${slug}" via the bridge (RFC-0148 write contract): python3 ${BRIDGE} append_reflection '{"entry":{...,"prd_id":"${slug}",...}}'`,
    };
  }
  try {
    const lines = readFileSync(path, 'utf-8').trim().split('\n').slice(-50);
    const matched = lines.some((line) => {
      try {
        return (JSON.parse(line) as { prd_id?: string }).prd_id === slug;
      } catch {
        return false;
      }
    });
    return {
      name: 'reflection-jsonl',
      passed: matched,
      evidence: matched ? `entry with prd_id=${slug} present in last 50 lines` : `no entry with prd_id=${slug} in last 50 lines`,
      remediation: `append reflection entry via the bridge (RFC-0148 — raw echo >> is withdrawn): python3 ${BRIDGE} append_reflection '{"entry":{"timestamp":"<date -u>","prd_id":"${slug}",...}}'`,
    };
  } catch (err) {
    return {
      name: 'reflection-jsonl',
      passed: false,
      evidence: `read error: ${(err as Error).message}`,
      remediation: 'inspect reflections file permissions',
    };
  }
}

function prdHasDecisions(): boolean {
  if (!existsSync(filePath)) return false;
  try {
    const body = readFileSync(filePath, 'utf-8');
    // `\Z` is NOT a JS regex anchor — it matched a literal 'Z', truncating this
    // capture at the first 'Z' (e.g. an ISO-8601 `...T14:00:00Z` timestamp, used
    // all over these PRDs), so a real Decisions section read as <50 chars and the
    // decision-drawer blocking gate silently passed. Anchored lookahead = next
    // `^## ` heading OR true end-of-input. (Forge Gen 16, verified across edges.)
    const match = body.match(/^## Decisions\s*\n([\s\S]*?)(?=^## |(?![\s\S]))/m);
    if (!match) return false;
    const section = match[1].trim();
    return section.length > 50;
  } catch {
    return false;
  }
}

function checkDecisionDrawer(): CheckResult {
  if (!prdHasDecisions()) {
    return {
      name: 'decision-drawer',
      passed: true,
      evidence: 'PRD has no decisions section requiring archive',
      remediation: '',
    };
  }
  if (!existsSync(BRIDGE)) {
    return { name: 'decision-drawer', passed: false, evidence: 'bridge unavailable', remediation: 'check bridge install' };
  }
  // Slug is unique to the PRD; a row matches when its title or content carries the slug
  // and it reports the decision-archives room (or no room). Shared by both lookup paths.
  const matchesSlug = (rows: Array<{ title?: string; content?: string; room?: string }>): boolean =>
    Array.isArray(rows) && rows.some((d) => {
      const room = d.room ?? '';
      return (((d.title ?? '').includes(slug)) || ((d.content ?? '').includes(slug))) && (!room || room === 'decision-archives');
    });
  // Run one bridge action and return whether it matched the slug, or null when the call
  // did not yield parseable JSON (non-zero exit / empty stdout — e.g. degraded chromadb,
  // concurrent KG access). null is "couldn't tell", distinct from false "told, no match".
  const queryMatch = (action: string, payload: unknown): boolean | null => {
    try {
      const r = spawnSync('python3', [BRIDGE, action, JSON.stringify(payload)], { encoding: 'utf-8', timeout: 20000 });
      if (r.status !== 0) return null;
      const text = (typeof r.stdout === 'string' ? r.stdout : new TextDecoder().decode(r.stdout)).trim();
      if (!text || (text[0] !== '{' && text[0] !== '[')) return null;
      const parsed = JSON.parse(text) as { status?: string; results?: Array<{ title?: string; content?: string; room?: string }>; drawers?: Array<{ title?: string; content?: string; room?: string }> };
      if (parsed.status === 'error') return null; // exit-0 error payload — "couldn't tell", not "no match"
      const rows = parsed.results ?? parsed.drawers ?? [];
      if (matchesSlug(rows)) return true;
      // A page filled to the limit may hide the target beyond the window — report "couldn't
      // tell" (null), never a confident "no match" (false).
      const limit = (payload as { limit?: number }).limit;
      if (Array.isArray(rows) && typeof limit === 'number' && rows.length >= limit) return null;
      return false;
    } catch {
      return null;
    }
  };
  // Fast path: hybrid BM25+vector search. No room `where` filter — the bridge ranks top-K
  // THEN post-filters, so a room filter can drop a poorly-ranked match; we post-match below.
  const semantic = queryMatch('search', { query: `${slug} decisions`, limit: 15 });
  if (semantic === true) {
    return { name: 'decision-drawer', passed: true, evidence: `decision drawer with title containing ${slug} found`, remediation: '' };
  }
  // Fallback: metadata-only enumeration of decision-archives. list_drawers uses Chroma's
  // `where`/`get` (metadata), NOT the vector index, so it stays correct when the semantic
  // search exits non-zero / empty under a degraded HNSW index. Closes the recurring
  // decision-drawer false-negative (RFC-0060; TECH-DEBT 2026-06-01). preview_chars:0 returns
  // full content (no window that could clip the slug). NOTE: list_drawers rows carry no
  // `title` — this path matches on content, which by convention opens "Decisions for {slug}:".
  const metadata = queryMatch('list_drawers', { room: 'decision-archives', limit: 1000, preview_chars: 0 });
  if (metadata === true) {
    return {
      name: 'decision-drawer',
      passed: true,
      evidence: `decision drawer for ${slug} found via metadata fallback (semantic search ${semantic === null ? 'unavailable' : 'missed'})`,
      remediation: '',
    };
  }
  // list_drawers is the authoritative metadata scan: a definitive `false` means every
  // decision-archives drawer was read and none matched the slug; `null` means the scan could
  // not complete (degraded chromadb / >1000 drawers) — stay uncertain rather than fail hard.
  const uncertain = metadata === null;
  return {
    name: 'decision-drawer',
    passed: false,
    evidence: uncertain
      ? 'list_drawers could not confirm (chromadb degraded or >1000 decision drawers) — verify manually before override'
      : 'no decision drawer matching slug',
    remediation: uncertain
      ? `Retry the gate; if persistent, verify manually: python3 ${BRIDGE} list_drawers '{"room":"decision-archives","limit":1000,"preview_chars":0}' | grep ${slug}`
      : `python3 ${BRIDGE} add_drawer '{"wing":"<project>","room":"decision-archives","title":"${slug}-decisions","content":"<## Decisions text — MUST contain the slug verbatim>","tags":["decision-archive","${slug}"],"added_by":"algorithm-learn","dup_threshold":0.0}' (dup_threshold:0.0 disables similarity dedupe — without it, near-identical prior decision drawers cause add_drawer to return {"status":"duplicate"} without writing, leaving this gate check still failing)`,
  };
}

function checkWorkingTreeClean(): CheckResult {
  const tool = join(HOME, 'Durante', 'Tools', 'working-tree-clean-gate.ts');
  if (!existsSync(tool)) {
    return { name: 'wt-clean', passed: true, evidence: 'working-tree-clean-gate.ts not present (tool not installed)', remediation: '' };
  }
  if (process.env.DOS_ALLOW_DIRTY_LEARN === '1') {
    return { name: 'wt-clean', passed: true, evidence: 'DOS_ALLOW_DIRTY_LEARN=1 audited override', remediation: '' };
  }
  if (sessionOverride?.wt_clean === 'skip') {
    console.error(`[PhaseCompleteGate] OVERRIDE: session-override wt_clean=skip (reason: ${sessionOverride.reason || 'unspecified'})`);
    return {
      name: 'wt-clean',
      passed: true,
      evidence: `session-override file at ~/.claude/MEMORY/STATE/learn-overrides/${sessionId}.json (reason: ${sessionOverride.reason || 'unspecified'})`,
      remediation: '',
    };
  }
  try {
    const result = spawnSync('bun', [tool, '--format', 'json'], { encoding: 'utf-8', timeout: 10000 });
    return {
      name: 'wt-clean',
      passed: result.status === 0,
      evidence: result.status === 0 ? 'working tree clean' : 'working tree dirty (see ship-submodule recommendation)',
      remediation: 'bun ~/Durante/Tools/ship-submodule.ts "<message>" for submodule edits; git add + commit for parent edits; or DOS_ALLOW_DIRTY_LEARN=1 for audited bypass',
    };
  } catch (err) {
    return { name: 'wt-clean', passed: false, evidence: `gate run error: ${(err as Error).message}`, remediation: '' };
  }
}

// V12.3-β-β Gate B (RFC-0082 §2.2): when transitioning to phase: complete on a
// vNext PRD (format_version: 3), additionally verify RFC-0081 lint passes —
// format_version is in closed enum {2, 3}, parent_rfc declared for effort >=
// standard. The check runs by reading the PRD file we're about to seal and
// parsing via @durante/prd. NOT a write block — phase transition only.
function checkVNextConformance(): CheckResult {
  try {
    // Dynamic import keeps the existing hook's startup path unchanged when
    // workspace resolution isn't yet wired (V12.3-α happened earlier in
    // v0.0.12 sprint; check defensively here for environments still on shim-
    // less hook code).
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { detectFormatVersion, parsePRDContent, getScalarField } = require('@durante/prd') as {
      detectFormatVersion: (s: string) => { status: 'valid' | 'missing' | 'invalid'; version?: 2 | 3; raw?: string };
      parsePRDContent: (s: string) => { frontmatter: Record<string, string | string[]> };
      getScalarField: (fm: Record<string, string | string[]> | null, name: string) => string | undefined;
    };
    const content = readFileSync(filePath, 'utf-8');
    const v = detectFormatVersion(content);
    if (v.status === 'invalid') {
      return {
        name: 'vnext-conformance',
        passed: false,
        evidence: `format_version=${JSON.stringify(v.raw)} not in closed enum {2, 3} per RFC-0080 §2.2`,
        remediation: 'Fix the format_version frontmatter field to 2 (legacy) or 3 (vNext)',
      };
    }
    if (v.status !== 'valid' || v.version !== 3) {
      // v2.1 legacy PRDs skip vNext checks entirely
      return { name: 'vnext-conformance', passed: true, evidence: 'legacy v2.1 (format_version missing or = 2); vNext checks skipped', remediation: '' };
    }
    const doc = parsePRDContent(content);
    const effort = getScalarField(doc.frontmatter, 'effort')?.toLowerCase();
    const STANDARD_PLUS = new Set(['standard', 'extended', 'advanced', 'deep', 'xhigh', 'comprehensive']);
    if (effort && STANDARD_PLUS.has(effort)) {
      const parentRfc = getScalarField(doc.frontmatter, 'parent_rfc');
      if (!parentRfc) {
        return {
          name: 'vnext-conformance',
          passed: false,
          evidence: `vNext PRD at effort: ${effort} missing parent_rfc field per RFC-0080 §2.2 (R44)`,
          remediation: 'Add `parent_rfc: <RFC-NNNN>` (or `parent_rfc: none` for orphan PRD + 🪶 ORPHAN STRATEGIC INTENT marker in ## Goal per RFC-0080 §6.1)',
        };
      }
    }
    return { name: 'vnext-conformance', passed: true, evidence: `format_version: 3 + parent_rfc OK`, remediation: '' };
  } catch (e) {
    // @durante/prd not yet resolvable from this hook's import path (V12.3-α
    // workspace integration may not be live in the consuming environment).
    // Fail-soft: pass with audit evidence so the other phase-complete checks
    // still gate phase: complete.
    return { name: 'vnext-conformance', passed: true, evidence: `@durante/prd not resolvable (${(e as Error).message.slice(0, 60)}); skipping vNext lint`, remediation: '' };
  }
}

// Amendment G (v0.0.10 Part 4) — Subagent Return Reconciliation. The
// SubagentReturnTally PostToolUse hook logs every Agent/Task return to a
// per-session ledger; this check blocks `phase: complete` when the PRD's
// `## Reconciliation Log` holds fewer `📐 RECONCILED:` lines than the ledger
// holds return entries for this slug. The reconciliation rule itself lives in
// ./lib/subagent-reconcile.ts (defined once — RedTeam D1); this wrapper only
// does file I/O and fails OPEN so it can never brick a session.
function checkSubagentReconciliation(): CheckResult {
  let ledgerLines: string[] = [];
  try {
    const ledgerPath = join(getMemorySubdir('STATE'), 'subagent-returns', `${sessionId}.jsonl`);
    if (existsSync(ledgerPath)) {
      ledgerLines = readFileSync(ledgerPath, 'utf-8').trim().split('\n');
    }
  } catch { /* fail open — leave ledger empty */ }
  let prdBody = '';
  try { prdBody = readFileSync(filePath, 'utf-8'); } catch { /* treat as empty */ }
  const r = reconcileCheck({
    ledgerLines,
    prdBody,
    slug,
    overrideSkip: sessionOverride?.reconcile === 'skip',
    overrideReason: sessionOverride?.reason,
  });
  // severity:'warn' — observe-mode rollout (2026-05-29): the ledger now collects
  // returns, but a discrepancy surfaces as a warning rather than blocking closeout.
  // Flip to blocking by removing severity once calibrated against workflow-era fan-outs.
  return { name: 'subagent-reconciliation', ...r, severity: 'warn' };
}

// ISC Coverage Saturation (PRD 20260520-194114_isc-coverage-saturation) — the
// OBSERVE-side mirror of Amendment G. Coverage is COMPUTED at the §6.1.e8
// OBSERVE substep, which runs isc-coverage.ts and discharges-or-waives each
// obligation: that substep is the PRIMARY control (Council D2). This check is
// an explicitly-named BACKSTOP — it independently re-resolves the convention
// obligations and asserts they were discharged-or-waived, closing the
// skip-the-substep hole (D3 self-RedTeam). The decision rule lives in
// ./lib/coverage-check.ts (defined once — mirrors subagent-reconcile.ts); this
// wrapper only does file I/O + subprocess and fails OPEN so it can never brick
// a session.
function checkCoverageSaturation(): CheckResult {
  // INDEPENDENT obligation resolution (ISC-34): shell out to isc-coverage.ts —
  // this check does NOT merely trust the PRD's `## Coverage Log`. The tool
  // lives in ~/Durante/Tools, which is absent on customer installs; a missing
  // spawn target / errored call / unparseable JSON → null → coverageCheck()
  // fails OPEN (ISC-36, mirroring checkWorkingTreeClean's existsSync guard).
  let report: CoverageReport | null = null;
  const tool = join(HOME, 'Durante', 'Tools', 'isc-coverage.ts');
  if (existsSync(tool)) {
    try {
      const result = spawnSync('bun', [tool, '--prd', filePath, '--format', 'json'], {
        encoding: 'utf-8',
        timeout: 20000,
      });
      // EXIT 0 = clean, 1 = undischarged found — both emit a valid
      // CoverageReport on stdout. EXIT 2 (IO error) or any other status →
      // leave report null so the check fails open.
      if (result.status === 0 || result.status === 1) {
        const stdoutText =
          typeof result.stdout === 'string'
            ? result.stdout
            : new TextDecoder().decode(result.stdout);
        report = JSON.parse(stdoutText) as CoverageReport;
      }
    } catch {
      report = null; // fail open — never a false block
    }
  }

  let prdBody = '';
  try {
    prdBody = readFileSync(filePath, 'utf-8');
  } catch {
    /* treat as empty — coverageCheck handles it */
  }

  // The session transcript drives the transcript-E WARN (never a block —
  // ISC-32). The hook input carries transcript_path; absent → [] → no WARN,
  // fails open (ISC-49).
  let transcriptLines: string[] = [];
  const transcriptPath = (input as { transcript_path?: string }).transcript_path;
  if (transcriptPath && existsSync(transcriptPath)) {
    try {
      transcriptLines = readFileSync(transcriptPath, 'utf-8').trim().split('\n');
    } catch {
      transcriptLines = []; // fail open
    }
  }

  const r = coverageCheck({
    report,
    prdBody,
    transcriptLines,
    slug,
    overrideSkip: sessionOverride?.coverage === 'skip',
    overrideReason: sessionOverride?.reason,
  });
  return { name: 'coverage-saturation', ...r };
}

// Shared triviality validator for Amendment I-2 overrides (Cato F1,
// 2026-05-26). Applied identically to BOTH the PRD-body
// `Override I-2 reason:` line AND the session-override file
// `i2_recount` slot's `reason` field. Prior to F1, the PRD-body path
// enforced ≥3 distinct content words and ≤32 words total but the
// session-override path silently accepted any non-empty string —
// asymmetry that let bare reasons ("no time", "skip") slip through one
// door but not the other. The helper closes the gap with one rule.
function validateOverrideReason(reason: string): boolean {
  const text = (reason || '').trim();
  if (text.length === 0) return false;
  const STOPWORDS = new Set([
    'a', 'an', 'the', 'is', 'was', 'are', 'were', 'of', 'to', 'for',
    'in', 'on', 'at', 'by', 'and', 'or', 'but', 'i', 'it', 'no',
    'not', 'do', 'did', 'have', 'has', 'had', 'be', 'been', 'this',
    'that', 'with', 'as', 'we', 'me', 'my', 'so',
  ]);
  const contentWords = text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w && !STOPWORDS.has(w));
  const distinctContent = new Set(contentWords);
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  return distinctContent.size >= 3 && wordCount <= 32;
}

// Amendment I-2 (Council β, D1/D2/D3 — 2026-05-26) — /code-review
// HIGH-severity completeness Recount gate. When `/code-review` returns
// HIGH-severity completeness findings (file-count discrepancy, missed
// callsite, undercounted JOIN-site, operator-asserted-not-grep-verified)
// the VERIFY → phase: complete write fails closed UNTIL a recount artifact
// is logged at `MEMORY/STATE/recount-log.jsonl` matching this session_id
// AND prd_slug.
//
// SESSION-OVERRIDE SCHEMA SLOT (per D2):
//   i2_recount?: "skip"  — bypass this check for the live session. `reason`
//                          field is required; absent/blank reason is no-op.
//
// PRD-DECISIONS OVERRIDE SYNTAX (per Amendment I-2 clause text):
//   In PRD `## Decisions`, write one line:
//     Override I-2 reason: <≤32-word non-trivial reason>
//   Hook enforces ≥3 distinct content words after the prefix; bare reasons
//   ("no time", "tested manually", "I already counted") are insufficient.
//
// JSONL SCHEMA — RecountLogEntry (one line per recount, emitted by future
// sibling tool `bun ~/Durante/Tools/recount-record.ts`; hook reads, does
// NOT re-hash per Council D2 — trust the tool's sha256 emit):
//   {
//     timestamp:         ISO 8601 UTC string,
//     session_id:        Claude Code session UUID,
//     prd_slug:          matches PRD frontmatter `slug:`,
//     original_count:    number (count claimed before /code-review),
//     corrected_count:   number (count after recount),
//     missed_callsites:  string[] (newly-discovered file:line refs),
//     evidence_paths:    string[] (sources reviewed during recount),
//     sha256:            hex string (computed by emitting tool — NOT re-hashed)
//   }
//
// /code-review EVIDENCE-DETECTION (Discovery-First open question per
// design PRD ISC-A1 — `/code-review` skill not at `~/.claude/skills/`;
// found at `Releases/v0.0.18/.claude/plugins/marketplaces/.../code-review/`):
// the hook recognizes evidence via TWO paths:
//   (a) PRD `## Verification` section mentions `/code-review` invocation
//   (b) sidecar artifact at `MEMORY/STATE/code-review-results-{session_id}.json`
//       containing a `findings: [{severity, category}]` array with HIGH +
//       completeness-taxonomy categories
// If NEITHER signal is present → no `/code-review` was invoked → out of
// scope (covered by Algorithm §6.6 Invocation Gate); check fails OPEN.
//
// FAIL-OPEN philosophy: any file-read error, parse error, or absent
// adjacent artifact → check returns ok=true. Council D2: no shell-exec
// inside PreToolUse, pure file reads only.
function checkCodeReviewRecount(): CheckResult {
  // 1. PRD-body-level override (Amendment I-2 clause text) — takes
  //    precedence over session-override per F-Cluster operator-visibility
  //    (operator amending PRD is a more durable signal than a per-session
  //    JSON slot).
  const overrideLineMatch = candidateText.match(/^Override I-2 reason:\s*(.+)$/m);
  if (overrideLineMatch) {
    const reasonText = overrideLineMatch[1].trim();
    if (validateOverrideReason(reasonText)) {
      return {
        name: 'code-review-recount',
        passed: true,
        evidence: `operator-override in PRD ## Decisions: "${reasonText.slice(0, 60)}${reasonText.length > 60 ? '…' : ''}"`,
        remediation: '',
      };
    }
    console.error(
      `[PhaseCompleteGate] PRD-body Override I-2 reason rejected (Cato F1): trivial/insufficient reason "${reasonText.slice(0, 60)}${reasonText.length > 60 ? '…' : ''}" — needs ≥3 distinct content words and ≤32 words total.`,
    );
    // override present but non-trivial-reason check failed — fall through
    // and let the standard check fail with a tailored message
  }

  // 2. Session-override slot (D2) — equivalent to (1) when in-session AI
  //    cannot write to PRD body for some reason. Reason validation now
  //    matches the PRD-body path (Cato F1, 2026-05-26): the same
  //    ≥3-distinct-content-words / ≤32-words-total triviality test applies.
  if (sessionOverride?.i2_recount === 'skip') {
    const reasonText = (sessionOverride.reason || '').trim();
    if (validateOverrideReason(reasonText)) {
      console.error(`[PhaseCompleteGate] OVERRIDE: session-override i2_recount=skip (reason: ${reasonText})`);
      return {
        name: 'code-review-recount',
        passed: true,
        evidence: `session-override file (i2_recount=skip, reason: ${reasonText})`,
        remediation: '',
      };
    }
    console.error(
      `[PhaseCompleteGate] session-override i2_recount=skip rejected (Cato F1): trivial/insufficient reason ${reasonText.length === 0 ? '(empty)' : `"${reasonText.slice(0, 60)}${reasonText.length > 60 ? '…' : ''}"`} — needs ≥3 distinct content words and ≤32 words total.`,
    );
    // override present but reason invalid — fall through to standard check
  }

  // 3. Detect `/code-review` invocation evidence. If NONE, this check is
  //    out of scope (covered by §6.6 Invocation Gate elsewhere).
  let prdBody = '';
  try { prdBody = readFileSync(filePath, 'utf-8'); } catch { /* treat as empty */ }
  // candidateText (the write-in-progress) may contain the verification
  // section before the file is sealed; check both.
  const combinedText = `${candidateText}\n${prdBody}`;

  // 3a. PRD `## Verification` section mentions `/code-review`?
  // Same `\Z`-is-literal-'Z' bug as prdHasDecisions (Forge Gen 16) — a `## Verification`
  // section with an early 'Z' (timestamp/word) truncated, hiding a real /code-review mention.
  const verificationSectionMatch = combinedText.match(/^## Verification\s*\n([\s\S]*?)(?=^## |(?![\s\S]))/m);
  const verifMentionsCodeReview = verificationSectionMatch
    ? /\/code-review\b/.test(verificationSectionMatch[1])
    : false;

  // 3b. Sidecar artifact?
  //
  // Cato F2 (2026-05-26): a sidecar file whose JSON fails to parse is
  // EVIDENCE that `/code-review` was attempted — it is NOT equivalent to
  // an absent sidecar. Prior behavior treated parse failure as "fail
  // open" and routed the request to the out-of-scope branch at 3c, which
  // silently passed the gate. F2 distinguishes the two: parse failure
  // sets `sidecarExistedButParseFailed = true` and the gate fails closed
  // with a denial message instructing the operator to delete or repair
  // the malformed file before retrying.
  const sidecarPath = join(HOME, '.claude', 'MEMORY', 'STATE', `code-review-results-${sessionId}.json`);
  type CodeReviewFinding = { severity?: string; category?: string; message?: string };
  type CodeReviewSidecar = { findings?: CodeReviewFinding[] };
  let sidecarFindings: CodeReviewFinding[] = [];
  let sidecarExistedButParseFailed = false;
  let sidecarParseError = '';
  if (existsSync(sidecarPath)) {
    try {
      const parsed = JSON.parse(readFileSync(sidecarPath, 'utf-8')) as CodeReviewSidecar;
      if (Array.isArray(parsed.findings)) sidecarFindings = parsed.findings;
    } catch (err) {
      // Cato F2: do NOT fail open. The file's mere existence indicates
      // /code-review ran; a corrupt body is a recovery-required signal.
      sidecarExistedButParseFailed = true;
      sidecarParseError = (err as Error).message;
    }
  }
  const sidecarPresent = sidecarFindings.length > 0;

  // 3a-F2. Cato F2: malformed sidecar → fail closed BEFORE out-of-scope
  //        short-circuit. This is the only path through which a sidecar's
  //        existence-but-corruption can be surfaced to the operator.
  if (sidecarExistedButParseFailed) {
    return {
      name: 'code-review-recount',
      passed: false,
      evidence: `sidecar at ${sidecarPath} exists but is malformed JSON (parse error: ${sidecarParseError.slice(0, 80)})`,
      remediation: `Sidecar at ${sidecarPath} exists but is malformed JSON — delete or repair before retrying. (sidecar was present, indicating /code-review attempted; the parse failure must not silently fail-open per Cato F2.)`,
    };
  }

  if (!verifMentionsCodeReview && !sidecarPresent) {
    return {
      name: 'code-review-recount',
      passed: true,
      evidence: 'no /code-review invocation detected — covered by §6.6 Invocation Gate (out of scope here)',
      remediation: '',
    };
  }

  // 4. Filter for HIGH-severity completeness findings only.
  const COMPLETENESS_CATEGORIES = new Set([
    'file-count-discrepancy',
    'missed-callsite',
    'undercounted-join',
    'undercounted-join-string-typed',
    'operator-asserted-not-grep-verified',
  ]);
  const highCompletenessFindings = sidecarFindings.filter((f) => {
    const sev = String(f.severity || '').toUpperCase();
    const cat = String(f.category || '').toLowerCase();
    return sev === 'HIGH' && COMPLETENESS_CATEGORIES.has(cat);
  });

  // 4a. /code-review evidence present but NO HIGH-completeness findings →
  //     gate is dischargeable without a recount artifact.
  if (highCompletenessFindings.length === 0) {
    return {
      name: 'code-review-recount',
      passed: true,
      evidence: verifMentionsCodeReview
        ? '/code-review verified; no HIGH-severity completeness findings to recount'
        : `sidecar present (${sidecarFindings.length} findings); none HIGH-severity completeness`,
      remediation: '',
    };
  }

  // 5. HIGH-completeness findings present → require matching recount
  //    artifact at MEMORY/STATE/recount-log.jsonl.
  type RecountLogEntry = {
    timestamp?: string;
    session_id?: string;
    prd_slug?: string;
    original_count?: number;
    corrected_count?: number;
    missed_callsites?: string[];
    evidence_paths?: string[];
    sha256?: string;
  };
  const recountLogPath = join(HOME, '.claude', 'MEMORY', 'STATE', 'recount-log.jsonl');
  let matchingLineNumber = -1;
  let matchedEntry: RecountLogEntry | null = null;
  if (existsSync(recountLogPath)) {
    try {
      const lines = readFileSync(recountLogPath, 'utf-8').trim().split('\n');
      for (let i = 0; i < lines.length; i++) {
        const raw = lines[i];
        // Cato F9 (2026-05-26): whitespace-only lines (e.g., `'   '`) are
        // truthy and would fall through to JSON.parse, which throws and
        // is caught silently below — but the per-line skip is the right
        // place to short-circuit so the catch handler is reserved for
        // genuinely malformed content. `.trim()` covers '', ' ', '\t', '\r'.
        if (!raw.trim()) continue;
        try {
          const entry = JSON.parse(raw) as RecountLogEntry;
          if (entry.session_id === sessionId && entry.prd_slug === slug) {
            // require structurally-sane recount: sha256 present (per D2
            // trust the tool's emit — but it MUST emit), corrected_count
            // present. Malformed entries fail closed (do NOT discharge).
            if (typeof entry.sha256 === 'string' && entry.sha256.length > 0 &&
                typeof entry.corrected_count === 'number') {
              matchingLineNumber = i + 1; // 1-indexed for human reporting
              matchedEntry = entry;
              break;
            }
          }
        } catch { /* skip malformed line */ }
      }
    } catch { /* read error → treat as no match → fail closed */ }
  }

  if (matchedEntry) {
    return {
      name: 'code-review-recount',
      passed: true,
      evidence: `recount logged at ${recountLogPath}:${matchingLineNumber} (original=${matchedEntry.original_count} → corrected=${matchedEntry.corrected_count}, sha256=${(matchedEntry.sha256 || '').slice(0, 12)}…)`,
      remediation: '',
    };
  }

  // 6. Fail closed.
  const firstFinding = highCompletenessFindings[0];
  const findingQuote = String(firstFinding.message || `${firstFinding.category} (no message)`).slice(0, 80);
  return {
    name: 'code-review-recount',
    passed: false,
    evidence: `${highCompletenessFindings.length} HIGH-severity completeness finding(s) from /code-review; no matching recount artifact at ${recountLogPath} for session_id=${sessionId} + prd_slug=${slug}. First finding: "${findingQuote}"`,
    remediation: `Log recount at MEMORY/STATE/recount-log.jsonl matching session_id + prd_slug (sibling tool: bun ~/Durante/Tools/recount-record.ts). Bypass: append \`Override I-2 reason: <≤32-word non-trivial reason>\` to PRD \`## Decisions\`, OR set \`i2_recount: "skip"\` (with \`reason: <text>\`) in ~/.claude/MEMORY/STATE/learn-overrides/${sessionId}.json`,
  };
}

const checks: CheckResult[] = [
  checkWorkedOn(),
  checkLearned(),
  checkReflectionJsonl(),
  checkDecisionDrawer(),
  checkWorkingTreeClean(),
  checkVNextConformance(),
  checkSubagentReconciliation(),
  checkCoverageSaturation(),
  checkCodeReviewRecount(),
];

const { failedBlocking, failedWarn } = classifyFailures(checks);

// Warn-severity checks (e.g. Amendment G reconciliation during observe-mode rollout)
// never block — surface them to stderr whenever they fail, then fall through.
if (failedWarn.length > 0) {
  console.error(
    `[PhaseCompleteGate] WARN (observe-only, non-blocking): ${failedWarn.length} check(s) failed for ${slug}.\n` +
    failedWarn.map((f) => `  - ${f.name}: ${f.evidence}`).join('\n'),
  );
}

if (failedBlocking.length === 0) {
  // RFC-0151 sig-2: all blocking checks passed → the phase: complete write is
  // ALLOWED. Emit the completion receipt (fire-and-forget) BEFORE releasing the
  // write. This is the only genuine-pass path — warn-mode and override bypasses
  // below deliberately do NOT emit (they are not real completions). The receipt
  // subject keys on the PRD frontmatter slug (Work OS identity), not the gate's
  // directory-basename slug.
  emitWorkCompletedReceipt(receiptSlug(filePath, slug));
  console.log(JSON.stringify({ continue: true }));
  process.exit(0);
}

if (process.env.DOS_PHASE_GATE_MODE === 'warn' || sessionOverride?.phase_gate_mode === 'warn') {
  const source = process.env.DOS_PHASE_GATE_MODE === 'warn'
    ? 'DOS_PHASE_GATE_MODE=warn'
    : `session-override file (reason: ${sessionOverride?.reason || 'unspecified'})`;
  console.error(
    `[PhaseCompleteGate] WARN (${source}): ${failedBlocking.length} of ${checks.length} phase-complete checks failed for ${slug}; allowing through (warn mode).\n` +
    failedBlocking.map((f) => `  - ${f.name}: ${f.evidence}`).join('\n'),
  );
  console.log(JSON.stringify({ continue: true }));
  process.exit(0);
}

const reason = `🛑 PhaseCompleteGate: phase: complete write to ${slug} blocked — ${failedBlocking.length} of ${checks.length} phase-complete checks failed.

The Algorithm doctrine declares the obligations that fire BEFORE phase: complete is written. Six prior text-rule iterations failed to bind; this hook is the mechanical enforcement layer.

Failed checks:
${failedBlocking.map((f) => `  ❌ ${f.name}\n     evidence: ${f.evidence}\n     fix: ${f.remediation}`).join('\n\n')}

Passed checks:
${checks.filter((c) => c.passed).map((c) => `  ✓ ${c.name} — ${c.evidence}`).join('\n') || '  (none)'}
${failedWarn.length > 0 ? `\nObserve-only warnings (non-blocking — did NOT cause this block, surfaced for awareness):\n${failedWarn.map((f) => `  ⚠ ${f.name} — ${f.evidence}`).join('\n')}\n` : ''}
Override paths (in precedence order):

  1. SESSION-SCOPED OVERRIDE FILE — recommended for in-session bypass.
     Works from ANY Bash call in the live session — no env propagation needed.
     Schema: {wt_clean?: "skip", incomplete_learn?: "skip",
              reconcile?: "skip", coverage?: "skip",
              i2_recount?: "skip", phase_gate_mode?: "warn",
              reason: string, expires_at?: ISO-8601-UTC}
     Path: ~/.claude/MEMORY/STATE/learn-overrides/${sessionId}.json
     Example (skip dirty-WT only — most common case for AI):
       mkdir -p ~/.claude/MEMORY/STATE/learn-overrides && \\
       echo '{"wt_clean":"skip","reason":"<why>"}' > \\
         ~/.claude/MEMORY/STATE/learn-overrides/${sessionId}.json

  2. PRD-BODY OVERRIDE (Amendment I-2 only) — for the 9th check
     (code-review-recount) ONLY. Append a line to PRD ## Decisions:
       Override I-2 reason: <≤32-word non-trivial reason>
     Bare reasons ("no time", "tested manually") are insufficient — hook
     enforces ≥3 distinct content words after the prefix.

  3. ENV VARS — must be set in ".env" or ".gateway.env" at project root,
     loaded via loadProjectEnv(). Shell "export" in a Bash subshell does
     NOT reach hook subprocesses — the harness invokes hooks with its own
     env, not the user's bash env (load-bearing gotcha discovered 2026-05-06).
       DOS_ALLOW_INCOMPLETE_LEARN=1   — full bypass (audited)
       DOS_ALLOW_DIRTY_LEARN=1        — wt-clean check bypass only (audited)
       DOS_PHASE_GATE_MODE=warn        — durable backfill mode (logs, allows)

Spec: ~/Durante/Plans/Specs/RFC-0060-phase-complete-gate.md
Conformance: Sentinel R35 (presence.phase-complete-gate-active)
Reference: ~/.claude/projects/[REDACTED:operator-project-slug]/memory/feedback_load_project_env.md`;

console.log(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: 'PreToolUse',
    permissionDecision: 'deny',
    permissionDecisionReason: reason,
  },
}));
process.exit(0);
