/**
 * catalog-layers — dynamic discovery of atomic-design catalog layers.
 *
 * Spec: RFC-0098 §15.1 CODE-BS-3 (Cato cross-vendor audit 2026-05-14)
 * Sprint: v0.0.18 / A10 (PRD slug `20260525-143318_a10-layers-dynamic-discovery`)
 *
 * Why this seam exists:
 * --------------------
 * R59 (frontmatter completeness), R60 (body sections), and R61 (spec ↔
 * instance field parity) each used to declare:
 *   const LAYERS = ["atoms", "molecules", "organisms", "templates", "pages"];
 * plus an identical `listSpecFiles(catalogRoot)` helper. Cato CODE-BS-3
 * flagged this as scope-bias — adding a new layer to the catalog
 * (`Docs/AtomicDesign/artifact-catalog/source/`) silently underscanned all
 * three handlers until someone remembered to bump three constants.
 *
 * `getLayers()` reads the catalog directory at handler-init time and returns
 * the alphabetically-sorted list of layer subdirs. New layer dirs are picked
 * up automatically.
 *
 * Fallback contract:
 * ------------------
 * If the catalog root is missing OR `readdirSync` throws OR zero qualifying
 * subdirs are discovered, `getLayers()` returns the legacy frozen list and
 * emits a single `console.warn` to stderr. Handlers MUST NOT crash — the
 * conformance check should degrade gracefully (the catalog-missing case is
 * `not_applicable` at the handler level, not a runtime failure here).
 *
 * Discovery filter:
 * -----------------
 *   - directory entries only (files ignored)
 *   - skip hidden entries (any name starting with `.`, e.g. `.DS_Store`,
 *     `.git`, `.tmp`)
 *   - skip underscore-prefixed entries (consistency with the file-level `_*`
 *     spec-template exclusion already enforced by `listSpecFiles`)
 *   - sort alphabetically for deterministic verdict ordering
 */

import { existsSync, readdirSync, type Dirent } from "fs";
import { join } from "path";

/**
 * Legacy fallback list. Matches the catalog as of 2026-05-14 (RFC-0098
 * ratification). Used when `getLayers()` cannot read the catalog root.
 * Frozen to keep behaviour stable in the degraded path.
 */
export const LEGACY_LAYERS: ReadonlyArray<string> = Object.freeze([
  "atoms",
  "molecules",
  "organisms",
  "templates",
  "pages",
]);

/**
 * Meta files excluded from every layer. Preserved verbatim from the original
 * inline list in R59/R60/R61 to keep the spec-file enumeration byte-stable.
 */
const META_FILES: ReadonlyArray<string> = Object.freeze([
  "INDEX.md",
  "README.md",
  "FINDINGS.md",
  "GRAPH.md",
]);

/**
 * Discover catalog layers from the filesystem.
 *
 * @param catalogRoot Absolute path to `Docs/AtomicDesign/artifact-catalog/source`.
 * @returns Alphabetically-sorted layer names (e.g. ["atoms", "molecules",
 *   "organisms", "pages", "templates"]). Falls back to `LEGACY_LAYERS` if the
 *   catalog root is unreachable or yields zero qualifying subdirs; emits one
 *   `console.warn` to stderr in that case.
 */
export function getLayers(catalogRoot: string): string[] {
  if (!existsSync(catalogRoot)) {
    console.warn(
      `[catalog-layers] catalog root not found at ${catalogRoot}; using LEGACY_LAYERS fallback`,
    );
    return [...LEGACY_LAYERS];
  }

  let entries: Dirent[];
  try {
    entries = readdirSync(catalogRoot, { withFileTypes: true });
  } catch (err) {
    console.warn(
      `[catalog-layers] failed to read ${catalogRoot} (${(err as Error).message}); using LEGACY_LAYERS fallback`,
    );
    return [...LEGACY_LAYERS];
  }

  const layers = entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .filter((name) => !name.startsWith(".") && !name.startsWith("_"))
    .sort();

  if (layers.length === 0) {
    console.warn(
      `[catalog-layers] no layer subdirs discovered at ${catalogRoot}; using LEGACY_LAYERS fallback`,
    );
    return [...LEGACY_LAYERS];
  }

  return layers;
}

/**
 * Enumerate spec files across all discovered catalog layers.
 *
 * @param catalogRoot Absolute path to `Docs/AtomicDesign/artifact-catalog/source`.
 * @returns Absolute paths to every `*.md` spec file under each layer,
 *   excluding `_*`-prefixed (e.g. `_spec-template.md`) and the four meta files
 *   (`INDEX.md`, `README.md`, `FINDINGS.md`, `GRAPH.md`). Returns `[]` if no
 *   layers are reachable.
 */
export function listSpecFiles(catalogRoot: string): string[] {
  const out: string[] = [];
  for (const layer of getLayers(catalogRoot)) {
    const dir = join(catalogRoot, layer);
    if (!existsSync(dir)) continue;
    try {
      for (const file of readdirSync(dir)) {
        if (!file.endsWith(".md")) continue;
        if (file.startsWith("_") || META_FILES.includes(file)) continue;
        out.push(join(dir, file));
      }
    } catch {
      // Layer dir vanished mid-scan — degrade silently; the missing layer
      // simply contributes zero specs to the enumeration.
    }
  }
  return out;
}
