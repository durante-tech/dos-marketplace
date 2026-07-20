/**
 * ci-canary — tamper-evident tripwire for DOS CI gate files.
 *
 * Promoted from spike #22 (`spikes/2026-06-02_ci-canary/`, receipt §E #22;
 * tl;dr sec #329 "GitHub Action canaries"). DOS's CI surface is a set of gate
 * files — `.github/workflows/*.yml` (release-readiness, sync-check, drift-check,
 * …). An author who can land a PR can also weaken a gate (turn the secret-scan
 * step into `echo`), append an exfil step, then ride the now-toothless gate to
 * merge. A canary makes that tampering EVIDENT: each protected gate is bound to
 * a blessed sha256 + byte count in `.github/ci-canary.json`; this detector
 * recomputes the hash of every gate and FIRES on any drift, missing file, or
 * byte-length mismatch.
 *
 * Hashing contract: the canary hashes RAW FILE BYTES (gate files are read as a
 * Buffer, never decoded), so a blessed `sha256` matches `shasum -a 256 <file>`
 * exactly — an operator can hand-verify a pin, and a non-UTF8 byte cannot be
 * laundered through a lossy decode. Byte counts are raw `Buffer.length`.
 *
 * EOL dependency: the canary does NOT normalize line endings — a CRLF/LF
 * checkout difference IS a hash difference (by design: CR injection is a tamper
 * vector). The DOS repo pins `*.yml`/`*.json eol=lf` via `.gitattributes`, so it
 * does not false-trip across platforms. A repo REUSING this Tool must do the
 * same (or accept that an autocrlf checkout trips every gate).
 *
 * HONEST SCOPE (v1 — accident-catcher). A pure in-repo hash canary is
 * tamper-EVIDENT, not tamper-PROOF. Known limitations, ALL resolved by the same
 * follow-on (relocate the bless authority OFF the surface the PR author
 * controls — detached signature / cosign keyless OIDC / Environment-secret pins,
 * ranked in the spike findings):
 *   - self-bless: an author who edits a gate can re-bless it in the same PR;
 *   - addition-blindness: a NEWLY ADDED malicious gate file is invisible until
 *     someone blesses it (the canary only checks declared gates);
 *   - gate-set deletion-blindness: silently REMOVING a gate object from the
 *     manifest, then weakening that gate, is invisible (the canary iterates only
 *     the remaining declared gates).
 * Until that follow-on lands this ships as the deterministic accident-catcher
 * (Sentinel R81, warn-only) — the same ladder R80 walked.
 *
 * Style: mirrors the R80 `lint.*` detector — a PURE decision function exported
 * via `__testing__` so the test exercises the REAL logic, plus a thin CLI. The
 * R81 Sentinel handler (`handlers/R81-lint-ci-gate-canary.ts`) imports
 * `verifyCanary` from here — ONE decision function, no duplication.
 */

import { createHash } from "crypto";
import { existsSync, lstatSync, readFileSync, realpathSync, writeFileSync } from "fs";
import { resolve, join, sep } from "path";

// ---------------------------------------------------------------------------
// Types — discriminated verdict (DOS R7 discriminated-union-return convention).
// ---------------------------------------------------------------------------

export interface CanaryGate {
  path: string;
  role?: string;
  sha256: string;
  bytes: number;
}

export interface CanaryManifest {
  $schema?: string;
  blessed_at?: string;
  blessed_by?: string;
  note?: string;
  gates: CanaryGate[];
}

/** One per-gate finding. `intact` gates carry no reason. */
export type GateFinding =
  | { path: string; status: "intact" }
  | { path: string; status: "malformed"; reason: string }
  | { path: string; status: "missing"; reason: string }
  | { path: string; status: "hash-drift"; reason: string; expected: string; actual: string }
  | { path: string; status: "size-drift"; reason: string; expectedBytes: number; actualBytes: number };

export interface CanaryVerdict {
  /** True iff ANY gate is not "intact" — the tripwire fired. */
  tripped: boolean;
  total: number;
  intact: number;
  findings: GateFinding[];
}

/**
 * A gate is read by path → file content (or null if absent). Returns a Buffer
 * for raw-byte fidelity on disk; in-memory test readers may return a string
 * (hashed as UTF-8, identical to bytes for ASCII/valid-UTF8 fixtures).
 * Injectable so the pure function is exercised without disk.
 */
