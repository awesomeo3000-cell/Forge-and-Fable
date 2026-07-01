# Project Outline — Functional Spellcasting (leveled spells, level control, spell slots, cast actions)

**Project:** Forge & Fable
**Feature:** Make the sheet's Spells section real: spells carry full data (level, school, casting time, range, components, duration, description), the player can change their character level on the sheet, spell slots are tracked and spent, and clicking a spell opens its details with a **Cast** button that spends a slot and rolls attack/damage/save.
**Intended implementer:** an AI coding assistant (e.g. DeepSeek). Section 11 has copy-paste prompts.

---

## 1. Data is already prepared

The uploaded `DND Spells.xlsm` has been converted into a clean, typed dataset committed at:

```
src/data/spells.json   (521 spells, ~640 KB)
```

Each record:

```jsonc
{
  "id": "storm-sphere",           // slug of name; stable key
  "name": "Storm Sphere",
  "level": 4,                      // 0 = cantrip
  "school": "Evocation",
  "castingTime": "1 Action",
  "duration": "1 Minute",
  "range": "150 ft",
  "area": "sphere 20 ft",
  "attack": "",                    // "" | "Ranged" | "Melee"
  "save": "STR Save",              // "" or e.g. "DEX Save"
  "damageEffect": "Bludgeoning",   // type/effect label (NOT a dice formula — see §7)
  "ritual": false,
  "concentration": true,
  "components": { "verbal": true, "somatic": true, "material": false },
  "material": "",                  // material component text if any
  "source": "Elemental Evil",
  "description": "A 20-foot-radius sphere of whirling air…"  // full text
}
```

The implementer does **not** need the spreadsheet or the older `spells-sublist-allspells.json` (that one was only names). `src/data/spells.json` is the single source of truth.

> **Licensing note:** this dataset includes non-SRD spells. It's fine for a personal tool; if this is ever published, non-SRD spell text would need review. Not a blocker for building the feature.

---

## 2. Current state (facts the implementer needs)

| Concern | Where | Notes |
|---|---|---|
| Spell type | `src/types/game.ts` | Minimal: `{ id, name, level, school, action, summary }`. Will be replaced/augmented by the dataset shape. |
| Known spells | `Character.spellsKnown: string[]` | Array of spell ids. Should reference `spells.json` ids. |
| Spells UI | `src/components/HeroSheet.tsx` | Already groups known spells by level (`spellsByLevel`) and renders a **Spells** tab with `.cs-spell-card` (name, school·action, summary). This is the surface to upgrade. |
| Level | `Character.level: number` | Set at creation; there is **no way to change it on the sheet** yet. A "Lv N" badge shows in the identity banner. |
| Rolls | `props.onRoll(label, sides, count?, modifier?)` | The dice overlay system. Use this for spell attack/damage rolls. |
| Rests | Short/Long buttons in identity | Currently **no-ops**. Wire slot recovery here. |
| Helpers | `src/lib/utils.ts` | `proficiencyBonus(level)`, `abilityModifier(score)`, `signed()` already exist. |
| Spell slots | — | **Not modeled anywhere.** New. |

There are **four** things to build, in order of dependency: (A) rich spell data + detail view, (B) level control, (C) spell slots, (D) cast actions. B and C are prerequisites for D.

---

## 3. Data model changes (`src/types/game.ts`)

```ts
export type SpellComponents = { verbal: boolean; somatic: boolean; material: boolean };

export type SpellData = {
  id: string; name: string; level: number; school: string;
  castingTime: string; duration: string; range: string; area: string;
  attack: string; save: string; damageEffect: string;
  ritual: boolean; concentration: boolean;
  components: SpellComponents; material: string; source: string; description: string;
};

// Caster progression, added to HeroClass (see §5):
export type CasterType = "full" | "half" | "third" | "pact" | "none";

// Spent spell slots, tracked on the character (max is derived from class+level):
export type SpellSlots = Record<number, number>;   // spell level -> slots CURRENTLY used
// Add to Character:
//   spellSlotsUsed?: SpellSlots;        // e.g. { 1: 2 } = two 1st-level slots spent
//   pactSlotsUsed?: number;             // warlock pact magic
//   concentratingOn?: string | null;    // spell id currently concentrating on (optional, Phase 4)
```

