/**
 * Safe writer for the DOS project registry.
 *
 * This module deliberately has no project-discovery behavior. A caller must
 * supply both an exact project entry and an explicit registration context;
 * only Sentinel's completed scan or an operator-requested registration may
 * call the writer. Merely installing DOS never indexes the current directory.
 */

import { randomUUID } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";

export interface ProjectEntry {
  id: string;
  name: string;
  wing: string;
  root_path: string;
  description?: string;
  [key: string]: unknown;
}

export interface PreservedProjectEntry {
  id: string;
  name?: string | null;
  wing?: string | null;
  root_path?: string | null;
  [key: string]: unknown;
}

export interface ProjectsRegistry {
  projects?: PreservedProjectEntry[];
  [key: string]: unknown;
}

export type ProjectRegistrationContext =
  | "sentinel-scan"
  | "explicit-registration";

export interface RegisterProjectInput {
  registryPath: string;
  entry: ProjectEntry;
  context: ProjectRegistrationContext;
}

export interface ProjectRegistrationResult {
  registry: ProjectsRegistry;
  changed: boolean;
}

const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

type ProjectRegistryPathEnv = {
  DOS_PROJECTS_REGISTRY?: string;
  DOS_DIR?: string;
};

function expandInstallRoot(path: string, home: string): string {
  if (path === "~" || path === "$HOME" || path === "${HOME}") return home;
  if (path.startsWith("~/")) return join(home, path.slice(2));
  if (path.startsWith("$HOME/")) return join(home, path.slice("$HOME/".length));
  if (path.startsWith("${HOME}/")) {
    return join(home, path.slice("${HOME}/".length));
  }
  return path;
}

/**
 * Select the Sentinel registry write target using the reader's D1 precedence.
 *
 * The operator override is authoritative when non-empty. Otherwise writes go
 * to the install-class canonical registry (relocated by DOS_DIR when set).
 * Legacy Durante registries remain reader fallbacks only: a new scan must not
 * keep producing state into the maintainer-only location.
 */
export function resolveProjectRegistryWritePath(
  env: ProjectRegistryPathEnv = process.env,
  home: string = homedir(),
): string {
  const override = env.DOS_PROJECTS_REGISTRY;
  if (override && override.length > 0) return resolve(override);

  const installRoot =
    env.DOS_DIR && env.DOS_DIR.length > 0
      ? expandInstallRoot(env.DOS_DIR, home)
      : join(home, ".claude");
  return join(resolve(installRoot), "DOS", "projects", "registry.json");
}

function requireText(
  field: "id" | "name" | "wing",
  value: unknown,
): string {
  if (typeof value !== "string") {
    throw new Error(`project registry: ${field} must be a string`);
  }
  if (value.includes("\0")) {
    throw new Error(`project registry: ${field} must not contain NUL`);
  }
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`project registry: ${field} must not be empty`);
  }
  return trimmed;
}

/**
 * Validate and normalize a newly registered project.
 *
 * Existing registry rows are preserved value-for-value at the object level,
 * including legacy rows with null wing/root_path and forward-compatible
 * fields. These strict requirements apply only to a new indexable entry.
 */
export function validateProjectEntry(entry: ProjectEntry): ProjectEntry {
  if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
    throw new Error("project registry: entry must be an object");
  }

  const id = requireText("id", entry.id);
  const name = requireText("name", entry.name);
  const wing = requireText("wing", entry.wing);
  if (!SLUG_PATTERN.test(id)) {
    throw new Error(
      "project registry: id must be a lowercase kebab slug (1-63 characters)",
    );
  }
  if (!SLUG_PATTERN.test(wing)) {
    throw new Error(
      "project registry: wing must be a lowercase kebab slug (1-63 characters)",
    );
  }
  if (name.length > 200) {
    throw new Error("project registry: name must be at most 200 characters");
  }

  if (typeof entry.root_path !== "string") {
    throw new Error("project registry: root_path must be a string");
  }
  if (entry.root_path.includes("\0")) {
    throw new Error("project registry: root_path must not contain NUL");
  }
  const rawRootPath = entry.root_path.trim();
  if (!isAbsolute(rawRootPath)) {
    throw new Error("project registry: root_path must be absolute");
  }
  const rootPath = resolve(rawRootPath);
  if (rootPath === "/") {
    throw new Error("project registry: root_path must not be filesystem root");
  }

  let description: string | undefined;
  if (entry.description !== undefined) {
    if (typeof entry.description !== "string") {
      throw new Error("project registry: description must be a string");
    }
    if (entry.description.includes("\0")) {
      throw new Error("project registry: description must not contain NUL");
    }
    const trimmed = entry.description.trim();
    if (trimmed) description = trimmed;
  }

  return {
    id,
    name,
    wing,
    root_path: rootPath,
    ...(description ? { description } : {}),
  };
}

