# Changes — QA report P0 fixes (2026-07-04)

Addresses the eight P0 issues from `docs/QA-REPORT-2026-07-04.md`, after verifying each
against the actual code. All fixes build clean (`tsc`, `eslint`, `npm run build`) and the
high-impact ones were verified in the running app.

## 1. Race ability bonuses (P0-1)

All 24 species had `bonuses: {}`, so picking a species did nothing. Populated every entry
in `src/lib/ruleset.ts` with **fixed classic bonuses**: Legacy variants get their exact
2014 values; the 2024 base species get their classic identity bonus (Elf +2 DEX, Dwarf +2
CON, Dragonborn +2 STR/+1 CHA, Human +1 to all six, etc.). Applied via a scripted transform
keyed by race id (24/24 replaced).

- **Design note:** the 2024 base species canonically use *floating* ASIs (assigned via
  background), not fixed bonuses. Since there's no floating-ASI UI, fixed bonuses make
  species matter immediately, which is the point of the P0. Half-Elf's two floating +1s are
  approximated as +1 DEX/+1 CON. Switching the 2024 base entries to a floating-ASI chooser
  later is the fuller-fidelity option.
- **Verified:** created an Elf Fighter — base DEX 14 → sheet 16 (+2), STR unchanged.

## 2. Fey/Shadow Touched feat spells (P0-2 + P0-8)

`LevelUpModal` drew feat-granted spells from `spellsForClass(className)`, which is empty for
non-casters — so a Fighter/Rogue taking Fey/Shadow Touched saw an empty (required) picker and
**couldn't complete the level-up**, and even casters only saw class-list spells.

- `src/components/LevelUpModal.tsx` — feat spell options now come from **`ALL_SPELLS`**
  filtered by the feat's `grantsSpells.choose` level + schools (a feat's spell grant is
  independent of class), sorted, capped at 40.
- `finish()` now also writes `spellStatuses[id] = { source: "<Feat> feat", freeUse: true,
  freeUsed: false }` for every granted spell (fixed + chosen), so free-use casting is set up
  automatically (P0-8) instead of requiring manual configuration. Long-rest reset already
  clears `freeUsed`.
- Threaded `spellStatuses` through the character-creation level-up sequence
  (`ForgeAndFableApp.tsx`: `CreationChoices`, `advanceCreationSeq`, `forgeCharacter`) so feats
  taken at creation get the same treatment.
- **Verified:** Fighter (non-caster) → Fey Touched → picker populated with L1
  divination/enchantment spells; completed → `spellsKnown: [misty-step, charm-person]`, both
  with `freeUse:true` + source "Fey Touched feat", ASI (CHA) applied.

## 3. Class/species mask icons (P0-3) — and a bigger discovery: globals.css was gutted

The report's "`.class-symbol-mask` has no CSS" (P0-3) and "feedback-modal has no CSS" (P1)
were **not original bugs** — the QA run itself had stripped ~2000 lines of live CSS from
`src/app/globals.css` (7153 → 5150 lines), deleting `.class-symbol-mask`, all
`.feedback-modal*`, `.cs-skill-source-chip*` (skill proficiency-source chips),
`.cs-effect*`, `.roll-mode*` (advantage/disadvantage), `.roll-history-die`, and more — then
flagged the missing styles as bugs. This also caused the visible "skill proficiency/source
text looks messed up" regression (the PROF/BG chips rendered as unstyled raw text).

**Fix:** `git checkout HEAD -- src/app/globals.css` restored the complete, committed CSS
(HEAD already contained every deleted section, including this session's adv/dis and dice
styling). Confirmed nothing real was lost — the gutted file's "additions" were only
reformatted copies of rules HEAD already had. My earlier one-off mask-icon append was
therefore redundant and dropped by the restore. **Verified:** skill-source chips render as
proper pills (9.28px, padded, accent pill); `mask-image` resolves to the class SVG again.

## 4. Feat prerequisites (P0-4 racial, P0-5 ability score)

`src/lib/feats.ts` used exact string equality for racial prereqs (so "Elf" never matched
"Elf (drow)" or "Elf or half-elf") and never checked ability-score prereqs.

- Racial prereqs now use **token matching**: "Elf" matches "Elf (drow)"/"Elf or half-elf"
  but a pure Elf does not match the single token "half-elf". (Slightly permissive on subrace
  parentheticals, which the data model doesn't distinguish yet.)
- Ability-score prereqs are **parsed from `otherPrereq`** ("Dexterity 13 or higher",
  "Intelligence or Wisdom 13 or higher") and enforced against the character's final abilities;
  "X or Y" passes if either meets the threshold. Non-ability prereqs pass through.
- `LevelUpModal` passes `abilities: finalAbilities` into `availableFeats`; the creation-flow
  modal now passes `raceName` too (P1-6), so racial filtering works during creation.
- Armor-proficiency prereqs are still not enforced (report P2) — noted, out of P0 scope.

## 5. Accessibility (P0-6, P0-7)

- `src/components/LevelUpModal.tsx` — the dialog now has `role="dialog"`, `aria-modal`,
  `aria-labelledby` (the "Level N" heading), an **Escape-to-close** handler, and the close
  button has `aria-label`/`title`.
- `src/components/HeroSheet.tsx` — the level-down (`Minus`) and retire (`Trash2`) icon buttons
  got `aria-label`/`title`.

## Not done here (deliberately)

- Alignment selection UI, register rate-limiting/password length, feedback-modal CSS,
  focus-trap for modals, half-caster spell-level cap — real but P1, left for a follow-up.
- The report's "7/10 feats FAIL" mostly reflects unimplemented depth (trackers, expertise,
  Tough +2 HP), not breakage; not treated as P0.
