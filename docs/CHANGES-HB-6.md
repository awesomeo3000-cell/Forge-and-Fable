# CHANGES-HB-6 — Class and Subclass Studio (in progress)

Phase 6 of `docs/ai-project-proposal-homebrew-studio.md`. This is a Critical-risk
phase being delivered in reviewable sub-rounds; this changelog is updated as each
lands. **Not yet complete** — remaining sub-rounds are listed in §Remaining.

## Sub-round 6a — level-up class picker (multiclass selection)

The deferred Phase-5 UI item: choosing which class gains a level, and
translating the single-class level-up modal into whole-character multiclass
state.

- **`src/lib/levelUpMulticlass.ts`** (new):
  - `classScopedCharacterView(character, classRef)` — hands `LevelUpModal` a view
    scoped to one class (`level` = that class's level, `subclassId` = that
    class's subclass), because the modal's internals are single-class.
  - `multiclassLevelUpPatch(character, targetRef, modalData)` — translates the
    modal's class-space confirm payload into a whole-character patch:
    `classLevels` via `addClassLevel`, mirror fields via `classLevelMirrors`, a
    subclass picked mid-level-up attached to the leveled class (not the mirror),
    progression **recomputed** on the merged multiclass character (the modal's
    single-class progression output is never passed through), and appended
    choice/spell history rewritten from class-level space to the new total
    level.
- **`src/components/HeroSheet.tsx`**: the level-up button opens a class picker
  (`cs-class-picker`) offering current classes plus eligible new built-in
  classes from `eligibleMulticlassOptions` (ineligible ones disabled with the
  unmet-requirement reason). A pure single-class character continuing its own
  class keeps the unchanged legacy path (no `classLevels` write); any other pick
  runs the modal in class space and applies the translated patch. Multiclass
  level-down is gated with a snapshot-restore hint (per-class unwind ships with
  the studio).
- Gate tests in `tests/multiclassFoundation.test.ts`: new-class translation
  end-to-end (validates server-side), and a mid-level-up subclass landing on the
  leveled class while the mirror stays with the primary class.

## Sub-round 6b — homebrew class/subclass packet normalization

The keystone that lets the Phase-5 injectable registry resolve a homebrew class
through the *same* `buildLevelUpPlan` path built-in classes use (proposal §8.4:
"do not build a second homebrew-only level-up engine").

- **`src/lib/homebrew/classPacketNormalization.ts`** (new):
  `normalizeHomebrewClassPacket(payload, ref)` → `ClassProgressionPacket` and
  `normalizeHomebrewSubclassPacket(payload, ref)` → `SubclassProgressionPacket`.
  Maps hit die, ability/save/armor/weapon data, aggregated skill/tool choices,
  per-level automatic features and resource grants, fills proficiency bonus for
  all 20 levels, and builds spellcasting slot/count tables for
  full/half/third/pact/custom modes (`slotsForMode` uses the shared
  `FULL_CASTER_SLOTS`; half rounds up from level 2 capped at 5th, third from
  level 3 capped at 4th; pact emits the warlock count/slot-level tables).
  Stable packet id `hb:<definitionId>`.
- **`src/lib/progression/engine.ts`**: `BuildClassLevelUpPlanInput` gains
  optional `classRef` / `subclassRef`. When set, the registry is asked for that
  exact ref — the only way to resolve a homebrew class, since `classId` alone
  always implies a built-in. Absent, a built-in ref is derived from `classId`
  (unchanged). Resolving a homebrew ref without a registry throws clearly.
- Gate tests in `tests/homebrewClassPacket.test.ts` (10): packet identity and
  1-20 fill, full/half/pact/none spell tables, and — the real proof — a homebrew
  class **and** homebrew subclass producing correct features, resources, spell
  changes, and proficiency bonuses through `buildLevelUpPlan` via an injected
  registry; wrong-parent and no-registry rejections.

## Test evidence (sub-rounds to date)

- `npx vitest run tests/homebrewClassPacket.test.ts` — 10 passed.
- `npx vitest run tests/progressionEngine.test.ts tests/progressionValidation.test.ts tests/multiclassFoundation.test.ts tests/homebrewClassProgression.test.ts tests/homebrewClassPacket.test.ts tests/classProgression.test.ts tests/homebrewRegistry.test.ts` — 7 files, 62 passed.
- `npx tsc --noEmit` — clean. `npx eslint <touched files>` — clean.

## Deliberate deferrals within Phase 6 (documented, not silently dropped)

- **Structured per-level class `choices`** are normalized to `[]`. Offering them
  needs the modal's option renderer to read `ChoiceDefinition.from`; emitting
  choice ids now would surface picks the UI cannot render and validators would
  reject. Deferred to the class-selection-integration sub-round.
- **Feature descriptions on the sheet**: the packet carries feature *ids*; the
  resolver must carry homebrew feature descriptions to the client before the
  sheet can show them. Deferred to the sheet-integration sub-round.
- **Sheet-level slots for homebrew casters**: `casterContribution`
  (`src/lib/multiclass.ts`) still returns zero for non-built-in refs. Combined
  slots for a homebrew caster arrive with the resolver/sheet integration.

## Remaining Phase 6 sub-rounds

1. **Server registry** resolving authorized homebrew class/subclass refs from
   the store, threaded into `progressionPatchForCharacter` /
   `validateCharacterProgression` and the multiclass aggregation (which still
   throws "until Phase 6" for homebrew entries in `state.ts`).
2. **Class & Subclass Studio editors** (foundation, proficiencies, spellcasting
   simple + advanced, 1-20 level guide, prerequisites, preview) with built-in
   template cloning.
3. **Creation & level-up selection** of homebrew classes (extend the 6a picker
   to offer accessible homebrew classes).
4. **Sheet integration**: homebrew features/resources/labels, homebrew caster
   slots, structured class choices.
5. **Class/subclass version upgrade preview + snapshot rollback.**
6. **Freeform authoring mode** for classes/subclasses (§10A).
7. `docs/CHANGES-HB-6.md` finalization + independent review agent (proposal §14
   requires one before Phase 6 is accepted).

## Browser/runtime evidence

Deferred, as with HB-4/5 — the engine-level work here has no UI surface yet, and
the Phase 3-5 build/Playwright/browser debt still stands.

## Rollback notes

Revert the listed files; no migrations, no stored-data changes. No shipped UI
writes homebrew `classLevels` refs, so no character can hold state a rollback
would strand. The 6a picker only writes built-in multiclass state, which the
Phase-5 foundation already supports.
