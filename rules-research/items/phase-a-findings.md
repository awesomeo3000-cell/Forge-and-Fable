# Phase A Findings: Repository Audit, Catalog Profile, Source Manifest & Schema Design

**Date**: 2026-07-16
**Branch**: `research/exhaustive-item-catalog`
**Status**: COMPLETE — ready for Phase B

---

## Executive Summary

Phase A completed four parallel investigations without modifying any production data. Here are the consolidated findings:

| Investigation | Key Finding |
|---|---|
| **Repo Audit** | `src/data/items.json` is the sole canonical store. 1,055 items. IDs are persisted via `sourceItemId` in character JSON blobs. No dedicated items table in SQLite. `image` field is dead code. Zero test coverage for item logic. |
| **Catalog Profile** | 1,055 items across 17 categories. 16 high-severity anomalies (13 structural duplicates, Plate wrong rarity, Oil of Taggit cross-category duplicate). 185 mundane items misclassified as "Common" instead of "Mundane". 99.9% of weapons lack damageType. |
| **Source Manifest** | 71 total sources identified: 51 included, 16 excluded, 4 pending review. Covers 2014 core (4), 2024 core (4), supplements (9), settings (13), adventures (16), anthologies (7), starters (6), digital (12). All accessible. |
| **Schema Design** | Recommended: **Option B** — canonical `items.canonical.json` + build-generated `items.json` for backward compatibility. Schema adds ~40 fields with structured weapon/armor/tool data, rules versioning, provenance tracking, and `_legacy*` bridge fields. |

---

## 1. Repository Audit (Agent 1)

### Canonical Store
- `src/data/items.json` is the **only** canonical item catalog
- 1,055 items, 874 KB, statically imported by `src/lib/itemCatalog.ts:1`
- No secondary catalogs, no DLC packs, no API-served items
- Secondary item sources exist but are not catalog items:
  - `src/lib/ruleset.ts`: 3 hardcoded `starterItems` (not catalog-backed)
  - `src/lib/equipment.ts`: 12 `ARMORS` + 17 `WEAPONS` static definitions (legacy system)

### Item ID Flow
- Catalog IDs (e.g., `"leather-1"`, `"sending-stones"`) → converted to UUID-based inventory IDs via `catalogItemToInventory()` → `sourceItemId` stores the original catalog ID
- Character inventory is a JSON blob in `characters.data TEXT` column
- Equipment references (`Equipment.armorItemId`, `shieldItemId`, `weaponItemIds`, `bonusItemIds`) point to UUID inventory IDs, NOT catalog IDs
- **Critical safety net**: `catalogBackedInventoryItem()` has a name-based fallback — if `sourceItemId` lookup fails, it matches by normalized name. This means catalog ID changes are survivable.

### Database
- SQLite via `node:sqlite`, schema revision 18
- **No dedicated items/equipment/inventory tables**
- Items exist only as JSON within character blobs
- Schema migrations are column-oriented and never touch item data

### Consumer Map
| File | Role |
|---|---|
| `src/lib/itemCatalog.ts` | Core module — imports items.json, exports ITEM_CATALOG and 12 utility functions |
| `src/components/HeroSheet.tsx` | Primary UI — equipment browser, inventory, equipment slots, passive bonuses |
| `src/lib/equipment.ts` | AC computation, weapon property parsing, encumbrance |
| `src/lib/utils.ts` | Character creation helpers |
| `src/lib/ruleset.ts` | Starter item definitions |
| `src/app/api/import/pdf/create/route.ts` | PDF character import |
| `src/components/ForgeAndFableApp.tsx` | Console commands |

### Test Coverage
- **Zero** test coverage for: `catalogItemToInventory()`, `catalogBackedInventoryItem()`, `getEquippedItemBonuses()`, `itemPassiveBonuses()`, `isWeaponItem()`, `isArmorItem()`, `isShieldItem()`, `sourceItemId` reconciliation
- Only `tests/equipment.test.ts` touches items, and only tests legacy static armor AC (not inventory-backed)

### Key Risks
- `catalogItemToInventory()` uses explicit field mapping — new fields added to `CatalogItem` MUST be added to this function or they're lost during conversion
- `properties` is parsed as text in 5+ locations via `.includes()` and regex — changing it to an array is a BREAKING change
- `attunement` is checked as boolean in HeroSheet — changing to object is a BREAKING change
- `image` field is present in types and JSON but NEVER rendered — dead code

### Deliverables
- ✅ `rules-research/items/agents/repo-audit/repo-audit.md`
- ✅ `rules-research/items/current-schema.json`
- ✅ `rules-research/items/item-consumers.json`
- ✅ `rules-research/items/id-compatibility-report.md`

---

## 2. Catalog Profile (Agent 2)

