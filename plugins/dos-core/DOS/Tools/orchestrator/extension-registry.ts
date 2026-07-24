/**
 * RFC-0001 orchestration runtime — extension manifest discovery + registry.
 *
 * Extracted from index.ts per the G6 (Long-Class) refactor iter 7. Owns:
 *   - discovering extension.{json,yaml} manifests across configured roots
 *   - parsing manifests (JSON inline; YAML via dynamic import)
 *   - validating manifest schema, namespace conventions, collision rules
 *   - building a queryable ExtensionRegistry from validated manifests
 *   - rendering the human-readable extension contract block for prompts
 *
 * Async because manifest parsing dynamically imports `yaml`. Side-effecting
 * because of filesystem walking + process.env reading; both are confined to
 * loadExtensionRegistry's call boundary.
 */

import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join } from "node:path";

import {
  type Diagnostic,
  type ExtensionContribution,
  type ExtensionRegistry,
} from "./types";
import { walkFiles } from "./capability-registry";

export function extensionContractBlock(registry?: ExtensionRegistry): string {
  if (!registry) return "Extension registry: not loaded";
  const counts = new Map<ExtensionContribution["surface"], number>();
  for (const contribution of registry.contributions) {
    counts.set(contribution.surface, (counts.get(contribution.surface) ?? 0) + 1);
  }
  const summary = [...counts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([surface, count]) => `${surface}=${count}`)
    .join(", ");
  const phaseContributions = registry.getBySurface("phase").map((c) => c.id).slice(0, 8);
  const handlerContributions = registry.getBySurface("handler").map((c) => c.id).slice(0, 8);
  const errorCount = registry.diagnostics.filter((d) => d.severity === "error").length;
  const warnCount = registry.diagnostics.filter((d) => d.severity === "warn").length;
  return [
    `Extension registry: ${registry.manifestCount ?? 0} manifests, ${registry.contributions.length} contributions${summary ? ` (${summary})` : ""}`,
    phaseContributions.length > 0
      ? `Extension phases declared but not auto-inserted in RFC-0002 Phase 1: ${phaseContributions.join(", ")}`
      : `Extension phases declared but not auto-inserted in RFC-0002 Phase 1: none`,
    handlerContributions.length > 0
      ? `Extension handlers declared: ${handlerContributions.join(", ")}`
      : `Extension handlers declared: none`,
    `Extension diagnostics: ${errorCount} error, ${warnCount} warn`,
  ].join("\n");
}

export function createExtensionRegistry(loadResult: {
  manifests: Array<{ extensionId: string; manifest: Record<string, unknown>; path?: string }>;
  diagnostics?: Array<{ severity?: string; rule?: string; message: string; path?: string }>;
}): ExtensionRegistry {
  const contributions: ExtensionContribution[] = [];
  const diagnostics: Diagnostic[] = (loadResult.diagnostics ?? []).map((d) => ({
    code: `extension:${d.rule ?? "diagnostic"}`,
    severity: d.severity === "error" ? "error" : "warn",
    message: d.path ? `${d.path}: ${d.message}` : d.message,
  }));
  const surfaces: ExtensionContribution["surface"][] = [
    "phase",
    "gate",
    "tool_gate_level",
    "handler",
    "criterion_type",
    "slot_type",
    "effort_level",
    "model_routing_strategy",
  ];

  for (const lm of loadResult.manifests) {
    const contributes = lm.manifest.contributes;
    if (typeof contributes !== "object" || contributes === null) continue;
    const c = contributes as Record<string, unknown>;
    for (const surface of surfaces) {
      const items = c[surface];
      if (!Array.isArray(items)) continue;
      for (const item of items) {
        if (typeof item !== "object" || item === null) continue;
        const raw = item as Record<string, unknown>;
        const id = typeof raw.id === "string" ? raw.id : "";
        if (!id) continue;
        if ((surface === "phase" || surface === "effort_level" || surface === "tool_gate_level") && !id.includes("/")) {
          diagnostics.push({
            code: "extension:canonical_surface_non_overridable",
            severity: "error",
            message: `extension '${lm.extensionId}' attempted to register non-namespaced ${surface} '${id}'`,
          });
          continue;
        }
        contributions.push({ surface, id, extensionId: lm.extensionId, path: lm.path, raw });
      }
    }
  }

  return {
    contributions,
    diagnostics,
    manifestCount: loadResult.manifests.length,
    getBySurface(surface) {
      return contributions.filter((c) => c.surface === surface);
    },
  };
}

export interface LoadExtensionRegistryOptions {
  roots?: string[];
  severity?: "warn" | "error";
}

function defaultExtensionRoots(): string[] {
  const explicit = process.env.DOS_EXTENSION_ROOTS;
  if (explicit) return explicit.split(":").map((p) => p.trim()).filter(Boolean);
  const dosDir = process.env.DOS_DIR ?? join(homedir(), ".claude");
  return [join(dosDir, "Packs"), join(dosDir, "skills")];
}

