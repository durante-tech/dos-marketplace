---
name: AuthorArchetype
description: Mint a new feature-archetype matrix via two-cohort live market mining, then encode it as typed data.
divergence_from_canonical:
  _workflow-voice.md:
    partial_version: 1.0.0
    reason: "hand-authored v0.0.1; canonical-partials adoption queued for next enhancement pass"
  _intent-to-flag-table.md:
    partial_version: 1.0.0
    reason: "hand-authored v0.0.1; canonical-partials adoption queued for next enhancement pass"
  _workflow-output-shape.md:
    partial_version: 1.0.0
    reason: "hand-authored v0.0.1; canonical-partials adoption queued for next enhancement pass"
status: STABLE
---

# AuthorArchetype Workflow

Create (or extend) an archetype matrix. The output is a typed `Data/<Name>.archetype.ts` module — never a prose-only matrix. Field-proven recipe: the 2026-07-08 media pilot and billing mint, then hardened across 25 measured generations and proven on the 2026-07-09 auth-session + notifications field mints (parallel miners, live-doc verification, one session per mint).

## Voice Notification

```bash
bash "$DOS_DIR/DOS/Tools/voice.sh" main "Running the AuthorArchetype workflow in the Archetypes skill"
```

Running the **AuthorArchetype** workflow in the **Archetypes** skill...

## Steps

### Step 1 — Define the archetype and its cohorts

- Name the archetype (kebab-case, e.g. `notifications`, `import-export`, `audit-log`).
- Pick **two cohorts** (mandatory — single-cohort grounding mis-tiers; media pilot: tags looked table-stakes from services but are 0-1/8 in-app):
  1. **In-app cohort** — 6-8 products whose embedded version of this feature sets user expectations.
  2. **Dedicated cohort** — 4-6 services/products whose whole business is this feature (reveals API-tier norms).

### Step 2 — Fan out mining agents (parallel)

Spawn 2 web-research agents + optionally 1 read-only inventory agent (if auditing an existing implementation in the same pass). Each web agent MUST:
- Verify against LIVE docs (WebFetch), never training data alone — minimum 6 fetched URLs each.
- Return a capability table: `| capability | references shipping it | count | notes |` (~30-45 rows).
- **Self-consistency before writing:** reconcile overlapping/kindred capability rows so no two rows contradict each other's counts (gen-5 probe shipped "mTLS/static-IP 0/6" two lines above "static egress IPs 2/6" — one reconciled row, or two rows with disjoint definitions, never a contradiction).
- **Provenance survives the pipeline (gen-17, H3):** every count in the table cites its doc URLs, and confidence caveats ("inferred", "implied", "not directly quoted") are explicit — synthesis MUST propagate them to `inferred: true` on the evidence entry (the validator refuses a T1 universality override resting on inferred counts) and carry the URLs into `refs`.
- Name 3-5 surprisingly-universal capabilities and 3-5 clearly-premium ones.

### Step 3 — Synthesize rows