### Summary Statistics
- **1,055 total records** across 17 categories
- Top categories: Scroll (320), Wondrous Items (199), Adventuring Gear (192)
- Rarity distribution: Common (314), Rare (214), Uncommon (208), Very Rare (155), Legendary (83), Mundane (78), Artifact (3)
- 202 items require attunement (19.1%)
- 896 items have no image (84.9%)

### High-Severity Anomalies (16 identified)
1. **13 structural duplicates**: Arcane Focus (5 variants), Druidic Focus (4 variants), Holy Symbol (3 variants) exist twice — once with numeric ID suffix, once without
2. **Oil of Taggit cross-category duplicate**: `oil-of-taggit-192` (Poisons) and `oil-of-taggit` (Potions & Oils) — same item
3. **Plate armor at "Rare"**: `plate-10` is standard 1,500 gp mundane plate but marked "Rare" while all other mundane armor is "Common"
4. **99.9% of weapons lack damageType**: Only Scimitar of Speed has it populated

### Medium-Severity Anomalies (4 identified)
1. **185 mundane items marked "Common"**: Adventuring Gear, Tools, Food, Mounts, Tack, Instruments should be "Mundane"
2. **147 zero-cost magic item templates**: Missing costs for generic templates (Flametongue, +1 Weapon, etc.)
3. **Scroll classification misuse**: 320 scrolls use classification for spell metadata, not item type
4. **Weapon damage missing**: 44 weapons (templates + ammunition + net) have no damage value

### Cost Analysis
- All costs verified correct in copper pieces against SRD
- 147 items have zero cost (magic item templates)
- Median cost: 12,000 cp (120 gp)
- Max: 16,500,000 cp (Holy Avenger Greatsword)

### ID Patterns
- 513 IDs with numeric suffix (48.6%), 542 without (51.4%)
- Early equipment: `leather-1` through `spikes-iron-10-142`
- Magic items: descriptive kebab-case (`sending-stones`, `robe-of-useful-items`)

### Deliverables
- ✅ `rules-research/items/current-catalog-profile.json`
- ✅ `rules-research/items/current-catalog-profile.md`
- ✅ `rules-research/items/current-catalog-normalized.json` (1,055 items with `normalizedName` added)
- ✅ `rules-research/items/current-data-anomalies.json` (22 anomalies)

---

## 3. Source Manifest (Agent 3)

### Scope Summary
**71 sources identified**: 51 included, 16 excluded, 4 pending review

### Included Sources by Type
| Type | Count | Details |
|---|---|---|
| Core Books | 6 | PHB 2014, DMG 2014, PHB 2024, DMG 2024, SRD 5.1, SRD 5.2 |
| Supplements | 6 | Xanathar's, Tasha's, Fizban's, Bigby's, Book of Many Things, Sword Coast Adventurer's Guide |
| Settings | 11 | Eberron, Wildemount, Theros, Ravenloft, Ravnica, Strixhaven, Spelljammer, Planescape, Dragonlance, plus 2024 settings |
| Adventures | 16 | Curse of Strahd, Tomb of Annihilation, Storm King's Thunder, Out of the Abyss, Princes of the Apocalypse, Tyranny of Dragons, Dragon Heist, Dungeon of the Mad Mage, Descent into Avernus, Rime of the Frostmaiden, Wild Beyond the Witchlight, Radiant Citadel, Keys from the Golden Vault, Phandelver and Below, Vecna: Eve of Ruin, Infinite Staircase |
| Anthologies | 7 | Candlekeep Mysteries, Tales from the Yawning Portal, Ghosts of Saltmarsh, Quests from the Infinite Staircase, etc. |
| Starters | 5 | Lost Mine of Phandelver, Dragon of Icespire Peak, Dragons of Stormwreck Isle, etc. |

