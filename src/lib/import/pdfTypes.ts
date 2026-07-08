import type { AbilityKey } from "@/types/game";

// ── Confidence states ──

export type ImportConfidence = "confirmed" | "review" | "missing";

// ── Generic import field wrapper ──

export type ImportField<T> = {
  value: T | null;
  confidence: ImportConfidence;
  source?: string;
  note?: string;
};

// ── Source descriptor ──

export type ImportSource = {
  kind: "dnd-beyond" | "fillable-pdf" | "generic-pdf";
  pages: number;
  fileName?: string;
};

// ── Attack row from a sheet ──

export type ImportAttack = {
  name: string;
  hit: string;
  damage: string;
  notes: string;
};

// ── Inventory row from a sheet ──

export type ImportInventoryItem = {
  name: string;
  quantity?: number;
  weight?: number;
  notes?: string;
};

// ── Spell row from a sheet ──

export type ImportSpell = {
  name: string;
  level?: number;
  prepared?: boolean;
};

// ── The full import draft ──

export type ImportDraft = {
  source: ImportSource;

  identity: {
    name: ImportField<string>;
    className: ImportField<string>;
    level: ImportField<number>;
    species: ImportField<string>;
    background: ImportField<string>;
  };

  abilities: Record<AbilityKey, ImportField<number>>;

  vitals: {
    maxHp: ImportField<number>;
    currentHp: ImportField<number>;
    tempHp: ImportField<number>;
    armorClass: ImportField<number>;
    initiative: ImportField<number>;
    speed: ImportField<string>;
  };

  proficiencies: {
    savingThrows: ImportField<string[]>;
    skills: ImportField<string[]>;
    armor: ImportField<string[]>;
    weapons: ImportField<string[]>;
    languages: ImportField<string[]>;
    tools: ImportField<string[]>;
  };

  attacks: Array<ImportField<ImportAttack>>;
  inventory: Array<ImportField<ImportInventoryItem>>;
  spells: Array<ImportField<ImportSpell>>;

  notes: {
    features: ImportField<string>;
    backstory: ImportField<string>;
    personality: ImportField<string>;
    appearance: ImportField<string>;
  };
};

// ── Helpers ──

export function emptyField<T>(value: T | null = null, confidence: ImportConfidence = "missing"): ImportField<T> {
  return { value, confidence };
}

export function confirmedField<T>(value: T, source?: string): ImportField<T> {
  return { value, confidence: "confirmed", source };
}

export function reviewField<T>(value: T | null, note?: string): ImportField<T> {
  return { value, confidence: "review", note };
}

export function missingField<T>(): ImportField<T> {
  return { value: null, confidence: "missing" };
}

/** Create an empty draft. The analyzer fills in what it finds. */
export function emptyDraft(): ImportDraft {
  const abilityKeys: AbilityKey[] = ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"];
  const abilities = Object.fromEntries(abilityKeys.map((k) => [k, missingField<number>()])) as ImportDraft["abilities"];

  return {
    source: { kind: "generic-pdf", pages: 0 },
    identity: {
      name: missingField(),
      className: missingField(),
      level: missingField(),
      species: missingField(),
      background: missingField(),
    },
    abilities,
    vitals: {
      maxHp: missingField(),
      currentHp: missingField(),
      tempHp: missingField(),
      armorClass: missingField(),
      initiative: missingField(),
      speed: missingField(),
    },
    proficiencies: {
      savingThrows: missingField(),
      skills: missingField(),
      armor: missingField(),
      weapons: missingField(),
      languages: missingField(),
      tools: missingField(),
    },
    attacks: [],
    inventory: [],
    spells: [],
    notes: {
      features: missingField(),
      backstory: missingField(),
      personality: missingField(),
      appearance: missingField(),
    },
  };
}
