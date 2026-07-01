# Master Implementation Proposal — Functional Spellcasting + Full Level-Up

**Project:** Forge & Fable
**Scope:** Make the character sheet play D&D 5e for real — spells with full data and casting, character level control, spell slots, and a guided level-up (roll HP → subclass → ASI/feat → learn spells). **All required data is now committed**, so this is an implementation job, not a research one.
**Intended implementer:** an AI coding assistant (e.g. DeepSeek). Section 9 has copy-paste prompts.
**Supersedes:** `spells-functional-proposal.md` and `level-up-proposal.md` (kept for detail; this is the single build plan).

---

## 1. Data is complete — what's in the repo

| File | Contents | Coverage / notes |
|---|---|---|
| `src/data/spells.json` | 521 spells: level, school, casting time, duration, range, area, attack, save, ritual, concentration, V/S/M components, source, **full description**, and **`classes: string[]`** (which classes can cast it). | 503/521 have class tags. 18 lack them — mostly Tasha's summon spells + a few psionic/renamed entries (see §8). |
| `src/data/subclasses.json` | 13 classes → 116 subclasses. Per class: `subclassLevel`, `subclassFeatureLevels[]`. Per subclass: `{ id, name, source, description, features: [{ level, name, description, source }] }`. | 111/116 have full feature lists; 5 lack them (homebrew/variants — see §8). |
| `src/data/feats.json` | 83 feats: `{ id, name, description, abilityBonuses[], fixedAbility, chooseAbility, racialPrereq, otherPrereq, source }`. | Half-feats carry `abilityBonuses`. |

Add thin loaders (one each): `src/lib/spells.ts`, `src/lib/subclasses.ts`, `src/lib/feats.ts` exporting the parsed arrays plus `getX(id)` / `subclassesForClass(classId)` helpers.

---

## 2. Data model changes (`src/types/game.ts`)

```ts
export type CasterType = "full" | "half" | "pact" | "none";

export type SpellData = {
  id: string; name: string; level: number; school: string;
  castingTime: string; duration: string; range: string; area: string;
  attack: string; save: string; damageEffect: string;
  ritual: boolean; concentration: boolean;
  components: { verbal: boolean; somatic: boolean; material: boolean };
  material: string; source: string; description: string; classes: string[];
};

export type Feat = {
  id: string; name: string; description: string;
  abilityBonuses: AbilityKey[]; fixedAbility: boolean; chooseAbility: boolean;
  racialPrereq: string; otherPrereq: string; source: string;
};

export type SubclassFeature = { level: number; name: string; description: string; source: string };
export type ASIChoice =
  | { type: "asi"; level: number; increases: Partial<AbilityScores> }
  | { type: "feat"; level: number; featId: string };

// Add to Character (ALL optional → existing characters unaffected):
//   subclassId?: string;
//   asiChoices?: ASIChoice[];
//   hpRolls?: number[];
//   spellSlotsUsed?: Record<number, number>;   // spell level -> slots spent
//   pactSlotsUsed?: number;
//   concentratingOn?: string | null;
```

Add to `HeroClass` in `src/lib/ruleset.ts`: `casterType`, `spellcastingAbility?`, `asiLevels: number[]`. (`subclassLevel`/`subclassFeatureLevels`/subclass options come from `subclasses.json`.)

**Per-class rules data** (author directly — standard 5e):

| Class | casterType | ability | ASI levels |
|---|---|---|---|
| artificer | half | INT | 4,8,12,16,19 |
| barbarian | none | — | 4,8,12,16,19 |
| bard | full | CHA | 4,8,12,16,19 |
| cleric | full | WIS | 4,8,12,16,19 |
| druid | full | WIS | 4,8,12,16,19 |
| fighter | none | — | 4,6,8,12,14,16,19 |
| monk | none | — | 4,8,12,16,19 |
| paladin | half | CHA | 4,8,12,16,19 |
| ranger | half | WIS | 4,8,12,16,19 |
| rogue | none | — | 4,8,10,12,16,19 |
| sorcerer | full | CHA | 4,8,12,16,19 |
| warlock | pact | CHA | 4,8,12,16,19 |
| wizard | full | INT | 4,8,12,16,19 |

---

## 3. Cross-cutting: level, spellcasting stats, rests

- **Level control:** the identity banner's −/+ stepper already calls `onUpdate({ level })`. Increasing level opens the **Level-Up modal** (§5); decreasing prompts a confirm that reverses the last level (use `hpRolls` to subtract exact HP). Clamp 1–20.
- **Spellcasting stats:** `mod = abilityModifier(finalAbilities[class.spellcastingAbility])`; spell attack = `pb + mod`; save DC = `8 + pb + mod`. `proficiencyBonus(level)` already exists.
- **Rests** (wire the existing Short/Long buttons): Long → `spellSlotsUsed = {}`, `pactSlotsUsed = 0` (optionally restore HP); Short → `pactSlotsUsed = 0`.

