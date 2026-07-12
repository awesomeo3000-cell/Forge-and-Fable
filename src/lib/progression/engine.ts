import { isSupportedRuleset } from "@/lib/characterRuleset";
import { progressionCatalog } from "@/lib/progression/packets";
import type {
  ClassProgressionPacket,
  FeatureGrant,
  LevelUpChoice,
  LevelUpPlan,
  PlannedResourceChange,
  PlannedSpellChange,
  ProgressionRulesetId,
  SpellcastingProgression,
  SubclassProgressionPacket,
} from "@/lib/progression/types";
import type { FeatureChoiceValue } from "@/types/game";

export type BuildClassLevelUpPlanInput = {
  ruleset: ProgressionRulesetId;
  classId: string;
  fromLevel: number;
  toLevel: number;
  mode?: "production" | "research";
  subclassId?: string;
  featureChoices?: Record<string, FeatureChoiceValue>;
};

const SPELL_COUNT_TABLES = [
  ["cantrips-known", "cantripsKnownByLevel"],
  ["spells-known", "spellsKnownByLevel"],
  ["prepared-spells", "preparedSpellsByLevel"],
  ["spellbook-spells", "spellbookSpellsByLevel"],
  ["eldritch-invocations", "eldritchInvocationsByLevel"],
  ["pact-magic-slots", "pactMagicSlotsByLevel"],
  ["pact-magic-slot-level", "pactMagicSlotLevelByClassLevel"],
] as const satisfies ReadonlyArray<readonly [string, keyof SpellcastingProgression]>;

function catalogKey(ruleset: ProgressionRulesetId, id: string): string {
  return `${ruleset}:${id}`;
}

const SUBCLASS_PLACEHOLDER_FEATURES = new Set([
  "archetype-feature", "circle-feature", "college-feature", "domain-feature", "oath-feature",
  "origin-feature", "path-feature", "patron-feature", "subclass-feature", "tradition-feature",
]);

function resolveSubclassPacket(input: BuildClassLevelUpPlanInput, classPacket: ClassProgressionPacket): SubclassProgressionPacket | undefined {
  if (!input.subclassId) return undefined;
  const packet = progressionCatalog.subclasses.get(catalogKey(input.ruleset, input.subclassId));
  if (!packet) throw new Error(`No ${input.ruleset} progression packet exists for subclass "${input.subclassId}".`);
  if (packet.classId !== classPacket.id) {
    throw new Error(`Subclass "${input.subclassId}" belongs to class "${packet.classId}", not "${classPacket.id}" in ruleset ${input.ruleset}.`);
  }
  return packet;
}

function validateLevel(level: number, field: string, minimum: number): void {
  if (!Number.isInteger(level) || level < minimum || level > 20) {
    throw new Error(`${field} must be an integer from ${minimum} through 20; received ${level}.`);
  }
}

function resolveClassPacket(input: BuildClassLevelUpPlanInput): ClassProgressionPacket {
  if ((input.mode ?? "production") === "production" && !isSupportedRuleset(input.ruleset)) {
    throw new Error(`Ruleset "${input.ruleset}" is research-only and is not enabled for production progression.`);
  }
  const packet = progressionCatalog.classes.get(catalogKey(input.ruleset, input.classId));
  if (!packet) throw new Error(`No ${input.ruleset} progression packet exists for class "${input.classId}".`);
  return packet;
}

function valueAtLevel(values: number[] | undefined, level: number): number {
  return level === 0 ? 0 : values?.[level] ?? 0;
}

function slotsAtLevel(values: Record<string, number[]> | undefined, level: number): number[] {
  return level === 0 ? [] : [...(values?.[String(level)] ?? [])];
}

