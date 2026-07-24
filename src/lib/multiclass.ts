/**
 * Multiclass foundation (proposal HB §8.1, Phase 5).
 *
 * The single module that owns per-class level records. Everything downstream
 * asks these helpers instead of reading `character.level` / `classId` /
 * `subclassId` directly, so the compatibility mirrors live in exactly one
 * place:
 *
 *  - a character WITHOUT `classLevels` derives one built-in entry from its
 *    legacy fields and behaves exactly as before;
 *  - a character WITH `classLevels` keeps `level` as the total-level mirror and
 *    `classId`/`subclassId` as primary-class mirrors until every call site is
 *    migrated.
 */
import type { AbilityScores, Character, RulesetId } from "@/types/game";
import type { CharacterClassLevel, RulesContentRef } from "@/types/homebrew";
import { HOMEBREW_CLASS_ID } from "@/lib/homebrewIdentity";
import { FULL_CASTER_SLOTS, maxSlots } from "@/lib/spellSlots";

/** The slice of a character these helpers need. */
export type ClassLevelSource = Pick<Character, "ruleset" | "classId" | "level"> & {
  subclassId?: string;
  classLevels?: CharacterClassLevel[];
};

export function builtinClassRef(ruleset: RulesetId, classId: string): RulesContentRef {
  return { source: "builtin", kind: "class", id: classId, ruleset };
}

export function builtinSubclassRef(ruleset: RulesetId, subclassId: string): RulesContentRef {
  return { source: "builtin", kind: "subclass", id: subclassId, ruleset };
}

/** Stable identity key for a class ref (definition, not version). */
export function classRefKey(ref: RulesContentRef): string {
  return ref.source === "builtin" ? `builtin:${ref.id}` : `homebrew:${ref.definitionId}`;
}

/**
 * The character's class levels, in acquisition order. Single-class legacy
 * characters (no `classLevels`) derive one entry from the mirror fields.
 */
export function getClassLevels(character: ClassLevelSource): CharacterClassLevel[] {
  if (character.classLevels && character.classLevels.length > 0) {
    return [...character.classLevels].sort((a, b) => a.acquiredOrder - b.acquiredOrder);
  }
  return [{
    classRef: builtinClassRef(character.ruleset, character.classId),
    level: character.level,
    subclassRef: character.subclassId ? builtinSubclassRef(character.ruleset, character.subclassId) : undefined,
    acquiredOrder: 0,
  }];
}

export function totalLevel(character: ClassLevelSource): number {
  if (!character.classLevels || character.classLevels.length === 0) return character.level;
  return character.classLevels.reduce((sum, entry) => sum + entry.level, 0);
}

/** The first-acquired class — the compatibility mirror for `classId`. */
export function primaryClass(character: ClassLevelSource): CharacterClassLevel {
  return getClassLevels(character)[0];
}

export function classLevelFor(character: ClassLevelSource, ref: RulesContentRef): number {
  const key = classRefKey(ref);
  return getClassLevels(character).find((entry) => classRefKey(entry.classRef) === key)?.level ?? 0;
}

export function isMulticlass(character: ClassLevelSource): boolean {
  return (character.classLevels?.length ?? 0) > 1;
}

/**
 * Recompute the legacy mirror fields from a classLevels array. Every write of
 * `classLevels` goes through this so `level`/`classId`/`subclassId` stay
 * consistent (proposal §8.1: keep the mirrors until all call sites migrate).
 */
export function classLevelMirrors(classLevels: CharacterClassLevel[]): {
  level: number;
  classId: string;
  subclassId: string | undefined;
} {
  const ordered = [...classLevels].sort((a, b) => a.acquiredOrder - b.acquiredOrder);
  const primary = ordered[0];
  return {
    level: ordered.reduce((sum, entry) => sum + entry.level, 0),
    classId: primary.classRef.source === "builtin" ? primary.classRef.id : HOMEBREW_CLASS_ID,
    subclassId: primary.subclassRef?.source === "builtin" ? primary.subclassRef.id : undefined,
  };
}

/** Add one level of `ref`, appending a new class entry when needed. */
export function addClassLevel(character: ClassLevelSource, ref: RulesContentRef): CharacterClassLevel[] {
  const levels = getClassLevels(character);
  const key = classRefKey(ref);
  const existing = levels.find((entry) => classRefKey(entry.classRef) === key);
  if (existing) {
    return levels.map((entry) => entry === existing ? { ...entry, level: entry.level + 1 } : entry);
  }
  const nextOrder = levels.reduce((max, entry) => Math.max(max, entry.acquiredOrder), -1) + 1;
  return [...levels, { classRef: ref, level: 1, acquiredOrder: nextOrder }];
}

