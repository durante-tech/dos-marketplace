#!/usr/bin/env bun
/**
 * SentinelBootstrap — deterministic file generators for the Sentinel Bootstrap workflow.
 *
 * Extracts the Bootstrap "Step 3 Scaffold" + "Step 4 CLAUDE.md" markdown templates
 * (Bootstrap.md 3b/3c/Step 4, RFC-0126 B1 render-family) into pure generators so the
 * generated .gitignore / config files / CLAUDE.md are produced from one tested source
 * of truth, not hand-transcribed per bootstrap. The agent still owns the interview
 * judgment (which stack, db, auth); these helpers render the deterministic file bodies
 * from those locked answers.
 *
 * Usage (CLI):
 *   bun SentinelBootstrap.ts gitignore <stack>
 *   bun SentinelBootstrap.ts claude-md <spec.json>
 *   bun SentinelBootstrap.ts stack-config <spec.json>
 */

import { readFileSync } from "fs";

// Stack identifiers mirror the Bootstrap interview's stack choices. The .gitignore
// and config blocks are keyed on these. Kept as a union so callers cannot pass an
// unknown stack silently.
export type Stack = "nextjs" | "react-vite" | "node" | "python";

// ---------------------------------------------------------------------------
// 3b — .gitignore generation (Bootstrap.md lines 154-214)
// ---------------------------------------------------------------------------

// "For all stacks" base block — verbatim from the template (grouped comment headers
// preserved). This is the shared prefix every generated .gitignore starts with.
const GITIGNORE_BASE = `# Dependencies
node_modules/

# DOS internals
.sentinel/
MEMORY/SECURITY/
MEMORY/LEARNING/SIGNALS/

# Environment
.env
.env.local
.env.*.local

# OS
.DS_Store
Thumbs.db`;

// Per-stack tail blocks — verbatim from the template. nextjs and react-vite share the
// "Next.js / React + Vite" block; node and python have their own.
const GITIGNORE_NEXT_VITE = `# Build
.next/
out/
dist/
build/

# Turbo
.turbo/

# Vercel
.vercel/`;

const GITIGNORE_NODE = `# Build
dist/
build/

# Coverage
coverage/`;

const GITIGNORE_PYTHON = `# Virtual environments
.venv/
venv/
__pycache__/
*.pyc

# Build
dist/
*.egg-info/`;

/**
 * generateGitignore — stack-appropriate .gitignore body (Bootstrap.md 3b).
 *
 * Byte-identical to the template: the "all stacks" base block, then the stack-specific
 * block separated by a blank line. nextjs/react-vite share the Next.js/Vite block.
 */
export function generateGitignore(stack: Stack): string {
  const tail =
    stack === "nextjs" || stack === "react-vite"
      ? GITIGNORE_NEXT_VITE
      : stack === "node"
        ? GITIGNORE_NODE
        : GITIGNORE_PYTHON;
  return `${GITIGNORE_BASE}\n\n${tail}\n`;
}

// ---------------------------------------------------------------------------
// 3c — stack-specific config files (Bootstrap.md lines 216-396)
// ---------------------------------------------------------------------------

export interface StackConfigSpec {
  stack: Stack;
  database: string;
  auth: string;
  monorepo: boolean;
  projectName: string;
  projectDescription?: string;
}

// Each config-file body is rendered verbatim from the template, with {PROJECT_NAME} /
// {PROJECT_DESCRIPTION} interpolation. Returned as a path -> contents map matching the
// "files written using Write tool" prose. Database/auth/monorepo additions mutate the
// package.json the same way the template's append rules specify.

function nextjsPackageJson(name: string): Record<string, unknown> {
  return {
    name,
    version: "0.1.0",
    private: true,
    scripts: { dev: "next dev --turbopack", build: "next build", start: "next start", lint: "next lint" },
    dependencies: { next: "latest", react: "latest", "react-dom": "latest" },
    devDependencies: {
      "@types/node": "latest",
      "@types/react": "latest",
      "@types/react-dom": "latest",
      typescript: "latest",
    },
  };
}

const NEXTJS_TSCONFIG = {
  compilerOptions: {
    target: "ES2017",
    lib: ["dom", "dom.iterable", "esnext"],
    allowJs: true,
    skipLibCheck: true,
    strict: true,
    noEmit: true,
    esModuleInterop: true,
    module: "esnext",
    moduleResolution: "bundler",
    resolveJsonModule: true,
    isolatedModules: true,
    jsx: "preserve",
    incremental: true,
    plugins: [{ name: "next" }],
    paths: { "@/*": ["./src/*"] },
  },
  include: ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  exclude: ["node_modules"],
};

