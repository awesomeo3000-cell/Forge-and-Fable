# Item ID Compatibility Report

## 1. Current ID Systems

### Catalog Item IDs (`CatalogItem.id`)

Two patterns coexist in `items.json`:
- **Sequential suffix**: `"{name}-{N}"` where N is a 1-based index (e.g., `"leather-1"`, `"dagger-15"`, `"rapier-39"`). Used for approximately the first 40 items (mundane armor/weapons).
- **Semantic name-based**: `"{kebab-case-name}"` (e.g., `"sending-stones"`, `"robe-of-useful-items"`, `"well-of-many-worlds"`). Used for the majority of magic items.

### Inventory Item IDs (`InventoryItem.id`)

- **UUID-based**: `crypto.randomUUID()` for catalog-sourced and UI-created items
- **Slug-based**: `"{slugified-name}-{index}"` for `utils.inventoryEntry()` (starter kit)
- **Hardcoded**: `"item-healers-kit"`, `"item-moonsteel-token"`, `"item-ember-vial"` in `ruleset.ts`

### Static Equipment IDs (`ArmorDef.id`, `WeaponDef.id`)

- Simple semantic IDs: `"leather"`, `"plate"`, `"longsword"`, `"dagger"`, etc.
- These are **NOT** the same as catalog IDs (catalog has `"leather-1"`, static has `"leather"`)

## 2. What References Existing IDs

### Catalog IDs are referenced by:

1. **`InventoryItem.sourceItemId`** (persisted in `characters.data` JSON blob)
   - Set by `catalogItemToInventory()` in `src/lib/itemCatalog.ts:183`
   - Used by `catalogBackedInventoryItem()` in `HeroSheet.tsx:110` for catalog lookback
   - Fallback: name-based matching if `sourceItemId` lookup fails (line 111)

2. **Runtime search/filter**:
   - `ITEM_CATALOG.find()` by `id` (only in `catalogBackedInventoryItem`, line 110)
   - `ITEM_CATALOG.map()` for `ITEM_CATEGORIES` derivation (line 60-62)
   - `ITEM_CATALOG.map()` for `ITEM_RARITIES` derivation (line 64-69)
   - `ITEM_CATALOG.filter()` for search results in `itemMatches` useMemo (line 671-692)

### Static Equipment IDs are referenced by:

1. **`Equipment.armorId`** (persisted in `characters.data` JSON blob)
2. **`Equipment.weaponIds`** (persisted in `characters.data` JSON blob)
3. **`ARMORS_BY_ID` / `WEAPONS_BY_ID`** Maps in equipment.ts (lines 70-71)
4. **`ARMORS.find()` / `WEAPONS.find()`** for name matching (lines 77-98)
5. **`getArmor()` / `getWeapon()`** lookup functions (lines 73-74)

## 3. Can Catalog Item IDs Be Changed?

### Renaming Existing IDs — Risk: MEDIUM

- **Impact on existing characters**: Characters that already added the item to their inventory will have the old ID in `sourceItemId`. The `catalogBackedInventoryItem()` function will **fail the `sourceItemId` lookup** but **succeed the name-based fallback** (line 111). This means:
  - Item enrichment will still work via name matching
  - The stale `sourceItemId` will remain in the persisted data but become inert
  - No data loss or crash

- **Impact on runtime**: None. IDs are not used as React keys in the catalog browser.

- **Migration burden**: None required for a simple rename if the name stays the same. If both ID and name change, the fallback fails and items lose catalog enrichment.

### Changing ID Format — Risk: LOW

Changing from `"leather-1"` to a new format like `"armor-leather"` has the same fallback behavior as renaming. The `sourceItemId` becomes stale, name-based matching takes over.

### Adding New Items — Risk: NONE

New items with new unique IDs have no backward compatibility concerns.

### Deleting Items — Risk: LOW

Deleted items that were already added to character inventories will:
- Lose catalog enrichment via `sourceItemId` (dead reference)
- Lose catalog enrichment via name-based fallback (no match found)
- But retain all data that was snapshotted at the time of adding

## 4. Can Inventory Item IDs Be Changed?

**Inventory item IDs are generated at creation time and cannot be "changed" in bulk.** Each is a UUID or slug unique to a specific character. The `Equipment` object references these IDs.

- Changing the ID generation strategy would only affect new items.
- Existing persisted UUIDs in `Equipment.armorItemId`, `Equipment.shieldItemId`, `Equipment.weaponItemIds`, `Equipment.bonusItemIds` are permanent references that would break if inventory item IDs were retroactively changed.

## 5. Migration Risk Summary

| Operation | Risk | Mitigation |
|---|---|---|
| Rename catalog item ID | MEDIUM | Name-based fallback in `catalogBackedInventoryItem()` provides resilience |
| Rename catalog item ID + name | HIGH | Would break enrichment for existing characters; consider migration script |
| Add new catalog items | NONE | No backward references exist |
| Delete catalog items | LOW | Snapshot data retained in inventory; only enrichment lost |
| Change catalog ID format | LOW | Same as rename — fallback works |
| Add required fields to CatalogItem | LOW | Old items in inventory just have `undefined` for new fields |
| Remove fields from CatalogItem | MEDIUM | `catalogItemToInventory()` explicitly maps fields — must update |
| Change inventory ID generation | LOW | Only affects new items |
| Change Equipment reference semantics | HIGH | Would break all existing character equipment state |

## 6. Recommendations

1. **Do NOT rename catalog item IDs without also keeping the name stable.** The name-based fallback is the only safety net.

2. **If IDs must change**, consider a migration approach:
   - Add a `legacyIds?: string[]` field to `CatalogItem`
   - Update `catalogBackedInventoryItem()` to also check `legacyIds`
   - This would allow old `sourceItemId` values to continue resolving

3. **The `image` field is dead code** — present in both `CatalogItem` and `InventoryItem` types, copied by `catalogItemToInventory()`, but never rendered. It can be safely removed from both types and from `items.json`.

4. **The `cost` field is always a string** in practice, but `formatItemCost()` handles non-numeric gracefully. Converting to a number would require updating `formatItemCost()` and `itemMetaParts()`.

5. **Test coverage for item ID reconciliation is zero.** Any ID migration work should include tests for `catalogBackedInventoryItem()` and fallback behavior.
