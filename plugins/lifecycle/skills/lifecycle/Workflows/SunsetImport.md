---
name: SunsetImport
description: Retire an adopted external import — dormant upstream, native absorption, or field failure — with attribution preserved
bestPath:
  - title: "Trigger Re-Verification"
    description: "Fresh dated evidence for the sunset trigger — staleness readings expire; a revived upstream is a keep signal."
  - title: "Keep-Test"
    description: "Re-run the Retire keep-test; a self-contained import can outlive its upstream."
  - title: "Motion Choice"
    description: "REMOVE with attribution tombstone, CONVERT TO POINTER, or RE-ADOPT through the full assay."
  - title: "Ledger Mirror + Closure"
    description: "Sunset entry mirrors the adoption entry where it was ledgered; closure per Retire Step 5."
---

# SunsetImport Workflow

## When to Use

- An adopted external capability (imported skill body, technique, or tool) hits a sunset trigger
- NOT for in-house capabilities (use `Retire` directly) or relocations (use `MigrateSurface`)

## Sunset triggers

Any one opens the question; none auto-decides:

1. **Upstream dormant** — no pushes in 6+ months while the corpus carries its content (the zombie
   signal; for Prospector-adopted imports the census `upstream_staleness` leg flags this
   mechanically)
2. **Native absorption** — the harness or platform now ships the capability; under the
   compose-on-native law the local copy has become the graveyard shape
3. **Field failure** — the import's frozen field prediction scored MISS, or the qualifying-use
   window elapsed with zero real invocations
4. **License or compliance change** upstream

## Procedure

1. **Re-verify the trigger with dated evidence** (fresh `gh api` pull, changelog read). A
   dormancy flag from last month on a repo that revived last week is a keep signal — staleness
   readings expire.
2. **Re-run the keep-test** (Retire, Step 1). An import can rightfully outlive its upstream when
   the content is self-contained and still earns its keep; dormancy alone is not a verdict.
3. **Choose the motion:**
   - **REMOVE** — content deleted per Retire mechanics; the upstream credit moves INTO the
     tombstone. Attribution is never deleted — history keeps it.
   - **CONVERT TO POINTER** — content replaced by a pointer entry naming the upstream and its
     install path (the curated-pointer shape). Right when the capability is real but carrying a
     local copy is the liability.
   - **RE-ADOPT** — upstream revived or the defect resolved; refresh through the full assay
     (adoption evidence, license, overlap, security) instead of sunsetting.
4. **Mirror the ledger.** The sunset entry lands where the adoption was ledgered (importing
   loop's ledger, pack CHANGELOG) and mirrors its adoption row — claim, evidence, verdict.
5. **Closure** per Retire Step 5.

## Field precedent

Vendored Anthropic document-skills (PAI heritage, sunset 2026-07-12): the license class made the
vendored copies non-distributable — motion was REMOVE plus a router rewrite to the official
plugin (a pointer conversion in effect). The locally-authored delta (`html2pptx.js`) and the
attribution both survived the sunset; only the liability left.
