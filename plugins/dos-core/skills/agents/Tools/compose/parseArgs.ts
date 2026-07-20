import { parseArgs } from "util";

export interface AgentArgs {
  task?: string;
  traits?: string;
  output?: string;
  format?: string;
  timing?: string;
  list?: boolean;
  save?: boolean;
  "list-saved"?: boolean;
  load?: string;
  council?: string;
  analytics?: boolean;
  search?: string;
  criteria?: string;
  delete?: string;
  promote?: string;
  demote?: string;
  ephemeral?: boolean;
  "ephemeral-exec"?: boolean;
  "promote-n-sessions"?: string;
  "freshness-days"?: string;
  "promote-min-days"?: string;
  "promote-min-persisted-ratio"?: string;
  "force-promote"?: boolean;
  scope?: string;
  tools?: string;
  "auto-attach-globs"?: string;
  "always-apply"?: boolean;
  "dry-run"?: boolean;
  help?: boolean;
}

export function parseAgentArgs(argv: string[]): AgentArgs {
  const { values } = parseArgs({
    args: argv,
    options: {
      task: { type: "string", short: "t" },
      traits: { type: "string", short: "r" },
      output: { type: "string", short: "o", default: "prompt" },
      timing: { type: "string" },
      list: { type: "boolean", short: "l" },
      save: { type: "boolean", short: "s" },
      "list-saved": { type: "boolean" },
      load: { type: "string" },
      council: { type: "string", short: "c" },
      analytics: { type: "boolean" },
      search: { type: "string" },
      criteria: { type: "string" },
      delete: { type: "string" },
      promote: { type: "string" },
      demote: { type: "string" },
      ephemeral: { type: "boolean" },
      "ephemeral-exec": { type: "boolean" },
      "promote-n-sessions": { type: "string" },
      "freshness-days": { type: "string" },
      "promote-min-days": { type: "string" },
      "promote-min-persisted-ratio": { type: "string" },
      "force-promote": { type: "boolean" },
      scope: { type: "string" },
      tools: { type: "string" },
      format: { type: "string" },
      "auto-attach-globs": { type: "string" },
      "always-apply": { type: "boolean", default: false },
      "dry-run": { type: "boolean" },
      help: { type: "boolean", short: "h" },
    },
  });
  return values as AgentArgs;
}
