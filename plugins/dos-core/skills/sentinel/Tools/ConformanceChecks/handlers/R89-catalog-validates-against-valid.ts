/**
 * R89 — Atomic-design catalog `validates_against:` entries that name a Sentinel
 * check-key must reference a key that actually exists in the registry (unless
 * the entry is explicitly marked proposed/not-yet-shipped).
 *
 * The 2026-06-26 self-compliance audit found 8 specs asserting governance by
 * rules that do not exist — `presence.r-rule-handler-exists`,
 * `presence.isc-count-floor`, `presence.frontmatter-required-keys`,
 * `presence.four-copy-aliased`, etc. — several presented as shipped peers of
 * real rules. R59 only checks the `validates_against` KEY is present; this rule
 * checks the VALUES name real (or honestly-proposed) rules.
 *
 * Scope: only entries containing a check-key token (`presence.*`, `ast.*`,
 * `lint.*`, `format.*`, `regex.*`, `seed-array.*`, `workflow-regex.*`) are
 * checked. Plain doctrine references ("Splitting Test (§3.1)", "per-phase output
 * spec in ...") carry no such token and are ignored.
 *
 * Exemption: an entry marked `proposed` / `not yet shipped` / `not shipped` /
 * `queued` is a declared-future rule and is NOT flagged.
 *
 * Pass: every check-key named in validates_against resolves in the registry (or
 *   is exempted).
 * Fail: at least one names a nonexistent, unmarked check-key.
 * Not_applicable: catalog missing / no specs / registry unreadable.
 *
 * Tier: warning (RFC-0085 default for new presence checks).
 *
 * Implementation note: parses the registry as TEXT (mirrors R85) — it does NOT
 * import registry.ts, so registering R89 there cannot create an import cycle.
 */

import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { parse as parseYaml } from "yaml";
import type { CheckContext, CheckResult } from "../types.ts";
import { stripSlashComments } from "../lib/source-presence.ts";
import { listSpecFiles } from "../lib/catalog-layers.ts";

const REQUIREMENT =
  "Every Sentinel check-key named in a catalog `validates_against:` exists in the registry (or is marked proposed)";

// Namespaces MUST cover every registry key namespace — `dlq` and `pai-acl` were
// omitted, so a `validates_against: dlq.cross-tenant-isolation` (a REAL registry
// key) was silently un-validated rather than checked (SENT-12).
// (?<![a-z0-9-]) instead of \b: a plain \b matches AFTER a hyphen, so the
// filename `prd-section-presence.hook.ts` false-matched as phantom key
// "presence.hook.ts" (operator items pass 2026-07-07). Namespaces must start
// at a genuine token boundary, not mid-identifier.
const KEY_TOKEN = /(?<![a-z0-9-])((?:presence|ast|lint|format|regex|seed-array|workflow-regex|dlq|pai-acl)\.[a-z0-9.-]+)/g;
const EXEMPT_RE = /proposed|not yet shipped|not-yet-shipped|not shipped|queued/i;

function registryKeys(repoRoot: string): Set<string> | null {
  const p = join(repoRoot, "Packs/sentinel/src/Tools/ConformanceChecks/registry.ts");
  if (!existsSync(p)) return null;
  let text: string;
  try { text = readFileSync(p, "utf-8"); } catch { return null; }
  // Strip comments (string-literal-aware, shared lib) so a COMMENTED-OUT entry
  // (`// "presence.foo": handler,` — including TRAILING comments after live
  // code) is not counted as a live registry key, and a string containing `/*`
  // (a glob/path) cannot eat live keys. Reuses the SENT-05 stripper instead of
  // a naive regex pair (code-review 2026-07-07).
  text = stripSlashComments(text);
  const keys = new Set<string>();
  const re = /"([a-z][a-z0-9-]*\.[a-z0-9.-]+)"\s*:/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) keys.add(m[1]);
  return keys;
}

function frontmatterObj(content: string): Record<string, unknown> | null {
  const mm = content.match(/^---\n([\s\S]*?)\n---/);
  if (!mm) return null;
  try {
    const p = parseYaml(mm[1], { strict: false, logLevel: "silent" });
    return p && typeof p === "object" && !Array.isArray(p) ? (p as Record<string, unknown>) : null;
  } catch { return null; }
}

export async function r89CatalogValidatesAgainstValid(ctx: CheckContext): Promise<CheckResult> {
  const catalogRoot = join(ctx.repoRoot, "Docs", "AtomicDesign", "artifact-catalog", "source");
  if (!existsSync(catalogRoot)) {
    return { rId: "R89", requirement: REQUIREMENT, status: "not_applicable", evidence: ["catalog directory not found"] };
  }
  const keys = registryKeys(ctx.repoRoot);
  if (!keys || keys.size === 0) {
    return { rId: "R89", requirement: REQUIREMENT, status: "not_applicable", evidence: ["registry.ts unreadable or no keys parsed"] };
  }
  const specs = listSpecFiles(catalogRoot);
  if (specs.length === 0) {
    return { rId: "R89", requirement: REQUIREMENT, status: "not_applicable", evidence: ["no spec files found"] };
  }

  const fails: string[] = [];
  let scanned = 0;
  for (const path of specs) {
    let content: string;
    try { content = readFileSync(path, "utf-8"); } catch { continue; }
    const fm = frontmatterObj(content);
    if (!fm) continue;
    scanned++;
    const va = Array.isArray(fm.validates_against) ? fm.validates_against : [];
    const stem = path.replace(ctx.repoRoot + "/", "");
    for (const entry of va) {
      if (typeof entry !== "string") continue;
      if (EXEMPT_RE.test(entry)) continue;
      const tokens = entry.match(KEY_TOKEN);
      if (!tokens) continue;
      for (const tok of tokens) {
        if (!keys.has(tok)) fails.push(`${stem}: "${tok}" not in registry`);
      }
    }
  }

  if (fails.length === 0) {
    return { rId: "R89", requirement: REQUIREMENT, status: "pass", evidence: [`${scanned} specs; all named check-keys resolve in registry`] };
  }
  return {
    rId: "R89",
    requirement: REQUIREMENT,
    status: "fail",
    evidence: [`${fails.length} phantom check-key reference(s) across ${scanned} specs:`, ...fails.slice(0, 6)],
  };
}
