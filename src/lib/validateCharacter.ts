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
  "equipment", "preparedSpells", "spellStatuses", "heroicInspiration", "effects",
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
      case "spellStatuses":
        if (val !== undefined) {
          if (typeof val !== "object" || val === null || Array.isArray(val)) {
            throw new Error(`"spellStatuses" must be an object.`);
          }
          const entries = Object.entries(val as Record<string, unknown>);
          if (entries.length > 200) throw new Error(`"spellStatuses" must have at most 200 entries.`);
          for (const [spellId, entry] of entries) {
            assertString(spellId, "spellStatuses key", 128);
            if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
              throw new Error(`"spellStatuses" entries must be objects.`);
            }
            const status = entry as Record<string, unknown>;
            if (status.source !== undefined) assertString(status.source, "spellStatuses[].source", 80);
            if (status.freeUse !== undefined && typeof status.freeUse !== "boolean") {
              throw new Error(`"spellStatuses[].freeUse" must be a boolean.`);
            }
            if (status.freeUsed !== undefined && typeof status.freeUsed !== "boolean") {
              throw new Error(`"spellStatuses[].freeUsed" must be a boolean.`);
            }
          }
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
      case "effects":
        if (val !== undefined) {
          assertArray(val, "effects");
          if (val.length > 40) throw new Error(`"effects" must have at most 40 entries.`);
          for (const entry of val) {
            if (!entry || typeof entry !== "object" || Array.isArray(entry)) throw new Error(`"effects" entries must be objects.`);
            const e = entry as Record<string, unknown>;
            assertString(e.label, "effects[].label", 48);
            if (!(e.label as string).trim()) throw new Error(`"effects[].label" is required.`);
            if (typeof e.active !== "boolean") throw new Error(`"effects[].active" must be a boolean.`);
            for (const k of ["ac", "attack", "damage", "saves", "checks", "initiative"]) {
              if (e[k] !== undefined) assertInteger(e[k], `effects[].${k}`, -20, 20);
            }
            if (e.d20Dice !== undefined && (typeof e.d20Dice !== "string" || !/^[1-9]d(4|6|8|10|12|20|100)$/.test(e.d20Dice))) {
              throw new Error(`"effects[].d20Dice" must look like "1d4".`);
            }
            if (e.sense !== undefined) assertString(e.sense, "effects[].sense", 48);
            if (e.source !== undefined) assertString(e.source, "effects[].source", 24);
          }
        }
        break;
      case "asiChoices":
        if (val !== undefined) {
          assertArray(val, "asiChoices");
          if (val.length > 30) throw new Error(`"asiChoices" must have at most 30 entries.`);
          for (const entry of val) {
            if (!entry || typeof entry !== "object" || Array.isArray(entry)) throw new Error(`"asiChoices" entries must be objects.`);
            const c = entry as Record<string, unknown>;
            if (c.type !== "asi" && c.type !== "feat") throw new Error(`"asiChoices[].type" must be "asi" or "feat".`);
            assertInteger(c.level, "asiChoices[].level", 1, 20);
            if (c.type === "feat") {
              assertString(c.featId, "asiChoices[].featId", 64);
              if (c.abilityChoice !== undefined) {
                if (!ABILITY_KEYS.includes(c.abilityChoice as string)) {
                  throw new Error(`"asiChoices[].abilityChoice" must be a valid ability key.`);
                }
              }
            }
          }
        }
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
