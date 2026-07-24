/**
 * Multiclass level-up patch translation (Phase 6a).
 *
 * `LevelUpModal` runs in *class-level space*: its `character` prop is a
 * class-scoped view (level = that class's level, subclassId = that class's
 * subclass) and its confirm payload carries `level = <new class level>` plus a
 * progression patch computed on that single-class view. This module translates
 * that payload into whole-character space: per-class `classLevels`, mirror
 * fields, and a progression patch recomputed on the true multiclass character
 * — the modal's single-class progression output is never passed through.
 */
import type { Character, CharacterProgressionState } from "@/types/game";
import type { RulesContentRef } from "@/types/homebrew";
import {
  addClassLevel,
  builtinSubclassRef,
  classLevelMirrors,
  classRefKey,
  getClassLevels,
} from "@/lib/multiclass";
import { progressionPatchForCharacter } from "@/lib/progression/state";

/** The class-scoped view handed to `LevelUpModal` when leveling `targetRef`. */
export function classScopedCharacterView(character: Character, targetRef: RulesContentRef): Character {
  const entry = getClassLevels(character).find((e) => classRefKey(e.classRef) === classRefKey(targetRef));
  return {
    ...character,
    level: entry?.level ?? 0,
    subclassId: entry?.subclassRef?.source === "builtin" ? entry.subclassRef.id : undefined,
  };
}

/**
 * Translate a modal confirm payload for leveling `targetRef` into a
 * whole-character patch. `modalData.level` is the new CLASS level of the
 * target; the returned patch's `level` is the new TOTAL level, `classLevels`
 * carries the per-class record, and the mirrors follow the primary class.
 */
export function multiclassLevelUpPatch(
  character: Character,
  targetRef: RulesContentRef,
  modalData: Record<string, unknown>,
): Record<string, unknown> {
  const leveled = addClassLevel(character, targetRef);
  // A subclass picked during this level-up belongs to the leveled class, not
  // to the character-wide mirror field.
  const pickedSubclassId = modalData.subclassId as string | undefined;
  const classLevels = pickedSubclassId
    ? leveled.map((entry) => classRefKey(entry.classRef) === classRefKey(targetRef)
        ? { ...entry, subclassRef: builtinSubclassRef(character.ruleset, pickedSubclassId) }
        : entry)
    : leveled;
  const mirrors = classLevelMirrors(classLevels);

  // Recompute progression on the merged multiclass character. The modal's
  // non-progression outputs (HP, spells, feats, feature choices) merge in
  // first; its single-class progression fields are overridden below.
  const merged = {
    ...character,
    ...modalData,
    level: mirrors.level,
    classId: mirrors.classId,
    subclassId: mirrors.subclassId,
    classLevels,
  } as Character;
  const progression = progressionPatchForCharacter(merged);

  // History entries the modal appended are in class-level space; rewrite the
  // appended tail to the new total level so level filtering stays coherent.
  const modalState = modalData.progressionState as CharacterProgressionState | undefined;
  const oldChoices = character.progressionState?.choiceHistory ?? [];
  const oldSpells = character.progressionState?.spellHistory ?? [];
  const appendedChoices = (modalState?.choiceHistory ?? []).slice(oldChoices.length)
    .map((entry) => ({ ...entry, level: mirrors.level }));
  const appendedSpells = (modalState?.spellHistory ?? []).slice(oldSpells.length)
    .map((entry) => ({ ...entry, level: mirrors.level }));

  return {
    ...modalData,
    level: mirrors.level,
    classId: mirrors.classId,
    subclassId: mirrors.subclassId,
    classLevels,
    featureResources: progression.featureResources,
    alwaysPreparedSpells: progression.alwaysPreparedSpells,
    expandedSpellLists: progression.expandedSpellLists,
    progressionState: {
      ...progression.progressionState!,
      choiceHistory: [...oldChoices, ...appendedChoices],
      spellHistory: [...oldSpells, ...appendedSpells],
    },
  };
}
