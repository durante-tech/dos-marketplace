/**
 * Central Identity Loader
 * Single source of truth for DA (Digital Assistant) and Principal identity
 *
 * Reads from settings.json - the programmatic way, not markdown parsing.
 * All hooks and tools should import from here.
 *
 * SCHEMA OWNERSHIP: This module is the SOLE TS owner of the
 * `daidentity.voices.<mode>.voiceId` chain shape. Every TS caller MUST go
 * through `getMainVoiceId()`, `getAlgorithmVoiceId()`, `getAlgorithmVoice()`,
 * `getIdentity()`, or `setVoiceConfig()`. Inline walks of the chain anywhere
 * else are a G36 (Demeter) violation. Bash mirror lives in
 * `DOS/Tools/voice-paths.sh` — change both when the schema changes.
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { FOX_VOICE_ID } from '../../DOS/Tools/voice-constants';

const HOME = process.env.HOME!;
const SETTINGS_PATH = join(HOME, '.claude/settings.json');

// Default identity (fallback if settings.json doesn't have identity section)
const DEFAULT_IDENTITY = {
  name: 'DOS',
  fullName: 'Personal AI',
  displayName: 'DOS',
  mainDAVoiceID: '',
  color: '#3B82F6',
};

const DEFAULT_PRINCIPAL = {
  name: 'User',
  pronunciation: '',
  timezone: 'UTC',
};

export interface VoiceProsody {
  stability: number;
  similarity_boost: number;
  style: number;
  speed: number;
  use_speaker_boost: boolean;
}

export interface VoicePersonality {
  baseVoice: string;
  enthusiasm: number;
  energy: number;
  expressiveness: number;
  resilience: number;
  composure: number;
  optimism: number;
  warmth: number;
  formality: number;
  directness: number;
  precision: number;
  curiosity: number;
  playfulness: number;
}

export interface Identity {
  name: string;
  fullName: string;
  displayName: string;
  mainDAVoiceID: string;
  color: string;
  voice?: VoiceProsody;
  personality?: VoicePersonality;
}

export interface Principal {
  name: string;
  pronunciation: string;
  timezone: string;
}

export interface Settings {
  daidentity?: Partial<Identity>;
  principal?: Partial<Principal>;
  env?: Record<string, string>;
  [key: string]: unknown;
}

let cachedSettings: Settings | null = null;

/**
 * Load settings.json (cached)
 */
function loadSettings(): Settings {
  if (cachedSettings) return cachedSettings;

  try {
    if (!existsSync(SETTINGS_PATH)) {
      cachedSettings = {};
      return cachedSettings;
    }

    const content = readFileSync(SETTINGS_PATH, 'utf-8');
    cachedSettings = JSON.parse(content);
    return cachedSettings!;
  } catch {
    cachedSettings = {};
    return cachedSettings;
  }
}

/**
 * Get DA (Digital Assistant) identity from settings.json
 */
export function getIdentity(): Identity {
  const settings = loadSettings();

  // Prefer settings.daidentity, fall back to env.DA for backward compat
  const daidentity = settings.daidentity || {};
  const envDA = settings.env?.DA;

  // Support both old (daidentity.voice) and new (daidentity.voices.main) structures
  const voices = (daidentity as any).voices || {};
  const voiceConfig = voices.main || (daidentity as any).voice;

  return {
    name: daidentity.name || envDA || DEFAULT_IDENTITY.name,
    fullName: daidentity.fullName || daidentity.name || envDA || DEFAULT_IDENTITY.fullName,
    displayName: daidentity.displayName || daidentity.name || envDA || DEFAULT_IDENTITY.displayName,
    mainDAVoiceID: voiceConfig?.voiceId || (daidentity as any).voiceId || daidentity.mainDAVoiceID || DEFAULT_IDENTITY.mainDAVoiceID,
    color: daidentity.color || DEFAULT_IDENTITY.color,
    voice: voiceConfig as VoiceProsody | undefined,
    personality: (daidentity as any).personality as VoicePersonality | undefined,
  };
}

/**
 * Get Principal (human owner) identity from settings.json
 */
