# Current Catalog Profile: `src/data/items.json` (1,055 Records)

Generated: 2026-07-16 | Corrected: 2026-07-17

## 1. Basic Counts

### By Category (17 categories, 1,055 total)
| Category | Count | % |
|---|---|---|
| Scroll | 320 | 30.3% |
| Wondrous Items | 199 | 18.9% |
| Adventuring Gear | 192 | 18.2% |
| Weapon | 108 | 10.2% |
| Potions & Oils | 47 | 4.5% |
| Armor | 42 | 4.0% |
| Tools | 39 | 3.7% |
| Ring | 29 | 2.7% |
| Wand | 15 | 1.4% |
| Poisons | 14 | 1.3% |
| Food & Drink | 14 | 1.3% |
| Staff | 12 | 1.1% |
| Mount | 8 | 0.8% |
| Tack | 8 | 0.8% |
| Rod | 6 | 0.6% |
| Elixir | 1 | 0.1% |
| Musical Instrument | 1 | 0.1% |

### By Rarity
| Rarity | Count | % |
|---|---|---|
| Common | 314 | 29.8% |
| Rare | 214 | 20.3% |
| Uncommon | 208 | 19.7% |
| Very Rare | 155 | 14.7% |
| Legendary | 83 | 7.9% |
| Mundane | 78 | 7.4% |
| Artifact | 3 | 0.3% |

### By Attunement
- Attunement required: 202 (19.1%)
- No attunement: 853 (80.9%)

### Empty/Missing Fields (with raw counts)
| Field | Empty Count | Total | % Empty |
|---|---|---|---|
| id | 0 | 1,055 | 0% |
| name | 0 | 1,055 | 0% |
| description | 0 | 1,055 | 0% |
| category | 0 | 1,055 | 0% |
| rarity | 0 | 1,055 | 0% |
| cost | 0 | 1,055 | 0% |
| attunement | 0 | 1,055 | 0% |
| image | 896 | 1,055 | 84.93% |
| damageType | 1,054 | 1,055 | 99.91% |
| damage | 991 | 1,055 | 93.93% |
| ac | 1,029 | 1,055 | 97.54% |
| properties | 864 | 1,055 | 81.90% |
| classification | 74 | 1,055 | 7.01% |

### Weapon-Specific Stats
| Metric | Missing | Total | % |
|---|---|---|---|
| damageType | 107 | 108 | 99.07% |
| damage | 44 | 108 | 40.74% |
| properties | 43 | 108 | 39.81% |

Only 1 weapon has damageType populated: Scimitar of Speed (`scimitar-of-speed-342`, "Slashing").

### Armor-Specific Stats
| Metric | Missing | Total | % |
|---|---|---|---|
| ac | 16 | 42 | 38.10% |

---

## 2. Duplicate Detection

### Duplicate Names (case-insensitive): 1 group (2 records)
- **Oil of Taggit** — `oil-of-taggit-192` (Poisons/Uncommon) AND `oil-of-taggit` (Potions & Oils/Uncommon)

### Structural Duplicates (same item, two ID conventions): 13 groups
Arcane Focus (5 variants), Druidic Focus (4 variants), and Holy Symbol (3 variants) exist twice — once with comma-separated name and `-N` ID, once with dash-separated name and no numeric suffix.

### Names with Quantity Suffixes: 5
- Arrows (20), Blowgun Needles (50), Crossbow Bolts (20), Sling Bullets (20), Spikes, Iron (10)

---

## 3. Data Quality Issues

- **Non-Title-Case Names**: 394 items (mostly legitimate SRD conventions: "Alchemist's supplies", "Scale mail")
- **Curly Apostrophes**: 16 items use curly quotes; 432 use straight quotes
- **Em-Dash vs Hyphen**: 8 items contain em/en-dashes
- **Whitespace Issues**: 0
- **Non-numeric costs**: 0
- **Negative costs**: 0
- **Zero-cost items**: 147

---

## 4. Category-Specific Checks

### Weapons (108 items)
- **Missing damage**: 44 of 108 (40.74%) — generic magic templates, ammunition, and net
- **Missing damageType**: 107 of 108 (99.07%) — only Scimitar of Speed has it
- **Classification**: "Simple Melee Weapon" (singular, 21 items) vs "Martial Melee Weapons" (plural, 38 items)