function validateRegistryShape(registry: unknown): asserts registry is ProjectsRegistry {
  if (typeof registry !== "object" || registry === null || Array.isArray(registry)) {
    throw new Error("project registry: file root must be a JSON object");
  }
  const projects = (registry as ProjectsRegistry).projects;
  if (projects !== undefined && !Array.isArray(projects)) {
    throw new Error("project registry: projects must be an array");
  }
  for (const [index, candidate] of (projects ?? []).entries()) {
    if (
      typeof candidate !== "object"
      || candidate === null
      || Array.isArray(candidate)
      || typeof candidate.id !== "string"
      || !candidate.id.trim()
      || candidate.id.includes("\0")
    ) {
      throw new Error(
        `project registry: existing projects[${index}] is not a preservable entry`,
      );
    }
  }
}

/**
 * Pure, idempotent transform. Existing ids are never overwritten: changing a
 * root_path is an operator-reviewed registry edit, not a scan side effect.
 */
export function upsertProjectEntry(
  registry: ProjectsRegistry,
  entry: ProjectEntry,
): ProjectRegistrationResult {
  validateRegistryShape(registry);
  const normalizedEntry = validateProjectEntry(entry);
  const projects = registry.projects ?? [];
  if (
    projects.some((candidate) => candidate.id.trim() === normalizedEntry.id)
  ) {
    return { registry, changed: false };
  }
  return {
    registry: {
      ...registry,
      projects: [...projects, normalizedEntry],
    },
    changed: true,
  };
}

function readRegistry(registryPath: string): ProjectsRegistry {
  if (!existsSync(registryPath)) return { projects: [] };
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(registryPath, "utf8"));
  } catch (error) {
    throw new Error(
      `project registry: refusing to overwrite unreadable JSON at ${registryPath}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
  validateRegistryShape(parsed);
  return parsed;
}

/**
 * Read, upsert, and atomically replace a project registry.
 *
 * The temporary file is created in the destination directory so rename is a
 * same-filesystem atomic swap. Malformed existing registries fail closed and
 * are never replaced. No write occurs for an existing id.
 */
export function registerProjectEntryAtomic(
  input: RegisterProjectInput,
): ProjectRegistrationResult {
  if (
    input.context !== "sentinel-scan"
    && input.context !== "explicit-registration"
  ) {
    throw new Error("project registry: explicit registration context required");
  }
  if (
    typeof input.registryPath !== "string"
    || input.registryPath.includes("\0")
    || !isAbsolute(input.registryPath)
  ) {
    throw new Error("project registry: registry path must be absolute");
  }

  const normalizedEntry = validateProjectEntry(input.entry);
  if (
    !existsSync(normalizedEntry.root_path)
    || !statSync(normalizedEntry.root_path).isDirectory()
  ) {
    throw new Error(
      `project registry: root_path is not an existing directory: ${normalizedEntry.root_path}`,
    );
  }

  const registry = readRegistry(input.registryPath);
  const result = upsertProjectEntry(registry, normalizedEntry);
  if (!result.changed) return result;

  const parent = dirname(input.registryPath);
  mkdirSync(parent, { recursive: true });
  const temporaryPath = join(
    parent,
    `.${basename(input.registryPath)}.${process.pid}.${randomUUID()}.tmp`,
  );

  try {
    // writeArtifact:exempt — canonical registry state, atomically renamed below
    writeFileSync(
      temporaryPath,
      `${JSON.stringify(result.registry, null, 2)}\n`,
      { encoding: "utf8", flag: "wx", mode: 0o600 },
    );
    renameSync(temporaryPath, input.registryPath);
  } finally {
    if (existsSync(temporaryPath)) rmSync(temporaryPath, { force: true });
  }
  return result;
}
