import type { Character, CharacterPatch, CharacterSnapshot } from "@/types/game";

const MAX_SNAPSHOT_JSON_LENGTH = 250_000;

/**
 * Snapshots contain a complete character for display, but restoring one must
 * never send identity or persistence metadata through the character PATCH API.
 * Edition identity is also immutable and is intentionally not restored by a
 * gameplay snapshot.
 */
export function patchFromSnapshot(snapshot: CharacterSnapshot, snapshots: CharacterSnapshot[], currentRuleset?: Character["ruleset"]): CharacterPatch {
  if (currentRuleset && snapshot.character.ruleset && snapshot.character.ruleset !== currentRuleset) {
    throw new Error(`Snapshot ruleset ${snapshot.character.ruleset} cannot be restored onto a ${currentRuleset} character.`);
  }
  const patch = structuredClone(snapshot.character) as Partial<Character>;
  delete patch.id;
  delete patch.userId;
  delete patch.createdAt;
  delete patch.revision;
  delete patch.ruleset;
  delete patch.snapshots;
  if (!snapshot.character.subclassId) patch.subclassId = "";
  return { ...patch, snapshots } as CharacterPatch;
}

export function assertSnapshotCharacter(value: unknown): asserts value is Character {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`"snapshots[].character" must be an object.`);
  }

  const character = value as Record<string, unknown>;
  for (const key of ["id", "userId", "createdAt", "name"] as const) {
    if (typeof character[key] !== "string" || !(character[key] as string).trim()) {
      throw new Error(`"snapshots[].character.${key}" must be a non-empty string.`);
    }
  }

  if ("snapshots" in character) {
    throw new Error(`"snapshots[].character" cannot contain nested snapshots.`);
  }

  if (JSON.stringify(character).length > MAX_SNAPSHOT_JSON_LENGTH) {
    throw new Error(`"snapshots[].character" is too large.`);
  }
}