### Excluded Sources (16)
- Monster Manuals (2014, 2025) — no standalone player-usable items
- Children's books, comics, cookbooks
- Superseded reprints (Tyranny of Dragons 2023, Wayfinder's Guide to Eberron)
- Unofficial/third-party products

### Pending Review (4)
- Extra Life charity products (DMsGuild, content verification needed)
- Domains of Delight, Minsc and Boo's Journal of Villainy

### Access Status
- All 51 included sources are fully accessible (web research)
- No blocked sources among the included set
- Research cutoff: July 2026

### Deliverables
- ✅ `rules-research/items/source-manifest.json` (44 KB, 71 entries)
- ✅ `rules-research/items/source-manifest.md` (14 KB)
- ✅ `rules-research/items/source-access-blockers.md` (8 KB)

---

## 4. Schema Architecture (Agent 4)

### Recommendation: Option B — Canonical + Generated Legacy

**File architecture:**
```
src/data/items.canonical.json   ← Hand-edited, full schema, source of truth
scripts/build-items-legacy.mjs   ← Auto-generates flat format
src/data/items.json              ← Build artifact (generated, not hand-edited)
```

### Canonical Schema Highlights
- **~40 new fields** organized into structured sub-types:
  - `weapon`: damage dice, damage type, range, properties (array), mastery, magic bonus, base item
  - `armor`: base AC, dex bonus, max dex, STR requirement, stealth, magic bonus, base item
  - `tool`, `container`, `consumableRules`, `charges`, `vehicle`
  - `attunement`: structured object with requirement text, class/species/alignment restrictions
  - `provenance[]`: multi-source verification trail
- **`_legacy*` bridge fields**: `_legacyProperties`, `_legacyAc`, `_legacyDamage`, `_legacyDamageType`, `_legacyAttunement`, `_legacyCost` — preserve original string formats for current consumers
- **New top-level fields**: `rulesVersion`, `sourceCode`, `sourceTitle`, `page`, `license`, `normalizedName`, `aliases`, `mundane`/`magical`/`consumable`/`stackable` flags, `weightLb`, `costCp`, `tags`, `spoiler`, `deprecated`, `replacedBy`

### Compatibility Analysis
| Change | Risk | Mitigation |
|---|---|---|
| Add new optional fields | NONE | TypeScript structural typing ignores unknown fields |
| Add `_legacy*` fields | NONE | Extra fields; current code ignores them |
| Change `properties` string→array | BREAKING | Keep `_legacyProperties` string; add `weapon.properties[]` array |
| Change `attunement` boolean→object | BREAKING | Keep `_legacyAttunement` boolean; add `attunement` object |
| Change `cost` string→number | BREAKING | Keep `_legacyCost` string; add `costCp` number |

### Key Design Decisions (10 logged)
1. **Cost**: number (cp) with legacy string bridge
2. **Attunement**: structured object with legacy boolean bridge
3. **Properties**: array in canonical, string in legacy
4. **AC**: parsed into structured armor data, original string preserved
5. **Weight**: `number | null` (null = weightless)
6. **Rarity**: lowercase normalized, plus `mundane`/`magical` boolean flags
7. **Rules version**: `"2014" | "2024" | "shared"` — "shared" avoids duplicating unchanged items
8. **Provenance**: array for multi-source items
9. **Deprecation**: `deprecated` + `replacedBy` instead of deletion
10. **File naming**: `items.canonical.json` signals authoritative role

### Deliverables
- ✅ `rules-research/items/proposed-item-schema.ts`
- ✅ `rules-research/items/schema-mapping.md`
- ✅ `rules-research/items/schema-migration-options.md`
- ✅ `rules-research/items/schema-decision-log.md`

---

## 5. Interdependencies & Conflicts

### Issues Requiring Resolution Before Phase B
1. **Schema strategy must be locked** — Option B is recommended but needs owner approval
2. **2014 vs 2024 rules family**: Source manifest has 0 "mixed" entries; all sources are either 2014 or 2024. Items shared between editions (most mundane equipment) will need `rulesVersion: "shared"` records.
3. **Deprecation policy**: 13 structural duplicates need to be resolved — which record is canonical?
4. **Rarity standardization**: "Common" vs "Mundane" for non-magical gear must be decided

### Risks to Monitor
- **Test gap**: Zero tests for item logic means any change is risky. Tests MUST be added during Phase D integration.
- **Name-based fallback fragility**: If we change item names AND IDs simultaneously, saved characters lose enrichment.
- **`catalogItemToInventory()`**: Must be updated to map new fields to `InventoryItem` when adding items from the canonical catalog.

---

## 6. Phase B Readiness Assessment

| Gate | Status | Notes |
|---|---|---|
| Repository audit complete | ✅ | All consumers identified, ID flow traced, risks documented |
| Catalog profiled | ✅ | All 1,055 items analyzed, anomalies documented |
| Source manifest complete | ✅ | 71 sources, 51 included, all accessible |
| Schema designed | ✅ | Option B recommended with full type definitions |
| Schema strategy approved | ⚠️ PENDING | Needs owner sign-off on Option B |
| Baseline backup created | ✅ | `rules-research/items/baseline-items.json` |

**Phase B is ready to proceed** once the schema strategy is confirmed. The research agents can begin populating the canonical catalog with researched items.

---

## 7. Next Steps (Phase B)

1. **Lock schema** — Confirm Option B or select alternative
2. **Create `items.canonical.json`** — Seed with current items in canonical format
3. **Create `scripts/build-items-legacy.mjs`** — Build script for legacy format
4. **Spawn research agents** (Agents 5-11):
   - 2014 mundane equipment (Agent 5)
   - 2024 mundane equipment (Agent 6)
   - Core magic items (Agent 7)
   - Supplement magic items (Agent 8)
   - Setting items (Agent 9)
   - Adventure items (Agent 10)
   - Edge categories (Agent 11)
5. **Validate all candidate files** against canonical schema
6. **Proceed to Phase C (comparison)**
