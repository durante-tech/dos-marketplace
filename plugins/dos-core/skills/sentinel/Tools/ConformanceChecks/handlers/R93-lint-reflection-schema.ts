/**
 * R93 — lint.reflection-schema (§K.1 mechanism 3, fourth-generation lint.* rule).
 *
 * The corpus's FOURTH `lint.*` static-source-scan rule (after R80
 * verifier-fail-on-empty, R81 ci-gate-canary, R91 false-green). §K.1's
 * mechanism 3: the bridge `append_reflection` action is the SANCTIONED write
 * path to ~/.claude/MEMORY/LEARNING/REFLECTIONS/algorithm-reflections.jsonl
 * (schema-validated, O_APPEND-atomic). A raw append anywhere else bypasses that
 * validation and can poison the corpus every downstream reader trusts
 * (SaveReflectionsToStudio, R32/R62 parity checks, FetchReflections). This rule
 * is the AUDIT-tier companion to the bridge validation — it observes and
 * reports; the bridge remains the load-bearing gate, NEVER this scan.
 *
 * Violation idioms (single logical line, v1 — a filename built through a
 * variable is a documented miss):
 *   #1  shell/py redirection append to the reflections-log filename — incl. a
 *          shell command built inside a TS template literal.   [ALL surfaces]
 *   #2  TS fs append API naming the log inside the call parens — appendFile /
 *          appendFileSync / createWriteStream — appendFile* is append-semantics
 *          by construction; a write stream over the log outside the bridge is
 *          flagged regardless of flags.                        [ALL surfaces]
 *   #3  python open() naming the log with an append mode ('a'/'ab'/'a+'/'ab+').
 *
 * Scope: `.sh` / `.ts` / `.py` code surfaces via walkFiles (which prunes
 * dot-dirs + node_modules by construction). Additionally EXCLUDED from
 * violations (noted here, per the audit-tier honesty contract): __fixtures__/,
 * fixtures/, tests/, __tests__/ dirs and test-file basenames (*.test.{ts,sh,py},
 * *.spec.ts, test_*.py, *_test.py) — test sources legitimately carry the idioms
 * as fixture strings (this rule's OWN test file included). `.md` is NOT
 * scanned. Full-line comments (`#`, `//`, `*` doc-continuation) are inert; a
 * TRAILING same-line comment carrying an idiom still fires (documented v1
 * limitation — neutralize with the opt-out).
 *
 * Allowlist (the sanctioned writers): path endsWith `Tools/_bridge_palace.py`
 * (the palace module that implements append_reflection — covers pack source and
 * the deployed sibling), `DOS/Tools/mempalace_bridge.py` (the deployed alias of
 * bridge.py), or `Tools/bridge.py` (the pack alias). Opt-out: a
 * `lint.reflection-schema: ok <reason>` comment on the hit line or the line
 * above neutralizes it.
 *
 * Warn-only ship (mirrors R91/R80 advisory): ALWAYS returns `status: "pass"`;
 * violations surface via evidence only (`file:line — idiom`). Promote to
 * fail-tier after FP-rate measurement (R75 DOS_R75_MODE precedent). Decision
 * logic lives in `__testing__.evaluateSource`.
 */

import { readFileSync } from "fs";
import { relative } from "path";
import { walkFiles } from "../lib/ast-utils.ts";
import type { CheckContext, CheckResult } from "../types.ts";

const REQUIREMENT =
  "lint.reflection-schema: reflections reach algorithm-reflections.jsonl only through the bridge append_reflection action (no raw >>/appendFile writes in code surfaces)";

const R_ID = "R93";

/** Opt-out comment — neutralizes a hit on this logical line or the physical line above. */
const ALLOW_RE = /lint\.reflection-schema:\s*ok/i;

/**
 * The sanctioned writers. `_bridge_palace.py` implements append_reflection
 * (the suffix covers the pack source AND the deployed DOS/Tools sibling);
 * `mempalace_bridge.py` is the deployed alias of `bridge.py` (the pack alias).
 */
const SANCTIONED_WRITER_SUFFIXES = [
  "Tools/_bridge_palace.py",
  "DOS/Tools/mempalace_bridge.py",
  "Tools/bridge.py",
];

