import { describe, it, expect } from "vitest";
import {
  rollRequestDescriptor,
  rollRequestMode,
  summarizeRollRequest,
  combineRollModes,
} from "@/lib/rollRequest";

describe("rollRequestDescriptor", () => {
  it("names an ability check", () => {
    expect(rollRequestDescriptor({ kind: "check", keyType: "ability", key: "strength" })).toBe("Strength check");
  });
  it("names a saving throw", () => {
    expect(rollRequestDescriptor({ kind: "save", key: "wisdom" })).toBe("Wisdom saving throw");
  });
  it("names a skill check from the skill id", () => {
    expect(rollRequestDescriptor({ kind: "check", keyType: "skill", key: "perception" })).toBe("Perception check");
  });
  it("names initiative", () => {
    expect(rollRequestDescriptor({ kind: "initiative" })).toBe("Initiative");
  });
  it("honors the legacy kind:skill shape", () => {
    expect(rollRequestDescriptor({ kind: "skill", key: "stealth" })).toBe("Stealth check");
  });
  it("falls back gracefully on garbage", () => {
    expect(rollRequestDescriptor({ kind: "check", key: "not-a-key" })).toBe("Ability check");
  });
});

describe("rollRequestMode", () => {
  it("reads advantage/disadvantage, defaults to normal", () => {
    expect(rollRequestMode({ advantage: "advantage" })).toBe("advantage");
    expect(rollRequestMode({ advantage: "disadvantage" })).toBe("disadvantage");
    expect(rollRequestMode({})).toBe("normal");
    expect(rollRequestMode({ advantage: "garbage" })).toBe("normal");
  });
});

describe("combineRollModes (5e adv/dis cancel)", () => {
  it("opposite sources cancel to normal", () => {
    expect(combineRollModes("advantage", "disadvantage")).toBe("normal");
    expect(combineRollModes("disadvantage", "advantage")).toBe("normal");
  });
  it("same or single source carries", () => {
    expect(combineRollModes("advantage", "advantage")).toBe("advantage");
    expect(combineRollModes("advantage", "normal")).toBe("advantage");
    expect(combineRollModes("normal", "disadvantage")).toBe("disadvantage");
    expect(combineRollModes("normal", "normal")).toBe("normal");
  });
});

describe("summarizeRollRequest", () => {
  it("combines prompt, descriptor, advantage and a revealed DC", () => {
    expect(
      summarizeRollRequest({ prompt: "Spot the ambush", kind: "check", keyType: "skill", key: "perception", advantage: "disadvantage", dc: 15 }),
    ).toBe("Spot the ambush — Perception check · with disadvantage · DC 15");
  });
  it("omits an unrevealed DC and normal mode", () => {
    expect(summarizeRollRequest({ kind: "save", key: "dexterity" })).toBe("Dexterity saving throw");
  });
});
