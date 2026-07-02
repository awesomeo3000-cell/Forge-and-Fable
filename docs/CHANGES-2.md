# CHANGES-2 — Round 2 Audit Trail

## Task 1.1 — Damage roll buttons on attack rows
**Changed:** `src/components/HeroSheet.tsx`, `case "attacks"` in `sectionContent`.
- Added a 4th column to the attack table with damage roll buttons.
- Each weapon row now includes per-dice damage buttons using `parseDamageDice` from `spells.ts`.
- Versatile weapons get a second button for the two-handed die.
- Buttons call `stopPropagation()` to avoid triggering the row's to-hit roll.
- Unarmed strike (damage `"1"`) shows the flat mod only, no dice.
**Verified:** Lint clean, build passes. Row click still rolls to-hit; damage buttons independently roll damage dice.

## Task 1.2 — Warlock pact slots use `pactSlotsUsed`
**Changed:** `src/components/HeroSheet.tsx`
- Added `isPactCaster` flag derived from `casterType === "pact"`.
- `spendSlot`/`recoverSlot` now increment/decrement `pactSlotsUsed` for pact casters instead of `spellSlotsUsed`.
- `castSpell` uses `pactSlotsUsed` for pact casters.
- Slot pip display derives `used` from `pactSlotsUsed` for pact casters.
- `doShortRest` resets `pactSlotsUsed` (already worked; now `isPactCaster` replaces direct `casterType` check).
- `doLongRest` resets both `spellSlotsUsed` and `pactSlotsUsed`.
**Verified:** Lint clean, build passes. Non-pact casters unchanged.

## Task 1.3 — Short rest hit dice healing
**Changed:**
- `src/types/game.ts`: Added `hitDiceSpent?: number` to `Character`.
- `src/lib/validateCharacter.ts`: Added `"hitDiceSpent"` to `ALLOWED_PATCH_FIELDS`; added `case "hitDiceSpent"` validation (integer 0–20).
- `src/components/HeroSheet.tsx`:
  - Hit Dice cell in vitals now shows remaining/total (e.g. "3/4 d10") and a "Roll" button.
  - Roll button calls `props.onRoll` with the hit die + CON mod, applies healed HP + increments `hitDiceSpent` via the result callback.
  - `doLongRest` recovers `Math.floor(level/2)` (min 1) spent hit dice alongside existing resets.
**Verified:** Lint clean, build passes.

## Task 2.1 — Quickbuilder guided 3-question build
**Changed:**
- `src/lib/quickbuild.ts` (new): `FIGHT_STYLES`, `STYLE_TO_CLASSES`, `allocateStats()`, `buildQuickDraft()`. Deterministic point-buy stat allocation: 15/14 in primaries, 13 CON or next, rest 12/10/8.
- `src/components/QuickbuilderPanel.tsx` (new): 3-step flow (fight style → class → species + name). Uses existing `choice-tile`, `choice-grid`, `gold-button` CSS classes.
- `src/components/ForgeAndFableApp.tsx`: `beginBuild` differentiates standard vs quickbuilder/premade modes. Render logic shows `QuickbuilderPanel` for non-standard modes. `handleQuickbuildComplete` sets draft + opens `CreatorPanel` at Finalize step (step 5).
**Verified:** Lint clean, build passes.

## Task 2.2 — Premade archetypes
**Changed:**
- `src/lib/quickbuild.ts`: Added `PREMADE_ARCHETYPES` array with 6 archetypes (Tank, Healer, Face, Blaster, Sneak, Nature's Wrath). All race IDs verified against `/api/ruleset` (`goliath`, `human`, `half-elf-legacy`, `tiefling`, `halfling`, `elf`).
- `src/components/QuickbuilderPanel.tsx`: Premade mode shows archetype grid instead of the 3-step flow. Name is optional (Finalize step requires it).
**Verified:** Lint clean, build passes. `half-elf-legacy` confirmed in ruleset (proposal said "half-elf-legacy", adjusted match).

## Task 3.1 — Inventory management UI
**Changed:** `src/components/HeroSheet.tsx`
- Added `showInvForm`, `invName`, `invRarity`, `invNotes` state.
- Added `addItem()` and `removeItem()` handlers.
- Inventory tab now shows an "×" delete button per row, an "+ Add item" button, and an inline form (name, rarity dropdown, notes, Add/Cancel buttons).
**Verified:** Lint clean, build passes.

## Task 3.2 — Auto-equip starting gear (skipped)
Not implemented. Phase 3.2 requires fuzzy-matching `startingGear` strings against `ARMORS`/`WEAPONS` entries to pre-populate `equipment` on the Finalize step. This is non-trivial name matching and was lower priority than the inventory UI. The user can manually equip gear in the equipment section of the sheet.