- Tier by the **in-app cohort** (T1 ≥6/8; T2 4-5/8; T3 ≤3/8 including 0 — bands are exclusive, every count maps to exactly one tier), with ONE unconditional override: a capability universal across the services cohort is T1 regardless of in-app count (in-app UIs hide backend capabilities; demoting it requires a groundingException — the validator enforces this). **A partially-inferred count is judged on its confirmed sub-count for T1 (gen-38):** an inferred in-app count clears the T1 band only if `confirmed ≥ 6`; an inferred universal count grants the override only if `confirmed == of` — otherwise the row takes the tier its confirmed portion supports, or carries a declared groundingException (the `t1-grounding` check enforces this).
- No other promotion paths: counts + the universality override are the only tiering rules ("segment leaders" was removed — it minted unsanctioned T2s). A tier FORCED by doctrine (an anti-criterion makes the capability non-optional) is declared via `mandatedBy: '<anti-id>'` in the row data — never inferred by a reviewer; the validator requires the named source to exist. Rows with no in-app evidence tier as if in-app 0 (T3) unless the override applies. Doc-thin table-stakes with 0 market count (empty/loading states) take T1 only via a groundingException DECLARED in the row data — reviewers and judges never infer one.
- **Row atomicity (hard output contract — the Splitting Test for rows):** one row = one independently-verifiable capability. If a row can fail two independent ways, it is two rows. The two banned shapes: conjunctive bundles ("show-once secret AND rotation grace period" — vendors shipping only one half get miscounted) and disjunctive bundles ("auto-ping OR verification handshake" — counts sum vendors satisfying different things). Evidence counts NEVER sum across sub-capabilities; when tempted to write "and"/"or"/"with"/"plus" in a capability name, split and give each row its own counts (gen-5 probe: 7 of 15 skeptic findings were this shape).
- Write a **seed ISC** per row: fork-agnostic, verifiable, and **5-16 words as a hard output contract — count the words of every seedISC before emitting; 17+ is a validator failure** (`seed-isc-length`). Compliant examples: "Registered endpoints receive subscribed events with HMAC signatures" (8 words); "Failed deliveries retry automatically with exponential backoff" (7 words). Stated as prose alone this bound was ignored on 24/38 rows (gen-4 probe); stated as this contract, 0/31 (gen-5 probe).
- Add **context riders** for deployment-shape rows with no market cohort (e.g. `saas-multitenant`, `metered`, `generation`) — and a one-line `riderRationale` stating the within-shape tier basis (gen-18: rider tiers are judgments; judgments get recorded — the validator requires it on evidence-less rider rows).
- Add **anti-criteria** (`a-` prefixed): the tempting-but-wrong moves this archetype punishes. **Anti-criteria are output contracts too (gen-21):** `rule` is a testable must-NOT statement; `why` names the concrete failure the rule prevents and MUST NOT contradict the rule (a gen-7 probe shipped a self-contradictory `why`); where a matrix row covers the guarded capability, the `why` names it.
- **Absence diff + exclusion ledger (mandatory synthesis output):** before handing rows over, diff BOTH miner capability tables against the row set. Every table line that does not become a row gets an exclusion-ledger entry — `capability | count | one-line reason` (e.g. "subsumed by row X", "adjacent domain, out of scope", "singleton delighter, below encoding threshold") — emitted alongside the rows under the JSON key `exclusions`. A drop with a reason is a decision; a drop without one is the ISC-A2 defect this system exists to kill (gen-4 probe: 11 silent singleton drops; billing: 3 skeptic-caught absent rows). **Cutoff-class exclusions obey ONE declared threshold (gen-20):** the ledger's first entry is a header — `{"capability": "_cutoff", "count": "<N>", "reason": "rows below N in their cohort encode only if premium-notable"}` — and every below-cutoff exclusion cites it. Two same-count capabilities with different cutoff verdicts is a defect (the gen-5/7 ledger-quality class). **"Premium-notable" decides only whether a below-cutoff capability ENCODES as a row at all — it is never a tier-promotion path; an encoded row's tier still comes exclusively from Step 3's rules (gen-22: a probe synthesis narrated it as an override).**

### Step 3b — The canonical synthesis contract block (gen-24)

Every contract above is only as good as the prompt that carries it — three consecutive syntheses violated contracts the orchestrator's hand-written prompt dropped (anti-id shape 3×, sources shape once). **Paste this block VERBATIM into every synthesis-agent prompt; do not re-derive it:**

```
OUTPUT CONTRACTS (validator-enforced; violations fail encoding):
- rows: {"id":"kebab-case","capability","dimension","tier":"T1|T2|T3","evidence":[{"cohort","shipping","of","refs":[doc URLs],"inferred":true-if-caveated}],"seedISC":"5-16 words, count before emitting"}
- one row = one capability; NO and/or bundles; counts never sum; counts+refs from miner tables only; propagate table caveats to inferred (T1 override on inferred-only counts FAILS)
- carry the FULL table count with inferred:true on caveated members; never trim to the doc-confirmed subset (trimming under-grounds the row and forces post-hoc adjudication)
- when a table states a confirmed sub-count ("N confirmed / M total"), emit it as "confirmed":N alongside the full count (the validator accepts T1 when the confirmed portion alone clears the bar)
- contextRider rows with no evidence REQUIRE riderRationale; mandatedBy names an existing a- anti-criterion id
- antiCriteria: {"id":"a-<kebab-slug>","rule":"testable must-NOT","why":"names the prevented failure, never contradicts the rule, names guarded rows"}
- anti-criteria why claims about vendor capabilities trace to miner table lines exactly like counts do; a why may not assert more than its table line grounds (over-claim = finding)
- when a miner roster table declares member-fit caveats (adjacent-category, sunset, bundled-feature), propagate them into EVERY row those members ground: the caveat in the row note, and inferred:true where the member's cell is itself caveated (an unpropagated roster caveat = finding)
- sources: flat ARRAY of URL strings (never a dict/paths)
- top-level container shapes are fixed: cohorts = ARRAY of {id,label,references:[names]}; tierDefinitions = OBJECT with exactly the keys T1,T2,T3 (each a prose string); exclusions = ARRAY — a dict, prose-string, or other improvised container for ANY of these fails encoding (deviations shipped 3×: sources dict, cohorts dict, tierDefinitions string)
- exclusions: first entry {"capability":"_cutoff","count":"<N>","reason":"rows below N in their cohort encode only if premium-notable"}; every below-cutoff exclusion cites it; premium-notable gates ENCODING only, never tier; zero unaccounted table lines
```

