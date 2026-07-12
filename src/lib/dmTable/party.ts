import type { CampaignMemberSummary } from "@/types/campaign";

export type DmLayoutPreset = "combat" | "roleplay" | "preparation" | "compact";
export type DmWorkspaceMode = "scene" | "encounter" | "preparation" | "review";

export type ImportantResource = {
  id: string;
  label: string;
  shortLabel: string;
  current: number;
  maximum: number;
  recharge: "short-rest" | "long-rest" | "other";
  priority: number;
};

export function deriveImportantResources(member: CampaignMemberSummary): ImportantResource[] {
  const resources: ImportantResource[] = [];
  if (member.heroicInspiration) {
    resources.push({ id: "heroic-inspiration", label: "Heroic Inspiration", shortLabel: "Inspiration", current: 1, maximum: 1, recharge: "other", priority: 100 });
  }
  if (member.hitDice) {
    resources.push({ id: "hit-dice", label: "Hit Dice", shortLabel: "Hit dice", current: member.hitDice.remaining, maximum: member.hitDice.maximum, recharge: "long-rest", priority: 20 });
  }
  return resources.sort((a, b) => b.priority - a.priority);
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
