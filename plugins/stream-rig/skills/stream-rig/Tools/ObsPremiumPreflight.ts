#!/usr/bin/env bun
// ObsPremiumPreflight.ts — bring a running OBS rig up to "premium" capture spec.
//
// Premium spec (coding/build-in-public stream on Apple Silicon + a Retina display):
//   - Canvas (Base) >= 3840x2160 so the Retina screen capture is supersampled,
//     with Output left as-is (e.g. 1920x1080) -> Lanczos downscale = razor-sharp.
//   - Every "Scaling/Aspect Ratio" source filter scaled to match the new canvas
//     (so a pinned 1080p filter stops crushing the capture before compositing).
//   - Record encoder = Apple VT HEVC HARDWARE (better quality/bit + frees CPU).
//
// Design contract:
//   - Reuses the on-PATH `obs` CLI (`obs raw <Type> <json>`) — does NOT fork
//     obs.ts / re-implement the websocket client (StreamRig ISC-A4).
//   - Idempotent: an already-premium rig is a clean no-op.
//   - Canvas resize correctly rescales EVERY scene item so layout is preserved:
//       * bounds items (bounds_type != 0): pos *= k, bounds *= k  (scale left alone -> preserves flip)
//       * non-bounds items (bounds_type == 0): pos *= k, scale *= k
//         ...UNLESS the item's source carries a scale_filter we also scaled by k
//         (then the source render size already grew by k, so scale stays).
//   - Canvas/filter changes go live via websocket. The record-encoder change is a
//     profile FILE edit (read at profile load), so it is applied only to a NON-ACTIVE
//     profile (safe) and otherwise reported for the operator to switch+reload.
//   - Refuses to touch video settings while OBS is actively recording/streaming.
//
// Usage:
//   bun ObsPremiumPreflight.ts            # auto-fix, then print what changed
//   bun ObsPremiumPreflight.ts --check    # report premium gaps only, no writes (exit 1 if gaps)
//   bun ObsPremiumPreflight.ts --dry-run  # print the plan, no writes
//   bun ObsPremiumPreflight.ts --record-profile "DuranteOS - Record"  # which profile to HEVC

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, copyFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const HOME = homedir();
const BASE_W = 3840;
const BASE_H = 2160;
const HEVC_HW = "com.apple.videotoolbox.videoencoder.ave.hevc";
const PROFILES_DIR = join(HOME, "Library/Application Support/obs-studio/basic/profiles");

const args = process.argv.slice(2);
const CHECK = args.includes("--check");
const DRY = args.includes("--dry-run");
const recIdx = args.indexOf("--record-profile");
const RECORD_PROFILE = recIdx >= 0 ? args[recIdx + 1] : null; // null => skip encoder step unless found

type Json = any;
const changes: string[] = [];
const gaps: string[] = [];

function obs(type: string, payload?: Json): Json {
  const a = ["raw", type];
  if (payload !== undefined) a.push(JSON.stringify(payload));
  const out = execFileSync(join(HOME, "scripts/obs"), a, { encoding: "utf-8" });
  return out.trim() ? JSON.parse(out) : {};
}

function round(n: number): number {
  // OBS positions are floats; keep 3dp to avoid drift noise.
  return Math.round(n * 1000) / 1000;
}

// ---- 0. guard: not mid-output ------------------------------------------------
function assertIdle() {
  const rec = obs("GetRecordStatus");
  const st = obs("GetStreamStatus");
  if (rec.outputActive || st.outputActive) {
    console.error("REFUSING: OBS is actively recording/streaming — canvas changes are blocked. Stop output first.");
    process.exit(2);
  }
}

// Collect every scene item across every scene, recursing into groups (GetSceneItemList
// returns only TOP-LEVEL items; a group's children come from GetGroupSceneItemList).
function allSceneItems(): Array<{ sceneName: string; item: Json }> {
  const out: Array<{ sceneName: string; item: Json }> = [];
  const scenes = obs("GetSceneList").scenes ?? [];
  for (const sc of scenes) {
    const sceneName = sc.sceneName;
    for (const it of obs("GetSceneItemList", { sceneName }).sceneItems ?? []) {
      out.push({ sceneName, item: it });
      if (it.isGroup) {
        // Children are positioned in the group's own coordinate space (relative to the
        // group), so they DO NOT get rescaled — the group item itself carries the canvas
        // transform. We surface a note but skip the children to avoid double-scaling.
        gaps.push(`note: group "${it.sourceName}" in "${sceneName}" — children scale with the group, not rescaled individually`);
      }
    }
  }
  return out;
}

