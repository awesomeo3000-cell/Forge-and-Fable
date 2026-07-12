import { describe, expect, it } from "vitest";
import { DEFAULT_RULESET_ID, normalizeStoredRuleset, SUPPORTED_RULESET_IDS } from "@/lib/characterRuleset";
import { validateCharacterInput } from "@/lib/validateCharacter";
import { characterInput } from "./fixtures/character";

describe("character ruleset boundaries", () => {
  it("defaults legacy records to 2014 and only exposes approved production rulesets", () => {
    expect(DEFAULT_RULESET_ID).toBe("2014");
    expect(SUPPORTED_RULESET_IDS).toEqual(["2014"]);
    expect(normalizeStoredRuleset(undefined)).toBe("2014");
    expect(normalizeStoredRuleset("legacy-value")).toBe("2014");
    expect(normalizeStoredRuleset("2024")).toBe("2024");
  });

  it("requires a supported ruleset for new characters", () => {
    expect(validateCharacterInput(characterInput(), false)).toMatchObject({ ruleset: "2014" });
    expect(() => validateCharacterInput({ ...characterInput(), ruleset: "2024" }, false)).toThrow(/not available in production/);
  });

  it("does not allow an edition switch through an ordinary character patch", () => {
    expect(() => validateCharacterInput({ ruleset: "2024" }, true)).toThrow(/cannot be changed/);
  });
});