export type GateReader = (path: string) => string | Buffer | null;

// ---------------------------------------------------------------------------
// Pure decision function — the load-bearing logic. Exercised directly by tests.
// ---------------------------------------------------------------------------

/** sha256 of raw bytes (Buffer) or a UTF-8 string. No re-encoding for Buffers. */
export function sha256(content: string | Buffer): string {
  return createHash("sha256").update(content).digest("hex");
}

function byteLen(content: string | Buffer): number {
  return Buffer.isBuffer(content) ? content.length : Buffer.byteLength(content, "utf-8");
}

/**
 * LEXICAL containment check: resolve a manifest-declared gate path INSIDE
 * repoRoot, or null if it escapes via `../` or an absolute path. `repoRootAbs`
 * is re-resolved internally so a trailing slash does not over-reject. This is a
 * fast pre-filter; `safeGatePath` adds symlink-aware (realpath) containment.
 * (QA HIGH, 2026-06-02 — path-containment.)
 */
export function resolveWithin(repoRootAbs: string, rel: string): string | null {
  const root = resolve(repoRootAbs); // strip trailing slash / normalize
  const abs = resolve(root, rel);
  if (abs === root) return abs;
  return abs.startsWith(root + sep) ? abs : null;
}

/**
 * Resolve a gate path to a SAFE absolute path to read, or null if it must trip.
 * Defense layers (a recall-from-CI-runner threat model — QA HIGH/MED 2026-06-02):
 *   1. lexical containment (`resolveWithin`) — rejects `../` / absolute escapes;
 *   2. existence — a missing file trips (deletion is the loudest tamper);
 *   3. LEAF symlink refusal (`lstatSync`) — a gate swapped for a symlink to a
 *      benign hash-matching file must NOT read "intact";
 *   4. realpath containment — resolves ALL symlinked PATH COMPONENTS (e.g. a
 *      `.github` parent dir swapped for a symlink to outside the checkout) and
 *      re-asserts the REAL path is within the REAL repo root. Lexical checks
 *      alone miss a symlinked intermediate component (code-review 2026-06-02).
 */
export function safeGatePath(repoRoot: string, rel: string): string | null {
  const repoRootAbs = resolve(repoRoot);
  const abs = resolveWithin(repoRootAbs, rel);
  if (abs === null || !existsSync(abs)) return null;
  if (lstatSync(abs).isSymbolicLink()) return null; // leaf symlink refused
  let realAbs: string;
  let realRoot: string;
  try {
    realAbs = realpathSync(abs);
    realRoot = realpathSync(repoRootAbs);
  } catch {
    return null; // unresolvable (broken link in the path) → trip
  }
  if (realAbs !== realRoot && !realAbs.startsWith(realRoot + sep)) return null; // symlinked parent escaped
  return abs;
}

/**
 * A disk GateReader built on `safeGatePath` (lexical + leaf-symlink + realpath
 * containment). Returns null (→ verifyCanary treats the gate as missing → TRIPS)
 * on any escape. Reads RAW BYTES so the hash matches `shasum -a 256`.
 */
export function safeRepoReader(repoRoot: string): GateReader {
  return (rel: string) => {
    const abs = safeGatePath(repoRoot, rel);
    return abs === null ? null : readFileSync(abs);
  };
}

/**
 * Verify a canary manifest against the current gate files. PURE: all I/O is
 * delegated to `readGate`, so the test drives the real function with in-memory
 * readers (no disk dependency) AND on-disk fixtures.
 *
 * A gate trips the canary when ANY of:
 *   - the gate entry is malformed (no string `path`/`sha256` — partial manifest)
 *   - the file is missing (deletion is the loudest tamper)
 *   - its sha256 differs from the blessed hash (content edit / exfil injection)
 *   - its byte length differs despite a matching hash. NOTE: a matching hash
 *     already implies byte-identical content, so this branch does NOT catch
 *     tampering — it catches a manifest whose `bytes` field was hand-edited out
 *     of sync with its `sha256` (operator typo / partial bless). Kept as a
 *     cheap manifest-integrity check, not a defense against content edits.
 */
