#!/usr/bin/env bun
/**
 * @pack Brand
 * @workflow tokens-lint
 *
 * validate-brand-tokens.ts — Brand design-token (DTCG) validator
 *
 * Cloned from the proven validate-brand-voice.ts template (ISC-21): same
 * allowlist + line/path-pragma mechanism, same staged/full/paths modes, same
 * 0/1/2 exit-code taxonomy, same characterization-test idiom. It mirrors that
 * shape but operates over a W3C DTCG 2025.10 `brand-tokens.json` instead of
 * prose copy.
 *
 * The six checks (run over a token document):
 *   ISC-22 schema     — every token carries `$value` + a valid `$type`; the
 *                       three layer groups nest correctly; the version marker
 *                       ($schema or $extensions["dos.version"]) is present.
 *   ISC-23 color      — every raw `$type:"color"` value is valid OKLCH
 *                       (parsed, not regexed); decision-layer foreground/
 *                       background pairs (declared via $extensions.dos.contrast)
 *                       are scored with BOTH APCA and WCAG2 using real math.
 *   ISC-24 integrity  — three-layer rule: option holds raw primitives, decision
 *                       aliases {option.*}, component aliases {decision.*}. Flags
 *                       a hardcoded literal below the option layer and resolves
 *                       every alias to catch dangling references + cycles.
 *   ISC-26 contract   — assert required token groups/paths exist + are parseable
 *                       (the executable form of TokenSpec Step-8's prose checklist).
 *   ISC-25 orphan     — diff a consumer file (DESIGN.md / theme.css): every
 *                       color literal must reference a token value present in the
 *                       JSON, with an allowlist + line pragma to suppress
 *                       option-layer raw definitions.
 *
 * Modes:
 *   --stdin           — read one token JSON document from stdin (CLI demo path)
 *   --file <path>     — validate a single token JSON file
 *   (default)/--staged— scan git-staged *token*.json files (mirror sibling default)
 *   --full            — scan canonical token surfaces (DEFAULT_GLOBS) for CI sweeps
 *   --paths <globs>   — scan explicit globs
 *   --consumer <path> — ALSO run the orphan diff over a consumer file (ISC-25)
 *   --require <p,...> — ALSO run the contract check (ISC-26); e.g. 'decision.color.*'
 *   --allow <lit,...> — orphan-diff literal allowlist additions (ISC-25)
 *   --json            — machine-readable output
 *   --help            — print usage
 *
 * Exit codes: 0 = clean, 1 = token violations found, 2 = tool/usage error (CLIError).
 *
 * Allowlist:
 *   - Full-file skip (FULL_FILE_ALLOWLIST) for multi-file modes.
 *   - Orphan line pragma: `brand-tokens:exempt — reason` (in a CSS `/* *​/` or
 *     HTML `<!-- -->` comment) suppresses an orphan finding on the same line OR
 *     the immediately following line. Substring match — works in .css and .md.
 *   - Token-path: ORPHAN_LITERAL_ALLOWLIST / --allow suppress known raw literals.
 *
 * Adding a check: append a validate*() pass + call it from validateTokenDoc().
 * Adding an allowed token file: append to FULL_FILE_ALLOWLIST (relative to root).
 */

import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { Glob } from 'bun';

// From Packs/brand/src/Tools → repo root is four levels up. Used only by the
// multi-file (staged/full/paths) modes; stdin/file resolve against cwd.
const REPO_ROOT = resolve(import.meta.dir, '..', '..', '..', '..');

// ───────────────────────── types + taxonomy ─────────────────────────

export type CheckKind = 'schema' | 'color' | 'contrast' | 'integrity' | 'orphan' | 'contract';

export interface Finding {
  check: CheckKind;
  path: string;            // token dotted-path, or `consumer:<line>` for orphan
  message: string;
  metric?: 'wcag' | 'apca'; // contrast findings only
}

/** CLIError → exit 2 (tool/usage error, distinct from exit-1 token violations). */
export class CLIError extends Error {
  code: number;
  constructor(message: string, code = 2) {
    super(message);
    this.code = code;
    this.name = 'CLIError';
  }
}

export const VALID_TYPES = new Set([
  'color', 'dimension', 'fontFamily', 'fontWeight',
  'duration', 'cubicBezier', 'number', 'shadow', 'typography',
]);

