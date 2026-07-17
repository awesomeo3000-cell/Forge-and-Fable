# Repository & Consumer Audit: Item Data Flow in Forge & Fable

## 1. Item Catalog Source of Truth

### Canonical Store

**`src/data/items.json`** is the single canonical item catalog. It contains **1,055 items** across 15,827 lines (874 KB).

It is loaded in exactly one place: `src/lib/itemCatalog.ts:1`

```typescript
import rawItems from "@/data/items.json";
```

On line 4 it is cast:
```typescript
export const ITEM_CATALOG = rawItems as CatalogItem[];
```

There are **no other `@/data/*.json` item data sources**. No secondary catalogs, no DLC-like item packs.

### Secondary Hardcoded Items

`src/lib/ruleset.ts:3-25` defines `starterItems: InventoryItem[]` — a hardcoded array of 3 items:
- `item-healers-kit` (Healer's kit, Common)
- `item-moonsteel-token` (Moonsteel token, Uncommon, attunement)
- `item-ember-vial` (Ember vial, Rare)

These are `InventoryItem` objects, NOT `CatalogItem` objects. They are held in `ruleset.items` and are **not** part of the searchable catalog. They are available to the `DraftCharacter` type but are never consumed by any visible UI path — `HeroSheet` reads items from `character.inventory`, not `ruleset.items`.

### Static Equipment Defs

`src/lib/equipment.ts:35-68` defines `ARMORS` (12 entries, `ArmorDef[]`) and `WEAPONS` (17 entries, `WeaponDef[]`). These are **NOT** `CatalogItem` or `InventoryItem` types. They are independent data used for the legacy equipment system (`Equipment.armorId`, `Equipment.weaponIds`). They have their own IDs like `"leather"`, `"plate"`, `"longsword"`, etc. These are distinct from catalog item IDs like `"leather-1"`, `"plate-10"`, `"longsword-35"`.

---

## 2. All Imports / Consumers

### Files that import from `@/lib/itemCatalog`

| File | What is imported |
|---|---|
| `src/components/HeroSheet.tsx:37` | `ITEM_CATALOG, ITEM_RARITIES, catalogItemToInventory, getEquippedItemBonuses, isArmorItem, isShieldItem, isWeaponItem, itemHasPassiveBonus, itemMetaParts` |
| `src/lib/equipment.ts:2` | `getEquippedItemBonuses, isArmorItem, isShieldItem, isWeaponItem, itemArmorAcBonus, itemWeaponBonus` |

### Files that import from `@/data/items.json`

**Only** `src/lib/itemCatalog.ts:1` imports `@/data/items.json`. No other file imports it directly.

### Files that use `CatalogItem` type

| File | Usage |
|---|---|
| `src/types/game.ts:179-193` | Type definition |
| `src/lib/itemCatalog.ts:2,81,180` | Import, `itemMetaParts` parameter, `catalogItemToInventory` return type |
| `src/components/HeroSheet.tsx:22,37,94,504` | Import type, import catalog, `equipmentCatalogCategory` parameter, `addCatalogItem` parameter |

### Files that use `InventoryItem` type

| File | Usage |
|---|---|
| `src/types/game.ts:150-169` | Type definition |
| `src/types/game.ts:373,472,499` | In `Character.inventory`, `Ruleset.items`, `DraftCharacter.inventory` |
| `src/lib/itemCatalog.ts:2,6-12,147,180` | Import type, `ItemLike`, `getEquippedItemBonuses` param, `catalogItemToInventory` return |
| `src/lib/equipment.ts:1,93,117,133,154,200,231,238,289,369` | Type imports and function parameters |
| `src/lib/utils.ts:1,142,171,229` | Type import, `inventoryEntry()`, `createInitialDraft()`, `characterPayload()` |
| `src/lib/ruleset.ts:1,3` | Type import, `starterItems` |
| `src/components/HeroSheet.tsx:22,108,452-507` | Type import, `catalogBackedInventoryItem`, equipment functions |
| `src/components/ForgeAndFableApp.tsx:32,1959` | Type import, console `add-item` command |
| `src/app/api/import/pdf/create/route.ts:22,133,147,254` | Type import, `importedInventoryItem()` |

### Files that use `Equipment` type

| File | Usage |
|---|---|
| `src/types/game.ts:195-203` | Type definition |
| `src/lib/itemCatalog.ts:2,147` | Type import, `getEquippedItemBonuses` param |
| `src/lib/equipment.ts:1,200,289,369` | Type import, function parameters |
| `src/components/HeroSheet.tsx:22,205,439-484` | Type import, equipment state management |
| `src/app/api/import/pdf/create/route.ts:21,266` | Type import, PDF import character creation |
| `tests/equipment.test.ts:3,24-67` | Type import, test fixtures |

---

## 3. Item ID Flow

### Catalog Item IDs

Catalog items in `items.json` use two ID patterns:
- **Sequential numeric suffix** for mundane/early items: `"leather-1"`, `"padded-2"`, …, `"rapier-39"`, `"scimitar-40"` (roughly first ~40 items)
- **Semantic name-based** for magic items: `"sending-stones"`, `"stone-of-good-luck"`, `"robe-of-useful-items"`, `"quiver-of-ehlonna"`, etc.

IDs are **never persisted in the database as foreign keys**. They are only used at runtime in the client-side catalog.

### Inventory Item ID Generation

When `catalogItemToInventory()` (`src/lib/itemCatalog.ts:180-198`) converts a `CatalogItem` to an `InventoryItem`:

```typescript
export function catalogItemToInventory(item: CatalogItem): InventoryItem {
  return {
    id: crypto.randomUUID(),        // ← NEW UUID, NOT the catalog ID
    sourceItemId: item.id,          // ← Catalog ID stored here
    name: item.name,
    rarity: item.rarity,
    // … (all other fields copied) …
  };
}
```

**Critical**: The inventory item gets a **new random UUID** as its `id`. The original catalog item's `id` is stored in `sourceItemId` (type: `string | undefined`).

### Manual/Console Item Creation

- `HeroSheet` `addItem()` (line 487-503): Creates `InventoryItem` with `crypto.randomUUID()` as `id`, **no `sourceItemId`** set.
- `ForgeAndFableApp` console `add-item` (line 1958-1968): Same — `crypto.randomUUID()`, no `sourceItemId`.
- `utils.inventoryEntry()` (line 142-150): Generates ID as `"${slugified-name}-${index}"`, not UUID. No `sourceItemId`.
- `importedInventoryItem()` in PDF import route (line 133-142): Uses `randomUUID()` from `node:crypto`. No `sourceItemId`.

### Source Item ID Reconciliation

`catalogBackedInventoryItem()` in `HeroSheet.tsx:108-126` reconciles inventory items with their catalog source:

```typescript
function catalogBackedInventoryItem(item: InventoryItem): InventoryItem {
  const normalizedName = item.name.toLowerCase().replace(/\s+armor$/, "").trim();
  const catalog = ITEM_CATALOG.find((candidate) => candidate.id === item.sourceItemId)
    ?? ITEM_CATALOG.find((candidate) => candidate.name.toLowerCase() === normalizedName);
  if (!catalog) return item;
  const base = catalogItemToInventory(catalog);
  return {
    ...base,
    ...item,
    category: item.category || base.category,
    // … field-by-field fallback to catalog
  };
}
```

This means:
1. **First**: Look up by `sourceItemId` (exact match preferred)
2. **Fallback**: Look up by normalized name match
3. **If found**: Enrich missing fields from catalog, but preserve user-overridden values
4. **If not found**: Return the item as-is

### Equipment References

The `Equipment` object (`src/types/game.ts:195-203`) references inventory items by their **UUID-based inventory ID**:
```typescript
export type Equipment = {
  armorId?: string;        // Legacy static armor ID (e.g. "leather")
  shield?: boolean;         // Legacy shield flag
  weaponIds?: string[];     // Legacy static weapon IDs (e.g. "longsword")
  armorItemId?: string;     // UUID of inventory item serving as armor
  shieldItemId?: string;    // UUID of inventory item serving as shield
  weaponItemIds?: string[]; // UUIDs of inventory items serving as weapons
  bonusItemIds?: string[];  // UUIDs of inventory items providing passive bonuses
};
```

The legacy fields (`armorId`, `shield`, `weaponIds`) reference the static `ARMORS`/`WEAPONS` arrays in `equipment.ts`, NOT catalog items. The inventory-backed fields (`armorItemId`, `shieldItemId`, `weaponItemIds`, `bonusItemIds`) reference the UUID-based `InventoryItem.id`.

### Are Catalog IDs Ever Persisted?

**Yes**, indirectly — via `InventoryItem.sourceItemId`. When a catalog item is added to inventory through the UI, `sourceItemId` is preserved in the JSON blob stored in `characters.data`. This is the **only** persistent reference to catalog item IDs.

However, items added manually (custom items, console items) have **no** `sourceItemId`. If a catalog item's ID changed, existing characters that added that item would have a stale `sourceItemId` — the `catalogBackedInventoryItem()` function would fall back to name-based matching.

---

## 4. Database Investigation

### Schema

`src/lib/db.ts` defines these tables (CREATE TABLE statements at lines 59-373):

- `users` — user accounts
- **`characters`** — `id TEXT PK, user_id TEXT FK, data TEXT NOT NULL, revision INTEGER, created_at TEXT, updated_at TEXT`
- `feedback` — user feedback
- `auth_attempts` — rate limiting
- `campaigns`, `campaign_members`, `campaign_rolls`, `campaign_events`, `campaign_initiative`, `campaign_tracks`, `campaign_audio_assets`, `campaign_audio`, `campaign_presence`, `campaign_character_notes`, `campaign_requests`, `campaign_request_responses`, `campaign_scenes`, `campaign_npcs`, `campaign_loot_parcels`, `campaign_handouts`, `campaign_journal_entries`, `campaign_sessions`, `session_pins`
- `creature_library`, `saved_encounters`, `encounter_runs`
- `invite_codes`, `verification_tokens`, `user_portraits`
- `schema_migrations`

### No Dedicated Items/Equipment Table

There is **NO** `items`, `equipment`, or `inventory` table. Items are **not** normalized in the database.

### How Inventories Are Stored

Characters are stored as a JSON blob in `characters.data TEXT`. The serialization path:

1. **Save**: `serializedCharacter()` in `vaultStore.ts:123-127` calls `JSON.stringify(stored)` on the entire `Character` object. The `Character.inventory: InventoryItem[]` array and `Character.equipment: Equipment` object are serialized as part of this JSON blob.

2. **Load**: `parseCharacter()` in `vaultStore.ts:89-121` calls `JSON.parse(row.data)` and reconstructs the `Character` object.

3. **Update**: `updateCharacter()` in `vaultStore.ts:247-296` reads the full character, merges the patch with `{ ...current, ...patch }`, then writes the entire JSON blob back.

### Migration Code

The schema migrations (`migrateSchema()`, lines 390-478) are **column-oriented** and do not touch item data at all. Migrations add columns like `revision`, `is_ghost`, `theme_key`, etc. The legacy vault migration (`migrateLegacyVault()`, lines 481-535) migrates characters from a single JSON file (`forge-vault.json`) to SQLite rows, but does not transform item schemas.

### Campaign Loot System

Campaign loot parcels (`campaign_loot_parcels`) store loot items as JSON in the `data TEXT` column. Loot items have their own ID system (separate from character inventories). The loot system's `itemId` references are internal to the loot parcel JSON and are **not** related to catalog item IDs.

---

## 5. UI Components

### HeroSheet.tsx — Primary Item Consumer

**Equipment Section** (lines 1453-1500):
- Displays legacy static armor/weapons as checkboxes (lines 1459-1464)
- Displays inventory items as equip toggles with proficiency warnings (lines 1465-1479)
- "+ Add equipment" button opens the equipment catalog browser (line 1486)
- Catalog browser: search input + category filter + rarity filter (lines 1488-1493)
- Results show 24 items max, with "Add" button per item (line 1494)
- Custom item creation form with name, rarity, notes, weight fields (line 1496)

**Inventory Section** (lines 1818-1873):
- Currency panel with cp/sp/ep/gp/pp inputs (lines 1819-1836)
- Carrying capacity display (lines 1837-1848)
- Item list showing name, notes, equipped badges, rarity, attunement, remove button (lines 1850-1872)
- "Details" expandable section for description (lines 1862-1867)

**Attacks Section** (lines 1561-1595):
- Resolves weapon definitions from both legacy `equipment.weaponIds` and inventory `equipment.weaponItemIds` (lines 1562-1568)
- Computes to-hit and damage with item bonuses (lines 1571-1579)
- Falls back to class default actions if no weapons equipped

**Passive Bonus Integration** (lines 210-211):
```typescript
const inventoryItems = inventory.map(catalogBackedInventoryItem);
const equipmentItemBonuses = getEquippedItemBonuses(inventoryItems, equipment, { includeAc: false });
```
Applied to: spell save DC (line 704), spell attack (line 705), saving throws (line 251, display line 1359).

**Catalog Search** (lines 671-692):
Filters `ITEM_CATALOG` by category, rarity, and search text. Searches across: name, category, rarity, classification, ac, damage, damageType, properties, description.

### ForgeAndFableApp.tsx

- Console command `add-item` (line 1958-1968): Creates `InventoryItem` with `crypto.randomUUID()`, pushes to inventory array, no catalog backing.
- Loot response handling (lines 1556-1566): Processes campaign loot offers (separate item system).

---

## 6. API Routes

### No Dedicated Item API

There are **no** API routes at paths like `/api/items`, `/api/equipment`, or `/api/catalog`. Items are always loaded **client-side** via the static `import` of `items.json` bundled with the app.

### Routes with Item Interaction

- **`src/app/api/characters/[id]/route.ts`**: Generic CRUD for characters. Item data flows through the `Character` type's `inventory` and `equipment` fields as part of the full JSON blob.
- **`src/app/api/import/pdf/create/route.ts`**: Creates `InventoryItem` objects during PDF import. Uses `randomUUID()` for IDs, does not reference the catalog.
- **`src/app/api/campaigns/[id]/loot/[parcelId]/offer/route.ts`** and **`respond/route.ts`**: Campaign loot system with its own loot item IDs (unrelated to catalog or inventory items).
- **`src/app/api/campaigns/[id]/events/route.ts`**: Campaign events reference loot parcel `itemId` internally.

### Item Loading

Items are **client-side only**. The 874 KB `items.json` is statically imported and bundled by the build tool (Next.js/Turbopack). There is no server-side API that serves items.

---

## 7. Tests

### Direct Item Tests

- **`tests/equipment.test.ts`** (81 lines): Tests `computeArmorClass()` with legacy `Equipment` type (`armorId`, `shield`). Uses static armor IDs like `"leather"`, `"half-plate"`, `"chain-mail"`. Does **NOT** test inventory-backed items (`armorItemId`, `shieldItemId`). Does **NOT** reference `ITEM_CATALOG` or `CatalogItem`.

### Indirect Item Coverage

- **`tests/derivedStats.test.ts`**: No item references.
- **`tests/characterSaveCoordinator.test.ts`**: Tests save coordinator with generic patches (`currentHp`, `tempHp`, `name`). No inventory or equipment in patches.
- **`tests/characterApi.integration.test.ts`**: Character CRUD integration tests. May touch items indirectly through character JSON, but no item-specific assertions.
- **`tests/utils.test.ts`**: No item references found.

### No Test Coverage For

- `catalogItemToInventory()` conversion
- `catalogBackedInventoryItem()` enrichment
- `getEquippedItemBonuses()` calculation
- `itemPassiveBonuses()` regex parsing
- `itemWeaponBonus()` / `itemArmorAcBonus()`
- `isWeaponItem()` / `isArmorItem()` / `isShieldItem()` classification
- `ITEM_CATALOG` data integrity (all items have required fields)
- `sourceItemId` reconciliation logic

---

## 8. Scripts and Build

### package.json

No item-related scripts found. There are no `generate:items`, `build:items`, or similar npm scripts. No build scripts that process `items.json`.

### Build Process

`items.json` is a static JSON file imported directly. Next.js/Turbopack bundles it. There is no preprocessing, validation, or generation step.

---

## 9. Critical Questions Answered

### Q1: What is the actual canonical item store?

**`src/data/items.json`** (1,055 items) is the ONLY canonical item catalog. It is the single source of truth for all searchable/browsable items. Secondary item sources:
- `src/lib/ruleset.ts` `starterItems` (3 hardcoded InventoryItems) — not part of the catalog
- `src/lib/equipment.ts` `ARMORS` (12) and `WEAPONS` (17) — static legacy equipment, NOT catalog items

### Q2: Are item IDs persisted in character JSON or SQLite?

Catalog item IDs (`"leather-1"`, `"sending-stones"`) are persisted **indirectly** in `character.inventory[].sourceItemId` within the JSON blob in `characters.data TEXT`. Inventory items themselves have UUID-based IDs. Equipment references point to inventory UUIDs. The legacy equipment system references static ARMORS/WEAPONS IDs (not catalog IDs).

### Q3: Which fields are required at runtime?

**CatalogItem** fields used at runtime (all from `items.json`):

| Field | Required? | Runtime Use |
|---|---|---|
| `id` | YES | Catalog lookup key, `sourceItemId` persistence |
| `name` | YES | Display, search, name-based fallback matching |
| `description` | NO (but important) | Display, `itemText()` concatenation for bonus parsing |
| `category` | YES | Category filtering, equipment classification, bonus detection |
| `rarity` | YES | Rarity filtering, UI display |
| `classification` | NO | Supplement to category, armor proficiency detection |
| `ac` | NO | Armor Class calculation |
| `damage` | NO | Weapon damage dice |
| `damageType` | NO | Damage type display |
| `properties` | NO | Weapon properties (finesse, versatile, two-handed, ammunition, attunement), `itemText()` bonus detection, search |
| `cost` | NO | Cost display via `formatItemCost()` |
| `attunement` | YES | Display attunement tag, equipment logic |
| `image` | NO | **Not consumed anywhere** — present in type but never rendered |

### Q4: Which fields are display-only?

| Field | Display-Only? | Also Used For |
|---|---|---|
| `name` | Display | Search, name matching |
| `description` | Display | Regex bonus parsing |
| `rarity` | Display | Filtering |
| `category` | Display | Equipment classification, `isArmorItem()`/`isShieldItem()`/`isWeaponItem()` |
| `classification` | Display | Armor proficiency detection |
| `cost` | Display (via `formatItemCost`) | — |
| `notes` (InventoryItem) | Display | — |
| `image` | **Never displayed** | — |

### Q5: Can unknown fields be added safely?

**Yes, with caveats.** The import is:
```typescript
import rawItems from "@/data/items.json";
export const ITEM_CATALOG = rawItems as CatalogItem[];
```

The `as CatalogItem[]` cast means TypeScript will ignore extra fields at compile time. Extra fields in `items.json` will:
- Be present at runtime on the parsed objects
- Survive the `catalogItemToInventory()` conversion because it uses `{ ...spread }` syntax (only copies known fields)
- **NOT** survive `catalogItemToInventory()` unless the spread is modified

**Risk**: The `catalogItemToInventory()` function (line 180-198) uses explicit field mapping. Any new field added to `CatalogItem` type must also be added to this function's return object or it will be lost during conversion.

### Q6: Which components parse `properties` as text?

Yes, `properties` is **always** a string. It is parsed as text in:

| Location | What it parses |
|---|---|
| `src/lib/itemCatalog.ts:34-36` `itemText()` | Concatenates name + description + properties for regex bonus detection |
| `src/lib/itemCatalog.ts:85` `itemMetaParts()` | Pushes raw properties string as a display part |
| `src/lib/equipment.ts:96` `findWeaponForItem()` | Concatenates with name + description for weapon name matching |
| `src/lib/equipment.ts:242` `inventoryWeaponToDef()` | `.toLowerCase()` then `.includes("ammunition")`, `.includes("finesse")` |
| `src/lib/equipment.ts:244` `inventoryWeaponToDef()` | Regex: `/versatile\s*\(([^)]+)\)/i` to extract versatile damage |
| `src/lib/equipment.ts:258` `inventoryWeaponToDef()` | `.includes("two-handed")` |

The properties string format observed: `"finesse | light | thrown (range 20/60)"` or `"ammunition (range 100/400) | heavy | loading, two-handed"`. It is a pipe-separated list with some parenthetical parameters.

### Q7: What does `cost` represent?

**Copper pieces**, stored as a string. `formatItemCost()` (line 71-79) converts:
- Divisible by 100: displayed as `gp` (e.g., `"1000"` → `"10 gp"`)
- Divisible by 10 (not 100): displayed as `sp` (e.g., `"50"` → `"5 sp"`)
- Otherwise: displayed as `cp` (e.g., `"7"` → `"7 cp"`)
- Non-numeric strings: displayed as-is

Examples from `items.json`:
- `"cost": "1000"` = 10 gp (Leather armor)
- `"cost": "500"` = 5 sp (Padded armor)
- `"cost": "4500"` = 45 gp (Studded Leather)

### Q8: Is rarity used for mundane gear?

**Yes.** The rarity distribution: Mundane (78), Common (314), Uncommon (208), Rare (214), Very Rare (155), Legendary (83), Artifact (3).

`ITEM_RARITIES` (line 64-69) includes "Mundane" at the start of the sort order. The manual item creation form in HeroSheet (line 1496) offers "Mundane" as a rarity option. Non-magical gear like armor and basic weapons have `"rarity": "Common"` in the catalog.

### Q9: Are quantities stored on item definitions or inventory entries?

**Neither.** There is **no quantity field** anywhere:
- `CatalogItem` has no `quantity` field
- `InventoryItem` has no `quantity` field
- `ImportInventoryItem` (PDF import) has `quantity?: number` but it is **never mapped** to `InventoryItem` in the import route

Each inventory entry represents exactly **one** item. If a character has two daggers, there are two separate inventory entries.

### Q10: Are item mechanics executable or descriptive?

**Partially executable.** The app parses mechanics from text via regex:

1. **Passive bonuses** (`itemPassiveBonuses`, line 111-128): Regex scans concatenated `name + description + properties` for patterns like:
   - `+N bonus to AC` → adds to AC
   - `+N bonus to saving throws` → adds to saves
   - `+N bonus to spell attack rolls` → adds to spell attack
   - `+N bonus to spell save DC` → adds to spell save DC
   - `wearing no armor and using no shield` → flags unarmored requirement

2. **Weapon enhancement bonus** (`itemWeaponBonus`, line 135-138): Looks for `+[1-3] bonus to attack and damage rolls` in text, or falls back to `+[1-3]` in the item name (for weapons).

3. **Armor AC bonus** (`itemArmorAcBonus`, line 140-144): Uses passive AC bonus, or falls back to `+[1-3]` in the item name (for armor/shields).

4. **Name enhancement** (`nameEnhancementBonus`, line 45-50): Parses `+[1-3]` from the item name.

5. **Weapon property parsing** (`inventoryWeaponToDef`, line 238-262): Parses `finesse`, `two-handed`, `ammunition`, `versatile(XdY)` from properties string.

The app does **NOT**:
- Parse damage dice from descriptions (e.g., "deals an extra 1d6 fire damage")
- Execute spell-like item effects
- Handle limited-use items (charges, uses/day)
- Process condition application (poisoned, charmed, etc.)

---

## Summary Statistics

- **Total catalog items**: 1,055
- **Total type definitions**: 3 core item types (`CatalogItem`, `InventoryItem`, `Equipment`)
- **Files directly importing item types**: 9 source files + 1 test file
- **Database tables for items**: 0 (items are JSON blobs)
- **API endpoints for items**: 0 (client-side only)
- **Test coverage of item logic**: Minimal (only legacy AC tests)
- **Item ID persistence mechanism**: `sourceItemId` on `InventoryItem` (optional field)
- **Static equipment definitions**: 12 armors + 17 weapons (separate from catalog)
