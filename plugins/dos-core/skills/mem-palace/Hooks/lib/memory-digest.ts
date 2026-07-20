/**
 * Single emit point for the `🪶 Memory: <body>` <system-reminder> digest
 * that surfaces memory-write hook activity into the CC TUI.
 *
 * Memory-write hooks were silent stderr-only before this; the council
 * (2026-04-28) named the asymmetry as the root cause of "memory feels
 * broken even when correct". Centralizing here prevents marker drift
 * across the four call sites (MemoryHarvest / MemPalaceLearn /
 * MemPalaceRate / CorrectionDetector).
 */

const VERBOSE_OFF = '0';

export function emitMemoryDigest(body: string): void {
  if (process.env.DOS_VERBOSE_MEMORY === VERBOSE_OFF) return;
  console.log(`<system-reminder>\n🪶 Memory: ${body}\n</system-reminder>`);
}
