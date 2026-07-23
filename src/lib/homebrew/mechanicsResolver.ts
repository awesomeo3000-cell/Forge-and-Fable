/**
 * Declarative mechanics resolver (Phase 2).
 *
 * Takes a set of gated effect *instances* and produces explainable character
 * contributions plus aggregated derived outputs, following the deterministic
 * resolution order in proposal §6.4:
 *
 *   1. base scores (caller-provided)         4. additive numeric bonuses
 *   2. replacement calcs (native, external)  5. riders/conditions/senses/resources
 *   3. floors/ceilings (strongest wins)      6. presentation grouped by source
 *
 * Every applied effect yields a `ResolvedContribution` carrying its source
 * provenance — the sheet never shows an unexplained number. The resolver is pure
 * and idempotent: evaluating the same source instance twice yields the same
 * result (contributions are keyed by `sourceInstanceId + effectId`).
 */
import type { AbilityKey, AbilityScores } from "@/types/game";
import type {
  MechanicEffect,
  NumericBonusTarget,
  RechargeMode,
  ResolvedContribution,
  RulesContentRef,
} from "@/types/homebrew";
import { evaluateGate, type GateState } from "@/lib/homebrew/effectGate";

/** One attached, gated bundle of effects (an item copy, a feat instance, …). */
export type MechanicSource = {
  sourceInstanceId: string;
  sourceRef: RulesContentRef;
  label: string;
  effects: readonly MechanicEffect[];
  gateState: GateState;
};

export type ConditionContribution = {
  conditionId: string;
  label: string;
  sourceInstanceId: string;
  sourceRef: RulesContentRef;
};
export type RiderContribution = {
  dice: string;
  appliesTo: ReadonlyArray<"attack" | "save" | "check">;
  sourceInstanceId: string;
  sourceRef: RulesContentRef;
};
export type SenseContribution = { text: string; sourceInstanceId: string; sourceRef: RulesContentRef };
export type ResourceContribution = {
  resourceId: string;
  maximum: number;
  recharge: RechargeMode;
  sourceInstanceId: string;
  sourceRef: RulesContentRef;
};
export type AuraContribution = {
  radiusFeet: number;
  recipient: "self" | "allies" | "all-creatures";
  effects: ReadonlyArray<Exclude<MechanicEffect, { type: "aura" }>>;
  sourceInstanceId: string;
  sourceRef: RulesContentRef;
};

export type ResolvedMechanics = {
  /** Every applied effect, in source-grouped presentation order. */
  contributions: ResolvedContribution[];
  /** Strongest ability floor per ability (apply as max(base, floor)). */
  abilityFloors: Partial<Record<AbilityKey, number>>;
  /** Character-wide additive numeric bonuses, summed per target. */
  numericTotals: Partial<Record<NumericBonusTarget, number>>;
  /** Additive numeric bonuses scoped to one source item, keyed by instance id. */
  sourceItemBonuses: Record<string, Partial<Record<NumericBonusTarget, number>>>;
  /** Added spell slots by spell level (never negative; removal is absence). */
  spellSlotDeltas: Partial<Record<number, number>>;
  conditions: ConditionContribution[];
  d20Riders: RiderContribution[];
  senses: SenseContribution[];
  resources: ResourceContribution[];
  /** Auras with a non-self recipient, recorded for later campaign propagation. */
  auras: AuraContribution[];
  /** Base abilities with floors applied, when base scores were provided. */
  effectiveAbilities?: AbilityScores;
};

/** Stable key for stacking decisions: the content definition, not the instance. */
function definitionKey(ref: RulesContentRef): string {
  return ref.source === "homebrew" ? `hb:${ref.definitionId}` : `builtin:${ref.kind}:${ref.id}`;
}

type NumericAccumulator = {
  // target -> stacking numbers (sum) and per-definition max (non-stacking)
  stacking: Partial<Record<NumericBonusTarget, number>>;
  nonStacking: Map<string, number>; // `${defKey}|${target}` -> max value
};

function addNumeric(acc: NumericAccumulator, target: NumericBonusTarget, value: number, defKey: string, nonStacking: boolean): void {
  if (nonStacking) {
    const key = `${defKey}|${target}`;
    acc.nonStacking.set(key, Math.max(acc.nonStacking.get(key) ?? value, value));
  } else {
    acc.stacking[target] = (acc.stacking[target] ?? 0) + value;
  }
}

function foldNumeric(acc: NumericAccumulator): Partial<Record<NumericBonusTarget, number>> {
  const totals: Partial<Record<NumericBonusTarget, number>> = { ...acc.stacking };
  for (const [key, value] of acc.nonStacking) {
    const target = key.split("|")[1] as NumericBonusTarget;
    totals[target] = (totals[target] ?? 0) + value;
  }
  return totals;
}

/**
 * Resolve mechanics for a character from a set of sources.
 *
 * `baseAbilities` is used only to report the effective floored ability scores in
 * the deterministic order; callers combine the returned deltas with their native
 * pipeline. Passing the same sources twice is idempotent.
 */
