#!/usr/bin/env bun
/**
 * BuildBrief — Compose a per-agent invocation brief from PRD + role + framework
 * digest slice + authorized MCP cluster catalogue.
 *
 * Usage:
 *   bun run BuildBrief.ts --role pm --prd MEMORY/WORK/<slug>/PRD.md --isc "ISC-1,ISC-2"
 *   bun run BuildBrief.ts --role frontend --prd ... --contract Workflows/contracts/phase4.md
 *
 * Output: a markdown brief suitable to drop into a Task tool's `prompt` field
 * AFTER the system prompt (which comes from InvokeAgent.ts).
 */
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

interface RosterRole {
  id: string;
  role: string;
  slug: string;
  purpose: string;
  traits: string[];
  owns: string[];
  consumes: string[];
  produces: string[];
  mcp_tools?: string[];
}

interface McpCluster {
  name: string;
  purpose: string;
  tools: string[];
  notes: string;
}

interface McpToolMap {
  version: string;
  clusters: Record<string, McpCluster>;
}

const ROSTER_PATH = resolve(import.meta.dir, '../Data/Roster.json');
const DIGEST_PATH = resolve(import.meta.dir, '../FrameworkDigest.md');
const MCP_TOOL_MAP_PATH = resolve(import.meta.dir, '../Data/McpToolMap.json');

const DIGEST_SLICE_BY_ROLE: Record<string, string[]> = {
  pm: ['1', '2'],
  sm: ['1'],
  ux: ['1', '2', '9'],
  ui: ['9'],
  architect: ['1', '2', '3', '4', '13'],
  frontend: ['1', '2', '3', '9', '10', '13'],
  backend: ['3', '5', '6', '7', '8', '13'],
  database: ['1', '7', '13'],
  security: ['2', '3', '4', '5', '6', '11', '13'],
  qa: ['10', '11'],
  e2e: ['10', '11'],
  devops: ['1', '5', '7', '10', '11', '13'],
  writer: ['1', '12', '13'],
};

function loadRoster() {
  return JSON.parse(readFileSync(ROSTER_PATH, 'utf8')) as { team: RosterRole[] };
}

function loadDigest(): string {
  if (!existsSync(DIGEST_PATH)) {
    return '_(framework digest not yet authored at FrameworkDigest.md)_';
  }
  return readFileSync(DIGEST_PATH, 'utf8');
}

function loadMcpToolMap(): McpToolMap | null {
  if (!existsSync(MCP_TOOL_MAP_PATH)) return null;
  return JSON.parse(readFileSync(MCP_TOOL_MAP_PATH, 'utf8')) as McpToolMap;
}

function validateRosterMcpTools(team: RosterRole[], map: McpToolMap | null): void {
  if (!map) return;
  const knownClusters = new Set(Object.keys(map.clusters));
  const errors: string[] = [];
  for (const role of team) {
    for (const clusterId of role.mcp_tools ?? []) {
      if (!knownClusters.has(clusterId)) {
        errors.push(`role "${role.id}" references unknown MCP cluster "${clusterId}"`);
      }
    }
  }
  if (errors.length > 0) {
    console.error(`McpToolMap validation failed (${errors.length}):`);
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }
}

function renderMcpToolsSection(role: RosterRole, map: McpToolMap | null): string {
  if (!map) return '_(McpToolMap.json not found — agent operates without MCP authorization context)_';
  const clusters = role.mcp_tools ?? [];
  if (clusters.length === 0) return '_(no MCP tools — use repo Read/Grep instead)_';
  const lines: string[] = [];
  for (const clusterId of clusters) {
    const cluster = map.clusters[clusterId];
    if (!cluster) continue;
    lines.push(`### ${cluster.name} (\`${clusterId}\`)`);
    lines.push(cluster.purpose);
    lines.push('');
    lines.push('Tools:');
    for (const tool of cluster.tools) lines.push(`- \`${tool}\``);
    lines.push('');
    lines.push(`_Notes:_ ${cluster.notes}`);
    lines.push('');
  }
  return lines.join('\n');
}

function sliceDigest(digest: string, sectionNumbers: string[]): string {
  const lines = digest.split('\n');
  const slices: string[] = [];
  let currentSection = '';
  let inWantedSection = false;
  for (const line of lines) {
    const heading = line.match(/^##\s+(\d+)\s+·/);
    if (heading) {
      currentSection = heading[1];
      inWantedSection = sectionNumbers.includes(currentSection);
    }
    if (inWantedSection) slices.push(line);
  }
  return slices.length > 0 ? slices.join('\n') : `_(no sections matched: ${sectionNumbers.join(', ')})_`;
}

function parseArgs(argv: string[]): {
  role?: string;
  prd?: string;
  isc?: string;
  contract?: string;
  upstream?: string;
} {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--role') out.role = argv[++i];
    else if (a === '--prd') out.prd = argv[++i];
    else if (a === '--isc') out.isc = argv[++i];
    else if (a === '--contract') out.contract = argv[++i];
    else if (a === '--upstream') out.upstream = argv[++i];
  }
  return out;
}

