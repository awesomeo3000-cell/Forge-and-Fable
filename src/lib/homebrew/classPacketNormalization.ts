/**
 * Homebrew class/subclass → progression packet normalization (Phase 6b).
 *
 * Converts a validated `HomebrewClassPayload` / `HomebrewSubclassPayload` into
 * the `ClassProgressionPacket` / `SubclassProgressionPacket` shapes the existing
 * progression engine already consumes. This is the keystone that lets the
 * Phase-5 injectable registry resolve a homebrew class through the same
 * `buildLevelUpPlan` path built-in classes use — no second level-up engine
 * (proposal §8.4).
 *
 * Scope (this sub-round): the mechanical spine — hit die, ability/proficiency
 * data, per-level automatic features, resource grants, and spellcasting slot /
 * count tables. Deferred to later Phase-6 sub-rounds and deliberately NOT
 * emitted here:
 *   - structured per-level `choices` (need the modal's option renderer);
 *   - feature *descriptions* on the sheet (need the resolver to carry them);
 * both are documented in `docs/CHANGES-HB-6.md`.
 */
import type {
  ClassFeatureLevel,
  ClassProgressionPacket,
  ResourceChange,
  SpellcastingProgression,
  SubclassFeatureLevel,
  SubclassProgressionPacket,
} from "@/lib/progression/types";
import type {
  HomebrewClassPayload,
  HomebrewProgressionLevel,
  HomebrewSpellcasting,
  HomebrewSubclassPayload,
  RulesContentRef,
} from "@/types/homebrew";
import { FULL_CASTER_SLOTS } from "@/lib/spellSlots";

/** Stable packet id for a homebrew class/subclass ref (definition, not version). */
export function homebrewPacketId(ref: RulesContentRef): string {
  return ref.source === "homebrew" ? `hb:${ref.definitionId}` : ref.id;
}

function standardProficiencyBonus(level: number): number {
  return Math.floor((level - 1) / 4) + 2;
}

function toResourceChanges(level: HomebrewProgressionLevel): ResourceChange[] {
  return (level.resources ?? []).map((resource) => ({
    resourceId: resource.resourceId,
    maximum: resource.maximum,
    recharge: resource.recharge,
  }));
}

/** Spell slots for one class level under a caster mode, trimmed like built-in
 *  packets (`[4,3,2]`, no trailing zeros). Full = class level; half rounds up
 *  from level 2 and caps at 5th; third rounds up from level 3 and caps at 4th. */
function slotsForMode(mode: HomebrewSpellcasting["mode"], level: number): number[] {
  const fromTable = (effective: number, maxSpellLevel: number): number[] => {
    if (effective < 1) return [];
    return FULL_CASTER_SLOTS[Math.min(effective, 20) - 1].slice(0, maxSpellLevel);
  };
  switch (mode) {
    case "full":
      return fromTable(level, 9);
    case "half":
      return fromTable(level < 2 ? 0 : Math.ceil(level / 2), 5);
    case "third":
      return fromTable(level < 3 ? 0 : Math.ceil(level / 3), 4);
    default:
      return [];
  }
}

/** Standard warlock pact progression for a class level. */
function pactAt(level: number): { count: number; slotLevel: number } {
  return {
    count: level >= 17 ? 4 : level >= 11 ? 3 : level >= 2 ? 2 : level >= 1 ? 1 : 0,
    slotLevel: Math.min(5, Math.ceil(level / 2)),
  };
}