const LAYERS = ['option', 'decision', 'component'] as const;

// Token files documented/exempt from full-file scanning (mirror sibling allowlist).
const FULL_FILE_ALLOWLIST: string[] = [
  'Packs/brand/src/Tools/validate-brand-tokens.ts',
];

// Known raw literals that are always allowed in a consumer diff (option-layer
// primitives a DESIGN.md may legitimately print). Mirrors the voice validator's
// allowlist; per-run additions come via --allow.
const ORPHAN_LITERAL_ALLOWLIST: string[] = [];

// ─────────────────── OKLCH parsing + real color math (ISC-23) ───────────────────

export interface Oklch { L: number; C: number; H: number; A: number; }

// OKLCH grammar per CSS Color 4 §10.3: oklch( L C H [ / A ] ).
// L is 0..1 (or a percentage of 1); C ≥ 0 (percentage relative to 0.4); H in deg.
const OKLCH_RE =
  /^oklch\(\s*([+-]?[\d.]+%?)\s+([+-]?[\d.]+%?)\s+([+-]?[\d.]+)(?:deg)?\s*(?:\/\s*([\d.]+%?))?\s*\)$/i;

export function parseOklch(value: string): Oklch | null {
  if (typeof value !== 'string') return null;
  const m = OKLCH_RE.exec(value.trim());
  if (!m) return null;
  const num = (s: string, pctBase: number): number =>
    s.endsWith('%') ? (parseFloat(s) / 100) * pctBase : parseFloat(s);
  const L = num(m[1]!, 1);
  const C = num(m[2]!, 0.4);
  const H = parseFloat(m[3]!);
  const A = m[4] != null ? num(m[4], 1) : 1;
  if (!Number.isFinite(L) || L < 0 || L > 1) return null;
  if (!Number.isFinite(C) || C < 0) return null;
  if (!Number.isFinite(H) || H < 0 || H > 360) return null;
  if (!Number.isFinite(A) || A < 0 || A > 1) return null;
  return { L, C, H, A };
}

/**
 * OKLCH → OKLab → linear sRGB → gamma-encoded sRGB (clamped to gamut).
 * Matrices from Björn Ottosson's reference oklab implementation
 * (https://bottosson.github.io/posts/oklab/). Returns channels in 0..1.
 */
export function oklchToSrgb({ L, C, H }: Oklch): [number, number, number] {
  const hr = (H * Math.PI) / 180;
  const a = C * Math.cos(hr);
  const b = C * Math.sin(hr);

  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;

  const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3;

  const rLin = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const gLin = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const bLin = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;

  const enc = (c: number): number => {
    const v = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
    return Math.min(1, Math.max(0, v));
  };
  return [enc(rLin), enc(gLin), enc(bLin)];
}

/**
 * WCAG 2.x contrast ratio (1.0 .. 21.0).
 * Relative luminance + ratio per WCAG 2.1 §1.4.3
 * (https://www.w3.org/TR/WCAG21/#dfn-relative-luminance):
 *   Lin(c) = c/12.92                       if c <= 0.04045
 *          = ((c + 0.055)/1.055) ** 2.4    otherwise
 *   Y      = 0.2126 R + 0.7152 G + 0.0722 B
 *   ratio  = (Y_light + 0.05) / (Y_dark + 0.05)
 */
