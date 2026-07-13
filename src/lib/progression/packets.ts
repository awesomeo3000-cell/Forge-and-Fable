import artificer2014 from "../../../rules-research/2014/classes/artificer.json";
import barbarian2014 from "../../../rules-research/2014/classes/barbarian.json";
import bard2014 from "../../../rules-research/2014/classes/bard.json";
import cleric2014 from "../../../rules-research/2014/classes/cleric.json";
import druid2014 from "../../../rules-research/2014/classes/druid.json";
import fighter2014 from "../../../rules-research/2014/classes/fighter.json";
import monk2014 from "../../../rules-research/2014/classes/monk.json";
import paladin2014 from "../../../rules-research/2014/classes/paladin.json";
import ranger2014 from "../../../rules-research/2014/classes/ranger.json";
import rogue2014 from "../../../rules-research/2014/classes/rogue.json";
import sorcerer2014 from "../../../rules-research/2014/classes/sorcerer.json";
import warlock2014 from "../../../rules-research/2014/classes/warlock.json";
import wizard2014 from "../../../rules-research/2014/classes/wizard.json";
import barbarian2024 from "../../../rules-research/2024/classes/barbarian.json";
import bard2024 from "../../../rules-research/2024/classes/bard.json";
import cleric2024 from "../../../rules-research/2024/classes/cleric.json";
import druid2024 from "../../../rules-research/2024/classes/druid.json";
import fighter2024 from "../../../rules-research/2024/classes/fighter.json";
import monk2024 from "../../../rules-research/2024/classes/monk.json";
import paladin2024 from "../../../rules-research/2024/classes/paladin.json";
import ranger2024 from "../../../rules-research/2024/classes/ranger.json";
import rogue2024 from "../../../rules-research/2024/classes/rogue.json";
import sorcerer2024 from "../../../rules-research/2024/classes/sorcerer.json";
import warlock2024 from "../../../rules-research/2024/classes/warlock.json";
import wizard2024 from "../../../rules-research/2024/classes/wizard.json";
import subclass2014Basic from "../../../rules-research/subclasses/2014/basic-rules.json";
import subclass2014Remaining from "../../../rules-research/subclasses/2014/remaining.json";
import subclass2024Basic from "../../../rules-research/subclasses/2024/basic-rules.json";
import sourceLedger from "../../../rules-research/sources.json";
import legacySubclassCatalog from "@/data/subclasses.json";

import { isSupportedRuleset } from "@/lib/characterRuleset";
import type {
  ClassFeatureLevel,
  ClassProgressionPacket,
  FeatureScaling,
  ProgressionCatalog,
  ProgressionChoice,
  ProgressionPacket,
  ProgressionRulesetId,
  ResourceChange,
  SpellChange,
  SpellcastingProgression,
  SubclassFeatureLevel,
  SubclassProgressionPacket,
} from "@/lib/progression/types";
import type { AbilityKey } from "@/types/game";

const CLASS_PACKETS: unknown[] = [
  artificer2014, barbarian2014, bard2014, cleric2014, druid2014, fighter2014, monk2014,
  paladin2014, ranger2014, rogue2014, sorcerer2014, warlock2014, wizard2014,
  barbarian2024, bard2024, cleric2024, druid2024, fighter2024, monk2024, paladin2024,
  ranger2024, rogue2024, sorcerer2024, warlock2024, wizard2024,
];

const SUBCLASS_COLLECTIONS: unknown[] = [subclass2014Basic, subclass2014Remaining, subclass2024Basic];
const RULESET_IDS = new Set<ProgressionRulesetId>(["2014", "2024"]);
const ABILITY_IDS = new Set<AbilityKey>(["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"]);

const SUBCLASS_ID_ALIASES: Record<string, string> = {
  "path-of-the-berserker": "berserker",
  "way-of-shadow": "way-of-the-shadow",
  archfey: "the-archfey",
  fiend: "the-fiend",
  "great-old-one": "the-great-old-one",
  "warrior-of-the-open-hand": "way-of-the-open-hand",
  "draconic-sorcery": "draconic-bloodline",
  evoker: "school-of-evocation",
};

