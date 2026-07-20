---
name: Enforce Consistency
description: Check brand assets against guidelines rules
status: BETA
---

# Enforce Brand Consistency

Check assets, content, and code against brand guidelines. The enforcement system that drives 10-33% revenue uplift through brand consistency.

## When to Use

- Checking a new page/component against brand guidelines
- Reviewing content for voice/tone compliance
- Auditing a codebase for hardcoded values that should use brand tokens
- Pre-launch brand consistency check

## Steps

### Step 1: Load Brand Rules

Read brand guidelines or constituent artifacts:
- Color system (allowed values, usage rules)
- Typography (allowed fonts, scale, weights)
- Voice guide (tone attributes, vocabulary)
- Logo rules (clear space, minimum size)
- Motion tokens (allowed durations, easings)

### Step 2: Select Check Scope

Every scope is either **tool-backed** (a deterministic validator IS the
measurement) or **LLM-judgment** (no deterministic tool yet — a reviewer scores
it, and the report MUST say "LLM-judgment" rather than fabricate a percentage).
No scope is allowed to present a hand-authored number as if it were measured.

| Scope | What Gets Checked | Backing |
|-------|-------------------|---------|
| **Visual** | Colors match palette, fonts match system, logo usage correct | tool-backed → `validate-brand-tokens.ts` |
| **Verbal** | Copy matches voice attributes, vocabulary compliance | tool-backed → `validate-brand-voice.ts --project` |
| **Code** | No hardcoded colors/fonts, proper token usage | tool-backed → `validate-brand-tokens.ts` |
| **Content** | Blog posts, docs pages against voice and visual standards | LLM-judgment (no deterministic tool) |
| **Social** | Profile assets match templates, bios match voice | LLM-judgment (no deterministic tool) |

### Step 3: Execute Checks (run the validators — their output IS the report)

Do NOT hand-author compliance percentages. The tool-backed scopes are measured by
invoking the validators against the target project; their output is the compliance
section verbatim.

**Verbal scope — `validate-brand-voice.ts --project`** (ISC-28). Lints the
project's copy against ITS OWN VoiceGuide "We Don't Say" list (NOT DOS's
POSITIONING.md). Forbidden terms are re-derived from the project's VoiceGuide
"We Say / We Don't Say" table:

```bash
bun Tools/validate-brand-voice.ts --project <project-dir> --json
```

Real output replaces the old fabricated "Verbal Compliance" percentage — the
validator names the file, line, column, and the violating term:

```text
<!-- brand-voice:exempt — illustrative validator output, not brand prose -->
✗ brand-voice[project]: 1 violation(s) across 1 file(s) (forbidden list from Docs/brand-voice.md)
  Docs/pricing.md
    14:8  [forbidden]  Leverage (project VoiceGuide: do not say)
      We leverage AI to ship faster.
```

This is the cheap immediate win (ISC-31): even before the token validator landed,
wiring the *existing* voice validator into Step 3 already catches what the old
report only **claimed** — the "Leverage" → "use" failure the previous prose
hand-authored as `[FAIL] "Leverage" used in pricing page`. (The DOS-default
forbidden list already carries `leverage`; `--project` mode re-derives the same
term from the project's VoiceGuide so the check is portable to a customer repo.)

**Visual / Code / Token scope — `validate-brand-tokens.ts`** (ISC-27, sibling
validator). Lints hardcoded colors/fonts and token-contract drift; its output IS
the Visual + Token compliance section (replacing the fabricated "Visual
Compliance" and "Token Compliance" percentages):

```bash
bun Tools/validate-brand-tokens.ts --project <project-dir> --json
```

**Content / Social scope — LLM-judgment.** No deterministic tool yet. A reviewer
scores these against the voice attributes and template set; the report MUST label
the score "LLM-judgment", never present it as a measured percentage.

### Step 4: Generate Fix Suggestions

For each failure, provide specific remediation:
- File path and line number (for code issues)
- Current value → correct token/value
- Priority (P0: visible to users, P1: internal, P2: minor)

## Intent-to-Flag Mapping

This workflow shells out to two CLI validators. Map the operator's phrasing to the
right scope + flags:

| Operator says | Scope | Invocation |
|---------------|-------|------------|
| "check the voice / copy / vocabulary / tone" | Verbal | `bun Tools/validate-brand-voice.ts --project <dir>` |
| "check tokens / colors / fonts / hardcoded values" | Visual + Code | `bun Tools/validate-brand-tokens.ts --project <dir>` |
| "full consistency check" | both | run both validators, then LLM-judge Content + Social |
| "machine-readable / for CI / give me JSON" | any | append `--json` |
| "use this voice guide instead" | Verbal | append `--voice-guide <path>` |
| "review the blog post / social bios" | Content / Social | LLM-judgment (no deterministic tool) |
