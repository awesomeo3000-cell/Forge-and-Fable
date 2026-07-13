import type { CampaignMemberSummary } from "@/types/campaign";
import { progressionChoiceLabel } from "@/lib/progression/choiceOptions";

export type DmLayoutPreset = "combat" | "roleplay" | "preparation" | "compact";
export type DmWorkspaceMode = "scene" | "encounter" | "preparation" | "review";

export type ImportantResource = {
  id: string;
  label: string;
  shortLabel: string;
  current: number;
  maximum: number;
  recharge: "short-rest" | "long-rest" | "short-or-long-rest" | "other";
  priority: number;
  tone: "ready" | "warning" | "danger";
};

export type ConditionTone = "body" | "magic" | "focus" | "warning" | "danger" | "neutral";

const RESOURCE_LABELS: Record<string, { label: string; shortLabel?: string; priority: number }> = {
  "bardic-inspiration-uses": { label: "Bardic Inspiration", shortLabel: "Inspiration", priority: 96 },
  "lay-on-hands-pool": { label: "Lay on Hands", priority: 96 },
  "wild-shape-uses": { label: "Wild Shape", priority: 96 },
  "channel-divinity-uses": { label: "Channel Divinity", priority: 92 },
  "ki-points": { label: "Ki Points", shortLabel: "Ki", priority: 96 },
  "rage-uses": { label: "Rage", priority: 96 },
  "sorcery-points": { label: "Sorcery Points", shortLabel: "Sorcery", priority: 94 },
  "superiority-dice": { label: "Superiority Dice", shortLabel: "Maneuvers", priority: 92 },
  "second-wind-uses": { label: "Second Wind", priority: 88 },
  "action-surge-uses": { label: "Action Surge", priority: 90 },
  "divine-sense-uses": { label: "Divine Sense", priority: 82 },
  "arcane-recovery-uses": { label: "Arcane Recovery", priority: 82 },
  "pact-slots": { label: "Pact Slots", priority: 88 },
};

function rechargeKind(value: string | undefined): ImportantResource["recharge"] {
  if (value === "short-rest" || value === "long-rest" || value === "short-or-long-rest") return value;
  return "other";
}

function resourceTone(current: number, maximum: number): ImportantResource["tone"] {
  if (current <= 0) return "danger";
  if (current / maximum <= 0.25) return "warning";
  return "ready";
}

function fallbackResourceLabel(resourceId: string) {
  return progressionChoiceLabel(resourceId)
    .replace(/\bUses\b$/i, "")
    .replace(/\bPool\b$/i, "")
    .trim();
}

export function conditionTone(label: string): ConditionTone {
  const value = label.toLowerCase();
  if (/unconscious|dead|dying|paraly[sz]ed|stunned|incapacitated/.test(value)) return "danger";
  if (/poison|disease|grapple|restrain|prone|blind|deaf/.test(value)) return "body";
  if (/concentrat/.test(value)) return "focus";
  if (/exhaust|frighten|charm|burn|bleed/.test(value)) return "warning";
  if (/bless|guidance|haste|shield|armor|invisible|magic|enlarge|fly/.test(value)) return "magic";
  return "neutral";
}

export function deriveImportantResources(member: CampaignMemberSummary): ImportantResource[] {
  const resources: ImportantResource[] = [];
  if (member.heroicInspiration) {
    resources.push({ id: "heroic-inspiration", label: "Heroic Inspiration", shortLabel: "Inspiration", current: 1, maximum: 1, recharge: "other", priority: 100, tone: "ready" });
  }
  for (const [id, state] of Object.entries(member.characterJson?.featureResources ?? {})) {
    if (typeof state.current !== "number" || typeof state.maximum !== "number" || state.maximum <= 0) continue;
    const known = RESOURCE_LABELS[id];
    const label = known?.label ?? fallbackResourceLabel(id);
    resources.push({
      id,
      label,
      shortLabel: known?.shortLabel ?? label,
      current: state.current,
      maximum: state.maximum,
      recharge: rechargeKind(state.recharge),
      priority: known?.priority ?? 64,
      tone: resourceTone(state.current, state.maximum),
    });
  }
  if (member.hitDice) {
    resources.push({ id: "hit-dice", label: "Hit Dice", shortLabel: "Hit dice", current: member.hitDice.remaining, maximum: member.hitDice.maximum, recharge: "long-rest", priority: 20, tone: resourceTone(member.hitDice.remaining, member.hitDice.maximum) });
  }
  return resources.sort((a, b) => b.priority - a.priority || a.label.localeCompare(b.label));
}

export function memberHpState(member: CampaignMemberSummary) {
  if (member.currentHp === null || !member.maxHp) return "unknown" as const;
  if (member.currentHp <= 0) return "unconscious" as const;
  const ratio = member.currentHp / member.maxHp;
  if (ratio <= 0.25) return "critical" as const;
  if (ratio < 0.5) return "wounded" as const;
  return "healthy" as const;
}

export function presetMode(preset: DmLayoutPreset): DmWorkspaceMode {
  if (preset === "combat") return "encounter";
  if (preset === "preparation") return "preparation";
  return "scene";
}