function main(): void {
  const args = parseArgs(Bun.argv.slice(2));
  if (!args.role || !args.prd) {
    console.error('Usage: --role <id> --prd <path> [--isc "ISC-1,ISC-2"] [--contract <path>] [--upstream <path>]');
    process.exit(1);
  }

  const { team } = loadRoster();
  const role = team.find((r) => r.id === args.role);
  if (!role) {
    console.error(`Unknown role: ${args.role}`);
    process.exit(1);
  }

  const digest = loadDigest();
  const mcpToolMap = loadMcpToolMap();
  validateRosterMcpTools(team, mcpToolMap);
  const sliceNums = DIGEST_SLICE_BY_ROLE[role.id] ?? [];
  const digestSlice = sliceDigest(digest, sliceNums);

  const iscList = args.isc ? args.isc.split(',').map((s) => s.trim()) : [];
  const contractText = args.contract && existsSync(args.contract) ? readFileSync(args.contract, 'utf8') : '';
  const upstreamText = args.upstream && existsSync(args.upstream) ? readFileSync(args.upstream, 'utf8') : '';

  const brief = `# Brief — ${role.role}

You are the ${role.role} on the makerkit delivery team. You operate under the Subagent Algorithm Profile (already in your system prompt).

## Your responsibilities
${role.owns.map((o) => `- ${o}`).join('\n')}

## You consume
${role.consumes.map((c) => `- ${c}`).join('\n')}

## You produce
${role.produces.map((p) => `- ${p}`).join('\n')}

## PRD
Read: \`${args.prd}\`

## Read first — the kit agentic bridge (before editing any package)
The kit carries its own always-fresh onboarding mechanism. Ground yourself in it, do not rely on this digest alone:
- **The package you're editing has an \`AGENTS.md\`** (auto-loaded via its \`CLAUDE.md\`=\`@AGENTS.md\` shim) carrying that package's non-negotiables. The most-local \`AGENTS.md\` wins on conflict — read it before you touch the package.
- **Root \`AGENTS.md\` has a "Development Docs" task→doc table** → the matching \`docs/development-guide/*.mdoc\` is the behavioral source of truth (reasoning + anti-patterns); AGENTS.md is the checklist.
- Honor the surfaced drift anti-patterns: never catch \`redirect()\` (use \`isRedirectError\`), correct \`revalidatePath\` placement, keep the \`'use server'\`/\`'server-only'\` split, and use the service pattern for server-side APIs (root \`AGENTS.md\`).
- Never mix client/server imports across packages — use separate \`package.json\` exports. Layer boundaries are enforced by convention (root \`AGENTS.md\`) + review; there is no boundary-check script in the kit.

## Your ISC criteria
${iscList.length > 0 ? iscList.map((c) => `- ${c}`).join('\n') : '_(operator will assign at phase gate)_'}

## Framework digest — sections relevant to your role (§${sliceNums.join(', §')})
${digestSlice}

## Authorized MCP Tools

The Makerkit MCP server (\`mcp__makerkit__*\`) exposes 50+ tools. Your role is authorized to call the clusters below. Tools NOT in this section are out of scope for your role — surface findings to the orchestrator instead of overreaching. The destructive tools (\`kit_db_reset\`, \`kit_translations_remove_*\`) require operator confirmation even when authorized.

${renderMcpToolsSection(role, mcpToolMap)}

${contractText ? `## Pre-Delegation Contract\n${contractText}\n` : ''}
${upstreamText ? `## Upstream artifacts\n${upstreamText}\n` : ''}

## Expected output format
Per the Subagent Algorithm Profile: emit OBSERVE-lite markers (🔎 / 🧠 / 🏹) first, then the structured response sections (📋 / 🔍 / ⚡ / ✅ / 📊 / 📁 / ➡️ / 📖 / 🎯).

## Constraints
- Do not exceed your role's ownership boundary (see "You consume" / "You produce" above).
- Cite file:line for every claim about the codebase.
- For framework patterns, prefer the team's internal role authority (e.g. \`frontend\` owns react-hook-form patterns, \`backend\` owns server-action patterns, \`database\` owns Prisma patterns, \`e2e\` owns Playwright patterns — see Roster.json), AND compose the matching kit-specialist skill where it sharpens the deliverable: \`react-form-builder\` (forms), \`server-actions-expert\` (server actions), \`prisma-expert\` (schema/migrations/queries), \`playwright-e2e-expert\` (e2e), \`frontend-design\` (component/design-system review). All are installed; invoke via the Skill tool per the Council-G2 conditional-fire + cost-guard pattern in \`_skill-composition.md\` (skip silently when not applicable; degrade to \`⚠️ unverified\` on error, never block the phase).
`;

  console.log(brief);
}

main();