/**
 * Remove one level of `ref` (level-down unwinds the correct class, proposal
 * Phase 5 gate). A class dropping to 0 levels is removed entirely; the primary
 * class can never be removed while other classes remain.
 */
export function removeClassLevel(character: ClassLevelSource, ref: RulesContentRef): CharacterClassLevel[] {
  const levels = getClassLevels(character);
  const key = classRefKey(ref);
  const target = levels.find((entry) => classRefKey(entry.classRef) === key);
  if (!target) throw new Error("The character has no levels in that class.");
  if (target.level > 1) {
    return levels.map((entry) => entry === target ? { ...entry, level: entry.level - 1 } : entry);
  }
  if (target.acquiredOrder === levels[0].acquiredOrder && levels.length > 1) {
    throw new Error("The first class cannot be removed while other class levels remain.");
  }
  return levels.filter((entry) => entry !== target);
}

// ── Hit dice ────────────────────────────────────────────────────────────────

export type HitDicePool = { die: number; count: number; classRef: RulesContentRef };

/** Per-class hit dice pools. `hitDieFor` maps a class ref to its die size. */
export function hitDicePools(
  character: ClassLevelSource,
  hitDieFor: (ref: RulesContentRef) => number,
): HitDicePool[] {
  return getClassLevels(character).map((entry) => ({
    die: hitDieFor(entry.classRef),
    count: entry.level,
    classRef: entry.classRef,
  }));
}

// ── Combined spellcasting (multiclass caster level, PHB "Multiclassing") ────

/** Built-in caster weights. Third-casters are subclass-driven. */
const FULL_CASTERS = new Set(["bard", "cleric", "druid", "sorcerer", "wizard"]);
const HALF_CASTERS = new Set(["paladin", "ranger"]);
const THIRD_CASTER_SUBCLASSES = ["eldritch-knight", "arcane-trickster"];

export type CasterContribution = {
  classRef: RulesContentRef;
  /** Levels contributed to the shared multiclass spellcaster level. */
  casterLevels: number;
  /** Warlock pact levels — never merged into the shared table. */
  pactLevels: number;
};

export function casterContribution(entry: CharacterClassLevel): CasterContribution {
  const base = { classRef: entry.classRef, casterLevels: 0, pactLevels: 0 };
  if (entry.classRef.source !== "builtin") return base; // homebrew casting lands in Phase 6
  const id = entry.classRef.id;
  if (id === "warlock") return { ...base, pactLevels: entry.level };
  if (FULL_CASTERS.has(id)) return { ...base, casterLevels: entry.level };
  // PHB multiclassing rounds half/third casters DOWN; single-class artificer
  // rounds up, but its multiclass rule is also round up (Tasha's).
  if (id === "artificer") return { ...base, casterLevels: Math.ceil(entry.level / 2) };
  if (HALF_CASTERS.has(id)) return { ...base, casterLevels: Math.floor(entry.level / 2) };
  const subclassId = entry.subclassRef?.source === "builtin" ? entry.subclassRef.id : "";
  if (THIRD_CASTER_SUBCLASSES.some((third) => subclassId.includes(third))) {
    return { ...base, casterLevels: Math.floor(entry.level / 3) };
  }
  return base;
}

export type CombinedSpellSlots = {
  /** Shared multiclass slot table by spell level (index 0 = level 1). */
  slots: number[];
  /** The combined multiclass spellcaster level driving `slots`. */
  casterLevel: number;
  /** Warlock pact slots, kept separate: `slotLevel` is 1-based. */
  pact: { count: number; slotLevel: number } | null;
};

/**
 * Combined spell slots per the multiclass rules: sum each class's caster-level
 * contribution, read the full-caster table at that level, and keep pact slots
 * separate. A single-class character reads its native table (so a level-1
 * paladin correctly has no slots, rather than the multiclass table's rounding).
 */
