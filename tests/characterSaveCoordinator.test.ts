import { describe, expect, it, vi } from "vitest";
import { CharacterSaveCoordinator, type CharacterSaveResult } from "@/lib/client/characterSaveCoordinator";
import type { Character, CharacterPatch } from "@/types/game";

function serverCharacter(revision: number, name = "Hero") {
  return { id: "char-1", revision, name } as Character;
}

describe("CharacterSaveCoordinator", () => {
  it("serializes rapid writes and advances the revision", async () => {
    const resolvers: Array<(result: CharacterSaveResult) => void> = [];
    const send = vi.fn((id: string, patch: CharacterPatch, revision: number) => {
      void id;
      void patch;
      void revision;
      return new Promise<CharacterSaveResult>((resolve) => resolvers.push(resolve));
    });
    const onSaved = vi.fn();
    const coordinator = new CharacterSaveCoordinator({ send, onSaved, onRebase: vi.fn(), onError: vi.fn() });

    coordinator.enqueue("char-1", { currentHp: 11 }, 0);
    coordinator.enqueue("char-1", { tempHp: 3 }, 0);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][2]).toBe(0);

    resolvers.shift()!({ conflict: false, character: serverCharacter(1) });
    await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(2));
    expect(send.mock.calls[1][2]).toBe(1);
    resolvers.shift()!({ conflict: false, character: serverCharacter(2) });
    await vi.waitFor(() => expect(onSaved).toHaveBeenCalledTimes(2));
  });

  it("rebases and retries a stale write", async () => {
    const send = vi.fn()
      .mockResolvedValueOnce({ conflict: true, character: serverCharacter(4, "Remote") })
      .mockResolvedValueOnce({ conflict: false, character: serverCharacter(5, "Local") });
    const onRebase = vi.fn();
    const onError = vi.fn();
    const coordinator = new CharacterSaveCoordinator({ send, onSaved: vi.fn(), onRebase, onError });

    coordinator.enqueue("char-1", { name: "Local" }, 1);
    await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(2));
    expect(send.mock.calls[1][2]).toBe(4);
    expect(onRebase).toHaveBeenCalledWith("char-1", expect.objectContaining({ name: "Remote" }), { name: "Local" });
    expect(onError).not.toHaveBeenCalled();
  });
});
