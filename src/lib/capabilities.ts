import rawCapabilities from "@/data/actionCapabilities.json";
import { getFeat } from "@/lib/feats";
import { getSpell, isAttackRollSpell } from "@/lib/spells";
import type { Character, FeatureResourceState, SpellData } from "@/types/game";

export type CapabilityActivation =
  | "action"
  | "bonus-action"
  | "reaction"
  | "passive"
  | "triggered"
  | "rider"
  | "replacement"
  | "special"
  | "long-activation";

export type CapabilityLane = "actions" | "bonus-actions" | "reactions" | "passives";

type CatalogCapability = {
  id: string;
  name: string;
  sourceKind: "universal" | "class" | "subclass" | "feat";
  sourceId: string;
  subclassId?: string;
  minimumLevel: number;
  activation: CapabilityActivation;
  trigger?: string;
  resourceId?: string;
  resourceCostSummary?: string;
  rechargeSummary?: string;
  scalingSummary?: string;
  resolutionKind: string;
  summary: string;
};

export type CharacterCapability = CatalogCapability & {
  lane: CapabilityLane;
  sourceLabel: string;
  resource?: FeatureResourceState;
  spell?: SpellData;
};

const SUPPLEMENTAL_CAPABILITIES: CatalogCapability[] = [
  {
    id: "monk.martial-arts-bonus-strike", name: "Martial Arts: Bonus Strike", sourceKind: "class", sourceId: "monk", minimumLevel: 1,
    activation: "bonus-action", resolutionKind: "attack", summary: "After you use the Attack action with an unarmed strike or monk weapon, make one unarmed strike as a bonus action.",
  },
  {
    id: "monk.flurry-of-blows", name: "Flurry of Blows", sourceKind: "class", sourceId: "monk", minimumLevel: 2,
    activation: "bonus-action", resourceId: "ki-points", resourceCostSummary: "Spend 1 ki point", resolutionKind: "attack", summary: "Immediately after the Attack action, spend 1 ki point to make two unarmed strikes as a bonus action.",
  },
  {
    id: "monk.patient-defense", name: "Patient Defense", sourceKind: "class", sourceId: "monk", minimumLevel: 2,
    activation: "bonus-action", resourceId: "ki-points", resourceCostSummary: "Spend 1 ki point", resolutionKind: "state-toggle", summary: "Spend 1 ki point to take the Dodge action as a bonus action on your turn.",
  },
  {
    id: "monk.step-of-the-wind", name: "Step of the Wind", sourceKind: "class", sourceId: "monk", minimumLevel: 2,
    activation: "bonus-action", resourceId: "ki-points", resourceCostSummary: "Spend 1 ki point", resolutionKind: "movement", summary: "Spend 1 ki point to Disengage or Dash as a bonus action; your jump distance is doubled for the turn.",
  },
  {
    id: "artificer.battle-smith.command-defender", name: "Command Steel Defender", sourceKind: "subclass", sourceId: "artificer", subclassId: "battle-smith", minimumLevel: 3,
    activation: "bonus-action", resolutionKind: "choice", summary: "Command your steel defender to take an action other than Dodge on its turn.",
  },
  {
    id: "artificer.artillerist.activate-cannon", name: "Activate Eldritch Cannon", sourceKind: "subclass", sourceId: "artificer", subclassId: "artillerist", minimumLevel: 3,
    activation: "bonus-action", resolutionKind: "mixed", summary: "Command your eldritch cannon to use its Flamethrower, Force Ballista, or Protector effect.",
  },
  {
    id: "barbarian.totem.eagle-dash", name: "Eagle Totem: Dash", sourceKind: "subclass", sourceId: "barbarian", subclassId: "totem-warrior", minimumLevel: 3,
    activation: "bonus-action", resolutionKind: "movement", summary: "While raging and not wearing heavy armor, take the Dash action as a bonus action.",
  },
  {
    id: "feat.crossbow-expert-bonus-attack", name: "Crossbow Expert: Bonus Attack", sourceKind: "feat", sourceId: "crossbow-expert", minimumLevel: 1,
    activation: "bonus-action", resolutionKind: "attack", summary: "After attacking with a one-handed weapon, attack with a hand crossbow you are holding as a bonus action.",
  },
  {
    id: "fighter.eldritch-knight.summon-bonded-weapon", name: "Summon Bonded Weapon", sourceKind: "subclass", sourceId: "fighter", subclassId: "eldritch-knight", minimumLevel: 3,
    activation: "bonus-action", resolutionKind: "state-toggle", summary: "Summon one of your bonded weapons into your hand while it is on the same plane of existence.",
  },
  {
    id: "feat.great-weapon-master-bonus-attack", name: "Great Weapon Master: Bonus Attack", sourceKind: "feat", sourceId: "great-weapon-master", minimumLevel: 1,
    activation: "bonus-action", resolutionKind: "attack", trigger: "You score a critical hit with a melee weapon or reduce a creature to 0 hit points with one", summary: "Make one melee weapon attack as a bonus action.",
  },
  {
    id: "rogue.soulknife.second-psychic-blade", name: "Psychic Blades: Second Blade", sourceKind: "subclass", sourceId: "rogue", subclassId: "soulknife", minimumLevel: 3,
    activation: "bonus-action", resolutionKind: "attack", summary: "After attacking with your psychic blade, manifest a second blade and attack with it as a bonus action.",
  },
  {
    id: "sorcerer.flexible-casting", name: "Flexible Casting", sourceKind: "class", sourceId: "sorcerer", minimumLevel: 2,
    activation: "bonus-action", resolutionKind: "resource-conversion", summary: "Convert sorcery points into a spell slot, or expend a spell slot to gain sorcery points, using the feature's conversion table.",
  },
  {
    id: "artificer.soul-of-artifice-survival", name: "Soul of Artifice: Survive", sourceKind: "class", sourceId: "artificer", minimumLevel: 20,
    activation: "reaction", resolutionKind: "state-toggle", trigger: "You are reduced to 0 hit points but not killed outright", summary: "End one artificer infusion to drop to 1 hit point instead of 0.",
  },
  {
    id: "barbarian.beast.tail-defense", name: "Form of the Beast: Tail Defense", sourceKind: "subclass", sourceId: "barbarian", subclassId: "beast", minimumLevel: 3,
    activation: "reaction", resolutionKind: "mixed", trigger: "A creature you can see within 10 feet hits you with an attack roll", summary: "Roll a d8 and add it to your AC against the attack, potentially causing it to miss.",
  },
  {
    id: "feat.gift-chromatic-reactive-resistance", name: "Reactive Resistance", sourceKind: "feat", sourceId: "gift-of-the-chromatic-dragon", minimumLevel: 1,
    activation: "reaction", resolutionKind: "state-toggle", trigger: "You take acid, cold, fire, lightning, or poison damage", summary: "Give yourself resistance to the triggering damage instance.",
  },
  {
    id: "feat.sentinel-reaction-attack", name: "Sentinel: Retaliatory Attack", sourceKind: "feat", sourceId: "sentinel", minimumLevel: 1,
    activation: "reaction", resolutionKind: "attack", trigger: "A creature within 5 feet attacks a target other than you", summary: "Make a melee weapon attack against the triggering creature.",
  },
  {
    id: "feat.shield-master-evasion", name: "Shield Master: Avoid Damage", sourceKind: "feat", sourceId: "shield-master", minimumLevel: 1,
    activation: "reaction", resolutionKind: "state-toggle", trigger: "You succeed on a Dexterity saving throw for half damage", summary: "Use your reaction to take no damage instead, interposing your shield.",
  },
  {
    id: "feat.war-caster-opportunity-spell", name: "War Caster: Opportunity Spell", sourceKind: "feat", sourceId: "war-caster", minimumLevel: 1,
    activation: "reaction", resolutionKind: "mixed", trigger: "A creature's movement provokes an opportunity attack from you", summary: "Cast a spell at that creature instead of making the opportunity attack, following the feature's targeting and casting-time restrictions.",
  },
  {
    id: "wizard.abjuration.projected-ward", name: "Projected Ward", sourceKind: "subclass", sourceId: "wizard", subclassId: "school-of-abjuration", minimumLevel: 6,
    activation: "reaction", resolutionKind: "state-toggle", trigger: "A creature you can see within 30 feet takes damage", summary: "Have your Arcane Ward absorb the damage instead, up to the ward's remaining hit points.",
  },
  {
    id: "feat.grappler-restrain", name: "Grappler: Pin", sourceKind: "feat", sourceId: "grappler", minimumLevel: 1,
    activation: "action", resolutionKind: "ability-check", summary: "Try to restrain a creature you are grappling; on success, both you and the creature become restrained while the pin lasts.",
  },
];

