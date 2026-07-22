import { describe, expect, it } from "vitest";
import { getFeat } from "@/lib/feats";
import { spellsGrantedByInvocations } from "@/lib/featChoices";

describe("feat choices", () => {
  it("exposes spell and invocation choices for feats that need player input", () => {
    expect(getFeat("fey-touched")?.grantsSpells?.choose).toMatchObject({ count: 1, level: 1 });
    expect(getFeat("magic-initiate")?.grantsSpells?.chooseCantrips).toEqual({ count: 2 });
    expect(getFeat("eldritch-adept")?.invocationChoices).toEqual({ count: 1 });
    expect(getFeat("skill-expert")?.skillChoices).toEqual({ proficiency: 1, expertise: 1 });
  });

  it("resolves invocation spell grants without duplicating spells", () => {
    expect(spellsGrantedByInvocations(["mask-of-many-faces", "mask-of-many-faces", "devils-sight"])).toEqual(["disguise-self"]);
  });
});