// ---- 1. canvas supersample + filter + item rescale ---------------------------
function premiumCanvas() {
  const v = obs("GetVideoSettings");
  // Already premium if the canvas meets the 4K supersample floor on BOTH axes.
  if (v.baseWidth >= BASE_W && v.baseHeight >= BASE_H) return; // no-op

  // UNIFORM scale factor (kx == ky) that lifts the limiting axis to the premium floor
  // while PRESERVING the current aspect ratio — a non-uniform stretch to a fixed 16:9
  // would distort a 16:10 / ultrawide base. Target dims rounded to even px (encoder-friendly).
  const k = Math.max(BASE_W / v.baseWidth, BASE_H / v.baseHeight);
  const targetW = Math.round((v.baseWidth * k) / 2) * 2;
  const targetH = Math.round((v.baseHeight * k) / 2) * 2;
  gaps.push(`canvas ${v.baseWidth}x${v.baseHeight} -> ${targetW}x${targetH} (output ${v.outputWidth}x${v.outputHeight} kept)`);
  if (CHECK) return;

  // Discover scale_filters by scanning EVERY source referenced by a scene item (not just
  // GetInputList — that misses scene/group/non-input sources). A non-bounds item whose
  // source has a scale_filter we scale by k must KEEP its scale (the filter compensates).
  const items = allSceneItems();
  const sources = [...new Set(items.map((x) => x.item.sourceName))];
  const scaleFiltered = new Set<string>();
  for (const sourceName of sources) {
    let filters: Json[] = [];
    try { filters = obs("GetSourceFilterList", { sourceName }).filters ?? []; } catch { /* not filterable */ }
    const sf = filters.find((f) => f.filterKind === "scale_filter");
    if (!sf) continue;
    scaleFiltered.add(sourceName);
    const res: string = sf.filterSettings?.resolution ?? `${v.baseWidth}x${v.baseHeight}`;
    const [w, h] = res.split("x").map((s) => parseInt(s, 10));
    const newRes = `${Math.round(w * k)}x${Math.round(h * k)}`;
    if (DRY) { changes.push(`[dry] filter ${sourceName}/${sf.filterName} ${res} -> ${newRes}`); continue; }
    obs("SetSourceFilterSettings", { sourceName, filterName: sf.filterName, filterSettings: { resolution: newRes } });
    changes.push(`filter ${sourceName}/${sf.filterName} ${res} -> ${newRes}`);
  }

  if (DRY) {
    changes.push(`[dry] SetVideoSettings base=${targetW}x${targetH} output=${v.outputWidth}x${v.outputHeight}`);
    for (const { sceneName, item: it } of items) changes.push(`[dry] rescale ${sceneName}/${it.sourceName}`);
    changes.push(`[dry] would rescale ${items.length} scene items by ${round(k)}`);
    return;
  }

  // Apply canvas, then rescale items. NOTE: SetVideoSettings only updates fields sent;
  // omitting boundsType/scale in SetSceneItemTransform MERGES (rotation/crop/flip preserved).
  obs("SetVideoSettings", {
    baseWidth: targetW, baseHeight: targetH,
    outputWidth: v.outputWidth, outputHeight: v.outputHeight,
    fpsNumerator: v.fpsNumerator, fpsDenominator: v.fpsDenominator,
  });
  changes.push(`canvas -> ${targetW}x${targetH} (output ${v.outputWidth}x${v.outputHeight} kept)`);

  // Partial-failure hazard: if a SetSceneItemTransform throws mid-loop, the canvas is
  // already at 4K so a naive re-run would early-return and never finish the rescale.
  // We surface exactly how far we got so the operator (or a re-run after reverting canvas)
  // can recover, rather than silently leaving a half-scaled layout.
  let done = 0;
  for (const { sceneName, item: it } of items) {
    const t = it.sceneItemTransform;
    const isBounds = (t.boundsType ?? 0) !== 0 && t.boundsType !== "OBS_BOUNDS_NONE";
    const tf: Json = { positionX: round(t.positionX * k), positionY: round(t.positionY * k) };
    if (isBounds) {
      tf.boundsWidth = round(t.boundsWidth * k);
      tf.boundsHeight = round(t.boundsHeight * k);
    } else if (!scaleFiltered.has(it.sourceName)) {
      tf.scaleX = round(t.scaleX * k);
      tf.scaleY = round(t.scaleY * k);
    } // else: non-bounds WITH a scaled filter -> keep scale (filter already grew by k)
    try {
      obs("SetSceneItemTransform", { sceneName, sceneItemId: it.sceneItemId, sceneItemTransform: tf });
      done++;
    } catch (e) {
      changes.push(`rescaled ${done}/${items.length} items, then FAILED at ${sceneName}/${it.sourceName}: ${String(e)}`);
      console.error(`PARTIAL RESCALE — canvas is ${targetW}x${targetH} but only ${done}/${items.length} items rescaled. ` +
        `Re-running will early-return (canvas already premium). To recover: revert canvas to ${v.baseWidth}x${v.baseHeight} and re-run, or finish the remaining items in OBS by hand.`);
      process.exit(3);
    }
  }
  changes.push(`rescaled ${done} scene items by ${round(k)}`);
}

