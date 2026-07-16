/**
 * Presentation copy and derived display values for the Class chapter
 * (Orrery Path redesign). Everything here is derived from the ruleset's
 * existing class data — no rules are invented and no draft state is read.
 */

import type { HeroClass } from "@/types/game";
import { abilityLabels, abilityNames } from "@/lib/utils";
import { classDescriptor } from "@/lib/ledgerCopy";
import { CLASS_TOOL_CHOICES, CLASS_TOOL_GRANTS } from "@/lib/srd";

/** Short marketing copy per class: one browsing descriptor + a role/identity line. */
export const CLASS_SELECTOR_COPY: Record<string, { description: string; role: string }> = {
  artificer: { description: "Clever inventor and magical engineer", role: "Support & Utility" },
  barbarian: { description: "Relentless frontline bruiser", role: "Durability & Damage" },
  bard: { description: "Charismatic performer and versatile ally", role: "Support & Control" },
  cleric: { description: "Divine champion and steadfast healer", role: "Support & Healing" },
  druid: { description: "Wild spellcaster and shapeshifter", role: "Control & Support" },
  fighter: { description: "Versatile master of weapons and armor", role: "Martial Damage" },
  monk: { description: "Swift martial artist and skirmisher", role: "Mobility & Damage" },
  paladin: { description: "Armored champion bound by an oath", role: "Defense & Support" },
  ranger: { description: "Wilderness hunter and deadly scout", role: "Ranged Damage" },
  rogue: { description: "Elusive expert and precision striker", role: "Precision Damage" },
  sorcerer: { description: "Unstable & explosive spellcaster", role: "Arcane Damage" },
  warlock: { description: "Pact-bound caster with forbidden power", role: "Arcane Damage" },
  wizard: { description: "Studied master of arcane magic", role: "Control & Utility" },
};

export function classCardDescription(heroClass: HeroClass): string {
  return CLASS_SELECTOR_COPY[heroClass.id]?.description ?? classDescriptor(heroClass.id);
}

export function classRoleLine(heroClass: HeroClass): string {
  return CLASS_SELECTOR_COPY[heroClass.id]?.role ?? classDetailLine(heroClass);
}

export function casterLabel(heroClass: HeroClass): string {
  if (!heroClass.casterType || heroClass.casterType === "none") return "martial";
  if (heroClass.casterType === "pact") return "pact magic";
  if (heroClass.spellcastingAbility) return `${abilityLabels[heroClass.spellcastingAbility]} caster`;
  return `${heroClass.casterType} caster`;
}

export function classDetailLine(heroClass: HeroClass): string {
  return [`d${heroClass.hitDie} hit die`, casterLabel(heroClass)].join(" / ");
}

function casterTag(heroClass: HeroClass): string {
  switch (heroClass.casterType) {
    case "full":
      return "Full Spellcaster";
    case "half":
      return "Half Spellcaster";
    case "pact":
      return "Pact Magic";
    default:
      return "Martial";
  }
}

/** Feature-card tags, derived only from real class fields. */
export function classTags(heroClass: HeroClass): string[] {
  return [
    casterTag(heroClass),
    ...heroClass.primary.map((key) => abilityNames[key]),
    `d${heroClass.hitDie} Hit Die`,
  ];
}

/** One truthful sentence about a class's tool training, or "None". */
export function classToolSummary(classId: string): string {
  const grants = CLASS_TOOL_GRANTS[classId] ?? [];
  const choice = CLASS_TOOL_CHOICES[classId];
  const parts: string[] = [];
  if (grants.length > 0) parts.push(grants.join(", "));
  if (choice) parts.push(`choose ${choice.count} in Commission Details`);
  return parts.length > 0 ? parts.join("; ") : "None";
}

function spellcastingSummary(heroClass: HeroClass): string {
  if (!heroClass.casterType || heroClass.casterType === "none") return "None — martial techniques";
  const ability = heroClass.spellcastingAbility ? abilityNames[heroClass.spellcastingAbility] : null;
  const kind =
    heroClass.casterType === "pact"
      ? "Pact magic"
      : heroClass.casterType === "half"
        ? "Half caster"
        : "Full caster";
  return ability ? `${kind} — ${ability}` : kind;
}

/**
 * Mechanical Essentials rows. Only fields the ruleset actually records are
 * rendered; the flat `proficiencies` list is shown as-is rather than being
 * split into invented saving-throw/armor/weapon groups.
 */
export function mechanicalEssentials(heroClass: HeroClass): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = [
    { label: "Hit Die", value: `1d${heroClass.hitDie} per ${heroClass.name} level` },
  ];
  if (heroClass.primary.length > 0) {
    rows.push({ label: "Primary Ability", value: heroClass.primary.map((key) => abilityNames[key]).join(" & ") });
  }
  rows.push({ label: "Spellcasting", value: spellcastingSummary(heroClass) });
  if (heroClass.proficiencies.length > 0) {
    rows.push({ label: "Proficiencies", value: heroClass.proficiencies.join(", ") });
  }
  rows.push({ label: "Tool Proficiencies", value: classToolSummary(heroClass.id) });
  if (heroClass.startingGear.length > 0) {
    rows.push({ label: "Starting Equipment", value: heroClass.startingGear.join(", ") });
  }
  return rows;
}
