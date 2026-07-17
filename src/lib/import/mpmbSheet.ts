/**
 * MPMB automated character sheet mapper (Lane A variant).
 *
 * MorePurpleMoreBetter's "Character Record Sheet" is a common fillable PDF
 * whose visible stat boxes (Str, HP Max, PC Name…) are computed at view time
 * by Acrobat JavaScript and saved as EMPTY field values — the real data lives
 * in component fields ("Dex Remember" = "8,2,0,0"), proficiency checkboxes,
 * "Attack.N.*" rows, "Adventuring Gear Row N" rows and "P#.SSfront.spells.*"
 * spell pages. A generic field-name mapper therefore imports almost nothing
 * from these sheets; this module reads the MPMB scheme directly.
 */

import type { ImportDraft, ImportSource } from "./pdfTypes";
import { emptyDraft, confirmedField, reviewField, type ImportAttack, type ImportInventoryItem, type ImportSpell } from "./pdfTypes";
import type { AbilityKey } from "@/types/game";

const ABILITY_PREFIX: Record<AbilityKey, string> = {
  strength: "Str",
  dexterity: "Dex",
  constitution: "Con",
  intelligence: "Int",
  wisdom: "Wis",
  charisma: "Cha",
};

const SKILL_PREFIXES: Record<string, string> = {
  Acr: "Acrobatics",
  Ani: "Animal Handling",
  Arc: "Arcana",
  Ath: "Athletics",
  Dec: "Deception",
  His: "History",
  Ins: "Insight",
  Inti: "Intimidation",
  Inv: "Investigation",
  Med: "Medicine",
  Nat: "Nature",
  Perc: "Perception",
  Perf: "Performance",
  Pers: "Persuasion",
  Rel: "Religion",
  Sle: "Sleight of Hand",
  Ste: "Stealth",
  Sur: "Survival",
};

function isChecked(value: string | undefined): boolean {
  if (!value) return false;
  const clean = value.trim().toLowerCase();
  return clean !== "" && clean !== "off" && clean !== "false" && clean !== "0";
}

function toInt(value: string | undefined): number | null {
  if (!value) return null;
  const match = value.match(/[+-]?\d+/);
  return match ? parseInt(match[0], 10) : null;
}

/** Signature check: MPMB sheets carry component ability fields. */
export function isMpmbSheet(fields: Record<string, string>): boolean {
  if ("Str Remember" in fields || "Dex Remember" in fields) return true;
  return "PC Name" in fields && "Class and Levels" in fields;
}

/**
 * An ability score: prefer the visible field (filled when the sheet was
 * saved by full Acrobat), else derive it from the "Remember" component list.
 * MPMB stores "base,racial,extra,override" — an override wins outright.
 */
function resolveAbility(fields: Record<string, string>, prefix: string): { value: number; derived: boolean } | null {
  const visible = toInt(fields[prefix]);
  if (visible !== null && visible >= 3 && visible <= 30) return { value: visible, derived: false };

  const remember = fields[`${prefix} Remember`];
  if (!remember) return null;
  const parts = remember.split(",").map((part) => parseInt(part.trim(), 10)).filter(Number.isFinite);
  if (parts.length === 0) return null;
  const override = parts.length >= 4 && parts[3] > 0 ? parts[3] : null;
  const value = override ?? parts.slice(0, 3).reduce((sum, part) => sum + part, 0);
  if (value < 3 || value > 30) return null;
  return { value, derived: true };
}

