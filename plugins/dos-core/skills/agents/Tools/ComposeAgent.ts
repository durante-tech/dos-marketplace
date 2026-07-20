#!/usr/bin/env bun

/**
 * ComposeAgent — Dynamic Agent Composition from Traits
 *
 * CLI dispatcher. All composition logic lives in ./compose/.
 *
 * Configuration files:
 *   Base:  ~/.claude/skills/agents/Data/Traits.yaml
 *   User:  ~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/Agents/Traits.yaml
 *
 * @version 3.0.0
 */

import { parseAgentArgs } from "./compose/parseArgs.ts";
import { printHelp } from "./compose/help.ts";
import { loadTraits } from "./compose/traits.ts";
import { commands } from "./compose/commands/index.ts";
import type { TraitsData } from "./compose/types.ts";

async function main(): Promise<number> {
  const argv = parseAgentArgs(Bun.argv.slice(2));

  if (argv.help) {
    printHelp();
    return 0;
  }

  let cachedTraits: TraitsData | null = null;
  const ctx = {
    getTraits: () => (cachedTraits ??= loadTraits()),
  };

  const command = commands.find((c) => c.matches(argv));
  if (!command) {
    console.error("Error: No matching command. Use --help for usage information.");
    return 1;
  }

  return await command.execute(argv, ctx);
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
