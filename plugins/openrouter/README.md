---
name: OpenRouter
pack-id: durante-openrouter-v1.0.0
version: 1.0.0
author: durante-tech
description: Multi-vendor LLM inference routed through Studio's credit-metered gateway. Chat completions and live model catalogue via one unified endpoint.
type: skill
role: executor
visibility: public
category: Inference
platform: claude-code
dependencies: []
keywords: [openrouter, call model, multi-vendor inference, try a different model, bakeoff, model comparison, gpt-5, claude via openrouter, gemini text, llama, deepseek, qwen]
---

# OpenRouter

> Multi-vendor LLM inference, credit-metered through Studio.

---

## The Problem

Agents sometimes need GPT, Gemini, DeepSeek, Qwen, Llama, or another non-default model without each workflow owning vendor-specific auth, pricing, and metering logic.

---

## The Solution

The **OpenRouter** pack packages 1 workflow and 2 CLI tools behind a single `SKILL.md` entry card and Studio gateway contract.

**Elevator:** Multi-vendor LLM inference via Studio's gateway.

**Core capabilities:**

- **MultiVendorInference** - `Workflows/MultiVendorInference.md`
- **ChatCompletion** - `Tools/Chat.ts`
- **ModelCatalogue** - `Tools/Models.ts`

---

## Installation

This pack is designed for AI-assisted installation. Give this directory to your AI and ask it to install using `INSTALL.md`.

```text
Install the openrouter pack from DOS/Packs/openrouter/
```

The installer creates the skill directories, copies pack files, runs `bun install` in `Tools`, and verifies the two CLI entry points.

---

## What's Included

| Component | Path | Purpose |
|-----------|------|---------|
| Skill definition | `src/SKILL.md` | Skill routing, configuration, documentation |
| Skill source | `src/SKILL.partials.md` | RFC-0006 partial source |
| Extension manifest | `src/extension.yaml` | RFC-0002 pack manifest |
| Lib | `src/Lib/` | Studio env and gateway helpers |
| Tools | `src/Tools/` | 2 CLI entry points |
| Workflows | `src/Workflows/` | 1 workflow definition |

**Summary:**
- Directories: 3 (`Lib`, `Tools`, `Workflows`)
- Files in `src/`: 12
- Workflows: 1
- Tools: 2
- Hooks registered: 0
- Visibility: public

---

## Workflow Routing

| Workflow | Path |
|----------|------|
| **MultiVendorInference** | `src/Workflows/MultiVendorInference.md` |

---

## Invocation Scenarios

- Chat completion: `bun ~/.claude/skills/openrouter/Tools/Chat.ts --model openai/gpt-5.2 --prompt "Summarize this"`
- Model catalogue: `bun ~/.claude/skills/openrouter/Tools/Models.ts --author anthropic --format table`

---

## Customization

User customizations live separately and are never overwritten by updates:

```text
~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/OpenRouter/
```

---

## Credits

- **Pack family:** durante-tech / DOS
- **Skill definition format:** RFC-0004
- **Extension manifest format:** RFC-0002
- **OpenRouter gateway spec:** RFC-0002

---

## Changelog

### 1.0.0
- Initial published version with Studio-routed chat/models CLIs, inference workflow, installation guide, and verification smoke checks.