export function verifyCanary(
  manifest: CanaryManifest,
  readGate: GateReader,
): CanaryVerdict {
  const findings: GateFinding[] = [];
  const gates = Array.isArray(manifest?.gates) ? manifest.gates : [];
  const seenPaths = new Set<string>();

  for (const gate of gates) {
    // Guard a malformed gate entry rather than throwing — keeps the pure
    // function (and the warn-only handler that calls it) crash-free on a
    // partially-authored manifest.
    if (!gate || typeof gate.path !== "string" || typeof gate.sha256 !== "string") {
      findings.push({
        path: typeof gate?.path === "string" ? gate.path : "<unknown>",
        status: "malformed",
        reason: "manifest gate entry is missing a string `path` or `sha256`",
      });
      continue;
    }

    // A duplicate path is a manifest authoring error AND a padding/tamper signal:
    // an attacker who deletes a real gate object could pad the manifest with a
    // duplicate of an intact gate so the "N/N intact" count still looks full.
    // Surface it (trips) so total reflects honest coverage. (QA MED, 2026-06-02.)
    if (seenPaths.has(gate.path)) {
      findings.push({
        path: gate.path,
        status: "malformed",
        reason: "duplicate gate path in manifest (padding/tamper signal)",
      });
      continue;
    }
    seenPaths.add(gate.path);

    const content = readGate(gate.path);

    if (content === null) {
      findings.push({
        path: gate.path,
        status: "missing",
        reason: `gate file is absent — a CI gate was deleted (blessed sha256 ${gate.sha256.slice(0, 12)}…)`,
      });
      continue;
    }

    const actualBytes = byteLen(content);
    const actualHash = sha256(content);

    if (actualHash !== gate.sha256) {
      findings.push({
        path: gate.path,
        status: "hash-drift",
        reason: `gate content was modified — blessed ${gate.sha256.slice(0, 12)}… != actual ${actualHash.slice(0, 12)}…`,
        expected: gate.sha256,
        actual: actualHash,
      });
      continue;
    }

    if (typeof gate.bytes === "number" && actualBytes !== gate.bytes) {
      findings.push({
        path: gate.path,
        status: "size-drift",
        reason: `byte length drift despite matching hash — manifest bytes ${gate.bytes} != actual ${actualBytes} (manifest internally inconsistent)`,
        expectedBytes: gate.bytes,
        actualBytes,
      });
      continue;
    }

    findings.push({ path: gate.path, status: "intact" });
  }

  const intact = findings.filter((f) => f.status === "intact").length;
  return {
    tripped: intact !== findings.length,
    total: findings.length,
    intact,
    findings,
  };
}

export const __testing__ = { verifyCanary, sha256 };

// ---------------------------------------------------------------------------
// Thin CLI — wraps the pure function with disk I/O + process.exit. Mirrors the
// R80 handler/CLI split. Usage:
//   bun ci-canary.ts <repoRoot> [--manifest <relpath>] [--json]   # verify
//   bun ci-canary.ts <repoRoot> --rebless [--manifest <relpath>]  # re-pin
// Verify exit codes: 0 = all gates intact, 1 = canary tripped, 2 = manifest error.
// Rebless exit codes:  0 = re-pinned ok, 2 = manifest/read error.
//
// REBLESS is the operator audit-record flow: it re-hashes the paths ALREADY in
// the manifest from disk and writes back fresh sha256+bytes+blessed_at. NEVER
// auto-heal — re-bless only on a reviewed gate change; the bless commit IS the
// audit record. It does not invent paths (it re-pins the declared set), so an
// added malicious workflow stays invisible until an operator adds + blesses it.
// ---------------------------------------------------------------------------

function isMain(): boolean {
  // Bun: import.meta.main. Node: compare import.meta.url to the invoked script.
  const meta = import.meta as { main?: boolean; url?: string };
  if (typeof meta.main === "boolean") return meta.main;
  if (meta.url && typeof process !== "undefined" && process.argv[1]) {
    try {
      return meta.url === new URL(`file://${process.argv[1]}`).href;
    } catch {
      return false;
    }
  }
  return false;
}

/** Parse `<positional> [--manifest <val>] [--rebless] [--json]`, excluding the
 *  --manifest VALUE from positionals (the flag/positional collision fix). */
