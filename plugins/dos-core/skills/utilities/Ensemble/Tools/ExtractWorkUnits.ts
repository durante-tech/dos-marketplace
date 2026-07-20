#!/usr/bin/env bun
/**
 * ExtractWorkUnits — walk a markdown artifact, emit a list of work units.
 *
 * A work unit is a depth ≥ 2 heading section that contains either body text
 * or acceptance checkboxes. The H1 (artifact title) is always skipped.
 *
 * Unit section numbers use hierarchical counters (1, 1.1, 1.1.1, 2, 2.1, ...).
 */

import { readFileSync } from "node:fs";

export type WorkUnit = {
  id: string;
  title: string;
  artifact_section: string;
  acceptance_criteria: string[];
  raw_content: string;
};

const RAW_CONTENT_CAP = 4000;

export function extractWorkUnits(artifactPath: string): WorkUnit[] {
  const md = readFileSync(artifactPath, "utf8");
  return extractFromString(md);
}

export function extractFromString(md: string): WorkUnit[] {
  const lines = md.split("\n");

  type Frame = { level: number; title: string; section: string; startLine: number };
  const allFrames: Frame[] = [];
  const openStack: Frame[] = [];
  const counters: number[] = [];

  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(#+)\s+(.+?)\s*$/);
    if (!m) continue;
    const level = m[1].length;
    const title = stripHeadingNumber(m[2].trim());

    while (openStack.length && openStack[openStack.length - 1].level >= level) {
      openStack.pop();
    }
    while (counters.length > level - 1) counters.pop();
    while (counters.length < level - 1) counters.push(0);
    counters[level - 1] = (counters[level - 1] ?? 0) + 1;

    const section = counters.slice(0, level).map(String).join(".");
    const frame: Frame = { level, title, section, startLine: i };
    openStack.push(frame);
    allFrames.push(frame);
  }

  const units: WorkUnit[] = [];
  for (let i = 0; i < allFrames.length; i++) {
    const f = allFrames[i];
    if (f.level < 2) continue;
    const end = nextFrameAtOrAbove(allFrames, i, f.level)?.startLine ?? lines.length;
    const body = lines.slice(f.startLine + 1, end).join("\n");
    const acceptance = [...body.matchAll(/^\s*-\s*\[\s?\]\s+(.+)$/gm)].map((m) => m[1].trim());
    const trimmed = body.trim();
    if (trimmed.length === 0 && acceptance.length === 0) continue;
    units.push({
      id: `W${units.length + 1}`,
      title: f.title,
      artifact_section: `§${f.section}`,
      acceptance_criteria: acceptance,
      raw_content: trimmed.slice(0, RAW_CONTENT_CAP),
    });
  }
  return units;
}

function nextFrameAtOrAbove(
  frames: Array<{ level: number; startLine: number }>,
  startIdx: number,
  level: number,
): { startLine: number } | null {
  for (let i = startIdx + 1; i < frames.length; i++) {
    if (frames[i].level <= level) return frames[i];
  }
  return null;
}

function stripHeadingNumber(s: string): string {
  return s.replace(/^(?:§\s*)?(?:\d+(?:\.\d+)*)\.?\s+/, "").trim();
}

if (import.meta.main) {
  const path = process.argv[2];
  if (!path) {
    process.stderr.write("usage: bun ExtractWorkUnits.ts <artifact.md>\n");
    process.exit(2);
  }
  process.stdout.write(JSON.stringify(extractWorkUnits(path), null, 2) + "\n");
}
