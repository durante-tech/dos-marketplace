# Archetype → preset selector

The conductor (`RunProgram`) reads this to auto-select a preset from detected project signals, then
confirms with the operator. A preset is a starting hypothesis — the council still tunes every cell.

| If the product is… | Detected signals | Preset |
|---|---|---|
| Local service business (restaurant/salon/clinic), few locations, **France/FR** | GBP profile, local pages, French copy, `locale: fr` | `local-smb-french` |
| **B2B SaaS**, sells to companies, EN/global | pricing/"for teams" pages, G2/Capterra listing, seat-based plans | `b2b-saas-global` |
| **DTC** consumer product brand | Shopify/cart, SKUs, IG/TikTok-led, shipping pages | `dtc-ecommerce` |
| **Developer tool / OSS** | GitHub repo, docs site, CLI/SDK, `package.json`/`pyproject` | `dev-tool-oss` |
| **Regulated fintech** / financial services | "invest"/"lending"/"payments", compliance + disclaimer copy | `fintech-regulated` |
| **Solo creator / personal brand** | one person, newsletter, YouTube/podcast, build-in-public | `creator-personal-brand` |
| **Healthcare / medical (YMYL)** | clinical claims, medical content, practitioner bios | `healthcare-ymyl` |
| **Enterprise B2B** | "enterprise"/SOC2/SSO, analyst coverage, ABM motion | `enterprise-abm` |

**Decision rule:** pick the highest-confidence single match. If two are close (e.g. dev-tool that's also
B2B SaaS), present both to the operator with the signal evidence and let them choose — never silently
guess. No confident match → run preset-less (derive channels/cadence/GEO from project knowledge).

**Selection signals come from:** `sentinel` repo scan (routes, schema, package manifests, copy),
`mem-palace` recall (prior positioning), and the brand baseline. Locale is authoritative — a French local
SMB is `local-smb-french`, not `b2b-saas-global`, even if it sells software.
