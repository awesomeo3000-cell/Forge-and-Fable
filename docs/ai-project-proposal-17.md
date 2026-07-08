# Forge & Fable — Round 17: Multiclassing (OPTIONAL for 1.0 — cut before compromising the release)

**Audience:** strongest available agent; this is the most invasive rules change in the roadmap. If partway through the gates stop passing and the fixes aren't obvious, STOP, roll back to the checkpoint, and ship 1.0 without multiclassing — the roadmap explicitly permits this.
**Read first:** `docs/ROADMAP-1.0.md` §0; the R13 proposal for how gated rounds work. **Checkpoint commit first.**

## Design (all pre-decided)

### Data model — additive, never destructive
- `Character.classLevels?: { classId: string; level: number; subclassId?: string }[]` — ORDER MATTERS (first entry = starting class, source of save proficiencies & starting skills).
- **Single-class characters stay exactly as they are** (`classId` + `level` + `subclassId` remain authoritative when `classLevels` is absent). `classLevels` appears only when a second class is taken. Derivation rule everywhere: `const levels = character.classLevels ?? [{ classId, level, subclassId }]`. Introduce ONE helper module `src/lib/multiclass.ts` exporting: `getClassLevels(character)`, `totalLevel(character)`, `primaryClass(character)`, `spellSlotsFor(character)` — and refactor consumers to use it (grep every `character.level` and `character.classId` read in HeroSheet/LevelUpModal/libs; each call site is a decision: total level (proficiency bonus, hit dice pool) vs per-class level (features, slots) — list every call site and its decision in the changelog).
- `level` stays maintained as the TOTAL level mirror (so old code paths and validation keep working). `validateCharacter`: `classLevels` array ≤3 entries, each classId whitelisted against ruleset ids, levels 1–20, sum == `level`.

### Rules (2014 PHB)
- **Multiclass prerequisites** (enforced when `settings.useMulticlassPrerequisites` is true, which becomes the DEFAULT for new characters — the toggle finally earns its keep; wire it back into the settings panel): 13+ in the primary ability of BOTH current and target class. Table: barbarian STR13; bard/sorcerer/warlock CHA13; cleric/druid/wisdom WIS13; fighter STR13 or DEX13; monk DEX13+WIS13; paladin STR13+CHA13; ranger DEX13+WIS13; rogue DEX13; wizard/artificer INT13.
- **Spell slots:** multiclass caster level = full levels + ⌈half⌉→floor(level/2) for half casters + artificer ⌈level/2⌉ rounded UP; warlock pact magic stays SEPARATE (pact slots per warlock level, on top). Use the shared full-caster table with that combined level. Implement in `spellSlotsFor()`; `maxSlots` stays for single-class.
- **Proficiencies on multiclass-in** (fixed grants, no choices in v1): per PHB multiclass table — e.g. fighter-in: light/medium armor, shields, simple/martial weapons; rogue-in: light armor + one skill (v1: SKIP the skill choice, note it); cleric-in: light/medium armor, shields. Store nothing new — these affect display only (Proficiencies section) via a helper.
- **Hit dice:** pool becomes per-class (d8×3 + d10×2 shown as "3d8 + 2d10"); the hit-dice vital and short-rest spend use total count, rolling the die of the FIRST class with dice remaining (documented simplification).

### Level-up flow
- `LevelUpModal` gains a first step when leveling past 1: "Advance which class?" — cards for current class(es) + eligible new classes (prereq-gated). Everything downstream (HP die, features, subclass, spells) uses the CHOSEN class's data at that class's NEW per-class level. ASI eligibility: per-class asiLevels against the per-class level.
- Level-down (the minus stepper) pops the LAST classLevels increment (track a parallel `levelHistory?: string[]` of classIds in level order — validated array, len == level−1 tolerated for legacy) — if `levelHistory` is absent (legacy character), level-down behaves exactly as today (single-class assumption).

### Sheet display
- Identity subtitle: "Human Fighter 3 / Wizard 2". Class icon = first class. Features tab: one "Class Features" group per class (per-class level). Spells: union of each caster class's known/prepared logic with slots from `spellSlotsFor` (prepared-caster lists keyed per class — cleric list at cleric level, etc.).

## Gates (each must pass before the next)
1. `multiclass.ts` + refactor with `classLevels` ABSENT everywhere: full regression (existing single-class characters byte-identical behavior — build one fresh + walk an old one).
2. Level-up class picker: fighter 3 takes wizard 1 → subtitle right, HP rolled on d6, wizard cantrip/spellbook step appears, slots = caster level 1 ([2]).
3. Slot math table test (changelog: show computed slots for fighter5/wizard5 → caster 5; paladin4/warlock3 → caster 2 + pact 2; ranger4/cleric4 → caster 6).
4. Prereq gating: STR 10 fighter cannot see barbarian in the picker with the toggle on; toggle off → visible.
5. Level-down of the multiclassed level unwinds the right class; legacy character level-down unchanged.

## Constraints
Landmines apply. NOTHING about this round may alter the behavior of a character that never multiclasses — that's the invariant every gate re-checks. `docs/CHANGES-17.md` with the call-site decision table, gate evidence, deviations. No entry = not done.
