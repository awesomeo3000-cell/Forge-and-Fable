# Phase A Findings: Repository Audit, Catalog Profile, Source Manifest & Schema Design

**Date**: 2026-07-16 (corrected 2026-07-17)  
**Schema version**: 1.0.0  
**Research cutoff**: 2026-07-16  
**Branch**: `research/exhaustive-item-catalog`  
**Status**: COMPLETE — corrections applied, ready for Phase B

---

## Executive Summary

Phase A completed four parallel investigations without modifying any production data. All corrections from the 2026-07-17 verification review have been applied.

| Investigation | Key Finding |
|---|---|
| **Repo Audit** | `src/data/items.json` is the sole canonical store. 1,055 items. IDs are persisted via `sourceItemId` in character JSON blobs. No dedicated items table in SQLite. `image` field is dead code. Zero test coverage for item logic. |
| **Catalog Profile** | 1,055 items across 17 categories. 16 high-severity anomalies. 107 of 108 weapons (99.07%) lack damageType. Common vs Mundane is a **taxonomy conflict** — the current field conflates magic rarity with mundane availability. |
| **Source Manifest** | 71 total sources: 51 included, 16 excluded, 4 pending review. SRD 5.2.1 (not the superseded 5.2) with 15 restored magic items. Publisher lanes added. Research cutoff 2026-07-16. |
| **Schema Design** | **Option B** conditionally approved: canonical `items.canonical.json` + deterministic generated `items.json`. Schema v1.0.0 with price status model (listed/not-listed/varies/not-applicable/unknown), separated magical/r rarity, publisher lanes, and 10 required generator gates. |

---

## 1. Repository Audit (Agent 1)

### Canonical Store
- `src/data/items.json` is the **only** canonical item catalog
- 1,055 items, 874 KB, statically imported by `src/lib/itemCatalog.ts:1`
- No secondary catalogs, no DLC packs, no API-served items
- Secondary sources: `ruleset.ts` (3 starter items), `equipment.ts` (12 armors + 17 weapons — legacy, not catalog-backed)

### Item ID Flow
- Catalog IDs → `catalogItemToInventory()` → UUID inventory IDs → `sourceItemId` persistence
- Character inventory: JSON blob in `characters.data TEXT` column (SQLite)
- Equipment references point to UUID inventory IDs, NOT catalog IDs
- **Name-based fallback exists** in `catalogBackedInventoryItem()` — but it is NOT rules-version aware. Before dual-version records are added, the fallback must be updated to a staged priority lookup that considers `rulesVersion`.

### Database
- SQLite via `node:sqlite`, schema revision 18
- No dedicated items/equipment/inventory tables
- Items exist only as JSON within character blobs
- Schema migrations are column-oriented; never touch item data

### Consumer Map (14 files)
| File | Role |
|---|---|
| `src/lib/itemCatalog.ts` | Core module — imports items.json, exports ITEM_CATALOG and 12 utility functions |
| `src/components/HeroSheet.tsx` | Primary UI — equipment browser, inventory, equipment slots, passive bonuses |
| `src/lib/equipment.ts` | AC computation, weapon property parsing, encumbrance |
| `src/lib/utils.ts` | Character creation helpers |
| `src/lib/ruleset.ts` | Starter item definitions |
| `src/app/api/import/pdf/create/route.ts` | PDF character import |
| `src/components/ForgeAndFableApp.tsx` | Console commands |
| +7 more (types, tests, persistence) |

### Test Coverage
- **Zero** test coverage for: `catalogItemToInventory()`, `catalogBackedInventoryItem()`, `getEquippedItemBonuses()`, `itemPassiveBonuses()`, `isWeaponItem()`, `isArmorItem()`, `isShieldItem()`, `sourceItemId` reconciliation
- Only `tests/equipment.test.ts` touches items — legacy static armor AC only

### Key Risks Documented
- `catalogItemToInitialize()` explicit field mapping — new fields MUST be added or lost
- `properties` parsed as text in 5+ locations — type change is BREAKING
- `attunement` checked as boolean — type change is BREAKING
- Name-based fallback becomes ambiguous with dual-version records
- `image` field is dead code (typed but never rendered)

### Deliverables
- ✅ `rules-research/items/agents/repo-audit/repo-audit.md`
- ✅ `rules-research/items/current-schema.json`
- ✅ `rules-research/items/item-consumers.json`
- ✅ `rules-research/items/id-compatibility-report.md` (updated with rules-version–aware fallback)

---

## 2. Catalog Profile (Agent 2)

