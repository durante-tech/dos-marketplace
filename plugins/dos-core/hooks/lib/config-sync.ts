/**
 * config-sync.ts — Studio config sync helper
 *
 * Shared implementation behind ConfigSync.hook.ts and inline callers
 * (LoadContext, BuildCLAUDE). Exposes a single entry point:
 *
 *   await ensureConfigSynced();
 *
 * Behavior is identical to the original ConfigSync hook: pulls the remote
 * DOS config from Studio on session start, merges syncable sections
 * (daidentity, principal, notifications, techStack, preferences,
 * spinnerVerbs) into local settings.json, leaves system-internal sections
 * (hooks, permissions, env) alone.
 *
 * Safe to call multiple times per session — the server's conditional-fetch
 * (`?version=N`) short-circuits to 304 after the first successful sync, so
 * subsequent calls cost one HTTP round-trip (~5-15 ms).
 *
 * RATIONALE:
 * Claude Code runs all SessionStart hooks in parallel with no ordering
 * primitive (docs: https://code.claude.com/docs/en/hooks.md). Consumers
 * that need fresh settings.json (LoadContext banner, BuildCLAUDE rebuild
 * decision) invoke this helper at the top of their main(), guaranteeing
 * settings.json reflects Studio before they read it.
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { getDosDir, getSettingsPath, loadProjectEnv } from './paths';
import { atomicWriteSync } from './atomic-write';

const SYNCABLE_SECTIONS = [
  'daidentity',
  'principal',
  'notifications',
  'techStack',
  'preferences',
  'spinnerVerbs',
] as const;

const REQUEST_TIMEOUT_MS = 5000;

export async function ensureConfigSynced(): Promise<void> {
  // Subagents inherit parent settings — skip sync
  if (process.env.CLAUDE_AGENT_TYPE !== undefined) return;

  const settingsPath = getSettingsPath();
  if (!existsSync(settingsPath)) return;

  let settings: Record<string, unknown>;
  try {
    settings = JSON.parse(readFileSync(settingsPath, 'utf-8'));
  } catch {
    console.error('[ConfigSync] Failed to parse settings.json');
    return;
  }

  // Load env cascade (project → cwd → ~/.claude/.gateway.env)
  loadProjectEnv();

  const studioUrl = process.env.STUDIO_API_URL;
  const studioApiKey = process.env.STUDIO_API_KEY;
  if (!studioUrl || !studioApiKey) return;

  // Conditional fetch — version stored from last successful sync
  const stateDir = join(getDosDir(), 'MEMORY', 'STATE');
  const versionPath = join(stateDir, 'config-sync-version.json');
  let currentVersion: number | null = null;
  try {
    if (existsSync(versionPath)) {
      const state = JSON.parse(readFileSync(versionPath, 'utf-8'));
      currentVersion = state.version ?? null;
    }
  } catch {
    // Ignore — full fetch on next call
  }

  const versionParam = currentVersion !== null ? `?version=${currentVersion}` : '';
  const syncUrl = `${studioUrl}/api/v1/config/sync${versionParam}`;

  try {
    const response = await fetch(syncUrl, {
      headers: { Authorization: `Bearer ${studioApiKey}` },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (response.status === 304) {
      console.error('[ConfigSync] Config up to date');
      return;
    }

    if (response.status === 404) {
      // No config stored in Studio yet — push local up
      await pushLocalConfig(studioUrl, studioApiKey, settings);
      return;
    }

    if (!response.ok) {
      console.error(
        `[ConfigSync] API error: ${response.status} ${response.statusText}`,
      );
      return;
    }

    const data = (await response.json()) as {
      config: Record<string, unknown>;
      version: number;
      updatedAt: string;
    };

    let changed = false;
    for (const section of SYNCABLE_SECTIONS) {
      if (section in data.config) {
        const remoteValue = JSON.stringify(data.config[section]);
        const localValue = JSON.stringify(settings[section]);
        if (remoteValue !== localValue) {
          settings[section] = data.config[section];
          changed = true;
        }
      }
    }

    if (changed) {
      // RFC-0005 §13.1 R2: atomic write — settings.json is read by many hooks;
      // a torn write would break the whole hook system.
      atomicWriteSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');
      console.error('[ConfigSync] Settings updated from Studio');
    }

    atomicWriteSync(
      versionPath,
      JSON.stringify({ version: data.version, updatedAt: data.updatedAt }),
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[ConfigSync] Sync failed: ${message}`);
  }
}

async function pushLocalConfig(
  studioUrl: string,
  apiKey: string,
  settings: Record<string, unknown>,
): Promise<void> {
  const syncPayload: Record<string, unknown> = {};
  for (const section of SYNCABLE_SECTIONS) {
    if (section in settings) {
      syncPayload[section] = settings[section];
    }
  }
  if (Object.keys(syncPayload).length === 0) return;

  try {
    const response = await fetch(`${studioUrl}/api/v1/config/sync`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(syncPayload),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (response.ok) {
      const data = (await response.json()) as {
        version: number;
        updatedAt: string;
      };
      const stateDir = join(getDosDir(), 'MEMORY', 'STATE');
      const versionPath = join(stateDir, 'config-sync-version.json');
      atomicWriteSync(
        versionPath,
        JSON.stringify({ version: data.version, updatedAt: data.updatedAt }),
      );
      console.error('[ConfigSync] Local config pushed to Studio');
    }
  } catch {
    // Best-effort push — don't block session start
  }
}
