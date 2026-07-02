# Forge & Fable — Round 2: Combat Polish, Quickbuilder & Premade Heroes

**Audience:** An AI coding assistant executing this work in a fresh session.
**Repo root:** `E:\forge-and-fable`
**Read "Ground Rules" and "Current State" before writing any code.**

---

## 1. Project Overview

Forge & Fable is a local-first D&D 5e character builder: **Next.js 16 (App Router), React 19, TypeScript**. JWT auth (`jose`) + bcryptjs, JSON-file persistence in `data/forge-vault.json` (no database). It has a five-step creation wizard, an interactive drag-and-drop character sheet, a dice-roll overlay, a level-up wizard, and (new in round 1.5) an equipment system and spell preparation/casting.

## 2. Ground Rules

1. **Smallest change that completes each task.** No reformatting, renaming, import reordering, or drive-by cleanup.
2. **No new npm dependencies.**
3. **Never remove or rename existing `Character` fields** — saved characters must keep loading. New fields are optional and must be added to `ALLOWED_PATCH_FIELDS` in `src/lib/validateCharacter.ts` (with a type check in `validateCharacterInput`).
4. After every task: `npm run lint` (0 errors) and `npm run build` (must pass).
5. Work in order. Phases 1–2 are required; Phase 3 only if 1–2 are green.
6. If the code contradicts this document, stop and record the discrepancy in `docs/CHANGES-2.md` rather than guessing.
7. **Deliverable (not optional — it was skipped in round 1):** `docs/CHANGES-2.md` with one entry per task ID: what changed, and how you verified it. A task without a CHANGES entry counts as not done.
8. When a task needs the running app to verify, use the dev server: `npm run dev` (it may already be running on port 3000; if so, use it rather than starting another — Next refuses a second dev server for the same project).

## 3. Current State (post round 1.5 — this is the code you'll find)

```
src/
  lib/
    equipment.ts        ARMORS, WEAPONS, computeArmorClass(), weaponAbility(),
                        preparedSpellLimit(), getWeapon(), getArmor()
    spellSlots.ts       maxSlots(casterType, level) — full/half/pact
    spells.ts           ALL_SPELLS, getSpell(), spellsForClass(), PREPARED_CASTERS
    validateCharacter.ts ALLOWED_PATCH_FIELDS + validateCharacterInput(raw, isPatch)
    sheetLayout.ts      SECTION_TITLES, DEFAULT_LAYOUT, mergeWithDefaults()
    utils.ts            ability math, characterPayload(), createInitialDraft()
    ruleset.ts          hardcoded classes/races (~1,350 lines)
  components/
    HeroSheet.tsx       (~800 lines) sheet with sectionContent(id) switch;
                        equipment section, weapon-driven attacks table,
                        prepared-spell toggles, castSpell(), concentration banner
    CreatorPanel.tsx    the 6-step Standard wizard (Setup/Class/Origin/Species/Attributes/Finalize)
    CharacterStartPanel.tsx  build-mode chooser: Standard / Quickbuilder / Premade
                        (Quickbuilder & Premade are UI stubs — selecting them
                        currently starts the same Standard flow)
    ForgeAndFableApp.tsx root: auth, character CRUD, beginBuild(mode), dice
    LevelUpModal.tsx    level-up wizard (HP/subclass/feat/spells steps)
  types/game.ts         Character (has equipment?: Equipment, preparedSpells?: string[],
                        hpRolls?, asiChoices?, concentratingOn?), BuildMode =
                        "standard" | "quickbuilder" | "premade"
```

