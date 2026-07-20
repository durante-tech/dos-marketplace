/**
 * R91 — lint.false-green (RFC-0146 F3, third-generation lint.* rule).
 *
 * The corpus's THIRD `lint.*` static-source-scan rule (after R80
 * verifier-fail-on-empty and R81 ci-gate-canary). RFC-0146's F3: a gate that
 * reports GREEN it did not earn silently defeats every downstream verification
 * built on top of it (F1's own receipt included). Scans gate / CI / test scripts
 * for the exit-code-laundering idioms named in RFC-0146 §3.2:
 *
 *   #1  --passWithNoTests / passWithNoTests:true  — an empty/zero-collected suite
 *          reports green (dead gate).  [ALL formats]
 *   #2  a gate/test/build command piped WITHOUT `set -o pipefail`  — the pipe
 *          launders the exit code to the last stage.               [SHELL only]
 *   #3  a regen (`--write`/`--fix`/codegen) `&&`-chained on the same line to a
 *          self-compare (diff/--check) over the SAME artifact — a
 *          regenerate-and-compare gate that self-heals to false green. [SHELL only]
 *
 * Scope (v1, honest): `.sh` scripts get all three idioms. `package.json` scripts
 * and `.github/workflows/*.yml` (reached by a targeted readdir — walkFiles prunes
 * dot-dirs) get idiom #1 only, since a portable pipefail/self-heal analysis of a
 * JSON/YAML value needs format-aware parsing (documented follow-up). node_modules
 * / .git / __fixtures__ are excluded.
 *
 * Opt-out: a `lint.false-green: ok <reason>` comment on the hit line or the line
 * above neutralizes it — the carve-out for a legitimately-empty suite (brand-new
 * package bootstrap / Walking-Skeleton) or an intentional `|| true` cleanup.
 *
 * Warn-only ship (mirrors R80 / R72 advisory): ALWAYS returns `status: "pass"`;
 * violations surface via evidence only. baseline.json / verdict_matrix are NOT
 * touched (additive). Promote to fail-tier after FP-rate measurement (R75
 * DOS_R75_MODE precedent). Decision logic lives in `__testing__.evaluateSource`.
 */

import { existsSync, readFileSync, readdirSync } from "fs";
import { join, relative } from "path";
import { walkFiles } from "../lib/ast-utils.ts";
import type { CheckContext, CheckResult } from "../types.ts";

const REQUIREMENT =
  "lint.false-green: gate/CI/test scripts must not launder a failing exit code into a green (no --passWithNoTests; shell: no pipe-without-pipefail on a gate command, no regen-then-self-compare)";

const R_ID = "R91";

/** Opt-out comment — neutralizes a hit on this logical line or the physical line above. */
const ALLOW_RE = /lint\.false-green:\s*ok/i;

/** #1 — empty-suite green. Excludes the explicitly-disabled `=false` / `: false` forms. */
const PASS_NO_TESTS_RE = /--passWithNoTests(?!\s*=?\s*false\b)\b|passWithNoTests\s*[:=]\s*true/;

/** #2 — a gate/test/build command whose exit code is load-bearing. */
const GATE_CMD_RE =
  /\b(?:bun\s+(?:x\s+)?(?:test|run|tsc)|npm\s+(?:run\s+)?test|npm\s+run\b|pnpm\s+(?:test|run)|yarn\s+(?:test|run)|tsc\b|vitest\b|jest\b|pytest\b|go\s+test\b|cargo\s+test\b)/;

/** #3 — a regeneration / write / codegen invocation, and a self-compare. */
const REGEN_RE = /--write\b|--fix\b|\bregen(?:erate)?\b|\b(?:generate|codegen)\b|--emit\b/;
const COMPARE_RE = /\bdiff\b|--check\b|--exit-code\b|\bsync-check\b|\bcmp\b/;
/** File-like token (has an extension) — used to require a SHARED artifact for #3. */
const PATH_TOKEN_RE = /[\w./-]+\.[A-Za-z0-9]+/g;

/** ENABLING pipefail only — `set -o pipefail` / `-eo` / `-euo`; NOT `set +o pipefail`. */
const PIPEFAIL_ENABLE_RE = /\bset\s+-[a-zA-Z]*o[a-zA-Z]*\s+pipefail\b|\bset\s+-o\s+pipefail\b/;

export interface FalseGreenVerdict {
  fires: boolean;
  hits: string[];
}

/** Strip quoted strings + a trailing unquoted `#` comment (shell tokenization for #2/#3). */
function stripShellNoise(s: string): string {
  let t = s.replace(/"[^"]*"|'[^']*'|`[^`]*`/g, '""');
  const h = t.indexOf("#");
  if (h >= 0) t = t.slice(0, h);
  return t;
}