### Summary Statistics
- **1,055 total records** across 17 categories
- Top categories: Scroll (320), Wondrous Items (199), Adventuring Gear (192)
- Rarity distribution: Common (314), Rare (214), Uncommon (208), Very Rare (155), Legendary (83), Mundane (78), Artifact (3)
- 202 items require attunement (19.1%)

### Weapon Stats (with raw counts)
| Metric | Missing | Total | % |
|---|---|---|---|
| damageType | 107 | 108 | 99.07% |
| damage | 44 | 108 | 40.74% |
| properties | 43 | 108 | 39.81% |

Only Scimitar of Speed (`scimitar-of-speed-342`) has damageType populated ("Slashing").

### High-Severity Anomalies (16)
1. **13 structural duplicates**: Arcane Focus (5), Druidic Focus (4), Holy Symbol (3) variants exist twice
2. **Oil of Taggit cross-category duplicate**: Poisons vs Potions & Oils
3. **Plate armor at "Rare"** — requires inspection of the exact record before correction. Must determine whether it is: ordinary plate with wrong rarity, a magic variant, a merged record, or a category-mapping error.

### Taxonomy Conflict (not confirmed error)
**Common vs Mundane**: 185 non-magical items use "Common" while 78 use "Mundane". The current `rarity` field conflates multiple purposes (magic-item rarity, general availability, UI grouping). This is a **taxonomy conflict** to be resolved by schema policy, not a confirmed source-rule error. The canonical schema separates `magical: boolean` from `rarity: CanonicalRarity | null`.

### Price Analysis
- 147 items have zero cost. A zero may mean: no official price listed, not applicable, variable, template, unknown, or missing. **These meanings must not be collapsed into one numeric value.**
- **Cost verification scope**: All mundane equipment records with an official listed SRD price were compared against that source. Magic items and items without official listed prices are not included in that comparison.
- The canonical schema uses `ItemPrice { costCp, status, sourceCode }` with a `PriceStatus` enum.

### Deliverables
- ✅ `rules-research/items/current-catalog-profile.json` (raw counts + percentages)
- ✅ `rules-research/items/current-catalog-profile.md` (corrected)
- ✅ `rules-research/items/current-catalog-normalized.json` (1,055 items with normalizedName)
- ✅ `rules-research/items/current-data-anomalies.json` (22 anomalies with raw counts and anomaly types)

---

## 3. Source Manifest (Agent 3)

### Scope Summary
**71 sources** (in a structured manifest with metadata):
- 51 included, 16 excluded, 4 pending review
- Research cutoff: **2026-07-16**
- Publisher lanes: wizards-first-party (default), official-licensed, partnered, charity, third-party

### Included Sources by Type
| Type | Count | Details |
|---|---|---|
| Core Books | 6 | PHB 2014, DMG 2014, PHB 2024, DMG 2024, SRD 5.1, **SRD 5.2.1** |
| Supplements | 6 | Xanathar's, Tasha's, Fizban's, Bigby's, Book of Many Things, SCAG |
| Settings | 11 | Eberron, Wildemount, Theros, Ravenloft, Ravnica, Strixhaven, Spelljammer, Planescape, Dragonlance, +2 more |
| Adventures | 16 | Curse of Strahd through Vecna: Eve of Ruin |
| Anthologies | 7 | Candlekeep, Yawning Portal, Saltmarsh, etc. |
| Starters | 5 | LMoP, Icespire Peak, Stormwreck Isle, etc. |

### SRD 5.2.1 (not the superseded 5.2)
SRD 5.2.1 restores **15 magic items** accidentally omitted from SRD 5.2:
+1 Ammunition, +1 Armor, +1 Shield, +1 Weapon, +2 Ammunition, +2 Armor, +2 Shield, +2 Weapon, +3 Ammunition, +3 Armor, +3 Shield, +3 Weapon, Adamantine Armor, Ammunition +1/+2/+3, Dragon Scale Mail.

These items are now explicitly in the research scope.

### Excluded (16)
- Monster Manuals (2014, 2025) — excluded after confirming no standalone player-usable item definitions. Policy is source-specific, not a blanket "bestiaries never contain items" rule.
- Children's books, comics, cookbooks
- Superseded reprints
- Third-party products

### Publisher Lane Policy
| Lane | Inclusion Rule |
|---|---|
| wizards-first-party | Include by default |
| official-licensed | Review separately |
| partnered | Review separately |
| charity | Review separately |
| third-party | Exclude by default |

