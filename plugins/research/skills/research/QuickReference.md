# Research Quick Reference

## Three Research Modes

| Trigger | Mode | Config | Speed |
|---------|------|--------|-------|
| "quick research", "minor research" | Quick | 1 Perplexity agent | ~10-15s |
| "do research", "research this" | Standard | 4 agents (Perplexity + Claude + Gemini + Brave) | ~15-30s |
| "extensive research" | Extensive | 12 agents (4 types x 3 threads each) | ~60-90s |

## Extract Alpha Philosophy

Based on Shannon's information theory: **real information is what's different.**

**HIGH-ALPHA:** Surprising, counterintuitive, connects domains unexpectedly
**LOW-ALPHA:** Common knowledge, obvious implications, generic advice

Output: 24-30 insights, Paul Graham style, 8-12 word bullets

## Retrieval — One Call, Router Escalates

- `Scrape.fetch(url, { mode })` — router owns the WebFetch → proxy tier → semantic cleanup ladder (RFC-0015 §7.1)
- `Scrape.profile(entity, { kind, platform })` — specialized platform actors (LinkedIn, Instagram, Amazon, Google Maps) per §5.4
- Pass `mode: 'fast'` for quick one-shot fetches, `'standard'` (default) for blocked pages, `'deep'` for must-succeed with semantic cleanup

### Port form (RFC-0031 Phase 0) — `bun Tools/dos-scrape.ts <url>`

For single-URL fetches outside the TS code path (e.g., bash workflows, agent-driven CLIs), the `dos-scrape` Port wraps the same routing decision. Auto mode delegates to the canonical `isAntiBotDomain` heuristic and routes to either Bun fetch (static) or BrightData (subprocess) — same routing decision as `Scrape.fetch`, exposed as a CLI:

```bash
bun Tools/dos-scrape.ts "https://www.linkedin.com/in/profile" --json
# → routes to BrightData (matches ANTI_BOT_DOMAINS)
# → emits telemetry to MEMORY/ARTIFACTS/dos-router-telemetry.jsonl

bun Tools/dos-scrape.ts "https://example.com/article"
# → routes to WebFetch (not in anti-bot list)
```

Use `--render=js` to force BrightData; `--render=static` to force WebFetch. Use `--telemetry-tag=<slug>` for caller-attribution. Per RFC-0031 §4.4 named exit codes: 0=ok, 1=provider_error, 64=invalid args, 124=timeout.

### Port form (RFC-0031 Phase 2) — `bun Tools/dos-fetch.ts <url>`

Higher-level Port for the `web.fetch` capability. Surfaces intents (verb-noun) instead of render mode — the operator describes what they want, the Port picks the right Adapter. Composes with dos-scrape via subprocess when the host needs bot-detection escalation.

```bash
# Quick page get — WebFetch always
bun Tools/dos-fetch.ts "https://example.com/article" --intent=quick-summary

# Deep content — escalates to dos-scrape (BrightData) for anti-bot hosts
bun Tools/dos-fetch.ts "https://www.linkedin.com/in/profile" --intent=deep-content --json
# → routes to Scrape Adapter (subprocess to dos-scrape.ts --json)

# Structured extract (Phase 2 narrowed: WebFetch + caller post-processes;
# future phases may add a Research-skill Adapter for multi-source synthesis)
bun Tools/dos-fetch.ts "https://blog.example.com/post" --intent=structured-extract \
  --telemetry-tag=Research/QuickReference
```

Intent vocabulary per RFC §4.1: `quick-summary | deep-content | structured-extract`. Use `dos-fetch` when the caller wants an intent-level CLI; use `dos-scrape` when the caller already knows it needs escalation (matches the lower-level surface). Both write telemetry to `dos-router-telemetry.jsonl`. Same exit-code surface (0/1/64/124).

## Examples

**Example 1: Quick research on a topic**
```
User: "quick research on Texas hot sauce brands"
-> Spawns 1 Perplexity agent with single query
-> Returns top brands with brief descriptions
-> Completes in ~10-15 seconds
```

**Example 2: Standard research (default)**
```
User: "do research on AI agent frameworks"
-> Spawns 4 agents in parallel (Perplexity + Claude + Gemini + Brave)
-> Each searches from different perspective
-> Returns synthesized findings with multiple viewpoints (~15-30s)
```

**Example 3: Extract alpha from content**
```
User: "extract alpha from this YouTube video" [URL]
-> Extracts transcript via fabric -y
-> Runs deep thinking deep analysis
-> Returns 24-30 high-alpha insights in Paul Graham style bullets
```
