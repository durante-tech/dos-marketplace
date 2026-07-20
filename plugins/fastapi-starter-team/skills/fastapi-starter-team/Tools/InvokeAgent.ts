#!/usr/bin/env bun
/**
 * InvokeAgent — Resolve a role id to its system prompt + voice metadata.
 *
 * Usage:
 *   bun run InvokeAgent.ts --role pm                     → prints system prompt
 *   bun run InvokeAgent.ts --role agent --json           → prints { systemPrompt, voice_id, role }
 *   bun run InvokeAgent.ts --list                        → list all roles in roster
 *
 * The orchestrator (the parent agent in Claude Code) reads the system prompt
 * and passes it as the `prompt` field of a Task tool call with
 * subagent_type="general-purpose". The voice_id is used by the parent to
 * voice the agent's `🎯 COMPLETED:` line via voice.sh.
 *
 * Sibling: MakerkitTeam/Tools/InvokeAgent.ts. Same shape, different roster.
 */
import { readFileSync, existsSync } from 'fs';
import { homedir } from 'os';
import { resolve } from 'path';

interface RosterRole {
  role: string;
  id: string;
  slug: string;
  purpose: string;
  traits: string[];
  voice?: string;
  voice_id: string;
  color: string;
  owns: string[];
  consumes: string[];
  produces: string[];
}

interface Roster {
  version: string;
  framework: string;
  saved_agents_dir: string;
  team: RosterRole[];
}

const ROSTER_PATH = resolve(import.meta.dir, '../Data/Roster.json');
const SAVED_AGENTS_DIR = resolve(homedir(), '.claude/custom-agents');

function loadRoster(): Roster {
  if (!existsSync(ROSTER_PATH)) {
    throw new Error(`Roster not found at ${ROSTER_PATH}`);
  }
  return JSON.parse(readFileSync(ROSTER_PATH, 'utf8'));
}

function loadSystemPrompt(slug: string): string {
  const path = resolve(SAVED_AGENTS_DIR, `${slug}.md`);
  if (!existsSync(path)) {
    throw new Error(
      `Saved composition not found at ${path}. Re-run ComposeAgent --save for slug "${slug}".`
    );
  }
  return readFileSync(path, 'utf8');
}

function parseArgs(argv: string[]): { role?: string; json?: boolean; list?: boolean } {
  const out: { role?: string; json?: boolean; list?: boolean } = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--role' || a === '-r') out.role = argv[++i];
    else if (a === '--json') out.json = true;
    else if (a === '--list' || a === '-l') out.list = true;
  }
  return out;
}

function main(): void {
  const args = parseArgs(Bun.argv.slice(2));
  const roster = loadRoster();

  if (args.list) {
    for (const r of roster.team) {
      console.log(
        `${r.id.padEnd(10)} ${r.role.padEnd(22)} ${r.traits.join(' · ').padEnd(50)} ${r.slug}`
      );
    }
    return;
  }

  if (!args.role) {
    console.error('Usage: --role <id> [--json] | --list');
    process.exit(1);
  }

  const role = roster.team.find((r) => r.id === args.role);
  if (!role) {
    console.error(`Unknown role id: ${args.role}`);
    console.error(`Known: ${roster.team.map((r) => r.id).join(', ')}`);
    process.exit(1);
  }

  const systemPrompt = loadSystemPrompt(role.slug);

  if (args.json) {
    console.log(
      JSON.stringify(
        {
          id: role.id,
          role: role.role,
          slug: role.slug,
          voice_id: role.voice_id,
          systemPrompt,
        },
        null,
        2
      )
    );
  } else {
    console.log(systemPrompt);
  }
}

main();
