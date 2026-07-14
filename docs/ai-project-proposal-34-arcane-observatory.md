# Proposal 34 — Arcane Observatory redesign: repo adaptations and sequencing

Author: Fable, 2026-07-13. Status: direction approved by owner (supersedes the
parchment-everywhere "Printed Tome" presentation as the site-wide direction).

This document does NOT restate the redesign plan. The canonical plan is:

- `docs/arcane-observatory-implementation-plan.md` — phases, tokens, gates,
  testing strategy, master prompt. Read it in full first.
- `mockups/arcane-observatory/index.html` — interactive prototype.

This document is the adaptation layer: everything in the plan that must bend
to how this repository actually works. Where this document and the plan
conflict, this document wins. Where the prototype and the plan conflict, the
plan wins.

## 1. How to read the prototype (important)

The prototype HTML contains TWO `<style>` blocks:

1. The first (base) block is the ORIGINAL glassy prototype. It still contains
   `backdrop-filter: blur(16px)`, cyan neon glows, 16px radii and a
   constellation layer. **Do not use it as a reference.**
2. The second block (starts near the `--radius: 5px` override, labeled
   sections like "Strip remaining glow and transparency cues") is the matte
   revision. It flattens radii to 2–5px, kills all blur/glow, hides the
   constellation, and swaps accents to slate blue `#7896b1`, brass
   `#9b8456`, seal red `#8f4742`, paper `#e8dfcf`.

The EFFECTIVE rendered page (base + override) is the visual reference. If you
read CSS in that file and see glass, blur or neon, you are reading the
overridden base layer. The plan's palette in Phase 1 (`#5c94c8` arcane blue,
`#9e8452` brass, `#a84f49` seal red) differs slightly from the prototype's
matte layer; both are declared starting values — final values are settled in
the browser at Gate 2, leaning matte and engraved.

Typography: keep the repository's fonts mapped to roles (Fraunces = display,
Newsreader = body, Archivo = label caps). Do NOT import the prototype's
Zilla Slab / Montserrat / Roboto / Roboto Condensed. If stat rows need a
condensed numeric face in Phase 2, propose it at Gate 2 — don't just add it.

## 2. Sequencing against in-flight work

Two proposals are already contracted to crews:

- **Proposal 25 (DM server follow-ups)** — server + thin wiring, no UI
  redesign. Unaffected by this pivot. Proceed any time.
- **Proposal 26 (DM Table Round Four A1/A2)** — approved implementation
  contract, presentation-heavy, written in the current Ledger language.
  **It proceeds FIRST, unchanged.** Rationale: its structural outcomes
  (focal hierarchy, active-turn stage, encounter log discipline) are exactly
  what the plan's Phase 4D requires, and the plan's Phase 2 state grammar is
  explicitly "the state system established during the DM-screen design."
  Phase 4D later re-skins that structure in Observatory materials; the
  structure survives, only the material language is swapped.

Ordering rules:

1. Redesign **Phase 0 (audit)** is read-only and may run in parallel with
   proposals 25/26.
2. Redesign **Phase 1+ must not start until CHANGES-DM-11 and CHANGES-DM-12
   have landed.** Both the redesign and proposal 26 append CSS to the end of
   `src/app/globals.css`; running them concurrently guarantees conflicts in
   the append-only zone.
3. Round Four B (folio inspector, card polish, toolbar intent) and the
   soundboard dock are NOT yet specced; when they are, they will be specced
   directly in Observatory language as part of Phase 4D rather than in
   Ledger language.

## 3. Token strategy: fourth era, but the last one

`src/app/globals.css` (13,400+ lines) already carries three token eras:

1. "Direction A: Printed Tome" tokens (`--ground`, `--parchment`, `--rule`)
   plus a **back-compat alias block** (`--ink`, `--gold`, `--glass`,
   `--ember`, …) marked DO NOT REMOVE — components reference the aliases.