function reactVitePackageJson(name: string): Record<string, unknown> {
  return {
    name,
    version: "0.1.0",
    private: true,
    type: "module",
    scripts: { dev: "vite", build: "tsc -b && vite build", preview: "vite preview" },
    dependencies: { react: "latest", "react-dom": "latest" },
    devDependencies: {
      "@types/react": "latest",
      "@types/react-dom": "latest",
      "@vitejs/plugin-react": "latest",
      typescript: "latest",
      vite: "latest",
    },
  };
}

const REACT_VITE_TSCONFIG = {
  compilerOptions: {
    target: "ES2020",
    module: "ESNext",
    lib: ["ES2020", "DOM", "DOM.Iterable"],
    skipLibCheck: true,
    moduleResolution: "bundler",
    isolatedModules: true,
    jsx: "react-jsx",
    strict: true,
    noEmit: true,
    resolveJsonModule: true,
    paths: { "@/*": ["./src/*"] },
  },
  include: ["src"],
};

function nodePackageJson(name: string): Record<string, unknown> {
  return {
    name,
    version: "0.1.0",
    private: true,
    type: "module",
    scripts: { dev: "tsx watch src/index.ts", build: "tsc", start: "node dist/index.js" },
    devDependencies: { "@types/node": "latest", tsx: "latest", typescript: "latest" },
  };
}

const NODE_TSCONFIG = {
  compilerOptions: {
    target: "ES2022",
    module: "NodeNext",
    moduleResolution: "NodeNext",
    outDir: "dist",
    rootDir: "src",
    strict: true,
    esModuleInterop: true,
    skipLibCheck: true,
    resolveJsonModule: true,
    declaration: true,
  },
  include: ["src"],
  exclude: ["node_modules", "dist"],
};

function pythonPyproject(name: string, description: string): string {
  return `[project]
name = "${name}"
version = "0.1.0"
description = "${description}"
requires-python = ">=3.11"
dependencies = []

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"
`;
}

// Mutate a package.json object with the database/auth additions the template appends.
function applyDatabaseAuthAdditions(pkg: Record<string, unknown>, database: string, auth: string): void {
  const deps = (pkg.dependencies as Record<string, string>) ?? (pkg.dependencies = {} as Record<string, string>);
  const dev = (pkg.devDependencies as Record<string, string>) ?? (pkg.devDependencies = {} as Record<string, string>);
  const scripts = (pkg.scripts as Record<string, string>) ?? (pkg.scripts = {} as Record<string, string>);
  switch (database) {
    case "prisma-postgres":
      dev.prisma = "latest";
      deps["@prisma/client"] = "latest";
      scripts["db:migrate"] = "prisma migrate dev";
      scripts["db:generate"] = "prisma generate";
      break;
    case "supabase":
      deps["@supabase/supabase-js"] = "latest";
      break;
    case "mongodb":
      deps.mongoose = "latest";
      break;
  }
  switch (auth) {
    case "better-auth":
      deps["better-auth"] = "latest";
      break;
    case "nextauth":
      deps["next-auth"] = "latest";
      break;
    case "clerk":
      deps["@clerk/nextjs"] = "latest";
      break;
  }
}

const TURBO_JSON = { $schema: "https://turbo.build/schema.json", pipeline: { build: { dependsOn: ["^build"] } } };

/**
 * generateStackConfig — the stack config-file set (Bootstrap.md 3c).
 *
 * Returns a { path: contents } map. JS/TS stacks get package.json + tsconfig.json
 * (with database/auth deps appended per the template's rules, and monorepo additions
 * when monorepo is true); Python gets pyproject.toml only. JSON files are rendered with
 * 2-space indent + trailing newline.
 */
export function generateStackConfig(spec: StackConfigSpec): Record<string, string> {
  const { stack, database, auth, monorepo, projectName, projectDescription } = spec;
  const json = (o: unknown): string => `${JSON.stringify(o, null, 2)}\n`;
  const files: Record<string, string> = {};

  if (stack === "python") {
    files["pyproject.toml"] = pythonPyproject(projectName, projectDescription ?? "");
    return files; // No tsconfig/package.json for Python.
  }

  const pkg =
    stack === "nextjs"
      ? nextjsPackageJson(projectName)
      : stack === "react-vite"
        ? reactVitePackageJson(projectName)
        : nodePackageJson(projectName);
  const tsconfig = stack === "nextjs" ? NEXTJS_TSCONFIG : stack === "react-vite" ? REACT_VITE_TSCONFIG : NODE_TSCONFIG;

  applyDatabaseAuthAdditions(pkg, database, auth);

  if (monorepo) {
    (pkg as Record<string, unknown>).workspaces = ["apps/*", "packages/*"];
    files["turbo.json"] = json(TURBO_JSON);
  }

  files["package.json"] = json(pkg);
  files["tsconfig.json"] = json(tsconfig);
  return files;
}

