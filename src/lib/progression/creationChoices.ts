import { buildClassLevelUpPlan } from "@/lib/progression/engine";
import { cantripsKnownAt } from "@/lib/spells";
import type { HeroClass, RulesetId } from "@/types/game";

/** Levels 1..target that require a player choice when starting above level 1:
    subclass, ASI/feat, a spell pick for known casters, or a cantrip gain (any
    caster with cantrips — prepared casters included, e.g. cleric at 4/10).
    Level 1 is included only for level-1-subclass classes (sorcerer/warlock/
    cleric) so a high-level start still picks its origin. HP-only levels are
    skipped — the creator already computes starting HP for the chosen level.

    The ruleset must be threaded from the character's actual ruleset — the plan
    differs between 2014 and 2024 (e.g. subclass-selection levels), so a
    hardcoded ruleset would prompt 2024 characters at the wrong levels (DW-003). */
export function creationChoiceLevels(
  rulesetId: RulesetId,
  heroClass: HeroClass,
  targetLevel: number,
  raceId?: string,
): number[] {
  const plan = buildClassLevelUpPlan({ ruleset: rulesetId, classId: heroClass.id, fromLevel: 0, toLevel: targetLevel });
  const levels = plan.choices.map((choice) => choice.level);
  for (let level = 1; level <= targetLevel; level += 1) {
    if (cantripsKnownAt(heroClass.id, level) > cantripsKnownAt(heroClass.id, level - 1)) levels.push(level);
  }
  if (raceId === "high-elf-legacy" && targetLevel >= 1) levels.push(1);
  return Array.from(new Set(levels)).sort((a, b) => a - b);
}
