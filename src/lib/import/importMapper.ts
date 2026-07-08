/**
 * Import Mapper
 *
 * Maps raw extracted data (form fields, generic text) into ImportDraft.
 */

import type { ImportDraft, ImportSource } from "./pdfTypes";
import { emptyDraft, confirmedField, reviewField, type ImportAttack, type ImportInventoryItem, type ImportSpell } from "./pdfTypes";
import type { AbilityKey } from "@/types/game";

// ── Form field mapping (Lane A) ──

/** Known D&D Beyond / standard fillable PDF field name mappings. */
const FORM_FIELD_MAP: Record<string, { target: string; type: "identity" | "ability" | "vital" | "prof" | "other" }> = {
  // Identity
  "CharacterName": { target: "name", type: "identity" },
  "ClassLevel": { target: "classLevel", type: "identity" },
  "CLASS  LEVEL": { target: "classLevel", type: "identity" },
  "Race": { target: "species", type: "identity" },
  "RACE": { target: "species", type: "identity" },
  "Species": { target: "species", type: "identity" },
  "Background": { target: "background", type: "identity" },
  "BACKGROUND": { target: "background", type: "identity" },
  "Alignment": { target: "alignment", type: "identity" },
  "PlayerName": { target: "playerName", type: "other" },
  "XP": { target: "xp", type: "other" },

  // Abilities
  "STR": { target: "strength", type: "ability" },
  "DEX": { target: "dexterity", type: "ability" },
  "CON": { target: "constitution", type: "ability" },
  "INT": { target: "intelligence", type: "ability" },
  "WIS": { target: "wisdom", type: "ability" },
  "CHA": { target: "charisma", type: "ability" },
  "Strength": { target: "strength", type: "ability" },
  "Dexterity": { target: "dexterity", type: "ability" },
  "Constitution": { target: "constitution", type: "ability" },
  "Intelligence": { target: "intelligence", type: "ability" },
  "Wisdom": { target: "wisdom", type: "ability" },
  "Charisma": { target: "charisma", type: "ability" },

  // Vitals
  "AC": { target: "armorClass", type: "vital" },
  "ArmorClass": { target: "armorClass", type: "vital" },
  "HP": { target: "maxHp", type: "vital" },
  "HPMax": { target: "maxHp", type: "vital" },
  "MaxHP": { target: "maxHp", type: "vital" },
  "HPCurrent": { target: "currentHp", type: "vital" },
  "CurrentHP": { target: "currentHp", type: "vital" },
  "HPTemp": { target: "tempHp", type: "vital" },
  "TempHP": { target: "tempHp", type: "vital" },
  "Initiative": { target: "initiative", type: "vital" },
  "Init": { target: "initiative", type: "vital" },
  "Speed": { target: "speed", type: "vital" },

  // Proficiencies
  "Proficiencies": { target: "proficiencies", type: "prof" },
  "ProficienciesLang": { target: "proficiencies", type: "prof" },
  "Languages": { target: "languages", type: "prof" },
  "Tools": { target: "tools", type: "prof" },
};

const NORMALIZED_FORM_FIELD_MAP = new Map(
  Object.entries(FORM_FIELD_MAP).map(([key, value]) => [normalizeFieldName(key), value]),
);

const SKILL_FIELD_NAMES: Record<string, string> = {
  acrobatics: "Acrobatics",
  animal: "Animal Handling",
  animalhandling: "Animal Handling",
  arcana: "Arcana",
  athletics: "Athletics",
  deception: "Deception",
  history: "History",
  insight: "Insight",
  intimidation: "Intimidation",
  investigation: "Investigation",
  medicine: "Medicine",
  nature: "Nature",
  perception: "Perception",
  performance: "Performance",
  persuasion: "Persuasion",
  religion: "Religion",
  sleightofhand: "Sleight of Hand",
  stealth: "Stealth",
  survival: "Survival",
};