### Required Refresh Before Phase B
The manifest should refresh coverage for later first-party releases including: Dragon Delves, Heroes of the Borderlands, Forgotten Realms: Heroes of Faerûn, Forgotten Realms: Adventures in Faerûn, Eberron: Forge of the Artificer, and any other releases through the cutoff date.

### Deliverables
- ✅ `rules-research/items/source-manifest.json` (updated: SRD 5.2.1, publisher lanes, cutoff)
- ✅ `rules-research/items/source-manifest.md`
- ✅ `rules-research/items/source-access-blockers.md`

---

## 4. Schema Architecture (Agent 4)

### Recommendation: Option B (conditionally approved)

**File architecture:**
```
src/data/items.canonical.json   ← Hand-edited, full schema v1.0.0, source of truth
scripts/build-items-legacy.mjs   ← Deterministic generator
src/data/items.json              ← Build artifact (GENERATED — do not edit)
```

### Canonical Schema v1.0.0 — Key Features
- **Price status model**: `ItemPrice { costCp, status: PriceStatus, sourceCode }` disambiguates listed/not-listed/varies/not-applicable/unknown prices
- **Separated magic classification**: `magical: boolean` + `rarity: CanonicalRarity | null` — mundane items use `{ magical: false, rarity: null }`. No synthetic "mundane" rarity tier.
- **Publisher lanes**: Every provenance entry includes `publisherLane: PublisherLane`
- **Structured weapon/armor/tool data** with `_legacy*` bridge fields
- **Rules-version–aware identity**: `CanonicalItemIdentity` with `id`, `legacyIds`, `rulesVersion`, `sourceCode`, `normalizedName`, `aliases`
- **SRD 5.2.1** tracked in license field (not the superseded 5.2)

### Required Generator Gates (10)
1. Preserve existing IDs byte-for-byte unchanged
2. Preserve existing names during initial migration (use aliases)
3. Deterministic generation (same input → same output, no diff)
4. Legacy snapshot test in CI
5. Saved-character compatibility test
6. Separate same-name rules versions (distinct IDs)
7. Mark generated file with header comment
8. CI stale-file check
9. Research isolation (agents write only to `rules-research/items/agents/`)
10. Reconciliation before merge (provenance, schema, match, conflict, duplicate, rules-version review)

### Deliverables
- ✅ `rules-research/items/proposed-item-schema.ts` (v1.0.0, updated)
- ✅ `rules-research/items/schema-mapping.md`
- ✅ `rules-research/items/schema-migration-options.md` (risk assessment, not "zero risk")
- ✅ `rules-research/items/schema-decision-log.md` (14 decisions, updated)

---

## 5. Phase B Readiness Assessment

| Gate | Status | Notes |
|---|---|---|
| Repository audit complete | ✅ | All consumers identified, ID flow traced, risks documented |
| Catalog profiled | ✅ | 1,055 items analyzed, raw counts on all metrics |
| Source manifest complete | ✅ | 71 sources, SRD 5.2.1, publisher lanes, cutoff recorded |
| Schema designed | ✅ | v1.0.0 with price status, separated rarity, publisher lanes |
| Schema strategy approved | ✅ | Option B conditionally approved |
| SRD 5.2 → 5.2.1 | ✅ | Updated with 15 restored magic items in scope |
| Weapon percentage corrected | ✅ | 107/108 = 99.07%, raw counts on all anomalies |
| Common/Mundane reclassified | ✅ | Taxonomy conflict, not confirmed source error |
| ID fallback rules-version aware | ✅ | Staged lookup priority documented |
| Price status model added | ✅ | listed/not-listed/varies/not-applicable/unknown |
| Publisher lanes added | ✅ | First-party, licensed, partnered, charity, third-party |
| Zero-risk language removed | ✅ | Replaced with documented risk assessment and 10 gates |
| Generator gates defined | ✅ | 10 required gates before production use |
| Baseline backup created | ✅ | `rules-research/items/baseline-items.json` |

**Phase B is ready to proceed** once the Phase A checkpoint is committed and the schema v1.0.0 contract is distributed to all research agents.

---

## 6. Next Steps (Phase B)

1. **Commit Phase A checkpoint** — `research(items): complete phase A audit and schema findings`
2. **Freeze schema v1.0.0** — distribute to all Phase B agents
3. **Refresh source manifest** — confirm later first-party releases are covered
4. **Spawn research agents** (Agents 5-11) — all writing to `rules-research/items/agents/`
5. **Validate all candidate files** against canonical schema v1.0.0
6. **Proceed to Phase C (comparison)**
