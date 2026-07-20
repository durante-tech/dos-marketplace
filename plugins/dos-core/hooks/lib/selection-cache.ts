/**
 * selection-cache.ts — persisted cache for SELECTION.md routing rules.
 *
 * Loads `~/.claude/DOS/SELECTION.md` plus the `role:`/`accepts:` frontmatter
 * of every SKILL.md into an input-shape → candidates index and a skill
 * registry. The build is expensive: it reads + parses the entire skills tree
 * (200+ files), which is why it must not run on every tool call.
 *
 * Two cache layers:
 *   1. In-process memo (`cached`) — dies with each `bun` process, so it only
 *      helps a single hook that calls loadSelectionCache() more than once.
 *   2. Persisted JSON file under MEMORY/STATE — survives across processes.
 *      SkillRouteGuard runs a fresh process on every WebFetch/Bash/Read/Edit/
 *      MultiEdit, and SelectionCacheWarm runs at SessionStart; with only the
 *      in-process memo, neither could see the other's work, so every guarded
 *      tool call re-walked the tree (D2). The persisted layer closes that gap.
 *
 * Freshness (persisted layer) — two tiers, because the empirical cost model
 * is not what "just cache the parse" assumes. The skills tree is ~1150 dirs /
 * ~3000 files; the dominant cost is the DIRECTORY WALK (readdir traversal),
 * not reading the ~136 SKILL.md bodies (~1.2 MB total). A stat-only sweep
 * still walks, so it cannot beat the walk — and the walk is precisely what
 * balloons under load. So:
 *
 *   Tier 1 (hot path, zero tree syscalls): if the persisted file's SELECTION.md
 *   mtime still matches and it was built within TTL_MS, the payload is served
 *   directly — no readdir, no stat, no read. This is the per-tool-call win and
 *   it is robust under load because it touches only the one small JSON file.
 *
 *   Tier 2 (TTL expiry, runs at most once per TTL window): a `readdir`+`statSync`
 *   manifest sweep of the skills tree. If the SELECTION.md mtime matches and the
 *   manifest is identical (same paths, same mtimes) the payload is revalidated
 *   (builtAt bumped) without re-reading bodies; otherwise a full rebuild runs.
 *   This bounds staleness to TTL_MS and picks up add/remove/edit of any skill.
 *
 * SessionStart (SelectionCacheWarm, forceReload=true) always does a full
 * rebuild + rewrite, so a session opens on a fresh cache. TTL_MS defaults to
 * 60s and is overridable via DOS_SELECTION_CACHE_TTL_MS. mtime (not content
 * hashing) is the change key so Tier 2 never re-reads unchanged bodies.
 *
 * SkillRouteGuard is a log-only observer (Week 1), so a bounded staleness of
 * TTL_MS between a mid-session skill edit and its reflection is harmless.
 *
 * Fail-open: any cache-layer error (unreadable/corrupt persisted file, sweep
 * failure, write failure) falls back to the full-walk build. The cache never
 * breaks a consumer.
 *
 * Consumers: SkillRouteGuard.hook.ts (PreToolUse), SelectionCacheWarm.hook.ts
 * (SessionStart). Other hooks may read via getCachedSelection().
 *
 * Path/TTL overrides (operator/test escape hatches):
 *   DOS_SKILLS_DIR             — skills tree root (default ~/.claude/skills)
 *   DOS_SELECTION_PATH         — SELECTION.md path (default $DOS_DIR/DOS/SELECTION.md)
 *   DOS_SELECTION_CACHE_PATH   — persisted cache file
 *                                (default MEMORY/STATE/selection-cache.json)
 *   DOS_SELECTION_CACHE_TTL_MS — Tier-1 freshness window (default 60000; 0 forces
 *                                the Tier-2 sweep on every read)
 */

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { atomicWriteSync } from "./atomic-write";
import { getMemorySubdir } from "./paths";

export interface SkillEntry {
  name: string;
  path: string;          // directory segment (e.g. "Utilities/Parser")
  role: string;
  accepts: string[];
}

export interface SelectionCache {
  mtimeMs: number;
  /** Map from input-shape token → skill-names that claim it */
  acceptsIndex: Record<string, string[]>;
  /** All skill entries by name (last-segment basis) */
  skills: Record<string, SkillEntry>;
  /** Hand-curated routing rules extracted from SELECTION.md "Routing Rules" section */
  rules: Record<string, { candidates: string[]; rule: string }>;
}

