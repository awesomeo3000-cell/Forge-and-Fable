/**
 * D&D Beyond Flattened PDF Parser (Lane B)
 *
 * D&D Beyond character sheets have a fairly consistent text layout.
 * This module uses label proximity and positional heuristics to extract
 * character data from the raw text items (with coordinates).
 *
 * Approach:
 * 1. Build a spatial index of all text items across all pages.
 * 2. Use known label patterns to find nearby values.
 * 3. Map extracted values into an ImportDraft.
 */

import type { ImportDraft } from "./pdfTypes";
import {
  emptyDraft,
  confirmedField,
  reviewField,
  type ImportAttack,
  type ImportSpell,
} from "./pdfTypes";
import type { ImportSource } from "./pdfTypes";
import type { AbilityKey } from "@/types/game";

// ── Text item with position ──

type TextItem = {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
};

// ── Ability mapping ──

const ABILITY_LABELS: Record<string, AbilityKey> = {
  "str": "strength",
  "strength": "strength",
  "dex": "dexterity",
  "dexterity": "dexterity",
  "con": "constitution",
  "constitution": "constitution",
  "int": "intelligence",
  "intelligence": "intelligence",
  "wis": "wisdom",
  "wisdom": "wisdom",
  "cha": "charisma",
  "charisma": "charisma",
};

const SKILL_NAMES = new Set([
  "acrobatics", "animal handling", "arcana", "athletics",
  "deception", "history", "insight", "intimidation", "investigation",
  "medicine", "nature", "perception", "performance", "persuasion",
  "religion", "sleight of hand", "stealth", "survival",
]);

// ── Helpers ──

/** Flatten all text items across pages into a single array. */
function flattenItems(
  pageTexts: Array<{ page: number; text: string; items: Array<{ str: string; x: number; y: number; width: number; height: number }> }>,
): TextItem[] {
  const result: TextItem[] = [];
  for (const page of pageTexts) {
    for (const item of page.items) {
      result.push({ ...item, page: page.page });
    }
  }
  return result;
}

/** Normalize a string for matching. */
function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
}

/** Find the closest text item to the right of a given item, within a threshold. */
function findRightNeighbor(
  items: TextItem[],
  ref: TextItem,
  maxGap: number = 120,
): TextItem | null {
  let best: TextItem | null = null;
  let bestDist = Infinity;
  for (const item of items) {
    if (item === ref) continue;
    if (item.page !== ref.page) continue;
    const dx = item.x - (ref.x + ref.width);
    const dy = Math.abs(item.y - ref.y);
    if (dx > 0 && dx < maxGap && dy < 12) {
      if (dx < bestDist) {
        bestDist = dx;
        best = item;
      }
    }
  }
  return best;
}

/** Find the closest text item below a given item, within a threshold. */
function findBelowNeighbor(
  items: TextItem[],
  ref: TextItem,
  maxGap: number = 30,
): TextItem | null {
  let best: TextItem | null = null;
  let bestDist = Infinity;
  for (const item of items) {
    if (item === ref) continue;
    if (item.page !== ref.page) continue;
    const dy = ref.y - item.y; // PDF y increases upward
    const dx = Math.abs(item.x - ref.x);
    if (dy > 0 && dy < maxGap && dx < 60) {
      if (dy < bestDist) {
        bestDist = dy;
        best = item;
      }
    }
  }
  return best;
}

