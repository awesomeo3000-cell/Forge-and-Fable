# Schema Mapping: Current → Proposed Canonical

Maps every field from the current flat `CatalogItem` schema to the proposed canonical `CanonicalItem` schema.

## Direct Mappings

| Current Field | Canonical Field | Notes |
|---|---|---|
| `id` | `id` | Preserve as-is. Add `legacyIds` for renamed items. |
| `name` | `name` | Preserve display name as-is. Add `normalizedName` and `aliases`. |
| `image` | `image` | Preserve. Currently dead code but harmless. |
| `description` | `description` | Preserve text. Add `shortDescription` and `descriptionStatus`. |
| `category` | `category` | Preserve as-is. Add `subcategory` for finer grouping. |
| `classification` | `classification` | Preserve as legacy field. Structured data moves to sub-types. |
| `rarity` | `rarity` | Map string → canonical enum. Normalize case. Add `mundane`/`magical` flags. |
| `ac` | `_legacyAc` + `armor.baseAc` | Parse "14 + Dex" → `baseAc: 14, addDex: true`. Preserve original string. |
| `damage` | `_legacyDamage` + `weapon.damageDice` | Parse "1d8" → string. Add `weapon.damageType` separately. |
| `damageType` | `_legacyDamageType` + `weapon.damageType` | 99.9% empty currently. Populate for all weapons. |
| `properties` | `_legacyProperties` + `weapon.properties[]` | Split pipe-delimited string into array. Preserve original for backward compat. |
| `cost` | `_legacyCost` + `costCp` | Parse string to number (copper pieces). Preserve original string. |
| `attunement` | `_legacyAttunement` + `attunement.required` | Map boolean → object. Preserve boolean for backward compat. |

## New Fields Without Current Equivalent

| Canonical Field | Reason |
|---|---|
| `normalizedName` | Required for deterministic matching and deduplication |
| `aliases` | Handle name variants (e.g., "Longsword, +1" / "+1 Longsword") |
| `rulesVersion` | Essential for 2014/2024 coexistence |
| `sourceCode` | Required provenance tracking |
| `sourceTitle` | Human-readable source display |
| `page` / `section` | Precise source location |
| `license` | Required for open-content compliance |
| `subcategory` | Finer grouping within categories |
| `mundane` / `magical` / `consumable` / `stackable` | Type classification flags |
| `costCp` | Typed cost (number, copper pieces) |
| `weightLb` | Weight tracking (currently absent from catalog) |
| `shortDescription` | Brief display for card views |
| `descriptionStatus` | License compliance tracking |
| `attunement.*` | Structured attunement requirements |
| `weapon.*` | Structured weapon mechanics |
| `armor.*` | Structured armor mechanics |
| `tool.*` | Structured tool data |
| `container.*` | Structured container data |
| `consumableRules.*` | Consumable item behavior |
| `charges.*` | Charge-based item behavior |
| `vehicle.*` | Vehicle data |
| `tags` | Flexible filtering |
| `spoiler` | Adventure content warning |
| `deprecated` / `replacedBy` | Safe deprecation mechanism |
| `_legacy*` | Backward compatibility bridge fields |
| `provenance` | Source verification trail |

## Field Transformation Rules

### `rarity` → Canonical Rarity
```
Current          → Canonical
"Mundane"        → "mundane" + mundane: true
"Common"         → "common" (check if mundane or magic)
"Uncommon"       → "uncommon" + magical: true
"Rare"           → "rare" + magical: true
"Very Rare"      → "very-rare" + magical: true
"Legendary"      → "legendary" + magical: true
"Artifact"       → "artifact" + magical: true
```

### `cost` → `costCp`
```
"1000"    → costCp: 1000, _legacyCost: "1000"
"500"     → costCp: 500, _legacyCost: "500"
"0"       → costCp: 0, _legacyCost: "0"
```

### `attunement` → `attunement`
```
true  → attunement: { required: true }
false → attunement: { required: false }
```

### `properties` → `weapon.properties[]`
```
"finesse | light | thrown (range 20/60)" 
  → weapon.properties: ["finesse", "light", "thrown (range 20/60)"]
  → _legacyProperties: "finesse | light | thrown (range 20/60)"

"ammunition (range 100/400) | heavy | loading, two-handed"
  → weapon.properties: ["ammunition (range 100/400)", "heavy", "loading", "two-handed"]
  → _legacyProperties: "ammunition (range 100/400) | heavy | loading, two-handed"
```

### `ac` → `armor`
```
"11 + Dex"           → armor: { baseAc: 11, addDex: true }
"12 + Dex (max 2)"   → armor: { baseAc: 12, addDex: true, maxDexBonus: 2 }
"16"                 → armor: { baseAc: 16, addDex: false }
"+2"                 → armor: { magicBonus: 2 } (shield bonus)
```
