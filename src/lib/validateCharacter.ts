import { assertSnapshotCharacter } from "@/lib/characterSnapshots";

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

function assertPlainObjectOrString(value: unknown, label: string, maxStringLength = 160, maxObjectJsonLength = 4000): void {
  if (typeof value === "string") {
    assertString(value, label, maxStringLength);
    return;
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`"${label}" must be an object or string.`);
  }

  const json = JSON.stringify(value);
  if (json.length > maxObjectJsonLength) {
    throw new Error(`"${label}" is too large.`);
  }
}

/** Fields that may be updated via PATCH or set at creation. id, userId, and createdAt are immutable. */
export const ALLOWED_PATCH_FIELDS = new Set([
  "name", "level", "alignment", "background",
  "physicalCharacteristics", "personalCharacteristics", "generalNotes",
  "raceId", "classId", "sourceIds", "settings",
  "abilities", "currentHp", "maxHp", "tempHp",
  "inventory", "spellsKnown", "customRules",
  "skillProficiencies", "skillExpertise", "raceBonusChoices", "savingThrowProficiencies",
  "toolProficiencies", "languages", "currency",
  "deathSaves", "theme", "sheetLayout",
  "spellSlotsUsed", "pactSlotsUsed", "concentratingOn",
  "subclassId", "asiChoices", "hpRolls", "hitDiceSpent",
  "equipment", "preparedSpells", "spellStatuses", "heroicInspiration", "effects", "pages", "snapshots",
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
        if (val !== undefined) {
          assertArray(val, key);
          if (val.length > 500) throw new Error(`"${key}" must have at most 500 entries.`);
          for (const entry of val) assertPlainObjectOrString(entry, `${key}[]`);
        }
        break;
      case "spellsKnown":
        if (val !== undefined) {
          assertArray(val, key);
          if (val.length > 300) throw new Error(`"${key}" must have at most 300 entries.`);
          for (const entry of val) assertString(entry, `${key}[]`, 96);
        }
        break;
      case "skillProficiencies":
        if (val !== undefined) {
          assertArray(val, key);
          if (val.length > 64) throw new Error(`"${key}" must have at most 64 entries.`);
          for (const entry of val) assertString(entry, `${key}[]`, 96);
        }
        break;
      case "skillExpertise":
        if (val !== undefined) {
          assertArray(val, key);
          if (val.length > 64) throw new Error(`"${key}" must have at most 64 entries.`);
          for (const entry of val) assertString(entry, `${key}[]`, 96);
        }
        break;
      case "preparedSpells":
        if (val !== undefined) {
          assertArray(val, key);
          for (const entry of val) assertString(entry, `${key}[]`, 128);
        }
        break;
      case "toolProficiencies":
      case "languages":
        if (val !== undefined) {
          assertArray(val, key);
          if (val.length > 40) throw new Error(`"${key}" must have at most 40 entries.`);
          for (const entry of val) assertString(entry, `${key}[]`, 64);
        }
        break;
      case "currency":
        if (val !== undefined) {
          if (typeof val !== "object" || val === null || Array.isArray(val)) {
            throw new Error(`"currency" must be an object.`);
          }
          const currency = val as Record<string, unknown>;
          for (const denomination of ["cp", "sp", "ep", "gp", "pp"]) {
            if (denomination in currency) assertInteger(currency[denomination], `currency.${denomination}`, 0, 999999);
          }
        }
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
        if (val !== undefined) {
          assertArray(val, key);
          if (val.length > 100) throw new Error(`"${key}" must have at most 100 entries.`);
          for (const entry of val) assertPlainObjectOrString(entry, `${key}[]`, 500, 6000);
        }
        break;
      case "hpRolls":
        if (val !== undefined) {
          assertArray(val, key);
          if (val.length > 20) throw new Error(`"${key}" must have at most 20 entries.`);
          for (const roll of val) assertInteger(roll, `${key}[]`, 1, 30);
        }
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
            assertString(e.id, "effects[].id", 64);
            if (!(e.id as string).trim()) throw new Error(`"effects[].id" is required.`);
            for (const k of ["ac", "attack", "damage", "saves", "checks", "initiative"]) {
              if (e[k] !== undefined) assertInteger(e[k], `effects[].${k}`, -20, 20);
            }
            if (e.d20Dice !== undefined && (typeof e.d20Dice !== "string" || !/^[1-9]d(4|6|8|10|12|20|100)$/.test(e.d20Dice))) {
              throw new Error(`"effects[].d20Dice" must look like "1d4".`);
            }
            if (e.sense !== undefined) assertString(e.sense, "effects[].sense", 48);
            if (e.source !== undefined) assertString(e.source, "effects[].source", 24);
            if (e.advantageMode !== undefined && e.advantageMode !== "advantage" && e.advantageMode !== "disadvantage") {
              throw new Error(`"effects[].advantageMode" must be "advantage" or "disadvantage".`);
            }
            if (e.stack !== undefined) assertInteger(e.stack, "effects[].stack", 1, 6);
          }
        }
        break;
      case "pages":
        if (val !== undefined) {
          assertArray(val, "pages");
          if (val.length > 10) throw new Error(`"pages" must have at most 10 entries.`);
          for (const page of val) {
            if (!page || typeof page !== "object" || Array.isArray(page)) throw new Error(`"pages" entries must be objects.`);
            const p = page as Record<string, unknown>;
            assertString(p.id, "pages[].id", 64);
            assertString(p.title, "pages[].title", 60);
            if (!(p.title as string).trim()) throw new Error(`"pages[].title" is required.`);
            assertArray(p.blocks, "pages[].blocks");
            if ((p.blocks as unknown[]).length > 20) throw new Error(`"pages[].blocks" must have at most 20 entries.`);
            for (const block of p.blocks as unknown[]) {
              if (!block || typeof block !== "object" || Array.isArray(block)) throw new Error(`"pages[].blocks" entries must be objects.`);
              const b = block as Record<string, unknown>;
              assertString(b.id, "pages[].blocks[].id", 64);
              if (b.type === "text") {
                assertString(b.content, "pages[].blocks[].content", 5000);
              } else if (b.type === "image") {
                assertString(b.url, "pages[].blocks[].url", 500);
                // Empty string = draft placeholder (block added, URL not typed
                // yet). The client persists immediately on block creation, so
                // rejecting "" here silently discards the whole patch.
                if ((b.url as string) !== "" && !/^https?:\/\//i.test(b.url as string)) {
                  throw new Error(`"pages[].blocks[].url" must be an http(s) URL.`);
                }
                if (b.caption !== undefined) assertString(b.caption, "pages[].blocks[].caption", 120);
              } else {
                throw new Error(`"pages[].blocks[].type" must be "text" or "image".`);
              }
            }
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
      case "snapshots":
        if (val !== undefined) {
          assertArray(val, "snapshots");
          if (val.length > 10) throw new Error(`"snapshots" must have at most 10 entries.`);
          for (const entry of val) {
            if (!entry || typeof entry !== "object" || Array.isArray(entry)) throw new Error(`"snapshots" entries must be objects.`);
            const s = entry as Record<string, unknown>;
            assertString(s.id, "snapshots[].id", 64);
            assertString(s.label, "snapshots[].label", 120);
            assertString(s.createdAt, "snapshots[].createdAt", 40);
            assertSnapshotCharacter(s.character);
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