function arraysEqual(left: number[], right: number[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function spellChangesForRange(packet: ClassProgressionPacket, fromLevel: number, toLevel: number): PlannedSpellChange[] {
  const spellcasting = packet.spellcasting;
  if (!spellcasting || fromLevel === toLevel) return [];
  const changes: PlannedSpellChange[] = [];
  for (const [kind, field] of SPELL_COUNT_TABLES) {
    const values = spellcasting[field];
    if (!Array.isArray(values)) continue;
    const before = valueAtLevel(values, fromLevel);
    const after = valueAtLevel(values, toLevel);
    if (before !== after) {
      changes.push({ kind, before, after, count: after - before, level: toLevel, source: "class", sourcePacketId: packet.sourceClassId });
    }
  }

  const slotsBefore = slotsAtLevel(spellcasting.spellSlotsByLevel, fromLevel);
  const slotsAfter = slotsAtLevel(spellcasting.spellSlotsByLevel, toLevel);
  if (!arraysEqual(slotsBefore, slotsAfter)) {
    changes.push({ kind: "spell-slots", before: slotsBefore, after: slotsAfter, level: toLevel, source: "class", sourcePacketId: packet.sourceClassId });
  }
  if (fromLevel === 0 && spellcasting.preparedSpellsFormula) {
    changes.push({
      kind: "prepared-spells-formula",
      formula: spellcasting.preparedSpellsFormula,
      level: toLevel,
      source: "class",
      sourcePacketId: packet.sourceClassId,
    });
  }
  return changes;
}

function choiceStrings(value: FeatureChoiceValue | undefined): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  return [];
}

function spellsCrossingLevel(map: Record<string, string[]> | undefined, fromLevel: number, toLevel: number): string[] {
  if (!map) return [];
  return Object.entries(map)
    .filter(([level]) => Number(level) > fromLevel && Number(level) <= toLevel)
    .flatMap(([, spells]) => spells);
}

function subclassSpellChangesForRange(
  packet: SubclassProgressionPacket,
  fromLevel: number,
  toLevel: number,
  featureChoices: Record<string, FeatureChoiceValue>,
): PlannedSpellChange[] {
  const changes: PlannedSpellChange[] = [];
  for (const feature of packet.featureLevels) {
    for (const change of feature.spellChanges) {
      const base = { ...change, level: feature.level, source: "subclass" as const, sourcePacketId: packet.sourceSubclassId };
      if (feature.level > fromLevel && feature.level <= toLevel && !change.byChoice && !change.byClericLevel && !change.byPaladinLevel && !change.bySorcererLevel && !change.bySpellLevel && !change.byWarlockLevel) {
        changes.push(base);
      }
      const byLevel = change.byClericLevel ?? change.byPaladinLevel ?? change.bySorcererLevel ?? change.byWarlockLevel ?? change.bySpellLevel;
      const automaticSpells = spellsCrossingLevel(byLevel, fromLevel, toLevel);
      if (automaticSpells.length > 0) changes.push({ ...base, spells: automaticSpells, count: automaticSpells.length });
      if (change.byChoice && change.choiceId) {
        for (const selected of choiceStrings(featureChoices[change.choiceId])) {
          const spells = spellsCrossingLevel(change.byChoice[selected], fromLevel, toLevel);
          if (spells.length > 0) changes.push({ ...base, spells, count: spells.length });
        }
      }
    }
  }
  return changes;
}

export function buildLevelUpPlan(input: BuildClassLevelUpPlanInput): LevelUpPlan {
  validateLevel(input.fromLevel, "fromLevel", 0);
  validateLevel(input.toLevel, "toLevel", 1);
  if (input.toLevel < input.fromLevel) {
    throw new Error(`toLevel ${input.toLevel} cannot be lower than fromLevel ${input.fromLevel}.`);
  }
  const packet = resolveClassPacket(input);
  const subclassPacket = resolveSubclassPacket(input, packet);
  const automaticFeatures: FeatureGrant[] = [];
  const choices: LevelUpChoice[] = [];
  const resourceChanges: PlannedResourceChange[] = [];

  for (let level = input.fromLevel + 1; level <= input.toLevel; level += 1) {
    const progression = packet.levels[level];
    for (const featureId of progression.automaticFeatures) {
      if (subclassPacket && SUBCLASS_PLACEHOLDER_FEATURES.has(featureId)) continue;
      automaticFeatures.push({ featureId, level, source: "class", sourcePacketId: packet.sourceClassId });
    }
    for (const choiceId of progression.choices) {
      choices.push({ choiceId, level, source: "class", sourcePacketId: packet.sourceClassId });
    }
    for (const change of progression.resourceChanges) {
      resourceChanges.push({ ...change, level, source: "class", sourcePacketId: packet.sourceClassId });
    }
  }

  if (subclassPacket) {
    for (const feature of subclassPacket.featureLevels) {
      if (feature.level <= input.fromLevel || feature.level > input.toLevel) continue;
      for (const featureId of feature.automaticFeatures) {
        automaticFeatures.push({
          featureId,
          level: feature.level,
          source: "subclass",
          sourcePacketId: subclassPacket.sourceSubclassId,
          parentInteractions: feature.parentInteractions,
          scaling: feature.scaling,
        });
      }
      for (const choice of feature.choices) {
        choices.push({ ...choice, level: feature.level, source: "subclass", sourcePacketId: subclassPacket.sourceSubclassId });
      }
      for (const change of feature.resourceChanges) {
        resourceChanges.push({ ...change, level: feature.level, source: "subclass", sourcePacketId: subclassPacket.sourceSubclassId });
      }
    }
  }

  const beforeProficiency = input.fromLevel === 0 ? 0 : packet.levels[input.fromLevel].proficiencyBonus;
  const afterProficiency = packet.levels[input.toLevel].proficiencyBonus;
  const warnings: string[] = [];
  if (input.fromLevel === 0 && packet.spellcasting?.preparedSpellsFormula && !packet.spellcasting.preparedSpellsByLevel) {
    warnings.push(`Prepared spell capacity uses ${packet.spellcasting.preparedSpellsFormula}; character ability data is required to resolve the final maximum.`);
  }

  return {
    fromLevel: input.fromLevel,
    toLevel: input.toLevel,
    proficiencyBonus: { before: beforeProficiency, after: afterProficiency },
    automaticFeatures,
    choices,
    resourceChanges,
    spellChanges: [
      ...spellChangesForRange(packet, input.fromLevel, input.toLevel),
      ...(subclassPacket ? subclassSpellChangesForRange(subclassPacket, input.fromLevel, input.toLevel, input.featureChoices ?? {}) : []),
    ],
    warnings,
  };
}

export function buildClassLevelUpPlan(input: BuildClassLevelUpPlanInput): LevelUpPlan {
  return buildLevelUpPlan({ ...input, subclassId: undefined });
}
