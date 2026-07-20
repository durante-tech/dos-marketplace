# SkillLifecycle — How This Skill Is Created, Updated, Validated, and Evaluated

This is the interop protocol between the two skill-creation systems that touch MakerkitTeam.
It exists because the official skill-creator plugin's documented update flow silently destroys
generated four-copy skills (2026-07-02 audit, finding SL-4).

## Ownership Split

| Concern | Owner | How |
|---|---|---|
| Create / Update / Validate / Canonicalize | **Utilities CreateSkill** (DOS-native) | Edit `SKILL.partials.md` in PACK SOURCE (`~/Durante/Packs/makerkit-team/src/`) → `bun ~/Durante/Tools/dos-build.ts skill <pack>` regenerates `SKILL.md` into all copies → `bun ~/Durante/Tools/sync-check.ts` must be clean before commit |
| Eval methodology (trigger evals, benchmark loop) | **skill-creator plugin** (claude-plugins-official) | Invoked AS A TOOL by the validate step. Input: `evals/evals.json` (trigger set incl. twin-collision negatives). Its description-optimizer and benchmark viewer are the sanctioned surfaces. |
| Static contract eval | **This pack** | `Tools/__tests__/ContractEval.test.ts` — reference integrity, retired-API bans, wire-or-delete, version parity. Runs with `bun test`. |

## Forbidden Operations (SL-4 class)

- NEVER edit the generated `SKILL.md` directly — the `generated-from` banner is the tripwire; edits are destroyed on the next `dos-build`.
- NEVER use the skill-creator plugin's copy-to-`/tmp` → edit → package update flow on this skill — it bypasses partials-mode AND the four-copy rule; the packaged output overwrites none of the real copies and diverges from all of them.
- NEVER edit the live install (`~/.claude/skills/makerkit-team/`) — it is a deploy target; pack source is the only writable surface.

## Update Pipeline (the only sanctioned path)

1. Edit pack source (`SKILL.partials.md`, `Workflows/`, `Tools/`, `Data/`).
2. `cd ~/Durante/Packs/makerkit-team/src && bun test` — suite green.
3. `bun ~/Durante/Tools/dos-build.ts skill ~/Durante/Packs/makerkit-team/src` — regenerate `SKILL.md` into all copies.
4. Deploy non-generated files to the live install (rsync pack → live), then `bun ~/Durante/Tools/sync-check.ts` — zero drift.
5. `cd ~/.claude/skills/MakerkitTeam && bun test` — the DEPLOYED copy must be green too.
6. CHANGELOG entry + version bump in `SKILL.partials.md` Status (ContractEval asserts the version strings match).
