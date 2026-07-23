/**
 * Effect gate evaluator (Phase 2).
 *
 * Pure boolean evaluation of an `EffectGate` against a per-instance `GateState`
 * (is this item equipped/attuned, which toggles are on, current stage, character
 * level). No side effects, no throws — an unknown/malformed gate evaluates to
 * `false` (fail closed).
 */
import type { EffectGate } from "@/types/homebrew";

export type GateState = {
  equipped?: boolean;
  attuned?: boolean;
  activeToggleIds?: readonly string[];
  currentStageId?: string;
  /** Total character level, used by `minimum-level` gates. */
  characterLevel: number;
};

export function evaluateGate(gate: EffectGate, state: GateState): boolean {
  switch (gate.type) {
    case "always":
      return true;
    case "equipped":
      return state.equipped === true;
    case "attuned":
      return state.attuned === true;
    case "toggle":
      return (state.activeToggleIds ?? []).includes(gate.toggleId);
    case "stage":
      return state.currentStageId != null && gate.stageIds.includes(state.currentStageId);
    case "minimum-level":
      return state.characterLevel >= gate.level;
    case "all":
      return gate.gates.every((g) => evaluateGate(g, state));
    case "any":
      return gate.gates.some((g) => evaluateGate(g, state));
    default:
      return false;
  }
}
