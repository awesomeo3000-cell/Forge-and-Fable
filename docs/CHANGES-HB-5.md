# CHANGES-HB-5 — Multiclass and generalized progression foundation

Phase 5 of `docs/ai-project-proposal-homebrew-studio.md`. The progression
engine is registry-injectable and per-class; characters can carry
`classLevels`; validation, aggregation, prerequisites, slots, and hit dice are
multiclass-aware. All mandatory Phase 5 gates pass at the engine level.

## 1. Scope completed

- **`Character.classLevels`** (`CharacterClassLevel[]` from the frozen Phase 0
  contract) with compatibility mirrors: `level` = total level, `classId` /
  `subclassId` = primary (first-acquired) class. Mirrors are enforced by
  validation on every write.
- **One multiclass helper module** — `src/lib/multiclass.ts` owns:
  `getClassLevels` (derives a single built-in entry from legacy fields when
  `classLevels` is absent), `totalLevel`, `primaryClass`, `classLevelFor`,
  `classLevelMirrors`, `addClassLevel` / `removeClassLevel` (level-down unwinds
  the correct class; the first class can never be removed while others remain),
  `hitDicePools`, `casterContribution` + `combinedSpellSlots`, and the
  structured multiclass prerequisite evaluator.
- **Combined spell slots**: per-class caster contributions (full = level, half
  = ⌊level/2⌋, artificer = ⌈level/2⌉, third-caster subclasses = ⌊level/3⌋),
  summed into the shared full-caster table; **warlock pact slots stay
  separate**. Single-class characters read their native table so existing slot
  behavior (including "no slots at paladin 1" and "EK subclasses not modeled")
  is untouched.
- **Structured multiclass prerequisites**: SRD ability minimums with either-or
  groups (fighter STR 13 *or* DEX 13; monk DEX 13 *and* WIS 13), applied to
  both leaving and entering classes; `eligibleMulticlassOptions` honors the
  same enforce/relax toggle used for feat prerequisites. Server-repeatable —
  it is pure over ability scores.
- **Registry injection (§8.5)**: `buildLevelUpPlan` (and therefore
  `progressionPatchForCharacter` and `validateCharacterProgression`) accepts an
  optional `RulesContentRegistry`. Without one, resolution is byte-identical to
  the previous direct catalog lookup (research-mode rulesets included); with
  one, class/subclass packets resolve through the injected interface, which is
  how Phase 6 admits database-backed homebrew classes. No process-global
  mutable map.
- **Generalized progression aggregation**: multiclass characters get one plan
  per class at that class's own level, merged into `featureResources` (Lay on
  Hands scales with **paladin** levels, not total level — `level*N` formulas
  resolve against the granting class), `alwaysPreparedSpells`,
  `expandedSpellLists`, and an extended `progressionState` with a new optional
  `classes: [{classId, subclassId?, level}]` array. Single-class output is
  unchanged (no `classes` field, same shape as before).
- **Server validation**: field-shape checks for `classLevels` in
  `validateCharacter.ts` (≤ 5 entries, ref shapes, bounded levels/order) plus
  cross-field progression checks in `validate.ts` — duplicate classes, total
  ≠ mirror, ruleset mismatch, wrong subclass parent, subclass below selection
  level, and homebrew class refs (rejected until Phase 6) all fail with clear
  messages. Multiclass feature state validates against the aggregated patch.

## 2. Files changed

- `src/lib/multiclass.ts` — new helper module (the only owner of class-level
  semantics).
- `src/types/game.ts` — `Character.classLevels`,
  `CharacterProgressionState.classes`.
- `src/lib/progression/engine.ts` — optional `registry` input; default path
  preserved exactly.
- `src/lib/progression/state.ts` — multiclass aggregation branch; registry
  passthrough; single-class branch unchanged.
- `src/lib/progression/validate.ts` — `validateClassLevels`,
  `validateMulticlassProgression`, registry threading.
- `src/lib/validateCharacter.ts` — `classLevels` allowed patch field + shape
  validation.
- `tests/multiclassFoundation.test.ts` — 17-test Phase 5 gate suite.

## 3. Call-site decision table (proposal §8.1)

Classification of `character.level` / `classId` / `subclassId` consumers:

| Consumer | Classification | Phase 5 action |
|---|---|---|
| `proficiencyBonus(level)`, minimum-level effect gates, encumbrance, passive scores | Total level | Correct as-is via the `level` mirror |
| `resolveMaximum` `level*N` resource formulas (state.ts) | **Class level** | Fixed: multiclass path resolves per granting class |
| `maxSlots(casterType, level)` (HeroSheet, campaignStore) | All classes (combined) | `combinedSpellSlots` ready; sheet/campaign still read the mirror (single-class-correct) until the UI round |
| Hit dice (restRecovery, hitPoints, HeroSheet) | All classes (per-class pools) | `hitDicePools` ready; sheet integration deferred with the picker |
| `buildLevelUpPlan` classId/subclassId | A particular class | Engine per-class; state.ts aggregates |
| `validateCharacterProgression` deep choice checks (cantrips, spells, ASI) | A particular class | Single-class only this phase (see §7) |
| LevelUpModal `classId` prop | A particular class (the leveled class) | Deferred with the picker (see §7) |
| `capabilities.ts`, `subclasses.ts` lookups | A particular class | Primary mirror this phase; Phase 6 generalizes |
| `isHomebrewClass`, vault/dashboard labels, `ordinalLevel` | Primary class + total (display) | Mirrors are correct by construction |

## 4. Compatibility decisions

- A character without `classLevels` derives exactly one built-in entry from its
  legacy fields; every existing code path is unchanged (gate: existing
  progression fixtures all green).
- Default (no-registry) engine resolution is the same direct catalog lookup as
  before — including research-mode 2024 packets, which the built-in registry
  adapter's production gate would wrongly reject (caught by the existing engine
  suite during this round and fixed by keeping the legacy default path).
- `progressionState` for single-class characters is byte-identical; the new
  `classes` array appears only for multiclass characters.
- Manual-homebrew classes (`HOMEBREW_CLASS_ID` sentinel) behave exactly as
  before; homebrew refs inside `classLevels` are rejected until Phase 6.

## 5. Test evidence

- `npx vitest run tests/multiclassFoundation.test.ts tests/progressionValidation.test.ts tests/homebrewClassProgression.test.ts` — **23 passed** (includes all mandatory gates: derivation/compatibility, Fighter 3 / Wizard 1 features + combined slots + hit dice, Paladin 5 / Warlock 3 pact separation, prerequisite toggle, either-or requirements, leaving+entering checks, level-down unwind, duplicate/total/ruleset/homebrew/subclass-parent rejections, patch-field shape, registry parity and failure surfacing).
- `npx vitest run tests/classProgression.test.ts tests/creationChoices.test.ts tests/levelUpModal.test.tsx tests/progressionEngine.test.ts tests/progressionPackets.test.ts tests/restRecovery.test.ts tests/snapshotRestore.test.ts tests/characterApi.integration.test.ts tests/progressionValidation.test.ts tests/homebrewClassProgression.test.ts tests/homebrewRegistry.test.ts` — **11 files, 67 passed** (existing fixtures green).
- `npx tsc --noEmit` — clean. `npx eslint <touched files>` — clean.

## 6. Browser/runtime evidence

Not applicable to this round's engine scope (no UI consumes `classLevels`
yet). The Phase 3-4 browser/build/Playwright debt noted in `CHANGES-HB-4.md`
§6 still stands and now also covers this round's regression surface.

## 7. Deviations from the proposal

- **Level-up class picker UI: deferred.** The eligibility evaluator and
  level-up/-down helpers are implemented and tested, but `LevelUpModal` still
  receives a single `classId` from the shell. Rationale: with homebrew classes
  locked until Phase 6 and no sheet surfaces reading `classLevels`, a picker
  now would expose multiclass state the rest of the UI cannot yet display. The
  picker should open Phase 6 (which already owns "creation and level-up
  selection") backed by `eligibleMulticlassOptions` + `addClassLevel`.
- **Deep per-choice validation for secondary classes** (cantrip/spell counts,
  ASI cadence) is single-class only; multiclass characters validate structure,
  packets, mirrors, and the aggregated feature set. The choice model
  generalizes in Phase 6 alongside the picker.
- Combined-slot presentation on the sheet still reads the single-class mirror;
  correct for every character that can currently exist (multiclass characters
  cannot be authored without the picker).

## 8. Known manual-only behavior

Unchanged from HB-4. Nothing new claims automation.

## 9. Rollback notes

- Revert the listed files; no migrations, no stored-data changes. No shipped UI
  writes `classLevels`, so no character can hold multiclass state that a
  rollback would strand. `progressionState.classes` is optional and ignored by
  prior code.

## 10. Next-phase blockers

- **Independent review round required before Phase 6** (proposal §14 Phase 5).
  Review focus: the compatibility mirror invariants, the multiclass patch
  aggregation (resource-id collision policy: first-acquired wins), and the
  registry default-path parity.
- Phase 6 entry work: the class picker (see §7), homebrew class packet
  normalization into `ClassProgressionPacket`, and a server registry that
  resolves authorized homebrew refs through the now-injectable engine.
