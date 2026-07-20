/**
 * R13 — SessionEnd hooks doing slow work must be daemon-detached.
 *
 * Walks every `*.hook.ts` under `CheckContext.hooksRoot` (excluding
 * `*.daemon.ts` siblings which ARE the detached workers). A hook is
 * a VIOLATION when it contains any of the SLOW_PATTERN regex hits
 * AND none of the DETACH_PATTERN regex hits AND has no exempt pragma.
 *
 * Why: Claude Code's SessionEnd reaper SIGKILLs hooks that exceed ~5s.
 * SIGKILL does NOT fire `process.on('exit')`, so timing/error telemetry
 * never lands in hook-timing.jsonl or hook-errors.jsonl. The hook fails
 * silently — exactly the failure mode that left MemoryHarvest, StudioSync,
 * and MemPalaceLearn dead for days/weeks before being noticed (RFC-0037
 * follow-ups, 2026-05-03).
 *
 * Slow patterns (any one is suspicious):
 *   - `await inference(` — DOS Inference Tool calls (Haiku ~20-60s)
 *   - `bridgeSync(` — synchronous MemPalace bridge calls (default 5s timeout)
 *   - `await fetch(` — HTTP calls without same-file AbortController/signal
 *   - `await runBackfill\b` — the legacy unbounded HTTP pattern
 *
 * Detach patterns (any one satisfies the rule):
 *   - `detached: true` — Node child_process.spawn detached
 *   - `import .* detachWorker` — canonical detach helper
 *   - `\.daemon\.ts` — references a sibling daemon (wrapper-pattern)
 *
 * Exemption: `// conformance:R13-exempt` pragma anywhere in the file
 * (e.g., for hooks that genuinely complete in <500ms despite matching
 * a slow pattern, or for non-SessionEnd hooks where the rule doesn't
 * apply).
 */

import { readFileSync } from "fs";
import { walkFiles } from "../lib/ast-utils.ts";
import type { CheckContext, CheckResult } from "../types.ts";

const SLOW_PATTERNS: Array<{ name: string; re: RegExp }> = [
  { name: "await inference()", re: /\bawait\s+inference\s*\(/ },
  { name: "bridgeSync()", re: /\bbridgeSync\s*\(/ },
  { name: "await fetch()", re: /\bawait\s+fetch\s*\(/ },
  { name: "await runBackfill", re: /\bawait\s+runBackfill\s*\(/ },
];

const DETACH_PATTERNS: Array<{ name: string; re: RegExp }> = [
  { name: "detached: true", re: /\bdetached\s*:\s*true\b/ },
  { name: "lib/detachWorker import", re: /from\s+['"][^'"]*\/lib\/detachWorker['"]/ },
  { name: ".daemon.ts reference", re: /['"`][^'"`]*\.daemon\.ts['"`]/ },
];

const EXEMPT_PRAGMA = /conformance:R13-exempt/;
const ABORT_SIGNAL = /\bsignal\s*:\s*\w+\.signal\b|\bAbortController\b/;

interface HookFinding {
  file: string;
  matchedSlowPatterns: string[];
}

function fileHasSlowWork(content: string): string[] {
  const matches: string[] = [];
  for (const { name, re } of SLOW_PATTERNS) {
    if (!re.test(content)) continue;
    // Special case: await fetch() with same-file AbortController is safe.
    if (name === "await fetch()" && ABORT_SIGNAL.test(content)) continue;
    matches.push(name);
  }
  return matches;
}

function fileIsDetached(content: string): boolean {
  return DETACH_PATTERNS.some((p) => p.re.test(content));
}

export async function r13SessionEndSlowHookDetached(ctx: CheckContext): Promise<CheckResult> {
  const files = walkFiles(
    ctx.hooksRoot,
    (name) => name.endsWith(".hook.ts") && !name.endsWith(".daemon.ts"),
  );
  if (files.length === 0) {
    return {
      rId: "R13",
      requirement: "SessionEnd hooks doing slow work must be daemon-detached",
      status: "not_applicable",
      evidence: [`no *.hook.ts found under ${ctx.hooksRoot}`],
    };
  }

  const findings: HookFinding[] = [];

  for (const file of files) {
    let content: string;
    try {
      content = readFileSync(file, "utf-8");
    } catch {
      continue;
    }
    if (EXEMPT_PRAGMA.test(content)) continue;

    const slowMatches = fileHasSlowWork(content);
    if (slowMatches.length === 0) continue;

    if (fileIsDetached(content)) continue;

    findings.push({
      file: file.replace(ctx.hooksRoot + "/", ""),
      matchedSlowPatterns: slowMatches,
    });
  }

  if (findings.length === 0) {
    return {
      rId: "R13",
      requirement: "SessionEnd hooks doing slow work must be daemon-detached",
      status: "pass",
      evidence: [`scanned ${files.length} *.hook.ts file(s); none violate the slow-work-without-detach rule`],
    };
  }

  const evidence = findings.map(
    (f) => `${f.file}: matches [${f.matchedSlowPatterns.join(", ")}] without detach pattern (split into wrapper + .daemon.ts or add // conformance:R13-exempt)`,
  );

  return {
    rId: "R13",
    requirement: "SessionEnd hooks doing slow work must be daemon-detached",
    status: "fail",
    evidence,
  };
}