export function wcagContrast(fg: Oklch, bg: Oklch): number {
  const lum = (rgb: [number, number, number]): number => {
    const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
    return 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]);
  };
  const Lf = lum(oklchToSrgb(fg));
  const Lb = lum(oklchToSrgb(bg));
  const hi = Math.max(Lf, Lb), lo = Math.min(Lf, Lb);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * APCA-W3 0.1.9 (W3 'G'-series). Faithful port of the published
 * `sRGBtoY()` + `APCAcontrast()` from Myndex/apca-w3
 * (https://github.com/Myndex/apca-w3 ; spec git.apcacontrast.com).
 * Distinct math from WCAG2: APCA uses a simple 2.4-power transfer with a
 * black soft-clamp, then a polarity-aware power-difference. Returns the
 * signed lightness contrast Lc; |Lc| is the perceptual contrast
 * (|Lc| ≈ 60 ≙ body-text minimum, ≈ 45 ≙ large-text minimum).
 */
export function apcaLc(txt: Oklch, bg: Oklch): number {
  const mainTRC = 2.4;
  const Rco = 0.2126729, Gco = 0.7151522, Bco = 0.0721750;
  const normBG = 0.56, normTXT = 0.57, revTXT = 0.62, revBG = 0.65;
  const blkThrs = 0.022, blkClmp = 1.414;
  const scaleBoW = 1.14, scaleWoB = 1.14;
  const loBoWoffset = 0.027, loWoBoffset = 0.027;
  const deltaYmin = 0.0005, loClip = 0.1;

  const sRGBtoY = (rgb: [number, number, number]): number => {
    let Y =
      Rco * Math.pow(rgb[0], mainTRC) +
      Gco * Math.pow(rgb[1], mainTRC) +
      Bco * Math.pow(rgb[2], mainTRC);
    if (Y < blkThrs) Y += Math.pow(blkThrs - Y, blkClmp); // soft-clamp dark
    return Y;
  };

  const Ytxt = sRGBtoY(oklchToSrgb(txt));
  const Ybg = sRGBtoY(oklchToSrgb(bg));

  if (Math.abs(Ybg - Ytxt) < deltaYmin) return 0;

  let out: number;
  if (Ybg > Ytxt) {
    // normal polarity: dark text on light background
    const sapc = (Math.pow(Ybg, normBG) - Math.pow(Ytxt, normTXT)) * scaleBoW;
    out = sapc < loClip ? 0 : sapc - loBoWoffset;
  } else {
    // reverse polarity: light text on dark background
    const sapc = (Math.pow(Ybg, revBG) - Math.pow(Ytxt, revTXT)) * scaleWoB;
    out = sapc > -loClip ? 0 : sapc + loWoBoffset;
  }
  return out * 100;
}

// ─────────────────── token tree: flatten + alias resolution ───────────────────

export interface TokenNode {
  $value: unknown;
  $type?: string;
  $extensions?: unknown;
  __path: string;
}

function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

/** DTCG whole-string alias, e.g. "{decision.color.surface}". */
export function isAlias(v: unknown): v is string {
  return typeof v === 'string' && /^\{[A-Za-z0-9_.\- ]+\}$/.test(v.trim());
}
function aliasPath(v: string): string { return v.trim().slice(1, -1).trim(); }

/**
 * Flatten the DTCG tree into path → token, carrying inherited group `$type`.
 * A node is a token if it has own `$value`, or has own `$type` but no child
 * tokens (a malformed token missing its `$value` — surfaced by the schema pass).
 */
export function flattenTokens(doc: Record<string, unknown>): Map<string, TokenNode> {
  const out = new Map<string, TokenNode>();
  const walk = (node: Record<string, unknown>, prefix: string, inheritedType?: string) => {
    const groupType = typeof node['$type'] === 'string' ? (node['$type'] as string) : inheritedType;
    for (const [key, val] of Object.entries(node)) {
      if (key.startsWith('$')) continue;
      if (!isObject(val)) continue;
      const path = prefix ? `${prefix}.${key}` : key;
      const hasValue = '$value' in val;
      const hasOwnType = typeof (val as any).$type === 'string';
      const hasChildren = Object.keys(val).some(k => !k.startsWith('$') && isObject((val as any)[k]));
      if (hasValue || (hasOwnType && !hasChildren)) {
        out.set(path, {
          $value: (val as any).$value,
          $type: hasOwnType ? (val as any).$type : groupType,
          $extensions: (val as any).$extensions,
          __path: path,
        });
      } else {
        walk(val, path, groupType);
      }
    }
  };
  walk(doc, '');
  return out;
}

/** Resolve a token path through its alias chain to a raw value. Detects dangling refs + cycles. */
export function resolveRaw(
  index: Map<string, TokenNode>,
  path: string,
  seen = new Set<string>(),
): { ok: boolean; raw?: unknown; type?: string; error?: string } {
  const node = index.get(path);
  if (!node) return { ok: false, error: `dangling reference: '${path}' does not exist` };
  if (seen.has(path)) return { ok: false, error: `alias cycle through '${path}'` };
  seen.add(path);
  if (isAlias(node.$value)) {
    return resolveRaw(index, aliasPath(node.$value as string), seen);
  }
  return { ok: true, raw: node.$value, type: node.$type };
}

// ───────────────────────── the six checks ─────────────────────────

function validateSchema(doc: Record<string, unknown>, index: Map<string, TokenNode>): Finding[] {
  const findings: Finding[] = [];

  // ISC-22 version marker
  const hasSchema = typeof doc['$schema'] === 'string';
  const ext = doc['$extensions'];
  const hasVersion = isObject(ext) && typeof (ext as any)['dos.version'] === 'string';
  if (!hasSchema && !hasVersion) {
    findings.push({
      check: 'schema',
      path: '(root)',
      message: 'missing version marker — expected "$schema" or $extensions["dos.version"]',
    });
  }

  // ISC-22 three groups nest correctly
  for (const layer of LAYERS) {
    if (!isObject(doc[layer])) {
      findings.push({ check: 'schema', path: layer, message: `missing required top-level group '${layer}'` });
    }
  }

  // ISC-22 per-token shape
  for (const [path, node] of index) {
    if (node.$value === undefined) {
      findings.push({ check: 'schema', path, message: 'malformed token: missing $value' });
    }
    const t = node.$type;
    if (!t) {
      findings.push({ check: 'schema', path, message: 'malformed token: missing $type (and no inherited group $type)' });
    } else if (!VALID_TYPES.has(t)) {
      findings.push({
        check: 'schema',
        path,
        message: `malformed token: invalid $type '${t}' (allowed: ${[...VALID_TYPES].join(', ')})`,
      });
    }
  }
  return findings;
}

function validateColor(index: Map<string, TokenNode>): Finding[] {
  const findings: Finding[] = [];
  for (const [path, node] of index) {
    if (node.$type !== 'color') continue;
    if (isAlias(node.$value)) continue; // aliases resolve through option; only raw colors get the OKLCH lint
    if (typeof node.$value !== 'string' || !parseOklch(node.$value)) {
      findings.push({
        check: 'color',
        path,
        message: `invalid OKLCH color value: ${JSON.stringify(node.$value)} (expected oklch(L C H [/ A]))`,
      });
    }
  }
  return findings;
}

function validateIntegrity(index: Map<string, TokenNode>): Finding[] {
  const findings: Finding[] = [];
  for (const [path, node] of index) {
    const top = path.split('.')[0];
    const v = node.$value;

    if (top === 'option') {
      if (isAlias(v)) {
        findings.push({ check: 'integrity', path, message: `option-layer token must hold a raw primitive, found alias ${v}` });
      }
    } else if (top === 'decision') {
      if (!isAlias(v)) {
        findings.push({ check: 'integrity', path, message: `decision-layer token must alias the option layer — hardcoded literal not allowed: ${JSON.stringify(v)}` });
      } else if (!aliasPath(v as string).startsWith('option.')) {
        findings.push({ check: 'integrity', path, message: `decision-layer token must alias {option.*}, found {${aliasPath(v as string)}}` });
      }
    } else if (top === 'component') {
      if (!isAlias(v)) {
        findings.push({ check: 'integrity', path, message: `component-layer token must alias the decision layer — hardcoded literal not allowed: ${JSON.stringify(v)}` });
      } else if (!aliasPath(v as string).startsWith('decision.')) {
        findings.push({ check: 'integrity', path, message: `component-layer token must alias {decision.*}, found {${aliasPath(v as string)}}` });
      }
    }

    // dangling / cycle: resolve every alias to a raw value
    if (isAlias(v)) {
      const r = resolveRaw(index, path);
      if (!r.ok) findings.push({ check: 'integrity', path, message: r.error! });
    }
  }
  return findings;
}

function validateContrast(index: Map<string, TokenNode>): Finding[] {
  const findings: Finding[] = [];
  for (const [path, node] of index) {
    const ext = node.$extensions;
    const cfg = isObject(ext) ? (ext as any)['dos.contrast'] : undefined;
    if (!isObject(cfg)) continue;

    const against = (cfg as any).against;
    if (!isAlias(against)) {
      findings.push({ check: 'contrast', path, message: 'dos.contrast.against must be an alias like "{decision.color.surface}"' });
      continue;
    }
    const minWcag = typeof (cfg as any).min?.wcag === 'number' ? (cfg as any).min.wcag : 4.5;
    const minApca = typeof (cfg as any).min?.apca === 'number' ? (cfg as any).min.apca : 60;

    const fgR = resolveRaw(index, path);
    if (!fgR.ok) { findings.push({ check: 'contrast', path, message: `cannot resolve foreground: ${fgR.error}` }); continue; }
    const bgR = resolveRaw(index, aliasPath(against));
    if (!bgR.ok) { findings.push({ check: 'contrast', path, message: `cannot resolve background: ${bgR.error}` }); continue; }

    const fg = typeof fgR.raw === 'string' ? parseOklch(fgR.raw) : null;
    const bg = typeof bgR.raw === 'string' ? parseOklch(bgR.raw) : null;
    if (!fg || !bg) { findings.push({ check: 'contrast', path, message: 'contrast pair resolves to a non-OKLCH color' }); continue; }

    const ratio = wcagContrast(fg, bg);
    const lc = apcaLc(fg, bg);
    if (ratio < minWcag) {
      findings.push({ check: 'contrast', metric: 'wcag', path, message: `WCAG2 contrast ${ratio.toFixed(2)}:1 is below the ${minWcag}:1 minimum (vs ${aliasPath(against)})` });
    }
    if (Math.abs(lc) < minApca) {
      findings.push({ check: 'contrast', metric: 'apca', path, message: `APCA Lc ${lc.toFixed(1)} is below the ${minApca} minimum (vs ${aliasPath(against)})` });
    }
  }
  return findings;
}

function validateContract(index: Map<string, TokenNode>, requires: string[]): Finding[] {
  const findings: Finding[] = [];
  for (const req of requires) {
    if (req.endsWith('.*')) {
      const prefix = req.slice(0, -2) + '.';
      const members = [...index.keys()].filter(k => k.startsWith(prefix));
      if (members.length === 0) {
        findings.push({ check: 'contract', path: req, message: `required group '${req}' has no tokens` });
        continue;
      }
      for (const m of members) {
        const r = resolveRaw(index, m);
        if (!r.ok) findings.push({ check: 'contract', path: m, message: `required token not parseable: ${r.error}` });
      }
    } else {
      if (!index.has(req)) {
        findings.push({ check: 'contract', path: req, message: `required token '${req}' is missing` });
      } else {
        const r = resolveRaw(index, req);
        if (!r.ok) findings.push({ check: 'contract', path: req, message: `required token not parseable: ${r.error}` });
      }
    }
  }
  return findings;
}

// Orphan-diff line pragma (mirrors voice validator's `<!-- brand-voice:exempt -->`).
const ORPHAN_PRAGMA = /brand-tokens:exempt/;
// Color literals in a consumer file: hex (#rgb..#rrggbbaa) and oklch(...).
const COLOR_LITERAL_RE = /#[0-9a-fA-F]{3,8}\b|oklch\([^)]*\)/g;

function normColor(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * ISC-25 orphan / no-hardcoded diff. Every color literal in a consumer file
 * must equal a raw token value present in the JSON; otherwise it is an orphan
 * (an off-token hardcoded color). A line pragma or the literal allowlist
 * suppresses option-layer raw definitions that legitimately appear.
 */
export function orphanDiff(
  doc: Record<string, unknown>,
  consumerText: string,
  opts: { allow?: string[] } = {},
): Finding[] {
  const index = flattenTokens(doc);
  const known = new Set<string>();
  for (const node of index.values()) {
    if (typeof node.$value === 'string' && !isAlias(node.$value)) known.add(normColor(node.$value));
  }
  const allow = new Set([...ORPHAN_LITERAL_ALLOWLIST, ...(opts.allow ?? [])].map(normColor));

  const findings: Finding[] = [];
  const lines = consumerText.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const prev = i > 0 ? lines[i - 1]! : '';
    if (ORPHAN_PRAGMA.test(line) || ORPHAN_PRAGMA.test(prev)) continue;

    COLOR_LITERAL_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = COLOR_LITERAL_RE.exec(line)) !== null) {
      const lit = normColor(m[0]);
      if (known.has(lit) || allow.has(lit)) continue;
      findings.push({
        check: 'orphan',
        path: `consumer:${i + 1}`,
        message: `hardcoded color '${m[0]}' does not reference any token in the JSON`,
      });
    }
  }
  return findings;
}

