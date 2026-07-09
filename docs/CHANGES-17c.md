# CHANGES-17c — level-up accuracy fixes (2026-07-11, reviewer-applied)

Closes the three defects from the level-up audit (verified against
`dnd_5e_level_up_rules_1_20_by_class.docx`, 2014 SRD tables). Follows the 17b
spell-workflow correction round.

## 1. Cantrip progression (was: missing entirely)
No caster could ever gain the cantrips owed at class thresholds (bard/cleric/
druid/sorcerer/warlock/wizard at 4 and 10; artificer at 10 and 14).

- `src/lib/spells.ts` — new `CANTRIPS_KNOWN` threshold table + `cantripsKnownAt(classId, level)`.
- `src/components/LevelUpModal.tsx` — the Spells step now also appears when the
  class's cantrip total increases (including for prepared casters, who
  otherwise have no learn step: cleric/druid/artificer). Separate "New
  cantrips — choose N" grid with its own pick cap; merged into `spellsKnown`
  on confirm.
- `src/components/ForgeAndFableApp.tsx` — `creationChoiceLevels` now includes
  cantrip-gain levels, so a high-level creation (e.g. cleric started at 5)
  prompts for the level-4 cantrip during the creation sequence.
- Step completion is now strict: the Spells step requires the full target of
  cantrips AND leveled spells before Continue/Confirm (previously any 1 spell
  unlocked it, silently under-learning).

## 2. Artificer level 1–2 spell slots (was: none)
`maxSlots` treated all half-casters as slotless before level 2, but artificer
rounds UP (Tasha's): 2 first-level slots at level 1.

- `src/lib/spellSlots.ts` — `maxSlots(casterType, level, classId?)`; the
  half-caster floor is level 1 for `classId === "artificer"`, level 2
  otherwise. Ranger/paladin unchanged.
- Callers updated to pass the class id: HeroSheet (`_maxSpellLvl`, `slotMax`)
  and LevelUpModal. An artificer at level 1 now shows 2 first-level slot pips
  and can access first-level spells in the prepared list.

## 3. Wizard no longer offered the level-up spell swap
"Replace one known spell" is a known-caster feature (bard/ranger/sorcerer/
warlock); wizard spellbooks never forget. The swap UI and its application in
`finish()` are now gated on `classId !== "wizard"`.

## Verification
- `npm run build` clean.
- 25-assertion unit run against the live source (extracted, not re-typed):
  artificer slots at L1/2/3/5/17, ranger/paladin floors, pact and full-caster
  spot checks, cantrip totals for all 7 cantrip classes at every threshold,
  gain-level derivation (bard → [4,10], artificer → [10,14]) — ALL PASS.
- Browser walk-through was blocked by a wedged preview session (the harness
  error page, both hostnames; likely aggravated by two `next start` processes
  sharing the rebuilt `.next`). Wiring was instead verified by full re-read:
  step assembly, strict step completion, cantrip/spell grids, wizard swap
  gate, and the confirm-merge order.
- Manual-test fixtures left on the `player-two-review@example.com` account:
  **AuditBard** (lvl 3 — leveling to 4 must ask for 1 cantrip + 1 spell +
  offer the swap + feat), **AuditArtificer** (lvl 1 — sheet must show two
  1st-level slot pips), **AuditWizard** (lvl 5 — leveling to 6 must ask for
  2 spells and NOT offer the swap).

## Note for the next session
Any `next start` process launched before this round's build serves a stale
manifest over the new chunks — restart it before testing in the browser.
