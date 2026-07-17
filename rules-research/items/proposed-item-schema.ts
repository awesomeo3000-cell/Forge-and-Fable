# Proposed Canonical Item Schema

```typescript
// ============================================================================
// Canonical Item Schema for Forge & Fable
// Designed 2026-07-16 by Agent 4 (Schema Architect)
// ============================================================================

/**
 * The canonical item catalog record.
 * Designed to represent every official D&D 5e item while maintaining
 * backward compatibility with the current flat schema.
 */
export type CanonicalItem = {
  // ---- Identity ----
  /** Stable unique identifier. Preserve existing IDs from current catalog.
   *  New IDs follow pattern: item:<rulesVersion>:<sourceCode>:<normalized-slug> */
  id: string;
  /** Previous IDs if this item replaces or consolidates older records */
  legacyIds?: string[];

  // ---- Naming ----
  /** Display name (preserve original formatting) */
  name: string;
  /** Machine-friendly normalized name for matching (NFKD, lowercase, straight quotes, etc.) */
  normalizedName: string;
  /** Known alternate names or formatting variants */
  aliases?: string[];

  // ---- Rules & Source ----
  /** Rules family this item belongs to */
  rulesVersion: "2014" | "2024" | "shared";
  /** Short code for the sourcebook (e.g., "phb-2014", "dmg-2024", "tcoe") */
  sourceCode: string;
  /** Human-readable source title */
  sourceTitle?: string;
  /** Page number in the source */
  page?: number;
  /** Section or chapter reference */
  section?: string;
  /** License governing this item's text */
  license?: "srd-5.1" | "srd-5.2" | "cc-by-4.0" | "ogl-1.0a" | "proprietary";

  // ---- Classification ----
  /** Primary category (Armor, Weapon, Wondrous Items, Ring, etc.) */
  category: string;
  /** Secondary classification for sub-grouping */
  subcategory?: string;
  /** Legacy classification field for backward compat */
  classification?: string;

  // ---- Rarity ----
  /** Standard 5e rarity tiers plus 'mundane' for non-magical and 'none' for items without rarity */
  rarity?:
    | "common"
    | "uncommon"
    | "rare"
    | "very-rare"
    | "legendary"
    | "artifact"
    | "varies"
    | "mundane"
    | "none";

  // ---- Item Type Flags ----
  /** True if this is non-magical equipment */
  mundane?: boolean;
  /** True if this is a magic item (or magical variant of mundane gear) */
  magical?: boolean;
  /** True if this item is destroyed/consumed on use */
  consumable?: boolean;
  /** True if multiples of this item can stack in one inventory slot */
  stackable?: boolean;
  /** Unit for quantity display (e.g., "arrow", "ration") */
  quantityUnit?: string;

  // ---- Economics ----
  /** Cost in copper pieces. null if cost is unknown/varies. Omit for priceless items. */
  costCp?: number | null;
  /** Weight in pounds. null if weightless/varies. */
  weightLb?: number | null;

  // ---- Description ----
  /** Full item description (SRD text for open-license; original summary for proprietary) */
  description: string;
  /** Brief one-liner for card/list views */
  shortDescription?: string;
  /** Description provenance status */
  descriptionStatus?: "open-license" | "original-summary" | "metadata-only";

  // ---- Attunement ----
  attunement?: {
    /** Whether attunement is required */
    required: boolean;
    /** Free-text requirement (e.g., "by a spellcaster", "by a dwarf") */
    requirementText?: string;
    /** Classes that can attune, if restricted */
    classes?: string[];
    /** Species that can attune, if restricted */
    species?: string[];
    /** Alignments that can attune, if restricted */
    alignments?: string[];
  };

  // ---- Structured Weapon Data ----
  weapon?: {
    /** Weapon category: simple, martial */
    category?: string;
    /** Melee or ranged */
    rangeType?: "melee" | "ranged";
    /** Damage dice expression (e.g., "1d8", "2d6") */
    damageDice?: string;
    /** Damage type (e.g., "slashing", "piercing") */
    damageType?: string;
    /** Two-handed damage dice, if versatile */
    versatileDamageDice?: string;
    /** Normal range in feet */
    normalRangeFt?: number;
    /** Long range in feet (disadvantage beyond normal) */
    longRangeFt?: number;
    /** Weapon properties as structured array */
    properties?: string[];
    /** 2024 weapon mastery property */
    mastery?: string;
    /** Ammunition type required */
    ammunitionType?: string;
    /** Magic enhancement bonus (+1, +2, +3) */
    magicBonus?: number;
    /** Base mundane weapon this magic weapon is based on */
    baseItemId?: string;
  };

  // ---- Structured Armor Data ----
  armor?: {
    /** Armor category: light, medium, heavy, shield */
    category?: string;
    /** Base AC provided (before Dex) */
    baseAc?: number;
    /** Whether Dexterity modifier is added */
    addDex?: boolean;
    /** Maximum Dexterity bonus allowed */
    maxDexBonus?: number;
    /** Minimum Strength required to wear without penalty */
    strengthRequirement?: number;
    /** Whether this armor imposes disadvantage on Stealth checks */
    stealthDisadvantage?: boolean;
    /** Magic enhancement bonus (+1, +2, +3) */
    magicBonus?: number;
    /** Base mundane armor this magic armor is based on */
    baseItemId?: string;
  };

  // ---- Structured Tool Data ----
  tool?: {
    /** Type of tool (e.g., "artisans-tools", "gaming-set", "musical-instrument") */
    toolType?: string;
    /** Suggested ability checks for using this tool */
    abilitySuggestions?: string[];
    /** Specific tool name within a type (e.g., "Smith's Tools" within "artisans-tools") */
    specificTool?: string;
  };

  // ---- Structured Container Data ----
  container?: {
    /** Maximum weight capacity in pounds */
    capacityWeightLb?: number;
    /** Volume capacity description */
    capacityVolume?: string;
  };

  // ---- Consumable Rules ----
  consumableRules?: {
    /** Number of uses before item is consumed */
    uses?: number;
    /** Duration of effect when used */
    duration?: string;
    /** Action type required to use (action, bonus action, reaction, etc.) */
    activation?: string;
    /** Whether the item replenishes (e.g., daily at dawn) */
    replenishes?: string;
  };

  // ---- Charges ----
  charges?: {
    /** Maximum number of charges */
    maximum?: number;
    /** How charges replenish (e.g., "1d3 at dawn") */
    recharge?: string;
    /** Whether the item is destroyed when the last charge is expended */
    destroyOnEmpty?: boolean;
  };

  // ---- Vehicle Data ----
  vehicle?: {
    /** Type of vehicle (land, water, air, spelljamming) */
    vehicleType?: string;
    /** Speed description */
    speed?: string;
    /** Capacity description */
    capacity?: string;
    /** Vehicle's armor class */
    armorClass?: number;
    /** Vehicle's hit points */
    hitPoints?: number;
    /** Damage threshold */
    damageThreshold?: number;
  };

  // ---- Tags & Metadata ----
  /** Flexible tags for filtering (e.g., "cursed", "sentient", "firearm", "siege") */
  tags?: string[];
  /** Whether this item contains adventure spoilers */
  spoiler?: boolean;
  /** Whether this item is deprecated (replaced by another record) */
  deprecated?: boolean;
  /** ID of the item that replaces this one */
  replacedBy?: string;

  // ---- Legacy Compatibility Fields ----
  /** Legacy flat string properties for backward compat with current consumers */
  _legacyProperties?: string;
  /** Legacy string AC for backward compat */
  _legacyAc?: string;
  /** Legacy string damage for backward compat */
  _legacyDamage?: string;
  /** Legacy string damage type for backward compat */
  _legacyDamageType?: string;
  /** Legacy boolean attunement for backward compat */
  _legacyAttunement?: boolean;
  /** Legacy string cost in cp for backward compat */
  _legacyCost?: string;
  /** Legacy image key */
  image?: string;

  // ---- Provenance ----
  /** Source verification trail. Multiple entries if cross-referenced. */
  provenance: ItemProvenance[];
};

/**
 * Provenance record for a single source verification.
 * Every canonical item must have at least one provenance entry.
 */
export type ItemProvenance = {
  /** Short source code (e.g., "dmg-2014", "phb-2024") */
  sourceCode: string;
  /** Human-readable source title */
  sourceTitle: string;
  /** Rules family of this source */
  rulesVersion: "2014" | "2024" | "shared";
  /** Type of source */
  sourceType:
    | "srd"
    | "core-book"
    | "supplement"
    | "setting"
    | "adventure"
    | "anthology"
    | "digital"
    | "promotional";
  /** Page number, if known */
  page?: number;
  /** Section or chapter */
  section?: string;
  /** Official URL key (D&D Beyond slug), if applicable */
  officialUrlKey?: string;
  /** License governing this source's content */
  license?: string;
  /** ISO timestamp of research */
  researchedAt: string;
  /** Identifier of the agent/person who researched */
  researcherAgent: string;
  /** Verification confidence level */
  verificationStatus:
    | "single-source"
    | "cross-checked"
    | "manual-review";
};
```
