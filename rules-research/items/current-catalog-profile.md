# Current Catalog Profile: `src/data/items.json` (1,055 Records)

Generated: 2026-07-16

## 1. Basic Counts

### By Category
| Category | Count |
|---|---|
| Scroll | 320 |
| Wondrous Items | 199 |
| Adventuring Gear | 192 |
| Weapon | 108 |
| Potions & Oils | 47 |
| Armor | 42 |
| Tools | 39 |
| Ring | 29 |
| Wand | 15 |
| Poisons | 14 |
| Food & Drink | 14 |
| Staff | 12 |
| Mount | 8 |
| Tack | 8 |
| Rod | 6 |
| Elixir | 1 |
| Musical Instrument | 1 |

### By Rarity
| Rarity | Count |
|---|---|
| Common | 314 |
| Rare | 214 |
| Uncommon | 208 |
| Very Rare | 155 |
| Legendary | 83 |
| Mundane | 78 |
| Artifact | 3 |

### By Attunement
- Attunement required: 202 (19.1%)
- No attunement: 853 (80.9%)

### Empty/Missing Fields
| Field | Empty Count | % Empty |
|---|---|---|
| id | 0 | 0% |
| name | 0 | 0% |
| description | 0 | 0% |
| category | 0 | 0% |
| rarity | 0 | 0% |
| cost | 0 | 0% |
| attunement | 0 | 0% |
| image | 896 | 84.9% |
| damageType | 1,054 | 99.9% |
| damage | 991 | 93.9% |
| ac | 1,029 | 97.5% |
| properties | 864 | 81.9% |
| classification | 74 | 7.0% |

---

## 2. Duplicate Detection

### Duplicate Names (case-insensitive): 1
- **Oil of Taggit** — appears as `oil-of-taggit-192` (Poisons/Uncommon) AND `oil-of-taggit` (Potions & Oils/Uncommon). Identical name, different categories, different IDs.

### Structural Duplicates (same item, two ID conventions): 13
Arcane Focus, Druidic Focus, and Holy Symbol variants exist twice — once with comma-separated name and `-N` ID, once with dash-separated name and no numeric suffix. These are the same items.

### Names with Quantity Suffixes: 5
- Arrows (20)
- Blowgun Needles (50)
- Crossbow Bolts (20)
- Sling Bullets (20)
- Spikes, Iron (10)

---

## 3. Data Quality Issues

- **Non-Title-Case Names**: 394 items (mostly legitimate SRD conventions)
- **Curly Apostrophes**: 16 items use curly quotes; 432 use straight
- **Em-Dash vs Hyphen**: 8 items contain em/en-dashes
- **Whitespace Issues**: 0
- **Non-numeric costs**: 0
- **Negative costs**: 0
- **Zero-cost items**: 147 (mostly magic item templates)

---

## 4. Category-Specific Checks

### Weapons (108 items)
- **Missing damage**: 44 (generic magic templates + ammunition + net)
- **Missing damageType**: 107 (only Scimitar of Speed has it populated)
- **Classification singular/plural**: "Simple Melee Weapon" (singular, 21 items) vs "Martial Melee Weapons" (plural, 38 items)

### Armor (42 items)
- **Missing AC**: 16 (generic magic armor templates + Dwarven Plate + Flesh Shield + Old Round Shield)
- **Classification redundancy**: "Medium or Heavy (except Hide)" and "Medium or Heavy (but not Hide)" mean the same thing

### Magic Items
- **Wondrous Items (199)**: 74 have empty classification (specific named items); 125 have "Wondrous Item"
- **Ring (29)**: Legendary (12), Rare (9), Uncommon (5), Very Rare (3)
- **Scrolls (320)**: Classification field used for spell school/level metadata instead of item classification

### Mundane Gear
- Cost validation against SRD: All verified correct (in copper pieces)
- **Plate armor at "Rare" is suspect**: Standard plate should be "Common" or "Mundane"

---

