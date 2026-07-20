# iOSStarter v0.1.0

Scaffolds and extends the **dos-ios-starter** — Durante's native iOS foundation
built on SwiftUI + `@Observable` + Tuist + swift-openapi-generator + backend
JWT via Keychain + OpenTelemetry → Pydantic Logfire.

Sibling pack to `FastAPIStarter` (which targets `dos-fastapi-starter`). Where
FastAPIStarter scaffolds Python service backends and agent APIs, iOSStarter
scaffolds SwiftUI consumer apps that read those backends' OpenAPI documents
and stream from their `/agents/chat` endpoints.

## Status

**Bootstrap scaffold (v0.1.0)** — pack manifest, install/verify wiring, and the
SKILL entry card are present. Workflows TBD. Not yet ready for distribution.

## What this pack will provide (planned)

- **Bootstrap** — clone `dos-ios-starter`, rename bundle ID, configure
  signing team, first commit
- **AddFeatureModule** — scaffold a new SPM package (Sources + Tests + Tuist
  target entry) for a vertical feature — domain types + ViewModel +
  SwiftUI views following the StateStore seam
- **WireOpenAPISpec** — pull a backend's `/openapi.json`, run the generator,
  scaffold an `APIClient` ACL extension translating the new endpoint's
  generated types to domain types (Tidy First commit discipline enforced)
- **AddSocialProvider** — wire a new auth provider (e.g., Microsoft, Facebook)
  alongside SiwA + Google + GitHub — protocol conformance + UI button +
  backend JWT exchange path
- **DeployTo** — guided deploy to TestFlight / App Store Connect / Xcode Cloud
  / Fastlane + GitHub Actions / Enterprise per `docs/deployments/`
- **AuditPrivacy** — review `PrivacyInfo.xcprivacy`, `Info.plist` ATT key,
  privacy nutrition label coverage, and Apple Sign-In rule 4.8 enforcement
- **WireLogfire** — replace the OTel stub with the OpenTelemetry-Swift SDK,
  configure the OTLP/gRPC exporter, ship spans to a Logfire endpoint

## Source repo

`~/Developer/dos-ios-starter` (greenfield — no upstream remote, not a fork).

## See also

- Sibling pack: `~/Durante/Packs/FastAPIStarter/`
- Sibling kit: `~/Developer/dos-fastapi-starter/`
- Build PRD: `~/Developer/dos-ios-starter/MEMORY/WORK/20260506-201901_dos-ios-starter-build/PRD.md`
- Design PRD: `~/Developer/dos-ios-starter/MEMORY/WORK/20260506-195312_ios-starter-kit-research-design/PRD.md`
