import type { SpellData } from "@/types/game";

let spellLoadPromise: Promise<SpellData[]> | null = null;

export function fetchSpellCatalog(): Promise<SpellData[]> {
  spellLoadPromise ??= fetch("/api/spells")
    .then((response) => {
      if (!response.ok) {
        throw new Error("Spell catalog failed to load.");
      }
      return response.json() as Promise<SpellData[]>;
    });

  return spellLoadPromise;
}
