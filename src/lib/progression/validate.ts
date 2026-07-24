import { buildLevelUpPlan } from "@/lib/progression/engine";
import { progressionCatalog } from "@/lib/progression/packets";
import { progressionPatchForCharacter } from "@/lib/progression/state";
import { classLevelMirrors, classRefKey } from "@/lib/multiclass";
import type { LevelUpChoice } from "@/lib/progression/types";
import type { Character, FeatureChoiceValue } from "@/types/game";
import type { RulesContentRegistry } from "@/types/homebrew";
import rawSpells from "@/data/spells.json";
import { progressionChoiceOptions } from "@/lib/progression/choiceOptions";
import { cantripsKnownAt } from "@/lib/spells";
import { isHomebrewClass } from "@/lib/homebrewIdentity";
import { CharacterValidationError } from "@/lib/validateCharacter";

type SpellRecord = { id: string; level: number; school: string; classes: string[] };
const SPELLS = new Map((rawSpells as SpellRecord[]).map((spell) => [spell.id, spell]));

function values(value: FeatureChoiceValue | undefined): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.map(String);
  return value && typeof value === "object" ? Object.keys(value) : [];
}

function requiredCount(choice: LevelUpChoice): number {
  return choice.count ?? 1;
}

function isChoiceHandledElsewhere(choiceId: string): boolean {
  return choiceId === "choose-subclass"
    || choiceId === "choose-asi-or-feat"
    || choiceId.includes("expertise")
    || choiceId.includes("spell")
    || choiceId.includes("cantrip");
}

function validateChoice(character: Character, choice: LevelUpChoice, expectedCount = requiredCount(choice)): void {
  if (choice.choiceId === "choose-subclass") {
    if (!character.subclassId) throw new Error(`Character ${character.id} level ${choice.level} field subclassId violates ${choice.choiceId}: a subclass is required.`);
    return;
  }
  if (choice.choiceId === "choose-asi-or-feat") {
    if (!(character.asiChoices ?? []).some((entry) => entry.level === choice.level)) {
      throw new Error(`Character ${character.id} level ${choice.level} field asiChoices violates ${choice.choiceId}: a choice is required.`);
    }
    return;
  }
  if (choice.choiceId.includes("expertise")) {
    if ((character.skillExpertise?.length ?? 0) < requiredCount(choice)) {
      throw new Error(`Character ${character.id} level ${choice.level} field skillExpertise violates ${choice.choiceId}: ${requiredCount(choice)} selections are required.`);
    }
    return;
  }
  if (choice.choiceId.includes("cantrip")) {
    const sourceClass = choice.choiceId.includes("druid-cantrip") ? "druid" : choice.choiceId.includes("wizard-cantrip") ? "wizard" : character.classId;
    const count = new Set([...character.spellsKnown, ...(character.spellbookSpells ?? [])].filter((id) => {
      const spell = SPELLS.get(id);
      return spell?.level === 0 && spell.classes.includes(sourceClass) && (choice.choiceId !== "choose-light-cantrip" || id === "light");
    })).size;
    if (count < expectedCount) throw new Error(`Character ${character.id} level ${choice.level} field spellsKnown violates ${choice.choiceId}: ${expectedCount} cantrips are required.`);
    return;
  }
  if (choice.choiceId.includes("spell")) {
    const anyClass = choice.choiceId.includes("any-class");
    const sourceClass = choice.restrictedSchools?.length && character.classId === "fighter" ? "wizard" : character.classId;
    const count = new Set([...character.spellsKnown, ...(character.spellbookSpells ?? [])].filter((id) => {
      const spell = SPELLS.get(id);
      if (!spell || spell.level <= 0) return false;
      if (!anyClass && !spell.classes.includes(sourceClass)) return false;
      if (choice.restrictedSchools?.length && !choice.restrictedSchools.includes(spell.school.toLowerCase())) return false;
      if (/first-level|1st-level/.test(choice.choiceId) && spell.level !== 1) return false;
      if (/2nd-level/.test(choice.choiceId) && spell.level !== 2) return false;
      return true;
    })).size;
    if (count < expectedCount) throw new Error(`Character ${character.id} level ${choice.level} field spellsKnown violates ${choice.choiceId}: ${expectedCount} spells are required.`);
    return;
  }
  if (isChoiceHandledElsewhere(choice.choiceId)) return;

  const selected = values(character.featureChoices?.[choice.choiceId]);
  if (selected.length < expectedCount) {
    throw new Error(`Character ${character.id} level ${choice.level} field featureChoices.${choice.choiceId} violates ${choice.choiceId}: ${expectedCount} selections are required.`);
  }
  if (new Set(selected).size !== selected.length) {
    throw new Error(`Character ${character.id} level ${choice.level} field featureChoices.${choice.choiceId} violates ${choice.choiceId}: duplicate selections are not allowed.`);
  }
  const allowedOptions = progressionChoiceOptions(choice);
  if (allowedOptions.length > 0) {
    const invalid = selected.find((selection) => !allowedOptions.includes(selection));
    if (invalid) throw new Error(`Character ${character.id} level ${choice.level} field featureChoices.${choice.choiceId} violates ${choice.choiceId}: "${invalid}" is not an allowed option.`);
  }
}

