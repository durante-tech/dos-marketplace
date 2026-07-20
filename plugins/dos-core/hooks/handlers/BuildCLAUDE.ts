#!/usr/bin/env bun

/**
 * BuildCLAUDE.ts — SessionStart hook
 *
 * Checks if CLAUDE.md needs rebuilding (algorithm version changed,
 * DA name changed, unresolved variables). If so, regenerates from template.
 *
 * Current session uses the existing CLAUDE.md (already loaded by Claude
 * Code before any hook fires — structural lag). Rebuild ensures the NEXT
 * session gets the fresh version.
 *
 * Calls ensureConfigSynced() FIRST so the rebuild decision is made against
 * the freshly-pulled Studio config; without this, BuildCLAUDE and
 * ConfigSync race at SessionStart and the rebuild check typically runs
 * against the pre-sync settings.json — extending CLAUDE.md propagation
 * lag from 1 session to 2.
 */

import { needsRebuild, build } from "../../DOS/Tools/BuildCLAUDE.ts";
import { startTimer, stopTimer } from '../lib/hook-io';
import { ensureConfigSynced } from '../lib/config-sync';

const _t = startTimer('DocRebuild');

async function main(): Promise<void> {
  try {
    await ensureConfigSynced();

    if (needsRebuild()) {
      const result = build();
      if (result.rebuilt) {
        console.error("🔄 CLAUDE.md rebuilt from template (will take effect next session)");
      }
    }
  } finally {
    stopTimer(_t, 'SessionStart');
  }
}

main();