export function combinedSpellSlots(character: ClassLevelSource): CombinedSpellSlots {
  const levels = getClassLevels(character);
  const contributions = levels.map(casterContribution);
  const pactLevels = contributions.reduce((sum, c) => sum + c.pactLevels, 0);
  const pact = pactLevels > 0
    ? {
        count: pactLevels >= 17 ? 4 : pactLevels >= 11 ? 3 : pactLevels >= 2 ? 2 : 1,
        slotLevel: Math.min(5, Math.ceil(pactLevels / 2)),
      }
    : null;

  if (levels.length === 1) {
    // Single-class: defer to the native per-class table (existing behavior).
    const entry = levels[0];
    if (entry.classRef.source !== "builtin") return { slots: [], casterLevel: 0, pact };
    const id = entry.classRef.id;
    if (id === "warlock") return { slots: [], casterLevel: 0, pact };
    const casterType = FULL_CASTERS.has(id) ? "full"
      : id === "artificer" || HALF_CASTERS.has(id) ? "half"
      : null;
    // Non-casters (including third-caster subclasses, which the native sheet
    // does not model today) keep their existing no-slot behavior single-class.
    if (!casterType) return { slots: [], casterLevel: 0, pact };
    const native = maxSlots(casterType, entry.level, id).filter((_, i) => i < 9);
    return { slots: native, casterLevel: casterContribution(entry).casterLevels, pact };
  }

  const casterLevel = contributions.reduce((sum, c) => sum + c.casterLevels, 0);
  if (casterLevel <= 0) return { slots: [], casterLevel: 0, pact };
  const slots = FULL_CASTER_SLOTS[Math.min(casterLevel, 20) - 1].slice();
  while (slots.length < 9) slots.push(0);
  return { slots, casterLevel, pact };
}

// ── Multiclass prerequisites (structured, server-repeatable) ────────────────

/** SRD multiclass ability minimums. `anyOf` groups are alternatives. */
const MULTICLASS_REQUIREMENTS: Record<string, Array<Array<{ ability: keyof AbilityScores; minimum: number }>>> = {
  barbarian: [[{ ability: "strength", minimum: 13 }]],
  bard: [[{ ability: "charisma", minimum: 13 }]],
  cleric: [[{ ability: "wisdom", minimum: 13 }]],
  druid: [[{ ability: "wisdom", minimum: 13 }]],
  fighter: [[{ ability: "strength", minimum: 13 }, { ability: "dexterity", minimum: 13 }]],
  monk: [[{ ability: "dexterity", minimum: 13 }], [{ ability: "wisdom", minimum: 13 }]],
  paladin: [[{ ability: "strength", minimum: 13 }], [{ ability: "charisma", minimum: 13 }]],
  ranger: [[{ ability: "dexterity", minimum: 13 }], [{ ability: "wisdom", minimum: 13 }]],
  rogue: [[{ ability: "dexterity", minimum: 13 }]],
  sorcerer: [[{ ability: "charisma", minimum: 13 }]],
  warlock: [[{ ability: "charisma", minimum: 13 }]],
  wizard: [[{ ability: "intelligence", minimum: 13 }]],
  artificer: [[{ ability: "intelligence", minimum: 13 }]],
};

export type MulticlassEligibility = {
  eligible: boolean;
  /** Human-readable unmet requirements, empty when eligible. */
  unmet: string[];
};

/**
 * Structured multiclass prerequisite check for a built-in class. Both leaving
 * (current classes) and entering (target class) requirements apply per the PHB;
 * the caller passes final ability scores. Unknown classes fail closed.
 */
export function multiclassEligibility(
  targetClassId: string,
  currentClassIds: string[],
  abilities: AbilityScores,
): MulticlassEligibility {
  const unmet: string[] = [];
  const check = (classId: string) => {
    const groups = MULTICLASS_REQUIREMENTS[classId];
    if (!groups) {
      unmet.push(`${classId}: no multiclass requirements are defined`);
      return;
    }
    // Each group is an OR of alternatives; all groups must pass (AND).
    for (const group of groups) {
      if (!group.some(({ ability, minimum }) => abilities[ability] >= minimum)) {
        unmet.push(`${classId}: requires ${group.map((g) => `${g.ability} ${g.minimum}`).join(" or ")}`);
      }
    }
  };
  check(targetClassId);
  for (const classId of new Set(currentClassIds)) {
    if (classId !== targetClassId) check(classId);
  }
  return { eligible: unmet.length === 0, unmet };
}

/**
 * Built-in classes the character could take a level in right now: existing
 * classes are always continuable; new classes require multiclass prerequisites
 * (unless `enforcePrerequisites` is false, mirroring the feat-prereq setting).
 */
export function eligibleMulticlassOptions(
  character: ClassLevelSource,
  candidateClassIds: string[],
  abilities: AbilityScores,
  enforcePrerequisites = true,
): Array<{ classId: string; isNew: boolean; eligibility: MulticlassEligibility }> {
  const current = getClassLevels(character)
    .map((entry) => entry.classRef.source === "builtin" ? entry.classRef.id : null)
    .filter((id): id is string => id !== null);
  return candidateClassIds.map((classId) => {
    const isNew = !current.includes(classId);
    const eligibility = isNew && enforcePrerequisites
      ? multiclassEligibility(classId, current, abilities)
      : { eligible: true, unmet: [] };
    return { classId, isNew, eligibility };
  });
}
