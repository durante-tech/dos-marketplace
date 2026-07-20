/**
 * Voice subsystem constants — canonical TypeScript source.
 *
 * The TS side owns these two literals. The bash side owns the same values
 * in `voice.sh`. When either canonical changes, change BOTH FILES; drift is
 * caught by `DOS/Tools/voice-constants.test.ts` (it regex-extracts the bash
 * literals and asserts equality with these exports).
 *
 * A single-source intermediate (e.g., JSON read by both languages) was
 * considered and rejected — it adds a third moving piece without
 * eliminating the cross-language coordination duty. Two canonicals,
 * one short distance apart, beats three.
 *
 * Every TypeScript caller that previously hardcoded `"fTtv3eikoepIosk8dTZ5"`
 * or `"http://localhost:8888/notify"` MUST now import from this file.
 * Grep `fTtv3eikoepIosk8dTZ5` in TS source should return only this file.
 */

export const FOX_VOICE_ID = "fTtv3eikoepIosk8dTZ5";
export const VOICE_BRIDGE_URL = "http://localhost:8888/notify";
export const VOICE_BRIDGE_PERSONALITY_URL = `${VOICE_BRIDGE_URL}/personality`;
