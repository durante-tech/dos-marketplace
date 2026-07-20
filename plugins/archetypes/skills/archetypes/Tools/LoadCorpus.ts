/**
 * LoadCorpus — the ONE corpus loader shared by ValidateArchetype and
 * RenderArchetype (previously duplicated and already drifted: one guarded
 * malformed default exports, the other silently produced undefined).
 * Not a CLI — a relative-import helper, co-deployed with the tools.
 * Zero external deps by design.
 *
 * Scoped-load isolation (archer gen-9, H12): `loadCorpus(only)` must not
 * hard-fail because an UNRELATED Data/ file is a malformed WIP draft. When
 * `only` is given, files are filtered by the filename↔name convention BEFORE
 * import (fast path), falling back to a full scan when no filename matches
 * (e.g. Media.archetype.ts declares "media-asset-library" — a known,
 * deliberately-unrenamed mismatch). Under `only`, failures in non-requested
 * files become warnings; a FULL load still throws on any malformed file —
 * that invariant is a ratchet and must never be softened.
 */
import { readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Archetype } from '../Schema/Archetype';

const HERE = dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = join(HERE, '..', 'Data');

export interface CorpusWarning {
  file: string;
  message: string;
}

/** "MediaAssetLibrary.archetype.ts" → "media-asset-library" (convention only — may differ from the declared name). */
export function kebabFromFilename(file: string): string {
  return file
    .replace(/\.archetype\.ts$/, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .toLowerCase();
}

/**
 * Load Data/*.archetype.ts modules, guarding against malformed default
 * exports. Optionally filter to one archetype by name; optionally point at a
 * different directory (tests use temp fixtures — never the live Data/);
 * optionally collect non-fatal warnings.
 */
export async function loadCorpus(
  only?: string,
  dir: string = DATA_DIR,
  warnings?: CorpusWarning[],
): Promise<Archetype[]> {
  let files = readdirSync(dir).filter((f) => f.endsWith('.archetype.ts'));
  if (only) {
    const matched = files.filter((f) => kebabFromFilename(f) === only);
    if (matched.length > 0) files = matched;
  }

  const out: Archetype[] = [];
  for (const file of files) {
    const isRequested = !only || kebabFromFilename(file) === only;
    let a: Archetype | undefined;
    try {
      const mod: { default?: Archetype } = await import(join(dir, file));
      // The default ACCESS stays inside the guard: re-importing a module that
      // failed evaluation resolves, but reading its never-initialized default
      // binding throws a raw TDZ error (caught by the gen-9 test battery).
      a = mod.default;
    } catch (err) {
      const message = `${file}: failed to load — ${err instanceof Error ? err.message : String(err)}`;
      if (only && !isRequested) {
        warnings?.push({ file, message });
        continue;
      }
      throw new Error(message);
    }
    if (!a?.name) {
      const message = `${file}: default export is not an Archetype`;
      if (only && !isRequested) {
        warnings?.push({ file, message });
        continue;
      }
      throw new Error(message);
    }
    if (kebabFromFilename(file) !== a.name) {
      warnings?.push({
        file,
        message: `${file}: filename implies "${kebabFromFilename(file)}" but declares name "${a.name}" (--only fast-path misses it; full-scan fallback covers it)`,
      });
    }
    if (!only || a.name === only) out.push(a);
  }
  return out;
}