/** Serialized wrapper written to disk. `manifest` is absPath → SKILL.md mtimeMs.
 *  `builtAtMs` is the wall-clock build time gating the Tier-1 TTL fast path. */
interface PersistedCache {
  version: number;
  builtAtMs: number;
  selectionMtimeMs: number;
  manifest: Record<string, number>;
  payload: SelectionCache;
}

const PERSIST_VERSION = 1;
const DEFAULT_TTL_MS = 60_000;

interface Config {
  skillsDir: string;
  selectionPath: string;
  cachePath: string;
  ttlMs: number;
}

/**
 * Resolve paths from env each call so operators (and tests) can redirect the
 * skills tree, SELECTION.md, and cache file without a re-import. Cheap — a few
 * string joins. getMemorySubdir('STATE') is only invoked when the cache-path
 * override is unset (short-circuit), keeping tests off the real ~/.claude tree.
 */
function getConfig(): Config {
  const home = homedir();
  const dosDir = process.env.DOS_DIR || join(home, ".claude");
  const skillsDir = process.env.DOS_SKILLS_DIR || join(home, ".claude", "skills");
  const selectionPath = process.env.DOS_SELECTION_PATH || join(dosDir, "DOS", "SELECTION.md");
  const cachePath =
    process.env.DOS_SELECTION_CACHE_PATH || join(getMemorySubdir("STATE"), "selection-cache.json");
  const ttlRaw = process.env.DOS_SELECTION_CACHE_TTL_MS;
  const ttlParsed = ttlRaw === undefined ? NaN : Number(ttlRaw);
  const ttlMs = Number.isFinite(ttlParsed) && ttlParsed >= 0 ? ttlParsed : DEFAULT_TTL_MS;
  return { skillsDir, selectionPath, cachePath, ttlMs };
}

let cached: SelectionCache | null = null;

function parseSkillFrontmatter(content: string): { role?: string; accepts?: string[]; name?: string } {
  if (!content.startsWith("---\n")) return {};
  const end = content.indexOf("\n---\n", 4);
  if (end === -1) return {};
  const fm = content.slice(4, end);
  const role = fm.match(/^role:\s*(\S+)/m)?.[1];
  const name = fm.match(/^name:\s*(.+)$/m)?.[1]?.trim();
  // accepts: supports BOTH YAML syntaxes. Inline flow (`accepts: [a, b]`) is
  // used by 14/56 skills; block-list (`accepts:\n  - a\n  - b`) is the DOMINANT
  // form at 42/56. Parsing only the inline form silently dropped 75% of skills
  // from the routing index, so SkillRouteGuard's "missed skill" telemetry was
  // built from a quarter of the fleet (H-051).
  const inlineMatch = fm.match(/^accepts:\s*\[(.*)\]/m);
  let accepts: string[] | undefined = inlineMatch
    ? inlineMatch[1].split(",").map((t) => t.trim().replace(/^["']|["']$/g, "")).filter(Boolean)
    : undefined;
  if (!accepts) {
    const blockMatch = fm.match(/^accepts:[ \t]*\r?\n((?:[ \t]+-[ \t]*.+\r?\n?)+)/m);
    if (blockMatch) {
      accepts = blockMatch[1]
        .split(/\r?\n/)
        .map((l) => l.replace(/^[ \t]+-[ \t]*/, "").trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean);
    }
  }
  return { role, accepts, name };
}

function isSkipDir(full: string): boolean {
  return /\/(Templates|Partials|node_modules|backups)$/.test(full);
}

function walkSkillMds(root: string): string[] {
  const out: string[] = [];
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop()!;
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (isSkipDir(full)) continue;
        stack.push(full);
      } else if (entry.isFile() && entry.name === "SKILL.md") {
        out.push(full);
      }
    }
  }
  return out;
}

/**
 * Stat-only sweep of the skills tree — the cheap freshness probe. Walks the
 * directories (readdir) and stats each SKILL.md (no file reads), returning
 * absPath → mtimeMs. Detecting a change is then a map comparison against the
 * manifest the persisted cache was built with.
 */
function sweepSkillManifest(root: string): Record<string, number> {
  const manifest: Record<string, number> = {};
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop()!;
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (isSkipDir(full)) continue;
        stack.push(full);
      } else if (entry.isFile() && entry.name === "SKILL.md") {
        try {
          manifest[full] = statSync(full).mtimeMs;
        } catch {
          /* vanished mid-sweep — omit; a mismatch just forces a rebuild */
        }
      }
    }
  }
  return manifest;
}

