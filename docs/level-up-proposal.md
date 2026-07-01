# Project Outline — Level-Up Flow (roll HP, choose subclass / ASI-or-feat / spells)

**Project:** Forge & Fable
**Feature:** When a character gains a level, run a guided level-up: **roll the hit die** for the HP increase, and let the player **choose** what they gain — subclass (at the right level), Ability Score Improvement or a feat (at ASI levels), and any newly learned spells/cantrips. Choices are saved to the character.
**Intended implementer:** an AI coding assistant (e.g. DeepSeek). Section 11 has copy-paste prompts.

---

## 1. Where things stand

The level control already exists — in `HeroSheet.tsx` the "Lv N" badge has −/+ steppers that call `props.onUpdate({ level })`. But that only changes the number:

- **HP doesn't change** (`maxHp` stays put).
- **Features are auto-listed, not chosen.** `heroClass.levelProgression` is `{ level, features: string[] }` — plain feature *names* (e.g. `"Primal Path"`, `"Ability Score Improvement"`, `"Bard College"`) with descriptions in a lookup. The names *imply* choices, but there is **no structured choice data**: no subclass option lists, no ASI/feat mechanics, no "learn N spells" counts.

So this feature is two things: (A) a small, high-value HP-on-level-up step, and (B) a larger data-authoring effort to make the implied choices real. Be honest about that split — see §8.

### Data gaps to plan around (important)

| Needed for | Missing today | Consequence |
|---|---|---|
| ASI vs **feat** | ~~No feat data~~ **Now provided** → `src/data/feats.json` (83 feats). | ASI (+2/+1+1) needs no data; the feat branch is now unblocked. |
| **Subclass** choice | ~~No subclass data~~ **Provided** → `src/data/subclasses.json`: 13 classes, 116 subclasses (names + descriptions) **plus** `subclassLevel` and `subclassFeatureLevels` per class. | Selection *and* timing (when to pick, when subclass features are gained) are data-backed. Only the actual subclass feature **name/description per level** is still unauthored. |
| **Spells learned** | `spells.json` has **no class tags** | Can't filter "which spells this class can learn" from the dataset alone; MVP filters by spell level only, or a class-spell-list must be added. |
| HP roll result | `onRoll()` shows the dice but doesn't return the number | The level-up step computes the roll itself, then may replay the animation for flavor. |

---

## 2. The level-up flow (UX)

Increasing level (via the existing + stepper, or a new "Level Up" button) opens a **Level-Up wizard** (modal) with only the steps relevant to that class + level:

1. **Hit Points (always, levels 2+).** Roll the class hit die (`heroClass.hitDie`) + CON modifier, minimum 1. Show the roll via the dice overlay for flavor, then `maxHp += result` and `currentHp += result`. (Level 1 uses max hit die at creation — not part of this flow.)
2. **Subclass (only at the class's subclass level).** Choose from that class's subclasses. On pick, store `subclassId` and merge its features into what the sheet shows.
3. **Ability Score Improvement or Feat (only at ASI levels).** Either +2 to one ability or +1 to two (respecting the 20 cap), **or** pick a feat (needs feat data). Store the choice.
4. **Spells / cantrips learned (only casters, when the progression grants them).** Pick the allowed number of new spells/cantrips from the eligible list; append ids to `spellsKnown`.
5. **Summary.** Show everything gained; **Confirm** applies all changes in one `onUpdate` patch; **Cancel** reverts the level.

Auto-granted (non-choice) features for the new level are applied automatically and listed in the summary.

**Leveling down:** the − stepper should either be disabled once a level has choices, or prompt "this will remove level N's gains." Reversing choices cleanly is fiddly; recommend **gating level-down** behind a confirm that strips the last level's stored gains, or hide − outside a dedicated "undo last level" action.

---

## 3. Data model changes

### `src/types/game.ts`

The feat dataset is **already committed** at `src/data/feats.json` (83 feats). Its shape (load it like the spells data, via a small `src/lib/feats.ts` with `ALL_FEATS` / `getFeat`):

```jsonc
{
  "id": "actor",
  "name": "Actor",
  "description": "+1 in Cha., advantage on Deception and Performance checks, …",
  "abilityBonuses": ["charisma"], // abilities this (half-)feat can raise; [] = no ASI
  "fixedAbility": true,           // the +1 is a fixed ability
  "chooseAbility": false,         // player picks which ability to raise
  "racialPrereq": "",             // e.g. "Elf"
  "otherPrereq": "",              // e.g. "Str 13"
  "source": "PHB"
}
```

```ts
export type Feat = {
  id: string; name: string; description: string;
  abilityBonuses: AbilityKey[]; fixedAbility: boolean; chooseAbility: boolean;
  racialPrereq: string; otherPrereq: string; source: string;
};

// Subclass catalog is committed at src/data/subclasses.json — an array of
// { id, name, description, subclasses: [{ id, name, source, description }] }
// keyed by class id (matches ruleset classIds). Enough for SELECTION.
export type Subclass = {
  id: string; name: string; source: string; description: string;
  levelProgression?: LevelProgression[];   // OPTIONAL — feature trees not authored yet
};

export type ASIChoice =
  | { type: "asi"; level: number; increases: Partial<AbilityScores> } // e.g. { strength: 2 }
  | { type: "feat"; level: number; featId: string };

// Add to Character (all optional → existing characters unaffected):
//   subclassId?: string;
//   asiChoices?: ASIChoice[];
//   hpRolls?: number[];            // the die result recorded per level (audit / undo)
```

### `src/lib/ruleset.ts` (add to `HeroClass`)

```ts
subclassLevel: number;              // 1 (cleric/sorc/warlock), 2 (druid/wizard), 3 (most)
subclasses: Subclass[];
asiLevels: number[];                // usually [4,8,12,16,19]; fighter [4,6,8,12,14,16,19]; rogue adds 10
casterType: CasterType;             // from the spells work (full/half/pact/none)
spellcastingAbility?: AbilityKey;
spellsKnownByLevel?: number[];      // cumulative or per-level counts (known-casters)
cantripsKnownByLevel?: number[];
```

### New data files

- `src/data/feats.json` — **already committed** (83 feats, schema above). Add a `src/lib/feats.ts` loader (`ALL_FEATS`, `getFeat`). Filter the feat picker by `racialPrereq`/`otherPrereq` where you can; half-feats with `abilityBonuses` also grant an ability bump.
- `src/data/subclasses.json` — **already committed**, keyed by class id: `{ id, name, description, subclassLevel, subclassFeatureLevels: number[], subclasses: [{ id, name, source, description }] }`. Use `subclassLevel` to know when to prompt selection, and `subclassFeatureLevels` to flag "you gain a subclass feature" at the right levels. The actual feature text per level is the remaining content task.

---

## 4. HP on level-up (roll the hit die)

```ts
import { rollDie, abilityModifier } from "@/lib/utils";
const conMod = abilityModifier(finalAbilities.constitution);
const gained = Math.max(1, rollDie(heroClass.hitDie) + conMod);
// for flavor, trigger the dice overlay: onRoll(`Level ${newLevel} HP`, heroClass.hitDie, 1, conMod)
// then patch: { maxHp: character.maxHp + gained, currentHp: character.currentHp + gained, hpRolls: [...] }
```

`rollDie` already exists in `src/lib/utils.ts`. Record the roll in `hpRolls` so a level-down can subtract exactly what was added. (If a player prefers not to roll, a later toggle can offer the fixed average — out of scope for this pass since you chose "roll".)

---

## 5. Subclass, ASI/feat, and spells steps

- **Subclass:** show `heroClass.subclasses` as cards (name + description). Selecting stores `subclassId`. The sheet's feature list should then include subclass features up to the current level (merge `subclass.levelProgression` into `featuresUpToLevel` in `HeroSheet.tsx`).
- **ASI/feat:** a toggle between "Improve abilities" (+2 to one or +1 to two, enforce ≤20) and "Take a feat" (list from `feats.json`, filter by any prerequisite text). Store an `ASIChoice`. Ability improvements must feed `finalAbilities` — apply them where race bonuses are applied (`applyRaceBonuses` in `src/lib/utils.ts` is the natural place to also add `asiChoices`).
- **Spells learned:** compute how many new spells/cantrips this level grants (`spellsKnownByLevel`/`cantripsKnownByLevel` deltas). Present eligible spells from `ALL_SPELLS` (from the spells feature) filtered to `level ≤ maxSpellLevelForCharacter` (and by class list **if** class tags get added). Append chosen ids to `spellsKnown`.

---

## 6. Integration points

| File | Change |
|---|---|
| `src/types/game.ts` | `Feat`, `Subclass`, `ASIChoice`; add `subclassId?`, `asiChoices?`, `hpRolls?` to `Character`; add subclass/ASI/caster fields to `HeroClass`. |
| `src/lib/ruleset.ts` | Add `asiLevels` (+ caster fields) per class. Subclass options, `subclassLevel`, and `subclassFeatureLevels` all come from `subclasses.json`. |
| `src/data/feats.json` | **Committed.** Feat list (83). |
| `src/data/subclasses.json` | **Committed.** 116 subclasses across 13 classes (names + descriptions), keyed by class id. |
| `src/lib/feats.ts`, `src/lib/subclasses.ts` *(new)* | Dataset loaders. |
| `src/lib/levelUp.ts` *(new)* | Pure helpers: `stepsForLevel(cls, level)`, `rollHp(cls, conMod)`, `applyLevelUp(character, results)`. |
| `src/components/LevelUpModal.tsx` *(new)* | The wizard (HP → subclass → ASI/feat → spells → summary). |
| `src/components/HeroSheet.tsx` | Level +/‑ opens the modal on increase; merge subclass features into the shown list; apply ASI to `finalAbilities`. |
| `src/lib/utils.ts` | `applyRaceBonuses` (or a new `applyAllBonuses`) also adds `asiChoices` so scores/modifiers reflect improvements. |
| `src/app/globals.css` | Modal + choice-card styles (reuse existing panel/card patterns). |

`vaultStore.ts` needs no change — the patch-merge handles the new fields.

---

## 7. Phased plan & acceptance criteria

**Phase 1 — HP on level-up.** Level + opens a minimal modal that rolls the hit die (shown via the overlay) and applies HP. *Done when:* leveling 4→5 rolls e.g. a d8+CON and raises max/current HP by that amount, persisted; `hpRolls` recorded.

**Phase 2 — ASI (no feats yet).** At ASI levels, offer ability improvements only; feed `finalAbilities`. *Done when:* choosing +2 STR at level 4 raises Strength (and its modifier everywhere) and persists.

**Phase 3 — Spells learned.** Caster classes pick the granted number of new spells/cantrips from `ALL_SPELLS`. *Done when:* a wizard leveling up can add spells that appear in the Spells tab.

**Phase 4 — Subclass + feats.** The feat branch uses the committed `src/data/feats.json`; the subclass branch needs `subclasses[]` authored per class (the data-heavy part). Wire both into the modal and the feature list. *Done when:* "take a feat" adds one from the dataset (applying any half-feat ability bump), and choosing a subclass shows its features.

**Global checks:** existing characters (no new fields) render unchanged; level-down safely removes the last level's HP via `hpRolls`; `tsc` + `eslint` pass.

---

## 8. The honest scope note

Phases 1–3 are mechanics and are achievable without much new content. With the committed datasets (`spells.json`, `feats.json`, `subclasses.json`), Phase 4's **choices are now data-backed** — the feat list and the subclass options (names + descriptions) exist. We even know *which levels* each class gains a subclass feature (`subclassFeatureLevels`). The one remaining content task is the **feature name + description at each of those levels, per subclass** — until that's authored, the modal can correctly say "you gain a {Subclass} feature at this level" but can't name it. The modal should degrade gracefully — show the selection and the "gains a subclass feature" flag, and fill in feature text once it exists.

---

## 9. Risks & mitigations

| Risk | Mitigation |
|---|---|
| `onRoll` doesn't return the die value. | The modal computes the roll with `rollDie` and just replays the animation for flavor. |
| ASI must affect every derived stat. | Apply `asiChoices` in the same place as race bonuses so `finalAbilities` is the single source of truth. |
| No class tags on spells. | MVP filters spell choices by level; add class spell-lists later for correctness. |
| Feat prerequisites / half-feats. | `feats.json` carries `racialPrereq`, `otherPrereq`, and `abilityBonuses`; filter and apply accordingly. |
| Level-down corrupts state. | Use `hpRolls` to subtract exact HP; gate/undo choices behind a confirm. |
| Subclass feature trees are huge. | Selection is data-backed by `subclasses.json`; per-level subclass features authored over time; modal skips what isn't present. |

---

## 10. Ready-to-paste prompts for the AI implementer

> **Prompt 1 (Phase 1):** "Add a level-up HP flow. Create `src/lib/levelUp.ts` with `rollHp(hitDie, conMod)` using `rollDie` from utils (min 1). In `HeroSheet.tsx`, when the level + stepper increases the level, open a new `LevelUpModal` that rolls the hit die (call `onRoll('Level N HP', hitDie, 1, conMod)` for the animation), shows the result, and on confirm patches `{ level, maxHp: +gained, currentHp: +gained, hpRolls: [...] }` via `onUpdate`. Record each roll in `character.hpRolls`. Keep tsc/eslint green."

> **Prompt 2 (Phase 2):** "Add ASI levels to each class in `ruleset.ts` (`asiLevels`, usually [4,8,12,16,19]; fighter [4,6,8,12,14,16,19]; rogue adds 10). When leveling into an ASI level, the LevelUpModal offers +2 to one ability or +1 to two (cap 20). Store choices as `character.asiChoices` and apply them wherever `applyRaceBonuses` runs so `finalAbilities` reflects them."

> **Prompt 3 (Phase 3):** "For caster classes, add `spellsKnownByLevel`/`cantripsKnownByLevel` to `ruleset.ts`. On level-up, the modal lets the player pick the granted number of new spells/cantrips from `ALL_SPELLS` (filtered to eligible spell level), appending ids to `character.spellsKnown`."

> **Prompt 4 (Phase 4):** "Add loaders `src/lib/feats.ts` and `src/lib/subclasses.ts` for the committed `src/data/feats.json` and `src/data/subclasses.json`, and add `subclassLevel` to classes in `ruleset.ts`. In the ASI step, the 'take a feat' option lists feats from the dataset (filter by `racialPrereq`/`otherPrereq`; if the feat has `abilityBonuses`, also apply its ability bump). At each class's `subclassLevel`, offer subclass selection from `subclasses.json` (cards with name + description), storing `subclassId`. At every level in that class's `subclassFeatureLevels`, flag 'you gain a {subclass} feature'. Don't fabricate the feature name/description (not in the data yet) — just show the selection and the flag. Skip any step whose data isn't present."

---

## 11. Estimated effort

Phase 1: ~2–3 hrs · Phase 2: ~3–4 hrs · Phase 3: ~3–5 hrs · Phase 4: variable — the modal wiring is ~4–6 hrs, but authoring all subclass trees + feats is an ongoing content task. Phases 1–3 deliver rolled HP and real ASI/spell choices; Phase 4 layers in subclasses and feats as data lands.