// lint.reflection-schema: ok — the rule's own detection regex, not a writer
const REDIRECT_APPEND_RE = />>\s*\S*algorithm-reflections\.jsonl/;
// lint.reflection-schema: ok — the rule's own detection regex, not a writer
const TS_APPEND_RE = /(appendFile|appendFileSync|createWriteStream)\s*\([^)]*algorithm-reflections\.jsonl/;
// lint.reflection-schema: ok — the rule's own detection regex, not a writer
const PY_OPEN_APPEND_RE = /\bopen\s*\([^\n]*?algorithm-reflections\.jsonl[^\n]*?["']a[bt+]{0,2}["']/;

export interface ReflectionSchemaVerdict {
  fires: boolean;
  hits: string[];
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

/** Full-line comment / doc-continuation — inert for all three idioms. */
function isCommentLine(text: string): boolean {
  const t = text.trimStart();
  return t.startsWith("#") || t.startsWith("//") || t.startsWith("*");
}

/**
 * Pure decision function. All three idiom regexes run on every surface — a
 * raw append is a raw append regardless of the host language (a `.ts` hook
 * shelling out a `>>` redirect is exactly the bypass §K.1 names). `filePath`
 * drives the sanctioned-writer allowlist and the `file:line` evidence prefix.
 */
export function evaluateSource(src: string, filePath: string): ReflectionSchemaVerdict {
  if (SANCTIONED_WRITER_SUFFIXES.some((s) => filePath.endsWith(s))) {
    return { fires: false, hits: [] };
  }

  const hits: string[] = [];
  for (const ll of logicalLines(src)) {
    if (ALLOW_RE.test(ll.text) || ALLOW_RE.test(ll.prev)) continue;
    if (isCommentLine(ll.text)) continue;

    // #1 — shell/py redirection append (incl. shell built in a TS template literal)
    if (REDIRECT_APPEND_RE.test(ll.text)) {
      hits.push(
        `${filePath}:${ll.line} — raw \`>>\` redirection into the reflections log; route through ` +
          `\`mempalace_bridge.py append_reflection\` (schema-validated, O_APPEND) or add "lint.reflection-schema: ok <reason>".`,
      );
      continue;
    }

    // #2 — TS fs append API naming the log inside the call parens
    if (TS_APPEND_RE.test(ll.text)) {
      hits.push(
        `${filePath}:${ll.line} — fs append API (appendFile / appendFileSync / createWriteStream) targeting the ` +
          `reflections log directly; route through the bridge append_reflection action or add "lint.reflection-schema: ok <reason>".`,
      );
      continue;
    }

    // #3 — python open() on the log with an append mode
    if (PY_OPEN_APPEND_RE.test(ll.text)) {
      hits.push(
        `${filePath}:${ll.line} — python open() on the reflections log with an append mode; route through ` +
          `the bridge append_reflection action or add "lint.reflection-schema: ok <reason>".`,
      );
    }
  }
  return { fires: hits.length > 0, hits };
}

/** Dirs excluded from violations (walkFiles already prunes dot-dirs + node_modules). */
const EXCLUDE_RE = /\/(?:node_modules|\.git|__fixtures__|fixtures|__tests__|tests)\//;
/** Test-file basenames — fixture strings inside tests legitimately carry the idioms. */
const TEST_FILE_RE = /(?:\.test\.(?:ts|sh|py)|\.spec\.ts|_test\.py)$|^test_.*\.py$/;

/**
 * R93 handler. `.sh` / `.ts` / `.py` via walkFiles, minus excluded dirs and
 * test-file basenames. Always `status: "pass"` (warn-only, AUDIT tier — the
 * bridge validation is the load-bearing gate); violations in evidence.
 */
export async function r93LintReflectionSchema(ctx: CheckContext): Promise<CheckResult> {
  const files = walkFiles(
    ctx.repoRoot,
    (name) =>
      (name.endsWith(".sh") || name.endsWith(".ts") || name.endsWith(".py")) && !TEST_FILE_RE.test(name),
  ).filter((f) => !EXCLUDE_RE.test(f));

  if (files.length === 0) {
    return {
      rId: R_ID,
      requirement: REQUIREMENT,
      status: "not_applicable",
      evidence: [`no code surfaces (.sh, .ts, .py) under ${ctx.repoRoot}`],
    };
  }

  const violations: string[] = [];
  for (const file of files) {
    let src: string;
    try {
      src = readFileSync(file, "utf-8");
    } catch {
      continue;
    }
    const v = evaluateSource(src, relative(ctx.repoRoot, file));
    if (v.fires) violations.push(...v.hits);
  }

  const summary =
    violations.length === 0
      ? `lint.reflection-schema: ${files.length} code surface(s) scanned, 0 raw appends to algorithm-reflections.jsonl (clean)`
      : `lint.reflection-schema (WARN-ONLY): ${violations.length} raw-append idiom(s) across ${files.length} code surface(s) — reflections go through the bridge append_reflection action`;

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