## 5. Rarity Analysis

### Mundane vs Common Confusion
- 78 items marked "Mundane" (trash/treasure items)
- 185 items are non-magical mundane equipment but marked "Common" (Adventuring Gear, Tools, Food, Mounts, Tack, Instruments)
- 41 mundane weapons marked "Common"
- 11 mundane armor pieces marked "Common" (except Plate at "Rare")
- Only 1 genuine Common magic item: Clothes of Mending

---

## 6. Cost Analysis

### Distribution (in copper pieces)
- Min: 0 (147 items)
- 10th percentile: 0 cp
- 25th percentile: 100 cp (1 gp)
- Median: 12,000 cp (120 gp)
- 75th percentile: 200,000 cp (2,000 gp)
- 90th percentile: 1,000,000 cp (10,000 gp)
- Max: 16,500,000 cp (Holy Avenger Greatsword, 165,000 gp)

### Cost ranges
| Range (cp) | Count |
|---|---|
| 0 | 147 |
| 1-10 | 43 |
| 11-100 | 80 |
| 101-1,000 | 100 |
| 1,001-10,000 | 151 |
| 10,001-100,000 | 251 |
| 100,001-1,000,000 | 187 |
| >1,000,000 | 96 |

### Top 5 Most Expensive
| Item | Cost (cp) | Cost (gp) | Rarity |
|---|---|---|---|
| Holy Avenger Greatsword | 16,500,000 | 165,000 | Legendary |
| Amulet of the Planes | 16,000,000 | 160,000 | Very Rare |
| Decanter of Endless Water | 13,500,000 | 135,000 | Uncommon |
| Obsidian Steed | 12,800,000 | 128,000 | Very Rare |
| Staff of Power | 9,550,000 | 95,500 | Very Rare |

### GP-vs-CP Check
All costs verified correct in copper pieces. Examples:
- Longsword: 1,500 cp = 15 gp ✓
- Plate: 150,000 cp = 1,500 gp ✓
- Dagger: 200 cp = 2 gp ✓
- Club: 10 cp = 1 sp ✓

---

## 7. Description Analysis

- **Average length**: 468 characters
- **Median length**: 274 characters
- **Min**: 15 characters ("Saw" — "A simple one-hand saw")
- **Max**: 3,910 characters ("Spell Scroll: Prismatic Wall (9th Level)")

### Very Short (< 30 chars): 33 items
Mostly mundane weapons with formulaic descriptions or container capacity notes.

### Very Long (> 1,000 chars): 135 items
Mostly spell scrolls with full spell descriptions.

### Shared Description Prefixes: 32 groups
Multiple items share templated descriptions (arcane/druidic foci, artisan's tools, musical instruments, Ioun Stones, Figurines of Wondrous Power, Bag of Tricks variants, Potions of Resistance, etc.)

---

## 8. ID Patterns

- IDs with numeric suffix (-N): 513 (48.6%)
- IDs without numeric suffix: 542 (51.4%)
- ID length: min=4, max=50, average=21 characters
- All lowercase kebab-case, no uppercase, no special characters beyond hyphens

### Pattern
Early equipment uses sequential numbering: `leather-1`, `padded-2`, …, `spikes-iron-10-142`. Later magic items use descriptive kebab-case: `berserker-axe`, `spell-scroll-acid-arrow`.

---

## 9. Image Field

- Items with image: 159 (15.1%)
- Items without image: 896 (84.9%)
- Image values are simple key references (e.g., "dagger", "handaxe") without path or extension

---

## 10. Key Anomalies Summary

See `current-data-anomalies.json` for the complete list. Highlights:

| Severity | Count | Key Issues |
|---|---|---|
| High | 16 | 13 structural duplicates, Plate wrong rarity, Oil of Taggit duplicate |
| Medium | 4 | 185 items wrong rarity, 147 zero-cost templates, missing damageType, scroll classification misuse |
| Low | 2 | Weapon classification singular/plural, curly apostrophes |