Key mechanics already in place (do not re-implement):
- AC comes from `computeArmorClass(finalAbilities, classId, character.equipment)` + custom rules + feat bonus.
- The Attacks section builds rows from `character.equipment.weaponIds` (falls back to `heroClass.actions` when none equipped). Clicking a row rolls **to-hit only** via `props.onRoll(name, 20, 1, toHit)`.
- `castSpell(spell, atLevel)` in HeroSheet spends a slot from `spellSlotsUsed` and sets `concentratingOn` in **one** `onUpdate` patch.
- Warlocks (`casterType === "pact"`): `maxSlots` returns their pact slots at a single level, but the UI spends them through the shared `spellSlotsUsed` map; the separate `pactSlotsUsed` counter is only ever reset by short/long rest. This inconsistency is Task 1.2.

---

## Phase 1 — Combat & casting polish (required)

### Task 1.1 — Damage roll buttons on attack rows

**File:** `src/components/HeroSheet.tsx`, `case "attacks"` inside `sectionContent`.

Clicking an attack row rolls to-hit, but there's no way to roll damage. Add a small damage button at the end of each row (a `<td>` with a `<button>` labeled with the dice, e.g. "1d8+2"):

- Parse the damage dice from the row's weapon (`WeaponDef.damage`, e.g. `"2d6"`; the flat `"1"` for unarmed strike has no dice — roll nothing, it's always 1+mod) or from the class action's `formula`. `parseDamageDice` in `src/lib/spells.ts` already turns text into `{count, sides}[]` — reuse it.
- Clicking it calls `props.onRoll(`${name} damage`, sides, count, mod)` where `mod` is the same ability modifier used for to-hit. It must **not** also trigger the row's to-hit roll (`stopPropagation`).
- Versatile weapons get a second button for the two-handed die (e.g. "1d10+2").

**Accept:** a longsword row shows to-hit on row click, and separate 1d8+mod / 1d10+mod damage buttons that fly dice without triggering to-hit.

### Task 1.2 — Warlock pact slots use `pactSlotsUsed`

**Files:** `src/components/HeroSheet.tsx` (slot pips, `spendSlot`/`recoverSlot`/`castSpell`), reference `src/lib/spellSlots.ts`.

When `casterType === "pact"`: track spent slots in the numeric `character.pactSlotsUsed` (0..max) instead of `spellSlotsUsed`. Concretely: derive `used` for the pact slot level from `pactSlotsUsed ?? 0`; spending/recovering/casting increments/decrements `pactSlotsUsed` (clamped to [0, max]); short rest already resets it. Non-pact casters keep the existing `spellSlotsUsed` path untouched. Warlock pact slots are all the same level — cast buttons for a lower-level spell still consume one pact slot at the pact level.

**Accept:** a warlock spends 2 pact slots, short rest restores both; a cleric's behavior is unchanged.

### Task 1.3 — Short rest: spend hit dice to heal

**File:** `src/components/HeroSheet.tsx`; new optional field `hitDiceSpent?: number` on `Character` (types + allowlist + integer 0–20 validation).

The Short rest button currently only resets pact slots. Replace it with a small flow:

- Track `hitDiceSpent` (0..level). Available dice = `level - hitDiceSpent`.
- Short rest button opens a compact inline panel (a small overlay like the spell detail, or an expansion of the vitals HP cell — pick the lighter one): shows "Hit dice: X/level d{hitDie}", a "Spend & roll" button that rolls `1d{hitDie} + CON mod` via `props.onRoll` and applies the healed amount (clamped to maxHp) plus increments `hitDiceSpent`, in one `onUpdate`.
- Long rest: recover all HP is **not** current behavior — don't add it. Just reset `hitDiceSpent` to `Math.max(0, hitDiceSpent - Math.floor(level / 2))` per 5e (recover half your level, min 1 → use `Math.max(1, Math.floor(level/2))` recovered) alongside its existing resets.
- Pact-slot reset on short rest must keep working.

**Accept:** level 4 character with 10/44 HP spends 2 hit dice, HP rises by the rolled amounts, counter shows 2/4 remaining; long rest restores 2 dice.

---

## Phase 2 — Quickbuilder (required)

### Task 2.1 — Quickbuilder mode: guided 3-question build

