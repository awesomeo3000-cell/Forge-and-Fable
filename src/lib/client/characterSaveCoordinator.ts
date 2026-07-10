import type { Character, CharacterPatch } from "@/types/game";

export type CharacterSaveResult =
  | { conflict: false; character: Character }
  | { conflict: true; character: Character };

type SaveState = {
  revision: number;
  pending: CharacterPatch;
  running: boolean;
};

type SaveHooks = {
  send: (characterId: string, patch: CharacterPatch, revision: number) => Promise<CharacterSaveResult>;
  onSaved: (characterId: string, character: Character) => void;
  onRebase: (characterId: string, serverCharacter: Character, optimisticPatch: CharacterPatch) => void;
  onError: (characterId: string, error: unknown) => void;
};

/**
 * Coalesces rapid edits and allows only one write per character at a time.
 * Conflicts are rebased onto the latest server character and retried with its
 * revision, preventing late responses from replacing newer optimistic state.
 */
export class CharacterSaveCoordinator {
  private readonly states = new Map<string, SaveState>();

  constructor(private readonly hooks: SaveHooks) {}

  enqueue(characterId: string, patch: CharacterPatch, revision: number) {
    const state = this.states.get(characterId) ?? { revision, pending: {}, running: false };
    state.pending = { ...state.pending, ...patch };
    this.states.set(characterId, state);
    if (!state.running) void this.flush(characterId, state);
  }

  reset(characterId?: string) {
    if (characterId) this.states.delete(characterId);
    else this.states.clear();
  }

  private async flush(characterId: string, state: SaveState) {
    state.running = true;
    let consecutiveConflicts = 0;

    while (Object.keys(state.pending).length > 0) {
      const patch = state.pending;
      state.pending = {};

      try {
        const result = await this.hooks.send(characterId, patch, state.revision);
        if (result.conflict) {
          consecutiveConflicts += 1;
          state.revision = result.character.revision ?? 0;
          const rebasedPatch = { ...patch, ...state.pending };
          this.hooks.onRebase(characterId, result.character, rebasedPatch);
          state.pending = rebasedPatch;
          if (consecutiveConflicts >= 3) {
            throw new Error("Character kept changing in another session. Review the latest values and try again.");
          }
          continue;
        }

        consecutiveConflicts = 0;
        state.revision = result.character.revision ?? state.revision + 1;
        this.hooks.onSaved(characterId, result.character);
      } catch (error) {
        state.pending = { ...patch, ...state.pending };
        this.hooks.onError(characterId, error);
        break;
      }
    }

    state.running = false;
  }
}