Keep everything optional so existing characters don't break. Load the dataset once:

```ts
// src/lib/spells.ts
import raw from "@/data/spells.json";
export const ALL_SPELLS: SpellData[] = raw as SpellData[];
export const SPELLS_BY_ID = new Map(ALL_SPELLS.map((s) => [s.id, s]));
export const getSpell = (id: string) => SPELLS_BY_ID.get(id);
```

---

## 4. Level control on the sheet

Make the "Lv N" badge in the identity banner editable:

- Add a small stepper (− / +) or click-to-edit next to the level badge, clamped 1–20.
- On change: `props.onUpdate({ level: next })`. This already flows through `updateCharacter`.
- Changing level automatically recomputes: **proficiency bonus** (`proficiencyBonus(level)` — already used), **spell slots** (derived, §5), and class features shown (already keyed off `character.level`).
- **Out of scope:** recomputing max HP from hit dice (leave HP manual; there's a `hitPointType` setting). Note this in the UI so it isn't surprising.

---

## 5. Spell slots

### 5.1 Caster classification (add to `HeroClass` in `src/lib/ruleset.ts`)

```ts
casterType: CasterType;             // full | half | third | pact | none
spellcastingAbility?: AbilityKey;   // WIS (cleric/druid/ranger), CHA (bard/sorcerer/warlock/paladin), INT (wizard)
```

Defaults: bard/cleric/druid/sorcerer/wizard = `full`; paladin/ranger = `half`; warlock = `pact`; barbarian/fighter/monk/rogue = `none` (fighter/rogue subclass third-casters can be added later).

### 5.2 Slot tables (`src/lib/spellSlots.ts`)

**Full caster** — max slots by character level (index 1–20 → slots for spell levels 1..9):

```ts
export const FULL_CASTER_SLOTS: number[][] = [
  /*1*/[2], /*2*/[3], /*3*/[4,2], /*4*/[4,3], /*5*/[4,3,2],
  /*6*/[4,3,3], /*7*/[4,3,3,1], /*8*/[4,3,3,2], /*9*/[4,3,3,3,1], /*10*/[4,3,3,3,2],
  /*11*/[4,3,3,3,2,1], /*12*/[4,3,3,3,2,1], /*13*/[4,3,3,3,2,1,1], /*14*/[4,3,3,3,2,1,1],
  /*15*/[4,3,3,3,2,1,1,1], /*16*/[4,3,3,3,2,1,1,1], /*17*/[4,3,3,3,2,1,1,1,1],
  /*18*/[4,3,3,3,3,1,1,1,1], /*19*/[4,3,3,3,3,2,1,1,1], /*20*/[4,3,3,3,3,2,2,1,1],
];
```

- **Half caster** (paladin/ranger): use spellcaster level = `floor(level/2)` (min 1 at level 2), then index a full-caster-style table capped at 5th-level slots. Provide `HALF_CASTER_SLOTS` similarly (levels 2–20, max spell level 5).
- **Pact magic** (warlock): 1–4 slots of a single, always-highest level (1st@L1 → 5th@L9+); count: 1 (L1), 2 (L2–10), 3 (L11–16), 4 (L17+). Track separately (`pactSlotsUsed`), recovers on **short rest**.
- Max slots = table lookup by `casterType` + `level`; **remaining** = max − `spellSlotsUsed[lvl]`.

### 5.3 Rest recovery (wire the existing Short/Long buttons)

- **Long rest:** `spellSlotsUsed = {}`, `pactSlotsUsed = 0` (and restore HP if desired).
- **Short rest:** `pactSlotsUsed = 0` only.

---

## 6. Spells tab UI (the main surface)

Upgrade the existing Spells tab in `HeroSheet.tsx`:

1. **Spellcasting header:** show spell save DC = `8 + prof + abilityMod` and spell attack = `prof + abilityMod` (from the class's `spellcastingAbility`).
2. **Per-level groups (already exist):** for each spell level 1–9 that has known spells, show a **slot tracker** — pips like `● ● ○` (used vs remaining) with click to spend/recover a slot manually. Cantrips (level 0) show no slots ("at will").
3. **Spell rows:** each known spell (looked up via `getSpell(id)` from `spells.json`) shows name + quick facts (casting time, range, a concentration/ritual dot). Clicking a row opens the **detail view**.
4. **Detail view** (modal or expanding panel): full block — level/school, casting time, range, area, components (V/S/M + material text), duration (with a concentration flag), save/attack, and the full `description`. Include a **Cast** control (§7).

Reuse existing `.cs-spell-card` styling; add `.cs-spell-detail`, `.cs-slot-pip`, `.cs-spellcast-head`.

---

## 7. Cast action ("click does stuff")

Clicking **Cast** on a spell:

1. **Choose slot level:** default = the spell's level; allow upcasting by picking any level ≥ spell level that still has a remaining slot (a small level selector). Cantrips skip this.
2. **Spend the slot:** increment `spellSlotsUsed[chosenLevel]` (or `pactSlotsUsed` for warlocks) via `onUpdate`. Block if none remain (disable Cast, show "no slots").
3. **Roll what's relevant** through the existing dice system:
   - If `attack` is set (Ranged/Melee): `onRoll(`${name} attack`, 20, 1, prof + abilityMod)`.
   - If `save` is set: display "Target rolls {save} vs DC {saveDC}" (no roll — the target saves).
   - **Damage:** the dataset's `damageEffect` is a *type label*, not dice. Parse dice expressions from `description` (regex `/\d+d\d+/g`) and render each as a **roll button** (`onRoll(`${name} damage`, dieSides, count)`). Upcast scaling text is prose — treat extra dice as **best-effort/manual** (let the player click the die buttons the number of times needed) and note it.
4. **Concentration (optional, Phase 4):** if `concentration`, set `concentratingOn = id`; casting another concentration spell replaces it and shows a small "Concentrating on X" indicator in vitals.

---

## 8. File-by-file change list

| File | Change |
|---|---|
| `src/data/spells.json` | **Already added** — the dataset. |
| `src/lib/spells.ts` *(new)* | Load dataset, `SPELLS_BY_ID`, `getSpell`, dice-parse helper. |
| `src/lib/spellSlots.ts` *(new)* | Slot tables + `maxSlots(casterType, level)` + rest helpers. |
| `src/types/game.ts` | `SpellData`, `CasterType`, `SpellSlots`; add `spellSlotsUsed?`, `pactSlotsUsed?`, optional `concentratingOn?` to `Character`; add `casterType`/`spellcastingAbility` to `HeroClass`. |
| `src/lib/ruleset.ts` | Set `casterType` + `spellcastingAbility` per class. |
| `src/components/HeroSheet.tsx` | Level stepper; spellcasting header; slot pips; spell detail view; Cast action; wire Short/Long rests. |
| `src/components/SpellDetail.tsx` *(new, optional)* | The detail/cast panel, to keep HeroSheet manageable. |
| `src/app/globals.css` | Styles for slot pips, spell detail, cast button, level stepper. |
| Creator spell picker | (If in scope) switch spell selection to `ALL_SPELLS` so `spellsKnown` ids match the dataset. |

No change to `vaultStore.ts` — the patch-merge already handles the new character fields.

---

## 9. Phased plan & acceptance criteria

**Phase 1 — Rich data + detail view.** Add `spells.ts`, expand types, look up known spells from `spells.json`, render full detail (description, range, components, duration). *Done when:* clicking a known spell shows its real description and stats.

**Phase 2 — Level control.** Editable level (1–20) on the identity banner; proficiency + shown features update. *Done when:* changing level updates proficiency bonus and (after Phase 3) slot counts, and persists.

**Phase 3 — Spell slots.** Slot tables, per-level pips, spend/recover, Short/Long rest wiring. *Done when:* a level-5 full caster shows 4/3/2 slots for levels 1–3, spending decrements, long rest restores.

**Phase 4 — Cast actions.** Cast button spends a slot (with upcast selector), rolls attack via `onRoll`, surfaces save DC, and offers damage-die roll buttons parsed from the description. Optional concentration indicator. *Done when:* casting Fire Bolt rolls a spell attack; casting a leveled spell spends the right slot; upcasting spends a higher slot.

**Global checks:** existing characters with no slot data still render; `npx tsc --noEmit` and `npx eslint` pass; cantrips never consume slots.

---

## 10. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Damage dice aren't a structured field. | Parse `\d+d\d+` from `description` for roll buttons; mark upcast scaling as manual. |
| Slot tables are easy to get wrong. | The full-caster table is provided verbatim in §5.2; unit-check a few known values (L5 full = [4,3,2]). |
| `spellsKnown` ids may not match `spells.json` slugs. | Match by slugified name on load; log/skip unmatched ids; ideally update the creator picker to use `ALL_SPELLS`. |
| 640 KB JSON import. | Fine for a client bundle; if needed, lazy-load the Spells tab. |
| Changing level surprises users (HP unchanged). | Note in the UI that HP is managed separately. |

---

## 11. Ready-to-paste prompts for the AI implementer

> **Prompt 1 (Phase 1):** "Add `src/lib/spells.ts` that imports `src/data/spells.json` (already present) and exports `ALL_SPELLS`, `SPELLS_BY_ID`, and `getSpell(id)`. Add a `SpellData` type to `src/types/game.ts` matching the JSON shape. In `src/components/HeroSheet.tsx`, render the Spells tab from the real dataset: look up each `character.spellsKnown` id via `getSpell`, group by level, and add a detail view (modal or expanding panel) showing school, casting time, range, area, components (V/S/M + material), duration, save/attack, and full description. Keep tsc/eslint green."

> **Prompt 2 (Phase 2):** "Add an editable character level (1–20) to the identity banner in HeroSheet: a −/+ stepper next to the level badge that calls `onUpdate({ level })`. Proficiency and shown features already key off `character.level`; verify they update. Note in the UI that HP isn't auto-recalculated."

> **Prompt 3 (Phase 3):** "Add `src/lib/spellSlots.ts` with the full/half/pact slot tables (use the FULL_CASTER_SLOTS table from the proposal) and `maxSlots(casterType, level)`. Add `casterType` and `spellcastingAbility` to each class in `src/lib/ruleset.ts`. Track spent slots on the character (`spellSlotsUsed`, `pactSlotsUsed`). In the Spells tab, show per-level slot pips (used vs remaining) with click to spend/recover, and wire the Short/Long rest buttons to restore slots (long = all, short = pact only)."

> **Prompt 4 (Phase 4):** "Add a Cast action to the spell detail view: a slot-level selector (spell level and up, only levels with remaining slots; cantrips skip), which spends the slot via `onUpdate`. On cast, if the spell has an attack, call `onRoll('<name> attack', 20, 1, prof + abilityMod)`; if it has a save, show 'Target: <save> vs DC <8 + prof + abilityMod>'; and render damage-die roll buttons parsed from the description (regex `/(\\d+)d(\\d+)/g`) that call `onRoll`. Disable Cast when no slots remain."

---

## 12. Estimated effort

Phase 1: ~4–6 hrs · Phase 2: ~1–2 hrs · Phase 3: ~3–5 hrs · Phase 4: ~4–6 hrs. Phases 1–3 give a fully informative, slot-tracking sheet; Phase 4 adds the interactive casting.
