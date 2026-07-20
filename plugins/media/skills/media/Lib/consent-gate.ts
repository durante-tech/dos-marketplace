/**
 * consent-gate.ts — the shared content-safety gate for the media pack's
 * liability-grade modalities.
 *
 * Deepfake (FaceSwap), biometric voice-clone (Speech CloneVoice), copyright /
 * style-mimicry (Music), and AI-images-of-real-people (Art reference images) are
 * liability classes, not aesthetic preferences. This gate lives in the Lib layer so
 * NO per-tool path bypasses it: each tool calls `enforceConsent()` BEFORE its
 * gateway call. It is warn-then-block with a SINGLE affirmative attestation flag
 * (`--consent-attested`) — block-by-default, audit-logged, but never a multi-step
 * wizard. Legitimate own-face / own-voice / synthetic-subject flows still ship by
 * passing the flag once. Same shape as Bdr #15's compliance gate, higher liability.
 */
import { CLIError } from "./cli.ts";

export type ConsentModality = "deepfake" | "voice-clone" | "music-style" | "real-person-image";

export interface ConsentFacts {
  /** voice-clone: a reference voice sample is present (biometric clone, not plain TTS) */
  hasVoiceSample?: boolean;
  /** music-style: the generation prompt (scanned for named-artist style mimicry) */
  prompt?: string;
  /** real-person-image: a reference/input image is present (may depict a real person) */
  hasReferenceImage?: boolean;
}

export interface ConsentDecision {
  required: boolean;
  modality: ConsentModality;
  reason: string;
}

export interface Attestation {
  consentAttested: true;
  consentModality: ConsentModality;
  attestedAt: string;
}

// Heuristic style-mimicry detector: does a music prompt invoke a NAMED artist/band
// style? Matches "in the style of <Proper Noun>", "sounds like <Proper Noun>",
// "<Proper Noun>-style", etc. Requires a Capitalized token so lowercase genres
// ("in the style of jazz") do NOT flag — only named entities ("…of Taylor Swift").
export function detectStyleMimicry(prompt: string): { flagged: boolean; phrase: string } {
  const triggers = [
    /\b(?:in the style of|styled?\s+(?:like|after)|sounds?\s+like|inspired by|a\s*la|à\s*la|mimic(?:king)?)\s+([A-Z][\w.'’&-]+(?:\s+[A-Z][\w.'’&-]+){0,3})/,
    /\b([A-Z][\w.'’&-]+(?:\s+[A-Z][\w.'’&-]+){0,2})[-\s]style\b/,
  ];
  for (const re of triggers) {
    const m = prompt.match(re);
    if (m) return { flagged: true, phrase: m[0].trim() };
  }
  return { flagged: false, phrase: "" };
}

// Pure: does this invocation require a consent attestation, and why?
export function consentRequired(modality: ConsentModality, facts: ConsentFacts): ConsentDecision {
  switch (modality) {
    case "deepfake":
      return {
        required: true,
        modality,
        reason: "Face-swap synthesizes a person's likeness onto another image (a deepfake).",
      };
    case "voice-clone":
      return facts.hasVoiceSample
        ? {
            required: true,
            modality,
            reason: "Voice cloning replicates a real person's biometric voiceprint from a sample.",
          }
        : { required: false, modality, reason: "" };
    case "music-style": {
      const m = detectStyleMimicry(facts.prompt || "");
      return m.flagged
        ? {
            required: true,
            modality,
            reason: `The prompt mimics a named artist's style ("${m.phrase}") — copyright / right-of-publicity risk.`,
          }
        : { required: false, modality, reason: "" };
    }
    case "real-person-image":
      return facts.hasReferenceImage
        ? {
            required: true,
            modality,
            reason: "Generating from a reference image can depict a real, identifiable person.",
          }
        : { required: false, modality, reason: "" };
  }
}

// Enforce the gate at a tool's pre-gateway boundary. Throws CLIError (block, exit 2)
// when consent is required but not attested — the message warns AND tells the
// operator how to proceed (warn-then-block). On a clean/own-subject path it returns
// null; on an attested path it returns an Attestation to merge into the artifact
// metadata so the consent is logged to the artifact JSONL for audit (ISC-7).
export function enforceConsent(
  modality: ConsentModality,
  facts: ConsentFacts,
  attested: boolean,
  now: string = new Date().toISOString(),
): Attestation | null {
  const decision = consentRequired(modality, facts);
  if (!decision.required) return null;
  if (!attested) {
    throw new CLIError(
      `Content-safety gate (${modality}): ${decision.reason}\n` +
        `  This is a liability-grade operation. Re-run with --consent-attested to confirm you are authorized\n` +
        `  (you have the depicted person's/voice owner's consent, or no real person is depicted). Logged for audit.`,
      2,
    );
  }
  return { consentAttested: true, consentModality: modality, attestedAt: now };
}
