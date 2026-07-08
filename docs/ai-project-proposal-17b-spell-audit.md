# Forge & Fable — Spell Workflow Correction (Known Casters + Wizard)

**Date:** 2026-07-08  
**Reference:** `E:\downloads\dnd_5e_level_up_rules_1_20_by_class.docx` (2014 SRD class tables)  
**Audit complete:** 13 class agents reported — 10 PASS, 3 PARTIAL, 1 CRITICAL FAIL

---

## Root Cause Found

The audit revealed two interconnected bugs in `src/components/HeroSheet.tsx`:

### Bug A: Freeform "Learn" dropdown for known casters (lines 200, 1156-1183)

```ts
const canManageSpellbook = learnsIndividualSpells(heroClass.id, casterType) && classSpellList.length > 0;
```

`learnsIndividualSpells` returns `true` for **all** known casters (Bard, Ranger, Sorcerer, Warlock) — because they're NOT in `PREPARED_CASTERS`. This gives them a freeform "Learn" dropdown on the HeroSheet that lets them add ANY spell from their class list at ANY time with NO cap. This completely bypasses the spells-known-per-level table and makes the level-up "pick spells" step meaningless.

**5e RAW:** Known casters learn new spells ONLY on level-up. They cannot freely add/remove spells between levels. The "Learn/Forget" manager is only appropriate for **Wizards** (scribing scrolls into spellbook).

### Bug B: Wizard missing from PREPARED_CASTERS (`spells.ts:39`)

Wizard behaves as a known caster — forced through "pick spells" on level-up instead of "add 2 to spellbook" + daily preparation.

---

## Correct 5e 2014 Spell Models

| Model | Classes | HeroSheet behavior | Level-Up behavior |
|---|---|---|---|
| **Known full** | Bard, Sorcerer | Display known spells. NO freeform learn. | Learn N new from class list. May swap 1. |
| **Known half** | Ranger | Same, spellcasting starts L2. | Learn N new from class list. May swap 1. |
| **Pact Magic** | Warlock | Same as known. | Learn N new. May swap 1. |
| **Prepared full** | Cleric, Druid, Wizard | Full class list. Prepare = mod + level. Wizard: spellbook + scribe. | No "pick spells" step. Wizard: add 2 to spellbook. |
| **Prepared half** | Paladin, Artificer | Full class list. Prepare = mod + half-level. | No "pick spells" step. |
| **Non-caster** | Barb, Fighter, Monk, Rogue | No spell tab. | No spell step. |

---

## Implementation Plan

### Phase 1: Wizard fix (critical)
1. Add `"wizard"` to `PREPARED_CASTERS` in `spells.ts:39`
2. `learnsIndividualSpells("wizard", "full")` will now return `false` → `canManageSpellbook` still needs to be TRUE for Wizard (scribe scrolls)
3. Add separate `isWizardSpellbook` check: Wizard gets the "Learn" dropdown but for **spellbook** (adds 2/level), not `spellsKnown`
4. `_isPrepared` becomes `true` → Wizard gets prepare/unprepare toggles with INT+level limit

### Phase 2: Known caster discipline (Bard, Ranger, Sorcerer, Warlock)
1. Remove freeform "Learn" dropdown from HeroSheet for known casters
2. Known casters only learn spells during level-up via LevelUpModal
3. Add spell-swap to LevelUpModal: "Replace one known spell" dropdown + "Learn N new"
4. Enforce spells-known cap: level-up can't exceed the RAW table

### Phase 3: Prepared caster verification (Cleric, Druid, Paladin, Artificer)
1. Already correct — no "pick spells" step. Verify preparation limits.

---

## Agent Execution Plan — 13 Class Implementation Agents

Each agent reads the current HeroSheet + LevelUpModal code and implements fixes for their class.

| # | Class | Task |
|---|---|---|
| 1 | Barbarian | Verify no spell tab, no spell step. No changes needed. |
| 2 | Bard | Remove freeform Learn from HeroSheet. Enforce spells-known cap. Add swap in LevelUpModal. |
| 3 | Cleric | Verify preparation UI correct. No Learn dropdown. |
| 4 | Druid | Same as Cleric. |
| 5 | Fighter | Verify no spell tab. |
| 6 | Monk | Verify no spell tab. |
| 7 | Paladin | Verify preparation UI correct. No Learn dropdown. |
| 8 | Ranger | Remove freeform Learn. Enforce spells-known cap (L2+ only). Add swap. |
| 9 | Rogue | Verify no spell tab. |
| 10 | Sorcerer | Remove freeform Learn. Enforce spells-known cap. Add swap. |
| 11 | Warlock | Remove freeform Learn. Enforce spells-known cap. Add swap. |
| 12 | Wizard | Add to PREPARED_CASTERS. Keep Learn as spellbook scribe. Add preparation toggles. |
| 13 | Artificer | Verify preparation UI correct. |

---

## Implementation

1. Add `"wizard"` to `PREPARED_CASTERS` in `spells.ts:39`
2. `learnsIndividualSpells()` already returns false for prepared casters — wizard will auto-correct
3. Add wizard spellbook step: "Add 2 spells to spellbook" from class list (distinct from preparation)
4. Ranger: gate spell step on `newLevel >= 2`
5. Add spell-swap UI for known casters (dropdown: "Replace one known spell")
6. Verify all 13 classes and fix any remaining discrepancies

**Constraint:** No schema changes. No new dependencies.
