---
name: iOSStarter
pack-id: durante-ios-starter-v0.1.0
version: 0.1.0
author: durante-tech
description: Entry card for the dos-ios-starter — a native iOS foundation built on SwiftUI + @Observable + Tuist + swift-openapi-generator + backend JWT via Keychain + OpenTelemetry to Pydantic Logfire. v0.1.0 scaffold-only — the scaffold/extend workflows (Bootstrap, AddFeatureModule, WireOpenAPISpec, AddSocialProvider, DeployTo, AuditPrivacy, WireLogfire) are PLANNED for v0.2.0 and NOT yet shipped, so this skill does not yet execute them. USE WHEN ios starter kit, dos-ios-starter, native ios foundation, swiftui starter project, ios scaffold reference.
type: skill
role: scaffolder
visibility: public
category: Engineering
platform: claude-code
dependencies: []
keywords: [ios-starter, swiftui, observable, tuist, swift-openapi-generator, sign-in-with-apple, keychain, opentelemetry, logfire, pydantic-ai, dos-ios-starter, app-store, testflight]
writes: false
divergence_from_canonical:
  _customization*.md:
    partial_version: 1.0.0
    reason: "Scaffolder pack — customization surface deferred to v0.2.0+; per-operator project preferences live in dos-ios-starter repo CONFIG, not skill frontmatter"
    rationale_link: null
  _four-copy-footer*.md:
    partial_version: 1.0.0
    reason: "Scaffolder pack — four-copy footer is infrastructural decoration; SCAFFOLDER skills emit project files (Xcode/Tuist), not MEMORY artifacts"
    rationale_link: null
---
<!-- generated-from: SKILL.partials.md — DO NOT EDIT directly. Run: bun Tools/dos-build.ts skill <path> -->
# iOSStarter

> Scaffolds and extends the `dos-ios-starter` — Durante's native iOS foundation.

---

## The Problem

Each new iOS app re-invents the same primitives — Tuist + SPM workspace
shape, SwiftUI + `@Observable` ViewModel seam, Sign-in-with-Apple +
Keychain JWT storage, swift-openapi-generator with ACL discipline,
OpenTelemetry → Logfire wiring, App Store privacy manifest. The
`dos-ios-starter` repo solves the *initial* problem; ongoing work on top
of it (adding feature modules, regenerating against new specs, wiring
extra providers, deploying) still benefits from packaged workflows.

---

## The Solution

The **iOSStarter** pack packages workflows + tools + manifests behind a
single SKILL.md entry card with the canonical RFC-0011 distribution
manifest.

**Planned capabilities (v0.2.0+):**

- **Bootstrap** — clone the starter, rename bundle ID, configure signing,
  first commit
- **AddFeatureModule** — scaffold a new SPM package via Tuist target
  entry with the StateStore seam pre-wired
- **WireOpenAPISpec** — pull `/openapi.json`, run swift-openapi-generator,
  extend the `APIClient` ACL with translation helpers (Tidy First commit
  enforced)
- **AddSocialProvider** — wire a new social auth provider alongside SiwA
  + Google + GitHub
- **DeployTo** — guided deploy via TestFlight / App Store Connect /
  Xcode Cloud / Fastlane + GitHub Actions / Enterprise
- **AuditPrivacy** — review `PrivacyInfo.xcprivacy`, ATT key, privacy
  nutrition labels, App Store rule 4.8 SiwA enforcement
- **WireLogfire** — replace the OTel stub with OpenTelemetry-Swift SDK
  + OTLP/gRPC exporter, ship spans to a Logfire endpoint

**v0.1.0 scaffold-only.** Workflows TBD.

---

## Source repository

`~/Developer/dos-ios-starter` — greenfield (no upstream fork; the design
itself is the work product, not an adaptation of someone else's
boilerplate).

> **Distribution status (v0.1.0): operator-local, not yet distributable.** The starter currently
> lives only on the maintainer's machine — it has no public/Durante remote and is not vendored into
> this pack. So the planned Bootstrap workflow's "clone the starter" step works only on the author's
> machine today. Before any workflow ships (v0.2.0), the distribution model must be resolved — one of:
> vendor a template subset into the pack (heavier, drifts from upstream), publish `dos-ios-starter`
> as a clonable remote (needs a hosting decision), or make the source a configurable repo path with a
> documented default. The Examples below describe **planned (v0.2.0) design**, not shipped behavior.

## Examples

**Example 1: Bootstrap a new iOS app**

User: "Create a new SwiftUI app from the iOS starter for com.altyaa.coach."

The workflow should clone `~/Developer/dos-ios-starter`, rename the bundle ID, verify Tuist generation, wire signing placeholders, and return the first-commit checklist.

**Example 2: Add a feature module**

User: "Add a Settings module with a ViewModel and API-backed preferences screen."

The workflow should scaffold a Tuist/SPM target, keep SwiftUI state behind an `@Observable` ViewModel, add tests around the feature seam, and document the module entry points.

**Example 3: Wire an OpenAPI spec**

User: "Regenerate the API client from the backend `/openapi.json` and expose account endpoints."

The workflow should run swift-openapi-generator, update the APIClient anti-corruption layer, avoid leaking generated DTOs into views, and produce a focused diff summary.

## See also

- Sibling pack: `fastapi-starter-team` (Python/FastAPI/Pydantic AI backend delivery) — the actual
  sibling in the starter family. (An earlier reference to a solo `FastAPIStarter` pack was wrong:
  no such pack exists; the family converged on the team-delivery substrate alongside `makerkit-team`.)
- The following are **operator-local provenance** (the maintainer's machine), NOT files shipped with
  this pack or a distributed dependency a customer can resolve — recorded for traceability only:
  - Sibling kit: `~/Developer/dos-fastapi-starter/`
  - Build PRD: `~/Developer/dos-ios-starter/MEMORY/WORK/20260506-201901_dos-ios-starter-build/PRD.md`
  - Design PRD: `~/Developer/dos-ios-starter/MEMORY/WORK/20260506-195312_ios-starter-kit-research-design/PRD.md`