/**
 * Structural validation for multiclass class-level records (Phase 5). Deep
 * per-choice validation (cantrip/spell counts, ASI cadence) remains
 * single-class-only until Phase 6 generalizes the choice model; feature grants
 * are still fully validated through the aggregated progressionState below.
 */
function validateClassLevels(character: Character): void {
  const classLevels = character.classLevels ?? [];
  if (classLevels.length === 0) return;
  const seen = new Set<string>();
  for (const entry of classLevels) {
    if (entry.classRef.source !== "builtin") {
      throw new Error(`Character ${character.id} field classLevels violates progression: homebrew class references are not accepted until Phase 6.`);
    }
    if (entry.classRef.ruleset !== character.ruleset) {
      throw new Error(`Character ${character.id} field classLevels violates progression: class "${entry.classRef.id}" is pinned to ruleset ${entry.classRef.ruleset}, not ${character.ruleset}.`);
    }
    if (!Number.isInteger(entry.level) || entry.level < 1 || entry.level > 20) {
      throw new Error(`Character ${character.id} field classLevels violates progression: class "${entry.classRef.id}" level must be an integer 1-20.`);
    }
    const key = classRefKey(entry.classRef);
    if (seen.has(key)) {
      throw new Error(`Character ${character.id} field classLevels violates progression: duplicate class "${entry.classRef.id}".`);
    }
    seen.add(key);
    const classPacket = progressionCatalog.classes.get(`${character.ruleset}:${entry.classRef.id}`);
    if (!classPacket) {
      throw new Error(`Character ${character.id} field classLevels violates progression: class "${entry.classRef.id}" is invalid for ${character.ruleset}.`);
    }
    if (entry.subclassRef) {
      if (entry.subclassRef.source !== "builtin") {
        throw new Error(`Character ${character.id} field classLevels violates progression: homebrew subclass references are not accepted until Phase 6.`);
      }
      const subclass = progressionCatalog.subclasses.get(`${character.ruleset}:${entry.subclassRef.id}`);
      if (!subclass) {
        throw new Error(`Character ${character.id} field classLevels violates progression: subclass "${entry.subclassRef.id}" is unavailable for ${character.ruleset}.`);
      }
      if (subclass.classId !== classPacket.id) {
        throw new Error(`Character ${character.id} field classLevels violates progression: subclass "${entry.subclassRef.id}" belongs to ${subclass.classId}.`);
      }
      if (entry.level < subclass.selectionLevel) {
        throw new Error(`Character ${character.id} field classLevels violates progression: subclass "${entry.subclassRef.id}" requires ${classPacket.id} level ${subclass.selectionLevel}.`);
      }
    }
  }
  const mirrors = classLevelMirrors(classLevels);
  if (mirrors.level !== character.level) {
    throw new Error(`Character ${character.id} field classLevels violates progression: class levels total ${mirrors.level} but the character level mirror is ${character.level}.`);
  }
  if (mirrors.classId !== character.classId || mirrors.subclassId !== (character.subclassId || undefined)) {
    throw new Error(`Character ${character.id} field classLevels violates progression: the primary-class mirror does not match classId/subclassId.`);
  }
}