/** Strip only a trailing whitespace-preceded `#` comment (keeps quoted JSON values intact for #1). */
function stripTrailingComment(s: string): string {
  return s.replace(/\s#.*$/, "");
}

/** A bare `|` pipe (not part of `||`). */
function hasBarePipe(s: string): boolean {
  const singles = (s.match(/\|/g) || []).length;
  const doubles = (s.match(/\|\|/g) || []).length * 2;
  return singles - doubles > 0;
}

/** Group physical lines into logical lines, joining trailing-backslash continuations. */
function logicalLines(src: string): Array<{ text: string; line: number; prev: string }> {
  const raw = src.split("\n");
  const out: Array<{ text: string; line: number; prev: string }> = [];
  let i = 0;
  while (i < raw.length) {
    const start = i;
    let text = raw[i];
    while (/\\\s*$/.test(text) && i + 1 < raw.length) {
      text = text.replace(/\\\s*$/, " ") + raw[i + 1];
      i++;
    }
    out.push({ text, line: start + 1, prev: raw[start - 1] ?? "" });
    i++;
  }
  return out;
}

/** #3 — same logical line, `&&`/`;`-chained regen → compare over a SHARED artifact token. */
function detectSelfHeal(clean: string): boolean {
  const segs = clean.split(/&&|;/);
  for (let a = 0; a < segs.length; a++) {
    if (!REGEN_RE.test(segs[a])) continue;
    const paths = segs[a].match(PATH_TOKEN_RE) || [];
    if (paths.length === 0) continue;
    for (let b = a + 1; b < segs.length; b++) {
      if (COMPARE_RE.test(segs[b]) && paths.some((p) => segs[b].includes(p))) return true;
    }
  }
  return false;
}

/**
 * Pure decision function. `shell=true` → full tokenized 3-idiom scan; `shell=false`
 * (package.json / CI-YAML) → idiom #1 only, on the raw (comment-stripped) line.
 */
export function evaluateSource(loc: string, src: string, shell: boolean): FalseGreenVerdict {
  const lls = logicalLines(src);
  const fileHasPipefail = shell && lls.some((l) => PIPEFAIL_ENABLE_RE.test(stripShellNoise(l.text)));
  const hits: string[] = [];

  for (const ll of lls) {
    if (ALLOW_RE.test(ll.text) || ALLOW_RE.test(ll.prev)) continue;

    // #1 — empty-suite green (all formats). Comment-stripped so a commented mention is inert.
    if (PASS_NO_TESTS_RE.test(stripTrailingComment(ll.text))) {
      hits.push(
        `${loc}:${ll.line}  --passWithNoTests lets a zero-collected suite report green (dead gate) — ` +
          `assert >0 collected, or add "# lint.false-green: ok <reason>" for a legit-empty bootstrap.`,
      );
      continue;
    }

    if (!shell) continue; // idioms #2/#3 are shell-only in v1

    const clean = stripShellNoise(ll.text);

    // #2 — shell pipe launders the exit code
    if (!fileHasPipefail && GATE_CMD_RE.test(clean) && hasBarePipe(clean)) {
      hits.push(
        `${loc}:${ll.line}  gate/test command piped without \`set -o pipefail\` — the pipe reports the ` +
          `LAST stage's exit code, laundering a failure to green. Add \`set -o pipefail\` or capture rc directly.`,
      );
      continue;
    }

    // #3 — regen && self-compare over the same artifact
    if (detectSelfHeal(clean)) {
      hits.push(
        `${loc}:${ll.line}  regen (--write/--fix/codegen) \`&&\` self-compare (diff/--check) over the same ` +
          `artifact — a regenerate-and-compare gate can self-heal to false green. Compare read-only against a committed baseline.`,
      );
    }
  }
  return { fires: hits.length > 0, hits };
}

const EXCLUDE_RE = /\/(?:node_modules|\.git|__fixtures__)\//;

/**
 * R91 handler. `.sh` (all idioms) + `package.json` (idiom #1) via walkFiles;
 * `.github/workflows/*.yml` (idiom #1) via a targeted readdir (walkFiles prunes
 * dot-dirs). Always `status: "pass"` (warn-only); violations in evidence.
 */
export async function r91LintFalseGreen(ctx: CheckContext): Promise<CheckResult> {
  const shFiles = walkFiles(ctx.repoRoot, (name) => name.endsWith(".sh")).filter((f) => !EXCLUDE_RE.test(f));
  const pkgFiles = walkFiles(ctx.repoRoot, (name) => name === "package.json").filter((f) => !EXCLUDE_RE.test(f));

  const ghDir = join(ctx.repoRoot, ".github", "workflows");
  let ymlFiles: string[] = [];
  if (existsSync(ghDir)) {
    try {
      ymlFiles = readdirSync(ghDir)
        .filter((n) => n.endsWith(".yml") || n.endsWith(".yaml"))
        .map((n) => join(ghDir, n));
    } catch {
      ymlFiles = [];
    }
  }

  const scanned = shFiles.length + pkgFiles.length + ymlFiles.length;
  if (scanned === 0) {
    return {
      rId: R_ID,
      requirement: REQUIREMENT,
      status: "not_applicable",
      evidence: [`no gate/CI/test scripts (.sh, package.json, .github/workflows/*.yml) under ${ctx.repoRoot}`],
    };
  }

  const violations: string[] = [];
  const scan = (files: string[], shell: boolean) => {
    for (const file of files) {
      let src: string;
      try {
        src = readFileSync(file, "utf-8");
      } catch {
        continue;
      }
      const v = evaluateSource(relative(ctx.repoRoot, file), src, shell);
      if (v.fires) violations.push(...v.hits);
    }
  };
  scan(shFiles, true);
  scan(pkgFiles, false);
  scan(ymlFiles, false);

  const summary =
    violations.length === 0
      ? `lint.false-green: ${scanned} gate/CI/test script(s) scanned, 0 false-green idioms (clean)`
      : `lint.false-green (WARN-ONLY): ${violations.length} exit-code-laundering idiom(s) across ${scanned} script(s)`;

  return {
    rId: R_ID,
    requirement: REQUIREMENT,
    status: "pass",
    evidence: [
      summary,
      ...violations.slice(0, 25),
      ...(violations.length > 25 ? [`(... +${violations.length - 25} more)`] : []),
    ],
  };
}

export const __testing__ = { evaluateSource };