**Files:** `src/components/ForgeAndFableApp.tsx` (`beginBuild` already receives `mode`), new `src/components/QuickbuilderPanel.tsx`, `src/components/CharacterStartPanel.tsx` (already sends the mode), `src/lib/quickbuild.ts` (new).

Selecting **Quickbuilder** currently launches the Standard wizard. Replace with a three-question flow that produces a complete draft, then drops the user into the Standard wizard's **Finalize** step (step 5) so they can review and tweak before forging:

1. "How do you want to fight?" → Weapons & armor / Magic / Sneaky & skills / Faith & support
2. "Pick a vibe" → 4–6 options mapping to class within the answer above (e.g. Weapons → Barbarian/Fighter/Monk/Paladin)
3. "Pick a species" → the species grid reused from CreatorPanel, or a simple list.

`src/lib/quickbuild.ts` exports `buildQuickDraft(ruleset, classId, raceId, name): DraftCharacter` that fills everything else with sensible defaults: point-buy stats allocated to the class's `primary` abilities (15/14 in primaries, 13 CON or next, rest 12/10/8 — one fixed mapping, keep it simple and deterministic), first background from the ruleset, default alignment, sources `["5e-core"]`, skill proficiencies empty. The result must pass the existing `createHero` validation (name, class, background, species, sources all set).

Wire-up: in `ForgeAndFableApp`, when `buildMode === "quickbuilder"`, render `QuickbuilderPanel` instead of `CreatorPanel`; on completion call `setDraft(built)` and open `CreatorPanel` at the Finalize step. Reuse existing CSS classes (`choice-tile`, `choice-grid`, `gold-button`) — no new visual language.

**Accept:** From "New character" → Quickbuilder → 3 choices + a name → Finalize screen shows a complete, forgeable character; Forge Hero succeeds.

### Task 2.2 — Premade archetypes

**Files:** `src/lib/quickbuild.ts` (add `PREMADE_ARCHETYPES`), `src/components/CharacterStartPanel.tsx` / `ForgeAndFableApp.tsx`.

Premade currently reserves a dead slot. Implement 6 one-click archetypes: **Tank** (fighter/goliath), **Healer** (cleric/human), **Face** (bard/half-elf-legacy), **Blaster** (sorcerer/tiefling), **Sneak** (rogue/halfling), **Nature's Wrath** (druid/elf). Each is a `buildQuickDraft` call with fixed class/race plus a flavor name placeholder (user must still enter a character name before forging — route them to the Finalize step exactly like Quickbuilder, with the archetype pre-applied). Verify each archetype's race id exists in `/api/ruleset` before hardcoding; adjust to real ids.

**Accept:** picking Tank lands on Finalize with fighter/goliath and sane stats; all 6 archetypes forge successfully.

---

## Phase 3 — Optional (only if 1–2 green)

- **3.1 Inventory management UI:** add/remove items from the Inventory reference tab (name + rarity + notes form, delete button per row). Server-side this is just the existing `inventory` PUT.
- **3.2 Equip from the creation wizard:** let the Finalize step preselect `equipment` (armor/weapons) matching the class's `startingGear` names where they match `ARMORS`/`WEAPONS` entries (fuzzy match on lowercase name; skip non-matches).

Not in scope: campaigns/parties, multiclassing, homebrew editor, CSS refactors.

---

## 4. Verification & Deliverables

Smoke test (dev server, register a throwaway account):
1. Fighter with longsword: row click rolls to-hit; damage buttons roll 1d8/1d10 + mod.
2. Warlock level 3: spend both pact slots casting; short rest restores them; `spellSlotsUsed` stays empty in the saved character (check via GET `/api/characters/:id`).
3. Short rest hit-dice flow heals and decrements the pool; long rest restores half-level dice.
4. Quickbuilder → forge a "Magic" character end-to-end. Premade → forge Tank.

**Deliverables:** the code + `docs/CHANGES-2.md` (per-task entries, discrepancies included). If a task is skipped, say so there explicitly.
