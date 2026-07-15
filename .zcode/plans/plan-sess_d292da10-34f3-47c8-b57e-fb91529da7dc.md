## Plan: Comprehensive D&D 5e Creature Library

### Current State
- Only **8 built-in creatures** (goblin, wolf, skeleton, orc, bugbear, ogre, troll, air elemental) — hardcoded in TypeScript
- Well-designed `CreatureLibraryRecord` type already supports: abilities, traits, actions, bonus actions, reactions, legendary actions, lair actions, environments, tags, CR, XP, AC, HP, speed, saves, skills, senses, languages, vulnerabilities, resistances, immunities
- DM can manually create custom creatures — this just gives them a pre-loaded library
- Encounter generator, initiative tracker, and DM table are all built and ready — they just need a creature library to pull from

### Data Source: 5e SRD
The SRD (Systems Reference Document) contains ~300 creatures and is freely distributable — same license as the spells and items already in the codebase. Non-SRD creatures (from Monster Manual expansions) would need separate data sources.

---

### Subagent Team (4 parallel + 1 integration)

**Agent 1: SRD Creature Data Extraction**
- Source: 5e SRD JSON (available from open 5e APIs/data repos)
- Extract all ~300 creatures with complete stat blocks
- Convert to `CreatureLibraryRecord` format
- Fields per creature: name, creatureType, size, alignment, CR, XP, AC, HP (average + formula), speed, abilities (STR/DEX/CON/INT/WIS/CHA), savingThrows, skills, senses (darkvision, blindsight, etc.), languages, passivePerception, vulnerabilities, resistances, immunities, conditionImmunities, environments
- Output: `tmp/srd-creatures.json` — flat array of ~300 creatures

**Agent 2: Creature Actions & Features**
- Extract traits, actions, bonusActions, reactions, legendaryActions, lairActions for every creature
- Each feature as `{ name, description, attackBonus?, damage?, averageDamage? }`
- Handle complex features (multiattack, spellcasting, breath weapons, etc.)
- For spellcasting creatures: note spell lists in the feature description
- Output: `tmp/srd-creature-features.json` — features keyed by creature ID

**Agent 3: Creature Organization & Metadata**
- Assign environment tags: Arctic, Coastal, Desert, Forest, Grassland, Hill, Mountain, Swamp, Underdark, Urban, Underwater
- Assign behavioral tags: Brute, Skirmisher, Artillery, Controller, Ambusher, Solo, Minion, Leader
- Group by creature type: Aberration, Beast, Celestial, Construct, Dragon, Elemental, Fey, Fiend, Giant, Humanoid, Monstrosity, Ooze, Plant, Undead
- Create NPC template creatures (Bandit, Guard, Cultist, etc.)
- Create hazard entries (traps, environmental dangers)
- Output: `tmp/srd-creature-metadata.json` — tags, environments, groupings

**Agent 4: Encounter Generator Enhancement**
- Create encounter tables for each environment + CR band (e.g., "Forest CR 1-4: wolves, bears, owlbears, dryads, etc.")
- Create thematic packs (e.g., "Goblinoid Raiding Party", "Undead Crypt", "Dragon's Lair Minions")
- Add creature synergy notes (these creatures work well together)
- Output: `tmp/encounter-tables.json` + `tmp/thematic-packs.json`

**Agent 5: QA, Integration & Code Update**
- Merge Agents 1-3 outputs into final `src/data/creatures.json`
- Validate: all IDs unique, required fields present, CR/XP math correct, abilities are valid 1-30
- Update `src/lib/builtInCreatures.ts` — replace hand-coded 8 creatures with import from `creatures.json`
- Update `getBuiltInCreature()` function
- Ensure `dmToolsStore.ts` listCreatures works with new library
- Verify TypeScript compiles
- Output: final `src/data/creatures.json` + updated builtInCreatures.ts

### Final Structure
```
src/data/creatures.json          ~300+ creatures, one flat array
src/lib/builtInCreatures.ts      import + lookup (replaces hardcoded 8)
tmp/encounter-tables.json        environment × CR encounter tables
tmp/thematic-packs.json          pre-built creature groupings
```

### Creature Counts by Type (SRD)
| Type | ~Count |
|---|---|
| Beast | 100 |
| Humanoid (NPCs) | 50 |
| Dragon | 25 |
| Fiend | 25 |
| Undead | 20 |
| Monstrosity | 20 |
| Giant | 10 |
| Aberration | 10 |
| Elemental | 10 |
| Fey | 8 |
| Construct | 8 |
| Celestial | 5 |
| Ooze | 5 |
| Plant | 5 |

### What the DM gets
- Searchable, filterable creature library with 300+ stat blocks
- Creatures organized by type, CR, and environment
- Encounter generator can pull from a real library instead of 8 creatures
- Encounter tables for quick "random encounter by environment"
- Thematic packs for quick encounter assembly
- All existing creature CRUD, duplication, and customization still work