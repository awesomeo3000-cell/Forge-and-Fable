# Rounds 10–12 — Review pass (Claude, 2026-07-08)

Reviewed CHANGES-10, CHANGES-11, CHANGES-12-pages against the code and the running app,
including every item the changelogs flagged as "spot-check next session."

## Verified good
- **R10 spell-cap fix:** leveled a Ranger to 3 in the app — spell picker offered ONLY
  level-1 spells (17 rows), exactly the level where the old `ceil(level/2)` formula
  over-offered. Correct.
- **R10 changelog claims** spot-checked (alignment picker, settings panel reduction,
  feats options-object signature with single call site) — consistent with code.
- **R11 tools/languages/currency:** reviewed validation cases (bounded arrays, capped
  strings, non-negative currency ints) — solid; changelog's own runtime verification was
  thorough (Bard instrument cap, Sage languages, carry weight math).
- **R12 pages:** section registration, layout migration, tab strip, block CRUD all work;
  **broken-image fallback verified live** ("Image unavailable" renders after onError on a
  dead domain — the flagged spot-check passes); **dark-skin readability verified** under
  Necromancer (light ink title, muted fallback). Codex's "headless blur flakiness" note
  was accurate — programmatic focus/blur is unreliable in headless Chromium; a bubbling
  `focusout` dispatch is the reliable test path (noting for future verification sessions).

## Bugs found & fixed during review
1. **R12 pages: draft image blocks could never persist (silent total data loss for the
   patch).** Adding an image block saves immediately with `url: ""`, but the server
   validator rejected empty as "must be an http(s) URL" → the WHOLE pages patch 400'd
   (page + all blocks lost on reload) while the UI showed success. Reproduced live
   (400 captured on the wire). **Fix:** `validateCharacter.ts` now accepts `""` as a
   draft placeholder; non-empty URLs still require `https?://`. Re-verified: page +
   empty image block persist; URL commit persists; fallback works.
   *Lesson for the changelog record: R12's own verification only round-tripped text
   blocks — image blocks were never round-tripped. "Verify every block type through the
   real PUT" added to review lore.*
2. **R10 settings: `useFeatPrerequisites` defaulted to `false`** — the QA P0 prerequisite
   enforcement was OFF for every new character unless they found the toggle. Flipped the
   default to `true` (RAW by default; toggle relaxes). Existing characters keep their
   stored setting.

## Status after review
- `npm run lint` 0 app errors, `npm run build` clean.
- Roadmap items closed by R10–R12: §2.1 (P1 sweep), §2.3 (pages), §2.4 (toggles),
  §2.5 (registration atomicity), §2.7 (dead code); §3.10 (tools/languages),
  §3.11 (currency/encumbrance). §3.13 (XP) intentionally skipped per user decision.
  §2.6 (passive-check nuance) still open. Next per roadmap: R13 (SQLite + auth) — the
  hosting gate; treat as strongest-agent work with mandatory review.
