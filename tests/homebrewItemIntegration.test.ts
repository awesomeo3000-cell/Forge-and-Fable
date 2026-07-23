import { describe, expect, it } from "vitest";
import {
  catalogItemToHomebrewPayload,
  describeItemUpgrade,
  homebrewPayloadToInventory,
  upgradeHomebrewInventoryItem,
} from "@/lib/homebrew/itemIntegration";
import { homebrewItemInstanceToSource } from "@/lib/homebrew/mechanicSources";
import { resolveMechanics } from "@/lib/homebrew/mechanicsResolver";
import { plusTwoWeapon } from "./fixtures/homebrew";
import type { CatalogItem } from "@/types/game";

describe("Phase 3 item integration", () => {
  it("clones rules-facing weapon fields from a built-in baseline", () => {
    const longsword: CatalogItem = {
      id: "longsword",
      name: "Longsword",
      description: "A martial blade.",
      category: "Weapon",
      classification: "Martial Melee",
      rarity: "Mundane",
      damage: "1d8",
      damageType: "slashing",
      properties: "Versatile (1d10)",
      cost: "1500",
      attunement: false,
    };
    expect(catalogItemToHomebrewPayload(longsword)).toMatchObject({
      name: "Longsword",
      damage: "1d8",
      damageType: "slashing",
      properties: "Versatile (1d10)",
      equipmentSlots: ["hand"],
    });
  });

  it("uses the inventory copy id for source-scoped bonuses", () => {
    const item = homebrewPayloadToInventory("moonsteel", "v1", "2014", plusTwoWeapon);
    item.homebrew!.equipped = true;
    const source = homebrewItemInstanceToSource(plusTwoWeapon, item.homebrew!, 5, item.id);
    const mechanics = resolveMechanics([source]);
    expect(mechanics.sourceItemBonuses[item.id]).toMatchObject({
      "weapon-attack": 2,
      "weapon-damage": 2,
    });
  });

  it("keeps per-copy state while explicitly pinning a newer version", () => {
    const item = homebrewPayloadToInventory("moonsteel", "v1", "2014", plusTwoWeapon);
    item.homebrew = { ...item.homebrew!, equipped: true, bodyLocation: "Right hand", instanceNotes: "Won at Dawnwatch" };
    const plusThree = structuredClone(plusTwoWeapon);
    plusThree.effects = plusThree.effects.map((effect) => effect.type === "numeric-bonus" ? { ...effect, value: 3 } : effect);
    const upgraded = upgradeHomebrewInventoryItem(item, "moonsteel", "v2", "2014", plusThree);
    expect(upgraded.homebrew).toMatchObject({
      equipped: true,
      bodyLocation: "Right hand",
      instanceNotes: "Won at Dawnwatch",
      contentRef: { versionId: "v2" },
    });
    expect(describeItemUpgrade(plusTwoWeapon, plusThree)).toContain("Metadata or effect configuration changed.");
  });
});
