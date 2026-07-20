/**
 * R87 — Atomic-design catalog `composes:` entries must be well-formed and
 * resolve to a catalogued spec id.
 *
 * Convention (blessed 2026-06-26, _spec-template.md §"composes convention"):
 * a composes entry is `<id> (<layer>) [× N] [— note]`. The leading token is the
 * referenced spec id; the parenthetical layer + count + em-dash note are
 * annotation. This rule parses the leading id, then:
 *   - MALFORMED: the entry did not parse to a string (the classic failure is an
 *     unquoted `: ` inside the value, which YAML silently turns into a nested
 *     object — e.g. `isc-entry`'s `frontmatter-field (atom) — \`progress: M/N\``),
 *     or the leading token is not a clean kebab/snake id.
 *   - DANGLING: the parsed id is not present anywhere in the catalog AND the
 *     entry is not explicitly marked as a known-future reference.
 *
 * Honest-future exemption: an entry whose annotation contains `proposed`,
 * `not yet catalogued`, `candidate`, `not yet a separate`, or `pattern)` is a
 * deliberately-declared forward reference and is NOT flagged — the catalog is
 * allowed to name an atom it has not authored yet, as long as it says so.
 *
 * Pass: every composes entry is well-formed and resolves (or is exempted).
 * Fail: at least one malformed or unexempted-dangling entry.
 * Not_applicable: catalog missing / no specs.
 *
 * Tier: warning (RFC-0085 default for new presence checks).
 *
 * Origin: 2026-06-26 catalog self-compliance audit — 26 dangling composes +
 * 1 YAML-object corruption found, none caught by R59 (presence-only).
 */

import { existsSync, readFileSync } from "fs";
import { join, basename } from "path";
import { parse as parseYaml } from "yaml";
import type { CheckContext, CheckResult } from "../types.ts";
import { listSpecFiles } from "../lib/catalog-layers.ts";

const REQUIREMENT =
  "Every atomic-design catalog `composes:` entry is well-formed and resolves to a catalogued spec id (or is explicitly marked proposed/uncatalogued)";

const EXEMPT_RE = /proposed|not yet catalogued|candidate|not yet a separate|pattern\)/i;

function frontmatterObj(content: string): Record<string, unknown> | null {
  const m = content.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return null;
  try {
    const p = parseYaml(m[1], { strict: false, logLevel: "silent" });
    return p && typeof p === "object" && !Array.isArray(p) ? (p as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

type Norm = { kind: "ok" | "malformed"; id?: string };
function normalizeComposes(raw: unknown): Norm | null {
  if (raw == null) return null;
  if (typeof raw !== "string") return { kind: "malformed" }; // YAML object / non-string
  const s = raw.trim();
  if (!s || s.toLowerCase() === "null") return null;
  let core = s.split(/\s+\(|\s+—|\s+-\s|\s+×/)[0].trim();
  core = core.replace(/[)"'`]+$/g, "").trim();
  core = basename(core).replace(/\.md$/, "");
  if (!core || /[\s,{}\[\]A-Z]/.test(core) || /^\d/.test(core) || core.includes(".")) {
    return { kind: "malformed" };
  }
  return { kind: "ok", id: core };
}

export async function r87CatalogComposesResolves(ctx: CheckContext): Promise<CheckResult> {
  const catalogRoot = join(ctx.repoRoot, "Docs", "AtomicDesign", "artifact-catalog", "source");
  if (!existsSync(catalogRoot)) {
    return { rId: "R87", requirement: REQUIREMENT, status: "not_applicable", evidence: ["catalog directory not found"] };
  }
  const specs = listSpecFiles(catalogRoot);
  if (specs.length === 0) {
    return { rId: "R87", requirement: REQUIREMENT, status: "not_applicable", evidence: ["no spec files found"] };
  }

  // build the corpus id set first (frontmatter id, else filename stem)
  const parsed: Array<{ stem: string; fm: Record<string, unknown> | null }> = [];
  const idSet = new Set<string>();
  for (const path of specs) {
    let content: string;
    try { content = readFileSync(path, "utf-8"); } catch { continue; }
    const fm = frontmatterObj(content);
    const stem = basename(path).replace(/\.md$/, "");
    parsed.push({ stem, fm });
    idSet.add(fm?.id != null ? String(fm.id) : stem);
  }

  const malformed: string[] = [];
  const dangling: string[] = [];
  let scanned = 0;
  for (const { stem, fm } of parsed) {
    if (!fm) continue;
    scanned++;
    const composes = Array.isArray(fm.composes) ? fm.composes : [];
    for (const entry of composes) {
      const n = normalizeComposes(entry);
      if (!n) continue;
      if (n.kind === "malformed") {
        malformed.push(`${stem}: ${typeof entry === "string" ? entry : JSON.stringify(entry)}`);
        continue;
      }
      if (!idSet.has(n.id!)) {
        const rawStr = typeof entry === "string" ? entry : "";
        if (EXEMPT_RE.test(rawStr)) continue; // honestly-declared future ref
        dangling.push(`${stem} -> ${n.id}`);
      }
    }
  }

  const total = malformed.length + dangling.length;
  if (total === 0) {
    return { rId: "R87", requirement: REQUIREMENT, status: "pass", evidence: [`${scanned} specs; all composes entries well-formed and resolved`] };
  }
  const ev: string[] = [`${total} composes problem(s) across ${scanned} specs:`];
  if (malformed.length) ev.push(`malformed (${malformed.length}): ${malformed.slice(0, 3).join("; ")}`);
  if (dangling.length) ev.push(`dangling (${dangling.length}): ${dangling.slice(0, 5).join("; ")}`);
  return { rId: "R87", requirement: REQUIREMENT, status: "fail", evidence: ev };
}
