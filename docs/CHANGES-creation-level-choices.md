# Changes — Level-up choices at character creation

Starting a character above level 1 previously skipped every choice that comes with the
gained levels: `characterPayload` (`src/lib/utils.ts`) forged the character with **no
`asiChoices`, no `subclassId`, and only 3 default `spellsKnown`**. So a level-4 fighter
had no feat/ASI and no subclass, a level-3 sorcerer had no origin, etc. — the player
could pick a starting level but not the things that level grants.

## Approach

Reuse the existing, tested `LevelUpModal` — on forging above level 1, walk it once per
**choice-bearing** level from 2 up to the chosen level, collect the choices against an
in-memory "character so far," then forge once at the target level with them applied. No
partial character, one POST. HP is untouched — the creator already computes starting HP
for the chosen level, so the sequence's HP step is suppressed.

## Changes

- **`src/components/LevelUpModal.tsx`** — new optional `skipHp` prop. When set, the HP
  step is omitted (`hasHp = newLevel > 1 && !skipHp`) and `finish()` emits no HP fields.
  Existing sheet level-ups pass nothing and are unchanged.

- **`src/components/ForgeAndFableApp.tsx`**
  - `creationChoiceLevels(heroClass, targetLevel)` — the levels 1..target that need a
    player choice: the subclass level, ASI/feat levels, and (for known casters) each
    level's spell pick. Level 1 is included only for level-1-subclass classes
    (sorcerer/warlock/cleric) so a high-level start still picks its origin. HP-only levels
    are skipped. **Subclass level comes from `getClassData(classId)?.subclassLevel`**
    (subclasses.json) — the same source the sheet uses — not `heroClass.subclassLevel`,
    which is only set for artificer in the ruleset.
  - `createHero` now, when `draft.level > 1` and there are choice-levels, opens the
    sequence (`creationSeq` state) instead of forging immediately.
  - `forgeCharacter(choices)` — extracted POST path; applies `asiChoices` / `subclassId` /
    `spellsKnown` from the collected choices on top of `characterPayload`.
  - `advanceCreationSeq(patch)` — merges each level's patch into `soFar` and advances, or
    forges once the last choice-level is confirmed.
  - `creationSeqFinalAbilities` memo — race bonuses + ASIs chosen so far, so each step's
    ASI cap and HP modifier stay accurate.
  - Renders `LevelUpModal` (keyed per index so picks reset each level) with `skipHp` while
    the sequence is active; cancel aborts without forging.

## Verification (running production build, port 3005)

Standard build, **Fighter, starting level 4**, through the full creator UI:
- Forge Hero opened the sequence at **Level 3 → Subclass** (Champion/Battle Master/…),
  picked Champion; advanced to **Level 4 → Feat**, picked Athlete → the STR/DEX ability
  selector appeared and gated Continue; chose DEX; summary read "Feat: Athlete (+1 DEX)";
  Confirm forged the character.
- Persisted character: `level 4`, `subclassId: "champion"`,
  `asiChoices: [{ type:"feat", featId:"athlete", abilityChoice:"dexterity", level:4 }]`,
  2 chosen class skills.
- Sheet reflects it: DEX 9 (base 8 + Athlete +1), no "select a subclass" prompt, Champion
  features present.
- Regression: earlier bug where the sequence skipped the subclass step (used the wrong
  `subclassLevel` source) fixed and re-verified.
- `tsc --noEmit`, `eslint`, and `npm run build` all clean.

## Notes / scope

- Level-1 starts are unchanged (forge immediately; no sequence).
- Known casters get a spell-pick step per level (as in normal leveling); prepared casters
  (cleric/druid/paladin/artificer) get their list from the sheet automatically, no step.
- Level-1 spell loadout for known casters still uses the payload's default suggestions
  as the base; the sequence adds the per-level picks on top. A fuller "level-1 spell
  loadout at creation" is out of scope here.