// ---- 2. record encoder -> HEVC hardware --------------------------------------
function premiumEncoder() {
  if (!RECORD_PROFILE) return; // operator did not name the record profile -> skip silently
  // Resolve profile dir (OBS sanitizes spaces/specials to '_' for dir names but keeps a Name= header).
  const dirGuess = RECORD_PROFILE.replace(/[^A-Za-z0-9]+/g, "_");
  let basic = join(PROFILES_DIR, dirGuess, "basic.ini");
  if (!existsSync(basic)) {
    // Fall back: scan for a profile whose [General] Name matches.
    try {
      const dirs = execFileSync("/bin/ls", [PROFILES_DIR], { encoding: "utf-8" }).split("\n").filter(Boolean);
      for (const d of dirs) {
        const p = join(PROFILES_DIR, d, "basic.ini");
        if (existsSync(p) && readFileSync(p, "utf-8").includes(`Name=${RECORD_PROFILE}`)) { basic = p; break; }
      }
    } catch { /* ignore */ }
  }
  if (!existsSync(basic)) { gaps.push(`record encoder: profile "${RECORD_PROFILE}" not found — skipped`); return; }

  const txt = readFileSync(basic, "utf-8");
  // The active [AdvOut] RecEncoder line.
  const m = txt.match(/^RecEncoder=(com\.apple\.videotoolbox\.videoencoder\.[^\n]+)$/m);
  const current = m?.[1];
  if (current === HEVC_HW) return; // already HEVC
  gaps.push(`record encoder ${current ?? "?"} -> ${HEVC_HW}`);
  if (CHECK || DRY) { if (DRY) changes.push(`[dry] would set ${basic} RecEncoder=${HEVC_HW}`); return; }

  // Only safe to edit a NON-ACTIVE profile (OBS rewrites the active profile on exit).
  const active = obs("GetProfileList").currentProfileName;
  if (active === RECORD_PROFILE) {
    gaps.push(`record encoder: "${RECORD_PROFILE}" is the ACTIVE profile — switch away (or stop here) before editing; not modified live`);
    return;
  }
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  copyFileSync(basic, `${basic}.pre-hevc.${ts}.bak`);
  // Replace ONLY the [AdvOut] videotoolbox RecEncoder line (not the [SimpleOutput] apple_h264).
  const next = txt.replace(/^RecEncoder=com\.apple\.videotoolbox\.videoencoder\.[^\n]+$/m, `RecEncoder=${HEVC_HW}`);
  // writeArtifact:exempt — edits the operator's OBS profile basic.ini (external app config), not a DOS artifact
  writeFileSync(basic, next);
  changes.push(`record encoder -> HEVC hardware in "${RECORD_PROFILE}" (backup .pre-hevc.bak; loads on next switch to that profile)`);
}

// ---- main --------------------------------------------------------------------
function main() {
  if (!CHECK && !DRY) assertIdle(); // read-only modes never mutate, so never block/exit on active output
  premiumCanvas();
  premiumEncoder();

  if (CHECK) {
    if (gaps.length) { console.log("PREMIUM GAPS:\n  - " + gaps.join("\n  - ")); process.exit(1); }
    console.log("PREMIUM: rig already at spec (canvas >= 3840x2160, scale filters matched, HEVC where checked)."); process.exit(0);
  }
  if (!gaps.length && !changes.length) { console.log("PREMIUM: already at spec — no changes."); return; }
  console.log((DRY ? "PREMIUM PLAN (dry-run):" : "PREMIUM APPLIED:"));
  for (const c of changes) console.log("  - " + c);
  if (gaps.length && !DRY) {
    const unresolved = gaps.filter((g) => g.includes("ACTIVE profile") || g.includes("not found"));
    if (unresolved.length) { console.log("STILL NEEDS OPERATOR:"); for (const g of unresolved) console.log("  - " + g); }
  }
}

main();
