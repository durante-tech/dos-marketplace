#!/usr/bin/env bun
/**
 * TranscriptParser.ts - Claude transcript parsing utilities
 *
 * Shared library for extracting content from Claude Code transcript files.
 * Used by Stop hooks for voice, tab state, and response capture.
 *
 * CLI Usage:
 *   bun TranscriptParser.ts <transcript_path>
 *   bun TranscriptParser.ts <transcript_path> --voice
 *   bun TranscriptParser.ts <transcript_path> --plain
 *   bun TranscriptParser.ts <transcript_path> --structured
 *   bun TranscriptParser.ts <transcript_path> --state
 *
 * Module Usage:
 *   import { parseTranscript, getLastAssistantMessage } from './TranscriptParser'
 */

import { readFileSync } from 'fs';
import { getIdentity } from '../../hooks/lib/identity';

const DA_IDENTITY = getIdentity();

// ============================================================================
// Types
// ============================================================================

export interface StructuredResponse {
  date?: string;
  summary?: string;
  analysis?: string;
  actions?: string;
  results?: string;
  status?: string;
  next?: string;
  completed?: string;
}

export type ResponseState = 'awaitingInput' | 'completed' | 'error';

export interface ParsedTranscript {
  /** Raw transcript content */
  raw: string;
  /** Last assistant message text */
  lastMessage: string;
  /** Last REAL user prompt text — the human message that triggered the
   * current response turn. Filters out `tool_result` entries that share
   * `type: "user"` in Claude Code transcripts. Empty string when no real
   * user prompt is present (e.g., freshly-seeded transcript, parse error).
   * See `parseLastUserMessage` for the detection logic. */
  userPrompt: string;
  /** Full text from current response turn (all assistant blocks combined) */
  currentResponseText: string;
  /** Voice completion text (for TTS) */
  voiceCompletion: string;
  /** Plain completion text (for tab title) */
  plainCompletion: string;
  /** Structured sections extracted from response */
  structured: StructuredResponse;
  /** Response state for tab coloring */
  responseState: ResponseState;
}

// ============================================================================
// Core Parsing Functions
// ============================================================================

/**
 * Safely convert Claude content (string or array of blocks) to plain text.
 */
export function contentToText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map(c => {
        if (typeof c === 'string') return c;
        if (c?.text) return c.text;
        if (c?.content) return contentToText(c.content);
        return '';
      })
      .join(' ')
      .trim();
  }
  return '';
}

/**
 * Parse last assistant message from transcript content.
 * Takes raw content string to avoid re-reading file.
 */
export function parseLastAssistantMessage(transcriptContent: string): string {
  const lines = transcriptContent.trim().split('\n');
  let lastAssistantMessage = '';

  for (const line of lines) {
    if (line.trim()) {
      try {
        const entry = JSON.parse(line) as any;
        if (entry.type === 'assistant' && entry.message?.content) {
          const text = contentToText(entry.message.content);
          if (text) {
            lastAssistantMessage = text;
          }
        }
      } catch {
        // Skip invalid JSON lines
      }
    }
  }

  return lastAssistantMessage;
}

/**
 * Extract the user-authored text blocks from a `type: "user"` transcript
 * entry's `content` field. Returns an empty array when the entry is a
 * tool_result (Claude Code reuses `type: "user"` for both real prompts
 * and tool_result blocks) or has no non-empty text blocks.
 *
 * Contract:
 *   string content               → [content]  (always a real user prompt)
 *   array with {type:text} block → [trimmed-non-empty texts]
 *   array with only tool_result  → []  (caller treats this as "not real")
 *   anything else                → []
 *
 * Use `.length > 0` as the real-user-prompt discriminator.
 */
export function extractUserTextBlocks(content: unknown): string[] {
  if (typeof content === 'string') return [content];
  if (!Array.isArray(content)) return [];
  const out: string[] = [];
  for (const b of content as any[]) {
    if (b?.type === 'text' && typeof b?.text === 'string' && b.text.trim().length > 0) {
      out.push(b.text as string);
    }
  }
  return out;
}

/**
 * Parse the last REAL user prompt from a transcript. Mirrors
 * `parseLastAssistantMessage` but uses `extractUserTextBlocks` to skip
 * `type: "user"` entries that are actually tool_result blocks mid-response.
 */
export function parseLastUserMessage(transcriptContent: string): string {
  const lines = transcriptContent.trim().split('\n');
  let lastUserMessage = '';

  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const entry = JSON.parse(line) as any;
      if (entry.type !== 'human' && entry.type !== 'user') continue;
      const texts = extractUserTextBlocks(entry.message?.content);
      if (texts.length > 0) {
        lastUserMessage = texts.join('\n');
      }
    } catch {
      // Skip invalid JSON lines
    }
  }

  return lastUserMessage;
}

/**
 * Collect assistant text from the CURRENT response turn only.
 * A "turn" is everything after the last human message in the transcript.
 * This prevents voice/completion extraction from picking up stale lines
 * from previous turns when the Stop hook fires.
 *
 * Within a single turn, there may be multiple assistant entries
 * (text → tool_use → tool_result → more text). All are collected.
 */