function normalizeSpellcasting(spellcasting: HomebrewSpellcasting): SpellcastingProgression | undefined {
  if (spellcasting.mode === "none") return undefined;
  const ability = spellcasting.ability ?? "intelligence";
  const base: SpellcastingProgression = {
    type: spellcasting.mode,
    ability,
    ...(spellcasting.cantripsKnownByLevel ? { cantripsKnownByLevel: [0, ...spellcasting.cantripsKnownByLevel] } : {}),
    ...(spellcasting.spellsKnownByLevel ? { spellsKnownByLevel: [0, ...spellcasting.spellsKnownByLevel] } : {}),
    ...(spellcasting.preparedFormula === "class-level-plus-modifier"
      ? { preparedSpellsFormula: `${ability}Modifier + level*1 min1` }
      : spellcasting.preparedFormula === "half-level-plus-modifier"
        ? { preparedSpellsFormula: `${ability}Modifier + level/2 min1` }
        : {}),
  };

  if (spellcasting.mode === "pact") {
    const pactCounts: number[] = [0];
    const pactSlotLevels: number[] = [0];
    for (let level = 1; level <= 20; level += 1) {
      const explicit = spellcasting.pactSlotsByLevel?.[level];
      const pact = explicit ?? pactAt(level);
      pactCounts.push(pact.count);
      pactSlotLevels.push(pact.slotLevel);
    }
    return { ...base, pactMagicSlotsByLevel: pactCounts, pactMagicSlotLevelByClassLevel: pactSlotLevels };
  }

  // full / half / third / custom → a level-keyed spell-slot table.
  const spellSlotsByLevel: Record<string, number[]> = {};
  for (let level = 1; level <= 20; level += 1) {
    const explicit = spellcasting.mode === "custom" ? spellcasting.spellSlotsByLevel?.[level] : undefined;
    const slots = explicit ?? slotsForMode(spellcasting.mode, level);
    if (slots.length > 0) spellSlotsByLevel[String(level)] = slots;
  }
  return { ...base, spellSlotsByLevel };
}

/** Aggregate every creation-time skill/tool choice into one packet field. */
function aggregateChoices(choices: HomebrewClassPayload["skillChoices"]): { count: number; options: string[] } {
  const list = choices ?? [];
  const options = new Set<string>();
  let count = 0;
  for (const choice of list) {
    count += choice.count;
    for (const option of (choice.from.type === "skills" || choice.from.type === "tools" || choice.from.type === "list" ? choice.from.options ?? [] : [])) {
      options.add(option);
    }
  }
  return { count, options: [...options] };
}

export function normalizeHomebrewClassPacket(payload: HomebrewClassPayload, ref: RulesContentRef): ClassProgressionPacket {
  const id = homebrewPacketId(ref);
  const levels: Record<number, ClassFeatureLevel> = {};
  for (let level = 1; level <= 20; level += 1) {
    const authored = payload.levels[level];
    levels[level] = {
      level,
      proficiencyBonus: authored?.proficiencyBonus ?? standardProficiencyBonus(level),
      automaticFeatures: (authored?.features ?? []).map((feature) => feature.id),
      // Structured per-level choices are deferred (see file header); emitting
      // none keeps the plan from offering picks the modal cannot yet render.
      choices: [],
      resourceChanges: authored ? toResourceChanges(authored) : [],
      sourceReferences: [id],
    };
  }

  return {
    id,
    sourceClassId: id,
    ruleset: ref.ruleset,
    name: payload.name,
    sourceId: ref.source === "homebrew" ? ref.definitionId : id,
    researchStatus: "homebrew",
    hitDie: payload.hitDie,
    primaryAbilities: payload.primaryAbilities,
    savingThrowProficiencies: payload.savingThrowProficiencies,
    armorTraining: payload.armorTraining,
    weaponProficiencies: payload.weaponProficiencies,
    toolProficiencies: aggregateChoices(payload.toolChoices),
    skillProficiencies: aggregateChoices(payload.skillChoices),
    spellcasting: normalizeSpellcasting(payload.spellcasting),
    levels,
  };
}

export function normalizeHomebrewSubclassPacket(
  payload: HomebrewSubclassPayload,
  ref: RulesContentRef,
): SubclassProgressionPacket {
  const id = homebrewPacketId(ref);
  const featureLevels: SubclassFeatureLevel[] = Object.values(payload.levels)
    .sort((a, b) => a.level - b.level)
    .map((level) => ({
      level: level.level,
      automaticFeatures: (level.features ?? []).map((feature) => feature.id),
      choices: [],
      resourceChanges: toResourceChanges(level),
      spellChanges: [],
      scaling: [],
      parentInteractions: [],
      sourceReferences: [id],
    }));

  const selectionLevel = featureLevels[0]?.level ?? 1;
  return {
    id,
    sourceSubclassId: id,
    classId: homebrewPacketId(payload.parentClassRef),
    sourceClassId: homebrewPacketId(payload.parentClassRef),
    ruleset: ref.ruleset,
    name: payload.name,
    sourceId: ref.source === "homebrew" ? ref.definitionId : id,
    selectionLevel,
    featureLevels,
  };
}
