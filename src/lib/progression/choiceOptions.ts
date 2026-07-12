import type { LevelUpChoice } from "@/lib/progression/types";

const OPTIONS: Record<string, string[]> = {
  "choose-3-skills": ["acrobatics", "animal-handling", "arcana", "athletics", "deception", "history", "insight", "intimidation", "investigation", "medicine", "nature", "perception", "performance", "persuasion", "religion", "sleight-of-hand", "stealth", "survival"],
  "choose-fighting-style": ["archery", "defense", "dueling", "great-weapon-fighting", "protection", "two-weapon-fighting"],
  "choose-3-maneuvers": ["commanders-strike", "disarming-attack", "distracting-strike", "evasive-footwork", "feinting-attack", "goading-attack", "lunging-attack", "maneuvering-attack", "menacing-attack", "parry", "precision-attack", "pushing-attack", "rally", "riposte", "sweeping-attack", "trip-attack"],
  "choose-2-maneuvers": ["commanders-strike", "disarming-attack", "distracting-strike", "evasive-footwork", "feinting-attack", "goading-attack", "lunging-attack", "maneuvering-attack", "menacing-attack", "parry", "precision-attack", "pushing-attack", "rally", "riposte", "sweeping-attack", "trip-attack"],
  "choose-elemental-discipline": ["breath-of-winter", "clench-of-the-north-wind", "elemental-attunement", "eternal-mountain-defense", "fangs-of-the-fire-snake", "fist-of-four-thunders", "fist-of-unbroken-air", "flames-of-the-phoenix", "gong-of-the-summit", "mist-stance", "ride-the-wind", "river-of-hungry-flame", "rush-of-the-gale-spirits", "shape-the-flowing-river", "sweeping-cinder-strike", "water-whip", "wave-of-rolling-earth"],
  "choose-elemental-attunement": ["elemental-attunement"],
  "choose-artisans-tool": ["alchemists-supplies", "brewers-supplies", "calligraphers-supplies", "carpenters-tools", "cartographers-tools", "cobblers-tools", "cooks-utensils", "glassblowers-tools", "jewelers-tools", "leatherworkers-tools", "masons-tools", "painters-supplies", "potters-tools", "smiths-tools", "tinkers-tools", "weavers-tools", "woodcarvers-tools"],
  "choose-pact-boon": ["pact-of-the-chain", "pact-of-the-blade", "pact-of-the-tome"],
  "choose-2-eldritch-invocations": ["agonizing-blast", "armor-of-shadows", "beast-speech", "beguiling-influence", "devils-sight", "eldritch-sight", "eyes-of-the-rune-keeper", "fiendish-vigor", "mask-of-many-faces", "misty-visions", "repelling-blast", "thief-of-five-fates"],
  "choose-1-eldritch-invocation": ["agonizing-blast", "armor-of-shadows", "beast-speech", "beguiling-influence", "devils-sight", "eldritch-sight", "eyes-of-the-rune-keeper", "fiendish-vigor", "mask-of-many-faces", "misty-visions", "repelling-blast", "thief-of-five-fates"],
  "choose-4-infusions": ["enhanced-arcane-focus", "enhanced-defense", "enhanced-weapon", "homunculus-servant", "mind-sharpener", "repeating-shot", "replicate-magic-item", "returning-weapon"],
  "choose-favored-enemy": ["aberrations", "beasts", "celestials", "constructs", "dragons", "elementals", "fey", "fiends", "giants", "monstrosities", "oozes", "plants", "undead", "two-humanoid-types"],
  "choose-favored-terrain": ["arctic", "coast", "desert", "forest", "grassland", "mountain", "swamp", "underdark"],
  "choose-2-metamagic-options": ["careful-spell", "distant-spell", "empowered-spell", "extended-spell", "heightened-spell", "quickened-spell", "subtle-spell", "twinned-spell"],
  "choose-1-metamagic-option": ["careful-spell", "distant-spell", "empowered-spell", "extended-spell", "heightened-spell", "quickened-spell", "subtle-spell", "twinned-spell"],
  "choose-resistance-damage-type": ["acid", "cold", "fire", "lightning", "necrotic", "poison", "psychic", "radiant", "thunder"],
  "choose-armor-model": ["guardian", "infiltrator"],
  "choose-cannon-form": ["flamethrower", "force-ballista", "protector"],
  "choose-companion-beast": ["ape", "black-bear", "boar", "giant-badger", "giant-frog", "giant-poisonous-snake", "panther", "wolf"],
  "choose-beast-forms": ["brown-bear", "dire-wolf", "giant-hyena", "giant-spider", "lion", "tiger"],
  "choose-2-known-beast-forms": ["brown-bear", "dire-wolf", "giant-hyena", "giant-spider", "lion", "tiger"],
  "choose-4-known-beast-forms": ["brown-bear", "dire-wolf", "giant-hyena", "giant-spider", "lion", "tiger"],
  "choose-2-languages": ["dwarvish", "elvish", "giant", "gnomish", "goblin", "halfling", "orc", "abyssal", "celestial", "draconic", "deep-speech", "infernal", "primordial", "sylvan", "undercommon"],
  "choose-alchemist-supplies": ["alchemists-supplies"],
  "choose-smiths-tools": ["smiths-tools"],
  "choose-woodcarvers-or-smiths-tools": ["woodcarvers-tools", "smiths-tools"],
  "choose-heavy-armor-or-martial-weapon-proficiency": ["heavy-armor", "martial-weapon"],
};

export function progressionChoiceOptions(choice: LevelUpChoice): string[] {
  if (Array.isArray(choice.options)) return choice.options;
  if (choice.options === "all-skills") return OPTIONS["choose-3-skills"];
  return OPTIONS[choice.choiceId] ?? [];
}

export function progressionChoiceLabel(value: string): string {
  return value.split("-").map((word) => word ? word[0].toUpperCase() + word.slice(1) : word).join(" ");
}
