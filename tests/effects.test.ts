import { describe, expect, it } from "vitest";
import { EFFECT_PRESETS } from "@/lib/effects";

describe("condition presets", () => {
  it("includes every core 5e condition", () => {
    const labels = new Set(EFFECT_PRESETS.filter((preset) => preset.source === "Condition").map((preset) => preset.label));
    expect([...labels]).toEqual(expect.arrayContaining([
      "Blinded", "Charmed", "Deafened", "Exhaustion", "Frightened", "Grappled",
      "Incapacitated", "Invisible", "Paralyzed", "Petrified", "Poisoned", "Prone",
      "Restrained", "Stunned", "Unconscious",
    ]));
  });
});