const SAVE_FIELD_NAMES: Record<string, string> = {
  str: "Strength",
  strength: "Strength",
  dex: "Dexterity",
  dexterity: "Dexterity",
  con: "Constitution",
  constitution: "Constitution",
  int: "Intelligence",
  intelligence: "Intelligence",
  wis: "Wisdom",
  wisdom: "Wisdom",
  cha: "Charisma",
  charisma: "Charisma",
};

function normalizeFieldName(value: string) {
  return value.toLowerCase().replace(/\d+$/g, "").replace(/[^a-z0-9]+/g, "");
}

function lookupMapping(fieldName: string) {
  return FORM_FIELD_MAP[fieldName] ?? NORMALIZED_FORM_FIELD_MAP.get(normalizeFieldName(fieldName));
}

function isMarkedProficient(value: string) {
  const clean = value.trim().toLowerCase();
  return clean !== "" && clean !== "off" && clean !== "--" && clean !== "0";
}

function parseClassLevel(value: string) {
  const match = value.trim().match(/^([A-Za-z][A-Za-z\s'-]*?)\s+(\d{1,2})$/);
  if (!match) return null;
  return { className: match[1].trim(), level: parseInt(match[2], 10) };
}

function parseIntegerValue(value: string) {
  const match = value.match(/[+-]?\d+/);
  return match ? parseInt(match[0], 10) : null;
}

function splitList(value: string) {
  return value
    .split(/[,;\n]/)
    .map((part) => part.replace(/^[-*]\s*/, "").trim())
    .filter(Boolean);
}

function parseProficiencySections(value: string) {
  const section = (label: string) => {
    const match = value.match(new RegExp(`===\\s*${label}\\s*===\\s*([\\s\\S]*?)(?=\\n\\s*===|$)`, "i"));
    return match ? splitList(match[1]) : [];
  };

  return {
    armor: section("armor"),
    weapons: section("weapons"),
    languages: section("languages"),
    tools: section("tools"),
  };
}

function parseWeight(value: string | undefined) {
  if (!value) return undefined;
  const parsed = parseFloat(value.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function mergeConfirmedList(current: string[] | null, additions: string[]) {
  return Array.from(new Set([...(current ?? []), ...additions]));
}

function rowFor(map: Map<number, Partial<ImportAttack>>, index: number) {
  const row = map.get(index) ?? {};
  map.set(index, row);
  return row;
}

function itemRowFor(map: Map<number, Partial<ImportInventoryItem>>, index: number) {
  const row = map.get(index) ?? {};
  map.set(index, row);
  return row;
}

function spellRowFor(map: Map<number, Partial<ImportSpell>>, index: number) {
  const row = map.get(index) ?? {};
  map.set(index, row);
  return row;
}

function collectGroupedFields(
  fieldName: string,
  value: string,
  groups: {
    weaponRows: Map<number, Partial<ImportAttack>>;
    equipmentRows: Map<number, Partial<ImportInventoryItem>>;
    spellRows: Map<number, Partial<ImportSpell>>;
    featureTexts: Array<{ index: number; value: string }>;
  },
) {
  const name = fieldName.trim();

  const weaponName = name.match(/^Wpn Name(?:\s+(\d+))?$/i);
  if (weaponName) {
    const index = weaponName[1] ? parseInt(weaponName[1], 10) : 1;
    rowFor(groups.weaponRows, index).name = value;
    return;
  }

  const weaponHit = name.match(/^Wpn\s*(\d+)\s+AtkBonus/i);
  if (weaponHit) {
    rowFor(groups.weaponRows, parseInt(weaponHit[1], 10)).hit = value;
    return;
  }

  const weaponDamage = name.match(/^Wpn\s*(\d+)\s+Damage/i);
  if (weaponDamage) {
    rowFor(groups.weaponRows, parseInt(weaponDamage[1], 10)).damage = value;
    return;
  }

  const weaponNotes = name.match(/^Wpn Notes\s*(\d+)$/i);
  if (weaponNotes) {
    rowFor(groups.weaponRows, parseInt(weaponNotes[1], 10)).notes = value;
    return;
  }

  const equipmentName = name.match(/^Eq Name(\d+)$/i);
  if (equipmentName) {
    itemRowFor(groups.equipmentRows, parseInt(equipmentName[1], 10)).name = value;
    return;
  }

  const equipmentQty = name.match(/^Eq Qty(\d+)$/i);
  if (equipmentQty) {
    itemRowFor(groups.equipmentRows, parseInt(equipmentQty[1], 10)).quantity = parseIntegerValue(value) ?? undefined;
    return;
  }

  const equipmentWeight = name.match(/^Eq Weight(\d+)$/i);
  if (equipmentWeight) {
    itemRowFor(groups.equipmentRows, parseInt(equipmentWeight[1], 10)).weight = parseWeight(value);
    return;
  }

  const spellName = name.match(/^spellName(\d+)$/i);
  if (spellName) {
    spellRowFor(groups.spellRows, parseInt(spellName[1], 10)).name = value;
    return;
  }

  const spellPrepared = name.match(/^spellPrepared(\d+)$/i);
  if (spellPrepared) {
    spellRowFor(groups.spellRows, parseInt(spellPrepared[1], 10)).prepared = isMarkedProficient(value);
    return;
  }

  const spellHeader = name.match(/^spellHeader(\d+)$/i);
  if (spellHeader) {
    const level = parseIntegerValue(value);
    if (level !== null) spellRowFor(groups.spellRows, parseInt(spellHeader[1], 10)).level = level;
    return;
  }

  const features = name.match(/^FeaturesTraits(\d+)$/i);
  if (features) {
    groups.featureTexts.push({ index: parseInt(features[1], 10), value });
  }
}

function collectProficiencyMarkers(
  fieldName: string,
  value: string,
  skillProficiencies: string[],
  savingThrowProficiencies: string[],
) {
  if (!isMarkedProficient(value)) return;
  const normalized = normalizeFieldName(fieldName);
  if (!normalized.endsWith("prof")) return;
  const base = normalized.slice(0, -"prof".length);

  const skill = SKILL_FIELD_NAMES[base];
  if (skill) {
    skillProficiencies.push(skill);
    return;
  }

  const save = SAVE_FIELD_NAMES[base];
  if (save) {
    savingThrowProficiencies.push(save);
  }
}

export function mapFormFieldsToDraft(
  fields: Record<string, string>,
  source: ImportSource,
): ImportDraft {
  const draft = emptyDraft();
  draft.source = source;
  const skillProficiencies: string[] = [];
  const savingThrowProficiencies: string[] = [];
  const weaponRows = new Map<number, Partial<ImportAttack>>();
  const equipmentRows = new Map<number, Partial<ImportInventoryItem>>();
  const spellRows = new Map<number, Partial<ImportSpell>>();
  const featureTexts: Array<{ index: number; value: string }> = [];

  for (const [fieldName, fieldValue] of Object.entries(fields)) {
    const trimmed = fieldValue.trim();
    if (!trimmed) continue;
    collectGroupedFields(fieldName, trimmed, { weaponRows, equipmentRows, spellRows, featureTexts });
    collectProficiencyMarkers(fieldName, trimmed, skillProficiencies, savingThrowProficiencies);

    const mapping = lookupMapping(fieldName);
    if (!mapping) continue;

    switch (mapping.type) {
      case "identity": {
        if (mapping.target === "name") {
          draft.identity.name = confirmedField(trimmed, `Form field: ${fieldName}`);
        } else if (mapping.target === "classLevel") {
          const parsed = parseClassLevel(trimmed);
          if (parsed) {
            draft.identity.className = confirmedField(parsed.className, `Form field: ${fieldName}`);
            draft.identity.level = confirmedField(parsed.level, `Form field: ${fieldName}`);
          } else {
            draft.identity.className = reviewField(trimmed, `Form field: ${fieldName}`);
          }
        } else if (mapping.target === "species") {
          draft.identity.species = confirmedField(trimmed, `Form field: ${fieldName}`);
        } else if (mapping.target === "background") {
          draft.identity.background = confirmedField(trimmed, `Form field: ${fieldName}`);
        }
        break;
      }

      case "ability": {
        const score = parseInt(trimmed, 10);
        if (!isNaN(score) && score >= 3 && score <= 30) {
          draft.abilities[mapping.target as AbilityKey] = confirmedField(score, `Form field: ${fieldName}`);
        }
        break;
      }

      case "vital": {
        const num = parseIntegerValue(trimmed);
        if (num !== null) {
          if (mapping.target === "armorClass") draft.vitals.armorClass = confirmedField(num, `Form field: ${fieldName}`);
          else if (mapping.target === "maxHp") draft.vitals.maxHp = confirmedField(num, `Form field: ${fieldName}`);
          else if (mapping.target === "currentHp") draft.vitals.currentHp = confirmedField(num, `Form field: ${fieldName}`);
          else if (mapping.target === "tempHp") draft.vitals.tempHp = confirmedField(num, `Form field: ${fieldName}`);
          else if (mapping.target === "initiative") draft.vitals.initiative = confirmedField(num, `Form field: ${fieldName}`);
        } else if (mapping.target === "speed") {
          draft.vitals.speed = confirmedField(trimmed, `Form field: ${fieldName}`);
        }
        break;
      }

      case "prof": {
        if (mapping.target === "languages") {
          draft.proficiencies.languages = confirmedField(
            trimmed.split(/[,;]/).map((l) => l.trim()).filter(Boolean),
            `Form field: ${fieldName}`,
          );
        } else if (mapping.target === "tools") {
          draft.proficiencies.tools = confirmedField(
            trimmed.split(/[,;]/).map((t) => t.trim()).filter(Boolean),
            `Form field: ${fieldName}`,
          );
        } else if (mapping.target === "proficiencies") {
          const parsed = parseProficiencySections(trimmed);
          if (parsed.armor.length > 0) {
            draft.proficiencies.armor = confirmedField(
              mergeConfirmedList(draft.proficiencies.armor.value, parsed.armor),
              `Form field: ${fieldName}`,
            );
          }
          if (parsed.weapons.length > 0) {
            draft.proficiencies.weapons = confirmedField(
              mergeConfirmedList(draft.proficiencies.weapons.value, parsed.weapons),
              `Form field: ${fieldName}`,
            );
          }
          if (parsed.languages.length > 0) {
            draft.proficiencies.languages = confirmedField(
              mergeConfirmedList(draft.proficiencies.languages.value, parsed.languages),
              `Form field: ${fieldName}`,
            );
          }
          if (parsed.tools.length > 0) {
            draft.proficiencies.tools = confirmedField(
              mergeConfirmedList(draft.proficiencies.tools.value, parsed.tools),
              `Form field: ${fieldName}`,
            );
          }
        }
        break;
      }
    }
  }

  if (skillProficiencies.length > 0) {
    draft.proficiencies.skills = confirmedField(
      mergeConfirmedList(draft.proficiencies.skills.value, skillProficiencies),
      "Form proficiency markers",
    );
  }

  if (savingThrowProficiencies.length > 0) {
    draft.proficiencies.savingThrows = confirmedField(
      mergeConfirmedList(draft.proficiencies.savingThrows.value, savingThrowProficiencies),
      "Form proficiency markers",
    );
  }

  draft.attacks = Array.from(weaponRows.entries())
    .sort(([a], [b]) => a - b)
    .map(([, attack]) => attack)
    .filter((attack): attack is ImportAttack => Boolean(attack.name && attack.hit && attack.damage))
    .map((attack) => confirmedField(attack, "Form weapon rows"));

  draft.inventory = Array.from(equipmentRows.entries())
    .sort(([a], [b]) => a - b)
    .map(([, item]) => item)
    .filter((item): item is ImportInventoryItem => Boolean(item.name))
    .map((item) => confirmedField(item, "Form equipment rows"));

  draft.spells = Array.from(spellRows.entries())
    .sort(([a], [b]) => a - b)
    .map(([, spell]) => spell)
    .filter((spell): spell is ImportSpell => Boolean(spell.name))
    .map((spell) => reviewField(spell, "Form spell rows"));

  const features = featureTexts
    .sort((a, b) => a.index - b.index)
    .map((entry) => entry.value)
    .join("\n\n")
    .trim();
  if (features) {
    draft.notes.features = reviewField(features.slice(0, 5000), "Form feature fields");
  }

  return draft;
}

// ── Generic PDF text-based analysis (Lane C) ──

export function analyzeGenericPdf(
  pageTexts: Array<{ page: number; text: string; items: Array<{ str: string; x: number; y: number; width: number; height: number }> }>,
  source: ImportSource,
): ImportDraft {
  const draft = emptyDraft();
  draft.source = source;

  const allText = pageTexts.map((p) => p.text).join("\n");

  // Very basic label:value extraction
  const labelPatterns: Array<{ regex: RegExp; setter: (match: RegExpMatchArray) => void }> = [
    {
      regex: /(?:character\s*name|name)[:\s]*([\w\s'-]+?)(?:\s{2,}|$)/im,
      setter: (m) => { draft.identity.name = reviewField(m[1].trim(), "Generic label match"); },
    },
    {
      regex: /(?:class)[:\s]*(\w+)/im,
      setter: (m) => { draft.identity.className = reviewField(m[1].trim(), "Generic label match"); },
    },
    {
      regex: /(?:level|lvl)[:\s]*(\d+)/im,
      setter: (m) => { draft.identity.level = reviewField(parseInt(m[1], 10), "Generic label match"); },
    },
    {
      regex: /(?:race|species)[:\s]*(\w+)/im,
      setter: (m) => { draft.identity.species = reviewField(m[1].trim(), "Generic label match"); },
    },
    {
      regex: /(?:background)[:\s]*([\w\s]+?)(?:\s{2,}|$)/im,
      setter: (m) => { draft.identity.background = reviewField(m[1].trim(), "Generic label match"); },
    },
    {
      regex: /(?:armou?r\s*class|ac)[:\s]*(\d{1,2})/im,
      setter: (m) => { draft.vitals.armorClass = reviewField(parseInt(m[1], 10), "Generic label match"); },
    },
    {
      regex: /(?:hit\s*points?|hp)[:\s]*(\d+)/im,
      setter: (m) => { draft.vitals.maxHp = reviewField(parseInt(m[1], 10), "Generic label match"); },
    },
    {
      regex: /(?:initiative)[:\s]*([+-]?\s*\d+)/im,
      setter: (m) => { draft.vitals.initiative = reviewField(parseInt(m[1].replace(/\s+/g, ""), 10), "Generic label match"); },
    },
  ];

  for (const { regex, setter } of labelPatterns) {
    const match = allText.match(regex);
    if (match) setter(match);
  }

  // Try to find ability scores
  const abilityLabels: Array<{ label: string; key: AbilityKey }> = [
    { label: "str", key: "strength" },
    { label: "dex", key: "dexterity" },
    { label: "con", key: "constitution" },
    { label: "int", key: "intelligence" },
    { label: "wis", key: "wisdom" },
    { label: "cha", key: "charisma" },
  ];

  for (const { label, key } of abilityLabels) {
    const regex = new RegExp(`${label}\\s*[:\\s]\\s*(\\d{1,2})`, "i");
    const match = allText.match(regex);
    if (match) {
      const score = parseInt(match[1], 10);
      if (score >= 3 && score <= 30) {
        draft.abilities[key] = reviewField(score, `Generic label match: ${label}`);
      }
    }
  }

  return draft;
}
