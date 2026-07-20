import type { ClaudeCodeColorName } from "./types.ts";
import { AGENT_COLOR_PALETTE, HEX_TO_NAMED_COLOR } from "./constants.ts";

export function hexToNamedColor(hex: string): ClaudeCodeColorName {
  return HEX_TO_NAMED_COLOR[hex] ?? "cyan";
}

export function generateAgentColor(traitKeys: string[]): string {
  const sortedTraits = [...traitKeys].sort().join(",");
  let hash = 0;
  for (let i = 0; i < sortedTraits.length; i++) {
    const char = sortedTraits.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  const index = Math.abs(hash) % AGENT_COLOR_PALETTE.length;
  return AGENT_COLOR_PALETTE[index] ?? "cyan";
}