2. Ledger tokens (`--ledger-*`, proposal 18) and the document/"paper"
   palette scoped to `.cs-sheet`.
3. The DM Table `--dm-*` layer plus a `.dm-table`-scoped legacy remap
   (comment block ~line 12630).

The plan's Phase 1 semantic tokens (`--surface-*`, `--text-*`, `--border-*`,
`--state-*`) become the **single canonical layer going forward**. Rules:

- New/migrated components use semantic tokens only.
- During migration, repoint the legacy ALIASES at semantic tokens instead of
  raw hex where feasible — components inherit the new theme without edits.
  Verify per-component; the aliases are load-bearing in odd places.
- The `.dm-table` remap and `--dm-*` layer stay untouched until Phase 4D.
- **CSS custom-property cycle landmine:** never redefine the next/font
  variables (`--font-fraunces` etc.) in terms of themselves — the
  self-reference invalidates them document-wide. The warning comment at the
  top of globals.css stands.
- globals.css is append-only by convention: new rules go at the end of the
  file in a labeled block (`/* ═══ Arcane Observatory: <phase> ═══ */`).
  Do not reorder or rewrite old era blocks until Phase 5 (legacy removal),
  and Phase 5 only runs after every gate has passed.

## 4. The skins system is a feature, not legacy parchment

`src/lib/skins.ts` + `CharacterTheme` (paper/ink/accent/font/background per
character, user-saved presets, `FFSKIN1.` share codes, sanitizer) is user
data and shipped behavior. The plan's "parchment only inside documents" rule
is already how skins behave — the skin themes the sheet, not the app.

Additions to the plan's engine-protection list:

- `CharacterTheme` schema, skin share codes, and the sanitizer are
  behavior — do not change.
- Phase 4C (character sheet) must keep every skin preset rendering
  correctly inside the new dark shell, including dark-paper presets
  (Necromancer, Cosmic Void, Crimson Crypt). The shell's semantic tokens
  must not clobber the per-sheet CSS variables.
- Add "all 17 built-in skin presets render on the sheet" to the Phase 4C
  regression checklist.

## 5. Environment corrections to the plan

- The launch configs (`forge-and-fable` :3005, `forge-and-fable-alt` :3006)
  run `next start` — **production mode. Changes are invisible until
  `npm run build` + restart.** Use `npm run dev` for iteration.
- The plan's screenshot requirements (Phase 0 baseline, per-phase captures)
  are owner-assisted in practice: the preview browser wedges at the
  login → app transition. Playwright is in devDependencies — prefer scripted
  Playwright captures; fall back to owner screenshots (incognito only; the
  owner's normal Chrome profile has a color-transforming extension).
- Per-phase gates: `npm run build`, `npm test` (252-test baseline as of
  2026-07-13), `npm run lint` all green — same convention as every round.
- Changelog series for this effort: **`CHANGES-AO-N.md`** (AO-0 = audit,
  AO-1 = tokens, …), one per phase, "no entry = not done."
- Branch: `feature/arcane-observatory-redesign` off `main`, small commits
  per the plan's commit sequence.

## 6. Known landmines (restated so nobody re-learns them)

1. `.dm-command-member > button:first-child` — inserting any element before
   the button unstyles it into the UA gray slab. The sigil `<img>` stays
   after the buttons.
2. Minified single-line JSX/CSS regions and mixed CRLF/LF exist (notably
   DMTablePanel.tsx's IIFE-wrapped request center). Exact-match edits only.
3. `DmWorkspaceMode` lives in `src/lib/dmTable/party.ts`; the view-preset
   system was deliberately deleted (DM-8) — do not reintroduce it.
4. Other AI sessions modify this repo without changelogs — re-verify file
   state before editing; do not trust this document's line numbers.

## 7. First action

Phase 0 only: branch, audit, baseline, written deliverable per the plan's
Gate 1. No visual changes. The audit's migration-order recommendation must
account for §2 sequencing above.
