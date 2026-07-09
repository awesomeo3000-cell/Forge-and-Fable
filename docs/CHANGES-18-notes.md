# CHANGES-18-notes — owner's notes round (2026-07-09, applied by the reviewer)

Fixes for the six notes the owner raised after reviewing Codex's 18a–18d. All verified in the running production build (login → new character → full commission walk-through).

## 1. Skill/tool/language chips now fully highlight when picked
`.ledger-spread .dj-skill-chip.picked` (appended override) — picked = solid `--ledger-seal` fill with paper text. Verified: `rgb(140, 47, 34)` background on pick.

## 2. Learn-modal header redone (the "square in a circle" mess)
Two causes, both fixed:
- **Root cause of the overlap/line-through-seal:** `.ledger-page > *` (the grain-overlay `position: relative` rule) sits later in the cascade than `.modal-close`'s `position: absolute`, so the close ✕ became a **grid item** in `.class-modal`'s 3-row template — pushing the header into a 0px row and spilling its contents over "Core Traits". Fixed with `.ledger-page > .modal-close { position: absolute; }`.
- **Markup:** `ClassLearnModal` and `SpeciesLearnModal` heros rewritten from `class-modal-hero` + `class-icon-stage compact` (the square-inset stage) to `ledger-modal-head`: 72px class-color seal circle (paper-colored icon, inset paper ring), eyebrow/title/italic-summary column, registry double-rule under the whole header — the rule passes below the seal, never through it.

## 3. "Sealed ✦" → "Chosen ✦"
The wax-seal metaphor read as jargon. All four row states in `CreatorPanel.tsx` plus the DossierStamp's `sealed ✦` now say **chosen**. Proposal doc updated to match.

## 4. Backgrounds color-coded
New tone system in `ledgerCopy.ts`: `ORIGIN_TONES` + `originTone()` map each background to one of seven muted ink families (lore/shadow/wilds/war/trade/sea/court) with a stable hash fallback for homebrew. Rows carry `data-origin-tone`; CSS maps each tone to a `--class-a` override so the existing dot machinery works unchanged. Verified: Acolyte violet, Criminal slate, Soldier rust.

## 5. Attribute methods as clean outlines
`.ledger-spread .method-row button` — hairline-outlined tabs, small-caps, radius 0; active = ink outline (doubled with inset shadow) + `--ledger-tint` fill. The gold gradient pill is gone. `points-pill` restyled to italic marginalia on a hairline.

## 6. Chapter VI "The Seal" is now a certificate
Replaced the bare finalize panel with `.ledger-certificate`: "THE RECORD, READ BACK" eyebrow, 42px name, italic summary line, then ruled recap rows (Provenance / Vocation with trained skills / Origin / Lineage / Attributes strip with modifiers / Provisions from starting gear). Undecided chapters show ghost text pointing back ("undecided — return to Chapter IV"). A rotated wax seal in the class color sits beside the closing footnote (stat method + "every entry can still be revised from the sheet"). `heroClass` fallback binding removed from `CreatorPanel` (was showing the first class in the ruleset when none was chosen).

## 7. (Follow-up note) Level-up modal now inherits the character's skin
`.cs-levelup` and its whole family (`cs-lvl-step`, `cs-lvl-subcard`, `cs-lvl-spell-row`, steppers, inputs) hardcoded the dark-chrome root vars. The modal renders inside `.cs-sheet`, which already sets `--paper/--ink/--doc-*` from the theme — the rules just never consumed them. Appended overrides re-point every color at the themed var with the original dark value as fallback (covers un-themed characters and the creation-flow instance, which renders outside the sheet). Verified with the Necromancer skin: modal surface `rgb(28,34,48)`, ink text, blackletter font, violet accent on step tabs and spell rows.

## 8. (Follow-up sketch) Chapter VI certificate, take 2
Per the owner's annotated screenshot: masthead is now a centered stack — `CHAPTER VI · THE SEAL` eyebrow, the name large, the class wax seal beneath it, then the italic summary line. The Attributes row moved out of the recap list to a centered strip below it at 38px numerals (the eye path: masthead → scores → supporting rows). Flavor lines deleted: the step-5 chapter subtitle ("read it back…"), the "THE RECORD, READ BACK" eyebrow, the † seal footnote, and the TOC's "Each chapter inks the record as it is decided." Other chapters keep their subtitles; the generic chapter head is suppressed on step 5 only (the masthead carries the `dj-section-title` id so the section stays labelled). "Press the seal" on the button is now the only remaining metaphor on the page.

## Verification
- `npm run build` clean (×2, before each server restart — note: launch config runs the **production** server, so changes require a rebuild to appear).
- Full commission walk-through as a real user: Standard → name via keyboard → Barbarian chosen + 2 skills picked (chips solid red) → Soldier (rust dot) → point buy (outlined tabs) → certificate rendered with all rows + ghost Lineage row + rotated seal.
- Class preview modal (Barbarian): screenshot-verified clean header, no overlap, close button back in the corner.
- Existing character (Pip) unaffected in the roster rail; sheet untouched.
