/**
 * portBypassRoutes.ts — single source of truth for port-bypass
 * detection across build-time (Doctor D11) and runtime
 * (PreToolUse PortBypass.hook).
 *
 * Replaces parallel `D11_PROVIDER_PORTS` (Doctor) + `BYPASS_ROUTES` (hook)
 * lists which previously carried "keep in sync" comments across two repos
 * (parent vs submodule). The drift class is real because the two consumers
 * live at different VCS roots; this module collapses them into one.
 *
 * CANONICAL LOCATION: parent repo at `Tools/dos-toolchain/portBypassRoutes.ts`.
 * MIRROR LOCATION:    active submodule at `Releases/v0.0.11/.claude/hooks/lib/portBypassRoutes.ts`.
 *
 * Sync-check enforces byte-identity via the alias triple registered in
 * `.dos-sync-manifest.json` (matches the `glob.ts` precedent).
 *
 * IMPORTANT — when adding a provider:
 *   1. Add an entry to `PORT_BYPASS_ROUTES` in this file
 *   2. Run `bun ~/Durante/Tools/sync-check.ts --fix --dry-run` then `--fix`
 *      to propagate to the submodule mirror
 *   3. Add a new fixture test in `dos-pack-doctor-d11.test.ts` (one provider
 *      per fixture pair: clean + with-violation)
 *   4. Add a unit test in `portBypassRoutes.test.ts` for the new regex +
 *      classify behavior
 */

export interface PortBypassRoute {
  /** Matcher applied to the bash command string OR workflow .md line. */
  readonly hostPattern: RegExp;
  /** Provider label for operator-facing reminder (e.g. "OpenAI"). */
  readonly providerLabel: string;
  /** Suggested DOS Port (one or two — comma/pipe-separated for multi-Port providers). */
  readonly suggestedPort: string;
  /** Why the bypass is a problem (Studio gateway routing, credit metering). */
  readonly rationale: string;
}

/**
 * Build the bypass matcher for a provider host.
 *
 * Phase 3 scope is deliberately narrow (Beck-narrowed walking skeleton): the URL
 * must follow `curl` directly. `curl -X POST <url>` is a KNOWN false-negative,
 * pinned by a characterization test so Phase 4 cannot widen it silently.
 *
 * The host boundary, however, is not part of that deferral. A trailing `\b` let
 * `api.openai.com.evil.test` match — a different host entirely. The host now must
 * end at a path, port, query, fragment, quote, or whitespace boundary. This
 * strictly reduces false advisories and no test asserted the old behavior.
 *
 * PHASE 4 WIDENING (operator-gated — do not flip autonomously): replace the body
 * with the token-skipping form below. It skips flag/value tokens between `curl`
 * and the URL but never crosses a shell separator, so `curl x && echo <url>`
 * stays clean. Measured by Forge H-087 against the real module: catches 11/11
 * realistic invocations vs 1/9 today, 0 false positives, 2ms on a 20k-token
 * backtracking probe. Widening changes the RFC-0006 §2D soak population, which
 * is why it is a decision, not a fix.
 *
 *     `curl(?:\\s+(?!https?://)(?![&|;])\\S+)*\\s+https?://${escaped}(?=[/:?#\\s'"]|$)`
 */
function curlBypassPattern(host: string): RegExp {
  const escaped = host.replace(/\./g, "\\.");
  return new RegExp(`curl\\s+https?://${escaped}(?=[/:?#\\s'"]|$)`, "i");
}

/**
 * Provider-host → suggested DOS Port. Detection scope:
 *   - bash code blocks containing `curl <flags...> https://api.<provider>.com`
 *   - one suggested Port per provider; operator-readable advisory
 *
 * NOT detected (deferred):
 *   - TS/Python imports of provider SDKs (would require AST parsing)
 *   - direct `Skill("Media/Art")` prose invocations (different concern;
 *     re-targeting an already-routed call vs catching a raw bypass)
 *   - non-curl HTTP clients (httpie, wget) — same advisory shape; add
 *     when first violation surfaces in the wild
 */
export const PORT_BYPASS_ROUTES: ReadonlyArray<PortBypassRoute> = [
  {
    hostPattern: curlBypassPattern("api.openai.com"),
    providerLabel: "OpenAI",
    suggestedPort: "Tools/Inference.ts (LLM) or Tools/dos-image.ts --intent=diagram (gpt-image-1)",
    rationale: "OpenAI calls bypass Studio gateway credit metering",
  },
  {
    hostPattern: curlBypassPattern("api.anthropic.com"),
    providerLabel: "Anthropic",
    suggestedPort: "Tools/Inference.ts",
    rationale: "Anthropic LLM calls must route through Inference.ts for Studio metering",
  },
  {
    hostPattern: curlBypassPattern("api.replicate.com"),
    providerLabel: "Replicate",
    suggestedPort: "Tools/dos-image.ts (Flux/NanoBanana) or Tools/dos-video.ts (Seedance/Kling/Veo) or Tools/dos-audio.ts (Qwen TTS)",
    rationale: "Replicate calls must route through Studio gateway for credit metering",
  },
  {
    hostPattern: curlBypassPattern("api.elevenlabs.io"),
    providerLabel: "ElevenLabs",
    suggestedPort: "Tools/dos-audio.ts --intent=tts-narration",
    rationale: "ElevenLabs TTS must route through Studio gateway for credit metering",
  },
  {
    hostPattern: curlBypassPattern("openrouter.ai"),
    providerLabel: "OpenRouter",
    suggestedPort: "Tools/Inference.ts (with appropriate model)",
    rationale: "OpenRouter calls must route through Studio gateway",
  },
];

/**
 * Find the first matching route for a given command/line, or null.
 *
 * Use case: PortBypass hook — emits ONE advisory per Bash invocation,
 * so first-match is the correct semantics. A Bash command with two
 * provider URLs gets one reminder for the first; the operator sees the
 * second on next turn if they re-curl.
 *
 * @param command — bash command string (hook input)
 * @returns the matching route, or null if no provider pattern matches
 */
export function classifyBypassCommand(command: string): PortBypassRoute | null {
  for (const route of PORT_BYPASS_ROUTES) {
    if (route.hostPattern.test(command)) return route;
  }
  return null;
}

/**
 * Find ALL matching routes for a given command/line.
 *
 * Use case: Doctor D11 — emits ONE finding per violation. A workflow
 * .md line `curl <openai> && curl <anthropic>` is two violations and
 * deserves two findings (otherwise the second is silently swept under
 * the first). This preserves the pre-extraction Doctor's
 * no-break-on-match inner loop semantics.
 *
 * @param command — workflow .md line (Doctor input)
 * @returns array of matching routes (empty when no match)
 */
export function classifyAllBypassMatches(command: string): PortBypassRoute[] {
  const out: PortBypassRoute[] = [];
  for (const route of PORT_BYPASS_ROUTES) {
    if (route.hostPattern.test(command)) out.push(route);
  }
  return out;
}
