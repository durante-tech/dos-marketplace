/**
 * Shared pronunciation preprocessing for speech generation.
 *
 * Loads pronunciation rules from a JSON config file and applies
 * word-boundary replacements before sending text to any TTS provider.
 * Extracted from VoiceServer for reuse across the Speech collection.
 */

import { readFileSync } from "node:fs";

interface PronunciationEntry {
  term: string;
  phonetic: string;
  note?: string;
}

interface PronunciationConfig {
  replacements: PronunciationEntry[];
}

interface CompiledRule {
  regex: RegExp;
  phonetic: string;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Load and compile pronunciation rules from a JSON file.
 * Returns compiled regex rules for efficient repeated application.
 */
export function loadPronunciationRules(configPath: string): CompiledRule[] {
  try {
    const content = readFileSync(configPath, "utf-8");
    const config: PronunciationConfig = JSON.parse(content);

    return config.replacements.map((entry) => ({
      regex: new RegExp(`\\b${escapeRegex(entry.term)}\\b`, "g"),
      phonetic: entry.phonetic,
    }));
  } catch {
    return [];
  }
}

/**
 * Apply pronunciation replacements to text before TTS.
 */
export function applyPronunciations(
  text: string,
  rules: CompiledRule[],
): string {
  let result = text;
  for (const rule of rules) {
    result = result.replace(rule.regex, rule.phonetic);
  }
  return result;
}
