## Plan: Comprehensive D&D 5e Item Catalog

### Goal
Replace the current 541-item catalog with a comprehensive ~1,000+ item catalog covering all D&D 5e equipment, magic items, potions, scrolls, elixirs, and more — organized into properly separated categories.

### Subagent Team (5 agents, 4 run in parallel)

**Agent 1: Merge & Normalize**
- Merge items.json + complete-catalog.json
- Deduplicate by name+category (~200 duplicates)
- Normalize all fields to CatalogItem type
- Preserve images from items.json, add weights from catalog
- Output: single merged JSON array

**Agent 2: Spell Scrolls**  
- Generate spell scroll for every spell at appropriate level
- Rarity: cantrip/1st→Common, 2nd-3rd→Uncommon, 4th-5th→Rare, 6th-8th→Very Rare, 9th→Legendary
- Name format: "Spell Scroll: Fireball (3rd Level)"
- Merge with existing Scroll of Protection
- Output: ~300+ scroll entries

**Agent 3: Potions, Elixirs & Oils**
- Catalog all DMG + SRD potions missing from current set
- Add Elixirs as separate sub-category (Elixir of Health, etc.)
- Identify missing oils
- Output: ~50+ potion/elixir/oil entries

**Agent 4: Category Restructure**
- Split Wondrous Items (175) into Rings, Rods, Staves, Wands, remaining Wondrous
- Add missing weights
- Add classification sub-tags
- Remove {modifier} template junk items
- Output: reorganized categories

**Agent 5: QA & Integration** (runs after 1-4)
- Validate unique IDs, standardized rarities, complete descriptions
- Update ITEM_CATEGORIES/ITEM_RARITIES in itemCatalog.ts
- Verify UI filters work with new categories
- Output: final clean catalog

### Final Category Structure
Armor, Weapons, Ammunition, Adventuring Gear, Tools, Poisons, Potions & Oils, Elixirs, Scrolls, Rings, Rods, Staves, Wands, Wondrous Items

### Data Sources (all already in repo)
items.json (active), complete-catalog.json (reference), magic-items.json, adventuring-gear.json, weapons.json, armor.json, spells.json

### No breaking changes
Character inventory, equipment slots, combat calculations, loot system, and API routes remain unchanged