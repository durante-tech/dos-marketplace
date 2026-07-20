#!/usr/bin/env bun
/**
 * ConfigSync.hook.ts — Bidirectional config sync with Studio (SessionStart)
 *
 * Thin SessionStart wrapper around `lib/config-sync.ts`. The same helper is
 * also called inline by LoadContext and BuildCLAUDE so their reads of
 * settings.json reflect Studio even though SessionStart hooks run in
 * parallel with no documented ordering (belt-and-suspenders — this hook
 * stays registered as a safety net; its second call hits the 304 fast path).
 *
 * TRIGGER: SessionStart
 */

import { ensureConfigSynced } from './lib/config-sync';
import { startTimer, stopTimer } from './lib/hook-io';

const _t = startTimer('ConfigSync');
process.on('exit', () => stopTimer(_t, 'SessionStart'));

ensureConfigSynced()
  .then(() => process.exit(0))
  .catch(() => process.exit(0));