// ---------------------------------------------------------------------------
// Step 4 — CLAUDE.md generation (Bootstrap.md lines 423-459)
// ---------------------------------------------------------------------------

export interface ClaudeMdSpec {
  projectName: string;
  projectDescription: string;
  language: string;
  framework: string;
  runtime: string;
  database: string;
  auth: string;
  packageManager: string;
  date: string;
  /** Stack-standard recommended-convention bullets (already worded by caller). */
  recommendedConventions: string[];
  installCommand: string;
  devCommand: string;
  buildCommand: string;
}

/**
 * generateClaudeMd — the bootstrapped CLAUDE.md (Bootstrap.md Step 4 template).
 *
 * Byte-identical to the inlined template: Tech Stack list, the auto-generated Sentinel
 * Conventions comment + "No conventions discovered yet" note, the Recommended
 * Conventions bullets, and the Setup commands. recommendedConventions is rendered one
 * bullet per line; the bullet wording is the caller's (stack-standard) judgment.
 */
export function generateClaudeMd(s: ClaudeMdSpec): string {
  const out: string[] = [];
  out.push(`# ${s.projectName}`);
  out.push("");
  out.push(s.projectDescription);
  out.push("");
  out.push("## Tech Stack");
  out.push("");
  out.push(`- **Language:** ${s.language}`);
  out.push(`- **Framework:** ${s.framework}`);
  out.push(`- **Runtime:** ${s.runtime}`);
  out.push(`- **Database:** ${s.database}`);
  out.push(`- **Auth:** ${s.auth}`);
  out.push(`- **Package Manager:** ${s.packageManager}`);
  out.push("");
  out.push("## Sentinel Conventions");
  out.push(`<!-- Auto-generated by sentinel bootstrap on ${s.date}. Run \`sentinel scan\` after adding code to discover actual conventions. -->`);
  out.push("");
  out.push("No conventions discovered yet — this project was just bootstrapped. Sentinel will populate this section when you run `sentinel scan` after adding code.");
  out.push("");
  out.push("### Recommended Conventions (based on stack)");
  out.push("");
  for (const c of s.recommendedConventions) out.push(`- ${c}`);
  out.push("");
  out.push("## Setup");
  out.push("");
  out.push(`- Install: \`${s.installCommand}\``);
  out.push(`- Dev: \`${s.devCommand}\``);
  out.push(`- Build: \`${s.buildCommand}\``);
  out.push("");
  return out.join("\n");
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function printHelp(): void {
  console.log(`SentinelBootstrap — deterministic Bootstrap file generators

USAGE
  bun SentinelBootstrap.ts gitignore <stack>
  bun SentinelBootstrap.ts stack-config <spec.json>
  bun SentinelBootstrap.ts claude-md <spec.json>

SUBCOMMANDS
  gitignore <stack>        Print the .gitignore for stack
                           (nextjs|react-vite|node|python).
  stack-config <spec.json> Read a StackConfigSpec JSON and print the generated
                           config files as a { path: contents } JSON map.
  claude-md <spec.json>    Read a ClaudeMdSpec JSON and print the bootstrapped
                           CLAUDE.md markdown.`);
}

function main(): void {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    printHelp();
    process.exit(0);
  }
  const sub = process.argv[2];
  if (sub === "gitignore") {
    const stack = process.argv[3] as Stack;
    if (!["nextjs", "react-vite", "node", "python"].includes(stack)) {
      console.error("Error: gitignore requires a <stack>: nextjs | react-vite | node | python");
      process.exit(1);
    }
    process.stdout.write(generateGitignore(stack));
    return;
  }
  if (sub === "stack-config") {
    const path = process.argv[3];
    if (!path) {
      console.error("Error: stack-config requires a <spec.json> path argument");
      process.exit(1);
    }
    const spec = JSON.parse(readFileSync(path, "utf8")) as StackConfigSpec;
    console.log(JSON.stringify(generateStackConfig(spec), null, 2));
    return;
  }
  if (sub === "claude-md") {
    const path = process.argv[3];
    if (!path) {
      console.error("Error: claude-md requires a <spec.json> path argument");
      process.exit(1);
    }
    const spec = JSON.parse(readFileSync(path, "utf8")) as ClaudeMdSpec;
    process.stdout.write(generateClaudeMd(spec));
    return;
  }
  console.error(`Error: unknown subcommand '${sub ?? ""}'. Expected: gitignore | stack-config | claude-md`);
  process.exit(1);
}

if (import.meta.main) {
  main();
}
