import { describe, expect, it } from "vitest";
import { conditionTone, deriveImportantResources, memberHpState, presetMode } from "@/lib/dmTable/party";
import { derivePartyAlerts } from "@/lib/dmTable/alerts";
import type { CampaignMemberSummary } from "@/types/campaign";

const member: CampaignMemberSummary = {
  userId: "player",
  userName: "Player",
  characterId: "hero",
  characterName: "Elowen",
  characterClass: "cleric",
  characterLevel: 5,
  currentHp: 8,
  maxHp: 40,
  tempHp: 4,
  ac: 17,
  speed: "30 ft.",
  passivePerception: 16,
  passiveInsight: 15,
  passiveInvestigation: 11,
  spellSaveDc: 15,
  conditions: ["Poisoned"],
  concentratingOn: "Bless",
  deathSaves: { successes: 1, failures: 0 },
  heroicInspiration: true,
  hitDice: { remaining: 3, maximum: 5 },
  spellSlots: [],
};

describe("DM party command center derivation", () => {
  it("classifies exact HP thresholds without relying on color", () => {
    expect(memberHpState(member)).toBe("critical");
    expect(memberHpState({ ...member, currentHp: 0 })).toBe("unconscious");
    expect(memberHpState({ ...member, currentHp: 20 })).toBe("healthy");
  });

  it("shows only resources with a real character source of truth", () => {
    expect(deriveImportantResources(member).map((resource) => resource.id)).toEqual(["heroic-inspiration", "hit-dice"]);
  });

  it("surfaces class resources in priority order with depletion tones", () => {
    const resourceMember: CampaignMemberSummary = {
      ...member,
      characterJson: {
        featureResources: {
          "lay-on-hands-pool": { current: 8, maximum: 25, recharge: "long-rest" },
          "channel-divinity-uses": { current: 0, maximum: 1, recharge: "short-or-long-rest" },
          "wild-shape-max-cr": { maximum: "1/2" },
        },
      } as unknown as CampaignMemberSummary["characterJson"],
    };
    expect(deriveImportantResources(resourceMember).map((resource) => [resource.id, resource.tone])).toEqual([
      ["heroic-inspiration", "ready"],
      ["lay-on-hands-pool", "ready"],
      ["channel-divinity-uses", "danger"],
      ["hit-dice", "ready"],
    ]);
  });

  it("assigns stable semantic condition families", () => {
    expect(conditionTone("Poisoned")).toBe("body");
    expect(conditionTone("Concentrating · Bless")).toBe("focus");
    expect(conditionTone("Exhaustion 2")).toBe("warning");
    expect(conditionTone("Unconscious")).toBe("danger");
    expect(conditionTone("Mage Armor")).toBe("magic");
  });

  it("maps view presets to their primary workspace mode", () => {
    expect(presetMode("combat")).toBe("encounter");
    expect(presetMode("roleplay")).toBe("scene");
    expect(presetMode("preparation")).toBe("preparation");
  });

  it("deduplicates deterministic critical, condition, and presence alerts", () => {
    const alerts = derivePartyAlerts([member], [{ userId: "player", characterId: "hero", state: "disconnected", lastSeenAt: null }], "dm");
    expect(alerts.map((alert) => alert.id)).toEqual(expect.arrayContaining(["player:critical", "player:condition:poisoned", "player:disconnected"]));
    expect(new Set(alerts.map((alert) => alert.id)).size).toBe(alerts.length);
  });

  it("raises only one at-a-glance alert for a depleted major class resource", () => {
    const resourceMember = {
      ...member,
      currentHp: 40,
      conditions: [],
      characterJson: {
        featureResources: {
          "channel-divinity-uses": { current: 0, maximum: 1, recharge: "short-or-long-rest" },
          "divine-sense-uses": { current: 0, maximum: 4, recharge: "long-rest" },
        },
      } as unknown as CampaignMemberSummary["characterJson"],
    };
    const alerts = derivePartyAlerts([resourceMember], [{ userId: "player", characterId: "hero", state: "connected", lastSeenAt: null }], "dm");
    expect(alerts.filter((alert) => alert.kind === "resource-empty").map((alert) => alert.id)).toEqual(["player:resource:channel-divinity-uses"]);
  });
});
