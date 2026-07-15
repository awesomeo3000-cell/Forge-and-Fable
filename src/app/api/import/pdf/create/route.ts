/**
 * POST /api/import/pdf/create
 *
 * Accepts a reviewed ImportDraft and creates a real Dreamwright character.
 * Validates through the normal character validation pipeline.
 */

import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import rawSpells from "@/data/spells.json";
import { authenticateRequest, AuthError } from "@/lib/auth";
import { createCharacter } from "@/lib/vaultStore";
import { validateCharacterInput } from "@/lib/validateCharacter";
import type { ImportDraft } from "@/lib/import/pdfTypes";
import type {
  AbilityKey,
  AbilityScores,
  Character,
  CharacterPage,
  CustomRule,
  Equipment,
  InventoryItem,
  PageBlock,
  SpellData,
} from "@/types/game";
import { ruleset } from "@/lib/ruleset";
import { SKILLS } from "@/lib/srd";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const abilityKeys = ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"] as const;

function normalizeLookup(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((value) => value?.trim() ?? "").filter(Boolean)));
}

function requireText(value: string | null | undefined, label: string) {
  const clean = value?.trim();
  if (!clean) throw new Error(`${label} is required before importing.`);
  return clean;
}

function requireInteger(value: number | null | undefined, label: string, min: number, max: number) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${label} must be a whole number from ${min} to ${max}.`);
  }
  return value;
}

function optionalInteger(value: number | null | undefined, fallback: number, min: number, max: number) {
  if (typeof value !== "number" || !Number.isInteger(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function abilityModifier(score: number) {
  return Math.floor((score - 10) / 2);
}

function findNamedId<T extends { id: string; name: string }>(items: T[], rawName: string, label: string) {
  const wanted = normalizeLookup(rawName);
  const exact = items.find((item) => normalizeLookup(item.name) === wanted || normalizeLookup(item.id) === wanted);
  if (exact) return exact.id;

  const partial = items.filter((item) => {
    const itemName = normalizeLookup(item.name);
    return itemName.includes(wanted) || wanted.includes(itemName);
  });

  if (partial.length === 1) return partial[0].id;
  if (partial.length > 1) {
    throw new Error(`${label} "${rawName}" matches more than one option. Please make it more specific before importing.`);
  }

  throw new Error(`${label} "${rawName}" is not in this ruleset. Please correct it before importing.`);
}

function mapAbilityName(value: string): AbilityKey | null {
  const normalized = normalizeLookup(value);
  const aliases: Record<string, AbilityKey> = {
    str: "strength",
    strength: "strength",
    dex: "dexterity",
    dexterity: "dexterity",
    con: "constitution",
    constitution: "constitution",
    int: "intelligence",
    intelligence: "intelligence",
    wis: "wisdom",
    wisdom: "wisdom",
    cha: "charisma",
    charisma: "charisma",
  };
  return aliases[normalized] ?? null;
}

function mapSkillIds(rawSkills: string[] | null | undefined) {
  const skillByName = new Map(SKILLS.map((skill) => [normalizeLookup(skill.name), skill.id]));
  return uniqueStrings(
    (rawSkills ?? [])
      .map((skill) => skillByName.get(normalizeLookup(skill)) ?? "")
      .filter(Boolean),
  );
}

function mapSavingThrows(rawSaves: string[] | null | undefined) {
  return uniqueStrings(
    (rawSaves ?? [])
      .map((save) => mapAbilityName(save))
      .filter((save): save is AbilityKey => Boolean(save)),
  ) as AbilityKey[];
}

function splitDamage(rawDamage: string | undefined) {
  const text = rawDamage?.trim() ?? "";
  const match = text.match(/(\d+d\d+(?:\s*[+-]\s*\d+)?|\d+)\s*([a-zA-Z][a-zA-Z\s]*)?/);
  if (!match) return { damage: text, damageType: "" };
  return {
    damage: match[1].replace(/\s+/g, ""),
    damageType: (match[2] ?? "").trim(),
  };
}

function importedInventoryItem(name: string, notes: string, extra: Partial<InventoryItem> = {}): InventoryItem {
  return {
    id: randomUUID(),
    name,
    rarity: "Common",
    attunement: false,
    notes,
    ...extra,
  };
}

function importedAttackToWeapon(attack: NonNullable<ImportDraft["attacks"][number]["value"]>) {
  const damage = splitDamage(attack.damage);
  const notes = uniqueStrings([attack.hit ? `To hit ${attack.hit}` : "", attack.notes]).join(" | ");
  return importedInventoryItem(attack.name, notes, {
    category: "Weapon",
    classification: "Imported weapon",
    damage: damage.damage,
    damageType: damage.damageType,
    properties: attack.notes,
  });
}

function mapSpells(spells: ImportDraft["spells"]) {
  const spellByName = new Map(
    (rawSpells as SpellData[]).map((spell) => [normalizeLookup(spell.name), spell]),
  );
  const spellIds: string[] = [];
  const preparedIds: string[] = [];
  const unmatched: string[] = [];

  for (const field of spells) {
    const spellName = field.value?.name?.trim();
    if (!spellName) continue;
    const match = spellByName.get(normalizeLookup(spellName));
    if (!match) {
      unmatched.push(spellName);
      continue;
    }
    spellIds.push(match.id);
    if (field.value?.prepared) preparedIds.push(match.id);
  }

  return {
    spellIds: uniqueStrings(spellIds),
    preparedIds: uniqueStrings(preparedIds),
    unmatched: uniqueStrings(unmatched),
  };
}

function addTextPage(pages: CharacterPage[], title: string, content: string | null | undefined) {
  const clean = content?.trim();
  if (!clean) return;

  const blocks: PageBlock[] = [
    { id: randomUUID(), type: "text", content: clean.slice(0, 5000) },
  ];
  pages.push({ id: randomUUID(), title, blocks });
}

function makeCustomRules(draft: ImportDraft, abilities: AbilityScores): CustomRule[] {
  const rules: CustomRule[] = [];
  const dexMod = abilityModifier(abilities.dexterity);
  const importedAc = draft.vitals.armorClass.value;
  const importedInitiative = draft.vitals.initiative.value;

  if (typeof importedAc === "number") {
    const baseAc = 10 + dexMod;
    const acAdjustment = importedAc - baseAc;
    if (acAdjustment !== 0 && acAdjustment >= -20 && acAdjustment <= 20) {
      rules.push({
        id: randomUUID(),
        label: "Imported AC adjustment",
        type: "ac",
        value: acAdjustment,
        source: "PDF import",
      });
    }
  }

  if (typeof importedInitiative === "number") {
    const initiativeAdjustment = importedInitiative - dexMod;
    if (initiativeAdjustment !== 0 && initiativeAdjustment >= -20 && initiativeAdjustment <= 20) {
      rules.push({
        id: randomUUID(),
        label: "Imported initiative adjustment",
        type: "initiative",
        value: initiativeAdjustment,
        source: "PDF import",
      });
    }
  }

  return rules;
}

function draftToCharacterPayload(draft: ImportDraft): Omit<Character, "id" | "userId" | "createdAt"> {
  const name = requireText(draft.identity.name.value, "Character name");
  const className = requireText(draft.identity.className.value, "Class");
  const species = requireText(draft.identity.species.value, "Species");
  const level = requireInteger(draft.identity.level.value, "Level", 1, 20);
  const classId = findNamedId(ruleset.classes, className, "Class");
  const raceId = findNamedId(ruleset.races, species, "Species");

  const missingAbilities = abilityKeys.filter((key) => typeof draft.abilities[key]?.value !== "number");
  if (missingAbilities.length > 0) {
    throw new Error(`Ability scores are required before importing: ${missingAbilities.join(", ")}.`);
  }

  const abilities = Object.fromEntries(
    abilityKeys.map((key) => [key, requireInteger(draft.abilities[key].value, key, 1, 30)]),
  ) as AbilityScores;

  const maxHp = optionalInteger(draft.vitals.maxHp.value, 10, 1, 999);
  const currentHp = optionalInteger(draft.vitals.currentHp.value, maxHp, 0, 999);
  const tempHp = optionalInteger(draft.vitals.tempHp.value, 0, 0, 999);

  const importedItems = (draft.inventory ?? [])
    .map((item) => item.value)
    .filter((item): item is NonNullable<typeof item> => Boolean(item?.name?.trim()))
    .map((item) =>
      importedInventoryItem(item.name.trim(), item.notes ?? "", {
        category: "Other",
        weight: item.weight,
      }),
    );

  const importedWeapons = (draft.attacks ?? [])
    .map((attack) => attack.value)
    .filter((attack): attack is NonNullable<typeof attack> => Boolean(attack?.name?.trim()))
    .map(importedAttackToWeapon);

  const inventory = [...importedItems, ...importedWeapons];
  const equipment: Equipment = importedWeapons.length > 0 ? { weaponItemIds: importedWeapons.map((item) => item.id) } : {};
  const mappedSpells = mapSpells(draft.spells ?? []);
  const pages: CharacterPage[] = [];

  addTextPage(pages, "Imported Features", draft.notes.features.value);
  addTextPage(pages, "Imported Backstory", draft.notes.backstory.value);
  addTextPage(pages, "Imported Personality", draft.notes.personality.value);
  addTextPage(pages, "Unmatched Imported Spells", mappedSpells.unmatched.join(", "));

  return {
    name,
    ruleset: "2014",
    level,
    alignment: "Neutral",
    background: draft.identity.background.value?.trim() ?? "",
    physicalCharacteristics: draft.notes.appearance.value ?? "",
    personalCharacteristics: draft.notes.personality.value ?? "",
    generalNotes: draft.notes.backstory.value ?? "",
    raceId,
    classId,
    sourceIds: ["phb"],
    settings: {
      diceRollingEnabled: true,
      optionalClassFeatures: false,
      customizeOrigin: false,
      advancementType: "milestone",
      hitPointType: "fixed",
      usePrerequisites: true,
      useFeatPrerequisites: true,
      useMulticlassPrerequisites: false,
      showLevelScaledSpells: false,
      encumbranceType: "none",
      ignoreCoinWeight: true,
      modifiersTop: false,
    },
    abilities,
    currentHp,
    maxHp,
    tempHp,
    inventory,
    spellsKnown: mappedSpells.spellIds,
    customRules: makeCustomRules(draft, abilities),
    skillProficiencies: mapSkillIds(draft.proficiencies.skills.value),
    savingThrowProficiencies: mapSavingThrows(draft.proficiencies.savingThrows.value),
    toolProficiencies: uniqueStrings(draft.proficiencies.tools.value ?? []),
    languages: uniqueStrings(draft.proficiencies.languages.value ?? []),
    deathSaves: { successes: 0, failures: 0 },
    theme: null,
    sheetLayout: undefined,
    spellSlotsUsed: {},
    pactSlotsUsed: 0,
    concentratingOn: null,
    subclassId: undefined,
    asiChoices: [],
    hpRolls: [],
    hitDiceSpent: 0,
    equipment,
    preparedSpells: mappedSpells.preparedIds,
    spellStatuses: {},
    heroicInspiration: false,
    effects: [],
    pages,
    currency: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 },
  };
}

export async function POST(request: Request) {
  try {
    const userId = await authenticateRequest(request);
    const body = await request.json();
    const { draft } = body as { draft?: ImportDraft };

    if (!draft) {
      return NextResponse.json({ error: "Draft is required." }, { status: 400 });
    }

    const rawCharacter = draftToCharacterPayload(draft);
    const validated = validateCharacterInput(rawCharacter, false) as Omit<Character, "id" | "userId" | "createdAt">;
    const character = await createCharacter(userId, validated);

    return NextResponse.json({ character }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Failed to create character from import.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
