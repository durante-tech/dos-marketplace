---
name: OpenRouter
description: Multi-vendor LLM inference routed through Studio's credit-metered gateway. Chat completions + live model catalogue for 300+ models (Anthropic, OpenAI, Google, Meta, Mistral, xAI, etc.) via one unified endpoint. USE WHEN call model, multi-vendor inference, try a different model, bakeoff, model comparison, openrouter, gpt-5, claude via openrouter, gemini text, llama, deepseek, qwen, cheapest model, longest context, openrouter chat, openrouter models.
role: executor
accepts:
  - text
icon: Waypoints
colorVar: secondary
colorHex: "#a855f7"
tier: primary
category: Inference
displayLabel: OpenRouter
marketingDescription: 300+ models, one API — credit-metered
elevator: Multi-vendor LLM inference via Studio's gateway
highlightWorkflows:
  - name: Chat Completion
    technicalName: ChatCompletion
  - name: Model Catalogue
    technicalName: ModelCatalogue
  - name: Multi-Vendor Inference
    technicalName: MultiVendorInference
roots: []
visibility: public
capabilities:
  - artifact.write
  - customization.cascade
  - four-copy.sync
  - voice.emit
---
<!-- generated-from: SKILL.partials.md — DO NOT EDIT directly. Run: bun Tools/dos-build.ts skill <path> -->
## Customization

**Before executing, check for user customizations at:**
`~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/OpenRouter/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.

# OpenRouter — Multi-Vendor LLM Inference

**Purpose:** Invoke any of 300+ LLMs (Anthropic, OpenAI, Google, Meta, Mistral, xAI, DeepSeek, Qwen, etc.) through one OpenAI-compatible endpoint, routed through Studio's credit-metered gateway. Unlocks non-Anthropic models for DOS agents without per-vendor plumbing.

## Architecture

```
Agent / CLI user
      │
      ▼
Packs/openrouter/src/Tools/Chat.ts
      │  (--model anthropic/claude-opus-4-8 --prompt "...")
      ▼
Lib/openrouter-gateway.ts  (chatCompletions / listModels)
      │
      ▼  POST {STUDIO_API_URL}/api/v1/inference/openrouter/chat/completions
      │  Authorization: Bearer sk-studio-...
      │  Idempotency-Key: <optional>
Studio Gateway Route
      │  auth → rate-limit → spend-cap → pricing lookup (wildcard fallback)
      │  → reserve credits → run worker
      ▼
Studio Worker (openrouter-worker.ts)
      │  POST https://openrouter.ai/api/v1/chat/completions
      │  Authorization: Bearer $STUDIO_POOL_OPENROUTER_API_KEY
      ▼
OpenRouter → Upstream provider (Anthropic / OpenAI / Google / ...)
      │
      ▼  response with `usage.cost` (USD, authoritative)
Studio commits: Math.ceil(cost*100) cents × markupBp → credits debited
      │
      ▼
Pack returns content + citations + cost + generationId
```

**NO BYOK.** The Pack never holds an OpenRouter API key. All inference is credit-metered through Studio's double-entry ledger. See PRD D1 at `MEMORY/WORK/20260424-020000_openrouter-pack-studio-worker-build/PRD.md`.

## Workflows

> **Model IDs below are illustrative and churn weekly.** This pack deliberately does NOT mirror the
> catalogue in code (it delegates to the live `openrouter.ai/models` — see Cost Model) for exactly that
> reason, and the docs follow the same discipline: treat every `<vendor>/<model-id>` here as an example,
> and run `Tools/Models.ts` (the ModelCatalogue pattern) for the current, authoritative IDs before
> pinning one in a script.

### ChatCompletion — single-turn or multi-turn chat

```bash
bun ~/.claude/skills/openrouter/Tools/Chat.ts \
  --model anthropic/claude-opus-4-8 \
  --prompt "Explain the halting problem in three sentences."
