---
name: MultiVendorInference
description: One-line recipe for DOS agents to invoke non-Anthropic models through Studio's metered OpenRouter gateway.
status: STABLE
bestPath:
  - title: "The One-Line Pattern"
    description: "Call Chat.ts with --model and --prompt as the minimum required invocation."
  - title: "Model Selection"
    description: "Pick a vendor/model per need — reasoning, long context, cost floor, or a bakeoff."
  - title: "Request Shaping"
    description: "Layer in JSON mode, reasoning effort, multimodal input, tool calling, or provider order as needed."
  - title: "Cost Attribution"
    description: "Read the per-call cost and credit fields logged to artifacts.jsonl."
divergence_from_canonical:
  _intent-to-flag-table.md:
    partial_version: 1.0.0
    reason: "OpenRouter MultiVendorInference workflow uses workflow-specific intent-to-flag vocabulary; canonical Mode/Output two-table shape doesn't fit"
---

# MultiVendorInference — agent usage pattern

## When to Use

- Agent needs GPT/Gemini/Llama/DeepSeek/Grok inference, a cross-vendor bakeoff, or a model outside Claude's native lane
- Fit: one-line non-Anthropic model invocation through Studio's metered gateway
- NOT for looking up library/API documentation (use Ref) or general multi-source research (use Research)

**Purpose:** give DOS agents (native, composed, subagent-spawned) a one-line recipe for invoking non-Anthropic models through Studio's metered gateway.

## The one-line pattern

```bash
bun ~/.claude/skills/openrouter/Tools/Chat.ts \
  --model <vendor>/<model-id> \
  --prompt "$PROMPT"
```

All other flags optional. `--model` is the only required argument; the Pack rejects anything else with a clear CLI error.

> **The concrete `<vendor>/<model-id>` values below are illustrative and churn weekly.** The pack delegates the
> live catalogue (it does NOT mirror it in code — see Cost attribution) for exactly that reason; the docs
> follow suit. Run `Tools/Models.ts` (e.g. `--author openai --max-price 5`) for the current, authoritative
> IDs before pinning one — a versioned ID shown here may already be a release behind.

## When to pick a non-Anthropic model

Anthropic Claude remains DOS's default inference through the native Claude CLI/subscription lane (`fast|standard|smart` -> haiku|sonnet|opus), which is free against Lucas's Max plan. Use OpenRouter when:

| Need | Route via OpenRouter |
|------|---------------------|
| GPT-5 / GPT-5.2 / o-series reasoning with web search | `openai/gpt-5.2`, `openai/o4` |
| 1M+ token context (Gemini's lane) | `google/gemini-2.5-pro`, `google/gemini-3-flash-preview` |
| Open-weight cost floor (Llama/Qwen/DeepSeek) | `meta-llama/llama-3.3-70b-instruct`, `deepseek/deepseek-r1`, `qwen/qwen-2.5-72b-instruct` |
| Grok's live X/Twitter search | `x-ai/grok-4-1-fast-reasoning` |
| A bakeoff across N vendors for the same prompt | Spawn N parallel Chat.ts invocations with different `--model` values |

## Patterns

### 1. Force JSON mode

```bash
bun ~/.claude/skills/openrouter/Tools/Chat.ts \
  --model anthropic/claude-opus-4-8 \
  --system "Respond with a JSON object matching the schema." \
  --prompt "$PROMPT" \
  --json
```

Sets `response_format: {type: 'json_object'}` upstream. Chat.ts does not re-validate the JSON — the caller does.

### 2. Extended thinking / reasoning

```bash
bun ~/.claude/skills/openrouter/Tools/Chat.ts \
  --model deepseek/deepseek-r1 \
  --prompt "Solve this combinatorics problem: ..." \
  --reasoning high
```

Passes `reasoning: {effort: 'high'}` through. Use `--verbose` to see `usage.reasoningTokens` in the metadata trailer.

### 3. Multimodal input

```bash
bun ~/.claude/skills/openrouter/Tools/Chat.ts \
  --model google/gemini-2.5-pro \
  --prompt "Describe what's in these frames." \
  --images /tmp/frame1.jpg,/tmp/frame2.jpg
```

Each image is base64-encoded into a `{type: 'image_url', image_url: {url: 'data:image/jpeg;base64,...'}}` content part.

### 4. Tool calling

```bash
cat > /tmp/tools.json <<EOF
[
  {
    "type": "function",
    "function": {
      "name": "get_weather",
      "description": "Returns current weather for a location",
      "parameters": {
        "type": "object",
        "properties": { "location": { "type": "string" } },
        "required": ["location"]
      }
    }
  }
]
EOF

bun ~/.claude/skills/openrouter/Tools/Chat.ts \
  --model anthropic/claude-opus-4-8 \
  --prompt "What's the weather in Tokyo?" \
  --tools /tmp/tools.json \
  --tool-choice auto \
  --verbose
```

The Pack **passes** tool definitions through verbatim and surfaces any `toolCalls[]` the model emits. Executing the tool and handing the result back for a continuation is the caller's job (a second Chat.ts invocation with the tool result appended as `role: 'tool'`).

### 5. Provider routing preference

```bash
bun ~/.claude/skills/openrouter/Tools/Chat.ts \
  --model anthropic/claude-sonnet-4-6 \
  --prompt "$PROMPT" \
  --provider-order anthropic,bedrock,vertex
```

`--provider-order` sets `provider.order[]` which is a priority list of upstream vendors OpenRouter will try in sequence before falling through to its default routing.

### 6. Idempotent retries

```bash
KEY=$(uuidgen)
bun ~/.claude/skills/openrouter/Tools/Chat.ts \
  --model openai/gpt-5.2 \
  --prompt "$PROMPT" \
  --idempotency-key "$KEY"
# network drop — retry with SAME key returns the cached completion
bun ~/.claude/skills/openrouter/Tools/Chat.ts \
  --model openai/gpt-5.2 \
  --prompt "$PROMPT" \
  --idempotency-key "$KEY"
```

Studio's idempotency layer short-circuits the second call to the cached Generation row — no second credit debit, no second upstream request.

## Intent-to-Flag Mapping

This workflow shells out to `Tools/Chat.ts`. Translate operator phrasing into deterministic flag selection per CreateSkill workflow Step 6 + CliFirstArchitecture.md.

### Required + Input Selection

| User Says | Flag | Effect |
|-----------|------|--------|
| "use [vendor]/[model]", "via gpt-5", "ask claude opus" | `--model <id>` | Required. Selects the upstream OpenRouter model id (e.g., `anthropic/claude-opus-4-8`) |
| "ask it [text]", inline prompt string | `--prompt <text>` | User message body |
| "from this file", "use prompt.md as input" | `--input-file <path>` | Reads user message from a file instead of CLI |
| "with system prompt X", "act as Y" | `--system <text>` | Sets the system message |
| "look at these images", "describe these frames" | `--images <p1,p2>` | Comma-separated local image paths, base64-encoded into content parts |

### Mode/Behavior Selection

| User Says | Flag | Effect |
|-----------|------|--------|
| "respond in JSON", "JSON only" | `--json` | Sets `response_format: {type: 'json_object'}` upstream |
| "use tools", "give it these functions" | `--tools <path>` | OpenAI-compat tools[] JSON file passed verbatim |
| "force tool use", "auto pick tool" | `--tool-choice <auto\|none\|required\|json>` | Tool-forcing policy |
| "think hard", "high reasoning effort" | `--reasoning <xhigh\|high\|medium\|low\|minimal\|none>` | Sets reasoning effort level |
| "stream the response" | `--stream` | SSE deltas (Phase 1B.2 — currently errors) |
| "prefer Anthropic over Bedrock", "route through Vertex first" | `--provider-order <p1,p2>` | Comma-separated upstream priority list |

### Tuning Options

| User Says | Flag | Effect |
|-----------|------|--------|
| "cap output at N tokens" | `--max-tokens <n>` | Hard cap on completion tokens |
| "be more creative", "more deterministic" | `--temperature <0..2>` | Sampling temperature |
| "tighter sampling" | `--top-p <0..1>` | Nucleus sampling cutoff |
| "make it replay-safe", "retry the same call" | `--idempotency-key <uuid>` | Studio short-circuits second call to cached Generation |

### Output Options

| User Says | Flag | Effect |
|-----------|------|--------|
| "save to file" | `--output <stdout\|path>` | Default stdout; path writes response body to disk |
| "show me the metadata", "verbose" | `--verbose, -v` | Print full response metadata to stderr |

## Cost attribution

Every Chat.ts invocation appends a line to `MEMORY/ARTIFACTS/artifacts.jsonl` with `{generationId, model, provider, actualCostCents, chargedCredits, promptTokens, completionTokens, cacheHit}`. Downstream pipeline steps can tail that log to attribute spend back to a specific agent run or sprint.

## What this Pack does NOT do

- **No BYOK.** If you need to call OpenRouter directly without going through Studio, you're outside this Pack's scope. Use a different integration.
- **No streaming yet.** `--stream` errors out until the sibling `/chat/completions/stream` route lands in Phase 1B.2.
- **No multi-step tool-loop orchestration.** This is a one-shot CLI. Callers that want a "call tool → feed result back → continue" loop handle that themselves across multiple Chat.ts invocations.
- **No per-model pricing caching.** Ask the `/models` route (`bun Tools/Models.ts`) for live pricing — OpenRouter's catalogue moves too fast to mirror.