### Armor (42 items)
- **Missing AC**: 16 of 42 (38.10%) — generic magic templates and a few specific items
- **Classification redundancy**: "Medium or Heavy (except Hide)" and "Medium or Heavy (but not Hide)"

### Magic Items
- **Wondrous Items (199)**: 74 have empty classification; 125 have "Wondrous Item"
- **Ring (29)**: Legendary (12), Rare (9), Uncommon (5), Very Rare (3)
- **Scrolls (320)**: Classification field used for spell school/level metadata instead of "Spell Scroll"

---

## 5. Rarity Analysis — Taxonomy Conflict

### The "Common vs Mundane" Problem

The current `rarity` field serves multiple conflicting purposes:

- **78 items** use `"Mundane"` — trash/treasure items
- **185 items** are non-magical equipment but use `"Common"` — Adventuring Gear, Tools, Food, Mounts, Tack, Instruments
- **41 mundane weapons** use `"Common"`
- **11 mundane armor pieces** use `"Common"` (except Plate at `"Rare"`)
- **1 genuine Common magic item**: Clothes of Mending

**This is a taxonomy conflict, not a confirmed source-rule error.** The field likely conflates:
- Magic-item rarity (common/uncommon/rare/etc.)
- General availability
- UI grouping
- Legacy categorization

The canonical schema resolves this by separating `magical: boolean` from `rarity: CanonicalRarity | null`. Typical mundane equipment should use `{ magical: false, rarity: null }`. The legacy `"Mundane"` or `"Common"` string is preserved in `_legacyRarity` for backward compatibility.

---

## 6. Cost Analysis

### Distribution (in copper pieces)
| Metric | Value |
|---|---|
| Min | 0 (147 items) |
| P10 | 0 cp |
| P25 | 100 cp (1 gp) |
| Median | 12,000 cp (120 gp) |
| P75 | 200,000 cp (2,000 gp) |
| P90 | 1,000,000 cp (10,000 gp) |
| Max | 16,500,000 cp (165,000 gp) |

### Price Status Breakdown
A zero or missing cost can mean different things:
- **Not listed**: Most magic items have no official purchase price in 5e
- **Varies**: Template items whose cost depends on the base item and enhancement bonus
- **Not applicable**: Artifacts, story items, narrative objects
- **Unknown**: Not yet researched

**Cost verification scope**: All mundane equipment records with an official listed SRD price were compared against that source. Magic items, templates, and items without official listed prices are not included in that comparison.

### Top 5 Most Expensive
| Item | Cost (cp) | Cost (gp) | Rarity |
|---|---|---|---|
| Holy Avenger Greatsword | 16,500,000 | 165,000 | Legendary |
| Amulet of the Planes | 16,000,000 | 160,000 | Very Rare |
| Decanter of Endless Water | 13,500,000 | 135,000 | Uncommon |
| Obsidian Steed | 12,800,000 | 128,000 | Very Rare |
| Staff of Power | 9,550,000 | 95,500 | Very Rare |

---

## 7. Description Analysis

- **Average length**: 468 characters
- **Median length**: 274 characters
- **Min**: 15 characters ("Saw")
- **Max**: 3,910 characters ("Spell Scroll: Prismatic Wall (9th Level)")
- **Very short (< 30 chars)**: 33 items
- **Very long (> 1,000 chars)**: 135 items (mostly spell scrolls)
- **Shared description prefixes**: 32 groups (templated items)

---

## 8. ID Patterns

- IDs with numeric suffix (-N): 513 (48.6%)
- IDs without numeric suffix: 542 (51.4%)
- ID length: min=4, max=50, average=21 characters

---

## 9. Image Field

- Items with image: 159 (15.1%)
- Items without image: 896 (84.9%)
- Image values are simple key references (e.g., "dagger", "handaxe")

---

## 10. Key Anomalies

See `current-data-anomalies.json` for the complete list with raw counts. Summary:

| Severity | Count | Key Issues |
|---|---|---|
| High | 16 | 13 structural duplicates, Plate wrong rarity (requires inspection), Oil of Taggit duplicate |
| Medium | 4 | Taxonomy conflict (Common vs Mundane — 185 vs 78 items), 147 zero-cost items (ambiguous meaning), scroll classification misuse, 107 of 108 weapons missing damageType (99.07%) |
| Low | 2 | Weapon classification singular/plural, curly apostrophes |
