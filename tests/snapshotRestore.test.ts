import { describe, expect, it } from "vitest";
import { patchFromSnapshot } from "@/lib/characterSnapshots";
import { validateCharacterInput } from "@/lib/validateCharacter";
import { characterInput } from "./fixtures/character";
import type { Character, CharacterSnapshot } from "@/types/game";

function character(): Character {
  return {
    ...characterInput("Snapshot Hero"),
    id: "character-1",
    userId: "user-1",
    revision: 4,
    createdAt: "2026-07-11T00:00:00.000Z",
  };
}

describe("character snapshots", () => {
  it("restores gameplay fields without immutable persistence metadata", () => {
    const snapshot: CharacterSnapshot = {
      id: "snapshot-1",
      label: "Before the dragon",
      character: { ...character(), currentHp: 3 },
      createdAt: "2026-07-11T01:00:00.000Z",
    };
    const patch = patchFromSnapshot(snapshot, [snapshot]);

    expect(patch).toMatchObject({ currentHp: 3, snapshots: [snapshot] });
    expect(patch).not.toHaveProperty("id");
    expect(patch).not.toHaveProperty("userId");
    expect(patch).not.toHaveProperty("createdAt");
    expect(patch).not.toHaveProperty("revision");
    expect(() => validateCharacterInput(patch, true)).not.toThrow();
  });

  it("rejects recursively nested snapshot characters", () => {
    const nested = character();
    nested.snapshots = [];
    expect(() => validateCharacterInput({
      snapshots: [{ id: "snapshot-1", label: "Nested", createdAt: "2026-07-11", character: nested }],
    }, true)).toThrow(/cannot contain nested snapshots/);
  });
});
