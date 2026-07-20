# Motion Primitives — Reference Mirror

A complete, offline mirror of the [Motion Primitives](https://motion-primitives.com/docs)
documentation and component source, for use as a **best-practices catalog when building
custom animated UI** in this repo.

This is a **repo/agent-facing reference** (per `AGENTS.md` docs boundary: top-level `docs/`
is for contributors and agents, not in-app product docs). It is third-party material kept
verbatim — do not edit the mirrored files; treat them as read-only source of truth.

## Start here

- **[INDEX.md](./INDEX.md)** — the catalog. 33 components grouped (Core, Text, Number,
  Interactive, Toolbars, Advanced), each with a description, source-file pointer, and
  example count. This is the file to feed a conversation that needs "the complete list of
  components we use as best practices."

## Layout

```
INDEX.md                      catalog of all components (start here)
getting-started.mdx           upstream intro / vision
installation.mdx              upstream setup instructions
LICENCE.md                    upstream license (MIT) — attribution
components/<name>/
  page.mdx                    official docs (description, usage, props/API)
  <name>.tsx                  copy-paste-ready core implementation
  examples/*.tsx              usage variants shown in the docs
shared/
  hooks/*.tsx                 supporting hooks (useClickOutside, usePreventScroll)
  lib/*.ts                    supporting utilities (utils, etc.)
registry/<name>.json          shadcn-style installable bundle (deps + files) per component
```

## Provenance

- **Upstream:** https://github.com/ibelick/motion-primitives (`main` branch)
- **Author:** Ibelick — https://motion-primitives.com
- **Stack:** React + [Motion](https://motion.dev/) (Framer Motion) + Tailwind CSS
- **Mirrored:** 2026-06-09
- **License:** MIT — see [LICENCE.md](./LICENCE.md). Attribution retained.

## Regenerating

This mirror was assembled by shallow-cloning the upstream repo and copying:
`app/docs/*/page.mdx` (docs) + `app/docs/*/*.tsx` (examples) + `components/core/*.tsx`
(implementations) + `hooks/` + `lib/` + `public/c/*.json` (registry). To refresh:

```bash
git clone --depth 1 https://github.com/ibelick/motion-primitives.git /tmp/mp-src
# then re-run the copy + INDEX-generation steps used to build this folder
```

Live install of any component (preferred over copy-paste for updates):

```bash
npx motion-primitives@latest add <name>
```