/** Orchestrate the document-level checks (schema + color + contrast + integrity [+ contract]). */
export function validateTokenDoc(doc: unknown, opts: { require?: string[] } = {}): Finding[] {
  if (!isObject(doc)) throw new CLIError('token document root must be a JSON object');
  const index = flattenTokens(doc);
  const findings: Finding[] = [];
  findings.push(...validateSchema(doc, index));
  findings.push(...validateColor(index));
  findings.push(...validateIntegrity(index));
  findings.push(...validateContrast(index));
  if (opts.require && opts.require.length) findings.push(...validateContract(index, opts.require));
  return findings;
}

// ───────────────────────── CLI plumbing ─────────────────────────

function parseJsonDoc(text: string, label: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    throw new CLIError(`${label}: not valid JSON — ${(e as Error).message}`);
  }
  if (!isObject(parsed)) throw new CLIError(`${label}: token document root must be a JSON object`);
  return parsed;
}

function isTokenFile(path: string): boolean {
  return path.endsWith('.json') && /token/i.test(path);
}

function isAllowedFile(relPath: string): boolean {
  return FULL_FILE_ALLOWLIST.includes(relPath);
}

function getStagedFiles(): string[] {
  const result = spawnSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
  if (result.status !== 0) return [];
  return result.stdout.split('\n').filter(f => f.length > 0 && isTokenFile(f));
}