```

Flags (see `Tools/Chat.ts --help`):
- `--model <id>` — OpenRouter model ID (e.g., `openai/gpt-5.2`, `google/gemini-2.5-pro`, `meta-llama/llama-3.3-70b-instruct`)
- `--prompt <text>` — user message (or `--input-file <path>` / stdin)
- `--system <text>` — system prompt
- `--stream` — SSE passthrough (Phase 1B.2 — coming)
- `--tools <json-file>` — OpenAI-style tool definitions array
- `--tool-choice <auto|none|required|json>` — forcing policy
- `--images <p1,p2>` — base64-encoded content parts from local files
- `--reasoning <effort>` — `xhigh|high|medium|low|minimal|none`
- `--json` — set `response_format: {type: 'json_object'}`
- `--max-tokens <n>` — hard cap on output tokens
- `--temperature <0..2>` — sampling temperature
- `--provider-order <p1,p2>` — preferred provider slugs (comma-sep)
- `--idempotency-key <uuid>` — replay-safe

### ModelCatalogue — discover what's available

```bash
bun ~/.claude/skills/openrouter/Tools/Models.ts --format table
bun ~/.claude/skills/openrouter/Tools/Models.ts --author anthropic --format json
bun ~/.claude/skills/openrouter/Tools/Models.ts --min-context 100000 --max-price 0.003
```

Flags:
- `--author <name>` — filter by vendor prefix (e.g., `anthropic`, `openai`)
- `--min-context <tokens>` — minimum context window (e.g., `100000`)
- `--max-price <usd-per-mtok>` — maximum $/M input tokens
- `--format <table|json>` — output shape

Catalogue proxies `https://openrouter.ai/api/v1/models` through Studio with a 24h cache. First call after cache expiry refreshes upstream; subsequent calls within the window are served from storage.

### MultiVendorInference — agent usage pattern

See `Workflows/MultiVendorInference.md` for the canonical pattern agents use to opt into non-Anthropic models via this Pack (e.g., GPT for heavy reasoning, Gemini for long-context, Claude for default).

## Examples

**Example 1: Single-turn chat with non-Anthropic model**
```
User: "Ask GPT-5 to summarize this paper"
→ Invokes ChatCompletion workflow
→ Routes Chat.ts --model openai/gpt-5.2 --prompt "<paper text>" through Studio's metered gateway
→ Returns content + chargedCredits + generationId; cost debited from operator's credit balance
```

**Example 2: Discover available models by author and price**
```
User: "Show me Anthropic models under $0.003/Mtok with at least 200k context"
→ Invokes ModelCatalogue workflow
→ Runs Models.ts --author anthropic --min-context 200000 --max-price 0.003 --format table
→ Returns the filtered model table from OpenRouter's catalogue (24h-cached server-side)
```

**Example 3: Cross-vendor bakeoff for the same prompt**
```
User: "Run this reasoning prompt across Claude, GPT-5, and DeepSeek-R1 and compare"
→ Invokes MultiVendorInference workflow
→ Spawns parallel Chat.ts invocations with three different --model values + --reasoning high
→ Returns three completions side-by-side with per-model actualCostCents for cost comparison
```

## Cost Model

Passthrough — OpenRouter returns `usage.cost` (USD) per response; Studio ceils to cents and applies a markup. The default markup is `markupBp=18000` — **18000 basis points = a 1.8× multiplier** on the upstream USD cost (the platform-economy margin that funds the credit-metered gateway). The Pack never sees raw vendor pricing; it sees `chargedCredits` and `actualCostCents` on every response, so the operator can always reconcile what was charged against the actual upstream cost.

Per-model pricing lives on OpenRouter's side; the DOS Pack deliberately does not mirror it because the catalogue churns weekly. Use `ModelCatalogue --author X --max-price Y` to shop before committing.

## Security

- `OPENROUTER_API_KEY` is NOT read by any Pack file. The Pack requires ONLY `STUDIO_API_URL` + `STUDIO_API_KEY` from `~/.claude/.gateway.env`.
- Every request goes through Studio's auth-bearer → rate-limit → kill-switch → spend-cap → credit-reservation path.
- Idempotency-Key headers supported end-to-end for replay-safe retries.

## Limitations

- **Streaming** (`--stream`) is scoped to Phase 1B.2 — a sibling `/chat/completions/stream` route. Non-streaming works today.
- **Provider-side prompt caching** is passed through but only works when OpenRouter routes directly to Anthropic (not Bedrock / Vertex). Usage returns `cacheCreationTokens` + `cacheReadTokens` when the cache hits.
- **Function calling / tool use** — schema is OpenAI-compat. Pack passes `tools[]` + `tool_choice` through verbatim; response returns any `toolCalls` the model emits. The Pack does NOT execute tools — that's the caller's job.

**Four-copy note:** this skill exists in multiple copies — after editing any file here, verify parity with `bun ~/Durante/Tools/sync-check.ts` (full rule: Durante/CLAUDE.md "The Four Copies"). Artifact writes are auto-logged by ArtifactAutoLogger.hook.ts.
