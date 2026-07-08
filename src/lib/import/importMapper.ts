/**
 * Import Mapper
 *
 * Maps raw extracted data (form fields, generic text) into ImportDraft.
 */

import type { ImportDraft, ImportSource } from "./pdfTypes";
import { emptyDraft, confirmedField, reviewField } from "./pdfTypes";
import type { AbilityKey } from "@/types/game";

// ── Form field mapping (Lane A) ──

/** Known D&D Beyond / standard fillable PDF field name mappings. */
const FORM_FIELD_MAP: Record<string, { target: string; type: "identity" | "ability" | "vital" | "prof" | "other" }> = {
  // Identity
  "CharacterName": { target: "name", type: "identity" },
  "ClassLevel": { target: "classLevel", type: "identity" },
  "Race": { target: "species", type: "identity" },
  "Species": { target: "species", type: "identity" },
  "Background": { target: "background", type: "identity" },
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
  "HPCurrent": { target: "currentHp", type: "vital" },
  "HPTemp": { target: "tempHp", type: "vital" },
  "Initiative": { target: "initiative", type: "vital" },
  "Speed": { target: "speed", type: "vital" },

  // Proficiencies
  "Proficiencies": { target: "proficiencies", type: "prof" },
  "Languages": { target: "languages", type: "prof" },
  "Tools": { target: "tools", type: "prof" },
};

export function mapFormFieldsToDraft(
  fields: Record<string, string>,
  source: ImportSource,
): ImportDraft {
  const draft = emptyDraft();
  draft.source = source;

  for (const [fieldName, fieldValue] of Object.entries(fields)) {
    const mapping = FORM_FIELD_MAP[fieldName];
    if (!mapping) continue;

    const trimmed = fieldValue.trim();
    if (!trimmed) continue;

    switch (mapping.type) {
      case "identity": {
        if (mapping.target === "name") {
          draft.identity.name = confirmedField(trimmed, `Form field: ${fieldName}`);
        } else if (mapping.target === "classLevel") {
          // Parse "Paladin 8" format
          const parts = trimmed.match(/^(\w+)\s+(\d+)$/);
          if (parts) {
            draft.identity.className = confirmedField(parts[1], `Form field: ${fieldName}`);
            draft.identity.level = confirmedField(parseInt(parts[2], 10), `Form field: ${fieldName}`);
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
        const num = parseInt(trimmed, 10);
        if (!isNaN(num)) {
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
        }
        break;
      }
    }
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
