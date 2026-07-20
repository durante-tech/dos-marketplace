import type { AgentArgs } from "../parseArgs.ts";
import type { TraitsData } from "../types.ts";

export interface CommandContext {
  getTraits: () => TraitsData;
}

export interface Command {
  name: string;
  matches: (argv: AgentArgs) => boolean;
  execute: (argv: AgentArgs, ctx: CommandContext) => number | Promise<number>;
}
