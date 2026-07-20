/**
 * R95 — lint.hook-timing-adoption (sixth `lint.*` rule).
 *
 * The 2026-07-02 maturity audit: only ~5 of 97 hooks emit timing telemetry
 * (hooks/lib/hook-io.ts startTimer/stopTimer → hook-timing.jsonl), so the
 * hook pipeline is largely unmeasured — you cannot manage what you barely
 * measure (Feathers dissent, Observability 2). Tools/hook-profiler.ts is the
 * read side; this rule lints the write side: every `*.hook.ts` should either
 * use the timing wrapper or opt out with a reason.
 *
 * Detection (content-level, single pass): a hook file that references
 * neither `hook-io` (import) nor `startTimer(` counts as untimed.
 * Opt-out: a `lint.hook-timing-adoption: ok <reason>` comment anywhere in
 * the file (e.g. sub-millisecond guards where wrapper cost exceeds signal).
 *
 * Scope: `*.hook.ts` under the repo via walkFiles — covers pack-owned hooks
 * (Packs/x/src/Hooks/) and the active release submodule's hooks tree
 * (Releases/vN/.claude/hooks/) when checked out. fixtures/__fixtures__ and
 * test basenames excluded.
 *
 * Warn-only ship (R80/R91/R93/R94 advisory precedent): ALWAYS returns
 * `status: "pass"`; violations surface via evidence only. Promote after
 * adoption crosses ~80% (measured by this rule's own evidence count).
 */

import { readFileSync } from "fs";
import { relative } from "path";
import { walkFiles } from "../lib/ast-utils.ts";
import type { CheckContext, CheckResult } from "../types.ts";

const REQUIREMENT =
  "lint.hook-timing-adoption: every *.hook.ts uses the hook-io timing wrapper (startTimer) or opts out with a reason";

const R_ID = "R95";

const ALLOW_RE = /lint\.hook-timing-adoption:\s*ok/i;
const TIMED_RE = /hook-io|startTimer\s*\(/;
const HOOK_FILE_RE = /\.hook\.ts$/;
const EXCLUDE_RE = /\/(?:node_modules|\.git|__fixtures__|fixtures|__tests__)\//;
const TEST_FILE_RE = /\.test\.ts$/;

export interface HookTimingVerdict {
  timed: boolean;
  optedOut: boolean;
}

export function evaluateSource(src: string): HookTimingVerdict {
  return { timed: TIMED_RE.test(src), optedOut: ALLOW_RE.test(src) };
}

export async function r95HookTimingAdoption(ctx: CheckContext): Promise<CheckResult> {
  const files = walkFiles(
    ctx.repoRoot,
    (name) => HOOK_FILE_RE.test(name) && !TEST_FILE_RE.test(name),
  ).filter((f) => !EXCLUDE_RE.test(f));

  if (files.length === 0) {
    return {
      rId: R_ID,
      requirement: REQUIREMENT,
      status: "not_applicable",
      evidence: [`no *.hook.ts files under ${ctx.repoRoot}`],
    };
  }

  let timed = 0;
  let optedOut = 0;
  const untimed: string[] = [];
  for (const file of files) {
    let src: string;
    try {
      src = readFileSync(file, "utf-8");
    } catch {
      continue;
    }
    const v = evaluateSource(src);
    if (v.timed) timed++;
    else if (v.optedOut) optedOut++;
    else untimed.push(relative(ctx.repoRoot, file));
  }

  const pctTimed = Math.round((100 * (timed + optedOut)) / files.length);
  const summary =
    untimed.length === 0
      ? `lint.hook-timing-adoption: ${files.length} hook(s) — all timed or opted out`
      : `lint.hook-timing-adoption (WARN-ONLY): ${untimed.length} of ${files.length} hook(s) untimed (${pctTimed}% adopted) — Tools/hook-profiler.ts is blind to them`;

  return {
    rId: R_ID,
    requirement: REQUIREMENT,
    status: "pass",
    evidence: [
      summary,
      ...untimed.slice(0, 25).map((f) => `${f} — no hook-io/startTimer and no opt-out`),
      ...(untimed.length > 25 ? [`(... +${untimed.length - 25} more)`] : []),
    ],
  };
}

export const __testing__ = { evaluateSource };
