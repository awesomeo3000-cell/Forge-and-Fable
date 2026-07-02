const ABILITY_KEYS = ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"];

function assertString(val: unknown, name: string, maxLen?: number): asserts val is string {
  if (typeof val !== "string") throw new Error(`"${name}" must be a string.`);
  if (maxLen !== undefined && val.length > maxLen) throw new Error(`"${name}" must be at most ${maxLen} characters.`);
}

function assertInteger(val: unknown, name: string, min?: number, max?: number): asserts val is number {
  if (typeof val !== "number" || !Number.isFinite(val) || !Number.isInteger(val)) {
    throw new Error(`"${name}" must be an integer.`);
  }
  if (min !== undefined && val < min) throw new Error(`"${name}" must be at least ${min}.`);
  if (max !== undefined && val > max) throw new Error(`"${name}" must be at most ${max}.`);
}

function assertArray(val: unknown, name: string): asserts val is unknown[] {
  if (!Array.isArray(val)) throw new Error(`"${name}" must be an array.`);
}

/** Fields that may be updated via PATCH or set at creation. id, userId, and createdAt are immutable. */
export const ALLOWED_PATCH_FIELDS = new Set([
  "name", "level", "alignment", "background",
  "physicalCharacteristics", "personalCharacteristics", "generalNotes",
  "raceId", "classId", "sourceIds", "settings",
  "abilities", "currentHp", "maxHp", "tempHp",
  "inventory", "spellsKnown", "customRules",
  "skillProficiencies", "savingThrowProficiencies",
  "deathSaves", "theme", "sheetLayout",
  "spellSlotsUsed", "pactSlotsUsed", "concentratingOn",
  "subclassId", "asiChoices", "hpRolls", "hitDiceSpent",
  "equipment", "preparedSpells", "heroicInspiration",
]);

/** Validate a character creation payload or partial update patch. */
export function validateCharacterInput(raw: unknown, isPatch: boolean): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Body must be a JSON object.");
  }

  const obj = raw as Record<string, unknown>;
  const sanitized: Record<string, unknown> = {};

  for (const key of Object.keys(obj)) {
    if (!ALLOWED_PATCH_FIELDS.has(key)) {
      throw new Error(`Field "${key}" is not allowed.`);
    }

    const val = obj[key];

    switch (key) {
      case "name":
        if (!isPatch) assertString(val, "name", 100);
        else if (val !== undefined) assertString(val, "name", 100);
        break;
      case "level":
        if (!isPatch) assertInteger(val, "level", 1, 20);
        else if (val !== undefined) assertInteger(val, "level", 1, 20);
        break;
      case "currentHp":
      case "tempHp":
        if (val !== undefined) assertInteger(val, key, 0, 999);
        break;
      case "maxHp":
        if (val !== undefined) assertInteger(val, "maxHp", 1, 999);
        break;
      case "abilities":
        if (val !== undefined) {
          if (typeof val !== "object" || val === null) throw new Error(`"abilities" must be an object.`);
          const abilities = val as Record<string, unknown>;
          for (const a of ABILITY_KEYS) {
            // Assert every present key is an integer 1–30 regardless of type.
            // Previously we only checked if typeof === "number", which let
            // non-number values (e.g. "cat") through silently.
            if (a in abilities) {
              assertInteger(abilities[a], `abilities.${a}`, 1, 30);
            }
          }
        }
        break;
      case "inventory":
      case "spellsKnown":
      case "skillProficiencies":
      case "preparedSpells":
        if (val !== undefined) assertArray(val, key);
        break;
      case "equipment":
        if (val !== undefined && (typeof val !== "object" || val === null || Array.isArray(val))) {
          throw new Error(`"equipment" must be an object.`);
        }
        break;
      case "customRules":
        if (val !== undefined) assertArray(val, "customRules");
        break;
      case "hpRolls":
        if (val !== undefined) assertArray(val, "hpRolls");
        break;
      case "hitDiceSpent":
        if (val !== undefined) assertInteger(val, "hitDiceSpent", 0, 20);
        break;
      case "heroicInspiration":
        if (val !== undefined && typeof val !== "boolean") throw new Error(`"heroicInspiration" must be a boolean.`);
        break;
      case "theme":
        if (val !== undefined && val !== null) {
          if (typeof val !== "object" || Array.isArray(val)) throw new Error(`"theme" must be an object.`);
          const bg = (val as Record<string, unknown>).backgroundImageUrl;
          if (bg !== undefined && (typeof bg !== "string" || bg.length > 500 || !/^https?:\/\//i.test(bg))) {
            throw new Error(`"theme.backgroundImageUrl" must be an http(s) URL of at most 500 characters.`);
          }
        }
        break;
    }

    sanitized[key] = val;
  }

  // Full creation requires a name
  if (!isPatch && !sanitized.name) {
    throw new Error(`"name" is required.`);
  }

  return sanitized;
}