export function getPrincipal(): Principal {
  const settings = loadSettings();

  // Prefer settings.principal, fall back to env.PRINCIPAL for backward compat
  const principal = settings.principal || {};
  const envPrincipal = settings.env?.PRINCIPAL;

  return {
    name: principal.name || envPrincipal || DEFAULT_PRINCIPAL.name,
    pronunciation: principal.pronunciation || DEFAULT_PRINCIPAL.pronunciation,
    timezone: principal.timezone || DEFAULT_PRINCIPAL.timezone,
  };
}

/**
 * Clear cache (useful for testing or when settings.json changes)
 */
export function clearCache(): void {
  cachedSettings = null;
}

/**
 * Get just the DA name (convenience function)
 */
export function getDAName(): string {
  return getIdentity().name;
}

/**
 * Get just the Principal name (convenience function)
 */
export function getPrincipalName(): string {
  return getPrincipal().name;
}

/**
 * Get just the voice ID (convenience function)
 */
export function getVoiceId(): string {
  return getIdentity().mainDAVoiceID;
}

/**
 * Get the full settings object (for advanced use)
 */
export function getSettings(): Settings {
  return loadSettings();
}

/**
 * Get the default identity (for documentation/testing)
 */
export function getDefaultIdentity(): Identity {
  return { ...DEFAULT_IDENTITY };
}

/**
 * Get the default principal (for documentation/testing)
 */
export function getDefaultPrincipal(): Principal {
  return { ...DEFAULT_PRINCIPAL };
}

/**
 * Get algorithm voice settings from settings.json → daidentity.voices.algorithm
 * Returns { voiceId, voiceName, stability, similarity_boost, style, speed, use_speaker_boost, volume }
 * or null if not configured.
 */
export function getAlgorithmVoice(): { voiceId: string; voiceName: string; stability: number; similarity_boost: number; style: number; speed: number; use_speaker_boost: boolean; volume?: number } | null {
  const settings = loadSettings();
  const voices = (settings.daidentity as any)?.voices;
  if (!voices?.algorithm?.voiceId) return null;
  return voices.algorithm;
}

/**
 * Resolve the main voice ID with full fallback chain → FOX_VOICE_ID.
 * Single canonical accessor — callers must NOT walk the daidentity.voices chain.
 */
export function getMainVoiceId(): string {
  return getIdentity().mainDAVoiceID || FOX_VOICE_ID;
}

/**
 * Resolve the algorithm voice ID with fallback to main → FOX_VOICE_ID.
 * Single canonical accessor — callers must NOT walk the daidentity.voices chain.
 */
export function getAlgorithmVoiceId(): string {
  return getAlgorithmVoice()?.voiceId || getIdentity().mainDAVoiceID || FOX_VOICE_ID;
}

/**
 * Mutate a settings object to install/update voice configuration for a mode.
 * Single canonical writer — callers must NOT mutate `daidentity.voices.<mode>` directly.
 *
 * - For 'main' mode, also mirrors `voiceId` to the legacy `daidentity.voiceId`
 *   field for backward-compat readers.
 * - Accepts partial updates: if the mode entry already exists, fields are merged
 *   (Object.assign); otherwise the partial becomes the full entry.
 *
 * Caller is responsible for load + save (readFileSync / writeFileSync).
 */
export function setVoiceConfig(
  settings: any,
  mode: 'main' | 'algorithm',
  partial: { voiceId: string; voiceName?: string; stability?: number; similarityBoost?: number; style?: number; speed?: number; use_speaker_boost?: boolean; volume?: number }
): void {
  if (!settings.daidentity) return;
  settings.daidentity.voices = settings.daidentity.voices || {};
  if (settings.daidentity.voices[mode]) {
    Object.assign(settings.daidentity.voices[mode], partial);
  } else {
    settings.daidentity.voices[mode] = { ...partial };
  }
  if (mode === 'main' && partial.voiceId) {
    settings.daidentity.voiceId = partial.voiceId; // legacy mirror
  }
}

/**
 * Get voice prosody settings (convenience function) - legacy ElevenLabs
 */
export function getVoiceProsody(): VoiceProsody | undefined {
  return getIdentity().voice;
}

/**
 * Get voice personality settings (convenience function) - Qwen3-TTS
 */
export function getVoicePersonality(): VoicePersonality | undefined {
  return getIdentity().personality;
}
