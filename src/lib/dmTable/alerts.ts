import { deriveImportantResources, memberHpState } from "@/lib/dmTable/party";
import type { CampaignMemberSummary, CampaignPresence } from "@/types/campaign";

export type PartyAlertSeverity = "info" | "warning" | "critical";
export type PartyAlert = {
  id: string;
  characterId?: string;
  userId: string;
  severity: PartyAlertSeverity;
  kind: "low-hp" | "unconscious" | "death-save" | "condition" | "resource-empty" | "disconnected";
  title: string;
  detail?: string;
};

export function derivePartyAlerts(members: CampaignMemberSummary[], presence: CampaignPresence[], dmUserId: string): PartyAlert[] {
  const alerts: PartyAlert[] = [];
  for (const member of members) {
    if (member.userId === dmUserId || !member.characterId) continue;
    const name = member.characterName ?? member.userName;
    const hp = memberHpState(member);
    if (hp === "unconscious") alerts.push({ id: `${member.userId}:unconscious`, userId: member.userId, characterId: member.characterId, severity: "critical", kind: "unconscious", title: `${name} is unconscious`, detail: `${member.deathSaves?.failures ?? 0} failed death saves` });
    else if (hp === "critical") alerts.push({ id: `${member.userId}:critical`, userId: member.userId, characterId: member.characterId, severity: "critical", kind: "low-hp", title: `${name} is critically wounded`, detail: `${member.currentHp}/${member.maxHp} HP` });
    else if (hp === "wounded") alerts.push({ id: `${member.userId}:wounded`, userId: member.userId, characterId: member.characterId, severity: "warning", kind: "low-hp", title: `${name} is wounded`, detail: `${member.currentHp}/${member.maxHp} HP` });
    if ((member.deathSaves?.failures ?? 0) > 0) alerts.push({ id: `${member.userId}:death-save`, userId: member.userId, characterId: member.characterId, severity: "critical", kind: "death-save", title: `${name} has a failed death save`, detail: `${member.deathSaves!.failures} of 3 failures` });
    for (const condition of member.conditions.slice(0, 2)) alerts.push({ id: `${member.userId}:condition:${condition.toLowerCase()}`, userId: member.userId, characterId: member.characterId, severity: "warning", kind: "condition", title: `${name}: ${condition}` });
    const depleted = deriveImportantResources(member).find((resource) => resource.current === 0 && resource.priority >= 80);
    if (depleted) alerts.push({ id: `${member.userId}:resource:${depleted.id}`, userId: member.userId, characterId: member.characterId, severity: "info", kind: "resource-empty", title: `${name} is out of ${depleted.label}`, detail: depleted.recharge === "other" ? undefined : `Returns on ${depleted.recharge.replaceAll("-", " ")}` });
    const state = presence.find((item) => item.userId === member.userId)?.state ?? "disconnected";
    // Ghosts have no presence rows; the server plays them, so they are never
    // "disconnected" (review finding DM-9 #1 — this was spamming the rail).
    if (state === "disconnected" && !member.isGhost) alerts.push({ id: `${member.userId}:disconnected`, userId: member.userId, characterId: member.characterId, severity: "warning", kind: "disconnected", title: `${name} is disconnected` });
  }
  const rank: Record<PartyAlertSeverity, number> = { critical: 3, warning: 2, info: 1 };
  return alerts.sort((a, b) => rank[b.severity] - rank[a.severity] || a.title.localeCompare(b.title));
}