function manifestsMatch(a: Record<string, number>, b: Record<string, number>): boolean {
  const ak = Object.keys(a);
  if (ak.length !== Object.keys(b).length) return false;
  for (const k of ak) {
    if (b[k] !== a[k]) return false;
  }
  return true;
}

function relativeSkillPath(absPath: string, skillsDir: string): string {
  // ~/.claude/skills/utilities/Parser/SKILL.md → "Utilities/Parser"
  const rel = absPath.replace(`${skillsDir}/`, "");
  return rel.replace(/\/SKILL\.md$/, "");
}

function parseRoutingRules(selectionContent: string): SelectionCache["rules"] {
  const rules: SelectionCache["rules"] = {};
  const section = selectionContent.split("## Routing Rules")[1];
  if (!section) return rules;
  const ruleBlocks = section.split(/^### /m).slice(1);
  for (const block of ruleBlocks) {
    const lines = block.split("\n");
    const shape = lines[0].trim();
    const candidatesLine = lines.find((l) => l.trim().startsWith("- **Candidates:**"));
    const ruleLine = lines.find((l) => l.trim().startsWith("- **Rule:**"));
    if (!candidatesLine) continue;
    const candidates = [...candidatesLine.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
    const ruleText = ruleLine?.replace(/^.*\*\*Rule:\*\*\s*/, "").trim() ?? "";
    rules[shape] = { candidates, rule: ruleText };
  }
  return rules;
}

/**
 * Full rebuild — the expensive path. One walk of the skills tree that produces
 * BOTH the payload (reads + parses each SKILL.md) and the manifest (stats each
 * SKILL.md) so the freshness key it writes is exactly what a later sweep
 * compares against.
 */
function buildCache(cfg: Config, selectionMtimeMs: number): { payload: SelectionCache; manifest: Record<string, number> } {
  const skills: Record<string, SkillEntry> = {};
  const acceptsIndex: Record<string, string[]> = {};
  const manifest: Record<string, number> = {};

  for (const skillMd of walkSkillMds(cfg.skillsDir)) {
    // Record every SKILL.md in the manifest — even ones without role/accepts —
    // so that editing one to ADD frontmatter (mtime bump) is detected too.
    try {
      manifest[skillMd] = statSync(skillMd).mtimeMs;
    } catch {
      /* skip: unreadable stat just means this file won't gate freshness */
    }
    const content = (() => {
      try { return readFileSync(skillMd, "utf-8"); } catch { return ""; }
    })();
    const fm = parseSkillFrontmatter(content);
    if (!fm.role || !fm.accepts) continue;
    const path = relativeSkillPath(skillMd, cfg.skillsDir);
    const segments = path.split("/");
    const name = segments[segments.length - 1];
    const entry: SkillEntry = { name, path, role: fm.role, accepts: fm.accepts };
    skills[path] = entry;
    for (const shape of fm.accepts) {
      // 'none' is NOT an input shape — a skill declaring `accepts: none` is saying it
      // has no input-shape trigger (it is invoked by USE-WHEN semantic matching, not by
      // input classification). Indexing 'none' as a real shape made classifyInputShape's
      // "none" fallback (returned for EVERY Bash tool call) match every accepts:none skill,
      // so every bash command produced a false routing tie among skills that accept nothing
      // — 3,227 spurious AudioEditor|Cloudflare "unresolved-tie" telemetry rows, ~40% of all
      // ambiguous events, drowning the real "missed-skill" signal. (Forge H-120.)
      if (!shape || shape === "none") continue;
      (acceptsIndex[shape] ||= []).push(path);
    }
  }

  const selectionContent = (() => {
    try { return readFileSync(cfg.selectionPath, "utf-8"); } catch { return ""; }
  })();
  const rules = parseRoutingRules(selectionContent);

  return { payload: { mtimeMs: selectionMtimeMs, acceptsIndex, skills, rules }, manifest };
}

/** Read + validate the persisted cache. Any defect (missing, corrupt JSON,
 *  wrong version, wrong shape) returns null so the caller rebuilds. */
function readPersisted(cachePath: string): PersistedCache | null {
  let raw: string;
  try {
    raw = readFileSync(cachePath, "utf-8");
  } catch {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const p = parsed as Partial<PersistedCache>;
  if (p.version !== PERSIST_VERSION) return null;
  if (typeof p.builtAtMs !== "number") return null;
  if (typeof p.selectionMtimeMs !== "number") return null;
  if (!p.manifest || typeof p.manifest !== "object") return null;
  const payload = p.payload;
  if (
    !payload ||
    typeof payload !== "object" ||
    typeof payload.mtimeMs !== "number" ||
    !payload.acceptsIndex ||
    !payload.skills ||
    !payload.rules
  ) {
    return null;
  }
  return p as PersistedCache;
}

function writePersisted(cachePath: string, data: PersistedCache): void {
  // atomicWriteSync is silent-fail (temp-file → fsync → rename); a failed disk
  // write leaves the in-memory result intact — fail-open.
  atomicWriteSync(cachePath, JSON.stringify(data));
}

export function loadSelectionCache(forceReload = false): SelectionCache {
  const cfg = getConfig();

  const empty: SelectionCache = { mtimeMs: 0, acceptsIndex: {}, skills: {}, rules: {} };

  if (!existsSync(cfg.selectionPath)) {
    return cached ?? empty;
  }

  let selectionMtimeMs: number;
  try {
    selectionMtimeMs = statSync(cfg.selectionPath).mtimeMs;
  } catch {
    return cached ?? empty;
  }

  // In-process memo (fastest path within a single hook process).
  if (!forceReload && cached && cached.mtimeMs === selectionMtimeMs) {
    return cached;
  }

  // Persisted layers (skipped entirely on forceReload — warm always rebuilds).
  if (!forceReload) {
    try {
      const persisted = readPersisted(cfg.cachePath);
      if (persisted && persisted.selectionMtimeMs === selectionMtimeMs) {
        // Tier 1: TTL fast path — zero tree syscalls.
        if (Date.now() - persisted.builtAtMs < cfg.ttlMs) {
          cached = persisted.payload;
          return cached;
        }
        // Tier 2: TTL expired — one stat-only sweep to detect real changes.
        if (manifestsMatch(persisted.manifest, sweepSkillManifest(cfg.skillsDir))) {
          cached = persisted.payload;
          // Unchanged: revalidate the freshness window without re-reading bodies.
          try {
            writePersisted(cfg.cachePath, { ...persisted, builtAtMs: Date.now() });
          } catch {
            // Non-fatal: payload is still correct; the next reader just re-sweeps.
          }
          return cached;
        }
        // Manifest changed → fall through to full rebuild.
      }
    } catch {
      // Fail-open: fall through to the full rebuild below.
    }
  }

  // Cold path: full walk + read + parse, then persist for the next process.
  const { payload, manifest } = buildCache(cfg, selectionMtimeMs);
  cached = payload;
  try {
    writePersisted(cfg.cachePath, {
      version: PERSIST_VERSION,
      builtAtMs: Date.now(),
      selectionMtimeMs,
      manifest,
      payload,
    });
  } catch {
    // Fail-open: cache still returned from memory even if the disk write failed.
  }
  return cached;
}

export function getCachedSelection(): SelectionCache | null {
  return cached;
}

/**
 * Test-only seam: clear the in-process memo so the next loadSelectionCache()
 * exercises the persisted layer as a fresh process would. No effect on the
 * persisted file. Not used in production paths.
 */
export function resetSelectionMemo(): void {
  cached = null;
}

/**
 * Classify a raw tool-input string into one of the `accepts:` enum tokens.
 * Returns "text" as the safe fallback.
 */
export function classifyInputShape(tool: string, input: Record<string, unknown>): string {
  const str = (input.url as string) ?? (input.path as string) ?? (input.file_path as string) ?? (input.command as string) ?? "";
  if (/(?:https?:\/\/)?(?:www\.)?(youtube\.com|youtu\.be)/.test(str)) return "youtube_url";
  if (/^https?:\/\//.test(str)) return "url";
  if (/\.pdf$/i.test(str)) return "file:pdf";
  if (/\.docx$/i.test(str)) return "file:docx";
  if (/\.xlsx$/i.test(str)) return "file:xlsx";
  if (/\.pptx$/i.test(str)) return "file:pptx";
  if (/\.md$/i.test(str)) return "file:md";
  if (/\.txt$/i.test(str)) return "file:txt";
  if (/\.jsonl?$/i.test(str)) return "file:jsonl";
  if (/^\//.test(str) && !/\./.test(str.split("/").pop() ?? "")) return "repo_path";
  if (tool === "Bash") return "none";
  return "text";
}
