import { buildLevelUpPlan } from "@/lib/progression/engine";
import { progressionCatalog } from "@/lib/progression/packets";
import { progressionPatchForCharacter } from "@/lib/progression/state";
import type { LevelUpChoice } from "@/lib/progression/types";
import type { Character, FeatureChoiceValue } from "@/types/game";
import rawSpells from "@/data/spells.json";
import { progressionChoiceOptions } from "@/lib/progression/choiceOptions";

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

export function validateCharacterProgression(character: Character, requireComplete: boolean, choicesFromLevel = 0): void {
  const normalizedSubclassId = character.subclassId || undefined;
  const classPacket = progressionCatalog.classes.get(`${character.ruleset}:${character.classId}`);
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
  });
  for (const spellId of [...character.spellsKnown, ...(character.preparedSpells ?? []), ...(character.alwaysPreparedSpells ?? []), ...(character.spellbookSpells ?? [])]) {
    if (!SPELLS.has(spellId)) throw new Error(`Character ${character.id} level ${character.level} field spells violates progression: spell "${spellId}" is invalid.`);
  }
  if (requireComplete) {
    const cumulativeCounts = new Map<string, number>();
    for (const choice of plan.choices) cumulativeCounts.set(choice.choiceId, (cumulativeCounts.get(choice.choiceId) ?? 0) + requiredCount(choice));
    plan.choices.filter((choice) => choice.level > choicesFromLevel).forEach((choice) => validateChoice(character, choice, cumulativeCounts.get(choice.choiceId)));
  }

  if (character.progressionState) {
    const expected = progressionPatchForCharacter(character).progressionState!;
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
    const expected = progressionPatchForCharacter(character).featureResources ?? {};
    for (const [resourceId, resource] of Object.entries(character.featureResources)) {
      const expectedResource = expected[resourceId];
      if (!expectedResource) throw new Error(`Character ${character.id} level ${character.level} field featureResources.${resourceId} is not granted by progression.`);
      if (resource.maximum !== undefined && resource.maximum !== expectedResource.maximum) {
        throw new Error(`Character ${character.id} level ${character.level} field featureResources.${resourceId}.maximum violates the expected maximum.`);
      }
    }
  }
}