### Step 4 — Encode and validate

**The orchestrator encodes; agents don't write TS.** The synthesis agent returns (or writes to a scratch path) schema-shaped JSON — `{name, title, cohorts, tierDefinitions, rows, antiCriteria, sources, exclusions}` — and the orchestrator deterministically wraps it into the typed module, **stripping `exclusions` first** (the ledger is a mint-time decision record for the mint PRD and the Step 4b audit, not corpus data) (`import type { Archetype } …; export const <Name>: Archetype = …; export default …`). The schema is exacting; hand-written agent TS is how malformed modules ship (billing-mint decision, proven).

Write `Data/<Name>.archetype.ts` conforming to `Schema/Archetype.ts` (default-export the object), then validate and render:

```bash
cd ~/.claude/skills/archetypes
bun Tools/ValidateArchetype.ts --only <archetype-name>
bun Tools/RenderArchetype.ts <archetype-name>
```

Fix every validator finding before shipping. The rendered markdown is a projection — commit the `.ts`, generate the `.md` on demand.

### Step 4b — Adversarial skeptic pass (mandatory before Step 5)

Spawn a **fresh agent with no synthesis context**. The orchestrator prepares TWO row artifacts so derivation happens blind: (1) an **evidence-only view** (id, capability, dimension, evidence counts, rider/exception presence — tiers stripped), (2) the **stored-tier key**. Hand the skeptic the evidence-only view, the miners' raw capability tables (Step 2 output), Step 3's tiering rules, and the key LAST, with instructions to:

1. **Re-derive tiering** for every row from the evidence-only view FIRST (bands + the unconditional universality override + the declared-exception rule), then diff against the stored-tier key. Every mismatch is a finding, cited to the rule that decides it. (Deriving before seeing the stored answer is the point — a skeptic shown conclusions confirms them.)
2. **Hunt silent absences** — diff each miner capability table against the row set. Any cohort-shipped capability with no row and no recorded exclusion is a finding (this is the ISC-A2 failure class the system exists to kill).
3. **Verify evidence arithmetic** — every `shipping/of` count must trace to the miner tables or cited sources. Counts carry the FULL table membership with caveated members flagged `inferred` (gen-25 law) — a properly-flagged full count is CORRECT, not a finding; the findings are counts that don't trace, counts that sum across sub-capabilities, and caveated members missing their `inferred` flag.
4. **Verify anti-criteria completeness, why-provenance, and contextRider correctness** — a tempting-but-wrong move the domain punishes with no `a-` rule, a rider the evidence does not support, or a deployment-shape row missing its rider is a finding (the wrong-riders / missing-anti-criteria failure class from the billing mint). **Why-provenance (gen-39):** audit every anti-criterion `why` claim about vendor capabilities against the miner tables — a `why` asserting more than its table line grounds is a finding, cited to the line (the gen-36 probe emitted 4 such over-claims THROUGH the contract-block rule; prose contracts don't police prose — this audit is the enforcement surface for non-mechanical claims).

The skeptic's output is **always the itemized findings list — empty if none found — never a PASS/ADJUST grade or any other verdict noun.** A binary approve/reject label is an incentive-to-approve surface: it gives the skeptic an achievable done-state that rewards finding nothing instead of digging harder. Apply every finding (or record in the mint PRD why not), then re-run the validator. Skipping this step forfeits the class of defects the validator structurally cannot see (billing mint: 14 findings, including 3 silently-absent rows and 2 evidence-hygiene errors, on an encoding that validated clean).

### Step 5 — Version and sync

- New archetype starts at `version: 0.1.0`. Extending an existing one (compounding loop: audit findings become rows) bumps minor and updates `updated`.
- Pack-source is SoT — propagate per the Four-Copy footer and run `bun ~/Durante/Tools/sync-check.ts`.

## Intent-to-Flag Mapping

### Validation scope

| User Says | Flag | When to Use |
|-----------|------|-------------|
| "validate everything", "check the corpus" | (no flag) | All Data/*.archetype.ts |
| "validate <name>", "just this archetype" | `--only <name>` | Single archetype |
| "machine-readable", "JSON" | `--json` | Piping findings into tooling |

### Rendering

| User Says | Flag | Effect |
|-----------|------|--------|
| "show the matrix", "render it" | `<name>` (stdout) | Markdown to console |
| "write the matrix to a file" | `<name> --out <path>` | Markdown projection to file |
| "what archetypes exist" | `--list` | Name/version/row-count listing |

## Output

- `Data/<Name>.archetype.ts` (typed source) — validator exit 0.
- Optional rendered projection for review.
- Log the artifact per the Artifact Tracking section of `SKILL.md` (type: `archetype-matrix`).