type LegacySubclassCatalog = Array<{
  id: string;
  subclassLevel: number;
  subclasses: Array<{
    id: string;
    name: string;
    features: Array<{ level: number; name: string }>;
  }>;
}>;

function featureId(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

const LEGACY_SUBCLASS_PACKETS = new Map<string, SubclassProgressionPacket>(
  (legacySubclassCatalog as LegacySubclassCatalog).flatMap((classEntry) => classEntry.subclasses.map((subclass) => {
    const featuresByLevel = new Map<number, string[]>();
    for (const feature of subclass.features) {
      const existing = featuresByLevel.get(feature.level) ?? [];
      const id = featureId(feature.name);
      if (id && !existing.includes(id)) existing.push(id);
      featuresByLevel.set(feature.level, existing);
    }
    const packet: SubclassProgressionPacket = {
      id: subclass.id,
      sourceSubclassId: `${subclass.id}-2014-legacy`,
      classId: classEntry.id,
      sourceClassId: `${classEntry.id}-2014`,
      ruleset: "2014",
      name: subclass.name,
      sourceId: "legacy-subclass-catalog",
      selectionLevel: classEntry.subclassLevel,
      featureLevels: Array.from(featuresByLevel.entries()).sort(([a], [b]) => a - b).map(([level, automaticFeatures]) => ({
        level,
        automaticFeatures,
        choices: [],
        resourceChanges: [],
        spellChanges: [],
        scaling: [],
        parentInteractions: ["legacy-subclass-catalog"],
        sourceReferences: [],
      })),
    };
    return [subclass.id, packet] as const;
  })),
);

type SourceRecord = { id: string; ruleset: ProgressionRulesetId };
type LoaderInput = { classPackets: unknown[]; subclassCollections: unknown[]; sources: unknown[] };

function fail(path: string, message: string): never {
  throw new Error(`Invalid progression packet at ${path}: ${message}`);
}

function objectAt(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) fail(path, "expected an object");
  return value as Record<string, unknown>;
}

function stringAt(value: unknown, path: string): string {
  if (typeof value !== "string" || value.length === 0) fail(path, "expected a non-empty string");
  return value;
}

function numberAt(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) fail(path, "expected a finite number");
  return value;
}

function rulesetAt(value: unknown, path: string): ProgressionRulesetId {
  const ruleset = stringAt(value, path) as ProgressionRulesetId;
  if (!RULESET_IDS.has(ruleset)) fail(path, `unsupported ruleset "${ruleset}"`);
  return ruleset;
}

function stringsAt(value: unknown, path: string): string[] {
  if (!Array.isArray(value)) fail(path, "expected an array");
  return value.map((item, index) => stringAt(item, `${path}[${index}]`));
}

function objectsAt(value: unknown, path: string): Record<string, unknown>[] {
  if (!Array.isArray(value)) fail(path, "expected an array");
  return value.map((item, index) => objectAt(item, `${path}[${index}]`));
}

function stripEditionSuffix(id: string, ruleset: ProgressionRulesetId, path: string): string {
  const suffix = `-${ruleset}`;
  if (!id.endsWith(suffix)) fail(path, `ID "${id}" is not scoped to ruleset ${ruleset}`);
  return id.slice(0, -suffix.length);
}

function catalogKey(ruleset: ProgressionRulesetId, id: string): string {
  return `${ruleset}:${id}`;
}

function validateSource(sourceId: string, ruleset: ProgressionRulesetId, sources: Map<string, SourceRecord>, path: string): void {
  const source = sources.get(sourceId);
  if (!source) fail(path, `references missing source "${sourceId}"`);
  if (source.ruleset !== ruleset) fail(path, `source "${sourceId}" belongs to ruleset ${source.ruleset}, not ${ruleset}`);
}

function normalizeResource(value: Record<string, unknown>, path: string): ResourceChange {
  return { ...value, resourceId: stringAt(value.resourceId, `${path}.resourceId`) } as ResourceChange;
}