export function collectCurrentResponseText(transcriptContent: string): string {
  const lines = transcriptContent.trim().split('\n');

  // Find the index of the last REAL user prompt. Claude Code transcripts
  // reuse type='user' for both real prompts AND tool_result entries; the
  // shared `extractUserTextBlocks` helper returns non-empty only for real
  // prompts, so `.length > 0` is the discriminator.
  let lastHumanIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    try {
      const entry = JSON.parse(lines[i]) as any;
      if (entry.type !== 'human' && entry.type !== 'user') continue;
      if (extractUserTextBlocks(entry.message?.content).length > 0) {
        lastHumanIndex = i;
      }
    } catch {
      // Skip invalid JSON lines
    }
  }

  // Collect only assistant text AFTER the last human message
  const textParts: string[] = [];
  for (let i = lastHumanIndex + 1; i < lines.length; i++) {
    if (lines[i].trim()) {
      try {
        const entry = JSON.parse(lines[i]) as any;
        if (entry.type === 'assistant' && entry.message?.content) {
          const text = contentToText(entry.message.content);
          if (text) {
            textParts.push(text);
          }
        }
      } catch {
        // Skip invalid JSON lines
      }
    }
  }

  return textParts.join('\n');
}

/**
 * Get last assistant message from transcript file.
 * Convenience function that reads file and parses.
 */
export function getLastAssistantMessage(transcriptPath: string): string {
  try {
    const content = readFileSync(transcriptPath, 'utf-8');
    return parseLastAssistantMessage(content);
  } catch (error) {
    console.error('[TranscriptParser] Error reading transcript:', error);
    return '';
  }
}

// ============================================================================
// Extraction Functions
// ============================================================================

/**
 * Extract voice completion line for TTS.
 * Uses LAST match to avoid capturing mentions in analysis text.
 */
export function extractVoiceCompletion(text: string): string {
  // Remove system-reminder tags
  text = text.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, '');

  // Use global flag and find LAST match (voice line is at end of response)
  const completedPatterns = [
    new RegExp(`🗣️\\s*\\*{0,2}${DA_IDENTITY.name}:?\\*{0,2}\\s*(.+?)(?:\\n|$)`, 'gi'),
    /🎯\s*\*{0,2}COMPLETED:?\*{0,2}\s*(.+?)(?:\n|$)/gi,
  ];

  for (const pattern of completedPatterns) {
    const matches = [...text.matchAll(pattern)];
    if (matches.length > 0) {
      // Use LAST match - the actual voice line at end of response
      const lastMatch = matches[matches.length - 1];
      if (lastMatch && lastMatch[1]) {
        let completed = lastMatch[1].trim();
        // Clean up agent tags
        completed = completed.replace(/^\[AGENT:\w+\]\s*/i, '');
        // Voice server handles sanitization
        return completed.trim();
      }
    }
  }

  // Don't say anything if no voice line found
  return '';
}

/**
 * Extract plain completion text for display/tab titles.
 * Uses LAST match to avoid capturing mentions in analysis text.
 */
export function extractCompletionPlain(text: string): string {
  text = text.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, '');

  // Use global flag and find LAST match (voice line is at end of response)
  const completedPatterns = [
    new RegExp(`🗣️\\s*\\*{0,2}${DA_IDENTITY.name}:?\\*{0,2}\\s*(.+?)(?:\\n|$)`, 'gi'),
    /🎯\s*\*{0,2}COMPLETED:?\*{0,2}\s*(.+?)(?:\n|$)/gi,
  ];

  for (const pattern of completedPatterns) {
    const matches = [...text.matchAll(pattern)];
    if (matches.length > 0) {
      // Use LAST match - the actual voice line at end of response
      const lastMatch = matches[matches.length - 1];
      if (lastMatch && lastMatch[1]) {
        let completed = lastMatch[1].trim();
        completed = completed.replace(/^\[AGENT:\w+\]\s*/i, '');
        completed = completed.replace(/\[.*?\]/g, '');
        completed = completed.replace(/\*\*/g, '');
        completed = completed.replace(/\*/g, '');
        completed = completed.replace(/[\p{Emoji}\p{Emoji_Component}]/gu, '');
        completed = completed.replace(/\s+/g, ' ').trim();
        return completed;
      }
    }
  }

  // Fallback: try to extract something meaningful from the response
  const summaryMatch = text.match(/📋\s*\*{0,2}SUMMARY:?\*{0,2}\s*(.+?)(?:\n|$)/i);
  if (summaryMatch && summaryMatch[1]) {
    let summary = summaryMatch[1].trim().slice(0, 30);
    return summary.length > 27 ? summary.slice(0, 27) + '…' : summary;
  }

  // No voice line found — return empty, let downstream handle fallback
  return '';
}

/**
 * Extract structured sections from response.
 */