function parseArgv(argv: string[]): {
  repoRoot: string | null;
  manifestRel: string;
  rebless: boolean;
  json: boolean;
  error?: string;
} {
  let manifestRel = ".github/ci-canary.json";
  let manifestSeen = false;
  const positionals: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--manifest=")) {
      manifestRel = a.slice("--manifest=".length);
      if (manifestRel.length === 0) {
        return { repoRoot: null, manifestRel, rebless: false, json: false, error: "--manifest requires a value" };
      }
      manifestSeen = true;
      continue;
    }
    if (a === "--manifest") {
      const v = argv[i + 1];
      if (v === undefined || v.startsWith("--")) {
        return { repoRoot: null, manifestRel, rebless: false, json: false, error: "--manifest requires a value" };
      }
      manifestRel = v;
      manifestSeen = true;
      i++; // skip the consumed value so it is NOT treated as a positional
      continue;
    }
    if (a === "--rebless" || a === "--json") continue;
    if (a.startsWith("--")) continue; // unknown flag — ignore
    positionals.push(a);
  }
  void manifestSeen;
  return {
    repoRoot: positionals[0] ?? ".",
    manifestRel,
    rebless: argv.includes("--rebless"),
    json: argv.includes("--json"),
  };
}

async function rebless(manifestPath: string, repoRoot: string): Promise<number> {
  if (!existsSync(manifestPath)) {
    console.error(`ci-canary --rebless: manifest not found at ${manifestPath}`);
    return 2;
  }
  let manifest: CanaryManifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, "utf-8")) as CanaryManifest;
  } catch (e) {
    console.error(`ci-canary --rebless: manifest parse error — ${String(e)}`);
    return 2;
  }
  if (!Array.isArray(manifest.gates) || manifest.gates.length === 0) {
    console.error("ci-canary --rebless: manifest has no `gates` array");
    return 2;
  }

  for (const gate of manifest.gates) {
    if (!gate || typeof gate.path !== "string") {
      console.error("ci-canary --rebless: a gate entry has no string `path`");
      return 2;
    }
    // Containment + symlink guard (lexical + leaf + realpath): NEVER re-pin a
    // file outside the checkout, a symlink, or a path through a symlinked parent
    // dir — re-blessing an out-of-repo path would write a foreign file's digest
    // into a committed manifest (hash-exfil). (QA HIGH/MED + code-review, 2026-06-02.)
    const fp = safeGatePath(repoRoot, gate.path);
    if (fp === null) {
      console.error(`ci-canary --rebless: gate path is unsafe (escapes repo / symlink / missing) — ${gate.path}`);
      return 2;
    }
    const content = readFileSync(fp); // raw bytes
    gate.sha256 = sha256(content);
    gate.bytes = content.length;
  }
  manifest.blessed_at = new Date().toISOString();

  // writeArtifact:exempt — canary manifest — internal CI harness state
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
  console.log(`ci-canary --rebless: re-pinned ${manifest.gates.length} gate(s) at ${manifest.blessed_at}`);
  return 0;
}

async function cli(argv: string[]): Promise<number> {
  const parsed = parseArgv(argv);
  if (parsed.error || parsed.repoRoot === null) {
    console.error(`ci-canary: ${parsed.error ?? "missing repoRoot"}`);
    return 2;
  }
  const repoRoot = resolve(parsed.repoRoot);
  const manifestPath = join(repoRoot, parsed.manifestRel);

  if (parsed.rebless) {
    return rebless(manifestPath, repoRoot);
  }

  if (!existsSync(manifestPath)) {
    console.error(`ci-canary: manifest not found at ${manifestPath}`);
    return 2;
  }

  let manifest: CanaryManifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, "utf-8")) as CanaryManifest;
  } catch (e) {
    console.error(`ci-canary: manifest parse error — ${String(e)}`);
    return 2;
  }
  if (!Array.isArray(manifest.gates)) {
    console.error("ci-canary: manifest has no `gates` array");
    return 2;
  }

  const verdict = verifyCanary(manifest, safeRepoReader(repoRoot));

  if (parsed.json) {
    console.log(JSON.stringify(verdict, null, 2));
  } else if (!verdict.tripped) {
    console.log(`ci-canary: OK — ${verdict.intact}/${verdict.total} gate(s) intact`);
  } else {
    console.error(`ci-canary: TRIPPED — ${verdict.total - verdict.intact}/${verdict.total} gate(s) tampered`);
    for (const f of verdict.findings) {
      if (f.status !== "intact") console.error(`  [${f.status}] ${f.path}: ${(f as { reason: string }).reason}`);
    }
  }

  return verdict.tripped ? 1 : 0;
}

if (isMain()) {
  cli(process.argv.slice(2)).then((code) => process.exit(code));
}