const ACTIVATION_OVERRIDES: Partial<Record<string, CapabilityActivation>> = {
  "druid.moon.combat-wild-shape": "bonus-action",
  "rogue.cunning-action": "bonus-action",
  "rogue.mastermind.master-of-tactics": "bonus-action",
  "rogue.thief.fast-hands": "bonus-action",
};

const CATALOG = [...rawCapabilities as CatalogCapability[], ...SUPPLEMENTAL_CAPABILITIES];
const RESOURCE_ALIASES: Record<string, string> = {
  "bardic-inspiration-dice": "bardic-inspiration-uses",
  "channel-divinity-use": "channel-divinity-uses",
  "wild-shape-use": "wild-shape-uses",
};

function runtimeResourceId(resourceId: string | undefined) {
  return resourceId ? RESOURCE_ALIASES[resourceId] ?? resourceId : undefined;
}

export function capabilityLane(activation: CapabilityActivation): CapabilityLane {
  if (activation === "bonus-action") return "bonus-actions";
  if (activation === "reaction") return "reactions";
  if (activation === "passive" || activation === "triggered" || activation === "rider") return "passives";
  return "actions";
}

export function spellActivation(spell: Pick<SpellData, "castingTime">): CapabilityActivation {
  const castingTime = spell.castingTime.trim().toLowerCase();
  if (castingTime.startsWith("1 bonus action")) return "bonus-action";
  if (castingTime.startsWith("1 reaction")) return "reaction";
  if (castingTime === "special") return "special";
  if (castingTime === "1 action") return "action";
  return "long-activation";
}

