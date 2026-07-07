# Round 11 Proposal — Tool proficiencies, languages, currency & encumbrance

**Context:** Continues `docs/ROADMAP-1.0.md` §3 rules-engine work, following R10's QA sweep and the subspecies round. Covers §3.10 (tool proficiencies & languages) and §3.11 (currency & encumbrance). §3.13 (XP advancement) is intentionally skipped this round — XP tracking is normally a DM/table decision made outside the app, not something the builder should enforce.

**Tier:** DS (mechanical, fully specced below).

---

## Pre-implementation scoping decision

`items.json`'s 541-item catalog has **no `weight` field anywhere** — confirmed via direct grep across every entry. Hand-authoring accurate 5e weights for all 541 (potions, scrolls, wondrous items, tools) is a large, error-prone data task, especially since this file already has known-wrong entries from prior QA (mistyped Trident damage die, wrong Longbow property). Scoped down per user direction:

- **In scope:** the ~29-item *static* armor/weapon catalog in `equipment.ts` (the actual worn/wielded gear that drives most STR-based encumbrance) gets accurate real 5e weights.
- **Out of scope:** the 541-item magic/gear catalog gets no weight data this round — those items simply contribute 0 to carry weight until a future round populates them. Manually-added inventory items get an optional weight field so players can specify their own.

---

## Part A — Tool proficiencies & languages (§3.10)

**Data (`src/lib/srd.ts`):** added `LANGUAGES` (15 standard 5e languages, Common assumed known), `TOOLS` (artisan tools, musical instruments, gaming sets, thieves'/herbalism/etc. kits), and four grant/choice maps mirroring the existing `CLASS_SKILL_CHOICES`/`BACKGROUND_SKILLS` pattern:
- `CLASS_TOOL_GRANTS` / `CLASS_TOOL_CHOICES` — fixed and choice-based class tool grants (Druid: Herbalism kit; Rogue: Thieves' tools; Artificer: Thieves' + Tinker's tools fixed, +1 artisan tool choice; Bard: choose 3 instruments; Monk: choose 1 tool/instrument).
- `BACKGROUND_TOOL_GRANTS` / `BACKGROUND_TOOL_CHOICES` — Criminal (Thieves' tools fixed + 1 gaming set choice), Soldier (Land vehicles fixed + 1 gaming set choice).
- `BACKGROUND_LANGUAGE_CHOICES` — Acolyte and Sage each grant 2 languages of choice.

**Types:** `Character.toolProficiencies?`, `Character.languages?`, matching `DraftCharacter.toolProficiencies`/`languages` (chosen-picks-only arrays, mirroring `skillProficiencies`). Whitelisted in `ALLOWED_PATCH_FIELDS` with array/string validation in `validateCharacter.ts`.

**Builder UI (`CreatorPanel.tsx`):** Class step shows fixed tool grants (read-only) + a choice-picker chip UI (reusing the existing skill-picker's `.dj-skill-chip` convention) when the class has one. Origin step shows the same for background tool grants/choices, plus a language choice picker when the background grants any. Picks are tracked per-pool (a class choice and a background choice can be active simultaneously without competing for the same count) and reset appropriately when class/background changes mid-wizard.

**Merge at creation (`characterPayload` in `utils.ts`):** fixed class + background tool grants are merged with the player's chosen picks into the final `toolProficiencies` array at Finalize — so the sheet shows everything granted, not just what required a choice.

**Sheet (`HeroSheet.tsx`):** "Proficiencies & Training" section now shows Tools and Languages groups alongside the existing Armor & Weapons group, using the same chip styling.

## Part B — Currency & encumbrance (§3.11)

**Types:** new `Currency` type (`cp`/`sp`/`ep`/`gp`/`pp`), `Character.currency?` / `DraftCharacter.currency`, `InventoryItem.weight?`. Whitelisted + validated (non-negative integers, capped).

**Weights (`equipment.ts`):** real PHB weights added to all 12 static armors, all 17 static weapons, and a `SHIELD_WEIGHT = 6` constant. `inventoryWeaponToDef` (synthesizes a `WeaponDef` from an inventory item) falls back to the matched static weapon's weight when the item itself has none.

**New helpers (`equipment.ts`):**
- `totalCarriedWeight(inventory, equipment, currency, ignoreCoinWeight)` — sums inventory item weights + statically-equipped armor/weapon/shield weight + coin weight (50 coins/lb, per the existing settings copy), honoring `ignoreCoinWeight`.
- `carryCapacity(strength, encumbranceType)` — `"none"` disables the display; `"standard"` returns `STR × 15`; `"variant"` also returns the 5×/10× encumbered/heavily-encumbered thresholds.

**Settings (`SourceSettingsPanel.tsx`):** re-added the `encumbranceType`/`ignoreCoinWeight` controls that were removed in R10 for being dead — now wired to a real feature.

**Sheet (`HeroSheet.tsx`):** new currency panel (5 number inputs, cp/sp/ep/gp/pp) at the top of the Inventory tab, plus a carry-weight line showing `Carrying X / Y lb` with encumbered/heavily-encumbered/over-capacity messaging when using variant rules. Manual "Add item" form gained an optional weight (lb) field.

---

## Verification requirements
- `npm run lint` / `npm run build` — 0 new errors, same baseline as prior rounds.
- Manual walk: create a Bard (musical instrument tool choice) with a Sage background (2 language choice) — confirm both choice pickers enforce their counts independently and the sheet's Proficiencies & Training section shows the right Tools/Languages groups. Set currency and equip static armor — confirm carry weight updates correctly (coin weight = total coins / 50; armor/weapon/shield weight from the PHB table).
- One entry per task in `docs/CHANGES-11.md`.
