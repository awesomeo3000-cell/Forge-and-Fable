/**
 * POST /api/import/pdf/create
 *
 * Accepts a reviewed ImportDraft and creates a real Forge & Fable character.
 * Validates through the normal character validation pipeline.
 */

import { NextResponse } from "next/server";
import { createCharacter } from "@/lib/vaultStore";
import { authenticateRequest, AuthError } from "@/lib/auth";
import { validateCharacterInput } from "@/lib/validateCharacter";
import type { ImportDraft } from "@/lib/import/pdfTypes";
import type { Character, AbilityKey, AbilityScores, InventoryItem, Equipment, CharacterPage, PageBlock } from "@/types/game";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Convert an ImportDraft into a minimal Character payload suitable for creation.
 * Gaps stay as defaults; the user can fill them in later from the sheet.
 */
function draftToCharacter(draft: ImportDraft): Omit<Character, "id" | "userId" | "createdAt"> {
  const abilityKeys = ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"] as const;

  // Build abilities — default 10 for anything not confirmed
  const abilities: AbilityScores = Object.fromEntries(
    abilityKeys.map((k) => [k, draft.abilities[k]?.value ?? 10]),
  ) as AbilityScores;

  // Build inventory items from imported inventory
    const inventory: InventoryItem[] = (draft.inventory ?? []).map((item, idx) => ({
      id: `imported-${idx}-${Date.now()}`,
    name: item.value?.name ?? "Unknown item",
    rarity: "Common",
    attunement: false,
    notes: item.value?.notes ?? "",
    weight: item.value?.weight,
  }));

  // Build equipment if attacks are found
  const equipment: Equipment = {};
  const weaponIds: string[] = [];
  if (draft.attacks.length > 0) {
    draft.attacks.forEach((atk) => {
      if (atk.value?.name) {
        weaponIds.push(atk.value.name.toLowerCase().replace(/\s+/g, "-"));
      }
    });
    equipment.weaponIds = weaponIds;
  }

  // Build custom pages for imported features and backstory
  const pages: CharacterPage[] = [];
  if (draft.notes?.features?.value) {
    const blocks: PageBlock[] = [
      { id: "feat-text", type: "text", content: draft.notes.features.value },
    ];
    pages.push({ id: "imported-features", title: "Imported Features", blocks });
  }
  if (draft.notes?.backstory?.value) {
    const blocks: PageBlock[] = [
      { id: "backstory-text", type: "text", content: draft.notes.backstory.value },
    ];
    pages.push({ id: "imported-backstory", title: "Imported Backstory", blocks });
  }
  if (draft.notes?.personality?.value) {
    const blocks: PageBlock[] = [
      { id: "personality-text", type: "text", content: draft.notes.personality.value },
    ];
    pages.push({ id: "imported-personality", title: "Imported Personality", blocks });
  }

  const characterName = draft.identity?.name?.value ?? "Imported Character";

  return {
    name: characterName,
    level: draft.identity?.level?.value ?? 1,
    alignment: "Neutral",
    background: draft.identity?.background?.value ?? "",
    physicalCharacteristics: draft.notes?.appearance?.value ?? "",
    personalCharacteristics: draft.notes?.personality?.value ?? "",
    generalNotes: draft.notes?.backstory?.value ?? "",
    raceId: draft.identity?.species?.value?.toLowerCase().replace(/\s+/g, "-") ?? "human",
    classId: draft.identity?.className?.value?.toLowerCase() ?? "fighter",
    sourceIds: ["phb"],
    settings: {
      diceRollingEnabled: true,
      optionalClassFeatures: false,
      customizeOrigin: false,
      advancementType: "milestone",
      hitPointType: "fixed",
      usePrerequisites: true,
      useFeatPrerequisites: true,
      useMulticlassPrerequisites: false,
      showLevelScaledSpells: false,
      encumbranceType: "none",
      ignoreCoinWeight: true,
      modifiersTop: false,
    },
    abilities,
    currentHp: draft.vitals?.currentHp?.value ?? draft.vitals?.maxHp?.value ?? 10,
    maxHp: draft.vitals?.maxHp?.value ?? 10,
    tempHp: draft.vitals?.tempHp?.value ?? 0,
    inventory,
    spellsKnown: (draft.spells ?? []).map((s) => s.value?.name ?? "").filter(Boolean),
    customRules: [],
    skillProficiencies: draft.proficiencies?.skills?.value ?? [],
    savingThrowProficiencies: (draft.proficiencies?.savingThrows?.value ?? []) as AbilityKey[],
    deathSaves: { successes: 0, failures: 0 },
    theme: null,
    sheetLayout: undefined,
    spellSlotsUsed: {},
    pactSlotsUsed: 0,
    concentratingOn: null,
    subclassId: undefined,
    asiChoices: [],
    hpRolls: [],
    hitDiceSpent: 0,
    equipment,
    preparedSpells: [],
    spellStatuses: {},
    heroicInspiration: false,
    effects: [],
    pages,
    currency: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 },
  };
}

export async function POST(request: Request) {
  try {
    const userId = await authenticateRequest(request);
    const body = await request.json();

    const { draft } = body as { draft: ImportDraft };

    if (!draft || !draft.identity?.name?.value) {
      return NextResponse.json(
        { error: "Draft must include at least a character name." },
        { status: 400 },
      );
    }

    // Convert draft → character payload
    const rawCharacter = draftToCharacter(draft);

    // Run through normal validation
    const validated = validateCharacterInput(rawCharacter, false) as Omit<Character, "id" | "userId" | "createdAt">;

    // Create character
    const character = await createCharacter(userId, validated);

    return NextResponse.json({ character }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Failed to create character from import.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