export function extractStructuredSections(text: string): StructuredResponse {
  const result: StructuredResponse = {};

  text = text.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, '');

  const patterns: Record<keyof StructuredResponse, RegExp> = {
    date: /📅\s*(.+?)(?:\n|$)/i,
    summary: /📋\s*SUMMARY:\s*(.+?)(?:\n|$)/i,
    analysis: /🔍\s*ANALYSIS:\s*(.+?)(?:\n|$)/i,
    actions: /⚡\s*ACTIONS:\s*(.+?)(?:\n|$)/i,
    results: /✅\s*RESULTS:\s*(.+?)(?:\n|$)/i,
    status: /📊\s*STATUS:\s*(.+?)(?:\n|$)/i,
    next: /➡️\s*NEXT:\s*(.+?)(?:\n|$)/i,
    completed: new RegExp(`(?:🗣️\\s*${DA_IDENTITY.name}:|🎯\\s*COMPLETED:)\\s*(.+?)(?:\\n|$)`, 'i'),
  };

  for (const [key, pattern] of Object.entries(patterns)) {
    const match = text.match(pattern);
    if (match && match[1]) {
      result[key as keyof StructuredResponse] = match[1].trim();
    }
  }

  return result;
}

// ============================================================================
// State Detection
// ============================================================================

/**
 * Detect response state for tab coloring.
 * Takes parsed content to avoid re-reading file.
 */
export function detectResponseState(lastMessage: string, transcriptContent: string): ResponseState {
  try {
    // Check if the LAST assistant message used AskUserQuestion
    const lines = transcriptContent.trim().split('\n');
    let lastAssistantEntry: any = null;

    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        if (entry.type === 'assistant' && entry.message?.content) {
          lastAssistantEntry = entry;
        }
      } catch {}
    }

    if (lastAssistantEntry?.message?.content) {
      const content = Array.isArray(lastAssistantEntry.message.content)
        ? lastAssistantEntry.message.content
        : [];
      for (const block of content) {
        if (block.type === 'tool_use' && block.name === 'AskUserQuestion') {
          return 'awaitingInput';
        }
      }
    }
  } catch (err) {
    console.error('[TranscriptParser] Error detecting response state:', err);
  }

  // Check for error indicators
  if (/📊\s*STATUS:.*(?:error|failed|broken|problem|issue)/i.test(lastMessage)) {
    return 'error';
  }

  const hasErrorKeyword = /\b(?:error|failed|exception|crash|broken)\b/i.test(lastMessage);
  const hasErrorEmoji = /❌|🚨|⚠️/.test(lastMessage);
  if (hasErrorKeyword && hasErrorEmoji) {
    return 'error';
  }

  return 'completed';
}

// ============================================================================
// Unified Parser
// ============================================================================

/**
 * Parse transcript and extract all relevant data in one pass.
 * This is the main function for the orchestrator pattern.
 */
export function parseTranscript(transcriptPath: string): ParsedTranscript {
  try {
    const raw = readFileSync(transcriptPath, 'utf-8');
    const lastMessage = parseLastAssistantMessage(raw);
    const userPrompt = parseLastUserMessage(raw);
    // Collect assistant text from CURRENT response turn only.
    // This prevents stale voice lines from previous turns being read
    // when the Stop hook fires. Within the current turn, multiple
    // assistant entries exist (text → tool_use → tool_result → more text).
    const currentResponseText = collectCurrentResponseText(raw);

    return {
      raw,
      lastMessage,
      userPrompt,
      currentResponseText,
      voiceCompletion: extractVoiceCompletion(currentResponseText),
      plainCompletion: extractCompletionPlain(currentResponseText),
      structured: extractStructuredSections(currentResponseText),
      responseState: detectResponseState(lastMessage, raw),
    };
  } catch (error) {
    console.error('[TranscriptParser] Error parsing transcript:', error);
    return {
      raw: '',
      lastMessage: '',
      userPrompt: '',
      currentResponseText: '',
      voiceCompletion: '',
      plainCompletion: '',
      structured: {},
      responseState: 'completed',
    };
  }
}

// ============================================================================
// CLI
// ============================================================================

if (import.meta.main) {
  const args = process.argv.slice(2);
  const transcriptPath = args.find(a => !a.startsWith('-'));

  if (!transcriptPath) {
    console.log(`Usage: bun TranscriptParser.ts <transcript_path> [options]

Options:
  --voice       Output voice completion (for TTS)
  --plain       Output plain completion (for tab titles)
  --structured  Output structured sections as JSON
  --state       Output response state
  --all         Output full parsed transcript as JSON (default)
`);
    process.exit(1);
  }

  const parsed = parseTranscript(transcriptPath);

  if (args.includes('--voice')) {
    console.log(parsed.voiceCompletion);
  } else if (args.includes('--plain')) {
    console.log(parsed.plainCompletion);
  } else if (args.includes('--structured')) {
    console.log(JSON.stringify(parsed.structured, null, 2));
  } else if (args.includes('--state')) {
    console.log(parsed.responseState);
  } else {
    // Default: output everything
    console.log(JSON.stringify(parsed, null, 2));
  }
}
