import type { ProsodySettings, ClaudeCodeColorName } from "./types.ts";

const HOME = process.env.HOME || "~";

export const BASE_TRAITS_PATH = `${HOME}/.claude/skills/agents/Data/Traits.yaml`;
export const USER_TRAITS_PATH = `${HOME}/.claude/DOS/USER/SKILLCUSTOMIZATIONS/Agents/Traits.yaml`;
export const TEMPLATE_PATH = `${HOME}/.claude/skills/agents/Templates/DynamicAgent.hbs`;
export const SAVED_AGENT_TEMPLATE_PATH = `${HOME}/.claude/skills/agents/Tools/compose/templates/saved-agent.hbs`;
export const COUNCILS_PATH = `${HOME}/.claude/skills/agents/Tools/compose/councils.yaml`;
export const HELP_TEXT_PATH = `${HOME}/.claude/skills/agents/Tools/compose/help.txt`;
export const CUSTOM_AGENTS_DIR = `${HOME}/.claude/custom-agents`;
export const ANALYTICS_PATH = `${HOME}/.claude/MEMORY/ARTIFACTS/trait-compositions.jsonl`;
export const ARTIFACTS_PATH = `${HOME}/.claude/MEMORY/ARTIFACTS/artifacts.jsonl`;

export const AGENT_COLOR_PALETTE = [
  "#FF6B35",
  "#4ECDC4",
  "#9B59B6",
  "#2ECC71",
  "#E74C3C",
  "#3498DB",
  "#F39C12",
  "#1ABC9C",
  "#E91E63",
  "#00BCD4",
  "#8BC34A",
  "#FF5722",
  "#673AB7",
  "#009688",
  "#FFC107",
];

export const HEX_TO_NAMED_COLOR: Record<string, ClaudeCodeColorName> = {
  "#FF6B35": "orange",
  "#4ECDC4": "cyan",
  "#9B59B6": "purple",
  "#2ECC71": "green",
  "#E74C3C": "red",
  "#3498DB": "blue",
  "#F39C12": "orange",
  "#1ABC9C": "cyan",
  "#E91E63": "pink",
  "#00BCD4": "cyan",
  "#8BC34A": "green",
  "#FF5722": "orange",
  "#673AB7": "purple",
  "#009688": "cyan",
  "#FFC107": "yellow",
};

export const DEFAULT_PROSODY: ProsodySettings = {
  stability: 0.5,
  similarity_boost: 0.75,
  style: 0.0,
  speed: 1.0,
  use_speaker_boost: true,
  volume: 0.8,
};

export const PERSONALITY_PROSODY: Record<string, Partial<ProsodySettings>> = {
  skeptical:    { stability: 0.60, style: 0.10, speed: 0.95, volume: 0.85 },
  analytical:   { stability: 0.65, style: 0.08, speed: 0.95, volume: 0.85 },
  enthusiastic: { stability: 0.35, style: 0.40, speed: 1.10, volume: 0.90 },
  contrarian:   { stability: 0.50, style: 0.20, speed: 1.00, volume: 0.90 },
  pragmatic:    { stability: 0.60, style: 0.05, speed: 1.00, volume: 0.85 },
  cautious:     { stability: 0.70, style: 0.05, speed: 0.90, volume: 0.80 },
  bold:         { stability: 0.40, style: 0.35, speed: 1.05, volume: 0.95 },
  empathetic:   { stability: 0.55, style: 0.15, speed: 0.95, volume: 0.80 },
  meticulous:   { stability: 0.70, style: 0.05, speed: 0.85, volume: 0.85 },
};