function normalizeChoice(value: Record<string, unknown>, path: string): ProgressionChoice {
  return { ...value, choiceId: stringAt(value.choiceId, `${path}.choiceId`) } as ProgressionChoice;
}

function normalizeSpellChange(value: Record<string, unknown>, path: string): SpellChange {
  return { ...value, kind: stringAt(value.kind, `${path}.kind`) } as SpellChange;
}

function normalizeClassPacket(raw: unknown, sources: Map<string, SourceRecord>, index: number): ClassProgressionPacket {
  const path = `classes[${index}]`;
  const value = objectAt(raw, path);
  const ruleset = rulesetAt(value.ruleset, `${path}.ruleset`);
  const sourceClassId = stringAt(value.id, `${path}.id`);
  const id = stripEditionSuffix(sourceClassId, ruleset, `${path}.id`);
  const sourceId = stringAt(value.sourceId, `${path}.sourceId`);
  validateSource(sourceId, ruleset, sources, `${path}.sourceId`);

  const rawLevels = objectAt(value.levels, `${path}.levels`);
  const levels = {} as Record<number, ClassFeatureLevel>;
  for (let level = 1; level <= 20; level += 1) {
    const levelPath = `${path}.levels.${level}`;
    const entry = objectAt(rawLevels[String(level)], levelPath);
    if (numberAt(entry.level, `${levelPath}.level`) !== level) fail(`${levelPath}.level`, `expected ${level}`);
    const sourceReferences = stringsAt(entry.sourceReferences, `${levelPath}.sourceReferences`);
    sourceReferences.forEach((reference, refIndex) => validateSource(reference, ruleset, sources, `${levelPath}.sourceReferences[${refIndex}]`));
    levels[level] = {
      level,
      proficiencyBonus: numberAt(entry.proficiencyBonus, `${levelPath}.proficiencyBonus`),
      automaticFeatures: stringsAt(entry.automaticFeatures, `${levelPath}.automaticFeatures`),
      choices: stringsAt(entry.choices, `${levelPath}.choices`),
      resourceChanges: objectsAt(entry.resourceChanges, `${levelPath}.resourceChanges`).map((item, itemIndex) => normalizeResource(item, `${levelPath}.resourceChanges[${itemIndex}]`)),
      sourceReferences,
    };
  }
  const extraLevels = Object.keys(rawLevels).filter((key) => !/^(?:[1-9]|1\d|20)$/.test(key));
  if (extraLevels.length > 0) fail(`${path}.levels`, `contains unsupported levels: ${extraLevels.join(", ")}`);

  const abilities = (field: string): AbilityKey[] => stringsAt(value[field], `${path}.${field}`).map((ability, abilityIndex) => {
    if (!ABILITY_IDS.has(ability as AbilityKey)) fail(`${path}.${field}[${abilityIndex}]`, `unsupported ability "${ability}"`);
    return ability as AbilityKey;
  });
  const skills = objectAt(value.skillProficiencies, `${path}.skillProficiencies`);
  let spellcasting: SpellcastingProgression | undefined;
  if (value.spellcasting !== undefined) {
    const spell = objectAt(value.spellcasting, `${path}.spellcasting`);
    const ability = stringAt(spell.ability, `${path}.spellcasting.ability`) as AbilityKey;
    if (!ABILITY_IDS.has(ability)) fail(`${path}.spellcasting.ability`, `unsupported ability "${ability}"`);
    spellcasting = { ...spell, type: stringAt(spell.type, `${path}.spellcasting.type`), ability } as SpellcastingProgression;
  }

  return {
    id, sourceClassId, ruleset,
    name: stringAt(value.name, `${path}.name`),
    sourceId,
    researchStatus: stringAt(value.researchStatus, `${path}.researchStatus`),
    hitDie: numberAt(value.hitDie, `${path}.hitDie`),
    primaryAbilities: abilities("primaryAbilities"),
    savingThrowProficiencies: abilities("savingThrowProficiencies"),
    armorTraining: stringsAt(value.armorTraining, `${path}.armorTraining`),
    weaponProficiencies: stringsAt(value.weaponProficiencies, `${path}.weaponProficiencies`),
    toolProficiencies: value.toolProficiencies === undefined
      ? []
      : Array.isArray(value.toolProficiencies)
        ? stringsAt(value.toolProficiencies, `${path}.toolProficiencies`)
        : (() => {
            const tools = objectAt(value.toolProficiencies, `${path}.toolProficiencies`);
            return { count: numberAt(tools.count, `${path}.toolProficiencies.count`), options: stringsAt(tools.options, `${path}.toolProficiencies.options`) };
          })(),
    skillProficiencies: { count: numberAt(skills.count, `${path}.skillProficiencies.count`), options: stringsAt(skills.options, `${path}.skillProficiencies.options`) },
    spellcasting,
    levels,
  };
}