/** Try to parse a string as an integer. */
function tryParseInt(s: string): number | null {
  const match = s.match(/([+-]?\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

// ── Main parser ──

export function analyzeDndBeyondPdf(
  pageTexts: Array<{ page: number; text: string; items: Array<{ str: string; x: number; y: number; width: number; height: number }> }>,
  source: ImportSource,
): ImportDraft {
  const draft = emptyDraft();
  draft.source = source;

  const allItems = flattenItems(pageTexts);

  // ── Page 1: identity, abilities, vitals, attacks ──
  const page1 = pageTexts.find((p) => p.page === 1);
  if (page1) {
    parseIdentity(draft, page1.items);
    parseAbilities(draft, allItems.filter((i) => i.page === 1));
    parseVitals(draft, allItems.filter((i) => i.page === 1));
    parseSavingThrows(draft, allItems.filter((i) => i.page === 1));
    parseSkills(draft, allItems.filter((i) => i.page === 1));
    parseProficiencies(draft, allItems.filter((i) => i.page === 1));
    parseAttacks(draft, allItems.filter((i) => i.page === 1));
  }

  // ── Pages 2-4: features, equipment ──
  const featuresItems = allItems.filter((i) => i.page >= 2 && i.page <= 4);
  parseFeaturesText(draft, featuresItems);

  // ── Pages 6-7: spells ──
  const spellItems = allItems.filter((i) => i.page >= 6 && i.page <= 7);
  parseSpells(draft, spellItems);

  // ── Page 5: notes, personality ──
  const page5Items = allItems.filter((i) => i.page === 5);
  parseNotes(draft, page5Items);

  return draft;
}

// ── Section parsers ──

function parseIdentity(
  draft: ImportDraft,
  items: Array<{ str: string; x: number; y: number; width: number; height: number }>,
): void {
  // D&D Beyond page 1: character name is usually the largest text at the top
  // Look for large text in the top-left region
  const topItems = items.filter((i) => i.y > 680 && i.height > 10);

  // Sort by height descending — the name is often the biggest text
  topItems.sort((a, b) => b.height - a.height);

  if (topItems.length > 0) {
    draft.identity.name = confirmedField(topItems[0].str.trim(), "D&D Beyond page 1 banner");
  }

  // Class & level: look for pattern like "Paladin 8" or "Class & Level" label
  const allText = items.map((i) => i.str).join(" ");
  const classLevelMatch = allText.match(/(\w+)\s+(\d{1,2})\s*(?:Class|Level|XP)/i);
  if (classLevelMatch) {
    draft.identity.className = reviewField(classLevelMatch[1], "Detected near Class & Level label");
    draft.identity.level = reviewField(parseInt(classLevelMatch[2], 10), "Detected near Class & Level label");
  }

  // Try to find species/race
  const raceMatch = allText.match(/(?:race|species)[:\s]*(\w+)/i);
  if (raceMatch) {
    draft.identity.species = reviewField(raceMatch[1], "Detected near Race/Species label");
  }

  // Try background
  const bgMatch = allText.match(/(?:background)[:\s]*(\w[\w\s]+?)(?:\s{2,}|$)/i);
  if (bgMatch) {
    draft.identity.background = reviewField(bgMatch[1].trim(), "Detected near Background label");
  }

  // Fallback: scan for known class names
  if (!draft.identity.className.value) {
    const knownClasses = ["barbarian", "bard", "cleric", "druid", "fighter", "monk", "paladin", "ranger", "rogue", "sorcerer", "warlock", "wizard", "artificer"];
    for (const cls of knownClasses) {
      if (allText.toLowerCase().includes(cls)) {
        draft.identity.className = reviewField(cls.charAt(0).toUpperCase() + cls.slice(1), "Found class name in page text");
        break;
      }
    }
  }
}

function parseAbilities(
  draft: ImportDraft,
  items: Array<{ str: string; x: number; y: number; width: number; height: number }>,
): void {
  // D&D Beyond: ability scores are in a vertical column on the left
  // Labels are: STR, DEX, CON, INT, WIS, CHA (or full names)
  // The score number is typically large and nearby

  const abilityOrder: Array<{ label: string; key: AbilityKey }> = [
    { label: "str", key: "strength" },
    { label: "dex", key: "dexterity" },
    { label: "con", key: "constitution" },
    { label: "int", key: "intelligence" },
    { label: "wis", key: "wisdom" },
    { label: "cha", key: "charisma" },
  ];

  // Find all potential ability label items
  const labelItems = items.filter((i) => {
    const n = norm(i.str);
    return n === "str" || n === "dex" || n === "con" || n === "int" || n === "wis" || n === "cha" ||
      n === "strength" || n === "dexterity" || n === "constitution" || n === "intelligence" || n === "wisdom" || n === "charisma";
  });

  for (const labelItem of labelItems) {
    const n = norm(labelItem.str);
    const key = ABILITY_LABELS[n];
    if (!key) continue;

    // The score is usually a large number to the right or below the label
    // First try right neighbor
    const rightNeighbor = findRightNeighbor(items as TextItem[], labelItem as TextItem, 80);
    if (rightNeighbor) {
      const score = tryParseInt(rightNeighbor.str);
      if (score !== null && score >= 3 && score <= 30) {
        draft.abilities[key] = confirmedField(score, `Page 1 near ${labelItem.str} label`);
        continue;
      }
    }

    // Try below neighbor
    const belowNeighbor = findBelowNeighbor(items as TextItem[], labelItem as TextItem, 40);
    if (belowNeighbor) {
      const score = tryParseInt(belowNeighbor.str);
      if (score !== null && score >= 3 && score <= 30) {
        draft.abilities[key] = confirmedField(score, `Page 1 near ${labelItem.str} label`);
        continue;
      }
    }

    // Try any nearby number
    const nearby = items
      .filter((i) => Math.abs(i.x - labelItem.x) < 100 && Math.abs(i.y - labelItem.y) < 40 && i !== labelItem)
      .map((i) => tryParseInt(i.str))
      .find((v) => v !== null && v >= 3 && v <= 30);

    if (nearby) {
      draft.abilities[key] = reviewField(nearby, `Found near ${labelItem.str}`);
    }
  }

  // Fallback: scan for patterns like "STR 19" or "Strength 19"
  const joined = items.map((i) => i.str).join("  ");
  for (const { label, key } of abilityOrder) {
    if (draft.abilities[key].confidence !== "missing") continue;
    const regex = new RegExp(`${label}\\s*[:\\s]\\s*(\\d{1,2})`, "i");
    const match = joined.match(regex);
    if (match) {
      const score = parseInt(match[1], 10);
      if (score >= 3 && score <= 30) {
        draft.abilities[key] = reviewField(score, `Pattern match "${label} ${score}"`);
      }
    }
  }
}

function parseVitals(
  draft: ImportDraft,
  items: Array<{ str: string; x: number; y: number; width: number; height: number }>,
): void {
  const allText = items.map((i) => i.str).join(" ");

  // HP: look for "HIT POINTS" or "HP" followed by numbers
  const hpMatch = allText.match(/(?:hit\s*points?|hp|maximum\s*hp)[:\s]*(\d+)/i);
  if (hpMatch) {
    draft.vitals.maxHp = reviewField(parseInt(hpMatch[1], 10), "Found near HP label");
  }

  // AC: look for "ARMOR CLASS" or "AC" followed by a number
  const acMatch = allText.match(/(?:armou?r\s*class|ac)[:\s]*(\d{1,2})/i);
  if (acMatch) {
    draft.vitals.armorClass = reviewField(parseInt(acMatch[1], 10), "Found near AC label");
  }

  // Initiative
  const initMatch = allText.match(/(?:initiative)[:\s]*([+-]?\s*\d+)/i);
  if (initMatch) {
    draft.vitals.initiative = reviewField(parseInt(initMatch[1].replace(/\s+/g, ""), 10), "Found near Initiative label");
  }

  // Speed
  const speedMatch = allText.match(/(?:speed)[:\s]*(\d+\s*(?:ft\.?|feet)?)/i);
  if (speedMatch) {
    draft.vitals.speed = reviewField(speedMatch[1].trim(), "Found near Speed label");
  }
}

function parseSavingThrows(
  draft: ImportDraft,
  items: Array<{ str: string; x: number; y: number; width: number; height: number }>,
): void {
  const proficiencies: string[] = [];
  const allText = items.map((i) => i.str).join(" ");

  // Look for filled proficiency dots or circled labels near saving throw section
  // In D&D Beyond text extraction, proficient saves often have a filled circle (●) nearby
  // or the label appears with a bonus value

  const saveSection = allText.match(/SAVING THROWS([\s\S]*?)(?:SKILLS|PROFICIENCIES|$)/i);
  const saveText = saveSection ? saveSection[1] : allText;

  for (const [label, key] of Object.entries(ABILITY_LABELS)) {
    if (label.length > 3) continue; // only check short forms
    // Check if there's a filled marker near this save
    const markerPattern = new RegExp(`${label}\\s*[●✓✔⚫]`, "i");
    if (markerPattern.test(saveText)) {
      proficiencies.push(key);
    }
  }

  if (proficiencies.length > 0) {
    draft.proficiencies.savingThrows = confirmedField(proficiencies, "Detected proficiency markers");
  }

  // Fallback: check for numbers that look like save bonuses (PB + ability mod)
  // This is heuristic — skip for now
}

function parseSkills(
  draft: ImportDraft,
  items: Array<{ str: string; x: number; y: number; width: number; height: number }>,
): void {
  const proficiencies: string[] = [];
  const allText = items.map((i) => i.str).join(" ");

  // Look for skill section
  const skillSection = allText.match(/SKILLS([\s\S]*?)(?:PROFICIENCIES|ATTACKS|$)/i);
  const skillText = skillSection ? skillSection[1] : "";

  for (const skill of SKILL_NAMES) {
    // Check if skill name appears with a proficiency marker
    const pattern = new RegExp(`${skill.replace(/\s+/g, "\\s*")}\\s*[●✓✔⚫]`, "i");
    if (pattern.test(skillText)) {
      proficiencies.push(skill);
    }
    // Also check for filled circle before the skill name
    const pattern2 = new RegExp(`[●✓✔⚫]\\s*${skill.replace(/\s+/g, "\\s*")}`, "i");
    if (pattern2.test(skillText) && !proficiencies.includes(skill)) {
      proficiencies.push(skill);
    }
  }

  if (proficiencies.length > 0) {
    draft.proficiencies.skills = confirmedField(proficiencies, "Detected proficiency markers");
  }
}

function parseProficiencies(
  draft: ImportDraft,
  items: Array<{ str: string; x: number; y: number; width: number; height: number }>,
): void {
  const allText = items.map((i) => i.str).join(" ");

  // Look for "PROFICIENCIES & LANGUAGES" or similar section
  const profMatch = allText.match(/(?:PROFICIENCIES\s*&?\s*LANGUAGES|OTHER PROFICIENCIES)([\s\S]*?)(?:FEATURES|ATTACKS|$)/i);
  if (!profMatch) return;

  const profText = profMatch[1];

  // Armor
  const armorTypes = ["light armor", "medium armor", "heavy armor", "shields"];
  const foundArmor = armorTypes.filter((a) => profText.toLowerCase().includes(a));
  if (foundArmor.length > 0) {
    draft.proficiencies.armor = confirmedField(foundArmor, "PROFICIENCIES section");
  }

  // Weapons
  const weaponKws = ["simple weapons", "martial weapons", "improvised weapons"];
  const foundWeapons = weaponKws.filter((w) => profText.toLowerCase().includes(w));
  if (foundWeapons.length > 0) {
    draft.proficiencies.weapons = confirmedField(foundWeapons, "PROFICIENCIES section");
  }

  // Languages
  const langMatch = profText.match(/(?:languages?)[:\s]*([\w\s,]+?)(?:\.|$|\s{2,})/i);
  if (langMatch) {
    const langs = langMatch[1].split(/[,;]/).map((l) => l.trim()).filter(Boolean);
    if (langs.length > 0) {
      draft.proficiencies.languages = confirmedField(langs, "PROFICIENCIES section");
    }
  }

  // Tools
  const toolMatch = profText.match(/(?:tools?)[:\s]*([\w\s,]+?)(?:\.|$|\s{2,})/i);
  if (toolMatch) {
    const tools = toolMatch[1].split(/[,;]/).map((t) => t.trim()).filter(Boolean);
    if (tools.length > 0) {
      draft.proficiencies.tools = confirmedField(tools, "PROFICIENCIES section");
    }
  }
}

function parseAttacks(
  draft: ImportDraft,
  items: Array<{ str: string; x: number; y: number; width: number; height: number }>,
): void {
  const allText = items.map((i) => i.str).join(" ");

  // Look for attack rows in the bottom area
  // D&D Beyond: "ATTACKS & SPELLCASTING" section with table rows
  const attackSection = allText.match(/(?:ATTACKS\s*&?\s*SPELLCASTING|ACTIONS)([\s\S]*?)(?:EQUIPMENT|FEATURES|$)/i);
  const attackText = attackSection ? attackSection[1] : "";

  if (!attackText) return;

  // Try to find weapon name patterns followed by to-hit and damage
  // Pattern: "WeaponName +X 1dY+Z damageType"
  const weaponPattern = /([\w\s]+?)\s+([+-]\d+)\s+(\d+d\d+(?:[+-]\d+)?(?:\s+\w+)?)/gi;
  let match: RegExpExecArray | null;

  while ((match = weaponPattern.exec(attackText)) !== null) {
    const name = match[1].trim();
    // Skip non-weapon matches
    if (name.length < 2 || name.length > 40) continue;
    if (/^(name|atk|bonus|damage|type|actions|attacks)$/i.test(name)) continue;

    const attack: ImportAttack = {
      name,
      hit: match[2],
      damage: match[3].trim(),
      notes: "",
    };
    draft.attacks.push(confirmedField(attack, "ATTACKS section"));
  }

  // If no weapon rows found, try a simpler pattern
  if (draft.attacks.length === 0) {
    // Look for lines containing both "+" and "d" (to-hit and damage dice)
    const lines = attackText.split(/\s{2,}/);
    for (const line of lines) {
      const hasToHit = /[+-]\d+/.test(line);
      const hasDice = /\d+d\d+/.test(line);
      if (hasToHit && hasDice && line.length < 80) {
        const attack: ImportAttack = {
          name: line.replace(/[+-]\d+.*$/, "").trim(),
          hit: line.match(/[+-]\d+/)?.[0] ?? "?",
          damage: line.match(/\d+d\d+(?:[+-]\d+)?/)?.[0] ?? "?",
          notes: "",
        };
        draft.attacks.push(reviewField(attack, "Heuristic match in attacks area"));
      }
    }
  }
}

function parseFeaturesText(
  draft: ImportDraft,
  items: Array<{ str: string; x: number; y: number; width: number; height: number }>,
): void {
  const allText = items.map((i) => i.str).join(" ");
  if (allText.length > 0) {
    draft.notes.features = reviewField(allText.slice(0, 2000), "Pages 2-4 features text");
  }
}

function parseSpells(
  draft: ImportDraft,
  items: Array<{ str: string; x: number; y: number; width: number; height: number }>,
): void {
  const allText = items.map((i) => i.str).join(" ");
  if (!allText) return;

  // Look for known spell names in the text
  // We'll import the spell catalog lazily — for now, detect common patterns
  const spellPatterns = [
    /(?:Cantrips?\s*(?:\([^)]+\))?\s*:?\s*)([\w\s,]+?)(?:1st|Level\s*1|$)/i,
    /(?:1st\s*Level|Level\s*1)\s*:?\s*([\w\s,]+?)(?:2nd|Level\s*2|$)/i,
    /(?:2nd\s*Level|Level\s*2)\s*:?\s*([\w\s,]+?)(?:3rd|Level\s*3|$)/i,
    /(?:3rd\s*Level|Level\s*3)\s*:?\s*([\w\s,]+?)(?:4th|Level\s*4|$)/i,
  ];

  for (const pattern of spellPatterns) {
    const match = allText.match(pattern);
    if (match) {
      const spellList = match[1].split(/[,;]/).map((s) => s.trim()).filter((s) => s.length > 2 && s.length < 40);
      for (const spellName of spellList) {
        const spell: ImportSpell = { name: spellName };
        draft.spells.push(reviewField(spell, "Detected in spell list"));
      }
    }
  }

  // Fallback: extract individual spell-looking names
  if (draft.spells.length === 0) {
    // Look for capitalized words that might be spell names
    const words = allText.split(/\s+/);
    const potentialSpells = words.filter((w) =>
      /^[A-Z][a-z]+(?:\s[A-Z][a-z]+)*$/.test(w) &&
      w.length > 3 &&
      w.length < 30 &&
      !["The", "This", "That", "When", "With", "From", "Your", "Each", "Once"].includes(w)
    );

    // Limit to reasonable count
    const unique = [...new Set(potentialSpells)].slice(0, 30);
    for (const name of unique) {
      const spell: ImportSpell = { name };
      draft.spells.push(reviewField(spell, "Potential spell name"));
    }
  }
}

function parseNotes(
  draft: ImportDraft,
  items: Array<{ str: string; x: number; y: number; width: number; height: number }>,
): void {
  const allText = items.map((i) => i.str).join(" ");

  // Personality traits
  const persMatch = allText.match(/(?:PERSONALITY\s*TRAITS?)[:\s]*([\s\S]*?)(?:IDEALS|BONDS|FLAWS|$)/i);
  if (persMatch) {
    draft.notes.personality = reviewField(persMatch[1].trim().slice(0, 500), "Page 5 personality traits");
  }

  // Backstory / appearance
  const appearMatch = allText.match(/(?:APPEARANCE|CHARACTER\s*APPEARANCE)[:\s]*([\s\S]*?)(?:BACKSTORY|NOTES|ALLIES|$)/i);
  if (appearMatch) {
    draft.notes.appearance = reviewField(appearMatch[1].trim().slice(0, 500), "Page 5 appearance");
  }

  const backMatch = allText.match(/(?:BACKSTORY|CHARACTER\s*BACKSTORY)[:\s]*([\s\S]*?)(?:NOTES|ALLIES|$)/i);
  if (backMatch) {
    draft.notes.backstory = reviewField(backMatch[1].trim().slice(0, 2000), "Page 5 backstory");
  }
}