---

## 4. Feature A — functional spells

`src/lib/spellSlots.ts`, full-caster max slots by character level (index 1..20 → spell levels 1..9):

```ts
export const FULL_CASTER_SLOTS: number[][] = [
  [2],[3],[4,2],[4,3],[4,3,2],[4,3,3],[4,3,3,1],[4,3,3,2],[4,3,3,3,1],[4,3,3,3,2],
  [4,3,3,3,2,1],[4,3,3,3,2,1],[4,3,3,3,2,1,1],[4,3,3,3,2,1,1],[4,3,3,3,2,1,1,1],
  [4,3,3,3,2,1,1,1],[4,3,3,3,2,1,1,1,1],[4,3,3,3,3,1,1,1,1],[4,3,3,3,3,2,1,1,1],[4,3,3,3,3,2,2,1,1],
];
```
- **Half caster** (artificer/paladin/ranger): caster level = `ceil(level/2)` for artificer, `floor(level/2)` for paladin/ranger (min 1), capped at 5th-level slots. **Pact** (warlock): 1–4 slots of the single highest level (1st@1 → 5th@9+; count 1/2/3/4 at levels 1/2/11/17), tracked in `pactSlotsUsed`, restored on short rest.
- Max slots = table by `casterType` + level; remaining = max − used.

**Spells tab UI** (upgrade the existing tab in `HeroSheet.tsx`): spellcasting header (save DC + attack); per-level groups with **slot pips** (click to spend/recover); each known spell (via `getSpell(id)`) opens a **detail view** (full block + description); cantrips = "at will", no slot.

**Cast action:** choose slot level (spell level and up with remaining slots; cantrips skip) → spend it → if `attack`, `onRoll('<name> attack', 20, 1, pb+mod)`; if `save`, show "Target: <save> vs DC <dc>"; render damage-die roll buttons parsed from the description (`/(\d+)d(\d+)/g`). Upcast scaling is prose → manual.

---

## 5. Feature B — level-up flow (modal)

Opened when level increases. Steps shown only when relevant:

