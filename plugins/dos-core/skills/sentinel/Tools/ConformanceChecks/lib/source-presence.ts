/**
 * source-presence — shared helpers for the wiring-canary presence rules
 * (R55 / R56 / R90) that assert a load-bearing function or flag still exists
 * in a committed source file.
 *
 * WHY (SENT-05): those rules used a raw whole-file `src.includes(TOKEN)`.
 * That stays GREEN when the guarded symbol is DELETED but a COMMENT still
 * mentions it — e.g. `// runRoadmapReconcile wired the roadmap section` keeps
 * R55 passing even after `runRoadmapReconcile` is gone. The canary is then
 * blind to the exact regression it exists to catch.
 *
 * FIX: strip comments FIRST, then require a real declaration / call / usage
 * shape (not a bare substring). A prose mention no longer satisfies the canary.
 *
 * Two comment dialects are supported because the canaries span two languages:
 *   - stripSlashComments  — TypeScript (`//` + `/* … *\/`)  → R55, R90 (drift-check.ts)
 *   - stripHashComments   — shell (`#`)                     → R56 (release.sh)
 *
 * The strippers are string-literal aware (they do NOT treat a comment marker
 * inside a quoted string as a comment). They are deliberately conservative:
 * on an exotic construct they UNDER-strip (leave code intact) rather than
 * over-strip, so they never remove a real definition and cause a false fail.
 * Newlines are preserved so line-based reasoning downstream stays stable.
 */

/** Strip `//` line comments and `/* … *\/` block comments from TS/JS source. */
export function stripSlashComments(src: string): string {
  let out = "";
  let i = 0;
  const n = src.length;
  type State = "code" | "line" | "block" | "sq" | "dq" | "tpl";
  let state: State = "code";
  while (i < n) {
    const c = src[i]!;
    const c2 = i + 1 < n ? src[i + 1] : "";
    if (state === "code") {
      if (c === "/" && c2 === "/") { state = "line"; i += 2; continue; }
      if (c === "/" && c2 === "*") { state = "block"; i += 2; continue; }
      if (c === "'") { state = "sq"; out += c; i++; continue; }
      if (c === '"') { state = "dq"; out += c; i++; continue; }
      if (c === "`") { state = "tpl"; out += c; i++; continue; }
      out += c; i++; continue;
    }
    if (state === "line") {
      if (c === "\n") { state = "code"; out += c; }
      i++; continue;
    }
    if (state === "block") {
      if (c === "*" && c2 === "/") { state = "code"; i += 2; continue; }
      if (c === "\n") out += c; // preserve line count
      i++; continue;
    }
    // string states (sq / dq / tpl): copy through, honoring escapes.
    if (c === "\\" && i + 1 < n) { out += c + src[i + 1]; i += 2; continue; }
    out += c;
    if (state === "sq" && c === "'") state = "code";
    else if (state === "dq" && c === '"') state = "code";
    else if (state === "tpl" && c === "`") state = "code";
    i++;
  }
  return out;
}

/** Strip shell `#` line comments (quote-aware) from a shell script. */
export function stripHashComments(src: string): string {
  return src
    .split("\n")
    .map((line) => {
      let inS = false;
      let inD = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i]!;
        if (ch === "'" && !inD) inS = !inS;
        else if (ch === '"' && !inS) inD = !inD;
        else if (ch === "#" && !inS && !inD && (i === 0 || /\s/.test(line[i - 1]!))) {
          return line.slice(0, i);
        }
      }
      return line;
    })
    .join("\n");
}

const RE_META = /[.*+?^${}()|[\]\\]/g;

/**
 * True when `token` appears as a declaration, assignment, or call in
 * comment-stripped code — `token(`, `token =`, `function token(`, etc. — not
 * merely as a substring or comment mention. Intended for identifier tokens
 * (R55 / R90 function-name canaries).
 */
export function hasDeclarationOrCall(codeSrc: string, token: string): boolean {
  const esc = token.replace(RE_META, "\\$&");
  return new RegExp(`\\b${esc}\\s*[(=]`).test(codeSrc);
}

/**
 * True when a literal (e.g. a CLI flag like `--alias-versions=`) appears in
 * comment-stripped code. For non-identifier literals a declaration/call shape
 * does not apply; the honest strengthening over whole-file `includes()` is that
 * the literal must survive comment-stripping (a `#`-comment mention no longer
 * counts). R56 flag canary.
 */
export function hasLiteralInCode(codeSrc: string, literal: string): boolean {
  return codeSrc.includes(literal);
}
