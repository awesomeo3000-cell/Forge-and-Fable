import { buildLevelUpPlan } from "@/lib/progression/engine";
import type { LevelUpPlan } from "@/lib/progression/types";
import type { Character, CharacterPatch, FeatureResourceState } from "@/types/game";

function abilityModifier(score: number | undefined) {
  return Math.floor(((score ?? 10) - 10) / 2);
}

function resolveMaximum(maximum: string | number | undefined, character: Pick<Character, "level"> & { abilities?: Character["abilities"] }) {
  if (typeof maximum !== "string") return maximum;
  const compact = maximum.replace(/\s+/g, "").toLowerCase();
  const levelFormula = compact.match(/(?:[a-z]+)?level\*(\d+)/);
  if (levelFormula) return character.level * Number(levelFormula[1]);

  const abilityFormula = compact.match(/(strength|dexterity|constitution|intelligence|wisdom|charisma)(?:modifier|-modifier)/);
  if (abilityFormula) {
    const ability = abilityFormula[1] as keyof Character["abilities"];
    const base = abilityModifier(character.abilities?.[ability]);
    const leading = compact.match(/^(\d+)\+/);
    const value = base + (leading ? Number(leading[1]) : 0);
    return compact.includes("min1") || compact.includes("minimum1") ? Math.max(1, value) : Math.max(0, value);
  }
  return maximum;
}

function latestResources(
  plan: LevelUpPlan,
  character: Pick<Character, "level"> & { abilities?: Character["abilities"] },
  existing: Record<string, FeatureResourceState> = {},
): Record<string, FeatureResourceState> {
  const resources: Record<string, FeatureResourceState> = {};
  for (const change of plan.resourceChanges) {
    const previous = resources[change.resourceId] ?? existing[change.resourceId] ?? {};
    const maximum = resolveMaximum(change.maximum ?? previous.maximum, character);
    const consumable = Boolean(change.recharge || change.consumedBy || /(?:uses|points|dice|charges|free-casts|free-use)$/.test(change.resourceId));
    resources[change.resourceId] = {
      ...previous,
      ...(maximum !== undefined ? { maximum } : {}),
      ...(typeof maximum === "number" && (consumable || previous.current !== undefined) ? { current: Math.min(previous.current ?? maximum, maximum) } : {}),
      ...(change.recharge ? { recharge: change.recharge } : {}),
      ...(change.die ? { die: change.die } : {}),
      sourceFeatureId: change.sourcePacketId,
    };
  }
  return resources;
}

function automaticSpells(plan: LevelUpPlan): string[] {
  return Array.from(new Set(plan.spellChanges
    .filter((change) => change.kind.startsWith("always-prepared"))
    .flatMap((change) => change.spells ?? (change.spell ? [change.spell] : []))));
}

function expandedSpellLists(plan: LevelUpPlan): Record<string, string[]> {
  return Object.fromEntries(plan.spellChanges
    .filter((change) => change.kind.includes("expanded-list"))
    .map((change) => [change.sourcePacketId, change.spells ?? (change.spell ? [change.spell] : [])])
    .filter(([, spells]) => spells.length > 0));
}

export function progressionPatchForCharacter(character: Pick<Character, "ruleset" | "classId" | "subclassId" | "level" | "featureChoices" | "featureResources" | "progressionState"> & { abilities?: Character["abilities"] }): CharacterPatch {
  const plan = buildLevelUpPlan({
    ruleset: character.ruleset,
    classId: character.classId,
    subclassId: character.subclassId,
    fromLevel: 0,
    toLevel: character.level,
    featureChoices: character.featureChoices,
  });
  return {
    featureResources: latestResources(plan, character, character.featureResources),
    alwaysPreparedSpells: automaticSpells(plan),
    expandedSpellLists: expandedSpellLists(plan),
    progressionState: {
      ruleset: character.ruleset,
      classId: character.classId,
      subclassId: character.subclassId,
      appliedThroughLevel: character.level,
      featureIds: plan.automaticFeatures.map((feature) => feature.featureId),
      featureGrants: plan.automaticFeatures.map(({ featureId, level, source, sourcePacketId }) => ({ featureId, level, source, sourcePacketId })),
      warnings: plan.automaticFeatures
        .filter((feature) => (feature.parentInteractions?.length ?? 0) > 0)
        .map((feature) => `${feature.featureId}: rules text is tracked; some combat interactions remain manual.`),
      choiceHistory: character.progressionState?.choiceHistory ?? [],
      spellHistory: character.progressionState?.spellHistory ?? [],
    },
  };
}
