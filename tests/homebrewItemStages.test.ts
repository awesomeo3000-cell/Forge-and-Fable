/**
 * Phase 4 — item stages, counters, history, and stage-gated mechanics.
 *
 * Exercises the four-stage sentient weapon gate scenario from the proposal
 * (§14 Phase 4): +1 at stage 1, +2 at stage 2, a 3rd-level slot at stage 3, a
 * Bless aura at stage 4, safe reverts, counter persistence, and audit history.
 */
import { describe, expect, it } from "vitest";
import {
  describeItemUpgrade,
  describeStageChange,
  firstStageId,
  homebrewPayloadToInventory,
  sortedStages,
  stageCounterIds,
  upgradeHomebrewInventoryItem,
} from "@/lib/homebrew/itemIntegration";
import { homebrewItemInstanceToSource } from "@/lib/homebrew/mechanicSources";
import { computeSlotAvailability, resolveMechanics } from "@/lib/homebrew/mechanicsResolver";
import { validateItemPayload } from "@/lib/homebrew/homebrewSchema";
import { validateCharacterInput } from "@/lib/validateCharacter";
import { sentientWeapon } from "./fixtures/homebrew";
import type { HomebrewItemInstanceState } from "@/types/homebrew";

function instanceAtStage(stageId: string | undefined, counters?: Record<string, number>): HomebrewItemInstanceState {
  const item = homebrewPayloadToInventory("dawnbringer", "v1", "2014", sentientWeapon);
  return { ...item.homebrew!, equipped: true, attuned: true, currentStageId: stageId, counters };
}

function mechanicsAtStage(stageId: string | undefined) {
  const instance = instanceAtStage(stageId);
  return resolveMechanics([homebrewItemInstanceToSource(sentientWeapon, instance, 9, "copy-1")]);
}

describe("stage payload validation", () => {
  it("accepts the four-stage sentient weapon fixture", () => {
    expect(validateItemPayload(sentientWeapon)).toEqual([]);
  });

  it("rejects duplicate stage orders", () => {
    const payload = structuredClone(sentientWeapon);
    payload.stages[1].order = 1;
    const errors = validateItemPayload(payload);
    expect(errors.some((e) => e.path === "stages[1].order" && e.message.includes("duplicate"))).toBe(true);
  });

  it("rejects a stage order below 1", () => {
    const payload = structuredClone(sentientWeapon);
    payload.stages[0].order = 0;
    expect(validateItemPayload(payload).some((e) => e.path === "stages[0].order")).toBe(true);
  });

  it("rejects an out-of-range counter threshold", () => {
    const payload = structuredClone(sentientWeapon);
    payload.stages[1].activation = { type: "counter", counterId: "kills", minimum: 100000 };
    expect(validateItemPayload(payload).some((e) => e.path === "stages[1].activation.minimum")).toBe(true);
  });
});

describe("stage lifecycle on a character copy", () => {
  it("a fresh copy begins in the first stage", () => {
    const item = homebrewPayloadToInventory("dawnbringer", "v1", "2014", sentientWeapon);
    expect(item.homebrew!.currentStageId).toBe("stage-1");
    expect(firstStageId(sentientWeapon)).toBe("stage-1");
  });

  it("stage 1 grants +1 and stage 2 replaces it with +2 (no stacking across stages)", () => {
    const stageOne = mechanicsAtStage("stage-1");
    expect(stageOne.sourceItemBonuses["copy-1"]).toMatchObject({ "weapon-attack": 1, "weapon-damage": 1 });

    const stageTwo = mechanicsAtStage("stage-2");
    expect(stageTwo.sourceItemBonuses["copy-1"]).toMatchObject({ "weapon-attack": 2, "weapon-damage": 2 });
    // The stage-1 effects are gated to stage-1 and must be gone.
    expect(stageTwo.contributions.some((c) => c.effectId === "s1-atk")).toBe(false);
  });

  it("stage 3 adds one 3rd-level slot and stage 4 exposes the Bless aura", () => {
    const stageThree = mechanicsAtStage("stage-3");
    expect(stageThree.spellSlotDeltas[3]).toBe(1);
    expect(stageThree.sourceItemBonuses["copy-1"]).toBeUndefined();

    const stageFour = mechanicsAtStage("stage-4");
    expect(stageFour.auras).toHaveLength(1);
    expect(stageFour.auras[0]).toMatchObject({ radiusFeet: 30, recipient: "allies" });
    expect(stageFour.spellSlotDeltas[3]).toBeUndefined();
  });

  it("reverting a stage removes its slot without erasing casts (overdrawn, not clamped)", () => {
    // At stage 3 the character had base 2 + 1 bonus = 3 slots and spent all 3.
    const atStageThree = computeSlotAvailability(2, 1, 3);
    expect(atStageThree).toMatchObject({ max: 3, available: 0, overdrawn: false });
    // Reverting to stage 2 drops the bonus slot. Used stays 3 — overdrawn.
    const reverted = computeSlotAvailability(2, 0, 3);
    expect(reverted).toMatchObject({ max: 2, used: 3, available: 0, overdrawn: true });
  });

  it("resolution is idempotent for the same source instance", () => {
    const instance = instanceAtStage("stage-2");
    const source = homebrewItemInstanceToSource(sentientWeapon, instance, 9, "copy-1");
    const mechanics = resolveMechanics([source, source]);
    expect(mechanics.sourceItemBonuses["copy-1"]).toMatchObject({ "weapon-attack": 2, "weapon-damage": 2 });
  });

  it("describes the stage diff for the manual confirmation preview", () => {
    const diff = describeStageChange(sentientWeapon, "stage-1", "stage-2");
    expect(diff.removed).toEqual(["+1 weapon-attack (this item)", "+1 weapon-damage (this item)"]);
    expect(diff.added).toEqual(["+2 weapon-attack (this item)", "+2 weapon-damage (this item)"]);
    const intoAura = describeStageChange(sentientWeapon, "stage-3", "stage-4");
    expect(intoAura.removed).toEqual(["+1 level-3 spell slot"]);
    expect(intoAura.added[0]).toContain("30 ft. aura (allies)");
  });

  it("exposes creator-defined counters in stage order", () => {
    expect(stageCounterIds(sentientWeapon)).toEqual(["kills"]);
    expect(sortedStages(sentientWeapon).map((s) => s.id)).toEqual(["stage-1", "stage-2", "stage-3", "stage-4"]);
  });
});