function normalizeSubclassFeature(raw: unknown, ruleset: ProgressionRulesetId, sources: Map<string, SourceRecord>, path: string): SubclassFeatureLevel {
  const value = objectAt(raw, path);
  const sourceReferences = stringsAt(value.sourceReferences, `${path}.sourceReferences`);
  sourceReferences.forEach((reference, index) => validateSource(reference, ruleset, sources, `${path}.sourceReferences[${index}]`));
  return {
    level: numberAt(value.level, `${path}.level`),
    automaticFeatures: stringsAt(value.automaticFeatures, `${path}.automaticFeatures`),
    choices: objectsAt(value.choices, `${path}.choices`).map((item, index) => normalizeChoice(item, `${path}.choices[${index}]`)),
    resourceChanges: objectsAt(value.resourceChanges, `${path}.resourceChanges`).map((item, index) => normalizeResource(item, `${path}.resourceChanges[${index}]`)),
    spellChanges: value.spellChanges === undefined ? [] : objectsAt(value.spellChanges, `${path}.spellChanges`).map((item, index) => normalizeSpellChange(item, `${path}.spellChanges[${index}]`)),
    scaling: value.scaling === undefined ? [] : objectsAt(value.scaling, `${path}.scaling`) as FeatureScaling[],
    parentInteractions: value.parentInteractions === undefined ? [] : stringsAt(value.parentInteractions, `${path}.parentInteractions`),
    sourceReferences,
  };
}