1. **HP (levels 2+):** `gained = max(1, rollDie(class.hitDie) + conMod)`; replay the dice overlay via `onRoll('Level N HP', hitDie, 1, conMod)` for flavor; patch `maxHp += gained`, `currentHp += gained`, push to `hpRolls`. (`onRoll` doesn't return the value — the modal computes it.)
2. **Subclass (at `subclassLevel`):** cards from `subclassesForClass(classId)` (name + description); store `subclassId`. The sheet's feature list now merges the chosen subclass's `features` (from `subclasses.json`) up to the current level.
3. **ASI or feat (at `asiLevels`):** +2 one / +1 two (cap 20) **or** a feat from `feats.json` (filter by `racialPrereq`/`otherPrereq`; if it has `abilityBonuses`, also apply its bump). Store an `ASIChoice`. Apply ability increases wherever `applyRaceBonuses` runs so `finalAbilities` reflects them.
4. **Spells learned (casters):** grant the class's newly-available count; the picker lists `ALL_SPELLS` filtered by **`classes.includes(className)`** and eligible spell level (now possible — spells carry class tags). Append ids to `spellsKnown`.
5. **Summary → Confirm** applies everything in one `onUpdate`; **Cancel** reverts the level.

The sheet should also render subclass features (from `subclasses.json`) alongside class features in the Features/Traits tab.

---

## 6. File-by-file

| File | Change |
|---|---|
| `src/data/*.json` | **Committed** (spells, subclasses, feats). |
| `src/lib/spells.ts`, `subclasses.ts`, `feats.ts` *(new)* | Dataset loaders + helpers. |
| `src/lib/spellSlots.ts` *(new)* | Slot tables + `maxSlots(casterType, level)`. |
| `src/lib/levelUp.ts` *(new)* | `stepsForLevel`, `rollHp`, `applyLevelUp`. |
| `src/types/game.ts` | Types above; optional character fields. |
| `src/lib/ruleset.ts` | `casterType`, `spellcastingAbility`, `asiLevels` per class. |
| `src/lib/utils.ts` | `applyRaceBonuses` also applies `asiChoices`. |
| `src/components/HeroSheet.tsx` | Spells tab upgrade, slot pips, spell detail + cast, subclass features in Features tab, level-up trigger. |
| `src/components/SpellDetail.tsx`, `LevelUpModal.tsx` *(new)* | Keep HeroSheet manageable. |
| `src/app/globals.css` | Slot pips, spell detail, cast button, modal styles. |

`vaultStore.ts` unchanged — patch-merge handles all new fields.

---

## 7. Phased plan & acceptance

1. **Spell data + detail view** — known spells show real descriptions/stats. *Check:* clicking a spell shows its description.
2. **Level control + HP roll** — leveling opens the modal, rolls the hit die, HP rises. *Check:* 4→5 rolls hitDie+CON and raises max/current HP; `hpRolls` recorded.
3. **Spell slots** — tables + pips + rest recovery. *Check:* level-5 full caster shows 4/3/2 for levels 1–3; spending decrements; long rest restores.
4. **Cast actions** — spend slot, attack roll, save DC, damage buttons. *Check:* Fire Bolt rolls an attack; a leveled spell spends the right slot; upcast spends higher.
5. **Level-up choices** — subclass (with features), ASI/feat, spells-learned (filtered by class). *Check:* picking a subclass shows its features; ASI raises a score everywhere; a wizard learns class-legal spells.

Global: existing characters render unchanged; `tsc` + `eslint` pass; cantrips never spend slots.

---

## 8. Known data caveats (small, documented)

- **5 subclasses lack feature lists:** `barbarian/wild-soul`, `cleric/arcane-domain`, `fighter/purple-dragon-knight`, `wizard/school-of-graviturgy`, `wizard/school-of-chronurgy` (homebrew or name variants). The modal should still let them be chosen and just show "features not yet listed."
- **18 spells lack class tags** (`classes: []`): mostly Tasha's summon spells and a few psionic/renamed entries. They still display fully; they just won't appear in the class-filtered learn list. Treat empty `classes` as "not offered in the picker."
- **Damage dice** live in prose, not a structured field → parse `NdM` from the description; upcast scaling stays manual.
- **`onRoll` doesn't return the die value** → the level-up HP step computes the roll itself and replays the animation for flavor.
- **ASI must flow into `finalAbilities`** → apply `asiChoices` at the same point as race bonuses (single source of truth).

---

## 9. Ready-to-paste prompts

> **P1 — spells:** "Add loaders `src/lib/spells.ts`/`subclasses.ts`/`feats.ts` for the committed JSON in `src/data`. Add the `SpellData`/`Feat` types to `game.ts`. Upgrade the Spells tab in `HeroSheet.tsx` to render known spells from `spells.json` via `getSpell`, grouped by level, with a detail view (school, casting time, range, area, V/S/M, duration, save/attack, full description). tsc/eslint green."

> **P2 — level + HP:** "Make the identity level stepper open a `LevelUpModal` on increase. Add `src/lib/levelUp.ts` `rollHp(hitDie, conMod)` (min 1) using `rollDie`. The HP step replays the overlay via `onRoll('Level N HP', hitDie, 1, conMod)`, then patches `maxHp`/`currentHp` and pushes to `hpRolls`."

> **P3 — slots:** "Add `src/lib/spellSlots.ts` with FULL_CASTER_SLOTS (from the proposal) + half/pact rules and `maxSlots(casterType, level)`. Add `casterType`/`spellcastingAbility`/`asiLevels` to classes in `ruleset.ts`. Track `spellSlotsUsed`/`pactSlotsUsed`; show per-level slot pips (spend/recover); wire Short/Long rests (long = all, short = pact)."

> **P4 — cast:** "Add Cast to the spell detail: slot-level selector (spell level+ with remaining slots; cantrips skip) that spends a slot; if `attack`, `onRoll('<name> attack',20,1,pb+mod)`; if `save`, show DC `8+pb+mod`; render damage-die buttons parsed via `/(\\d+)d(\\d+)/g`. Disable when no slots."

> **P5 — level-up choices:** "In `LevelUpModal`, at `subclassLevel` offer subclass cards from `subclasses.json` (store `subclassId`; merge that subclass's `features` into the sheet's feature list up to level). At `asiLevels` offer ASI (+2/+1+1, cap 20) or a feat from `feats.json` (apply half-feat `abilityBonuses`); store `asiChoices` and apply them where race bonuses apply. For casters, add a spells-learned step filtered by `spell.classes.includes(className)` and eligible level, appending to `spellsKnown`. Skip steps whose data is empty."

---

## 10. Effort

P1 ~4–6h · P2 ~2–3h · P3 ~3–5h · P4 ~4–6h · P5 ~5–8h. P1–P4 give an informative, slot-tracking, castable sheet; P5 delivers the full guided level-up with real subclass/feat/spell choices — all now backed by committed data.
