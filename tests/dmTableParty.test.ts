import { describe, expect, it } from "vitest";
import { deriveImportantResources, memberHpState, presetMode } from "@/lib/dmTable/party";
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

  it("maps view presets to their primary workspace mode", () => {
    expect(presetMode("combat")).toBe("encounter");
    expect(presetMode("roleplay")).toBe("scene");
    expect(presetMode("preparation")).toBe("preparation");
  });
});