const DEFAULT_GLOBS = [
  'Docs/**/brand-tokens.json',
  'Docs/**/tokens.json',
  'Packs/brand/**/brand-tokens.json',
] as const;

async function getPathsMatching(patterns: readonly string[]): Promise<string[]> {
  const seen = new Set<string>();
  for (const pattern of patterns) {
    const glob = new Glob(pattern);
    for await (const f of glob.scan({ cwd: REPO_ROOT })) {
      if (isTokenFile(f as string)) seen.add(f as string);
    }
  }
  return [...seen];
}

function argValue(args: string[], flag: string): string | undefined {
  const i = args.indexOf(flag);
  if (i === -1) return undefined;
  const v = args[i + 1];
  return v && !v.startsWith('--') ? v : undefined;
}

function printHelp(): void {
  console.log(`validate-brand-tokens — DOS brand design-token (DTCG) validator

USAGE
  bun Packs/brand/src/Tools/validate-brand-tokens.ts <input> [checks] [--json] [--help]
  echo '<json>' | bun Packs/brand/src/Tools/validate-brand-tokens.ts --stdin

INPUT (one of)
  --stdin            Read one token JSON document from stdin
  --file <path>      Validate a single token JSON file
  (default)/--staged Scan git-staged *token*.json files (mirror sibling default)
  --full             Scan canonical token surfaces (CI sweeps):
                       ${DEFAULT_GLOBS.join('\n                       ')}
  --paths <globs>    Scan explicit glob patterns

EXTRA CHECKS
  --consumer <path>  Also run the orphan diff over a consumer file (DESIGN.md / theme.css)
  --require <p,...>  Also run the contract check; e.g. 'decision.color.*,decision.typography.*'
  --allow <lit,...>  Orphan-diff literal allowlist additions

OUTPUT
  --json             Machine-readable JSON
  --help             Print this help

CHECKS
  schema     every token has $value + valid $type; groups nest; version marker present
  color      raw $type:color values are valid OKLCH; decision fg/bg pairs scored APCA + WCAG2
  integrity  three-layer rule (option raw, decision→{option.*}, component→{decision.*}); no dangling alias
  contract   required token groups/paths exist + are parseable
  orphan     consumer color literals must reference a token value (allowlist + line pragma)

EXIT CODES
  0  No violations
  1  Token violations found
  2  Tool/usage error (bad args, unparseable JSON, missing file)

LINE-LEVEL EXEMPTION (orphan diff)
  Add on the line before or same line as a literal to suppress it:
    /* brand-tokens:exempt — reason */      (theme.css)
    <!-- brand-tokens:exempt — reason -->   (DESIGN.md)`);
}

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) { printHelp(); return 0; }

  const jsonMode = args.includes('--json');
  const stdinMode = args.includes('--stdin');
  const fullMode = args.includes('--full');
  const pathsMode = args.includes('--paths');
  const filePath = argValue(args, '--file');
  const consumerPath = argValue(args, '--consumer');
  const requires = (argValue(args, '--require') ?? '').split(',').map(s => s.trim()).filter(Boolean);
  const allows = (argValue(args, '--allow') ?? '').split(',').map(s => s.trim()).filter(Boolean);

  // Gather token documents from the selected input mode.
  type Source = { label: string; doc: Record<string, unknown> };
  const sources: Source[] = [];

  if (stdinMode) {
    const text = await Bun.stdin.text();
    if (!text.trim()) throw new CLIError('--stdin: no input received on stdin');
    sources.push({ label: '<stdin>', doc: parseJsonDoc(text, '<stdin>') });
  } else if (filePath) {
    const abs = resolve(process.cwd(), filePath);
    if (!existsSync(abs)) throw new CLIError(`--file: '${filePath}' does not exist`);
    sources.push({ label: filePath, doc: parseJsonDoc(readFileSync(abs, 'utf8'), filePath) });
  } else {
    // Multi-file modes: full / paths / staged (default).
    let rels: string[];
    if (fullMode) {
      rels = await getPathsMatching(DEFAULT_GLOBS);
    } else if (pathsMode) {
      const pathsIdx = args.indexOf('--paths');
      const globs = args.slice(pathsIdx + 1).filter(a => !a.startsWith('--'));
      if (globs.length === 0) throw new CLIError('--paths requires at least one glob argument');
      rels = await getPathsMatching(globs);
    } else {
      rels = getStagedFiles();
    }
    for (const rel of rels) {
      if (isAllowedFile(rel)) continue;
      const abs = resolve(REPO_ROOT, rel);
      if (!existsSync(abs) || !statSync(abs).isFile()) continue;
      sources.push({ label: rel, doc: parseJsonDoc(readFileSync(abs, 'utf8'), rel) });
    }
  }

  // The orphan diff needs exactly one token document for its known-literal set.
  if (consumerPath && sources.length !== 1) {
    throw new CLIError('--consumer requires exactly one token document (use --stdin or --file)');
  }

  const all: Array<Finding & { source: string }> = [];
  for (const src of sources) {
    for (const f of validateTokenDoc(src.doc, { require: requires })) {
      all.push({ ...f, source: src.label });
    }
  }
  if (consumerPath) {
    const abs = resolve(process.cwd(), consumerPath);
    if (!existsSync(abs)) throw new CLIError(`--consumer: '${consumerPath}' does not exist`);
    const text = readFileSync(abs, 'utf8');
    for (const f of orphanDiff(sources[0]!.doc, text, { allow: allows })) {
      all.push({ ...f, source: consumerPath });
    }
  }

  if (jsonMode) {
    console.log(JSON.stringify({
      sources: sources.map(s => s.label),
      consumer: consumerPath ?? null,
      totalFindings: all.length,
      findings: all,
    }, null, 2));
    return all.length === 0 ? 0 : 1;
  }

  if (all.length === 0) {
    const scope = sources.map(s => s.label).join(', ') || '(no token files in scope)';
    console.log(`✓ brand-tokens: ${sources.length} document(s) scanned, 0 violations [${scope}]`);
    return 0;
  }

  console.error(`✗ brand-tokens: ${all.length} violation(s)\n`);
  const byCheck = new Map<string, Array<Finding & { source: string }>>();
  for (const f of all) {
    const arr = byCheck.get(f.check) ?? [];
    arr.push(f);
    byCheck.set(f.check, arr);
  }
  for (const [check, fs] of byCheck) {
    console.error(`  [${check}]`);
    for (const f of fs) {
      const metric = f.metric ? ` (${f.metric})` : '';
      console.error(`    ${f.source} · ${f.path}${metric}`);
      console.error(`      ${f.message}`);
    }
    console.error('');
  }
  console.error('Fix: correct the token document per the DTCG contract + TokenSpec.md.');
  console.error('Exempt an orphan literal: add /* brand-tokens:exempt — reason */ on that line or the line above.');
  return 1;
}

// Guard: only auto-run as a CLI entrypoint, so tests can import the pure
// functions without triggering main() (mirrors sibling's script behavior when
// invoked directly).
if (import.meta.main) {
  main()
    .then(code => process.exit(code))
    .catch(err => {
      console.error('validate-brand-tokens: error:', err?.message || err);
      process.exit(err instanceof CLIError ? err.code : 2);
    });
}