function sourceLabel(record: CatalogCapability) {
  if (record.sourceKind === "universal") return "Universal";
  if (record.sourceKind === "feat") return getFeat(record.sourceId)?.name ?? "Feat";
  if (record.sourceKind === "subclass") return "Subclass";
  return "Class";
}

function availableFeatIds(character: Pick<Character, "asiChoices">) {
  return new Set((character.asiChoices ?? []).flatMap((choice) => choice.type === "feat" ? [choice.featId] : []));
}

function classAndUniversalCapabilities(character: Pick<Character, "ruleset" | "classId" | "subclassId" | "level" | "asiChoices" | "featureResources">) {
  if (character.ruleset !== "2014") return [];
  const featIds = availableFeatIds(character);
  return CATALOG.filter((record) => {
    if (record.minimumLevel > character.level) return false;
    if (record.sourceKind === "universal") return true;
    if (record.sourceKind === "feat") return featIds.has(record.sourceId);
    if (record.sourceId !== character.classId) return false;
    return record.sourceKind !== "subclass" || record.subclassId === character.subclassId;
  }).map((record): CharacterCapability => {
    const activation = ACTIVATION_OVERRIDES[record.id] ?? record.activation;
    const resourceId = runtimeResourceId(record.resourceId);
    return {
      ...record,
      activation,
      ...(resourceId ? { resourceId } : {}),
      lane: capabilityLane(activation),
      sourceLabel: sourceLabel(record),
      ...(resourceId && character.featureResources?.[resourceId]
        ? { resource: character.featureResources[resourceId] }
        : {}),
    };
  });
}

function spellCapability(spell: SpellData, character: Pick<Character, "featureResources">): CharacterCapability {
  const activation = spellActivation(spell);
  return {
    id: `spell.${spell.id}`,
    name: spell.name,
    sourceKind: "class",
    sourceId: "spellcasting",
    minimumLevel: 1,
    activation,
    lane: capabilityLane(activation),
    sourceLabel: "Spell",
    resourceId: spell.level > 0 ? "spell-slots" : undefined,
    resource: spell.level > 0 ? character.featureResources?.["spell-slots"] : undefined,
    rechargeSummary: spell.level > 0 ? "Spell slot" : undefined,
    scalingSummary: spell.higherLevel ? "Can be cast with a higher-level slot" : undefined,
    resolutionKind: isAttackRollSpell(spell) ? "attack" : spell.save ? "saving-throw" : "mixed",
    summary: spell.description,
    trigger: activation === "reaction" ? spell.castingTime.replace(/^1 Reaction\s*\*?\s*/i, "").trim() || undefined : undefined,
    spell,
  };
}

export function capabilitiesForCharacter(
  character: Pick<Character, "ruleset" | "classId" | "subclassId" | "level" | "asiChoices" | "featureResources">,
  availableSpellIds: Iterable<string> = [],
): CharacterCapability[] {
  const spells = Array.from(new Set(availableSpellIds))
    .map((id) => getSpell(id))
    .filter((spell): spell is SpellData => Boolean(spell))
    .map((spell) => spellCapability(spell, character));
  return [...classAndUniversalCapabilities(character), ...spells]
    .sort((a, b) => a.lane.localeCompare(b.lane) || a.sourceLabel.localeCompare(b.sourceLabel) || a.name.localeCompare(b.name));
}

export function capabilityResourceCost(capability: CharacterCapability): number | "choose" | null {
  if (!capability.resourceId || capability.resourceId === "spell-slots") return null;
  if (capability.id === "paladin.lay-on-hands") return "choose";
  const explicit = capability.resourceCostSummary?.match(/(?:costs?|spend(?:s|ing)?|expends?)\s+(\d+)/i);
  if (explicit) return Number(explicit[1]);
  if (/two (?:uses|points)/i.test(capability.resourceCostSummary ?? "")) return 2;
  return 1;
}

export function capabilityById(id: string) {
  return CATALOG.find((capability) => capability.id === id);
}
