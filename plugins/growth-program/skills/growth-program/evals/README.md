# GrowthProgram evals

`evals.json` — prompt-level routing + behavior regression for the conductor (the brightdata `evals/`
pattern). Each case is `{id, prompt, expected}`; `expected` describes the routing/behavior to assert
(which workflow, which preset, which integrity rule), not exact output text.

What it guards:
- **Routing** — a prompt reaches the right workflow (RunProgram / CampaignCalendar / GeoPillar / …).
- **Archetype selection** — signals pick the right preset (dev-tool-oss vs b2b-saas-global; enterprise-abm).
- **Integrity** — fabricated stats / fake testimonials trigger the Skeptic guard; publishing needs approval.

Run as an LLM-judged eval (DOS `utilities` eval harness or any judge): feed each `prompt` to the skill,
score the response against `expected`. Dev-only; cheap to extend — drop a new case in the array.