export function resolveMechanics(
  sources: readonly MechanicSource[],
  baseAbilities?: AbilityScores,
): ResolvedMechanics {
  const contributions: ResolvedContribution[] = [];
  const abilityFloors: Partial<Record<AbilityKey, number>> = {};
  const characterNumeric: NumericAccumulator = { stacking: {}, nonStacking: new Map() };
  const sourceItemBonuses: Record<string, Partial<Record<NumericBonusTarget, number>>> = {};
  const spellSlotDeltas: Partial<Record<number, number>> = {};
  const conditions: ConditionContribution[] = [];
  const d20Riders: RiderContribution[] = [];
  const senses: SenseContribution[] = [];
  const resources: ResourceContribution[] = [];
  const auras: AuraContribution[] = [];

  // Idempotency guard: a source instance's effect is only ever applied once.
  const applied = new Set<string>();

  const record = (source: MechanicSource, effectId: string, target: string, value?: number): void => {
    contributions.push({
      sourceInstanceId: source.sourceInstanceId,
      sourceRef: source.sourceRef,
      effectId,
      label: source.label,
      target,
      value,
    });
  };

  const applyEffect = (source: MechanicSource, effect: Exclude<MechanicEffect, { type: "aura" }>): void => {
    const defKey = definitionKey(source.sourceRef);
    switch (effect.type) {
      case "numeric-bonus": {
        if (effect.scope === "source-item") {
          const bucket = (sourceItemBonuses[source.sourceInstanceId] ??= {});
          bucket[effect.target] = (bucket[effect.target] ?? 0) + effect.value;
        } else {
          addNumeric(characterNumeric, effect.target, effect.value, defKey, effect.stacking === "same-source-nonstacking");
        }
        record(source, effect.id, effect.target, effect.value);
        return;
      }
      case "ability-floor": {
        const current = abilityFloors[effect.ability];
        abilityFloors[effect.ability] = current == null ? effect.minimum : Math.max(current, effect.minimum);
        record(source, effect.id, `ability-floor:${effect.ability}`, effect.minimum);
        return;
      }
      case "spell-slot-bonus": {
        spellSlotDeltas[effect.spellLevel] = (spellSlotDeltas[effect.spellLevel] ?? 0) + effect.amount;
        record(source, effect.id, `spell-slot:${effect.spellLevel}`, effect.amount);
        return;
      }
      case "condition": {
        conditions.push({ conditionId: effect.conditionId, label: effect.label, sourceInstanceId: source.sourceInstanceId, sourceRef: source.sourceRef });
        record(source, effect.id, `condition:${effect.conditionId}`);
        return;
      }
      case "d20-rider": {
        d20Riders.push({ dice: effect.dice, appliesTo: effect.appliesTo, sourceInstanceId: source.sourceInstanceId, sourceRef: source.sourceRef });
        record(source, effect.id, "d20-rider");
        return;
      }
      case "sense": {
        senses.push({ text: effect.text, sourceInstanceId: source.sourceInstanceId, sourceRef: source.sourceRef });
        record(source, effect.id, "sense");
        return;
      }
      case "resource-grant": {
        resources.push({ resourceId: effect.resourceId, maximum: effect.maximum, recharge: effect.recharge, sourceInstanceId: source.sourceInstanceId, sourceRef: source.sourceRef });
        record(source, effect.id, `resource:${effect.resourceId}`, effect.maximum);
        return;
      }
      case "spell-grant": {
        record(source, effect.id, "spell-grant");
        return;
      }
    }
  };

  for (const source of sources) {
    for (const effect of source.effects) {
      const key = `${source.sourceInstanceId}::${effect.id}`;
      if (applied.has(key)) continue;
      if (!evaluateGate(effect.gate, source.gateState)) continue;
      applied.add(key);

      if (effect.type === "aura") {
        if (effect.recipient === "self") {
          // Self auras resolve locally: inner effects apply to this character.
          for (const inner of effect.effects) {
            const innerKey = `${key}::${inner.id}`;
            if (applied.has(innerKey)) continue;
            if (!evaluateGate(inner.gate, source.gateState)) continue;
            applied.add(innerKey);
            applyEffect(source, inner);
          }
        } else {
          // Ally/all-creature propagation needs campaign presence (later phase).
          auras.push({ radiusFeet: effect.radiusFeet, recipient: effect.recipient, effects: effect.effects, sourceInstanceId: source.sourceInstanceId, sourceRef: source.sourceRef });
          record(source, effect.id, `aura:${effect.recipient}`);
        }
        continue;
      }

      applyEffect(source, effect);
    }
  }

  const result: ResolvedMechanics = {
    contributions,
    abilityFloors,
    numericTotals: foldNumeric(characterNumeric),
    sourceItemBonuses,
    spellSlotDeltas,
    conditions,
    d20Riders,
    senses,
    resources,
    auras,
  };

  // Step 1 sanity: if base scores were supplied, callers can read effective
  // floored scores from `effectiveAbilities` for presentation.
  if (baseAbilities) result.effectiveAbilities = applyAbilityFloors(baseAbilities, abilityFloors);
  return result;
}

export function applyAbilityFloors(
  base: AbilityScores,
  floors: Partial<Record<AbilityKey, number>>,
): AbilityScores {
  const result = { ...base };
  for (const ability of Object.keys(floors) as AbilityKey[]) {
    const floor = floors[ability];
    if (floor != null) result[ability] = Math.max(result[ability], floor);
  }
  return result;
}

/**
 * Spell-slot availability for one level, honoring the overdrawn rule (§6.5):
 * removing a bonus slot never clamps `used` below zero and never silently erases
 * casts — if `used` exceeds the new `max`, the level reads as overdrawn.
 */
export function computeSlotAvailability(baseMax: number, delta: number, used: number): {
  max: number;
  used: number;
  available: number;
  overdrawn: boolean;
} {
  const max = Math.max(0, baseMax + delta);
  return { max, used, available: Math.max(0, max - used), overdrawn: used > max };
}
