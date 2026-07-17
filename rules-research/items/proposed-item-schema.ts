# Proposed Canonical Item Schema

**Schema version**: 1.0.0  
**Designed**: 2026-07-16 (corrected 2026-07-17)  
**Research cutoff**: 2026-07-16

```typescript
// ============================================================================
// Canonical Item Schema v1.0.0 for Forge & Fable
// ============================================================================

/**
 * Publisher lane for source classification.
 * Separates first-party Wizards content from partnered, licensed, and charity releases.
 */
export type PublisherLane =
  | "wizards-first-party"
  | "official-licensed"
  | "partnered"
  | "charity"
  | "third-party";

/**
 * Price status — disambiguates what a zero or null cost means.
 * A single numeric costCp value is ambiguous without this status.
 */
export type PriceStatus =
  | "listed"        // Official listed price in the source
  | "not-listed"    // No official price exists (most magic items)
  | "varies"        // Price varies (e.g., by size, quality, or negotiation)
  | "not-applicable" // Cost concept does not apply (e.g., artifacts, story items)
  | "unknown";      // Not yet researched or source unavailable

export type ItemPrice = {
  /** Cost in copper pieces. null when not applicable or unknown. */
  costCp: number | null;
  /** What the value in costCp represents */
  status: PriceStatus;
  /** Source that provided the price, if applicable */
  sourceCode?: string;
};

/**
 * Magic item rarity — only for items where magical = true.
 * null for non-magical items. "varies" for items whose rarity depends on variant.
 */
export type CanonicalRarity =
  | "common"
  | "uncommon"
  | "rare"
  | "very-rare"
  | "legendary"
  | "artifact"
  | "varies"
  | null;

/**
 * Whether an item is magical and, if so, its rarity.
 * Separates the magical/non-magical axis from the rarity axis.
 */
export type ItemMagicClassification = {
  magical: boolean;
  rarity: CanonicalRarity;
};

/**
 * Item identity fields used for deterministic matching and lookup.
 */
export type CanonicalItemIdentity = {
  /** Stable unique identifier */
  id: string;
  /** Previous IDs if this item replaces or consolidates older records */
  legacyIds?: string[];
  /** Rules family */
  rulesVersion: "2014" | "2024" | "shared";
  /** Short source code */
  sourceCode: string;
  /** Machine-friendly normalized name */
  normalizedName: string;
  /** Known alternate names or formatting variants */
  aliases?: string[];
};

/**
 * The canonical item catalog record.
 * Designed to represent every official D&D 5e item while maintaining
 * backward compatibility with the current flat schema via _legacy* bridge fields.
 */
export type CanonicalItem = {
  // ---- Identity ----
  id: string;
  legacyIds?: string[];

  // ---- Naming ----
  name: string;
  normalizedName: string;
  aliases?: string[];

  // ---- Rules & Source ----
  rulesVersion: "2014" | "2024" | "shared";
  sourceCode: string;
  sourceTitle?: string;
  /** Publisher classification lane */
  publisherLane: PublisherLane;
  page?: number;
  section?: string;
  /** License governing this item's text */
  license?: "srd-5.1" | "srd-5.2.1" | "cc-by-4.0" | "ogl-1.0a" | "proprietary";

  // ---- Classification ----
  category: string;
  subcategory?: string;
  classification?: string;

  // ---- Magic Classification (replaces conflated rarity field) ----
  /** Whether this is a magic item */
  magical: boolean;
  /** Rarity: only meaningful when magical = true. null for mundane equipment. */
  rarity?: CanonicalRarity;

  // ---- Item Type Flags ----
  consumable?: boolean;
  stackable?: boolean;
  quantityUnit?: string;

  // ---- Economics ----
  price?: ItemPrice;
  weightLb?: number | null;

  // ---- Description ----
  description: string;
  shortDescription?: string;
  descriptionStatus?: "open-license" | "original-summary" | "metadata-only";

  // ---- Attunement ----
  attunement?: {
    required: boolean;
    requirementText?: string;
    classes?: string[];
    species?: string[];
    alignments?: string[];
  };

  // ---- Structured Weapon Data ----
  weapon?: {
    category?: string;
    rangeType?: "melee" | "ranged";
    damageDice?: string;
    damageType?: string;
    versatileDamageDice?: string;
    normalRangeFt?: number;
    longRangeFt?: number;
    properties?: string[];
    mastery?: string;
    ammunitionType?: string;
    magicBonus?: number;
    baseItemId?: string;
  };

  // ---- Structured Armor Data ----
  armor?: {
    category?: string;
    baseAc?: number;
    addDex?: boolean;
    maxDexBonus?: number;
    strengthRequirement?: number;
    stealthDisadvantage?: boolean;
    magicBonus?: number;
    baseItemId?: string;
  };

  // ---- Structured Tool Data ----
  tool?: {
    toolType?: string;
    abilitySuggestions?: string[];
    specificTool?: string;
  };

  // ---- Structured Container Data ----
  container?: {
    capacityWeightLb?: number;
    capacityVolume?: string;
  };

  // ---- Consumable Rules ----
  consumableRules?: {
    uses?: number;
    duration?: string;
    activation?: string;
    replenishes?: string;
  };

  // ---- Charges ----
  charges?: {
    maximum?: number;
    recharge?: string;
    destroyOnEmpty?: boolean;
  };

  // ---- Vehicle Data ----
  vehicle?: {
    vehicleType?: string;
    speed?: string;
    capacity?: string;
    armorClass?: number;
    hitPoints?: number;
    damageThreshold?: number;
  };

  // ---- Tags & Metadata ----
  tags?: string[];
  spoiler?: boolean;
  deprecated?: boolean;
  replacedBy?: string;

  // ---- Legacy Compatibility Fields ----
  _legacyProperties?: string;
  _legacyAc?: string;
  _legacyDamage?: string;
  _legacyDamageType?: string;
  _legacyAttunement?: boolean;
  _legacyCost?: string;
  /** Legacy rarity string for backward compat ("Mundane", "Common", etc.) */
  _legacyRarity?: string;
  image?: string;

  // ---- Provenance ----
  provenance: ItemProvenance[];
};

/**
 * Provenance record for a single source verification.
 */
export type ItemProvenance = {
  sourceCode: string;
  sourceTitle: string;
  rulesVersion: "2014" | "2024" | "shared";
  sourceType:
    | "srd"
    | "core-book"
    | "supplement"
    | "setting"
    | "adventure"
    | "anthology"
    | "digital"
    | "promotional";
  publisherLane: PublisherLane;
  page?: number;
  section?: string;
  officialUrlKey?: string;
  license?: string;
  researchedAt: string;
  researcherAgent: string;
  verificationStatus:
    | "single-source"
    | "cross-checked"
    | "manual-review";
};
```
