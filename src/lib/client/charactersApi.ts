import type { Character } from "@/types/game";

const jsonHeaders: Record<string, string> = {
  "Content-Type": "application/json",
};

export async function fetchCharacters() {
  const response = await fetch("/api/characters", {
    headers: jsonHeaders,
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Vault session could not load.");
  }

  const data = (await response.json()) as { characters: Character[] };
  return data;
}

export async function updateCharacter(characterId: string, patch: Record<string, unknown>) {
  const response = await fetch(`/api/characters/${encodeURIComponent(characterId)}`, {
    method: "PUT",
    headers: jsonHeaders,
    credentials: "include",
    body: JSON.stringify(patch),
  });

  const data = (await response.json()) as { character?: Character; error?: string };

  if (!response.ok || !data.character) {
    throw new Error(data.error || "Unable to update character.");
  }

  return data.character;
}

export async function createCharacter(payload: Record<string, unknown>) {
  const response = await fetch("/api/characters", {
    method: "POST",
    headers: jsonHeaders,
    credentials: "include",
    body: JSON.stringify(payload),
  });

  const data = (await response.json()) as { character?: Character; error?: string };

  if (!response.ok || !data.character) {
    throw new Error(data.error || "Unable to create character.");
  }

  return data.character;
}

export async function deleteCharacter(characterId: string) {
  const response = await fetch(`/api/characters/${encodeURIComponent(characterId)}`, {
    method: "DELETE",
    headers: jsonHeaders,
    credentials: "include",
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({} as { error?: string }));
    throw new Error(data.error || "Unable to delete character.");
  }
}
