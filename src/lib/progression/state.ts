import { buildLevelUpPlan } from "@/lib/progression/engine";
import type { LevelUpPlan } from "@/lib/progression/types";
import { isHomebrewClass } from "@/lib/homebrewIdentity";
import { getClassLevels, isMulticlass } from "@/lib/multiclass";
import type { Character, CharacterPatch, FeatureResourceState } from "@/types/game";
import type { RulesContentRegistry } from "@/types/homebrew";

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

type ProgressionCharacter = Pick<Character, "ruleset" | "classId" | "subclassId" | "level" | "featureChoices" | "featureResources" | "progressionState"> & { abilities?: Character["abilities"]; classLevels?: Character["classLevels"] };

export function progressionPatchForCharacter(character: ProgressionCharacter, registry?: RulesContentRegistry): CharacterPatch {
  // Manual homebrew classes intentionally have no catalog progression packet, so
  // there is no plan to build. Return an empty patch (never a progressionState —
  // validateCharacterProgression rejects catalog progression on a homebrew class).
  if (isHomebrewClass(character)) return {};

  // Multiclass: aggregate one per-class plan per class level entry (proposal
  // §8.1). The single-class path below is byte-identical to the pre-Phase-5
  // output, so existing characters and their stored progressionState never
  // change shape.
  if (isMulticlass(character)) return multiclassProgressionPatch(character, registry);

  const plan = buildLevelUpPlan({
    ruleset: character.ruleset,
    classId: character.classId,
    subclassId: character.subclassId,
    fromLevel: 0,
    toLevel: character.level,
    featureChoices: character.featureChoices,
    registry,
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

/**
 * Multiclass aggregation: build one plan per class at that class's own level.
 * Resource maximum formulas that read "level" resolve against the granting
 * class's level (Lay on Hands scales with paladin levels, not total level).
 * Resource-id collisions keep the first-acquired class's grant.
 */
function multiclassProgressionPatch(character: ProgressionCharacter, registry?: RulesContentRegistry): CharacterPatch {
  const entries = getClassLevels(character);
  const featureResources: Record<string, FeatureResourceState> = {};
  const always = new Set<string>();
  const expanded: Record<string, string[]> = {};
  const featureGrants: Array<{ featureId: string; level: number; source: "class" | "subclass"; sourcePacketId: string }> = [];
  const warnings: string[] = [];
  const stateClasses: NonNullable<Character["progressionState"]>["classes"] = [];

  for (const entry of entries) {
    if (entry.classRef.source !== "builtin") {
      throw new Error("Homebrew classes cannot enter automated progression until Phase 6.");
    }
    const classId = entry.classRef.id;
    const subclassId = entry.subclassRef?.source === "builtin" ? entry.subclassRef.id : undefined;
    const plan = buildLevelUpPlan({
      ruleset: character.ruleset,
      classId,
      subclassId,
      fromLevel: 0,
      toLevel: entry.level,
      featureChoices: character.featureChoices,
      registry,
    });
    const classView = { level: entry.level, abilities: character.abilities };
    const resources = latestResources(plan, classView, character.featureResources);
    for (const [resourceId, resource] of Object.entries(resources)) {
      if (!(resourceId in featureResources)) featureResources[resourceId] = resource;
    }
    for (const spell of automaticSpells(plan)) always.add(spell);
    Object.assign(expanded, expandedSpellLists(plan));
    for (const { featureId, level, source, sourcePacketId } of plan.automaticFeatures) {
      featureGrants.push({ featureId, level, source, sourcePacketId });
    }
    warnings.push(...plan.automaticFeatures
      .filter((feature) => (feature.parentInteractions?.length ?? 0) > 0)
      .map((feature) => `${feature.featureId}: rules text is tracked; some combat interactions remain manual.`));
    stateClasses.push({ classId, ...(subclassId ? { subclassId } : {}), level: entry.level });
  }

  return {
    featureResources,
    alwaysPreparedSpells: [...always],
    expandedSpellLists: expanded,
    progressionState: {
      ruleset: character.ruleset,
      classId: character.classId,
      subclassId: character.subclassId,
      appliedThroughLevel: character.level,
      featureIds: featureGrants.map((grant) => grant.featureId),
      featureGrants,
      classes: stateClasses,
      warnings,
      choiceHistory: character.progressionState?.choiceHistory ?? [],
      spellHistory: character.progressionState?.spellHistory ?? [],
    },
  };
}