export function mapMpmbFieldsToDraft(fields: Record<string, string>, source: ImportSource): ImportDraft {
  const draft = emptyDraft();
  draft.source = source;

  const text = (key: string) => fields[key]?.trim() || null;

  // ── Identity ──
  const name = text("PC Name");
  if (name) draft.identity.name = confirmedField(name, "MPMB field: PC Name");

  const classAndLevels = text("Class and Levels");
  if (classAndLevels) {
    // Usually "Wizard (Bladesinger) 2"; sometimes just the (sub)class name.
    const match = classAndLevels.match(/^(.+?)\s*(\d{1,2})?\s*$/);
    const className = (match?.[1] ?? classAndLevels).trim();
    if (className) draft.identity.className = confirmedField(className, "MPMB field: Class and Levels");
    const trailingLevel = match?.[2] ? parseInt(match[2], 10) : null;
    if (trailingLevel) draft.identity.level = confirmedField(trailingLevel, "MPMB field: Class and Levels");
  }
  const characterLevel = toInt(fields["Character Level"]);
  if (characterLevel && characterLevel >= 1 && characterLevel <= 20) {
    draft.identity.level = confirmedField(characterLevel, "MPMB field: Character Level");
  }

  const race = text("Race");
  if (race) draft.identity.species = confirmedField(race, "MPMB field: Race");
  const background = text("Background");
  if (background) draft.identity.background = confirmedField(background, "MPMB field: Background");

  // ── Abilities ──
  for (const [key, prefix] of Object.entries(ABILITY_PREFIX) as Array<[AbilityKey, string]>) {
    const resolved = resolveAbility(fields, prefix);
    if (!resolved) continue;
    draft.abilities[key] = resolved.derived
      ? reviewField(resolved.value, "Derived from the sheet's ability components")
      : confirmedField(resolved.value, `MPMB field: ${prefix}`);
  }

  // ── Vitals ──
  const maxHp = toInt(fields["HP Max"]);
  if (maxHp !== null && maxHp > 0) draft.vitals.maxHp = confirmedField(maxHp, "MPMB field: HP Max");
  const currentHp = toInt(fields["HP Current"]);
  if (currentHp !== null && currentHp >= 0) draft.vitals.currentHp = confirmedField(currentHp, "MPMB field: HP Current");
  const tempHp = toInt(fields["HP Temp"]);
  if (tempHp !== null && tempHp > 0) draft.vitals.tempHp = confirmedField(tempHp, "MPMB field: HP Temp");
  const armorClass = toInt(fields["AC"]);
  if (armorClass !== null && armorClass >= 1 && armorClass <= 40) draft.vitals.armorClass = confirmedField(armorClass, "MPMB field: AC");
  const initiative = toInt(fields["Init Bonus"]);
  if (initiative !== null) draft.vitals.initiative = confirmedField(initiative, "MPMB field: Init Bonus");
  const speed = text("Speed");
  if (speed) {
    // Multi-line ("30 ft\r20 ft climb") — the first line is the walking speed.
    draft.vitals.speed = confirmedField(speed.split(/[\r\n]+/)[0].trim(), "MPMB field: Speed");
  }

  // ── Saving throws and skills (checkbox flags) ──
  const saves = (Object.entries(ABILITY_PREFIX) as Array<[AbilityKey, string]>)
    .filter(([, prefix]) => isChecked(fields[`${prefix} ST Prof`]))
    .map(([key]) => key.charAt(0).toUpperCase() + key.slice(1));
  if (saves.length > 0) draft.proficiencies.savingThrows = confirmedField(saves, "MPMB save proficiencies");

  const skills = Object.entries(SKILL_PREFIXES)
    .filter(([prefix]) => isChecked(fields[`${prefix} Prof`]))
    .map(([prefix, label]) => (isChecked(fields[`${prefix} Exp`]) ? `${label} (Expertise)` : label));
  if (skills.length > 0) draft.proficiencies.skills = confirmedField(skills, "MPMB skill proficiencies");

  // ── Armor/weapon/language/tool proficiencies ──
  const armor = [
    isChecked(fields["Proficiency Armor Light"]) ? "Light armor" : null,
    isChecked(fields["Proficiency Armor Medium"]) ? "Medium armor" : null,
    isChecked(fields["Proficiency Armor Heavy"]) ? "Heavy armor" : null,
    isChecked(fields["Proficiency Shields"]) ? "Shields" : null,
  ].filter((entry): entry is string => Boolean(entry));
  if (armor.length > 0) draft.proficiencies.armor = confirmedField(armor, "MPMB armor proficiencies");

  const weapons = [
    isChecked(fields["Proficiency Weapon Simple"]) ? "Simple weapons" : null,
    isChecked(fields["Proficiency Weapon Martial"]) ? "Martial weapons" : null,
    ...(isChecked(fields["Proficiency Weapon Other"])
      ? (fields["Proficiency Weapon Other Description"] ?? "").split(/[,;]/).map((part) => part.trim()).filter(Boolean)
      : []),
  ].filter((entry): entry is string => Boolean(entry));
  if (weapons.length > 0) draft.proficiencies.weapons = confirmedField(weapons, "MPMB weapon proficiencies");

  const numberedList = (base: string, max: number) => {
    const values: string[] = [];
    for (let i = 1; i <= max; i++) {
      const value = text(`${base} ${i}`);
      if (value) values.push(value);
    }
    return values;
  };
  const languages = numberedList("Language", 12);
  if (languages.length > 0) draft.proficiencies.languages = confirmedField(languages, "MPMB languages");
  const tools = numberedList("Tool", 12);
  if (tools.length > 0) draft.proficiencies.tools = confirmedField(tools, "MPMB tools");

  // ── Attacks ──
  for (let i = 1; i <= 10; i++) {
    const weapon = text(`Attack.${i}.Weapon`);
    if (!weapon) continue;
    const attack: ImportAttack = {
      name: weapon,
      hit: text(`Attack.${i}.To Hit`) ?? "",
      damage: [text(`Attack.${i}.Damage`), text(`Attack.${i}.Damage Type`)].filter(Boolean).join(" "),
      notes: text(`Attack.${i}.Description`) ?? "",
    };
    draft.attacks.push(confirmedField(attack, `MPMB attack row ${i}`));
  }

  // ── Inventory (gear rows; "- " prefix marks container contents) ──
  for (let i = 1; i <= 80; i++) {
    const row = text(`Adventuring Gear Row ${i}`);
    if (!row) continue;
    const item: ImportInventoryItem = {
      name: row.replace(/^-\s*/, ""),
      quantity: toInt(fields[`Adventuring Gear Amount ${i}`]) ?? undefined,
      weight: toInt(fields[`Adventuring Gear Weight ${i}`]) ?? undefined,
    };
    draft.inventory.push(confirmedField(item, `MPMB gear row ${i}`));
  }

  // ── Spells: "P#.SSfront.spells.name.N" rows; literal "SPELL" rows are the
  //    per-level section headers, so count them to infer spell level. ──
  const spellKeys = Object.keys(fields)
    .map((key) => {
      const match = key.match(/^P(\d+)\.SS(?:front|more)\.spells\.name\.(\d+)$/);
      return match ? { key, page: parseInt(match[1], 10), index: parseInt(match[2], 10) } : null;
    })
    .filter((entry): entry is { key: string; page: number; index: number } => entry !== null)
    .sort((a, b) => a.page - b.page || a.index - b.index);

  let sectionsSeen = 0;
  for (const { key, page, index } of spellKeys) {
    const value = fields[key]?.trim();
    if (!value) continue;
    if (value.toUpperCase() === "SPELL") {
      sectionsSeen++;
      continue;
    }
    const marker = fields[key.replace(".name.", ".book.")]?.trim().toUpperCase() ?? "";
    const spell: ImportSpell = {
      name: value,
      level: sectionsSeen > 0 ? sectionsSeen - 1 : undefined,
      prepared: marker === "P" || undefined,
    };
    draft.spells.push(
      sectionsSeen > 0
        ? reviewField(spell, "Spell level inferred from sheet sections")
        : confirmedField(spell, `MPMB spell page ${page} row ${index}`),
    );
  }

  // ── Features (limited-use rows read as a summary) ──
  const features = numberedList("Limited Feature", 12);
  if (features.length > 0) {
    draft.notes.features = confirmedField(features.join("\n"), "MPMB limited features");
  }

  return draft;
}
