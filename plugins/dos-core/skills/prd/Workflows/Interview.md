---
name: Interview
description: Multi-turn elicitation flow for OBSERVE-time scoping of a new PRD
bestPath:
  - title: "Hypothesis Gate"
    description: "State a confidence-scored guess at the principal's intent before asking anything."
  - title: "Structured Q&A"
    description: "Ask the 5 content-floor questions: goal, parent RFC, out-of-scope, constraints, effort tier."
  - title: "Confidence-Driven Follow-Up"
    description: "Skip already-confident items; follow up one at a time only on low-confidence areas."
  - title: "PRD Scaffold"
    description: "Hand the answers to the Scaffold workflow to produce the populated PRD stub."
---

# Interview Workflow

## When to Use

- Trigger phrases: "interview me for the PRD", "scope this PRD", "elicit criteria"
- Situation: complex new tasks where OBSERVE-time scoping benefits from structured Q&A rather than the AI inferring scope
- NOT for generating the PRD stub itself once scope is already known — use `Scaffold` directly

## Purpose

For complex new tasks where OBSERVE-time scoping benefits from structured Q&A rather than the AI inferring scope. Produces a fully-populated PRD stub ready for ISC decomposition.

## Procedure

0. **Hypothesis + confidence gate (before Q1).** Write one sentence stating your best read of
   what the principal actually wants, with an honest confidence number (0-100%) and, below ~70%,
   what's missing. Re-state the number after each answer. Two rules: (a) every question carries
   your GUESS at the answer with the reasoning — a wrong guess surfaces the misread cheaply;
   (b) STOP interviewing when you can predict the answers (~95% confidence) — more questions past
   that point is ceremony. If the ask is unambiguous at step 0, skip to scaffolding and say so.
   Non-interactive contexts (loops, cron, CI) never interview — flag the underspecification as a
   blocker instead of guessing.
1. Ask: "What's the user-goal for this PRD?" (sea-level, one sentence)
2. Ask: "What's the kite-level summary-goal? Does a parent RFC exist?" → determines `parent_rfc:` value
3. Ask: "What is OUT OF SCOPE?" (3-5 bullets) → populates `## Out of Scope`
4. Ask: "What constraints / dependencies bound this work?" → populates `## Health & Constraints`
5. Ask: "Effort tier?" → standard / extended / advanced / deep / comprehensive
6. Scaffold the PRD with answers; AI fills `## Goal` paragraph from Q1 + Q2; AI proposes initial ISC seeds from Q1+Q3

Questions 1-5 are the CONTENT floor, not a script: every item must be COVERED before
scaffolding, but an item already at ~95% confidence may be filled from the confirmed hypothesis
instead of asked. Ask the rest one at a time, each with a guess attached, and let low-confidence
areas earn follow-ups.

## Notes

V12.4-β scaffold. Today: AI runs the Q&A as conversation turns; the produced PRD lands via Scaffold workflow. Programmatic harness (one-shot CLI invocation) is a future enhancement.
