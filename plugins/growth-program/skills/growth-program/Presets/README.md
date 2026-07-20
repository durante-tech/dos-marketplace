# GrowthProgram Presets

Reusable archetype profiles — each pins a channel mix + cadence, the creative `signature_formats` the
Media engine should favor, the **answer-engine reality** for that niche (`geo.engines` + `corpus_targets`
+ `note`), and an archetype-specific **integrity** contract (`do_not` + `must`). Pass a preset to skip
re-deriving the channel/GEO/integrity shape from scratch; the council still tunes it to the product.

| Preset | Market | Answer-engine reality (the GEO note) |
|---|---|---|
| `local-smb-french` | Local SMB, France | Le Chat is FR-biased/RGPD-native — DIY probe only |
| `b2b-saas-global` | B2B SaaS, EN | Claude→Capterra+editorial; Perplexity→Reddit+freshness |
| `dtc-ecommerce` | DTC product brand | shopping-graph + influencer + UGC > LLM-text; Gemini→Shopping/GBP |
| `dev-tool-oss` | Dev tool / OSS | code LLMs cite docs+GitHub+Reddit/SO; llms.txt IS the play |
| `fintech-regulated` | Regulated fintech | LLMs conservative on finance; editorial authority + clarity win |
| `creator-personal-brand` | Solo creator | the creator IS the corpus — entity + podcast/interview citations |
| `healthcare-ymyl` | Healthcare (YMYL) | E-E-A-T is everything; reviewed-by-clinician + sources or excluded |
| `enterprise-abm` | Enterprise B2B | the answer corpus is the ANALYST corpus (Gartner/Forrester) |

**Schema:** `preset · locale · market · wedge_hint · channels[] · cadence{} · signature_formats[] ·
geo{engines[], corpus_targets[], note} · integrity{reviews_pillar_gated_on, do_not[], must[]}`. Optional
`compose[]` names a composed pack that leads for the archetype (e.g. `stream-rig` for creators).
Add a preset by dropping a new `.yaml` here.