export function loadProgressionCatalog(input: LoaderInput): ProgressionCatalog {
  const sources = new Map<string, SourceRecord>();
  input.sources.forEach((raw, index) => {
    const value = objectAt(raw, `sources[${index}]`);
    const id = stringAt(value.id, `sources[${index}].id`);
    if (sources.has(id)) fail(`sources[${index}].id`, `duplicate source "${id}"`);
    sources.set(id, { id, ruleset: rulesetAt(value.ruleset, `sources[${index}].ruleset`) });
  });

  const classes = new Map<string, ClassProgressionPacket>();
  input.classPackets.forEach((raw, index) => {
    const packet = normalizeClassPacket(raw, sources, index);
    const key = catalogKey(packet.ruleset, packet.id);
    if (classes.has(key)) fail(`classes[${index}].id`, `duplicate class "${packet.sourceClassId}"`);
    classes.set(key, packet);
  });

  const subclasses = new Map<string, SubclassProgressionPacket>();
  input.subclassCollections.forEach((rawCollection, collectionIndex) => {
    const collectionPath = `subclassCollections[${collectionIndex}]`;
    const collection = objectAt(rawCollection, collectionPath);
    const ruleset = rulesetAt(collection.ruleset, `${collectionPath}.ruleset`);
    const sourceId = stringAt(collection.sourceId, `${collectionPath}.sourceId`);
    validateSource(sourceId, ruleset, sources, `${collectionPath}.sourceId`);
    objectsAt(collection.records, `${collectionPath}.records`).forEach((value, recordIndex) => {
      const path = `${collectionPath}.records[${recordIndex}]`;
      const sourceSubclassId = stringAt(value.id, `${path}.id`);
      const unscopedSubclassId = stripEditionSuffix(sourceSubclassId, ruleset, `${path}.id`);
      const id = SUBCLASS_ID_ALIASES[unscopedSubclassId] ?? unscopedSubclassId;
      const sourceClassId = stringAt(value.classId, `${path}.classId`);
      const classId = stripEditionSuffix(sourceClassId, ruleset, `${path}.classId`);
      if (!classes.has(catalogKey(ruleset, classId))) fail(`${path}.classId`, `references missing class "${sourceClassId}"`);
      const recordSourceId = value.sourceId === undefined ? sourceId : stringAt(value.sourceId, `${path}.sourceId`);
      validateSource(recordSourceId, ruleset, sources, `${path}.sourceId`);
      const featureLevels = objectsAt(value.featureLevels, `${path}.featureLevels`).map((feature, featureIndex) => normalizeSubclassFeature(feature, ruleset, sources, `${path}.featureLevels[${featureIndex}]`));
      if (featureLevels.length === 0) fail(`${path}.featureLevels`, "expected at least one feature level");
      const selectionLevel = numberAt(value.selectionLevel, `${path}.selectionLevel`);
      if (!featureLevels.some((feature) => feature.level === selectionLevel)) fail(`${path}.selectionLevel`, `no feature exists at selection level ${selectionLevel}`);
      const packet: SubclassProgressionPacket = {
        id, sourceSubclassId, classId, sourceClassId, ruleset,
        name: stringAt(value.name, `${path}.name`),
        sourceId: recordSourceId,
        selectionLevel,
        reprintRelationship: value.reprintRelationship === undefined ? undefined : stringAt(value.reprintRelationship, `${path}.reprintRelationship`),
        featureLevels,
      };
      const key = catalogKey(ruleset, id);
      if (subclasses.has(key)) fail(`${path}.id`, `duplicate normalized subclass ID "${id}" for ruleset ${ruleset}`);
      subclasses.set(key, packet);
    });
  });
  return { classes, subclasses };
}

const reviewedProgressionCatalog = loadProgressionCatalog({
  classPackets: CLASS_PACKETS,
  subclassCollections: SUBCLASS_COLLECTIONS,
  sources: sourceLedger,
});

const productionSubclassPackets = new Map(reviewedProgressionCatalog.subclasses);
for (const [subclassId, packet] of LEGACY_SUBCLASS_PACKETS) {
  const key = catalogKey("2014", subclassId);
  if (!productionSubclassPackets.has(key)) productionSubclassPackets.set(key, packet);
}

export const progressionCatalog: ProgressionCatalog = {
  classes: reviewedProgressionCatalog.classes,
  subclasses: productionSubclassPackets,
};

export function getProgressionPacket(ruleset: ProgressionRulesetId, classId: string, subclassId?: string): ProgressionPacket {
  if (!isSupportedRuleset(ruleset)) {
    throw new Error(`Ruleset "${ruleset}" is research-only and is not enabled for production progression.`);
  }
  const classPacket = progressionCatalog.classes.get(catalogKey(ruleset, classId));
  if (!classPacket) throw new Error(`No ${ruleset} progression packet exists for class "${classId}".`);
  if (!subclassId) return { ruleset, classId, class: classPacket };
  const subclassPacket = progressionCatalog.subclasses.get(catalogKey(ruleset, subclassId))
    ?? (ruleset === "2014" ? LEGACY_SUBCLASS_PACKETS.get(subclassId) : undefined);
  if (!subclassPacket) throw new Error(`No ${ruleset} progression packet exists for subclass "${subclassId}".`);
  if (subclassPacket.classId !== classId) {
    throw new Error(`Subclass "${subclassId}" belongs to class "${subclassPacket.classId}", not "${classId}" in ruleset ${ruleset}.`);
  }
  return { ruleset, classId, subclassId, class: classPacket, subclass: subclassPacket };
}
