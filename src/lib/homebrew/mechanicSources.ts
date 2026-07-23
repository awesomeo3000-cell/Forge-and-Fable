/**
 * Adapters that turn every bonus source — new homebrew payloads AND legacy
 * `CharacterEffect`s / prose-parsed items — into a single `MechanicSource` shape,
 * so there is exactly one resolver engine (proposal §7.2: "Do not maintain two
 * unrelated bonus engines").
 */
import type { CharacterEffect, RulesetId } from "@/types/game";
import type {
  HomebrewItemInstanceState,
  HomebrewItemPayload,
  MechanicEffect,
  NumericBonusTarget,
  RulesContentRef,
} from "@/types/homebrew";
import { itemPassiveBonuses, type ItemLike } from "@/lib/itemCatalog";
import type { MechanicSource } from "@/lib/homebrew/mechanicsResolver";

// ── Homebrew item instance → source ──────────────────────────────────────────

/**
 * Build a resolver source from a versioned item payload and the character's
 * per-copy instance state. Effects include the payload's always-on effects plus
 * the current stage's effects; gates are evaluated later against the instance.
 */
export function homebrewItemInstanceToSource(
  payload: HomebrewItemPayload,
  instance: HomebrewItemInstanceState,
  characterLevel: number,
  sourceInstanceId = instanceRefId(instance.contentRef),
): MechanicSource {
  const stage = instance.currentStageId
    ? payload.stages.find((s) => s.id === instance.currentStageId)
    : undefined;
  const effects: MechanicEffect[] = [...payload.effects, ...(stage?.effects ?? [])];
  return {
    sourceInstanceId,
    sourceRef: instance.contentRef,
    label: payload.name,
    effects,
    gateState: {
      equipped: instance.equipped,
      attuned: instance.attuned,
      activeToggleIds: instance.activeToggleIds,
      currentStageId: instance.currentStageId,
      characterLevel,
    },
  };
}

/** Stable fallback id for callers that do not have a per-copy inventory id. */
function instanceRefId(ref: RulesContentRef): string {
  return ref.source === "homebrew" ? `${ref.definitionId}:${ref.versionId}` : `${ref.kind}:${ref.id}`;
}

// ── Legacy CharacterEffect → source ──────────────────────────────────────────

const EFFECT_FIELD_TARGETS: Array<{ key: keyof CharacterEffect; target: NumericBonusTarget }> = [
  { key: "ac", target: "ac" },
  { key: "attack", target: "weapon-attack" },
  { key: "damage", target: "weapon-damage" },
  { key: "saves", target: "saving-throws" },
  { key: "checks", target: "ability-checks" },
  { key: "initiative", target: "initiative" },
];

/**
 * Represent one *active* legacy effect as a source (flat bonuses, d20 rider, and
 * sense). Advantage/exhaustion stacking stay with the legacy `effects.ts` path;
 * they have no `MechanicEffect` equivalent yet. Returns null when inactive or
 * empty.
 */
export function characterEffectToSource(effect: CharacterEffect, ruleset: RulesetId): MechanicSource | null {
  if (!effect.active) return null;
  const effects: MechanicEffect[] = [];
  for (const { key, target } of EFFECT_FIELD_TARGETS) {
    const value = effect[key];
    if (typeof value === "number" && value !== 0) {
      effects.push({ id: `${effect.id}-${target}`, type: "numeric-bonus", target, value, gate: { type: "always" } });
    }
  }
  if (effect.d20Dice) {
    effects.push({ id: `${effect.id}-rider`, type: "d20-rider", dice: effect.d20Dice, appliesTo: ["attack", "save", "check"], gate: { type: "always" } });
  }
  if (effect.sense) {
    effects.push({ id: `${effect.id}-sense`, type: "sense", text: effect.sense, gate: { type: "always" } });
  }
  if (effects.length === 0) return null;
  return {
    sourceInstanceId: `effect:${effect.id}`,
    sourceRef: { source: "builtin", kind: "spell", id: effect.id, ruleset },
    label: effect.label,
    effects,
    gateState: { characterLevel: 0 },
  };
}

// ── Legacy prose-parsed item → source ────────────────────────────────────────

/**
 * Represent an equipped catalog/inventory item's prose-parsed passive bonuses as
 * a source. Only used for legacy built-in items; newly authored content uses the
 * declarative path (proposal §6.1).
 */
export function proseItemToSource(
  item: ItemLike & { id: string; name: string },
  ruleset: RulesetId,
  equipped: boolean,
): MechanicSource | null {
  const bonuses = itemPassiveBonuses(item);
  const map: Array<{ value: number; target: NumericBonusTarget }> = [
    { value: bonuses.ac, target: "ac" },
    { value: bonuses.saves, target: "saving-throws" },
    { value: bonuses.spellAttack, target: "spell-attack" },
    { value: bonuses.spellSaveDc, target: "spell-save-dc" },
  ];
  const effects: MechanicEffect[] = map
    .filter((m) => m.value !== 0)
    .map((m) => ({ id: `${item.id}-${m.target}`, type: "numeric-bonus", target: m.target, value: m.value, scope: "character", gate: { type: "equipped" } }));
  if (effects.length === 0) return null;
  return {
    sourceInstanceId: `item:${item.id}`,
    sourceRef: { source: "builtin", kind: "item", id: item.id, ruleset },
    label: item.name,
    effects,
    gateState: { equipped, characterLevel: 0 },
  };
}