/** Multiclass characters validate feature state against the aggregated patch. */
function validateMulticlassProgression(character: Character, registry?: RulesContentRegistry): void {
  validateClassLevels(character);
  if (character.progressionState) {
    const expected = progressionPatchForCharacter(character, registry).progressionState!;
    const state = character.progressionState;
    if (state.ruleset !== character.ruleset || state.appliedThroughLevel !== character.level) {
      throw new Error(`Character ${character.id} level ${character.level} field progressionState violates progression identity or level.`);
    }
    if (state.featureIds.length !== expected.featureIds.length || state.featureIds.some((id, index) => id !== expected.featureIds[index])) {
      throw new Error(`Character ${character.id} level ${character.level} field progressionState.featureIds violates the expected feature set.`);
    }
  }
  for (const spellId of [...character.spellsKnown, ...(character.preparedSpells ?? []), ...(character.alwaysPreparedSpells ?? []), ...(character.spellbookSpells ?? [])]) {
    if (!SPELLS.has(spellId)) throw new Error(`Character ${character.id} level ${character.level} field spells violates progression: spell "${spellId}" is invalid.`);
  }
}

function validateCharacterProgressionUnchecked(character: Character, requireComplete: boolean, choicesFromLevel = 0, registry?: RulesContentRegistry): void {
  const normalizedSubclassId = character.subclassId || undefined;
  if ((character.classLevels?.length ?? 0) > 1) {
    validateMulticlassProgression(character, registry);
    return;
  }
  // A single-entry classLevels array must still agree with its mirrors before
  // the ordinary single-class validation runs against those mirrors.
  if ((character.classLevels?.length ?? 0) === 1) validateClassLevels(character);
  const classPacket = progressionCatalog.classes.get(`${character.ruleset}:${character.classId}`);
  if (!classPacket && isHomebrewClass(character)) {
    if (!character.customClassName?.trim()) {
      throw new Error(`Character ${character.id} is missing its homebrew class name.`);
    }
    if (normalizedSubclassId) {
      throw new Error(`Character ${character.id} cannot use catalog subclass "${normalizedSubclassId}" with a homebrew class.`);
    }
    if (character.progressionState) {
      throw new Error(`Character ${character.id} cannot use catalog progression state with a homebrew class.`);
    }
    for (const spellId of [...character.spellsKnown, ...(character.preparedSpells ?? []), ...(character.alwaysPreparedSpells ?? []), ...(character.spellbookSpells ?? [])]) {
      if (!SPELLS.has(spellId)) throw new Error(`Character ${character.id} level ${character.level} field spells violates progression: spell "${spellId}" is invalid.`);
    }
    return;
  }
  if (!classPacket) throw new Error(`Character ${character.id} level ${character.level} field classId violates progression: class "${character.classId}" is invalid for ${character.ruleset}.`);
  if (normalizedSubclassId) {
    const subclass = progressionCatalog.subclasses.get(`${character.ruleset}:${normalizedSubclassId}`);
    if (!subclass) throw new Error(`Character ${character.id} level ${character.level} field subclassId violates progression: subclass "${normalizedSubclassId}" is unavailable for ${character.ruleset}.`);
    if (subclass.classId !== character.classId) throw new Error(`Character ${character.id} level ${character.level} field subclassId violates progression: ${character.subclassId} belongs to ${subclass.classId}.`);
    if (character.level < subclass.selectionLevel) throw new Error(`Character ${character.id} level ${character.level} field subclassId violates progression: ${character.subclassId} requires level ${subclass.selectionLevel}.`);
  }

  const plan = buildLevelUpPlan({
    ruleset: character.ruleset,
    classId: character.classId,
    subclassId: normalizedSubclassId,
    fromLevel: 0,
    toLevel: character.level,
    featureChoices: character.featureChoices,
    registry,
  });
  if (requireComplete && character.raceId === "high-elf-legacy") {
    const hasWizardCantrip = [...character.spellsKnown, ...(character.spellbookSpells ?? [])].some((id) => {
      const spell = SPELLS.get(id);
      return spell?.level === 0 && spell.classes.includes("wizard");
    });
    if (!hasWizardCantrip) {
      throw new Error(`Character ${character.id} level ${character.level} field spellsKnown violates high-elf-legacy: a wizard cantrip is required.`);
    }
  }
  if (requireComplete) {
    const knownSpellIds = new Set([...character.spellsKnown, ...(character.spellbookSpells ?? [])]);
    const knownCantripIds = [...knownSpellIds].filter((id) => SPELLS.get(id)?.level === 0);
    const classCantripCount = knownCantripIds.filter((id) => SPELLS.get(id)?.classes.includes(character.classId)).length;
    const expectedClassCantrips = cantripsKnownAt(character.classId, character.level);
    if (classCantripCount < expectedClassCantrips) {
      throw new Error(`Character ${character.id} level ${character.level} field spellsKnown violates cantrips-known: ${expectedClassCantrips} ${character.classId} cantrips are required.`);
    }
    const bonusCantripChoices = plan.choices
      .filter((choice) => choice.choiceId.includes("cantrip") && !/^choose-\d+-cantrips?$/.test(choice.choiceId))
      .reduce((total, choice) => total + (choice.count ?? Number(choice.choiceId.match(/choose-(\d+)/)?.[1] ?? 1)), 0);
    const expectedTotalCantrips = expectedClassCantrips + bonusCantripChoices + (character.raceId === "high-elf-legacy" ? 1 : 0);
    if (knownCantripIds.length < expectedTotalCantrips) {
      throw new Error(`Character ${character.id} level ${character.level} field spellsKnown violates cantrips-known: ${expectedTotalCantrips} total cantrips are required.`);
    }
  }
  for (const spellId of [...character.spellsKnown, ...(character.preparedSpells ?? []), ...(character.alwaysPreparedSpells ?? []), ...(character.spellbookSpells ?? [])]) {
    if (!SPELLS.has(spellId)) throw new Error(`Character ${character.id} level ${character.level} field spells violates progression: spell "${spellId}" is invalid.`);
  }
  if (requireComplete) {
    const cumulativeCounts = new Map<string, number>();
    for (const choice of plan.choices) cumulativeCounts.set(choice.choiceId, (cumulativeCounts.get(choice.choiceId) ?? 0) + requiredCount(choice));
    plan.choices.filter((choice) => choice.level > choicesFromLevel).forEach((choice) => validateChoice(character, choice, cumulativeCounts.get(choice.choiceId)));
  }

  if (character.progressionState) {
    const expected = progressionPatchForCharacter(character, registry).progressionState!;
    const state = character.progressionState;
    if (state.ruleset !== character.ruleset || state.classId !== character.classId || state.subclassId !== normalizedSubclassId || state.appliedThroughLevel !== character.level) {
      throw new Error(`Character ${character.id} level ${character.level} field progressionState violates progression identity or level.`);
    }
    if (state.featureIds.length !== expected.featureIds.length || state.featureIds.some((id, index) => id !== expected.featureIds[index])) {
      throw new Error(`Character ${character.id} level ${character.level} field progressionState.featureIds violates the expected feature set.`);
    }
  } else if (requireComplete) {
    throw new Error(`Character ${character.id} level ${character.level} field progressionState is required for a progression-aware level change.`);
  }

  if (character.featureResources) {
    const expected = progressionPatchForCharacter(character, registry).featureResources ?? {};
    for (const [resourceId, resource] of Object.entries(character.featureResources)) {
      const expectedResource = expected[resourceId];
      if (!expectedResource) throw new Error(`Character ${character.id} level ${character.level} field featureResources.${resourceId} is not granted by progression.`);
      if (resource.maximum !== undefined && resource.maximum !== expectedResource.maximum) {
        throw new Error(`Character ${character.id} level ${character.level} field featureResources.${resourceId}.maximum violates the expected maximum.`);
      }
    }
  }
}

/** Progression mismatches are client input errors, not database outages. */
export function validateCharacterProgression(character: Character, requireComplete: boolean, choicesFromLevel = 0, registry?: RulesContentRegistry): void {
  try {
    validateCharacterProgressionUnchecked(character, requireComplete, choicesFromLevel, registry);
  } catch (error) {
    if (error instanceof CharacterValidationError) throw error;
    throw new CharacterValidationError(error instanceof Error ? error.message : "Invalid character progression.");
  }
}