async function parseExtensionManifest(path: string): Promise<Record<string, unknown>> {
  const raw = readFileSync(path, "utf8");
  if (path.endsWith(".json")) return JSON.parse(raw) as Record<string, unknown>;
  const { parse } = await import("yaml");
  const parsed = parse(raw);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new Error("manifest must be an object");
  return parsed as Record<string, unknown>;
}

function extensionManifestPaths(roots: string[]): string[] {
  const seen = new Set<string>();
  const paths: string[] = [];
  for (const root of roots) {
    for (const path of walkFiles(root, (p) => basename(p) === "extension.yaml" || basename(p) === "extension.json")) {
      if (seen.has(path)) continue;
      seen.add(path);
      paths.push(path);
    }
  }
  return paths.sort();
}

function extensionLoadDiagnostics(
  manifests: Array<{ extensionId: string; manifest: Record<string, unknown>; path?: string }>,
  severity: "warn" | "error",
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const seen = new Map<string, { extensionId: string; path?: string }>();
  const surfaces: ExtensionContribution["surface"][] = [
    "phase",
    "gate",
    "tool_gate_level",
    "handler",
    "criterion_type",
    "slot_type",
    "effort_level",
    "model_routing_strategy",
  ];

  for (const lm of manifests) {
    const vendor = lm.extensionId.includes("/") ? lm.extensionId.split("/")[0] : "";
    const contributes = lm.manifest.contributes;
    if (typeof contributes !== "object" || contributes === null) {
      diagnostics.push({
        code: "extension:schema",
        severity,
        message: `${lm.path ?? lm.extensionId}: missing contributes object`,
      });
      continue;
    }
    for (const surface of surfaces) {
      const items = (contributes as Record<string, unknown>)[surface];
      if (items === undefined) continue;
      if (!Array.isArray(items)) {
        diagnostics.push({ code: "extension:schema", severity, message: `${lm.path ?? lm.extensionId}: contributes.${surface} must be an array` });
        continue;
      }
      for (const item of items) {
        if (typeof item !== "object" || item === null) continue;
        const raw = item as Record<string, unknown>;
        const id = typeof raw.id === "string" ? raw.id : "";
        if (!id) continue;
        if (vendor && !id.startsWith(`${vendor}/`)) {
          diagnostics.push({ code: "extension:namespace", severity, message: `${lm.path ?? lm.extensionId}: ${surface} id '${id}' must begin with '${vendor}/'` });
        }
        const key = `${surface}:${id}`;
        const prior = seen.get(key);
        if (!prior) {
          seen.set(key, { extensionId: lm.extensionId, path: lm.path });
          continue;
        }
        const replaces = typeof raw.replaces === "string" ? raw.replaces : "";
        if (replaces === id) {
          seen.set(key, { extensionId: lm.extensionId, path: lm.path });
          continue;
        }
        diagnostics.push({
          code: "extension:namespace_collision",
          severity,
          message: `${lm.path ?? lm.extensionId}: duplicate ${surface} id '${id}' previously declared by ${prior.extensionId}${prior.path ? ` at ${prior.path}` : ""}`,
        });
      }
    }
  }
  return diagnostics;
}

export async function loadExtensionRegistry(opts: LoadExtensionRegistryOptions = {}): Promise<ExtensionRegistry> {
  const roots = opts.roots ?? defaultExtensionRoots();
  const severity = opts.severity ?? (process.env.DOS_EXTENSION_SEVERITY === "error" ? "error" : "warn");
  const diagnostics: Diagnostic[] = [];
  const manifests: Array<{ extensionId: string; manifest: Record<string, unknown>; path?: string }> = [];

  for (const path of extensionManifestPaths(roots)) {
    try {
      const manifest = await parseExtensionManifest(path);
      const extensionId = typeof manifest.extension_id === "string" ? manifest.extension_id : "";
      if (!extensionId) {
        diagnostics.push({ code: "extension:schema", severity, message: `${path}: missing extension_id` });
        continue;
      }
      if (manifest.schema !== "dos-extension/v1") {
        diagnostics.push({ code: "extension:schema", severity, message: `${path}: unsupported schema '${String(manifest.schema)}'` });
        continue;
      }
      manifests.push({ extensionId, manifest, path });
    } catch (error) {
      diagnostics.push({
        code: "extension:parse",
        severity,
        message: `${path}: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  manifests.sort((a, b) => a.extensionId.localeCompare(b.extensionId) || String(a.path ?? "").localeCompare(String(b.path ?? "")));
  const registry = createExtensionRegistry({
    manifests,
    diagnostics: diagnostics.concat(extensionLoadDiagnostics(manifests, severity)).map((d) => ({
      severity: d.severity,
      rule: d.code.replace(/^extension:/, ""),
      message: d.message,
    })),
  });
  registry.manifestCount = manifests.length;
  return registry;
}
