# Item ID Compatibility Report

**Updated**: 2026-07-17 (added rules-version–aware fallback)

## 1. Current ID Systems

### Catalog Item IDs (`CatalogItem.id`)

Two patterns coexist in `items.json`:
- **Sequential suffix**: `"{name}-{N}"` (e.g., `"leather-1"`, `"dagger-15"`). ~513 items.
- **Semantic name-based**: `"{kebab-case-name}"` (e.g., `"sending-stones"`). ~542 items.

### Inventory Item IDs (`InventoryItem.id`)

- **UUID-based**: `crypto.randomUUID()` for catalog-sourced and UI-created items
- **Slug-based**: `"{slugified-name}-{index}"` for starter kit items
- **Hardcoded**: `"item-healers-kit"`, `"item-moonsteel-token"`, `"item-ember-vial"` in `ruleset.ts`

---

## 2. What References Existing IDs

### Catalog IDs are referenced by:

1. **`InventoryItem.sourceItemId`** (persisted in `characters.data` JSON blob)
   - Set by `catalogItemToInventory()` in `src/lib/itemCatalog.ts:183`
   - Used by `catalogBackedInventoryItem()` in `HeroSheet.tsx:110` for catalog lookback
   - **Name-based fallback** on line 111 — matches by normalized name if `sourceItemId` fails

2. **Runtime search/filter** in `HeroSheet.tsx:671-692`

---

## 3. Risks When Adding 2014/2024 Records

### The Name-Based Fallback Is Not Sufficient for Dual-Version Catalogs

Once the catalog contains both 2014 and 2024 versions of the same item name, the current fallback becomes dangerous:

```
InventoryItem { sourceItemId: "longsword-35", name: "Longsword" }
```

If `longsword-35` is deprecated and there are now two "Longsword" records (one 2014, one 2024), the name-based fallback will match **arbitrarily** — whichever comes first in the array.

**Same-name records may differ across**: rules versions, sources, variant families, templates, adventure-specific objects, reprints, and revised mechanics.

### Required Lookup Priority

```
1. Exact match on sourceItemId
2. Match on legacyIds (if sourceItemId is a deprecated ID)
3. Exact match on canonical item ID
4. Normalized name + rulesVersion + sourceCode
5. Verified alias + rulesVersion
6. Manual reconciliation (flag for review, do not silently bind)
```

### Required Rule

**Never allow a plain name match to silently bind a 2014 inventory record to a 2024 item.** The current `catalogBackedInventoryItem()` function must be updated before dual-version records are added to the catalog.

### Recommended Identity Fields for Canonical Schema

```typescript
type CanonicalItemIdentity = {
  id: string;
  legacyIds?: string[];
  rulesVersion: "2014" | "2024" | "shared";
  sourceCode: string;
  normalizedName: string;
  aliases?: string[];
};
```

The lookup function should use `CanonicalItemIdentity` for matching, not just a name string.

---

## 4. Migration Risk Summary

| Operation | Risk | Mitigation |
|---|---|---|
| Rename catalog item ID | MEDIUM | Add old ID to `legacyIds`; update lookup to check `legacyIds` |
| Rename catalog item ID + name | HIGH | Requires migration script or `legacyIds` + alias matching |
| Add new catalog items | NONE | No backward references exist |
| Add 2014/2024 variant of existing item | **HIGH** | Name-based fallback becomes ambiguous; must implement rules-version–aware matching FIRST |
| Delete catalog items | LOW | Snapshot data retained; use `deprecated` + `replacedBy` instead of deletion |
| Change catalog ID format | LOW | Same as rename — use `legacyIds` |
| Add required fields to CatalogItem | LOW | Old inventory items just have `undefined` |
| Remove fields from CatalogItem | MEDIUM | `catalogItemToInitialize()` explicitly maps fields |

---

## 5. Recommendations

1. **Before adding any 2014/2024 dual-version records**, update `catalogBackedInventoryItem()` to use the staged lookup priority above.

2. **Add `legacyIds` to the canonical schema** and update the lookup to check it.

3. **Add a `rulesVersion` filter to the name-based fallback** — when resolving by name, prefer the same rules version as a `rulesVersion` field on the inventory item (if present), or require explicit disambiguation.

4. **Add `_legacyRarity` bridge field** to preserve the current flat rarity string for backward compatibility.

5. **Test coverage for item ID reconciliation is zero.** Any ID migration work must include tests for the staged lookup, legacy ID resolution, and rules-version–aware matching.