describe("stage state across version upgrades", () => {
  it("keeps the current stage when the new version still defines it", () => {
    const item = homebrewPayloadToInventory("dawnbringer", "v1", "2014", sentientWeapon);
    item.homebrew = { ...item.homebrew!, currentStageId: "stage-3", counters: { kills: 12 } };
    const upgraded = upgradeHomebrewInventoryItem(item, "dawnbringer", "v2", "2014", structuredClone(sentientWeapon));
    expect(upgraded.homebrew).toMatchObject({ currentStageId: "stage-3", counters: { kills: 12 } });
  });

  it("remaps a removed stage to the new version's first stage and says so in the preview", () => {
    const item = homebrewPayloadToInventory("dawnbringer", "v1", "2014", sentientWeapon);
    item.homebrew = { ...item.homebrew!, currentStageId: "stage-4" };
    const trimmed = structuredClone(sentientWeapon);
    trimmed.stages = trimmed.stages.filter((stage) => stage.id !== "stage-4");
    const upgraded = upgradeHomebrewInventoryItem(item, "dawnbringer", "v2", "2014", trimmed);
    expect(upgraded.homebrew!.currentStageId).toBe("stage-1");
    expect(describeItemUpgrade(sentientWeapon, trimmed).join("\n")).toContain("Removed stages remap to the first stage: Radiant");
  });
});

describe("server-side instance state validation", () => {
  function characterPatchWith(homebrew: Record<string, unknown>) {
    return {
      inventory: [{
        id: "copy-1",
        name: "Dawnbringer",
        quantity: 1,
        rarity: "Artifact",
        attunement: true,
        notes: "",
        homebrew: {
          contentRef: { source: "homebrew", kind: "item", definitionId: "dawnbringer", versionId: "v1", ruleset: "2014" },
          equipped: true,
          attuned: true,
          activeToggleIds: [],
          ...homebrew,
        },
      }],
    };
  }

  it("accepts stage, counters, and history within limits", () => {
    expect(() => validateCharacterInput(characterPatchWith({
      currentStageId: "stage-2",
      counters: { kills: 11 },
      stageHistory: [{ stageId: "stage-2", changedAt: new Date().toISOString(), changedBy: "R18 Reviewer", reason: "Tenth kill" }],
    }), true)).not.toThrow();
  });

  it("rejects a negative or non-integer counter", () => {
    expect(() => validateCharacterInput(characterPatchWith({ counters: { kills: -1 } }), true)).toThrow(/counters/);
    expect(() => validateCharacterInput(characterPatchWith({ counters: { kills: 1.5 } }), true)).toThrow(/counters/);
  });

  it("rejects an oversized history and malformed entries", () => {
    const entry = { stageId: "stage-2", changedAt: "2026-07-23T12:00:00.000Z", changedBy: "R18 Reviewer" };
    // An oversized history is rejected — the per-item JSON size cap fires
    // before the dedicated 100-entry stageHistory limit, and either is fine.
    expect(() => validateCharacterInput(characterPatchWith({
      stageHistory: Array.from({ length: 101 }, () => entry),
    }), true)).toThrow();
    expect(() => validateCharacterInput(characterPatchWith({
      stageHistory: [{ stageId: "stage-2" }],
    }), true)).toThrow(/changedAt/);
  });
});
