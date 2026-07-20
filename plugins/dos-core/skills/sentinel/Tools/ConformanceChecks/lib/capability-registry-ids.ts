/**
 * capability-registry-ids — fail-open adapter that loads the live RFC-0026
 * capability-registry id set, for R82's §10.6 unknown-capability-id check.
 *
 * WHY (SENT-08): R82 flags `## Catalog Match` dispositions whose id is not a
 * live registry capability, gated on `ctx.catalogRegistryIds`. But NO
 * production CheckContext builder ever populated that field, so the set was
 * always empty and `flagUnknownIds` degraded to a no-op — the §10.6 sub-check
 * was dead in production. The production ctx builders (ValidateRfcConformance,
 * sentinel-baseline) call this loader so the check runs for real.
 *
 * The registry is the orchestrator's `loadCapabilityRegistry(dosDir, stateDir)`
 * — the same seam capability-select.ts uses (Tools/capability-select.ts:221).
 * It lives in the installed DOS tree (DOS_DIR || ~/.claude), which may be absent
 * in a bare worktree / CI clone; the loader is FAIL-OPEN — any failure returns
 * an empty Set, which makes R82 degrade to its prior behavior (skip §10.6)
 * rather than false-fail. R82 is an advisory (work-corpus) check, so reading
 * install-tree state here does not affect the gating tripwire.
 */

/**
 * Load the live RFC-0026 capability id set. Returns an empty Set if the
 * orchestrator registry is unavailable (worktree / CI / missing install).
 */
export async function loadCatalogRegistryIds(): Promise<ReadonlySet<string>> {
  try {
    const { homedir } = await import("node:os");
    const { join } = await import("node:path");
    const dosDir = process.env.DOS_DIR || join(homedir(), ".claude");
    const stateDir = process.env.DOS_ORCH_STATE_DIR;
    // dynamic import keeps this importable without the submodule present.
    const mod: any = await import(join(dosDir, "DOS", "Tools", "orchestrator", "index.ts"));
    const registry = mod.loadCapabilityRegistry(dosDir, stateDir);
    const ids = new Set<string>();
    for (const e of registry?.entries ?? []) {
      if (e && typeof e.id === "string" && e.id.length > 0) ids.add(e.id);
    }
    return ids;
  } catch {
    return new Set<string>(); // fail-open: registry unavailable → degrade, don't false-fail
  }
}
