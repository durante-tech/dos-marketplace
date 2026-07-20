// RFC-0112 A1 — vendored hook-dependency bundle ENTRY.
//
// `Tools/bundle-hook-deps.ts` runs `Bun.build` on this single file to produce
// the self-contained `prd-bundle.js` that DOS hooks fall back to on a fresh
// install with no `node_modules`. ONE shared module (amendment A1): it exports
// the whole `@durante/prd` parser API AND a `yaml` `parse` function, so both
// the PRD hooks and `SecurityValidator` resolve from the same vendored bundle
// — `yaml` is bundled once, never duplicated per hook.
//
// This file is SOURCE (committed, editable). The build OUTPUT `prd-bundle.js`
// is generated — do not hand-edit it; the A4 parity test fails loud if it
// drifts from this entry + the workspace `@durante/prd` source.
export * from '@durante/prd';
export { parse as parseYaml } from 'yaml';
