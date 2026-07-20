/**
 * profile-loader — extracts the machine-readable conformance manifest from
 * an RFC markdown file and validates it against SUPPORTED_SCHEMA_VERSION.
 *
 * The manifest is an HTML-comment-tagged YAML island:
 *
 *   <!-- conformance-machine-readable -->
 *   ```yaml
 *   schema_version: 1
 *   ...
 *   ```
 *   <!-- /conformance-machine-readable -->
 *
 * Prose drift outside the island does NOT affect parsing. Drift inside
 * the island is caught by schema_version validation.
 */

import { readFileSync } from "fs";
import { parse as parseYaml } from "yaml";
import {
  SUPPORTED_SCHEMA_VERSION,
  type ConformanceManifest,
  type Profile,
} from "./types.ts";

const ISLAND_OPEN = "<!-- conformance-machine-readable -->";
const ISLAND_CLOSE = "<!-- /conformance-machine-readable -->";
// Require the tag to sit at line-start so prose that MENTIONS the tag
// (inside inline-code backticks in explanatory text) is not mistaken
// for the island itself. Without this, indexOf() matches the first
// occurrence which is typically the "see tags X through Y" sentence.
const OPEN_RE = /^<!-- conformance-machine-readable -->$/m;
const CLOSE_RE = /^<!-- \/conformance-machine-readable -->$/m;

export class ManifestParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ManifestParseError";
  }
}

function extractIsland(md: string): string {
  const openMatch = OPEN_RE.exec(md);
  if (!openMatch) {
    throw new ManifestParseError(
      `conformance island not found — missing line-anchored ${ISLAND_OPEN}`,
    );
  }
  const after = md.slice(openMatch.index + openMatch[0].length);
  const closeMatch = CLOSE_RE.exec(after);
  if (!closeMatch) {
    throw new ManifestParseError(
      `conformance island not closed — missing line-anchored ${ISLAND_CLOSE}`,
    );
  }
  const inner = after.slice(0, closeMatch.index);
  const fenceOpen = inner.indexOf("```yaml");
  if (fenceOpen === -1) {
    throw new ManifestParseError("conformance island missing ```yaml fence");
  }
  const bodyStart = inner.indexOf("\n", fenceOpen) + 1;
  const fenceClose = inner.indexOf("```", bodyStart);
  if (fenceClose === -1) {
    throw new ManifestParseError("conformance island yaml fence not closed");
  }
  return inner.slice(bodyStart, fenceClose).trim();
}

function validateManifest(raw: unknown): ConformanceManifest {
  if (raw === null || typeof raw !== "object") {
    throw new ManifestParseError("manifest is not an object");
  }
  const m = raw as Record<string, unknown>;
  if (m.schema_version !== SUPPORTED_SCHEMA_VERSION) {
    throw new ManifestParseError(
      `schema_version mismatch: got ${m.schema_version}, supported ${SUPPORTED_SCHEMA_VERSION}`,
    );
  }
  if (typeof m.rfc !== "string" || typeof m.rfc_title !== "string") {
    throw new ManifestParseError("manifest missing rfc / rfc_title");
  }
  if (typeof m.profiles !== "object" || m.profiles === null) {
    throw new ManifestParseError("manifest.profiles is not an object");
  }
  const profiles = m.profiles as Record<string, unknown>;
  for (const [name, p] of Object.entries(profiles)) {
    if (typeof p !== "object" || p === null) {
      throw new ManifestParseError(`profile ${name} is not an object`);
    }
    const pp = p as Record<string, unknown>;
    if (typeof pp.section !== "string") {
      throw new ManifestParseError(`profile ${name} missing section`);
    }
    if (!Array.isArray(pp.requirements)) {
      throw new ManifestParseError(`profile ${name} missing requirements[]`);
    }
    for (const r of pp.requirements as unknown[]) {
      if (typeof r !== "object" || r === null) {
        throw new ManifestParseError(`profile ${name} has non-object requirement`);
      }
      const rr = r as Record<string, unknown>;
      if (typeof rr.id !== "string" || typeof rr.text !== "string" || typeof rr.check !== "string") {
        throw new ManifestParseError(
          `profile ${name} requirement missing id/text/check`,
        );
      }
    }
  }
  return raw as ConformanceManifest;
}

export function loadManifest(rfcPath: string): ConformanceManifest {
  const md = readFileSync(rfcPath, "utf-8");
  const yamlText = extractIsland(md);
  let parsed: unknown;
  try {
    parsed = parseYaml(yamlText);
  } catch (err) {
    throw new ManifestParseError(
      `yaml parse failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  return validateManifest(parsed);
}

export function profileByName(
  manifest: ConformanceManifest,
  name: string,
): Profile {
  const p = manifest.profiles[name];
  if (!p) {
    throw new ManifestParseError(
      `unknown profile '${name}'; available: ${Object.keys(manifest.profiles).join(", ")}`,
    );
  }
  return { ...p, name };
}
